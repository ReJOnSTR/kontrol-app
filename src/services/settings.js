export const settingsService = {
    get: () => window.electronAPI.getSettings(),
    save: (settings) => window.electronAPI.saveSettings(settings),
    selectFolder: () => window.electronAPI.selectFolder(),
    getCompanyDbSettings: (companyId) => {
        if (window.electronAPI?.getCompanyDbSettings) {
            return window.electronAPI.getCompanyDbSettings(companyId);
        }
        return Promise.resolve({ success: false, error: 'API not supported' });
    },
    saveCompanyDbSettings: (companyId, settings) => {
        if (window.electronAPI?.saveCompanyDbSettings) {
            return window.electronAPI.saveCompanyDbSettings(companyId, settings);
        }
        return Promise.resolve({ success: false, error: 'API not supported' });
    },
    getUserPreferences: (userId) => {
        if (window.electronAPI?.getUserPreferences) {
            return window.electronAPI.getUserPreferences(userId);
        }
        return Promise.resolve({ success: false, error: 'API not supported' });
    },
    saveUserPreferences: (userId, preferences) => {
        if (window.electronAPI?.saveUserPreferences) {
            return window.electronAPI.saveUserPreferences(userId, preferences);
        }
        return Promise.resolve({ success: false, error: 'API not supported' });
    }
}

