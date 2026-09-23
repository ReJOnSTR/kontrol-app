const { app, BrowserWindow, ipcMain, dialog, Menu, nativeImage, globalShortcut, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const Store = require('electron-store')
const AdmZip = require('adm-zip')
const db = require('./prismaService')
const { getPrismaClient, runAutoMigrations } = require('./prismaClient')
const log = require('./logger') // Import logger
const { startAdminServer, stopAdminServer } = require('./adminServer')
const mfaService = require('./services/mfa.service')
const auditService = require('./services/audit.service')
const sessionService = require('./services/session.service')
const emailTemplateService = require('./services/emailTemplate.service')


// Optional: Override console to correct log file
// console.log = log.log;

app.setName('Kontrol')

function migrateLegacyAppData() {
    try {
        const userDataPath = app.getPath('userData');
        const appDataPath = app.getPath('appData');
        const homeDir = app.getPath('home');

        const legacyAppDirs = [
            path.join(appDataPath, 'kontrol-app'),
            path.join(appDataPath, 'AracTakip'),
            path.join(appDataPath, 'muayen'),
            path.join(homeDir, 'Library', 'Application Support', 'kontrol-app'),
            path.join(homeDir, 'Library', 'Application Support', 'AracTakip'),
            path.join(homeDir, 'Library', 'Application Support', 'muayen'),
        ];

        // 1. Migrate Chromium Local Storage
        const targetLocalStorage = path.join(userDataPath, 'Local Storage');
        if (!fs.existsSync(targetLocalStorage)) {
            for (const legacyAppDir of legacyAppDirs) {
                const legacyDir = path.join(legacyAppDir, 'Local Storage');
                if (fs.existsSync(legacyDir)) {
                    log.info(`Migrating Chromium Local Storage: ${legacyDir} -> ${targetLocalStorage}`);
                    if (fs.cpSync) {
                        fs.cpSync(legacyDir, targetLocalStorage, { recursive: true });
                    }
                    break;
                }
            }
        }

        // 2. Migrate uploaded files (PDFs, images, documents)
        const targetFilesDir = path.join(userDataPath, 'files');
        if (!fs.existsSync(targetFilesDir) || fs.readdirSync(targetFilesDir).length === 0) {
            for (const legacyAppDir of legacyAppDirs) {
                const legacyFilesDir = path.join(legacyAppDir, 'files');
                if (path.resolve(legacyFilesDir) === path.resolve(targetFilesDir)) continue;
                if (fs.existsSync(legacyFilesDir)) {
                    const files = fs.readdirSync(legacyFilesDir);
                    if (files.length > 0) {
                        log.info(`Migrating ${files.length} uploaded files: ${legacyFilesDir} -> ${targetFilesDir}`);
                        if (!fs.existsSync(targetFilesDir)) {
                            fs.mkdirSync(targetFilesDir, { recursive: true });
                        }
                        for (const file of files) {
                            const src = path.join(legacyFilesDir, file);
                            const dest = path.join(targetFilesDir, file);
                            if (!fs.existsSync(dest)) {
                                try {
                                    fs.copyFileSync(src, dest);
                                } catch (e) {
                                    log.warn(`Failed to copy file ${file}: ${e.message}`);
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
    } catch (err) {
        log.error('Failed to migrate legacy app data:', err);
    }
}

migrateLegacyAppData()

const store = new Store()

let mainWindow

function notifyDbUpdate(changeType) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('db-update', changeType)
    }
}


function createWindow() {
    // Restore window state
    const bounds = store.get('windowBounds')
    const { width, height, x, y } = bounds || { width: 1400, height: 900 }

    // Set Dock Icon for macOS (Dev Mode)
    if (process.platform === 'darwin') {
        const iconPath = path.join(__dirname, '../resources/icon-mac.png')
        if (fs.existsSync(iconPath)) {
            app.dock.setIcon(iconPath)
        }
    }

    // Determine platform icon
    let platformIcon = path.join(__dirname, '../resources/icon-win.png') // Default to Windows/Linux
    if (process.platform === 'darwin') {
        platformIcon = path.join(__dirname, '../resources/icon-mac.png')
    }

    mainWindow = new BrowserWindow({
        title: 'Kontrol',
        width,
        height,
        x,
        y,
        minWidth: 1200,
        minHeight: 700,
        icon: platformIcon,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            plugins: true // Enable PDF viewer plugin
        },

        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#18181b',
            symbolColor: '#ffffff',
            height: 38
        },
        trafficLightPosition: { x: 12, y: 12 },
        backgroundColor: '#0f0f1a',
        show: false
    })

    // Save window state
    mainWindow.on('close', () => {
        if (!mainWindow.isMaximized()) {
            store.set('windowBounds', mainWindow.getBounds())
        }
    })

    // Development or production mode
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        const devUrl = 'http://127.0.0.1:5173'
        mainWindow.loadURL(devUrl)
        mainWindow.webContents.openDevTools()

        mainWindow.webContents.on('did-fail-load', () => {
            log.warn('Dev server loading failed, retrying in 1s...')
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.loadURL(devUrl)
                }
            }, 1000)
        })
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
        mainWindow.focus()
        if (mainWindow.webContents) mainWindow.webContents.focus()
    })

    // Ensure webContents maintains first-responder keyboard focus
    mainWindow.on('focus', () => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
            mainWindow.webContents.focus()
        }
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })

    // Custom Menu
    createMenu()

    // Right Click Context Menu for text inputs & selection
    mainWindow.webContents.on('context-menu', (event, params) => {
        if (params.isEditable) {
            const menu = Menu.buildFromTemplate([
                { role: 'undo', label: 'Geri Al' },
                { role: 'redo', label: 'Yinele' },
                { type: 'separator' },
                { role: 'cut', label: 'Kes' },
                { role: 'copy', label: 'Kopyala' },
                { role: 'paste', label: 'Yapıştır' },
                { role: 'selectAll', label: 'Tümünü Seç' }
            ]);
            menu.popup({ window: mainWindow });
        }
    })

    // Tray Icon
    // Custom Context Menu
    ipcMain.on('show-context-menu', (event, items) => {
        const template = items.map(item => {
            if (item.type === 'separator') return { type: 'separator' }
            return {
                label: item.label,
                click: () => event.sender.send('context-action', item.id)
            }
        })
        const menu = Menu.buildFromTemplate(template)
        menu.popup({ window: BrowserWindow.fromWebContents(event.sender) })
    })

}

function createMenu() {
    const isMac = process.platform === 'darwin'
    const template = [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { label: 'Ayarlar', accelerator: 'CmdOrCtrl+,', click: () => mainWindow.webContents.send('navigate', '/settings') },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: 'Dosya',
            submenu: [
                { label: 'Yeni Araç Ekle', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('trigger-action', 'new-vehicle') },
                { type: 'separator' },
                { role: 'close' }
            ]
        },
        {
            label: 'Düzen',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
                { type: 'separator' },
                { label: 'Ara', accelerator: 'CmdOrCtrl+F', click: () => mainWindow.webContents.send('trigger-action', 'search') }
            ]
        },
        {
            label: 'Görünüm',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Pencere',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ] : [
                    { role: 'close' }
                ])
            ]
        }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}

// Set App ID for Windows Notifications
if (process.platform === 'win32') {
    app.setAppUserModelId('com.kontrol.app') // Must match appId in package.json
}



// Notification Handler
const { Notification } = require('electron')

ipcMain.handle('notification:show', (event, { title, body }) => {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title,
            body,
            icon: path.join(__dirname, '../resources/icon.png'),
            sound: 'default' // Play default system sound
        })
        notification.show()

        notification.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore()
                mainWindow.show()
            }
        })
        return true
    }
    return false
})

app.whenReady().then(async () => {
    // 1. Open the UI Window immediately (instant launch)
    createWindow()
    log.info('Application window created')

    // 2. Initialize Database & Services
    try {
        if (db.initializeDatabase) db.initializeDatabase()
        log.info('Database initialized')

        // Run schema migrations (add missing columns to older DBs)
        await runAutoMigrations()

        startAdminServer(getPrismaClient(), notifyDbUpdate)

        // Background one-time SQLite -> Supabase auto-sync check for existing desktop installs
        try {
            const flagPath = path.join(app.getPath('userData'), 'data', 'supabase_synced.flag');
            if (!fs.existsSync(flagPath)) {
                const { migrateSqliteToPostgres } = require('./services/postgresMigration.service');
                const pgUrl = process.env.DATABASE_URL || DEFAULT_POSTGRES_URL;
                log.info('Checking for initial SQLite -> Supabase auto-sync...');
                migrateSqliteToPostgres(null, pgUrl).then(res => {
                    if (res && res.success) {
                        try { fs.writeFileSync(flagPath, new Date().toISOString()); } catch(e) {}
                        log.info('✓ Local SQLite data successfully synced to Supabase on startup.');
                        notifyDbUpdate('all');
                    }
                }).catch(e => {
                    log.warn('Auto-sync notice:', e.message);
                });
            }
        } catch (syncErr) {
            log.warn('Startup sync check notice:', syncErr.message);
        }
    } catch (err) {
        log.error('Failed to initialize database:', err)
        if (mainWindow && !mainWindow.isDestroyed()) {
            dialog.showErrorBox('Veritabanı Hatası', 'Veritabanı başlatılamadı.\n' + err.message)
        }
    }

    log.info('Application started')

    // Global Shortcut for DevTools (F12)
    globalShortcut.register('F12', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('browser-window-focus', (event, win) => {
    if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.focus()
    }
})

app.on('activate', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
        if (mainWindow.webContents) mainWindow.webContents.focus()
    } else {
        createWindow()
    }
})

app.on('window-all-closed', () => {
    stopAdminServer()
    if (process.platform !== 'darwin') {
        log.info('Application quitting (window-all-closed)')
        app.quit()
    }
})

process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error)
})

const withTimeout = (promise, ms) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            const err = new Error('ETIMEDOUT: operation timed out');
            err.code = 'ETIMEDOUT';
            reject(err);
        }, ms);
    });
    return Promise.race([
        promise.then(val => {
            clearTimeout(timeoutId);
            return val;
        }),
        timeoutPromise
    ]);
};

