const http = require('http');

const url = 'http://127.0.0.1:5173';
const timeout = 60000;
const start = Date.now();

console.log('⏳ Vite sunucusunun hazır olması bekleniyor...');

function check() {
    const req = http.get(url, (res) => {
        // Any 2xx or 3xx or even 404 means the HTTP server is alive and responding to requests
        if (res.statusCode >= 200 && res.statusCode < 500) {
            console.log('✅ Vite sunucusu hazır! Electron başlatılıyor...');
            process.exit(0);
        } else {
            retry();
        }
    });

    req.on('error', () => {
        retry();
    });

    req.setTimeout(2000, () => {
        req.destroy();
        retry();
    });
}

function retry() {
    if (Date.now() - start > timeout) {
        console.error('❌ Vite sunucusu zaman aşımına uğradı (60s).');
        process.exit(1);
    }
    setTimeout(check, 350);
}

check();
