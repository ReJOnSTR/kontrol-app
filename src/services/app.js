export const appService = {
    getVersion: () => window.electronAPI?.getAppVersion ? window.electronAPI.getAppVersion() : Promise.resolve('1.0.0'),
    checkForUpdates: () => window.electronAPI?.checkForUpdates ? window.electronAPI.checkForUpdates() : Promise.resolve({ success: true, updateAvailable: false }),
    quitAndInstall: () => window.electronAPI?.quitAndInstall ? window.electronAPI.quitAndInstall() : Promise.resolve({ success: true }),

    // PC Features with safe fallbacks
    getMemoryUsage: () => window.electronAPI?.getMemoryUsage ? window.electronAPI.getMemoryUsage() : Promise.resolve({ success: true, memory: null }),
    getDiskUsage: () => window.electronAPI?.getDiskUsage ? window.electronAPI.getDiskUsage() : Promise.resolve({ success: true, disk: null }),

    // Notifications
    showNotification: (title, body) => window.electronAPI?.showNotification ? window.electronAPI.showNotification(title, body) : Promise.resolve({ success: true }),

    // Utils
    openExternal: (url) => window.electronAPI?.openExternal ? window.electronAPI.openExternal(url) : window.open(url, '_blank'),
    downloadGenelge: (url) => window.electronAPI?.downloadGenelge ? window.electronAPI.downloadGenelge(url) : window.open(url, '_blank'),
    selectFile: () => window.electronAPI?.selectFile ? window.electronAPI.selectFile() : Promise.resolve({ canceled: true, filePaths: [] }),

    // UI/Context
    showContextMenu: (items) => window.electronAPI?.showContextMenu ? window.electronAPI.showContextMenu(items) : undefined,
    onContextAction: (callback) => window.electronAPI?.onContextAction ? window.electronAPI.onContextAction(callback) : () => {},
    removePCListeners: () => window.electronAPI?.removePCListeners ? window.electronAPI.removePCListeners() : () => {}
}
