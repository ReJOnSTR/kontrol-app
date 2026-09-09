const { PrismaClient } = require('./prisma/client');
let PrismaBetterSqlite3;
try {
    PrismaBetterSqlite3 = require('@prisma/adapter-better-sqlite3').PrismaBetterSqlite3;
} catch(e) {}

let PrismaPg;
let pg;
try {
    PrismaPg = require('@prisma/adapter-pg').PrismaPg;
    pg = require('pg');
} catch(e) {}

let app = null;
try {
    const electron = require('electron');
    if (electron && electron.app) {
        app = electron.app;
    }
} catch (e) {}

const path = require('path');
const fs = require('fs');
const log = require('./logger');
let Database;
try {
    Database = require('better-sqlite3');
} catch(e) {}

let prisma = null;

const MIGRATION_FLAG_FILE = 'db_migrated.flag';

function hasValidData(dbPath) {
    // Check if this SQLite file has at least one row in users or companies table.
    try {
        const rawDb = new Database(dbPath, { readonly: true });
        try {
            const row = rawDb.prepare('SELECT COUNT(*) as cnt FROM users').get();
            if (row && row.cnt > 0) return true;
        } catch(e) { /* table may not exist yet */ }
        try {
            const row = rawDb.prepare('SELECT COUNT(*) as cnt FROM companies').get();
            if (row && row.cnt > 0) return true;
        } catch(e) { /* table may not exist yet */ }
        return false;
    } catch(e) {
        return false;
    } finally {
        try {
            // Database instances from better-sqlite3 close themselves on GC, but explicit close is safer
        } catch(e) {}
    }
}

function getDbPath() {
    let dataDir;
    if (app && typeof app.getPath === 'function') {
        const userDataPath = app.getPath('userData');
        dataDir = path.join(userDataPath, 'data');
    } else {
        dataDir = process.env.DATA_DIR || path.join(__dirname, '../data');
    }
    const targetDbPath = path.join(dataDir, 'aractakip.db');
    const migrationFlagPath = path.join(dataDir, MIGRATION_FLAG_FILE);

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!app || typeof app.getPath !== 'function') {
        return targetDbPath;
    }

    // ── CRITICAL: Once the active DB has real data, NEVER overwrite it. ──
    // Check migration flag first (fast path), then validate DB content.
    const alreadyMigrated = fs.existsSync(migrationFlagPath);
    if (alreadyMigrated && fs.existsSync(targetDbPath)) {
        log.info(`DB migration already done. Using active DB: ${targetDbPath}`);
        return targetDbPath;
    }

    // If DB exists and has real user/company data, set the flag and stop.
    if (fs.existsSync(targetDbPath) && hasValidData(targetDbPath)) {
        log.info(`Active DB has valid data. Setting migration flag and skipping legacy import.`);
        try { fs.writeFileSync(migrationFlagPath, new Date().toISOString()); } catch(e) {}
        return targetDbPath;
    }

    // ── Only reach here on fresh install or genuinely empty DB ──
    const homeDir = app.getPath('home');
    const appDataPath = app.getPath('appData');

    const legacyCandidateDirs = [
        path.join(appDataPath, 'kontrol-app', 'data'),
        path.join(appDataPath, 'AracTakip', 'data'),
        path.join(appDataPath, 'muayen', 'data'),
        path.join(homeDir, 'Library', 'Application Support', 'kontrol-app', 'data'),
        path.join(homeDir, 'Library', 'Application Support', 'AracTakip', 'data'),
        path.join(homeDir, 'Library', 'Application Support', 'muayen', 'data'),
    ];

    let bestLegacyPath = null;
    let maxLegacySize = 0;

    for (const dir of legacyCandidateDirs) {
        const dbFile = path.join(dir, 'aractakip.db');
        // Skip if it IS the target file (different name/path check)
        if (path.resolve(dbFile) === path.resolve(targetDbPath)) continue;
        if (fs.existsSync(dbFile)) {
            try {
                const stat = fs.statSync(dbFile);
                if (stat.size > maxLegacySize) {
                    maxLegacySize = stat.size;
                    bestLegacyPath = dbFile;
                }
            } catch(e) { /* ignore */ }
        }
    }

    if (bestLegacyPath) {
        log.info(`Migrating legacy DB (${maxLegacySize} bytes) from: ${bestLegacyPath} -> ${targetDbPath}`);
        try {
            fs.copyFileSync(bestLegacyPath, targetDbPath);
            if (fs.existsSync(bestLegacyPath + '-wal')) fs.copyFileSync(bestLegacyPath + '-wal', targetDbPath + '-wal');
            if (fs.existsSync(bestLegacyPath + '-shm')) fs.copyFileSync(bestLegacyPath + '-shm', targetDbPath + '-shm');
            // Set migration flag so we never do this again
            try { fs.writeFileSync(migrationFlagPath, new Date().toISOString()); } catch(e) {}
        } catch (err) {
            log.error(`Failed to copy legacy database from ${bestLegacyPath}:`, err.message);
            return bestLegacyPath; // Fall back to reading legacy path directly
        }
    }

    return targetDbPath;
}

function getGeneratedProvider() {
    try {
        const schemaPath = path.join(__dirname, 'prisma/client/schema.prisma');
        if (fs.existsSync(schemaPath)) {
            const schemaContent = fs.readFileSync(schemaPath, 'utf8');
            if (schemaContent.includes('provider = "postgresql"') || schemaContent.includes('provider = "postgres"')) {
                return 'postgresql';
            }
            if (schemaContent.includes('provider = "sqlite"')) {
                return 'sqlite';
            }
        }
    } catch (e) {}
    return 'postgresql';
}

/**
 * Initializes and exports the Prisma Singleton
 * Dynamically binds the correct user data folder path or PostgreSQL connection.
 */
function getPrismaClient() {
    if (!prisma) {
        try {
            // Ensure local .env is loaded if available
            try { require('dotenv').config(); } catch (e) {}

            const generatedProvider = getGeneratedProvider();
            let dbUrl = process.env.DATABASE_URL;
            const isPostgres = (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) || (process.env.USE_POSTGRES === 'true' && dbUrl) || (generatedProvider === 'postgresql' && dbUrl);

            if (isPostgres) {
                log.info(`Initializing Prisma Client with PostgreSQL (${dbUrl.split('@')[1] || 'remote'})`);
                if (PrismaPg && pg) {
                    const pool = new pg.Pool({
                        connectionString: dbUrl,
                        connectionTimeoutMillis: 5000,
                        idleTimeoutMillis: 30000,
                        max: 20,
                        keepAlive: true,
                        keepAliveInitialDelayMillis: 10000
                    });
                    const adapter = new PrismaPg(pool);
                    prisma = new PrismaClient({ adapter });
                } else {
                    prisma = new PrismaClient({ datasourceUrl: dbUrl });
                }
            } else {
                const dbPath = getDbPath();
                log.info(`Initializing Prisma Client on SQLite DB: ${dbPath}`);
                process.env.DATABASE_URL = `file:${dbPath}?connection_limit=1`;
                if (PrismaBetterSqlite3 && generatedProvider === 'sqlite') {
                    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
                    prisma = new PrismaClient({ adapter });
                } else {
                    prisma = new PrismaClient();
                }
            }

            // Override BigInt serialization
            BigInt.prototype.toJSON = function () {
                return Number(this);
            };

        } catch (error) {
            log.error('Failed to initialize Prisma:', error);
            throw error;
        }
    }
    return prisma;
}

/**
 * Run DB schema migrations using Prisma's $executeRawUnsafe.
 * Must be called AFTER getPrismaClient() and BEFORE any queries.
 */
