const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

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

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'kontrol-app-production-secret-key-98765';

// Security Headers (configured to allow PDF previews & embedded assets)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration
app.use(cors({
    origin: true,
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
app.use(['/api/rpc/login', '/api/rpc/loginUser', '/api/rpc/register', '/api/rpc/registerUser'], authLimiter);

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
app.post('/api/admin/backup', async (req, res) => {
    const { performBackup } = require('./scripts/backup-service');
    const authHeader = req.headers.authorization;
    if (!authHeader && req.query.key !== SECRET_KEY) {
        return res.status(401).json({ success: false, error: 'Yetkisiz erişim' });
    }
    const result = await performBackup();
    res.json(result);
});

// Uploads directory configuration
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const filesDir = path.join(dataDir, 'files');
if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
}

// Serve /uploads with automatic fallback to Supabase Storage (Express 5 compatible)
app.use('/uploads', async (req, res, next) => {
    try {
        const relativePath = decodeURIComponent(req.path || '').replace(/^\/+/, '');
        if (!relativePath) return res.status(404).send('File not found');

        const localFile = path.join(filesDir, relativePath);
        const ext = path.extname(relativePath).toLowerCase();
        const mime = ext === '.pdf' ? 'application/pdf' : (ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream'));

        if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
            res.setHeader('Content-Type', mime);
            res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(path.basename(relativePath)) + '"');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.sendFile(localFile);
        }
        const { downloadFromStorage } = require('./electron/services/supabase.service');
        const sRes = await downloadFromStorage(relativePath);
        const buf = sRes.buffer || sRes.data;
        if (sRes.success && buf) {
            const localDir = path.dirname(localFile);
            if (!fs.existsSync(localDir)) {
                fs.mkdirSync(localDir, { recursive: true });
            }
            fs.writeFileSync(localFile, buf);
            res.setHeader('Content-Type', mime);
            res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(path.basename(relativePath)) + '"');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Accept-Ranges', 'bytes');
            return res.send(buf);
        }
    } catch (e) {
        console.error('[Uploads fallback error]:', e.message);
    }
    return res.status(404).send('File not found');
});

