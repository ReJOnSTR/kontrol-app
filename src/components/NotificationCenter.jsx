import { useState, useEffect, useRef } from 'react'
import { Bell, AlertTriangle, Calendar, FileText, Wallet, CheckCircle2, ChevronRight, X, Shield, Wrench, User, ClipboardCheck } from 'lucide-react'
import { useCompany } from '../context/CompanyContext'
import { getDaysUntil, formatDate, formatCurrency } from '../utils/helpers'
import { useNavigate } from 'react-router-dom'

export default function NotificationCenter() {
    const { upcomingEvents } = useCompany()
    const [isOpen, setIsOpen] = useState(false)
    const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'overdue' | 'urgent' | 'upcoming'
    const dropdownRef = useRef(null)
    const navigate = useNavigate()

    // Filter events based on user preferences from localStorage
    const filteredEvents = (upcomingEvents || []).filter(e => {
        const isEnabled = localStorage.getItem(`notify_${e.eventType}`) !== 'false'
        return isEnabled
    })

    // E-postadaki mantıkla 30 günlük zaman ve durum gruplaması
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

    // Tüm 30 günlük bildirimler (Tarihe göre sıralı)
    const allNotifications = [...overdue, ...today, ...urgent, ...upcoming30].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
    )

    // Acil ilgilenilmesi gerekenler: Gecikmiş + Bugün + 1-3 Gün
    const criticalCount = overdue.length + today.length + urgent.length
    const totalCount = allNotifications.length

    // Aktif filtreye göre gösterilecek liste
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
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const getIcon = (type) => {
        switch (type) {
            case 'inspection': return <ClipboardCheck size={16} className="text-primary" />
            case 'insurance': return <Shield size={16} className="text-success" />
            case 'maintenance': return <Wrench size={16} className="text-warning" />
            case 'employee_document': return <User size={16} className="text-info" />
            case 'finance_check': return <Wallet size={16} className="text-danger" />
            case 'approval_center': return <CheckCircle2 size={16} className="text-primary" />
            default: return <Bell size={16} />
        }
    }

    const handleItemClick = (event) => {
        setIsOpen(false)
        if (event.eventType === 'approval_center') {
            navigate('/personnel/approvals')
        } else if (event.vehicleId) {
            navigate(`/vehicles/${event.vehicleId}`)
        } else if (event.employeeId) {
            navigate(`/employees/${event.employeeId}`)
        } else if (event.eventType === 'finance_check') {
            navigate('/finance')
        }
    }

    return (
        <div className="notification-center" ref={dropdownRef} style={{ position: 'relative' }}>
            <button 
                className={`notification-bell ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    color: isOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                }}
                title={criticalCount > 0 ? `${criticalCount} acil işlem bekliyor` : 'Bildirimler'}
            >
                <Bell size={20} />
                {criticalCount > 0 ? (
                    <span style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'var(--danger)',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        minWidth: '16px',
                        height: '16px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                        border: '2px solid var(--bg-primary)'
                    }}>
                        {criticalCount}
                    </span>
                ) : totalCount > 0 ? (
                    <span style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: '#14b8a6',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        border: '2px solid var(--bg-primary)'
                    }} />
                ) : null}
            </button>

            {isOpen && (
                <div className="notification-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '10px',
                    width: '370px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                    border: '1px solid var(--border-color)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    animation: 'slideIn 0.2s ease-out'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--bg-tertiary)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                                Bildirimler & Uyarılar
                            </h3>
                            <span style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: criticalCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(20, 184, 166, 0.15)',
                                color: criticalCount > 0 ? 'var(--danger)' : '#14b8a6',
                                fontWeight: '700'
                            }}>
                                {totalCount} Kayıt (30 Gün)
                            </span>
                        </div>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                            <X size={16} />
                        </button>
                    </div>

                    {/* Quick Filters (E-postadaki 30 günlük grup mantığı) */}
                    <div style={{
                        display: 'flex',
                        gap: '6px',
                        padding: '8px 12px',
                        background: 'var(--bg-primary)',
                        borderBottom: '1px solid var(--border-color)',
                        overflowX: 'auto'
                    }}>
                        <button
                            onClick={() => setActiveFilter('all')}
                            style={{
                                border: 'none',
                                background: activeFilter === 'all' ? 'var(--bg-tertiary)' : 'transparent',
                                color: activeFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: activeFilter === 'all' ? '600' : '500',
                                fontSize: '11px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s'
                            }}
                        >
                            Tümü ({totalCount})
                        </button>

                        {overdue.length > 0 && (
                            <button
                                onClick={() => setActiveFilter('overdue')}
                                style={{
                                    border: 'none',
                                    background: activeFilter === 'overdue' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                                    color: 'var(--danger)',
                                    fontWeight: activeFilter === 'overdue' ? '700' : '600',
                                    fontSize: '11px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                🔴 Geciken ({overdue.length})
                            </button>
                        )}

                        {(today.length + urgent.length) > 0 && (
                            <button
                                onClick={() => setActiveFilter('urgent')}
                                style={{
                                    border: 'none',
                                    background: activeFilter === 'urgent' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                                    color: 'var(--warning)',
                                    fontWeight: activeFilter === 'urgent' ? '700' : '600',
                                    fontSize: '11px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                🟡 3 Gün ({today.length + urgent.length})
                            </button>
                        )}

                        {upcoming30.length > 0 && (
                            <button
                                onClick={() => setActiveFilter('upcoming')}
                                style={{
                                    border: 'none',
                                    background: activeFilter === 'upcoming' ? 'rgba(20, 184, 166, 0.15)' : 'transparent',
                                    color: '#14b8a6',
                                    fontWeight: activeFilter === 'upcoming' ? '700' : '600',
                                    fontSize: '11px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                🟢 30 Gün ({upcoming30.length})
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                        {displayedEvents.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <CheckCircle2 size={32} style={{ marginBottom: '10px', opacity: 0.5, color: '#10b981' }} />
                                <p style={{ fontSize: '13px', margin: 0, color: 'var(--text-secondary)' }}>
                                    {activeFilter === 'overdue' ? 'Harika! Gecikmiş işlem bulunmuyor.' :
                                     activeFilter === 'urgent' ? 'Önümüzdeki 3 gün içinde kritik işlem yok.' :
                                     'Önümüzdeki 30 gün içinde bekleyen bir işlem bulunmuyor.'}
                                </p>
                            </div>
                        ) : (
                            <div>
                                {displayedEvents.map((e, idx) => (
                                    <NotificationItem key={`notif-${e.id || idx}-${e.eventType}`} event={e} onClick={() => handleItemClick(e)} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {allNotifications.length > 0 && (
                        <div 
                            onClick={() => { navigate('/'); setIsOpen(false); }}
                            style={{
                                padding: '11px',
                                textAlign: 'center',
                                fontSize: '12px',
                                color: 'var(--accent-primary)',
                                cursor: 'pointer',
                                borderTop: '1px solid var(--border-color)',
                                background: 'var(--bg-tertiary)',
                                fontWeight: '600',
                                transition: 'background 0.15s'
                            }}
                        >
                            Tümünü Dashboard Takviminde Gör →
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function NotificationItem({ event, onClick }) {
    const days = getDaysUntil(event.date)
    
    // E-postadaki rozet sistemiyle birebir aynı durum rozetleri
    let badgeBg = 'rgba(20, 184, 166, 0.12)'
    let badgeColor = '#14b8a6'
    let badgeBorder = 'rgba(20, 184, 166, 0.25)'
    let badgeText = `${days} Gün Kaldı`

    if (days < 0) {
        badgeBg = 'rgba(239, 68, 68, 0.15)'
        badgeColor = '#ef4444'
        badgeBorder = 'rgba(239, 68, 68, 0.3)'
        badgeText = '🔴 GECİKTİ'
    } else if (days === 0) {
        badgeBg = 'rgba(249, 115, 22, 0.15)'
        badgeColor = '#f97316'
        badgeBorder = 'rgba(249, 115, 22, 0.3)'
        badgeText = '🟠 BUGÜN'
    } else if (days <= 3) {
        badgeBg = 'rgba(234, 179, 8, 0.15)'
        badgeColor = '#eab308'
        badgeBorder = 'rgba(234, 179, 8, 0.3)'
        badgeText = `⚠️ ${days} Gün Kaldı`
    }

    const isOverdue = days < 0

    return (
        <div 
            onClick={onClick}
            style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
                display: 'flex',
                gap: '12px',
                transition: 'background 0.15s',
                alignItems: 'flex-start',
                background: isOverdue ? 'rgba(239, 68, 68, 0.03)' : 'transparent'
            }}
            className="notification-item-hover"
        >
            <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: isOverdue ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: `1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.25)' : 'var(--border-color)'}`
            }}>
                {event.eventType === 'inspection' && <ClipboardCheck size={16} className="text-primary" />}
                {event.eventType === 'insurance' && <Shield size={16} className="text-success" />}
                {event.eventType === 'maintenance' && <Wrench size={16} className="text-warning" />}
                {event.eventType === 'employee_document' && <User size={16} className="text-info" />}
                {event.eventType === 'finance_check' && <Wallet size={16} className="text-danger" />}
                {event.eventType === 'approval_center' && <CheckCircle2 size={16} className="text-primary" />}
                {!['inspection','insurance','maintenance','employee_document','finance_check','approval_center'].includes(event.eventType) && <Bell size={16} />}
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {event.plate || event.employeeName || (event.eventType === 'finance_check' ? 'Çek/Senet Vadesi' : 'Operasyonel İşlem')}
                    </span>
                    <span style={{
                        fontSize: '10px',
                        padding: '2px 7px',
                        borderRadius: '5px',
                        background: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${badgeBorder}`,
                        fontWeight: '700',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                    }}>
                        {badgeText}
                    </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {event.type}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📅 {formatDate(event.date)}</span>
                    {event.amount && <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(event.amount)}</span>}
                </div>
            </div>
            <ChevronRight size={14} style={{ marginTop: '10px', color: 'var(--text-muted)', flexShrink: 0 }} />
        </div>
    )
}
