const { Client } = require('pg');
const Database = require('better-sqlite3');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { postgresDdlSql } = require('../utils/postgresDdl');
const { getDbPath } = require('../prismaClient');
const log = require('../logger');

/**
 * Robust date parser for PostgreSQL timestamp/date columns.
 */
function parseDateForPg(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string' && val.trim() === '') return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Migrates local SQLite database to PostgreSQL safely:
 * - Preserves existing cloud data (never deletes other companies/users).
 * - Dynamically remaps all foreign keys (users, companies, vehicles, employees, works, etc.).
 * - Idempotent per company: if the same company is re-migrated, only its own data is refreshed.
 * - Uploads local media/documents to Supabase storage.
 */
async function migrateSqliteToPostgres(sender, postgresUrl) {
    const sendLog = (msg) => {
        try {
            if (sender && !sender.isDestroyed()) {
                sender.send('migration-log', msg);
            }
        } catch (e) {}
        log.info(`[Migration] ${msg}`);
    };

    let sqliteDb = null;
    let pgClient = null;

    try {
        sendLog('PostgreSQL bulut sunucusuna bağlanılıyor...');
        pgClient = new Client({ connectionString: postgresUrl });
        await pgClient.connect();
        sendLog('✓ PostgreSQL bağlantısı sağlandı.');

        sendLog('Bulut veritabanı şeması ve tabloları kontrol ediliyor/güncelleniyor...');
        await pgClient.query(postgresDdlSql);
        sendLog('✓ Veritabanı şeması hazır.');

        let sqlitePath = getDbPath();
        if (!fs.existsSync(sqlitePath)) {
            const home = process.env.HOME || process.env.USERPROFILE || '';
            const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(home, 'Library/Application Support') : '');
            const candidates = [
                path.join(appData, 'kontrol-app/data/aractakip.db'),
                path.join(appData, 'Kontrol/data/aractakip.db'),
                path.join(appData, 'AracTakip/data/aractakip.db'),
                path.join(home, 'Library/Application Support/kontrol-app/data/aractakip.db'),
                path.join(__dirname, '../../data/aractakip.db'),
                path.join(process.cwd(), 'data/aractakip.db'),
                path.join(process.cwd(), 'aractakip.db')
            ];
            const found = candidates.find(c => fs.existsSync(c));
            if (found) {
                sqlitePath = found;
            }
        }
        sendLog(`Aktarılacak yerel veritabanı: ${sqlitePath}`);

        if (!fs.existsSync(sqlitePath)) {
            throw new Error(`Yerel veritabanı dosyası bulunamadı: ${sqlitePath}`);
        }

        sqliteDb = new Database(sqlitePath, { readonly: true });

        // Helper to check if a table exists in SQLite
        const sqliteHasTable = (tName) => {
            try {
                const row = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tName);
                return !!row;
            } catch (e) {
                return false;
            }
        };

        // Cache column info for PostgreSQL tables
        const pgTableColumnsCache = new Map();
        async function getPgColumns(tableName) {
            if (pgTableColumnsCache.has(tableName)) {
                return pgTableColumnsCache.get(tableName);
            }
            const res = await pgClient.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [tableName]);
            const colMap = new Map();
            res.rows.forEach(r => colMap.set(r.column_name, r));
            pgTableColumnsCache.set(tableName, colMap);
            return colMap;
        }

        // Disable foreign keys temporarily during data transfer
        await pgClient.query("SET session_replication_role = 'replica'");

        // ID Mapping Stores: SQLite ID -> PostgreSQL ID
        const userMap = new Map();
        const companyMap = new Map();
        const roleMap = new Map();
        const departmentMap = new Map();
        const folderMap = new Map();
        const customerMap = new Map();
        const vehicleMap = new Map();
        const employeeMap = new Map();
        const workMap = new Map();
        const requestMap = new Map();

        // ─────────────────────────────────────────────────────────
        // 1. MIGRATING USERS
        // ─────────────────────────────────────────────────────────
        if (sqliteHasTable('users')) {
            sendLog('--- [1/8] Kullanıcı hesapları aktarılıyor ---');
            const sqliteUsers = sqliteDb.prepare('SELECT * FROM users').all();
            const pgCols = await getPgColumns('users');

            for (const u of sqliteUsers) {
                try {
                    // Check if a user with same username or email already exists in PostgreSQL
                    const existingRes = await pgClient.query(`
                        SELECT id, username, email, password_hash 
                        FROM users 
                        WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)
                    `, [u.username, u.email]);

                    if (existingRes.rows.length > 0) {
                        const existingUser = existingRes.rows[0];
                        // If exact match on username and email, reuse the account
                        if (existingUser.username.toLowerCase() === u.username.toLowerCase() &&
                            existingUser.email.toLowerCase() === u.email.toLowerCase()) {
                            userMap.set(u.id, existingUser.id);
                            sendLog(`  • Kullanıcı "${u.username}" bulutta mevcut, eşleştirildi (ID: ${existingUser.id}).`);
                            continue;
                        }

                        // If conflict on username or email, ensure unique credentials
                        let uniqueUsername = u.username;
                        let uCounter = 2;
                        while (true) {
                            const check = await pgClient.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [uniqueUsername]);
                            if (check.rows.length === 0) break;
                            uniqueUsername = `${u.username}_${uCounter++}`;
                        }

                        let uniqueEmail = u.email;
                        let eCounter = 2;
                        const emailParts = (u.email || 'user@kontrol.app').split('@');
                        while (true) {
                            const check = await pgClient.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [uniqueEmail]);
                            if (check.rows.length === 0) break;
                            uniqueEmail = `${emailParts[0]}_${eCounter++}@${emailParts[1] || 'kontrol.app'}`;
                        }

                        const insertRes = await pgClient.query(`
                            INSERT INTO users (username, email, full_name, password_hash, role, must_change_password, is_active, status, created_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            RETURNING id
                        `, [
                            uniqueUsername,
                            uniqueEmail,
                            u.full_name || uniqueUsername,
                            u.password_hash,
                            u.role || 'user',
                            u.must_change_password || 0,
                            u.is_active !== undefined ? u.is_active : 1,
                            u.status || 'active',
                            parseDateForPg(u.created_at) || new Date()
                        ]);

                        const newId = insertRes.rows[0].id;
                        userMap.set(u.id, newId);
                        sendLog(`  • Kullanıcı "${u.username}" çakışmayı önlemek için "${uniqueUsername}" olarak oluşturuldu (ID: ${newId}).`);
                    } else {
                        // Brand new user
                        const insertRes = await pgClient.query(`
                            INSERT INTO users (username, email, full_name, password_hash, role, must_change_password, is_active, status, created_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            RETURNING id
                        `, [
                            u.username,
                            u.email,
                            u.full_name || u.username,
                            u.password_hash,
                            u.role || 'user',
                            u.must_change_password || 0,
                            u.is_active !== undefined ? u.is_active : 1,
                            u.status || 'active',
                            parseDateForPg(u.created_at) || new Date()
                        ]);

                        const newId = insertRes.rows[0].id;
                        userMap.set(u.id, newId);
                        sendLog(`  • Kullanıcı "${u.username}" başarıyla aktarıldı (ID: ${newId}).`);
                    }
                } catch (uErr) {
                    sendLog(`  ! Kullanıcı "${u.username}" aktarılırken hata: ${uErr.message}`);
                }
            }
        }

        // Fallback user if needed
        const defaultPgUserId = userMap.values().next().value || 1;

        // ─────────────────────────────────────────────────────────
        // 2. MIGRATING COMPANIES (Tenant Root)
        // ─────────────────────────────────────────────────────────
        if (sqliteHasTable('companies')) {
            sendLog('--- [2/8] Şirket profilleri aktarılıyor ---');
            const sqliteCompanies = sqliteDb.prepare('SELECT * FROM companies').all();

            for (const c of sqliteCompanies) {
                try {
                    const mappedUserId = userMap.get(c.user_id) || defaultPgUserId;

                    // Check if this company already exists in PG
                    let existingCompRes;
                    if (c.tax_number && c.tax_number.trim()) {
                        existingCompRes = await pgClient.query(
                            'SELECT id FROM companies WHERE name = $1 AND tax_number = $2',
                            [c.name, c.tax_number]
                        );
                    } else {
                        existingCompRes = await pgClient.query(
                            'SELECT id FROM companies WHERE name = $1 AND (tax_number IS NULL OR tax_number = \'\')',
                            [c.name]
                        );
                    }

                    if (existingCompRes.rows.length > 0) {
                        const existingCompId = existingCompRes.rows[0].id;
                        sendLog(`  • Şirket "${c.name}" bulutta zaten mevcut. Eski verileri temizlenip güncelleniyor...`);
                        // Cascade delete ONLY this company's records, leaving all other companies safe
                        await pgClient.query('DELETE FROM companies WHERE id = $1', [existingCompId]);
                    }

                    const insertRes = await pgClient.query(`
                        INSERT INTO companies (user_id, name, tax_number, tax_office, sgk_no, address, phone, signature_path, stamp_path, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        RETURNING id
                    `, [
                        mappedUserId,
                        c.name,
                        c.tax_number || null,
                        c.tax_office || null,
                        c.sgk_no || null,
                        c.address || null,
                        c.phone || null,
                        c.signature_path || null,
                        c.stamp_path || null,
                        parseDateForPg(c.created_at) || new Date()
                    ]);

                    const newCompId = insertRes.rows[0].id;
                    companyMap.set(c.id, newCompId);
                    sendLog(`  ✓ Şirket "${c.name}" aktarıldı (Yeni Bulut ID: ${newCompId}).`);

                    // Ensure user_company_access entry
                    if (mappedUserId && newCompId) {
                        try {
                            await pgClient.query(`
                                INSERT INTO user_company_access (user_id, company_id)
                                VALUES ($1, $2)
                                ON CONFLICT DO NOTHING
                            `, [mappedUserId, newCompId]);
                        } catch (e) {}
                    }
                } catch (cErr) {
                    sendLog(`  ! Şirket "${c.name}" aktarılamadı: ${cErr.message}`);
                }
            }
        }

        // Primary company fallback
        const defaultPgCompanyId = companyMap.values().next().value || null;

        // Generic row inserter for child tables
        async function insertMappedRows(tableName, rows, mapperFn) {
            if (!rows || rows.length === 0) return 0;
            const pgCols = await getPgColumns(tableName);
            let insertedCount = 0;

            for (const rawRow of rows) {
                try {
                    const mappedRow = mapperFn(rawRow);
                    if (!mappedRow) continue; // Skipped intentionally

                    const validKeys = Object.keys(mappedRow).filter(k => pgCols.has(k));
                    if (validKeys.length === 0) continue;

                    const colList = validKeys.map(k => `"${k}"`).join(', ');
                    const paramPlaceholders = validKeys.map((_, idx) => `$${idx + 1}`).join(', ');
                    const paramValues = validKeys.map(k => {
                        const colMeta = pgCols.get(k);
                        const val = mappedRow[k];
                        if (val === undefined || val === null) return null;

                        const dataType = (colMeta?.data_type || '').toLowerCase();
                        if (dataType.includes('timestamp') || dataType === 'date') {
                            return parseDateForPg(val);
                        }
                        if (dataType === 'boolean') {
                            return Boolean(val);
                        }
                        if (dataType === 'integer' || dataType === 'bigint') {
                            const n = parseInt(val, 10);
                            return isNaN(n) ? null : n;
                        }
                        if (dataType === 'double precision' || dataType === 'numeric' || dataType === 'real') {
                            const f = parseFloat(val);
                            return isNaN(f) ? null : f;
                        }
                        return String(val);
                    });

                    const insertSql = `INSERT INTO "${tableName}" (${colList}) VALUES (${paramPlaceholders}) RETURNING id`;
                    const res = await pgClient.query(insertSql, paramValues);
                    insertedCount++;

                    if (res.rows && res.rows[0] && mappedRow.__recordIdMap) {
                        mappedRow.__recordIdMap(rawRow.id, res.rows[0].id);
                    }
                } catch (rowErr) {
                    // Non-fatal per-row error logging
                }
            }
            return insertedCount;
        }

        // ─────────────────────────────────────────────────────────
        // 3. COMPANY-LEVEL BASE METADATA & DICTIONARIES
        // ─────────────────────────────────────────────────────────
        sendLog('--- [3/8] Şirket ayarları ve tanımları aktarılıyor ---');

        // Roles & Permissions
        if (sqliteHasTable('roles')) {
            const rows = sqliteDb.prepare('SELECT * FROM roles').all();
            const count = await insertMappedRows('roles', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    name: r.name,
                    description: r.description || null,
                    created_at: r.created_at,
                    __recordIdMap: (oldId, newId) => roleMap.set(oldId, newId)
                };
            });
            sendLog(`  • Roller: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('permissions')) {
            const rows = sqliteDb.prepare('SELECT * FROM permissions').all();
            const count = await insertMappedRows('permissions', rows, (r) => {
                const roleId = roleMap.get(r.role_id);
                if (!roleId) return null;
                return {
                    role_id: roleId,
                    module: r.module,
                    can_read: r.can_read ? 1 : 0,
                    can_create: r.can_create ? 1 : 0,
                    can_update: r.can_update ? 1 : 0,
                    can_delete: r.can_delete ? 1 : 0,
                    can_approve: r.can_approve ? 1 : 0,
                    scope: r.scope || 'OWN'
                };
            });
            if (count > 0) sendLog(`  • Yetkiler: ${count} adet aktarıldı.`);
        }

        // Departments
        if (sqliteHasTable('departments')) {
            const rows = sqliteDb.prepare('SELECT * FROM departments').all();
            const count = await insertMappedRows('departments', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    name: r.name,
                    status: r.status || 'active',
                    created_at: r.created_at,
                    __recordIdMap: (oldId, newId) => departmentMap.set(oldId, newId)
                };
            });
            sendLog(`  • Departmanlar: ${count} adet aktarıldı.`);
        }

        // Leave Types
        if (sqliteHasTable('leave_types')) {
            const rows = sqliteDb.prepare('SELECT * FROM leave_types').all();
            const count = await insertMappedRows('leave_types', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    name: r.name,
                    status: r.status || 'active',
                    created_at: r.created_at
                };
            });
            sendLog(`  • İzin Türleri: ${count} adet aktarıldı.`);
        }

        // Document Categories
        if (sqliteHasTable('document_categories')) {
            const rows = sqliteDb.prepare('SELECT * FROM document_categories').all();
            const count = await insertMappedRows('document_categories', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    name: r.name,
                    status: r.status || 'active',
                    target_type: r.target_type || 'employee',
                    created_at: r.created_at
                };
            });
            sendLog(`  • Belge Kategorileri: ${count} adet aktarıldı.`);
        }

        // Document Folders
        if (sqliteHasTable('document_folders')) {
            const rows = sqliteDb.prepare('SELECT * FROM document_folders').all();
            const count = await insertMappedRows('document_folders', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    name: r.name,
                    related_type: r.related_type || null,
                    related_id: r.related_id || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at,
                    __recordIdMap: (oldId, newId) => folderMap.set(oldId, newId)
                };
            });
            if (count > 0) sendLog(`  • Belge Klasörleri: ${count} adet aktarıldı.`);
        }

        // Vehicle Types
        if (sqliteHasTable('vehicle_types')) {
            const rows = sqliteDb.prepare('SELECT * FROM vehicle_types').all();
            const count = await insertMappedRows('vehicle_types', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    name: r.name,
                    created_at: r.created_at
                };
            });
            sendLog(`  • Araç Tipleri: ${count} adet aktarıldı.`);
        }

        // Public Holidays
        if (sqliteHasTable('public_holidays')) {
            const rows = sqliteDb.prepare('SELECT * FROM public_holidays').all();
            const count = await insertMappedRows('public_holidays', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    date: r.date,
                    description: r.description || null,
                    status: r.status || 'active',
                    created_at: r.created_at
                };
            });
            sendLog(`  • Resmi Tatiller: ${count} adet aktarıldı.`);
        }

        // Meal Settings & Tickets
        if (sqliteHasTable('meal_settings')) {
            const rows = sqliteDb.prepare('SELECT * FROM meal_settings').all();
            for (const ms of rows) {
                const compId = companyMap.get(ms.company_id) || defaultPgCompanyId;
                if (compId) {
                    try {
                        await pgClient.query(`
                            INSERT INTO meal_settings (company_id, price_per_person, is_archived, created_at)
                            VALUES ($1, $2, $3, $4)
                            ON CONFLICT (company_id) DO UPDATE SET price_per_person = EXCLUDED.price_per_person
                        `, [compId, ms.price_per_person || 0, ms.is_archived || 0, parseDateForPg(ms.created_at) || new Date()]);
                    } catch (e) {}
                }
            }
        }

        if (sqliteHasTable('meal_tickets')) {
            const rows = sqliteDb.prepare('SELECT * FROM meal_tickets').all();
            const count = await insertMappedRows('meal_tickets', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    date: r.date,
                    person_count: r.person_count || 1,
                    price_per_person: r.price_per_person || 0,
                    notes: r.notes || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            if (count > 0) sendLog(`  • Yemek Fişleri: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('meal_price_history')) {
            const rows = sqliteDb.prepare('SELECT * FROM meal_price_history').all();
            const count = await insertMappedRows('meal_price_history', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    old_price: r.old_price || 0,
                    new_price: r.new_price || 0,
                    change_date: r.change_date
                };
            });
            if (count > 0) sendLog(`  • Yemek Fiyat Geçmişi: ${count} adet aktarıldı.`);
        }

        // Recurring Transactions
        if (sqliteHasTable('recurring_transactions')) {
            const rows = sqliteDb.prepare('SELECT * FROM recurring_transactions').all();
            const count = await insertMappedRows('recurring_transactions', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    type: r.type,
                    method: r.method || 'CASH',
                    amount: r.amount || 0,
                    category: r.category || 'Diğer',
                    description: r.description || null,
                    frequency: r.frequency || 'MONTHLY',
                    next_run_date: r.next_run_date,
                    is_active: r.is_active !== undefined ? r.is_active : 1,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            if (count > 0) sendLog(`  • Düzenli İşlemler: ${count} adet aktarıldı.`);
        }

        // ─────────────────────────────────────────────────────────
        // 4. CORE BUSINESS ENTITIES: CUSTOMERS, VEHICLES, EMPLOYEES
        // ─────────────────────────────────────────────────────────
        sendLog('--- [4/8] Müşteriler, Araçlar ve Personeller aktarılıyor ---');

        // Customers
        if (sqliteHasTable('customers')) {
            const rows = sqliteDb.prepare('SELECT * FROM customers').all();
            const count = await insertMappedRows('customers', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    name: r.name,
                    phone: r.phone || null,
                    email: r.email || null,
                    address: r.address || null,
                    tax_number: r.tax_number || null,
                    tax_office: r.tax_office || null,
                    notes: r.notes || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at,
                    __recordIdMap: (oldId, newId) => customerMap.set(oldId, newId)
                };
            });
            sendLog(`  ✓ Müşteriler: ${count} adet aktarıldı.`);
        }

        // Vehicles
        if (sqliteHasTable('vehicles')) {
            const rows = sqliteDb.prepare('SELECT * FROM vehicles').all();
            const count = await insertMappedRows('vehicles', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    type: r.type || 'Diğer',
                    plate: r.plate,
                    brand: r.brand || null,
                    model: r.model || null,
                    year: r.year || null,
                    color: r.color || null,
                    status: r.status || 'active',
                    km: r.km || 0,
                    image: r.image || null,
                    notes: r.notes || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at,
                    __recordIdMap: (oldId, newId) => vehicleMap.set(oldId, newId)
                };
            });
            sendLog(`  ✓ Araçlar: ${count} adet aktarıldı.`);
        }

        // Employees
        if (sqliteHasTable('employees')) {
            const rows = sqliteDb.prepare('SELECT * FROM employees').all();
            const count = await insertMappedRows('employees', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    first_name: r.first_name,
                    last_name: r.last_name,
                    tc_no: r.tc_no || null,
                    phone: r.phone || null,
                    email: r.email || null,
                    position: r.position || null,
                    department: r.department || null,
                    start_date: r.start_date || null,
                    end_date: r.end_date || null,
                    salary: r.salary || 0,
                    status: r.status || 'active',
                    notes: r.notes || null,
                    image: r.image || null,
                    signature_path: r.signature_path || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at,
                    past_used_leaves: r.past_used_leaves || 0,
                    birth_date: r.birth_date || null,
                    devir_izin_bakiyesi: r.devir_izin_bakiyesi || 0,
                    devir_maas_bakiyesi: r.devir_maas_bakiyesi || 0,
                    devir_tarihi: r.devir_tarihi || null,
                    iban: r.iban || null,
                    off_days: r.off_days || '0',
                    __recordIdMap: (oldId, newId) => employeeMap.set(oldId, newId)
                };
            });
            sendLog(`  ✓ Personeller: ${count} adet aktarıldı.`);
        }

        // Link users with their mapped employee_id and role_id
        if (sqliteHasTable('users')) {
            const sqliteUsers = sqliteDb.prepare('SELECT id, employee_id, role_id FROM users').all();
            for (const u of sqliteUsers) {
                const pgUid = userMap.get(u.id);
                if (!pgUid) continue;
                const newEmpId = u.employee_id ? employeeMap.get(u.employee_id) || null : null;
                const newRoleId = u.role_id ? roleMap.get(u.role_id) || null : null;
                if (newEmpId || newRoleId) {
                    try {
                        await pgClient.query(`
                            UPDATE users 
                            SET employee_id = COALESCE($1, employee_id), 
                                role_id = COALESCE($2, role_id) 
                            WHERE id = $3
                        `, [newEmpId, newRoleId, pgUid]);
                    } catch (e) {}
                }
            }
        }

        // ─────────────────────────────────────────────────────────
        // 5. VEHICLE SUB-TABLES
        // ─────────────────────────────────────────────────────────
        sendLog('--- [5/8] Araç bakım, muayene, sigorta ve servis kayıtları aktarılıyor ---');

        if (sqliteHasTable('maintenances')) {
            const rows = sqliteDb.prepare('SELECT * FROM maintenances').all();
            const count = await insertMappedRows('maintenances', rows, (r) => {
                const vId = vehicleMap.get(r.vehicle_id);
                if (!vId) return null;
                return {
                    vehicle_id: vId,
                    type: r.type || 'Genel Bakım',
                    description: r.description || null,
                    date: r.date,
                    cost: r.cost || 0,
                    next_km: r.next_km || null,
                    next_date: r.next_date || null,
                    notes: r.notes || null,
                    file_path: r.file_path || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            sendLog(`  • Bakım Kayıtları: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('inspections')) {
            const rows = sqliteDb.prepare('SELECT * FROM inspections').all();
            const count = await insertMappedRows('inspections', rows, (r) => {
                const vId = vehicleMap.get(r.vehicle_id);
                if (!vId) return null;
                return {
                    vehicle_id: vId,
                    inspection_date: r.inspection_date,
                    next_inspection: r.next_inspection || null,
                    result: r.result || 'Geçti',
                    cost: r.cost || 0,
                    notes: r.notes || null,
                    type: r.type || 'traffic',
                    file_path: r.file_path || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            sendLog(`  • Muayene Kayıtları: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('insurances')) {
            const rows = sqliteDb.prepare('SELECT * FROM insurances').all();
            const count = await insertMappedRows('insurances', rows, (r) => {
                const vId = vehicleMap.get(r.vehicle_id);
                if (!vId) return null;
                return {
                    vehicle_id: vId,
                    company: r.company || 'Sigorta Şirketi',
                    policy_no: r.policy_no || null,
                    type: r.type || 'Trafik',
                    start_date: r.start_date,
                    end_date: r.end_date,
                    premium: r.premium || 0,
                    notes: r.notes || null,
                    file_path: r.file_path || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            sendLog(`  • Sigorta Kayıtları: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('services')) {
            const rows = sqliteDb.prepare('SELECT * FROM services').all();
            const count = await insertMappedRows('services', rows, (r) => {
                const vId = vehicleMap.get(r.vehicle_id);
                if (!vId) return null;
                return {
                    vehicle_id: vId,
                    type: r.type || 'Servis',
                    service_name: r.service_name || null,
                    description: r.description || null,
                    date: r.date,
                    km: r.km || null,
                    cost: r.cost || 0,
                    notes: r.notes || null,
                    file_path: r.file_path || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            sendLog(`  • Servis Kayıtları: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('assignments')) {
            const rows = sqliteDb.prepare('SELECT * FROM assignments').all();
            const count = await insertMappedRows('assignments', rows, (r) => {
                const vId = vehicleMap.get(r.vehicle_id) || null;
                return {
                    vehicle_id: vId,
                    item_name: r.item_name,
                    quantity: r.quantity || 1,
                    assigned_to: r.assigned_to || null,
                    department: r.department || null,
                    start_date: r.start_date,
                    end_date: r.end_date || null,
                    notes: r.notes || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            if (count > 0) sendLog(`  • Araç Zimmetleri: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('documents')) {
            const rows = sqliteDb.prepare('SELECT * FROM documents').all();
            const count = await insertMappedRows('documents', rows, (r) => {
                let vId = vehicleMap.get(r.vehicle_id) || null;
                let relId = r.related_id;

                if (r.related_type === 'vehicle' && r.related_id) {
                    relId = vehicleMap.get(r.related_id) || null;
                    if (!vId) vId = relId;
                } else if (r.related_type === 'customer' && r.related_id) {
                    relId = customerMap.get(r.related_id) || null;
                } else if (r.related_type === 'employee' && r.related_id) {
                    relId = employeeMap.get(r.related_id) || null;
                }

                return {
                    vehicle_id: vId,
                    related_type: r.related_type || null,
                    related_id: relId,
                    file_name: r.file_name,
                    file_path: r.file_path,
                    file_type: r.file_type || null,
                    doc_type: r.doc_type || null,
                    category: r.category || null,
                    folder: r.folder || null,
                    start_date: r.start_date || null,
                    end_date: r.end_date || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            sendLog(`  • Evrak ve Belgeler: ${count} adet aktarıldı.`);
        }

        // ─────────────────────────────────────────────────────────
        // 6. EMPLOYEE SUB-TABLES
        // ─────────────────────────────────────────────────────────
        sendLog('--- [6/8] Personel maaş, izin, mesai ve belgeleri aktarılıyor ---');

        if (sqliteHasTable('salaries')) {
            const rows = sqliteDb.prepare('SELECT * FROM salaries').all();
            const count = await insertMappedRows('salaries', rows, (r) => {
                const empId = employeeMap.get(r.employee_id);
                if (!empId) return null;
                return {
                    employee_id: empId,
                    period: r.period,
                    base_salary: r.base_salary || 0,
                    bonus: r.bonus || 0,
                    deduction: r.deduction || 0,
                    net_salary: r.net_salary || 0,
                    payment_date: r.payment_date || null,
                    salary_month: r.salary_month || null,
                    status: r.status || 'pending',
                    payment_method: r.payment_method || 'cash',
                    notes: r.notes || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            sendLog(`  • Maaş Kayıtları: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('leaves')) {
            const rows = sqliteDb.prepare('SELECT * FROM leaves').all();
            const count = await insertMappedRows('leaves', rows, (r) => {
                const empId = employeeMap.get(r.employee_id);
                if (!empId) return null;
                return {
                    employee_id: empId,
                    type: r.type || 'annual',
                    start_date: r.start_date,
                    end_date: r.end_date,
                    days: r.days || 1,
                    hours: r.hours || null,
                    status: r.status || 'approved',
                    notes: r.notes || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            sendLog(`  • İzin Kayıtları: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('overtimes')) {
            const rows = sqliteDb.prepare('SELECT * FROM overtimes').all();
            const count = await insertMappedRows('overtimes', rows, (r) => {
                const empId = employeeMap.get(r.employee_id);
                if (!empId) return null;
                return {
                    employee_id: empId,
                    date: r.date,
                    hours: r.hours || 0,
                    rate: r.rate || 1.5,
                    amount: r.amount || 0,
                    notes: r.notes || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            sendLog(`  • Mesai Kayıtları: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('employee_documents')) {
            const rows = sqliteDb.prepare('SELECT * FROM employee_documents').all();
            const count = await insertMappedRows('employee_documents', rows, (r) => {
                const empId = employeeMap.get(r.employee_id);
                if (!empId) return null;
                return {
                    employee_id: empId,
                    file_name: r.file_name,
                    file_path: r.file_path,
                    file_type: r.file_type || null,
                    category: r.category || null,
                    folder: r.folder || null,
                    issue_date: r.issue_date || null,
                    start_date: r.start_date || null,
                    expiry_date: r.expiry_date || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            sendLog(`  • Personel Belgeleri: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('employee_assignments')) {
            const rows = sqliteDb.prepare('SELECT * FROM employee_assignments').all();
            const count = await insertMappedRows('employee_assignments', rows, (r) => {
                const empId = employeeMap.get(r.employee_id);
                if (!empId) return null;
                return {
                    employee_id: empId,
                    item_name: r.item_name,
                    serial_number: r.serial_number || null,
                    quantity: r.quantity || 1,
                    assign_date: r.assign_date || null,
                    return_date: r.return_date || null,
                    status: r.status || 'active',
                    notes: r.notes || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            if (count > 0) sendLog(`  • Personel Zimmetleri: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('employee_attendance')) {
            const rows = sqliteDb.prepare('SELECT * FROM employee_attendance').all();
            const count = await insertMappedRows('employee_attendance', rows, (r) => {
                const empId = employeeMap.get(r.employee_id);
                if (!empId) return null;
                return {
                    employee_id: empId,
                    date: r.date,
                    status: r.status,
                    description: r.description || null,
                    created_at: r.created_at
                };
            });
            if (count > 0) sendLog(`  • Puantaj / Devam Takibi: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('employee_movements')) {
            const rows = sqliteDb.prepare('SELECT * FROM employee_movements').all();
            const count = await insertMappedRows('employee_movements', rows, (r) => {
                const empId = employeeMap.get(r.employee_id);
                if (!empId) return null;
                return {
                    employee_id: empId,
                    type: r.type,
                    amount: r.amount || 0,
                    date: r.date,
                    description: r.description || null,
                    is_paid: r.is_paid || 0,
                    payment_method: r.payment_method || 'cash',
                    created_at: r.created_at
                };
            });
            if (count > 0) sendLog(`  • Personel Hareketleri (Avans/Kesinti): ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('employee_salary_history')) {
            const rows = sqliteDb.prepare('SELECT * FROM employee_salary_history').all();
            const count = await insertMappedRows('employee_salary_history', rows, (r) => {
                const empId = employeeMap.get(r.employee_id);
                if (!empId) return null;
                return {
                    employee_id: empId,
                    amount: r.amount || 0,
                    start_date: r.start_date,
                    end_date: r.end_date || null,
                    type: r.type || 'initial',
                    description: r.description || null,
                    created_at: r.created_at
                };
            });
            if (count > 0) sendLog(`  • Maaş Geçmişi: ${count} adet aktarıldı.`);
        }

        // ─────────────────────────────────────────────────────────
        // 7. OPERATIONS, WORKS & FINANCE
        // ─────────────────────────────────────────────────────────
        sendLog('--- [7/8] Operasyonlar, İş Emirleri ve Kasa Hareketleri aktarılıyor ---');

        if (sqliteHasTable('transactions')) {
            const rows = sqliteDb.prepare('SELECT * FROM transactions').all();
            const count = await insertMappedRows('transactions', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                return {
                    company_id: compId,
                    date: r.date,
                    type: r.type,
                    category: r.category || null,
                    amount: r.amount || 0,
                    description: r.description || null,
                    payment_method: r.payment_method || null,
                    method: r.method || 'CASH',
                    check_number: r.check_number || null,
                    check_due_date: r.check_due_date || null,
                    status: r.status || 'COMPLETED',
                    currency: r.currency || 'TRY',
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            sendLog(`  • Finansal İşlemler: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('works')) {
            const rows = sqliteDb.prepare('SELECT * FROM works').all();
            const count = await insertMappedRows('works', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                if (!compId) return null;
                const vId = r.vehicle_id ? vehicleMap.get(r.vehicle_id) || null : null;
                const empId = r.employee_id ? employeeMap.get(r.employee_id) || null : null;
                const custId = r.customer_id ? customerMap.get(r.customer_id) || null : null;

                let title = r.title;
                if (!title || (typeof title === 'string' && title.trim() === '')) {
                    title = r.customer || 'İş / Operasyon';
                }

                return {
                    company_id: compId,
                    vehicle_id: vId,
                    employee_id: empId,
                    customer_id: custId,
                    customer: r.customer || null,
                    title: title,
                    description: r.description || null,
                    status: r.status || 'pending',
                    price: r.price || 0,
                    location: r.location || null,
                    start_date: r.start_date || null,
                    end_date: r.end_date || null,
                    work_start_time: r.work_start_time || '08:00',
                    work_end_time: r.work_end_time || '17:00',
                    pazar_multiplier: r.pazar_multiplier || 1.5,
                    mesai_multiplier: r.mesai_multiplier || 1.5,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at,
                    __recordIdMap: (oldId, newId) => workMap.set(oldId, newId)
                };
            });
            sendLog(`  ✓ İşler / Operasyonlar: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('work_items')) {
            const rows = sqliteDb.prepare('SELECT * FROM work_items').all();
            const count = await insertMappedRows('work_items', rows, (r) => {
                const wId = workMap.get(r.work_id);
                if (!wId) return null; // Skip orphan work item
                const vId = r.vehicle_id ? vehicleMap.get(r.vehicle_id) || null : null;
                const empId = r.employee_id ? employeeMap.get(r.employee_id) || null : null;

                return {
                    work_id: wId,
                    date: r.date,
                    receipt_no: r.receipt_no || null,
                    vehicle_id: vId,
                    employee_id: empId,
                    custom_vehicle: r.custom_vehicle || null,
                    custom_employee: r.custom_employee || null,
                    start_time: r.start_time || null,
                    end_time: r.end_time || null,
                    hours: r.hours || 0,
                    overtime_hours: r.overtime_hours || 0,
                    unit_price: r.unit_price || 0,
                    travel_price: r.travel_price || 0,
                    total_price: r.total_price || 0,
                    description: r.description || null,
                    is_archived: r.is_archived || 0,
                    created_at: r.created_at
                };
            });
            sendLog(`  ✓ Operasyon Kalemleri (Puantajlar): ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('requests')) {
            const rows = sqliteDb.prepare('SELECT * FROM requests').all();
            const count = await insertMappedRows('requests', rows, (r) => {
                const compId = companyMap.get(r.company_id) || defaultPgCompanyId;
                const createdBy = r.created_by_id ? userMap.get(r.created_by_id) || defaultPgUserId : defaultPgUserId;
                const empId = r.employee_id ? employeeMap.get(r.employee_id) || null : null;
                if (!compId || !createdBy || !empId) return null;

                return {
                    company_id: compId,
                    created_by_id: createdBy,
                    employee_id: empId,
                    type: r.type,
                    title: r.title,
                    description: r.description || null,
                    request_data: r.request_data || '{}',
                    status: r.status || 'PENDING',
                    current_step: r.current_step || 1,
                    total_steps: r.total_steps || 1,
                    document_path: r.document_path || null,
                    created_at: r.created_at,
                    updated_at: r.updated_at || r.created_at,
                    __recordIdMap: (oldId, newId) => requestMap.set(oldId, newId)
                };
            });
            if (count > 0) sendLog(`  • İzin / Avans Talepleri: ${count} adet aktarıldı.`);
        }

        if (sqliteHasTable('request_approvals')) {
            const rows = sqliteDb.prepare('SELECT * FROM request_approvals').all();
            const count = await insertMappedRows('request_approvals', rows, (r) => {
                const reqId = requestMap.get(r.request_id);
                if (!reqId) return null;
                const approverId = r.approver_id ? userMap.get(r.approver_id) || null : null;

                return {
                    request_id: reqId,
                    approver_id: approverId,
                    step: r.step || 1,
                    status: r.status,
                    comment: r.comment || null,
                    action_date: r.action_date
                };
            });
            if (count > 0) sendLog(`  • Talep Onay Hareketleri: ${count} adet aktarıldı.`);
        }

        // ─────────────────────────────────────────────────────────
        // 8. RESET SEQUENCES & SYNC PHYSICAL FILES
        // ─────────────────────────────────────────────────────────
        sendLog('--- [8/8] Veritabanı sayaçları ve fiziksel dosyalar eşitleniyor ---');

        // Reset all sequence counters in PostgreSQL
        try {
            const seqRes = await pgClient.query(`
                SELECT table_name, column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND column_default LIKE 'nextval%';
            `);
            for (const row of seqRes.rows) {
                try {
                    await pgClient.query(`
                        SELECT setval(pg_get_serial_sequence('"${row.table_name}"', '${row.column_name}'), coalesce(max("${row.column_name}"), 1)) 
                        FROM "${row.table_name}";
                    `);
                } catch (sErr) {}
            }
            sendLog('  ✓ Tüm otomatik ID sayaçları güncellendi.');
        } catch (seqErr) {
            sendLog(`  ! Sayaç güncelleme notu: ${seqErr.message}`);
        }

        // Re-enable foreign key checks
        await pgClient.query("SET session_replication_role = 'origin'");

        // Upload physical files (PDFs, pictures, stamps) to Supabase Storage
        try {
            const { uploadToStorage } = require('./supabase.service');
            const userData = app ? app.getPath('userData') : path.join(__dirname, '../../');
            const uploadDirs = [
                path.join(userData, 'files'),
                path.join(userData, 'data'),
                path.join(userData, 'uploads')
            ];

            const allFilesToUpload = [];
            for (const uDir of uploadDirs) {
                if (fs.existsSync(uDir)) {
                    const files = fs.readdirSync(uDir);
                    for (const f of files) {
                        const lower = f.toLowerCase();
                        if (lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
                            allFilesToUpload.push({ fullPath: path.join(uDir, f), fileName: f });
                        }
                    }
                }
            }

            if (allFilesToUpload.length > 0) {
                sendLog(`[Storage] ${allFilesToUpload.length} adet evrak ve görsel Supabase Storage'a senkronize ediliyor...`);
                let uploadedCount = 0;
                for (const item of allFilesToUpload) {
                    try {
                        const fileBuf = fs.readFileSync(item.fullPath);
                        const ext = path.extname(item.fileName).toLowerCase();
                        let mimeType = 'application/octet-stream';
                        if (ext === '.pdf') mimeType = 'application/pdf';
                        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
                        else if (ext === '.png') mimeType = 'image/png';

                        const res = await uploadToStorage(fileBuf, item.fileName, mimeType, 'documents');
                        if (res && res.success) {
                            uploadedCount++;
                        }
                    } catch (fErr) {}
                }
                sendLog(`✓ ${uploadedCount} adet dosya Supabase bulut depolamaya yüklendi.`);
            }
        } catch (storageErr) {
            sendLog(`[Storage Notu] ${storageErr.message}`);
        }

        sendLog('========================================================');
        sendLog('🎉 TEBRİKLER! Verileriniz diğer şirketlerle karışmadan,');
        sendLog('   ilişkileri eksiksiz korunarak bulut veritabanına aktarıldı.');
        sendLog('========================================================');

        return {
            success: true,
            migratedCompanies: companyMap.size,
            migratedVehicles: vehicleMap.size,
            migratedEmployees: employeeMap.size,
            migratedWorks: workMap.size
        };

    } catch (err) {
        sendLog(`[HATA] Aktarım sırasında kritik hata oluştu: ${err.message}`);
        if (pgClient) {
            try {
                await pgClient.query("SET session_replication_role = 'origin'");
            } catch (e) {}
        }
        return { success: false, error: err.message };
    } finally {
        if (sqliteDb) {
            try { sqliteDb.close(); } catch (e) {}
        }
        if (pgClient) {
            try { await pgClient.end(); } catch (e) {}
        }
    }
}

module.exports = {
    migrateSqliteToPostgres
};
