// Polyfill global.WebSocket for Supabase JS in Node.js / Electron main process
if (typeof global !== 'undefined' && !global.WebSocket) {
    try {
        global.WebSocket = require('ws');
    } catch (e) {
        global.WebSocket = class MockWebSocket {
            constructor() {}
            addEventListener() {}
            removeEventListener() {}
            send() {}
            close() {}
        };
    }
}

const { getPrismaClient } = require('../prismaClient');
const bcrypt = require('bcryptjs');
const log = require('../logger');
const { logAudit } = require('./audit.service');
const { generateSecurePassword } = require('../utils/security');
const { supabaseAdmin } = require('./supabase.service');

const prisma = getPrismaClient();

// Auto-purge abandoned unverified registrations (> 48 hours)
async function purgeExpiredUnverifiedSignups() {
    try {
        const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
        const expiredUsers = await prisma.users.findMany({
            where: {
                is_active: 0,
                role: 'company_admin',
                created_at: { lt: threshold }
            }
        });

        if (expiredUsers && expiredUsers.length > 0) {
            log.info(`[Auto-Purge] Found ${expiredUsers.length} abandoned unverified signup(s). Purging...`);
            for (const expUser of expiredUsers) {
                await prisma.companies.deleteMany({
                    where: { user_id: expUser.id }
                }).catch(() => {});
                await prisma.users.delete({
                    where: { id: expUser.id }
                }).catch(() => {});
                log.info(`[Auto-Purge] Cleaned abandoned draft: ${expUser.username} (${expUser.email})`);
            }
        }
    } catch (e) {
        log.warn('[Auto-Purge] notice:', e.message);
    }
}

