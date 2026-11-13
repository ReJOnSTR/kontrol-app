const crypto = require('node:crypto');
const { getSecret } = require('./sessions');

const PREFIX = 'enc:v1:';

function getKey() {
    const raw = process.env.SETTINGS_ENCRYPTION_KEY || getSecret();
    return crypto.createHash('sha256').update(`kontrol-vault:${raw}`).digest();
}

function encryptSecret(plaintext) {
    if (plaintext === null || plaintext === undefined || plaintext === '') return '';
    const str = String(plaintext);
    if (str.startsWith(PREFIX)) return str;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(value) {
    if (value === null || value === undefined || value === '') return '';
    const str = String(value);
    if (!str.startsWith(PREFIX)) return str;
    const parts = str.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return '';
    try {
        const [ivB64, tagB64, dataB64] = parts;
        const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
    } catch {
        return '';
    }
}

module.exports = { encryptSecret, decryptSecret };

