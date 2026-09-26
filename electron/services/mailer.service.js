const nodemailer = require('nodemailer');
const { getPrismaClient } = require('../prismaClient');
const log = require('../logger');

const prisma = getPrismaClient();

/**
 * Ensure email_settings table exists in database
 */
async function ensureEmailSettingsTable() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS email_settings (
                id SERIAL PRIMARY KEY,
                smtp_host VARCHAR(255),
                smtp_port INTEGER DEFAULT 587,
                smtp_secure BOOLEAN DEFAULT false,
                smtp_user VARCHAR(255),
                smtp_pass VARCHAR(255),
                sender_name VARCHAR(150) DEFAULT 'Kontrol Güvenlik Ekibi',
                sender_email VARCHAR(255) DEFAULT 'noreply@kontrol-app.com',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (e) {
        try {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS email_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    smtp_host TEXT,
                    smtp_port INTEGER DEFAULT 587,
                    smtp_secure INTEGER DEFAULT 0,
                    smtp_user TEXT,
                    smtp_pass TEXT,
                    sender_name TEXT DEFAULT 'Kontrol Güvenlik Ekibi',
                    sender_email TEXT DEFAULT 'noreply@kontrol-app.com',
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
        } catch (sqliteErr) {}
    }
}

/**
 * Get current SMTP settings
 */
async function getEmailSettings() {
    try {
        await ensureEmailSettingsTable();
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM email_settings ORDER BY id DESC LIMIT 1;`);
        const dbConfig = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

        return {
            success: true,
            data: {
                smtpHost: dbConfig?.smtp_host || process.env.SMTP_HOST || '',
                smtpPort: dbConfig?.smtp_port || parseInt(process.env.SMTP_PORT || '587'),
                smtpSecure: dbConfig ? (dbConfig.smtp_secure === true || dbConfig.smtp_secure === 1) : (process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465'),
                smtpUser: dbConfig?.smtp_user || process.env.SMTP_USER || '',
                smtpPass: dbConfig?.smtp_pass ? '••••••••' : (process.env.SMTP_PASS ? '••••••••' : ''),
                hasPass: !!(dbConfig?.smtp_pass || process.env.SMTP_PASS),
                senderName: dbConfig?.sender_name || process.env.SMTP_SENDER_NAME || 'Kontrol Güvenlik Ekibi',
                senderEmail: dbConfig?.sender_email || process.env.SMTP_FROM || 'noreply@kontrol-app.com'
            }
        };
    } catch (err) {
        log.error('getEmailSettings error:', err);
        return {
            success: true,
            data: {
                smtpHost: process.env.SMTP_HOST || '',
                smtpPort: parseInt(process.env.SMTP_PORT || '587'),
                smtpSecure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
                smtpUser: process.env.SMTP_USER || '',
                smtpPass: '',
                hasPass: !!process.env.SMTP_PASS,
                senderName: process.env.SMTP_SENDER_NAME || 'Kontrol Güvenlik Ekibi',
                senderEmail: process.env.SMTP_FROM || 'noreply@kontrol-app.com'
            }
        };
    }
}

/**
 * Save SMTP settings
 */
async function saveEmailSettings(config) {
    try {
        await ensureEmailSettingsTable();
        const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, senderName, senderEmail } = config || {};

        // Check if existing record
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM email_settings ORDER BY id DESC LIMIT 1;`);
        const existing = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

        let finalPass = existing?.smtp_pass || process.env.SMTP_PASS || '';
        if (smtpPass && smtpPass !== '••••••••') {
            finalPass = smtpPass;
        }

        if (existing) {
            await prisma.$executeRawUnsafe(`
                UPDATE email_settings 
                SET smtp_host = $1, smtp_port = $2, smtp_secure = $3, smtp_user = $4, smtp_pass = $5, sender_name = $6, sender_email = $7, updated_at = NOW()
                WHERE id = $8;
            `, smtpHost, parseInt(smtpPort || '587'), !!smtpSecure, smtpUser, finalPass, senderName, senderEmail, existing.id);
        } else {
            await prisma.$executeRawUnsafe(`
                INSERT INTO email_settings (smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, sender_name, sender_email, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW());
            `, smtpHost, parseInt(smtpPort || '587'), !!smtpSecure, smtpUser, finalPass, senderName, senderEmail);
        }

        log.info('[Mailer] SMTP configuration updated successfully.');
        return { success: true, message: 'SMTP sunucu ayarları başarıyla kaydedildi!' };
    } catch (err) {
        log.error('saveEmailSettings error:', err);
        return { success: false, error: 'SMTP ayarları kaydedilemedi: ' + err.message };
    }
}

/**
 * Test SMTP connection
 */
