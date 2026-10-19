const path = require('node:path');
const fs = require('node:fs');
const { forbidden } = require('./context');
const { assertCompany, permission } = require('./access');

function safePath(root, name) {
    if (typeof name !== 'string' || !name || name.includes('\0') || name.includes('\\') || path.isAbsolute(name)) forbidden('Geçersiz dosya yolu.');
    const parts = name.split('/');
    if (parts.some(p => !p || p === '.' || p === '..' || p.startsWith('.'))) forbidden('Geçersiz dosya yolu.');
    const base = path.resolve(root);
    const target = path.resolve(base, name);
    if (!target.startsWith(base + path.sep)) forbidden();
    // A symlink in any existing parent must not escape the storage root.
    let existing = target;
    while (!fs.existsSync(existing) && existing !== base) existing = path.dirname(existing);
    if (fs.existsSync(base) && fs.existsSync(existing)) {
        const realBase = fs.realpathSync(base);
        const real = fs.realpathSync(existing);
        if (real !== realBase && !real.startsWith(realBase + path.sep)) forbidden();
    }
    return target;
}
function segment(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) forbidden('Geçersiz dosya klasörü.');
    return value;
}
async function authorizeFile(actor, name, prisma, write = false) {
    if (!actor) forbidden();
    if (actor.role === 'superadmin') return;
    const match = /^company_(\d+)\/([^/]+)\/(.*)$/.exec(name);
    if (match) {
        assertCompany(actor, Number(match[1]));
        const modules = { employees: 'employees', personnel: 'employees', vehicles: 'vehicles', works: 'works', customers: 'customers', companies: 'settings', company: 'settings', documents: 'vehicles' };
        const module = modules[match[2]];
        if (!module) forbidden();
        if (actor.role === 'personnel') {
            if (!['employees', 'personnel'].includes(match[2]) || !match[3].startsWith(`employee_${actor.employee_id}/`)) forbidden();
        } else if (!permission(actor, module, write ? 'can_create' : 'can_read')) forbidden();
        return;
    }
    // Legacy flat files need an actual scoped owner record, never a global basename search.
    if (write) forbidden('Yeni dosyalar şirket klasörüne kaydedilmelidir.');
    const checks = [
        ['documents', 'vehicles', { vehicles: { company_id: { in: actor.companyIds } } }],
        ['employee_documents', 'employees', { employees: { company_id: { in: actor.companyIds }, ...(actor.role === 'personnel' ? { id: actor.employee_id || -1 } : {}) } }]
    ];
    for (const [model, module, scope] of checks) {
        if (actor.role !== 'personnel' && !permission(actor, module, 'can_read')) continue;
        if (actor.role === 'personnel' && model !== 'employee_documents') continue;
        if (await prisma[model].findFirst({ where: { file_path: name, ...scope }, select: { id: true } })) return;
    }
    forbidden('Belgeye erişim yetkiniz yok.');
}
module.exports = { safePath, segment, authorizeFile };
