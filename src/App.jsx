import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { CompanyProvider, useCompany } from './context/CompanyContext'
import { TabProvider } from './context/TabContext' // Import TabProvider

import { useNotification } from './hooks/useNotification'
import ErrorBoundary from './components/ErrorBoundary'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import TabBar from './components/TabBar' // Import TabBar
import PersonnelHeader from './components/PersonnelHeader'
import TopProgressBar from './components/TopProgressBar'
import CommandPalette from './components/CommandPalette'
import LockScreen from './components/LockScreen'
import { useIdle } from './hooks/useIdle'

// Resilient lazy import helper that automatically reloads the page once if a stale chunk 404s after a new deployment
const lazyWithRetry = (componentImport) =>
    lazy(async () => {
        const pageAlreadyRefreshed = JSON.parse(
            window.sessionStorage.getItem('retry-lazy-refreshed') || 'false'
        );
        try {
            const component = await componentImport();
            window.sessionStorage.setItem('retry-lazy-refreshed', 'false');
            return component;
        } catch (error) {
            const msg = error?.message || '';
            if (!pageAlreadyRefreshed && (msg.includes('dynamically imported module') || msg.includes('Failed to fetch') || error.name === 'ChunkLoadError')) {
                window.sessionStorage.setItem('retry-lazy-refreshed', 'true');
                window.location.reload();
                return new Promise(() => {});
            }
            throw error;
        }
    });

// Lazy-loaded pages with chunk error auto-retry
const Login = lazyWithRetry(() => import('./pages/Login'))
const Register = lazyWithRetry(() => import('./pages/Register'))
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'))
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const MainPortal = lazyWithRetry(() => import('./pages/MainPortal'))
const FinanceDashboard = lazyWithRetry(() => import('./pages/FinanceDashboard'))
const Finance = lazyWithRetry(() => import('./pages/Finance'))
const Checks = lazyWithRetry(() => import('./pages/Checks'))
const Companies = lazyWithRetry(() => import('./pages/Companies'))
const Vehicles = lazyWithRetry(() => import('./pages/Vehicles'))
const VehicleDetail = lazyWithRetry(() => import('./pages/VehicleDetail'))
const ArventoTracking = lazyWithRetry(() => import('./pages/ArventoTracking'))
const Maintenance = lazyWithRetry(() => import('./pages/Maintenance'))
const Inspections = lazyWithRetry(() => import('./pages/Inspections'))
const PeriodicInspections = lazyWithRetry(() => import('./pages/PeriodicInspections'))
const Insurance = lazyWithRetry(() => import('./pages/Insurance'))
const Assignments = lazyWithRetry(() => import('./pages/Assignments'))
const Settings = lazyWithRetry(() => import('./pages/Settings'))
const Reports = lazyWithRetry(() => import('./pages/Reports'))
const EmployeeReports = lazyWithRetry(() => import('./pages/EmployeeReports'))
const PrintPage = lazyWithRetry(() => import('./pages/PrintPage'))
const Services = lazyWithRetry(() => import('./pages/Services'))
const ChangePassword = lazyWithRetry(() => import('./pages/ChangePassword'))
const MealTickets = lazyWithRetry(() => import('./pages/MealTickets'))
const MealTicketReport = lazyWithRetry(() => import('./pages/MealTicketReport'))
const MealTicketSettings = lazyWithRetry(() => import('./pages/MealTicketSettings'))
const Employees = lazyWithRetry(() => import('./pages/Employees'))
const EmployeeDetail = lazyWithRetry(() => import('./pages/EmployeeDetail'))
const PersonelDashboard = lazyWithRetry(() => import('./pages/PersonelDashboard'))
const PayrollDashboard = lazyWithRetry(() => import('./pages/PayrollDashboard'))
const Leaves = lazyWithRetry(() => import('./pages/Leaves'))
const Overtimes = lazyWithRetry(() => import('./pages/Overtimes'))
const Works = lazyWithRetry(() => import('./pages/Works'))
const WorkDetails = lazyWithRetry(() => import('./pages/WorkDetails'))
const WorkPdfReport = lazyWithRetry(() => import('./pages/WorkPdfReport'))
const Customers = lazyWithRetry(() => import('./pages/Customers'))
const CustomerDetail = lazyWithRetry(() => import('./pages/CustomerDetail'))
const ModuleSettings = lazyWithRetry(() => import('./pages/ModuleSettings'))
const Profile = lazyWithRetry(() => import('./pages/Profile'))
const PrintDocument = lazyWithRetry(() => import('./pages/PrintDocument'))
const PersonnelDashboardPortal = lazyWithRetry(() => import('./components/personnel/PersonnelDashboard'))
const ApprovalCenter = lazyWithRetry(() => import('./components/personnel/ApprovalCenter'))
const PlatformAdmin = lazyWithRetry(() => import('./pages/PlatformAdmin'))

