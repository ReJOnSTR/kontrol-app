const { logAudit } = require('./audit.service');

// In-memory active sessions store
// Key: sessionId (string), Value: Session Object
const activeSessions = new Map();

// Blacklisted / Terminated session IDs (force logout)
const terminatedSessionIds = new Set();
let revokedCacheLoaded = false;

async function loadRevokedSessionsFromDb() {
    if (revokedCacheLoaded) return;
    revokedCacheLoaded = true;
    try {
        const { getPrismaClient } = require('../prismaClient');
        const prisma = getPrismaClient();
        if (!prisma) return;

        // Cleanup expired sessions
        await prisma.$executeRawUnsafe(`DELETE FROM revoked_sessions WHERE expires_at < CURRENT_TIMESTAMP`).catch(() => {});

        // Fetch active revoked session IDs
        const rows = await prisma.$queryRawUnsafe(`SELECT session_id FROM revoked_sessions WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP`).catch(() => []);
        if (Array.isArray(rows)) {
            for (const r of rows) {
                if (r.session_id) terminatedSessionIds.add(r.session_id);
            }
        }
    } catch (e) {
        // Fallback gracefully to memory
    }
}

/**
 * Handle heartbeat from active client
 */
function recordHeartbeat(data) {
    try {
        if (!revokedCacheLoaded) {
            loadRevokedSessionsFromDb().catch(() => {});
        }

        const {
            userId,
            username,
            userRole,
            companyId,
            companyName,
            sessionId,
            platform,
            ip,
            userAgent,
            loginAt
        } = data || {};

        if (!userId || !sessionId) {
            return { success: false, error: 'Eksik oturum parametreleri' };
        }

        const uid = parseInt(userId, 10);

        // Check if this specific session was terminated by SuperAdmin
        if (terminatedSessionIds.has(sessionId)) {
            return {
                success: false,
                forceLogout: true,
                error: 'Oturumunuz sistem yöneticisi tarafından güvenlik gerekçesiyle sonlandırıldı.'
            };
        }

        const now = Date.now();
        const existing = activeSessions.get(sessionId);

        activeSessions.set(sessionId, {
            sessionId,
            userId: uid,
            username: username || existing?.username || 'Kullanıcı',
            userRole: userRole || existing?.userRole || 'user',
            companyId: companyId ? parseInt(companyId, 10) : null,
            companyName: companyName || existing?.companyName || 'Sistem / Genel',
            platform: platform || existing?.platform || 'Web / Masaüstü',
            ip: ip || existing?.ip || '127.0.0.1',
            userAgent: userAgent || existing?.userAgent || '',
            loginAt: existing?.loginAt || loginAt || now,
            lastSeenAt: now
        });

        return {
            success: true,
            activeCount: getOnlineCount()
        };
    } catch (error) {
        console.error('recordHeartbeat error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get count of active online sessions (last seen within 2.5 minutes)
 */
function getOnlineCount() {
    const threshold = Date.now() - 2.5 * 60 * 1000;
    let count = 0;
    for (const session of activeSessions.values()) {
        if (session.lastSeenAt >= threshold) {
            count++;
        }
    }
    return count;
}

/**
 * Get list of all real-time active users and observability metrics
 */
function getRealtimeActiveUsers() {
    try {
        const now = Date.now();
        const onlineThreshold = now - 2.5 * 60 * 1000; // 2.5 mins
        const idleThreshold = now - 10 * 60 * 1000;   // 10 mins
        const purgeThreshold = now - 30 * 60 * 1000;  // 30 mins

        const sessionsList = [];
        let onlineCount = 0;
        let idleCount = 0;

        for (const [sId, session] of activeSessions.entries()) {
            // Purge very old sessions
            if (session.lastSeenAt < purgeThreshold) {
                activeSessions.delete(sId);
                continue;
            }

            let status = 'offline';
            if (session.lastSeenAt >= onlineThreshold) {
                status = 'online';
                onlineCount++;
            } else if (session.lastSeenAt >= idleThreshold) {
                status = 'idle';
                idleCount++;
            }

            const durationMs = now - session.loginAt;
            const durationMins = Math.floor(durationMs / (60 * 1000));
            const durationHours = Math.floor(durationMins / 60);
            const durationFormatted = durationHours > 0 
                ? `${durationHours}s ${durationMins % 60}dk` 
                : `${durationMins} dk`;

            const lastSeenSecsAgo = Math.floor((now - session.lastSeenAt) / 1000);

            sessionsList.push({
                ...session,
                status,
                durationFormatted,
                lastSeenSecsAgo
            });
        }

        // Sort by last active desc
        sessionsList.sort((a, b) => b.lastSeenAt - a.lastSeenAt);

        return {
            success: true,
            onlineCount,
            idleCount,
            totalTracked: sessionsList.length,
            sessions: sessionsList
        };
    } catch (error) {
        console.error('getRealtimeActiveUsers error:', error);
        return { success: false, error: error.message, sessions: [], onlineCount: 0, idleCount: 0 };
    }
}

/**
 * Force-logout / Terminate an active user session
 */
async function terminateUserSession(sessionId, adminUser = 'SuperAdmin') {
    const { getPrismaClient } = require('../prismaClient');
    const { revokeSession } = require('../security/sessions');
    await require('../security/context').run(null, () => revokeSession(sessionId, getPrismaClient(), activeSessions.get(sessionId)?.userId || null));
    activeSessions.delete(sessionId);
    terminatedSessionIds.add(sessionId);
    return { success: true, message: 'Oturum sunucuda iptal edildi.' };
}

module.exports = {
    recordHeartbeat,
    getOnlineCount,
    getRealtimeActiveUsers,
    terminateUserSession
};