async function runAutoMigrations() {
    const isPostgres = getGeneratedProvider() === 'postgresql' || process.env.USE_POSTGRES === 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres'));
    if (isPostgres) {
        log.info('PostgreSQL connection active, SQLite pragma migrations skipped.');
        return;
    }

    // 0. Native Migration check using raw better-sqlite3 (bypasses Prisma caching & locks on Windows)
    try {
        const dbPath = getDbPath();
        const sqliteDb = new Database(dbPath);
        
        // 0. Auto-repair any tables corrupted with "_old" or "companies_old" references from previous SQLite alter table operations
        try {
            sqliteDb.prepare('PRAGMA foreign_keys = OFF').run();
            sqliteDb.prepare('PRAGMA legacy_alter_table = ON').run();

            const brokenTables = sqliteDb.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND (sql LIKE '%_old%' OR sql LIKE '%companies_old%') AND name NOT LIKE '%_fix_temp%'").all();
            for (const item of brokenTables) {
                if (!item.sql) continue;
                const tblName = item.name;
                const fixedSql = item.sql
                    .replace(/"companies_old"/g, '"companies"')
                    .replace(/companies_old/g, 'companies')
                    .replace(/"documents_old"/g, '"documents"')
                    .replace(/documents_old/g, 'documents');
                
                if (fixedSql !== item.sql) {
                    log.info(`Auto-repairing broken foreign keys in table: ${tblName}...`);
                    const tempName = `${tblName}_fix_temp`;
                    sqliteDb.prepare(`DROP TABLE IF EXISTS "${tempName}"`).run();
                    sqliteDb.prepare(`CREATE TABLE "${tempName}" AS SELECT * FROM "${tblName}"`).run();
                    sqliteDb.prepare(`DROP TABLE "${tblName}"`).run();
                    sqliteDb.prepare(fixedSql).run();

                    const cols = sqliteDb.pragma(`table_info("${tblName}")`).map(c => `"${c.name}"`).join(', ');
                    sqliteDb.prepare(`INSERT INTO "${tblName}" (${cols}) SELECT ${cols} FROM "${tempName}"`).run();
                    sqliteDb.prepare(`DROP TABLE "${tempName}"`).run();
                    log.info(`Successfully repaired table ${tblName}!`);
                }
            }
        } catch (repairErr) {
            log.error('Auto-repair broken foreign keys notice:', repairErr.message);
        }

        const pragma = sqliteDb.pragma("table_info('documents')");
        const columnNames = pragma.map(col => col.name.toLowerCase());
        
        // 1. Check if vehicle_id has a NOT NULL constraint and recreate table to make it nullable if so
        const vehicleIdCol = pragma.find(col => col.name.toLowerCase() === 'vehicle_id');
        if (vehicleIdCol && vehicleIdCol.notnull === 1) {
            log.info('Native Migration: vehicle_id in documents is NOT NULL. Re-creating table to make it nullable...');
            
            sqliteDb.prepare('PRAGMA foreign_keys = OFF').run();
            sqliteDb.prepare('PRAGMA legacy_alter_table = ON').run();
            sqliteDb.prepare('DROP TABLE IF EXISTS documents_old').run();
            sqliteDb.prepare('ALTER TABLE documents RENAME TO documents_old').run();
            
            sqliteDb.prepare(`
                CREATE TABLE "documents" (
                    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    "vehicle_id" INTEGER,
                    "related_type" TEXT,
                    "related_id" INTEGER,
                    "file_name" TEXT NOT NULL,
                    "file_path" TEXT NOT NULL,
                    "file_type" TEXT,
                    "doc_type" TEXT,
                    "category" TEXT,
                    "folder" TEXT,
                    "start_date" DATETIME,
                    "end_date" DATETIME,
                    "is_archived" INTEGER DEFAULT 0,
                    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
                )
            `).run();
            
            // Map column names to copy
            const oldColNames = pragma.map(c => `"${c.name}"`).join(', ');
            sqliteDb.prepare(`INSERT INTO documents (${oldColNames}) SELECT ${oldColNames} FROM documents_old`).run();
            sqliteDb.prepare('DROP TABLE IF EXISTS documents_old').run();
            sqliteDb.prepare('PRAGMA foreign_keys = ON').run();
            
            log.info('Native Migration: Successfully made vehicle_id in documents nullable!');
        } else {
            // 2. Normal alter table checks if not recreating
            if (!columnNames.includes('start_date')) {
                sqliteDb.prepare('ALTER TABLE documents ADD COLUMN start_date DATETIME').run();
                log.info('Native Migration: Added start_date to documents');
            }
            if (!columnNames.includes('end_date')) {
                sqliteDb.prepare('ALTER TABLE documents ADD COLUMN end_date DATETIME').run();
                log.info('Native Migration: Added end_date to documents');
            }
        }

        // 3. Check if companies has user_id NOT NULL or ON DELETE CASCADE in SQLite, recreate without cascade if so
        try {
            const compPragma = sqliteDb.pragma("table_info('companies')");
            const compFkList = sqliteDb.pragma("foreign_key_list('companies')");
            const hasCascade = compFkList.some(fk => fk.on_delete && fk.on_delete.toUpperCase() === 'CASCADE' && fk.table && fk.table.toLowerCase() === 'users');
            const userIdCol = compPragma.find(col => col.name.toLowerCase() === 'user_id');

            if (hasCascade || (userIdCol && userIdCol.notnull === 1)) {
                log.info('Native Migration: companies table in SQLite has user_id CASCADE / NOT NULL. Re-creating table without cascade...');
                sqliteDb.prepare('PRAGMA foreign_keys = OFF').run();
                sqliteDb.prepare('PRAGMA legacy_alter_table = ON').run();
                sqliteDb.prepare('DROP TABLE IF EXISTS companies_old').run();
                sqliteDb.prepare('ALTER TABLE companies RENAME TO companies_old').run();
                
                sqliteDb.prepare(`
                    CREATE TABLE "companies" (
                        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        "user_id" INTEGER,
                        "name" TEXT NOT NULL,
                        "tax_number" TEXT,
                        "tax_office" TEXT,
                        "sgk_no" TEXT,
                        "address" TEXT,
                        "phone" TEXT,
                        "signature_path" TEXT,
                        "stamp_path" TEXT,
                        "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT "companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
                    )
                `).run();

                const oldCompCols = compPragma.map(c => `"${c.name}"`).join(', ');
                sqliteDb.prepare(`INSERT INTO companies (${oldCompCols}) SELECT ${oldCompCols} FROM companies_old`).run();
                sqliteDb.prepare('DROP TABLE IF EXISTS companies_old').run();
                sqliteDb.prepare('PRAGMA foreign_keys = ON').run();
            }
        } catch (compErr) {
            log.error('Native Migration for companies table notice:', compErr.message);
        }

        // 4. Ensure all required columns for users table exist in SQLite (prevents 2FA column missing crash)
        try {
            const userPragma = sqliteDb.pragma("table_info('users')");
            const uColNames = userPragma.map(col => col.name.toLowerCase());
            if (uColNames.length > 0) {
                const userColsToAdd = [
                    { name: 'role', sql: "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'" },
                    { name: 'must_change_password', sql: "ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0" },
                    { name: 'is_active', sql: "ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1" },
                    { name: 'full_name', sql: "ALTER TABLE users ADD COLUMN full_name TEXT" },
                    { name: 'role_id', sql: "ALTER TABLE users ADD COLUMN role_id INTEGER" },
                    { name: 'employee_id', sql: "ALTER TABLE users ADD COLUMN employee_id INTEGER" },
                    { name: 'two_factor_secret', sql: "ALTER TABLE users ADD COLUMN two_factor_secret TEXT" },
                    { name: 'two_factor_enabled', sql: "ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0" },
                    { name: 'two_factor_backup_codes', sql: "ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT" }
                ];

                for (const col of userColsToAdd) {
                    if (!uColNames.includes(col.name)) {
                        sqliteDb.prepare(col.sql).run();
                        log.info(`Native Migration: Added ${col.name} to users table in SQLite.`);
                    }
                }

                // Self-heal: ensure admin accounts on older databases have company_admin role instead of plain 'user'
                try {
                    sqliteDb.prepare("UPDATE users SET role = 'company_admin' WHERE role = 'user' AND (username = 'admin' OR email = 'admin@muayen.com')").run();
                } catch(adminErr) {}
            }
        } catch (uErr) {
            log.error('Native Migration for users columns notice:', uErr.message);
        }
        
        sqliteDb.close();
    } catch (err) {
        log.error('Native Migration for documents/users columns failed:', err.message);
    }

    const p = getPrismaClient();
    log.info('Running auto-migrations for missing tables and columns...');

    // 1. Add `is_archived` to all relevant tables if missing
    try {
        const archivableTables = [
            'assignments', 'customers', 'employee_assignments', 'employees',
            'inspections', 'insurances', 'maintenances', 'meal_tickets',
            'services', 'transactions', 'vehicles', 'works', 'employee_documents',
            'documents'
        ];

        for (const tableName of archivableTables) {
            const cols = await p.$queryRawUnsafe(`PRAGMA table_info('${tableName}')`);
            if (cols.length > 0 && !cols.some(c => c.name === 'is_archived')) {
                await p.$executeRawUnsafe(`ALTER TABLE ${tableName} ADD COLUMN is_archived INTEGER DEFAULT 0`);
                log.info(`Migration: Added is_archived to ${tableName}`);
            }
        }
    } catch (error) {
        log.error('Migration step 1 (is_archived) error:', error.message);
    }

    // 2. Transactions: category, payment_method (missing in older versions)
    try {
        const tCols = await p.$queryRawUnsafe("PRAGMA table_info('transactions')");
        if (tCols.length > 0) {
            if (!tCols.some(c => c.name === 'category')) {
                await p.$executeRawUnsafe('ALTER TABLE transactions ADD COLUMN category TEXT');
                log.info('Migration: Added category to transactions');
            }
            if (!tCols.some(c => c.name === 'payment_method')) {
                await p.$executeRawUnsafe('ALTER TABLE transactions ADD COLUMN payment_method TEXT');
                log.info('Migration: Added payment_method to transactions');
            }
        }
    } catch (error) {
        log.error('Migration step 2 (transactions) error:', error.message);
    }

    // 2b. Users: role, must_change_password, 2FA columns (missing in older versions)
    try {
        const uCols = await p.$queryRawUnsafe("PRAGMA table_info('users')");
        if (uCols.length > 0) {
            const neededCols = [
                { name: 'role', sql: "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'" },
                { name: 'must_change_password', sql: "ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0" },
                { name: 'is_active', sql: "ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1" },
                { name: 'full_name', sql: "ALTER TABLE users ADD COLUMN full_name TEXT" },
                { name: 'role_id', sql: "ALTER TABLE users ADD COLUMN role_id INTEGER" },
                { name: 'employee_id', sql: "ALTER TABLE users ADD COLUMN employee_id INTEGER" },
                { name: 'two_factor_secret', sql: "ALTER TABLE users ADD COLUMN two_factor_secret TEXT" },
                { name: 'two_factor_enabled', sql: "ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0" },
                { name: 'two_factor_backup_codes', sql: "ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT" }
            ];

            for (const col of neededCols) {
                if (!uCols.some(c => c.name.toLowerCase() === col.name.toLowerCase())) {
                    await p.$executeRawUnsafe(col.sql);
                    log.info(`Migration: Added ${col.name} to users`);
                }
            }
        }
    } catch (error) {
        log.error('Migration step 2b (users) error:', error.message);
    }

    // 3. Create ALL tables IF NOT EXISTS (Fresh Database Bootstrap & Missing tables support)
    try {
        const { allTablesSQL } = require('./schema_script');
        for (const sql of allTablesSQL) {
            try {
                await p.$executeRawUnsafe(sql);
            } catch (sqlErr) {
                // Ignore individual SQL errors (e.g. sqlite_autoindex conflicts)
            }
        }
    } catch (error) {
        log.error('Migration step 3 (create tables) error:', error.message);
    }

    // 4. Add customer_id to works (for existing DBs that already have works table)
    try {
        const wCols = await p.$queryRawUnsafe("PRAGMA table_info('works')");
        if (wCols.length > 0 && !wCols.some(c => c.name === 'customer_id')) {
            await p.$executeRawUnsafe('ALTER TABLE works ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL');
            log.info('Migration: Added customer_id to works');
        }
    } catch (error) {
        log.error('Migration step 4 (customer_id) error:', error.message);
    }

    // 5. Add receipt_no to work_items (for existing DBs)
    try {
        const wiCols = await p.$queryRawUnsafe("PRAGMA table_info('work_items')");
        if (wiCols.length > 0 && !wiCols.some(c => c.name === 'receipt_no')) {
            await p.$executeRawUnsafe('ALTER TABLE work_items ADD COLUMN receipt_no TEXT');
            log.info('Migration: Added receipt_no to work_items');
        }
    } catch (error) {
        log.error('Migration step 5 (receipt_no) error:', error.message);
    }

    // 6. Add travel_price to work_items (for existing DBs)
    try {
        const wiCols2 = await p.$queryRawUnsafe("PRAGMA table_info('work_items')");
        if (wiCols2.length > 0 && !wiCols2.some(c => c.name === 'travel_price')) {
            await p.$executeRawUnsafe('ALTER TABLE work_items ADD COLUMN travel_price REAL DEFAULT 0');
            log.info('Migration: Added travel_price to work_items');
        }
    } catch (error) {
        log.error('Migration step 6 (travel_price) error:', error.message);
    }

    // 7. Add payment_method to salaries
    try {
        const salCols = await p.$queryRawUnsafe("PRAGMA table_info('salaries')");
        if (salCols.length > 0 && !salCols.some(c => c.name === 'payment_method')) {
            await p.$executeRawUnsafe("ALTER TABLE salaries ADD COLUMN payment_method TEXT DEFAULT 'cash'");
            log.info('Migration: Added payment_method to salaries');
        }
    } catch (error) {
        log.error('Migration step 7 (payment_method) error:', error.message);
    }

    // 8. Add salary_month to salaries (for tracking which month a payment belongs to)
    try {
        const salCols2 = await p.$queryRawUnsafe("PRAGMA table_info('salaries')");
        if (salCols2.length > 0 && !salCols2.some(c => c.name === 'salary_month')) {
            await p.$executeRawUnsafe("ALTER TABLE salaries ADD COLUMN salary_month TEXT");
            log.info('Migration: Added salary_month to salaries');
        }
    } catch (error) {
        log.error('Migration step 8 (salary_month) error:', error.message);
    }

    // 10. Employee Assignments: serial_number, assign_date (sync with schema)
    try {
        const eaCols = await p.$queryRawUnsafe("PRAGMA table_info('employee_assignments')");
        if (eaCols.length > 0) {
            if (!eaCols.some(c => c.name === 'serial_number')) {
                await p.$executeRawUnsafe('ALTER TABLE employee_assignments ADD COLUMN serial_number TEXT');
                log.info('Migration: Added serial_number to employee_assignments');
            }
            if (!eaCols.some(c => c.name === 'assign_date')) {
                // If assigned_date exists but assign_date does not, we should ideally rename or add it.
                // SQLite doesn't support easy renames on older versions, so we just add assign_date.
                await p.$executeRawUnsafe('ALTER TABLE employee_assignments ADD COLUMN assign_date DATETIME');
                log.info('Migration: Added assign_date to employee_assignments');
                
                // Copy data if assigned_date exists
                if (eaCols.some(c => c.name === 'assigned_date')) {
                    await p.$executeRawUnsafe('UPDATE employee_assignments SET assign_date = assigned_date');
                    log.info('Migration: Copied assigned_date to assign_date');
                }
            }
        }
    } catch (error) {
        log.error('Migration step 10 (employee_assignments) error:', error.message);
    }

    // 11. Employee Documents: issue_date, expiry_date
    try {
        const edCols = await p.$queryRawUnsafe("PRAGMA table_info('employee_documents')");
        if (edCols.length > 0) {
            if (!edCols.some(c => c.name === 'issue_date')) {
                await p.$executeRawUnsafe('ALTER TABLE employee_documents ADD COLUMN issue_date DATETIME');
                log.info('Migration: Added issue_date to employee_documents');
            }
            if (!edCols.some(c => c.name === 'expiry_date')) {
                await p.$executeRawUnsafe('ALTER TABLE employee_documents ADD COLUMN expiry_date DATETIME');
                log.info('Migration: Added expiry_date to employee_documents');
            }
            if (!edCols.some(c => c.name === 'start_date')) {
                await p.$executeRawUnsafe('ALTER TABLE employee_documents ADD COLUMN start_date DATETIME');
                log.info('Migration: Added start_date to employee_documents');
            }
            if (!edCols.some(c => c.name === 'folder')) {
                await p.$executeRawUnsafe('ALTER TABLE employee_documents ADD COLUMN folder TEXT');
                log.info('Migration: Added folder to employee_documents');
            }
        }
    } catch (error) {
        log.error('Migration step 11 (employee_documents) error:', error.message);
    }

    // 11b. Companies: signature_path, stamp_path (for existing DBs) - must run before Step 12
    try {
        const cCols = await p.$queryRawUnsafe("PRAGMA table_info('companies')");
        if (cCols.length > 0) {
            if (!cCols.some(c => c.name === 'signature_path')) {
                await p.$executeRawUnsafe('ALTER TABLE companies ADD COLUMN signature_path TEXT');
                log.info('Migration: Added signature_path to companies');
            }
            if (!cCols.some(c => c.name === 'stamp_path')) {
                await p.$executeRawUnsafe('ALTER TABLE companies ADD COLUMN stamp_path TEXT');
                log.info('Migration: Added stamp_path to companies');
            }
        }
    } catch (error) {
        log.error('Migration step 11b (signature/stamp columns) error:', error.message);
    }

    // 11d. Employees: signature_path (for existing DBs)
    try {
        const empCols = await p.$queryRawUnsafe("PRAGMA table_info('employees')");
        if (empCols.length > 0) {
            if (!empCols.some(c => c.name === 'signature_path')) {
                await p.$executeRawUnsafe('ALTER TABLE employees ADD COLUMN signature_path TEXT');
                log.info('Migration: Added signature_path to employees');
            }
        }
    } catch (error) {
        log.error('Migration step 11d (employee signature_path) error:', error.message);
    }

    // 11c. Documents: doc_type, category, folder, start_date, end_date (for existing DBs)
    try {
        const dCols = await p.$queryRawUnsafe("PRAGMA table_info('documents')");
        if (dCols.length > 0) {
            if (!dCols.some(c => c.name === 'doc_type')) {
                await p.$executeRawUnsafe('ALTER TABLE documents ADD COLUMN doc_type TEXT');
                log.info('Migration: Added doc_type to documents');
            }
            if (!dCols.some(c => c.name === 'category')) {
                await p.$executeRawUnsafe('ALTER TABLE documents ADD COLUMN category TEXT');
                log.info('Migration: Added category to documents');
            }
            if (!dCols.some(c => c.name === 'folder')) {
                await p.$executeRawUnsafe('ALTER TABLE documents ADD COLUMN folder TEXT');
                log.info('Migration: Added folder to documents');
            }
            if (!dCols.some(c => c.name === 'start_date')) {
                await p.$executeRawUnsafe('ALTER TABLE documents ADD COLUMN start_date DATETIME');
                log.info('Migration: Added start_date to documents');
            }
            if (!dCols.some(c => c.name === 'end_date')) {
                await p.$executeRawUnsafe('ALTER TABLE documents ADD COLUMN end_date DATETIME');
                log.info('Migration: Added end_date to documents');
            }
        }
    } catch (error) {
        log.error('Migration step 11c (documents columns) error:', error.message);
    }
    // 11e. Add status column to personnel settings tables if missing
    try {
        const settingsTables = ['departments', 'leave_types', 'document_categories', 'public_holidays'];
        for (const tableName of settingsTables) {
            const cols = await p.$queryRawUnsafe(`PRAGMA table_info('${tableName}')`);
            if (cols.length > 0 && !cols.some(c => c.name === 'status')) {
                await p.$executeRawUnsafe(`ALTER TABLE ${tableName} ADD COLUMN status TEXT DEFAULT 'active'`);
                log.info(`Migration: Added status column to ${tableName}`);
            }
        }
    } catch (error) {
        log.error('Migration step 11e (settings status columns) error:', error.message);
    }

    // 11f. Employees extra fields (devir, iban, off_days)
    try {
        const empCols = await p.$queryRawUnsafe("PRAGMA table_info('employees')");
        if (empCols.length > 0) {
            if (!empCols.some(c => c.name === 'devir_izin_bakiyesi')) {
                await p.$executeRawUnsafe('ALTER TABLE employees ADD COLUMN devir_izin_bakiyesi INTEGER DEFAULT 0');
            }
            if (!empCols.some(c => c.name === 'devir_maas_bakiyesi')) {
                await p.$executeRawUnsafe('ALTER TABLE employees ADD COLUMN devir_maas_bakiyesi REAL DEFAULT 0');
            }
            if (!empCols.some(c => c.name === 'devir_tarihi')) {
                await p.$executeRawUnsafe('ALTER TABLE employees ADD COLUMN devir_tarihi DATETIME');
            }
            if (!empCols.some(c => c.name === 'iban')) {
                await p.$executeRawUnsafe('ALTER TABLE employees ADD COLUMN iban TEXT');
            }
            if (!empCols.some(c => c.name === 'off_days')) {
                await p.$executeRawUnsafe("ALTER TABLE employees ADD COLUMN off_days TEXT DEFAULT '0'");
            }
        }
    } catch (error) {
        log.error('Migration step 11f (employees extra fields) error:', error.message);
    }

    // 11g. Works shift times (work_start_time, work_end_time, multipliers)
    try {
        const wCols = await p.$queryRawUnsafe("PRAGMA table_info('works')");
        if (wCols.length > 0) {
            if (!wCols.some(c => c.name === 'work_start_time')) {
                await p.$executeRawUnsafe("ALTER TABLE works ADD COLUMN work_start_time TEXT DEFAULT '08:00'");
            }
            if (!wCols.some(c => c.name === 'work_end_time')) {
                await p.$executeRawUnsafe("ALTER TABLE works ADD COLUMN work_end_time TEXT DEFAULT '17:00'");
            }
            if (!wCols.some(c => c.name === 'pazar_multiplier')) {
                await p.$executeRawUnsafe("ALTER TABLE works ADD COLUMN pazar_multiplier REAL DEFAULT 1.5");
            }
            if (!wCols.some(c => c.name === 'mesai_multiplier')) {
                await p.$executeRawUnsafe("ALTER TABLE works ADD COLUMN mesai_multiplier REAL DEFAULT 1.5");
            }
        }
    } catch (error) {
        log.error('Migration step 11g (works shift times) error:', error.message);
    }

    // 11h. Document folders relations (related_type, related_id)
    try {
        const dfCols = await p.$queryRawUnsafe("PRAGMA table_info('document_folders')");
        if (dfCols.length > 0) {
            if (!dfCols.some(c => c.name === 'related_type')) {
                await p.$executeRawUnsafe('ALTER TABLE document_folders ADD COLUMN related_type TEXT');
            }
            if (!dfCols.some(c => c.name === 'related_id')) {
                await p.$executeRawUnsafe('ALTER TABLE document_folders ADD COLUMN related_id INTEGER');
            }
        }
    } catch (error) {
        log.error('Migration step 11h (document_folders relations) error:', error.message);
    }

    // 12. Seed Default Personnel Settings for all companies
    try {
        const companies = await p.companies.findMany();
        const defaultDepts = ['Yönetim', 'Operasyon', 'Muhasebe', 'İnsan Kaynakları', 'Lojistik', 'Teknik', 'Satış', 'Diğer'];
        const defaultLeaveTypes = [
            'Yıllık Ücretli İzin', 
            'Ücretsiz İzin', 
            'Hastalık / Rapor (İstirahat)', 
            'Mazeret İzni', 
            'Evlilik İzni', 
            'Ölüm İzni', 
            'Doğum / Analık İzni', 
            'Babalık İzni', 
            'Süt İzni', 
            'İdari İzin', 
            'Mesai İzni (Mahsup)', 
            'İlave Yıllık İzin',
            'Diğer'
        ];
        const defaultDocCats = ['Ehliyet', 'SRC Belgesi', 'Psikoteknik', 'İş Sözleşmesi', 'Kimlik Fotokopisi', 'Adli Sicil Kaydı', 'Sağlık Raporu', 'İkametgah', 'Diploma', 'Sertifika / Belge', 'Diğer'];

        for (const company of companies) {
            if (p.departments) {
                const existingDepts = await p.departments.findMany({ where: { company_id: company.id } });
                const existingDeptNames = existingDepts.map(d => d.name.toLowerCase());
                
                for (const name of defaultDepts) {
                    if (!existingDeptNames.includes(name.toLowerCase())) {
                        await p.departments.create({ data: { company_id: company.id, name } });
                        log.info(`Seeding: Added default department "${name}" for company ${company.id}`);
                    }
                }
            }

            if (p.leave_types) {
                const existingTypes = await p.leave_types.findMany({ where: { company_id: company.id } });
                const existingNames = existingTypes.map(t => t.name.toLowerCase());
                
                for (const name of defaultLeaveTypes) {
                    if (!existingNames.includes(name.toLowerCase())) {
                        await p.leave_types.create({ data: { company_id: company.id, name } });
                        log.info(`Seeding: Added official leave type "${name}" for company ${company.id}`);
                    }
                }
            }

            if (p.document_categories) {
                const defaultVehicleDocCats = [
                    'Ruhsat',
                    'Trafik Sigortası',
                    'Kasko',
                    'Araç Muayenesi',
                    'Egzoz Muayenesi',
                    'Egzoz Emisyon Raporu',
                    'Taşıt Kartı',
                    'K Belgesi',
                    'Kira Sözleşmesi',
                    'Takograf',
                    'Bakım',
                    'Servis',
                    'Zimmet Belgesi',
                    'Diğer'
                ];
                
                // Seed employee document categories
                const empDocCount = await p.document_categories.count({ 
                    where: { company_id: company.id, target_type: 'employee' } 
                });
                if (empDocCount === 0) {
                    for (const name of defaultDocCats) {
                        await p.document_categories.create({ 
                            data: { company_id: company.id, name, target_type: 'employee' } 
                        });
                    }
                    log.info(`Seeding: Added default employee document categories for company ${company.id}`);
                }

                // Seed vehicle document categories (Clean and re-seed as requested)
                await p.document_categories.deleteMany({
                    where: { company_id: company.id, target_type: 'vehicle' }
                });
                for (const name of defaultVehicleDocCats) {
                    await p.document_categories.create({ 
                        data: { company_id: company.id, name, target_type: 'vehicle' } 
                    });
                }
                log.info(`Seeding: Re-seeded default vehicle document categories for company ${company.id}`);
            }

            if (p.vehicle_types) {
                // 1. Get existing types in the settings table
                const existingTypes = await p.vehicle_types.findMany({ where: { company_id: company.id } });
                const existingNames = existingTypes.map(t => t.name.toLowerCase());
                
                // 2. Define defaults
                const defaultVehicleTypes = ['Otomobil', 'Vinç', 'Kamyon', 'Minibüs', 'Pikap', 'Forklift', 'Ekskavatör', 'Diğer'];
                
                // 3. Collect types currently used by actual vehicles in this company
                const usedTypesRes = await p.vehicles.groupBy({
                    by: ['type'],
                    where: { company_id: company.id }
                });
                const usedTypes = usedTypesRes.map(ut => {
                    // Try to map English keys back to Turkish labels for the settings table
                    const mapping = {
                        'automobile': 'Otomobil',
                        'crane': 'Vinç',
                        'truck': 'Kamyon',
                        'van': 'Minibüs',
                        'pickup': 'Pikap',
                        'forklift': 'Forklift',
                        'excavator': 'Ekskavatör',
                        'other': 'Diğer'
                    };
                    return mapping[ut.type] || ut.type;
                });

                // Combine defaults and used types
                const allToSeed = [...new Set([...defaultVehicleTypes, ...usedTypes])];

                for (const name of allToSeed) {
                    if (name && !existingNames.includes(name.toLowerCase())) {
                        await p.vehicle_types.create({ data: { company_id: company.id, name } });
                        log.info(`Seeding: Added vehicle type "${name}" for company ${company.id}`);
                    }
                }
            }
        }
    } catch (error) {
        log.error('Migration step 12 (seeding settings) error:', error.message);
    }

    // 13. Migrate legacy data labels to new Turkish names
    try {
        log.info('Migrating legacy data labels...');
        // Leaves
        await p.$executeRawUnsafe("UPDATE leaves SET type = 'Yıllık İzin' WHERE type = 'annual'");
        await p.$executeRawUnsafe("UPDATE leaves SET type = 'Hastalık / Rapor' WHERE type = 'sick'");
        await p.$executeRawUnsafe("UPDATE leaves SET type = 'Ücretsiz İzin' WHERE type = 'unpaid'");
        await p.$executeRawUnsafe("UPDATE leaves SET type = 'Mazeret İzni' WHERE type = 'excuse'");
        await p.$executeRawUnsafe("UPDATE leaves SET type = 'Mesai İzni' WHERE type = 'overtime_leave'");
        await p.$executeRawUnsafe("UPDATE leaves SET type = 'Mahsup' WHERE type = 'offset'");
        await p.$executeRawUnsafe("UPDATE leaves SET type = 'Diğer' WHERE type = 'other'");

        // Document Categories
        await p.$executeRawUnsafe("UPDATE employee_documents SET category = 'Ehliyet' WHERE category = 'ehliyet'");
        await p.$executeRawUnsafe("UPDATE employee_documents SET category = 'SRC Belgesi' WHERE category = 'src'");
        await p.$executeRawUnsafe("UPDATE employee_documents SET category = 'Psikoteknik' WHERE category = 'psikoteknik'");
        await p.$executeRawUnsafe("UPDATE employee_documents SET category = 'İş Sözleşmesi' WHERE category = 'sozlesme'");
        await p.$executeRawUnsafe("UPDATE employee_documents SET category = 'Kimlik Fotokopisi' WHERE category = 'kimlik'");
        await p.$executeRawUnsafe("UPDATE employee_documents SET category = 'Adli Sicil Kaydı' WHERE category = 'sabika'");
        await p.$executeRawUnsafe("UPDATE employee_documents SET category = 'Sağlık Raporu' WHERE category = 'saglik'");
        await p.$executeRawUnsafe("UPDATE employee_documents SET category = 'İkametgah' WHERE category = 'ikametgah'");
        await p.$executeRawUnsafe("UPDATE employee_documents SET category = 'Diploma' WHERE category = 'diploma'");
        await p.$executeRawUnsafe("UPDATE employee_documents SET category = 'Sertifika / Belge' WHERE category = 'certificate'");
        await p.$executeRawUnsafe("UPDATE employee_documents SET category = 'Diğer' WHERE category = 'other'");
        
        log.info('Data label migration completed.');
    } catch (error) {
        log.error('Migration step 13 (data labels) error:', error.message);
    }

    // 14. Add work_start_time and work_end_time to works
    try {
        const wCols2 = await p.$queryRawUnsafe("PRAGMA table_info('works')");
        if (wCols2.length > 0) {
            if (!wCols2.some(c => c.name === 'work_start_time')) {
                await p.$executeRawUnsafe("ALTER TABLE works ADD COLUMN work_start_time TEXT DEFAULT '08:00'");
                log.info('Migration: Added work_start_time to works');
            }
            if (!wCols2.some(c => c.name === 'work_end_time')) {
                await p.$executeRawUnsafe("ALTER TABLE works ADD COLUMN work_end_time TEXT DEFAULT '17:00'");
                log.info('Migration: Added work_end_time to works');
            }
            if (!wCols2.some(c => c.name === 'disable_overtime')) {
                await p.$executeRawUnsafe("ALTER TABLE works ADD COLUMN disable_overtime INTEGER DEFAULT 0");
                log.info('Migration: Added disable_overtime to works');
            }
        }
    } catch (error) {
        log.error('Migration step 14 (work_start/end_time, disable_overtime) error:', error.message);
    }

    // 15. Companies & Customers: tax_office, sgk_no, tax_number (Sync with schema)
    try {
        // Companies
        const cCols = await p.$queryRawUnsafe("PRAGMA table_info('companies')");
        if (cCols.length > 0) {
            if (!cCols.some(c => c.name === 'tax_office')) {
                await p.$executeRawUnsafe('ALTER TABLE companies ADD COLUMN tax_office TEXT');
                log.info('Migration: Added tax_office to companies');
            }
            if (!cCols.some(c => c.name === 'sgk_no')) {
                await p.$executeRawUnsafe('ALTER TABLE companies ADD COLUMN sgk_no TEXT');
                log.info('Migration: Added sgk_no to companies');
            }
        }

        // Customers
        const custCols = await p.$queryRawUnsafe("PRAGMA table_info('customers')");
        if (custCols.length > 0) {
            if (!custCols.some(c => c.name === 'tax_office')) {
                await p.$executeRawUnsafe('ALTER TABLE customers ADD COLUMN tax_office TEXT');
                log.info('Migration: Added tax_office to customers');
            }
            if (!custCols.some(c => c.name === 'tax_number')) {
                await p.$executeRawUnsafe('ALTER TABLE customers ADD COLUMN tax_number TEXT');
                log.info('Migration: Added tax_number to customers');
            }
        }
    } catch (error) {
        log.error('Migration step 15 (tax/sgk columns) error:', error.message);
    }

    // 16. Migrate existing vehicles to use Turkish type labels (for consistency with new dynamic types)
    try {
        log.info('Migrating vehicle types to Turkish labels...');
        await p.$executeRawUnsafe("UPDATE vehicles SET type = 'Otomobil' WHERE type = 'automobile'");
        await p.$executeRawUnsafe("UPDATE vehicles SET type = 'Vinç' WHERE type = 'crane'");
        await p.$executeRawUnsafe("UPDATE vehicles SET type = 'Kamyon' WHERE type = 'truck'");
        await p.$executeRawUnsafe("UPDATE vehicles SET type = 'Minibüs' WHERE type = 'van'");
        await p.$executeRawUnsafe("UPDATE vehicles SET type = 'Pikap' WHERE type = 'pickup'");
        await p.$executeRawUnsafe("UPDATE vehicles SET type = 'Forklift' WHERE type = 'forklift'");
        await p.$executeRawUnsafe("UPDATE vehicles SET type = 'Ekskavatör' WHERE type = 'excavator'");
        await p.$executeRawUnsafe("UPDATE vehicles SET type = 'Diğer' WHERE type = 'other'");
        log.info('Vehicle type migration completed.');
    } catch (error) {
        log.error('Migration step 16 (vehicle types) error:', error.message);
    }

    // 17. Add iban and devir fields to employees (v1.0.163)
    try {
        const empCols = await p.$queryRawUnsafe("PRAGMA table_info('employees')");
        if (empCols.length > 0) {
            if (!empCols.some(c => c.name === 'iban')) {
                await p.$executeRawUnsafe('ALTER TABLE employees ADD COLUMN iban TEXT');
                log.info('Migration: Added iban to employees');
            }
            if (!empCols.some(c => c.name === 'devir_izin_bakiyesi')) {
                await p.$executeRawUnsafe('ALTER TABLE employees ADD COLUMN devir_izin_bakiyesi INTEGER DEFAULT 0');
                log.info('Migration: Added devir_izin_bakiyesi to employees');
            }
            if (!empCols.some(c => c.name === 'devir_maas_bakiyesi')) {
                await p.$executeRawUnsafe('ALTER TABLE employees ADD COLUMN devir_maas_bakiyesi REAL DEFAULT 0');
                log.info('Migration: Added devir_maas_bakiyesi to employees');
            }
            if (!empCols.some(c => c.name === 'devir_tarihi')) {
                await p.$executeRawUnsafe('ALTER TABLE employees ADD COLUMN devir_tarihi DATETIME');
                log.info('Migration: Added devir_tarihi to employees');
            }
        }
    } catch (error) {
        log.error('Migration step 17 (employee new fields) error:', error.message);
    }

    // 18. Fix plate numbers in arvento_history for devices with hyphenated plates
    try {
        if (!isPostgres) {
            const tbl = await p.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name='arvento_history'");
            if (tbl && tbl.length > 0) {
                await p.$executeRawUnsafe("UPDATE arvento_history SET plate = '55-09-13' WHERE device_no = 'K1200246883' AND plate = '55'");
                await p.$executeRawUnsafe("UPDATE arvento_history SET plate = '55-09-27' WHERE device_no = 'K1200246889' AND plate = '55'");
            }
        }
    } catch (error) {}

    // 19. Add price_per_person to meal_tickets and backfill from meal_settings
    try {
        const mtCols = await p.$queryRawUnsafe("PRAGMA table_info('meal_tickets')");
        if (mtCols.length > 0) {
            if (!mtCols.some(c => c.name === 'price_per_person')) {
                await p.$executeRawUnsafe('ALTER TABLE meal_tickets ADD COLUMN price_per_person REAL DEFAULT 0');
                log.info('Migration: Added price_per_person to meal_tickets');
                
                // Backfill existing meal_tickets with the price_per_person from meal_settings
                const settings = await p.meal_settings.findMany();
                for (const setting of settings) {
                    await p.$executeRawUnsafe(`UPDATE meal_tickets SET price_per_person = ${setting.price_per_person} WHERE company_id = ${setting.company_id} AND price_per_person IS NULL`);
                }
                // Set default 0 for any remaining nulls
                await p.$executeRawUnsafe('UPDATE meal_tickets SET price_per_person = 0 WHERE price_per_person IS NULL');
                log.info('Migration: Backfilled price_per_person in meal_tickets');
            }
        }
    } catch (error) {
        log.error('Migration step 19 (meal_tickets price_per_person) error:', error.message);
    }

    // 20. Add pazar_multiplier and mesai_multiplier to works
    try {
        const wCols3 = await p.$queryRawUnsafe("PRAGMA table_info('works')");
        if (wCols3.length > 0) {
            if (!wCols3.some(c => c.name === 'pazar_multiplier')) {
                await p.$executeRawUnsafe('ALTER TABLE works ADD COLUMN pazar_multiplier REAL DEFAULT 1.5');
                log.info('Migration: Added pazar_multiplier to works');
            }
            if (!wCols3.some(c => c.name === 'mesai_multiplier')) {
                await p.$executeRawUnsafe('ALTER TABLE works ADD COLUMN mesai_multiplier REAL DEFAULT 1.5');
                log.info('Migration: Added mesai_multiplier to works');
            }
        }
    } catch (error) {
        log.error('Migration step 20 (works multipliers) error:', error.message);
    }

    // 21. Add custom_vehicle and custom_employee to work_items
    try {
        const wiCols3 = await p.$queryRawUnsafe("PRAGMA table_info('work_items')");
        if (wiCols3.length > 0) {
            if (!wiCols3.some(c => c.name === 'custom_vehicle')) {
                await p.$executeRawUnsafe('ALTER TABLE work_items ADD COLUMN custom_vehicle TEXT');
                log.info('Migration: Added custom_vehicle to work_items');
            }
            if (!wiCols3.some(c => c.name === 'custom_employee')) {
                await p.$executeRawUnsafe('ALTER TABLE work_items ADD COLUMN custom_employee TEXT');
                log.info('Migration: Added custom_employee to work_items');
            }
        }
    } catch (error) {
        log.error('Migration step 21 (custom fields in work_items) error:', error.message);
    }

    // 22. Add hours field to leaves if missing
    try {
        const leaveCols = await p.$queryRawUnsafe("PRAGMA table_info('leaves')");
        if (leaveCols.length > 0) {
            if (!leaveCols.some(c => c.name === 'hours')) {
                await p.$executeRawUnsafe('ALTER TABLE leaves ADD COLUMN hours REAL');
                log.info('Migration: Added hours to leaves');
            }
        }
    } catch (error) {
        log.error('Migration step 22 (hours field in leaves) error:', error.message);
    }

    // 23. Add target_type to document_categories
    try {
        const dcCols = await p.$queryRawUnsafe("PRAGMA table_info('document_categories')");
        if (dcCols.length > 0) {
            if (!dcCols.some(c => c.name === 'target_type')) {
                await p.$executeRawUnsafe("ALTER TABLE document_categories ADD COLUMN target_type TEXT DEFAULT 'employee'");
                log.info('Migration: Added target_type to document_categories');
            }
        }
    } catch (error) {
        log.error('Migration step 23 (target_type field in document_categories) error:', error.message);
    }

    // 24. Add is_archived, related_type, related_id to document_folders
    try {
        const dfCols = await p.$queryRawUnsafe("PRAGMA table_info('document_folders')");
        if (dfCols.length > 0) {
            if (!dfCols.some(c => c.name === 'is_archived')) {
                await p.$executeRawUnsafe("ALTER TABLE document_folders ADD COLUMN is_archived INTEGER DEFAULT 0");
                log.info('Migration: Added is_archived to document_folders');
            }
            if (!dfCols.some(c => c.name === 'related_type')) {
                await p.$executeRawUnsafe("ALTER TABLE document_folders ADD COLUMN related_type TEXT");
                log.info('Migration: Added related_type to document_folders');
            }
            if (!dfCols.some(c => c.name === 'related_id')) {
                await p.$executeRawUnsafe("ALTER TABLE document_folders ADD COLUMN related_id INTEGER");
                log.info('Migration: Added related_id to document_folders');
            }
        }
    } catch (error) {
        log.error('Migration step 24 (document_folders fields) error:', error.message);
    }

    // 25. Add off_days column to employees if missing
    try {
        const empCols = await p.$queryRawUnsafe("PRAGMA table_info('employees')");
        if (empCols.length > 0) {
            if (!empCols.some(c => c.name === 'off_days')) {
                await p.$executeRawUnsafe("ALTER TABLE employees ADD COLUMN off_days TEXT DEFAULT '0'");
                log.info('Migration: Added off_days to employees');
            }
        }
    } catch (error) {
        log.error('Migration step 25 (off_days column in employees) error:', error.message);
    }

    // 26. Create public_holidays table if missing
    try {
        await p.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS public_holidays (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                date DATETIME NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
            )
        `);
        await p.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS idx_public_holidays_company ON public_holidays(company_id)
        `);
        log.info('Migration: Verified/Created public_holidays table');
    } catch (error) {
        log.error('Migration step 26 (create public_holidays table) error:', error.message);
    }

    // Self-healing database alignment for existing operation documents
    try {
        await healExistingOperationDocuments(p);
    } catch (err) {
        log.error('Self-healing operation documents alignment error:', err.message);
    }

    // 27. Auto-migration for RBAC & Request system (roles, permissions, requests, request_approvals, users columns)
    try {
        const uCols = await p.$queryRawUnsafe("PRAGMA table_info('users')");
        if (uCols.length > 0) {
            if (!uCols.some(c => c.name === 'role_id')) {
                await p.$executeRawUnsafe('ALTER TABLE users ADD COLUMN role_id INTEGER');
                log.info('Migration: Added role_id to users');
            }
            if (!uCols.some(c => c.name === 'employee_id')) {
                await p.$executeRawUnsafe('ALTER TABLE users ADD COLUMN employee_id INTEGER');
                log.info('Migration: Added employee_id to users');
            }
            if (!uCols.some(c => c.name === 'is_active')) {
                await p.$executeRawUnsafe('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1');
                log.info('Migration: Added is_active to users');
            }
        }

        // Drop bad tables if they were created with the wrong columns
        const permCols = await p.$queryRawUnsafe("PRAGMA table_info('permissions')");
        if (permCols.length > 0 && permCols.some(c => c.name === 'action')) {
            log.info('Migration: Found wrong permissions schema. Dropping tables to recreate correct columns...');
            await p.$executeRawUnsafe('DROP TABLE IF EXISTS request_approvals');
            await p.$executeRawUnsafe('DROP TABLE IF EXISTS requests');
            await p.$executeRawUnsafe('DROP TABLE IF EXISTS permissions');
            await p.$executeRawUnsafe('DROP TABLE IF EXISTS roles');
        }

        await p.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
            )
        `);

        await p.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_id INTEGER NOT NULL,
                module TEXT NOT NULL,
                can_read INTEGER DEFAULT 0,
                can_create INTEGER DEFAULT 0,
                can_update INTEGER DEFAULT 0,
                can_delete INTEGER DEFAULT 0,
                can_approve INTEGER DEFAULT 0,
                scope TEXT DEFAULT 'OWN',
                FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
            )
        `);

        await p.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                created_by_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                request_data TEXT NOT NULL,
                status TEXT DEFAULT 'PENDING',
                current_step INTEGER DEFAULT 1,
                total_steps INTEGER DEFAULT 1,
                document_path TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
                FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
            )
        `);

        await p.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS request_approvals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER NOT NULL,
                approver_id INTEGER,
                step INTEGER DEFAULT 1,
                status TEXT NOT NULL,
                comment TEXT,
                action_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES requests (id) ON DELETE CASCADE,
                FOREIGN KEY (approver_id) REFERENCES users (id) ON DELETE SET NULL
            )
        `);

        log.info('Migration: Verified/Created RBAC and Request system tables & columns');
    } catch (error) {
        log.error('Migration step 27 (RBAC & Request system) error:', error.message);
    }

    log.info('Auto-migrations loop completed.');
}

