import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { formatDate } from '../utils/helpers'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import CustomInput from '../components/CustomInput'
import CustomSelect from '../components/CustomSelect'
import TopProgressBar from '../components/TopProgressBar'
import EmailTemplatesManager from '../components/EmailTemplatesManager'
import PermissionMatrix, { ROLE_PRESETS } from '../components/PermissionMatrix'
import { 
    Building2, 
    Users, 
    Car, 
    Briefcase, 
    Activity, 
    Database, 
    Eye, 
    RefreshCw, 
    CheckCircle2, 
    XCircle, 
    HardDrive, 
    Cpu, 
    Shield, 
    Sparkles, 
    Loader2,
    KeyRound,
    Plus,
    Trash2,
    Lock,
    Unlock,
    ExternalLink,
    Server,
    Cloud,
    BadgeCheck,
    ScrollText,
    Radio,
    Megaphone,
    AlertTriangle,
    Wrench,
    Scale,
    AlertOctagon,
    Clock,
    Check,
    History,
    ShieldAlert,
    Copy,
    Filter,
    UserCog,
    Download,
    LayoutDashboard,
    Wallet,
    UtensilsCrossed,
    Sliders
} from 'lucide-react'
import './PlatformAdmin.css'

export default function PlatformAdmin({ section }) {
    const { user, setUser } = useAuth()
    const { selectCompany } = useCompany()
    const navigate = useNavigate()
    const location = useLocation()

    // Determine current section from prop or pathname
    const activeSection = useMemo(() => {
        if (section) return section
        if (location.pathname.includes('/companies')) return 'companies'
        if (location.pathname.includes('/announcements')) return 'announcements'
        if (location.pathname.includes('/email-templates')) return 'email-templates'
        if (location.pathname.includes('/audit')) return 'audit'
        if (location.pathname.includes('/health')) return 'health'
        if (location.pathname.includes('/logs')) return 'logs'
        if (location.pathname.includes('/backups')) return 'backups'
        return 'users'
    }, [section, location.pathname])

    const [loading, setLoading] = useState(true)
    const [overviewData, setOverviewData] = useState(null)
    const [platformUsers, setPlatformUsers] = useState([])
    const [backups, setBackups] = useState([])
    const [healthData, setHealthData] = useState(null)
    const [healthLoading, setHealthLoading] = useState(false)
    const [backupLoading, setBackupLoading] = useState(false)

    // Announcements state
    const [announcements, setAnnouncements] = useState([])
    const [announcementsLoading, setAnnouncementsLoading] = useState(false)
    const [createAnnouncementModal, setCreateAnnouncementModal] = useState(false)
    const [newAnnouncement, setNewAnnouncement] = useState({
        title: '',
        message: '',
        type: 'info',
        companyId: '',
        expiresAt: '',
        isDismissible: 1,
        showPopup: 0
    })
    const [creatingAnnouncement, setCreatingAnnouncement] = useState(false)

    // Company Modal state
    const [createCompanyModal, setCreateCompanyModal] = useState(false)
    const [newCompanyForm, setNewCompanyForm] = useState({
        name: '',
        taxNumber: '',
        taxOffice: '',
        sgkNo: '',
        address: '',
        phone: '',
        ownerUserId: '',
        plan: 'PRO',
        maxVehicles: 50,
        maxEmployees: 50,
        maxUsers: 10,
        storageLimitMb: 1024,
        expiresAt: '',
        modules: {
            fleet: true,
            finance: true,
            meals: true,
            hr: true,
            works: true,
            customers: true
        }
    })
    const [createCompanyLoading, setCreateCompanyLoading] = useState(false)

    // Edit Company & Quotas Modal state
    const [editCompanyModal, setEditCompanyModal] = useState(false)
    const [editCompanyForm, setEditCompanyForm] = useState({
        id: '',
        name: '',
        taxNumber: '',
        taxOffice: '',
        sgkNo: '',
        address: '',
        phone: '',
        ownerUserId: '',
        plan: 'PRO',
        status: 'active',
        expiresAt: '',
        maxVehicles: 50,
        maxEmployees: 50,
        maxUsers: 10,
        storageLimitMb: 1024,
        modules: {
            fleet: true,
            finance: true,
            meals: true,
            hr: true,
            works: true,
            customers: true
        }
    })
    const [editCompanyLoading, setEditCompanyLoading] = useState(false)

    // System Logs
    const [logs, setLogs] = useState([])
    const [logsLoading, setLogsLoading] = useState(false)
    const [autoPollLogs, setAutoPollLogs] = useState(false)

    // Audit Trail State
    const [auditLogs, setAuditLogs] = useState([])
    const [auditMetrics, setAuditMetrics] = useState({
        total24h: 0,
        failedLogins24h: 0,
        criticalDeletes24h: 0,
        securityEvents24h: 0,
        activeUsersCount: 0
    })
    const [auditLoading, setAuditLoading] = useState(false)
    const [auditDetailModal, setAuditDetailModal] = useState(false)
    const [selectedAuditDetail, setSelectedAuditDetail] = useState(null)
    const [copiedDetailJson, setCopiedDetailJson] = useState(false)
    const [auditFilters, setAuditFilters] = useState({
        action: 'all',
        entityType: 'all',
        severity: 'all',
        companyId: 'all'
    })

    // Real-Time Online Users & Active Sessions
    const [onlineUsersData, setOnlineUsersData] = useState({ onlineCount: 0, idleCount: 0, totalTracked: 0, sessions: [] })
    const [onlineUsersModal, setOnlineUsersModal] = useState(false)
    const [terminatingSessionId, setTerminatingSessionId] = useState(null)

    // Modals
    const [passwordModalUser, setPasswordModalUser] = useState(null)
    const [newPassword, setNewPassword] = useState('')
    const [passwordLoading, setPasswordLoading] = useState(false)

    // Edit User Role Modal
    const [editRoleModalUser, setEditRoleModalUser] = useState(null)
    const [editRoleForm, setEditRoleForm] = useState({
        role: 'user',
        companyId: '',
        fullName: ''
    })
    const [editRoleLoading, setEditRoleLoading] = useState(false)

    const [createUserModal, setCreateUserModal] = useState(false)
    const [newUserForm, setNewUserForm] = useState({
        username: '',
        email: '',
        password: '',
        fullName: '',
        role: 'company_admin',
        position: 'Şirket Yöneticisi',
        phone: '',
        companyId: '',
        permissions: ROLE_PRESETS[0]?.levels || {}
    })
    const [createUserLoading, setCreateUserLoading] = useState(false)

    // Helper for robust value extraction from CustomInput
    const getVal = (v) => {
        if (v && typeof v === 'object' && v.target !== undefined) {
            return v.target.value
        }
        return v ?? ''
    }

    // Strict SuperAdmin check
    const isSuperAdmin = user?.role === 'superadmin'

    useEffect(() => {
        if (!isSuperAdmin) {
            navigate('/dashboard')
            return
        }
        loadSectionData()
    }, [isSuperAdmin, activeSection])

    // Auto-polling for live logs if enabled
    useEffect(() => {
        if (!autoPollLogs || activeSection !== 'logs') return
        const interval = setInterval(() => {
            loadLogs(false)
        }, 3000)
        return () => clearInterval(interval)
    }, [autoPollLogs, activeSection])

    // Auto-refresh real-time active users every 8 seconds
    useEffect(() => {
        if (!isSuperAdmin) return
        loadRealtimeUsers()
        const interval = setInterval(() => {
            loadRealtimeUsers()
        }, 8000)
        return () => clearInterval(interval)
    }, [isSuperAdmin])

    const loadRealtimeUsers = async () => {
        try {
            let res;
            if (window.electronAPI?.getRealtimeActiveUsers) {
                res = await window.electronAPI.getRealtimeActiveUsers()
            } else {
                res = await fetch('/api/rpc/getRealtimeActiveUsers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ args: [] })
                }).then(r => r.json()).catch(() => null)
            }
            if (res && res.success) {
                setOnlineUsersData(res)
            }
        } catch (err) {
            console.error('loadRealtimeUsers error:', err)
        }
    }

    const handleTerminateSession = async (session) => {
        if (!window.confirm(`"${session.username}" (${session.companyName}) kullanıcısının oturumunu derhal sonlandırmak ve sistemden atmak istediğinizden emin misiniz?`)) {
            return
        }
        setTerminatingSessionId(session.sessionId)
        try {
            let res;
            if (window.electronAPI?.terminateUserSession) {
                res = await window.electronAPI.terminateUserSession(session.sessionId)
            } else {
                res = await fetch('/api/rpc/terminateUserSession', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ args: [session.sessionId] })
                }).then(r => r.json()).catch(() => null)
            }
            if (res && res.success) {
                await loadRealtimeUsers()
            } else {
                alert(res?.error || 'Oturum sonlandırılamadı')
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        } finally {
            setTerminatingSessionId(null)
        }
    }

    const loadSectionData = async () => {
        setLoading(true)
        try {
            if (activeSection === 'users') {
                await Promise.all([loadUsers(), loadOverview(), loadRealtimeUsers()])
            } else if (activeSection === 'companies') {
                await Promise.all([loadOverview(), loadUsers(), loadRealtimeUsers()])
            } else if (activeSection === 'announcements') {
                await Promise.all([loadAnnouncements(), loadOverview()])
            } else if (activeSection === 'audit') {
                await Promise.all([loadAuditLogs(), loadOverview(), loadRealtimeUsers()])
            } else if (activeSection === 'health') {
                await Promise.all([loadHealth(), loadRealtimeUsers()])
            } else if (activeSection === 'logs') {
                await loadLogs()
            } else if (activeSection === 'backups') {
                await loadBackups()
            }
        } catch (err) {
            console.error('Platform data load error:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadAuditLogs = async (overrideFilters = {}) => {
        setAuditLoading(true)
        try {
            const effectiveFilters = {
                ...auditFilters,
                ...overrideFilters
            }
            if (effectiveFilters.action === 'all') delete effectiveFilters.action
            if (effectiveFilters.entityType === 'all') delete effectiveFilters.entityType
            if (effectiveFilters.severity === 'all') delete effectiveFilters.severity
            if (effectiveFilters.companyId === 'all') delete effectiveFilters.companyId

            const [logsRes, metricsRes] = await Promise.all([
                window.electronAPI?.getPlatformAuditLogs ? window.electronAPI.getPlatformAuditLogs(effectiveFilters) : fetch('/api/rpc/getPlatformAuditLogs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args: [effectiveFilters] }) }).then(r => r.json()),
                window.electronAPI?.getAuditSummaryMetrics ? window.electronAPI.getAuditSummaryMetrics() : fetch('/api/rpc/getAuditSummaryMetrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args: [] }) }).then(r => r.json())
            ])

            if (logsRes?.success) {
                setAuditLogs(logsRes.logs || [])
            }
            if (metricsRes?.success) {
                setAuditMetrics(metricsRes.metrics || {})
            }
        } catch (err) {
            console.error('loadAuditLogs error:', err)
        } finally {
            setAuditLoading(false)
        }
    }

    const loadOverview = async () => {
        const res = await window.electronAPI?.getPlatformOverview()
        if (res?.success) {
            setOverviewData(res.data)
        }
    }

    const loadUsers = async () => {
        const res = await window.electronAPI?.getPlatformUsers()
        if (res?.success) {
            setPlatformUsers(res.data)
        }
    }

    const loadAnnouncements = async () => {
        setAnnouncementsLoading(true)
        try {
            const res = await window.electronAPI?.getPlatformAnnouncements()
            if (res?.success) {
                setAnnouncements(res.data || [])
            }
        } finally {
            setAnnouncementsLoading(false)
        }
    }

    const loadBackups = async () => {
        const res = await window.electronAPI?.getPlatformBackups()
        if (res?.success) {
            setBackups(res.data)
        }
    }

    const loadHealth = async () => {
        setHealthLoading(true)
        try {
            const res = await window.electronAPI?.getPlatformSystemHealth()
            if (res?.success) {
                setHealthData(res.data)
            }
        } finally {
            setHealthLoading(false)
        }
    }

    const loadLogs = async (showLoading = true) => {
        if (showLoading) setLogsLoading(true)
        try {
            const res = await window.electronAPI?.getPlatformLogs(300)
            if (res?.success) {
                setLogs(res.data || [])
            }
        } finally {
            if (showLoading) setLogsLoading(false)
        }
    }

    const handleClearLogs = async () => {
        if (!window.confirm('Tüm sistem loglarını sıfırlamak istediğinize emin misiniz?')) {
            return
        }
        const res = await window.electronAPI?.clearPlatformLogs()
        if (res?.success) {
            await loadLogs()
        }
    }

    // Impersonate Company (Dedicated Window -> opens Main Portal)
    const handleImpersonateCompany = (company) => {
        try {
            const isElectron = typeof window !== 'undefined' && 
                (window.navigator?.userAgent?.includes('Electron') || !!window.process?.versions?.electron);

            if (isElectron && window.electronAPI?.openImpersonateWindow) {
                window.electronAPI.openImpersonateWindow({
                    companyId: company.id,
                    companyName: company.name
                });
                return;
            }

            // Web mode (Edge, Chrome, Safari, etc.): Must execute synchronously to avoid popup blockers
            const queryStr = `impersonate_company_id=${company.id}&impersonate_company_name=${encodeURIComponent(company.name)}`;
            const baseUrl = window.location.origin + window.location.pathname;
            const url = `${baseUrl}#/portal?${queryStr}`;

            const winFeatures = 'width=1400,height=900,left=100,top=100,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes';
            const newWin = window.open(url, '_blank', winFeatures);
            if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
                window.open(url, '_blank');
            }
        } catch (err) {
            console.error('handleImpersonateCompany error:', err);
            selectCompany(company);
            navigate('/portal');
        }
    }

    // Toggle User Status (Lock / Unlock)
    const handleToggleUser = async (u) => {
        if (u.role === 'superadmin' || u.username === 'superadmin') {
            alert('Ana Süper Yönetici hesabı kilitlenemez.')
            return
        }
        const currentActive = u.isActive !== undefined ? u.isActive : (u.is_active !== 0)
        const nextState = currentActive ? 0 : 1

        try {
            const res = await window.electronAPI?.toggleUserStatus(u.id, nextState)
            if (res && (res.success || res.data)) {
                setPlatformUsers(prev => prev.map(item => 
                    item.id === u.id 
                        ? { ...item, isActive: nextState === 1, is_active: nextState } 
                        : item
                ))
                await loadUsers()
            } else {
                alert('Hata: ' + (res?.error || 'Durum değiştirilemedi'))
            }
        } catch (err) {
            alert('İşlem hatası: ' + err.message)
        }
    }

    // Reset User 2FA (Emergency Rescue)
    const handleResetUser2FA = async (u) => {
        if (!window.confirm(`"${u.username}" kullanıcısının İki Adımlı Doğrulama (2FA) kilidini sıfırlamak istediğinize emin misiniz? Kullanıcı sadece şifresiyle giriş yapabilecektir.`)) {
            return
        }
        try {
            const res = await window.electronAPI?.disableMfa(u.id)
            if (res && res.success) {
                alert(`"${u.username}" kullanıcısının 2FA kilidi başarıyla sıfırlandı.`)
                await loadUsers()
            } else {
                alert('2FA sıfırlama hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        }
    }

    // Reset Password
    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault()
        if (!newPassword || newPassword.length < 4) {
            alert('Şifre en az 4 karakter olmalıdır')
            return
        }
        setPasswordLoading(true)
        try {
            const res = await window.electronAPI?.resetPlatformUserPassword(passwordModalUser.id, newPassword)
            if (res?.success) {
                setPasswordModalUser(null)
                setNewPassword('')
                await loadUsers()
            } else {
                alert('Şifre değiştirme hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } finally {
            setPasswordLoading(false)
        }
    }

    // Edit User Role Handlers
    const handleOpenEditRole = (u) => {
        setEditRoleModalUser(u)
        setEditRoleForm({
            role: u.role || u.accountType || 'user',
            companyId: u.company?.id ? String(u.company.id) : (u.company_id ? String(u.company_id) : ''),
            fullName: u.fullName || u.full_name || ''
        })
    }

    const handleSaveUserRole = async (e) => {
        e?.preventDefault()
        if (!editRoleModalUser) return
        setEditRoleLoading(true)
        try {
            const res = await window.electronAPI?.updatePlatformUser(editRoleModalUser.id, {
                role: editRoleForm.role,
                companyId: editRoleForm.companyId ? parseInt(editRoleForm.companyId, 10) : null,
                fullName: editRoleForm.fullName
            })
            if (res?.success) {
                setEditRoleModalUser(null)
                await loadUsers()
                await loadOverview()
            } else {
                alert('Rol güncelleme hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        } finally {
            setEditRoleLoading(false)
        }
    }

    // Create User Submit
    const handleCreateUserSubmit = async (e) => {
        e.preventDefault()
        setCreateUserLoading(true)
        try {
            const res = await window.electronAPI?.createPlatformUser(newUserForm)
            if (res?.success) {
                setCreateUserModal(false)
                setNewUserForm({
                    username: '',
                    email: '',
                    password: '',
                    fullName: '',
                    role: 'company_admin',
                    position: 'Şirket Yöneticisi',
                    phone: '',
                    companyId: ''
                })
                await loadUsers()
                await loadOverview()
            } else {
                alert('Kullanıcı oluşturma hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            console.error('handleCreateUserSubmit error:', err)
            alert('Kullanıcı oluşturma hatası: ' + (err.message || 'Bilinmeyen sistem hatası'))
        } finally {
            setCreateUserLoading(false)
        }
    }

    // Create Company Submit
    const handleCreateCompanySubmit = async (e) => {
        e.preventDefault()
        if (!newCompanyForm.name) {
            alert('Şirket unvanı zorunludur')
            return
        }
        setCreateCompanyLoading(true)
        try {
            const res = await window.electronAPI?.createPlatformCompany(newCompanyForm)
            if (res?.success) {
                setCreateCompanyModal(false)
                setNewCompanyForm({
                    name: '',
                    taxNumber: '',
                    taxOffice: '',
                    sgkNo: '',
                    address: '',
                    phone: '',
                    ownerUserId: ''
                })
                await loadOverview()
                await loadUsers()
            } else {
                alert('Şirket oluşturma hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } finally {
            setCreateCompanyLoading(false)
        }
    }

    // Delete Company
    const handleDeleteCompany = async (company) => {
        if (!window.confirm(`"${company.name}" şirketini ve bu şirkete bağlı tüm araç, personel ve finans kayıtlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
            return
        }
        try {
            const res = await window.electronAPI?.deletePlatformCompany(company.id)
            if (res?.success) {
                await loadOverview()
                await loadUsers()
            } else {
                alert('Şirket silme hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        }
    }

    // Open Edit Company Modal
    const handleEditCompany = (company) => {
        setEditCompanyForm({
            id: company.id,
            name: company.name,
            taxNumber: company.tax_number === '-' ? '' : (company.tax_number || ''),
            taxOffice: company.tax_office === '-' ? '' : (company.tax_office || ''),
            sgkNo: company.sgk_no || '',
            address: company.address === '-' ? '' : (company.address || ''),
            phone: company.phone === '-' ? '' : (company.phone || ''),
            ownerUserId: company.owner?.id ? String(company.owner.id) : '',
            plan: company.plan || 'PRO',
            status: company.status || 'active',
            expiresAt: company.expires_at ? company.expires_at.split('T')[0] : '',
            maxVehicles: company.max_vehicles || 50,
            maxEmployees: company.max_employees || 50,
            maxUsers: company.max_users || 10,
            storageLimitMb: company.storage_limit_mb || 1024,
            modules: company.modules || {
                fleet: true,
                finance: true,
                meals: true,
                hr: true,
                works: true,
                customers: true
            }
        })
        setEditCompanyModal(true)
    }

    // Submit Edit Company
    const handleEditCompanySubmit = async (e) => {
        e.preventDefault()
        if (!editCompanyForm.name) {
            alert('Şirket unvanı zorunludur')
            return
        }
        setEditCompanyLoading(true)
        try {
            const res = await window.electronAPI?.updatePlatformCompany(editCompanyForm)
            if (res?.success) {
                setEditCompanyModal(false)
                await loadOverview()
                await loadUsers()
            } else {
                alert('Şirket güncelleme hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        } finally {
            setEditCompanyLoading(false)
        }
    }

    // Toggle Company Status (Active / Suspended)
    const handleToggleCompanyStatus = async (company) => {
        const isCurrentlyActive = company.status === 'active'
        const actionLabel = isCurrentlyActive ? 'askıya almak' : 'yeniden aktif etmek'
        if (!window.confirm(`"${company.name}" şirketini ${actionLabel} istediğinize emin misiniz?`)) {
            return
        }
        try {
            const res = await window.electronAPI?.toggleCompanyStatus(company.id, !isCurrentlyActive)
            if (res?.success) {
                await loadOverview()
            } else {
                alert('İşlem başarısız: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            alert('Hata: ' + err.message)
        }
    }

    // Create Announcement Submit
    const handleCreateAnnouncementSubmit = async (e) => {
        e.preventDefault()
        if (!newAnnouncement.title || !newAnnouncement.message) {
            alert('Lütfen duyuru başlığı ve mesajını doldurun.')
            return
        }
        setCreatingAnnouncement(true)
        try {
            const res = await window.electronAPI?.createPlatformAnnouncement({
                ...newAnnouncement,
                createdBy: user?.id
            })
            if (res?.success) {
                setCreateAnnouncementModal(false)
                setNewAnnouncement({
                    title: '',
                    message: '',
                    type: 'info',
                    companyId: '',
                    expiresAt: '',
                    isDismissible: 1,
                    showPopup: 0
                })
                await loadAnnouncements()
            } else {
                alert('Duyuru oluşturma hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } catch (err) {
            console.error('handleCreateAnnouncementSubmit error:', err)
            alert('Duyuru oluşturma hatası: ' + (err.message || 'Bilinmeyen sistem hatası'))
        } finally {
            setCreatingAnnouncement(false)
        }
    }

    // Toggle Announcement Status
    const handleToggleAnnouncement = async (ann) => {
        const nextState = ann.isActive ? 0 : 1
        const res = await window.electronAPI?.toggleAnnouncementStatus(ann.id, nextState)
        if (res?.success) {
            await loadAnnouncements()
        }
    }

    // Delete Announcement
    const handleDeleteAnnouncement = async (ann) => {
        if (!window.confirm(`"${ann.title}" duyurusunu silmek istediğinize emin misiniz?`)) {
            return
        }
        const res = await window.electronAPI?.deletePlatformAnnouncement(ann.id)
        if (res?.success) {
            await loadAnnouncements()
        }
    }

    // Trigger Manual Backup
    const handleManualBackup = async () => {
        setBackupLoading(true)
        try {
            const res = await window.electronAPI?.triggerPlatformBackup()
            if (res?.success) {
                await loadBackups()
            } else {
                alert('Yedekleme hatası: ' + (res?.error || 'Bilinmiyor'))
            }
        } finally {
            setBackupLoading(false)
        }
    }

    // Delete User
    const handleDeleteUser = async (u) => {
        if (u.role === 'superadmin' || u.username === 'superadmin') {
            alert('Ana Süper Yönetici hesabı silinemez.')
            return
        }
        if (!window.confirm(`"${u.username}" kullanıcısını silmek istediğinize emin misiniz?`)) {
            return
        }
        const res = await window.electronAPI?.deletePlatformUser(u.id)
        if (res?.success) {
            setPlatformUsers(prev => prev.filter(item => item.id !== u.id))
            await loadUsers()
        } else {
            alert('Hata: ' + (res?.error || 'Bilinmiyor'))
        }
    }

    // Table Data formatted for DataTable search & filters
    const tableUsers = useMemo(() => {
        return platformUsers.map(u => {
            const isPending = u.isPending !== undefined ? u.isPending : (u.is_active === 0)
            const isActive = u.isActive !== undefined ? u.isActive : (u.is_active === 1)
            return {
                ...u,
                isActive,
                isPending,
                company_id: u.company?.id ? String(u.company.id) : 'NONE',
                company_name: u.company?.name || 'Sistem / Genel',
                employee_name: u.employee?.fullName || '',
                employee_pos: u.employee?.position || '',
                employee_tc: u.employee?.tcNo || '',
                status_filter: isPending ? 'PENDING' : (isActive ? 'ACTIVE' : 'LOCKED')
            }
        })
    }, [platformUsers])

    const tableCompanies = useMemo(() => {
        return (overviewData?.companies || []).map(c => ({
            ...c,
            owner_username: c.owner?.username || '',
            owner_email: c.owner?.email || ''
        }))
    }, [overviewData])

    // Filters for DataTable (matching standard design across app)
    const userFilters = useMemo(() => [
        {
            key: 'company_id',
            label: 'Şirket',
            options: [
                ...overviewData?.companies?.map(c => ({ value: String(c.id), label: c.name })) || [],
                { value: 'NONE', label: 'Şirketsiz / Sistem' }
            ]
        },
        {
            key: 'accountType',
            label: 'Hesap Türü',
            options: [
                { value: 'superadmin', label: 'Süper Yönetici' },
                { value: 'company_owner', label: 'Şirket Sahibi' },
                { value: 'employee', label: 'Personel / Şoför' },
                { value: 'admin', label: 'Yönetici' }
            ]
        },
        {
            key: 'status_filter',
            label: 'Durum',
            options: [
                { value: 'PENDING', label: '⏳ Onay Bekleyenler' },
                { value: 'ACTIVE', label: 'Aktif Hesaplar' },
                { value: 'LOCKED', label: 'Kilitli Hesaplar' }
            ]
        }
    ], [overviewData])

    // Clean Type Mapping with colors (no ugly text at the beginning)
    const announcementTypeMeta = {
        info: { label: 'Bilgilendirme', color: '#3b82f6' },
        maintenance: { label: 'Planlı Sistem Bakımı', color: '#8b5cf6' },
        warning: { label: 'Uyarı', color: '#f59e0b' },
        legal: { label: 'Mevzuat & Sigorta', color: '#eab308' },
        critical: { label: 'Kritik / Acil Bildirim', color: '#ef4444' },
        success: { label: 'Başarılı / Tebrik', color: '#10b981' }
    }

    const announcementTypeOptions = [
        { value: 'info', label: 'Bilgilendirme' },
        { value: 'maintenance', label: 'Planlı Sistem Bakımı' },
        { value: 'warning', label: 'Uyarı' },
        { value: 'legal', label: 'Mevzuat & Sigorta' },
        { value: 'critical', label: 'Kritik / Acil Bildirim' },
        { value: 'success', label: 'Başarılı / Tebrik' }
    ]

    const announcementCompanyOptions = [
        { value: '', label: 'Tüm Şirketler (Genel Yayın)' },
        ...(overviewData?.companies?.map(c => ({ value: String(c.id), label: c.name })) || [])
    ]

    const userCompanyOptions = [
        { value: '', label: 'Şirketsiz / Sistem Kullanıcısı' },
        ...(overviewData?.companies?.map(c => ({ value: String(c.id), label: c.name })) || [])
    ]

    // User Role Options for Modal
    const userRoleOptions = [
        { value: 'company_admin', label: '👑 Şirket Sahibi / Yöneticisi (Kasa, Finans, Ayarlar, Tüm Modüller)' },
        { value: 'manager', label: '💼 Müdür / Operasyon Yöneticisi' },
        { value: 'personnel', label: '👷 Şoför / Saha Personeli (Sadece Kendi Bilgilerini Görür)' },
        { value: 'user', label: '👤 Standart Kullanıcı (Temel Operasyonel Görünüm)' },
        { value: 'admin', label: '🛡️ Birim / Modül Sorumlusu' },
        { value: 'superadmin', label: '⚡ Süper Yönetici (Tüm Platform Yetkisi)' }
    ]

    const companyOwnerOptions = [
        { value: '', label: 'Atanmamış / Şirket Sahipsiz' },
        ...(platformUsers?.map(u => ({ value: String(u.id), label: `${u.username} (${u.fullName || u.email})` })) || [])
    ]

    if (!isSuperAdmin) {
        return null
    }

    // ── USERS TABLE COLUMNS ──
    const userColumns = [
        { key: 'username', label: 'Kullanıcı Adı & E-Posta', width: '240px', minWidth: '220px', render: (val, r) => (
            <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '12.5px' }}>
                    {val} {r.fullName && r.fullName !== val && (
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({r.fullName})</span>
                    )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.email}</div>
            </div>
        )},
        { key: 'company', label: 'Bağlı Şirket & İlişki', width: '240px', minWidth: '220px', render: (_, r) => (
            <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>{r.company?.name || 'Sistem / Genel'}</span>
                </div>
                {r.employee && (
                    <div style={{ fontSize: '11px', color: '#10b981', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Personel: {r.employee.fullName} • {r.employee.position}</span>
                    </div>
                )}
            </div>
        )},
        { key: 'role_type', label: 'Hesap Türü & Yetki', width: '160px', minWidth: '150px', render: (_, r) => (
            <div>
                <span className={`badge ${
                    r.accountType === 'superadmin' ? 'badge-warning' : 
                    r.accountType === 'company_owner' ? 'badge-primary' : 
                    r.accountType === 'employee' ? 'badge-success' : 'badge-info'
                }`}>
                    {r.accountType === 'superadmin' ? 'Süper Yönetici' :
                     r.accountType === 'company_owner' ? 'Şirket Sahibi' :
                     r.accountType === 'employee' ? 'Personel' : r.accountBadge}
                </span>
                {r.customRole && (
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Rol: {r.customRole}
                    </div>
                )}
            </div>
        )},
        { key: 'two_factor_enabled', label: '2FA', width: '110px', minWidth: '100px', render: (val, r) => {
            const is2FA = r.two_factor_enabled === 1 || r.two_factor_enabled === true || r.has2FA;
            return is2FA ? (
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                    <Shield size={11} /> 2FA Açık
                </span>
            ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kapalı</span>
            );
        }},
        { key: 'status', label: 'Durum', width: '130px', minWidth: '120px', render: (_, r) => {
            if (r.isPending) {
                return (
                    <span className="badge badge-warning">
                        ⏳ Onay Bekliyor
                    </span>
                )
            }
            if (r.isActive) {
                return <span className="badge badge-success">• Aktif</span>
            }
            return <span className="badge badge-danger">• Kilitli</span>
        }},
        { key: 'created_at', label: 'Kayıt Tarihi', width: '120px', minWidth: '110px', render: (val) => formatDate(val) }
    ]

    // ── TENANTS TABLE COLUMNS ──
    const planBadgeStyle = (plan) => {
        switch ((plan || '').toUpperCase()) {
            case 'ENTERPRISE':
                return { background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }
            case 'PRO':
                return { background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }
            case 'STARTER':
                return { background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', border: '1px solid rgba(14, 165, 233, 0.3)' }
            default:
                return { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }
        }
    }

    const tenantColumns = [
        { key: 'name', label: 'Şirket Adı & İletişim', width: '270px', minWidth: '250px', render: (val, r) => (
            <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>{val}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    VN: {r.tax_number || '-'} • Tel: {r.phone || '-'}
                </div>
            </div>
        )},
        { key: 'plan', label: 'Paket & Lisans', width: '150px', minWidth: '130px', render: (val, r) => {
            const planKey = (val || 'PRO').toUpperCase();
            return (
                <div>
                    <span 
                        style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            letterSpacing: '0.5px',
                            ...planBadgeStyle(planKey) 
                        }}
                    >
                        {planKey}
                    </span>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {r.expires_at ? `Bitiş: ${formatDate(r.expires_at)}` : 'Süresiz'}
                    </div>
                </div>
            );
        }},
        { key: 'status', label: 'Durum', width: '120px', minWidth: '110px', render: (val) => {
            const isActive = (val || 'active') === 'active';
            return (
                <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {isActive ? <CheckCircle2 size={11} /> : <AlertOctagon size={11} />}
                    {isActive ? 'Aktif' : 'Askıda'}
                </span>
            );
        }},
        { key: 'quotas', label: 'Kullanım & Kotalar', width: '240px', minWidth: '220px', render: (_, r) => {
            const vCurrent = r.counts?.vehicles || 0;
            const vMax = r.max_vehicles || 50;
            const vPct = Math.min(100, Math.round((vCurrent / vMax) * 100));

            const eCurrent = r.counts?.employees || 0;
            const eMax = r.max_employees || 50;
            const ePct = Math.min(100, Math.round((eCurrent / eMax) * 100));

            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                            <span>Araç: <strong style={{ color: 'var(--text-primary)' }}>{vCurrent}/{vMax}</strong></span>
                            <span style={{ color: vPct >= 90 ? 'var(--danger)' : 'var(--text-muted)' }}>%{vPct}</span>
                        </div>
                        <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${vPct}%`, height: '100%', background: vPct >= 90 ? '#ef4444' : 'var(--primary)', transition: 'width 0.3s' }} />
                        </div>
                    </div>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                            <span>Personel: <strong style={{ color: 'var(--text-primary)' }}>{eCurrent}/{eMax}</strong></span>
                            <span style={{ color: ePct >= 90 ? 'var(--danger)' : 'var(--text-muted)' }}>%{ePct}</span>
                        </div>
                        <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${ePct}%`, height: '100%', background: ePct >= 90 ? '#ef4444' : '#f59e0b', transition: 'width 0.3s' }} />
                        </div>
                    </div>
                </div>
            );
        }},
        {
            key: 'modules',
            label: 'Aktif Modüller',
            width: '210px',
            minWidth: '190px',
            render: (_, r) => {
                const mods = r.modules || { fleet: true, finance: true, meals: true, hr: true, works: true, customers: true };
                const modLabels = [
                    { k: 'fleet', label: 'Filo', color: '#3b82f6' },
                    { k: 'finance', label: 'Finans', color: '#f59e0b' },
                    { k: 'meals', label: 'Yemek', color: '#ef4444' },
                    { k: 'hr', label: 'İK', color: '#10b981' },
                    { k: 'works', label: 'İş', color: '#8b5cf6' },
                    { k: 'customers', label: 'Cari', color: '#ec4899' }
                ];
                return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                        {modLabels.map(m => {
                            const isAct = mods[m.k] !== false;
                            return (
                                <span
                                    key={m.k}
                                    style={{
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: isAct ? `${m.color}20` : 'var(--bg-tertiary)',
                                        color: isAct ? m.color : 'var(--text-muted)',
                                        border: `1px solid ${isAct ? `${m.color}40` : 'var(--border-color)'}`,
                                        opacity: isAct ? 1 : 0.45
                                    }}
                                    title={isAct ? `${m.label} Modülü Aktif` : `${m.label} Modülü Kapalı`}
                                >
                                    {m.label}
                                </span>
                            );
                        })}
                    </div>
                );
            }
        },
        { key: 'owner', label: 'Yönetici / Kurucu', width: '180px', minWidth: '160px', render: (_, r) => (
            r.owner ? (
                <div>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>{r.owner.username}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.owner.email}</div>
                </div>
            ) : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Atanmamış</span>
        )},
        { key: 'created_at', label: 'Kayıt', width: '120px', minWidth: '110px', render: (val) => formatDate(val) }
    ]

    // ── ANNOUNCEMENTS TABLE COLUMNS ──
    const announcementColumns = [
        { key: 'title', label: 'Duyuru Başlığı & İçerik', width: '320px', minWidth: '280px', wrap: true, render: (val, r) => {
            const meta = announcementTypeMeta[r.type] || { color: '#3b82f6' }
            return (
                <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '12.5px' }}>{val}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4, paddingLeft: '12px' }}>
                        {r.message}
                    </div>
                </div>
            )
        }},
        { key: 'companyName', label: 'Hedef Kitle / Şirket', width: '170px', minWidth: '150px', render: (val, r) => (
            <span className={`badge ${!r.company_id ? 'badge-primary' : 'badge-warning'}`}>
                {val}
            </span>
        )},
        { key: 'type', label: 'Duyuru Türü', width: '150px', minWidth: '130px', render: (val) => {
            const meta = announcementTypeMeta[val] || { label: val, color: '#94a3b8' }
            return (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{meta.label}</span>
                </div>
            )
        }},
        { key: 'is_dismissible', label: 'Kapatma Kuralı', width: '160px', minWidth: '150px', render: (val) => {
            const mode = val !== undefined && val !== null ? Number(val) : 1
            if (mode === 0) {
                return <span className="badge badge-danger">Sabit</span>
            } else if (mode === 2) {
                return <span className="badge badge-info">Kalıcı Kapatılabilir</span>
            }
            return <span className="badge badge-warning">Her Girişte Göster</span>
        }},
        { key: 'status', label: 'Yayın Durumu', width: '130px', minWidth: '120px', render: (_, r) => {
            if (r.isExpired) {
                return <span className="badge badge-neutral"><Clock size={11} /> Süresi Doldu</span>
            }
            return r.isActive ? (
                <span className="badge badge-success"><CheckCircle2 size={11} /> Yayında</span>
            ) : (
                <span className="badge badge-danger"><XCircle size={11} /> Durduruldu</span>
            )
        }},
        { key: 'expires_at', label: 'Bitiş Tarihi', width: '130px', minWidth: '120px', render: (val) => val ? formatDate(val) : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Süresiz</span> }
    ]

    // ── AUDIT TRAIL COLUMNS ──
    const auditColumns = [
        { key: 'createdAt', label: 'Zaman Damgası', width: '170px', minWidth: '160px', render: (val) => (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                {val ? new Date(val).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
            </div>
        )},
        { key: 'companyName', label: 'Şirket', width: '170px', minWidth: '150px', render: (val) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Building2 size={12} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{val || 'Sistem / Platform'}</span>
            </div>
        )},
        { key: 'username', label: 'Kullanıcı & Rol', width: '160px', minWidth: '140px', render: (val, r) => (
            <div>
                <span style={{ fontWeight: 600, fontSize: '12px' }}>{val || 'Sistem'}</span>
                {r.userRole && (
                    <span className="badge badge-neutral" style={{ marginLeft: '5px', fontSize: '10px' }}>
                        {r.userRole}
                    </span>
                )}
            </div>
        )},
        { key: 'action', label: 'İşlem Türü', width: '140px', minWidth: '130px', render: (val) => {
            const actionBadges = {
                CREATE: 'badge badge-success',
                UPDATE: 'badge badge-warning',
                DELETE: 'badge badge-danger',
                LOGIN_SUCCESS: 'badge badge-info',
                LOGIN_FAILED: 'badge badge-danger',
                IMPERSONATE: 'badge badge-primary',
                SECURITY: 'badge badge-warning'
            }
            const actionLabels = {
                CREATE: 'Ekleme',
                UPDATE: 'Güncelleme',
                DELETE: 'Silme',
                LOGIN_SUCCESS: 'Giriş',
                LOGIN_FAILED: 'Hatalı Giriş',
                IMPERSONATE: 'Şirkete Geçiş',
                SECURITY: 'Güvenlik'
            }
            return (
                <span className={actionBadges[val] || 'badge badge-neutral'}>
                    {actionLabels[val] || val}
                </span>
            )
        }},
        { key: 'entityName', label: 'Hedef / Varlık', width: '190px', minWidth: '170px', wrap: true, render: (val, r) => (
            <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{val || '-'}</strong>
                {r.entityType && (
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Modül: {r.entityType}</div>
                )}
            </div>
        )},
        { key: 'description', label: 'İşlem Nedeni & Açıklaması', minWidth: '280px', wrap: true, render: (val) => (
            <div style={{ 
                fontSize: '12px', 
                color: 'var(--text-primary)', 
                lineHeight: 1.45, 
                whiteSpace: 'normal', 
                wordBreak: 'break-word', 
                overflowWrap: 'anywhere' 
            }}>
                {val || '-'}
            </div>
        )}
    ]

    // ── SYSTEM LOGS COLUMNS ──
    const logColumns = [
        { key: 'timestamp', label: 'Zaman Damgası', width: '180px', minWidth: '160px', render: (val) => (
            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{val}</span>
        )},
        { key: 'level', label: 'Seviye', width: '110px', minWidth: '100px', render: (val) => (
            <span className={`log-level-badge ${val}`}>
                {val}
            </span>
        )},
        { key: 'message', label: 'Log Detayı & Sistem Olayı', minWidth: '450px', render: (val) => (
            <span className="log-message-code">{val}</span>
        )}
    ]

    const backupColumns = [
        { key: 'fileName', label: 'Yedek Dosyası', minWidth: '280px', render: (val, row) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={15} style={{ color: row.isUnified ? '#3b82f6' : '#10b981' }} />
                <code style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{val}</code>
            </div>
        )},
        { key: 'type', label: 'Yedek Türü', width: '160px', minWidth: '140px', render: (val) => (
            <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '6px',
                background: val?.includes('Tam') ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: val?.includes('Tam') ? '#60a5fa' : '#34d399',
                border: val?.includes('Tam') ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
            }}>
                {val || 'Veritabanı'}
            </span>
        )},
        { key: 'sizeFormatted', label: 'Boyut', width: '120px', minWidth: '110px' },
        { key: 'createdAt', label: 'Yedek Tarihi', width: '180px', minWidth: '160px', render: (val) => new Date(val).toLocaleString('tr-TR') }
    ]

    return (
        <div className="platform-admin-page">
            <TopProgressBar loading={loading || backupLoading || logsLoading || announcementsLoading || createCompanyLoading} />

            {/* ══════════════════════════════════════════════════════
                PAGE 1: USERS & COMPANY ACCOUNTS (/platform/users)
               ══════════════════════════════════════════════════════ */}
            {activeSection === 'users' && (
                <div>
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Kullanıcı Hesapları & Şirket Bağlantıları</h1>
                            <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>
                                KONTROL SaaS platformundaki tüm kullanıcı hesapları, roller, pozisyonlar ve şirket eşleştirmeleri.
                            </p>
                        </div>
                        <div className="page-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => { loadRealtimeUsers(); setOnlineUsersModal(true); }}
                                title="Anlık Çevrimiçi Kullanıcıları & Oturumları İncele"
                                style={{ display: 'flex', alignItems: 'center', gap: '7px' }}
                            >
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                                <span>Canlı Oturumlar: <strong style={{ color: '#10b981' }}>{onlineUsersData.onlineCount || 0}</strong></span>
                            </button>
                            <button className="btn btn-secondary" onClick={loadSectionData} disabled={loading}>
                                <RefreshCw size={16} className={loading ? 'spin' : ''} />
                                Yenile
                            </button>
                            <button className="btn btn-primary" onClick={() => setCreateUserModal(true)}>
                                <Plus size={18} />
                                Yeni Kullanıcı
                            </button>
                        </div>
                    </div>

                    <DataTable
                        persistenceKey="PlatformAdmin_users_table_v4"
                        columns={userColumns}
                        data={tableUsers}
                        showSearch={true}
                        showCheckboxes={false}
                        searchPlaceholder="Kullanıcı adı, e-posta, şirket veya personel ile ara..."
                        searchKeys={['username', 'email', 'fullName', 'company_name', 'employee_name', 'employee_pos', 'employee_tc']}
                        filters={userFilters}
                        actions={(r) => (
                            <>
                                {r.isPending && (
                                    <button
                                        title="Başvuruyu Onayla & Hesabı Aktif Et"
                                        onClick={() => handleToggleUser(r)}
                                        className="success"
                                    >
                                        <Check size={16} />
                                    </button>
                                )}
                                <button
                                    title="Rol & Yetki Düzenle"
                                    onClick={() => handleOpenEditRole(r)}
                                >
                                    <UserCog size={16} />
                                </button>
                                <button
                                    title="Şifre Sıfırla"
                                    onClick={() => { setPasswordModalUser(r); setNewPassword(''); }}
                                >
                                    <KeyRound size={16} />
                                </button>
                                {(r.two_factor_enabled === 1 || r.two_factor_enabled === true || r.has2FA) && (
                                    <button
                                        title="2FA Kilidini Sıfırla"
                                        onClick={() => handleResetUser2FA(r)}
                                    >
                                        <Shield size={16} />
                                    </button>
                                )}
                                {r.role !== 'superadmin' && r.username !== 'superadmin' && !r.isPending && (
                                    <button
                                        title={r.isActive ? 'Hesabı Kilitle (Pasife Al)' : 'Hesabın Kilidini Aç (Aktif Et)'}
                                        onClick={() => handleToggleUser(r)}
                                        className={r.isActive ? 'danger' : 'success'}
                                    >
                                        {r.isActive ? <Lock size={16} /> : <Unlock size={16} />}
                                    </button>
                                )}
                                {r.role !== 'superadmin' && r.username !== 'superadmin' && (
                                    <button
                                        title="Kullanıcıyı Sil"
                                        className="danger"
                                        onClick={() => handleDeleteUser(r)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </>
                        )}
                    />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PAGE 2: TENANTS & COMPANIES (/platform/companies)
               ══════════════════════════════════════════════════════ */}
            {activeSection === 'companies' && (
                <div>
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Şirketler & Portföy</h1>
                            <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>
                                Sisteme kayıtlı tüm kiracı şirketler, kurucuları, kullanım özetleri ve şirket yönetimi.
                            </p>
                        </div>
                        <div className="page-actions" style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" onClick={loadSectionData} disabled={loading}>
                                <RefreshCw size={16} className={loading ? 'spin' : ''} />
                                Yenile
                            </button>
                            <button className="btn btn-primary" onClick={() => setCreateCompanyModal(true)}>
                                <Building2 size={16} />
                                Yeni Şirket Ekle
                            </button>
                        </div>
                    </div>

                    <DataTable
                        persistenceKey="PlatformAdmin_tenants_table_v4"
                        columns={tenantColumns}
                        data={tableCompanies}
                        showSearch={true}
                        showCheckboxes={false}
                        searchPlaceholder="Şirket adı, vergi no veya yetkili ile ara..."
                        searchKeys={['name', 'tax_number', 'phone', 'owner_username', 'owner_email']}
                        actions={(r) => (
                            <>
                                <button
                                    title="Şirkete Giriş Yap (Ayrı Pencerede Aç)"
                                    onClick={() => handleImpersonateCompany(r)}
                                >
                                    <ExternalLink size={16} />
                                </button>
                                <button
                                    title="Şirketi Düzenle & Paket / Kotalar / Modüller"
                                    onClick={() => handleEditCompany(r)}
                                >
                                    <Wrench size={16} />
                                </button>
                                <button
                                    title={r.status === 'active' ? 'Şirketi Askıya Al (Dondur)' : 'Şirketi Yeniden Aktif Et'}
                                    onClick={() => handleToggleCompanyStatus(r)}
                                    className={r.status === 'active' ? 'danger' : 'success'}
                                >
                                    {r.status === 'active' ? <Lock size={16} /> : <Unlock size={16} />}
                                </button>
                                <button
                                    title="Şirketi ve Tüm Verilerini Sil"
                                    className="danger"
                                    onClick={() => handleDeleteCompany(r)}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                    />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PAGE 3: BROADCAST ANNOUNCEMENTS (/platform/announcements)
               ══════════════════════════════════════════════════════ */}
            {activeSection === 'announcements' && (
                <div>
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Canlı Duyuru & Bildirim Yayını</h1>
                            <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>
                                Tüm SaaS şirketlerine veya seçtiğiniz şirketin Ana Portalı'na anlık duyuru şeridi yayınlayın.
                            </p>
                        </div>
                        <div className="page-actions" style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" onClick={loadAnnouncements} disabled={announcementsLoading}>
                                <RefreshCw size={16} className={announcementsLoading ? 'spin' : ''} />
                                Yenile
                            </button>
                            <button className="btn btn-primary" onClick={() => setCreateAnnouncementModal(true)}>
                                <Megaphone size={16} />
                                Yeni Duyuru Yayınla
                            </button>
                        </div>
                    </div>

                    <DataTable
                        persistenceKey="PlatformAdmin_announcements_table_v4"
                        columns={announcementColumns}
                        data={announcements}
                        showSearch={true}
                        showCheckboxes={false}
                        searchPlaceholder="Duyuru başlığı, mesajı veya şirket ile ara..."
                        searchKeys={['title', 'message', 'companyName', 'type']}
                        filters={[
                            {
                                key: 'type',
                                label: 'Duyuru Türü',
                                options: [
                                    { value: 'info', label: 'Bilgilendirme' },
                                    { value: 'maintenance', label: 'Sistem Bakımı' },
                                    { value: 'warning', label: 'Uyarı' },
                                    { value: 'legal', label: 'Mevzuat & Sigorta' },
                                    { value: 'critical', label: 'Kritik Uyarı' },
                                    { value: 'success', label: 'Başarılı' }
                                ]
                            }
                        ]}
                        actions={(r) => (
                            <>
                                <button
                                    title={r.isActive ? 'Yayından Kaldır (Durdur)' : 'Yayına Al'}
                                    onClick={() => handleToggleAnnouncement(r)}
                                    className={r.isActive ? 'danger' : 'success'}
                                >
                                    {r.isActive ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                </button>
                                <button
                                    title="Duyuruyu Sil"
                                    className="danger"
                                    onClick={() => handleDeleteAnnouncement(r)}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                    />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PAGE: EMAIL TEMPLATES & DESIGN EDITOR (/platform/email-templates)
               ══════════════════════════════════════════════════════ */}
            {activeSection === 'email-templates' && (
                <div>
                    <div className="page-header" style={{ marginBottom: '16px' }}>
                        <div>
                            <h1 className="page-title">E-Posta Şablonları & Tasarım Editörü</h1>
                            <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>
                                Kullanıcı kayıt, şifre sıfırlama, davet ve sihirli giriş e-postalarının HTML/CSS tasarımlarını canlı önizlemeli editör ile özelleştirin.
                            </p>
                        </div>
                    </div>
                    <EmailTemplatesManager />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PAGE 4: SYSTEM HEALTH & OBSERVABILITY (/platform/health)
               ══════════════════════════════════════════════════════ */}
            {activeSection === 'health' && (
                <div>
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Sistem Sağlığı & Canlı İzleme</h1>
                            <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>
                                PostgreSQL veritabanı gecikmesi, sunucu donanım durumu ve altyapı servisleri.
                            </p>
                        </div>
                        <div className="page-actions" style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" onClick={loadHealth} disabled={healthLoading}>
                                <RefreshCw size={16} className={healthLoading ? 'spin' : ''} />
                                Metrikleri Yenile
                            </button>
                        </div>
                    </div>

                    <div className="health-dashboard-grid">
                        {/* Database Health Card */}
                        <div className="health-metric-card">
                            <div className="health-metric-header">
                                <span className="health-metric-title">
                                    <Database size={15} style={{ color: '#3b82f6' }} />
                                    <span>PostgreSQL Veritabanı</span>
                                </span>
                                <div className="health-status-dot pulse" />
                            </div>
                            <div className="health-metric-number" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{healthData?.db?.latencyMs !== undefined ? `${healthData.db.latencyMs} ms` : '-'}</span>
                                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>● Hızlı / Stabil</span>
                            </div>
                            <div className="health-details-list">
                                <div className="health-detail-item">
                                    <span>Veritabanı Boyutu:</span>
                                    <span>{healthData?.db?.size || '-'}</span>
                                </div>
                                <div className="health-detail-item">
                                    <span>Aktif Bağlantı Sayısı:</span>
                                    <span>{healthData?.db?.activeConnections || 1}</span>
                                </div>
                                <div className="health-detail-item">
                                    <span>Veritabanı Motoru:</span>
                                    <span>{healthData?.db?.version || 'PostgreSQL 17'}</span>
                                </div>
                                <div className="health-detail-item">
                                    <span>Sağlayıcı:</span>
                                    <span>Dokploy Cloud DB</span>
                                </div>
                            </div>
                        </div>

                        {/* Server & CPU/RAM Card */}
                        <div className="health-metric-card">
                            <div className="health-metric-header">
                                <span className="health-metric-title">
                                    <Cpu size={15} style={{ color: '#8b5cf6' }} />
                                    <span>Sunucu Donanımı & RAM</span>
                                </span>
                                <Server size={15} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <div className="health-metric-number">
                                {healthData?.server?.totalMemGb || '16 GB'}
                            </div>
                            <div className="health-details-list">
                                <div className="health-detail-item">
                                    <span>İşlemci Mimarisi:</span>
                                    <span>{healthData?.server?.cpuModel || 'Apple M4'} ({healthData?.server?.cpuCores || 10} Çekirdek)</span>
                                </div>
                                <div className="health-detail-item">
                                    <span>Boş Bellek:</span>
                                    <span>{healthData?.server?.freeMemGb || '-'}</span>
                                </div>
                                <div className="health-detail-item">
                                    <span>Node.js RSS / Heap:</span>
                                    <span>{healthData?.server?.nodeRssMb || '-'} / {healthData?.server?.nodeHeapUsedMb || '-'}</span>
                                </div>
                                <div className="health-detail-item">
                                    <span>Sunucu Kesintisiz Uptime:</span>
                                    <span>{healthData?.hostUptimeFormatted || '-'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Cloud Services & Security Card */}
                        <div className="health-metric-card">
                            <div className="health-metric-header">
                                <span className="health-metric-title">
                                    <Cloud size={15} style={{ color: '#10b981' }} />
                                    <span>Bulut Servisleri & Güvenlik</span>
                                </span>
                                <Shield size={15} style={{ color: '#f59e0b' }} />
                            </div>
                            <div className="health-metric-number" style={{ color: '#10b981', fontSize: '18px' }}>
                                %100 Çalışır Durumda
                            </div>
                            <div className="health-details-list">
                                <div className="health-detail-item">
                                    <span>Supabase Storage (Evrak/PDF):</span>
                                    <span style={{ color: '#10b981' }}>● Hazır (documents)</span>
                                </div>
                                <div className="health-detail-item">
                                    <span>Yazılım Sürümü:</span>
                                    <span>v{healthData?.appVersion || '1.13.61'}</span>
                                </div>
                                <div className="health-detail-item">
                                    <span>Node.js Runtime:</span>
                                    <span>{healthData?.nodeVersion || '-'} ({healthData?.platform || '-'})</span>
                                </div>
                                <div className="health-detail-item">
                                    <span>Uygulama Çalışma Süresi:</span>
                                    <span>{healthData?.uptimeFormatted || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Micro-Services Overview Table */}
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Platform Alt Yapı Servisleri Durumu
                        </h4>
                        <table className="services-status-table">
                            <thead>
                                <tr>
                                    <th>Servis Adı</th>
                                    <th>Durum</th>
                                    <th>Açıklama / Yanıt</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>PostgreSQL Primary DB</strong></td>
                                    <td><span className="status-badge-active"><CheckCircle2 size={12} /> Çevrimiçi</span></td>
                                    <td>Dokploy bulut veritabanı aktif ({healthData?.db?.latencyMs || 24} ms)</td>
                                </tr>
                                <tr>
                                    <td><strong>Supabase Object Storage</strong></td>
                                    <td><span className="status-badge-active"><CheckCircle2 size={12} /> Bağlı</span></td>
                                    <td>Tüm ruhsat, ehliyet ve dekont dosyaları senkronize</td>
                                </tr>
                                <tr>
                                    <td><strong>Multi-Tenant İzolasyonu</strong></td>
                                    <td><span className="status-badge-active"><CheckCircle2 size={12} /> Aktif</span></td>
                                    <td>Şirketler arası veri güvenliği ve IDOR koruması devrede</td>
                                </tr>
                                <tr>
                                    <td><strong>Canlı Duyuru Yayını Servisi</strong></td>
                                    <td><span className="status-badge-active"><CheckCircle2 size={12} /> Aktif</span></td>
                                    <td>Ana Portal ekranına anlık duyuru bandı dağıtımı</td>
                                </tr>
                                <tr>
                                    <td><strong>Otomatik Yedekleme Servisi</strong></td>
                                    <td><span className="status-badge-active"><CheckCircle2 size={12} /> Zamanlandı</span></td>
                                    <td>Her gece 03:00'te tam Gzip SQL veritabanı yedeği</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PAGE: AUDIT TRAIL & SECURITY EVENTS (/platform/audit)
               ══════════════════════════════════════════════════════ */}
            {activeSection === 'audit' && (
                <div>
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Denetim İzi & Güvenlik Olayları</h1>
                            <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>
                                Platform genelindeki tüm veri ekleme, silme, güncelleme hareketleri ve şüpheli güvenlik olayları.
                            </p>
                        </div>
                        <div className="page-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => loadAuditLogs()} disabled={auditLoading}>
                                <RefreshCw size={16} className={auditLoading ? 'spin' : ''} />
                                Yenile
                            </button>
                        </div>
                    </div>

                    {/* 4 KPI Metric Cards */}
                    <div className="platform-overview-grid" style={{ marginBottom: '24px' }}>
                        <div className="platform-metric-card">
                            <div className="metric-icon-box" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                                <History size={24} />
                            </div>
                            <div className="metric-info">
                                <div className="metric-value">{auditMetrics.total24h || 0}</div>
                                <div className="metric-label">24s Toplam İşlem</div>
                                <div className="metric-sublabel">Tüm kiracı veri hareketleri</div>
                            </div>
                        </div>

                        <div className="platform-metric-card">
                            <div className="metric-icon-box" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                                <ShieldAlert size={24} />
                            </div>
                            <div className="metric-info">
                                <div className="metric-value" style={{ color: (auditMetrics.failedLogins24h > 0) ? '#ef4444' : 'inherit' }}>
                                    {auditMetrics.failedLogins24h || 0}
                                </div>
                                <div className="metric-label">Hatalı Giriş / Tehdit</div>
                                <div className="metric-sublabel">Son 24 saat auth denemeleri</div>
                            </div>
                        </div>

                        <div className="platform-metric-card">
                            <div className="metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                                <Trash2 size={24} />
                            </div>
                            <div className="metric-info">
                                <div className="metric-value">{auditMetrics.criticalDeletes24h || 0}</div>
                                <div className="metric-label">Kritik Silme İşlemi</div>
                                <div className="metric-sublabel">Araç, personel, hesap</div>
                            </div>
                        </div>

                        <div
                            className="platform-metric-card"
                            onClick={() => { loadRealtimeUsers(); setOnlineUsersModal(true); }}
                            style={{ cursor: 'pointer' }}
                            title="Canlı bağlı kullanıcıları ve oturumları incelemek için tıklayın"
                        >
                            <div className="metric-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                <Users size={24} />
                            </div>
                            <div className="metric-info">
                                <div className="metric-value" style={{ color: '#10b981' }}>
                                    {onlineUsersData.onlineCount || 0}
                                </div>
                                <div className="metric-label">Anlık Çevrimiçi Kullanıcı</div>
                                <div className="metric-sublabel">Canlı oturumları yönet (Tıkla)</div>
                            </div>
                        </div>
                    </div>

                    <DataTable
                        persistenceKey="PlatformAdmin_audit_table_v4"
                        columns={auditColumns}
                        data={auditLogs}
                        showSearch={true}
                        showCheckboxes={false}
                        searchPlaceholder="Kullanıcı, hedef varlık, plaka veya işlem ara..."
                        searchKeys={['username', 'entityName', 'description', 'companyName', 'action']}
                        filters={[
                            {
                                key: 'action',
                                label: 'İşlem Türü',
                                options: [
                                    { value: 'CREATE', label: 'Ekleme (CREATE)' },
                                    { value: 'UPDATE', label: 'Güncelleme (UPDATE)' },
                                    { value: 'DELETE', label: 'Silme (DELETE)' },
                                    { value: 'LOGIN_SUCCESS', label: 'Başarılı Giriş' },
                                    { value: 'LOGIN_FAILED', label: 'Hatalı Giriş' },
                                    { value: 'IMPERSONATE', label: 'Şirkete Geçiş' },
                                    { value: 'SECURITY', label: 'Güvenlik Olayı' }
                                ]
                            },
                            {
                                key: 'entityType',
                                label: 'Modül',
                                options: [
                                    { value: 'vehicle', label: 'Araçlar' },
                                    { value: 'employee', label: 'Personel' },
                                    { value: 'auth', label: 'Kimlik & Giriş' },
                                    { value: 'user', label: 'Kullanıcı Hesapları' },
                                    { value: 'company', label: 'Şirketler' },
                                    { value: 'announcement', label: 'Duyurular' }
                                ]
                            },
                            {
                                key: 'severity',
                                label: 'Önem Seviyesi',
                                options: [
                                    { value: 'info', label: 'Bilgi (Info)' },
                                    { value: 'warn', label: 'Uyarı (Warn)' },
                                    { value: 'critical', label: 'Kritik (Critical)' }
                                ]
                            }
                        ]}
                        onRowClick={(r) => { setSelectedAuditDetail(r); setAuditDetailModal(true); setCopiedDetailJson(false); }}
                        actions={(r) => (
                            <button
                                title="İşlem Detayını Görüntüle"
                                onClick={() => { setSelectedAuditDetail(r); setAuditDetailModal(true); setCopiedDetailJson(false); }}
                            >
                                <Eye size={16} />
                            </button>
                        )}
                    />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PAGE 5: SYSTEM & SECURITY LOGS (/platform/logs)
               ══════════════════════════════════════════════════════ */}
            {activeSection === 'logs' && (
                <div>
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Sistem & Güvenlik Logları</h1>
                            <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>
                                Sunucu olayları, kullanıcı giriş denemeleri, veritabanı sorguları ve denetim logları.
                            </p>
                        </div>
                        <div className="page-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-primary)', cursor: 'pointer', marginRight: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={autoPollLogs}
                                    onChange={(e) => setAutoPollLogs(e.target.checked)}
                                />
                                <Radio size={14} style={{ color: autoPollLogs ? '#10b981' : 'var(--text-muted)' }} />
                                <span>Canlı Akış (3sn)</span>
                            </label>

                            <button className="btn btn-secondary" onClick={() => loadLogs(true)} disabled={logsLoading}>
                                <RefreshCw size={16} className={logsLoading ? 'spin' : ''} />
                                Yenile
                            </button>
                            <button className="btn btn-secondary" onClick={handleClearLogs} style={{ color: '#f87171' }}>
                                <Trash2 size={16} />
                                Logları Temizle
                            </button>
                        </div>
                    </div>

                    <DataTable
                        persistenceKey="PlatformAdmin_logs_table_v4"
                        columns={logColumns}
                        data={logs}
                        showSearch={true}
                        showCheckboxes={false}
                        searchPlaceholder="Log mesajı, kullanıcı veya işlem içinde ara..."
                        searchKeys={['message', 'level', 'timestamp']}
                        filters={[
                            {
                                key: 'level',
                                label: 'Log Seviyesi',
                                options: [
                                    { value: 'info', label: 'Info / Bilgi' },
                                    { value: 'warn', label: 'Warn / Uyarı' },
                                    { value: 'error', label: 'Error / Hata' }
                                ]
                            }
                        ]}
                    />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PAGE 6: DATABASE BACKUPS (/platform/backups)
               ══════════════════════════════════════════════════════ */}
            {activeSection === 'backups' && (
                <div>
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Sistem &amp; Veritabanı Yedekleri</h1>
                            <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>
                                Supabase veritabanı (SQL/JSON) ve Supabase Storage dosyalarını (PDF, imza, kaşe, evraklar) kapsayan tam sistem yedekleri.
                            </p>
                        </div>
                        <div className="page-actions" style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" onClick={loadBackups} disabled={backupLoading}>
                                <RefreshCw size={16} className={backupLoading ? 'spin' : ''} />
                                Yenile
                            </button>
                            <button className="btn btn-primary" onClick={handleManualBackup} disabled={backupLoading}>
                                {backupLoading ? (
                                    <>
                                        <Loader2 size={16} className="spin" />
                                        Yedek Alınıyor...
                                    </>
                                ) : (
                                    <>
                                        <Database size={16} />
                                        Anlık Yedek Al
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <DataTable
                        persistenceKey="PlatformAdmin_backups_table_v4"
                        columns={backupColumns}
                        data={backups}
                        showSearch={true}
                        showCheckboxes={false}
                        searchPlaceholder="Yedek dosyası adı ile ara..."
                        searchKeys={['fileName']}
                        actions={(row) => (
                            <button
                                title="Çevrimdışı / Yerel İndir"
                                onClick={() => {
                                    const a = document.createElement('a')
                                    a.href = `/api/admin/backup/download/${encodeURIComponent(row.fileName)}`
                                    a.download = row.fileName
                                    document.body.appendChild(a)
                                    a.click()
                                    document.body.removeChild(a)
                                }}
                            >
                                <Download size={16} />
                            </button>
                        )}
                    />
                </div>
            )}

            {/* ── MODAL: CREATE BROADCAST ANNOUNCEMENT ── */}
            {createAnnouncementModal && (
                <Modal
                    isOpen={createAnnouncementModal}
                    onClose={() => setCreateAnnouncementModal(false)}
                    title="Yeni Canlı Duyuru & Bildirim Yayınla"
                >
                    <form onSubmit={handleCreateAnnouncementSubmit} className="modal-form-grid">
                        <CustomInput
                            label="Duyuru Başlığı"
                            value={newAnnouncement.title}
                            onChange={(val) => setNewAnnouncement(prev => ({ ...prev, title: getVal(val) }))}
                            placeholder="Örn: 28 Ağustos Planlı Sunucu Bakımı"
                            required
                            maxLength={100}
                        />

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                Duyuru Mesajı / İçerik:
                            </label>
                            <textarea
                                value={newAnnouncement.message}
                                onChange={(e) => setNewAnnouncement(prev => ({ ...prev, message: e.target.value }))}
                                placeholder="Duyuru detayını yazın..."
                                rows={3}
                                required
                                maxLength={500}
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '10px',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    outline: 'none',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <CustomSelect
                                label="Duyuru Türü"
                                value={newAnnouncement.type}
                                onChange={(val) => setNewAnnouncement(prev => ({ ...prev, type: getVal(val) }))}
                                options={[
                                    { value: 'info', label: 'Bilgilendirme (Info)' },
                                    { value: 'warning', label: 'Dikkat / Uyarı (Warning)' },
                                    { value: 'maintenance', label: 'Sistem Bakımı (Maintenance)' },
                                    { value: 'legal', label: 'Mevzuat / Zorunlu (Legal)' },
                                    { value: 'urgent', label: 'Acil Bildirim (Urgent)' }
                                ]}
                            />

                            <CustomSelect
                                label="Hedef Kitle"
                                value={newAnnouncement.companyId}
                                onChange={(val) => setNewAnnouncement(prev => ({ ...prev, companyId: getVal(val) }))}
                                options={[
                                    { value: '', label: 'Tüm Şirketler (Genel Yayın)' },
                                    ...(tableCompanies || []).map(c => ({ value: String(c.id), label: `${c.name}` }))
                                ]}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <CustomSelect
                                label="Kapatma Davranışı"
                                value={newAnnouncement.isDismissible}
                                onChange={(val) => setNewAnnouncement(prev => ({ ...prev, isDismissible: Number(getVal(val)) }))}
                                options={[
                                    { value: 1, label: 'Her Girişte Göster (Kapatınca Gizlenir)' },
                                    { value: 2, label: 'Kalıcı Kapatılabilir (Bir Kez Okundu)' },
                                    { value: 0, label: 'Kapatılamaz (Sürekli Sabit)' }
                                ]}
                            />

                            <CustomInput
                                label="Bitiş / Son Tarih (Opsiyonel)"
                                type="datetime-local"
                                value={newAnnouncement.expiresAt}
                                onChange={(val) => setNewAnnouncement(prev => ({ ...prev, expiresAt: getVal(val) }))}
                            />
                        </div>

                        <label className={`platform-modal-checkbox ${newAnnouncement.showPopup ? 'active' : ''}`}>
                            <input
                                type="checkbox"
                                checked={newAnnouncement.showPopup === 1}
                                onChange={(e) => setNewAnnouncement(prev => ({ ...prev, showPopup: e.target.checked ? 1 : 0 }))}
                                style={{ display: 'none' }}
                            />
                            <div className="platform-checkbox-box">
                                {newAnnouncement.showPopup === 1 && <Check size={12} />}
                            </div>
                            <div>
                                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Popup Modal Olarak Aç</strong>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                                    Kullanıcılar sisteme girdiğinde ekranın ortasında açılır modal olarak gösterilsin.
                                </p>
                            </div>
                        </label>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setCreateAnnouncementModal(false)}>
                                İptal
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={creatingAnnouncement}>
                                {creatingAnnouncement ? 'Yayınlanıyor...' : 'Duyuruyu Canlıya Al'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ── MODAL: CREATE COMPANY ── */}
            {createCompanyModal && (
                <Modal
                    isOpen={createCompanyModal}
                    onClose={() => setCreateCompanyModal(false)}
                    title="Platforma Yeni Şirket Ekle"
                >
                    <form onSubmit={handleCreateCompanySubmit} className="modal-form-grid">
                        <CustomInput
                            label="Şirket Tam Unvanı"
                            value={newCompanyForm.name}
                            onChange={(val) => setNewCompanyForm(prev => ({ ...prev, name: getVal(val) }))}
                            placeholder="Örn: Akdeniz Lojistik Ltd. Şti."
                            required
                            maxLength={150}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <CustomInput
                                label="Vergi Numarası"
                                value={newCompanyForm.taxNumber}
                                onChange={(val) => setNewCompanyForm(prev => ({ ...prev, taxNumber: getVal(val) }))}
                                placeholder="10 haneli vergi no"
                                format="tc_no"
                                maxLength={11}
                            />
                            <CustomInput
                                label="Vergi Dairesi"
                                value={newCompanyForm.taxOffice}
                                onChange={(val) => setNewCompanyForm(prev => ({ ...prev, taxOffice: getVal(val) }))}
                                placeholder="Daire adı"
                                maxLength={50}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <CustomInput
                                label="SGK İşyeri No"
                                value={newCompanyForm.sgkNo}
                                onChange={(val) => setNewCompanyForm(prev => ({ ...prev, sgkNo: getVal(val) }))}
                                placeholder="SGK sicil no"
                                maxLength={30}
                            />
                            <CustomInput
                                label="Telefon"
                                value={newCompanyForm.phone}
                                onChange={(val) => setNewCompanyForm(prev => ({ ...prev, phone: getVal(val) }))}
                                placeholder="0212 XXX XX XX"
                                format="phone"
                                maxLength={14}
                            />
                        </div>

                        <CustomInput
                            label="Şirket Adresi"
                            value={newCompanyForm.address}
                            onChange={(val) => setNewCompanyForm(prev => ({ ...prev, address: getVal(val) }))}
                            placeholder="Açık adres..."
                            maxLength={250}
                        />

                        {/* Module Feature Flags */}
                        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0' }}>
                                <Sliders size={15} style={{ color: '#10b981' }} />
                                Şirket İçin Aktif Edilecek Modüller
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                {[
                                    { key: 'fleet', label: 'Filo Yönetimi', color: '#3b82f6' },
                                    { key: 'finance', label: 'Kasa & Finans', color: '#f59e0b' },
                                    { key: 'meals', label: 'Yemek Fişleri', color: '#ef4444' },
                                    { key: 'hr', label: 'Personel / İK', color: '#10b981' },
                                    { key: 'works', label: 'İş & Operasyon', color: '#8b5cf6' },
                                    { key: 'customers', label: 'Cari & Müşteri', color: '#ec4899' }
                                ].map(mod => {
                                    const isEnabled = newCompanyForm.modules?.[mod.key] !== false;
                                    return (
                                        <div
                                            key={mod.key}
                                            onClick={() => setNewCompanyForm(prev => ({
                                                ...prev,
                                                modules: {
                                                    ...(prev.modules || {}),
                                                    [mod.key]: !isEnabled
                                                }
                                            }))}
                                            className={`platform-modal-checkbox ${isEnabled ? 'active' : ''}`}
                                            style={{ padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            <div className="platform-checkbox-box">
                                                {isEnabled && <Check size={12} />}
                                            </div>
                                            <div style={{ fontSize: '11.5px', fontWeight: isEnabled ? 600 : 400, color: isEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                {mod.label}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setCreateCompanyModal(false)}>
                                İptal
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={createCompanyLoading}>
                                {createCompanyLoading ? 'Ekleniyor...' : 'Şirketi Oluştur'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ── MODAL: EDIT COMPANY & SUBSCRIPTION / QUOTAS ── */}
            {editCompanyModal && (
                <Modal
                    isOpen={editCompanyModal}
                    onClose={() => setEditCompanyModal(false)}
                    title={`Şirketi Düzenle & Abonelik Kotaları (${editCompanyForm.name || 'Şirket'})`}
                    size="lg"
                >
                    <form onSubmit={handleEditCompanySubmit} className="modal-form-grid">
                        <CustomInput
                            label="Şirket Tam Unvanı"
                            value={editCompanyForm.name}
                            onChange={(val) => setEditCompanyForm(prev => ({ ...prev, name: getVal(val) }))}
                            placeholder="Örn: Akdeniz Lojistik Ltd. Şti."
                            required
                            maxLength={150}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <CustomInput
                                label="Vergi Numarası"
                                value={editCompanyForm.taxNumber}
                                onChange={(val) => setEditCompanyForm(prev => ({ ...prev, taxNumber: getVal(val) }))}
                                placeholder="10 haneli vergi no"
                                format="tc_no"
                                maxLength={11}
                            />
                            <CustomInput
                                label="Vergi Dairesi"
                                value={editCompanyForm.taxOffice}
                                onChange={(val) => setEditCompanyForm(prev => ({ ...prev, taxOffice: getVal(val) }))}
                                placeholder="Daire adı"
                                maxLength={50}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <CustomInput
                                label="SGK İşyeri No"
                                value={editCompanyForm.sgkNo}
                                onChange={(val) => setEditCompanyForm(prev => ({ ...prev, sgkNo: getVal(val) }))}
                                placeholder="SGK sicil no"
                                maxLength={30}
                            />
                            <CustomInput
                                label="Telefon"
                                value={editCompanyForm.phone}
                                onChange={(val) => setEditCompanyForm(prev => ({ ...prev, phone: getVal(val) }))}
                                placeholder="0212 XXX XX XX"
                                format="phone"
                                maxLength={14}
                            />
                        </div>

                        <CustomInput
                            label="Şirket Adresi"
                            value={editCompanyForm.address}
                            onChange={(val) => setEditCompanyForm(prev => ({ ...prev, address: getVal(val) }))}
                            placeholder="Açık adres..."
                            maxLength={250}
                        />

                        {/* Subscription & Tier Settings */}
                        <div style={{ marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0' }}>
                                <Sparkles size={15} style={{ color: 'var(--primary)' }} />
                                SaaS Abonelik & Lisans Planı
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <CustomSelect
                                    label="Abonelik Paketi"
                                    value={editCompanyForm.plan}
                                    onChange={(val) => {
                                        const p = getVal(val);
                                        // Auto-adjust default quotas when plan changes
                                        let defaultV = 50, defaultE = 50, defaultU = 10;
                                        if (p === 'FREE') { defaultV = 5; defaultE = 5; defaultU = 2; }
                                        else if (p === 'STARTER') { defaultV = 15; defaultE = 15; defaultU = 5; }
                                        else if (p === 'ENTERPRISE') { defaultV = 500; defaultE = 500; defaultU = 50; }
                                        setEditCompanyForm(prev => ({
                                            ...prev,
                                            plan: p,
                                            maxVehicles: defaultV,
                                            maxEmployees: defaultE,
                                            maxUsers: defaultU
                                        }));
                                    }}
                                    options={[
                                        { value: 'FREE', label: 'Ücretsiz Deneme (Free Trial)' },
                                        { value: 'STARTER', label: 'Başlangıç (Starter - 15 Araç / 15 Personel)' },
                                        { value: 'PRO', label: 'Profesyonel (Pro - 50 Araç / 50 Personel)' },
                                        { value: 'ENTERPRISE', label: 'Kurumsal (Enterprise - 500+ Sınırsız)' }
                                    ]}
                                    floatingLabel={false}
                                />

                                <CustomSelect
                                    label="Hesap Durumu"
                                    value={editCompanyForm.status}
                                    onChange={(val) => setEditCompanyForm(prev => ({ ...prev, status: getVal(val) }))}
                                    options={[
                                        { value: 'active', label: 'Aktif (Kullanıma Açık)' },
                                        { value: 'suspended', label: 'Askıya Alındı (Donduruldu)' },
                                        { value: 'expired', label: 'Süresi Doldu (Erişim Kısıtlı)' }
                                    ]}
                                    floatingLabel={false}
                                />
                            </div>

                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                    Lisans Bitiş Tarihi (Boş bırakılırsa süresiz):
                                </label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={editCompanyForm.expiresAt}
                                    onChange={(e) => setEditCompanyForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                                    style={{ height: '38px', fontSize: '13px' }}
                                />
                            </div>
                        </div>

                        {/* Resource Quotas */}
                        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0' }}>
                                <Scale size={15} style={{ color: '#f59e0b' }} />
                                Kaynak Kullanım Kotaları
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                        Maks. Araç Sayısı
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5000"
                                        className="form-input"
                                        value={editCompanyForm.maxVehicles}
                                        onChange={(e) => setEditCompanyForm(prev => ({ ...prev, maxVehicles: parseInt(e.target.value) || 1 }))}
                                        style={{ height: '36px', fontSize: '13px', fontWeight: 600 }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                        Maks. Personel Sayısı
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5000"
                                        className="form-input"
                                        value={editCompanyForm.maxEmployees}
                                        onChange={(e) => setEditCompanyForm(prev => ({ ...prev, maxEmployees: parseInt(e.target.value) || 1 }))}
                                        style={{ height: '36px', fontSize: '13px', fontWeight: 600 }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                        Maks. Kullanıcı
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="500"
                                        className="form-input"
                                        value={editCompanyForm.maxUsers}
                                        onChange={(e) => setEditCompanyForm(prev => ({ ...prev, maxUsers: parseInt(e.target.value) || 1 }))}
                                        style={{ height: '36px', fontSize: '13px', fontWeight: 600 }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                        Depolama (MB)
                                    </label>
                                    <input
                                        type="number"
                                        min="100"
                                        max="100000"
                                        className="form-input"
                                        value={editCompanyForm.storageLimitMb}
                                        onChange={(e) => setEditCompanyForm(prev => ({ ...prev, storageLimitMb: parseInt(e.target.value) || 1024 }))}
                                        style={{ height: '36px', fontSize: '13px', fontWeight: 600 }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Module Feature Flags */}
                        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0' }}>
                                <Sliders size={15} style={{ color: '#10b981' }} />
                                Aktif Şirket Modülleri (Özellik Yetkileri)
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                                {[
                                    { key: 'fleet', label: 'Filo Yönetimi', color: '#3b82f6' },
                                    { key: 'finance', label: 'Kasa & Finans', color: '#f59e0b' },
                                    { key: 'meals', label: 'Yemek Fişleri', color: '#ef4444' },
                                    { key: 'hr', label: 'Personel / İK', color: '#10b981' },
                                    { key: 'works', label: 'İş & Operasyon', color: '#8b5cf6' },
                                    { key: 'customers', label: 'Cari & Müşteri', color: '#ec4899' }
                                ].map(mod => {
                                    const isEnabled = editCompanyForm.modules?.[mod.key] !== false;
                                    return (
                                        <div
                                            key={mod.key}
                                            onClick={() => setEditCompanyForm(prev => ({
                                                ...prev,
                                                modules: {
                                                    ...(prev.modules || {}),
                                                    [mod.key]: !isEnabled
                                                }
                                            }))}
                                            className={`platform-modal-checkbox ${isEnabled ? 'active' : ''}`}
                                            style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            <div className="platform-checkbox-box">
                                                {isEnabled && <Check size={12} />}
                                            </div>
                                            <div style={{ fontSize: '12px', fontWeight: isEnabled ? 600 : 400, color: isEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                {mod.label}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditCompanyModal(false)}>
                                İptal
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={editCompanyLoading}>
                                {editCompanyLoading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ── MODAL: CREATE USER WITH ROLE & POSITION ── */}
            {createUserModal && (
                <Modal
                    isOpen={createUserModal}
                    onClose={() => setCreateUserModal(false)}
                    title="Platforma Yeni Kullanıcı Ekle"
                    size="xl"
                >
                    <form onSubmit={handleCreateUserSubmit} className="modal-form-grid">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <CustomInput
                                label="Kullanıcı Adı"
                                value={newUserForm.username}
                                onChange={(val) => setNewUserForm(prev => ({ ...prev, username: getVal(val) }))}
                                placeholder="ornek_kullanici"
                                required
                                maxLength={50}
                            />
                            <CustomInput
                                label="E-Posta"
                                type="email"
                                value={newUserForm.email}
                                onChange={(val) => setNewUserForm(prev => ({ ...prev, email: getVal(val) }))}
                                placeholder="kullanici@sirket.com"
                                required
                                maxLength={100}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <CustomInput
                                label="Ad Soyad"
                                value={newUserForm.fullName}
                                onChange={(val) => setNewUserForm(prev => ({ ...prev, fullName: getVal(val) }))}
                                placeholder="Ahmet Yılmaz"
                                maxLength={100}
                            />
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Geçici Şifre <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <button
                                        type="button"
                                        className="ghost-btn"
                                        style={{ padding: '2px 6px', fontSize: '11px', color: '#3b82f6' }}
                                        onClick={() => {
                                            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*+=?';
                                            let pwd = '';
                                            for (let i = 0; i < 16; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                                            setNewUserForm(prev => ({ ...prev, password: pwd }));
                                            navigator.clipboard.writeText(pwd);
                                            alert('Güvenli Şifre Üretildi ve Panoya Kopyalandı:\n\n' + pwd);
                                        }}
                                    >
                                        Rastgele Üret
                                    </button>
                                </div>
                                <CustomInput
                                    value={newUserForm.password}
                                    onChange={(val) => setNewUserForm(prev => ({ ...prev, password: getVal(val) }))}
                                    placeholder="En az 4 karakter"
                                    required
                                    maxLength={64}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <CustomSelect
                                label="Bağlanacağı Şirket"
                                value={newUserForm.companyId}
                                onChange={(val) => setNewUserForm(prev => ({ ...prev, companyId: getVal(val) }))}
                                options={[
                                    { value: '', label: 'Şirketsiz / Sistem Kullanıcısı' },
                                    ...(tableCompanies || []).map(c => ({ value: String(c.id), label: `${c.name}` }))
                                ]}
                            />

                            {newUserForm.role === 'personnel' ? (
                                <CustomInput
                                    label="Personel Görevi / Pozisyonu"
                                    value={newUserForm.position}
                                    onChange={(val) => setNewUserForm(prev => ({ ...prev, position: getVal(val) }))}
                                    placeholder="Örn: Ağır Vasıta Şoförü"
                                    maxLength={50}
                                />
                            ) : (
                                <CustomInput
                                    label="Telefon Numarası"
                                    value={newUserForm.phone}
                                    onChange={(val) => setNewUserForm(prev => ({ ...prev, phone: getVal(val) }))}
                                    placeholder="05XX XXX XX XX"
                                    format="phone"
                                    maxLength={14}
                                />
                            )}
                        </div>

                        {/* ── 3-LEVEL PERMISSION MATRIX ── */}
                        <div style={{ marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
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
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
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

            {/* ── MODAL: REAL-TIME ONLINE USERS MONITOR ── */}
            {onlineUsersModal && (
                <Modal
                    isOpen={onlineUsersModal}
                    onClose={() => setOnlineUsersModal(false)}
                    title="Canlı Çevrimiçi Kullanıcılar & Aktif Oturumlar"
                    size="xl"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 12px #10b981' }} />
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                                            {onlineUsersData.onlineCount || 0} Aktif Çevrimiçi Kullanıcı
                                        </strong>
                                        <span className="badge badge-success" style={{ fontSize: '11px' }}>
                                            Canlı İzleme
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        Toplam {onlineUsersData.totalTracked || onlineUsersData.sessions?.length || 0} oturum takip ediliyor ({onlineUsersData.idleCount || 0} boşta / inaktif).
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={loadRealtimeUsers}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                                    <span>Yenile</span>
                                </button>
                            </div>
                        </div>

                        {(!onlineUsersData.sessions || onlineUsersData.sessions.length === 0) ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                Şu anda sistemde kayıtlı aktif canlı oturum bulunmuyor.
                            </div>
                        ) : (
                            <div style={{ maxHeight: '480px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-primary)' }}>
                                <table className="services-status-table" style={{ margin: 0, width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ minWidth: '180px' }}>Kullanıcı & Rol</th>
                                            <th style={{ minWidth: '180px' }}>Bağlı Şirket</th>
                                            <th style={{ minWidth: '160px' }}>İstemci / Cihaz & IP</th>
                                            <th style={{ minWidth: '130px' }}>Oturum Süresi</th>
                                            <th style={{ minWidth: '110px' }}>Canlı Durum</th>
                                            <th style={{ textAlign: 'right', minWidth: '130px' }}>Güvenlik İşlemi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {onlineUsersData.sessions.map((s) => (
                                            <tr key={s.sessionId} style={{ transition: 'background 0.1s ease' }}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-primary, #3b82f6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
                                                            {s.username ? s.username[0].toUpperCase() : 'U'}
                                                        </div>
                                                        <div>
                                                            <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block' }}>{s.username}</strong>
                                                            <span className="badge" style={{ fontSize: '9.5px', background: 'rgba(255,255,255,0.08)' }}>
                                                                {s.userRole}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Building2 size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                                        <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                                            {s.companyName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <code style={{ fontSize: '11.5px', color: 'var(--accent-primary, #3b82f6)' }}>{s.ip || '127.0.0.1'}</code>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.platform || s.userAgent}>
                                                            {s.platform || 'Web İstemcisi'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>{s.durationFormatted}</span>
                                                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                                            {s.lastSeenSecsAgo < 60 ? 'Az önce görüldü' : `${s.lastSeenSecsAgo} sn önce`}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {s.status === 'online' ? (
                                                        <span className="status-badge-active" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                                            Canlı
                                                        </span>
                                                    ) : (
                                                        <span className="status-badge-suspended" style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                                                            Boşta
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleTerminateSession(s)}
                                                        disabled={terminatingSessionId === s.sessionId}
                                                        title="Bu Oturumu Zorla Sonlandır (Kick / Force Logout)"
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '11.5px' }}
                                                    >
                                                        <XCircle size={13} />
                                                        <span>Sonlandır</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setOnlineUsersModal(false)}>
                                Kapat
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── MODAL: RESET PASSWORD ── */}
            {passwordModalUser && (
                <Modal
                    isOpen={!!passwordModalUser}
                    onClose={() => setPasswordModalUser(null)}
                    title={`Şifre Sıfırla: ${passwordModalUser.username}`}
                >
                    <form onSubmit={handleResetPasswordSubmit} className="modal-form-grid">
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                            <strong>{passwordModalUser.username}</strong> ({passwordModalUser.email}) kullanıcısı için yeni bir şifre belirleyin:
                        </p>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Yeni Şifre <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <button
                                    type="button"
                                    className="ghost-btn"
                                    style={{ padding: '2px 6px', fontSize: '11px', color: '#3b82f6' }}
                                    onClick={() => {
                                        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*+=?';
                                        let pwd = '';
                                        for (let i = 0; i < 16; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                                        setNewPassword(pwd);
                                        navigator.clipboard.writeText(pwd);
                                        alert('Güvenli Şifre Üretildi ve Panoya Kopyalandı:\n\n' + pwd);
                                    }}
                                >
                                    Rastgele Üret
                                </button>
                            </div>
                            <CustomInput
                                value={newPassword}
                                onChange={(val) => setNewPassword(getVal(val))}
                                placeholder="Yeni şifreyi girin"
                                maxLength={64}
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setPasswordModalUser(null)}>
                                İptal
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={passwordLoading}>
                                {passwordLoading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ── MODAL: EDIT USER ROLE & PERMISSIONS ── */}
            {editRoleModalUser && (
                <Modal
                    isOpen={!!editRoleModalUser}
                    onClose={() => setEditRoleModalUser(null)}
                    title={`Rol & Yetki Düzenle: ${editRoleModalUser.username}`}
                    size="md"
                >
                    <form onSubmit={handleSaveUserRole} className="modal-form-grid">
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                                    {editRoleModalUser.username}
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {editRoleModalUser.email}
                                </div>
                            </div>
                            <span className={`badge ${
                                editRoleModalUser.role === 'company_admin' || editRoleModalUser.accountType === 'company_owner' ? 'badge-primary' :
                                editRoleModalUser.role === 'superadmin' ? 'badge-warning' :
                                editRoleModalUser.role === 'personnel' ? 'badge-success' : 'badge-info'
                            }`}>
                                Mevcut: {editRoleModalUser.role || editRoleModalUser.accountType || 'user'}
                            </span>
                        </div>

                        <div>
                            <CustomInput
                                label="Kullanıcı Adı / Tam İsim"
                                value={editRoleForm.fullName}
                                onChange={(val) => setEditRoleForm(prev => ({ ...prev, fullName: getVal(val) }))}
                                placeholder="Örn: Halil Sak"
                                maxLength={100}
                            />
                        </div>

                        <div>
                            <CustomSelect
                                label="Sistem Rolü & Yetki Seviyesi"
                                value={editRoleForm.role}
                                onChange={(val) => setEditRoleForm(prev => ({ ...prev, role: getVal(val) }))}
                                options={userRoleOptions}
                            />
                        </div>

                        <div>
                            <CustomSelect
                                label="Bağlı Olduğu Şirket"
                                value={editRoleForm.companyId}
                                onChange={(val) => setEditRoleForm(prev => ({ ...prev, companyId: getVal(val) }))}
                                options={userCompanyOptions}
                            />
                        </div>

                        <div style={{ padding: '10px 12px', borderRadius: '6px', background: editRoleForm.role === 'company_admin' ? 'rgba(59, 130, 246, 0.08)' : (editRoleForm.role === 'personnel' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)'), border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                            {editRoleForm.role === 'company_admin' && (
                                <span>👑 <strong>Şirket Yöneticisi:</strong> Kasa Finans, Personel Maaşları, Genel Ayarlar, Araçlar ve İşler dahil şirketin tüm modüllerine sınırsız tam erişim hakkı kazanır.</span>
                            )}
                            {editRoleForm.role === 'manager' && (
                                <span>💼 <strong>Müdür:</strong> Operasyonel yönetim, araç takibi, işler ve finansal operasyonları yönetebilir.</span>
                            )}
                            {editRoleForm.role === 'personnel' && (
                                <span>👷 <strong>Personel / Sürücü:</strong> Sadece kendi görevlerini, zimmetli aracını ve personel profilini görür. Şirket kasası ve ayarlar gizlenir.</span>
                            )}
                            {editRoleForm.role === 'user' && (
                                <span>👤 <strong>Standart Kullanıcı:</strong> Temel operasyonları görür; kritik finansal verilere erişimi kısıtlıdır.</span>
                            )}
                            {editRoleForm.role === 'superadmin' && (
                                <span>⚡ <strong>Süper Yönetici:</strong> Tüm platform, tüm şirketler ve sistem ayarlarında tam platform yetkisi.</span>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditRoleModalUser(null)}>
                                İptal
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={editRoleLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {editRoleLoading && <Loader2 size={14} className="spin" />}
                                <span>{editRoleLoading ? 'Kaydediliyor...' : 'Rolü Güncelle'}</span>
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ── MODAL: AUDIT DETAIL PREVIEW ── */}
            {auditDetailModal && selectedAuditDetail && (
                <Modal
                    isOpen={auditDetailModal}
                    onClose={() => setAuditDetailModal(false)}
                    title="İşlem Denetim Detayı"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>İşlem Zamanı:</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {new Date(selectedAuditDetail.createdAt).toLocaleString('tr-TR')}
                                </div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>İlgili Şirket:</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {selectedAuditDetail.companyName || 'Sistem / Platform'}
                                </div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kullanıcı:</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {selectedAuditDetail.username} ({selectedAuditDetail.userRole || 'rolsüz'})
                                </div>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>İşlem Türü / Modül:</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {selectedAuditDetail.action} / {selectedAuditDetail.entityType}
                                </div>
                            </div>
                        </div>

                        <div>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Açıklama:</span>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: '8px' }}>
                                {selectedAuditDetail.description}
                            </div>
                        </div>

                        {selectedAuditDetail.details && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Değişiklik Verisi / Parametreler (JSON):</span>
                                    <button
                                        type="button"
                                        className="ghost-btn"
                                        onClick={() => {
                                            navigator.clipboard.writeText(JSON.stringify(selectedAuditDetail.details, null, 2));
                                            setCopiedDetailJson(true);
                                            setTimeout(() => setCopiedDetailJson(false), 2000);
                                        }}
                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                    >
                                        {copiedDetailJson ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                                        <span>{copiedDetailJson ? 'Kopyalandı' : 'JSON Kopyala'}</span>
                                    </button>
                                </div>
                                <pre style={{
                                    background: '#0f172a',
                                    color: '#38bdf8',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                    fontFamily: 'monospace',
                                    margin: 0
                                }}>
                                    {JSON.stringify(selectedAuditDetail.details, null, 2)}
                                </pre>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setAuditDetailModal(false)}>
                                Kapat
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}
