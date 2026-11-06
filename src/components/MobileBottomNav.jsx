import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Car, Users, Wallet, Menu } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'

export default function MobileBottomNav() {
    const location = useLocation()
    const { user, isAdmin, hasPermission } = useAuth()
    const { isModuleEnabled } = useCompany()
    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)

    const isPersonnel = user?.role === 'personnel'
    const isSuperAdmin = user?.role === 'superadmin'

    React.useEffect(() => {
        const handleState = (e) => {
            setIsDrawerOpen(!!e.detail?.open)
        }
        window.addEventListener('kontrol:mobile-drawer-state', handleState)
        return () => window.removeEventListener('kontrol:mobile-drawer-state', handleState)
    }, [])

    const toggleDrawer = () => {
        window.dispatchEvent(new CustomEvent('kontrol:toggle-mobile-drawer'))
    }

    // Don't show bottom nav on print pages
    const isPrint = location.pathname.includes('print') || location.pathname.includes('work-report')
    if (isPrint) return null

    if (isPersonnel) {
        return (
            <nav className="mobile-bottom-nav">
                <NavLink to="/personnel-profile" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                    <Users size={20} />
                    <span>Profilim</span>
                </NavLink>
                <NavLink to="/leaves" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                    <Car size={20} />
                    <span>İzinlerim</span>
                </NavLink>
                <NavLink to="/overtimes" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                    <Wallet size={20} />
                    <span>Mesailerim</span>
                </NavLink>
                <button 
                    type="button" 
                    className={`bottom-nav-item menu-trigger ${isDrawerOpen ? 'active' : ''}`} 
                    onClick={toggleDrawer}
                    aria-label="Menüyü Aç / Kapat"
                >
                    <Menu size={20} />
                    <span>Menü</span>
                </button>
            </nav>
        )
    }

    const canSeeFleet = isSuperAdmin || isAdmin || (hasPermission && hasPermission('vehicles', 'can_read'))
    const canSeeHr = isSuperAdmin || isAdmin || (hasPermission && hasPermission('employees', 'can_read'))
    const canSeeFinance = isSuperAdmin || isAdmin || (hasPermission && hasPermission('finance', 'can_read'))

    return (
        <nav className="mobile-bottom-nav">
            <NavLink to="/portal" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                <LayoutDashboard size={20} />
                <span>Portal</span>
            </NavLink>

            {canSeeFleet && isModuleEnabled && isModuleEnabled('fleet') && (
                <NavLink 
                    to="/dashboard" 
                    className={({ isActive }) => `bottom-nav-item ${isActive || location.pathname.startsWith('/vehicles') || location.pathname === '/maintenance' || location.pathname === '/inspections' ? 'active' : ''}`}
                >
                    <Car size={20} />
                    <span>Filo</span>
                </NavLink>
            )}

            {canSeeHr && isModuleEnabled && isModuleEnabled('hr') && (
                <NavLink 
                    to="/personel-dashboard" 
                    className={({ isActive }) => `bottom-nav-item ${isActive || location.pathname.startsWith('/employees') || location.pathname === '/leaves' || location.pathname === '/salaries' || location.pathname === '/overtimes' ? 'active' : ''}`}
                >
                    <Users size={20} />
                    <span>Personel</span>
                </NavLink>
            )}

            {canSeeFinance && isModuleEnabled && isModuleEnabled('finance') && (
                <NavLink 
                    to="/finance-dashboard" 
                    className={({ isActive }) => `bottom-nav-item ${isActive || location.pathname.startsWith('/finance') || location.pathname === '/checks' ? 'active' : ''}`}
                >
                    <Wallet size={20} />
                    <span>Finans</span>
                </NavLink>
            )}

            <button 
                type="button" 
                className={`bottom-nav-item menu-trigger ${isDrawerOpen ? 'active' : ''}`} 
                onClick={toggleDrawer} 
                aria-label="Menüyü Aç / Kapat"
            >
                <Menu size={20} />
                <span>Menü</span>
            </button>
        </nav>
    )
}

