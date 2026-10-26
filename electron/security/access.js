const { run, forbidden } = require('./context');
const { scopeFor } = require('./scopedPrisma');

const PUBLIC = new Set(['login', 'loginUser', 'register', 'registerUser', 'requestPasswordReset', 'verifyRecoveryOtp', 'completePasswordReset', 'resendVerificationEmail', 'activateUserByEmail', 'verifyMfaLogin', 'getAppVersion']);
const SELF = new Set(['getUserProfile', 'updateProfile', 'changePassword', 'getMfaStatus', 'generateMfaSetup', 'enableMfa', 'disableMfa', 'getUserPreferences', 'saveUserPreferences', 'getUserNotificationSettings', 'saveUserNotificationSettings']);
const USER_ADMIN = new Set(['getCompanyUsers', 'getRoles', 'saveRole', 'deleteRole', 'assignUserRole', 'deleteUserAccount', 'createEmployeeUser', 'sendPersonnelInvite']);
const PLATFORM = new Set(['getRealtimeActiveUsers', 'terminateUserSession', 'getAuditSummaryMetrics', 'getEmailTemplates', 'saveEmailTemplate', 'resetEmailTemplate', 'sendTestEmail', 'getEmailSettings', 'saveEmailSettings', 'testSmtpConnection', 'syncEmployeesToSupabaseAuth', 'toggleCompanyStatus', 'toggleUserStatus', 'getPlatformAnnouncements', 'createPlatformAnnouncement', 'toggleAnnouncementStatus', 'deletePlatformAnnouncement', 'sendUserInvite']);
const SYSTEM = new Set(['focusWindow', 'setFullScreen', 'openExternal', 'showNotification', 'checkForUpdates', 'downloadUpdate', 'quitAndInstall', 'getPlatform', 'getMemoryUsage', 'getDiskUsage', 'saveAsPdf', 'saveReportPdf']);
const ADMIN = new Set(['createCompany', 'updateCompany', 'deleteCompany', 'getSettings', 'saveSettings', 'getCompanyDbSettings', 'saveCompanyDbSettings', 'getCompanyNotificationSettings', 'saveCompanyNotificationSettings', 'runCompanyNotificationScan', 'sendTestNotificationEmail', 'getCompanyAuditLogs', 'exportCompanyData', 'importCompanyData']);

