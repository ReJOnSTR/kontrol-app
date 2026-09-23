import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import {
    Building2,
    ChevronDown,
    User,
    LogOut,
    Settings,
    ArrowLeft,
    Crown
} from 'lucide-react'
import NotificationCenter from './NotificationCenter'

const pageTitles = {
    '/': 'Dashboard',
    '/companies': 'Şirketler',
    '/vehicles': 'Araçlar',
    '/maintenance': 'Bakım Takibi',
    '/inspections': 'Muayene Takibi',
    '/insurance': 'Sigorta Yönetimi',
    '/assignments': 'Zimmet Takibi',
    '/services': 'Servis İşlemleri',
    '/reports': 'Raporlar',
    '/platform-admin': 'Platform Yönetimi'
}

export default function Header() {
    const location = useLocation()
    const { user, logout } = useAuth()
    const { companies, currentCompany, selectCompany } = useCompany()
    const navigate = useNavigate()
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
    const [showUserDropdown, setShowUserDropdown] = useState(false)

    const pageTitle = pageTitles[location.pathname] || 'Sayfa'

    const handleCompanySelect = (company) => {
        selectCompany(company)
        setShowCompanyDropdown(false)
    }

    const isSuperAdmin = user?.role === 'superadmin'

    return (
        <header className="header">
            <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {location.pathname !== '/' && (
                    <button 
                        onClick={() => navigate(-1)}
                        className="btn btn-secondary"
                        style={{ 
                            padding: '6px 12px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            height: '32px' 
                        }}
                        title="Geri Dön"
                    >
                        <ArrowLeft size={16} /> Geri
                    </button>
                )}
                <h1 className="header-title">{pageTitle}</h1>
            </div>

            <div className="header-right">
                {/* Platform Super Admin Master Button */}
                {isSuperAdmin && (
                    <button
                        onClick={() => navigate('/platform-admin')}
                        style={{
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.25) 100%)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            color: '#f59e0b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        title="Süper Yönetici / Platform Yönetim Paneli"
                    >
                        <Crown size={15} />
                        <span>Platform Yönetimi</span>
                    </button>
                )}

                {/* Notification Center */}
                <NotificationCenter />

                {/* Company Selector */}
                <div className="company-selector">
                    <button
                        className="company-selector-btn"
                        onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                    >
                        <Building2 size={18} />
                        <span>{currentCompany?.name || 'Şirket Seçin'}</span>
                        <ChevronDown size={16} />
                    </button>

                    {showCompanyDropdown && (
                        <>
                            <div
                                className="dropdown-backdrop"
                                style={{
                                    position: 'fixed',
                                    inset: 0,
                                    zIndex: 199
                                }}
                                onClick={() => setShowCompanyDropdown(false)}
                            />
                            <div className="company-dropdown">
                                {companies.length === 0 ? (
                                    <div className="company-dropdown-item">
                                        <span style={{ color: 'var(--text-secondary)' }}>
                                            Henüz şirket eklenmemiş
                                        </span>
                                    </div>
                                ) : (
                                    companies.map((company) => (
                                        <div
                                            key={company.id}
                                            className={`company-dropdown-item ${currentCompany?.id === company.id ? 'active' : ''}`}
                                            onClick={() => handleCompanySelect(company)}
                                        >
                                            <Building2 size={18} />
                                            <span>{company.name}</span>
                                        </div>
                                    ))
                                )}
                                <div
                                    className="company-dropdown-item management-action"
                                    onClick={() => { navigate('/companies'); setShowCompanyDropdown(false) }}
                                >
                                    <Settings size={16} />
                                    <span>Şirket Yönetimi</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* User Menu */}
                <div className="user-menu">
                    <button
                        className="user-menu-btn"
                        onClick={() => setShowUserDropdown(!showUserDropdown)}
                    >
                        <div className="user-avatar">
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <ChevronDown size={16} />
                    </button>

                    {showUserDropdown && (
                        <>
                            <div
                                className="dropdown-backdrop"
                                style={{
                                    position: 'fixed',
                                    inset: 0,
                                    zIndex: 199
                                }}
                                onClick={() => setShowUserDropdown(false)}
                            />
                                <div className="user-dropdown">
                                    <div 
                                        className="user-dropdown-item" 
                                        style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                                        onClick={() => { navigate('/profile'); setShowUserDropdown(false) }}
                                    >
                                        <User size={16} />
                                        <div>
                                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{user?.full_name || user?.username}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email}</div>
                                        </div>
                                    </div>
                                    {isSuperAdmin && (
                                        <div 
                                            className="user-dropdown-item" 
                                            style={{ color: '#f59e0b', fontWeight: 600 }}
                                            onClick={() => { navigate('/platform-admin'); setShowUserDropdown(false) }}
                                        >
                                            <Crown size={16} />
                                            <span>Platform Yönetimi</span>
                                        </div>
                                    )}
                                    <div className="user-dropdown-item" onClick={() => { navigate('/settings'); setShowUserDropdown(false) }}>
                                        <Settings size={16} />
                                        <span>Genel Ayarlar</span>
                                    </div>
                                    <div className="user-dropdown-item" onClick={() => { navigate('/profile'); setShowUserDropdown(false) }}>
                                        <Settings size={16} />
                                        <span>Profil Ayarları</span>
                                    </div>
                                    <div className="user-dropdown-item danger" onClick={logout}>
                                        <LogOut size={16} />
                                        <span>Çıkış Yap</span>
                                    </div>
                                </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}
