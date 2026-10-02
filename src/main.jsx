import './services/apiBridge'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter as Router } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30, // 30 minutes
            refetchOnWindowFocus: false, // Electron app usually doesn't need this aggressive check
        },
    },
})

// Auto-recover from stale Vite deployment chunks (404 dynamic import errors after a new release)
if (typeof window !== 'undefined') {
    window.addEventListener('vite:preloadError', (event) => {
        console.warn('[Vite Preload] New version deployed or chunk failed to load. Auto-refreshing...', event);
        window.location.reload();
    });

    window.addEventListener('error', (event) => {
        const msg = event?.message || '';
        if (msg.includes('error loading dynamically imported module') || msg.includes('Failed to fetch dynamically imported module')) {
            console.warn('[Dynamic Import] Stale module detected, reloading page to fetch latest version...', msg);
            const lastReload = sessionStorage.getItem('last_chunk_reload');
            const now = Date.now();
            if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
                sessionStorage.setItem('last_chunk_reload', String(now));
                window.location.reload();
            }
        }
    });
}

// Auto-redirect direct path-based URLs to HashRouter format (e.g. /reset-password?email=... -> /#/reset-password?email=...)
// CRITICAL: Must ONLY run on HTTP/HTTPS web browsers. Never run in Electron desktop mode (file:// protocol) where origin is "null" and loads index.html directly
if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.protocol &&
    window.location.protocol.startsWith('http')
) {
    const origin = window.location.origin;
    const pathname = window.location.pathname || '';
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    if (
        origin &&
        origin !== 'null' &&
        pathname &&
        pathname !== '/' &&
        !pathname.endsWith('index.html') &&
        (!hash || hash === '' || hash === '#/')
    ) {
        const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
        window.location.replace(`${origin}/#${cleanPath}${search}`);
    }
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ThemeProvider>
                    <ToastProvider>
                        <AuthProvider>
                            <App />
                        </AuthProvider>
                    </ToastProvider>
                </ThemeProvider>
            </Router>
        </QueryClientProvider>
    </React.StrictMode>,
)
