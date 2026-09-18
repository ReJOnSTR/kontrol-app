// Polyfill global.WebSocket for Supabase JS in Node.js / Electron main process
if (typeof global !== 'undefined' && !global.WebSocket) {
    try {
        global.WebSocket = require('ws')
    } catch (e) {
        global.WebSocket = class MockWebSocket {
            constructor() {}
            addEventListener() {}
            removeEventListener() {}
            send() {}
            close() {}
        }
    }
}

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://supabase.kontrol-app.com'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_36cfd54f23bbf88d313317_24673797'

// Initialize Supabase Admin client with service role key
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    realtime: {
        enabled: false
    }
})

/**
 * Helper to slugify Turkish text for emails & usernames
 */
function slugify(text) {
    if (!text) return ''
    const trMap = { 'ç':'c', 'Ç':'c', 'ğ':'g', 'Ğ':'g', 'ı':'i', 'İ':'i', 'ö':'o', 'Ö':'o', 'ş':'s', 'Ş':'s', 'ü':'u', 'Ü':'u' }
    return String(text)
        .replace(/[çÇğĞıİöÖşŞüÜ]/g, m => trMap[m] || m)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim()
}

/**
 * Create or update a user in Supabase Auth (auth.users)
 */
async function createOrUpdateSupabaseAuthUser(userData) {
    try {
        const { email, password, username, full_name, role = 'employee', employee_id, company_id } = userData
        if (!email) return { success: false, error: 'Email is required' }

        const cleanEmail = email.toLowerCase().trim()
        const userMetadata = {
            username: username || cleanEmail.split('@')[0],
            full_name: full_name || username || cleanEmail.split('@')[0],
            role: role || 'employee',
            employee_id: employee_id ? parseInt(employee_id) : null,
            company_id: company_id ? parseInt(company_id) : null
        }

        // Try creating the user
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: password || '123456',
            email_confirm: true,
            user_metadata: userMetadata
        })

        if (!error && data?.user) {
            return { success: true, user: data.user }
        }

        // If user already exists, update their metadata & password
        if (error && (error.message?.includes('already registered') || error.message?.includes('already exists') || error.status === 422)) {
            // Find user by email
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
            const existing = listData?.users?.find(u => u.email?.toLowerCase() === cleanEmail)
            if (existing) {
                const updatePayload = { user_metadata: userMetadata }
                if (password) updatePayload.password = password
                const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, updatePayload)
                if (!updateError) {
                    return { success: true, user: updateData.user, updated: true }
                }
            }
        }

        return { success: false, error: error ? error.message : 'Unknown error' }
    } catch (err) {
        console.error('[Supabase Auth User Create/Update Error]:', err.message)
        return { success: false, error: err.message }
    }
}

/**
 * Synchronize all employees from PostgreSQL to Supabase Auth
 */
