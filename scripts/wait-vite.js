const http = require('http');

const url = 'http://127.0.0.1:5173/';
const timeout = 60000;
const start = Date.now();

console.log('⏳ Vite sunucusunun hazır olması bekleniyor...');

let isDone = false;
let retryTimer = null;

function cleanup() {
    isDone = true;
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
}

function scheduleRetry(delay = 400) {
    if (isDone) return;
    if (!retryTimer) {
        retryTimer = setTimeout(() => {
            retryTimer = null;
            check();
        }, delay);
    }
}

function check() {
    if (isDone) return;
    if (Date.now() - start > timeout) {
        cleanup();
        console.error('❌ Vite sunucusu zaman aşımına uğradı (60s).');
        process.exit(1);
    }

    // HEAD request is instant and doesn't trigger costly HTML compilation before Vite is ready
    const req = http.request(url, { method: 'HEAD' }, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 500) {
            cleanup();
            console.log('✅ Vite sunucusu hazır! Electron başlatılıyor...');
            process.exit(0);
        } else {
            scheduleRetry();
        }
    });

    req.on('error', () => {
        scheduleRetry();
    });

    // Generous 10s timeout so cold starts / esbuild don't get aborted prematurely
    req.setTimeout(10000, () => {
        req.destroy();
        scheduleRetry();
    });

    req.end();
}

check();
