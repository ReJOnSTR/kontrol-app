const { getPrismaClient } = require('../prismaClient');
const prisma = getPrismaClient();
const { encryptSecret, decryptSecret } = require('../security/cryptoVault');

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
    accent_color: 'teal',
    ui_scale: 100,
    // Ekran Kilidi
    lock: {
        enabled: false,
        timeout: 5,
        useCustomPassword: false,
        customPassword: ''
    },
    // Hızlı Aksiyon Kısayol Tercihleri
    dashboardActions: {
        fleet: null,
        hr: null,
        finance: null
    },
    // Kapatılan / Okundu Bildirimler
    dismissedEvents: [],
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

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function deepMerge(target, source) {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (FORBIDDEN_KEYS.has(key)) return;
            if (isObject(source[key])) {
                if (!Object.prototype.hasOwnProperty.call(target, key)) {
                    output[key] = deepMerge({}, source[key]);
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                output[key] = source[key];
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

        const rows = await prisma.$queryRaw`
            SELECT settings_json FROM company_settings WHERE company_id = ${cid} LIMIT 1;
        `;

        if (Array.isArray(rows) && rows.length > 0 && rows[0].settings_json) {
            try {
                const parsed = JSON.parse(rows[0].settings_json);
                const merged = deepMerge(DEFAULT_COMPANY_SETTINGS, parsed);
                if (merged?.integrations?.arvento) {
                    merged.integrations.arvento.pin1 = decryptSecret(merged.integrations.arvento.pin1);
                    merged.integrations.arvento.pin2 = decryptSecret(merged.integrations.arvento.pin2);
                }
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
        const toStore = structuredClone(merged);
        if (toStore?.integrations?.arvento) {
            if (toStore.integrations.arvento.pin1) toStore.integrations.arvento.pin1 = encryptSecret(toStore.integrations.arvento.pin1);
            if (toStore.integrations.arvento.pin2) toStore.integrations.arvento.pin2 = encryptSecret(toStore.integrations.arvento.pin2);
        }
        const jsonStr = JSON.stringify(toStore);

        try {
            await prisma.$executeRaw`
                INSERT INTO company_settings (company_id, settings_json, updated_at)
                VALUES (${cid}, ${jsonStr}, CURRENT_TIMESTAMP)
                ON CONFLICT (company_id) DO UPDATE SET
                    settings_json = EXCLUDED.settings_json,
                    updated_at = CURRENT_TIMESTAMP;
            `;
        } catch (pgError) {
            await prisma.$executeRaw`
                INSERT OR REPLACE INTO company_settings (company_id, settings_json, updated_at)
                VALUES (${cid}, ${jsonStr}, CURRENT_TIMESTAMP);
            `;
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

        const rows = await prisma.$queryRaw`
            SELECT preferences_json FROM user_preferences WHERE user_id = ${uid} LIMIT 1;
        `;

        if (Array.isArray(rows) && rows.length > 0 && rows[0].preferences_json) {
            try {
                const parsed = JSON.parse(rows[0].preferences_json);
                const merged = deepMerge(DEFAULT_USER_PREFERENCES, parsed);
                if (merged?.lock?.customPassword) {
                    merged.lock.customPassword = decryptSecret(merged.lock.customPassword);
                }
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
        const uid = parseInt(userId?.userId || userId, 10);
        if (!uid) return { success: false, error: 'Geçersiz kullanıcı kimliği' };

        const current = await getUserPreferences(uid);
        const merged = deepMerge(current.data || DEFAULT_USER_PREFERENCES, (userId?.preferences !== undefined ? userId.preferences : preferences) || {});

        const currentJson = JSON.stringify(current.data || {});
        const newJson = JSON.stringify(merged);
        if (currentJson === newJson) {
            return { success: true, data: merged };
        }

        const toStore = structuredClone(merged);
        if (toStore?.lock?.customPassword) {
            toStore.lock.customPassword = encryptSecret(toStore.lock.customPassword);
        }
        const storeJson = JSON.stringify(toStore);

        try {
            await prisma.$executeRaw`
                INSERT INTO user_preferences (user_id, preferences_json, updated_at)
                VALUES (${uid}, ${storeJson}, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) DO UPDATE SET
                    preferences_json = EXCLUDED.preferences_json,
                    updated_at = CURRENT_TIMESTAMP;
            `;
        } catch (pgError) {
            await prisma.$executeRaw`
                INSERT OR REPLACE INTO user_preferences (user_id, preferences_json, updated_at)
                VALUES (${uid}, ${storeJson}, CURRENT_TIMESTAMP);
            `;
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
