import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Bell,
    CheckCircle2,
    AlertCircle,
    Calendar,
    Search,
    RefreshCw,
    Sliders,
    Eye,
    EyeOff,
    Shield,
    Wrench,
    User,
    ClipboardCheck,
    Wallet,
    X,
    ChevronRight,
    CheckCheck,
    Clock
} from 'lucide-react'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { dashboardService } from '../services/dashboard'
import { getDaysUntil, formatDate, formatCurrency } from '../utils/helpers'
import TopProgressBar from '../components/TopProgressBar'
import NotificationSettingsModal from '../components/NotificationSettingsModal'
import CustomSelect from '../components/CustomSelect'
import '../components/Skeleton.css'

const CATEGORY_FILTER_OPTIONS = [
    { value: 'all', label: 'Tüm Kategoriler' },
    { value: 'inspection', label: 'Araç Muayene' },
    { value: 'insurance', label: 'Sigorta & Kasko' },
    { value: 'maintenance', label: 'Periyodik Bakım' },
    { value: 'employee_document', label: 'Personel Evrak' },
    { value: 'finance_check', label: 'Çek & Senet' },
    { value: 'approval_center', label: 'Onay Talepleri' }
]

const CATEGORY_MAP = {
    inspection: { label: 'Muayene', icon: ClipboardCheck, color: '#0ea5e9' },
    insurance: { label: 'Sigorta & Kasko', icon: Shield, color: '#22c55e' },
    maintenance: { label: 'Bakım', icon: Wrench, color: '#f59e0b' },
    employee_document: { label: 'Personel Evrak', icon: User, color: '#14b8a6' },
    finance_check: { label: 'Çek / Senet', icon: Wallet, color: '#ef4444' },
    approval_center: { label: 'Onay Talebi', icon: CheckCircle2, color: '#8b5cf6' }
}

