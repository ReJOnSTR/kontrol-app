/**
 * apiBridge.js
 * Automatically bridges window.electronAPI calls over HTTP RPC when running in a web browser.
 * In Electron desktop mode, this is a no-op as window.electronAPI is already provided by preload.js.
 */

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
                return async () => '1.13.8-web';
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
                            const comp = JSON.parse(localStorage.getItem('aractakip_company') || '{}');
                            currentCompanyId = comp?.id || null;
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
                                }
                            } catch (e) {
                                console.error('[Web File Upload Error]:', e);
                            }
                        }

                        if (filePaths.length > 0) {
                            resolve({ canceled: false, filePaths });
                        } else {
                            resolve({ canceled: true, filePaths: [] });
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
                    const cleanName = String(fileNameOrPath).split(/[\\/]/).pop();
                    window.open(`/uploads/${cleanName}`, '_blank', 'noopener,noreferrer');
                    return { success: true };
                };
            }

            // Web readDocumentData fast stream bridge (instant 0ms response, zero Base64 overhead)
            if (prop === 'readDocumentData') {
                return async (fileNameOrPath) => {
                    if (!fileNameOrPath) return { success: false, error: 'No file specified' };
                    const relativePath = String(fileNameOrPath).replace(/^\/+/, '');
                    const cleanName = relativePath.split(/[\\/]/).pop();
                    const ext = (cleanName.substring(cleanName.lastIndexOf('.')).toLowerCase()) || '';
                    const url = `/uploads/${encodeURIComponent(cleanName)}`;
                    return {
                        success: true,
                        fileName: cleanName,
                        path: relativePath,
                        url: url,
                        data: url,
                        ext: ext
                    };
                };
            }

            // Web saveAsPdf / saveReportPdf (opens report preview & print in new tab)
            if (prop === 'saveReportPdf') {
                return async (route, options) => {
                    const url = route || '/print';
                    window.open(url, '_blank', 'noopener,noreferrer');
                    return { success: true, isWeb: true, filePath: 'Rapor ekranı açıldı' };
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
                    const fileName = typeof params === 'string' ? params : (params?.fileName || params?.path);
                    if (!fileName) return { success: false, error: 'No file specified' };
                    const cleanName = String(fileName).split(/[\\/]/).pop();
                    const a = document.createElement('a');
                    a.href = `/uploads/${cleanName}`;
                    a.download = cleanName;
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
                const token = localStorage.getItem('token') || localStorage.getItem('aractakip_token') || sessionStorage.getItem('token');
                try {
                    const res = await fetch(`/api/rpc/${String(prop)}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify({ args })
                    });

                    if (!res.ok) {
                        const errBody = await res.json().catch(() => ({}));
                        return { success: false, error: errBody.error || `HTTP ${res.status}: ${res.statusText}` };
                    }

                    const data = await res.json();
                    return data;
                } catch (err) {
                    console.error(`[API Bridge Error] Method "${String(prop)}" failed:`, err);
                    return { success: false, error: err.message };
                }
            };
        }
    });
}
