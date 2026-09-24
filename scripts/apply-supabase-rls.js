/**
 * Apply Supabase Row-Level Security (RLS) Policies directly via PostgreSQL connection
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

try {
    require('dotenv').config();
} catch (e) {}

async function applyRls() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('❌ DATABASE_URL is not set in environment.');
        process.exit(1);
    }

    const sqlPath = path.join(__dirname, '../supabase/migrations/20260924_enable_rls_hardening.sql');
    if (!fs.existsSync(sqlPath)) {
        console.error('❌ SQL file not found at:', sqlPath);
        process.exit(1);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log('🔒 Connecting to database to apply Row-Level Security (RLS)...');

    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        await client.query(sqlContent);
        console.log('✅ [RLS Success] Supabase Row-Level Security policies applied to all tenant tables!');
    } catch (err) {
        console.error('❌ [RLS Error]:', err.message);
        process.exit(1);
    } finally {
        await client.end().catch(() => {});
    }
}

if (require.main === module) {
    applyRls();
}

module.exports = { applyRls };
