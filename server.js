const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { call, requestToken } = require('./electron/security/transport');
const { authenticate, getSecret } = require('./electron/security/sessions');
const { PUBLIC } = require('./electron/security/access');
const { safePath, segment, authorizeFile } = require('./electron/security/files');

// Global unhandled error & crash safety
process.on('uncaughtException', (err) => {
    console.error('❌ [FATAL] Uncaught Exception:', err?.stack || err);
});

process.on('unhandledRejection', (reason) => {
    console.error('⚠️ [WARNING] Unhandled Promise Rejection:', reason);
});

// Load environment variables if available
try {
    require('dotenv').config();
} catch (e) {}

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    process.env.USE_POSTGRES = 'true';
}

const { getPrismaClient, runAutoMigrations } = require('./electron/prismaClient');
const db = require('./electron/prismaService');
const authService = require('./electron/services/auth.service');
const mfaService = require('./electron/services/mfa.service');
const auditService = require('./electron/services/audit.service');
const sessionService = require('./electron/services/session.service');
const emailTemplateService = require('./electron/services/emailTemplate.service');
const notificationEngine = require('./electron/services/notification-engine.service');
const systemSettingsService = require('./electron/services/systemSettings.service');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// A missing/weak server secret is a startup error, not a development backdoor.
getSecret();
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try { return new URL(origin).host === req.headers.host || allowedOrigins.has(origin); } catch { return false; }
}
app.use((req, res, next) => {
    if (!sameOrigin(req)) return res.status(403).json({ success: false, error: 'İzin verilmeyen kaynak.' });
    next();
});
const requireSession = async (req, res, next) => {
    try { req.actor = await authenticate(requestToken(req), getPrismaClient()); next(); }
    catch (error) { res.status(error.status || 401).json({ success: false, error: 'Geçerli oturum gerekli.' }); }
};
const requirePlatformAdmin = [requireSession, (req, res, next) => req.actor.role === 'superadmin' ? next() : res.status(403).json({ success: false, error: 'Yönetici yetkisi gerekli.' })];

// Security Headers (configured to allow PDF previews & embedded assets)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration
app.use(cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true
}));

// General API Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // Max 2000 requests per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Çok fazla istek yapıldı, lütfen biraz bekleyin.' }
});

// Stricter Auth Rate Limiter for Login/Register
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 40, // Max 40 attempts per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Çok fazla giriş denemesi yapıldı, lütfen 15 dakika bekleyin.' }
});

app.use('/api/', apiLimiter);
app.use('/api/rpc/:method', (req, res, next) => PUBLIC.has(req.params.method) && req.params.method !== 'getAppVersion' ? authLimiter(req, res, next) : next());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health Check Endpoints for Dokploy & Uptime Monitoring
const handleHealthCheck = async (req, res) => {
    try {
        const prisma = getPrismaClient();
        const startTime = Date.now();
        await prisma.$queryRawUnsafe('SELECT 1');
        const latencyMs = Date.now() - startTime;

        const memory = process.memoryUsage();
        res.json({
            status: 'ok',
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            version: require('./package.json').version || '1.13.29',
            database: {
                status: 'connected',
                latencyMs
            },
            memory: {
                rssMb: (memory.rss / (1024 * 1024)).toFixed(1),
                heapUsedMb: (memory.heapUsed / (1024 * 1024)).toFixed(1)
            }
        });
    } catch (err) {
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: 'Database ping failed: ' + err.message
        });
    }
};

app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);

// Automated Database Backup Trigger Endpoint
app.post('/api/admin/backup', ...requirePlatformAdmin, async (req, res) => {
    const { performBackup } = require('./scripts/backup-service');
    const result = await performBackup();
    res.json(result);
});

// Download Backup File Endpoint
app.get('/api/admin/backup/download/:fileName', ...requirePlatformAdmin, (req, res) => {

    const { fileName } = req.params;
    const safeName = path.basename(fileName);
    const backupDir = process.env.BACKUP_DIR || path.join(__dirname, 'backups');
    const filePath = path.join(backupDir, safeName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Yedek dosyası bulunamadı' });
    }

    res.download(filePath, safeName);
});

