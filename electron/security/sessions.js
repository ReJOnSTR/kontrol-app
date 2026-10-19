const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

let secret;
function getSecret() {
    if (secret) return secret;
    if (process.env.JWT_SECRET?.length >= 32) return (secret = process.env.JWT_SECRET);
    let app;
    try { app = require('electron').app; } catch {}
    if (!app) throw new Error('JWT_SECRET must contain at least 32 characters.');
    const filename = path.join(app.getPath('userData'), 'session-secret');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    try { secret = fs.readFileSync(filename, 'utf8'); }
    catch (e) {
        if (e.code !== 'ENOENT') throw e;
        secret = crypto.randomBytes(48).toString('hex');
        fs.writeFileSync(filename, secret, { flag: 'wx', mode: 0o600 });
    }
    return secret;
}
const passwordVersion = user => crypto.createHmac('sha256', getSecret()).update(user.password_hash || '').digest('hex');
function issueSession(user) {
    const sid = crypto.randomUUID();
    return { token: jwt.sign({ id: user.id, sid, pv: passwordVersion(user) }, getSecret(), { expiresIn: '12h', algorithm: 'HS256', issuer: 'kontrol', audience: 'kontrol-client' }), sessionId: sid };
}
async function authenticate(token, prisma) {
    const invalid = () => { const e = new Error('Oturum geçersiz veya sona ermiş. Lütfen tekrar giriş yapın.'); e.status = 401; throw e; };
    let claims;
    try { claims = jwt.verify(token || '', getSecret(), { algorithms: ['HS256'], issuer: 'kontrol', audience: 'kontrol-client' }); } catch { return invalid(); }
    if (!claims.sid || !Number.isSafeInteger(claims.id)) return invalid();
    const user = await prisma.users.findUnique({ where: { id: claims.id }, include: { companies: true, employee: true, custom_role: { include: { permissions: true } }, user_company_access: true } });
    if (!user || user.is_active !== 1 || claims.pv !== passwordVersion(user)) return invalid();
    const revoked = await prisma.revoked_sessions.findUnique({ where: { session_id: claims.sid } });
    if (revoked && (!revoked.expires_at || new Date(revoked.expires_at) > new Date())) return invalid();
    const ids = [...(user.companies || []).map(c => c.id), ...(user.user_company_access || []).map(c => c.company_id), user.employee?.company_id, user.company_id].filter(Number.isSafeInteger);
    return { ...user, companyIds: [...new Set(ids)], sessionId: claims.sid };
}
async function revokeSession(sid, prisma, userId = null) {
    if (!sid || typeof sid !== 'string' || sid.length > 100) throw new Error('Geçersiz oturum.');
    const data = { user_id: userId, reason: 'Session revoked', expires_at: new Date(Date.now() + 13 * 60 * 60 * 1000) };
    await prisma.revoked_sessions.upsert({ where: { session_id: sid }, create: { session_id: sid, ...data }, update: data });
}
module.exports = { getSecret, issueSession, authenticate, revokeSession };
