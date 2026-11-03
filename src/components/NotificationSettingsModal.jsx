import React, { useState, useEffect } from 'react'
import {
    Bell,
    BellOff,
    Mail,
    Clock,
    Zap,
    Send,
    Check,
    RotateCcw,
    AlertCircle,
    CheckCircle,
    Shield,
    Wrench,
    User,
    ClipboardCheck,
    Wallet,
    RefreshCw,
    Sparkles
} from 'lucide-react'
import Modal from './Modal'
import CustomSelect from './CustomSelect'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const TEST_ROLE_OPTIONS = [
    { value: 'admin', label: 'Yönetici & Admin (Tam Konsolide Rapor)' },
    { value: 'accounting', label: 'Muhasebe & Finans (Çek, Senet, Avans)' },
    { value: 'fleet_manager', label: 'Filo Yöneticisi (Muayene, Sigorta, Bakım)' },
    { value: 'personnel', label: 'Personel (Süre Sonu ve Zimmet)' }
]

const NOTIF_CATEGORIES = [
    {
        key: 'inspection',
        label: 'Araç Muayene & Egzoz Kontrolleri',
        desc: 'Muayene ve egzoz pulu süresi dolan veya yaklaşan araçların uyarıları',
        icon: ClipboardCheck,
        color: '#0ea5e9'
    },
    {
        key: 'insurance',
        label: 'Trafik & Kasko Sigortaları',
        desc: 'Kasko ve zorunlu trafik poliçesi yenileme tarihi yaklaşan araçlar',
        icon: Shield,
        color: '#22c55e'
    },
    {
        key: 'maintenance',
        label: 'Periyodik Bakım & Kilometre Uyarıları',
        desc: 'Belirlenen bakım kilometre sınırına ulaşan araçların servis uyarıları',
        icon: Wrench,
        color: '#f59e0b'
    },
    {
        key: 'employee_document',
        label: 'Personel Ehliyet, SRC ve Evrak Süreleri',
        desc: 'Sürücü belgesi, SRC kartı, takograf ve sağlık raporu bitiş hatırlatmaları',
        icon: User,
        color: '#14b8a6'
    },
    {
        key: 'finance_check',
        label: 'Çek ve Senet Vadeleri',
        desc: 'Vadesi 7 gün içinde dolacak olan tahsilat veya ödeme çekleri',
        icon: Wallet,
        color: '#ef4444'
    },
    {
        key: 'approval_center',
        label: 'İzin, Mesai ve Avans Onay Talepleri',
        desc: 'Personelden gelen ve yönetici onayı bekleyen talep bildirimleri',
        icon: CheckCircle,
        color: '#8b5cf6'
    }
]

