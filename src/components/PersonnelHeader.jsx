import React, { useState } from 'react'
import { ChevronDown, User, LogOut, Settings, Building2 } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { getRouteInfo } from '../config/navigation'
import NotificationCenter from './NotificationCenter'

export default function PersonnelHeader() {
    const { user, logout } = useAuth()
    const { currentCompany } = useCompany()
    const navigate = useNavigate()
    const location = useLocation()
    const [showUserDropdown, setShowUserDropdown] = useState(false)

    const routeInfo = getRouteInfo(location.pathname)

    return (
        <div className="tab-bar personnel-header-bar" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            height: '48px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0
        }}>
            {/* Left: Breadcrumb / Page Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {routeInfo.icon && <routeInfo.icon size={16} style={{ color: 'var(--accent-primary)' }} />}
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {routeInfo.label}
                </span>
            </div>

            {/* Right: Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Active Company Name (ReadOnly for Personnel) */}
                {currentCompany && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-tertiary)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <Building2 size={14} color="var(--accent-primary)" />
                        <span style={{ fontWeight: 500 }}>{currentCompany.name}</span>
                    </div>
                )}

                {/* Notification Center */}
                <NotificationCenter />

                {/* User Profile Dropdown */}
                <div className="user-menu" style={{ position: 'relative' }}>
                    <button
                        className="user-menu-btn"
                        onClick={() => setShowUserDropdown(!showUserDropdown)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px'
                        }}
                    >
                        <div className="user-avatar" style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'var(--accent-primary)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: 'bold'
                        }}>
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 500 }} className="desktop-only">
                            {user?.full_name || user?.username}
                        </span>
                        <ChevronDown size={14} />
                    </button>

                    {showUserDropdown && (
                        <>
                            <div
                                className="dropdown-backdrop"
                                style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                                onClick={() => setShowUserDropdown(false)}
                            />
                            <div className="user-dropdown" style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: '8px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                width: '220px',
                                zIndex: 200,
                                boxShadow: 'var(--shadow-lg)',
                                padding: '4px 0'
                            }}>
                                <div
                                    className="user-dropdown-item"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'default'
                                    }}
                                >
                                    <User size={16} />
                                    <div>
                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '13px' }}>
                                            {user?.full_name || user?.username}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            {user?.email}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className="user-dropdown-item"
                                    onClick={() => { navigate('/change-password'); setShowUserDropdown(false) }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 16px',
                                        fontSize: '13px',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Settings size={16} />
                                    <span>Şifre Değiştir</span>
                                </div>
                                <div
                                    className="user-dropdown-item danger"
                                    onClick={logout}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 16px',
                                        fontSize: '13px',
                                        color: 'var(--danger)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <LogOut size={16} />
                                    <span>Çıkış Yap</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