// Direct File Upload API for Web Client with Enterprise Hierarchical Paths
app.post('/api/upload', async (req, res) => {
    try {
        const { fileName, fileData, mimeType, companyId, module, entityId, category } = req.body;
        if (!fileData) {
            return res.status(400).json({ success: false, error: 'No file data provided' });
        }

        const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.csv'];
        let ext = (path.extname(fileName || '') || '').toLowerCase();
        if (!ext && mimeType) {
            ext = mimeType.includes('pdf') ? '.pdf' : (mimeType.includes('png') ? '.png' : '.jpg');
        }
        if (!ext || !allowedExtensions.includes(ext)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Güvenlik Uyarısı: İzin verilmeyen dosya formatı. Sadece PDF, JPG, PNG ve Office belgeleri yüklenebilir.' 
            });
        }

        // Convert base64 data to buffer and enforce 20MB limit
        const base64Clean = fileData.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64Clean, 'base64');
        if (buffer.length > 20 * 1024 * 1024) {
            return res.status(400).json({ success: false, error: 'Dosya boyutu 20 MB sınırını aşamaz.' });
        }

        const uniqueFile = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;

        // Build enterprise hierarchy: company_X/module/entity_Y/category/file.ext
        let storageFolder = '';
        if (companyId) {
            storageFolder += `company_${companyId}/`;
        }
        if (module) {
            storageFolder += `${module}/`;
            if (entityId) {
                const singularModule = module.endsWith('s') ? module.slice(0, -1) : module;
                storageFolder += `${singularModule}_${entityId}/`;
            }
        }
        if (category) {
            storageFolder += `${category}/`;
        }

        const relativeStoragePath = (storageFolder + uniqueFile).replace(/^\/+/, '');
        const targetPath = path.join(filesDir, relativeStoragePath);

        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        fs.writeFileSync(targetPath, buffer);

        // Upload to Supabase Storage in background with clean hierarchical path
        try {
            const { uploadToStorage } = require('./electron/services/supabase.service');
            await uploadToStorage(buffer, relativeStoragePath, mimeType || 'application/octet-stream', 'documents');
        } catch (e) {
            console.warn('[Storage upload notice]:', e.message);
        }

        return res.json({
            success: true,
            fileName: relativeStoragePath,
            originalName: fileName,
            path: relativeStoragePath,
            url: `/uploads/${relativeStoragePath}`
        });
    } catch (err) {
        console.error('API upload error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
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
    createEmployeeUser: authService.createEmployeeUser,
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
    getAppVersion: async () => '1.13.11-web',

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
        if (!fileName) return { success: false, error: 'No fileName provided' };
        const relativePath = String(fileName).replace(/^\/+/, '');
        const cleanName = path.basename(relativePath);
        const filePath = path.join(filesDir, relativePath);
        const flatFilePath = path.join(filesDir, cleanName);
        const ext = path.extname(cleanName).toLowerCase();

        if (fs.existsSync(filePath)) {
            return {
                success: true,
                data: fs.readFileSync(filePath).toString('base64'),
                fileName: cleanName,
                path: relativePath,
                ext: ext
            };
        }

        if (fs.existsSync(flatFilePath)) {
            return {
                success: true,
                data: fs.readFileSync(flatFilePath).toString('base64'),
                fileName: cleanName,
                path: cleanName,
                ext: ext
            };
        }

        try {
            const { downloadFromStorage } = require('./electron/services/supabase.service');
            let res = await downloadFromStorage(relativePath);
            if (!res.success && relativePath !== cleanName) {
                res = await downloadFromStorage(cleanName);
            }

            const buf = res.buffer || res.data;
            if (res.success && buf) {
                const targetDir = path.dirname(filePath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                fs.writeFileSync(filePath, buf);
                return {
                    success: true,
                    data: buf.toString('base64'),
                    fileName: cleanName,
                    path: relativePath,
                    ext: ext
                };
            }
        } catch (e) {
            console.error('[readDocumentData Storage Error]:', e.message);
        }
        return { success: false, error: 'Belge bulunamadı' };
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
            res.data.localStorageData = payload?.localStorageData || null;
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
    getSettings: () => {
        try {
            const sPath = path.join(dataDir, 'settings.json');
            if (fs.existsSync(sPath)) return JSON.parse(fs.readFileSync(sPath, 'utf8'));
        } catch (e) {}
        return { autoBackup: false, frequency: 'daily', backupPath: '', lastBackup: {} };
    },
    saveSettings: (settings) => {
        try {
            const sPath = path.join(dataDir, 'settings.json');
            fs.writeFileSync(sPath, JSON.stringify(settings, null, 2));
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },
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
};

// Generic RPC Router
app.post('/api/rpc/:method', async (req, res) => {
    const { method } = req.params;
    const { args = [] } = req.body;

    const fn = rpcMap[method] || db[method] || authService[method];
    if (typeof fn !== 'function') {
        console.warn(`[RPC 404] Method "${method}" not found in rpcMap`);
        return res.status(404).json({ success: false, error: `Method "${method}" not found` });
    }

    try {
        const result = await fn(...args);
        res.json(result !== undefined ? result : { success: true });
    } catch (err) {
        console.error(`RPC Error [${method}]:`, err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Developer / Generic Table Endpoints
const TABLES = [
    'assignments', 'companies', 'customers', 'documents', 'employees', 'employee_documents',
    'employee_assignments', 'employee_attendance', 'employee_movements', 'employee_salary_history',
    'inspections', 'insurances', 'leaves', 'maintenances', 'meal_settings', 'meal_tickets', 'overtimes',
    'recurring_transactions', 'salaries', 'services', 'transactions', 'users', 'vehicles', 'works', 'work_items'
];

app.get('/api/tables', (req, res) => {
    res.json({ success: true, tables: TABLES });
});

app.get('/api/data/:table', async (req, res) => {
    const { table } = req.params;
    if (!TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });

    try {
        const prisma = getPrismaClient();
        const data = await prisma[table].findMany({ take: 500 });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
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

        // Verify users exist, seed default admin if empty
        const uRes = await pgClient.query('SELECT count(*) as count FROM users');
        if (parseInt(uRes.rows[0].count, 10) === 0) {
            console.log('• Seeding default admin user in PostgreSQL...');
            const bcrypt = require('bcryptjs');
            const defaultPasswordHash = bcrypt.hashSync('admin', 10);
            
            // Create default company
            const cRes = await pgClient.query("INSERT INTO companies (name, created_at) VALUES ('Varsayılan Şirket', CURRENT_TIMESTAMP) RETURNING id");
            const companyId = cRes.rows[0].id;

            await pgClient.query(`
                INSERT INTO users (username, email, password_hash, role, company_id, is_active, created_at)
                VALUES ('admin', 'admin@muayen.com', $1, 'admin', $2, 1, CURRENT_TIMESTAMP)
            `, [defaultPasswordHash, companyId]);
            console.log('✅ Default admin user created in PostgreSQL.');
        }

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

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Kontrol Web Application running on http://0.0.0.0:${PORT}`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

start();