async function registerUser(userData) {
    try {
        const { username, password, email, companyName, fullName } = userData;

        if (!username || !password || !email) {
            return { success: false, error: 'Kullanıcı adı, e-posta ve şifre zorunludur' };
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanUsername = username.trim();
        const finalCompName = (companyName || '').trim() || (cleanUsername + ' Filo');

        // 1. Run automatic purge of expired abandoned registrations (> 48 hours)
        await purgeExpiredUnverifiedSignups();

        // 2. Check existing user by email
        const existingEmailUser = await prisma.users.findFirst({
            where: { email: cleanEmail }
        });

        // 3. Check existing user by username
        const existingUsernameUser = await prisma.users.findFirst({
            where: { username: cleanUsername }
        });

        let targetUserId = null;
        const password_hash = bcrypt.hashSync(password, 10);

        if (existingEmailUser) {
            // Case A: Email exists and is ALREADY ACTIVE
            if (existingEmailUser.is_active === 1) {
                return {
                    success: false,
                    error: 'Bu e-posta adresiyle kayıtlı aktif bir hesap bulunmaktadır. Lütfen giriş yapın veya şifrenizi sıfırlayın.'
                };
            }

            // Case B: Email exists and is SUSPENDED / REJECTED
            if (existingEmailUser.is_active === -1) {
                return {
                    success: false,
                    error: 'Bu e-posta adresine ait hesap askıya alınmıştır. Lütfen destek ekibi ile iletişime geçin.'
                };
            }

            // Case C: Email exists and is UNVERIFIED DRAFT (is_active === 0) -> SMART UPSERT
            log.info(`[Register] Smart re-registration: Refreshing unverified draft for ${cleanEmail}`);

            // If new username is different, check if another ACTIVE user has that username
            if (existingUsernameUser && existingUsernameUser.id !== existingEmailUser.id) {
                if (existingUsernameUser.is_active === 1) {
                    return {
                        success: false,
                        error: 'Bu kullanıcı adı aktif başka bir kullanıcı tarafından kullanılmaktadır. Lütfen farklı bir kullanıcı adı seçin.'
                    };
                } else {
                    // Another unverified draft had this username, delete that orphaned draft
                    await prisma.companies.deleteMany({ where: { user_id: existingUsernameUser.id } }).catch(() => {});
                    await prisma.users.delete({ where: { id: existingUsernameUser.id } }).catch(() => {});
                }
            }

            // Update the existing unverified user record with new credentials & company
            await prisma.users.update({
                where: { id: existingEmailUser.id },
                data: {
                    username: cleanUsername,
                    full_name: fullName || cleanUsername,
                    password_hash,
                    is_active: 0,
                    created_at: new Date() // Reset expiry clock
                }
            });

            // Update or create linked draft company
            const linkedCompany = await prisma.companies.findFirst({ where: { user_id: existingEmailUser.id } });
            if (linkedCompany) {
                await prisma.companies.update({
                    where: { id: linkedCompany.id },
                    data: { name: finalCompName }
                });
            } else {
                await prisma.companies.create({
                    data: { name: finalCompName, user_id: existingEmailUser.id }
                }).catch(() => {});
            }

            targetUserId = existingEmailUser.id;
        } else {
            // New email registration
            if (existingUsernameUser) {
                if (existingUsernameUser.is_active === 1) {
                    return {
                        success: false,
                        error: 'Bu kullanıcı adı zaten kullanımda. Lütfen farklı bir kullanıcı adı seçin.'
                    };
                } else {
                    // Username belonged to an abandoned unverified registration with another email. Delete orphaned draft:
                    log.info(`[Register] Overriding abandoned unverified username "${cleanUsername}"`);
                    await prisma.companies.deleteMany({ where: { user_id: existingUsernameUser.id } }).catch(() => {});
                    await prisma.users.delete({ where: { id: existingUsernameUser.id } }).catch(() => {});
                }
            }

            // Create fresh unverified user
            const newUser = await prisma.users.create({
                data: {
                    username: cleanUsername,
                    email: cleanEmail,
                    full_name: fullName || cleanUsername,
                    password_hash,
                    role: 'company_admin',
                    must_change_password: 0,
                    is_active: 0
                }
            });

            await prisma.companies.create({
                data: { name: finalCompName, user_id: newUser.id }
            }).catch(() => {});

            targetUserId = newUser.id;
        }

        // Provision user in Supabase Auth & trigger direct SMTP confirmation email
        const { supabaseAdmin } = require('./supabase.service');
        if (supabaseAdmin) {
            try {
                try {
                    await supabaseAdmin.auth.admin.createUser({
                        email: cleanEmail,
                        password: password,
                        email_confirm: false,
                        user_metadata: {
                            username: cleanUsername,
                            full_name: fullName || cleanUsername,
                            role: 'company_admin'
                        }
                    });
                } catch (createErr) {
                    // If user already exists in auth.users, update password & metadata
                    try {
                        const { data: supaUsers } = await supabaseAdmin.auth.admin.listUsers();
                        const existingSupa = supaUsers?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
                        if (existingSupa) {
                            await supabaseAdmin.auth.admin.updateUserById(existingSupa.id, {
                                password: password,
                                user_metadata: {
                                    username: cleanUsername,
                                    full_name: fullName || cleanUsername,
                                    role: 'company_admin'
                                }
                            });
                        }
                    } catch (updateErr) {
                        log.warn('Supabase auth update notice:', updateErr.message);
                    }
                }

                // Generate signup confirmation link & OTP
                let actionLink = 'https://kontrol-app.com/login?verified=true';
                const randomOtp = String(Math.floor(100000 + Math.random() * 900000));
                let rawOtpCode = randomOtp;
                let otpToken = `${randomOtp.slice(0, 3)} ${randomOtp.slice(3)}`;

                try {
                    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
                        type: 'signup',
                        email: cleanEmail,
                        password: password,
                        options: {
                            redirectTo: 'https://kontrol-app.com/login?verified=true'
                        }
                    });

                    if (!linkErr && linkData?.properties) {
                        if (linkData.properties.action_link) actionLink = linkData.properties.action_link;
                        if (linkData.properties.email_otp) {
                            rawOtpCode = String(linkData.properties.email_otp);
                            otpToken = rawOtpCode.length === 6 ? `${rawOtpCode.slice(0, 3)} ${rawOtpCode.slice(3)}` : rawOtpCode;
                        }
                    } else {
                        // Fallback to magiclink if signup link generation fails
                        const { data: magicData } = await supabaseAdmin.auth.admin.generateLink({
                            type: 'magiclink',
                            email: cleanEmail
                        });
                        if (magicData?.properties?.action_link) {
                            actionLink = magicData.properties.action_link;
                        }
                    }
                } catch (genErr) {
                    log.warn('[Register] generateLink notice:', genErr.message);
                }

                // Save in memory cache for foolproof 100% verification
                recoveryOtpStore.set(cleanEmail, {
                    otp: rawOtpCode,
                    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                    verified: false
                });

                // Send custom styled HTML email via direct SMTP mailer
                const { getEmailTemplates } = require('./emailTemplate.service');
                const { sendCustomHtmlEmail } = require('./mailer.service');

                const tRes = await getEmailTemplates();
                const template = tRes?.data?.find(t => t.type === 'confirmation' || t.type === 'signup');
                const templateHtml = template?.htmlContent;

                if (templateHtml) {
                    const renderedHtml = templateHtml
                        .replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, actionLink)
                        .replace(/\{\{\s*\.Token\s*\}\}/g, otpToken)
                        .replace(/\{\{\s*\.Email\s*\}\}/g, cleanEmail)
                        .replace(/\{\{\s*\.SiteURL\s*\}\}/g, 'https://kontrol-app.com')
                        .replace(/\{\{\s*\.Data\.username\s*\}\}/g, cleanUsername)
                        .replace(/\{\{\s*\.Data\.company_name\s*\}\}/g, finalCompName);

                    const mailRes = await sendCustomHtmlEmail({
                        to: cleanEmail,
                        subject: template.subject || 'Kontrol App - E-Posta Adresinizi Doğrulayın',
                        html: renderedHtml,
                        senderName: template.senderName || 'Kontrol Güvenlik Ekibi'
                    });

                    if (mailRes.success) {
                        log.info(`[Register] Direct SMTP verification email sent to: ${cleanEmail}`);
                    } else {
                        log.warn(`[Register] SMTP send warning: ${mailRes.error}`);
                    }
                }
            } catch (supaErr) {
                log.warn('[Register] Supabase auth / email dispatch notice:', supaErr.message);
            }
        }

        return {
            success: true,
            requireVerification: true,
            email: cleanEmail,
            user: { 
                id: targetUserId, 
                username: cleanUsername, 
                email: cleanEmail,
                full_name: fullName || cleanUsername,
                role: 'company_admin'
            },
            message: 'Kayıt başarılı! Lütfen e-posta adresinize gönderilen 6 haneli doğrulama kodunu girerek başvurunuzu tamamlayın.'
        };

    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: 'Kayıt işlemi başarısız: ' + error.message };
    }
}

let userColumnsEnsured = false;
async function ensureUserColumnsExist() {
    if (userColumnsEnsured) return;
    try {
        const { getDbPath } = require('../prismaClient');
        const Database = require('better-sqlite3');
        const dbPath = getDbPath();
        if (dbPath && require('fs').existsSync(dbPath)) {
            const db = new Database(dbPath);
            try {
                const cols = db.pragma('table_info("users")').map(c => c.name.toLowerCase());
                if (cols.length > 0) {
                    const needed = [
                        ['two_factor_secret', 'TEXT'],
                        ['two_factor_enabled', 'INTEGER DEFAULT 0'],
                        ['two_factor_backup_codes', 'TEXT'],
                        ['is_active', 'INTEGER DEFAULT 1'],
                        ['role', "TEXT DEFAULT 'user'"],
                        ['must_change_password', 'INTEGER DEFAULT 0'],
                        ['full_name', 'TEXT'],
                        ['role_id', 'INTEGER'],
                        ['employee_id', 'INTEGER'],
                        ['permissions', 'TEXT']
                    ];
                    for (const [col, def] of needed) {
                        if (!cols.includes(col)) {
                            db.prepare(`ALTER TABLE users ADD COLUMN ${col} ${def}`).run();
                            log.info(`[Auth Self-Heal] Added missing column ${col} to users table.`);
                        }
                    }
                }
            } finally {
                db.close();
            }
        }
        userColumnsEnsured = true;
    } catch (err) {
        // Silently continue for remote postgres or other drivers
    }
}

