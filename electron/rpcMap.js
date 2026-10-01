const path = require('path');
const fs = require('fs');
const db = require('./prismaService');
const authService = require('./services/auth.service');
const mfaService = require('./services/mfa.service');
const auditService = require('./services/audit.service');
const sessionService = require('./services/session.service');
const emailTemplateService = require('./services/emailTemplate.service');
const notificationEngine = require('./services/notification-engine.service');
const systemSettingsService = require('./services/systemSettings.service');

function getFilesDir() {
    try {
        const electron = require('electron');
        if (electron && electron.app && typeof electron.app.getPath === 'function') {
            return path.join(electron.app.getPath('userData'), 'files');
        }
    } catch (e) {}
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '../data');
    return path.join(dataDir, 'files');
}

function getDataDir() {
    try {
        const electron = require('electron');
        if (electron && electron.app && typeof electron.app.getPath === 'function') {
            return path.join(electron.app.getPath('userData'), 'data');
        }
    } catch (e) {}
    return process.env.DATA_DIR || path.join(__dirname, '../data');
}

function createRpcMap() {
    const filesDir = getFilesDir();
    const dataDir = getDataDir();

    return {
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
            const { syncAllEmployeesToSupabaseAuth } = require('./services/supabase.service');
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
        getAppVersion: async () => '1.13.121-web',

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
                const { downloadFromStorage, getStoragePublicUrl } = require('./services/supabase.service');
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
                        url: getStoragePublicUrl(cleanName, 'documents'),
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
            const { getCompanyCompleteData } = require('./services/backup.service');
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
            const { importCompanyData } = require('./services/backup.service');
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
}

module.exports = { createRpcMap };