export default function NotificationSettingsModal({ isOpen, onClose }) {
    const { currentCompany } = useCompany()
    const { user, isAdmin } = useAuth()
    const toast = useToast()

    const [activeTab, setActiveTab] = useState('in_app') // 'in_app' | 'email'

    // In-App Master Toggle
    const [inAppEnabled, setInAppEnabled] = useState(() => {
        return localStorage.getItem('user_in_app_enabled') !== 'false'
    })

    // Category Visibility Filters
    const [categoryFilters, setCategoryFilters] = useState(() => {
        try {
            const saved = localStorage.getItem(`notif_cat_filters_${user?.id || 'anon'}`)
            return saved ? JSON.parse(saved) : {}
        } catch (_) {
            return {}
        }
    })

    // Dismissed Count
    const [dismissedCount, setDismissedCount] = useState(0)

    // Company Email & Auto Engine Settings (Admin)
    const [notificationConfig, setNotificationConfig] = useState({
        emailNotificationsEnabled: true,
        dailySummaryEnabled: true,
        dailySummaryTime: '09:00',
        notificationEmails: ''
    })
    const [savingCompanyConfig, setSavingCompanyConfig] = useState(false)
    const [scanLoading, setScanLoading] = useState(false)
    const [testEmailLoading, setTestEmailLoading] = useState(false)
    const [selectedTestRole, setSelectedTestRole] = useState('admin')
    const [statusMsg, setStatusMsg] = useState(null)

    // Load initial states on open
    useEffect(() => {
        if (!isOpen) return

        // 1. In-App master
        setInAppEnabled(localStorage.getItem('user_in_app_enabled') !== 'false')

        // 2. Category filters
        try {
            const saved = localStorage.getItem(`notif_cat_filters_${user?.id || 'anon'}`)
            setCategoryFilters(saved ? JSON.parse(saved) : {})
        } catch (_) {}

        // 3. Dismissed count
        try {
            const dismissed = JSON.parse(localStorage.getItem(`dismissed_notifs_${user?.id || 'anon'}`) || '[]')
            setDismissedCount(Array.isArray(dismissed) ? dismissed.length : 0)
        } catch (_) {
            setDismissedCount(0)
        }

        // 4. Company email settings (if admin)
        if (currentCompany?.id && (isAdmin || user?.role === 'superadmin')) {
            window.electronAPI?.getCompanyNotificationSettings?.(currentCompany.id).then(res => {
                if (res?.success && res.data) {
                    setNotificationConfig(res.data)
                }
            }).catch(() => {})
        }
    }, [isOpen, currentCompany?.id, user?.id, isAdmin])

    // Toggle master in-app notifications
    const handleToggleInAppMaster = (enabled) => {
        setInAppEnabled(enabled)
        localStorage.setItem('user_in_app_enabled', String(enabled))
        broadcastSettingsChange({ inAppEnabled: enabled })
    }

    // Toggle single category filter
    const handleToggleCategory = (catKey, isVisible) => {
        const nextFilters = { ...categoryFilters, [catKey]: isVisible }
        setCategoryFilters(nextFilters)
        localStorage.setItem(`notif_cat_filters_${user?.id || 'anon'}`, JSON.stringify(nextFilters))
        localStorage.setItem(`notify_${catKey}`, String(isVisible))
        broadcastSettingsChange({ categories: nextFilters })
    }

    // Broadcast change to top bar & pages
    const broadcastSettingsChange = (payload = {}) => {
        window.dispatchEvent(new CustomEvent('user_notification_settings_changed', {
            detail: {
                inAppEnabled: localStorage.getItem('user_in_app_enabled') !== 'false',
                categories: payload.categories || categoryFilters,
                ...payload
            }
        }))
    }

    // Restore all dismissed notifications
    const handleRestoreAllDismissed = () => {
        localStorage.removeItem(`dismissed_notifs_${user?.id || 'anon'}`)
        setDismissedCount(0)
        if (user?.id && window.electronAPI?.saveUserPreferences) {
            window.electronAPI.saveUserPreferences({
                userId: user.id,
                preferences: { dismissedEvents: [] }
            }).catch(() => {})
        }
        window.dispatchEvent(new CustomEvent('notifications_dismissed_changed', { detail: [] }))
        toast?.success ? toast.success('Tüm gizlenen bildirimler geri yüklendi.') : null
    }

    // Save company email config
    const handleSaveCompanyConfig = async (newConfig = notificationConfig) => {
        if (!currentCompany?.id) return
        setSavingCompanyConfig(true)
        setStatusMsg(null)
        try {
            const res = await window.electronAPI?.saveCompanyNotificationSettings?.(currentCompany.id, newConfig)
            if (res?.success) {
                setStatusMsg({ type: 'success', text: 'Şirket e-posta ve dağıtım ayarları kaydedildi.' })
                setTimeout(() => setStatusMsg(null), 3500)
            } else {
                setStatusMsg({ type: 'error', text: res?.error || 'Kayıt başarısız oldu.' })
            }
        } catch (e) {
            setStatusMsg({ type: 'error', text: e.message })
        } finally {
            setSavingCompanyConfig(false)
        }
    }

    // Run manual notification scan
    const handleRunScan = async () => {
        if (!currentCompany?.id) return
        setScanLoading(true)
        setStatusMsg(null)
        try {
            const res = await window.electronAPI?.runCompanyNotificationScan?.(currentCompany.id)
            if (res?.success) {
                const count = res?.data?.emailsSent || res?.data?.count || 0
                setStatusMsg({ type: 'success', text: `Tarama tamamlandı: ${count} adet e-posta bildirimi iletildi.` })
                setTimeout(() => setStatusMsg(null), 4000)
            } else {
                setStatusMsg({ type: 'error', text: res?.error || 'Tarama çalıştırılamadı.' })
            }
        } catch (e) {
            setStatusMsg({ type: 'error', text: e.message })
        } finally {
            setScanLoading(false)
        }
    }

    // Send test email
    const handleSendTestEmail = async () => {
        if (!currentCompany?.id) return
        const targetEmail = (notificationConfig.notificationEmails || '').split(',')[0]?.trim() || (user?.email && !user.email.endsWith('@muayen.com') ? user.email : '')
        if (!targetEmail) {
            setStatusMsg({ type: 'error', text: 'Lütfen test e-postasının gönderileceği geçerli bir adres girin.' })
            return
        }
        setTestEmailLoading(true)
        setStatusMsg(null)
        try {
            const res = await window.electronAPI?.sendTestNotificationEmail?.(currentCompany.id, selectedTestRole, targetEmail)
            if (res?.success) {
                setStatusMsg({ type: 'success', text: `Test e-postası başarıyla (${targetEmail}) adresine gönderildi!` })
                setTimeout(() => setStatusMsg(null), 4000)
            } else {
                setStatusMsg({ type: 'error', text: res?.error || 'Test e-postası gönderilemedi.' })
            }
        } catch (e) {
            setStatusMsg({ type: 'error', text: e.message })
        } finally {
            setTestEmailLoading(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Bildirim Ayarları & Tercihleri"
            size="md"
            placement="center"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Status alert message */}
                {statusMsg && (
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        backgroundColor: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: statusMsg.type === 'success' ? '#10b981' : '#ef4444',
                        border: `1px solid ${statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                    }}>
                        {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        <span>{statusMsg.text}</span>
                    </div>
                )}

                {/* Tab Switcher */}
                <div style={{
                    display: 'flex',
                    background: 'var(--bg-tertiary)',
                    padding: '4px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    gap: '4px'
                }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('in_app')}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            background: activeTab === 'in_app' ? 'var(--bg-secondary)' : 'transparent',
                            color: activeTab === 'in_app' ? 'var(--text-primary)' : 'var(--text-muted)',
                            boxShadow: activeTab === 'in_app' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Bell size={15} color={activeTab === 'in_app' ? 'var(--accent-primary)' : 'currentColor'} />
                        Zil & Uygulama İçi
                    </button>
                    {(isAdmin || user?.role === 'superadmin') && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('email')}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                background: activeTab === 'email' ? 'var(--bg-secondary)' : 'transparent',
                                color: activeTab === 'email' ? 'var(--text-primary)' : 'var(--text-muted)',
                                boxShadow: activeTab === 'email' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <Mail size={15} color={activeTab === 'email' ? 'var(--accent-primary)' : 'currentColor'} />
                            Şirket E-Posta Motoru
                        </button>
                    )}
                </div>

                {/* TAB 1: IN-APP & BELL NOTIFICATIONS */}
                {activeTab === 'in_app' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Master Switch Card */}
                        <div style={{
                            background: 'var(--bg-tertiary)',
                            borderRadius: '12px',
                            padding: '14px 18px',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: inAppEnabled ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: inAppEnabled ? 'var(--accent-primary)' : 'var(--danger)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    {inAppEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                                </div>
                                <div>
                                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        Üst Bar Zil Bildirimleri
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {inAppEnabled ? 'Zil simgesi ve açılır bildirim paneli aktif' : 'Tüm zil bildirimleri ve uyarı noktaları gizlendi'}
                                    </div>
                                </div>
                            </div>

                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={inAppEnabled}
                                    onChange={(e) => handleToggleInAppMaster(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {/* Category Visibility Toggles */}
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', paddingLeft: '4px' }}>
                                Gösterilecek Bildirim Kategorileri
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {NOTIF_CATEGORIES.map((cat) => {
                                    const IconComponent = cat.icon
                                    // If not defined, default is true (visible)
                                    const isVisible = categoryFilters[cat.key] !== false

                                    return (
                                        <div
                                            key={cat.key}
                                            style={{
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '10px',
                                                padding: '12px 14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '12px',
                                                opacity: inAppEnabled ? 1 : 0.5,
                                                pointerEvents: inAppEnabled ? 'auto' : 'none',
                                                transition: 'opacity 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    background: `${cat.color}18`,
                                                    color: cat.color,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    <IconComponent size={16} />
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {cat.label}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', lineHeight: 1.3 }}>
                                                        {cat.desc}
                                                    </div>
                                                </div>
                                            </div>

                                            <label className="toggle-switch" style={{ flexShrink: 0 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isVisible}
                                                    disabled={!inAppEnabled}
                                                    onChange={(e) => handleToggleCategory(cat.key, e.target.checked)}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Dismissed Items Management */}
                        <div style={{
                            marginTop: '4px',
                            padding: '12px 16px',
                            borderRadius: '10px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                        }}>
                            <div>
                                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    Gizlenen Bildirimler
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {dismissedCount > 0 
                                        ? `Şu anda ${dismissedCount} adet bildirim gizlenmiş durumda`
                                        : 'Gizlenmiş herhangi bir bildirim bulunmuyor'
                                    }
                                </div>
                            </div>

                            {dismissedCount > 0 && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleRestoreAllDismissed}
                                    style={{
                                        fontSize: '12px',
                                        padding: '6px 12px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        flexShrink: 0
                                    }}
                                >
                                    <RotateCcw size={13} />
                                    Tümünü Geri Yükle
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: COMPANY EMAIL ENGINE (ADMIN ONLY) */}
                {activeTab === 'email' && (isAdmin || user?.role === 'superadmin') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Company Email Switch */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: '10px',
                            padding: '12px 16px',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                        }}>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    Otomatik E-Posta İletimi
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Sistem uyarılarının personele e-posta ile ulaştırılmasını sağlar
                                </div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={notificationConfig.emailNotificationsEnabled !== false}
                                    onChange={(e) => {
                                        const updated = { ...notificationConfig, emailNotificationsEnabled: e.target.checked }
                                        setNotificationConfig(updated)
                                        handleSaveCompanyConfig(updated)
                                    }}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {/* Daily Summary Switch & Time */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: '10px',
                            padding: '12px 16px',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                        }}>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    Günlük Konsolide Özet Bülteni
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Her sabah tek derlenmiş bülten gönderir
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="time"
                                    className="form-input"
                                    style={{ width: '90px', height: '32px', textAlign: 'center', padding: '4px', fontSize: '12px' }}
                                    value={notificationConfig.dailySummaryTime || '09:00'}
                                    onChange={(e) => {
                                        const updated = { ...notificationConfig, dailySummaryTime: e.target.value }
                                        setNotificationConfig(updated)
                                    }}
                                    onBlur={() => handleSaveCompanyConfig()}
                                />
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={notificationConfig.dailySummaryEnabled !== false}
                                        onChange={(e) => {
                                            const updated = { ...notificationConfig, dailySummaryEnabled: e.target.checked }
                                            setNotificationConfig(updated)
                                            handleSaveCompanyConfig(updated)
                                        }}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        {/* CC Email */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: '10px',
                            padding: '12px 16px',
                            border: '1px solid var(--border-color)'
                        }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                Harici / Yedek E-Posta Adresi (İsteğe Bağlı CC)
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                Bildirimlerin kopyasının gideceği ortak muhasebe veya yönetici e-postası
                            </div>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="ornek@sirket.com, muhasebe@harici.com"
                                value={notificationConfig.notificationEmails || ''}
                                onChange={(e) => setNotificationConfig(prev => ({ ...prev, notificationEmails: e.target.value }))}
                                onBlur={() => handleSaveCompanyConfig()}
                                style={{ width: '100%', fontSize: '12px', height: '36px' }}
                            />
                        </div>

                        {/* Admin Action Buttons */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '10px',
                            marginTop: '4px',
                            paddingTop: '10px',
                            borderTop: '1px solid var(--border-color)'
                        }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleRunScan}
                                disabled={scanLoading || !currentCompany}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '34px' }}
                            >
                                {scanLoading ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
                                {scanLoading ? 'Taranıyor...' : 'Şimdi Personele Uyarı Taraması Yap'}
                            </button>

                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => handleSaveCompanyConfig()}
                                disabled={savingCompanyConfig || !currentCompany}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '34px' }}
                            >
                                {savingCompanyConfig ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                                {savingCompanyConfig ? 'Kaydediliyor...' : 'Politikayı Kaydet'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}

