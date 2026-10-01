const { getPrismaClient } = require('../prismaClient');
const log = require('../logger');
const { logAudit } = require('./audit.service');
const { supabaseAdmin } = require('./supabase.service');
const { sendCustomHtmlEmail, getEmailSettings, saveEmailSettings, testSmtpConnection } = require('./mailer.service');

const prisma = getPrismaClient();

/**
 * Clean & Minimalist Default Templates (Linear / Resend / Vercel inspired)
 */
const DEFAULT_TEMPLATES = {
    confirmation: {
        type: 'confirmation',
        name: 'Confirm signup',
        subject: 'Hesabınızı Doğrulayın - Kontrol',
        senderName: 'Kontrol',
        description: 'Yeni kullanıcı kayıtlarında e-posta adresini doğrulamak için gönderilir.'
    },
    recovery: {
        type: 'recovery',
        name: 'Reset Password',
        subject: 'Şifre Sıfırlama Talebi - Kontrol',
        senderName: 'Kontrol',
        description: 'Şifresini unutan kullanıcılara şifre yenileme bağlantısı ve OTP kodu iletmek için kullanılır.'
    },
    magic_link: {
        type: 'magic_link',
        name: 'Magic Link',
        subject: 'Giriş Bağlantınız - Kontrol',
        senderName: 'Kontrol',
        description: 'Şifresiz hızlı giriş bağlantısı iletmek için kullanılır.'
    },
    invite: {
        type: 'invite',
        name: 'Invite user',
        subject: 'Kontrol Sistemine Davet Edildiniz',
        senderName: 'Kontrol',
        description: 'Şirket yöneticilerinin yeni personelleri sisteme davet etmesi durumunda gönderilir.'
    },
    change_email: {
        type: 'change_email',
        name: 'Change Email Address',
        subject: 'E-Posta Değişikliği Doğrulaması - Kontrol',
        senderName: 'Kontrol',
        description: 'E-posta adresini güncellemek isteyen kullanıcılara onay bağlantısı göndermek için kullanılır.'
    }
};

/**
 * Generate Ultra-Modern, Minimalist & Icon-Free HTML Email
 */
