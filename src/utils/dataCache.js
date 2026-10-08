/**
 * In-memory Stale-While-Revalidate (SWR) cache for instantaneous page navigation
 * Retains fetched data in memory so pages mount with 0ms delay while silently validating fresh data.
 */

const cacheStore = new Map()
const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

export const dataCache = {
    get(key) {
        if (!key) return null
        const entry = cacheStore.get(key)
        if (!entry) return null
        // Expired check
        if (Date.now() > entry.expiresAt) {
            cacheStore.delete(key)
            return null
        }
        return entry.data
    },

    set(key, data, ttlMs = DEFAULT_TTL_MS) {
        if (!key || data === undefined) return
        cacheStore.set(key, {
            data,
            expiresAt: Date.now() + ttlMs,
            cachedAt: Date.now()
        })
    },

    has(key) {
        return this.get(key) !== null
    },

    invalidate(pattern) {
        if (!pattern) {
            cacheStore.clear()
            return
        }
        for (const key of cacheStore.keys()) {
            if (key.includes(pattern)) {
                cacheStore.delete(key)
            }
        }
    },

    clear() {
        cacheStore.clear()
    }
}

// Auto-invalidate cache keys on database changes
if (typeof window !== 'undefined' && window.electronAPI?.onDbUpdate) {
    try {
        window.electronAPI.onDbUpdate((change) => {
            if (!change?.table) return
            const table = change.table.toLowerCase()
            dataCache.invalidate(table)
            // If related fleet tables change, also invalidate dashboard cache
            if (['vehicles', 'maintenances', 'inspections', 'insurances', 'services', 'assignments', 'employees', 'works', 'transactions'].includes(table)) {
                dataCache.invalidate('dashboard')
            }
        })
    } catch (e) {
        console.warn('[dataCache] Could not attach onDbUpdate listener', e)
    }
}
