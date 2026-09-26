const fs = require('fs');
const path = require('path');
const { uploadToStorage, findFileInStorage, storagePathCache } = require('./supabase.service');

function getMimeType(fileName) {
    const ext = path.extname(fileName || '').toLowerCase();
    switch (ext) {
        case '.pdf': return 'application/pdf';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        case '.svg': return 'image/svg+xml';
        case '.txt': return 'text/plain';
        case '.csv': return 'text/csv';
        case '.json': return 'application/json';
        default: return 'application/octet-stream';
    }
}

/**
 * Asynchronously syncs a local file to Supabase Cloud Storage
 */
async function syncFileToCloud(filePath, customFileName = null) {
    try {
        if (!fs.existsSync(filePath)) return { success: false, error: 'File does not exist' };
        const fileName = customFileName || path.basename(filePath);
        const mimeType = getMimeType(fileName);
        const buffer = await fs.promises.readFile(filePath);

        const res = await uploadToStorage(buffer, fileName, mimeType, 'documents');
        if (res.success) {
            console.log(`[Document Cloud Sync]: Successfully synced ${fileName} to Supabase`);
        }
        return res;
    } catch (err) {
        console.warn(`[Document Cloud Sync Warning]: Failed to sync ${filePath}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Background routine that checks local files against cloud storage and uploads missing ones
 */
async function startStartupBackfill(userDataPath) {
    setTimeout(async () => {
        try {
            const filesDir = path.join(userDataPath, 'files');
            if (!fs.existsSync(filesDir)) return;

            const localFiles = fs.readdirSync(filesDir).filter(f => !f.startsWith('.') && fs.statSync(path.join(filesDir, f)).isFile());
            if (localFiles.length === 0) return;

            const { supabaseAdmin } = require('./supabase.service');
            const remoteFiles = new Set();
            try {
                let page = 0;
                while (true) {
                    const { data } = await supabaseAdmin.storage.from('documents').list('', { limit: 100, offset: page * 100 });
                    if (!data || data.length === 0) break;
                    data.forEach(item => {
                        remoteFiles.add(item.name);
                        storagePathCache.set(`documents:${item.name}`, item.name);
                    });
                    if (data.length < 100) break;
                    page++;
                }
            } catch (listErr) {
                console.warn('[Startup Cloud Backfill] Failed to list remote files:', listErr.message);
            }

            const missingFiles = localFiles.filter(f => !remoteFiles.has(f));
            if (missingFiles.length === 0) {
                console.log(`[Startup Cloud Backfill]: All ${localFiles.length} local files are verified in cloud storage.`);
                return;
            }

            console.log(`[Startup Cloud Backfill]: Found ${missingFiles.length} local files missing from cloud. Uploading...`);
            let syncedCount = 0;
            for (const file of missingFiles) {
                const fullPath = path.join(filesDir, file);
                try {
                    const stats = fs.statSync(fullPath);
                    if (stats.size === 0) continue;

                    const res = await syncFileToCloud(fullPath, file);
                    if (res && res.success) {
                        syncedCount++;
                        remoteFiles.add(file);
                    }
                } catch (fileErr) {
                    console.warn(`[Startup Cloud Backfill] Skip ${file}:`, fileErr.message);
                }
            }

            console.log(`[Startup Cloud Backfill]: Finished backfill. Successfully uploaded ${syncedCount} files.`);
        } catch (err) {
            console.warn('[Startup Cloud Backfill Warning]:', err.message);
        }
    }, 6000);
}

module.exports = {
    getMimeType,
    syncFileToCloud,
    startStartupBackfill
};