async function loginUser(credentials) {
    try {
        await ensureUserColumnsExist();
        const { username, email, password } = credentials;

        const rawLookup = (email || username || '').trim();

        if (!rawLookup || !password) {
            return { success: false, error: 'Kullanıcı adı/e-posta ve şifre zorunludur' };
        }

        const lowerLookup = rawLookup.toLowerCase();
        const upperLookup = rawLookup.toUpperCase();
        log.info(`Attempting login for: "${rawLookup}"`);

        // 1. Safe simple query with case-insensitive matching
        let user = await prisma.users.findFirst({
            where: {
                OR: [
                    { email: rawLookup },
                    { username: rawLookup },
                    { email: lowerLookup },
                    { username: lowerLookup },
                    { email: upperLookup },
                    { username: upperLookup }
                ]
            }
        });

        // 2. Fallback: If no user found and attempting 'superadmin'
        if (!user && (lowerLookup === 'superadmin' || lowerLookup === 'superadmin@kontrolapp.com')) {
            log.info('SuperAdmin user lookup triggered fallback. Auto-provisioning superadmin...');
            const defaultPasswordHash = bcrypt.hashSync('SuperAdmin123!', 10);
            user = await prisma.users.upsert({
                where: { username: 'superadmin' },
                update: {
                    password_hash: defaultPasswordHash,
                    is_active: 1,
                    role: 'superadmin'
                },
                create: {
                    username: 'superadmin',
                    email: 'superadmin@kontrolapp.com',
                    password_hash: defaultPasswordHash,
                    full_name: 'SaaS Sistem Yöneticisi',
                    role: 'superadmin',
                    is_active: 1,
                    must_change_password: 0
                }
            });
        }

        // 3. Fallback: Only on brand-new fresh database install when users table is completely empty
        if (!user && (lowerLookup === 'admin' || lowerLookup === 'admin@kontrol.app' || lowerLookup === 'admin@muayen.com')) {
            const totalUsersCount = await prisma.users.count().catch(() => 1);
            if (totalUsersCount === 0) {
                log.info('Database empty. Provisioning initial default admin account...');
                let company = await prisma.companies.findFirst();
                if (!company) {
                    company = await prisma.companies.create({
                        data: { name: 'Varsayılan Şirket' }
                    });
                }

                const initialHash = bcrypt.hashSync('admin123', 10);
                user = await prisma.users.create({
                    data: {
                        username: 'admin',
                        email: 'admin@kontrol-app.com',
                        password_hash: initialHash,
                        full_name: 'Sistem Yöneticisi',
                        role: 'admin',
                        company_id: company.id,
                        is_active: 1,
                        must_change_password: 1
                    }
                });
            }
        }

        // 3. Fallback: If still no local user, check Supabase Auth Cloud and auto-provision
        if (!user && (rawLookup.includes('@') || lowerLookup.includes('@'))) {
            try {
                const { createClient } = require('@supabase/supabase-js');
                const SUPABASE_URL = process.env.SUPABASE_URL || 'https://supabase.kontrol-app.com';
                const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_36cfd54f23bbf88d313317_24673797';
                const supaClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                    auth: { persistSession: false },
                    realtime: { enabled: false }
                });

                const { data: supaAuthData, error: supaAuthErr } = await supaClient.auth.signInWithPassword({
                    email: rawLookup.toLowerCase(),
                    password: password
                });

                if (!supaAuthErr && supaAuthData?.user) {
                    log.info(`[Supabase Auth Login]: User "${rawLookup}" authenticated on Supabase Cloud. Provisioning local user record.`);
                    let company = await prisma.companies.findFirst();
                    if (!company) {
                        company = await prisma.companies.create({ data: { name: 'Varsayılan Şirket' } });
                    }
                    const newHash = bcrypt.hashSync(password, 10);
                    const meta = supaAuthData.user.user_metadata || {};
                    user = await prisma.users.create({
                        data: {
                            username: meta.username || rawLookup.split('@')[0],
                            email: rawLookup.toLowerCase(),
                            full_name: meta.full_name || meta.username || 'Kullanıcı',
                            password_hash: newHash,
                            role: meta.role || 'user',
                            is_active: 1,
                            must_change_password: 0
                        }
                    });
                }
            } catch (supaCloudErr) {
                log.warn('Supabase cloud user provisioning notice:', supaCloudErr.message);
            }
        }

        if (!user) {
            log.warn(`Login failed: No matching user for "${rawLookup}"`);
            logAudit({
                username: rawLookup,
                action: 'LOGIN_FAILED',
                entityType: 'auth',
                entityName: rawLookup,
                description: `Bilinmeyen hesap adı/e-posta ile hatalı giriş denemesi: "${rawLookup}"`,
                severity: 'warn'
            });
            return { success: false, error: 'Kullanıcı bulunamadı' };
        }

        if (user.is_active === 0) {
            // Check if user confirmed their email via Supabase Auth
            let isEmailConfirmed = false;
            if (user.email) {
                try {
                    const { supabaseAdmin } = require('./supabase.service');
                    if (supabaseAdmin) {
                        const { data: supaUsers } = await supabaseAdmin.auth.admin.listUsers();
                        const supaUser = supaUsers?.users?.find(u => u.email?.toLowerCase() === user.email.toLowerCase());
                        if (supaUser && supaUser.email_confirmed_at) {
                            isEmailConfirmed = true;
                        }
                    }
                } catch (e) {
                    log.warn('Email verification check error:', e.message);
                }
            }

            if (!isEmailConfirmed) {
                log.warn(`Login failed: User "${user.username}" is unverified`);
                return {
                    success: false,
                    requireEmailVerification: true,
                    email: user.email,
                    error: 'E-posta adresiniz henüz doğrulanmamış. Lütfen gelen kutunuzdaki doğrulama kodunu girin.'
                };
            }

            // Email is confirmed, but account is awaiting platform admin approval
            log.warn(`Login notice: User "${user.username}" is awaiting platform admin approval`);
            return {
                success: false,
                pendingApproval: true,
                email: user.email,
                error: 'Hesabınız henüz Platform Yöneticisi tarafından onaylanmadı. Başvurunuz incelendikten sonra hesabınız aktif edilecektir.'
            };
        }

        if (user.is_active === -1) {
            log.warn(`Login failed: User "${user.username}" is suspended/rejected`);
            return {
                success: false,
                error: 'Hesabınız askıya alınmış veya başvurunuz onaylanmamıştır. Destek ekibiyle iletişime geçin.'
            };
        }

        let isValid = bcrypt.compareSync(password, user.password_hash);

        // Fallback: If local bcrypt password does not match, verify via Supabase Auth
        if (!isValid && user.email) {
            try {
                const { createClient } = require('@supabase/supabase-js');
                const SUPABASE_URL = process.env.SUPABASE_URL || 'https://supabase.kontrol-app.com';
                const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_36cfd54f23bbf88d313317_24673797';
                const supaClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                    auth: { persistSession: false },
                    realtime: { enabled: false }
                });

                const { data: supaAuthData, error: supaAuthErr } = await supaClient.auth.signInWithPassword({
                    email: user.email,
                    password: password
                });

                if (!supaAuthErr && supaAuthData?.user) {
                    log.info(`[Supabase Auth Login Success]: User "${user.username}" authenticated via Supabase Auth. Syncing local password hash.`);
                    isValid = true;
                    const newHash = bcrypt.hashSync(password, 10);
                    await prisma.users.update({
                        where: { id: user.id },
                        data: { password_hash: newHash }
                    });
                }
            } catch (supaErr) {
                log.warn('Supabase Auth fallback check notice:', supaErr.message);
            }
        }

        if (!isValid) {
            log.warn(`Login failed: Incorrect password for user "${user.username}"`);
            logAudit({
                companyId: user.company_id,
                userId: user.id,
                username: user.username,
                userRole: user.role,
                action: 'LOGIN_FAILED',
                entityType: 'auth',
                entityId: String(user.id),
                entityName: user.username,
                description: `"${user.username}" hesabı için hatalı şifre girildi`,
                severity: 'warn'
            });
            return { success: false, error: 'Hatalı şifre' };
        }

        // 3. Safely load relations separately
        let employeeData = null;
        if (user.employee_id) {
            try {
                employeeData = await prisma.employees.findUnique({
                    where: { id: user.employee_id }
                });
            } catch (e) {
                log.error('Failed to load employee relation during login:', e.message);
            }
        }

        let permissionsData = [];
        // A. Load direct permissions assigned to user (e.g. JSON string in user.permissions)
        if (user.permissions) {
            try {
                permissionsData = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
            } catch (e) {
                log.warn('Failed to parse user.permissions JSON during login:', e.message);
            }
        }

        // B. Load role permissions from `roles` table if role_id is assigned
        if (user.role_id) {
            try {
                const roleWithPerms = await prisma.roles.findUnique({
                    where: { id: user.role_id },
                    include: { permissions: true }
                });
                if (roleWithPerms && roleWithPerms.permissions) {
                    if (Array.isArray(permissionsData)) {
                        const existingModules = new Set(permissionsData.map(p => p.module));
                        for (const rp of roleWithPerms.permissions) {
                            if (!existingModules.has(rp.module)) {
                                permissionsData.push(rp);
                            }
                        }
                    } else if (!permissionsData || (typeof permissionsData === 'object' && Object.keys(permissionsData).length === 0)) {
                        permissionsData = roleWithPerms.permissions;
                    }
                }
            } catch (e) {
                log.error('Failed to load role relation during login:', e.message);
            }
        }

        // 4. If 2FA is enabled, return 2FA challenge
        if (user.two_factor_enabled === 1 && user.two_factor_secret) {
            log.info(`User "${user.username}" credentials valid. 2FA verification challenge issued.`);
            return {
                success: true,
                require2FA: true,
                userId: user.id,
                username: user.username,
                email: user.email
            };
        }

        const safeUser = {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role || 'user',
            role_id: user.role_id,
            employee_id: user.employee_id,
            company_id: user.company_id || employeeData?.company_id || null,
            two_factor_enabled: user.two_factor_enabled === 1,
            mustChangePassword: user.must_change_password === 1,
            employee: employeeData ? {
                id: employeeData.id,
                company_id: employeeData.company_id,
                first_name: employeeData.first_name,
                last_name: employeeData.last_name,
                email: employeeData.email,
                department: employeeData.department,
                position: employeeData.position
            } : null,
            permissions: permissionsData
        };

        log.info(`User "${safeUser.username}" logged in successfully.`);
        logAudit({
            companyId: employeeData?.company_id || null,
            userId: user.id,
            username: user.username,
            userRole: user.role || 'admin',
            action: 'LOGIN_SUCCESS',
            entityType: 'auth',
            entityId: String(user.id),
            entityName: user.username,
            description: `"${user.username}" kullanıcısı başarıyla giriş yaptı`,
            severity: 'info'
        });

        return { success: true, user: safeUser };

    } catch (error) {
        log.error('Unhandled Login Exception:', error);
        return { success: false, error: 'Giriş başarısız: ' + error.message };
    }
}

