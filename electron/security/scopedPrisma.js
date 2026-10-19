const { context, forbidden } = require('./context');

const COMPANY_MODELS = new Set(['customers', 'employees', 'meal_settings', 'meal_tickets', 'meal_price_history', 'recurring_transactions', 'transactions', 'vehicles', 'works', 'departments', 'leave_types', 'document_categories', 'document_folders', 'vehicle_types', 'public_holidays', 'roles', 'requests', 'company_settings', 'company_notification_settings', 'audit_logs', 'user_company_access']);
const VEHICLE_MODELS = new Set(['assignments', 'documents', 'inspections', 'insurances', 'maintenances', 'services']);
const EMPLOYEE_MODELS = new Set(['employee_assignments', 'employee_attendance', 'employee_documents', 'employee_movements', 'employee_salary_history', 'leaves', 'overtimes', 'salaries']);
const USER_MODELS = new Set(['user_preferences', 'user_notification_settings', 'user_permissions']);
const REFERENCES = { company_id: 'companies', vehicle_id: 'vehicles', employee_id: 'employees', work_id: 'works', customer_id: 'customers', role_id: 'roles', request_id: 'requests' };

function scopeFor(model, actor) {
    if (!actor || actor.role === 'superadmin') return null;
    const companies = { in: actor.companyIds };
    const own = actor.role === 'personnel' || actor.ownScope;
    if (model === 'companies') return { id: companies };
    if (model === 'users') return actor.manageUsers
        ? { OR: [{ id: actor.id }, { companies: { some: { id: companies } } }, { employee: { company_id: companies } }, { user_company_access: { some: { company_id: companies } } }] }
        : { id: actor.id };
    if (model === 'employees' && own) return { company_id: companies, id: actor.employee_id || -1 };
    if (model === 'requests' && own) return { company_id: companies, employee_id: actor.employee_id || -1 };
    if (model === 'works' && own) return { company_id: companies, employee_id: actor.employee_id || -1 };
    if (COMPANY_MODELS.has(model)) return { company_id: companies };
    if (VEHICLE_MODELS.has(model)) return { vehicles: { company_id: companies } };
    if (EMPLOYEE_MODELS.has(model)) return { employees: { company_id: companies, ...(own ? { id: actor.employee_id || -1 } : {}) } };
    if (USER_MODELS.has(model)) return { user_id: actor.id };
    if (model === 'work_items') return { works: { company_id: companies }, ...(own ? { employee_id: actor.employee_id || -1 } : {}) };
    if (model === 'permissions') return { roles: { company_id: companies } };
    if (model === 'request_approvals') return { requests: { company_id: companies, ...(own ? { employee_id: actor.employee_id || -1 } : {}) } };
    if (model === 'system_announcements') return { OR: [{ company_id: null }, { company_id: companies }] };
    return { id: -1 }; // Unknown/global models are not available to tenant callers.
}

function scopedWhere(where, scope) {
    // Keep unique fields at the top level for Prisma findUnique/update/delete.
    return { ...where, AND: [...(where?.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []), scope] };
}

async function validateData(client, model, data, actor, creating) {
    if (!data || actor.role === 'superadmin') return;
    if (Array.isArray(data)) { for (const row of data) await validateData(client, model, row, actor, creating); return; }
    if (model === 'companies') {
        if (creating && data.user_id !== actor.id) forbidden();
        if (!creating && data.user_id !== undefined) forbidden('Şirket sahibi bu işlemle değiştirilemez.');
    }
    if (USER_MODELS.has(model) && data.user_id !== undefined && Number(data.user_id) !== actor.id) forbidden();
    if (model === 'users') {
        if (data.role && !['user', 'personnel', 'manager', 'accountant', 'company_admin'].includes(data.role)) forbidden();
        if (!actor.manageUsers && ['role', 'role_id', 'permissions', 'is_active', 'employee_id'].some(k => k in data)) forbidden();
    }
    for (const [key, target] of Object.entries(REFERENCES)) {
        if (!(key in data) || data[key] === null) continue;
        const value = data[key];
        if (!Number.isSafeInteger(value) || value <= 0) forbidden('Geçersiz ilişki kimliği.');
        const scope = scopeFor(target, actor);
        if (!await client[target].findFirst({ where: scopedWhere({ id: value }, scope), select: { id: true } })) forbidden('Kayıt yetkili şirket kapsamında değil.');
    }
    if (creating && COMPANY_MODELS.has(model) && !Number.isSafeInteger(data.company_id)) forbidden('Şirket kimliği zorunludur.');
    if (creating && VEHICLE_MODELS.has(model) && !Number.isSafeInteger(data.vehicle_id)) forbidden('Araç kimliği zorunludur.');
    if (creating && EMPLOYEE_MODELS.has(model) && !Number.isSafeInteger(data.employee_id)) forbidden('Personel kimliği zorunludur.');
    if (creating && model === 'work_items' && !Number.isSafeInteger(data.work_id)) forbidden('İş kimliği zorunludur.');
    // Relation writes must go through scoped scalar-ID operations. The only nested
    // write in role editing creates permission rows belonging to the checked role.
    for (const [key, value] of Object.entries(data)) {
        if (!value || typeof value !== 'object' || value instanceof Date) continue;
        if (model === 'roles' && key === 'permissions' && Object.keys(value).every(k => k === 'create')) continue;
        if (['connect', 'connectOrCreate', 'disconnect', 'set', 'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'].some(k => k in value)) forbidden('İlişkili kayıtlar ayrı yetkili işlemlerle güncellenmelidir.');
    }
}

function withTenantScope(client) {
    const models = new Map();
    return new Proxy(client, {
        get(target, key) {
            if (key === '$transaction') return (fn, options) => {
                if (typeof fn !== 'function') throw new Error('Use callback transactions with tenant scope.');
                return target.$transaction(tx => fn(withTenantScope(tx)), options);
            };
            const value = target[key];
            if (typeof value === 'function') return value.bind(target);
            if (!value || typeof value.findMany !== 'function') return value;
            if (!models.has(key)) models.set(key, new Proxy(value, {
                get(delegate, operation) {
                    const fn = delegate[operation];
                    if (typeof fn !== 'function') return fn;
                    return async (args = {}) => {
                        const actor = context()?.actor;
                        const scope = scopeFor(key, actor);
                        if (!scope) return fn.call(delegate, args);
                        const next = { ...args };
                        if (['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) next.where = scopedWhere(args.where, scope);
                        else if (!['create', 'createMany', 'upsert'].includes(operation)) forbidden();
                        if (operation === 'upsert') {
                            const existing = await delegate.findFirst({ where: args.where });
                            if (existing && !await delegate.findFirst({ where: scopedWhere(args.where, scope) })) forbidden();
                            await validateData(target, key, args.create, actor, true);
                            await validateData(target, key, args.update, actor, false);
                            next.where = scopedWhere(args.where, scope);
                        }
                        if (args.data) await validateData(target, key, args.data, actor, operation.startsWith('create'));
                        const result = await fn.call(delegate, next);
                        if (key === 'companies' && operation === 'create' && result.user_id === actor.id && !actor.companyIds.includes(result.id)) actor.companyIds.push(result.id);
                        return result;
                    };
                }
            }));
            return models.get(key);
        }
    });
}
module.exports = { withTenantScope, scopeFor, scopedWhere, validateData };