// Documents are private: a session and an owner are required for every read/write.
let dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
let filesDir = path.join(dataDir, 'files');
try {
    const electronApp = require('electron').app;
    if (electronApp) { dataDir = path.join(electronApp.getPath('userData'), 'data'); filesDir = path.join(electronApp.getPath('userData'), 'files'); }
} catch {}
fs.mkdirSync(filesDir, { recursive: true });

app.use('/uploads', requireSession, async (req, res) => {
    try {
        const name = decodeURIComponent(req.path).replace(/^\/+/, '');
        const target = safePath(filesDir, name);
        await authorizeFile(req.actor, name, getPrismaClient());
        if (!fs.existsSync(target)) {
            const result = await require('./electron/services/supabase.service').downloadFromStorage(name);
            const buffer = result?.buffer || result?.data;
            if (!result?.success || !buffer) return res.sendStatus(404);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, buffer);
        }
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.sendFile(target);
    } catch (error) { res.status(error.status || 400).json({ success: false, error: 'Belgeye erişilemiyor.' }); }
});

const extensions = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv': 'text/csv' };
app.post('/api/upload', requireSession, async (req, res) => {
    try {
        const { fileName, fileData, companyId, module, entityId, category } = req.body;
        const ext = path.extname(fileName || '').toLowerCase();
        if (!extensions[ext] || typeof fileData !== 'string') return res.status(400).json({ success: false, error: 'İzin verilmeyen dosya biçimi.' });
        const cid = Number(companyId);
        if (!Number.isSafeInteger(cid) || cid <= 0) throw new Error('Şirket seçilmelidir.');
        const mod = segment(module || 'documents');
        let folder = `company_${cid}/${mod}/`;
        if (entityId != null) folder += `${mod.endsWith('s') ? mod.slice(0, -1) : mod}_${segment(String(entityId))}/`;
        if (category) folder += `${segment(category)}/`;
        const name = folder + crypto.randomUUID() + ext;
        await authorizeFile(req.actor, name, getPrismaClient(), true);
        const target = safePath(filesDir, name);
        const buffer = Buffer.from(fileData.replace(/^data:[^;]*;base64,/, ''), 'base64');
        if (!buffer.length || buffer.length > 20 * 1024 * 1024) return res.status(400).json({ success: false, error: 'Dosya boyutu 1 bayt–20 MB arasında olmalıdır.' });
        const signatures = { '.pdf': '%PDF-', '.png': '\x89PNG', '.jpg': '\xff\xd8\xff', '.jpeg': '\xff\xd8\xff', '.docx': 'PK', '.xlsx': 'PK', '.doc': '\xd0\xcf\x11\xe0', '.xls': '\xd0\xcf\x11\xe0', '.webp': 'RIFF' };
        if (signatures[ext] && !buffer.subarray(0, Buffer.byteLength(signatures[ext], 'latin1')).equals(Buffer.from(signatures[ext], 'latin1'))) throw new Error('Dosya içeriği uzantıyla eşleşmiyor.');
        const company = await getPrismaClient().companies.findUnique({ where: { id: cid }, select: { storage_limit_mb: true } });
        if (!company) throw new Error('Şirket bulunamadı.');
        const sizeOf = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isSymbolicLink() ? 0 : e.isDirectory() ? sizeOf(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0) : 0;
        if (sizeOf(path.join(filesDir, `company_${cid}`)) + buffer.length > (company.storage_limit_mb ?? 1024) * 1024 * 1024) throw new Error('Depolama kotası aşıldı.');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, buffer, { flag: 'wx' });
        const cloud = await require('./electron/services/supabase.service').uploadToStorage(buffer, name, extensions[ext], 'documents').catch(() => ({ success: false }));
        res.json({ success: true, fileName: name, originalName: fileName, path: name, url: `/uploads/${name}`, cloudSynced: !!cloud?.success });
    } catch (error) { res.status(error.status || 400).json({ success: false, error: error.message }); }
});

