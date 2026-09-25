const log = require('../logger');
const { getPrismaClient } = require('../prismaClient');
const mailerService = require('./mailer.service');
const { getUpcomingEvents } = require('./settings.service');

const prisma = getPrismaClient();

// In-memory cache to prevent duplicate email alerts on the same calendar day
const sentAlertCache = new Set();

/**
 * Default role-based notification configurations
 */
const DEFAULT_NOTIFICATION_SETTINGS = {
    emailNotificationsEnabled: true,
    notificationEmails: '', // comma-separated emails, or fallback to user/company email
    dailySummaryEnabled: true,
    dailySummaryTime: '09:00',
    rolePreferences: {
        admin: {
            label: 'Şirket Yöneticisi & Admin',
            description: 'Tüm operasyonel, finansal ve güvenlik süreçlerine tam yetkili erişim.',
            items: {
                inspection: { label: 'Araç Muayene & Periyodik Kontrol', inApp: true, email: true },
                insurance: { label: 'Trafik Sigortası ve Kasko Bitişleri', inApp: true, email: true },
                finance_check: { label: 'Vadesi Gelen Çek & Senetler', inApp: true, email: true },
                approval_center: { label: 'Onay Bekleyen Personel Talepleri (İzin/Mesai/Avans)', inApp: true, email: true },
                employee_document: { label: 'Personel Belge & Ehliyet/SRC Süreleri', inApp: true, email: true },
                security_alerts: { label: 'Kritik Güvenlik Olayları & Silme Hareketleri', inApp: true, email: true },
                daily_summary: { label: 'Konsolide Günlük Şirket Özeti', inApp: true, email: true }
            }
        },
        accounting: {
            label: 'Muhasebe & Finans',
            description: 'Finansal vadeler, çek/senet, kasa ve avans ödemeleri yönetimi.',
            items: {
                finance_check: { label: 'Vadesi Yaklaşan Çekler ve Senetler', inApp: true, email: true },
                advance_requests: { label: 'Personel Avans ve Masraf Talepleri', inApp: true, email: true },
                cash_flow_warning: { label: 'Kritik Kasa & Bakiye Hatırlatıcıları', inApp: true, email: false },
                daily_summary: { label: 'Günlük Finansal Durum Özeti', inApp: true, email: true }
            }
        },
        fleet: {
            label: 'Filo & Saha Operasyon',
            description: 'Araç muayeneleri, sigorta, periyodik bakım ve servis takibi.',
            items: {
                inspection: { label: 'Muayene & Egzoz Süresi Biten / Yaklaşan Araçlar', inApp: true, email: true },
                insurance: { label: 'Kasko & Trafik Sigortası Bitişleri', inApp: true, email: true },
                maintenance: { label: 'Periyodik Bakım & Kilometre Sayaç Uyarıları', inApp: true, email: true },
                daily_summary: { label: 'Günlük Filo ve Araç Takip Özeti', inApp: true, email: false }
            }
        },
        personnel: {
            label: 'Personel & Şoför',
            description: 'Sürücü ve saha personeli ehliyet, SRC belgeleri ve talep geri bildirimleri.',
            items: {
                employee_document: { label: 'Ehliyet, SRC ve Sağlık Raporu Süre Sonu', inApp: true, email: true },
                leave_results: { label: 'İzin & Mesai Talebi Onay / Red Bildirimi', inApp: true, email: true },
                vehicle_assignment: { label: 'Zimmetli Araç & Görev Atama Bildirimleri', inApp: true, email: false }
            }
        }
    }
};

/**
 * Ensure notification_settings table exists
 */