async function copyOrCloneFile(sourcePath, destPath) {
    const isCloudPath = /cloud|onedrive|icloud|dropbox|google/i.test(sourcePath) || 
                        sourcePath.toLowerCase().includes('cloudstorage') ||
                        sourcePath.includes('Library/Mobile Documents/com~apple~CloudDocs');

    const isTimeoutOrIOError = (err) => {
        if (!err) return false;
        const errMsg = String(err.message || '').toUpperCase();
        const errCode = String(err.code || '').toUpperCase();
        return errMsg.includes('ETIMEDOUT') || errMsg.includes('EIO') || errMsg.includes('TIMEDOUT') ||
               errCode.includes('ETIMEDOUT') || errCode.includes('EIO') || errCode.includes('TIMEDOUT');
    };

    try {
        await withTimeout(fs.promises.copyFile(sourcePath, destPath), 15000)
    } catch (copyError) {
        log.warn(`copyFile failed for ${sourcePath}:`, copyError.message)
        
        // If it is a cloud path or a timeout/IO error, throw the user-friendly error immediately.
        // Doing a fallback to readFile/writeFile will just time out again, wasting time.
        if (isCloudPath || isTimeoutOrIOError(copyError)) {
            throw new Error(`Bulut (OneDrive/iCloud) dosya indirme zaman aşımına uğradı veya dosya okunamadı. Lütfen Finder'dan dosyaya çift tıklayarak bilgisayarınıza indirildiğinden emin olun veya dosyayı yerel bir klasöre (Masaüstü, İndirilenler vb.) kopyalayıp oradan seçin.`)
        }

        log.info(`Falling back to readFile/writeFile for ${sourcePath}`)
        try {
            const buffer = await withTimeout(fs.promises.readFile(sourcePath), 15000)
            await fs.promises.writeFile(destPath, buffer)
        } catch (readError) {
            log.error(`Fallback readFile/writeFile failed for ${sourcePath}:`, readError.message)
            if (isCloudPath || isTimeoutOrIOError(readError)) {
                throw new Error(`Bulut (OneDrive/iCloud) dosya indirme zaman aşımına uğradı veya dosya okunamadı. Lütfen Finder'dan dosyaya çift tıklayarak bilgisayarınıza indirildiğinden emin olun veya dosyayı yerel bir klasöre (Masaüstü, İndirilenler vb.) kopyalayıp oradan seçin.`)
            }
            throw readError
        }
    }
}

// ============ IPC HANDLERS ============

// Auth handlers
ipcMain.handle('auth:register', async (event, userData) => {
    const result = await db.registerUser(userData)
    if (result.success && result.user) {
        const hash = await db.getUserPasswordHash(result.user.id)
        if (hash) currentSessionKey = deriveKey(hash)
    }
    return result
})

ipcMain.handle('auth:login', async (event, credentials) => {
    const result = await db.loginUser(credentials)
    if (result.success && result.user) {
        const hash = await db.getUserPasswordHash(result.user.id)
        if (hash) currentSessionKey = deriveKey(hash)
    }
    return result
})

ipcMain.handle('auth:changePassword', async (event, data) => {
    return await db.changePassword(data)
})

ipcMain.handle('auth:syncPasswordReset', async (event, data) => {
    return await db.syncPasswordReset(data)
})

ipcMain.handle('auth:requestPasswordReset', async (event, data) => {
    return await db.requestPasswordReset(data)
})

ipcMain.handle('auth:verifyRecoveryOtp', async (event, data) => {
    return await db.verifyRecoveryOtp(data)
})

ipcMain.handle('auth:completePasswordReset', async (event, data) => {
    return await db.completePasswordReset(data)
})

ipcMain.handle('auth:resendVerificationEmail', async (event, data) => {
    return await db.resendVerificationEmail(data)
})

ipcMain.handle('auth:activateUserByEmail', async (event, data) => {
    return await db.activateUserByEmail(data)
})

ipcMain.handle('auth:updateProfile', async (event, data) => {
    return await db.updateProfile(data)
})

ipcMain.handle('auth:createEmployeeUser', async (event, data) => {
    const result = await db.createEmployeeUser(data)
    if (result.success) notifyDbUpdate({ table: 'users', action: 'create' })
    return result
})

ipcMain.handle('auth:syncEmployeesToSupabaseAuth', async (event, companyId) => {
    const { syncAllEmployeesToSupabaseAuth } = require('./services/supabase.service')
    return await syncAllEmployeesToSupabaseAuth(companyId)
})

// Request & Approval handlers
ipcMain.handle('requests:create', async (event, data) => {
    const result = await db.createRequest(data)
    if (result.success) notifyDbUpdate({ table: 'requests', action: 'create' })
    return result
})

ipcMain.handle('requests:getAll', async (event, filters) => {
    return await db.getRequests(filters)
})

ipcMain.handle('requests:processApproval', async (event, data) => {
    const result = await db.processApproval(data)
    if (result.success) notifyDbUpdate({ table: 'requests', action: 'update' })
    return result
})

// Role & Permission handlers
ipcMain.handle('roles:getAll', async (event, companyId) => {
    return await db.getRoles(companyId)
})

ipcMain.handle('roles:save', async (event, data) => {
    const result = await db.saveRole(data)
    if (result.success) notifyDbUpdate({ table: 'roles', action: 'update' })
    return result
})

ipcMain.handle('roles:delete', async (event, roleId) => {
    const result = await db.deleteRole(roleId)
    if (result.success) notifyDbUpdate({ table: 'roles', action: 'delete' })
    return result
})

ipcMain.handle('roles:assignUserRole', async (event, data) => {
    const result = await db.assignUserRoleAndEmployee(data)
    if (result.success) notifyDbUpdate({ table: 'users', action: 'update' })
    return result
})

ipcMain.handle('roles:deleteUserAccount', async (event, userId) => {
    const result = await db.deleteUserAccount(userId)
    if (result.success) notifyDbUpdate({ table: 'users', action: 'delete' })
    return result
})

// Company handlers
ipcMain.handle('companies:getAll', async (event, userId) => {
    return await db.getCompanies(userId)
})

ipcMain.handle('companies:create', async (event, companyData) => {
    const result = await db.createCompany(companyData)
    if (result.success) notifyDbUpdate({ table: 'companies', action: 'create' })
    return result
})

ipcMain.handle('companies:update', async (event, companyData) => {
    const result = await db.updateCompany(companyData)
    if (result.success) notifyDbUpdate({ table: 'companies', action: 'update' })
    return result
})

ipcMain.handle('companies:delete', async (event, companyId) => {
    const result = await db.deleteCompany(companyId)
    if (result.success) notifyDbUpdate({ table: 'companies', action: 'delete' })
    return result
})

// Vehicle handlers
ipcMain.handle('vehicles:getAll', async (event, companyId, isArchived) => {
    return await db.getVehicles(companyId, isArchived)
})

ipcMain.handle('vehicles:getById', async (event, vehicleId) => {
    return await db.getVehicleById(vehicleId)
})

ipcMain.handle('vehicles:create', async (event, vehicleData) => {
    const result = await db.createVehicle(vehicleData)
    if (result.success) notifyDbUpdate({ table: 'vehicles', action: 'create' })
    return result
})

ipcMain.handle('vehicles:update', async (event, vehicleData) => {
    const result = await await db.updateVehicle(vehicleData)
    if (result.success) notifyDbUpdate({ table: 'vehicles', action: 'update' })
    return result
})

ipcMain.handle('vehicles:delete', async (event, vehicleId) => {
    const result = await await db.deleteVehicle(vehicleId)
    if (result.success) notifyDbUpdate({ table: 'vehicles', action: 'delete' })
    return result
})

// Maintenance handlers
ipcMain.handle('maintenances:getByVehicle', async (event, vehicleId) => {
    return await db.getMaintenances(vehicleId)
})

ipcMain.handle('maintenances:getAll', async (event, companyId, isArchived) => {
    return await db.getAllMaintenances(companyId, isArchived)
})

ipcMain.handle('maintenances:create', async (event, data) => {
    const result = await db.createMaintenance(data)
    if (result.success) notifyDbUpdate({ table: 'maintenances', action: 'create' })
    return result
})

ipcMain.handle('maintenances:update', async (event, data) => {
    const result = await await db.updateMaintenance(data)
    if (result.success) notifyDbUpdate({ table: 'maintenances', action: 'update' })
    return result
})

ipcMain.handle('maintenances:delete', async (event, id) => {
    const result = await await db.deleteMaintenance(id)
    if (result.success) notifyDbUpdate({ table: 'maintenances', action: 'delete' })
    return result
})

// Inspection handlers
ipcMain.handle('inspections:getByVehicle', async (event, vehicleId) => {
    return await db.getInspections(vehicleId)
})

ipcMain.handle('inspections:getAll', async (event, companyId, type, isArchived) => {
    return await db.getAllInspections(companyId, type, isArchived)
})

ipcMain.handle('inspections:create', async (event, data) => {
    const result = await db.createInspection(data)
    if (result.success) notifyDbUpdate({ table: 'inspections', action: 'create' })
    return result
})

ipcMain.handle('inspections:update', async (event, data) => {
    const result = await db.updateInspection(data)
    if (result.success) notifyDbUpdate({ table: 'inspections', action: 'update' })
    return result
})

ipcMain.handle('inspections:delete', async (event, id) => {
    const result = await db.deleteInspection(id)
    if (result.success) notifyDbUpdate({ table: 'inspections', action: 'delete' })
    return result
})

// Insurance handlers
ipcMain.handle('insurances:getByVehicle', async (event, vehicleId) => {
    return await db.getInsurances(vehicleId)
})

ipcMain.handle('insurances:getAll', async (event, companyId, isArchived) => {
    return await db.getAllInsurances(companyId, isArchived)
})

ipcMain.handle('insurances:create', async (event, data) => {
    const result = await db.createInsurance(data)
    if (result.success) notifyDbUpdate({ table: 'insurances', action: 'create' })
    return result
})

ipcMain.handle('insurances:update', async (event, data) => {
    const result = await db.updateInsurance(data)
    if (result.success) notifyDbUpdate({ table: 'insurances', action: 'update' })
    return result
})

ipcMain.handle('insurances:delete', async (event, id) => {
    const result = await db.deleteInsurance(id)
    if (result.success) notifyDbUpdate({ table: 'insurances', action: 'delete' })
    return result
})

// Assignment handlers
ipcMain.handle('assignments:getByVehicle', async (event, vehicleId) => {
    return await db.getAssignments(vehicleId)
})

ipcMain.handle('assignments:getAll', async (event, companyId, isArchived) => {
    return await db.getAllAssignments(companyId, isArchived)
})

ipcMain.handle('assignments:create', async (event, data) => {
    const result = await db.createAssignment(data)
    if (result.success) notifyDbUpdate({ table: 'assignments', action: 'create' })
    return result
})

ipcMain.handle('assignments:update', async (event, data) => {
    const result = await db.updateAssignment(data)
    if (result.success) notifyDbUpdate({ table: 'assignments', action: 'update' })
    return result
})

ipcMain.handle('assignments:delete', async (event, id) => {
    const result = await db.deleteAssignment(id)
    if (result.success) notifyDbUpdate({ table: 'assignments', action: 'delete' })
    return result
})

// Service handlers
ipcMain.handle('services:getByVehicle', async (event, vehicleId) => {
    return await db.getServices(vehicleId)
})

ipcMain.handle('services:getAll', async (event, companyId, isArchived) => {
    return await db.getAllServices(companyId, isArchived)
})

ipcMain.handle('services:create', async (event, data) => {
    const result = await db.createService(data)
    if (result.success) notifyDbUpdate({ table: 'services', action: 'create' })
    return result
})

ipcMain.handle('services:update', async (event, data) => {
    const result = await db.updateService(data)
    if (result.success) notifyDbUpdate({ table: 'services', action: 'update' })
    return result
})

ipcMain.handle('services:delete', async (event, id) => {
    const result = await db.deleteService(id)
    if (result.success) notifyDbUpdate({ table: 'services', action: 'delete' })
    return result
})

// Finance handlers
ipcMain.handle('finance:getAll', async (event, companyId, isArchived) => {
    return db.getTransactions(companyId, isArchived)
})

ipcMain.handle('finance:getById', async (event, id) => {
    return db.getTransactionById(id)
})

ipcMain.handle('finance:create', async (event, data) => {
    const result = await db.createTransaction(data)
    if (result.success) notifyDbUpdate({ table: 'transactions', action: 'create' })
    return result
})