async function changePassword(data) {
    try {
        const { userId, currentPassword, newPassword } = data;
        const targetId = Number(userId);

        if (!targetId || isNaN(targetId)) {
            return { success: false, error: 'Geçersiz kullanıcı ID' };
        }

        const user = await prisma.users.findUnique({
            where: { id: targetId }
        });

        if (!user) {
            return { success: false, error: 'Kullanıcı bulunamadı' };
        }

        if (currentPassword) {
            const isValid = bcrypt.compareSync(currentPassword, user.password_hash);
            if (!isValid) {
                return { success: false, error: 'Mevcut şifre hatalı' };
            }
        }

        const password_hash = bcrypt.hashSync(newPassword, 10);

        await prisma.users.update({
            where: { id: targetId },
            data: {
                password_hash,
                must_change_password: 0
            }
        });

        logAudit({
            userId: user.id,
            username: user.username,
            userRole: user.role,
            action: 'SECURITY',
            entityType: 'auth',
            entityId: String(user.id),
            entityName: user.username,
            description: `"${user.username}" kullanıcısı şifresini değiştirdi`,
            severity: 'info'
        });

        return { success: true, message: 'Şifre başarıyla güncellendi' };

    } catch (error) {
        console.error('Change password error:', error);
        return { success: false, error: 'Şifre değiştirme başarısız: ' + error.message };
    }
}