// Serve compiled React frontend
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
}

// Comprehensive RPC Dispatch Map (1:1 with window.electronAPI)
const rpcMap = {
    // Auth
    login: authService.loginUser,
    loginUser: authService.loginUser,
    register: authService.registerUser,
    registerUser: authService.registerUser,
    changePassword: authService.changePassword,
    syncPasswordReset: authService.syncPasswordReset,
    requestPasswordReset: authService.requestPasswordReset,
    verifyRecoveryOtp: authService.verifyRecoveryOtp,
    completePasswordReset: authService.completePasswordReset,
    resendVerificationEmail: authService.resendVerificationEmail,
    activateUserByEmail: authService.activateUserByEmail,
    updateProfile: authService.updateProfile,
    getUserProfile: authService.getUserProfile,
    createEmployeeUser: authService.createEmployeeUser,
    sendPersonnelInvite: authService.sendPersonnelInvite,
    syncEmployeesToSupabaseAuth: async (companyId) => {
        const { syncAllEmployeesToSupabaseAuth } = require('./electron/services/supabase.service');
        return await syncAllEmployeesToSupabaseAuth(companyId);
    },

    // Window / System Mocks
    focusWindow: async () => ({ success: true }),
    setFullScreen: async () => ({ success: true }),
    openFolder: async () => ({ success: true }),
    openExternal: async () => ({ success: true }),
    showNotification: async () => ({ success: true }),
    checkForUpdates: async () => ({ success: true, updateAvailable: false }),
    downloadUpdate: async () => ({ success: true }),
    quitAndInstall: async () => ({ success: true }),
    getAppVersion: async () => require('./package.json').version,
    logout: async () => ({ success: true }),

    // Companies
    getCompanies: db.getCompanies,
    createCompany: db.createCompany,
    updateCompany: db.updateCompany,
    deleteCompany: db.deleteCompany,

    // Vehicles
    getVehicles: db.getVehicles,
    getVehicleById: db.getVehicleById,
    createVehicle: db.createVehicle,
    updateVehicle: db.updateVehicle,
    deleteVehicle: db.deleteVehicle,

    // Maintenances
    getMaintenancesByVehicle: db.getMaintenances,
    getAllMaintenances: db.getAllMaintenances,
    createMaintenance: db.createMaintenance,
    updateMaintenance: db.updateMaintenance,
    deleteMaintenance: db.deleteMaintenance,

    // Inspections
    getInspectionsByVehicle: db.getInspections,
    getAllInspections: db.getAllInspections,
    createInspection: db.createInspection,
    updateInspection: db.updateInspection,
    deleteInspection: db.deleteInspection,

    // Insurances
    getInsurancesByVehicle: db.getInsurances,
    getAllInsurances: db.getAllInsurances,
    createInsurance: db.createInsurance,
    updateInsurance: db.updateInsurance,
    deleteInsurance: db.deleteInsurance,

    // Assignments
    getAssignmentsByVehicle: db.getAssignments,
    getAllAssignments: db.getAllAssignments,
    createAssignment: db.createAssignment,
    updateAssignment: db.updateAssignment,
    deleteAssignment: db.deleteAssignment,

    // Services
    getServicesByVehicle: db.getServices,
    getAllServices: db.getAllServices,
    createService: db.createService,
    updateService: db.updateService,
    deleteService: db.deleteService,

    // Aliases for quick actions / compatibility
    addMaintenance: db.createMaintenance,
    addService: db.createService,
    addInspection: db.createInspection,
    addInsurance: db.createInsurance,
    addVehicle: db.createVehicle,
    addAssignment: db.createAssignment,

    // Employees
    getEmployees: db.getEmployees,
    getPayrollSummary: db.getPayrollSummary,
    getEmployeeById: db.getEmployeeById,
    createEmployee: db.addEmployee,
    addEmployee: db.addEmployee,
    updateEmployee: db.updateEmployee,
    deleteEmployee: db.deleteEmployee,

    // Salaries
    getSalaries: db.getSalariesByEmployee,
    getSalariesByCompany: db.getAllSalariesForCompany,
    createSalary: db.createSalary,
    updateSalary: db.updateSalary,
    deleteSalary: db.deleteSalary,
    createSalaryHistory: db.createSalaryHistory,
    updateSalaryHistory: db.updateSalaryHistory,
    deleteSalaryHistory: db.deleteSalaryHistory,

    // Leaves
    getLeaves: db.getLeavesByEmployee,
    getLeavesByCompany: db.getAllLeaves,
    createLeave: db.createLeave,
    updateLeave: db.updateLeave,
    deleteLeave: db.deleteLeave,

    // Overtimes
    getOvertimes: db.getOvertimes,
    getAllOvertimes: db.getAllOvertimes,
    createOvertime: db.addOvertime,
    updateOvertime: db.updateOvertime,
    deleteOvertime: db.deleteOvertime,

    // Employee Assignments
    getEmployeeAssignments: db.getEmployeeAssignments,
    createEmployeeAssignment: db.addEmployeeAssignment,
    updateEmployeeAssignment: db.updateEmployeeAssignment,
    deleteEmployeeAssignment: db.deleteEmployeeAssignment,

    // Employee Documents
    getEmployeeDocuments: db.getEmployeeDocuments,
    getUpcomingPersonnelDocuments: db.getUpcomingPersonnelDocuments || db.getUpcomingDocuments,
    createEmployeeDocument: db.addEmployeeDocument,
    updateEmployeeDocument: db.updateEmployeeDocument,
    deleteEmployeeDocument: db.deleteEmployeeDocument,

    // Employee Movements
    getAllEmployeeMovements: db.getAllEmployeeMovements,
    addEmployeeMovement: db.addEmployeeMovement,
    updateEmployeeMovement: db.updateEmployeeMovement,
    deleteEmployeeMovement: db.deleteEmployeeMovement,

    // Finance / Transactions
    getAllFinance: db.getTransactions,
    getTransactions: db.getTransactions,
    getFinanceById: db.getTransactionById,
    createFinance: db.createTransaction,
    updateFinance: db.updateTransaction,
    deleteFinance: db.deleteTransaction,
    getFinanceStats: db.getFinanceStats,
    getChecks: db.getChecksAndNotes,
    updateCheckStatus: (payload) => db.updateCheckStatus(payload?.id, payload?.status),

    // Meal Tickets
    getMealTickets: db.getMealTickets,
    createMealTicket: db.addMealTicket,
    updateMealTicket: db.updateMealTicket,
    deleteMealTicket: db.deleteMealTicket,
    getMealTicketStats: db.getMealTicketStats,
    getMealPrice: db.getMealPrice,
    setMealPrice: db.setMealPrice,
    getMealPriceHistory: db.getMealPriceHistory,
    deleteMealPriceHistory: db.deleteMealPriceHistory,
    updateMealPriceHistory: db.updateMealPriceHistory,
    getMealTicketReport: (data) => db.getMealTicketReport(data?.companyId, data?.month, data?.year),

    // Works & Operations
    getWorks: db.getWorks,
    getWorkDetails: db.getWorkDetails,
    createWork: db.createWork,
    addWork: db.createWork,
    updateWork: db.updateWork,
    deleteWork: db.deleteWork,
    deleteWorks: db.deleteWorks,
    archiveWorks: db.archiveWorks,
    addWorkItem: db.addWorkItem,
    addBulkWorkItems: db.addBulkWorkItems,
    updateWorkItem: db.updateWorkItem,
    deleteWorkItem: db.deleteWorkItem,
    deleteBulkWorkItems: db.deleteBulkWorkItems,

    // Customers (Cari)
    getCustomers: db.getCustomers,
    getCustomerDetails: db.getCustomerDetails,
    createCustomer: db.createCustomer,
    addCustomer: db.createCustomer,
    updateCustomer: db.updateCustomer,
    deleteCustomer: db.deleteCustomer,

    // Documents
    getAllDocuments: db.getDocumentsByCompany,
    getDocumentsByVehicle: db.getDocumentsByVehicle,
    addDocument: db.addDocument,
    updateDocument: db.updateDocument,
    deleteDocument: db.deleteDocument,
    readDocumentData: async (fileName) => {
        const actor = require('./electron/security/context').context()?.actor;
        const target = safePath(filesDir, fileName);
        await authorizeFile(actor, fileName, getPrismaClient());
        let buffer;
        if (fs.existsSync(target)) buffer = fs.readFileSync(target);
        else { const result = await require('./electron/services/supabase.service').downloadFromStorage(fileName); if (result?.success) buffer = result.buffer || result.data; }
        return buffer ? { success: true, data: buffer.toString('base64'), fileName: path.basename(fileName), path: fileName, ext: path.extname(fileName) } : { success: false, error: 'Belge bulunamadı.' };
    },

    // Dashboard & Common
    getDashboardStats: db.getDashboardStats,
    getUpcomingEvents: db.getUpcomingEvents,
    getRecentActivity: db.getRecentActivity,
    searchGlobal: db.searchGlobal,
    archiveItem: db.archiveItem,
    archiveItems: db.archiveItems,

    // Backup & Data Export / Import
    exportCompanyData: async (payload) => {
        const { getCompanyCompleteData } = require('./electron/services/backup.service');
        const companyId = payload?.companyId || payload;
        const res = await getCompanyCompleteData(companyId);
        if (res.success && res.data) {

            return {
                success: true,
                backupData: res.data,
                companyName: res.data.company?.name || 'sirket'
            };
        }
        return res;
    },
    importCompanyData: async (userId, backupData) => {
        const { importCompanyData } = require('./electron/services/backup.service');
        return await importCompanyData(userId, backupData);
    },

    // Settings
    getSettings: async (companyId) => {
        const cid = Number(companyId?.companyId || companyId);
        const result = await systemSettingsService.getCompanyDbSettings(cid);
        return result.data || {};
    },
    saveSettings: async settings => systemSettingsService.saveCompanyDbSettings(Number(settings.companyId), settings),
    getPublicHolidays: db.getPublicHolidays,
    createPublicHoliday: db.createPublicHoliday,
    updatePublicHoliday: db.updatePublicHoliday,
    deletePublicHoliday: db.deletePublicHoliday,

    // Personnel Settings
    getDepartments: db.getDepartments,
    createDepartment: db.createDepartment,
    updateDepartment: db.updateDepartment,
    deleteDepartment: db.deleteDepartment,
    getLeaveTypes: db.getLeaveTypes,
    createLeaveType: db.createLeaveType,
    updateLeaveType: db.updateLeaveType,
    deleteLeaveType: db.deleteLeaveType,
    getDocumentCategories: db.getDocumentCategories,
    createDocumentCategory: db.createDocumentCategory,
    updateDocumentCategory: db.updateDocumentCategory,
    deleteDocumentCategory: db.deleteDocumentCategory,
    getDocumentFolders: db.getDocumentFolders,
    createDocumentFolder: db.createDocumentFolder,
    updateDocumentFolder: db.updateDocumentFolder,
    deleteDocumentFolder: db.deleteDocumentFolder,
    getVehicleTypes: db.getVehicleTypes,
    createVehicleType: db.createVehicleType,
    updateVehicleType: db.updateVehicleType,
    deleteVehicleType: db.deleteVehicleType,

    // Requests & Approvals
    createRequest: db.createRequest,
    getRequests: db.getRequests,
    processApproval: db.processApproval,

    // Roles & Granular Permissions
    getRoles: db.getRoles,
    saveRole: db.saveRole,
    deleteRole: db.deleteRole,
    assignUserRole: db.assignUserRoleAndEmployee,
    deleteUserAccount: db.deleteUserAccount,

    // Arvento Vehicle Tracking API
    arventoTestConnection: (credentials) => db.testArventoConnection(credentials),
    arventoGetStatus: (credentials) => db.getArventoVehicleStatus(credentials),
    arventoGetMappings: (credentials) => db.getArventoLicensePlateNodeMappings(credentials),
    arventoGetInfo: (credentials) => db.getArventoVehicleInfo(credentials),
    arventoGetDailyReport: (date, credentials) => db.getArventoVehicleDailyStatus(date, credentials),
    arventoGetAlarms: (credentials) => db.getArventoAlarms(credentials),
    arventoGetHistory: (filters, credentials) => db.getArventoHistory(filters, credentials),
    testArventoConnection: (credentials) => db.testArventoConnection(credentials),
    getArventoVehicleStatus: (credentials) => db.getArventoVehicleStatus(credentials),
    getArventoLicensePlateNodeMappings: (credentials) => db.getArventoLicensePlateNodeMappings(credentials),
    getArventoVehicleInfo: (credentials) => db.getArventoVehicleInfo(credentials),
    getArventoVehicleDailyStatus: (date, credentials) => db.getArventoVehicleDailyStatus(date, credentials),
    getArventoAlarms: (credentials) => db.getArventoAlarms(credentials),
    getArventoHistory: (filters, credentials) => db.getArventoHistory(filters, credentials),

    // Platform Super Admin API
    getPlatformOverview: db.getPlatformOverview,
    getPlatformUsers: db.getPlatformUsers,
    resetPlatformUserPassword: db.resetPlatformUserPassword,
    impersonatePlatformUser: db.impersonatePlatformUser,
    createPlatformUser: db.createPlatformUser,
    sendUserInvite: db.sendUserInvite,
    updatePlatformUser: db.updatePlatformUser,
    deletePlatformUser: db.deletePlatformUser,
    toggleCompanyStatus: db.toggleCompanyStatus,
    toggleUserStatus: db.toggleUserStatus,
    getPlatformBackups: db.getPlatformBackups,
    triggerPlatformBackup: db.triggerPlatformBackup,
    getPlatformSystemHealth: db.getPlatformSystemHealth,
    getPlatformLogs: db.getPlatformLogs,
    clearPlatformLogs: db.clearPlatformLogs,
    getPlatformAnnouncements: db.getPlatformAnnouncements,
    getActiveAnnouncements: db.getActiveAnnouncements,
    createPlatformAnnouncement: db.createPlatformAnnouncement,
    toggleAnnouncementStatus: db.toggleAnnouncementStatus,
    deletePlatformAnnouncement: db.deletePlatformAnnouncement,
    createPlatformCompany: db.createPlatformCompany,
    updatePlatformCompany: db.updatePlatformCompany,
    deletePlatformCompany: db.deletePlatformCompany,
    getCompanyUsers: db.getCompanyUsers,
    generateMfaSetup: mfaService.generateMfaSetup,
    enableMfa: mfaService.enableMfa,
    disableMfa: mfaService.disableMfa,
    verifyMfaLogin: mfaService.verifyMfaLogin,
    getMfaStatus: mfaService.getMfaStatus,
    getPlatformAuditLogs: auditService.getPlatformAuditLogs,
    getAuditSummaryMetrics: auditService.getAuditSummaryMetrics,
    recordHeartbeat: sessionService.recordHeartbeat,
    getRealtimeActiveUsers: sessionService.getRealtimeActiveUsers,
    terminateUserSession: sessionService.terminateUserSession,

    // Email Templates & SMTP Mailer API
    getEmailTemplates: emailTemplateService.getEmailTemplates,
    saveEmailTemplate: emailTemplateService.saveEmailTemplate,
    resetEmailTemplate: emailTemplateService.resetEmailTemplate,
    sendTestEmail: emailTemplateService.sendTestEmail,
    getEmailSettings: emailTemplateService.getEmailSettings,
    saveEmailSettings: emailTemplateService.saveEmailSettings,
    testSmtpConnection: emailTemplateService.testSmtpConnection,

    // Notification Engine & Company Audit Logs RPC
    getCompanyAuditLogs: auditService.getPlatformAuditLogs,
    getCompanyNotificationSettings: notificationEngine.getCompanyNotificationSettings,
    saveCompanyNotificationSettings: async (arg1, arg2) => {
        if (arg1 && typeof arg1 === 'object' && arg1.companyId) {
            return await notificationEngine.saveCompanyNotificationSettings(arg1.companyId, arg1.settings);
        }
        return await notificationEngine.saveCompanyNotificationSettings(arg1, arg2);
    },
    runCompanyNotificationScan: async (arg1, arg2) => {
        if (arg1 && typeof arg1 === 'object' && arg1.companyId) {
            return await notificationEngine.runCompanyNotificationScan(arg1.companyId, arg1.options);
        }
        return await notificationEngine.runCompanyNotificationScan(arg1, arg2);
    },
    sendTestNotificationEmail: notificationEngine.sendTestNotificationEmail,
    getUserNotificationSettings: async (arg) => {
        const uid = arg?.userId || arg;
        const role = arg?.userRole || 'admin';
        return await notificationEngine.getUserNotificationSettings(uid, role);
    },
    saveUserNotificationSettings: async (arg) => {
        return await notificationEngine.saveUserNotificationSettings(arg?.userId, arg?.settings);
    },

    // System & Company Database Settings
    getCompanyDbSettings: async (companyId) => {
        const cid = typeof companyId === 'object' ? companyId?.companyId : companyId;
        return await systemSettingsService.getCompanyDbSettings(cid);
    },
    saveCompanyDbSettings: async (arg1, arg2) => {
        if (arg1 && typeof arg1 === 'object' && arg1.companyId) {
            return await systemSettingsService.saveCompanyDbSettings(arg1.companyId, arg1.settings);
        }
        return await systemSettingsService.saveCompanyDbSettings(arg1, arg2);
    },
    getUserPreferences: async (userId) => {
        const uid = typeof userId === 'object' ? userId?.userId : userId;
        return await systemSettingsService.getUserPreferences(uid);
    },
    saveUserPreferences: async (arg1, arg2) => {
        if (arg1 && typeof arg1 === 'object' && arg1.userId) {
            return await systemSettingsService.saveUserPreferences(arg1.userId, arg1.preferences);
        }
        return await systemSettingsService.saveUserPreferences(arg1, arg2);
    }
};


