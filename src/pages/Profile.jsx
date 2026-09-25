import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
    User, 
    Mail, 
    Lock, 
    Save, 
    Key, 
    CheckCircle2, 
    AlertCircle,
    Shield,
    AtSign,
    QrCode,
    Smartphone,
    Copy,
    Check,
    KeyRound,
    Loader2,
    X,
    Bell,
    ClipboardCheck,
    Wallet,
    Wrench,
    Clock,
    ShieldAlert
} from 'lucide-react'
import TopProgressBar from '../components/TopProgressBar'
import CustomInput from '../components/CustomInput'
import Modal from '../components/Modal'

const NOTIF_ICONS = {
    inspection: <ClipboardCheck size={16} />,
    insurance: <Shield size={16} />,
    maintenance: <Wrench size={16} />,
    finance_check: <Wallet size={16} />,
    approval_center: <CheckCircle2 size={16} />,
    advance_requests: <Wallet size={16} />,
    cash_flow_warning: <AlertCircle size={16} />,
    employee_document: <User size={16} />,
    leave_results: <CheckCircle2 size={16} />,
    vehicle_assignment: <ClipboardCheck size={16} />,
    security_alerts: <ShieldAlert size={16} />,
    daily_summary: <Clock size={16} />
}

const NOTIF_DESCRIPTIONS = {
    inspection: 'Tüvtürk ve araç teknik muayene bitiş süreleri (15-30 gün önceden)',
    insurance: 'Trafik sigortası ve kasko poliçesi bitiş tarihleri',
    maintenance: 'Periyodik araç bakım zamanları ve sayaç/kilometre eşikleri',
    finance_check: 'Vadesi 7 gün içinde dolacak müşteri veya şirket çekleri / senetleri',
    approval_center: 'Onayınızı bekleyen izin, avans ve mesai talepleri',
    advance_requests: 'Personel avans talepleri ve masraf bildirimleri',
    cash_flow_warning: 'Kritik kasa bakiyesi ve bütçe eşik uyarıları',
    employee_document: 'Ehliyet, SRC, psikoteknik ve sağlık raporu geçerlilik süreleri',
    leave_results: 'Sunduğunuz izin ve mesai taleplerinin onay/ret sonuçları',
    vehicle_assignment: 'Adınıza zimmetlenen araç veya operasyonel görev atamaları',
    security_alerts: 'Kritik güvenlik olayları, yetkisiz giriş denemeleri ve veri silme hareketleri',
    daily_summary: 'Sabah saatlerinde hazırlanan genel durum ve aksiyon özeti'
}

