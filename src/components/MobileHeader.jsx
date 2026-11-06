import React, { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { 
    Menu, X, Building2, ChevronDown, User, LogOut, Settings, 
    Crown, Bell, LayoutDashboard, Car, Users, Wallet, Briefcase, 
    UtensilsCrossed, ChevronRight, Shield, Check, Search, Sparkles
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { useTabs } from '../context/TabContext'
import { moduleMenus, getActiveModule } from '../config/navigation'
import logoCollapsed from '../assets/logos/Group1.svg'
import NotificationCenter from './NotificationCenter'

const MODULE_LIST = [
    { id: 'portal', label: 'Ana Portal', icon: LayoutDashboard, path: '/portal', color: '#14b8a6' },
    { id: 'fleet', label: 'Filo Yönetimi', icon: Car, path: '/dashboard', color: '#3b82f6' },
    { id: 'hr', label: 'Personel & İK', icon: Users, path: '/personel-dashboard', color: '#10b981' },
    { id: 'finance', label: 'Kasa & Finans', icon: Wallet, path: '/finance-dashboard', color: '#f59e0b' },
    { id: 'works', label: 'İş & Operasyon', icon: Briefcase, path: '/works', color: '#8b5cf6' },
    { id: 'customers', label: 'Cari & Müşteri', icon: Building2, path: '/customers', color: '#06b6d4' },
    { id: 'meals', label: 'Yemek Fişleri', icon: UtensilsCrossed, path: '/meal-tickets', color: '#f43f5e' }
]

function canAccessPath(path, hasPermission, isAdmin, isSuperAdmin) {
    if (isSuperAdmin) return true
    if (path.startsWith('/platform')) return false
    if (isAdmin) return true
    if (path === '/companies') return false
    if (path.startsWith('/settings') || path.startsWith('/module-settings')) {
        return hasPermission('settings', 'can_read')
    }

    if (path.startsWith('/finance') || path === '/checks') return hasPermission('finance', 'can_read')
    if (path.startsWith('/meal')) return hasPermission('meals', 'can_read')
    if (path === '/payroll' || path === '/salary') return hasPermission('employees_view_salary') || hasPermission('employees', 'can_read')
    if (path.startsWith('/employees') || path === '/leaves' || path === '/overtimes' || path === '/personel-dashboard' || path === '/approvals' || path === '/employee-reports') return hasPermission('employees', 'can_read')
    if (path.startsWith('/works')) return hasPermission('works', 'can_read')
    if (path.startsWith('/customers')) return hasPermission('customers', 'can_read')
    if (path.startsWith('/vehicles') || path === '/maintenance' || path === '/inspections' || path === '/periodic-inspections' || path === '/insurance' || path === '/services' || path === '/assignments' || path === '/arvento-tracking') {
        return hasPermission('vehicles', 'can_read')
    }
    if (path === '/reports') return hasPermission('reports', 'can_read')
    return true
}

export default function MobileHeader() {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [showCompanyMenu, setShowCompanyMenu] = useState(false)
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [selectedDrawerModule, setSelectedDrawerModule] = useState(null)
    
    const { user, logout, isAdmin, hasPermission } = useAuth()
    const { companies, currentCompany, selectCompany, isImpersonating, isModuleEnabled, isIntegrationEnabled } = useCompany()
    const { openNewTab } = useTabs()
    const location = useLocation()
    const navigate = useNavigate()

    const isSuperAdmin = user?.role === 'superadmin'
    const isPersonnel = user?.role === 'personnel'

    // Listen to global open mobile drawer event
    useEffect(() => {
        const handleOpen = () => setDrawerOpen(true)
        window.addEventListener('kontrol:open-mobile-drawer', handleOpen)
        return () => window.removeEventListener('kontrol:open-mobile-drawer', handleOpen)
    }, [])

    // Close drawer on route change
    useEffect(() => {
        setDrawerOpen(false)
        setShowCompanyMenu(false)
        setShowUserMenu(false)
        setSelectedDrawerModule(null)
    }, [location.pathname, location.search])

    // Prevent background scrolling when drawer is open
    useEffect(() => {
        if (drawerOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [drawerOpen])

    const activeRouteModule = (isSuperAdmin && !isImpersonating) 
        ? 'platform' 
        : (isPersonnel ? 'personnel' : getActiveModule(location.pathname, location.search))

    // If on portal or activeRouteModule has no submenus, default to fleet or first available module
    const currentDrawerModule = selectedDrawerModule || (activeRouteModule !== 'portal' && moduleMenus[activeRouteModule] ? activeRouteModule : 'fleet')

    const isModuleAllowed = (isSuperAdmin && !isImpersonating) ? true : (isPersonnel ? true : isModuleEnabled(currentDrawerModule))
    const targetMenus = isModuleAllowed ? (moduleMenus[currentDrawerModule] || []) : []

    const filteredMenus = targetMenus.map(group => {
        const items = group.items.filter(item => {
            if (item.integration && !isIntegrationEnabled(item.integration)) return false
            if (item.path === '/arvento-tracking' && !isIntegrationEnabled('arvento')) return false
            return canAccessPath(item.path, hasPermission, isAdmin, isSuperAdmin)
        })
        return { ...group, items }
    }).filter(group => group.items.length > 0)

    const availableModules = isPersonnel
        ? [{ id: 'personnel', label: 'Personel Portalı', icon: User, path: '/personnel-profile' }]
        : (isSuperAdmin && !isImpersonating)
            ? [
                { id: 'portal', label: 'Ana Portal', icon: LayoutDashboard, path: '/portal' },
                { id: 'platform', label: 'Platform', icon: Crown, path: '/platform-admin' }
            ]
            : MODULE_LIST.filter(m => {
                if (m.id === 'portal') return true
                if (!isModuleEnabled(m.id)) return false
                if (isAdmin) return true
                if (m.id === 'fleet') return hasPermission('vehicles', 'can_read')
                if (m.id === 'finance') return hasPermission('finance', 'can_read')
                if (m.id === 'meals') return hasPermission('meals', 'can_read')
                if (m.id === 'hr') return hasPermission('employees', 'can_read')
                if (m.id === 'works') return hasPermission('works', 'can_read')
                if (m.id === 'customers') return hasPermission('customers', 'can_read')
                return false
            })

    return (
        <div className="mobile-header-wrapper">
            {/* Top Bar for Mobile Screens */}
            <header className="mobile-header">
                <div className="mobile-header-left">
                    <button
                        type="button"
                        className="mobile-menu-btn"
                        onClick={() => setDrawerOpen(true)}
                        aria-label="Menüyü Aç"
                    >
                        <Menu size={22} />
                    </button>
                    <div 
                        className="mobile-brand"
                        onClick={() => navigate(user?.role === 'personnel' ? '/personnel-profile' : '/portal')}
                    >
                        <img src={logoCollapsed} alt="Logo" className="mobile-logo" />
                        <span className="mobile-app-title">Kontrol</span>
                    </div>
                </div>

                <div className="mobile-header-right">
                    {/* Global Search Button */}
                    <button
                        type="button"
                        className="mobile-search-btn"
                        onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
                        aria-label="Hızlı Ara"
                        title="Hızlı Ara (Ctrl+K)"
                    >
                        <Search size={18} />
                    </button>

                    {/* Notification Center */}
                    <div className="mobile-notification-wrapper">
                        <NotificationCenter />
                    </div>

                    {/* User Profile Menu */}
                    <div className="mobile-user-wrapper">
                        <button
                            type="button"
                            className="mobile-avatar-btn"
                            onClick={() => {
                                setShowUserMenu(!showUserMenu)
                                setShowCompanyMenu(false)
                            }}
                        >
                            <div className="mobile-avatar-circle">
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        </button>

                        {showUserMenu && (
                            <>
                                <div 
                                    className="mobile-dropdown-backdrop"
                                    onClick={() => setShowUserMenu(false)}
                                />
                                <div className="mobile-dropdown-menu user-dropdown">
                                    <div className="mobile-user-info">
                                        <div className="mobile-user-name">{user?.full_name || user?.username}</div>
                                        <div className="mobile-user-email">{user?.email}</div>
                                    </div>

                                    {isSuperAdmin && (
                                        <button
                                            type="button"
                                            className="mobile-dropdown-item highlight"
                                            onClick={() => {
                                                navigate('/platform-admin')
                                                setShowUserMenu(false)
                                            }}
                                        >
                                            <Crown size={16} />
                                            <span>Platform Yönetimi</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        className="mobile-dropdown-item"
                                        onClick={() => {
                                            navigate(user?.role === 'personnel' ? '/personnel-profile' : '/profile')
                                            setShowUserMenu(false)
                                        }}
                                    >
                                        <User size={16} />
                                        <span>Profilim</span>
                                    </button>

                                    <button
                                        type="button"
                                        className="mobile-dropdown-item"
                                        onClick={() => {
                                            navigate(user?.role === 'personnel' ? '/change-password' : '/settings')
                                            setShowUserMenu(false)
                                        }}
                                    >
                                        <Settings size={16} />
                                        <span>Ayarlar</span>
                                    </button>

                                    <div className="mobile-dropdown-divider" />

                                    <button
                                        type="button"
                                        className="mobile-dropdown-item danger"
                                        onClick={logout}
                                    >
                                        <LogOut size={16} />
                                        <span>Çıkış Yap</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Slide-over Mobile Drawer / Navigation */}
            {drawerOpen && (
                <div 
                    className="mobile-drawer-overlay"
                    onClick={() => setDrawerOpen(false)}
                />
            )}

            <aside className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
                {/* Drag Indicator Handle */}
                <div className="bottom-sheet-handle-area" onClick={() => setDrawerOpen(false)}>
                    <div className="bottom-sheet-handle" />
                </div>

                {/* User & Company Header Card */}
                <div className="mobile-drawer-header">
                    <div 
                        className="drawer-user-info"
                        onClick={() => {
                            navigate(user?.role === 'personnel' ? '/personnel-profile' : '/portal');
                            setDrawerOpen(false);
                        }}
                    >
                        <div className="drawer-user-avatar">
                            {user?.username?.charAt(0).toUpperCase() || 'K'}
                        </div>
                        <div className="drawer-user-meta">
                            <div className="drawer-user-name">{user?.full_name || user?.username || 'Kullanıcı'}</div>
                            <div className="drawer-user-sub">
                                <span className="drawer-role-tag">
                                    {isSuperAdmin ? 'Süper Admin' : (isAdmin ? 'Yönetici' : (isPersonnel ? 'Personel' : 'Üye'))}
                                </span>
                                {currentCompany?.name && (
                                    <span className="drawer-company-tag" title={currentCompany.name}>
                                        {currentCompany.name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="drawer-close-btn"
                        onClick={() => setDrawerOpen(false)}
                        aria-label="Kapat"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Company Switcher (Multi-Company Support) */}
                {!(isSuperAdmin && !isImpersonating) && companies.length > 1 && (
                    <div className="drawer-company-section">
                        <div className="drawer-company-selector">
                            <button
                                type="button"
                                className="drawer-company-trigger"
                                onClick={() => setShowCompanyMenu(!showCompanyMenu)}
                            >
                                <div className="drawer-company-info">
                                    <Building2 size={15} className="drawer-company-icon" />
                                    <span className="drawer-company-name">{currentCompany?.name || 'Şirket Değiştir'}</span>
                                </div>
                                <ChevronDown size={14} className={`drawer-company-chevron ${showCompanyMenu ? 'rotate' : ''}`} />
                            </button>

                            {showCompanyMenu && (
                                <div className="drawer-company-list">
                                    {companies.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            className={`drawer-company-item ${currentCompany?.id === c.id ? 'active' : ''}`}
                                            onClick={() => {
                                                selectCompany(c)
                                                setShowCompanyMenu(false)
                                            }}
                                        >
                                            <Building2 size={14} />
                                            <span>{c.name}</span>
                                            {currentCompany?.id === c.id && <Check size={14} className="check-icon" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Module Quick Switcher */}
                <div className="drawer-modules-section">
                    <div className="drawer-section-header">
                        <span className="drawer-section-title">Modüller</span>
                        <button
                            type="button"
                            className="drawer-portal-btn"
                            onClick={() => {
                                navigate('/portal')
                                setDrawerOpen(false)
                            }}
                        >
                            <LayoutDashboard size={13} />
                            <span>Ana Portal</span>
                        </button>
                    </div>
                    <div className="drawer-modules-grid">
                        {availableModules.map(mod => {
                            const isModActive = currentDrawerModule === mod.id || (mod.id === 'portal' && location.pathname === '/portal')
                            const IconComponent = mod.icon
                            return (
                                <button
                                    key={mod.id}
                                    type="button"
                                    className={`drawer-module-chip ${isModActive ? 'active' : ''}`}
                                    onClick={() => {
                                        if (mod.id === 'portal') {
                                            navigate('/portal')
                                            setDrawerOpen(false)
                                        } else {
                                            setSelectedDrawerModule(mod.id)
                                        }
                                    }}
                                >
                                    <IconComponent size={15} style={{ color: isModActive ? '#ffffff' : (mod.color || 'var(--accent-primary)') }} />
                                    <span>{mod.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Submenu Title & Quick Access to Module Dashboard */}
                <div className="drawer-submenus-bar">
                    <span className="drawer-submenus-label">
                        {availableModules.find(m => m.id === currentDrawerModule)?.label || 'Seçili'} Menüleri
                    </span>
                    {availableModules.find(m => m.id === currentDrawerModule)?.path && (
                        <button
                            type="button"
                            className="drawer-panel-link"
                            onClick={() => {
                                const targetPath = availableModules.find(m => m.id === currentDrawerModule)?.path
                                if (targetPath) {
                                    navigate(targetPath)
                                    setDrawerOpen(false)
                                }
                            }}
                        >
                            Panele Git →
                        </button>
                    )}
                </div>

                {/* Submenu Items for Active/Selected Module */}
                <div className="drawer-nav-content">
                    {filteredMenus.map((group, gIdx) => (
                        <div key={gIdx} className="drawer-nav-group">
                            {group.title && (
                                <div className="drawer-nav-group-title">{group.title}</div>
                            )}
                            <div className="drawer-nav-list">
                                {group.items.map((item, iIdx) => {
                                    const IconComponent = item.icon
                                    const isCurrent = location.pathname === item.path || 
                                        (item.path.includes('?') && `${location.pathname}${location.search}` === item.path)

                                    return (
                                        <NavLink
                                            key={iIdx}
                                            to={item.path}
                                            className={`drawer-nav-item ${isCurrent ? 'active' : ''}`}
                                            onClick={() => setDrawerOpen(false)}
                                        >
                                            <div className="drawer-nav-icon">
                                                {IconComponent && <IconComponent size={17} />}
                                            </div>
                                            <span className="drawer-nav-text">{item.label}</span>
                                            <ChevronRight size={15} className="drawer-nav-arrow" />
                                        </NavLink>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Drawer Footer Actions */}
                <div className="drawer-footer">
                    <button
                        type="button"
                        className="drawer-footer-btn"
                        onClick={() => {
                            navigate(user?.role === 'personnel' ? '/personnel-profile' : '/profile')
                            setDrawerOpen(false)
                        }}
                    >
                        <User size={16} />
                        <span>Profil</span>
                    </button>
                    {(isAdmin || hasPermission('settings', 'can_read')) && (
                        <button
                            type="button"
                            className="drawer-footer-btn"
                            onClick={() => {
                                navigate('/settings')
                                setDrawerOpen(false)
                            }}
                        >
                            <Settings size={16} />
                            <span>Ayarlar</span>
                        </button>
                    )}
                    {isSuperAdmin && (
                        <button
                            type="button"
                            className="drawer-footer-btn highlight"
                            onClick={() => {
                                navigate('/platform-admin')
                                setDrawerOpen(false)
                            }}
                        >
                            <Crown size={16} />
                            <span>Platform</span>
                        </button>
                    )}
                    <button
                        type="button"
                        className="drawer-footer-btn danger"
                        onClick={logout}
                    >
                        <LogOut size={16} />
                        <span>Çıkış</span>
                    </button>
                </div>
            </aside>
        </div>
    )
}