ipcMain.handle('finance:update', async (event, data) => {
    const result = await db.updateTransaction(data)
    if (result.success) notifyDbUpdate({ table: 'transactions', action: 'update' })
    return result
})

ipcMain.handle('finance:delete', async (event, id) => {
    const result = await db.deleteTransaction(id)
    if (result.success) notifyDbUpdate({ table: 'transactions', action: 'delete' })
    return result
})

ipcMain.handle('finance:getStats', async (event, companyId) => {
    return db.getFinanceStats(companyId)
})

ipcMain.handle('finance:getChecks', async (event, companyId, isArchived) => {
    return db.getChecksAndNotes(companyId, isArchived)
})

ipcMain.handle('finance:updateCheckStatus', async (event, payload) => {
    const { id, status } = payload
    const result = await db.updateCheckStatus(id, status)
    if (result.success) notifyDbUpdate({ table: 'transactions', action: 'update' })
    return result
})


// ============ MEAL TICKETS ============

ipcMain.handle('mealTickets:getAll', async (event, companyId, isArchived) => {
    return db.getMealTickets(companyId, isArchived)
})

ipcMain.handle('mealTickets:create', async (event, data) => {
    const result = await db.addMealTicket(data)
    if (result.success) notifyDbUpdate({ table: 'meal_tickets', action: 'create' })
    return result
})

ipcMain.handle('mealTickets:update', async (event, data) => {
    const result = await db.updateMealTicket(data)
    if (result.success) notifyDbUpdate({ table: 'meal_tickets', action: 'update' })
    return result
})

ipcMain.handle('mealTickets:delete', async (event, id) => {
    const result = await db.deleteMealTicket(id)
    if (result.success) notifyDbUpdate({ table: 'meal_tickets', action: 'delete' })
    return result
})

ipcMain.handle('mealTickets:getStats', async (event, companyId) => {
    return await db.getMealTicketStats(companyId)
})

ipcMain.handle('mealTickets:getPrice', async (event, companyId) => {
    return await db.getMealPrice(companyId)
})

ipcMain.handle('mealTickets:setPrice', async (event, data) => {
    const result = await db.setMealPrice(data)
    if (result.success) notifyDbUpdate({ table: 'meal_settings', action: 'update' })
    return result
})

ipcMain.handle('mealTickets:getPriceHistory', async (event, companyId) => {
    return await db.getMealPriceHistory(companyId)
})

ipcMain.handle('mealTickets:deletePriceHistory', async (event, id) => {
    const result = await db.deleteMealPriceHistory(id)
    if (result.success) notifyDbUpdate({ table: 'meal_settings', action: 'delete' })
    return result
})

ipcMain.handle('mealTickets:updatePriceHistory', async (event, data) => {
    const result = await db.updateMealPriceHistory(data)
    if (result.success) notifyDbUpdate({ table: 'meal_settings', action: 'update' })
    return result
})

ipcMain.handle('mealTickets:getReport', async (event, { companyId, month, year }) => {
    return await db.getMealTicketReport(companyId, month, year)
})

// ============ EMPLOYEES ============
ipcMain.handle('employees:getAll', async (event, companyId, isArchived) => {
    return db.getEmployees(companyId, isArchived)
})
ipcMain.handle('employees:getPayrollSummary', async (event, companyId, month) => {
    return db.getPayrollSummary(companyId, month)
})

ipcMain.handle('employees:getById', async (event, id) => {
    return await db.getEmployeeById(id)
})
ipcMain.handle('employees:create', async (event, data) => {
    const result = await db.addEmployee(data)
    if (result.success) notifyDbUpdate({ table: 'employees', action: 'create' })
    return result
})
ipcMain.handle('employees:update', async (event, data) => {
    const result = await db.updateEmployee(data)
    if (result.success) notifyDbUpdate({ table: 'employees', action: 'update' })
    return result
})
ipcMain.handle('employees:delete', async (event, id) => {
    const result = await db.deleteEmployee(id)
    if (result.success) notifyDbUpdate({ table: 'employees', action: 'delete' })
    return result
})

// Salaries
ipcMain.handle('salaries:getAll', async (event, employeeId) => {
    return await db.getSalariesByEmployee(employeeId) // Correct function name mapped from EmployeeDataService
})
ipcMain.handle('salaries:getAllForCompany', async (event, companyId) => {
    return await db.getAllSalariesForCompany(companyId)
})
ipcMain.handle('salaries:create', async (event, data) => {
    const result = await db.createSalary(data)
    if (result.success) notifyDbUpdate({ table: 'salaries', action: 'create' })
    return result
})
ipcMain.handle('salaries:update', async (event, data) => {
    const result = await db.updateSalary(data)
    if (result.success) notifyDbUpdate({ table: 'salaries', action: 'update' })
    return result
})
ipcMain.handle('salaries:delete', async (event, id) => {
    const result = await db.deleteSalary(id)
    if (result.success) notifyDbUpdate({ table: 'salaries', action: 'delete' })
    return result
})

// Employee Movements
ipcMain.handle('employeeMovements:getAll', async (event, companyId) => {
    return await db.getAllEmployeeMovements(companyId)
})
ipcMain.handle('employeeMovements:create', async (event, data) => {
    const result = await db.addEmployeeMovement(data)
    if (result.success) notifyDbUpdate({ table: 'employee_movements', action: 'create' })
    return result
})
ipcMain.handle('employeeMovements:update', async (event, data) => {
    const result = await db.updateEmployeeMovement(data)
    if (result.success) notifyDbUpdate({ table: 'employee_movements', action: 'update' })
    return result
})
ipcMain.handle('employeeMovements:delete', async (event, id) => {
    const result = await db.deleteEmployeeMovement(id)
    if (result.success) notifyDbUpdate({ table: 'employee_movements', action: 'delete' })
    return result
})

// Overtimes Company-wide
ipcMain.handle('overtimes:getAllByCompany', async (event, companyId) => {
    return await db.getAllOvertimes(companyId)
})

// Salary History
ipcMain.handle('salaryHistory:create', async (event, data) => {
    const result = await db.createSalaryHistory(data)
    if (result.success) notifyDbUpdate({ table: 'employee_salary_history', action: 'create' })
    return result
})
ipcMain.handle('salaryHistory:update', async (event, data) => {
    const result = await db.updateSalaryHistory(data)
    if (result.success) notifyDbUpdate({ table: 'employee_salary_history', action: 'update' })
    return result
})
ipcMain.handle('salaryHistory:delete', async (event, id) => {
    const result = await db.deleteSalaryHistory(id)
    if (result.success) notifyDbUpdate({ table: 'employee_salary_history', action: 'delete' })
    return result
})

// Leaves
ipcMain.handle('leaves:getAll', async (event, employeeId) => {
    return await db.getLeavesByEmployee(employeeId)
})
ipcMain.handle('leaves:getAllByCompany', async (event, companyId) => {
    return await db.getAllLeaves(companyId)
})
ipcMain.handle('leaves:create', async (event, data) => {
    const result = await db.createLeave(data)
    if (result.success) notifyDbUpdate({ table: 'leaves', action: 'create' })
    return result
})
ipcMain.handle('leaves:update', async (event, data) => {
    const result = await db.updateLeave(data)
    if (result.success) notifyDbUpdate({ table: 'leaves', action: 'update' })
    return result
})
ipcMain.handle('leaves:delete', async (event, id) => {
    const result = await db.deleteLeave(id)
    if (result.success) notifyDbUpdate({ table: 'leaves', action: 'delete' })
    return result
})

// Overtimes
ipcMain.handle('overtimes:getAll', async (event, employeeId) => {
    return db.getOvertimes(employeeId)
})
ipcMain.handle('overtimes:create', async (event, data) => {
    const result = await db.addOvertime(data)
    if (result.success) notifyDbUpdate({ table: 'overtimes', action: 'create' })
    return result
})
ipcMain.handle('overtimes:update', async (event, data) => {
    const result = await db.updateOvertime(data)
    if (result.success) notifyDbUpdate({ table: 'overtimes', action: 'update' })
    return result
})
ipcMain.handle('overtimes:delete', async (event, id) => {
    const result = await db.deleteOvertime(id)
    if (result.success) notifyDbUpdate({ table: 'overtimes', action: 'delete' })
    return result
})

// Employee Assignments (Zimmet)
ipcMain.handle('employeeAssignments:getAll', async (event, employeeId) => {
    return db.getEmployeeAssignments(employeeId)
})
ipcMain.handle('employeeAssignments:create', async (event, data) => {
    const result = await db.addEmployeeAssignment(data)
    if (result.success) notifyDbUpdate({ table: 'employee_assignments', action: 'create' })
    return result
})
ipcMain.handle('employeeAssignments:update', async (event, data) => {
    const result = await db.updateEmployeeAssignment(data)
    if (result.success) notifyDbUpdate({ table: 'employee_assignments', action: 'update' })
    return result
})
ipcMain.handle('employeeAssignments:delete', async (event, id) => {
    const result = await db.deleteEmployeeAssignment(id)
    if (result.success) notifyDbUpdate({ table: 'employee_assignments', action: 'delete' })
    return result
})

// Employee Documents
    ipcMain.handle('employeeDocuments:getAll', async (event, employeeId, isArchived) => {
        return await db.getEmployeeDocuments(employeeId, isArchived);
    });
    ipcMain.handle('employeeDocuments:getUpcoming', async (event, companyId) => {
        return await db.getUpcomingDocuments(companyId);
    });
ipcMain.handle('employeeDocuments:create', async (event, data) => {
    try {
        const userDataPath = app.getPath('userData')
        const filesDir = path.join(userDataPath, 'files')

        // Ensure directory exists
        if (!fs.existsSync(filesDir)) {
            fs.mkdirSync(filesDir, { recursive: true })
        }

        const sourcePath = typeof data.filePath === 'object' && data.filePath !== null ? data.filePath.path : data.filePath
        if (!sourcePath) {
            return { success: false, error: 'Dosya yolu bulunamadı.' }
        }

        const ext = path.extname(sourcePath || '')
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`
        const destPath = path.join(filesDir, fileName)

        // Copy file
        await copyOrCloneFile(sourcePath, destPath)

        // Save to DB with the NEW path (the filename in our storage)
        const result = await db.addEmployeeDocument({
            ...data,
            fileName: data.fileName || (typeof data.filePath === 'object' && data.filePath !== null ? data.filePath.name : null) || path.basename(sourcePath), // Prioritize provided name
            filePath: fileName // New storage name (timestamped)
        })

        if (result.success) notifyDbUpdate({ table: 'employee_documents', action: 'create' })
        return result
    } catch (error) {
        console.error('Employee document create error:', error)
        return { success: false, error: error.message }
    }
})
ipcMain.handle('employeeDocuments:delete', async (event, id) => {
    try {
        // 1. Find document to get file path
        const docRes = await db.getEmployeeDocumentById(id)
        if (docRes.success && docRes.data) {
            const fileName = docRes.data.file_path
            const userDataPath = app.getPath('userData')
            const filePath = path.join(userDataPath, 'files', fileName)
            
            // 2. Delete physical file if exists
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
            }
        }

        // 3. Delete from DB
        const result = await db.deleteEmployeeDocument(id)
        if (result.success) notifyDbUpdate({ table: 'employee_documents', action: 'delete' })
        return result
    } catch (error) {
        console.error('Employee document delete error:', error)
        return { success: false, error: error.message }
    }
})
ipcMain.handle('employeeDocuments:update', async (event, data) => {
    try {
        let finalData = { ...data }

        if (data.filePath && !data.filePath.includes(app.getPath('userData'))) {
            // New file selected (full path), copy it
            const userDataPath = app.getPath('userData')
            const filesDir = path.join(userDataPath, 'files')
            if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true })

            const ext = path.extname(data.filePath)
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`
            const destPath = path.join(filesDir, fileName)

            await copyOrCloneFile(data.filePath, destPath)
            finalData.fileName = path.basename(data.filePath)
            finalData.filePath = fileName
        }

        const result = await db.updateEmployeeDocument(finalData)
        if (result.success) notifyDbUpdate({ table: 'employee_documents', action: 'update' })
        return result
    } catch (error) {
        console.error('Employee document update error:', error)
        return { success: false, error: error.message }
    }
})