function generateTemplateHtml(type) {
    let title = 'E-Posta Adresinizi Doğrulayın';
    let description = 'Kontrol hesabınızı aktif hale getirmek için aşağıdaki bağlantıyı kullanarak e-posta adresinizi doğrulayın.';
    let btnLabel = 'Hesabı Doğrula';
    let showOtp = true;
    let otpLabel = 'Doğrulama Kodu';

    if (type === 'recovery') {
        title = 'Şifrenizi Sıfırlayın';
        description = 'Hesabınız için bir şifre sıfırlama talebinde bulunuldu. Yeni bir şifre belirlemek için aşağıdaki butona tıklayın veya doğrulama kodunu kullanın.';
        btnLabel = 'Şifremi Sıfırla';
        otpLabel = 'Doğrulama Kodu';
        showOtp = true;
    } else if (type === 'magic_link') {
        title = 'Şifresiz Giriş Bağlantısı';
        description = 'Kontrol hesabınıza doğrudan giriş yapmak için aşağıdaki güvenli tek kullanımlık bağlantıyı tıklayın.';
        btnLabel = 'Hesaba Giriş Yap';
        otpLabel = 'Giriş Kodu';
        showOtp = true;
    } else if (type === 'invite') {
        title = 'Ekibe Katılmaya Davet Edildiniz';
        description = 'Kontrol yönetim platformuna davet edildiniz. Hesabınızı oluşturmak ve başlamak için daveti onaylayın.';
        btnLabel = 'Daveti Kabul Et';
        showOtp = false;
    } else if (type === 'change_email') {
        title = 'E-Posta Adresinizi Onaylayın';
        description = 'Hesabınızın e-posta adresini değiştirmek için bir talep aldık. Değişikliği tamamlamak için lütfen onaylayın.';
        btnLabel = 'Yeni Adresi Onayla';
        otpLabel = 'Doğrulama Kodu';
        showOtp = true;
    }

    return `<!DOCTYPE html>
<html lang="tr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #a1a1aa;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
    }
    td {
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #ffffff;
      padding: 40px 16px;
    }
    .card {
      width: 100%;
      max-width: 640px;
      margin: 0 auto;
      background: #141416;
      border: 1px solid #27272a;
      border-radius: 10px;
      overflow: hidden;
    }
    .header {
      padding: 24px 36px;
      border-bottom: 1px solid #27272a;
      background: #141416;
    }
    .brand {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #ffffff;
      text-transform: uppercase;
    }
    .content {
      padding: 36px 36px 32px 36px;
    }
    h1 {
      margin: 0 0 14px 0;
      font-size: 22px;
      font-weight: 600;
      color: #ffffff;
      line-height: 1.35;
      letter-spacing: -0.3px;
    }
    p {
      margin: 0 0 24px 0;
      font-size: 14.5px;
      line-height: 1.6;
      color: #a1a1aa;
    }
    .btn-wrap {
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      padding: 12px 26px;
      background: #ffffff;
      color: #09090b !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.1px;
    }
    .otp-block {
      margin: 26px 0;
      padding: 16px 20px;
      background: #0c0c0e;
      border: 1px solid #27272a;
      border-radius: 8px;
    }
    .otp-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #71717a;
      margin-bottom: 6px;
    }
    .otp-code {
      font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #14b8a6;
    }
    .notice {
      margin-top: 26px;
      padding-top: 20px;
      border-top: 1px solid #27272a;
      font-size: 12.5px;
      line-height: 1.5;
      color: #71717a;
    }
    .footer {
      padding: 22px 36px;
      border-top: 1px solid #27272a;
      background: #0f0f11;
      font-size: 12px;
      line-height: 1.6;
      color: #52525b;
    }
    @media screen and (max-width: 600px) {
      .wrapper { padding: 16px 8px; }
      .content, .header, .footer { padding: 20px 18px; }
      .btn { display: block; text-align: center; }
      .otp-code { font-size: 22px; letter-spacing: 4px; }
    }
  </style>
</head>
<body>
  <table class="wrapper" role="presentation">
    <tr>
      <td align="center">
        <table class="card" role="presentation">
          <tr>
            <td class="header">
              <div class="brand">KONTROL</div>
            </td>
          </tr>
          <tr>
            <td class="content">
              <h1>${title}</h1>
              <p>${description}</p>
              
              <div class="btn-wrap">
                <a href="{{ .ConfirmationURL }}" class="btn" target="_blank">${btnLabel}</a>
              </div>

              ${showOtp ? `
              <div class="otp-block">
                <div class="otp-label">${otpLabel}</div>
                <div class="otp-code">{{ .Token }}</div>
              </div>` : ''}

              <div class="notice">
                Bu isteği siz başlatmadıysanız bu iletiyi güvenle yok sayabilirsiniz.
              </div>
            </td>
          </tr>
          <tr>
            <td class="footer">
              Bu e-posta <strong>{{ .Email }}</strong> adresine gönderilmiştir.<br>
              © 2026 Kontrol. Tüm hakları saklıdır.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build consistent, ultra-modern HTML template for user & personnel invitations
 */
function buildInviteEmailHtml({
    companyName = 'Kontrol Filo',
    roleTitle = 'Kullanıcı',
    targetName = 'Kullanıcı',
    username = '',
    email = '',
    otp = '',
    inviteLink = '',
    isPersonnel = false
}) {
    const brandTitle = 'KONTROL';
    const pageTitle = isPersonnel 
        ? 'Personel Giriş & Şifre Davetiyesi' 
        : 'Kullanıcı Giriş & Şifre Davetiyesi';
    const roleBadgeText = companyName || 'Kontrol Filo';

    return `<!DOCTYPE html>
<html lang="tr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #a1a1aa;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
    }
    td {
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #ffffff;
      padding: 40px 16px;
    }
    .card {
      width: 100%;
      max-width: 640px;
      margin: 0 auto;
      background: #141416;
      border: 1px solid #27272a;
      border-radius: 10px;
      overflow: hidden;
    }
    .header {
      padding: 24px 36px;
      border-bottom: 1px solid #27272a;
      background: #141416;
    }
    .brand {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #ffffff;
      text-transform: uppercase;
    }
    .role-badge {
      font-size: 11px;
      font-weight: 600;
      color: #a1a1aa;
      background: #1f1f23;
      border: 1px solid #2e2e33;
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 0.3px;
    }
    .content {
      padding: 36px 36px 32px 36px;
    }
    h1 {
      margin: 0 0 8px 0;
      font-size: 21px;
      font-weight: 600;
      color: #ffffff;
      line-height: 1.35;
      letter-spacing: -0.3px;
    }
    .subtitle {
      font-size: 12.5px;
      color: #71717a;
      margin-bottom: 22px;
    }
    p {
      margin: 0 0 20px 0;
      font-size: 14.5px;
      line-height: 1.6;
      color: #a1a1aa;
    }
    .btn-wrap {
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      padding: 13px 28px;
      background: #ffffff;
      color: #09090b !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.1px;
    }
    .info-box {
      margin: 24px 0;
      padding: 18px 20px;
      background: #0c0c0e;
      border: 1px solid #27272a;
      border-radius: 8px;
    }
    .info-table {
      width: 100%;
      margin-bottom: 14px;
    }
    .info-table td {
      padding: 5px 0;
      font-size: 13px;
    }
    .info-label {
      color: #71717a;
    }
    .info-val {
      color: #ffffff;
      font-weight: 600;
      text-align: right;
    }
    .otp-divider {
      height: 1px;
      background: #27272a;
      margin: 12px 0 14px 0;
    }
    .otp-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #71717a;
      margin-bottom: 6px;
    }
    .otp-code {
      font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #14b8a6;
    }
    .notice {
      margin-top: 26px;
      padding-top: 20px;
      border-top: 1px solid #27272a;
      font-size: 12.5px;
      line-height: 1.5;
      color: #71717a;
    }
    .footer {
      padding: 22px 36px;
      border-top: 1px solid #27272a;
      background: #0f0f11;
      font-size: 12px;
      line-height: 1.6;
      color: #52525b;
    }
    @media screen and (max-width: 600px) {
      .wrapper { padding: 16px 8px; }
      .content, .header, .footer { padding: 20px 18px; }
      .btn { display: block; text-align: center; }
      .otp-code { font-size: 22px; letter-spacing: 4px; }
    }
  </style>
