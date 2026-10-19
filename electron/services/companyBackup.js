const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { safePath } = require('../security/files');

// Dependency order is also the restore order. Accounts and audit history are not cloned.
const DIRECT = ['departments', 'leave_types', 'document_categories', 'document_folders', 'vehicle_types', 'public_holidays', 'roles', 'customers', 'vehicles', 'employees', 'works', 'meal_settings', 'meal_price_history', 'meal_tickets', 'recurring_transactions', 'company_settings', 'company_notification_settings'];
const VEHICLE = ['assignments', 'documents', 'inspections', 'insurances', 'maintenances', 'services'];
const EMPLOYEE = ['employee_assignments', 'employee_attendance', 'employee_documents', 'employee_movements', 'employee_salary_history', 'leaves', 'overtimes', 'salaries'];
const ORDER = [...DIRECT, 'permissions', ...VEHICLE, ...EMPLOYEE, 'work_items', 'transactions'];
const FK = { company_id: 'companies', vehicle_id: 'vehicles', employee_id: 'employees', customer_id: 'customers', work_id: 'works', role_id: 'roles' };

function metadata() { return require('../prisma/client').Prisma.dmmf.datamodel.models; }
function scalarData(model, row, models) {
    const fields = models.find(m => m.name === model)?.fields;
    if (!fields) throw new Error(`Desteklenmeyen yedek tablosu: ${model}`);
    return Object.fromEntries(fields.filter(f => f.kind === 'scalar' && !['id', 'created_at', 'updated_at'].includes(f.name) && row[f.name] !== undefined).map(f => [f.name, f.type === 'DateTime' && row[f.name] ? new Date(row[f.name]) : row[f.name]]));
}
function collectPaths(value, out = new Set()) {
    if (!value || typeof value !== 'object') return out;
    for (const [key, item] of Object.entries(value)) {
        if (key.endsWith('_path') && typeof item === 'string' && item && !/^(https?:|data:)/.test(item)) out.add(item);
        else if (item && typeof item === 'object') collectPaths(item, out);
    }
    return out;
}
async function exportSnapshot(prisma, companyId, filesRoot) {
    const id = Number(companyId);
    const company = await prisma.companies.findUnique({ where: { id } });
    if (!company) throw new Error('Şirket bulunamadı.');
    const tables = {};
    for (const model of DIRECT) tables[model] = await prisma[model].findMany({ where: { company_id: id } });
    for (const model of VEHICLE) tables[model] = await prisma[model].findMany({ where: { vehicles: { company_id: id } } });
    for (const model of EMPLOYEE) tables[model] = await prisma[model].findMany({ where: { employees: { company_id: id } } });
    tables.permissions = await prisma.permissions.findMany({ where: { roles: { company_id: id } } });
    tables.work_items = await prisma.work_items.findMany({ where: { works: { company_id: id } } });
    tables.transactions = await prisma.transactions.findMany({ where: { company_id: id } });
    const files = [];
    let bytes = 0;
    for (const name of collectPaths({ company, tables })) {
        const target = safePath(filesRoot, name);
        let buffer;
        if (fs.existsSync(target)) buffer = fs.readFileSync(target);
        else {
            const cloud = await require('./supabase.service').downloadFromStorage(name);
            if (cloud.success) buffer = cloud.buffer || cloud.data;
        }
        if (!buffer) throw new Error(`Yedek eksik: ${name} dosyası okunamadı.`);
        bytes += buffer.length;
        if (bytes > 30 * 1024 * 1024) throw new Error('Dosyalar 30 MB sınırını aşıyor. Tam sunucu yedekleme aracını kullanın.');
        files.push({ path: name, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), base64: buffer.toString('base64') });
    }
    return JSON.parse(JSON.stringify({ version: 3, company, tables, files, exportedAt: new Date().toISOString(), excluded: ['login_accounts', 'audit_history', 'approval_requests', 'user_preferences'] }));
}
function upgradeLegacy(backup) {
    const tables = Object.fromEntries(ORDER.map(m => [m, []]));
    for (const model of ['vehicles', 'employees', 'customers', 'works', 'transactions']) tables[model] = backup[model] || [];
    tables.meal_tickets = backup.mealTickets || [];
    for (const v of tables.vehicles) for (const model of VEHICLE) tables[model].push(...(v[model] || []).map(row => ({ ...row, vehicle_id: v.id })));
    for (const e of tables.employees) for (const model of EMPLOYEE) tables[model].push(...(e[model] || []).map(row => ({ ...row, employee_id: e.id })));
    for (const w of tables.works) tables.work_items.push(...(w.work_items || []).map(row => ({ ...row, work_id: w.id })));
    return tables;
}
async function importSnapshot(prisma, userId, backup, filesRoot, models = metadata()) {
    if (!backup?.company || ![undefined, '2.0-cloud', 3].includes(backup.version)) throw new Error('Desteklenmeyen yedek biçimi.');
    const tables = backup.version === 3 ? backup.tables : upgradeLegacy(backup);
    if (!tables || ORDER.some(m => tables[m] !== undefined && !Array.isArray(tables[m]))) throw new Error('Geçersiz yedek tabloları.');
    if (Object.keys(tables).some(m => !ORDER.includes(m))) throw new Error('Yedekte desteklenmeyen tablo var; veriler atlanmadı.');
    if (ORDER.reduce((n, m) => n + (tables[m]?.length || 0), 0) > 100000) throw new Error('Yedek kayıt sınırını aşıyor.');
    const warnings = backup.version === 3 ? [] : ['Eski yedek dosya içeriklerini ve bazı ayarları içermiyor; mevcut tüm ilişkisel kayıtlar geri yüklendi.'];
    const files = backup.files || [];
    if (!Array.isArray(files)) throw new Error('Geçersiz dosya listesi.');
    let total = 0;
    for (const file of files) {
        safePath(filesRoot, file.path);
        const buf = Buffer.from(file.base64, 'base64');
        total += buf.length;
        if (total > 30 * 1024 * 1024 || crypto.createHash('sha256').update(buf).digest('hex') !== file.sha256) throw new Error('Yedek dosyası bütünlük/boyut kontrolünden geçemedi.');
    }
    const paths = collectPaths({ company: backup.company, tables });
    if (backup.version === 3 && [...paths].some(name => !files.some(f => f.path === name))) throw new Error('Yedekte bağlı dosya eksik.');
    let newDirectory;
    try {
        const company = await prisma.$transaction(async tx => {
            const permitted = new Set(['name', 'tax_number', 'tax_office', 'sgk_no', 'address', 'phone']);
            const data = Object.fromEntries(Object.entries(scalarData('companies', backup.company, models)).filter(([key]) => permitted.has(key)));
            delete data.signature_path; delete data.stamp_path;
            const comp = await tx.companies.create({ data: { ...data, user_id: Number(userId), name: `${data.name} (Geri Yüklendi)` } });
            const maps = { companies: new Map([[Number(backup.company.id), comp.id]]) };
            const replacements = new Map();
            newDirectory = safePath(filesRoot, `company_${comp.id}/restore_${crypto.randomUUID()}`);
            fs.mkdirSync(newDirectory, { recursive: true });
            for (const file of files) {
                const name = `${path.relative(filesRoot, newDirectory)}/${crypto.randomUUID()}${path.extname(file.path)}`;
                fs.writeFileSync(safePath(filesRoot, name), Buffer.from(file.base64, 'base64'), { flag: 'wx' });
                replacements.set(file.path, name);
            }
            const remapPaths = data => {
                for (const [key, val] of Object.entries(data)) if (key.endsWith('_path') && replacements.has(val)) data[key] = replacements.get(val);
            };
            for (const model of ORDER) {
                maps[model] = new Map();
                for (const row of tables[model] || []) {
                    const data = scalarData(model, row, models);
                    for (const [fk, parent] of Object.entries(FK)) if (data[fk] != null) {
                        const mapped = parent === 'companies' ? comp.id : maps[parent]?.get(Number(data[fk]));
                        if (!mapped) throw new Error(`${model}: eksik ${parent} ilişkisi. İşlem geri alındı.`);
                        data[fk] = mapped;
                    }
                    if (model === 'documents' && data.related_id && data.related_type) {
                        const parent = { inspection: 'inspections', periodic_inspection: 'inspections', maintenance: 'maintenances', insurance: 'insurances', assignment: 'assignments', service: 'services' }[data.related_type];
                        // Operation IDs are remapped in the second pass below.
                        if (parent) data.related_id = null;
                    }
                    if (model === 'transactions' && typeof data.category === 'string') {
                        const match = /^(WORK_PAYMENT_|SALARY_PAYMENT_)(\d+)$/.exec(data.category);
                        if (match) {
                            const mapped = maps[match[1] === 'WORK_PAYMENT_' ? 'works' : 'salaries'].get(Number(match[2]));
                            if (!mapped) throw new Error('Ödeme ilişkisi yedekte bulunamadı.');
                            data.category = match[1] + mapped;
                        }
                    }
                    remapPaths(data);
                    const created = await tx[model].create({ data });
                    if (row.id != null) maps[model].set(Number(row.id), created.id);
                }
            }
            for (const row of tables.documents || []) {
                const parent = { inspection: 'inspections', periodic_inspection: 'inspections', maintenance: 'maintenances', insurance: 'insurances', assignment: 'assignments', service: 'services' }[row.related_type];
                if (parent && row.related_id) {
                    const id = maps[parent].get(Number(row.related_id));
                    if (!id) throw new Error('Belgenin operasyon ilişkisi bulunamadı.');
                    await tx.documents.update({ where: { id: maps.documents.get(Number(row.id)) }, data: { related_id: id } });
                }
            }
            const assets = { signature_path: backup.company.signature_path, stamp_path: backup.company.stamp_path };
            remapPaths(assets);
            await tx.companies.update({ where: { id: comp.id }, data: assets });
            return comp;
        }, { timeout: 120000, maxWait: 10000 });
        return { success: true, companyId: company.id, warnings, restoredCounts: Object.fromEntries(ORDER.map(m => [m, tables[m]?.length || 0])) };
    } catch (error) {
        if (newDirectory) fs.rmSync(newDirectory, { recursive: true, force: true });
        throw error;
    }
}
module.exports = { exportSnapshot, importSnapshot, upgradeLegacy, ORDER };