export default function Notifications() {
    const { currentCompany, upcomingEvents } = useCompany()
    const { user, isAdmin, hasPermission } = useAuth()
    const toast = useToast()
    const navigate = useNavigate()

    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState('all') // 'all' | 'overdue' | 'urgent' | 'upcoming' | 'dismissed'
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [showSettingsModal, setShowSettingsModal] = useState(false)

    // Category visibility filters synced with settings
    const [categoryFilters, setCategoryFilters] = useState(() => {
        try {
            const saved = localStorage.getItem(`notif_cat_filters_${user?.id || 'anon'}`)
            return saved ? JSON.parse(saved) : {}
        } catch (_) {
            return {}
        }
    })

    // Dismissed notification keys stored per user
    const [dismissedIds, setDismissedIds] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(`dismissed_notifs_${user?.id || 'anon'}`) || '[]')
        } catch (_) {
            return []
        }
    })

    useEffect(() => {
        const handleSettingsChanged = (e) => {
            if (e.detail?.categories) {
                setCategoryFilters(e.detail.categories)
            } else {
                try {
                    setCategoryFilters(JSON.parse(localStorage.getItem(`notif_cat_filters_${user?.id || 'anon'}`) || '{}'))
                } catch (_) {}
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

    // RBAC permission check
    const isEventPermitted = (e) => {
        if (!user) return false
        if (isAdmin || user?.role === 'superadmin') return true

        if (e.eventType === 'finance_check') {
            return hasPermission('finance', 'can_read')
        }
        if (e.eventType === 'employee_document') {
            if (hasPermission('employees', 'can_read')) return true
            if (user?.employee_id && e.employeeId === user.employee_id) return true
            return false
        }
        if (['inspection', 'insurance', 'maintenance'].includes(e.eventType)) {
            return hasPermission('vehicles', 'can_read')
        }
        if (e.eventType === 'approval_center') {
            return hasPermission('approval_center', 'can_approve') || hasPermission('employees', 'can_read')
        }
        return false
    }

    const fetchNotifications = async (showToast = false) => {
        if (!currentCompany?.id) return
        setLoading(true)
        try {
            const res = await dashboardService.getUpcomingEvents(currentCompany.id)
            if (res?.success && Array.isArray(res.data)) {
                setEvents(res.data)
            } else if (upcomingEvents?.length) {
                setEvents(upcomingEvents)
            }
            if (showToast) {
                toast?.success ? toast.success('Bildirimler güncellendi.') : null
            }
        } catch (err) {
            console.error('Failed to load notifications:', err)
            if (upcomingEvents?.length) {
                setEvents(upcomingEvents)
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (currentCompany?.id) {
            fetchNotifications()
        }
    }, [currentCompany?.id])

    useEffect(() => {
        if (upcomingEvents && upcomingEvents.length > 0 && events.length === 0) {
            setEvents(upcomingEvents)
        }
    }, [upcomingEvents])

    const handleDismiss = (notifKey, e) => {
        if (e) e.stopPropagation()
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

    const handleRestore = (notifKey, e) => {
        if (e) e.stopPropagation()
        setDismissedIds(prev => {
            const next = prev.filter(k => k !== notifKey)
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
        toast?.success ? toast.success('Bildirim geri yüklendi.') : null
    }

    const handleDismissAll = () => {
        const visibleKeys = displayedEvents.map(item => `${item.eventType}_${item.id}`)
        setDismissedIds(prev => {
            const next = Array.from(new Set([...prev, ...visibleKeys]))
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
        toast?.success ? toast.success('Bildirimler gizlendi.') : null
    }

    const handleRestoreAll = () => {
        setDismissedIds([])
        localStorage.removeItem(`dismissed_notifs_${user?.id || 'anon'}`)
        if (user?.id && window.electronAPI?.saveUserPreferences) {
            window.electronAPI.saveUserPreferences({
                userId: user.id,
                preferences: { dismissedEvents: [] }
            }).catch(() => {})
        }
        window.dispatchEvent(new CustomEvent('notifications_dismissed_changed', { detail: [] }))
        toast?.success ? toast.success('Tüm gizlenen bildirimler geri yüklendi.') : null
    }

    const handleNavigate = (event) => {
        if (event.eventType === 'approval_center') {
            if (isAdmin || hasPermission('approval_center', 'can_approve')) {
                navigate('/approvals')
            } else {
                navigate('/personnel/approvals')
            }
        } else if (event.vehicleId) {
            navigate(`/vehicles/${event.vehicleId}`)
        } else if (event.employeeId) {
            if (isAdmin || hasPermission('employees', 'can_read')) {
                navigate(`/employees/${event.employeeId}`)
            } else if (user?.employee_id === event.employeeId) {
                navigate('/personnel-profile')
            }
        } else if (event.eventType === 'finance_check') {
            navigate('/checks')
        }
    }

    // Permitted pool filtered by category preferences
    const permittedEvents = useMemo(() => {
        return (events || [])
            .filter(isEventPermitted)
            .filter(e => categoryFilters[e.eventType] !== false)
    }, [events, user, isAdmin, categoryFilters])

    // Counts
    const counts = useMemo(() => {
        let total = 0
        let overdue = 0
        let urgent = 0
        let upcoming = 0
        let dismissed = 0

        permittedEvents.forEach(e => {
            const key = `${e.eventType}_${e.id}`
            const isDismissed = dismissedIds.includes(key)
            if (isDismissed) {
                dismissed++
                return
            }

            total++
            const days = getDaysUntil(e.date)
            if (days < 0) overdue++
            else if (days <= 3) urgent++
            else upcoming++
        })

        return { total, overdue, urgent, upcoming, dismissed }
    }, [permittedEvents, dismissedIds])

    // Filtered items
    const displayedEvents = useMemo(() => {
        let list = [...permittedEvents]

        // Status tab
        list = list.filter(e => {
            const key = `${e.eventType}_${e.id}`
            const isDismissed = dismissedIds.includes(key)

            if (activeTab === 'dismissed') return isDismissed
            if (isDismissed) return false

            const days = getDaysUntil(e.date)
            if (activeTab === 'overdue') return days < 0
            if (activeTab === 'urgent') return days >= 0 && days <= 3
            if (activeTab === 'upcoming') return days >= 4
            return true
        })

        // Category filter
        if (selectedCategory !== 'all') {
            list = list.filter(e => e.eventType === selectedCategory)
        }

        // Search term
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase().trim()
            list = list.filter(e => {
                const text = `${e.plate || ''} ${e.employeeName || ''} ${e.type || ''} ${e.description || ''} ${e.brand || ''} ${e.model || ''}`.toLowerCase()
                return text.includes(q)
            })
        }

        // Always sort by date ascending (closest or overdue first)
        list.sort((a, b) => new Date(a.date) - new Date(b.date))

        return list
    }, [permittedEvents, dismissedIds, activeTab, selectedCategory, searchTerm])

    return (
        <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
            <TopProgressBar />

            {/* Clean, Minimal Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                padding: '24px 0 16px 0',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '16px',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Bell size={18} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                Bildirimler
                            </h1>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '100px',
                                background: counts.overdue > 0 ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-tertiary)',
                                color: counts.overdue > 0 ? '#ef4444' : 'var(--text-secondary)'
                            }}>
                                {counts.total} bekleyen {counts.overdue > 0 ? `(${counts.overdue} gecikmiş)` : ''}
                            </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Muayene, sigorta, bakım, evrak ve çek vadeleri
                        </div>
                    </div>
                </div>

                {/* Right Header Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {displayedEvents.length > 0 && activeTab !== 'dismissed' && (
                        <button
                            type="button"
                            onClick={handleDismissAll}
                            className="btn btn-secondary"
                            style={{ height: '32px', fontSize: '12px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                            title="Listelenen bildirimleri gizle"
                        >
                            <CheckCheck size={14} />
                            <span>Tümünü Gizle</span>
                        </button>
                    )}

                    {counts.dismissed > 0 && activeTab === 'dismissed' && (
                        <button
                            type="button"
                            onClick={handleRestoreAll}
                            className="btn btn-secondary"
                            style={{ height: '32px', fontSize: '12px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                            <Eye size={14} />
                            <span>Tümünü Geri Al</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => fetchNotifications(true)}
                        disabled={loading}
                        className="btn btn-secondary"
                        style={{ height: '32px', width: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Yenile"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowSettingsModal(true)}
                        className="btn btn-secondary"
                        style={{ height: '32px', width: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Bildirim Ayarları & Tercihleri"
                    >
                        <Sliders size={13} />
                    </button>
                </div>
            </div>

            {/* Clean Tabs & Search Row */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                marginBottom: '16px'
            }}>
                {/* Status Tabs */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--bg-secondary)',
                    padding: '3px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className="btn"
                        style={{
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: activeTab === 'all' ? 600 : 500,
                            borderRadius: '6px',
                            border: 'none',
                            background: activeTab === 'all' ? 'var(--bg-tertiary)' : 'transparent',
                            color: activeTab === 'all' ? 'var(--text-primary)' : 'var(--text-muted)'
                        }}
                    >
                        Tümü ({counts.total})
                    </button>

                    {counts.overdue > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('overdue')}
                            className="btn"
                            style={{
                                padding: '5px 12px',
                                fontSize: '12px',
                                fontWeight: activeTab === 'overdue' ? 600 : 500,
                                borderRadius: '6px',
                                border: 'none',
                                background: activeTab === 'overdue' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                                color: activeTab === 'overdue' ? '#ef4444' : '#ef4444'
                            }}
                        >
                            Geciken ({counts.overdue})
                        </button>
                    )}

                    {counts.urgent > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('urgent')}
                            className="btn"
                            style={{
                                padding: '5px 12px',
                                fontSize: '12px',
                                fontWeight: activeTab === 'urgent' ? 600 : 500,
                                borderRadius: '6px',
                                border: 'none',
                                background: activeTab === 'urgent' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                                color: activeTab === 'urgent' ? '#f59e0b' : 'var(--text-muted)'
                            }}
                        >
                            Acil ({counts.urgent})
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setActiveTab('upcoming')}
                        className="btn"
                        style={{
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: activeTab === 'upcoming' ? 600 : 500,
                            borderRadius: '6px',
                            border: 'none',
                            background: activeTab === 'upcoming' ? 'var(--bg-tertiary)' : 'transparent',
                            color: activeTab === 'upcoming' ? 'var(--text-primary)' : 'var(--text-muted)'
                        }}
                    >
                        Yaklaşan ({counts.upcoming})
                    </button>

                    {counts.dismissed > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('dismissed')}
                            className="btn"
                            style={{
                                padding: '5px 10px',
                                fontSize: '12px',
                                fontWeight: activeTab === 'dismissed' ? 600 : 500,
                                borderRadius: '6px',
                                border: 'none',
                                background: activeTab === 'dismissed' ? 'var(--bg-tertiary)' : 'transparent',
                                color: activeTab === 'dismissed' ? 'var(--text-primary)' : 'var(--text-muted)'
                            }}
                        >
                            Gizlenenler ({counts.dismissed})
                        </button>
                    )}
                </div>

                {/* Search & Category Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 320px' }}>
                    {/* Category Filter using CustomSelect */}
                    <div className="filter-group" style={{ margin: 0 }}>
                        <CustomSelect
                            value={selectedCategory}
                            onChange={(val) => setSelectedCategory(val || 'all')}
                            options={CATEGORY_FILTER_OPTIONS}
                            placeholder="Kategori Seçin"
                            className="filter-select-custom"
                            floatingLabel={false}
                            hidePlaceholderOption
                            style={{ minWidth: '150px', margin: 0 }}
                        />
                    </div>

                    {/* Standard Search Box */}
                    <div className="search-box" style={{ minWidth: '180px', flex: '1 1 200px', height: '32px' }}>
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Plaka, personel, tür veya açıklama ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                className="search-clear"
                                onClick={() => setSearchTerm('')}
                                title="Aramayı Temizle"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Notifications Feed Container */}
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                overflow: 'hidden'
            }}>
                {loading ? (
                    <div>
                        {[1, 2, 3, 4, 5].map((idx) => (
                            <div
                                key={`notif-skeleton-${idx}`}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '14px',
                                    padding: '14px 16px',
                                    borderBottom: idx < 5 ? '1px solid var(--border-color)' : 'none'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                    <div
                                        className="skeleton-pulse"
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            background: 'var(--bg-tertiary)',
                                            flexShrink: 0
                                        }}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div
                                                className="skeleton-pulse"
                                                style={{
                                                    width: `${85 + (idx % 3) * 35}px`,
                                                    height: '14px',
                                                    borderRadius: '4px',
                                                    background: 'var(--bg-tertiary)'
                                                }}
                                            />
                                            <div
                                                className="skeleton-pulse"
                                                style={{
                                                    width: `${60 + (idx % 2) * 25}px`,
                                                    height: '14px',
                                                    borderRadius: '4px',
                                                    background: 'var(--bg-tertiary)'
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div
                                                className="skeleton-pulse"
                                                style={{
                                                    width: `${140 + (idx % 4) * 30}px`,
                                                    height: '12px',
                                                    borderRadius: '4px',
                                                    background: 'var(--bg-tertiary)'
                                                }}
                                            />
                                            <div
                                                className="skeleton-pulse"
                                                style={{
                                                    width: '75px',
                                                    height: '12px',
                                                    borderRadius: '4px',
                                                    background: 'var(--bg-tertiary)'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                    <div
                                        className="skeleton-pulse"
                                        style={{
                                            width: '72px',
                                            height: '22px',
                                            borderRadius: '6px',
                                            background: 'var(--bg-tertiary)'
                                        }}
                                    />
                                    <div
                                        className="skeleton-pulse"
                                        style={{
                                            width: '44px',
                                            height: '28px',
                                            borderRadius: '6px',
                                            background: 'var(--bg-tertiary)'
                                        }}
                                    />
                                    <div
                                        className="skeleton-pulse"
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '4px',
                                            background: 'var(--bg-tertiary)'
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : displayedEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                        <CheckCircle2 size={32} style={{ color: 'var(--success)', margin: '0 auto 10px auto', display: 'block', opacity: 0.8 }} />
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                            {searchTerm ? 'Eşleşen bildirim bulunamadı' : activeTab === 'overdue' ? 'Gecikmiş işlem yok' : 'Tüm bildirimler güncel'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {searchTerm ? 'Farklı bir arama yapabilir veya filtreleri temizleyebilirsiniz.' : 'Önümüzdeki dönem için bekleyen kritik bir işlem bulunmuyor.'}
                        </div>
                    </div>
                ) : (
                    <div>
                        {displayedEvents.map((item, index) => {
                            const key = `${item.eventType}_${item.id}`
                            const isDismissed = dismissedIds.includes(key)
                            const days = getDaysUntil(item.date)
                            const isOverdue = days < 0
                            const isToday = days === 0
                            const isUrgent = days >= 1 && days <= 3

                            const cat = CATEGORY_MAP[item.eventType] || { label: 'Bildirim', icon: Bell, color: '#3b82f6' }
                            const Icon = cat.icon

                            const title = item.plate || item.employeeName || (item.eventType === 'finance_check' ? 'Çek/Senet Vadesi' : 'İşlem')
                            const subtitle = item.plate
                                ? [item.brand, item.model].filter(Boolean).join(' ')
                                : (item.description || '')

                            return (
                                <div
                                    key={key}
                                    onClick={() => handleNavigate(item)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '14px',
                                        padding: '12px 16px',
                                        borderBottom: index < displayedEvents.length - 1 ? '1px solid var(--border-color)' : 'none',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s ease',
                                        background: isOverdue ? 'rgba(239, 68, 68, 0.03)' : 'transparent'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = isOverdue ? 'rgba(239, 68, 68, 0.03)' : 'transparent' }}
                                >
                                    {/* Left: Icon & Main Details */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            background: `${cat.color}15`,
                                            color: cat.color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <Icon size={15} />
                                        </div>

                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {title}
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>•</span>
                                                <span style={{ fontSize: '12.5px', color: 'var(--accent-primary)', fontWeight: 500 }}>
                                                    {item.type}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                {subtitle && (
                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                                                        {subtitle}
                                                    </span>
                                                )}
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={11} />
                                                    {formatDate(item.date)}
                                                </span>
                                                {item.amount && (
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {formatCurrency(item.amount)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Badge & Actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                        {/* Status Badge */}
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            whiteSpace: 'nowrap',
                                            background: isOverdue ? 'rgba(239, 68, 68, 0.15)' :
                                                        isToday ? 'rgba(245, 158, 11, 0.2)' :
                                                        isUrgent ? 'rgba(245, 158, 11, 0.12)' :
                                                        'var(--bg-tertiary)',
                                            color: isOverdue ? '#ef4444' :
                                                   isToday ? '#f59e0b' :
                                                   isUrgent ? '#f59e0b' :
                                                   'var(--text-secondary)'
                                        }}>
                                            {isOverdue ? `${Math.abs(days)} gün gecikti` :
                                             isToday ? 'Bugün' :
                                             `${days} gün kaldı`}
                                        </span>

                                        {/* Direct Open Button */}
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{ height: '28px', padding: '0 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            onClick={() => handleNavigate(item)}
                                            title="Kayda Git"
                                        >
                                            <span>Aç</span>
                                            <ChevronRight size={12} />
                                        </button>

                                        {/* Dismiss / Restore Button */}
                                        {isDismissed ? (
                                            <button
                                                type="button"
                                                onClick={(e) => handleRestore(key, e)}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: '4px' }}
                                                title="Geri Al"
                                            >
                                                <Eye size={14} />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={(e) => handleDismiss(key, e)}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                                title="Gizle"
                                            >
                                                <X size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <NotificationSettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />
        </div>
    )
}
