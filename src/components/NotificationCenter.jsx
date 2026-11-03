import { useState, useEffect, useRef } from 'react'
import {
    Bell,
    BellOff,
    CheckCircle2,
    X,
    Shield,
    Wrench,
    User,
    ClipboardCheck,
    Wallet,
    Sliders,
    ExternalLink
} from 'lucide-react'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'
import { getDaysUntil, formatDate, formatCurrency } from '../utils/helpers'
import { useNavigate } from 'react-router-dom'
import NotificationSettingsModal from './NotificationSettingsModal'
import './Skeleton.css'

export default function NotificationCenter() {
    const { upcomingEvents, loading } = useCompany()
    const { user, isAdmin, hasPermission, userPreferences } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'overdue' | 'urgent' | 'upcoming'
    const [userSettings, setUserSettings] = useState(() => {
        return {
            inAppEnabled: localStorage.getItem('user_in_app_enabled') !== 'false'
        }
    })
    const [categoryFilters, setCategoryFilters] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(`notif_cat_filters_${user?.id || 'anon'}`) || '{}')
        } catch (_) {
            return {}
        }
    })
    const dropdownRef = useRef(null)
    const navigate = useNavigate()

    useEffect(() => {
        const handleSettingsChanged = (e) => {
            if (e.detail) {
                if (e.detail.inAppEnabled !== undefined) {
                    setUserSettings(prev => ({ ...prev, inAppEnabled: e.detail.inAppEnabled }))
                }
                if (e.detail.categories) {
                    setCategoryFilters(e.detail.categories)
                } else {
                    try {
                        setCategoryFilters(JSON.parse(localStorage.getItem(`notif_cat_filters_${user?.id || 'anon'}`) || '{}'))
                    } catch (_) {}
                }
            }
        }
        window.addEventListener('user_notification_settings_changed', handleSettingsChanged)
        return () => window.removeEventListener('user_notification_settings_changed', handleSettingsChanged)
    }, [user?.id])

    useEffect(() => {
        const handleDismissedChanged = (e) => {
            if (Array.isArray(e.detail)) {
                setDismissedIds(e.detail)
            } else {
                try {
                    setDismissedIds(JSON.parse(localStorage.getItem(`dismissed_notifs_${user?.id || 'anon'}`) || '[]'))
                } catch (_) {}
            }
        }
        window.addEventListener('notifications_dismissed_changed', handleDismissedChanged)
        return () => window.removeEventListener('notifications_dismissed_changed', handleDismissedChanged)
    }, [user?.id])

    const isMasterInAppEnabled = userSettings?.inAppEnabled !== false && localStorage.getItem('user_in_app_enabled') !== 'false'

    // RBAC: Check whether this specific event is permitted for the current user
    const isEventPermitted = (e) => {
        if (!user) return false
        if (isAdmin || user?.role === 'superadmin') return true

        // A. Finance / Checks: Only users with finance permission
        if (e.eventType === 'finance_check') {
            return hasPermission('finance', 'can_read')
        }

        // B. Employee Documents:
        if (e.eventType === 'employee_document') {
            if (hasPermission('employees', 'can_read')) return true
            if (user?.employee_id && e.employeeId === user.employee_id) return true
            return false
        }

        // C. Vehicle Events:
        if (['inspection', 'insurance', 'maintenance'].includes(e.eventType)) {
            if (hasPermission('vehicles', 'can_read')) return true
            return false
        }

        // D. Approval Center Requests:
        if (e.eventType === 'approval_center') {
            return hasPermission('approval_center', 'can_approve') || hasPermission('employees', 'can_read')
        }

        return false
    }

    const [dismissedIds, setDismissedIds] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(`dismissed_notifs_${user?.id || 'anon'}`) || '[]')
        } catch (e) { return [] }
    })

    const dismissNotification = (e, notifKey) => {
        if (e && e.stopPropagation) e.stopPropagation()
        setDismissedIds(prev => {
            const next = Array.from(new Set([...prev, notifKey]))
            localStorage.setItem(`dismissed_notifs_${user?.id || 'anon'}`, JSON.stringify(next))
            if (user?.id && window.electronAPI?.saveUserPreferences) {
                window.electronAPI.saveUserPreferences({
                    userId: user.id,
                    preferences: { dismissedEvents: next }
                }).catch(() => {})
            }
            window.dispatchEvent(new CustomEvent('notifications_dismissed_changed', { detail: next }))
            return next
        })
    }

    const clearAllDismissed = () => {
        setDismissedIds([])
        localStorage.removeItem(`dismissed_notifs_${user?.id || 'anon'}`)
        if (user?.id && window.electronAPI?.saveUserPreferences) {
            window.electronAPI.saveUserPreferences({
                userId: user.id,
                preferences: { dismissedEvents: [] }
            }).catch(() => {})
        }
        window.dispatchEvent(new CustomEvent('notifications_dismissed_changed', { detail: [] }))
    }

    // Filter events based on User RBAC permissions first, then user in-app preferences & dismissed
    const permittedEvents = (upcomingEvents || [])
        .filter(isEventPermitted)
        .filter(e => !dismissedIds.includes(`${e.eventType}_${e.id}`))

    const filteredEvents = !isMasterInAppEnabled ? [] : permittedEvents.filter(e => {
        if (categoryFilters[e.eventType] === false) {
            return false
        }
        if (userPreferences?.notifications && userPreferences.notifications[e.eventType] !== undefined) {
            return userPreferences.notifications[e.eventType] === true
        }
        if (userSettings?.items && userSettings.items[e.eventType]) {
            return userSettings.items[e.eventType].inApp !== false
        }
        return localStorage.getItem(`notify_${e.eventType}`) !== 'false'
    })

    // Grouping
    const overdue = filteredEvents.filter(e => getDaysUntil(e.date) < 0)
    const today = filteredEvents.filter(e => getDaysUntil(e.date) === 0)
    const urgent = filteredEvents.filter(e => {
        const days = getDaysUntil(e.date)
        return days >= 1 && days <= 3
    })
    const upcoming30 = filteredEvents.filter(e => {
        const days = getDaysUntil(e.date)
        return days >= 4 && days <= 30
    })

    const allNotifications = [...overdue, ...today, ...urgent, ...upcoming30].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
    )

    const criticalCount = overdue.length + today.length + urgent.length
    const totalCount = allNotifications.length

    const getDisplayedEvents = () => {
        switch (activeFilter) {
            case 'overdue':
                return overdue
            case 'urgent':
                return [...today, ...urgent]
            case 'upcoming':
                return upcoming30
            default:
                return allNotifications
        }
    }

    const displayedEvents = getDisplayedEvents()

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('touchstart', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [])

    const handleItemClick = (event) => {
        setIsOpen(false)
        if (event.eventType === 'approval_center') {
            if (isAdmin || hasPermission('approval_center', 'can_approve')) {
                navigate('/approval-center')
            } else {
                navigate('/personnel/approvals')
            }
        } else if (event.vehicleId) {
            if (isAdmin || hasPermission('vehicles', 'can_read')) {
                navigate(`/vehicles/${event.vehicleId}`)
            }
        } else if (event.employeeId) {
            if (isAdmin || hasPermission('employees', 'can_read')) {
                navigate(`/employees/${event.employeeId}`)
            } else if (user?.employee_id === event.employeeId) {
                navigate('/personnel-profile')
            }
        } else if (event.eventType === 'finance_check') {
            if (isAdmin || hasPermission('finance', 'can_read')) {
                navigate('/finance')
            }
        }
    }

    return (
        <div className="notification-center" ref={dropdownRef}>
            <button
                type="button"
                className={`notification-bell ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title={criticalCount > 0 ? `${criticalCount} acil işlem bekliyor` : 'Bildirimler'}
                aria-label="Bildirimler"
            >
                <Bell size={17} />
                {criticalCount > 0 ? (
                    <span className="notification-badge">{criticalCount}</span>
                ) : totalCount > 0 ? (
                    <span className="notification-dot" />
                ) : null}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    {/* Header */}
                    <div className="notif-header">
                        <div className="notif-header-title">
                            <span>Bildirimler</span>
                        </div>
                        <div className="notif-header-actions">
                            <button
                                type="button"
                                className="notif-icon-btn"
                                onClick={() => { setIsOpen(false); navigate('/notifications'); }}
                                title="Detaylı Bildirimler Sayfası"
                            >
                                <ExternalLink size={14} />
                            </button>
                            <button
                                type="button"
                                className="notif-icon-btn"
                                onClick={() => { setIsOpen(false); setShowSettingsModal(true); }}
                                title="Bildirim Ayarları & Tercihleri"
                            >
                                <Sliders size={14} />
                            </button>
                            <button
                                type="button"
                                className="notif-icon-btn"
                                onClick={() => setIsOpen(false)}
                                title="Kapat"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {!isMasterInAppEnabled ? (
                        <div className="notif-empty">
                            <BellOff size={26} className="notif-empty-icon" />
                            <div className="notif-empty-title">Bildirimler Kapalı</div>
                            <p className="notif-empty-desc">
                                Profilinizden uygulama içi bildirimleri kapattınız.
                            </p>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: '11.5px', padding: '5px 12px', marginTop: '12px' }}
                                onClick={() => { setIsOpen(false); setShowSettingsModal(true); }}
                            >
                                Tercihleri Aç
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Segmented Filter Bar */}
                            {totalCount > 0 && (
                                <div className="notif-filter-bar">
                                    <button
                                        type="button"
                                        className={`notif-filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                                        onClick={() => setActiveFilter('all')}
                                    >
                                        Tümü
                                    </button>

                                    {overdue.length > 0 && (
                                        <button
                                            type="button"
                                            className={`notif-filter-btn ${activeFilter === 'overdue' ? 'active' : ''}`}
                                            onClick={() => setActiveFilter('overdue')}
                                        >
                                            <span className="notif-filter-dot danger" />
                                            Geciken
                                        </button>
                                    )}

                                    {(today.length + urgent.length) > 0 && (
                                        <button
                                            type="button"
                                            className={`notif-filter-btn ${activeFilter === 'urgent' ? 'active' : ''}`}
                                            onClick={() => setActiveFilter('urgent')}
                                        >
                                            <span className="notif-filter-dot warning" />
                                            Acil
                                        </button>
                                    )}

                                    {upcoming30.length > 0 && (
                                        <button
                                            type="button"
                                            className={`notif-filter-btn ${activeFilter === 'upcoming' ? 'active' : ''}`}
                                            onClick={() => setActiveFilter('upcoming')}
                                        >
                                            Yaklaşan
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Notification List */}
                            <div className="notif-list">
                                {loading && (!upcomingEvents || upcomingEvents.length === 0) ? (
                                    <div style={{ padding: '4px 0' }}>
                                        {[1, 2, 3].map((s) => (
                                            <div
                                                key={`drop-skel-${s}`}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    padding: '10px 14px',
                                                    borderBottom: s < 3 ? '1px solid var(--border-color)' : 'none'
                                                }}
                                            >
                                                <div
                                                    className="skeleton-pulse"
                                                    style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', flexShrink: 0 }}
                                                />
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                                                    <div className="skeleton-pulse" style={{ width: `${75 + s * 25}px`, height: '13px', borderRadius: '4px', background: 'var(--bg-tertiary)' }} />
                                                    <div className="skeleton-pulse" style={{ width: '115px', height: '11px', borderRadius: '4px', background: 'var(--bg-tertiary)' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : displayedEvents.length === 0 ? (
                                    <div className="notif-empty">
                                        <CheckCircle2 size={26} className="notif-empty-icon" />
                                        <div className="notif-empty-title">
                                            {activeFilter === 'overdue' ? 'Gecikmiş işlem yok' :
                                             activeFilter === 'urgent' ? 'Acil işlem yok' :
                                             'Bekleyen bildirim yok'}
                                        </div>
                                        <p className="notif-empty-desc">
                                            {activeFilter === 'all' ? 'Önümüzdeki 30 gün içinde tüm kayıtlar güncel.' : 'Bu filtreye uygun kayıt bulunmuyor.'}
                                        </p>
                                    </div>
                                ) : (
                                    displayedEvents.map((e, idx) => (
                                        <NotificationRow
                                            key={`notif-${e.id || idx}-${e.eventType}`}
                                            event={e}
                                            onClick={() => handleItemClick(e)}
                                            onDismiss={dismissNotification}
                                        />
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {/* Footer */}
                    <div className="notif-footer">
                        <div>
                            {dismissedIds.length > 0 ? (
                                <button
                                    type="button"
                                    className="notif-footer-link"
                                    onClick={clearAllDismissed}
                                >
                                    Gizlenenleri Göster ({dismissedIds.length})
                                </button>
                            ) : (
                                <span style={{ color: 'var(--text-muted)' }}>30 günlük operasyonlar</span>
                            )}
                        </div>

                        {user?.role !== 'personnel' && (
                            <button
                                type="button"
                                className="notif-footer-action"
                                onClick={() => { setIsOpen(false); navigate('/notifications'); }}
                            >
                                Tüm Bildirimler ({totalCount}) →
                            </button>
                        )}
                    </div>
                </div>
            )}

            <NotificationSettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />
        </div>
    )
}

function NotificationRow({ event, onClick, onDismiss }) {
    const days = getDaysUntil(event.date)
    const isOverdue = days < 0

    let statusClass = 'upcoming'
    let statusText = `${days} gün`

    if (days < 0) {
        statusClass = 'overdue'
        statusText = 'Gecikti'
    } else if (days === 0) {
        statusClass = 'today'
        statusText = 'Bugün'
    } else if (days <= 3) {
        statusClass = 'urgent'
        statusText = `${days} gün kaldı`
    }

    const renderIcon = () => {
        const iconSize = 15
        switch (event.eventType) {
            case 'inspection':
                return <ClipboardCheck size={iconSize} style={{ color: '#0ea5e9' }} />
            case 'insurance':
                return <Shield size={iconSize} style={{ color: '#22c55e' }} />
            case 'maintenance':
                return <Wrench size={iconSize} style={{ color: '#f59e0b' }} />
            case 'employee_document':
                return <User size={iconSize} style={{ color: '#14b8a6' }} />
            case 'finance_check':
                return <Wallet size={iconSize} style={{ color: '#ef4444' }} />
            case 'approval_center':
                return <CheckCircle2 size={iconSize} style={{ color: '#8b5cf6' }} />
            default:
                return <Bell size={iconSize} style={{ color: 'var(--text-secondary)' }} />
        }
    }

    const title = event.plate || event.employeeName || (event.eventType === 'finance_check' ? 'Çek/Senet Vadesi' : 'Operasyonel İşlem')

    return (
        <div
            className={`notif-item ${isOverdue ? 'overdue' : ''}`}
            onClick={onClick}
        >
            <div className="notif-item-icon">
                {renderIcon()}
            </div>

            <div className="notif-item-content">
                <div className="notif-item-top">
                    <span className="notif-item-title" title={title}>{title}</span>
                    <span className={`notif-status-badge ${statusClass}`}>
                        {statusText}
                    </span>
                </div>

                <div className="notif-item-sub">
                    {event.type}
                </div>

                <div className="notif-item-meta">
                    <span>{formatDate(event.date)}</span>
                    {event.amount && (
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {formatCurrency(event.amount)}
                        </span>
                    )}
                </div>
            </div>

            {onDismiss && (
                <button
                    type="button"
                    className="notif-dismiss-btn"
                    title="Gizle"
                    onClick={(e) => onDismiss(e, `${event.eventType}_${event.id}`)}
                >
                    <X size={12} />
                </button>
            )}
        </div>
    )
}
