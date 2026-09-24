const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Client } = require('pg');

try {
    require('dotenv').config();
} catch (e) {}

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Perform a full automated database & storage backup
 */
async function performBackup() {
    try {
        const { performUnifiedBackup } = require('./supabase-backup-manager');
        const res = await performUnifiedBackup({ includeDb: true, includeStorage: true });
        return res;
    } catch (unifiedErr) {
        console.warn('⚠️ Unified backup failed, falling back to basic DB JSON dump:', unifiedErr.message);
    }

    console.log(`[Backup ${new Date().toISOString()}] Starting automated database backup fallback...`);
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('❌ [Backup Error]: DATABASE_URL is not set in environment.');
        return { success: false, error: 'DATABASE_URL is not set in environment.' };
    }
    const client = new Client({ connectionString: dbUrl });
    
    try {
        await client.connect();

        // Get list of all public tables
        const tablesRes = await client.query(`
            SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
        `);

        const backupData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            tables: {}
        };

        for (const row of tablesRes.rows) {
            const table = row.tablename;
            const dataRes = await client.query(`SELECT * FROM public."${table}"`);
            backupData.tables[table] = dataRes.rows;
        }

        await client.end();

        // Compress to gzip
        const jsonString = JSON.stringify(backupData);
        const compressed = zlib.gzipSync(Buffer.from(jsonString));

        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `kontrol_db_backup_${dateStr}.json.gz`;
        const filePath = path.join(BACKUP_DIR, fileName);

        fs.writeFileSync(filePath, compressed);
        const sizeMb = (compressed.length / (1024 * 1024)).toFixed(2);
        console.log(`✅ [Backup Success] Saved ${fileName} (${sizeMb} MB) to ${BACKUP_DIR}`);

        // Rotate & clean up old backups
        cleanOldBackups();

        return {
            success: true,
            fileName,
            filePath,
            sizeBytes: compressed.length,
            tableCount: Object.keys(backupData.tables).length
        };
    } catch (err) {
        console.error('❌ [Backup Error]:', err.message);
        try { await client.end(); } catch (e) {}
        return { success: false, error: err.message };
    }
}

/**
 * Remove backups older than RETENTION_DAYS
 */
function cleanOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const now = Date.now();
        const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

        for (const file of files) {
            if (!file.startsWith('kontrol_db_backup_')) continue;
            const fullPath = path.join(BACKUP_DIR, file);
            const stats = fs.statSync(fullPath);
            if (now - stats.mtimeMs > maxAgeMs) {
                fs.unlinkSync(fullPath);
                console.log(`🗑️ [Backup Cleanup] Removed old backup: ${file}`);
            }
        }
    } catch (e) {
        console.warn('Backup cleanup warning:', e.message);
    }
}

if (require.main === module) {
    performBackup().then((res) => {
        if (!res.success) process.exit(1);
    });
}

module.exports = {
    performBackup,
    cleanOldBackups
};
