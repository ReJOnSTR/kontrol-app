const { getPrismaClient } = require('../prismaClient');
const prisma = getPrismaClient();

let log = console;
try {
    log = require('electron-log');
} catch (e) {}

const DEFAULT_COMPANY_SETTINGS = {
    // 0. Modül Yetkileri / Feature Flags
    modules: {
        fleet: true,
        finance: true,
        meals: true,
        hr: true,
        works: true,
        customers: true
    },
    // 1. İK & Mesai Katsayıları
    hr: {
        weekdayMultiplier: 1.5,
        sundayMultiplier: 1.5,
        holidayMultiplier: 2.0,
        gurbetMultiplier: 1.0,
        weekdayHoursPerLeave: 8,
        sundayDaysPerLeave: 1,
        holidayDaysPerLeave: 1,
        defaultAdvanceAmount: 0,
        weeklyWorkHours: 45
    },
    // 2. Finans Politikaları
    finance: {
        defaultCurrency: 'TRY', // TRY, USD, EUR
        defaultVatRate: 20,
        invoiceDueReminderDays: 7,
        checkDueReminderDays: 15,
        expenseApprovalLimit: 5000
    },
    // 3. İş & Operasyon
    works: {
        defaultStatus: 'pending',
        requireCustomerApproval: false,
        autoArchiveCompletedDays: 30
    },
    // 4. Cari & Müşteri
    customers: {
        defaultPaymentTermDays: 30,
        creditLimitWarning: true
    },
    // 5. Harici Entegrasyonlar
    integrations: {
        arvento: {
            enabled: false,
            username: '',
            pin1: '',
            pin2: '',
            language: 'tr',
            interval: 3
        }
    }
};

const DEFAULT_USER_PREFERENCES = {
    // Görünüm & Tema
    theme: 'dark',
    // Ekran Kilidi
    lock: {
        enabled: false,
        timeout: 5,
        useCustomPassword: false,
        customPassword: ''
    },
    // Kişisel UI Bildirimleri
    notifications: {
        maintenance: true,
        inspection: true,
        insurance: true,
        employee_document: true,
        finance_check: true,
        approval_center: true
    },
    // Tablo & UI Tercihleri
    ui: {
        tablePageSize: 10,
        compactMode: false
    }
};

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

