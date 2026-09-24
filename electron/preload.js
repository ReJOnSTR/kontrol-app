const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    // Auth
    register: (userData) => ipcRenderer.invoke('auth:register', userData),
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    changePassword: (data) => ipcRenderer.invoke('auth:changePassword', data),
    syncPasswordReset: (data) => ipcRenderer.invoke('auth:syncPasswordReset', data),
    requestPasswordReset: (data) => ipcRenderer.invoke('auth:requestPasswordReset', data),
    verifyRecoveryOtp: (data) => ipcRenderer.invoke('auth:verifyRecoveryOtp', data),
    completePasswordReset: (data) => ipcRenderer.invoke('auth:completePasswordReset', data),
    resendVerificationEmail: (data) => ipcRenderer.invoke('auth:resendVerificationEmail', data),
    activateUserByEmail: (data) => ipcRenderer.invoke('auth:activateUserByEmail', data),
    updateProfile: (data) => ipcRenderer.invoke('auth:updateProfile', data),
    createEmployeeUser: (data) => ipcRenderer.invoke('auth:createEmployeeUser', data),
    syncEmployeesToSupabaseAuth: (companyId) => ipcRenderer.invoke('auth:syncEmployeesToSupabaseAuth', companyId),

    // Requests & Approvals
    createRequest: (data) => ipcRenderer.invoke('requests:create', data),
    getRequests: (filters) => ipcRenderer.invoke('requests:getAll', filters),
    processApproval: (data) => ipcRenderer.invoke('requests:processApproval', data),

    // Roles & Granular Permissions
    getRoles: (companyId) => ipcRenderer.invoke('roles:getAll', companyId),
    saveRole: (data) => ipcRenderer.invoke('roles:save', data),
    deleteRole: (roleId) => ipcRenderer.invoke('roles:delete', roleId),
    assignUserRole: (data) => ipcRenderer.invoke('roles:assignUserRole', data),
    deleteUserAccount: (userId) => ipcRenderer.invoke('roles:deleteUserAccount', userId),

    // Companies
    getCompanies: (userId) => ipcRenderer.invoke('companies:getAll', userId),
    createCompany: (data) => ipcRenderer.invoke('companies:create', data),
    updateCompany: (data) => ipcRenderer.invoke('companies:update', data),
    deleteCompany: (id) => ipcRenderer.invoke('companies:delete', id),

    // Vehicles
    getVehicles: (companyId, isArchived) => ipcRenderer.invoke('vehicles:getAll', companyId, isArchived),
    getVehicleById: (id) => ipcRenderer.invoke('vehicles:getById', id),
    createVehicle: (data) => ipcRenderer.invoke('vehicles:create', data),
    updateVehicle: (data) => ipcRenderer.invoke('vehicles:update', data),
    deleteVehicle: (id) => ipcRenderer.invoke('vehicles:delete', id),

    // Maintenances
    getMaintenancesByVehicle: (vehicleId) => ipcRenderer.invoke('maintenances:getByVehicle', vehicleId),
    getAllMaintenances: (companyId, isArchived) => ipcRenderer.invoke('maintenances:getAll', companyId, isArchived),
    createMaintenance: (data) => ipcRenderer.invoke('maintenances:create', data),
    updateMaintenance: (data) => ipcRenderer.invoke('maintenances:update', data),
    deleteMaintenance: (id) => ipcRenderer.invoke('maintenances:delete', id),

    // Inspections
    getInspectionsByVehicle: (vehicleId) => ipcRenderer.invoke('inspections:getByVehicle', vehicleId),
    getAllInspections: (companyId, type, isArchived) => ipcRenderer.invoke('inspections:getAll', companyId, type, isArchived),
    createInspection: (data) => ipcRenderer.invoke('inspections:create', data),
    updateInspection: (data) => ipcRenderer.invoke('inspections:update', data),
    deleteInspection: (id) => ipcRenderer.invoke('inspections:delete', id),

    // Insurances
    getInsurancesByVehicle: (vehicleId) => ipcRenderer.invoke('insurances:getByVehicle', vehicleId),
    getAllInsurances: (companyId, isArchived) => ipcRenderer.invoke('insurances:getAll', companyId, isArchived),
    createInsurance: (data) => ipcRenderer.invoke('insurances:create', data),
    updateInsurance: (data) => ipcRenderer.invoke('insurances:update', data),
    deleteInsurance: (id) => ipcRenderer.invoke('insurances:delete', id),

    // Assignments
    getAssignmentsByVehicle: (vehicleId) => ipcRenderer.invoke('assignments:getByVehicle', vehicleId),
    getAllAssignments: (companyId, isArchived) => ipcRenderer.invoke('assignments:getAll', companyId, isArchived),
    createAssignment: (data) => ipcRenderer.invoke('assignments:create', data),
    updateAssignment: (data) => ipcRenderer.invoke('assignments:update', data),
    deleteAssignment: (id) => ipcRenderer.invoke('assignments:delete', id),

    // Services
    getServicesByVehicle: (vehicleId) => ipcRenderer.invoke('services:getByVehicle', vehicleId),
    getAllServices: (companyId, isArchived) => ipcRenderer.invoke('services:getAll', companyId, isArchived),
    createService: (data) => ipcRenderer.invoke('services:create', data),
    updateService: (data) => ipcRenderer.invoke('services:update', data),
    deleteService: (id) => ipcRenderer.invoke('services:delete', id),

    // Aliases for quick actions / compatibility
    addMaintenance: (data) => ipcRenderer.invoke('maintenances:create', data),
    addService: (data) => ipcRenderer.invoke('services:create', data),
    addInspection: (data) => ipcRenderer.invoke('inspections:create', data),
    addInsurance: (data) => ipcRenderer.invoke('insurances:create', data),
    addVehicle: (data) => ipcRenderer.invoke('vehicles:create', data),
    addAssignment: (data) => ipcRenderer.invoke('assignments:create', data),

    // Employees
    getEmployees: (companyId, isArchived) => ipcRenderer.invoke('employees:getAll', companyId, isArchived),
    getPayrollSummary: (companyId, month) => ipcRenderer.invoke('employees:getPayrollSummary', companyId, month),
    getEmployeeById: (id) => ipcRenderer.invoke('employees:getById', id),
    createEmployee: (data) => ipcRenderer.invoke('employees:create', data),
    updateEmployee: (data) => ipcRenderer.invoke('employees:update', data),
    deleteEmployee: (id) => ipcRenderer.invoke('employees:delete', id),

    // Salaries
    getSalaries: (employeeId) => ipcRenderer.invoke('salaries:getAll', employeeId),
    getSalariesByCompany: (companyId) => ipcRenderer.invoke('salaries:getAllForCompany', companyId),
    createSalary: (data) => ipcRenderer.invoke('salaries:create', data),
    updateSalary: (data) => ipcRenderer.invoke('salaries:update', data),
    deleteSalary: (id) => ipcRenderer.invoke('salaries:delete', id),
    createSalaryHistory: (data) => ipcRenderer.invoke('salaryHistory:create', data),
    updateSalaryHistory: (data) => ipcRenderer.invoke('salaryHistory:update', data),
    deleteSalaryHistory: (id) => ipcRenderer.invoke('salaryHistory:delete', id),

    // Leaves
    getLeaves: (employeeId) => ipcRenderer.invoke('leaves:getAll', employeeId),
    getLeavesByCompany: (companyId) => ipcRenderer.invoke('leaves:getAllByCompany', companyId),
    createLeave: (data) => ipcRenderer.invoke('leaves:create', data),
    updateLeave: (data) => ipcRenderer.invoke('leaves:update', data),
    deleteLeave: (id) => ipcRenderer.invoke('leaves:delete', id),

    // Overtimes
    getOvertimes: (employeeId) => ipcRenderer.invoke('overtimes:getAll', employeeId),
    createOvertime: (data) => ipcRenderer.invoke('overtimes:create', data),
    updateOvertime: (data) => ipcRenderer.invoke('overtimes:update', data),
    deleteOvertime: (id) => ipcRenderer.invoke('overtimes:delete', id),
    getAllOvertimes: (companyId) => ipcRenderer.invoke('overtimes:getAllByCompany', companyId),

    // Employee Assignments
    getEmployeeAssignments: (employeeId) => ipcRenderer.invoke('employeeAssignments:getAll', employeeId),
    createEmployeeAssignment: (data) => ipcRenderer.invoke('employeeAssignments:create', data),
    updateEmployeeAssignment: (data) => ipcRenderer.invoke('employeeAssignments:update', data),
    deleteEmployeeAssignment: (id) => ipcRenderer.invoke('employeeAssignments:delete', id),

    // Employee Documents
    getEmployeeDocuments: (employeeId, isArchived) => ipcRenderer.invoke('employeeDocuments:getAll', employeeId, isArchived),
    getUpcomingPersonnelDocuments: (companyId) => ipcRenderer.invoke('employeeDocuments:getUpcoming', companyId),
    createEmployeeDocument: (data) => ipcRenderer.invoke('employeeDocuments:create', data),
    updateEmployeeDocument: (data) => ipcRenderer.invoke('employeeDocuments:update', data),
    deleteEmployeeDocument: (id) => ipcRenderer.invoke('employeeDocuments:delete', id),

    // Employee Movements
    getAllEmployeeMovements: (companyId) => ipcRenderer.invoke('employeeMovements:getAll', companyId),
    addEmployeeMovement: (data) => ipcRenderer.invoke('employeeMovements:create', data),
    updateEmployeeMovement: (data) => ipcRenderer.invoke('employeeMovements:update', data),
    deleteEmployeeMovement: (id) => ipcRenderer.invoke('employeeMovements:delete', id),

    // Archive
    archiveItem: (table, id, isArchived) => ipcRenderer.invoke('archive:item', table, id, isArchived),
    archiveItems: (table, ids, isArchived) => ipcRenderer.invoke('archive:items', table, ids, isArchived),

    // Dashboard
    getDashboardStats: (companyId) => ipcRenderer.invoke('dashboard:getStats', companyId),
    getUpcomingEvents: (companyId) => ipcRenderer.invoke('dashboard:getUpcoming', companyId),
    getRecentActivity: (companyId) => ipcRenderer.invoke('dashboard:getRecentActivity', companyId),

    // Data Management
    exportCompanyData: (data) => ipcRenderer.invoke('data:export', data),
    importCompanyData: (userId) => ipcRenderer.invoke('data:import', userId),

    // Settings & Auto Backup
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
    selectFolder: () => ipcRenderer.invoke('settings:selectFolder'),

    // Public Holidays
    getPublicHolidays: (companyId) => ipcRenderer.invoke('settings:getPublicHolidays', companyId),
    createPublicHoliday: (data) => ipcRenderer.invoke('settings:createPublicHoliday', data),
    updatePublicHoliday: (data) => ipcRenderer.invoke('settings:updatePublicHoliday', data),
    deletePublicHoliday: (id) => ipcRenderer.invoke('settings:deletePublicHoliday', id),

    // Personnel Settings
    getDepartments: (companyId) => ipcRenderer.invoke('settings:getDepartments', companyId),
    createDepartment: (data) => ipcRenderer.invoke('settings:createDepartment', data),
    updateDepartment: (data) => ipcRenderer.invoke('settings:updateDepartment', data),
    deleteDepartment: (id) => ipcRenderer.invoke('settings:deleteDepartment', id),
    getLeaveTypes: (companyId) => ipcRenderer.invoke('settings:getLeaveTypes', companyId),
    createLeaveType: (data) => ipcRenderer.invoke('settings:createLeaveType', data),
    updateLeaveType: (data) => ipcRenderer.invoke('settings:updateLeaveType', data),
    deleteLeaveType: (id) => ipcRenderer.invoke('settings:deleteLeaveType', id),
    getDocumentCategories: (companyId, targetType) => ipcRenderer.invoke('settings:getDocumentCategories', companyId, targetType),
    createDocumentCategory: (data) => ipcRenderer.invoke('settings:createDocumentCategory', data),
    updateDocumentCategory: (data) => ipcRenderer.invoke('settings:updateDocumentCategory', data),
    deleteDocumentCategory: (id) => ipcRenderer.invoke('settings:deleteDocumentCategory', id),
    getDocumentFolders: (companyId, relatedType, relatedId) => ipcRenderer.invoke('settings:getDocumentFolders', companyId, relatedType, relatedId),
    createDocumentFolder: (data) => ipcRenderer.invoke('settings:createDocumentFolder', data),
    updateDocumentFolder: (data) => ipcRenderer.invoke('settings:updateDocumentFolder', data),
    deleteDocumentFolder: (id) => ipcRenderer.invoke('settings:deleteDocumentFolder', id),
    getVehicleTypes: (companyId) => ipcRenderer.invoke('settings:getVehicleTypes', companyId),
    createVehicleType: (data) => ipcRenderer.invoke('settings:createVehicleType', data),
    updateVehicleType: (data) => ipcRenderer.invoke('settings:updateVehicleType', data),
    deleteVehicleType: (id) => ipcRenderer.invoke('settings:deleteVehicleType', id),

    // Auto Updater
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate'),
    quitAndInstall: () => ipcRenderer.invoke('app:quitAndInstall'),
    getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, value) => callback(value)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, value) => callback(value)),
    removeUpdateListeners: () => {
        ipcRenderer.removeAllListeners('update-status')
        ipcRenderer.removeAllListeners('update-progress')
    },

    // PC Features
    onTriggerAction: (callback) => ipcRenderer.on('trigger-action', (event, action) => callback(action)),
    onNavigate: (callback) => ipcRenderer.on('navigate', (event, route) => callback(route)),
    showContextMenu: (items) => ipcRenderer.send('show-context-menu', items),
    onContextAction: (callback) => ipcRenderer.on('context-action', (event, action) => callback(action)),
    removePCListeners: () => {
        ipcRenderer.removeAllListeners('trigger-action')
        ipcRenderer.removeAllListeners('navigate')
        ipcRenderer.removeAllListeners('context-action')
    },

    // Notifications
    showNotification: (title, body) => ipcRenderer.invoke('notification:show', { title, body }),

    // File Handlers
    selectFile: (options) => ipcRenderer.invoke('files:select', options),
    saveFile: (sourcePath) => ipcRenderer.invoke('files:save', sourcePath),
    openFile: (fileName) => ipcRenderer.invoke('files:open', fileName),
    getPathForFile: (file) => {
        try {
            if (webUtils && typeof webUtils.getPathForFile === 'function') {
                return webUtils.getPathForFile(file)
            }
        } catch (e) {
            console.warn('webUtils.getPathForFile failed:', e)
        }
        return file?.path || null
    },

    // Document Management
    addDocument: (data) => ipcRenderer.invoke('documents:add', data),
    updateDocument: (data) => ipcRenderer.invoke('documents:update', data),
    getAllDocuments: (companyId, isArchived) => ipcRenderer.invoke('documents:getByCompany', companyId, isArchived),
    getDocumentsByVehicle: (vehicleId, isArchived) => ipcRenderer.invoke('documents:getByVehicle', vehicleId, isArchived),
    deleteDocument: (id) => ipcRenderer.invoke('documents:delete', id),
    openDocument: (fileName) => ipcRenderer.invoke('documents:open', fileName),
    openTempDocument: (base64Data, fileName) => ipcRenderer.invoke('documents:openTempData', base64Data, fileName),
    downloadFile: (params) => ipcRenderer.invoke('documents:downloadFile', params),
    readDocumentData: (fileName) => ipcRenderer.invoke('documents:readData', fileName),

    // Utils
    openExternal: (url) => ipcRenderer.send('app:openExternal', url),

    // Finance API
    getAllFinance: (companyId, isArchived) => ipcRenderer.invoke('finance:getAll', companyId, isArchived),
    getFinanceById: (id) => ipcRenderer.invoke('finance:getById', id),
    createFinance: (data) => ipcRenderer.invoke('finance:create', data),
    updateFinance: (data) => ipcRenderer.invoke('finance:update', data),
    deleteFinance: (id) => ipcRenderer.invoke('finance:delete', id),
    getFinanceStats: (companyId) => ipcRenderer.invoke('finance:getStats', companyId),
    getChecks: (companyId, isArchived) => ipcRenderer.invoke('finance:getChecks', companyId, isArchived),
    updateCheckStatus: (data) => ipcRenderer.invoke('finance:updateCheckStatus', data),

    // Meal Tickets API
    getMealTickets: (companyId, isArchived) => ipcRenderer.invoke('mealTickets:getAll', companyId, isArchived),
    createMealTicket: (data) => ipcRenderer.invoke('mealTickets:create', data),
    updateMealTicket: (data) => ipcRenderer.invoke('mealTickets:update', data),
    deleteMealTicket: (id) => ipcRenderer.invoke('mealTickets:delete', id),
    getMealTicketStats: (companyId) => ipcRenderer.invoke('mealTickets:getStats', companyId),
    getMealPrice: (companyId) => ipcRenderer.invoke('mealTickets:getPrice', companyId),
    setMealPrice: (data) => ipcRenderer.invoke('mealTickets:setPrice', data),
    getMealPriceHistory: (companyId) => ipcRenderer.invoke('mealTickets:getPriceHistory', companyId),
    deleteMealPriceHistory: (id) => ipcRenderer.invoke('mealTickets:deletePriceHistory', id),
    updateMealPriceHistory: (data) => ipcRenderer.invoke('mealTickets:updatePriceHistory', data),
    getMealTicketReport: (data) => ipcRenderer.invoke('mealTickets:getReport', data),

    // Works API
    getWorks: (companyId, isArchived) => ipcRenderer.invoke('works:getAll', companyId, isArchived),
    getWorkDetails: (id) => ipcRenderer.invoke('works:getDetails', id),
    createWork: (data) => ipcRenderer.invoke('works:create', data),
    updateWork: (data) => ipcRenderer.invoke('works:update', data),
    deleteWork: (id) => ipcRenderer.invoke('works:delete', id),
    deleteWorks: (ids) => ipcRenderer.invoke('works:bulkDelete', ids),
    archiveWorks: (ids, isArchived) => ipcRenderer.invoke('works:bulkArchive', ids, isArchived),

    // Customers API
    getCustomers: (companyId, isArchived) => ipcRenderer.invoke('customers:getAll', companyId, isArchived),
    getCustomerDetails: (id) => ipcRenderer.invoke('customers:getDetails', id),
    createCustomer: (data) => ipcRenderer.invoke('customers:create', data),
    updateCustomer: (data) => ipcRenderer.invoke('customers:update', data),
    deleteCustomer: (id) => ipcRenderer.invoke('customers:delete', id),

    addWorkItem: (data) => ipcRenderer.invoke('workItems:create', data),
    addBulkWorkItems: (data) => ipcRenderer.invoke('workItems:bulkCreate', data),
    updateWorkItem: (data) => ipcRenderer.invoke('workItems:update', data),
    deleteWorkItem: (id) => ipcRenderer.invoke('workItems:delete', id),
    deleteBulkWorkItems: (ids) => ipcRenderer.invoke('workItems:bulkDelete', ids),

    // Database Updates
    onDbUpdate: (callback) => {
        const subscription = (event, data) => callback(data)
        ipcRenderer.on('db-update', subscription)
        return () => ipcRenderer.removeListener('db-update', subscription)
    },

    // Global Search
    searchGlobal: (companyId, query) => ipcRenderer.invoke('global:search', companyId, query),

    // System actions
    saveAsPdf: (options) => ipcRenderer.invoke('save-pdf', options),
    saveReportPdf: (route, options) => ipcRenderer.invoke('save-report-pdf', route, options),
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
    setFullScreen: (flag) => ipcRenderer.invoke('window:setFullScreen', flag),
    focusWindow: () => ipcRenderer.invoke('window:focus'),

    // Arvento API
    arventoTestConnection: (credentials) => ipcRenderer.invoke('arvento:testConnection', credentials),
    arventoGetStatus: (credentials) => ipcRenderer.invoke('arvento:getStatus', credentials),
    arventoGetMappings: (credentials) => ipcRenderer.invoke('arvento:getMappings', credentials),
    arventoGetInfo: (credentials) => ipcRenderer.invoke('arvento:getInfo', credentials),
    arventoGetDailyReport: (date, credentials) => ipcRenderer.invoke('arvento:getDailyReport', date, credentials),
    arventoGetAlarms: (credentials) => ipcRenderer.invoke('arvento:getAlarms', credentials),
    arventoGetHistory: (filters, credentials) => ipcRenderer.invoke('arvento:getHistory', filters, credentials),

    // Database Migration to Postgres
    migrateToPostgres: (postgresUrl) => ipcRenderer.invoke('database:migrateToPostgres', postgresUrl),
    onMigrationLog: (callback) => {
        const subscription = (event, data) => callback(data)
        ipcRenderer.on('migration-log', subscription)
        return () => ipcRenderer.removeListener('migration-log', subscription)
    },

    // Platform Super Admin & Company User Management API
    getPlatformOverview: () => ipcRenderer.invoke('platform:getOverview'),
    getPlatformUsers: () => ipcRenderer.invoke('platform:getUsers'),
    getCompanyUsers: (companyId) => ipcRenderer.invoke('platform:getCompanyUsers', companyId),
    resetPlatformUserPassword: (userId, newPassword) => ipcRenderer.invoke('platform:resetUserPassword', userId, newPassword),
    impersonatePlatformUser: (userId) => ipcRenderer.invoke('platform:impersonateUser', userId),
    createPlatformUser: (userData) => ipcRenderer.invoke('platform:createUser', userData),
    updatePlatformUser: (userId, userData) => ipcRenderer.invoke('platform:updateUser', userId, userData),
    deletePlatformUser: (userId) => ipcRenderer.invoke('platform:deleteUser', userId),
    toggleCompanyStatus: (companyId, isActive) => ipcRenderer.invoke('platform:toggleCompanyStatus', companyId, isActive),
    toggleUserStatus: (userId, isActive) => ipcRenderer.invoke('platform:toggleUserStatus', userId, isActive),
    getPlatformBackups: () => ipcRenderer.invoke('platform:getBackups'),
    triggerPlatformBackup: () => ipcRenderer.invoke('platform:triggerBackup'),
    getPlatformSystemHealth: () => ipcRenderer.invoke('platform:getSystemHealth'),
    getPlatformLogs: (limit) => ipcRenderer.invoke('platform:getLogs', limit),
    clearPlatformLogs: () => ipcRenderer.invoke('platform:clearLogs'),
    getPlatformAnnouncements: () => ipcRenderer.invoke('platform:getAnnouncements'),
    getActiveAnnouncements: (companyId) => ipcRenderer.invoke('platform:getActiveAnnouncements', companyId),
    createPlatformAnnouncement: (payload) => ipcRenderer.invoke('platform:createAnnouncement', payload),
    toggleAnnouncementStatus: (id, isActive) => ipcRenderer.invoke('platform:toggleAnnouncementStatus', id, isActive),
    deletePlatformAnnouncement: (id) => ipcRenderer.invoke('platform:deleteAnnouncement', id),
    createPlatformCompany: (data) => ipcRenderer.invoke('platform:createCompany', data),
    updatePlatformCompany: (data) => ipcRenderer.invoke('platform:updateCompany', data),
    deletePlatformCompany: (companyId) => ipcRenderer.invoke('platform:deleteCompany', companyId),
    generateMfaSetup: (userId) => ipcRenderer.invoke('mfa:generateSetup', userId),
    enableMfa: (userId, secret, token, backupCodes) => ipcRenderer.invoke('mfa:enable', userId, secret, token, backupCodes),
    disableMfa: (userId) => ipcRenderer.invoke('mfa:disable', userId),
    verifyMfaLogin: (userId, tokenOrBackupCode) => ipcRenderer.invoke('mfa:verifyLogin', userId, tokenOrBackupCode),
    getMfaStatus: (userId) => ipcRenderer.invoke('mfa:getStatus', userId),
    getPlatformAuditLogs: (params) => ipcRenderer.invoke('platform:getAuditLogs', params),
    getAuditSummaryMetrics: () => ipcRenderer.invoke('platform:getAuditSummaryMetrics'),
    recordHeartbeat: (payload) => ipcRenderer.invoke('session:heartbeat', payload),
    getRealtimeActiveUsers: () => ipcRenderer.invoke('session:getRealtimeActiveUsers'),
    terminateUserSession: (sessionId) => ipcRenderer.invoke('session:terminate', sessionId),
    openImpersonateWindow: (payload) => ipcRenderer.invoke('platform:openImpersonateWindow', payload),
    getEmailTemplates: () => ipcRenderer.invoke('platform:getEmailTemplates'),
    saveEmailTemplate: (data) => ipcRenderer.invoke('platform:saveEmailTemplate', data),
    resetEmailTemplate: (data) => ipcRenderer.invoke('platform:resetEmailTemplate', data),
    sendTestEmail: (data) => ipcRenderer.invoke('platform:sendTestEmail', data),
    getEmailSettings: () => ipcRenderer.invoke('platform:getEmailSettings'),
    saveEmailSettings: (data) => ipcRenderer.invoke('platform:saveEmailSettings', data),
    testSmtpConnection: (data) => ipcRenderer.invoke('platform:testSmtpConnection', data),

    // Company Audit Log & Notification Engine APIs
    getCompanyAuditLogs: (params) => ipcRenderer.invoke('company:getAuditLogs', params),
    getCompanyNotificationSettings: (companyId) => ipcRenderer.invoke('notification:getCompanySettings', companyId),
    saveCompanyNotificationSettings: (companyId, settings) => ipcRenderer.invoke('notification:saveCompanySettings', { companyId, settings }),
    runCompanyNotificationScan: (companyId, options) => ipcRenderer.invoke('notification:runCompanyScan', { companyId, options }),
    sendTestNotificationEmail: (data) => ipcRenderer.invoke('notification:sendTestEmail', data),
})