// Global Search
ipcMain.handle('global:search', async (event, companyId, query) => {
    if (!query || query.length < 2) return { success: true, data: [] }
    try {
        const q = query.toLocaleLowerCase('tr-TR').replace(/\s/g, '')
        const [vehiclesRes, employeesRes, customersRes] = await Promise.all([
            db.getVehicles(companyId, false).catch(() => ({ success: false })),
            db.getEmployees(companyId, false).catch(() => ({ success: false })),
            db.getCustomers(companyId, 0).catch(() => ({ success: false }))
        ])

        const results = []
        const vehicles = (vehiclesRes && vehiclesRes.success) ? (vehiclesRes.data || []) : []
        const employees = (employeesRes && employeesRes.success) ? (employeesRes.data || []) : []
        const customers = (customersRes && customersRes.success) ? (customersRes.data || []) : []

        // Search Vehicles
        if (Array.isArray(vehicles)) {
            vehicles.forEach(v => {
                if (!v) return
                const plate = (v.plate?.toLocaleLowerCase('tr-TR') || '').replace(/\s/g, '')
                const brand = (v.brand?.toLocaleLowerCase('tr-TR') || '').replace(/\s/g, '')
                const model = (v.model?.toLocaleLowerCase('tr-TR') || '').replace(/\s/g, '')
                if (plate.includes(q) || brand.includes(q) || model.includes(q)) {
                    results.push({ id: v.id, type: 'vehicle', title: v.plate, subtitle: `${v.brand || ''} ${v.model || ''}`, icon: 'Car' })
                }
            })
        }

        // Search Employees
        if (Array.isArray(employees)) {
            employees.forEach(e => {
                if (!e) return
                const firstName = e.first_name?.toLocaleLowerCase('tr-TR') || ''
                const lastName = e.last_name?.toLocaleLowerCase('tr-TR') || ''
                const fullName = `${firstName}${lastName}`.replace(/\s/g, '')
                const phone = (e.phone?.toLocaleLowerCase('tr-TR') || '').replace(/\s/g, '')
                const pos = (e.position?.toLocaleLowerCase('tr-TR') || '').replace(/\s/g, '')
                if (fullName.includes(q) || phone.includes(q) || pos.includes(q)) {
                    results.push({ id: e.id, type: 'employee', title: `${e.first_name} ${e.last_name}`, subtitle: e.position || 'Personel', icon: 'User' })
                }
            })
        }

        // Search Customers
        if (Array.isArray(customers)) {
            customers.forEach(c => {
                if (!c) return
                const name = (c.name?.toLocaleLowerCase('tr-TR') || '').replace(/\s/g, '')
                const phone = (c.phone?.toLocaleLowerCase('tr-TR') || '').replace(/\s/g, '')
                const company = (c.tax_office?.toLocaleLowerCase('tr-TR') || '').replace(/\s/g, '')
                if (name.includes(q) || phone.includes(q) || company.includes(q)) {
                    results.push({ id: c.id, type: 'customer', title: c.name, subtitle: c.phone || 'Müşteri', icon: 'Building2' })
                }
            })
        }

        return { success: true, data: results.slice(0, 15) }
    } catch (error) {
        console.error('Global search error:', error)
        return { success: false, error: error.message }
    }
})

// Archive handler
ipcMain.handle('archive:item', async (event, table, id, isArchived) => {
    return await db.archiveItem(table, id, isArchived)
})
ipcMain.handle('archive:items', async (event, table, ids, isArchived) => {
    return await db.archiveItems(table, ids, isArchived)
})

// Works & Timesheets
ipcMain.handle('works:getAll', async (event, companyId, isArchived) => {
    return db.getWorks(companyId, isArchived)
})
ipcMain.handle('works:getDetails', async (event, id) => {
    return db.getWorkDetails(id)
})
ipcMain.handle('works:create', async (event, data) => {
    return db.createWork(data)
})
ipcMain.handle('works:update', async (event, data) => {
    return db.updateWork(data)
})
ipcMain.handle('works:delete', async (event, id) => {
    return db.deleteWork(id)
})
ipcMain.handle('works:bulkDelete', async (event, ids) => {
    return db.deleteWorks(ids)
})
ipcMain.handle('works:bulkArchive', async (event, ids, isArchived) => {
    return db.archiveWorks(ids, isArchived)
})

// Customers
ipcMain.handle('customers:getAll', async (event, companyId, isArchived) => {
    return db.getCustomers(companyId, isArchived)
})
ipcMain.handle('customers:getDetails', async (event, id) => {
    return db.getCustomerDetails(id)
})
ipcMain.handle('customers:create', async (event, data) => {
    return db.createCustomer(data)
})
ipcMain.handle('customers:update', async (event, data) => {
    return db.updateCustomer(data)
})
ipcMain.handle('customers:delete', async (event, id) => {
    return db.deleteCustomer(id)
})

ipcMain.handle('workItems:create', async (event, data) => {
    return db.addWorkItem(data)
})
ipcMain.handle('workItems:bulkCreate', async (event, data) => {
    return db.addBulkWorkItems(data)
})
ipcMain.handle('workItems:update', async (event, data) => {
    return db.updateWorkItem(data)
})
ipcMain.handle('workItems:delete', async (event, id) => {
    return db.deleteWorkItem(id)
})
ipcMain.handle('workItems:bulkDelete', async (event, ids) => {
    return db.deleteBulkWorkItems(ids)
})

// Dashboard stats
ipcMain.handle('dashboard:getStats', async (event, companyId) => {
    return await db.getDashboardStats(companyId)
})

ipcMain.handle('dashboard:getUpcoming', async (event, companyId) => {
    return await db.getUpcomingEvents(companyId)
})

ipcMain.handle('dashboard:getRecentActivity', async (event, companyId) => {
    return await db.getRecentActivity(companyId)
})

// ============ DATA MANAGEMENT ============

ipcMain.handle('data:export', async (event, payload) => {
    try {
        const userId = payload.userId

        // Fetch companies to get a relevant backup name
        const companies = await db.getCompanies(userId)
        const companyName = companies.length > 0 ? companies[0].name : "system"

        // Determine Encryption Key (Currently unused for raw zip, but can ZIP encrypt later)
        let key = currentSessionKey || LEGACY_KEY

        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Tam Güvenli Yedekleme (ZIP)',
            defaultPath: `muayen-yedek-${companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.zip`,
            filters: [
                { name: 'Güvenli Yedek Arşivi', extensions: ['zip'] }
            ]
        })

        if (!filePath) {
            return { success: false, error: 'İşlem iptal edildi' }
        }

        // We now bypass JSON serialization and just zip the pristine SQLite database file
        createBackupZip(filePath)

        return { success: true, filePath }
    } catch (error) {
        console.error('Backup error:', error)
        return { success: false, error: error.message }
    }
})

ipcMain.handle('data:import', async (event, userId) => {
    try {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Yedeği Geri Yükle',
            properties: ['openFile'],
            filters: [
                { name: 'Yedek Arşivi', extensions: ['zip'] }
            ]
        })

        if (!filePaths || filePaths.length === 0) {
            return { success: false, error: 'Dosya seçilmedi' }
        }

        const zip = new AdmZip(filePaths[0])
        const zipEntries = zip.getEntries()

        // Locate the database file within the zip (it should be at the root of the zip archive as 'aractakip.db')
        const dbEntry = zipEntries.find(entry => entry.entryName === "aractakip.db" || entry.entryName.endsWith("aractakip.db"))

        if (!dbEntry) {
            // Check for legacy data.json just to reject gracefully
            const legacyEntry = zipEntries.find(entry => entry.entryName === "data.json" || entry.entryName === "data.enc")
            if (legacyEntry) {
                return { success: false, error: 'Eski JSON formatlı yedekler Prisma mimarisi ile uyumlu değildir. Lütfen SQL yedeklerini kullanın.' }
            }
            return { success: false, error: 'Geçersiz yedek dosyası (Veritabanı bulunamadı)' }
        }

        const userDataPath = app.getPath('userData')

        // 1. Disconnect Prisma to unlock the file
        const prismaClient = getPrismaClient()
        await prismaClient.$disconnect()
        log.info('Prisma client disconnected for restore.')

        // 2. Extract and Overwrite the Database File
        const dataDir = path.join(userDataPath, 'data')
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true })
        }

        // Write the DB file directly
        const newDbContent = dbEntry.getData()
        const targetDbPath = path.join(dataDir, 'aractakip.db')
        fs.writeFileSync(targetDbPath, newDbContent)
        log.info('Database file successfully overwritten from backup.')

        // 3. Extract Files (Images, Documents)
        const filesDir = path.join(userDataPath, 'files')
        if (!fs.existsSync(filesDir)) {
            fs.mkdirSync(filesDir, { recursive: true })
        }

        zipEntries.forEach(entry => {
            if (entry.entryName.startsWith("files/") && !entry.isDirectory) {
                try {
                    zip.extractEntryTo(entry, filesDir, false, true)
                } catch (err) {
                    console.warn('Failed to extract file:', entry.entryName, err)
                }
            }
        })

        // Notify frontend to hard reload
        mainWindow.webContents.send('db-update', 'companies')

        // IMPORTANT: We must reload the app to reinitialize Prisma with the new DB safely.
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Geri Yükleme Başarılı',
            message: 'Veritabanı başarıyla geri yüklendi. Değişikliklerin uygulanabilmesi için uygulama yeniden başlatılacak.',
            buttons: ['Tamam']
        }).then(() => {
            app.relaunch()
            app.quit()
        })

        return { success: true }
    } catch (error) {
        console.error('Import error:', error)
        // Force app quit if it fails mid-restore to prevent db corruption state
        app.relaunch()
        app.quit()
        return { success: false, error: error.message }
    }
})



// ============ SETTINGS & AUTO BACKUP ============

const settingsPath = path.join(app.getPath('userData'), 'settings.json')
let backupInterval = null

function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
        }
    } catch (error) {
        console.error('Settings load error:', error)
    }
    return { autoBackup: false, frequency: 'daily', backupPath: '', lastBackup: {} }
}

function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
        setupAutoBackup(settings) // Re-setup when saved
        setupArventoPolling(settings) // Re-setup Arvento polling when settings are saved
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

// Encryption Helpers
// Encryption Helpers
const LEGACY_KEY = crypto.scryptSync('muayen-app-secure-key-v1', 'salt', 32)
const IV_LENGTH = 16
let currentSessionKey = null