function deepMerge(target, source) {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

/**
 * Ensure settings tables exist in database
 */
async function ensureSettingsTables() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS company_settings (
                company_id INTEGER PRIMARY KEY,
                settings_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (e) {
        try {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS company_settings (
                    company_id INTEGER PRIMARY KEY,
                    settings_json TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
        } catch (sqliteErr) {}
    }

    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id INTEGER PRIMARY KEY,
                preferences_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (e) {
        try {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS user_preferences (
                    user_id INTEGER PRIMARY KEY,
                    preferences_json TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
        } catch (sqliteErr) {}
    }
}

/**
 * Get company settings
 */
async function getCompanyDbSettings(companyId) {
    try {
        await ensureSettingsTables();
        const cid = parseInt(companyId, 10);
        if (!cid) return { success: true, data: DEFAULT_COMPANY_SETTINGS };

        const rows = await prisma.$queryRawUnsafe(
            `SELECT settings_json FROM company_settings WHERE company_id = ${cid} LIMIT 1;`
        );

        if (Array.isArray(rows) && rows.length > 0 && rows[0].settings_json) {
            try {
                const parsed = JSON.parse(rows[0].settings_json);
                const merged = deepMerge(DEFAULT_COMPANY_SETTINGS, parsed);
                return { success: true, data: merged };
            } catch (pErr) {
                log.error('[systemSettings] JSON parse error:', pErr.message);
            }
        }

        return { success: true, data: DEFAULT_COMPANY_SETTINGS };
    } catch (error) {
        log.error('[systemSettings] getCompanyDbSettings error:', error.message);
        return { success: true, data: DEFAULT_COMPANY_SETTINGS };
    }
}

/**
 * Save company settings
 */
async function saveCompanyDbSettings(companyId, settings) {
    try {
        await ensureSettingsTables();
        const cid = parseInt(companyId, 10);
        if (!cid) return { success: false, error: 'Geçersiz şirket kimliği' };

        const current = await getCompanyDbSettings(cid);
        const merged = deepMerge(current.data || DEFAULT_COMPANY_SETTINGS, settings || {});
        const jsonStr = JSON.stringify(merged).replace(/'/g, "''");

        try {
            await prisma.$executeRawUnsafe(`
                INSERT INTO company_settings (company_id, settings_json, updated_at)
                VALUES (${cid}, '${jsonStr}', CURRENT_TIMESTAMP)
                ON CONFLICT (company_id) DO UPDATE SET
                    settings_json = EXCLUDED.settings_json,
                    updated_at = CURRENT_TIMESTAMP;
            `);
        } catch (pgError) {
            await prisma.$executeRawUnsafe(`
                INSERT OR REPLACE INTO company_settings (company_id, settings_json, updated_at)
                VALUES (${cid}, '${jsonStr}', CURRENT_TIMESTAMP);
            `);
        }

        log.info(`[systemSettings] Saved company settings for company ${cid}`);
        return { success: true, data: merged };
    } catch (error) {
        log.error('[systemSettings] saveCompanyDbSettings error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get user preferences
 */
async function getUserPreferences(userId) {
    try {
        await ensureSettingsTables();
        const uid = parseInt(userId, 10);
        if (!uid) return { success: true, data: DEFAULT_USER_PREFERENCES };

        const rows = await prisma.$queryRawUnsafe(
            `SELECT preferences_json FROM user_preferences WHERE user_id = ${uid} LIMIT 1;`
        );

        if (Array.isArray(rows) && rows.length > 0 && rows[0].preferences_json) {
            try {
                const parsed = JSON.parse(rows[0].preferences_json);
                const merged = deepMerge(DEFAULT_USER_PREFERENCES, parsed);
                return { success: true, data: merged };
            } catch (pErr) {
                log.error('[systemSettings] user preferences parse error:', pErr.message);
            }
        }

        return { success: true, data: DEFAULT_USER_PREFERENCES };
    } catch (error) {
        log.error('[systemSettings] getUserPreferences error:', error.message);
        return { success: true, data: DEFAULT_USER_PREFERENCES };
    }
}

/**
 * Save user preferences
 */
async function saveUserPreferences(userId, preferences) {
    try {
        await ensureSettingsTables();
        const uid = parseInt(userId, 10);
        if (!uid) return { success: false, error: 'Geçersiz kullanıcı kimliği' };

        const current = await getUserPreferences(uid);
        const merged = deepMerge(current.data || DEFAULT_USER_PREFERENCES, preferences || {});
        const jsonStr = JSON.stringify(merged).replace(/'/g, "''");

        try {
            await prisma.$executeRawUnsafe(`
                INSERT INTO user_preferences (user_id, preferences_json, updated_at)
                VALUES (${uid}, '${jsonStr}', CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) DO UPDATE SET
                    preferences_json = EXCLUDED.preferences_json,
                    updated_at = CURRENT_TIMESTAMP;
            `);
        } catch (pgError) {
            await prisma.$executeRawUnsafe(`
                INSERT OR REPLACE INTO user_preferences (user_id, preferences_json, updated_at)
                VALUES (${uid}, '${jsonStr}', CURRENT_TIMESTAMP);
            `);
        }

        log.info(`[systemSettings] Saved user preferences for user ${uid}`);
        return { success: true, data: merged };
    } catch (error) {
        log.error('[systemSettings] saveUserPreferences error:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    DEFAULT_COMPANY_SETTINGS,
    DEFAULT_USER_PREFERENCES,
    ensureSettingsTables,
    getCompanyDbSettings,
    saveCompanyDbSettings,
    getUserPreferences,
    saveUserPreferences
};
