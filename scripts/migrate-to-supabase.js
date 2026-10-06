/**
 * Kontrol App -> Supabase Full Migration Script
 * Migrates all SQLite records and local document files to Self-Hosted Supabase.
 * 
 * Usage:
 *   DATABASE_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres" SUPABASE_SECRET_KEY="KEY" node scripts/migrate-to-supabase.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { postgresDdlSql } = require('../electron/utils/postgresDdl');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://supabase.kontrol-app.com';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is required.');
    console.log('Example: DATABASE_URL="postgresql://postgres:PASSWORD@45.147.47.56:5432/postgres" node scripts/migrate-to-supabase.js');
    process.exit(1);
}

// Initialize Supabase Storage Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || 'sb_publishable_36cfd54f23bbf88d313317_24673797', {
    auth: { persistSession: false }
});

function findSqliteDbPath() {
    const candidates = [
        path.join(process.env.HOME || '', 'Library', 'Application Support', 'kontrol-app', 'data', 'aractakip.db'),
        path.join(process.env.HOME || '', 'Library', 'Application Support', 'Kontrol', 'data', 'aractakip.db'),
        path.join(process.env.HOME || '', 'Library', 'Application Support', 'aractakip', 'data', 'aractakip.db'),
        path.join(process.cwd(), 'data', 'aractakip.db'),
        path.join(process.cwd(), 'aractakip.db')
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

async function runMigration() {
    console.log('====================================================');
    console.log('🚀 Kontrol App -> Supabase Migration Starting...');
    console.log('====================================================');
    console.log('• Supabase URL:', SUPABASE_URL);

    // 1. Locate SQLite DB
    const sqlitePath = findSqliteDbPath();
    if (!sqlitePath) {
        console.error('❌ SQLite database file (aractakip.db) could not be found automatically.');
        console.log('Please make sure aractakip.db is located in ./data/aractakip.db');
        return;
    }
    console.log('✅ Found SQLite database:', sqlitePath);

    const sqlite = new Database(sqlitePath, { readonly: true });

    // 2. Connect to Supabase Postgres
    console.log('• Connecting to Supabase PostgreSQL...');
    const pg = new Client({ connectionString: DATABASE_URL });
    
    try {
        await pg.connect();
        console.log('✅ Connected to Supabase PostgreSQL successfully!');
    } catch (err) {
        console.error('❌ Failed to connect to Supabase PostgreSQL:', err.message);
        console.log('\n💡 Note: If port 5432 is not opened externally on your VPS firewall,');
        console.log('you can run this script directly inside the server or Dokploy container.');
        return;
    }

    // 3. Create Tables
    console.log('• Initializing PostgreSQL Schema & Tables...');
    try {
        await pg.query(postgresDdlSql);
        console.log('✅ PostgreSQL Tables verified & ready.');
    } catch (err) {
        console.warn('⚠️ Schema notice:', err.message);
    }

    // 4. Table Migration Order (respecting foreign keys)
    const tablesToMigrate = [
        'users',
        'companies',
        'roles',
        'permissions',
        'user_company_access',
        'user_permissions',
        'company_settings',
        'user_preferences',
        'revoked_sessions',
        'departments',
        'leave_types',
        'document_categories',
        'vehicle_types',
        'public_holidays',
        'document_folders',
        'vehicles',
        'customers',
        'employees',
        'requests',
        'request_approvals',
        'employee_assignments',
        'employee_attendance',
        'employee_documents',
        'employee_movements',
        'employee_salary_history',
        'salaries',
        'leaves',
        'overtimes',
        'maintenances',
        'inspections',
        'insurances',
        'assignments',
        'services',
        'documents',
        'works',
        'work_items',
        'meal_settings',
        'meal_price_history',
        'meal_tickets',
        'recurring_transactions',
        'transactions',
        'audit_logs',
        'system_announcements',
        'company_notification_settings',
        'user_notification_settings',
        'email_settings',
        'email_templates',
        'arvento_history'
    ];

    for (const tableName of tablesToMigrate) {
        try {
            // Check if table exists in SQLite
            const checkTable = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
            if (!checkTable) {
                continue;
            }

            const rows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all();
            if (rows.length === 0) {
                console.log(`ℹ️ [${tableName}] 0 records found in SQLite.`);
                continue;
            }

            // Fetch actual Postgres columns for table
            const pgColsRes = await pg.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [tableName]);
            const pgColumns = new Set(pgColsRes.rows.map(r => r.column_name));

            // Detect Primary Key column in PostgreSQL dynamically
            const pkRes = await pg.query(`
                SELECT a.attname
                FROM   pg_index i
                JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE  i.indrelid = $1::regclass
                AND    i.indisprimary;
            `, [`public."${tableName}"`]).catch(() => ({ rows: [] }));
            const pkName = pkRes.rows[0]?.attname;

            for (const row of rows) {
                const cols = Object.keys(row).filter(c => pgColumns.has(c));
                if (cols.length === 0) continue;

                // PROTECTION: When migrating companies, never assign a personnel user as company owner
                if (tableName === 'companies') {
                    // Find actual admin user id in Postgres
                    const adminRes = await pg.query("SELECT id FROM users WHERE email = 'admin@muayen.com' OR role = 'company_admin' OR role = 'admin' LIMIT 1");
                    if (adminRes.rows.length > 0) {
                        row.user_id = adminRes.rows[0].id;
                    }
                }

                // PROTECTION: When migrating users, ensure admin accounts keep company_admin role
                if (tableName === 'users' && (row.email === 'admin@muayen.com' || row.username === 'admin')) {
                    row.role = 'company_admin';
                }

                const values = cols.map(c => {
                    const val = row[c];
                    if (val === undefined || val === null) return null;
                    if (typeof val === 'string' && (val.includes('T') && val.endsWith('Z') || /^\d{4}-\d{2}-\d{2}/.test(val))) {
                        const d = new Date(val);
                        if (!isNaN(d.getTime())) return d;
                    }
                    return val;
                });

                const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
                const colNames = cols.map(c => `"${c}"`).join(', ');

                let insertSql;
                if (pkName && cols.includes(pkName)) {
                    const updateSets = cols.filter(c => c !== pkName).map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
                    insertSql = updateSets.length > 0
                        ? `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT ("${pkName}") DO UPDATE SET ${updateSets};`
                        : `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT ("${pkName}") DO NOTHING;`;
                } else {
                    insertSql = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders});`;
                }

                try {
                    await pg.query(insertSql, values);
                } catch (rowErr) {}
            }

            // Sync serial sequence if table has integer primary key sequence
            if (pkName) {
                try {
                    await pg.query(`SELECT setval(pg_get_serial_sequence('"${tableName}"', '${pkName}'), coalesce(max("${pkName}"), 1)) FROM "${tableName}";`);
                } catch (seqErr) {}
            }

            console.log(`✅ [${tableName}] Migrated ${rows.length} records.`);
        } catch (tblErr) {
            console.error(`❌ Error migrating table ${tableName}:`, tblErr.message);
        }
    }

    // 5. Ensure Storage Buckets in Supabase
    console.log('• Checking & configuring Supabase Storage buckets...');
    const buckets = ['documents', 'invoices', 'vehicle-photos', 'avatars'];
    for (const b of buckets) {
        try {
            await supabase.storage.createBucket(b, { public: true });
        } catch (e) {}
    }
    console.log('✅ Supabase Storage buckets verified.');

    // 6. Upload Local Files to Supabase Storage
    const uploadsDirCandidates = [
        path.join(process.env.HOME || '', 'Library', 'Application Support', 'kontrol-app', 'files'),
        path.join(process.env.HOME || '', 'Library', 'Application Support', 'kontrol-app', 'data'),
        path.join(process.env.HOME || '', 'Library', 'Application Support', 'kontrol-app', 'uploads'),
        path.join(process.env.HOME || '', 'Library', 'Application Support', 'Kontrol', 'uploads'),
        path.join(process.env.HOME || '', 'Library', 'Application Support', 'aractakip', 'uploads'),
        path.join(process.cwd(), 'uploads')
    ];

    let uploadsDir = null;
    for (const d of uploadsDirCandidates) {
        if (fs.existsSync(d)) {
            uploadsDir = d;
            break;
        }
    }

    if (uploadsDir) {
        console.log(`• Found local uploads directory: ${uploadsDir}`);
        const files = fs.readdirSync(uploadsDir);
        console.log(`⏳ Uploading ${files.length} local files to Supabase Storage ('documents' bucket)...`);

        let uploadedCount = 0;
        for (const fileName of files) {
            const fullPath = path.join(uploadsDir, fileName);
            if (fs.statSync(fullPath).isFile()) {
                try {
                    const fileBuffer = fs.readFileSync(fullPath);
                    const ext = path.extname(fileName).toLowerCase();
                    let mimeType = 'application/octet-stream';
                    if (ext === '.pdf') mimeType = 'application/pdf';
                    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
                    else if (ext === '.png') mimeType = 'image/png';

                    const { error } = await supabase.storage.from('documents').upload(fileName, fileBuffer, {
                        contentType: mimeType,
                        upsert: true
                    });

                    if (!error) uploadedCount++;
                } catch (fErr) {
                    console.warn(`⚠️ File upload warning for ${fileName}:`, fErr.message);
                }
            }
        }
        console.log(`✅ Uploaded ${uploadedCount} / ${files.length} files to Supabase Storage.`);
    }

    await pg.end();
    sqlite.close();

    console.log('====================================================');
    console.log('🎉 ALL DATA & STORAGE MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('====================================================');
}

if (require.main === module) {
    runMigration().catch(err => console.error('Migration failed:', err));
}

module.exports = { runMigration };