</head>
<body>
  <table class="wrapper" role="presentation">
    <tr>
      <td align="center">
        <table class="card" role="presentation">
          <tr>
            <td class="header">
              <table style="width: 100%;">
                <tr>
                  <td><div class="brand">${brandTitle}</div></td>
                  <td align="right"><span class="role-badge">${roleBadgeText}</span></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="content">
              <h1>${pageTitle}</h1>
              <div class="subtitle">${companyName} • ${roleTitle}</div>
              
              <p>Sayın <strong>${targetName}</strong>,</p>
              <p>
                <strong>${companyName}</strong> tarafından Kontrol App yönetim platformundaki <strong>${roleTitle}</strong> hesabınız tanımlanmıştır.
              </p>
              <p>
                Aşağıdaki butona tıklayarak tek tıkla hesabınıza giriş yapabilir ve güvenli şifrenizi hemen belirleyebilirsiniz:
              </p>

              <div class="btn-wrap">
                <a href="${inviteLink}" class="btn" target="_blank">Giriş Yap ve Şifreni Belirle</a>
              </div>

              <div class="info-box">
                <table class="info-table" role="presentation">
                  ${username ? `
                  <tr>
                    <td class="info-label">Kullanıcı Adı:</td>
                    <td class="info-val"><span style="font-family: monospace;">${username}</span></td>
                  </tr>` : ''}
                  <tr>
                    <td class="info-label">E-Posta Adresi:</td>
                    <td class="info-val">${email}</td>
                  </tr>
                  <tr>
                    <td class="info-label">Yetki / Rol:</td>
                    <td class="info-val">${roleTitle}</td>
                  </tr>
                </table>

                ${otp ? `
                <div class="otp-divider"></div>
                <div class="otp-label">Tek Kullanımlık Doğrulama Kodu (OTP)</div>
                <div class="otp-code">${otp}</div>` : ''}
              </div>

              <div class="notice">
                Bu davet bağlantısı 7 gün boyunca geçerlidir. Butona tıklamakta sorun yaşıyorsanız aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:<br>
                <a href="${inviteLink}" style="color: #14b8a6; text-decoration: none; word-break: break-all; font-size: 12px; margin-top: 6px; display: inline-block;">${inviteLink}</a>
              </div>
            </td>
          </tr>
          <tr>
            <td class="footer">
              Bu e-posta <strong>${email}</strong> adresine gönderilmiştir.<br>
              © 2026 Kontrol. Tüm hakları saklıdır.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Ensure email_templates table exists in database
 */
async function ensureEmailTemplatesTable() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS email_templates (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(150) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                sender_name VARCHAR(150) DEFAULT 'Kontrol',
                description TEXT,
                html_content TEXT NOT NULL,
                is_customized BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (e) {
        try {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS email_templates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    sender_name TEXT DEFAULT 'Kontrol',
                    description TEXT,
                    html_content TEXT NOT NULL,
                    is_customized INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
        } catch (sqliteErr) {}
    }
}

/**
 * Seed or Fetch all email templates
 */