// Suspense fallback — invisible placeholder (TopProgressBar handles the visual)
function PageLoader() {
    return null
}

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()

    return (
        <>
            <TopProgressBar loading={loading} />
            {!loading && !user && <Navigate to="/login" replace />}
            {!loading && user?.mustChangePassword && <Navigate to="/change-password" replace />}
            {!loading && user && !user.mustChangePassword && children}
        </>
    )
}

function AdminRoute({ children }) {
    const { isPersonnel, loading } = useAuth()

    if (loading) return null
    if (isPersonnel) return <Navigate to="/personnel-profile" replace />
    return children
}

function SuperAdminRoute({ children }) {
    const { user, loading } = useAuth()
    const isSuperAdmin = user?.role === 'superadmin'

    if (loading) return null
    if (!isSuperAdmin) return <Navigate to="/dashboard" replace />
    return children
}

function PermissionRoute({ module, action = 'can_read', children }) {
    const { hasPermission, isAdmin, isPersonnel, loading } = useAuth()
    const { isModuleEnabled, isImpersonating } = useCompany()
    const { user } = useAuth()
    const isSuperAdmin = user?.role === 'superadmin'

    if (loading) return null

    // Check Company Module Entitlements (Feature Flags)
    const moduleMap = {
        'vehicles': 'fleet',
        'fleet': 'fleet',
        'finance': 'finance',
        'meals': 'meals',
        'employees': 'hr',
        'hr': 'hr',
        'works': 'works',
        'customers': 'customers'
    }
    const mappedModule = moduleMap[module]
    if (mappedModule && !(isSuperAdmin && !isImpersonating)) {
        if (isModuleEnabled && !isModuleEnabled(mappedModule)) {
            return <Navigate to="/portal" replace />
        }
    }

    if (isAdmin || !isPersonnel) return children

    if (!hasPermission(module, action)) {
        return <Navigate to="/personnel-profile" replace />
    }
    return children
}

import BroadcastBanner from './components/BroadcastBanner'
import ImpersonationBanner from './components/ImpersonationBanner'

function MainLayout() {
    const { user } = useAuth()
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        return localStorage.getItem('sidebarCollapsed') === 'true'
    })

    const toggleSidebar = () => {
        setSidebarCollapsed(prev => {
            const newState = !prev
            localStorage.setItem('sidebarCollapsed', newState)
            return newState
        })
    }

    return (
        <>
            <CommandPalette />
            <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
                <div className="main-content">
                    <ImpersonationBanner />
                    <TabBar />
                    <BroadcastBanner />
                    <div className="page-content">
                        <ErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <Outlet />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </div>
            </div>
        </>
    )
}

function MainLayoutWrapper() {
    return (
        <TabProvider>
            <MainLayout />
        </TabProvider>
    )
}

import { useDataListener } from './hooks/useDataListener'

