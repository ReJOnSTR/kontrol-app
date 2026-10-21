const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { fileURLToPath } = require('node:url');
const channels = require('./ipcChannels.json');
const { call } = require('./transport');
const { authenticate } = require('./sessions');
const { safePath, authorizeFile, segment } = require('./files');
const { forbidden } = require('./context');

function trusted(event) {
    if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return false;
    try {
        const url = new URL(event.senderFrame.url);
        if (url.protocol === 'file:') return path.resolve(fileURLToPath(url)) === path.resolve(__dirname, '../../dist/index.html');
        return !require('electron').app.isPackaged && url.origin === 'http://127.0.0.1:5173';
    } catch { return false; }
}
function install(ipcMain, getPrisma) {
    const selected = new Map();
    const register = ipcMain.handle.bind(ipcMain);
    channels['auth:logout'] = 'logout';
    const root = () => path.join(require('electron').app.getPath('userData'), 'files');
    async function saveSelected(event, source, actor) {
        const selections = selected.get(event.sender.id);
        const selection = selections?.get(source);
        if (!selection || selection.expires < Date.now()) forbidden('Önce dosya seçiciden dosyayı seçin.');
        const ext = path.extname(source).toLowerCase();
        if (!['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.csv'].includes(ext)) forbidden('Desteklenmeyen dosya türü.');
        if (fs.statSync(source).size > 20 * 1024 * 1024) forbidden('Dosya 20 MB sınırını aşıyor.');
        const mod = segment(selection.module || 'documents');
        const companyId = Number(selection.companyId) || actor.companyId || actor.companyIds?.[0] || 1;
        const name = `company_${companyId}/${mod}/${crypto.randomUUID()}${ext}`;
        await authorizeFile(actor, name, getPrisma(), true);
        const target = safePath(root(), name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
        selections.delete(source);
        return name;
    }
    ipcMain.handle = (channel, handler) => register(channel, async (event, envelope, ...args) => {
        try {
            if (!trusted(event)) forbidden('Güvenilmeyen pencere.');
            const method = channels[channel];
            if (!method) forbidden('Bu IPC işlemi dış erişime kapalı.');
            const token = envelope?.__authToken;
            const fn = async (...checked) => {
                if (['readDocumentData', 'getSettings', 'saveSettings'].includes(method)) return require('../../server').rpcMap[method](...checked);
                if (['openFile', 'openDocument', 'downloadFile', 'saveFile', 'addDocument'].includes(method)) {
                    const actor = require('./context').context().actor;
                    if (method === 'saveFile') return saveSelected(event, checked[0], actor);
                    if (method === 'addDocument') {
                        const data = checked[0];
                        let name = data.filePath?.path || data.filePath;
                        if (path.isAbsolute(name || '')) name = await saveSelected(event, name, actor);
                        else { safePath(root(), name); await authorizeFile(actor, name, getPrisma()); }
                        return require('../prismaService').addDocument({ ...data, filePath: name });
                    }
                    const name = typeof checked[0] === 'string' ? checked[0] : checked[0]?.fileName || checked[0]?.path;
                    const target = safePath(root(), name);
                    await authorizeFile(actor, name, getPrisma());
                    if (method === 'downloadFile') {
                        const chosen = await require('electron').dialog.showSaveDialog({ defaultPath: path.basename(name) });
                        if (chosen.canceled) return { success: false, canceled: true };
                        fs.copyFileSync(target, chosen.filePath);
                        return { success: true, filePath: chosen.filePath };
                    }
                    const error = await require('electron').shell.openPath(target);
                    return error ? { success: false, error } : { success: true };
                }
                const result = await handler(event, ...checked);
                if (method === 'selectFile' && result?.filePaths) {
                    let choices = selected.get(event.sender.id);
                    if (!choices) { choices = new Map(); selected.set(event.sender.id, choices); event.sender.once('destroyed', () => selected.delete(event.sender.id)); }
                    for (const name of result.filePaths) choices.set(name, { ...(checked[0] || {}), companyId: checked[0]?.companyId || actor?.companyId || actor?.companyIds?.[0], expires: Date.now() + 15 * 60 * 1000 });
                }
                return result;
            };
            return await call(method, args, token, fn, getPrisma());
        } catch (error) { return { success: false, status: error.status || 500, error: error.status ? error.message : 'İşlem gerçekleştirilemedi.' }; }
    });
    const on = ipcMain.on.bind(ipcMain);
    ipcMain.on = (channel, handler) => on(channel, (event, ...args) => { if (trusted(event)) handler(event, ...args); });
    ipcMain.handle('auth:logout', async () => ({ success: true }));
}
module.exports = { install, trusted };