async function getEmailTemplates() {
    try {
        await ensureEmailTemplatesTable();
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM email_templates ORDER BY id ASC;`);
        
        const existingTypes = new Set((rows || []).map(r => r.type));
        const templates = [];

        for (const [key, def] of Object.entries(DEFAULT_TEMPLATES)) {
            if (existingTypes.has(key)) {
                const row = rows.find(r => r.type === key);
                templates.push({
                    type: row.type,
                    name: row.name,
                    subject: row.subject,
                    senderName: row.sender_name || 'Kontrol',
                    description: row.description,
                    htmlContent: row.html_content,
                    isCustomized: Boolean(row.is_customized),
                    updatedAt: row.updated_at
                });
            } else {
                const defaultHtml = generateTemplateHtml(key);
                try {
                    await prisma.$executeRawUnsafe(`
                        INSERT INTO email_templates (type, name, subject, sender_name, description, html_content, is_customized, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, false, NOW());
                    `, def.type, def.name, def.subject, def.senderName, def.description, defaultHtml);
                } catch (insertErr) {}

                templates.push({
                    type: def.type,
                    name: def.name,
                    subject: def.subject,
                    senderName: def.senderName,
                    description: def.description,
                    htmlContent: defaultHtml,
                    isCustomized: false,
                    updatedAt: null
                });
            }
        }

        return { success: true, data: templates };
    } catch (err) {
        log.error('getEmailTemplates error:', err);
        const fallback = Object.values(DEFAULT_TEMPLATES).map(def => ({
            ...def,
            htmlContent: generateTemplateHtml(def.type),
            isCustomized: false,
            updatedAt: null
        }));
        return { success: true, data: fallback };
    }
}

/**
 * Save customized template
 */
async function saveEmailTemplate(data, actorUser) {
    try {
        const { type, subject, senderName, htmlContent } = data || {};
        if (!type || !subject || !htmlContent) {
            return { success: false, error: 'Şablon tipi, konu başlığı ve HTML içeriği zorunludur' };
        }

        await ensureEmailTemplatesTable();

        const def = DEFAULT_TEMPLATES[type] || {
            type,
            name: type,
            description: ''
        };

        const existing = await prisma.$queryRawUnsafe(`SELECT id FROM email_templates WHERE type = $1 LIMIT 1;`, type);

        if (existing && existing.length > 0) {
            await prisma.$executeRawUnsafe(`
                UPDATE email_templates 
                SET subject = $1, sender_name = $2, html_content = $3, is_customized = true, updated_at = NOW()
                WHERE type = $4;
            `, subject, senderName || 'Kontrol', htmlContent, type);
        } else {
            await prisma.$executeRawUnsafe(`
                INSERT INTO email_templates (type, name, subject, sender_name, description, html_content, is_customized, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, true, NOW());
            `, def.type, def.name, subject, senderName || 'Kontrol', def.description, htmlContent);
        }

        if (actorUser) {
            logAudit({
                userId: actorUser.id,
                username: actorUser.username,
                userRole: actorUser.role,
                action: 'EMAIL_TEMPLATE_UPDATE',
                entityType: 'EMAIL_TEMPLATE',
                entityId: type,
                details: { type, subject, senderName }
            });
        }

        return { success: true, message: 'Şablon başarıyla kaydedildi' };
    } catch (err) {
        log.error('saveEmailTemplate error:', err);
        return { success: false, error: 'Şablon kaydedilemedi: ' + err.message };
    }
}

/**
 * Reset template to minimalist default
 */
async function resetEmailTemplate(data, actorUser) {
    try {
        const { type } = data || {};
        if (!type) {
            return { success: false, error: 'Şablon tipi gereklidir' };
        }

        await ensureEmailTemplatesTable();

        await prisma.$executeRawUnsafe(`
            DELETE FROM email_templates WHERE type = $1;
        `, type);

        const def = DEFAULT_TEMPLATES[type] || {
            type,
            name: type,
            subject: 'Bildirim',
            senderName: 'Kontrol',
            description: ''
        };

        const defaultHtml = generateTemplateHtml(type);

        return {
            success: true,
            message: 'Şablon başarıyla varsayılana sıfırlandı',
            data: {
                ...def,
                htmlContent: defaultHtml,
                isCustomized: false,
                updatedAt: null
            }
        };
    } catch (err) {
        log.error('resetEmailTemplate error:', err);
        return { success: false, error: 'Şablon sıfırlanamadı: ' + err.message };
    }
}

/**
 * Send a real test email
 */
async function sendTestEmail(data, actorUser) {
    try {
        const { type, targetEmail, subject, htmlContent, senderName } = data || {};
        if (!targetEmail || !htmlContent) {
            return { success: false, error: 'Hedef e-posta adresi ve HTML içeriği gereklidir' };
        }

        let redirectTarget = 'https://kontrol-app.com/#/login?verified=true';
        if (type === 'recovery') {
            redirectTarget = 'https://kontrol-app.com/#/reset-password';
        } else if (type === 'invite') {
            redirectTarget = 'https://kontrol-app.com/#/reset-password?invite=true';
        } else if (type === 'change_email') {
            redirectTarget = 'https://kontrol-app.com/#/login?email_changed=true';
        }

        let confirmationUrl = redirectTarget;
        const randomOtp = String(Math.floor(100000 + Math.random() * 900000));
        let token = `${randomOtp.slice(0, 3)} ${randomOtp.slice(3)}`;

        try {
            const linkType = type === 'confirmation' ? 'signup' : (type === 'recovery' ? 'recovery' : (type === 'invite' ? 'invite' : 'magiclink'));
            const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
                type: linkType,
                email: targetEmail,
                options: {
                    redirectTo: redirectTarget
                }
            });
            if (linkData?.properties?.action_link) {
                confirmationUrl = linkData.properties.action_link;
            }
            if (linkData?.properties?.email_otp) {
                const rawOtp = String(linkData.properties.email_otp);
                token = rawOtp.length === 6 ? `${rawOtp.slice(0, 3)} ${rawOtp.slice(3)}` : rawOtp;
            }
        } catch (linkErr) {
            log.warn('[Test Email] Supabase generateLink notice:', linkErr.message);
        }

        const mockSiteUrl = 'https://kontrol-app.com';
        const mockUsername = actorUser?.username || 'halilsak';
        const mockCompanyName = 'SAK PETROL LOJİSTİK A.Ş.';

        let renderedHtml = htmlContent
            .replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, confirmationUrl)
            .replace(/\{\{\s*\.Token\s*\}\}/g, token)
            .replace(/\{\{\s*\.Email\s*\}\}/g, targetEmail)
            .replace(/\{\{\s*\.SiteURL\s*\}\}/g, mockSiteUrl)
            .replace(/\{\{\s*\.Data\.username\s*\}\}/g, mockUsername)
            .replace(/\{\{\s*\.Data\.company_name\s*\}\}/g, mockCompanyName);

        log.info(`[Test Email] Dispatching custom HTML email "${type}" to: ${targetEmail}`);

        const mailRes = await sendCustomHtmlEmail({
            to: targetEmail,
            subject: subject || 'Kontrol Bildirimi',
            html: renderedHtml,
            senderName: senderName || 'Kontrol'
        });

        let sentViaFallback = false;
        if (!mailRes.success) {
            log.warn(`[Test Email] Direct SMTP dispatch failed (${mailRes.error}). Triggering Supabase server-side relay fallback...`);
            
            try {
                const { error: supaErr } = await supabaseAdmin.auth.resetPasswordForEmail(targetEmail, {
                    redirectTo: confirmationUrl
                });
                if (!supaErr) {
                    sentViaFallback = true;
                } else {
                    return { success: false, error: `E-posta gönderilemedi: ${mailRes.error} (Supabase: ${supaErr.message})` };
                }
            } catch (fallbackErr) {
                return { success: false, error: 'E-posta gönderim hatası: ' + mailRes.error };
            }
        }

        if (actorUser) {
            logAudit({
                userId: actorUser.id,
                username: actorUser.username,
                userRole: actorUser.role,
                action: 'EMAIL_TEST_SEND',
                entityType: 'EMAIL_TEMPLATE',
                entityId: type,
                details: { targetEmail, type, messageId: mailRes.messageId, sentViaFallback }
            });
        }

        return {
            success: true,
            message: sentViaFallback
                ? `Test e-postası sunucu dahili kanalı üzerinden "${targetEmail}" adresine başarıyla gönderildi!`
                : `Özel tasarımlı test e-postası "${targetEmail}" adresine başarıyla gönderildi!`
        };
    } catch (err) {
        log.error('sendTestEmail error:', err);
        return { success: false, error: 'Test e-postası gönderilemedi: ' + err.message };
    }
}

module.exports = {
    DEFAULT_TEMPLATES,
    generateTemplateHtml,
    getEmailTemplates,
    saveEmailTemplate,
    resetEmailTemplate,
    sendTestEmail,
    getEmailSettings,
    saveEmailSettings,
    testSmtpConnection,
    buildInviteEmailHtml
};