// Only explicitly registered methods are remotely callable; no service-export fallback.
app.post('/api/rpc/:method', async (req, res) => {
    const method = req.params.method;
    const fn = Object.hasOwn(rpcMap, method) ? rpcMap[method] : null;
    if (typeof fn !== 'function') return res.status(404).json({ success: false, error: 'Bilinmeyen işlem.' });
    try {
        const result = await call(method, req.body?.args || [], requestToken(req), fn, getPrismaClient());
        if (result?.token) res.cookie('kontrol_session', result.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 12 * 60 * 60 * 1000, path: '/' });
        if (method === 'logout') res.clearCookie('kontrol_session', { path: '/' });
        res.json(result ?? { success: true });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'İşlem gerçekleştirilemedi.' });
    }
});

// Dedicated REST Endpoint for 24/7 Automated Notifications (Runs on Server)
app.all(['/api/cron/notifications', '/api/cron/daily-summary'], async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    const supplied = req.headers['x-cron-key'];
    if (!cronSecret || typeof supplied !== 'string' || Buffer.byteLength(supplied) !== Buffer.byteLength(cronSecret) || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(cronSecret))) return res.status(401).json({ success: false, error: 'Yetkisiz cron çağrısı.' });
    try {
        const force = req.query.force === 'true' || req.body?.force === true;
        const prisma = getPrismaClient();
        const companies = await prisma.companies.findMany({
            where: { status: 'active' },
            select: { id: true, name: true }
        });

        const results = [];
        for (const company of companies) {
            const scanRes = await notificationEngine.runCompanyNotificationScan(company.id, { force });
            results.push({ companyId: company.id, companyName: company.name, ...scanRes });
        }

        res.json({ success: true, timestamp: new Date().toISOString(), results });
    } catch (err) {
        console.error('[Cron API Error]:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Global Express Error Middleware
app.use((err, req, res, next) => {
    console.error('🔥 [Unhandled Express Error]:', err?.stack || err);
    if (res.headersSent) return next(err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Bir sunucu hatası meydana geldi.'
            : (err?.message || 'Bilinmeyen sunucu hatası')
    });
});

// Single Page Application (SPA) Fallback
app.use((req, res) => {
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('Kontrol Web Server is running. (dist/index.html not found, please build the frontend)');
    }
});

