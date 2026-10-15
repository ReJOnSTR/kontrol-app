/**
 * loadingManager.js
 * Centralized, reactive network & async operation tracker.
 * Automatically coordinates with API Bridge, Electron IPC, and TanStack Query
 * to power global top progress bar without requiring manual props in every page.
 */

let activeCount = 0;
const listeners = new Set();
let debounceTimer = null;

export const loadingManager = {
    start() {
        activeCount++;
        this._notifyDebounced();
    },

    stop() {
        activeCount = Math.max(0, activeCount - 1);
        this._notifyDebounced();
    },

    reset() {
        activeCount = 0;
        this._notifyDebounced();
    },

    isLoading() {
        return activeCount > 0;
    },

    getActiveCount() {
        return activeCount;
    },

    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    _notifyDebounced() {
        if (debounceTimer) cancelAnimationFrame(debounceTimer);
        debounceTimer = requestAnimationFrame(() => {
            const loading = activeCount > 0;
            listeners.forEach((fn) => {
                try {
                    fn(loading, activeCount);
                } catch (e) {
                    console.error('[loadingManager listener error]', e);
                }
            });
        });
    }
};

// Listen to both DOM CustomEvents and window.postMessage for Electron Preload IPC
if (typeof window !== 'undefined') {
    window.__loadingManager = loadingManager;
    window.addEventListener('app:loading:start', () => loadingManager.start());
    window.addEventListener('app:loading:stop', () => loadingManager.stop());
    window.addEventListener('message', (event) => {
        if (event.data === 'app:loading:start' || event.data?.type === 'app:loading:start') {
            loadingManager.start();
        } else if (event.data === 'app:loading:stop' || event.data?.type === 'app:loading:stop') {
            loadingManager.stop();
        }
    });
}