export default function Profile() {
    const { user, updateProfile } = useAuth()
    const [activeTab, setActiveTab] = useState('personal')
    
    const [profileData, setProfileData] = useState({
        username: user?.username || '',
        email: user?.email || '',
        full_name: user?.full_name || ''
    })
    
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    })
    
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState({ type: '', text: '' })

    // 2FA / MFA State
    const [mfaStatus, setMfaStatus] = useState({ enabled: false, remainingBackupCodes: 0 })
    const [mfaLoading, setMfaLoading] = useState(false)
    const [setupModal, setSetupModal] = useState(false)
    const [setupData, setSetupData] = useState(null) // { secret, qrCodeUrl, backupCodes }
    const [verificationCode, setVerificationCode] = useState('')
    const [enablingMfa, setEnablingMfa] = useState(false)
    const [copiedSecret, setCopiedSecret] = useState(false)
    const [copiedBackupCodes, setCopiedBackupCodes] = useState(false)

    useEffect(() => {
        loadMfaStatus()
    }, [user?.id])

    const loadMfaStatus = async () => {
        if (!user?.id || !window.electronAPI?.getMfaStatus) return
        try {
            const res = await window.electronAPI.getMfaStatus(user.id)
            if (res?.success) {
                setMfaStatus({
                    enabled: !!res.enabled,
                    remainingBackupCodes: res.remainingBackupCodes || 0
                })
            }
        } catch (err) {
            console.error('Fetch MFA status error:', err)
        }
    }

    // ── NOTIFICATION PREFERENCES STATE & LOGIC ──
    const [notifConfig, setNotifConfig] = useState(null)
    const [notifLoading, setNotifLoading] = useState(false)
    const [notifSaving, setNotifSaving] = useState(false)
    const [notifMsg, setNotifMsg] = useState({ type: '', text: '' })

    useEffect(() => {
        if (activeTab === 'notifications' && user?.id) {
            loadUserNotifications()
        }
    }, [activeTab, user?.id])

    const loadUserNotifications = async () => {
        if (!user?.id || !window.electronAPI?.getUserNotificationSettings) return
        setNotifLoading(true)
        try {
            const res = await window.electronAPI.getUserNotificationSettings(user.id)
            if (res?.success && res.data) {
                setNotifConfig(res.data)
            }
        } catch (e) {
            console.error('Kişisel bildirim tercihleri yüklenemedi:', e)
        } finally {
            setNotifLoading(false)
        }
    }

    const handleSaveUserNotifications = async (configToSave = notifConfig) => {
        if (!user?.id || !window.electronAPI?.saveUserNotificationSettings || !configToSave) return
        setNotifSaving(true)
        try {
            const res = await window.electronAPI.saveUserNotificationSettings(user.id, configToSave)
            if (res?.success) {
                setNotifMsg({ type: 'success', text: 'Bildirim tercihleriniz güncellendi.' })
            } else {
                setNotifMsg({ type: 'error', text: res?.error || 'Kaydedilemedi.' })
            }
        } catch (e) {
            setNotifMsg({ type: 'error', text: e.message })
        } finally {
            setNotifSaving(false)
            setTimeout(() => setNotifMsg({ type: '', text: '' }), 3500)
        }
    }

    const toggleNotifItem = (itemKey, channel) => {
        if (!notifConfig?.items?.[itemKey]) return
        const currentVal = notifConfig.items[itemKey][channel] !== false
        const updated = {
            ...notifConfig,
            items: {
                ...notifConfig.items,
                [itemKey]: {
                    ...notifConfig.items[itemKey],
                    [channel]: !currentVal
                }
            }
        }
        setNotifConfig(updated)
        handleSaveUserNotifications(updated)
    }

    const toggleGlobalChannel = (channel) => {
        if (!notifConfig) return
        const updated = {
            ...notifConfig,
            [channel]: !notifConfig[channel]
        }
        setNotifConfig(updated)
        handleSaveUserNotifications(updated)
    }

    const handleProfileSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMsg({ type: '', text: '' })
        const result = await updateProfile(profileData)
        if (result.success) setMsg({ type: 'success', text: 'Profil güncellendi' })
        else setMsg({ type: 'error', text: result.error || 'Hata oluştu' })
        setLoading(false)
    }

    const handlePasswordSubmit = async (e) => {
        e.preventDefault()
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMsg({ type: 'error', text: 'Şifreler eşleşmiyor' })
            return
        }
        setLoading(true)
        setMsg({ type: '', text: '' })
        const result = await window.electronAPI.changePassword({
            userId: user.id,
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword
        })
        if (result.success) {
            setMsg({ type: 'success', text: 'Şifre güncellendi' })
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        } else setMsg({ type: 'error', text: result.error || 'Hata oluştu' })
        setLoading(false)
    }

    // Start 2FA Setup Flow
    const handleStart2FASetup = async () => {
        setMfaLoading(true)
        setMsg({ type: '', text: '' })
        try {
            const res = await window.electronAPI.generateMfaSetup(user.id)
            if (res && res.success) {
                setSetupData(res)
                setVerificationCode('')
                setCopiedSecret(false)
                setCopiedBackupCodes(false)
                setSetupModal(true)
            } else {
                setMsg({ type: 'error', text: res?.error || '2FA kurulumu başlatılamadı' })
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Hata: ' + err.message })
        } finally {
            setMfaLoading(false)
        }
    }

    // Confirm & Enable 2FA
    const handleEnable2FASubmit = async (e) => {
        e.preventDefault()
        if (!verificationCode || verificationCode.trim().length < 6) {
            alert('Lütfen Authenticator uygulamanızdaki 6 haneli kodu girin.')
            return
        }

        setEnablingMfa(true)
        try {
            const res = await window.electronAPI.enableMfa(
                user.id,
                setupData.secret,
                verificationCode.trim(),
                setupData.backupCodes
            )
            if (res && res.success) {
                setSetupModal(false)
                setMsg({ type: 'success', text: 'İki Adımlı Doğrulama (2FA) başarıyla etkinleştirildi!' })
                await loadMfaStatus()
            } else {
                alert(res?.error || 'Doğrulama kodu geçersiz. Lütfen tekrar deneyin.')
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        } finally {
            setEnablingMfa(false)
        }
    }

    // Disable 2FA
    const handleDisable2FA = async () => {
        if (!window.confirm('İki Adımlı Doğrulamayı (2FA) devre dışı bırakmak istediğinize emin misiniz?')) {
            return
        }
        setMfaLoading(true)
        try {
            const res = await window.electronAPI.disableMfa(user.id)
            if (res && res.success) {
                setMsg({ type: 'success', text: 'İki Adımlı Doğrulama (2FA) devre dışı bırakıldı.' })
                await loadMfaStatus()
            } else {
                setMsg({ type: 'error', text: res?.error || '2FA kapatılamadı' })
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Hata: ' + err.message })
        } finally {
            setMfaLoading(false)
        }
    }

    const copySecretToClipboard = () => {
        if (!setupData?.secret) return
        navigator.clipboard.writeText(setupData.secret)
        setCopiedSecret(true)
        setTimeout(() => setCopiedSecret(false), 2000)
    }

    const copyBackupCodesToClipboard = () => {
        if (!setupData?.backupCodes) return
        navigator.clipboard.writeText(setupData.backupCodes.join('\n'))
        setCopiedBackupCodes(true)
        setTimeout(() => setCopiedBackupCodes(false), 2000)
    }

    return (
        <div className="settings-page">
            <TopProgressBar loading={loading || mfaLoading} />
            
            <div className="page-header">
                <div>
                    <h1 className="page-title">Profil & Güvenlik Ayarları</h1>
                    <p style={{ marginTop: '5px', color: 'var(--text-muted)' }}>Kişisel bilgilerinizi, şifrenizi ve 2FA güvenliğinizi yönetin.</p>
                </div>
            </div>

            <div className="settings-container">
                {/* Sidebar Navigation */}
                <div className="settings-sidebar">
                    <div 
                        className={`settings-sidebar-item ${activeTab === 'personal' ? 'active' : ''}`}
                        onClick={() => setActiveTab('personal')}
                    >
                        <User size={18} />
                        <span>Kişisel Bilgiler</span>
                    </div>

                    <div 
                        className={`settings-sidebar-item ${activeTab === 'notifications' ? 'active' : ''}`}
                        onClick={() => setActiveTab('notifications')}
                    >
                        <Bell size={18} />
                        <span>Bildirim Tercihleri</span>
                    </div>
                    
                    <div 
                        className={`settings-sidebar-item ${activeTab === 'security' ? 'active' : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        <Shield size={18} />
                        <span>Güvenlik & 2FA</span>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="settings-content">
                    {msg.text && (
                        <div className="profile-alert" style={{
                            backgroundColor: msg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                            borderColor: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                            padding: '12px 20px',
                            borderRadius: '12px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px'
                        }}>
                            {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            {msg.text}
                        </div>
                    )}

                    <div className="settings-card">
                        {activeTab === 'personal' ? (
                            <form onSubmit={handleProfileSubmit}>
                                <div className="profile-card" style={{ marginBottom: '30px' }}>
                                    <div className="profile-avatar">
                                        {profileData.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
                                    </div>
                                    <div className="profile-details">
                                        <h3>{profileData.full_name || user?.username}</h3>
                                        <p>{profileData.email}</p>
                                        <span className="profile-badge">
                                            {user?.role === 'superadmin' ? 'Süper Yönetici' : 'Yönetici'}
                                        </span>
                                    </div>
                                </div>

                                <h3 className="settings-card-title">Hesap Detayları</h3>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <CustomInput 
                                        label="Ad Soyad"
                                        value={profileData.full_name}
                                        onChange={val => setProfileData({...profileData, full_name: val})}
                                        maxLength={100}
                                        placeholder="Tam isminiz"
                                    />
                                    
                                    <div className="settings-grid">
                                        <CustomInput 
                                            label="Kullanıcı Adı"
                                            required
                                            value={profileData.username}
                                            onChange={val => setProfileData({...profileData, username: val})}
                                            maxLength={50}
                                            icon={<AtSign size={15} />}
                                        />
                                        <CustomInput 
                                            label="E-posta Adresi"
                                            type="email"
                                            required
                                            value={profileData.email}
                                            onChange={val => setProfileData({...profileData, email: val})}
                                            maxLength={100}
                                            icon={<Mail size={15} />}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '140px' }}>
                                            <Save size={18} />
                                            Değişiklikleri Kaydet
                                        </button>
                                    </div>
                                </div>
                            </form>
                        ) : activeTab === 'notifications' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {/* ── ROLE & DIRECT EMAIL BANNER ── */}
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%)',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    borderRadius: '16px',
                                    padding: '20px 24px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '16px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{
                                            width: '46px',
                                            height: '46px',
                                            borderRadius: '12px',
                                            background: 'rgba(99, 102, 241, 0.15)',
                                            color: '#6366f1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <Bell size={22} />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    Kişisel Bildirim &amp; E-Posta Tercihleri
                                                </h3>
                                                <span style={{
                                                    padding: '3px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    background: 'rgba(99, 102, 241, 0.15)',
                                                    color: '#818cf8',
                                                    letterSpacing: '0.04em'
                                                }}>
                                                    {notifConfig?.roleLabel || (user?.role === 'superadmin' ? 'Süper Yönetici' : 'Yönetici')}
                                                </span>
                                            </div>
                                            <p style={{ margin: '5px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                                Şirketteki rolünüze göre ilgili uyarılar doğrudan <strong>{user?.email || 'kayıtlı e-postanıza'}</strong> iletilir.
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {notifMsg.text && (
                                            <span style={{
                                                fontSize: '12px',
                                                color: notifMsg.type === 'success' ? '#10b981' : '#ef4444',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                {notifMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                                                {notifMsg.text}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={() => handleSaveUserNotifications()}
                                            disabled={notifSaving || notifLoading}
                                            style={{ minWidth: '130px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            {notifSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                                            {notifSaving ? 'Kaydediliyor...' : 'Tercihleri Kaydet'}
                                        </button>
                                    </div>
                                </div>

                                {/* ── MASTER CHANNELS ── */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                                    {/* Master E-posta */}
                                    <div style={{
                                        background: 'var(--bg-tertiary, #1e293b)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        padding: '16px 20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Mail size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>E-Posta Bildirimleri</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                    {user?.email ? `${user.email} adresine iletilir` : 'Kişisel e-postanıza iletilir'}
                                                </div>
                                            </div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={notifConfig?.emailEnabled !== false}
                                                onChange={() => toggleGlobalChannel('emailEnabled')}
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    {/* Master In-App */}
                                    <div style={{
                                        background: 'var(--bg-tertiary, #1e293b)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        padding: '16px 20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Bell size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Uygulama İçi Bildirimler</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Üst menüdeki zil ve sayaç rozetleri</div>
                                            </div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={notifConfig?.inAppEnabled !== false}
                                                onChange={() => toggleGlobalChannel('inAppEnabled')}
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>

                                {/* ── DETAILED EVENT CATEGORIES TABLE ── */}
                                <div style={{ border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 130px 130px',
                                        background: 'var(--bg-tertiary, #1e293b)',
                                        padding: '12px 18px',
                                        borderBottom: '1px solid var(--border-color)'
                                    }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                            Bildirim Kategorisi
                                        </div>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>
                                            📲 Uygulama İçi
                                        </div>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>
                                            ✉️ E-Posta
                                        </div>
                                    </div>

                                    {notifLoading ? (
                                        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                                            <div style={{ fontSize: '13px' }}>Tercihler yükleniyor...</div>
                                        </div>
                                    ) : notifConfig?.items && Object.keys(notifConfig.items).length > 0 ? (
                                        Object.entries(notifConfig.items).map(([key, item], idx, arr) => {
                                            const isLast = idx === arr.length - 1
                                            const icon = NOTIF_ICONS[key] || <Bell size={16} />
                                            const desc = NOTIF_DESCRIPTIONS[key] || item.label || 'Kategori bildirimleri'
                                            return (
                                                <div key={key} style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr 130px 130px',
                                                    padding: '14px 18px',
                                                    alignItems: 'center',
                                                    borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
                                                    background: idx % 2 === 0 ? 'transparent' : 'var(--bg-tertiary, rgba(255,255,255,0.015))',
                                                    transition: 'background 0.15s'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '16px' }}>
                                                        <div style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: '8px',
                                                            background: 'rgba(99, 102, 241, 0.1)',
                                                            color: '#818cf8',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {icon}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                                                {item.label || key}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                                {desc}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <label className="toggle-switch" title={item.inApp !== false ? 'Uygulama içi açık' : 'Kapalı'}>
                                                            <input
                                                                type="checkbox"
                                                                checked={item.inApp !== false}
                                                                disabled={notifConfig.inAppEnabled === false}
                                                                onChange={() => toggleNotifItem(key, 'inApp')}
                                                            />
                                                            <span className="toggle-slider"></span>
                                                        </label>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <label className="toggle-switch" title={item.email !== false ? 'E-posta iletimi açık' : 'Kapalı'}>
                                                            <input
                                                                type="checkbox"
                                                                checked={item.email !== false}
                                                                disabled={notifConfig.emailEnabled === false}
                                                                onChange={() => toggleNotifItem(key, 'email')}
                                                            />
                                                            <span className="toggle-slider"></span>
                                                        </label>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                            Rolünüze özel bildirim ayarları yüklenemedi.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                {/* ── TWO-FACTOR AUTHENTICATION (2FA - TOTP) CARD ── */}
                                <div style={{ background: 'var(--bg-tertiary, #1e293b)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                                        <div style={{ display: 'flex', gap: '14px' }}>
                                            <div style={{ 
                                                width: '42px', 
                                                height: '42px', 
                                                borderRadius: '10px', 
                                                background: mfaStatus.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)', 
                                                color: mfaStatus.enabled ? '#10b981' : '#3b82f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <Smartphone size={22} />
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        İki Adımlı Doğrulama (2FA - TOTP)
                                                    </h3>
                                                    {mfaStatus.enabled ? (
                                                        <span className="badge badge-success">Aktif</span>
                                                    ) : (
                                                        <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>Kapalı</span>
                                                    )}
                                                </div>
                                                <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '540px' }}>
                                                    Hesabınıza ekstra bir güvenlik katmanı ekleyin. Giriş yaparken şifrenize ek olarak Google Authenticator veya Microsoft Authenticator uygulamanızdaki 6 haneli kod istenir.
                                                </p>
                                                {mfaStatus.enabled && mfaStatus.remainingBackupCodes > 0 && (
                                                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        Kalan Acil Kurtarma Kodu: <strong>{mfaStatus.remainingBackupCodes}</strong> adet
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            {mfaStatus.enabled ? (
                                                <button 
                                                    type="button" 
                                                    className="btn btn-secondary" 
                                                    onClick={handleDisable2FA}
                                                    disabled={mfaLoading}
                                                    style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                                >
                                                    2FA'yı Devre Dışı Bırak
                                                </button>
                                            ) : (
                                                <button 
                                                    type="button" 
                                                    className="btn btn-primary" 
                                                    onClick={handleStart2FASetup}
                                                    disabled={mfaLoading}
                                                >
                                                    <QrCode size={16} />
                                                    2FA'yı Etkinleştir
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ── PASSWORD CHANGE FORM ── */}
                                <form onSubmit={handlePasswordSubmit}>
                                    <h3 className="settings-card-title">Şifre Değiştir</h3>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <CustomInput 
                                            label="Mevcut Şifre"
                                            type="password"
                                            value={passwordData.currentPassword}
                                            onChange={val => setPasswordData({...passwordData, currentPassword: val})}
                                            maxLength={64}
                                            icon={<Key size={15} />}
                                            placeholder="••••••••"
                                        />

                                        <div className="settings-grid">
                                            <CustomInput 
                                                label="Yeni Şifre"
                                                type="password"
                                                value={passwordData.newPassword}
                                                onChange={val => setPasswordData({...passwordData, newPassword: val})}
                                                maxLength={64}
                                                icon={<Lock size={15} />}
                                                placeholder="Yeni şifreniz"
                                            />
                                            <CustomInput 
                                                label="Yeni Şifre Onayı"
                                                type="password"
                                                value={passwordData.confirmPassword}
                                                onChange={val => setPasswordData({...passwordData, confirmPassword: val})}
                                                maxLength={64}
                                                icon={<Lock size={15} />}
                                                placeholder="Yeni şifrenizi doğrulayın"
                                            />
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                            <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '140px' }}>
                                                <Key size={18} />
                                                Şifreyi Güncelle
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── 2FA SETUP MODAL ── */}
            {setupModal && setupData && (
                <Modal
                    isOpen={setupModal}
                    onClose={() => setSetupModal(false)}
                    title="İki Adımlı Doğrulamayı (2FA) Kur"
                >
                    <form onSubmit={handleEnable2FASubmit} className="modal-form-grid">
                        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                                Telefonunuzdaki <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong> veya <strong>Apple Parolalar</strong> uygulamasını açıp aşağıdaki QR kodu taratın:
                            </p>

                            <div style={{ 
                                display: 'inline-block', 
                                padding: '12px', 
                                background: '#ffffff', 
                                borderRadius: '12px', 
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                marginBottom: '14px'
                            }}>
                                <img 
                                    src={setupData.qrCodeUrl} 
                                    alt="2FA QR Code" 
                                    style={{ width: '180px', height: '180px', display: 'block' }} 
                                />
                            </div>

                            {/* Manual Secret Key */}
                            <div style={{ 
                                background: 'var(--bg-secondary)', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '8px', 
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px',
                                textAlign: 'left'
                            }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Manuel Kurulum Gizli Anahtarı:</div>
                                    <code style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', color: '#3b82f6' }}>
                                        {setupData.secret}
                                    </code>
                                </div>
                                <button
                                    type="button"
                                    className="ghost-btn"
                                    onClick={copySecretToClipboard}
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                >
                                    {copiedSecret ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                                    <span>{copiedSecret ? 'Kopyalandı' : 'Kopyala'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Backup Recovery Codes Box */}
                        <div style={{ 
                            background: 'rgba(245, 158, 11, 0.08)', 
                            border: '1px solid rgba(245, 158, 11, 0.25)', 
                            borderRadius: '8px', 
                            padding: '12px 14px' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontSize: '12.5px', fontWeight: 600 }}>
                                    <KeyRound size={14} />
                                    <span>Acil Durum Kurtarma Kodları</span>
                                </div>
                                <button
                                    type="button"
                                    className="ghost-btn"
                                    onClick={copyBackupCodesToClipboard}
                                    style={{ padding: '4px 8px', fontSize: '11.5px', height: 'auto' }}
                                >
                                    {copiedBackupCodes ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                                    <span>{copiedBackupCodes ? 'Kopyalandı' : 'Tümünü Kopyala'}</span>
                                </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)' }}>
                                {setupData.backupCodes.map((code, idx) => (
                                    <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '3px 8px', borderRadius: '4px' }}>
                                        {code}
                                    </div>
                                ))}
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
                                Telefonunuzu kaybederseniz bu kodlarla giriş yapabilirsiniz. Lütfen güvenli bir yere kaydedin.
                            </p>
                        </div>

                        {/* 6-Digit Confirmation Test Input */}
                        <div>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                Authenticator'daki 6 Haneli Kodu Girin:
                            </label>
                            <input
                                type="text"
                                className="modern-input-field"
                                placeholder="000 000"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                maxLength={7}
                                required
                                autoFocus
                                style={{
                                    letterSpacing: '5px',
                                    fontSize: '18px',
                                    textAlign: 'center',
                                    fontWeight: '700',
                                    fontFamily: 'monospace',
                                    width: '100%',
                                    padding: '10px'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setSetupModal(false)}>
                                İptal
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={enablingMfa}>
                                {enablingMfa ? (
                                    <>
                                        <Loader2 size={16} className="spin" />
                                        Doğrulanıyor...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        Doğrula ve 2FA'yı Aktif Et
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    )
}
