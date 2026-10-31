const path = require('node:path');
const fs = require('node:fs');
const { forbidden } = require('./context');
const { assertCompany, permission } = require('./access');

function safePath(root, name) {
    if (typeof name !== 'string' || !name || name.includes('\0')) forbidden('Geçersiz dosya yolu.');
    // Normalize Windows backslashes and strip leading slashes
    let normalized = name.replace(/\\/g, '/').replace(/^\/+/, '');
    // If an absolute path was passed, safely extract its basename
    if (path.isAbsolute(name) || /^[a-zA-Z]:\//.test(normalized)) {
        normalized = path.basename(normalized);
    }
    const parts = normalized.split('/');
    if (parts.some(p => !p || p === '.' || p === '..' || p.startsWith('.'))) forbidden('Geçersiz dosya yolu.');
    const base = path.resolve(root);
    const target = path.resolve(base, normalized);
    const isWin = process.platform === 'win32';
    const basePrefix = isWin ? (base + path.sep).toLowerCase() : (base + path.sep);
    const targetCheck = isWin ? target.toLowerCase() : target;
    if (!targetCheck.startsWith(basePrefix)) forbidden('Geçersiz dosya yolu.');
    // A symlink in any existing parent must not escape the storage root.
    let existing = target;
    while (!fs.existsSync(existing) && existing !== base) existing = path.dirname(existing);
    if (fs.existsSync(base) && fs.existsSync(existing)) {
        const realBase = fs.realpathSync(base);
        const real = fs.realpathSync(existing);
        const rCheck = isWin ? real.toLowerCase() : real;
        const rbCheck = isWin ? realBase.toLowerCase() : realBase;
        const rbPrefix = isWin ? (realBase + path.sep).toLowerCase() : (realBase + path.sep);
        if (rCheck !== rbCheck && !rCheck.startsWith(rbPrefix)) forbidden('Geçersiz dosya yolu.');
    }
    return target;
}
function segment(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) forbidden('Geçersiz dosya klasörü.');
    return value;
}
async function authorizeFile(actor, name, prisma, write = false) {
    if (!actor) forbidden();
    if (['superadmin', 'admin', 'company_admin'].includes(actor.role)) {
        if (actor.role === 'company_admin') {
            const match = /^company_(\d+)\//.exec(String(name || '').replace(/\\/g, '/').replace(/^\/+/, ''));
            if (match && !actor.companyIds?.includes(Number(match[1]))) forbidden('Şirkete erişim yetkiniz yok.');
        }
        return;
    }

    const normalized = String(name || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const cleanName = path.basename(normalized);

    const match = /^company_(\d+)\/([^/]+)\/(.*)$/.exec(normalized);
    if (match) {
        assertCompany(actor, Number(match[1]));
        const mod = match[2];
        if (actor.role === 'personnel') {
            if (!['employees', 'personnel'].includes(mod) || !match[3].startsWith(`employee_${actor.employee_id}/`)) forbidden();
        } else {
            const modules = { 
                employees: 'employees', personnel: 'employees', 
                vehicles: 'vehicles', works: 'works', 
                customers: 'customers', companies: 'settings', 
                company: 'settings', documents: 'vehicles',
                insurances: 'vehicles', maintenances: 'vehicles',
                inspections: 'vehicles', assignments: 'vehicles',
                stamps: 'settings', signatures: 'settings'
            };
            const permMod = modules[mod];
            if (permMod && !permission(actor, permMod, write ? 'can_create' : 'can_read')) forbidden();
        }
        return;
    }

    if (write) {
        if (!actor.companyIds || actor.companyIds.length === 0) {
            if (['admin', 'superadmin', 'company_admin'].includes(actor.role)) return;
            forbidden('Yeni dosyalar şirket klasörüne kaydedilmelidir.');
        }
        return;
    }

    const actorCompanies = actor.companyIds || (actor.companyId ? [actor.companyId] : []);
    if (!actorCompanies.length) {
        if (['admin', 'superadmin', 'company_admin'].includes(actor.role)) return;
        forbidden('Belgeye erişim yetkiniz yok.');
    }

    // 1. Company stamp, signature, logo
    try {
        if (prisma.companies) {
            const comp = await prisma.companies.findFirst({
                where: {
                    id: { in: actorCompanies },
                    OR: [
                        { stamp_path: normalized },
                        { stamp_path: cleanName },
                        { signature_path: normalized },
                        { signature_path: cleanName }
                    ]
                },
                select: { id: true }
            });
            if (comp) return;
        }
    } catch (e) {}

    // 2. Vehicle & Employee documents & other modules
    const checks = [
        ['documents', 'vehicles', { vehicles: { company_id: { in: actorCompanies } } }],
        ['employee_documents', 'employees', { employees: { company_id: { in: actorCompanies }, ...(actor.role === 'personnel' ? { id: actor.employee_id || -1 } : {}) } }],
        ['insurances', 'vehicles', { vehicles: { company_id: { in: actorCompanies } } }],
        ['maintenances', 'vehicles', { vehicles: { company_id: { in: actorCompanies } } }],
        ['inspections', 'vehicles', { vehicles: { company_id: { in: actorCompanies } } }],
        ['services', 'vehicles', { vehicles: { company_id: { in: actorCompanies } } }]
    ];

    for (const [model, module, scope] of checks) {
        if (!prisma[model]) continue;
        if (actor.role !== 'personnel' && !permission(actor, module, 'can_read')) continue;
        if (actor.role === 'personnel' && model !== 'employee_documents') continue;
        try {
            const found = await prisma[model].findFirst({
                where: {
                    OR: [
                        { file_path: normalized },
                        { file_path: cleanName }
                    ],
                    ...scope
                },
                select: { id: true }
            });
            if (found) return;
        } catch (e) {}
    }

    // 3. Admin fallback for company scope
    if (['admin', 'superadmin', 'company_admin'].includes(actor.role)) {
        return;
    }

    forbidden('Belgeye erişim yetkiniz yok.');
}
module.exports = { safePath, segment, authorizeFile };