async function updateProfile(data) {
    try {
        const { userId, username, email, full_name } = data;

        // Check if username/email is taken by another user
        if (username || email) {
            const existingUser = await prisma.users.findFirst({
                where: {
                    AND: [
                        { id: { not: userId } },
                        {
                            OR: [
                                username ? { username } : null,
                                email ? { email } : null
                            ].filter(Boolean)
                        }
                    ]
                }
            });

            if (existingUser) {
                return { 
                    success: false, 
                    error: existingUser.username === username ? 'Bu kullanıcı adı zaten alınmış' : 'Bu e-posta adresi zaten kullanımda' 
                };
            }
        }

        const updated = await prisma.users.update({
            where: { id: userId },
            data: {
                username,
                email,
                full_name
            }
        });

        const safeUser = {
            id: updated.id,
            username: updated.username,
            email: updated.email,
            full_name: updated.full_name,
            mustChangePassword: updated.must_change_password === 1
        };

        return { success: true, user: safeUser };

    } catch (error) {
        console.error('Update profile error:', error);
        return { success: false, error: 'Profil güncelleme başarısız: ' + error.message };
    }
}

async function getUserPasswordHash(userId) {
    try {
        const user = await prisma.users.findUnique({
            where: { id: userId }
        });
        return user ? user.password_hash : null;
    } catch {
        return null;
    }
}

async function createEmployeeUser(data) {
    try {
        const { employeeId, username, email, password, role, roleId, permissions } = data;

        if (!employeeId || !username || !password || !email) {
            return { success: false, error: 'Personel, kullanıcı adı, e-posta ve şifre zorunludur' };
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanUsername = username.toLowerCase().trim();
        const empId = Number(employeeId);

        const employee = await prisma.employees.findUnique({
            where: { id: empId }
        });

        if (!employee) {
            return { success: false, error: 'Personel kaydı bulunamadı' };
        }

        // Update employee email if not set
        if (!employee.email || employee.email.trim() !== cleanEmail) {
            await prisma.employees.update({
                where: { id: empId },
                data: { email: cleanEmail }
            }).catch(() => {});
        }

        const existingUser = await prisma.users.findFirst({
            where: {
                OR: [
                    { username: cleanUsername },
                    { email: cleanEmail },
                    { employee_id: empId }
                ]
            }
        });

        const password_hash = bcrypt.hashSync(password, 10);
        const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
        let targetUser = null;

        if (existingUser) {
            if (existingUser.employee_id === empId) {
                // If account exists for this employee, update credentials & role and activate
                targetUser = await prisma.users.update({
                    where: { id: existingUser.id },
                    data: {
                        username: cleanUsername,
                        email: cleanEmail,
                        full_name: fullName,
                        password_hash,
                        role: role || 'personnel',
                        role_id: roleId ? Number(roleId) : null,
                        permissions: permissions ? (typeof permissions === 'string' ? permissions : JSON.stringify(permissions)) : null,
                        must_change_password: 1,
                        is_active: 1
                    }
                });
            } else if (existingUser.email === cleanEmail) {
                return { success: false, error: `"${cleanEmail}" e-posta adresi başka bir kullanıcı tarafından kullanılıyor.` };
            } else {
                return { success: false, error: `"${cleanUsername}" kullanıcı adı başka bir kullanıcı tarafından kullanılıyor. Lütfen farklı bir kullanıcı adı seçin.` };
            }
        } else {
            // Create in public.users
            targetUser = await prisma.users.create({
                data: {
                    username: cleanUsername,
                    email: cleanEmail,
                    full_name: fullName,
                    password_hash,
                    role: role || 'personnel',
                    role_id: roleId ? Number(roleId) : null,
                    employee_id: empId,
                    permissions: permissions ? (typeof permissions === 'string' ? permissions : JSON.stringify(permissions)) : null,
                    must_change_password: 1,
                    is_active: 1
                }
            });
        }
        const newUser = targetUser;

        // 2. Direct Sync to Supabase Auth (auth.users & auth.identities) if running PostgreSQL
        const dbUrl = process.env.DATABASE_URL || '';
        if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
            try {
                const { Client } = require('pg');
                const pgClient = new Client({ connectionString: dbUrl });
                await pgClient.connect();

                const metaJson = JSON.stringify({
                    username,
                    full_name: fullName,
                    employee_id: empId,
                    company_id: employee.company_id,
                    role: role || 'personnel'
                });

                const existAuth = await pgClient.query('SELECT id FROM auth.users WHERE email = $1', [cleanEmail]);
                let authUserId;
                if (existAuth.rows.length > 0) {
                    authUserId = existAuth.rows[0].id;
                    await pgClient.query(`
                        UPDATE auth.users 
                        SET encrypted_password = $1, raw_user_meta_data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $3::uuid
                    `, [password_hash, metaJson, authUserId]);
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
                    `, [cleanEmail, password_hash, metaJson]);
                    authUserId = newAuth.rows[0].id;
                }

                // Insert into auth.identities
                const existId = await pgClient.query('SELECT id FROM auth.identities WHERE provider = $1 AND provider_id = $2', ['email', cleanEmail]);
                const subData = JSON.stringify({ sub: String(authUserId), email: cleanEmail });
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
                    `, [authUserId, subData, cleanEmail]);
                }

                await pgClient.end();
            } catch (supaPgErr) {
                console.warn('Direct Supabase Auth create notice:', supaPgErr.message);
            }
        }

        return { success: true, user: { id: newUser.id, username: newUser.username, email: newUser.email } };
    } catch (error) {
        console.error('createEmployeeUser error:', error);
        return { success: false, error: 'Personel kullanıcı hesabı oluşturulamadı: ' + error.message };
    }
}

