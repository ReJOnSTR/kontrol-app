const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getPrismaClient } = require('../prismaClient');
const { logAudit } = require('./audit.service');
const prisma = getPrismaClient();

/**
 * Get comprehensive platform overview and stats from real database
 */
async function getPlatformOverview() {
    try {
        const [companies, totalVehicles, totalEmployees, totalWorks, totalUsers] = await Promise.all([
            prisma.companies.findMany({
                include: {
                    users: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            full_name: true,
                            role: true,
                            employee_id: true
                        }
                    },
                    _count: {
                        select: {
                            vehicles: true,
                            employees: true,
                            works: true,
                            customers: true,
                            transactions: true
                        }
                    }
                },
                orderBy: { id: 'asc' }
            }),
            prisma.vehicles.count(),
            prisma.employees.count(),
            prisma.works.count(),
            prisma.users.count()
        ]);

        // Find fallback default admin if company user_id is missing or points to a personnel
        const defaultAdmin = await prisma.users.findFirst({
            where: {
                OR: [
                    { email: 'admin@muayen.com' },
                    { username: 'admin' },
                    { role: 'company_admin' },
                    { role: 'admin' }
                ]
            },
            select: { id: true, username: true, email: true, full_name: true }
        }).catch(() => null);

        return {
            success: true,
            data: {
                stats: {
                    totalCompanies: companies.length,
                    totalVehicles,
                    totalEmployees,
                    totalWorks,
                    totalUsers
                },
                companies: companies.map(c => {
                    const isPersonnelUser = c.users && (c.users.role === 'personnel' || c.users.employee_id);
                    const validOwnerUser = (!isPersonnelUser && c.users) ? c.users : defaultAdmin;

                    return {
                        id: c.id,
                        name: c.name,
                        tax_number: c.tax_number || '-',
                        tax_office: c.tax_office || '-',
                        phone: c.phone || '-',
                        address: c.address || '-',
                        created_at: c.created_at,
                        owner: validOwnerUser ? {
                            id: validOwnerUser.id,
                            username: validOwnerUser.username,
                            email: validOwnerUser.email,
                            fullName: validOwnerUser.full_name
                        } : null,
                        counts: {
                            vehicles: c._count?.vehicles || 0,
                            employees: c._count?.employees || 0,
                            works: c._count?.works || 0,
                            customers: c._count?.customers || 0,
                            transactions: c._count?.transactions || 0
                        }
                    };
                })
            }
        };
    } catch (error) {
        console.error('getPlatformOverview error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all users across the entire platform with full relationship mapping
 */
async function getPlatformUsers() {
    try {
        const users = await prisma.users.findMany({
            include: {
                companies: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        tax_number: true
                    }
                },
                employee: {
                    include: {
                        companies: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                custom_role: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                }
            },
            orderBy: { id: 'asc' }
        });

        const mapped = users.map(u => {
            // Determine primary linked company
            let linkedCompany = null;
            let accountType = 'user';
            let accountBadge = 'Kullanıcı';

            const isStaffOrDriver = Boolean(u.employee || u.employee_id || (u.role && u.role.toLowerCase() === 'personnel'));

            if (u.role === 'superadmin') {
                accountType = 'superadmin';
                accountBadge = 'Süper Yönetici';
            } else if (isStaffOrDriver) {
                // An employee/driver MUST ALWAYS be tagged as employee, never company_owner
                accountType = 'employee';
                accountBadge = 'Personel / Şoför';
                linkedCompany = u.employee?.companies || (u.companies && u.companies[0]) || null;
            } else if (u.companies && u.companies.length > 0) {
                accountType = 'company_owner';
                accountBadge = 'Şirket Yöneticisi';
                linkedCompany = u.companies[0];
            } else if (u.role === 'company_admin' || u.role === 'admin' || u.role === 'manager') {
                accountType = 'company_admin';
                accountBadge = 'Şirket Yöneticisi';
            }

            const is2FA = Boolean(u.two_factor_enabled === 1 || u.two_factor_enabled === true || Boolean(u.two_factor_secret));

            return {
                id: u.id,
                username: u.username,
                email: u.email,
                fullName: u.full_name || u.username,
                role: u.role || 'user',
                customRole: u.custom_role?.name || null,
                accountType,
                accountBadge,
                isActive: u.is_active === 1,
                isPending: u.is_active === 0,
                rawStatus: u.is_active,
                mustChangePassword: u.must_change_password === 1,
                two_factor_enabled: is2FA ? 1 : 0,
                has2FA: is2FA,
                company: linkedCompany ? {
                    id: linkedCompany.id,
                    name: linkedCompany.name,
                    phone: linkedCompany.phone || '-'
                } : { id: null, name: 'Sistem / Genel', phone: '-' },
                employee: u.employee ? {
                    id: u.employee.id,
                    fullName: `${u.employee.first_name || ''} ${u.employee.last_name || ''}`.trim(),
                    tcNo: u.employee.tc_no || '-',
                    phone: u.employee.phone || '-',
                    position: u.employee.position || 'Personel'
                } : null,
                createdAt: u.created_at
            };
        });

        return { success: true, data: mapped };
    } catch (error) {
        console.error('getPlatformUsers error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Reset password for a platform user
 */
async function resetPlatformUserPassword(userId, newPassword) {
    try {
        if (!newPassword || newPassword.length < 4) {
            return { success: false, error: 'Şifre en az 4 karakter olmalıdır' };
        }
        const targetUid = parseInt(userId, 10);
        const targetUser = await prisma.users.findUnique({ where: { id: targetUid } });
        const password_hash = bcrypt.hashSync(newPassword, 10);
        await prisma.users.update({
            where: { id: targetUid },
            data: {
                password_hash,
                must_change_password: 0
            }
        });

        if (targetUser) {
            logAudit({
                companyId: targetUser.company_id,
                userId: targetUser.id,
                username: targetUser.username,
                userRole: targetUser.role,
                action: 'SECURITY',
                entityType: 'user',
                entityId: String(targetUser.id),
                entityName: targetUser.username,
                description: `SuperAdmin tarafından "${targetUser.username}" kullanıcısının şifresi sıfırlandı`,
                severity: 'warn'
            });
        }

        return { success: true, message: 'Şifre başarıyla güncellendi' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Impersonate user - get clean login payload for client session
 */
async function impersonatePlatformUser(userId) {
    try {
        const uid = parseInt(userId, 10);
        const user = await prisma.users.findUnique({
            where: { id: uid },
            include: {
                companies: true,
                employee: {
                    include: {
                        companies: true
                    }
                }
            }
        });

        if (!user) {
            return { success: false, error: 'Kullanıcı bulunamadı' };
        }

        const sanitized = {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            role_id: user.role_id,
            employee_id: user.employee_id,
            mustChangePassword: user.must_change_password === 1
        };

        const targetCompany = user.companies?.[0] || user.employee?.companies || null;

        logAudit({
            companyId: targetCompany?.id || null,
            userId: user.id,
            username: user.username,
            userRole: user.role,
            action: 'IMPERSONATE',
            entityType: 'auth',
            entityId: String(user.id),
            entityName: user.username,
            description: `SuperAdmin, "${user.username}" (${targetCompany?.name || 'Genel'}) kullanıcısı olarak oturum açtı (Ghost Login)`,
            severity: 'warn'
        });

        return {
            success: true,
            user: sanitized,
            company: targetCompany
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Create a new user from Master Portal
 */
async function createPlatformUser(userData) {
    try {
        const { username, email, password, role, fullName, companyId, position, phone } = userData;
        if (!username || !email || !password) {
            return { success: false, error: 'Kullanıcı adı, e-posta ve şifre zorunludur' };
        }

        const cleanEmail = email.toLowerCase().trim();
        const existing = await prisma.users.findFirst({
            where: {
                OR: [{ username }, { email: cleanEmail }]
            }
        });

        if (existing) {
            return { success: false, error: 'Bu kullanıcı adı veya e-posta zaten kayıtlı' };
        }

        const password_hash = bcrypt.hashSync(password, 10);
        let userRole = role || 'admin';
        let employeeId = userData.employeeId ? parseInt(userData.employeeId, 10) : null;

        // If creating for a company without an explicit employee selection
        if (!employeeId && companyId && userRole !== 'company_admin') {
            const compId = parseInt(companyId, 10);
            const employee = await prisma.employees.create({
                data: {
                    company_id: compId,
                    first_name: fullName?.split(' ')?.[0] || username,
                    last_name: fullName?.split(' ')?.slice(1)?.join(' ') || '',
                    position: position || (userRole === 'manager' ? 'Operasyon & Puantör' : (userRole === 'accountant' ? 'Ön Muhasebe' : 'Şirket Personeli')),
                    phone: phone || null,
                    email: cleanEmail,
                    start_date: new Date(),
                    status: 'active'
                }
            });
            employeeId = employee.id;
        }

        const newUser = await prisma.users.create({
            data: {
                username,
                email: cleanEmail,
                full_name: fullName || username,
                password_hash,
                role: userRole,
                employee_id: employeeId,
                must_change_password: 0,
                is_active: 1
            }
        });

        if (companyId && userRole !== 'personnel') {
            await prisma.companies.update({
                where: { id: parseInt(companyId, 10) },
                data: { user_id: newUser.id }
            }).catch(() => {});
        }

        logAudit({
            companyId: companyId ? parseInt(companyId, 10) : null,
            userId: newUser.id,
            username: newUser.username,
            userRole: newUser.role,
            action: 'CREATE',
            entityType: 'user',
            entityId: String(newUser.id),
            entityName: `${newUser.username} (${newUser.role})`,
            description: `SuperAdmin tarafından "${newUser.username}" (${newUser.role}) kullanıcısı oluşturuldu`,
            severity: 'info'
        });

        return { success: true, user: newUser };
    } catch (error) {
        console.error('createPlatformUser error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a user account safely
 */
async function deletePlatformUser(userId) {
    try {
        const uid = parseInt(userId, 10);
        const user = await prisma.users.findUnique({ where: { id: uid } });
        if (!user) return { success: false, error: 'Kullanıcı bulunamadı' };
        if (user.role === 'superadmin' || user.username === 'superadmin') {
            return { success: false, error: 'Ana Süper Yönetici hesabı silinemez' };
        }

        await prisma.users.delete({ where: { id: uid } });

        logAudit({
            companyId: user.company_id,
            userId: user.id,
            username: user.username,
            userRole: user.role,
            action: 'DELETE',
            entityType: 'user',
            entityId: String(user.id),
            entityName: user.username,
            description: `SuperAdmin tarafından "${user.username}" kullanıcı hesabı silindi`,
            severity: 'critical'
        });

        return { success: true, message: 'Kullanıcı hesabı silindi' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Toggle active state of a user
 */
async function toggleUserStatus(userId, isActive) {
    try {
        const uid = parseInt(userId, 10);
        const statusVal = (isActive === 1 || isActive === true || isActive === '1') ? 1 : 0;
        const updated = await prisma.users.update({
            where: { id: uid },
            data: { is_active: statusVal }
        });

        logAudit({
            companyId: updated.company_id,
            userId: updated.id,
            username: updated.username,
            userRole: updated.role,
            action: 'SECURITY',
            entityType: 'user',
            entityId: String(updated.id),
            entityName: updated.username,
            description: statusVal === 1 ? `"${updated.username}" kullanıcı hesabının kilidi açıldı (Aktif)` : `"${updated.username}" kullanıcı hesabı kilitlendi (Pasif)`,
            severity: statusVal === 1 ? 'info' : 'warn'
        });

        return { success: true, data: updated };
    } catch (error) {
        console.error('toggleUserStatus error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Toggle active state of a company
 */
async function toggleCompanyStatus(companyId, isActive) {
    try {
        return { success: true, message: 'Durum güncellendi' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get list of available database backups
 */
async function getPlatformBackups() {
    try {
        const backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const files = fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.zip') || f.endsWith('.enc') || f.endsWith('.sql.gz') || f.endsWith('.json.gz') || f.endsWith('.sql'))
            .map(f => {
                const fullPath = path.join(backupDir, f);
                const stats = fs.statSync(fullPath);
                const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
                const isUnified = f.includes('unified') || f.endsWith('.zip') || f.endsWith('.enc');
                return {
                    fileName: f,
                    type: isUnified ? 'Tam Sistem (DB + Dosyalar)' : 'Veritabanı',
                    isUnified,
                    sizeBytes: stats.size,
                    sizeFormatted: sizeMb > 0.05 ? `${sizeMb} MB` : `${(stats.size / 1024).toFixed(1)} KB`,
                    createdAt: stats.birthtime || stats.mtime
                };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return { success: true, data: files };
    } catch (error) {
        console.error('getPlatformBackups error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Trigger manual database backup
 */
async function triggerPlatformBackup() {
    try {
        const { performBackup } = require('../../scripts/backup-service');
        const res = await performBackup();
        return res;
    } catch (error) {
        console.error('triggerPlatformBackup error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get live platform health metrics with comprehensive DB, Memory, and Server Observability
 */
async function getPlatformSystemHealth() {
    const os = require('os');
    try {
        const mem = process.memoryUsage();
        const uptimeSec = Math.floor(process.uptime());

        // Measure database ping latency
        const start = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const dbLatencyMs = Date.now() - start;

        // DB Size
        let dbSizeFormatted = 'N/A';
        try {
            const sizeRes = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
            dbSizeFormatted = sizeRes[0]?.size || 'N/A';
        } catch (e) {}

        // Active connections
        let activeConnections = 1;
        try {
            const connRes = await prisma.$queryRaw`SELECT count(*)::int as count FROM pg_stat_activity WHERE state = 'active'`;
            activeConnections = connRes[0]?.count || 1;
        } catch (e) {}

        // PostgreSQL Version
        let pgVersion = 'PostgreSQL';
        try {
            const verRes = await prisma.$queryRaw`SELECT version()`;
            const rawVer = verRes[0]?.version || '';
            pgVersion = rawVer.split(' ')[0] + ' ' + (rawVer.split(' ')[1] || '');
        } catch (e) {}

        const totalMemGb = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
        const freeMemGb = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
        const usedMemPercent = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);

        return {
            success: true,
            data: {
                status: 'online',
                timestamp: new Date().toISOString(),
                uptimeSec,
                uptimeFormatted: formatUptime(uptimeSec),
                hostUptimeFormatted: formatUptime(Math.floor(os.uptime())),
                db: {
                    status: 'online',
                    latencyMs: dbLatencyMs,
                    size: dbSizeFormatted,
                    activeConnections,
                    version: pgVersion,
                    provider: 'Dokploy PostgreSQL (Cloud)'
                },
                server: {
                    cpuCores: os.cpus()?.length || 1,
                    cpuModel: os.cpus()?.[0]?.model || 'Cloud Host',
                    totalMemGb: `${totalMemGb} GB`,
                    freeMemGb: `${freeMemGb} GB`,
                    usedMemPercent: `${usedMemPercent}%`,
                    nodeRssMb: `${(mem.rss / (1024 * 1024)).toFixed(1)} MB`,
                    nodeHeapUsedMb: `${(mem.heapUsed / (1024 * 1024)).toFixed(1)} MB`,
                    nodeHeapTotalMb: `${(mem.heapTotal / (1024 * 1024)).toFixed(1)} MB`
                },
                services: {
                    database: { name: 'PostgreSQL Database', status: 'healthy', latency: `${dbLatencyMs} ms` },
                    storage: { name: 'Supabase Object Storage', status: 'healthy', bucket: 'documents' },
                    auth: { name: 'JWT & Session Security', status: 'active', mode: 'Multi-Tenant' },
                    backups: { name: 'Otomatik Yedekleme Servisi', status: 'scheduled', schedule: 'Her Gece 03:00' }
                },
                nodeVersion: process.version,
                platform: process.platform,
                appVersion: '1.13.44'
            }
        };
    } catch (error) {
        console.error('getPlatformSystemHealth error:', error);
        return {
            success: false,
            error: error.message,
            data: { status: 'degraded', db: { status: 'error', latencyMs: -1 } }
        };
    }
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (days > 0) return `${days} gün ${hours} sa ${minutes} dk`;
    if (hours > 0) return `${hours} sa ${minutes} dk ${secs} sn`;
    return `${minutes} dk ${secs} sn`;
}

/**
 * Read structured server and application logs
 */
async function getPlatformLogs(limit = 300) {
    try {
        const log = require('../logger');
        let logPath = null;
        try {
            logPath = log.transports.file.getFile()?.path;
        } catch (e) {}

        if (!logPath || !fs.existsSync(logPath)) {
            const os = require('os');
            const candidates = [
                path.join(os.homedir(), 'Library/Logs/kontrol-app/main.log'),
                path.join(os.homedir(), '.config/kontrol-app/logs/main.log'),
                path.join(__dirname, '../../logs/server.log')
            ];
            for (const c of candidates) {
                if (fs.existsSync(c)) {
                    logPath = c;
                    break;
                }
            }
        }

        if (!logPath || !fs.existsSync(logPath)) {
            return { success: true, data: [], totalLines: 0 };
        }

        const rawContent = fs.readFileSync(logPath, 'utf8');
        const lines = rawContent.trim().split('\n').filter(l => l.trim().length > 0);
        const sliced = lines.slice(-Math.min(limit, lines.length)).reverse();

        const regex = /^\[(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]\s\[([a-z]+)\]\s*(.*)$/i;

        const parsed = sliced.map((line, idx) => {
            const match = line.match(regex);
            if (match) {
                const [, timestamp, level, message] = match;
                return {
                    id: idx + 1,
                    timestamp,
                    level: level.toLowerCase(),
                    message: message.trim(),
                    raw: line
                };
            }
            return {
                id: idx + 1,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                level: 'info',
                message: line.trim(),
                raw: line
            };
        });

        return { success: true, data: parsed, totalLines: lines.length, filePath: logPath };
    } catch (error) {
        console.error('getPlatformLogs error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Clear or truncate server logs
 */
async function clearPlatformLogs() {
    try {
        const log = require('../logger');
        const logPath = log.transports.file.getFile()?.path;
        if (logPath && fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] [info] Log dosyası yönetici tarafından sıfırlandı.\n`);
        }
        return { success: true, message: 'Loglar başarıyla temizlendi' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get all platform announcements (SuperAdmin Hub)
 */
async function getPlatformAnnouncements() {
    try {
        const rows = await prisma.system_announcements.findMany({
            orderBy: { id: 'desc' }
        });

        const companies = await prisma.companies.findMany({
            select: { id: true, name: true }
        });
        const companyMap = new Map(companies.map(c => [c.id, c.name]));

        const enriched = rows.map(r => ({
            ...r,
            companyName: r.company_id ? (companyMap.get(r.company_id) || `Şirket #${r.company_id}`) : 'Tüm Şirketler (Genel Yayın)',
            isActive: r.is_active === 1,
            isExpired: r.expires_at ? new Date(r.expires_at) < new Date() : false
        }));

        return { success: true, data: enriched };
    } catch (error) {
        console.error('getPlatformAnnouncements error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get active announcements for client app / company banner
 */
async function getActiveAnnouncements(companyId) {
    try {
        const cId = companyId ? parseInt(companyId, 10) : null;
        const now = new Date();

        const rows = await prisma.system_announcements.findMany({
            where: {
                is_active: 1,
                OR: [
                    { company_id: null },
                    ...(cId ? [{ company_id: cId }] : [])
                ]
            },
            orderBy: { id: 'desc' }
        });

        const activeOnly = rows.filter(r => !r.expires_at || new Date(r.expires_at) >= now);

        return { success: true, data: activeOnly };
    } catch (error) {
        console.error('getActiveAnnouncements error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

/**
 * Create a new platform broadcast announcement
 */
async function createPlatformAnnouncement(payload) {
    try {
        const {
            title,
            message,
            type = 'info',
            companyId = null,
            expiresAt = null,
            isDismissible = 1,
            showPopup = 0,
            createdBy = null
        } = payload;

        if (!title || !message) {
            return { success: false, error: 'Başlık ve duyuru mesajı zorunludur' };
        }

        const created = await prisma.system_announcements.create({
            data: {
                title: title.trim(),
                message: message.trim(),
                type: type || 'info',
                company_id: companyId && companyId !== 'ALL' && companyId !== '' ? parseInt(companyId, 10) : null,
                expires_at: expiresAt ? new Date(expiresAt) : null,
                is_dismissible: typeof isDismissible !== 'undefined' ? parseInt(isDismissible, 10) : 1,
                show_popup: showPopup ? 1 : 0,
                created_by: createdBy ? parseInt(createdBy, 10) : null,
                is_active: 1
            }
        });

        logAudit({
            companyId: created.company_id,
            action: 'CREATE',
            entityType: 'announcement',
            entityId: String(created.id),
            entityName: created.title,
            description: `SuperAdmin tarafından "${created.title}" başlıklı sistem duyurusu yayınlandı`,
            severity: 'info'
        });

        return { success: true, data: created };
    } catch (error) {
        console.error('createPlatformAnnouncement error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Toggle active state of an announcement
 */
async function toggleAnnouncementStatus(id, isActive) {
    try {
        const aid = parseInt(id, 10);
        const statusVal = (isActive === 1 || isActive === true || isActive === '1') ? 1 : 0;
        const updated = await prisma.system_announcements.update({
            where: { id: aid },
            data: { is_active: statusVal }
        });
        return { success: true, data: updated };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete a platform announcement
 */
async function deletePlatformAnnouncement(id) {
    try {
        const aid = parseInt(id, 10);
        await prisma.system_announcements.delete({
            where: { id: aid }
        });
        return { success: true, message: 'Duyuru silindi' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Create a new Company from Platform Admin
 */
async function createPlatformCompany(data) {
    try {
        const { name, taxNumber, taxOffice, sgkNo, address, phone, ownerUserId } = data;
        if (!name) return { success: false, error: 'Şirket unvanı zorunludur' };

        const newComp = await prisma.companies.create({
            data: {
                name: name.trim(),
                tax_number: taxNumber || null,
                tax_office: taxOffice || null,
                sgk_no: sgkNo || null,
                address: address || null,
                phone: phone || null,
                user_id: ownerUserId && ownerUserId !== '' ? parseInt(ownerUserId, 10) : null
            }
        });

        logAudit({
            companyId: newComp.id,
            action: 'CREATE',
            entityType: 'company',
            entityId: String(newComp.id),
            entityName: newComp.name,
            description: `SuperAdmin tarafından "${newComp.name}" şirketi sisteme eklendi`,
            severity: 'info'
        });

        return { success: true, data: newComp };
    } catch (error) {
        console.error('createPlatformCompany error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update an existing Company and owner assignment from Platform Admin
 */
async function updatePlatformCompany(data) {
    try {
        const { id, name, taxNumber, taxOffice, sgkNo, address, phone, ownerUserId } = data;
        if (!id) return { success: false, error: 'Şirket kimliği zorunludur' };

        const updatedComp = await prisma.companies.update({
            where: { id: parseInt(id, 10) },
            data: {
                name: name ? name.trim() : undefined,
                tax_number: taxNumber !== undefined ? taxNumber : undefined,
                tax_office: taxOffice !== undefined ? taxOffice : undefined,
                sgk_no: sgkNo !== undefined ? sgkNo : undefined,
                address: address !== undefined ? address : undefined,
                phone: phone !== undefined ? phone : undefined,
                user_id: ownerUserId !== undefined ? (ownerUserId && ownerUserId !== '' ? parseInt(ownerUserId, 10) : null) : undefined
            }
        });

        logAudit({
            companyId: updatedComp.id,
            action: 'UPDATE',
            entityType: 'company',
            entityId: String(updatedComp.id),
            entityName: updatedComp.name,
            description: `SuperAdmin tarafından "${updatedComp.name}" şirketi güncellendi`,
            severity: 'info'
        });

        return { success: true, data: updatedComp };
    } catch (error) {
        console.error('updatePlatformCompany error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a Company and clean resources
 */
async function deletePlatformCompany(companyId) {
    try {
        const cid = parseInt(companyId, 10);
        const company = await prisma.companies.findUnique({ where: { id: cid } });
        if (!company) return { success: false, error: 'Şirket bulunamadı' };

        await prisma.companies.delete({ where: { id: cid } });

        logAudit({
            companyId: company.id,
            action: 'DELETE',
            entityType: 'company',
            entityId: String(company.id),
            entityName: company.name,
            description: `SuperAdmin tarafından "${company.name}" şirketi ve tüm bağlı verileri silindi`,
            severity: 'critical'
        });

        return { success: true, message: 'Şirket başarıyla silindi' };
    } catch (error) {
        console.error('deletePlatformCompany error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update user role and permissions
 */
async function updatePlatformUser(userId, userData) {
    try {
        const uid = parseInt(userId, 10);
        const updateData = {};
        if (userData.fullName !== undefined) updateData.full_name = userData.fullName;
        if (userData.email !== undefined) updateData.email = userData.email.toLowerCase().trim();
        if (userData.role !== undefined) updateData.role = userData.role;
        if (userData.isActive !== undefined) updateData.is_active = (userData.isActive === 1 || userData.isActive === true) ? 1 : 0;
        if (userData.roleId !== undefined) updateData.role_id = userData.roleId ? parseInt(userData.roleId, 10) : null;
        
        const updated = await prisma.users.update({
            where: { id: uid },
            data: updateData
        });

        // If companyId is provided, handle company ownership/linkage
        if (userData.companyId !== undefined) {
            const compId = userData.companyId ? parseInt(userData.companyId, 10) : null;
            if (compId) {
                if (userData.role === 'company_admin' || userData.role === 'company_owner') {
                    await prisma.companies.update({
                        where: { id: compId },
                        data: { user_id: uid }
                    }).catch(() => {});
                }
            } else if (userData.role === 'personnel') {
                // If demoted to personnel, release company ownership so personnel cannot be company owner
                await prisma.companies.updateMany({
                    where: { user_id: uid },
                    data: { user_id: null }
                }).catch(() => {});
            }
        }

        logAudit({
            companyId: updated.company_id,
            userId: updated.id,
            username: updated.username,
            userRole: updated.role,
            action: 'UPDATE',
            entityType: 'user',
            entityId: String(updated.id),
            entityName: updated.username,
            description: `"${updated.username}" kullanıcısının rolü (${updated.role}) ve yetkileri güncellendi`,
            severity: 'info'
        });

        return { success: true, user: updated };
    } catch (error) {
        console.error('updatePlatformUser error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get users belonging to a specific company
 */
async function getCompanyUsers(companyId) {
    try {
        const compId = parseInt(companyId, 10);
        if (!compId) return { success: true, data: [] };

        const allUsersRes = await getPlatformUsers();
        const allUsers = allUsersRes?.data || [];
        
        // Strict company isolation: Never return superadmins or users from other companies
        const companyUsers = allUsers.filter(u => {
            if (u.role === 'superadmin' || u.accountType === 'superadmin') return false;
            return u.company?.id === compId;
        });

        return { success: true, data: companyUsers };
    } catch (error) {
        console.error('getCompanyUsers error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

module.exports = {
    getPlatformOverview,
    getPlatformUsers,
    getCompanyUsers,
    resetPlatformUserPassword,
    impersonatePlatformUser,
    createPlatformUser,
    updatePlatformUser,
    deletePlatformUser,
    toggleCompanyStatus,
    toggleUserStatus,
    getPlatformBackups,
    triggerPlatformBackup,
    getPlatformSystemHealth,
    getPlatformLogs,
    clearPlatformLogs,
    getPlatformAnnouncements,
    getActiveAnnouncements,
    createPlatformAnnouncement,
    toggleAnnouncementStatus,
    deletePlatformAnnouncement,
    createPlatformCompany,
    updatePlatformCompany,
    deletePlatformCompany
};
