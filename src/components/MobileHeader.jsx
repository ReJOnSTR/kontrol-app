import React, { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { 
    Menu, X, Building2, ChevronDown, User, LogOut, Settings, 
    Crown, Bell, LayoutDashboard, Car, Users, Wallet, Briefcase, 
    UtensilsCrossed, ArrowRight, Shield, Check
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { useTabs } from '../context/TabContext'
import { moduleMenus, getActiveModule } from '../config/navigation'
import logoCollapsed from '../assets/logos/Group1.svg'
import NotificationCenter from './NotificationCenter'

const MODULE_LIST = [
    { id: 'portal', label: 'Ana Portal', icon: LayoutDashboard, path: '/portal' },
    { id: 'fleet', label: 'Filo & Araçlar', icon: Car, path: '/dashboard' },
    { id: 'hr', label: 'Personel & İK', icon: Users, path: '/personel-dashboard' },
    { id: 'finance', label: 'Finans', icon: Wallet, path: '/finance-dashboard' },
    { id: 'works', label: 'İş & Operasyon', icon: Briefcase, path: '/works' },
    { id: 'customers', label: 'Müşteriler', icon: Building2, path: '/customers' },
    { id: 'meals', label: 'Yemek Fişleri', icon: UtensilsCrossed, path: '/meal-tickets' }
]

function canAccessPath(path, hasPermission, isAdmin, isSuperAdmin) {
    if (isSuperAdmin) return true
    if (path.startsWith('/platform')) return false
    if (isAdmin) return true
    if (path === '/companies' || path.startsWith('/settings') || path.startsWith('/module-settings')) return true

    if (path.startsWith('/finance') || path === '/checks') return hasPermission('finance', 'can_read')
    if (path.startsWith('/meal')) return hasPermission('meals', 'can_read')
    if (path === '/payroll' || path === '/salary') return hasPermission('employees_view_salary') || hasPermission('employees', 'can_read')
    if (path.startsWith('/employees') || path === '/leaves' || path === '/overtimes' || path === '/personel-dashboard') return hasPermission('employees', 'can_read')
    if (path.startsWith('/works')) return hasPermission('works', 'can_read')
    if (path.startsWith('/customers')) return hasPermission('customers', 'can_read')
    if (path.startsWith('/vehicles') || path === '/maintenance' || path === '/inspections' || path === '/periodic-inspections' || path === '/insurance' || path === '/services' || path === '/assignments' || path === '/arvento-tracking') {
        return hasPermission('vehicles', 'can_read')
    }
    return true
}

export default function MobileHeader() {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [showCompanyMenu, setShowCompanyMenu] = useState(false)
    const [showUserMenu, setShowUserMenu] = useState(false)
    
    const { user, logout, isAdmin, hasPermission } = useAuth()
    const { companies, currentCompany, selectCompany, isImpersonating, isModuleEnabled } = useCompany()
    const { openNewTab } = useTabs()
    const location = useLocation()
    const navigate = useNavigate()

    const isSuperAdmin = user?.role === 'superadmin'

    // Close drawer on route change
    useEffect(() => {
        setDrawerOpen(false)
        setShowCompanyMenu(false)
        setShowUserMenu(false)
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

    const activeModule = (isSuperAdmin && !isImpersonating) 
        ? 'platform' 
        : getActiveModule(location.pathname, location.search)

    const isModuleAllowed = (isSuperAdmin && !isImpersonating) ? true : isModuleEnabled(activeModule)
    const activeMenus = isModuleAllowed ? (moduleMenus[activeModule] || []) : []

    const filteredMenus = activeMenus.map(group => {
        const items = group.items.filter(item => canAccessPath(item.path, hasPermission, isAdmin, isSuperAdmin))
        return { ...group, items }
    }).filter(group => group.items.length > 0)

    const availableModules = MODULE_LIST.filter(m => {
        if (m.id === 'portal') return true
        if (isSuperAdmin && !isImpersonating) return false
        return isModuleEnabled(m.id)
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
                    {/* Company Switcher */}
                    {!(isSuperAdmin && !isImpersonating) && (
                        <div className="mobile-company-selector">
                            <button
                                type="button"
                                className="mobile-company-btn"
                                onClick={() => {
                                    setShowCompanyMenu(!showCompanyMenu)
                                    setShowUserMenu(false)
                                }}
                            >
                                <Building2 size={15} />
                                <span className="mobile-company-name">
                                    {currentCompany?.name || 'Şirket'}
                                </span>
                                <ChevronDown size={13} />
                            </button>

                            {showCompanyMenu && (
                                <>
                                    <div 
                                        className="mobile-dropdown-backdrop"
                                        onClick={() => setShowCompanyMenu(false)}
                                    />
                                    <div className="mobile-dropdown-menu company-dropdown">
                                        <div className="mobile-dropdown-header">Şirket Değiştir</div>
                                        {companies.length === 0 ? (
                                            <div className="mobile-dropdown-empty">Şirket bulunamadı</div>
                                        ) : (
                                            companies.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    className={`mobile-dropdown-item ${currentCompany?.id === c.id ? 'active' : ''}`}
                                                    onClick={() => {
                                                        selectCompany(c)
                                                        setShowCompanyMenu(false)
                                                    }}
                                                >
                                                    <Building2 size={16} />
                                                    <span className="company-text">{c.name}</span>
                                                    {currentCompany?.id === c.id && <Check size={14} className="check-icon" />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

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
                <div className="mobile-drawer-header">
                    <div className="drawer-brand">
                        <img src={logoCollapsed} alt="Kontrol" className="drawer-logo" />
                        <div>
                            <div className="drawer-title">Kontrol</div>
                            <div className="drawer-subtitle">{currentCompany?.name || 'Filo Yönetimi'}</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="drawer-close-btn"
                        onClick={() => setDrawerOpen(false)}
                        aria-label="Kapat"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Module Quick Nav Chips */}
                <div className="drawer-modules-section">
                    <div className="drawer-section-title">Modüller</div>
                    <div className="drawer-modules-grid">
                        {availableModules.map(mod => {
                            const isModActive = activeModule === mod.id
                            const IconComponent = mod.icon
                            return (
                                <button
                                    key={mod.id}
                                    type="button"
                                    className={`drawer-module-chip ${isModActive ? 'active' : ''}`}
                                    onClick={() => {
                                        navigate(mod.path)
                                        setDrawerOpen(false)
                                    }}
                                >
                                    <IconComponent size={15} />
                                    <span>{mod.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Submenu Items for Active Module */}
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
                                                {IconComponent && <IconComponent size={18} />}
                                            </div>
                                            <span className="drawer-nav-text">{item.label}</span>
                                            <ArrowRight size={14} className="drawer-nav-arrow" />
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
                            navigate('/settings')
                            setDrawerOpen(false)
                        }}
                    >
                        <Settings size={17} />
                        <span>Ayarlar</span>
                    </button>
                    <button
                        type="button"
                        className="drawer-footer-btn danger"
                        onClick={logout}
                    >
                        <LogOut size={17} />
                        <span>Çıkış</span>
                    </button>
                </div>
            </aside>
        </div>
    )
}