async function healExistingOperationDocuments(prisma) {
    log.info('Starting self-healing for existing operation documents...');

    // Fetch all vehicles to help link documents correctly
    const vehicles = await prisma.vehicles.findMany({
        select: { id: true, company_id: true, plate: true }
    });
    const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

    const ensureFolder = async (companyId, folderName) => {
        if (!companyId || !folderName) return;
        const exists = await prisma.document_folders.findFirst({
            where: { company_id: companyId, name: folderName }
        });
        if (!exists) {
            await prisma.document_folders.create({
                data: { company_id: companyId, name: folderName, is_archived: 0 }
            });
            log.info(`Self-healing: Created folder "${folderName}" for company ${companyId}`);
        }
    };

    // --- Maintenances ---
    const maintenances = await prisma.maintenances.findMany({
        where: { file_path: { not: null } }
    });
    for (const item of maintenances) {
        const v = vehicleMap.get(item.vehicle_id);
        if (!v) continue;
        const existing = await prisma.documents.findFirst({
            where: { related_type: 'maintenance', related_id: item.id }
        });
        if (!existing) {
            await ensureFolder(v.company_id, 'Bakım Belgeleri');
            const ext = path.extname(item.file_path || '');
            const dateStr = item.date ? new Date(item.date).toISOString().split('T')[0] : '';
            await prisma.documents.create({
                data: {
                    vehicle_id: item.vehicle_id,
                    related_type: 'maintenance',
                    related_id: item.id,
                    file_name: `${v.plate}_Bakım_${dateStr}${ext}`,
                    file_path: item.file_path,
                    file_type: ext,
                    category: 'Bakım',
                    doc_type: 'Bakım',
                    folder: 'Bakım Belgeleri',
                    start_date: item.date ? new Date(item.date) : null,
                    end_date: item.next_date ? new Date(item.next_date) : null,
                    is_archived: item.is_archived || 0
                }
            });
            log.info(`Self-healing: Registered document for maintenance ${item.id}`);
        }
    }

    // --- Services ---
    const services = await prisma.services.findMany({
        where: { file_path: { not: null } }
    });
    for (const item of services) {
        const v = vehicleMap.get(item.vehicle_id);
        if (!v) continue;
        const existing = await prisma.documents.findFirst({
            where: { related_type: 'service', related_id: item.id }
        });
        if (!existing) {
            await ensureFolder(v.company_id, 'Servis Belgeleri');
            const ext = path.extname(item.file_path || '');
            const dateStr = item.date ? new Date(item.date).toISOString().split('T')[0] : '';
            await prisma.documents.create({
                data: {
                    vehicle_id: item.vehicle_id,
                    related_type: 'service',
                    related_id: item.id,
                    file_name: `${v.plate}_Servis_Belgesi_${dateStr}${ext}`,
                    file_path: item.file_path,
                    file_type: ext,
                    category: 'Servis',
                    doc_type: 'Servis',
                    folder: 'Servis Belgeleri',
                    start_date: item.date ? new Date(item.date) : null,
                    end_date: null,
                    is_archived: item.is_archived || 0
                }
            });
            log.info(`Self-healing: Registered document for service ${item.id}`);
        }
    }

    // --- Inspections ---
    const inspections = await prisma.inspections.findMany({
        where: { file_path: { not: null } }
    });
    for (const item of inspections) {
        const v = vehicleMap.get(item.vehicle_id);
        if (!v) continue;
        const existing = await prisma.documents.findFirst({
            where: { related_type: 'inspection', related_id: item.id }
        });
        if (!existing) {
            await ensureFolder(v.company_id, 'Muayene Belgeleri');
            const ext = path.extname(item.file_path || '');
            const isPeriodic = item.type === 'periodic';
            const cat = isPeriodic ? 'Egzoz Muayenesi' : 'Araç Muayenesi';
            const dateStr = item.inspection_date ? new Date(item.inspection_date).toISOString().split('T')[0] : '';
            await prisma.documents.create({
                data: {
                    vehicle_id: item.vehicle_id,
                    related_type: 'inspection',
                    related_id: item.id,
                    file_name: `${v.plate}_${isPeriodic ? 'Egzoz_Muayene_Raporu' : 'Arac_Muayene_Raporu'}_${dateStr}${ext}`,
                    file_path: item.file_path,
                    file_type: ext,
                    category: cat,
                    doc_type: cat,
                    folder: 'Muayene Belgeleri',
                    start_date: item.inspection_date ? new Date(item.inspection_date) : null,
                    end_date: item.next_inspection ? new Date(item.next_inspection) : null,
                    is_archived: item.is_archived || 0
                }
            });
            log.info(`Self-healing: Registered document for inspection ${item.id}`);
        }
    }

    // --- Insurances ---
    const insurances = await prisma.insurances.findMany({
        where: { file_path: { not: null } }
    });
    for (const item of insurances) {
        const v = vehicleMap.get(item.vehicle_id);
        if (!v) continue;
        const existing = await prisma.documents.findFirst({
            where: { related_type: 'insurance', related_id: item.id }
        });
        if (!existing) {
            await ensureFolder(v.company_id, 'Sigorta & Kasko Belgeleri');
            const ext = path.extname(item.file_path || '');
            const isKasko = item.type === 'kasko';
            const cat = isKasko ? 'Kasko' : 'Trafik Sigortası';
            const dateStr = item.start_date ? new Date(item.start_date).toISOString().split('T')[0] : '';
            await prisma.documents.create({
                data: {
                    vehicle_id: item.vehicle_id,
                    related_type: 'insurance',
                    related_id: item.id,
                    file_name: `${v.plate}_${isKasko ? 'Kasko_Policesi' : 'Trafik_Sigortasi_Policesi'}_${dateStr}${ext}`,
                    file_path: item.file_path,
                    file_type: ext,
                    category: cat,
                    doc_type: cat,
                    folder: 'Sigorta & Kasko Belgeleri',
                    start_date: item.start_date ? new Date(item.start_date) : null,
                    end_date: item.end_date ? new Date(item.end_date) : null,
                    is_archived: item.is_archived || 0
                }
            });
            log.info(`Self-healing: Registered document for insurance ${item.id}`);
        }
    }

    log.info('Self-healing operation documents alignment completed.');
}

