const crypto = require('node:crypto');
const challenges = new Map();
const fingerprint = user => crypto.createHash('sha256').update(user.password_hash || '').digest('hex');
function issue(user) {
    for (const [id, c] of challenges) if (c.expires <= Date.now()) challenges.delete(id);
    if (challenges.size > 10000) throw new Error('Çok fazla giriş isteği.');
    const token = crypto.randomBytes(32).toString('base64url');
    challenges.set(token, { userId: user.id, password: fingerprint(user), attempts: 0, expires: Date.now() + 5 * 60 * 1000 });
    return token;
}
function check(token, user) {
    const c = challenges.get(token);
    if (!c || c.expires <= Date.now() || c.userId !== user.id || c.password !== fingerprint(user) || ++c.attempts > 5) {
        challenges.delete(token);
        return false;
    }
    return true;
}
function consume(token) { return challenges.delete(token); }
module.exports = { issue, check, consume };
