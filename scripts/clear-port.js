const { execSync } = require('child_process');

try {
    if (process.platform === 'win32') {
        execSync('FOR /F "tokens=5" %P IN (\'netstat -a -n -o ^| findstr :5173\') DO taskkill /F /PID %P 2>NUL', { stdio: 'ignore' });
        execSync('taskkill /F /IM electron.exe 2>NUL', { stdio: 'ignore' });
    } else {
        execSync('lsof -t -i:5173 | xargs kill -9 2>/dev/null', { stdio: 'ignore' });
        execSync('pkill -f "Electron \\." 2>/dev/null', { stdio: 'ignore' });
    }
} catch (e) {
    // Port 5173 or processes were already clean - continue silently
}