function deriveKey(passwordHash) {
    return crypto.scryptSync(passwordHash, 'salt', 32)
}

function encryptData(text, key) {
    const finalKey = key || LEGACY_KEY
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-cbc', finalKey, iv)
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decryptData(text, key) {
    const finalKey = key || LEGACY_KEY
    const textParts = text.split(':')
    const iv = Buffer.from(textParts.shift(), 'hex')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', finalKey, iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
}

// Helper for ZIP creation
function createBackupZip(outputPath) {
    try {
        const zip = new AdmZip()
        const userDataPath = app.getPath('userData')

        // 1. Add the Database file directly to the ZIP
        const dbPath = path.join(userDataPath, 'data', 'aractakip.db')
        if (fs.existsSync(dbPath)) {
            zip.addLocalFile(dbPath)
        } else {
            console.warn('Backup: aractakip.db not found at', dbPath)
        }

        // 2. Add physical files (images/documents)
        const filesDir = path.join(userDataPath, 'files')
        if (fs.existsSync(filesDir)) {
            zip.addLocalFolder(filesDir, "files")
        }

        zip.writeZip(outputPath)
        return true
    } catch (error) {
        console.error('Zip creation error:', error)
        throw error
    }
}

async function performAutoBackup(companyId, backupPath) {
    try {
        console.log('Starting auto backup for company:', companyId)

        // Use a generic name if company is not fetched, or rely on active company ID
        const fileName = `autobackup-system-${new Date().toISOString().split('T')[0]}.zip`
        const fullPath = path.join(backupPath, fileName)

        createBackupZip(fullPath)

        console.log('Auto backup saved to:', fullPath)
        return true
    } catch (error) {
        console.error('Auto backup failed:', error)
        return false
    }
}

function setupAutoBackup(settings) {
    if (backupInterval) clearInterval(backupInterval)

    if (!settings.autoBackup || !settings.backupPath) return

    console.log('Setting up auto backup:', settings.frequency)

    // Check every hour
    backupInterval = setInterval(async () => {
        const currentSettings = loadSettings()
        const now = new Date()

        // Skip if autoBackup was turned off in settings file manually
        if (!currentSettings.autoBackup || !currentSettings.backupPath) return

        const lastBackupTime = new Date(currentSettings.lastBackup?.global || 0)
        let shouldBackup = false

        const diffTime = now - lastBackupTime
        if (currentSettings.frequency === 'daily') {
            if (diffTime > 24 * 60 * 60 * 1000) shouldBackup = true
        } else if (currentSettings.frequency === 'weekly') {
            if (diffTime > 7 * 24 * 60 * 60 * 1000) shouldBackup = true
        } else if (currentSettings.frequency === 'monthly') {
            if (diffTime > 30 * 24 * 60 * 60 * 1000) shouldBackup = true
        }

        if (shouldBackup) {
            // Since our backup creates a ZIP of the entire database, 
            // we only need to run it once, not per company.
            const success = await performAutoBackup('system', currentSettings.backupPath)
            
            if (success) {
                currentSettings.lastBackup = { global: now.toISOString() }
                saveSettings(currentSettings)
                log.info('Auto backup completed successfully')
            } else {
                log.error('Auto backup failed')
            }
        }
    }, 60 * 60 * 1000) // Check every hour
}

let arventoPollingInterval = null

function setupArventoPolling(settings) {
    if (arventoPollingInterval) {
        clearInterval(arventoPollingInterval)
        arventoPollingInterval = null
    }

    if (!settings.arvento || !settings.arvento.enabled) {
        log.info('Arvento background polling is disabled')
        return
    }

    const intervalMinutes = parseInt(settings.arvento.interval || 3)
    log.info(`Setting up Arvento background polling (every ${intervalMinutes} minutes)`)
    // Run once immediately
    db.getArventoVehicleStatus().catch(err => {
        log.error('Arvento background polling immediate run error:', err.message)
    })

    // Check and fetch every X minutes
    arventoPollingInterval = setInterval(async () => {
        try {
            const currentSettings = loadSettings()
            if (currentSettings && currentSettings.arvento && currentSettings.arvento.enabled) {
                log.info('Arvento background polling run...')
                await db.getArventoVehicleStatus()
            }
        } catch (err) {
            log.error('Arvento background polling error:', err.message)
        }
    }, intervalMinutes * 60 * 1000)
}

ipcMain.handle('settings:get', () => {
    return loadSettings()
})

ipcMain.handle('settings:save', (event, newSettings) => {
    return saveSettings(newSettings)
})

// Arvento API Handlers
ipcMain.handle('arvento:testConnection', async (event, credentials) => {
    return await db.testArventoConnection(credentials)
})
ipcMain.handle('arvento:getStatus', async (event, credentials) => {
    return await db.getArventoVehicleStatus(credentials)
})
ipcMain.handle('arvento:getMappings', async (event, credentials) => {
    return await db.getArventoLicensePlateNodeMappings(credentials)
})
ipcMain.handle('arvento:getInfo', async (event, credentials) => {
    return await db.getArventoVehicleInfo(credentials)
})
ipcMain.handle('arvento:getDailyReport', async (event, date, credentials) => {
    return await db.getArventoVehicleDailyStatus(date, credentials)
})
ipcMain.handle('arvento:getAlarms', async (event, credentials) => {
    return await db.getArventoAlarms(credentials)
})
ipcMain.handle('arvento:getHistory', async (event, filters, credentials) => {
    return await db.getArventoHistory(filters, credentials)
})

// Public Holidays
ipcMain.handle('settings:getPublicHolidays', async (event, companyId) => db.getPublicHolidays(companyId))
ipcMain.handle('settings:createPublicHoliday', async (event, data) => {
    const result = await db.createPublicHoliday(data)
    if (result.success) notifyDbUpdate({ table: 'public_holidays', action: 'create' })
    return result
})
ipcMain.handle('settings:updatePublicHoliday', async (event, data) => {
    const result = await db.updatePublicHoliday(data)
    if (result.success) notifyDbUpdate({ table: 'public_holidays', action: 'update' })
    return result
})
ipcMain.handle('settings:deletePublicHoliday', async (event, id) => {
    const result = await db.deletePublicHoliday(id)
    if (result.success) notifyDbUpdate({ table: 'public_holidays', action: 'delete' })
    return result
})

// Personnel Settings
ipcMain.handle('settings:getDepartments', async (event, companyId) => db.getDepartments(companyId))
ipcMain.handle('settings:createDepartment', async (event, data) => {
    const result = await db.createDepartment(data)
    if (result.success) notifyDbUpdate({ table: 'departments', action: 'create' })
    return result
})
ipcMain.handle('settings:updateDepartment', async (event, data) => {
    const result = await db.updateDepartment(data)
    if (result.success) notifyDbUpdate({ table: 'departments', action: 'update' })
    return result
})
ipcMain.handle('settings:deleteDepartment', async (event, id) => {
    const result = await db.deleteDepartment(id)
    if (result.success) notifyDbUpdate({ table: 'departments', action: 'delete' })
    return result
})

ipcMain.handle('settings:getLeaveTypes', async (event, companyId) => db.getLeaveTypes(companyId))
ipcMain.handle('settings:createLeaveType', async (event, data) => {
    const result = await db.createLeaveType(data)
    if (result.success) notifyDbUpdate({ table: 'leave_types', action: 'create' })
    return result
})
ipcMain.handle('settings:updateLeaveType', async (event, data) => {
    const result = await db.updateLeaveType(data)
    if (result.success) notifyDbUpdate({ table: 'leave_types', action: 'update' })
    return result
})
ipcMain.handle('settings:deleteLeaveType', async (event, id) => {
    const result = await db.deleteLeaveType(id)
    if (result.success) notifyDbUpdate({ table: 'leave_types', action: 'delete' })
    return result
})

ipcMain.handle('settings:getDocumentCategories', async (event, companyId, targetType) => db.getDocumentCategories(companyId, targetType))
ipcMain.handle('settings:createDocumentCategory', async (event, data) => {
    const result = await db.createDocumentCategory(data)
    if (result.success) notifyDbUpdate({ table: 'document_categories', action: 'create' })
    return result
})
ipcMain.handle('settings:updateDocumentCategory', async (event, data) => {
    const result = await db.updateDocumentCategory(data)
    if (result.success) notifyDbUpdate({ table: 'document_categories', action: 'update' })
    return result
})
ipcMain.handle('settings:deleteDocumentCategory', async (event, id) => {
    const result = await db.deleteDocumentCategory(id)
    if (result.success) notifyDbUpdate({ table: 'document_categories', action: 'delete' })
    return result
})

ipcMain.handle('settings:getDocumentFolders', async (event, companyId, relatedType, relatedId) => db.getDocumentFolders(companyId, relatedType, relatedId))
ipcMain.handle('settings:createDocumentFolder', async (event, data) => {
    const result = await db.createDocumentFolder(data)
    if (result.success) notifyDbUpdate({ table: 'document_folders', action: 'create' })
    return result
})
ipcMain.handle('settings:updateDocumentFolder', async (event, data) => {
    const result = await db.updateDocumentFolder(data)
    if (result.success) notifyDbUpdate({ table: 'document_folders', action: 'update' })
    return result
})
ipcMain.handle('settings:deleteDocumentFolder', async (event, id) => {
    const result = await db.deleteDocumentFolder(id)
    if (result.success) notifyDbUpdate({ table: 'document_folders', action: 'delete' })
    return result
})

// Vehicle Types
ipcMain.handle('settings:getVehicleTypes', async (event, companyId) => db.getVehicleTypes(companyId))
ipcMain.handle('settings:createVehicleType', async (event, data) => {
    const result = await db.createVehicleType(data)
    if (result.success) notifyDbUpdate({ table: 'vehicle_types', action: 'create' })
    return result
})
ipcMain.handle('settings:updateVehicleType', async (event, data) => {
    const result = await db.updateVehicleType(data)
    if (result.success) notifyDbUpdate({ table: 'vehicle_types', action: 'update' })
    return result
})
ipcMain.handle('settings:deleteVehicleType', async (event, id) => {
    const result = await db.deleteVehicleType(id)
    if (result.success) notifyDbUpdate({ table: 'vehicle_types', action: 'delete' })
    return result
})

ipcMain.handle('settings:selectFolder', async (event) => {
    const parentWin = (event && event.sender) ? BrowserWindow.fromWebContents(event.sender) : mainWindow;
    const { canceled, filePaths } = await dialog.showOpenDialog(parentWin || mainWindow, {
        title: 'Klasör Seç',
        properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || !filePaths || filePaths.length === 0) {
        return { success: false, canceled: true, filePaths: [], filePath: null }
    }
    return { success: true, filePaths, filePath: filePaths[0] }
})

// Initialize auto backup and notifications on app start
app.on('ready', () => {
    const settings = loadSettings()
    setupAutoBackup(settings)
    setupArventoPolling(settings)
    setupNotificationCheck()
})

let notificationInterval = null
let notifiedEvents = new Set() // Store keys to avoid double notifying in same session

async function checkAndNotify() {
    const settings = loadSettings()
    if (!settings.userId) return

    try {
        const companies = await db.getCompanies(settings.userId)
        if (!companies.success) return

        for (const company of companies.data) {
            const result = await db.getUpcomingEvents(company.id)
            if (result.success) {
                // Filter events based on user preferences
                const preferences = settings.notificationPreferences || {}
                const criticalEvents = result.data.filter(e => {
                    // Check if this category is enabled (default to true if not set)
                    const isEnabled = preferences[e.eventType] !== false
                    if (!isEnabled) return false

                    const eventDate = new Date(e.date)
                    const now = new Date()
                    const diffDays = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24))
                    return diffDays < 3 
                })

                for (const event of criticalEvents) {
                    const eventKey = `${event.eventType}-${event.id}-${event.date}`
                    if (!notifiedEvents.has(eventKey)) {
                        let title = 'Hatırlatma'
                        let body = ''

                        const formattedDate = new Date(event.date).toLocaleDateString('tr-TR')
                        const daysUntil = Math.ceil((new Date(event.date) - new Date()) / (1000 * 60 * 60 * 24))
                        const timeStatus = daysUntil < 0 ? 'GECİKTİ!' : (daysUntil === 0 ? 'BUGÜN!' : `${daysUntil} gün kaldı`)

                        switch (event.eventType) {
                            case 'maintenance':
                                title = `Bakım: ${event.plate}`
                                body = `${event.plate} plakalı aracın bakımı yaklaşıyor (${timeStatus}). Tarih: ${formattedDate}`
                                break
                            case 'inspection':
                                title = `Muayene: ${event.plate}`
                                body = `${event.plate} plakalı aracın ${event.type} zamanı (${timeStatus}). Tarih: ${formattedDate}`
                                break
                            case 'insurance':
                                title = `Sigorta: ${event.plate}`
                                body = `${event.plate} plakalı aracın ${event.type} süresi doluyor (${timeStatus}). Tarih: ${formattedDate}`
                                break
                            case 'employee_document':
                                title = `Personel: ${event.employeeName}`
                                body = `${event.employeeName} isimli personelin ${event.type} süresi doluyor (${timeStatus}). Tarih: ${formattedDate}`
                                break
                            case 'finance_check':
                                title = `Finans: Çek/Senet`
                                body = `${event.type} vadesi geldi (${timeStatus}). Tutar: ${event.amount ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(event.amount) : ''}`
                                break
                            case 'reminder':
                                title = event.type
                                body = `${event.description || 'Hatırlatma zamanı geldi.'} (${timeStatus})`
                                break
                            default:
                                title = event.plate || event.employeeName || 'Önemli Hatırlatma'
                                body = `${event.type} (${timeStatus}). Tarih: ${formattedDate}`
                        }
                        
                        if (Notification.isSupported()) {
                            new Notification({ 
                                title, 
                                body,
                                icon: path.join(__dirname, '../resources/icon.png')
                            }).show()
                        }
                        
                        notifiedEvents.add(eventKey)
                    }
                }
            }
        }
    } catch (error) {
        log.error('Periodic notification check failed:', error)
    }
}

