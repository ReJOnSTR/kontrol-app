/**
 * Reads a File object as Base64 data URL
 * @param {File} file 
 * @returns {Promise<string>}
 */
export function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Resolves a dropped or picked File into a usable file descriptor { path, name, isUploaded }
 * Works seamlessly in both Electron desktop and Web browser.
 * 
 * 1. Checks if Electron provides a native absolute file path via getPathForFile.
 * 2. If no valid native path is available, reads the file data as base64 and uploads it
 *    via window.electronAPI.uploadFileBase64 (or /api/upload in web).
 * 
 * @param {File} file 
 * @param {Object} options - { companyId, category, module, entityId }
 * @returns {Promise<{ path: string, name: string, isUploaded?: boolean }>}
 */
export async function resolveDroppedFile(file, options = {}) {
    if (!file) return null;

    const fileName = file.name || 'dosya';

    // 1. Try native Electron path extraction
    try {
        let nativePath = null;
        if (window.electronAPI?.getPathForFile && typeof window.electronAPI.getPathForFile === 'function') {
            nativePath = window.electronAPI.getPathForFile(file);
        } else if (file.path) {
            nativePath = file.path;
        }

        // Verify that nativePath is an actual absolute filesystem path (contains path separators and isn't just the bare filename)
        if (nativePath && typeof nativePath === 'string' && (nativePath.includes('/') || nativePath.includes('\\')) && nativePath !== fileName) {
            return {
                path: nativePath,
                name: fileName,
                isLocal: true
            };
        }
    } catch (e) {
        console.warn('Native getPathForFile failed, falling back to base64 upload:', e);
    }

    // 2. Fallback: Read file bytes as Base64 and upload to local storage or web storage
    try {
        const base64Data = await readFileAsBase64(file);

        if (window.electronAPI?.uploadFileBase64) {
            const res = await window.electronAPI.uploadFileBase64({
                fileName,
                fileData: base64Data,
                companyId: options.companyId
            });

            if (res && res.success && (res.path || res.fileName)) {
                return {
                    path: res.path || res.fileName,
                    name: fileName,
                    isUploaded: true
                };
            }
        }

        // Direct web API fallback
        const token = localStorage.getItem('token') || localStorage.getItem('aractakip_token') || sessionStorage.getItem('token');
        const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                fileName,
                fileData: base64Data,
                companyId: options.companyId || null,
                module: options.module || 'documents',
                entityId: options.entityId || null,
                category: options.category || null
            })
        });

        const uploadData = await uploadRes.json();
        if (uploadData && uploadData.success && uploadData.fileName) {
            return {
                path: uploadData.fileName,
                name: fileName,
                isUploaded: true
            };
        }
        throw new Error(uploadData?.error || 'Dosya yüklenemedi.');
    } catch (err) {
        console.error('resolveDroppedFile upload failed:', err);
        throw err;
    }
}
