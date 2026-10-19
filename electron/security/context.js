const { AsyncLocalStorage } = require('node:async_hooks');
const storage = new AsyncLocalStorage();
function forbidden(message = 'Bu işlem için yetkiniz yok.') {
    const error = new Error(message);
    error.status = 403;
    throw error;
}
module.exports = { context: () => storage.getStore(), run: (value, fn) => storage.run(value, fn), forbidden };