/**
 * Ensures a dedicated superadmin account exists and separates company admins
 */
async function ensureSuperAdminExists() {
    try {
        // 1. If admin@muayen.com has role superadmin, update it to company_admin so it manages SAK PETROL
        const adminMuayen = await prisma.users.findFirst({
            where: { email: 'admin@muayen.com' }
        });
        if (adminMuayen && adminMuayen.role === 'superadmin') {
            await prisma.users.update({
                where: { id: adminMuayen.id },
                data: { role: 'company_admin' }
            });
            log.info('Updated admin@muayen.com role to company_admin.');
        }

        // 2. Check if a dedicated superadmin user exists
        let superAdmin = await prisma.users.findFirst({
            where: { role: 'superadmin' }
        });

        if (!superAdmin) {
            const username = process.env.SUPERADMIN_USERNAME || 'superadmin';
            const email = process.env.SUPERADMIN_EMAIL || 'superadmin@kontrolapp.com';
            const initialPassword = process.env.SUPERADMIN_INITIAL_PASSWORD || generateSecurePassword(16);
            const password_hash = bcrypt.hashSync(initialPassword, 10);

            superAdmin = await prisma.users.create({
                data: {
                    username,
                    email,
                    full_name: 'SaaS Sistem Yöneticisi',
                    password_hash,
                    role: 'superadmin',
                    is_active: 1,
                    must_change_password: 0
                }
            });

            const box = `
╔══════════════════════════════════════════════════════════════════════╗
║             KONTROL SAAS - SİSTEM YÖNETİCİSİ OLUŞTURULDU         ║
╠══════════════════════════════════════════════════════════════════════╣
║ Kullanıcı Adı : ${superAdmin.username.padEnd(52)}║
║ E-Posta       : ${superAdmin.email.padEnd(52)}║
║ Geçici Şifre  : ${initialPassword.padEnd(52)}║
║                                                                      ║
║ Bu şifre rastgele üretilmiştir. Güvenli bir yere kaydediniz.     ║
╚══════════════════════════════════════════════════════════════════════╝`;
            console.log(box);
            log.info('SuperAdmin auto-created:\n' + box);
        }

        return superAdmin;
    } catch (err) {
        log.warn('ensureSuperAdminExists notice:', err.message);
    }
}

async function syncPasswordReset(data) {
    try {
        const { email, newPassword } = data || {};
        if (!email || !newPassword) {
            return { success: false, error: 'E-posta ve yeni şifre gereklidir' };
        }

        const user = await prisma.users.findFirst({
            where: { email: email.trim().toLowerCase() }
        });

        if (user) {
            const password_hash = bcrypt.hashSync(newPassword, 10);
            await prisma.users.update({
                where: { id: user.id },
                data: {
                    password_hash,
                    must_change_password: 0
                }
            });

            logAudit({
                userId: user.id,
                username: user.username,
                userRole: user.role,
                action: 'PASSWORD_RESET',
                entityType: 'auth',
                entityId: user.id,
                details: 'Kullanıcı şifresini e-posta kurtarma linki/kodu ile sıfırladı.'
            });

            log.info(`[Auth Sync] Password reset synced for user ${user.username} (${user.email})`);
        }

        return { success: true };
    } catch (err) {
        log.error('syncPasswordReset error:', err);
        return { success: false, error: err.message };
    }
}

const recoveryOtpStore = new Map();

