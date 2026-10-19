let serverInstance;
function startAdminServer() {
    if (serverInstance) return;
    const { app } = require('../server');
    serverInstance = app.listen(9999, '127.0.0.1');
    serverInstance.on('error', error => console.error('Local API failed:', error.message));
}
function stopAdminServer() { if (serverInstance) { serverInstance.close(); serverInstance = null; } }
module.exports = { startAdminServer, stopAdminServer };
