import { loadingManager } from '../utils/loadingManager';

const PASSIVE_RPC_METHODS = new Set([
    'checkForUpdates',
    'getMemoryUsage',
    'getDiskUsage',
    'getPlatform',
    'getAppVersion',
    'on',
    'removeListener',
    'removePCListeners',
    'removeUpdateListeners',
    'recordHeartbeat',
    'getRealtimeActiveUsers',
    'getActiveAnnouncements',
    'getPlatformLogs',
    'getUpcomingEvents',
    'getUpcomingPersonnelDocuments',
    'showNotification',
    'getUserNotificationSettings',
    'getCompanyNotificationSettings',
    'arventoGetStatus',
    'arventoGetDailyReport',
    'arventoGetAlarms',
    'arventoGetInfo',
    'searchGlobal'
]);

if (typeof window !== 'undefined' && !window.electronAPI) {
    console.info('[API Bridge] Running in Web mode. Polyfilling window.electronAPI via HTTP RPC.');

    window.electronAPI = new Proxy({}, {
        get(target, prop) {
            // Event listener mocks
            if (
                prop === 'on' || prop === 'onDbUpdate' || prop === 'onContextAction' || 
                prop === 'onUpdateDownloaded' || prop === 'onUpdateAvailable' || 
                prop === 'onUpdateStatus' || prop === 'onUpdateProgress' ||
                prop === 'onTriggerAction' || prop === 'onNavigate' || prop === 'onMigrationLog'
            ) {
                return (callback) => {
                    const handler = (e) => callback(e.detail);
                    window.addEventListener(`electron:${String(prop)}`, handler);
                    return () => window.removeEventListener(`electron:${String(prop)}`, handler);
                };
            }

            if (prop === 'removeListener' || prop === 'removePCListeners' || prop === 'removeUpdateListeners') {
                return () => {};
            }

            if (prop === 'openImpersonateWindow') {
                return undefined;
            }

            if (prop === 'getPlatform') {
                return async () => (navigator.platform || 'web').toLowerCase();
            }

            if (prop === 'getAppVersion') {
                return async () => typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.13.148';
            }

            if (prop === 'openExternal') {
                return async (url) => {
                    window.open(url, '_blank', 'noopener,noreferrer');
                    return { success: true };
                };
            }

            if (prop === 'focusWindow' || prop === 'setFullScreen') {
                return async () => ({ success: true });
            }

            if (prop === 'openFolder') {
                return async () => ({ success: true });
            }

            if (prop === 'getPathForFile') {
                return (file) => file?.path || null;
            }

            if (prop === 'uploadFileBase64') {
                return async ({ fileName, fileData, companyId, module, entityId, category }) => {
                    try {
                        const token = localStorage.getItem('token') || localStorage.getItem('aractakip_token') || sessionStorage.getItem('token');
                        let currentCompanyId = companyId;
                        if (!currentCompanyId) {
                            try {
                                const stored = JSON.parse(localStorage.getItem('aractakip_company') || localStorage.getItem('company') || 'null');
                                currentCompanyId = Number(typeof stored === 'object' ? stored?.id : stored) || null;
                            } catch (e) {}
                        }
                        if (!currentCompanyId) {
                            try {
                                const u = JSON.parse(localStorage.getItem('user') || 'null');
                                currentCompanyId = Number(u?.company_id || u?.companyId) || null;
                            } catch (e) {}
                        }

                        const uploadRes = await fetch('/api/upload', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                            },
                            body: JSON.stringify({
                                fileName,
                                fileData,
                                companyId: currentCompanyId,
                                module: module || 'documents',
                                entityId: entityId || null,
                                category: category || null
                            })
                        });

                        const data = await uploadRes.json();
                        if (data.success && data.fileName) {
                            return { success: true, fileName: data.fileName, path: data.fileName };
                        }
                        return { success: false, error: data.error || 'Yükleme başarısız' };
                    } catch (err) {
                        return { success: false, error: err.message };
                    }
                };
            }

            // Web file picker & auto-upload with hierarchical folder routing
            if (prop === 'selectFile') {
                return (options = {}) => new Promise((resolve) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = options?.multiple !== false;
                    input.accept = options?.accept || '*/*';
                    input.style.display = 'none';
                    document.body.appendChild(input);

                    let currentCompanyId = options?.companyId;
                    if (!currentCompanyId) {
                        try {
                            const stored = JSON.parse(localStorage.getItem('aractakip_company') || localStorage.getItem('company') || 'null');
                            currentCompanyId = Number(typeof stored === 'object' ? stored?.id : stored) || null;
                        } catch (e) {}
                    }
                    if (!currentCompanyId) {
                        try {
                            const u = JSON.parse(localStorage.getItem('user') || 'null');
                            currentCompanyId = Number(u?.company_id || u?.companyId) || null;
                        } catch (e) {}
                    }

                    input.onchange = async () => {
                        const files = Array.from(input.files || []);
                        document.body.removeChild(input);
                        if (files.length === 0) {
                            resolve({ canceled: true, filePaths: [] });
                            return;
                        }

                        const filePaths = [];
                        let lastError = null;
                        for (const file of files) {
                            try {
                                const base64 = await new Promise((res, rej) => {
                                    const reader = new FileReader();
                                    reader.onload = () => res(reader.result);
                                    reader.onerror = rej;
                                    reader.readAsDataURL(file);
                                });

                                const token = localStorage.getItem('token') || localStorage.getItem('aractakip_token') || sessionStorage.getItem('token');
                                const uploadRes = await fetch('/api/upload', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                    },
                                    body: JSON.stringify({
                                        fileName: file.name,
                                        fileData: base64,
                                        mimeType: file.type,
                                        companyId: currentCompanyId,
                                        module: options?.module || null,
                                        entityId: options?.entityId || options?.vehicleId || options?.employeeId || null,
                                        category: options?.category || null
                                    })
                                });

                                const data = await uploadRes.json();
                                if (data.success && data.fileName) {
                                    filePaths.push(data.fileName);
                                } else if (data.error) {
                                    lastError = data.error;
                                }
                            } catch (e) {
                                console.error('[Web File Upload Error]:', e);
                                lastError = e.message;
                            }
                        }

                        if (filePaths.length > 0) {
                            resolve({ canceled: false, filePaths });
                        } else {
                            resolve({ canceled: !lastError, error: lastError, filePaths: [] });
                        }
                    };

                    input.oncancel = () => {
                        document.body.removeChild(input);
                        resolve({ canceled: true, filePaths: [] });
                    };

                    input.click();
                });
            }

            // Web saveFile polyfill (returns the filename)
            if (prop === 'saveFile') {
                return async (filePathOrName) => {
                    if (!filePathOrName) return null;
                    if (typeof filePathOrName === 'string') return filePathOrName;
                    if (typeof filePathOrName === 'object' && (filePathOrName.path || filePathOrName.name)) {
                        return filePathOrName.path || filePathOrName.name;
                    }
                    return null;
                };
            }

            // Web openFile & openDocument polyfill (opens in new tab)
            if (prop === 'openFile' || prop === 'openDocument') {
                return async (fileNameOrPath) => {
                    if (!fileNameOrPath) return { success: false, error: 'No file specified' };
                    const cleanPath = String(fileNameOrPath).replace(/^[\\/]+/, '').replace(/^uploads[\\/]/, '');
                    window.open(`/uploads/${cleanPath}`, '_blank', 'noopener,noreferrer');
                    return { success: true };
                };
            }


            // Web saveAsPdf / saveReportPdf (seamless in-page export without opening new windows or tabs)
            if (prop === 'saveReportPdf') {
                return async (route, options) => {
                    const el = document.querySelector('.report-print-container') ||
                               document.querySelector('.pdf-pages-container') || 
                               document.querySelector('.print-body');
                    if (el) {
                        try {
                            const { exportElementToCleanPdf } = await import('../utils/pdfCleanExport');
                            const fileName = options?.defaultPath || 'Rapor.pdf';
                            const isLandscape = Boolean(options?.landscape);
                            await exportElementToCleanPdf(el, fileName, isLandscape);
                            return { success: true, isWeb: true, filePath: 'İndirildi' };
                        } catch (err) {
                            console.warn('In-page PDF export notice:', err);
                        }
                    }

                    // Hidden iframe fallback: NEVER open a new tab/window in browser
                    return new Promise((resolve) => {
                        let isResolved = false;
                        const cleanup = () => {
                            if (timer) clearTimeout(timer);
                            window.removeEventListener('message', handleMessage);
                            if (iframe.parentNode) {
                                iframe.parentNode.removeChild(iframe);
                            }
                        };

                        const handleMessage = (event) => {
                            if (event.data?.type === 'pdf:complete') {
                                if (!isResolved) {
                                    isResolved = true;
                                    cleanup();
                                    resolve({ success: true, isWeb: true, filePath: event.data.fileName || 'İndirildi' });
                                }
                            } else if (event.data?.type === 'pdf:error') {
                                if (!isResolved) {
                                    isResolved = true;
                                    cleanup();
                                    resolve({ success: false, error: event.data.error || 'PDF oluşturulamadı.' });
                                }
                            }
                        };

                        window.addEventListener('message', handleMessage);

                        const iframe = document.createElement('iframe');
                        iframe.style.position = 'fixed';
                        iframe.style.top = '-99999px';
                        iframe.style.left = '-99999px';
                        iframe.style.width = '1200px';
                        iframe.style.height = '900px';
                        iframe.style.opacity = '0';
                        iframe.style.pointerEvents = 'none';

                        iframe.onerror = () => {
                            if (!isResolved) {
                                isResolved = true;
                                cleanup();
                                resolve({ success: false, error: 'Rapor yüklenemedi.' });
                            }
                        };

                        const timer = setTimeout(() => {
                            if (!isResolved) {
                                isResolved = true;
                                cleanup();
                                resolve({ success: true, isWeb: true, filePath: 'İndirildi' });
                            }
                        }, 8000);

                        try {
                            const rawRoute = route || '/print';
                            const cleanHash = rawRoute.startsWith('#') ? rawRoute : `#${rawRoute.startsWith('/') ? '' : '/'}${rawRoute}`;
                            const separator = cleanHash.includes('?') ? '&' : '?';
                            iframe.src = `${cleanHash}${separator}autoDownload=1`;
                            document.body.appendChild(iframe);
                        } catch (e) {
                            cleanup();
                            resolve({ success: false, error: e.message });
                        }
                    });
                };
            }

            if (prop === 'saveAsPdf') {
                return async () => {
                    window.print();
                    return { success: true };
                };
            }

            // Web file download polyfill
            if (prop === 'downloadFile') {
                return async (params) => {
                    const rawName = typeof params === 'string' ? params : (params?.fileName || params?.path);
                    if (!rawName) return { success: false, error: 'No file specified' };
                    const cleanPath = String(rawName).replace(/^[\\/]+/, '').replace(/^uploads[\\/]/, '');
                    const a = document.createElement('a');
                    a.href = `/uploads/${cleanPath}`;
                    a.download = cleanPath.split(/[\\/]/).pop();
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    return { success: true };
                };
            }

            // Web exportCompanyData polyfill (triggers JSON backup file download)
            if (prop === 'exportCompanyData') {
                return async (payload) => {
                    try {
                        const token = localStorage.getItem('token') || localStorage.getItem('aractakip_token') || sessionStorage.getItem('token');
                        const res = await fetch('/api/rpc/exportCompanyData', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                            },
                            body: JSON.stringify({ args: [payload] })
                        });
                        const data = await res.json();
                        if (data && data.success && data.backupData) {
                            const jsonStr = JSON.stringify(data.backupData, null, 2);
                            const blob = new Blob([jsonStr], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            const compName = (data.companyName || 'kontrol').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                            const fileName = `kontrol-yedek-${compName}-${new Date().toISOString().split('T')[0]}.json`;
                            a.href = url;
                            a.download = fileName;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            return { success: true, filePath: fileName };
                        }
                        return data || { success: false, error: 'Dışa aktarma başarısız oldu' };
                    } catch (err) {
                        return { success: false, error: err.message };
                    }
                };
            }

            // Web importCompanyData polyfill (file picker + restore JSON backup)
            if (prop === 'importCompanyData') {
                return (userId) => new Promise((resolve) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.style.display = 'none';
                    document.body.appendChild(input);

                    input.onchange = async () => {
                        const file = input.files?.[0];
                        document.body.removeChild(input);
                        if (!file) {
                            resolve({ success: false, error: 'Dosya seçilmedi' });
                            return;
                        }

                        try {
                            const text = await file.text();
                            const backupData = JSON.parse(text);
                            const token = localStorage.getItem('token') || localStorage.getItem('aractakip_token') || sessionStorage.getItem('token');
                            const res = await fetch('/api/rpc/importCompanyData', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                },
                                body: JSON.stringify({ args: [userId, backupData] })
                            });
                            const result = await res.json();
                            resolve(result);
                        } catch (err) {
                            resolve({ success: false, error: 'Yedek dosyası okunamadı: ' + err.message });
                        }
                    };

                    input.oncancel = () => {
                        document.body.removeChild(input);
                        resolve({ success: false, error: 'İşlem iptal edildi' });
                    };

                    input.click();
                });
            }

            if (prop === 'showNotification') {
                return async (title, body) => {
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(title, { body });
                    }
                    return { success: true };
                };
            }

            // Standard RPC method call
            return async (...args) => {
                const propStr = String(prop);
                const isPassive = PASSIVE_RPC_METHODS.has(propStr) || args.some(a => a && typeof a === 'object' && (a.__passive === true || a.isBackground === true || a.silent === true));
                if (!isPassive) loadingManager.start();
                const token = localStorage.getItem('token') || localStorage.getItem('aractakip_token') || sessionStorage.getItem('token');
                try {
                    const res = await fetch(`/api/rpc/${propStr}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify({ args })
                    });

                    if (!res.ok) {
                        const errBody = await res.json().catch(() => ({}));
                        if (res.status === 401) window.dispatchEvent(new Event('kontrol:session-expired'));
                        return { success: false, error: errBody.error || `HTTP ${res.status}: ${res.statusText}` };
                    }

                    const data = await res.json();
                    return data;
                } catch (err) {
                    console.error(`[API Bridge Error] Method "${propStr}" failed:`, err);
                    return { success: false, error: err.message };
                } finally {
                    if (!isPassive) loadingManager.stop();
                }
            };
        }
    });
}