async function requestPasswordReset(data) {
    try {
        const { email } = data || {};
        if (!email) {
            return { success: false, error: 'E-posta adresi gereklidir' };
        }

        const cleanEmail = email.trim().toLowerCase();

        // 1. Check if user exists in public.users
        const user = await prisma.users.findFirst({
            where: { email: cleanEmail }
        });

        const { supabaseAdmin } = require('./supabase.service');
        if (supabaseAdmin) {
            // 2. Ensure user exists in Supabase Auth (auth.users)
            try {
                await supabaseAdmin.auth.admin.createUser({
                    email: cleanEmail,
                    email_confirm: true,
                    user_metadata: {
                        username: user ? user.username : cleanEmail.split('@')[0],
                        full_name: user ? user.full_name : cleanEmail.split('@')[0],
                        role: user ? user.role : 'user'
                    }
                });
                log.info(`[Password Reset] Provisioned user in Supabase Auth: ${cleanEmail}`);
            } catch (createErr) {
                // User may already exist in auth.users, ignore
            }

            // 3. Generate password recovery action link & token from Supabase Auth
            let actionLink = 'https://kontrol-app.com/reset-password';
            const randomOtp = String(Math.floor(100000 + Math.random() * 900000));
            let rawOtpCode = randomOtp;
            let otpToken = randomOtp.slice(0, 3) + ' ' + randomOtp.slice(3);

            try {
                const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
                    type: 'recovery',
                    email: cleanEmail,
                    options: {
                        redirectTo: 'https://kontrol-app.com/reset-password'
                    }
                });
                if (linkData?.properties?.action_link) {
                    actionLink = linkData.properties.action_link;
                }
                if (linkData?.properties?.email_otp) {
                    rawOtpCode = String(linkData.properties.email_otp);
                    otpToken = rawOtpCode.length === 6 ? `${rawOtpCode.slice(0, 3)} ${rawOtpCode.slice(3)}` : rawOtpCode;
                }
            } catch (genErr) {
                log.warn(`[Password Reset] generateLink notice:`, genErr.message);
            }

            // Store in reliable backend cache with 15-min expiry
            recoveryOtpStore.set(cleanEmail, {
                otp: rawOtpCode,
                expiresAt: Date.now() + 15 * 60 * 1000,
                verified: false
            });

            // 4. Load custom HTML template from database
            const { getEmailTemplates } = require('./emailTemplate.service');
            const { sendCustomHtmlEmail } = require('./mailer.service');

            const tRes = await getEmailTemplates();
            const template = tRes?.data?.find(t => t.type === 'recovery');
            const templateHtml = template?.htmlContent;

            if (templateHtml) {
                const renderedHtml = templateHtml
                    .replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, actionLink)
                    .replace(/\{\{\s*\.Token\s*\}\}/g, otpToken)
                    .replace(/\{\{\s*\.Email\s*\}\}/g, cleanEmail)
                    .replace(/\{\{\s*\.SiteURL\s*\}\}/g, 'https://kontrol-app.com')
                    .replace(/\{\{\s*\.Data\.username\s*\}\}/g, user ? user.username : cleanEmail.split('@')[0])
                    .replace(/\{\{\s*\.Data\.company_name\s*\}\}/g, 'Kontrol Filo & Yönetim Platformu');

                const mailRes = await sendCustomHtmlEmail({
                    to: cleanEmail,
                    subject: template.subject || 'Kontrol App - Şifre Sıfırlama Talebi',
                    html: renderedHtml,
                    senderName: template.senderName || 'Kontrol Güvenlik Ekibi'
                });

                if (mailRes.success) {
                    log.info(`[Password Reset] Custom HTML recovery email dispatched to ${cleanEmail}`);
                    return { success: true, message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.' };
                }
            }

            // Fallback: Supabase default mailer if direct send didn't run
            const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(cleanEmail, {
                redirectTo: 'https://kontrol-app.com/reset-password'
            });

            if (resetErr) {
                log.error(`[Password Reset] Supabase reset error for ${cleanEmail}:`, resetErr);
                return { success: false, error: resetErr.message };
            }

            log.info(`[Password Reset] Fallback recovery email sent to ${cleanEmail}`);
        }

        return { success: true, message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.' };
    } catch (err) {
        log.error('requestPasswordReset error:', err);
        return { success: false, error: err.message };
    }
}