async function ensureNotificationSettingsTable() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS company_notification_settings (
                company_id INTEGER PRIMARY KEY,
                settings_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (e) {
        try {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS company_notification_settings (
                    company_id INTEGER PRIMARY KEY,
                    settings_json TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
        } catch (err) {}
    }
}

/**
 * Get company notification settings
 */
async function getCompanyNotificationSettings(companyId) {
    try {
        await ensureNotificationSettingsTable();
        const cid = parseInt(companyId, 10);
        const rows = await prisma.$queryRawUnsafe(
            `SELECT settings_json FROM company_notification_settings WHERE company_id = ${cid} LIMIT 1;`
        );

        if (Array.isArray(rows) && rows.length > 0 && rows[0].settings_json) {
            const parsed = JSON.parse(rows[0].settings_json);
            return {
                success: true,
                data: {
                    ...DEFAULT_NOTIFICATION_SETTINGS,
                    ...parsed,
                    rolePreferences: {
                        admin: { ...DEFAULT_NOTIFICATION_SETTINGS.rolePreferences.admin, ...(parsed.rolePreferences?.admin || {}) },
                        accounting: { ...DEFAULT_NOTIFICATION_SETTINGS.rolePreferences.accounting, ...(parsed.rolePreferences?.accounting || {}) },
                        fleet: { ...DEFAULT_NOTIFICATION_SETTINGS.rolePreferences.fleet, ...(parsed.rolePreferences?.fleet || {}) },
                        personnel: { ...DEFAULT_NOTIFICATION_SETTINGS.rolePreferences.personnel, ...(parsed.rolePreferences?.personnel || {}) }
                    }
                }
            };
        }

        return {
            success: true,
            data: DEFAULT_NOTIFICATION_SETTINGS
        };
    } catch (error) {
        log.error('[NotificationEngine] getCompanyNotificationSettings error:', error.message);
        return { success: true, data: DEFAULT_NOTIFICATION_SETTINGS };
    }
}

/**
 * Save company notification settings
 */
async function saveCompanyNotificationSettings(companyId, settings) {
    try {
        await ensureNotificationSettingsTable();
        const cid = parseInt(companyId, 10);
        const jsonStr = JSON.stringify(settings).replace(/'/g, "''");

        // Try upsert
        try {
            await prisma.$executeRawUnsafe(`
                INSERT INTO company_notification_settings (company_id, settings_json, updated_at)
                VALUES (${cid}, '${jsonStr}', CURRENT_TIMESTAMP)
                ON CONFLICT (company_id) DO UPDATE SET
                    settings_json = EXCLUDED.settings_json,
                    updated_at = CURRENT_TIMESTAMP;
            `);
        } catch (pgError) {
            // SQLite fallback
            await prisma.$executeRawUnsafe(`
                INSERT OR REPLACE INTO company_notification_settings (company_id, settings_json, updated_at)
                VALUES (${cid}, '${jsonStr}', CURRENT_TIMESTAMP);
            `);
        }

        log.info(`[NotificationEngine] Saved notification settings for company ${cid}`);
        return { success: true };
    } catch (error) {
        log.error('[NotificationEngine] saveCompanyNotificationSettings error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Ensure user_notification_settings table exists
 */
async function ensureUserNotificationSettingsTable() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS user_notification_settings (
                user_id INTEGER PRIMARY KEY,
                settings_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (e) {
        try {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS user_notification_settings (
                    user_id INTEGER PRIMARY KEY,
                    settings_json TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
        } catch (sqliteErr) {}
    }
}

/**
 * Get standard default preference items tailored to a user's role
 */
function getDefaultPreferencesForRole(role = 'user') {
    const r = (role || '').toLowerCase();
    let matchedKey = 'admin';
    if (r.includes('account') || r.includes('muhasebe') || r.includes('finans')) matchedKey = 'accounting';
    else if (r.includes('fleet') || r.includes('filo') || r.includes('operasyon')) matchedKey = 'fleet';
    else if (r.includes('person') || r.includes('driver') || r.includes('sofor') || r.includes('calisan')) matchedKey = 'personnel';
    else if (r.includes('admin') || r.includes('owner') || r.includes('manager') || r.includes('superadmin')) matchedKey = 'admin';

    const roleDef = DEFAULT_NOTIFICATION_SETTINGS.rolePreferences[matchedKey] || DEFAULT_NOTIFICATION_SETTINGS.rolePreferences.admin;

    return {
        roleKey: matchedKey,
        roleLabel: roleDef.label,
        emailEnabled: true,
        inAppEnabled: true,
        items: roleDef.items
    };
}

/**
 * Get personal notification preferences for a specific user
 */
async function getUserNotificationSettings(userId, userRole = 'admin') {
    try {
        await ensureUserNotificationSettingsTable();
        const uid = parseInt(userId, 10);
        if (!uid) return { success: false, error: 'Geçersiz kullanıcı ID' };

        const defaults = getDefaultPreferencesForRole(userRole);
        const rows = await prisma.$queryRawUnsafe(
            `SELECT settings_json FROM user_notification_settings WHERE user_id = ${uid} LIMIT 1;`
        );

        if (Array.isArray(rows) && rows.length > 0 && rows[0].settings_json) {
            const parsed = JSON.parse(rows[0].settings_json);
            return {
                success: true,
                data: {
                    ...defaults,
                    ...parsed,
                    items: {
                        ...defaults.items,
                        ...(parsed.items || {})
                    }
                }
            };
        }

        return { success: true, data: defaults };
    } catch (err) {
        log.error('[NotificationEngine] getUserNotificationSettings error:', err.message);
        return { success: true, data: getDefaultPreferencesForRole(userRole) };
    }
}

/**
 * Save personal notification preferences for a user
 */
async function saveUserNotificationSettings(userId, settings) {
    try {
        await ensureUserNotificationSettingsTable();
        const uid = parseInt(userId, 10);
        if (!uid) return { success: false, error: 'Geçersiz kullanıcı ID' };

        const jsonStr = JSON.stringify(settings).replace(/'/g, "''");

        try {
            await prisma.$executeRawUnsafe(`
                INSERT INTO user_notification_settings (user_id, settings_json, updated_at)
                VALUES (${uid}, '${jsonStr}', CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) DO UPDATE SET
                    settings_json = EXCLUDED.settings_json,
                    updated_at = CURRENT_TIMESTAMP;
            `);
        } catch (pgError) {
            await prisma.$executeRawUnsafe(`
                INSERT OR REPLACE INTO user_notification_settings (user_id, settings_json, updated_at)
                VALUES (${uid}, '${jsonStr}', CURRENT_TIMESTAMP);
            `);
        }

        log.info(`[NotificationEngine] Saved personal notification settings for user ${uid}`);
        return { success: true };
    } catch (err) {
        log.error('[NotificationEngine] saveUserNotificationSettings error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Generate high-end HTML email template for notifications matching the linear/dark card design
 */
function buildNotificationHtml({ companyName, roleTitle, headline, events = [], summaryText = '' }) {
    const todayStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    let rowsHtml = '';
    if (events.length > 0) {
        rowsHtml = events.map(ev => {
            const evDate = new Date(ev.date);
            const daysUntil = Math.ceil((evDate - new Date()) / (1000 * 60 * 60 * 24));
            
            let badgeBg = 'rgba(20, 184, 166, 0.15)';
            let badgeColor = '#14b8a6';
            let badgeBorder = 'rgba(20, 184, 166, 0.3)';
            let badgeText = `${daysUntil} Gün Kaldı`;

            if (daysUntil < 0) {
                badgeBg = 'rgba(239, 68, 68, 0.15)';
                badgeColor = '#f87171';
                badgeBorder = 'rgba(239, 68, 68, 0.3)';
                badgeText = 'GECİKTİ';
            } else if (daysUntil === 0) {
                badgeBg = 'rgba(249, 115, 22, 0.15)';
                badgeColor = '#fb923c';
                badgeBorder = 'rgba(249, 115, 22, 0.3)';
                badgeText = 'BUGÜN';
            } else if (daysUntil <= 3) {
                badgeBg = 'rgba(234, 179, 8, 0.15)';
                badgeColor = '#facc15';
                badgeBorder = 'rgba(234, 179, 8, 0.3)';
                badgeText = `${daysUntil} Gün Kaldı`;
            }

            const itemTitle = ev.plate 
                ? `${ev.plate} <span style="font-weight: 400; color: #a1a1aa; font-size: 12px;">(${ev.brand || ''} ${ev.model || ''})</span>`
                : (ev.employeeName ? `${ev.employeeName}` : (ev.type || 'Hatırlatma'));

            const detail = ev.description || ev.type || 'İşlem gerekmektedir.';

            return `
                <tr style="border-bottom: 1px solid #1f1f23;">
                    <td style="padding: 14px 16px;">
                        <div style="color: #ffffff; font-size: 13.5px; font-weight: 600;">${itemTitle}</div>
                        <div style="color: #71717a; font-size: 12px; margin-top: 3px; line-height: 1.4;">${detail}</div>
                    </td>
                    <td align="center" style="padding: 14px 16px; color: #a1a1aa; font-size: 12.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: nowrap;">
                        ${evDate.toLocaleDateString('tr-TR')}
                    </td>
                    <td align="right" style="padding: 14px 16px; white-space: nowrap;">
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
                            ${badgeText}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    return `<!DOCTYPE html>
<html lang="tr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline || 'Kontrol Akıllı Bildirim'}</title>
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
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      line-height: 1.35;
      letter-spacing: -0.3px;
    }
    .subtitle {
      font-size: 12px;
      color: #71717a;
      margin-bottom: 20px;
    }
    p {
      margin: 0 0 22px 0;
      font-size: 14.5px;
      line-height: 1.6;
      color: #a1a1aa;
    }
    .events-box {
      width: 100%;
      background: #0c0c0e;
      border: 1px solid #27272a;
      border-radius: 8px;
      overflow: hidden;
      margin: 22px 0;
    }
    .events-table {
      width: 100%;
      border-collapse: collapse;
    }
    .events-table th {
      background: #18181b;
      padding: 10px 16px;
      font-size: 11px;
      font-weight: 600;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      border-bottom: 1px solid #27272a;
    }
    .empty-state {
      padding: 24px;
      background: #0c0c0e;
      border: 1px solid #27272a;
      border-radius: 8px;
      color: #14b8a6;
      font-size: 13.5px;
      text-align: center;
      margin: 22px 0;
    }
    .btn-wrap {
      margin: 28px 0 10px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      padding: 12px 28px;
      background: #ffffff;
      color: #09090b !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.1px;
    }
    .notice {
      margin-top: 26px;
      padding-top: 20px;
      border-top: 1px solid #27272a;
      font-size: 12px;
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
      .events-table th, .events-table td { padding: 8px 10px; }
    }
  </style>
</head>
<body>
  <table class="wrapper" role="presentation" width="100%">
    <tr>
      <td align="center">
        <table class="card" role="presentation">
          <!-- Header -->
          <tr>
            <td class="header">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left">
                    <span class="brand">KONTROL</span>
                  </td>
                  <td align="right">
                    <span class="role-badge">${roleTitle || 'Bildirim'}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content">
              <h1>${headline}</h1>
              <div class="subtitle">
                ${companyName || 'Kontrol SaaS'} • ${todayStr}
              </div>
              <p>${summaryText || 'Aşağıda dikkat etmeniz gereken ve süresi yaklaşan operasyonel/finansal kayıtlar listelenmiştir.'}</p>

              <!-- Events Box -->
              ${events.length > 0 ? `
              <div class="events-box">
                <table class="events-table" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <thead>
                    <tr>
                      <th align="left">Kayıt / İşlem</th>
                      <th align="center">Son Tarih</th>
                      <th align="right">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml}
                  </tbody>
                </table>
              </div>
              ` : `
              <div class="empty-state">
                Tüm kayıtlar güncel. Yaklaşan veya gecikmiş kritik bir işlem bulunmamaktadır.
              </div>
              `}

              <!-- CTA Button -->
              <div class="btn-wrap">
                <a href="https://app.kontrol.im" target="_blank" class="btn">Kontrol Paneline Git →</a>
              </div>

              <!-- Notice -->
              <div class="notice">
                Bu e-posta, Kontrol Akıllı Bildirim Motoru tarafından şirketinizin rol bazlı bildirim tercihleri doğrultusunda iletilmiştir.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer">
              Bildirim tercihlerinizi Kontrol App &gt; <strong>Ayarlar &gt; Bildirimler</strong> sekmesinden düzenleyebilirsiniz.<br>
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
 * Filter upcoming events tailored to a specific user and their personal settings
 */
function filterEventsForUser(events, user, userSettings) {
    const roleKey = userSettings.roleKey || 'admin';
    const items = userSettings.items || {};

    return events.filter(e => {
        // If the item configuration exists and user explicitly turned off email for it
        if (items[e.eventType] && items[e.eventType].email === false) {
            return false;
        }

        // If driver / personnel: only show events specifically for this employee or their assignments
        if (roleKey === 'personnel') {
            if (e.eventType === 'employee_document' && e.employeeId === user.employee_id) return true;
            if (e.eventType === 'approval_center' && e.employeeId === user.employee_id) return true;
            return false;
        }

        // If accounting: only check/promissory, advance requests, finance
        if (roleKey === 'accounting') {
            return ['finance_check', 'advance_requests', 'cash_flow_warning'].includes(e.eventType);
        }

        // If fleet: inspections, insurances, maintenances
        if (roleKey === 'fleet') {
            return ['inspection', 'insurance', 'maintenance'].includes(e.eventType);
        }

        // If admin / company owner: all events
        return true;
    });
}

/**
 * Professional SaaS Notification Dispatch:
 * Scans company events and routes tailored digests directly to each company user's own email account
 */
async function runCompanyNotificationScan(companyId, options = {}) {
    try {
        const cid = parseInt(companyId, 10);
        const settingsRes = await getCompanyNotificationSettings(cid);
        const companySettings = settingsRes.data;

        // If company has completely disabled email notifications and not forced
        if (!companySettings.emailNotificationsEnabled && !options.force) {
            return { success: true, message: 'Şirket genelinde e-posta bildirimleri devre dışı.' };
        }

        const company = await prisma.companies.findUnique({
            where: { id: cid },
            select: {
                id: true,
                name: true,
                users: {
                    select: { id: true, email: true, username: true, full_name: true, role: true }
                }
            }
        });

        if (!company) {
            return { success: false, error: 'Şirket bulunamadı.' };
        }

        // Fetch all active users belonging to this company
        let companyUsers = await prisma.users.findMany({
            where: {
                is_active: 1,
                OR: [
                    { companies: { some: { id: cid } } },
                    { employee: { company_id: cid, is_archived: 0, status: 'active' } },
                    { id: company.users?.id || 0 }
                ]
            },
            select: {
                id: true,
                email: true,
                username: true,
                full_name: true,
                role: true,
                employee_id: true
            }
        });

        // Ensure company owner user is included
        if (company.users && !companyUsers.some(u => u.id === company.users.id)) {
            companyUsers.push(company.users);
        }

        if (companyUsers.length === 0) {
            return { success: true, message: 'Şirkette bildirim alacak aktif kullanıcı bulunamadı.' };
        }

        // Fetch upcoming 30 days events
        const eventsRes = await getUpcomingEvents(cid);
        const allEvents = eventsRes.success ? eventsRes.data : [];

        // Parse CC / External backup emails
        const rawCc = companySettings.notificationEmails || '';
        const ccEmails = rawCc
            .split(',')
            .map(e => e.trim())
            .filter(e => e && e.includes('@'));
        const ccString = ccEmails.length > 0 ? ccEmails.join(', ') : null;

        const todayStr = new Date().toISOString().split('T')[0];
        let sentCount = 0;
        let ccSent = false;

        for (const user of companyUsers) {
            if (!user.email || !user.email.includes('@')) continue;

            // Fetch user's personal preferences
            const userSettingsRes = await getUserNotificationSettings(user.id, user.role);
            const userSettings = userSettingsRes.data;

            // If user turned off email notifications in their personal profile
            if (userSettings.emailEnabled === false && !options.force) continue;

            // Filter events relevant to this specific user
            const userEvents = filterEventsForUser(allEvents, user, userSettings);

            if (userEvents.length === 0 && !options.sendIfEmpty) {
                continue;
            }

            const cacheKey = `notif-user-${user.id}-${cid}-${todayStr}`;
            if (sentAlertCache.has(cacheKey) && !options.force) {
                log.info(`[NotificationEngine] User ${user.email} already received notification digest today.`);
                continue;
            }

            const html = buildNotificationHtml({
                companyName: company.name,
                roleTitle: userSettings.roleLabel || 'Operasyon Bildirimi',
                headline: `Merhaba ${user.full_name || user.username}, Günlük Hatırlatmalarınız`,
                events: userEvents,
                summaryText: `Görev alanınız ve bildirim tercihleriniz kapsamında dikkat etmeniz gereken ${userEvents.length} adet işlem aşağıdadır.`
            });

            // If this is an admin / company owner user, attach the backup CC emails
            const isAdminUser = user.role === 'admin' || user.role === 'company_admin' || user.id === company.users?.id;
            let mailCc = undefined;
            if (isAdminUser && !ccSent && ccString) {
                mailCc = ccString;
                ccSent = true;
            }

            const subject = `[Kontrol] ${company.name} - Günlük Operasyonel Özet (${userEvents.length} İşlem)`;
            const mailRes = await mailerService.sendCustomHtmlEmail({
                to: user.email,
                cc: mailCc,
                subject,
                html
            });

            if (mailRes.success) {
                sentCount++;
                sentAlertCache.add(cacheKey);
                log.info(`[NotificationEngine] Sent tailored digest email to ${user.email} (${user.role}) ${mailCc ? `[CC: ${mailCc}]` : ''} for company ${cid}`);
            }
        }

        // If CC backup emails were configured but not yet reached via user digests, send standalone company summary
        if (!ccSent && ccEmails.length > 0 && allEvents.length > 0) {
            const ccCacheKey = `notif-cc-${cid}-${todayStr}`;
            if (!sentAlertCache.has(ccCacheKey) || options.force) {
                const html = buildNotificationHtml({
                    companyName: company.name,
                    roleTitle: 'Şirket Harici Bildirim Özeti',
                    headline: `${company.name} Günlük Hatırlatma Özeti`,
                    events: allEvents,
                    summaryText: `Şirketinize ait yaklaşan ve dikkat edilmesi gereken ${allEvents.length} adet işlem özeti aşağıdadır.`
                });
                const subject = `[Kontrol] ${company.name} - Konsolide Operasyonel Özet (${allEvents.length} İşlem)`;
                const mailRes = await mailerService.sendCustomHtmlEmail({
                    to: ccEmails[0],
                    cc: ccEmails.slice(1).join(', ') || undefined,
                    subject,
                    html
                });
                if (mailRes.success) {
                    sentCount++;
                    sentAlertCache.add(ccCacheKey);
                    log.info(`[NotificationEngine] Sent standalone company digest to backup CC: ${ccString} for company ${cid}`);
                }
            }
        }

        return {
            success: true,
            sentCount,
            totalEvents: allEvents.length,
            message: `${sentCount} şirket kullanıcısına ${ccString ? '(ve harici CC adreslerine) ' : ''}kişiselleştirilmiş e-posta bildirimi iletildi.`
        };
    } catch (error) {
        log.error('[NotificationEngine] runCompanyNotificationScan error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send a test notification email for a specific role
 */
async function sendTestNotificationEmail({ companyId, recipientEmail, roleKey = 'admin' }) {
    try {
        if (!recipientEmail || !recipientEmail.includes('@')) {
            return { success: false, error: 'Geçerli bir test e-posta adresi belirtiniz.' };
        }

        let companyName = 'Kontrol Filo & Operasyon A.Ş.';
        let ccToUse = undefined;
        if (companyId) {
            const comp = await prisma.companies.findUnique({
                where: { id: parseInt(companyId, 10) },
                select: { name: true }
            });
            if (comp) companyName = comp.name;

            const compSettings = await getCompanyNotificationSettings(companyId);
            const rawCc = compSettings.data?.notificationEmails || '';
            const ccList = rawCc.split(',').map(e => e.trim()).filter(e => e && e.includes('@') && e !== recipientEmail);
            if (ccList.length > 0) ccToUse = ccList.join(', ');
        }

        const roleConfig = DEFAULT_NOTIFICATION_SETTINGS.rolePreferences[roleKey] || DEFAULT_NOTIFICATION_SETTINGS.rolePreferences.admin;

        // Sample test events
        const mockEvents = [
            {
                type: 'Tüvtürk Muayene',
                plate: '34 KTR 105',
                brand: 'Ford',
                model: 'Transit 2023',
                date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'Yıllık periyodik muayene süresi doluyor (2 gün kaldı).'
            },
            {
                type: 'Kasko Poliçesi',
                plate: '06 ABC 998',
                brand: 'Mercedes-Benz',
                model: 'Actros',
                date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'Poliçe süresi doldu! Acil yenileme gerekmektedir.'
            },
            {
                type: 'Çek / Senet Vadesi',
                plate: null,
                employeeName: null,
                date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'Portföy No: ÇK-2026-881 | Tutar: 85.000,00 ₺ (Garanti BBVA)'
            },
            {
                type: 'SRC Belgesi Süre Sonu',
                plate: null,
                employeeName: 'Mehmet Yılmaz (Sürücü)',
                date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'SRC-4 Belgesi yenileme süresi yaklaşıyor.'
            }
        ];

        const html = buildNotificationHtml({
            companyName,
            roleTitle: roleConfig.label,
            headline: `[TEST] ${roleConfig.label} Akıllı Bildirim Şablonu`,
            events: mockEvents,
            summaryText: 'Bu bir test e-postasıdır. SMTP bağlantınız ve e-posta bildirim motorunuzun çalıştığını doğrulamak amacıyla gönderilmiştir.'
        });

        const subject = `[TEST] Kontrol Bildirim Motoru: ${roleConfig.label} Test İletisi`;
        const res = await mailerService.sendCustomHtmlEmail({ to: recipientEmail, cc: ccToUse, subject, html });

        if (res.success) {
            return {
                success: true,
                message: `Test e-postası "${recipientEmail}" adresine ${ccToUse ? `(ve Harici CC: "${ccToUse}") ` : ''}başarıyla gönderildi.`
            };
        } else {
            return {
                success: false,
                error: res.error || 'E-posta gönderilemedi. Lütfen SMTP ayarlarınızı kontrol edin.'
            };
        }
    } catch (error) {
        log.error('[NotificationEngine] sendTestNotificationEmail error:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    DEFAULT_NOTIFICATION_SETTINGS,
    getCompanyNotificationSettings,
    saveCompanyNotificationSettings,
    getUserNotificationSettings,
    saveUserNotificationSettings,
    runCompanyNotificationScan,
    sendTestNotificationEmail
};
