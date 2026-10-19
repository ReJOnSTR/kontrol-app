const QRCode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getPrismaClient } = require('../prismaClient');
const prisma = getPrismaClient();

// RFC 4648 Base32 Alphabet
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;

        while (bits >= 5) {
            output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_CHARS[(value << (5 - bits)) & 31];
    }

    return output;
}

function base32Decode(input) {
    const clean = String(input || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    let index = 0;
    const output = Buffer.alloc(Math.floor((clean.length * 5) / 8));

    for (let i = 0; i < clean.length; i++) {
        const val = BASE32_CHARS.indexOf(clean[i]);
        if (val === -1) continue;

        value = (value << 5) | val;
        bits += 5;

        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }

    return output;
}

function generateSecret(length = 20) {
    return base32Encode(crypto.randomBytes(length));
}

function generateHOTP(secret, counter) {
    const key = base32Decode(secret);
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;

    return code.toString().padStart(6, '0');
}

function verifyTOTP(token, secret, timeStep = 30, window = 1) {
    if (!token || !secret) return false;
    const cleanToken = String(token).replace(/\s+/g, '').trim();
    if (cleanToken.length !== 6) return false;

    const currentCounter = Math.floor(Date.now() / 1000 / timeStep);
    for (let i = -window; i <= window; i++) {
        if (generateHOTP(secret, currentCounter + i) === cleanToken) {
            return true;
        }
    }
    return false;
}

/**
 * Generate 8 random backup recovery codes
 */
function generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
    }
    return codes;
}

const pendingSetups = new Map();
const hashCode = code => crypto.createHash('sha256').update(String(code).replace(/[^a-z0-9]/gi, '').toUpperCase()).digest('hex');

async function generateMfaSetup(userId) {
    const user = await prisma.users.findUnique({ where: { id: Number(userId) } });
    if (!user || user.is_active !== 1 || user.two_factor_enabled === 1) return { success: false, error: 'MFA kurulumu bu hesapta başlatılamaz.' };
    const secret = generateSecret();
    const backupCodes = generateBackupCodes();
    const otpauth = `otpauth://totp/KONTROL:${encodeURIComponent(user.email || user.username)}?secret=${secret}&issuer=KONTROL`;
    for (const [id, setup] of pendingSetups) if (setup.expires < Date.now()) pendingSetups.delete(id);
    pendingSetups.set(user.id, { secret, backupCodes, expires: Date.now() + 10 * 60 * 1000 });
    return { success: true, secret, backupCodes, otpauth, qrCodeUrl: await QRCode.toDataURL(otpauth) };
}

async function enableMfa(userId, secret, token) {
    const uid = Number(userId);
    const setup = pendingSetups.get(uid);
    if (!setup || setup.expires <= Date.now() || setup.secret !== secret || !verifyTOTP(token, setup.secret)) return { success: false, error: 'Kurulum süresi doldu veya kod geçersiz.' };
    const result = await prisma.users.updateMany({ where: { id: uid, is_active: 1, two_factor_enabled: 0 }, data: { two_factor_secret: secret, two_factor_enabled: 1, two_factor_backup_codes: JSON.stringify(setup.backupCodes.map(hashCode)) } });
    pendingSetups.delete(uid);
    return result.count === 1 ? { success: true, backupCodes: setup.backupCodes } : { success: false, error: 'MFA zaten etkin veya hesap kapalı.' };
}

async function disableMfa(userId, currentPassword) {
    const user = await prisma.users.findUnique({ where: { id: Number(userId) } });
    if (!user || !currentPassword || !await bcrypt.compare(currentPassword, user.password_hash)) return { success: false, error: 'MFA kapatmak için mevcut şifrenizi doğrulayın.' };
    await prisma.users.update({ where: { id: user.id }, data: { two_factor_secret: null, two_factor_enabled: 0, two_factor_backup_codes: null } });
    return { success: true };
}

async function verifyMfaLogin(userId, tokenOrBackupCode, challenge) {
    const challenges = require('../security/challenges');
    const user = await prisma.users.findUnique({ where: { id: Number(userId) } });
    if (!user || user.is_active !== 1 || user.two_factor_enabled !== 1 || !user.two_factor_secret || !challenges.check(challenge, user)) return { success: false, error: 'Geçersiz veya süresi dolmuş giriş doğrulaması. Yeniden giriş yapın.' };
    let valid = verifyTOTP(tokenOrBackupCode, user.two_factor_secret);
    let usedBackup = false;
    let codes = [];
    try { codes = JSON.parse(user.two_factor_backup_codes || '[]'); } catch {}
    if (!valid) {
        // Existing plaintext codes are consumed once; remaining codes are upgraded.
        const hash = hashCode(tokenOrBackupCode);
        const index = codes.findIndex(c => (c.length === 64 ? c : hashCode(c)) === hash);
        if (index >= 0) {
            codes.splice(index, 1);
            const consumed = await prisma.users.updateMany({ where: { id: user.id, two_factor_backup_codes: user.two_factor_backup_codes }, data: { two_factor_backup_codes: JSON.stringify(codes.map(c => c.length === 64 ? c : hashCode(c))) } });
            valid = consumed.count === 1;
            usedBackup = valid;
        }
    }
    if (!valid || !challenges.consume(challenge)) return { success: false, error: 'Doğrulama kodu geçersiz veya kullanılmış.' };
    const profile = await require('./auth.service').getUserProfile(user.id);
    return { ...profile, verified: true, backupCodeUsed: usedBackup, remainingBackupCodes: codes.length };
}

async function getMfaStatus(userId) {
    const user = await prisma.users.findUnique({ where: { id: Number(userId) }, select: { two_factor_enabled: true, two_factor_backup_codes: true } });
    if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };
    let codes = [];
    try { codes = JSON.parse(user.two_factor_backup_codes || '[]'); } catch {}
    return { success: true, enabled: user.two_factor_enabled === 1, remainingBackupCodes: codes.length };
}
module.exports = { generateMfaSetup, enableMfa, disableMfa, verifyMfaLogin, getMfaStatus };