async function checkPeriodicSummary() {
    // Check for Daily Summary
    await checkAndNotifySummary()
}

async function checkAndNotifySummary() {
    const settings = loadSettings()
    if (!settings.notificationSummaryEnabled || !settings.notificationSummaryTime || !settings.userId) return

    const now = new Date()
    const currentHourMin = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    
    if (currentHourMin !== settings.notificationSummaryTime) return

    const todayStr = now.toISOString().split('T')[0]
    const eventKey = `summary-${settings.userId}-${todayStr}`
    
    if (notifiedEvents.has(eventKey)) return

    try {
        const companies = await db.getCompanies(settings.userId)
        if (!companies.success) return

        let totalUpcoming = 0
        let summaryLines = []

        for (const company of companies.data) {
            const result = await db.getUpcomingEvents(company.id)
            if (result.success && result.data.length > 0) {
                const criticalCount = result.data.length
                totalUpcoming += criticalCount
                
                // Categorize
                const categories = {}
                result.data.forEach(e => {
                    const cat = e.eventType === 'maintenance' ? 'Bakım' : 
                                e.eventType === 'inspection' ? 'Muayene' :
                                e.eventType === 'insurance' ? 'Sigorta' : 'Diğer'
                    categories[cat] = (categories[cat] || 0) + 1
                })
                
                const catStr = Object.entries(categories).map(([k, v]) => `${v} ${k}`).join(', ')
                summaryLines.push(`${company.name}: ${criticalCount} işlem (${catStr})`)
            }
        }

        if (totalUpcoming > 0) {
            if (Notification.isSupported()) {
                new Notification({
                    title: `Günlük Hatırlatıcı Özeti`,
                    body: `Takip etmeniz gereken ${totalUpcoming} güncel işlem var.\n${summaryLines.slice(0, 3).join('\n')}${summaryLines.length > 3 ? '\n...' : ''}`,
                    icon: path.join(__dirname, '../resources/icon.png')
                }).show()
            }
            notifiedEvents.add(eventKey)
        }
    } catch (error) {
        log.error('Summary notification failed:', error)
    }
}

function setupNotificationCheck() {
    if (notificationInterval) clearInterval(notificationInterval)
    // Every 30 minutes for general checks
    notificationInterval = setInterval(checkAndNotify, 30 * 60 * 1000)
    
    // Every 1 minute for daily summary time-check
    setInterval(checkPeriodicSummary, 60 * 1000)

    // Run first checks after a short delay
    setTimeout(() => {
        checkAndNotify()
        checkPeriodicSummary()
    }, 10000)
}


// ============ AUTO UPDATER ============

// Configure auto updater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowPrerelease = true
autoUpdater.allowDowngrade = false

// Update Events
autoUpdater.on('checking-for-update', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'checking' })
})

autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'available', info })
})

autoUpdater.on('update-not-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'not-available', info })
})

autoUpdater.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'error', error: err.message })
})

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-progress', progressObj)
})

autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'downloaded', info })
})

// Update IPC Handlers
ipcMain.handle('app:checkForUpdates', () => {
    // Check if we are in development mode
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        return { status: 'dev-mode', message: 'Geliştirici modunda güncelleme kontrolü yapılamaz.' }
    }

    try {
        autoUpdater.checkForUpdates()
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
})

ipcMain.handle('app:downloadUpdate', () => {
    autoUpdater.downloadUpdate()
})

ipcMain.handle('app:quitAndInstall', () => {
    autoUpdater.quitAndInstall(false, true)
})

ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
})

ipcMain.on('app:openExternal', (event, url) => {
    require('electron').shell.openExternal(url)
})

// File handlers
ipcMain.handle('files:select', async (event, options = {}) => {
    const properties = options?.multiple === false ? ['openFile'] : ['openFile', 'multiSelections']
    const result = await dialog.showOpenDialog({
        properties,
        filters: options?.filters || [
            { name: 'Tüm Desteklenen Dosyalar', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'doc', 'docx', 'xls', 'xlsx'] },
            { name: 'Görseller (PNG, JPG, SVG, WEBP, BMP)', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
            { name: 'Belgeler (PDF, Word, Excel)', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx'] }
        ]
    })
    return result
})

ipcMain.handle('files:save', async (event, sourcePath) => {
    if (!sourcePath) return null
    try {
        const userDataPath = app.getPath('userData')
        const filesDir = path.join(userDataPath, 'files')
        if (!fs.existsSync(filesDir)) {
            fs.mkdirSync(filesDir, { recursive: true })
        }

        const ext = path.extname(sourcePath)
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`
        const destPath = path.join(filesDir, fileName)

        await copyOrCloneFile(sourcePath, destPath)

        // Asynchronously upload to Supabase Storage in background for cross-PC availability
        try {
            const { uploadToStorage } = require('./services/supabase.service');
            const fileBuf = fs.readFileSync(destPath);
            let mimeType = 'application/octet-stream';
            const extLower = ext.toLowerCase();
            if (extLower === '.pdf') mimeType = 'application/pdf';
            else if (extLower === '.jpg' || extLower === '.jpeg') mimeType = 'image/jpeg';
            else if (extLower === '.png') mimeType = 'image/png';
            uploadToStorage(fileBuf, fileName, mimeType, 'documents').catch(err => {
                console.warn('[Supabase Sync Notice]: File saved locally, background cloud upload:', err.message);
            });
        } catch (e) {}

        return fileName
    } catch (error) {
        console.error('File save error:', error)
        throw new Error(error.message)
    }
})

ipcMain.handle('files:open', async (event, fileName) => {
    if (!fileName) return
    const userDataPath = app.getPath('userData')
    const appDataPath = app.getPath('appData')
    const homeDir = app.getPath('home')
    const baseName = path.basename(fileName)

    const searchDirs = [
        path.join(userDataPath, 'files'),
        path.join(appDataPath, 'kontrol-app', 'files'),
        path.join(appDataPath, 'AracTakip', 'files'),
        path.join(appDataPath, 'muayen', 'files'),
        path.join(homeDir, 'Library', 'Application Support', 'kontrol-app', 'files'),
        path.join(homeDir, 'Library', 'Application Support', 'AracTakip', 'files'),
        path.join(homeDir, 'Library', 'Application Support', 'muayen', 'files'),
    ]

    for (const dir of searchDirs) {
        const candidate = path.join(dir, baseName)
        if (fs.existsSync(candidate)) {
            await shell.openPath(candidate)
            return
        }
    }
})

// Document Management Handlers
ipcMain.handle('documents:add', async (event, data) => {
    try {
        const userDataPath = app.getPath('userData')
        const filesDir = path.join(userDataPath, 'files')

        // Ensure directory exists
        if (!fs.existsSync(filesDir)) {
            fs.mkdirSync(filesDir, { recursive: true })
        }

        const sourcePath = typeof data.filePath === 'object' && data.filePath !== null ? data.filePath.path : data.filePath
        const ext = path.extname(sourcePath || '')
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`
        const destPath = path.join(filesDir, fileName)

        // Copy file
        await copyOrCloneFile(sourcePath, destPath)

        // Add to DB
        const result = await db.addDocument({
            vehicleId: data.vehicleId,
            relatedType: data.relatedType,
            relatedId: data.relatedId,
            fileName: data.fileName || (typeof data.filePath === 'object' && data.filePath !== null ? data.filePath.name : null) || path.basename(sourcePath),
            filePath: fileName, // Store relative path (filename only)
            fileType: ext,
            startDate: data.startDate,
            endDate: data.endDate,
            category: data.category || data.docType || null,
            docType: data.docType || data.category || null,
            folder: data.folder || null
        })

        // Also update the related operation record's file_path!
        if (result.success && data.relatedType && data.relatedId) {
            const prisma = getPrismaClient()
            const modelMap = {
                'inspection': 'inspections',
                'periodic_inspection': 'inspections',
                'insurance': 'insurances',
                'service': 'services',
                'maintenance': 'maintenances',
                'assignment': 'assignments'
            }
            const modelName = modelMap[data.relatedType]
            const prismaModel = modelName ? prisma[modelName] : null
            if (prismaModel) {
                await prismaModel.update({
                    where: { id: parseInt(data.relatedId) },
                    data: { file_path: fileName }
                });
            }
            // Trigger update of the specific table so lists refresh
            if (modelName) {
                notifyDbUpdate({ table: modelName, action: 'update' })
            }
        }

        if (result.success) {
            notifyDbUpdate({ table: 'documents', action: 'create' })
        }

        return result
    } catch (error) {
        console.error('Document add error:', error)
        return { success: false, error: error.message }
    }
})

ipcMain.handle('documents:update', async (event, data) => {
    try {
        const result = await db.updateDocument(data.id, data)
        if (result.success) {
            notifyDbUpdate({ table: 'documents', action: 'update' })
        }
        return result
    } catch (error) {
        console.error('Document update error:', error)
        return { success: false, error: error.message }
    }
})

ipcMain.handle('documents:getByVehicle', (event, vehicleId, isArchived) => {
    return db.getDocumentsByVehicle(vehicleId, isArchived)
})

ipcMain.handle('documents:getByCompany', (event, companyId, isArchived) => {
    return db.getDocumentsByCompany(companyId, isArchived)
})

ipcMain.handle('documents:delete', async (event, id) => {
    try {
        // 1. Get info to find file
        const docResult = await db.getDocument(id)
        let modelName = null
        if (docResult.success && docResult.data) {
            const fileName = docResult.data.file_path
            const userDataPath = app.getPath('userData')
            const filePath = path.join(userDataPath, 'files', fileName)

            // 2. Delete physical file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
            }

            // 2b. Also update the related operation's file_path to null!
            const relatedType = docResult.data.related_type
            const relatedId = docResult.data.related_id
            if (relatedType && relatedId) {
                const prisma = getPrismaClient()
                const modelMap = {
                    'inspection': 'inspections',
                    'periodic_inspection': 'inspections',
                    'insurance': 'insurances',
                    'service': 'services',
                    'maintenance': 'maintenances',
                    'assignment': 'assignments'
                }
                modelName = modelMap[relatedType]
                const prismaModel = modelName ? prisma[modelName] : null
                if (prismaModel) {
                    await prismaModel.update({
                        where: { id: parseInt(relatedId) },
                        data: { file_path: null }
                    });
                }
            }
        }

        // 3. Delete from DB
        const result = await db.deleteDocument(id)
        if (result.success) {
            notifyDbUpdate({ table: 'documents', action: 'delete' })
            if (modelName) {
                notifyDbUpdate({ table: modelName, action: 'update' })
            }
        }
        return result
    } catch (error) {
        console.error('Document delete error:', error)
        return { success: false, error: error.message }
    }
})