function moduleFor(method) {
    if (/Meal/.test(method)) return 'meals';
    if (/Finance|Transaction|Check/.test(method)) return 'finance';
    if (/Work/.test(method)) return 'works';
    if (/Customer/.test(method)) return 'customers';
    if (/Employee|Personnel|Salary|Salaries|Leave|Overtime|Payroll|Department|Request|Approval/.test(method)) return 'employees';
    if (/Vehicle|Maintenance|Inspection|Insurance|Assignment|Service|Document|Arvento|arvento|Dashboard|UpcomingEvents|RecentActivity|PublicHoliday/.test(method)) return 'vehicles';
    return null;
}
function permissionsFor(actor) {
    let direct = actor.permissions;
    if (typeof direct === 'string') { try { direct = JSON.parse(direct); } catch { direct = null; } }
    return direct && Object.keys(direct).length ? direct : actor.custom_role?.permissions || [];
}
function permission(actor, module, action) {
    if (['superadmin', 'company_admin', 'admin'].includes(actor.role)) return true;
    const p = permissionsFor(actor);
    if (Array.isArray(p)) return !!p.find(x => x.module === module)?.[action];
    const suffix = { can_read: 'read', can_create: 'create', can_update: 'edit', can_delete: 'delete', can_approve: 'approve' }[action];
    if (typeof p[`${module}_${suffix}`] === 'boolean') return p[`${module}_${suffix}`];
    return ['editor', 'ADMIN'].includes(p[module]) || (action === 'can_read' && ['viewer', 'VIEW'].includes(p[module]));
}
function actionFor(method) {
    if (/^(get|search|read|arventoGet|testArvento|arventoTest)/.test(method)) return 'can_read';
    if (/^(delete|archive)/.test(method)) return 'can_delete';
    if (/^(create|add)/.test(method)) return 'can_create';
    if (method === 'processApproval') return 'can_approve';
    return 'can_update';
}
function assertCompany(actor, id) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) forbidden('Geçerli şirket kimliği gereklidir.');
    if (!['superadmin', 'admin'].includes(actor?.role) && !actor?.companyIds?.includes(Number(id))) forbidden('Şirkete erişim yetkiniz yok.');
}
async function authorize(method, args, actor, prisma) {
    if (PUBLIC.has(method)) return args;
    if (!actor) { const e = new Error('Giriş yapmanız gerekiyor.'); e.status = 401; throw e; }
    if (actor.must_change_password === 1 && !['changePassword', 'getUserProfile', 'logout', 'getCompanies'].includes(method)) forbidden('Devam etmeden önce şifrenizi değiştirin.');
    if (method === 'syncPasswordReset') forbidden('Bu parola sıfırlama yöntemi kaldırıldı.');
    if (method === 'logout') return [];
    if (method === 'recordHeartbeat') return [{ ...(args[0] || {}), userId: actor.id, username: actor.username, userRole: actor.role, sessionId: actor.sessionId, companyId: actor.companyIds[0] || null }];
    if (SYSTEM.has(method)) return args;
    if (PLATFORM.has(method) || /Platform/.test(method)) {
        if (actor.role !== 'superadmin') forbidden();
        return args;
    }
    if (method === 'getCompanies') return [actor.id];
    if (SELF.has(method)) {
        const id = typeof args[0] === 'object' ? args[0]?.userId : args[0];
        if (Number(id) !== actor.id) forbidden('Bu işlem yalnızca kendi hesabınızda kullanılabilir.');
        return args;
    }
    const isAdmin = ['superadmin', 'company_admin', 'admin'].includes(actor.role);
    if (USER_ADMIN.has(method)) {
        if (!isAdmin) forbidden();
        actor.manageUsers = true;
        if (method === 'assignUserRole') {
            const data = args[0] || {};
            if (actor.role !== 'superadmin' && data.role && !['personnel', 'user', 'manager', 'accountant'].includes(data.role)) forbidden();
            const target = await prisma.users.findFirst({ where: { id: Number(data.userId), ...(scopeFor('users', actor) || {}) } });
            if (!target || (actor.role !== 'superadmin' && ['superadmin', 'company_admin', 'admin'].includes(target.role))) forbidden();
        }
        if (['createEmployeeUser', 'sendPersonnelInvite'].includes(method) && actor.role !== 'superadmin' && !['personnel', 'user', 'manager', 'accountant', undefined].includes(args[0]?.role)) forbidden();
    } else if (ADMIN.has(method)) {
        if (!isAdmin) forbidden();
        if (method === 'createCompany') args[0] = { ...args[0], userId: actor.id };
        if (method === 'importCompanyData') args[0] = actor.id;
        if (['getSettings', 'getCompanyDbSettings', 'getCompanyNotificationSettings', 'runCompanyNotificationScan', 'exportCompanyData'].includes(method)) assertCompany(actor, args[0]?.companyId || args[0]);
        if (['saveSettings', 'saveCompanyDbSettings', 'saveCompanyNotificationSettings'].includes(method)) assertCompany(actor, args[0]?.companyId || args[0]);
        if (method === 'getCompanyAuditLogs') {
            assertCompany(actor, args[0]?.companyId);
            args[0] = { ...args[0], companyId: Number(args[0].companyId) };
        }
    } else if (method === 'getActiveAnnouncements') {
        assertCompany(actor, args[0]?.companyId || args[0]);
    } else if (method === 'searchGlobal') {
        const targetCid = args[0] || actor.companyIds?.[0] || null;
        if (targetCid) assertCompany(actor, targetCid);
        args[0] = targetCid;
    } else if (method === 'createRequest') {
        args[0] = { ...args[0], createdById: actor.id, ...(actor.role === 'personnel' ? { employeeId: actor.employee_id } : {}) };
    } else if (method === 'getRequests' && actor.role === 'personnel') {
        args[0] = { ...args[0], employeeId: actor.employee_id || -1 };
    } else if (['archiveItem', 'archiveItems'].includes(method)) {
        const module = moduleFor(String(args[0]).replace(/(^|_)(\w)/g, (_, a, b) => b.toUpperCase()));
        if (!module || !permission(actor, module, 'can_delete')) forbidden();
    } else if (['readDocumentData', 'selectFile', 'saveFile', 'openFile', 'openDocument', 'downloadFile'].includes(method)) {
        // File ownership is enforced by the file transport/handler.
    } else {
        const module = moduleFor(method);
        const selfReads = ['getEmployeeById', 'getSalaries', 'getLeaves', 'getOvertimes', 'getEmployeeAssignments', 'getEmployeeDocuments'];
        if (!(actor.role === 'personnel' && selfReads.includes(method)) && (!module || !permission(actor, module, actionFor(method)))) forbidden();
        const p = permissionsFor(actor);
        if (Array.isArray(p) && p.find(x => x.module === module)?.scope === 'OWN') actor.ownScope = true;
    }
    // Raw SQL settings services must not trust tenant/user IDs in object arguments.
    if (!['readDocumentData', 'selectFile', 'saveFile', 'openFile', 'openDocument', 'downloadFile'].includes(method)) {
        for (const arg of args) {
            if (!arg || typeof arg !== 'object' || Array.isArray(arg)) continue;
            if (arg.companyId != null) assertCompany(actor, arg.companyId);
            if (arg.company_id != null) assertCompany(actor, arg.company_id);
        }
    }
    return args;
}

const SECRET_FIELDS = new Set(['password_hash', 'password', 'two_factor_secret', 'two_factor_backup_codes', 'recovery_otp', 'recovery_otp_expires_at', 'smtp_pass']);
function sanitize(value) {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_FIELDS.has(key)).map(([key, item]) => [key, sanitize(item)]));
}
async function dispatch(method, args, actor, fn, prisma) {
    if (!Array.isArray(args) || args.length > 12) { const e = new Error('Geçersiz çağrı parametreleri.'); e.status = 400; throw e; }
    const checked = await authorize(method, structuredClone(args), actor, prisma);
    return run({ actor, method }, async () => sanitize(await fn(...checked)));
}
module.exports = { PUBLIC, SELF, assertCompany, authorize, dispatch, sanitize, permission };