async function syncAllEmployeesToSupabaseAuth(companyId) {
    try {
        const { getPrismaClient } = require('../prismaClient');
        const bcrypt = require('bcryptjs');
        const prisma = getPrismaClient();

        const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:eyaeaj0djlbjhybz04ma4vrw7otatabf@45.147.47.56:5432/postgres';
        let isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

        if (isPostgres) {
            const { Client } = require('pg');
            const pgClient = new Client({ connectionString: dbUrl });
            await pgClient.connect();

            let query = 'SELECT * FROM employees WHERE status = $1 OR status IS NULL';
            let params = ['active'];
            if (companyId) {
                query += ' AND company_id = $2';
                params.push(parseInt(companyId));
            }

            const empRes = await pgClient.query(query, params);
            const results = [];

            for (const emp of empRes.rows) {
                const firstNameSlug = slugify(emp.first_name);
                const lastNameSlug = slugify(emp.last_name);
                const fallbackEmail = `${firstNameSlug}.${lastNameSlug}.${emp.id}@kontrol-app.com`;
                const email = (emp.email && emp.email.includes('@')) ? emp.email.toLowerCase().trim() : fallbackEmail;
                const username = `${firstNameSlug}.${lastNameSlug}` || `emp_${emp.id}`;
                const defaultPassword = emp.tc_no ? String(emp.tc_no).trim() : '123456';
                const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
                const passwordHash = bcrypt.hashSync(defaultPassword, 10);
                const metaJson = JSON.stringify({
                    username,
                    full_name: fullName,
                    employee_id: emp.id,
                    company_id: emp.company_id,
                    role: 'employee'
                });

                // 1. Check existing user in auth.users
                const existAuth = await pgClient.query('SELECT id FROM auth.users WHERE email = $1', [email]);
                let authUserId;
                if (existAuth.rows.length > 0) {
                    authUserId = existAuth.rows[0].id;
                    await pgClient.query(`
                        UPDATE auth.users 
                        SET encrypted_password = $1, raw_user_meta_data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $3::uuid
                    `, [passwordHash, metaJson, authUserId]);
                } else {
                    const newAuth = await pgClient.query(`
                        INSERT INTO auth.users (
                            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
                        ) VALUES (
                            '00000000-0000-0000-0000-000000000000',
                            gen_random_uuid(),
                            'authenticated',
                            'authenticated',
                            $1,
                            $2,
                            CURRENT_TIMESTAMP,
                            '{"provider":"email","providers":["email"]}'::jsonb,
                            $3::jsonb,
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP,
                            '', '', '', ''
                        ) RETURNING id;
                    `, [email, passwordHash, metaJson]);
                    authUserId = newAuth.rows[0].id;
                }

                // 2. Insert/Update auth.identities
                const existId = await pgClient.query('SELECT id FROM auth.identities WHERE provider = $1 AND provider_id = $2', ['email', email]);
                const subData = JSON.stringify({ sub: String(authUserId), email });
                if (existId.rows.length > 0) {
                    await pgClient.query(`
                        UPDATE auth.identities 
                        SET identity_data = $1::jsonb, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $2
                    `, [subData, existId.rows[0].id]);
                } else {
                    await pgClient.query(`
                        INSERT INTO auth.identities (
                            id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
                        ) VALUES (
                            gen_random_uuid(),
                            $1::uuid,
                            $2::jsonb,
                            'email',
                            $3,
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP
                        )
                    `, [authUserId, subData, email]);
                }

                // 3. Upsert into public.users
                const existPublicUser = await pgClient.query('SELECT id FROM public.users WHERE username = $1 OR employee_id = $2', [username, emp.id]);
                if (existPublicUser.rows.length > 0) {
                    await pgClient.query(`
                        UPDATE public.users 
                        SET email = $1, password_hash = $2, full_name = $3, employee_id = $4, is_active = 1
                        WHERE id = $5
                    `, [email, passwordHash, fullName, emp.id, existPublicUser.rows[0].id]);
                } else {
                    await pgClient.query(`
                        INSERT INTO public.users (
                            username, email, password_hash, full_name, role, employee_id, is_active, must_change_password, created_at
                        ) VALUES (
                            $1, $2, $3, $4, 'employee', $5, 1, 0, CURRENT_TIMESTAMP
                        )
                    `, [username, email, passwordHash, fullName, emp.id]);
                }

                results.push({
                    employeeId: emp.id,
                    name: fullName,
                    email,
                    username,
                    success: true
                });
            }

            await pgClient.end();
            return { success: true, totalSynced: results.length, results };
        }

        // Fallback for local SQLite
        const where = { status: 'active' };
        if (companyId) where.company_id = parseInt(companyId);
        const employees = await prisma.employees.findMany({ where });
        return { success: true, totalSynced: employees.length, results: [] };
    } catch (err) {
        console.error('[Supabase Auth Sync Error]:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Upload a Buffer to a Supabase Storage Bucket
 */
async function uploadToStorage(buffer, storagePath, mimeType = 'application/octet-stream', bucket = 'documents') {
    try {
        const cleanPath = storagePath.replace(/^\/+/, '')
        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(cleanPath, buffer, {
                contentType: mimeType,
                upsert: true
            })

        if (error) throw error

        const { data: publicUrlData } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(cleanPath)

        return {
            success: true,
            path: data.path,
            publicUrl: publicUrlData.publicUrl
        }
    } catch (err) {
        console.error('[Supabase Admin Storage Upload Error]:', err.message)
        return { success: false, error: err.message }
    }
}

/**
 * Search for a file across root and subfolders in Supabase Storage
 */
async function findFileInStorage(targetFileName, bucket = 'documents') {
    try {
        const path = require('path')
        const baseName = path.basename(targetFileName)
        
        // 1. Direct search at root
        const rootSearch = await supabaseAdmin.storage.from(bucket).list('', { search: baseName, limit: 10 })
        if (rootSearch.data && rootSearch.data.length > 0) {
            const match = rootSearch.data.find(f => f.name === baseName)
            if (match) return match.name
        }

        // 2. Search common subdirectories like company_*
        const rootFolders = await supabaseAdmin.storage.from(bucket).list('', { limit: 100 })
        if (rootFolders.data) {
            for (const item of rootFolders.data) {
                if (item.id === null) {
                    // It's a folder, search inside
                    const subSearch = await supabaseAdmin.storage.from(bucket).list(item.name, { search: baseName, limit: 10 })
                    if (subSearch.data && subSearch.data.length > 0) {
                        const match = subSearch.data.find(f => f.name === baseName)
                        if (match) return `${item.name}/${match.name}`
                    }
                    // Try 2 levels deep
                    const deeperFolders = await supabaseAdmin.storage.from(bucket).list(item.name, { limit: 50 })
                    if (deeperFolders.data) {
                        for (const deepItem of deeperFolders.data) {
                            if (deepItem.id === null) {
                                const deepSearch = await supabaseAdmin.storage.from(bucket).list(`${item.name}/${deepItem.name}`, { search: baseName, limit: 10 })
                                if (deepSearch.data && deepSearch.data.length > 0) {
                                    const match = deepSearch.data.find(f => f.name === baseName)
                                    if (match) return `${item.name}/${deepItem.name}/${match.name}`
                                }
                            }
                        }
                    }
                }
            }
        }
        return null
    } catch (e) {
        return null
    }
}

/**
 * Download a file buffer from a Supabase Storage Bucket
 */
async function downloadFromStorage(storagePath, bucket = 'documents') {
    try {
        const path = require('path')
        const cleanPath = storagePath.replace(/^\/+/, '')
        let { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .download(cleanPath)

        if (!error && data) {
            const arrayBuffer = await data.arrayBuffer()
            return { success: true, buffer: Buffer.from(arrayBuffer) }
        }

        // Try searching subfolders if exact path failed
        const baseName = path.basename(cleanPath)
        const foundPath = await findFileInStorage(baseName, bucket)
        if (foundPath && foundPath !== cleanPath) {
            const retry = await supabaseAdmin.storage.from(bucket).download(foundPath)
            if (!retry.error && retry.data) {
                const arrayBuffer = await retry.data.arrayBuffer()
                return { success: true, buffer: Buffer.from(arrayBuffer), resolvedPath: foundPath }
            }
        }

        return { success: false, error: error ? error.message : 'Object not found' }
    } catch (err) {
        console.error('[Supabase Storage Download Error]:', err.message)
        return { success: false, error: err.message }
    }
}

/**
 * Delete a file from Supabase Storage
 */
async function deleteFromStorage(storagePath, bucket = 'documents') {
    try {
        const cleanPath = storagePath.replace(/^\/+/, '')
        const { error } = await supabaseAdmin.storage
            .from(bucket)
            .remove([cleanPath])

        if (error) throw error
        return { success: true }
    } catch (err) {
        console.error('[Supabase Storage Delete Error]:', err.message)
        return { success: false, error: err.message }
    }
}

/**
 * Get Public URL for a file
 */
function getStoragePublicUrl(storagePath, bucket = 'documents') {
    if (!storagePath) return ''
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) return storagePath
    const cleanPath = storagePath.replace(/^\/+/, '')
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(cleanPath)
    return data.publicUrl || ''
}

module.exports = {
    supabaseAdmin,
    SUPABASE_URL,
    createOrUpdateSupabaseAuthUser,
    syncAllEmployeesToSupabaseAuth,
    uploadToStorage,
    downloadFromStorage,
    deleteFromStorage,
    getStoragePublicUrl
}
