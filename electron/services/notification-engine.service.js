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
 * Generate high-end HTML email template for notifications
 */
function buildNotificationHtml({ companyName, roleTitle, headline, events = [], summaryText = '' }) {
    const todayStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    let rowsHtml = '';
    if (events.length > 0) {
        rowsHtml = events.map(ev => {
            const evDate = new Date(ev.date);
            const daysUntil = Math.ceil((evDate - new Date()) / (1000 * 60 * 60 * 24));
            
            let badgeBg = '#f1f5f9';
            let badgeColor = '#475569';
            let badgeText = `${daysUntil} Gün`;

            if (daysUntil < 0) {
                badgeBg = '#fee2e2';
                badgeColor = '#b91c1c';
                badgeText = '🔴 GECİKTİ!';
            } else if (daysUntil === 0) {
                badgeBg = '#ffedd5';
                badgeColor = '#c2410c';
                badgeText = '🟠 BUGÜN!';
            } else if (daysUntil <= 3) {
                badgeBg = '#fef3c7';
                badgeColor = '#b45309';
                badgeText = `⚠️ ${daysUntil} Gün`;
            } else {
                badgeBg = '#e0f2fe';
                badgeColor = '#0369a1';
                badgeText = `📅 ${daysUntil} Gün`;
            }

            const itemTitle = ev.plate 
                ? `<strong>${ev.plate}</strong> (${ev.brand || ''} ${ev.model || ''})`
                : (ev.employeeName ? `<strong>${ev.employeeName}</strong>` : (ev.type || 'Hatırlatma'));

            const detail = ev.description || ev.type || 'İşlem gerekmektedir.';

            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 16px; font-size: 14px; color: #1e293b;">
                        <div>${itemTitle}</div>
                        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${detail}</div>
                    </td>
                    <td style="padding: 12px 16px; font-size: 13px; color: #475569; text-align: center; white-space: nowrap;">
                        ${evDate.toLocaleDateString('tr-TR')}
                    </td>
                    <td style="padding: 12px 16px; text-align: right; white-space: nowrap;">
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: ${badgeBg}; color: ${badgeColor};">
                            ${badgeText}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kontrol Akıllı Bildirim</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
        <tr>
            <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px 35px; color: #ffffff;">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td>
                                        <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
                                            KONTROL <span style="font-size: 13px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background-color: #3b82f6; color: #ffffff; vertical-align: middle; margin-left: 6px;">SaaS</span>
                                        </div>
                                        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
                                            ${companyName || 'Şirket Operasyon Portalı'} • ${todayStr}
                                        </div>
                                    </td>
                                    <td align="right">
                                        <span style="font-size: 12px; padding: 6px 12px; background: rgba(255,255,255,0.1); border-radius: 8px; color: #e2e8f0; font-weight: 500;">
                                            ${roleTitle}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 35px 35px 25px 35px;">
                            <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #0f172a;">
                                ${headline}
                            </h2>
                            <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                                ${summaryText || 'Aşağıda dikkat etmeniz gereken ve süresi yaklaşan operasyonel/finansal kayıtlar listelenmiştir.'}
                            </p>

                            <!-- Events Table -->
                            ${events.length > 0 ? `
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 15px;">
                                <thead>
                                    <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                        <th align="left" style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Kayıt / İşlem</th>
                                        <th align="center" style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Son Tarih</th>
                                        <th align="right" style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                            </table>
                            ` : `
                            <div style="padding: 20px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; font-size: 14px; text-align: center;">
                                ✅ Harika! Yaklaşan veya gecikmiş kritik bir işlem bulunmamaktadır.
                            </div>
                            `}

                            <!-- CTA Button -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                                <tr>
                                    <td align="center">
                                        <a href="https://app.kontrol.im" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);">
                                            Kontrol Paneline Giriş Yap →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 35px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
                            Bu e-posta, Kontrol Otomatik Bildirim Motoru tarafından şirketinizin tercihleri doğrultusunda gönderilmiştir.<br />
                            Bildirim tercihlerinizi Kontrol App > <strong>Ayarlar > Bildirimler</strong> menüsünden yönetebilirsiniz.
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

/**
 * Filter upcoming events for a specific user role based on preferences
 */
function getEventsForRole(roleKey, events, roleSettings) {
    if (!roleSettings || !roleSettings.items) return [];

    return events.filter(e => {
        const itemConfig = roleSettings.items[e.eventType];
        if (!itemConfig) {
            // General fallback
            if (roleKey === 'admin') return true;
            if (roleKey === 'fleet' && ['inspection', 'insurance', 'maintenance'].includes(e.eventType)) return true;
            if (roleKey === 'accounting' && ['finance_check', 'advance_requests'].includes(e.eventType)) return true;
            if (roleKey === 'personnel' && ['employee_document', 'leave_results'].includes(e.eventType)) return true;
            return false;
        }
        return itemConfig.email === true;
    });
}

/**
 * Run notification scan for a company and dispatch emails if enabled
 */
async function runCompanyNotificationScan(companyId, options = {}) {
    try {
        const cid = parseInt(companyId, 10);
        const settingsRes = await getCompanyNotificationSettings(cid);
        const settings = settingsRes.data;

        if (!settings.emailNotificationsEnabled && !options.force) {
            return { success: true, message: 'E-posta bildirimleri şirket ayarlarında devre dışı.' };
        }

        // Get company details
        const company = await prisma.companies.findUnique({
            where: { id: cid },
            select: { id: true, name: true, email: true }
        });

        if (!company) {
            return { success: false, error: 'Şirket bulunamadı.' };
        }

        // Get recipients
        let recipients = [];
        if (settings.notificationEmails && settings.notificationEmails.trim()) {
            recipients = settings.notificationEmails
                .split(',')
                .map(s => s.trim())
                .filter(s => s.includes('@'));
        }

        if (recipients.length === 0 && company.email && company.email.includes('@')) {
            recipients = [company.email.trim()];
        }

        if (recipients.length === 0) {
            return { success: true, message: 'Bildirim gönderilecek geçerli e-posta adresi bulunamadı.' };
        }

        // Fetch upcoming events
        const eventsRes = await getUpcomingEvents(cid);
        const allEvents = eventsRes.success ? eventsRes.data : [];

        // Check each role and see if there are matching events
        const todayStr = new Date().toISOString().split('T')[0];
        let sentCount = 0;

        for (const [roleKey, roleConfig] of Object.entries(settings.rolePreferences)) {
            const roleEvents = getEventsForRole(roleKey, allEvents, roleConfig);

            if (roleEvents.length === 0 && !options.sendIfEmpty) {
                continue;
            }

            const cacheKey = `notif-${cid}-${roleKey}-${todayStr}`;
            if (sentAlertCache.has(cacheKey) && !options.force) {
                log.info(`[NotificationEngine] Cache hit: notification already sent today for ${cacheKey}`);
                continue;
            }

            const html = buildNotificationHtml({
                companyName: company.name,
                roleTitle: roleConfig.label,
                headline: `${roleConfig.label} İçin Yaklaşan Hatırlatmalar`,
                events: roleEvents,
                summaryText: `Sisteme kayıtlı ${roleEvents.length} adet işlem için süresi yaklaşan veya geciken kayıtlar aşağıdadır.`
            });

            for (const recipient of recipients) {
                const subject = `[Kontrol Bildirim] ${company.name} - ${roleConfig.label} Hatırlatması (${roleEvents.length} İşlem)`;
                const mailRes = await mailerService.sendCustomHtmlEmail(recipient, subject, html);
                if (mailRes.success) {
                    sentCount++;
                }
            }

            sentAlertCache.add(cacheKey);
        }

        return {
            success: true,
            sentCount,
            totalEvents: allEvents.length,
            message: `${sentCount} adet e-posta bildirimi başarıyla iletildi.`
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
        if (companyId) {
            const comp = await prisma.companies.findUnique({
                where: { id: parseInt(companyId, 10) },
                select: { name: true }
            });
            if (comp) companyName = comp.name;
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
        const res = await mailerService.sendCustomHtmlEmail(recipientEmail, subject, html);

        if (res.success) {
            return {
                success: true,
                message: `Test e-postası "${recipientEmail}" adresine başarıyla gönderildi.`
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
    runCompanyNotificationScan,
    sendTestNotificationEmail
};
