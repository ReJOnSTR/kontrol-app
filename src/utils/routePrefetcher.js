/**
 * High-performance route prefetcher for instant navigation
 * Pre-downloads and pre-compiles Vite chunks on hover or idle time
 */

const prefetchMap = {
    '/': () => import('../pages/Dashboard'),
    '/portal': () => import('../pages/MainPortal'),
    '/vehicles': () => import('../pages/Vehicles'),
    '/maintenance': () => import('../pages/Maintenance'),
    '/inspections': () => import('../pages/Inspections'),
    '/periodic-inspections': () => import('../pages/PeriodicInspections'),
    '/insurance': () => import('../pages/Insurance'),
    '/assignments': () => import('../pages/Assignments'),
    '/services': () => import('../pages/Services'),
    '/arvento-tracking': () => import('../pages/ArventoTracking'),
    '/employees': () => import('../pages/Employees'),
    '/leaves': () => import('../pages/Leaves'),
    '/overtimes': () => import('../pages/Overtimes'),
    '/payroll': () => import('../pages/PayrollDashboard'),
    '/salary': () => import('../pages/Salaries'),
    '/personel-dashboard': () => import('../pages/PersonelDashboard'),
    '/employee-reports': () => import('../pages/EmployeeReports'),
    '/finance': () => import('../pages/Finance'),
    '/finance-dashboard': () => import('../pages/FinanceDashboard'),
    '/checks': () => import('../pages/Checks'),
    '/meal-tickets': () => import('../pages/MealTickets'),
    '/meal-settings': () => import('../pages/MealTicketSettings'),
    '/meal-report': () => import('../pages/MealTicketReport'),
    '/works': () => import('../pages/Works'),
    '/customers': () => import('../pages/Customers'),
    '/companies': () => import('../pages/Companies'),
    '/settings': () => import('../pages/Settings'),
    '/reports': () => import('../pages/Reports'),
}

const prefetched = new Set()

export function prefetchRoute(path) {
    if (!path) return
    const cleanPath = path.split('?')[0]
    if (prefetched.has(cleanPath)) return
    const loader = prefetchMap[cleanPath]
    if (loader) {
        prefetched.add(cleanPath)
        loader().catch(() => {
            prefetched.delete(cleanPath) // allow retry if failed
        })
    }
}

/**
 * Automatically prefetch most common routes when CPU/network is idle after app start
 */
export function initIdlePrefetch() {
    const doPrefetch = () => {
        const priorityRoutes = [
            '/',
            '/vehicles',
            '/employees',
            '/works',
            '/maintenance',
            '/finance-dashboard',
            '/personel-dashboard'
        ]
        priorityRoutes.forEach((route, idx) => {
            setTimeout(() => {
                prefetchRoute(route)
            }, (idx + 1) * 700)
        })
    }

    if (typeof window !== 'undefined') {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(doPrefetch, { timeout: 3500 })
        } else {
            setTimeout(doPrefetch, 2500)
        }
    }
}