function AppRoutes() {
    useDataListener() // Global real-time data listener
    const { user } = useAuth()
    const location = useLocation()
    const isPrintRoute = location.pathname === '/print' || location.pathname === '/print-document' || location.pathname.startsWith('/work-report')

    const urlParams = new URLSearchParams(window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''))
    const impIdFromUrl = urlParams.get('impersonate_company_id')
    const isSuperAdmin = user?.role === 'superadmin'

    // Only allow SuperAdmin to impersonate companies
    if (impIdFromUrl && isSuperAdmin && !sessionStorage.getItem('aractakip_impersonate_company_id')) {
        sessionStorage.setItem('aractakip_impersonate_company_id', impIdFromUrl)
        const impNameFromUrl = urlParams.get('impersonate_company_name')
        if (impNameFromUrl) sessionStorage.setItem('aractakip_impersonate_company_name', decodeURIComponent(impNameFromUrl))
    } else if (!isSuperAdmin) {
        sessionStorage.removeItem('aractakip_impersonate_company_id')
        sessionStorage.removeItem('aractakip_impersonate_company_name')
    }
    const isImpersonating = isSuperAdmin && !!(impIdFromUrl || sessionStorage.getItem('aractakip_impersonate_company_id'))
    const isStandaloneSuperAdmin = isSuperAdmin && !isImpersonating

    return (
        <>
            {!isPrintRoute && <TitleBar />}
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
                    <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/change-password" element={<ChangePassword />} />

                    <Route element={
                        <ProtectedRoute>
                            <CompanyProvider>
                                <MainLayoutWrapper />
                            </CompanyProvider>
                        </ProtectedRoute>
                    }>
                        <Route path="/" element={
                            isStandaloneSuperAdmin
                                ? <Navigate to="/platform/users" replace />
                                : (user?.role === 'personnel' ? <Navigate to="/personnel-profile" replace /> : <Navigate to="/portal" replace />)
                        } />
                        <Route path="/portal" element={
                            user?.role === 'personnel' 
                                ? <Navigate to="/personnel-profile" replace /> 
                                : (isStandaloneSuperAdmin ? <Navigate to="/platform/users" replace /> : <MainPortal />)
                        } />
                        <Route path="/dashboard" element={<PermissionRoute module="vehicles"><Dashboard /></PermissionRoute>} />
                        <Route path="/finance-dashboard" element={<PermissionRoute module="finance"><FinanceDashboard /></PermissionRoute>} />
                        <Route path="/finance" element={<PermissionRoute module="finance"><Finance /></PermissionRoute>} />
                        <Route path="/checks" element={<PermissionRoute module="finance"><Checks /></PermissionRoute>} />
                        <Route path="/meal-tickets" element={<PermissionRoute module="meals"><MealTickets /></PermissionRoute>} />
                        <Route path="/meal-ticket-report" element={<PermissionRoute module="meals"><MealTicketReport /></PermissionRoute>} />
                        <Route path="/meal-ticket-settings" element={<PermissionRoute module="meals"><MealTicketSettings /></PermissionRoute>} />
                        <Route path="/companies" element={<AdminRoute><Companies /></AdminRoute>} />
                        <Route path="/vehicles" element={<PermissionRoute module="vehicles"><Vehicles /></PermissionRoute>} />
                        <Route path="/vehicles/:id" element={<PermissionRoute module="vehicles"><VehicleDetail /></PermissionRoute>} />
                        <Route path="/arvento-tracking" element={<PermissionRoute module="vehicles"><ArventoTracking /></PermissionRoute>} />
                        <Route path="/maintenance" element={<PermissionRoute module="vehicles"><Maintenance /></PermissionRoute>} />
                        <Route path="/inspections" element={<PermissionRoute module="vehicles"><Inspections /></PermissionRoute>} />
                        <Route path="/periodic-inspections" element={<PermissionRoute module="vehicles"><PeriodicInspections /></PermissionRoute>} />
                        <Route path="/insurance" element={<PermissionRoute module="vehicles"><Insurance /></PermissionRoute>} />
                        <Route path="/services" element={<PermissionRoute module="vehicles"><Services /></PermissionRoute>} />
                        <Route path="/assignments" element={<PermissionRoute module="vehicles"><Assignments /></PermissionRoute>} />
                        <Route path="/employees" element={<PermissionRoute module="employees"><Employees /></PermissionRoute>} />
                        <Route path="/employees/:id" element={<PermissionRoute module="employees"><EmployeeDetail /></PermissionRoute>} />
                        <Route path="/leaves" element={<PermissionRoute module="employees"><Leaves /></PermissionRoute>} />
                        <Route path="/personel-dashboard" element={<PermissionRoute module="employees"><PersonelDashboard /></PermissionRoute>} />
                        <Route path="/payroll" element={<PermissionRoute module="employees"><PayrollDashboard /></PermissionRoute>} />
                        <Route path="/overtimes" element={<PermissionRoute module="employees"><Overtimes /></PermissionRoute>} />
                        <Route path="/works" element={<PermissionRoute module="works"><Works /></PermissionRoute>} />
                        <Route path="/works/:id" element={<PermissionRoute module="works"><WorkDetails /></PermissionRoute>} />
                        <Route path="/customers" element={<PermissionRoute module="customers"><Customers /></PermissionRoute>} />
                        <Route path="/customers/:id" element={<PermissionRoute module="customers"><CustomerDetail /></PermissionRoute>} />
                        <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
                        <Route path="/module-settings/:module" element={<AdminRoute><ModuleSettings /></AdminRoute>} />
                        <Route path="/platform-admin" element={<Navigate to="/platform/users" replace />} />
                        <Route path="/platform" element={<Navigate to="/platform/users" replace />} />
                        <Route path="/platform/users" element={<SuperAdminRoute><PlatformAdmin section="users" /></SuperAdminRoute>} />
                        <Route path="/platform/companies" element={<SuperAdminRoute><PlatformAdmin section="companies" /></SuperAdminRoute>} />
                        <Route path="/platform/announcements" element={<SuperAdminRoute><PlatformAdmin section="announcements" /></SuperAdminRoute>} />
                        <Route path="/platform/email-templates" element={<SuperAdminRoute><PlatformAdmin section="email-templates" /></SuperAdminRoute>} />
                        <Route path="/platform/audit" element={<SuperAdminRoute><PlatformAdmin section="audit" /></SuperAdminRoute>} />
                        <Route path="/platform/health" element={<SuperAdminRoute><PlatformAdmin section="health" /></SuperAdminRoute>} />
                        <Route path="/platform/logs" element={<SuperAdminRoute><PlatformAdmin section="logs" /></SuperAdminRoute>} />
                        <Route path="/platform/backups" element={<SuperAdminRoute><PlatformAdmin section="backups" /></SuperAdminRoute>} />
                        <Route path="/approvals" element={<ApprovalCenter />} />
                        <Route path="/personnel-portal" element={<Navigate to="/personnel-profile" replace />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/employee-reports" element={<EmployeeReports />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/personnel-profile" element={<EmployeeDetail />} />
                    </Route>

                    <Route path="/print" element={<PrintPage />} />
                    <Route path="/print-document" element={<PrintDocument />} />
                    <Route path="/work-report/:id" element={<WorkPdfReport />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes >
            </Suspense >
        </>
    )
}

function App() {
    const location = useLocation()
    const isPrintRoute = location.pathname === '/print' || location.pathname === '/print-document' || location.pathname.startsWith('/work-report')

    const [lockSettings, setLockSettings] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('aractakip_lock_settings') || '{"enabled":false,"timeout":5,"useCustomPassword":false,"customPassword":""}')
        } catch {
            return { enabled: false, timeout: 5, useCustomPassword: false, customPassword: "" }
        }
    })

    useEffect(() => {
        const handleStorage = (e) => {
            if (e.key === 'aractakip_lock_settings') {
                try {
                    setLockSettings(JSON.parse(e.newValue || '{}'))
                } catch (err) {
                    console.error('Lock settings storage parse error:', err)
                }
            }
        }
        const handleCustomEvent = (e) => {
            if (e.detail) {
                setLockSettings(e.detail)
            } else {
                try {
                    setLockSettings(JSON.parse(localStorage.getItem('aractakip_lock_settings') || '{}'))
                } catch (err) {
                    console.error('Lock settings custom event parse error:', err)
                }
            }
        }

        window.addEventListener('storage', handleStorage)
        window.addEventListener('aractakip_lock_settings_changed', handleCustomEvent)
        return () => {
            window.removeEventListener('storage', handleStorage)
            window.removeEventListener('aractakip_lock_settings_changed', handleCustomEvent)
        }
    }, [])
    
    const { isIdle, resetIdle } = useIdle(lockSettings.enabled ? lockSettings.timeout * 60000 : 999999999) 
    
    const [isLocked, setIsLocked] = useState(() => {
        try {
            const settings = JSON.parse(localStorage.getItem('aractakip_lock_settings') || '{"enabled":false}')
            if (!settings.enabled) return false
            return localStorage.getItem('aractakip_locked') === 'true'
        } catch {
            return false
        }
    })

    useEffect(() => {
        // Detect platform for CSS adjustments
        const isWindows = navigator.userAgent.includes('Windows') || navigator.platform.startsWith('Win')
        if (isWindows) {
            document.body.setAttribute('data-platform', 'win32')
        } else if (navigator.userAgent.includes('Mac')) {
            document.body.setAttribute('data-platform', 'darwin')
        }
    }, [])

    useEffect(() => {
        if (isPrintRoute) return

        // Startup security check
        const isFreshStart = !sessionStorage.getItem('aractakip_session_active')
        const storedUser = localStorage.getItem('aractakip_user')
        
        if (storedUser && lockSettings.enabled && isFreshStart) {
            setIsLocked(true)
            localStorage.setItem('aractakip_locked', 'true')
        }

        // Mark session as active so subsequent refreshes don't lock unless idle
        if (storedUser) {
            sessionStorage.setItem('aractakip_session_active', 'true')
        }
    }, [lockSettings.enabled, isPrintRoute])

    const { user } = useAuth()

    useEffect(() => {
        if (isPrintRoute) return

        if (isIdle && user && lockSettings.enabled) {
            setIsLocked(true)
            localStorage.setItem('aractakip_locked', 'true')
        }
    }, [isIdle, user, lockSettings.enabled, isPrintRoute])

    const handleUnlock = () => {
        setIsLocked(false)
        localStorage.removeItem('aractakip_locked')
        resetIdle()
    }

    useEffect(() => {
        if (!lockSettings.enabled && isLocked) {
            handleUnlock()
        }
    }, [lockSettings.enabled, isLocked])

    return (
        <ErrorBoundary>
            <LockScreen isLocked={!isPrintRoute && isLocked && !!user && lockSettings.enabled} onUnlock={handleUnlock} />
            <AppRoutes />
        </ErrorBoundary>
    )
}

export default App
