import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import CustomSelect from '../components/CustomSelect'
import CustomInput from '../components/CustomInput'
import Modal from '../components/Modal'
import PermissionMatrix, { ROLE_PRESETS } from '../components/PermissionMatrix'
import { 
    Sun, Moon, Shield, Database, Palette, HardDrive, Lock, Globe, 
    Bell, Zap, Download, Upload, RefreshCw, Folder, User, Users, Wallet, 
    Wrench, FileSearch, ClipboardCheck, Layout, Cog, Eye, EyeOff, Clock, CheckCircle,
    UserPlus, Key, Unlock, Trash2, Edit2, ShieldAlert, Check, X, Building2, Sparkles
} from 'lucide-react'
import TopProgressBar from '../components/TopProgressBar'

export default function Settings() {
    const { theme, toggleTheme } = useTheme()
    const { user } = useAuth()
    const { currentCompany } = useCompany()

    const [activeTab, setActiveTab] = useState('general')

    const [settings, setSettings] = useState({
        autoBackup: false,
        frequency: 'daily',
        backupPath: '',
        lastBackup: {},
        arvento: {
            enabled: false,
            username: '',
            pin1: '',
            pin2: '',
            language: 'tr',
            interval: 3
        }
    })

    const [appVersion, setAppVersion] = useState('1.0.0')
    const [updateStatus, setUpdateStatus] = useState('idle')
    const [updateInfo, setUpdateInfo] = useState(null)
    const [progress, setProgress] = useState(0)
    const [errorMsg, setErrorMsg] = useState('')
    const [isBackupPathFocused, setIsBackupPathFocused] = useState(false)
    const [showLockPass, setShowLockPass] = useState(false)
    const [lockSettings, setLockSettings] = useState(() => {
        return JSON.parse(localStorage.getItem('aractakip_lock_settings') || '{"enabled":false,"timeout":5,"useCustomPassword":false,"customPassword":""}')
    })

    const [notifications, setNotifications] = useState({
        maintenance: localStorage.getItem('notify_maintenance') !== 'false',
        inspection: localStorage.getItem('notify_inspection') !== 'false',
        insurance: localStorage.getItem('notify_insurance') !== 'false',
        employee_document: localStorage.getItem('notify_employee_document') !== 'false',
        finance_check: localStorage.getItem('notify_finance_check') !== 'false',
        approval_center: localStorage.getItem('notify_approval_center') !== 'false'
    })

    const [testingConnection, setTestingConnection] = useState(false)
    const [connectionTestResult, setConnectionTestResult] = useState(null)

    const DEFAULT_CLOUD_PG_URL = 'postgresql://postgres:eyaeaj0djlbjhybz04ma4vrw7otatabf@45.147.47.56:5432/postgres'
    const [postgresUrl, setPostgresUrl] = useState(() => localStorage.getItem('aractakip_postgres_migration_url') || DEFAULT_CLOUD_PG_URL)
    const [migrating, setMigrating] = useState(false)
    const [migrationLogs, setMigrationLogs] = useState([])

    // ── COMPANY USERS & PERMISSION MANAGEMENT STATE ──
    const [companyUsers, setCompanyUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [employeesList, setEmployeesList] = useState([])
    const [createUserModal, setCreateUserModal] = useState(false)
    const [createUserLoading, setCreateUserLoading] = useState(false)
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
    const [editUserModal, setEditUserModal] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const [editUserLoading, setEditUserLoading] = useState(false)
    const [resetPasswordModal, setResetPasswordModal] = useState(false)
    const [resetPasswordData, setResetPasswordData] = useState({ userId: null, username: '', newPassword: '' })
    const [resetPasswordLoading, setResetPasswordLoading] = useState(false)

    const [newUserForm, setNewUserForm] = useState({
        username: '',
        email: '',
        password: '',
        fullName: '',
        role: 'manager',
        position: 'Operasyon & Puantör',
        phone: '',
        permissions: ROLE_PRESETS[1]?.levels || {}
    })

    const loadCompanyUsers = async () => {
        if (!currentCompany?.id) return
        setLoadingUsers(true)
        try {
            const [usersRes, empsRes] = await Promise.all([
                window.electronAPI?.getCompanyUsers ? window.electronAPI.getCompanyUsers(currentCompany.id) : { success: true, data: [] },
                window.electronAPI?.getEmployees ? window.electronAPI.getEmployees(currentCompany.id, 0) : { success: true, data: [] }
            ])
            
            let rawList = []
            if (usersRes?.success && Array.isArray(usersRes?.data)) {
                rawList = usersRes.data
            } else if (Array.isArray(usersRes)) {
                rawList = usersRes
            }

            // Strict company isolation: only show users strictly belonging to active company
            const strictlyCompanyUsers = rawList.filter(u => {
                if (u.role === 'superadmin' || u.accountType === 'superadmin') return false
                return u.company?.id === currentCompany.id
            })

            setCompanyUsers(strictlyCompanyUsers)

            if (empsRes?.success && empsRes?.data) {
                setEmployeesList(empsRes.data)
            } else if (Array.isArray(empsRes)) {
                setEmployeesList(empsRes)
            }
        } catch (err) {
            console.error('loadCompanyUsers error:', err)
        } finally {
            setLoadingUsers(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'users' && currentCompany?.id) {
            loadCompanyUsers()
        }
    }, [activeTab, currentCompany?.id])

    const handleEmployeeSelect = (empId) => {
        setSelectedEmployeeId(empId)
        if (!empId) return
        const emp = employeesList.find(e => String(e.id) === String(empId))
        if (emp) {
            const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
            const genUsername = (emp.first_name || 'kullanici').toLowerCase().replace(/[^a-z0-9]/g, '') + emp.id
            setNewUserForm(prev => ({
                ...prev,
                fullName,
                username: prev.username || genUsername,
                email: emp.email || prev.email || `${genUsername}@sirket.local`,
                phone: emp.phone || prev.phone || '',
                position: emp.position || 'Personel'
            }))
        }
    }

    const handleCreateUserSubmit = async (e) => {
        e.preventDefault()
        if (!newUserForm.username || !newUserForm.email || !newUserForm.password) {
            alert('Kullanıcı adı, e-posta ve şifre zorunludur')
            return
        }
        setCreateUserLoading(true)
        try {
            const res = await window.electronAPI?.createPlatformUser({
                ...newUserForm,
                employeeId: selectedEmployeeId || undefined,
                companyId: currentCompany.id
            })
            if (res?.success) {
                setCreateUserModal(false)
                setSelectedEmployeeId('')
                setNewUserForm({
                    username: '',
                    email: '',
                    password: '',
                    fullName: '',
                    role: 'manager',
                    position: 'Operasyon & Puantör',
                    phone: '',
                    permissions: ROLE_PRESETS[1]?.levels || {}
                })
                await loadCompanyUsers()
            } else {
                alert('Kullanıcı oluşturulamadı: ' + (res?.error || 'Bilinmeyen hata'))
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        } finally {
            setCreateUserLoading(false)
        }
    }

    const handleUpdateUserSubmit = async (e) => {
        e.preventDefault()
        if (!editingUser) return
        setEditUserLoading(true)
        try {
            const res = await window.electronAPI?.updatePlatformUser(editingUser.id, {
                fullName: editingUser.full_name || editingUser.fullName,
                email: editingUser.email,
                role: editingUser.role,
                isActive: editingUser.is_active
            })
            if (res?.success) {
                setEditUserModal(false)
                setEditingUser(null)
                await loadCompanyUsers()
            } else {
                alert('Güncelleme hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        } finally {
            setEditUserLoading(false)
        }
    }

    const handleToggleUserStatus = async (userId, currentStatus) => {
        try {
            const newStatus = (currentStatus === 1 || currentStatus === true) ? 0 : 1
            const res = await window.electronAPI?.toggleUserStatus(userId, newStatus)
            if (res?.success) {
                await loadCompanyUsers()
            } else {
                alert('Durum değiştirilemedi: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        }
    }

    const handleResetUser2FA = async (targetUser) => {
        if (!window.confirm(`"${targetUser.username}" kullanıcısının İki Adımlı Doğrulama (2FA) kilidini sıfırlamak istediğinize emin misiniz?`)) {
            return
        }
        try {
            const res = await window.electronAPI?.disableMfa(targetUser.id)
            if (res?.success) {
                alert(`"${targetUser.username}" kullanıcısının 2FA kilidi başarıyla sıfırlandı.`)
                await loadCompanyUsers()
            } else {
                alert('2FA sıfırlama hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        }
    }

    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault()
        if (!resetPasswordData.newPassword || resetPasswordData.newPassword.length < 4) {
            alert('Şifre en az 4 karakter olmalıdır')
            return
        }
        setResetPasswordLoading(true)
        try {
            const res = await window.electronAPI?.resetPlatformUserPassword(resetPasswordData.userId, resetPasswordData.newPassword)
            if (res?.success) {
                alert('Şifre başarıyla güncellendi')
                setResetPasswordModal(false)
                setResetPasswordData({ userId: null, username: '', newPassword: '' })
            } else {
                alert('Şifre sıfırlama hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        } finally {
            setResetPasswordLoading(false)
        }
    }

    const handleDeleteUser = async (userToDelete) => {
        if (userToDelete.id === user?.id) {
            alert('Kendi oturum açtığınız hesabı silemezsiniz')
            return
        }
        if (!window.confirm(`"${userToDelete.username}" kullanıcısını silmek istediğinize emin misiniz?`)) {
            return
        }
        try {
            const res = await window.electronAPI?.deletePlatformUser(userToDelete.id)
            if (res?.success) {
                await loadCompanyUsers()
            } else {
                alert('Silme hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        }
    }

    const handlePostgresMigration = async () => {
        const urlToUse = (postgresUrl || DEFAULT_CLOUD_PG_URL).trim()
        localStorage.setItem('aractakip_postgres_migration_url', urlToUse)
        setMigrating(true)
        setMigrationLogs([])
        
        const unsubscribe = window.electronAPI?.onMigrationLog ? window.electronAPI.onMigrationLog((logText) => {
            setMigrationLogs(prev => [...prev, logText])
        }) : () => {}
        
        try {
            if (!window.electronAPI?.migrateToPostgres) {
                alert('Bu işlem yalnızca Masaüstü uygulamasında (Electron) yerel veritabanını aktarmak için kullanılır.')
                return
            }
            const res = await window.electronAPI.migrateToPostgres(urlToUse)
            if (res.success) {
                const stats = []
                if (res.migratedCompanies) stats.push(`${res.migratedCompanies} Şirket`)
                if (res.migratedVehicles) stats.push(`${res.migratedVehicles} Araç`)
                if (res.migratedEmployees) stats.push(`${res.migratedEmployees} Personel`)
                if (res.migratedWorks) stats.push(`${res.migratedWorks} Operasyon`)
                const statsText = stats.length > 0 ? `\n\nAktarılan: ${stats.join(', ')}` : ''
                alert(`Aktarım başarıyla tamamlandı! Tüm veriler buluta güvenle yüklendi.${statsText}`)
            } else {
                alert(`Aktarım hatası: ${res.error}`)
            }
        } catch (err) {
            alert(`Sistem hatası: ${err.message}`)
        } finally {
            if (typeof unsubscribe === 'function') unsubscribe()
            setMigrating(false)
        }
    }

    const testArventoConnection = async () => {
        setTestingConnection(true)
        setConnectionTestResult(null)
        try {
            const result = await window.electronAPI.arventoTestConnection(settings.arvento)
            if (result.success) {
                setConnectionTestResult({ success: true, message: 'Bağlantı başarılı!' })
            } else {
                setConnectionTestResult({ success: false, message: `Bağlantı başarısız: ${result.error || 'Geçersiz kimlik bilgileri'}` })
            }
        } catch (error) {
            setConnectionTestResult({ success: false, message: `Hata: ${error.message}` })
        }
        setTestingConnection(false)
    }

    const hashPassword = async (str) => {
        if (!str) return ''
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    const handleLockSettingChange = async (key, value) => {
        let newLockSettings = { ...lockSettings, [key]: value }
        if (key === 'customPassword') {
            const hash = await hashPassword(value)
            newLockSettings.customPasswordHash = hash
        }
        setLockSettings(newLockSettings)

        const toSave = { ...newLockSettings }
        if (toSave.customPasswordHash) {
            delete toSave.customPassword
        }
        localStorage.setItem('aractakip_lock_settings', JSON.stringify(toSave))
        window.dispatchEvent(new CustomEvent('aractakip_lock_settings_changed', { detail: toSave }))
    }

    const toggleNotification = async (key) => {
        const newVal = !notifications[key]
        const newNotifications = { ...notifications, [key]: newVal }
        setNotifications(newNotifications)
        localStorage.setItem(`notify_${key}`, newVal)
        
        const currentSettings = await window.electronAPI.getSettings()
        await window.electronAPI.saveSettings({
            ...currentSettings,
            notificationPreferences: newNotifications
        })
    }

    useEffect(() => {
        loadSettings()
        loadAppVersion()

        window.electronAPI.onUpdateStatus((data) => {
            setUpdateStatus(data.status)
            if (data.info) setUpdateInfo(data.info)
            if (data.error) setErrorMsg(data.error)
        })

        window.electronAPI.onUpdateProgress((data) => {
            setUpdateStatus('downloading')
            setProgress(data.percent)
        })

        return () => {
            window.electronAPI.removeUpdateListeners()
        }
    }, [])

    const loadSettings = async () => {
        const data = await window.electronAPI.getSettings()
        setSettings({
            ...data,
            arvento: {
                enabled: false,
                username: '',
                pin1: '',
                pin2: '',
                language: 'tr',
                interval: 3,
                ...(data.arvento || {})
            }
        })
    }

    const loadAppVersion = async () => {
        const ver = await window.electronAPI.getAppVersion()
        setAppVersion(ver)
    }

    const handleSettingChange = async (key, value) => {
        const newSettings = {
            ...settings,
            [key]: value,
            userId: user?.id
        }
        setSettings(newSettings)
        await window.electronAPI.saveSettings(newSettings)
    }

    const handleArventoChange = async (key, value) => {
        const newArvento = {
            ...settings.arvento,
            [key]: value
        }
        const newSettings = {
            ...settings,
            arvento: newArvento,
            userId: user?.id
        }
        setSettings(newSettings)
        await window.electronAPI.saveSettings(newSettings)
    }

    const handleBackupPathSelect = async () => {
        const result = await window.electronAPI.selectFolder()
        if (result.filePaths && result.filePaths.length > 0) {
            handleSettingChange('backupPath', result.filePaths[0])
        }
    }

    const handleExport = async () => {
        if (!currentCompany) return
        const localStorageData = {}
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            localStorageData[key] = localStorage.getItem(key)
        }
        const result = await window.electronAPI.exportCompanyData({
            companyId: currentCompany.id,
            localStorageData,
            userId: user?.id
        })
        if (result.success) {
            window.electronAPI.showNotification('Başarılı', `Yedek alındı: ${result.filePath}`)
        } else {
            setErrorMsg(result.error)
        }
    }

    const handleImport = async () => {
        const result = await window.electronAPI.importCompanyData(user.id)
        if (result.success) {
            if (result.localStorage) {
                const { oldCompanyId, newCompanyId, localStorage: lsData } = result
                try {
                    const oldId = oldCompanyId ? oldCompanyId.toString() : ''
                    const newId = newCompanyId ? newCompanyId.toString() : ''
                    Object.entries(lsData).forEach(([key, value]) => {
                        if (oldId && newId && key.includes(oldId)) {
                            const newKey = key.replace(oldId, newId)
                            localStorage.setItem(newKey, value)
                        } else {
                            localStorage.setItem(key, value)
                        }
                    })
                    setNotifications({
                        maintenance: localStorage.getItem('notify_maintenance') !== 'false',
                        inspection: localStorage.getItem('notify_inspection') !== 'false',
                        insurance: localStorage.getItem('notify_insurance') !== 'false',
                        employee_document: localStorage.getItem('notify_employee_document') !== 'false',
                        finance_check: localStorage.getItem('notify_finance_check') !== 'false'
                    })
                    const newSettings = await window.electronAPI.getSettings()
                    setSettings(newSettings)
                } catch (err) {
                    console.error('LocalStorage restore error:', err)
                }
            }
            if (result.companyId) {
                localStorage.setItem('aractakip_company', result.companyId)
            }
            window.electronAPI.showNotification('Başarılı', 'Yedek başarıyla geri yüklendi. Sayfa yenileniyor...')
            setTimeout(() => window.location.reload(), 1500)
        } else {
            if (result.error !== 'Dosya seçilmedi' && result.error !== 'İşlem iptal edildi') {
                window.electronAPI.showNotification('Hata', result.error)
            }
        }
    }

    const checkForUpdates = async () => {
        setUpdateStatus('checking')
        setErrorMsg('')
        const result = await window.electronAPI.checkForUpdates()
        if (result && !result.success) {
            if (result.status === 'dev-mode') {
                setUpdateStatus('dev-mode')
            } else {
                setUpdateStatus('error')
                setErrorMsg(result.error || 'Kontrol edilemedi')
            }
        }
    }

    const downloadUpdate = async () => {
        setUpdateStatus('downloading')
        await window.electronAPI.downloadUpdate()
    }

    const quitAndInstall = async () => {
        await window.electronAPI.quitAndInstall()
    }

    const backupOptions = [
        { value: 'daily', label: 'Her Gün' },
        { value: 'weekly', label: 'Her Hafta' },
        { value: 'monthly', label: 'Her Ay' }
    ]

    const sidebarItems = [
        { id: 'general', label: 'Genel', icon: <Cog size={18} /> },
        { id: 'users', label: 'Kullanıcılar & Yetkiler', icon: <Users size={18} /> },
        { id: 'appearance', label: 'Görünüm', icon: <Palette size={18} /> },
        { id: 'security', label: 'Güvenlik', icon: <Shield size={18} /> },
        { id: 'notifications', label: 'Bildirimler', icon: <Bell size={18} /> },
        { id: 'data', label: 'Veri Yönetimi', icon: <Database size={18} /> },
        { id: 'arvento', label: 'Arvento Entegrasyonu', icon: <Globe size={18} /> },
    ]

    return (
        <div className="settings-page">
            <TopProgressBar loading={updateStatus === 'checking' || updateStatus === 'downloading'} />
            
            <div className="page-header">
                <div>
                    <h1 className="page-title">Ayarlar</h1>
                    <p style={{ marginTop: '5px', color: 'var(--text-muted)' }}>Uygulama tercihlerini yönetin.</p>
                </div>
            </div>

            <div className="settings-container">
                {/* Sidebar Navigation */}
                <div className="settings-sidebar">
                    {sidebarItems.map(item => (
                        <div 
                            key={item.id} 
                            className={`settings-sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="settings-content">
                    
                    {activeTab === 'general' && (
                        <div className="tab-fade-in">
                            <div className="settings-card">
                                <h2 className="settings-card-title"><User size={20} className="text-primary" /> Profil Bilgileri</h2>
                                <div className="profile-card">
                                    <div className="profile-avatar">
                                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div className="profile-details">
                                        <h3>{user?.username}</h3>
                                        <p>{user?.email}</p>
                                        <span className="profile-badge">Aktif Kullanıcı</span>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-card">
                                <h2 className="settings-card-title"><Globe size={20} className="text-primary" /> Sistem Bilgileri</h2>
                                <div className="settings-list">
                                    <div className="settings-item">
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Uygulama Versiyonu</div>
                                            <div className="settings-item-desc">Mevcut çalışan sürüm</div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                            <span className="badge badge-outline">v{appVersion}</span>
                                            {updateStatus === 'not-available' && <span className="text-success" style={{ fontSize: '11px' }}>Güncel</span>}
                                            {updateStatus === 'error' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                    <span className="text-danger" style={{ fontSize: '11px', textAlign: 'right' }}>
                                                        Hata: {errorMsg || 'Kurulum başlatılamadı'}
                                                    </span>
                                                    <button 
                                                        type="button"
                                                        className="btn btn-xs btn-outline-danger"
                                                        style={{ fontSize: '11px', padding: '2px 8px' }}
                                                        onClick={() => window.electronAPI.openExternal('https://github.com/ReJOnSTR/AracTakip/releases/latest')}
                                                    >
                                                        GitHub'dan İndir
                                                    </button>
                                                </div>
                                            )}
                                            
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {(updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'error' || updateStatus === 'dev-mode') && (
                                                    <button className="btn btn-sm btn-secondary" onClick={checkForUpdates} disabled={updateStatus === 'checking'}>
                                                        <RefreshCw size={14} /> Güncellemeleri Denetle
                                                    </button>
                                                )}
                                                {updateStatus === 'available' && (
                                                    <button className="btn btn-sm btn-primary" onClick={downloadUpdate}>
                                                        <Download size={14} /> İndir (v{updateInfo?.version})
                                                    </button>
                                                )}
                                                {updateStatus === 'downloaded' && (
                                                    <button className="btn btn-sm btn-success" onClick={quitAndInstall}>
                                                        <RefreshCw size={14} /> Kur & Yeniden Başlat
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {updateStatus === 'downloading' && (
                                        <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'stretch', background: 'rgba(var(--accent-primary-rgb), 0.03)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <Download size={16} className="text-primary" />
                                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Yeni Versiyon İndiriliyor</div>
                                                </div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', background: 'var(--accent-subtle)', padding: '2px 8px', borderRadius: '6px' }}>
                                                    %{Math.round(progress)}
                                                </div>
                                            </div>
                                            <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
                                                <div style={{ 
                                                    width: `${progress}%`, 
                                                    height: '100%', 
                                                    background: 'linear-gradient(90deg, var(--accent-primary), #6366f1)', 
                                                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    boxShadow: '0 0 12px rgba(var(--accent-primary-rgb), 0.4)'
                                                }}></div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lütfen uygulamayı kapatmayın...</span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{updateInfo?.version} sürümüne güncelleniyor</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="settings-item">
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Veritabanı Durumu</div>
                                            <div className="settings-item-desc">Yerel SQLite bağlantısı</div>
                                        </div>
                                        <span className="badge badge-success">BAĞLI</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="tab-fade-in">
                            <div className="settings-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                                    <div>
                                        <h2 className="settings-card-title" style={{ margin: 0 }}>
                                            <Users size={20} className="text-primary" /> Kullanıcılar & Yetki Yönetimi
                                        </h2>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Şirketinize ait kullanıcı hesaplarını, şifrelerini ve 3 seviyeli modül yetkilerini yönetin.
                                        </p>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="btn btn-primary" 
                                        onClick={() => {
                                            setSelectedEmployeeId('')
                                            setNewUserForm({
                                                username: '',
                                                email: '',
                                                password: '',
                                                fullName: '',
                                                role: 'manager',
                                                position: 'Operasyon & Puantör',
                                                phone: '',
                                                permissions: ROLE_PRESETS[1]?.levels || {}
                                            })
                                            setCreateUserModal(true)
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <UserPlus size={15} />
                                        <span>Yeni Kullanıcı Ekle</span>
                                    </button>
                                </div>

                                {loadingUsers ? (
                                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        Kullanıcılar yükleniyor...
                                    </div>
                                ) : companyUsers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                                        <Users size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Şirket kullanıcısı bulunamadı</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Personellerinize sistem erişimi vermek için yukarıdaki "+ Yeni Kullanıcı Ekle" butonunu kullanabilirsiniz.
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-secondary)' }}>
                                        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Kullanıcı</th>
                                                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Personel / Görev</th>
                                                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>İletişim</th>
                                                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Yetki Rolü</th>
                                                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>2FA</th>
                                                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Durum</th>
                                                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '150px' }}>İşlemler</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {companyUsers.map((u) => {
                                                    const rolePreset = ROLE_PRESETS.find(r => r.id === u.role)
                                                    const roleLabel = rolePreset ? rolePreset.label : (u.role === 'company_admin' ? 'Şirket Yöneticisi' : (u.role || 'Özel Yetki'))
                                                    const badgeClass = rolePreset ? rolePreset.badgeColor : (u.role === 'company_admin' ? 'badge-primary' : 'badge-neutral')
                                                    const isSelf = u.id === user?.id
                                                    const isActive = u.is_active === 1 || u.is_active === true
                                                    const is2FA = Boolean(u.two_factor_enabled === 1 || u.two_factor_enabled === true || u.has2FA)

                                                    return (
                                                        <tr key={u.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                                            <td style={{ padding: '10px 14px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <div style={{
                                                                        width: '32px',
                                                                        height: '32px',
                                                                        borderRadius: '50%',
                                                                        background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0d9488 100%)',
                                                                        color: '#ffffff',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontWeight: 700,
                                                                        fontSize: '12px',
                                                                        flexShrink: 0
                                                                    }}>
                                                                        {(u.full_name || u.username || 'U').charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                                                                            {u.full_name || u.username}
                                                                            {isSelf && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 600 }}>(Siz)</span>}
                                                                        </div>
                                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{u.username}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                                {u.employee ? (
                                                                    <div>
                                                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.employee.first_name} {u.employee.last_name}</div>
                                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.employee.position || 'Personel'}</div>
                                                                    </div>
                                                                ) : (
                                                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                                <div>{u.email}</div>
                                                                {u.phone && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.phone}</div>}
                                                            </td>
                                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                                <span className={`badge ${badgeClass}`} style={{ fontSize: '11px' }}>
                                                                    {roleLabel}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                                {is2FA ? (
                                                                    <span className="badge badge-success" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                        <Shield size={11} /> Açık
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kapalı</span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                                <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px' }}>
                                                                    {isActive ? 'Aktif' : 'Kilitli'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                                <div className="action-btns" style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center' }}>
                                                                    <button
                                                                        className="action-icon-btn"
                                                                        title="Yetkileri Düzenle"
                                                                        onClick={() => {
                                                                            setEditingUser({
                                                                                id: u.id,
                                                                                username: u.username,
                                                                                fullName: u.full_name || u.username,
                                                                                email: u.email,
                                                                                role: u.role || 'manager',
                                                                                is_active: u.is_active,
                                                                                permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {})
                                                                            })
                                                                            setEditUserModal(true)
                                                                        }}
                                                                    >
                                                                        <Edit2 size={14} />
                                                                    </button>
                                                                    <button
                                                                        className="action-icon-btn"
                                                                        title="Şifre Sıfırla"
                                                                        onClick={() => {
                                                                            setResetPasswordData({ userId: u.id, username: u.username, newPassword: '' })
                                                                            setResetPasswordModal(true)
                                                                        }}
                                                                    >
                                                                        <Key size={14} />
                                                                    </button>
                                                                    {is2FA && (
                                                                        <button
                                                                            className="action-icon-btn"
                                                                            title="2FA Kilidini Sıfırla"
                                                                            onClick={() => handleResetUser2FA(u)}
                                                                            style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                                                                        >
                                                                            <Shield size={14} />
                                                                        </button>
                                                                    )}
                                                                    {!isSelf && (
                                                                        <>
                                                                            <button
                                                                                className="action-icon-btn"
                                                                                title={isActive ? 'Hesabı Kilitle' : 'Kilidi Aç'}
                                                                                style={isActive ? { color: '#f59e0b' } : { color: '#10b981' }}
                                                                                onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                                                                            >
                                                                                {isActive ? <Lock size={14} /> : <Unlock size={14} />}
                                                                            </button>
                                                                            <button
                                                                                className="action-icon-btn danger"
                                                                                title="Kullanıcıyı Sil"
                                                                                onClick={() => handleDeleteUser(u)}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="tab-fade-in">
                            <div className="settings-card">
                                <h2 className="settings-card-title"><Palette size={20} className="text-primary" /> Görünüm Ayarları</h2>
                                    <div className="settings-item">
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Tema Tercihi</div>
                                            <div className="settings-item-desc">Açık veya koyu tema arasında geçiş yapın</div>
                                        </div>
                                        
                                        <div 
                                            className={`premium-theme-toggle ${theme}`}
                                            onClick={toggleTheme}
                                        >
                                            <div className="active-bg"></div>
                                            <div className={`toggle-icon-container light ${theme === 'light' ? 'active' : ''}`}>
                                                <Sun size={18} />
                                            </div>
                                            <div className={`toggle-icon-container dark ${theme === 'dark' ? 'active' : ''}`}>
                                                <Moon size={18} />
                                            </div>
                                        </div>
                                    </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="tab-fade-in">
                            <div className="settings-card">
                                <h2 className="settings-card-title"><Shield size={20} className="text-primary" /> Uygulama Güvenliği</h2>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                    Uygulamanın güvenliğini ve otomatik kilitleme tercihlerini yönetin.
                                </p>

                                <div className="settings-list">
                                    <div className="settings-item">
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Otomatik Kilitleme</div>
                                            <div className="settings-item-desc">Belirli bir süre işlem yapılmadığında uygulamayı kilitler.</div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input 
                                                type="checkbox" 
                                                checked={lockSettings.enabled} 
                                                onChange={(e) => handleLockSettingChange('enabled', e.target.checked)} 
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    {lockSettings.enabled && (
                                        <>
                                            <div className="settings-item">
                                                <div className="settings-item-content">
                                                    <div className="settings-item-label">Kilitleme Süresi (Dakika)</div>
                                                    <div className="settings-item-desc">Kaç dakika hareketsizlikten sonra kilitlensin?</div>
                                                </div>
                                                <div style={{ width: '80px' }}>
                                                    <input 
                                                        type="number" 
                                                        className="form-input text-center" 
                                                        value={lockSettings.timeout}
                                                        min="1"
                                                        max="60"
                                                        onChange={(e) => handleLockSettingChange('timeout', parseInt(e.target.value) || 1)}
                                                        style={{ padding: '8px' }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="settings-item">
                                                <div className="settings-item-content">
                                                    <div className="settings-item-label">Özel Kilit Şifresi Kullan</div>
                                                    <div className="settings-item-desc">Giriş şifresi yerine farklı bir şifre ile kilit açma.</div>
                                                </div>
                                                <label className="toggle-switch">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={lockSettings.useCustomPassword} 
                                                        onChange={(e) => handleLockSettingChange('useCustomPassword', e.target.checked)} 
                                                    />
                                                    <span className="toggle-slider"></span>
                                                </label>
                                            </div>

                                            {lockSettings.useCustomPassword && (
                                                <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                                                    <div className="settings-item-label">Kilit Şifresini Belirle</div>
                                                    <div style={{ width: '100%', position: 'relative' }}>
                                                        <input 
                                                            type={showLockPass ? 'text' : 'password'} 
                                                            className="form-input" 
                                                            placeholder="Yeni kilit şifresi"
                                                            value={lockSettings.customPassword}
                                                            onChange={(e) => handleLockSettingChange('customPassword', e.target.value)}
                                                            maxLength={64}
                                                            style={{ paddingRight: '45px' }}
                                                        />
                                                        <button 
                                                            type="button"
                                                            className="password-toggle-btn" 
                                                            onClick={() => setShowLockPass(!showLockPass)}
                                                            title={showLockPass ? "Şifreyi Gizle" : "Şifreyi Göster"}
                                                        >
                                                            {showLockPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="tab-fade-in">
                            <div className="settings-card">
                                <h2 className="settings-card-title"><Bell size={20} className="text-primary" /> Bildirim Tercihleri</h2>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                    Hangi işlemler için hatırlatma almak istediğinizi buradan yönetebilirsiniz.
                                </p>
                                
                                <div className="settings-grid">
                                    <div className="settings-item card-style">
                                        <div className="settings-item-icon"><Wrench size={18} /></div>
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Bakım Bildirimleri</div>
                                            <div className="settings-item-desc">Servis ve periyodik bakımlar</div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={notifications.maintenance} onChange={() => toggleNotification('maintenance')} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    <div className="settings-item card-style">
                                        <div className="settings-item-icon"><ClipboardCheck size={18} /></div>
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Muayene Bildirimleri</div>
                                            <div className="settings-item-desc">Trafik ve egzoz muayeneleri</div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={notifications.inspection} onChange={() => toggleNotification('inspection')} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    <div className="settings-item card-style">
                                        <div className="settings-item-icon"><Shield size={18} /></div>
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Sigorta Bildirimleri</div>
                                            <div className="settings-item-desc">Kasko ve trafik sigortaları</div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={notifications.insurance} onChange={() => toggleNotification('insurance')} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    <div className="settings-item card-style">
                                        <div className="settings-item-icon"><User size={18} /></div>
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Personel Belgeleri</div>
                                            <div className="settings-item-desc">Ehliyet, SRC ve diğer belgeler</div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={notifications.employee_document} onChange={() => toggleNotification('employee_document')} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    <div className="settings-item card-style">
                                        <div className="settings-item-icon"><Wallet size={18} /></div>
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Finans Bildirimleri</div>
                                            <div className="settings-item-desc">Çek ve senet vadesi uyarıları</div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={notifications.finance_check} onChange={() => toggleNotification('finance_check')} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    <div className="settings-item card-style">
                                        <div className="settings-item-icon"><CheckCircle size={18} /></div>
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Personel Onay Merkezi</div>
                                            <div className="settings-item-desc">İzin, mesai, avans ve onay talepleri</div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={notifications.approval_center} onChange={() => toggleNotification('approval_center')} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>

                                <div className="settings-section-divider" style={{ margin: '30px 0', borderTop: '1px solid var(--border-color)' }}></div>

                                <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Clock size={18} className="text-primary" /> Günlük Hatırlatıcı Özeti
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                    Belirlediğiniz saatte, yaklaşan ve geciken tüm işlemlerin toplu özetini bildirim olarak alın.
                                </p>

                                <div className="settings-list">
                                    <div className="settings-item card-style">
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Günlük Özet Bildirimi</div>
                                            <div className="settings-item-desc">Tüm yaklaşan/gecikmiş işleri tek bildirimde raporlar.</div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input 
                                                type="checkbox" 
                                                checked={settings.notificationSummaryEnabled || false} 
                                                onChange={(e) => handleSettingChange('notificationSummaryEnabled', e.target.checked)} 
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    {settings.notificationSummaryEnabled && (
                                        <div className="settings-item card-style">
                                            <div className="settings-item-content">
                                                <div className="settings-item-label">Hatırlatma Saati</div>
                                                <div className="settings-item-desc">Özet bildirimi her gün saat kaçta gönderilsin?</div>
                                            </div>
                                            <input 
                                                type="time" 
                                                className="form-input" 
                                                style={{ width: '120px' }}
                                                value={settings.notificationSummaryTime || '09:00'}
                                                onChange={(e) => handleSettingChange('notificationSummaryTime', e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="tab-fade-in">
                            <div className="settings-card">
                                <h2 className="settings-card-title"><Database size={20} className="text-primary" /> Yedekleme ve Geri Yükleme</h2>
                                <div className="settings-item" style={{ alignItems: 'flex-start' }}>
                                    <div className="settings-item-content">
                                        <div className="settings-item-label">Manuel Yedekleme</div>
                                        <div className="settings-item-desc">Mevcut şirket verilerini ve yerel ayarları bir dosyaya kaydeder.</div>
                                        <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                                            <button className="btn btn-secondary" onClick={handleExport} disabled={!currentCompany}>
                                                <Download size={16} /> Verileri Dışa Aktar
                                            </button>
                                            <button className="btn btn-secondary" onClick={handleImport}>
                                                <Upload size={16} /> Verileri İçe Aktar
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-item" style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                                    <div className="settings-item-content">
                                        <div className="settings-item-label" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            Otomatik Yedekleme
                                            {settings.autoBackup && <span className="badge badge-success" style={{ fontSize: '9px', padding: '2px 6px' }}>AKTİF</span>}
                                        </div>
                                        <div className="settings-item-desc">Belirlenen aralıklarla arka planda yedek alır.</div>
                                    </div>
                                    <label className="toggle-switch">
                                        <input 
                                            type="checkbox" 
                                            checked={settings.autoBackup} 
                                            onChange={(e) => handleSettingChange('autoBackup', e.target.checked)} 
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>

                                {settings.autoBackup && (
                                    <div className="auto-backup-config" style={{ 
                                        marginTop: '20px', 
                                        background: 'rgba(0, 0, 0, 0.02)', 
                                        padding: '24px', 
                                        borderRadius: '16px',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '20px'
                                    }}>
                                        <div style={{ maxWidth: '300px' }}>
                                            <CustomSelect 
                                                label="Yedekleme Sıklığı"
                                                options={backupOptions}
                                                value={settings.frequency}
                                                onChange={(val) => handleSettingChange('frequency', val)}
                                            />
                                        </div>

                                        <div className="form-group floating-label-group has-value" style={{ margin: 0 }}>
                                            <div className="input-wrapper">
                                                <input 
                                                    type="text" 
                                                    className="form-input" 
                                                    readOnly 
                                                    value={settings.backupPath || 'Varsayılan (Belgelerim)'} 
                                                    style={{ background: 'var(--bg-primary)' }}
                                                />
                                                <label className="form-label">Yedekleme Klasörü</label>
                                                <button 
                                                    className="btn btn-secondary" 
                                                    style={{ height: '42px', minWidth: '42px', padding: 0 }} 
                                                    onClick={handleBackupPathSelect}
                                                    title="Klasör Seç"
                                                >
                                                    <Folder size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="settings-card" style={{ marginTop: '24px' }}>
                                <h2 className="settings-card-title"><RefreshCw size={20} className="text-primary" /> PostgreSQL Veri Aktarımı</h2>
                                <div className="settings-item" style={{ alignItems: 'flex-start' }}>
                                    <div className="settings-item-content" style={{ width: '100%' }}>
                                        <div className="settings-item-label">Veritabanını Sunucuya Kopyala</div>
                                        <div className="settings-item-desc" style={{ marginBottom: '16px' }}>
                                            Yerel bilgisayarınızdaki verileri buluttaki PostgreSQL veritabanınıza aktarır. Farklı bilgisayarlardan sırayla aktarım yapabilirsiniz; şirketler ve hesaplar birbirine karışmaz, önceki bilgisayarların verileri silinmez.
                                        </div>
                                        
                                        <div className="form-group floating-label-group has-value" style={{ maxWidth: '600px', marginBottom: '16px' }}>
                                            <div className="input-wrapper">
                                                <input 
                                                    type="text" 
                                                    className="form-input" 
                                                    value={postgresUrl} 
                                                    onChange={(e) => setPostgresUrl(e.target.value)}
                                                    maxLength={250}
                                                    placeholder="postgresql://kullanici:sifre@sunucu:5432/veritabani"
                                                />
                                                <label className="form-label">PostgreSQL Bağlantı Adresi (URI)</label>
                                            </div>
                                        </div>

                                        <button 
                                            className="btn btn-primary" 
                                            onClick={handlePostgresMigration} 
                                            disabled={migrating}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            {migrating ? <RefreshCw size={16} className="spin" /> : <Database size={16} />}
                                            {migrating ? 'Aktarılıyor...' : 'Aktarımı Başlat'}
                                        </button>

                                        {migrationLogs.length > 0 && (
                                            <div style={{ 
                                                marginTop: '20px', 
                                                background: 'var(--bg-tertiary)', 
                                                border: '1px solid var(--border-color)', 
                                                borderRadius: '12px', 
                                                padding: '16px', 
                                                maxHeight: '200px', 
                                                overflowY: 'auto',
                                                fontFamily: 'monospace',
                                                fontSize: '12px',
                                                lineHeight: '1.6',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                                                    Aktarım Günlüğü (Logs)
                                                </div>
                                                {migrationLogs.map((log, idx) => (
                                                    <div key={idx} style={{ color: log.startsWith('Hata:') ? 'var(--danger)' : log.startsWith('Başarıyla') || log.includes('tamamlandı') ? 'var(--success)' : 'inherit' }}>
                                                        {log}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'arvento' && (
                        <div className="tab-fade-in">
                            <div className="settings-card">
                                <h2 className="settings-card-title"><Globe size={20} className="text-primary" style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Arvento Entegrasyonu</h2>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                    Arvento API hizmetini kullanarak araçlarınızın konum, hız ve alarm bilgilerini sisteme aktarın.
                                </p>

                                <div className="settings-list">
                                    <div className="settings-item card-style">
                                        <div className="settings-item-content">
                                            <div className="settings-item-label">Entegrasyonu Etkinleştir</div>
                                            <div className="settings-item-desc">Arvento servisinin arka planda çalışmasını sağlar.</div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input 
                                                type="checkbox" 
                                                checked={settings.arvento?.enabled || false} 
                                                onChange={(e) => handleArventoChange('enabled', e.target.checked)} 
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    <div style={{ 
                                        marginTop: '12px', 
                                        background: 'rgba(0, 0, 0, 0.02)', 
                                        padding: '16px 20px', 
                                        borderRadius: '16px',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        opacity: settings.arvento?.enabled ? 1 : 0.5,
                                        pointerEvents: settings.arvento?.enabled ? 'auto' : 'none',
                                        transition: 'all 0.3s ease',
                                        userSelect: settings.arvento?.enabled ? 'auto' : 'none'
                                    }}>
                                        {/* Row 1: Username, Language, Interval */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'end' }}>
                                            <CustomInput
                                                label="Kullanıcı Adı"
                                                value={settings.arvento?.username || ''}
                                                onChange={(val) => handleArventoChange('username', val)}
                                                required
                                                disabled={!settings.arvento?.enabled}
                                                maxLength={50}
                                            />

                                            <CustomInput
                                                label="Dil Kodu"
                                                value={settings.arvento?.language || 'tr'}
                                                onChange={(val) => handleArventoChange('language', val)}
                                                placeholder="Örn: tr, en"
                                                disabled={!settings.arvento?.enabled}
                                                maxLength={10}
                                            />

                                            <CustomSelect 
                                                label="Veri Çekme Sıklığı"
                                                options={[
                                                    { value: 1, label: '1 Dakika' },
                                                    { value: 2, label: '2 Dakika' },
                                                    { value: 3, label: '3 Dakika' },
                                                    { value: 5, label: '5 Dakika' },
                                                    { value: 10, label: '10 Dakika' }
                                                ]}
                                                value={settings.arvento?.interval || 3}
                                                onChange={(val) => handleArventoChange('interval', parseInt(val))}
                                                required
                                                disabled={!settings.arvento?.enabled}
                                            />
                                        </div>

                                        {/* Row 2: PIN 1, PIN 2, Test Button */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'end' }}>
                                            <CustomInput
                                                type="password"
                                                label="PIN 1"
                                                value={settings.arvento?.pin1 || ''}
                                                onChange={(val) => handleArventoChange('pin1', val)}
                                                required
                                                disabled={!settings.arvento?.enabled}
                                                maxLength={50}
                                            />

                                            <CustomInput
                                                type="password"
                                                label="PIN 2"
                                                value={settings.arvento?.pin2 || ''}
                                                onChange={(val) => handleArventoChange('pin2', val)}
                                                required
                                                disabled={!settings.arvento?.enabled}
                                                maxLength={50}
                                            />

                                            <div style={{ width: '100%', marginBottom: '16px' }}>
                                                <button 
                                                    className="btn btn-secondary" 
                                                    onClick={testArventoConnection}
                                                    disabled={testingConnection || !settings.arvento?.username || !settings.arvento?.pin1 || !settings.arvento?.enabled}
                                                    style={{ height: '36px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    {testingConnection ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Row 3: Test Status Message */}
                                        {connectionTestResult && (
                                            <div style={{ 
                                                marginTop: '-4px', 
                                                fontSize: '12px', 
                                                fontWeight: 500, 
                                                color: connectionTestResult.success ? 'var(--success)' : 'var(--danger)',
                                                display: 'flex',
                                                justifyContent: 'flex-start',
                                                animation: 'fadeIn 0.2s ease'
                                            }}>
                                                {connectionTestResult.message}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Create User Modal */}
            {createUserModal && (
                <Modal
                    isOpen={createUserModal}
                    onClose={() => setCreateUserModal(false)}
                    title="Şirkete Yeni Kullanıcı Ekle"
                    size="xl"
                >
                    <form onSubmit={handleCreateUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Top Section: User Details Card */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            padding: '16px'
                        }}>
                            {employeesList.length > 0 && (
                                <div style={{ marginBottom: '12px' }}>
                                    <CustomSelect
                                        label="Personelden Otomatik Doldur (İsteğe Bağlı)"
                                        placeholder="Personel seçiniz..."
                                        options={[
                                            { value: '', label: 'Personel Seçmeden Manuel Oluştur' },
                                            ...employeesList.map(e => ({
                                                value: String(e.id),
                                                label: `${e.first_name} ${e.last_name} (${e.position || 'Personel'})`
                                            }))
                                        ]}
                                        value={selectedEmployeeId}
                                        onChange={(val) => handleEmployeeSelect(val)}
                                    />
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                <CustomInput
                                    label="Kullanıcı Adı"
                                    value={newUserForm.username}
                                    onChange={(val) => setNewUserForm(prev => ({ ...prev, username: val.toLowerCase().trim() }))}
                                    required
                                    placeholder="ornek.kullanici"
                                />

                                <CustomInput
                                    type="email"
                                    label="E-Posta Adresi"
                                    value={newUserForm.email}
                                    onChange={(val) => setNewUserForm(prev => ({ ...prev, email: val.toLowerCase().trim() }))}
                                    required
                                    placeholder="ornek@sirket.com"
                                />

                                <CustomInput
                                    type="password"
                                    label="Giriş Şifresi"
                                    value={newUserForm.password}
                                    onChange={(val) => setNewUserForm(prev => ({ ...prev, password: val }))}
                                    required
                                    placeholder="••••••••"
                                />

                                <CustomInput
                                    label="Ad Soyad"
                                    value={newUserForm.fullName}
                                    onChange={(val) => setNewUserForm(prev => ({ ...prev, fullName: val }))}
                                    placeholder="Örn: Ahmet Yılmaz"
                                />

                                <CustomInput
                                    label="Telefon Numarası"
                                    value={newUserForm.phone}
                                    onChange={(val) => setNewUserForm(prev => ({ ...prev, phone: val }))}
                                    placeholder="05XX XXX XX XX"
                                    format="phone"
                                    maxLength={14}
                                />
                            </div>
                        </div>

                        {/* 3-Level Permission Matrix (Wide 2-Column Split Layout) */}
                        <PermissionMatrix
                            selectedPreset={newUserForm.role}
                            onPresetChange={(presetId, levels) => {
                                setNewUserForm(prev => ({
                                    ...prev,
                                    role: presetId,
                                    permissions: levels
                                }))
                            }}
                            permissionLevels={newUserForm.permissions || {}}
                            onLevelChange={(moduleKey, level) => {
                                setNewUserForm(prev => ({
                                    ...prev,
                                    permissions: {
                                        ...(prev.permissions || {}),
                                        [moduleKey]: level
                                    }
                                }))
                            }}
                        />

                        <div className="modal-footer" style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setCreateUserModal(false)}>
                                İptal
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={createUserLoading}>
                                {createUserLoading ? 'Ekleniyor...' : 'Kullanıcıyı Oluştur'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Edit User & Permissions Modal */}
            {editUserModal && editingUser && (
                <Modal
                    isOpen={editUserModal}
                    onClose={() => { setEditUserModal(false); setEditingUser(null); }}
                    title={`Yetkileri Düzenle: ${editingUser.fullName || editingUser.username}`}
                    size="xl"
                >
                    <form onSubmit={handleUpdateUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* 3-Level Permission Matrix (Ultra-clean 2-Column Split Layout) */}
                        <PermissionMatrix
                            selectedPreset={editingUser.role}
                            onPresetChange={(presetId, levels) => {
                                setEditingUser(prev => ({
                                    ...prev,
                                    role: presetId,
                                    permissions: levels
                                }))
                            }}
                            permissionLevels={editingUser.permissions || {}}
                            onLevelChange={(moduleKey, level) => {
                                setEditingUser(prev => ({
                                    ...prev,
                                    permissions: {
                                        ...(prev.permissions || {}),
                                        [moduleKey]: level
                                    }
                                }))
                            }}
                        />

                        <div className="modal-footer" style={{ marginTop: '4px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => { setEditUserModal(false); setEditingUser(null); }}>
                                İptal
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={editUserLoading}>
                                {editUserLoading ? 'Kaydediliyor...' : 'Yetkileri Kaydet'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Reset Password Modal */}
            {resetPasswordModal && (
                <Modal
                    isOpen={resetPasswordModal}
                    onClose={() => setResetPasswordModal(false)}
                    title={`Şifre Sıfırla: ${resetPasswordData.username}`}
                    size="default"
                >
                    <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                            <strong>@{resetPasswordData.username}</strong> kullanıcısı için yeni bir giriş şifresi belirleyin.
                        </p>

                        <CustomInput
                            type="password"
                            label="Yeni Şifre"
                            value={resetPasswordData.newPassword}
                            onChange={(val) => setResetPasswordData(prev => ({ ...prev, newPassword: val }))}
                            required
                            placeholder="Yeni şifre giriniz..."
                            minLength={4}
                        />

                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setResetPasswordModal(false)}>
                                İptal
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={resetPasswordLoading || !resetPasswordData.newPassword}>
                                {resetPasswordLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

        </div>
    )
}
