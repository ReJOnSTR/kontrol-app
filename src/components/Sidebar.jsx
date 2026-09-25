import { NavLink, useLocation } from 'react-router-dom'
import { moduleMenus, getActiveModule } from '../config/navigation'
import logoCollapsed from '../assets/logos/Group1.svg'
import { ChevronRight, ChevronLeft, Crown, Layers } from 'lucide-react'
import { useTabs } from '../context/TabContext'
import { useAuth } from '../context/AuthContext'
import { useEffect } from 'react'

import { useCompany } from '../context/CompanyContext'

function canAccessPath(path, hasPermission, isAdmin, isSuperAdmin) {
    if (isSuperAdmin) return true
    if (path.startsWith('/platform')) return false
    if (isAdmin) return true
    if (path === '/companies' || path.startsWith('/settings') || path.startsWith('/module-settings')) {
        return true
    }

    if (path.startsWith('/finance') || path === '/checks') {
        return hasPermission('finance', 'can_read')
    }
    if (path.startsWith('/meal')) {
        return hasPermission('meals', 'can_read')
    }
    if (path === '/payroll' || path === '/salary') {
        return hasPermission('employees_view_salary') || hasPermission('employees', 'can_read')
    }
    if (path.startsWith('/employees') || path === '/leaves' || path === '/overtimes' || path === '/personel-dashboard') {
        return hasPermission('employees', 'can_read')
    }
    if (path.startsWith('/works')) {
        return hasPermission('works', 'can_read')
    }
    if (path.startsWith('/customers')) {
        return hasPermission('customers', 'can_read')
    }
    if (path.startsWith('/vehicles') || path === '/maintenance' || path === '/inspections' || path === '/periodic-inspections' || path === '/insurance' || path === '/services' || path === '/assignments' || path === '/arvento-tracking') {
        return hasPermission('vehicles', 'can_read')
    }

    return true
}

export default function Sidebar({ collapsed, onToggle }) {
    const { openNewTab } = useTabs()
    const { user, isAdmin, hasPermission } = useAuth()
    const { isImpersonating, isModuleEnabled } = useCompany()
    const location = useLocation()

    const isSuperAdmin = user?.role === 'superadmin'

    // Determine the active module (For standalone SuperAdmin, always 'platform')
    const activeModule = (isSuperAdmin && !isImpersonating) 
        ? 'platform' 
        : getActiveModule(location.pathname, location.search)

    const isModuleAllowed = (isSuperAdmin && !isImpersonating) ? true : isModuleEnabled(activeModule)
    const activeMenus = isModuleAllowed ? (moduleMenus[activeModule] || []) : []

    const filteredMenus = activeMenus.map(group => {
        const items = group.items.filter(item => canAccessPath(item.path, hasPermission, isAdmin, isSuperAdmin))
        return { ...group, items }
    }).filter(group => group.items.length > 0)

    // Persist active module so we can recover it for non-module pages (like /settings)
    useEffect(() => {
        if (activeModule && activeModule !== 'portal' && !isSuperAdmin) {
            sessionStorage.setItem('lastActiveModule', activeModule)
        }
    }, [activeModule, isSuperAdmin])

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''} `}>
            <div className="sidebar-header">
                <div className="sidebar-logo" style={{ background: 'transparent', boxShadow: 'none', width: '24px', height: '24px' }}>
                    <img src={logoCollapsed} alt="Kontrol Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                {!collapsed && <span className="sidebar-title">Kontrol</span>}
            </div>

            <nav className="sidebar-nav">
                {filteredMenus.map((group, index) => (
                    <div className="nav-section" key={index}>
                        {group.title && <div className="nav-section-title">{group.title}</div>}
                        {group.items.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => {
                                    let isCurrent = false
                                    if (item.path.includes('?')) {
                                        const fullCurrent = `${location.pathname}${location.search}`
                                        isCurrent = fullCurrent === item.path || 
                                            (item.path === '/settings?tab=general' && location.pathname === '/settings' && (!location.search || location.search === '?tab=general')) ||
                                            (item.path === '/platform-admin?tab=users' && location.pathname === '/platform-admin' && (!location.search || location.search === '?tab=users'))
                                    } else {
                                        isCurrent = location.pathname === item.path && (!location.search || (item.path !== '/platform-admin' && item.path !== '/settings'))
                                    }

                                    return `nav-item ${isCurrent || (isActive && !item.path.includes('?') && location.pathname === item.path) ? 'active' : ''}`
                                }}
                                title={collapsed ? item.label : ''}
                                onAuxClick={(e) => e.preventDefault()}
                                onClick={(e) => {
                                    if (e.ctrlKey || e.metaKey) {
                                        e.preventDefault()
                                        openNewTab(item.path)
                                    }
                                }}
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="sidebar-toggle" onClick={onToggle}>
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    {!collapsed && <span>Daralt</span>}
                </button>
            </div>
        </aside>
    )
}