ipcMain.handle('documents:open', async (event, fileName) => {
    if (!fileName) return 'No filename provided'
    const userDataPath = app.getPath('userData')
    const appDataPath = app.getPath('appData')
    const homeDir = app.getPath('home')
    const baseName = path.basename(fileName)

    // 1. Try absolute path as-is
    if (path.isAbsolute(fileName) && fs.existsSync(fileName)) {
        return await shell.openPath(fileName)
    }

    // 2. Build candidate paths: current userData + all legacy app dirs
    const searchDirs = [
        path.join(userDataPath, 'files'),
        path.join(appDataPath, 'kontrol-app', 'files'),
        path.join(appDataPath, 'AracTakip', 'files'),
        path.join(appDataPath, 'muayen', 'files'),
        path.join(homeDir, 'Library', 'Application Support', 'kontrol-app', 'files'),
        path.join(homeDir, 'Library', 'Application Support', 'AracTakip', 'files'),
        path.join(homeDir, 'Library', 'Application Support', 'muayen', 'files'),
    ]

    for (const dir of searchDirs) {
        const candidate = path.join(dir, baseName)
        if (fs.existsSync(candidate)) {
            return await shell.openPath(candidate)
        }
    }

    return 'File not found: ' + baseName
})

ipcMain.handle('documents:openTempData', async (event, base64Data, fileName) => {
    try {
        const tempDir = app.getPath('temp')
        const cleanName = fileName || `document_${Date.now()}`
        const targetPath = path.join(tempDir, cleanName)
        
        const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
        const buffer = Buffer.from(base64Content, 'base64')
        fs.writeFileSync(targetPath, buffer)
        
        const error = await shell.openPath(targetPath)
        return error
    } catch (err) {
        return err.message
    }
})

ipcMain.handle('documents:downloadFile', async (event, { filePath, base64Data, defaultName }) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender)
        const ext = defaultName ? path.extname(defaultName).replace('.', '') : ''
        const filters = ext ? [{ name: `${ext.toUpperCase()} Dosyası`, extensions: [ext] }, { name: 'Tüm Dosyalar', extensions: ['*'] }] : [{ name: 'Tüm Dosyalar', extensions: ['*'] }]
        
        const { canceled, filePath: chosenPath } = await dialog.showSaveDialog(win, {
            title: 'Belgeyi Kaydet',
            defaultPath: defaultName || 'belge',
            filters
        })

        if (canceled || !chosenPath) return { success: false, canceled: true }

        if (filePath && fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, chosenPath)
        } else if (base64Data) {
            const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
            const buffer = Buffer.from(base64Content, 'base64')
            fs.writeFileSync(chosenPath, buffer)
        } else {
            return { success: false, error: 'Dosya içeriği veya yolu bulunamadı.' }
        }

        return { success: true, filePath: chosenPath }
    } catch (err) {
        return { success: false, error: err.message }
    }
})

ipcMain.handle('documents:readData', async (event, fileName) => {
    try {
        if (!fileName) return { success: false, notFound: true, error: 'Dosya adı belirtilmedi' }
        const userDataPath = app.getPath('userData')
        const cleanName = path.basename(fileName)
        
        let filePath = fileName
        if (!path.isAbsolute(fileName)) {
            filePath = path.join(userDataPath, 'files', fileName)
        }

        if (!fs.existsSync(filePath)) {
            // Check possible local folders
            const candidatePaths = [
                path.join(userDataPath, 'files', cleanName),
                path.join(userDataPath, 'data', cleanName),
                path.join(userDataPath, 'uploads', cleanName),
                path.join(userDataPath, 'data', 'files', cleanName),
                path.join(__dirname, '../data/files', cleanName)
            ]
            const foundLocal = candidatePaths.find(p => fs.existsSync(p))

            if (foundLocal) {
                filePath = foundLocal
            } else {
                // 1. Fetch from Supabase Storage for cross-PC synchronization
                let fetchedFromCloud = false;
                try {
                    const { downloadFromStorage } = require('./services/supabase.service');
                    const storageRes = await downloadFromStorage(cleanName, 'documents');
                    if (storageRes && storageRes.success && storageRes.buffer) {
                        const filesDir = path.join(userDataPath, 'files');
                        if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
                        const cachedPath = path.join(filesDir, cleanName);
                        fs.writeFileSync(cachedPath, storageRes.buffer);
                        filePath = cachedPath;
                        fetchedFromCloud = true;
                    }
                } catch (cloudErr) {
                    console.warn('[Cloud Storage Fetch Notice]:', cloudErr.message);
                }

                // 2. Fetch from Central Web Server /uploads/ as secondary fallback
                if (!fetchedFromCloud && !fs.existsSync(filePath)) {
                    try {
                        const https = require('https');
                        const fetchFromServer = (url) => new Promise((resolve) => {
                            const req = https.get(url, (res) => {
                                if (res.statusCode === 200 && res.headers['content-type'] && !res.headers['content-type'].includes('text/html')) {
                                    const chunks = [];
                                    res.on('data', d => chunks.push(d));
                                    res.on('end', () => resolve(Buffer.concat(chunks)));
                                } else {
                                    resolve(null);
                                }
                            });
                            req.on('error', () => resolve(null));
                            req.setTimeout(5000, () => {
                                req.destroy();
                                resolve(null);
                            });
                        });

                        const serverBuf = await fetchFromServer(`https://kontrol-app.com/uploads/${encodeURIComponent(cleanName)}`);
                        if (serverBuf && serverBuf.length > 0) {
                            const filesDir = path.join(userDataPath, 'files');
                            if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
                            const cachedPath = path.join(filesDir, cleanName);
                            fs.writeFileSync(cachedPath, serverBuf);
                            filePath = cachedPath;
                            fetchedFromCloud = true;
                        }
                    } catch (netErr) {
                        console.warn('[Server fallback fetch notice]:', netErr.message);
                    }
                }

                if (!fetchedFromCloud && !fs.existsSync(filePath)) {
                    return { 
                        success: false, 
                        notFound: true, 
                        error: 'Belge dosyası diskte veya bulutta bulunamadı.',
                        fileName: cleanName,
                        filePath 
                    };
                }
            }
        }

        const ext = path.extname(filePath).toLowerCase()
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.bmp': 'image/bmp',
            '.avif': 'image/avif',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.log': 'text/plain',
            '.csv': 'text/csv',
            '.json': 'application/json',
            '.xml': 'text/xml',
            '.html': 'text/html',
            '.md': 'text/markdown'
        }

        const mimeType = mimeTypes[ext] || 'application/octet-stream'
        const stats = await fs.promises.stat(filePath)
        
        if (!mimeTypes[ext]) {
            return { 
                success: true, 
                isUnsupported: true, 
                ext, 
                path: filePath, 
                size: stats.size, 
                fileName: path.basename(filePath) 
            }
        }

        const fileData = await fs.promises.readFile(filePath, { encoding: 'base64' })
        return { 
            success: true, 
            data: `data:${mimeType};base64,${fileData}`, 
            type: mimeType, 
            ext, 
            path: filePath, 
            size: stats.size 
        }
    } catch (error) {
        console.error('Read data error:', error)
        return { success: false, error: error.message }
    }
})

// Add PDF Save Handler
ipcMain.handle('save-pdf', async (event, options = {}) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
        
        const { canceled, filePath } = await dialog.showSaveDialog(win, {
            title: 'PDF Olarak Kaydet',
            defaultPath: options?.defaultPath || `Is_Raporu_${Date.now()}.pdf`,
            filters: [
                { name: 'PDF Belgeleri', extensions: ['pdf'] }
            ]
        });

        if (canceled || !filePath) return { success: false, canceled: true };

        const pdfData = await win.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            margins: { marginType: 'none' },
            preferCSSPageSize: true
        });

        fs.writeFileSync(filePath, pdfData);
        return { success: true, filePath };
    } catch (err) {
        console.error('Save PDF Error:', err);
        return { success: false, error: err.message };
    }
})