async function seedDefaultPublicHolidays(prisma) {
    log.info('Starting self-healing/seeding for default Turkish public holidays...');
    
    // Fetch all companies
    const companies = await prisma.companies.findMany({ select: { id: true } });
    if (companies.length === 0) return;

    // Define 2026 and 2027 Turkish Public Holidays
    const defaultHolidays = [
        // --- 2026 ---
        { date: '2026-01-01', description: 'Yılbaşı' },
        { date: '2026-03-19', description: 'Ramazan Bayramı Arifesi (Yarım Gün)' },
        { date: '2026-03-20', description: 'Ramazan Bayramı 1. Gün' },
        { date: '2026-03-21', description: 'Ramazan Bayramı 2. Gün' },
        { date: '2026-03-22', description: 'Ramazan Bayramı 3. Gün' },
        { date: '2026-04-23', description: 'Ulusal Egemenlik ve Çocuk Bayramı' },
        { date: '2026-05-01', description: 'Emek ve Dayanışma Günü' },
        { date: '2026-05-19', description: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı' },
        { date: '2026-05-26', description: 'Kurban Bayramı Arifesi (Yarım Gün)' },
        { date: '2026-05-27', description: 'Kurban Bayramı 1. Gün' },
        { date: '2026-05-28', description: 'Kurban Bayramı 2. Gün' },
        { date: '2026-05-29', description: 'Kurban Bayramı 3. Gün' },
        { date: '2026-05-30', description: 'Kurban Bayramı 4. Gün' },
        { date: '2026-07-15', description: 'Demokrasi ve Milli Birlik Günü' },
        { date: '2026-08-30', description: 'Zafer Bayramı' },
        { date: '2026-10-28', description: 'Cumhuriyet Bayramı Arifesi (Yarım Gün)' },
        { date: '2026-10-29', description: 'Cumhuriyet Bayramı' },

        // --- 2027 ---
        { date: '2027-01-01', description: 'Yılbaşı' },
        { date: '2027-03-08', description: 'Ramazan Bayramı Arifesi (Yarım Gün)' },
        { date: '2027-03-09', description: 'Ramazan Bayramı 1. Gün' },
        { date: '2027-03-10', description: 'Ramazan Bayramı 2. Gün' },
        { date: '2027-03-11', description: 'Ramazan Bayramı 3. Gün' },
        { date: '2027-04-23', description: 'Ulusal Egemenlik ve Çocuk Bayramı' },
        { date: '2027-05-01', description: 'Emek ve Dayanışma Günü' },
        { date: '2027-05-15', description: 'Kurban Bayramı Arifesi (Yarım Gün)' },
        { date: '2027-05-16', description: 'Kurban Bayramı 1. Gün' },
        { date: '2027-05-17', description: 'Kurban Bayramı 2. Gün' },
        { date: '2027-05-18', description: 'Kurban Bayramı 3. Gün' },
        { date: '2027-05-19', description: 'Kurban Bayramı 4. Gün / Atatürk\'ü Anma, Gençlik ve Spor Bayramı' },
        { date: '2027-07-15', description: 'Demokrasi ve Milli Birlik Günü' },
        { date: '2027-08-30', description: 'Zafer Bayramı' },
        { date: '2027-10-28', description: 'Cumhuriyet Bayramı Arifesi (Yarım Gün)' },
        { date: '2027-10-29', description: 'Cumhuriyet Bayramı' }
    ];

    for (const company of companies) {
        // Fetch existing holidays for this company
        const existing = await prisma.public_holidays.findMany({
            where: { company_id: company.id }
        });
        const existingDates = new Set(existing.map(h => new Date(h.date).toISOString().split('T')[0]));

        for (const holiday of defaultHolidays) {
            if (!existingDates.has(holiday.date)) {
                await prisma.public_holidays.create({
                    data: {
                        company_id: company.id,
                        date: new Date(holiday.date),
                        description: holiday.description
                    }
                });
                log.info(`Seeding: Added holiday "${holiday.description}" on ${holiday.date} for company ${company.id}`);
            }
        }
    }
    log.info('Seeding of Turkish public holidays completed.');

    // 12. Ensure default admin user exists if users table is empty
    try {
        const userCount = await p.users.count();
        if (userCount === 0) {
            const bcrypt = require('bcryptjs');
            const defaultPasswordHash = bcrypt.hashSync('admin', 10);

            // Ensure a company exists first
            let company = await p.companies.findFirst();
            if (!company) {
                company = await p.companies.create({
                    data: {
                        name: 'Varsayılan Şirket'
                    }
                });
            }

            await p.users.create({
                data: {
                    username: 'admin',
                    email: 'admin@kontrol.app',
                    password_hash: defaultPasswordHash,
                    full_name: 'Yönetici',
                    role: 'admin',
                    company_id: company.id,
                    is_active: 1,
                    must_change_password: 0
                }
            });
            log.info('Bootstrap: Created default admin user (username: admin, password: admin)');
        }
    } catch (error) {
        log.error('Bootstrap step 12 (default user) error:', error.message);
    }
}

module.exports = { getPrismaClient, runAutoMigrations, getDbPath, hasValidData };