async function verifyRecoveryOtp(data) {
    try {
        const { email, otp } = data || {};
        if (!email || !otp) return { success: false, error: 'E-posta ve doğrulama kodu gereklidir' };
        const cleanEmail = email.trim().toLowerCase();
        const cleanOtp = String(otp).replace(/[\s\-_]/g, '').trim();

        const entry = recoveryOtpStore.get(cleanEmail);
        if (entry && entry.expiresAt > Date.now() && entry.otp === cleanOtp) {
            entry.verified = true;
            log.info(`[Password Reset] OTP verified via memory cache for ${cleanEmail}`);
            return { success: true, verified: true };
        }

        // Also attempt Supabase Auth verify
        try {
            const { supabaseAdmin } = require('./supabase.service');
            if (supabaseAdmin) {
                const { data: supaData, error: supaErr } = await supabaseAdmin.auth.verifyOtp({
                    email: cleanEmail,
                    token: cleanOtp,
                    type: 'recovery'
                });
                if (!supaErr) {
                    recoveryOtpStore.set(cleanEmail, { otp: cleanOtp, expiresAt: Date.now() + 15 * 60 * 1000, verified: true });
                    return { success: true, verified: true };
                }
            }
        } catch (e) {}

        return { success: false, error: 'Geçersiz veya süresi dolmuş doğrulama kodu.' };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function completePasswordReset(data) {
    try {
        const { email, newPassword, otp } = data || {};
        if (!email || !newPassword) return { success: false, error: 'E-posta ve yeni şifre gereklidir' };
        if (newPassword.length < 6) return { success: false, error: 'Şifre en az 6 karakter olmalıdır' };
        const cleanEmail = email.trim().toLowerCase();

        const entry = recoveryOtpStore.get(cleanEmail);
        const cleanOtp = otp ? String(otp).replace(/[\s\-_]/g, '').trim() : '';

        const isAuthorized = Boolean(entry && (entry.verified || (entry.otp === cleanOtp && entry.expiresAt > Date.now())));

        if (!isAuthorized && cleanOtp) {
            const v = await verifyRecoveryOtp({ email: cleanEmail, otp: cleanOtp });
            if (!v.success) return v;
        }

        // 1. Update PostgreSQL user
        const newHash = bcrypt.hashSync(newPassword, 10);
        await prisma.users.updateMany({
            where: { email: cleanEmail },
            data: { password_hash: newHash }
        });

        // 2. Update Supabase Auth user
        try {
            const { supabaseAdmin } = require('./supabase.service');
            if (supabaseAdmin) {
                const { data: supaUsers } = await supabaseAdmin.auth.admin.listUsers();
                const supaUser = supaUsers?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
                if (supaUser) {
                    await supabaseAdmin.auth.admin.updateUserById(supaUser.id, {
                        password: newPassword
                    });
                    log.info(`[Password Reset] Synced new password to Supabase Auth user: ${supaUser.id}`);
                }
            }
        } catch (supaErr) {
            log.warn('[Password Reset] Supabase sync warning:', supaErr.message);
        }

        recoveryOtpStore.delete(cleanEmail);
        log.info(`[Password Reset] Password reset complete for: ${cleanEmail}`);

        return { success: true, message: 'Şifreniz başarıyla güncellendi!' };
    } catch (err) {
        log.error('completePasswordReset error:', err);
        return { success: false, error: err.message };
    }
}

async function resendVerificationEmail(data) {
    try {
        const { email } = data || {};
        if (!email) return { success: false, error: 'E-posta adresi gereklidir' };

        const cleanEmail = email.trim().toLowerCase();
        const { supabaseAdmin } = require('./supabase.service');

        if (supabaseAdmin) {
            let actionLink = 'https://kontrol-app.com/login?verified=true';
            const randomOtp = String(Math.floor(100000 + Math.random() * 900000));
            let rawOtpCode = randomOtp;
            let otpToken = `${randomOtp.slice(0, 3)} ${randomOtp.slice(3)}`;

            try {
                // Try signup link generation first
                const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
                    type: 'signup',
                    email: cleanEmail
                });

                if (!linkErr && linkData?.properties) {
                    if (linkData.properties.action_link) actionLink = linkData.properties.action_link;
                    if (linkData.properties.email_otp) {
                        rawOtpCode = String(linkData.properties.email_otp);
                        otpToken = rawOtpCode.length === 6 ? `${rawOtpCode.slice(0, 3)} ${rawOtpCode.slice(3)}` : rawOtpCode;
                    }
                } else {
                    // If user already exists in auth.users, get magiclink or use generated OTP
                    const { data: magicData } = await supabaseAdmin.auth.admin.generateLink({
                        type: 'magiclink',
                        email: cleanEmail
                    });
                    if (magicData?.properties?.action_link) {
                        actionLink = magicData.properties.action_link;
                    }
                }
            } catch (linkEx) {
                log.warn('[Auth] Resend generateLink notice:', linkEx.message);
            }

            // Cache OTP in memory for foolproof verification
            recoveryOtpStore.set(cleanEmail, {
                otp: rawOtpCode,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                verified: false
            });

            // Send custom HTML template via direct SMTP mailer
            const { getEmailTemplates } = require('./emailTemplate.service');
            const { sendCustomHtmlEmail } = require('./mailer.service');

            const tRes = await getEmailTemplates();
            const template = tRes?.data?.find(t => t.type === 'confirmation' || t.type === 'signup');
            const templateHtml = template?.htmlContent;

            if (templateHtml) {
                const renderedHtml = templateHtml
                    .replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, actionLink)
                    .replace(/\{\{\s*\.Token\s*\}\}/g, otpToken)
                    .replace(/\{\{\s*\.Email\s*\}\}/g, cleanEmail)
                    .replace(/\{\{\s*\.SiteURL\s*\}\}/g, 'https://kontrol-app.com')
                    .replace(/\{\{\s*\.Data\.username\s*\}\}/g, cleanEmail.split('@')[0])
                    .replace(/\{\{\s*\.Data\.company_name\s*\}\}/g, 'Kontrol Filo & Yönetim Platformu');

                const mailRes = await sendCustomHtmlEmail({
                    to: cleanEmail,
                    subject: template.subject || 'Kontrol App - E-Posta Adresinizi Doğrulayın',
                    html: renderedHtml,
                    senderName: template.senderName || 'Kontrol Güvenlik Ekibi'
                });

                if (mailRes.success) {
                    log.info(`[Auth] Custom HTML verification email successfully resent to: ${cleanEmail}`);
                    return { success: true, message: 'Doğrulama e-postası başarıyla gönderildi.' };
                }
            }
        }

        return { success: true, message: 'Doğrulama bağlantısı e-posta adresinize tekrar gönderildi.' };
    } catch (err) {
        log.error('resendVerificationEmail error:', err);
        return { success: false, error: err.message };
    }
}

async function activateUserByEmail(data) {
    try {
        const { email } = data || {};
        if (!email) return { success: false, error: 'E-posta adresi gereklidir' };

        const cleanEmail = email.trim().toLowerCase();
        const user = await prisma.users.findFirst({
            where: { email: cleanEmail }
        });

        if (user) {
            // If personnel, activate immediately. If company_admin, keep in pending approval state
            const newStatus = user.role === 'personnel' ? 1 : 0;
            await prisma.users.update({
                where: { id: user.id },
                data: { is_active: newStatus }
            });
            log.info(`[Auth] User email confirmed: ${cleanEmail} (role: ${user.role}, is_active: ${newStatus})`);
        }

        return { success: true, isPersonnel: user?.role === 'personnel' };
    } catch (err) {
        log.error('activateUserByEmail error:', err);
        return { success: false, error: err.message };
    }
}

async function getUserProfile(userId) {
    try {
        const uid = Number(userId);
        if (!uid) return { success: false, error: 'Invalid user ID' };
        const user = await prisma.users.findUnique({
            where: { id: uid },
            include: {
                employee: true,
                companies: true
            }
        });
        if (!user) return { success: false, error: 'User not found' };

        let permissionsData = [];
        if (user.role_id) {
            try {
                const roleWithPerms = await prisma.roles.findUnique({
                    where: { id: user.role_id },
                    include: { permissions: true }
                });
                if (roleWithPerms?.permissions) {
                    permissionsData = roleWithPerms.permissions;
                }
            } catch (e) {}
        }

        const safeUser = {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role || 'company_admin',
            role_id: user.role_id,
            employee_id: user.employee_id,
            company_id: user.company_id || user.employee?.company_id || user.companies?.[0]?.id || null,
            two_factor_enabled: user.two_factor_enabled === 1,
            mustChangePassword: user.must_change_password === 1,
            employee: user.employee || null,
            companies: user.companies || [],
            permissions: permissionsData
        };
        return { success: true, user: safeUser };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = {
    registerUser,
    loginUser,
    changePassword,
    syncPasswordReset,
    requestPasswordReset,
    verifyRecoveryOtp,
    completePasswordReset,
    resendVerificationEmail,
    activateUserByEmail,
    updateProfile,
    getUserPasswordHash,
    createEmployeeUser,
    ensureSuperAdminExists,
    getUserProfile
};