async function testSmtpConnection(config) {
    try {
        let { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } = config || {};
        
        if (!smtpHost) {
            const savedRes = await getEmailSettings();
            if (savedRes?.data?.smtpHost) {
                smtpHost = savedRes.data.smtpHost;
                if (smtpPort === undefined) smtpPort = savedRes.data.smtpPort;
                if (smtpSecure === undefined) smtpSecure = savedRes.data.smtpSecure;
                if (smtpUser === undefined) smtpUser = savedRes.data.smtpUser;
            }
        }

        let finalPass = smtpPass;
        if (!finalPass || finalPass === '••••••••') {
            const rows = await prisma.$queryRawUnsafe(`SELECT smtp_pass FROM email_settings ORDER BY id DESC LIMIT 1;`);
            finalPass = rows?.[0]?.smtp_pass || process.env.SMTP_PASS || '';
        }

        if (!smtpHost) {
            return { success: false, error: 'SMTP Sunucu adresi (Host) gereklidir' };
        }

        const transporterConfig = {
            host: smtpHost,
            port: parseInt(smtpPort || '587'),
            secure: smtpSecure === true || smtpSecure === 'true' || smtpPort === 465 || smtpPort === '465',
            tls: { rejectUnauthorized: false },
            connectionTimeout: 8000
        };

        if (smtpUser) {
            transporterConfig.auth = {
                user: smtpUser,
                pass: finalPass
            };
        }

        const transporter = nodemailer.createTransport(transporterConfig);
        await transporter.verify();

        return { success: true, message: 'SMTP Sunucu bağlantısı başarılı! Sunucu hazır.' };
    } catch (err) {
        log.error('testSmtpConnection error:', err);
        return { success: false, error: 'SMTP bağlantı hatası: ' + err.message };
    }
}

/**
 * Send an email with HTML & Plaintext fallback
 */
async function sendCustomHtmlEmail({ to, cc, bcc, subject, html, senderName, senderEmail }) {
    try {
        if (!to || !html) {
            throw new Error('Alıcı e-posta ve HTML içeriği zorunludur.');
        }

        await ensureEmailSettingsTable();
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM email_settings ORDER BY id DESC LIMIT 1;`);
        const cfg = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

        const smtpHost = cfg?.smtp_host || process.env.SMTP_HOST || '45.147.47.56';
        const smtpPort = cfg?.smtp_port || parseInt(process.env.SMTP_PORT || '587');
        const smtpSecure = cfg ? (cfg.smtp_secure === true || cfg.smtp_secure === 1) : (process.env.SMTP_SECURE === 'true');
        const smtpUser = cfg?.smtp_user || process.env.SMTP_USER || '';
        const smtpPass = cfg?.smtp_pass || process.env.SMTP_PASS || '';

        const fromName = senderName || cfg?.sender_name || 'Kontrol Güvenlik Ekibi';
        const fromEmail = senderEmail || cfg?.sender_email || 'noreply@kontrol-app.com';

        const transportOptions = {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure || smtpPort === 465,
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000
        };

        if (smtpUser && smtpPass) {
            transportOptions.auth = {
                user: smtpUser,
                pass: smtpPass
            };
        }

        const transporter = nodemailer.createTransport(transportOptions);

        // Convert HTML to simple plain text fallback
        const plainText = html
            .replace(/<style([\s\S]*?)<\/style>/gi, '')
            .replace(/<script([\s\S]*?)<\/script>/gi, '')
            .replace(/<\/div>/ig, '\n')
            .replace(/<\/li>/ig, '\n')
            .replace(/<li>/ig, '  * ')
            .replace(/<\/ul>/ig, '\n')
            .replace(/<\/p>/ig, '\n\n')
            .replace(/<br\s*[\/]?>/gi, '\n')
            .replace(/<[^>]+>/ig, '')
            .trim();

        const mailOptions = {
            from: `"${fromName}" <${fromEmail}>`,
            to,
            subject: subject || 'Kontrol Bildirimi',
            text: plainText,
            html
        };

        if (cc) mailOptions.cc = cc;
        if (bcc) mailOptions.bcc = bcc;

        log.info(`[Mailer] Sending custom HTML email to ${to} ${cc ? `(CC: ${cc})` : ''} via SMTP ${smtpHost}:${smtpPort}...`);
        const info = await transporter.sendMail(mailOptions);
        log.info(`[Mailer] Custom HTML email successfully sent to ${to}! MessageId: ${info.messageId}`);

        return { success: true, messageId: info.messageId };
    } catch (err) {
        log.error(`[Mailer] Failed to send custom HTML email to ${to}:`, err);
        return { success: false, error: err.message };
    }
}

module.exports = {
    getEmailSettings,
    saveEmailSettings,
    testSmtpConnection,
    sendCustomHtmlEmail
};
