const { PUBLIC, dispatch } = require('./access');
const { authenticate, issueSession, revokeSession } = require('./sessions');

async function call(method, args, token, fn, prisma) {
    const actor = PUBLIC.has(method) ? null : await authenticate(token, prisma);
    if (method === 'logout') { await revokeSession(actor.sessionId, prisma, actor.id); return { success: true }; }
    const result = await dispatch(method, args, actor, fn, prisma);
    if (['login', 'loginUser', 'verifyMfaLogin'].includes(method) && result?.success && result.user && !result.require2FA) {
        const user = await prisma.users.findUnique({ where: { id: result.user.id } });
        if (!user || user.is_active !== 1) throw Object.assign(new Error('Hesap kapalı.'), { status: 401 });
        Object.assign(result, issueSession(user));
    }
    return result;
}
function requestToken(req) {
    if (req.headers.authorization?.startsWith('Bearer ')) return req.headers.authorization.slice(7);
    const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('kontrol_session='));
    return cookie ? cookie.slice('kontrol_session='.length) : null;
}
module.exports = { call, requestToken };