// Report PDF - Hidden window approach (no visible window opens)
ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
        if (!folderPath) return { success: false, error: 'Klasör yolu belirtilmeyebilir.' };
        const normalized = path.normalize(folderPath);
        if (fs.existsSync(normalized)) {
            await shell.openPath(normalized);
            return { success: true };
        }
        return { success: false, error: 'Klasör bulunamadı: ' + normalized };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('save-report-pdf', async (event, route = '/print', options = {}) => {
    let hiddenWin = null;
    try {
        const parentWin = (event && event.sender) ? BrowserWindow.fromWebContents(event.sender) : mainWindow;
        let filePath = '';

        if (options.silent) {
            if (options.targetFilePath) {
                filePath = path.normalize(options.targetFilePath);
            } else {
                const tempDir = app.getPath('temp');
                const fileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;
                filePath = path.join(tempDir, fileName);
            }
        } else {
            const { canceled, filePath: chosenPath } = await dialog.showSaveDialog(parentWin || mainWindow, {
                title: 'Belgeyi PDF Olarak Kaydet',
                defaultPath: options.defaultPath || `Belge_${new Date().toISOString().split('T')[0]}.pdf`,
                filters: [
                    { name: 'PDF Belgeleri', extensions: ['pdf'] }
                ]
            });

            if (canceled || !chosenPath) return { success: false, canceled: true };
            filePath = path.normalize(chosenPath);
        }

        // Ensure target directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Create hidden window with non-focusable flags so it never hijacks keyboard responder
        hiddenWin = new BrowserWindow({
            width: 1400,
            height: 1000,
            show: false,
            focusable: false,
            skipTaskbar: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        // Load the print page route (cross-platform compatible on Windows/macOS)
        if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
            const devRoute = route.startsWith('/') ? route : `/${route}`;
            await hiddenWin.loadURL(`http://127.0.0.1:5173/#${devRoute}`);
        } else {
            const cleanHash = route.startsWith('#') ? route.substring(1) : (route.startsWith('/') ? route : `/${route}`);
            await hiddenWin.loadFile(path.join(__dirname, '../dist/index.html'), { hash: cleanHash });
        }

        // Inject the data directly to avoid localStorage sync issues
        const storedData = await parentWin.webContents.executeJavaScript(`localStorage.getItem('printDocData')`);
        const printData = await parentWin.webContents.executeJavaScript(`localStorage.getItem('printData')`);
        
        if (storedData) {
            const rawStr = typeof storedData === 'string' ? storedData : JSON.stringify(storedData);
            await hiddenWin.webContents.executeJavaScript(`
                try {
                    localStorage.setItem('printDocData', ${JSON.stringify(rawStr)});
                    window.dispatchEvent(new Event('storage'));
                    if (window.refreshPrintData) window.refreshPrintData();
                } catch(e) { console.error(e); }
            `);
        }
        if (printData) {
            const rawStr = typeof printData === 'string' ? printData : JSON.stringify(printData);
            await hiddenWin.webContents.executeJavaScript(`
                try {
                    localStorage.setItem('printData', ${JSON.stringify(rawStr)});
                    window.dispatchEvent(new Event('storage'));
                    if (window.refreshPrintData) window.refreshPrintData();
                } catch(e) { console.error(e); }
            `);
        }

        // Detect landscape orientation from options or payload
        let isLandscape = !!options.landscape;
        if (!isLandscape && printData) {
            try {
                const parsed = typeof printData === 'string' ? JSON.parse(printData) : printData;
                if (parsed && (parsed.orientation === 'landscape' || parsed.isLandscape)) {
                    isLandscape = true;
                }
            } catch (e) {}
        }
        if (!isLandscape && storedData) {
            try {
                const parsed = typeof storedData === 'string' ? JSON.parse(storedData) : storedData;
                if (parsed && (parsed.orientation === 'landscape' || parsed.isLandscape)) {
                    isLandscape = true;
                }
            } catch (e) {}
        }

        // Wait for content to fully render
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Generate PDF with true landscape dimensions when requested
        const pdfData = await hiddenWin.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            landscape: isLandscape,
            margins: { marginType: 'none' },
            preferCSSPageSize: true
        });

        fs.writeFileSync(filePath, pdfData);

        if (hiddenWin && !hiddenWin.isDestroyed()) {
            hiddenWin.close();
            hiddenWin = null;
        }

        // Restore focus to parent window
        if (parentWin && !parentWin.isDestroyed()) {
            parentWin.focus();
            if (parentWin.webContents) parentWin.webContents.focus();
        }

        return { success: true, filePath };
    } catch (err) {
        console.error('Report PDF Error:', err);
        if (hiddenWin && !hiddenWin.isDestroyed()) {
            hiddenWin.close();
            hiddenWin = null;
        }
        if (parentWin && !parentWin.isDestroyed()) {
            parentWin.focus();
            if (parentWin.webContents) parentWin.webContents.focus();
        }
        return { success: false, error: err.message };
    }
});

// Recover and force window / webContents focus
ipcMain.handle('window:focus', (event) => {
    try {
        const win = (event && event.sender) ? BrowserWindow.fromWebContents(event.sender) : mainWindow;
        if (win && !win.isDestroyed()) {
            win.focus();
            if (win.webContents) win.webContents.focus();
            return { success: true };
        }
    } catch (e) {}
    return { success: false };
});

ipcMain.handle('window:setFullScreen', (event, flag) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.setFullScreen(flag);
            return { success: true };
        }
        return { success: false, error: 'Window not found' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Database Migration to Postgres (Multi-PC collision-free safe migration)
const { migrateSqliteToPostgres } = require('./services/postgresMigration.service');
ipcMain.handle('database:migrateToPostgres', async (event, postgresUrl) => {
    return await migrateSqliteToPostgres(event.sender, postgresUrl);
});

// Platform Super Admin IPC Handlers
ipcMain.handle('platform:getOverview', async () => {
    return await db.getPlatformOverview();
});
ipcMain.handle('platform:getUsers', async () => {
    return await db.getPlatformUsers();
});
ipcMain.handle('platform:getCompanyUsers', async (event, companyId) => {
    return await db.getCompanyUsers(companyId);
});
ipcMain.handle('platform:resetUserPassword', async (event, userId, newPassword) => {
    return await db.resetPlatformUserPassword(userId, newPassword);
});
ipcMain.handle('platform:impersonateUser', async (event, userId) => {
    return await db.impersonatePlatformUser(userId);
});
ipcMain.handle('platform:createUser', async (event, userData) => {
    return await db.createPlatformUser(userData);
});
ipcMain.handle('platform:updateUser', async (event, userId, userData) => {
    return await db.updatePlatformUser(userId, userData);
});
ipcMain.handle('platform:deleteUser', async (event, userId) => {
    return await db.deletePlatformUser(userId);
});
ipcMain.handle('platform:toggleCompanyStatus', async (event, companyId, isActive) => {
    return await db.toggleCompanyStatus(companyId, isActive);
});
ipcMain.handle('platform:toggleUserStatus', async (event, userId, isActive) => {
    return await db.toggleUserStatus(userId, isActive);
});
ipcMain.handle('platform:getBackups', async () => {
    return await db.getPlatformBackups();
});
ipcMain.handle('platform:triggerBackup', async () => {
    return await db.triggerPlatformBackup();
});
ipcMain.handle('platform:getSystemHealth', async () => {
    return await db.getPlatformSystemHealth();
});
ipcMain.handle('platform:getLogs', async (event, limit) => {
    return await db.getPlatformLogs(limit);
});
ipcMain.handle('platform:clearLogs', async () => {
    return await db.clearPlatformLogs();
});
ipcMain.handle('platform:getAnnouncements', async () => {
    return await db.getPlatformAnnouncements();
});
ipcMain.handle('platform:getActiveAnnouncements', async (event, companyId) => {
    return await db.getActiveAnnouncements(companyId);
});
ipcMain.handle('platform:createAnnouncement', async (event, payload) => {
    return await db.createPlatformAnnouncement(payload);
});
ipcMain.handle('platform:toggleAnnouncementStatus', async (event, id, isActive) => {
    return await db.toggleAnnouncementStatus(id, isActive);
});
ipcMain.handle('platform:deleteAnnouncement', async (event, id) => {
    return await db.deletePlatformAnnouncement(id);
});
ipcMain.handle('platform:createCompany', async (event, data) => {
    return await db.createPlatformCompany(data);
});
ipcMain.handle('platform:updateCompany', async (event, data) => {
    return await db.updatePlatformCompany(data);
});
ipcMain.handle('platform:deleteCompany', async (event, companyId) => {
    return await db.deletePlatformCompany(companyId);
});

// 2FA / MFA IPC Handlers
ipcMain.handle('mfa:generateSetup', async (event, userId) => {
    return await mfaService.generateMfaSetup(userId);
});
ipcMain.handle('mfa:enable', async (event, userId, secret, token, backupCodes) => {
    return await mfaService.enableMfa(userId, secret, token, backupCodes);
});
ipcMain.handle('mfa:disable', async (event, userId) => {
    return await mfaService.disableMfa(userId);
});
ipcMain.handle('mfa:verifyLogin', async (event, userId, tokenOrBackupCode) => {
    return await mfaService.verifyMfaLogin(userId, tokenOrBackupCode);
});
ipcMain.handle('mfa:getStatus', async (event, userId) => {
    return await mfaService.getMfaStatus(userId);
});

// Platform Audit Trail IPC Handlers
ipcMain.handle('platform:getAuditLogs', async (event, params) => {
    return await auditService.getPlatformAuditLogs(params);
});
ipcMain.handle('platform:getAuditSummaryMetrics', async (event) => {
    return await auditService.getAuditSummaryMetrics();
});

// Live Session & Online User Monitoring IPC Handlers
ipcMain.handle('session:heartbeat', async (event, payload) => {
    return sessionService.recordHeartbeat(payload);
});
ipcMain.handle('session:getRealtimeActiveUsers', async (event) => {
    return sessionService.getRealtimeActiveUsers();
});
ipcMain.handle('session:terminate', async (event, sessionId) => {
    return sessionService.terminateUserSession(sessionId);
});

// Platform Email Templates IPC Handlers
ipcMain.handle('platform:getEmailTemplates', async () => {
    return await emailTemplateService.getEmailTemplates();
});
ipcMain.handle('platform:saveEmailTemplate', async (event, data) => {
    return await emailTemplateService.saveEmailTemplate(data);
});
ipcMain.handle('platform:resetEmailTemplate', async (event, data) => {
    return await emailTemplateService.resetEmailTemplate(data);
});
ipcMain.handle('platform:sendTestEmail', async (event, data) => {
    return await emailTemplateService.sendTestEmail(data);
});
ipcMain.handle('platform:getEmailSettings', async () => {
    return await emailTemplateService.getEmailSettings();
});
ipcMain.handle('platform:saveEmailSettings', async (event, data) => {
    return await emailTemplateService.saveEmailSettings(data);
});
ipcMain.handle('platform:testSmtpConnection', async (event, data) => {
    return await emailTemplateService.testSmtpConnection(data);
});

// Company Impersonation / Observer Mode New Window
ipcMain.handle('platform:openImpersonateWindow', async (event, { companyId, companyName }) => {
    try {
        const bounds = store.get('windowBounds') || { width: 1400, height: 900 };
        let platformIcon = path.join(__dirname, '../resources/icon-win.png');
        if (process.platform === 'darwin') {
            platformIcon = path.join(__dirname, '../resources/icon-mac.png');
        }

        const impersonateWin = new BrowserWindow({
            title: `[GÖZLEMCİ MODU] ${companyName || 'Şirket'} - Kontrol`,
            width: bounds.width,
            height: bounds.height,
            minWidth: 1200,
            minHeight: 700,
            icon: platformIcon,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                plugins: true
            },
            titleBarStyle: 'hidden',
            titleBarOverlay: {
                color: '#18181b',
                symbolColor: '#ffffff',
                height: 38
            },
            trafficLightPosition: { x: 12, y: 12 },
            backgroundColor: '#0f0f1a',
            show: false
        });

        const queryString = `impersonate_company_id=${companyId}&impersonate_company_name=${encodeURIComponent(companyName || '')}`;
        if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
            impersonateWin.loadURL(`http://127.0.0.1:5173/?${queryString}#/portal`);
        } else {
            impersonateWin.loadFile(path.join(__dirname, '../dist/index.html'), {
                search: `?${queryString}`,
                hash: '/portal'
            });
        }

        impersonateWin.once('ready-to-show', () => {
            impersonateWin.show();
            impersonateWin.focus();
        });

        return { success: true };
    } catch (err) {
        log.error('Failed to open impersonate window:', err);
        return { success: false, error: err.message };
    }
});