const { Client } = require('pg');
const { postgresDdlSql } = require('./electron/utils/postgresDdl');

async function initializePostgres(dbUrl) {
    try {
        console.log('• Checking & initializing PostgreSQL schema...');
        const pgClient = new Client({ connectionString: dbUrl });
        await pgClient.connect();
        await pgClient.query(postgresDdlSql);

        await pgClient.end();
        console.log('✅ PostgreSQL Schema & Tables verified.');
    } catch (err) {
        console.warn('⚠️ PostgreSQL DDL initialization notice:', err.message);
    }
}

// Initialize database and start listening
async function start() {
    try {
        const dbUrl = process.env.DATABASE_URL;

        if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
            await initializePostgres(dbUrl);
        }

        const prisma = getPrismaClient();
        // Test database connection
        await prisma.$connect();
        console.log('✅ Database connected successfully.');

        // Run auto migrations for SQLite tables and columns
        if (typeof runAutoMigrations === 'function') {
            await runAutoMigrations();
            console.log('✅ Database schema and migrations verified.');
        }

        // Ensure dedicated SuperAdmin exists and separate company admins
        if (typeof authService.ensureSuperAdminExists === 'function') {
            await authService.ensureSuperAdminExists();
        }

        // Start automated daily backup scheduler (Runs at 03:00 AM)
        const { performBackup } = require('./scripts/backup-service');
        setInterval(async () => {
            const now = new Date();
            if (now.getHours() === 3 && now.getMinutes() <= 4) {
                console.log('[Daily Cron] Triggering scheduled database backup...');
                await performBackup();
            }
        }, 5 * 60 * 1000);

        // Start 24/7 automated daily email notification scheduler
        // Runs directly on server regardless of whether client machines/desktop apps are open!
        const notifiedCompanyRuns = new Set();
        setInterval(async () => {
            try {
                // Get exact Turkey time (Europe/Istanbul)
                const formatter = new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Europe/Istanbul',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                const trTime = formatter.format(new Date());
                const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }); // YYYY-MM-DD

                // Clean old keys from cache
                for (const key of notifiedCompanyRuns) {
                    if (!key.includes(todayStr)) {
                        notifiedCompanyRuns.delete(key);
                    }
                }

                const prisma = getPrismaClient();
                const companies = await prisma.companies.findMany({
                    where: { status: 'active' },
                    select: { id: true, name: true }
                });

                for (const company of companies) {
                    const settingsRes = await notificationEngine.getCompanyNotificationSettings(company.id);
                    const notifSettings = settingsRes?.data;
                    if (!notifSettings || notifSettings.emailNotificationsEnabled === false) continue;
                    if (notifSettings.dailySummaryEnabled === false) continue;

                    const targetTime = notifSettings.dailySummaryTime || '09:00';

                    // When current Turkey time matches company scheduled time (e.g. 09:00)
                    if (trTime === targetTime) {
                        const runKey = `${company.id}-${todayStr}-${targetTime}`;
                        if (!notifiedCompanyRuns.has(runKey)) {
                            notifiedCompanyRuns.add(runKey);
                            console.log(`[Server 24/7 Cron] Triggering scheduled notification scan for ${company.name} (ID: ${company.id}) at ${trTime} TR time...`);
                            await notificationEngine.runCompanyNotificationScan(company.id);
                        }
                    }
                }
            } catch (cronErr) {
                console.error('[Server Notification Cron Error]:', cronErr.message);
            }
        }, 60 * 1000); // Check every minute

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Kontrol Web Application running on http://0.0.0.0:${PORT}`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

if (require.main === module) start();
module.exports = { app, rpcMap, start };
