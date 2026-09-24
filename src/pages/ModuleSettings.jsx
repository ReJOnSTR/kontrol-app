import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { 
    Settings, Info, ToggleLeft, Sliders, Bell, Database, Shield, Palette, 
    Clock, Calculator, Pencil, Save, CalendarCheck, Users, Plus, Trash2, 
    Edit2, Briefcase, FileText, AlertCircle, Car, Wallet 
} from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import DataTable from '../components/DataTable'
import CustomInput from '../components/CustomInput'
import { useCompany } from '../context/CompanyContext'

const moduleConfig = {
    fleet: {
        title: 'Filo Yönetimi',
        description: 'Araç filonuzla ilgili genel ayarları buradan yönetebilirsiniz.',
        icon: Sliders,
    },
    finance: {
        title: 'Finans',
        description: 'Finans modülüne özel ayarları buradan yönetebilirsiniz.',
        icon: Database,
    },
    meals: {
        title: 'Yemek Fişi',
        description: 'Yemek fişi modülüne özel ayarları buradan yönetebilirsiniz.',
        icon: Bell,
    },
    hr: {
        title: 'Personel',
        description: 'Personel yönetimi modülüne özel ayarları buradan yönetebilirsiniz.',
        icon: Shield,
    },
    works: {
        title: 'İş & Operasyon',
        description: 'İş takibi modülüne özel ayarları buradan yönetebilirsiniz.',
        icon: ToggleLeft,
    },
    customers: {
        title: 'Müşteri',
        description: 'Cari ve müşteri modülüne özel ayarları buradan yönetebilirsiniz.',
        icon: Palette,
    }
}

// Default placeholder content for non-HR modules
function DefaultModuleContent({ config, ModuleIcon }) {
    return (
        <div className="settings-layout">
            <div className="settings-column">
                <div className="settings-section">
                    <h2 className="settings-section-title">Genel</h2>
                    <div className="settings-list">
                        <div className="settings-item" style={{ opacity: 0.5, cursor: 'default' }}>
                            <div className="settings-item-icon">
                                <ModuleIcon size={18} />
                            </div>
                            <div className="settings-item-content">
                                <div className="settings-item-label">Modül Tercihleri</div>
                                <div className="settings-item-desc">Bu modüle özel tercihler yakında eklenecektir</div>
                            </div>
                            <span className="badge badge-warning" style={{ fontSize: '10px' }}>YAKINDA</span>
                        </div>

                        <div className="settings-item" style={{ opacity: 0.5, cursor: 'default' }}>
                            <div className="settings-item-icon">
                                <Bell size={18} />
                            </div>
                            <div className="settings-item-content">
                                <div className="settings-item-label">Bildirim Tercihleri</div>
                                <div className="settings-item-desc">Bu modüle özel bildirim ayarları</div>
                            </div>
                            <span className="badge badge-warning" style={{ fontSize: '10px' }}>YAKINDA</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="settings-column">
                <div className="settings-section">
                    <h2 className="settings-section-title">Bilgi</h2>
                    <div className="settings-list">
                        <div className="settings-item" style={{ alignItems: 'flex-start' }}>
                            <div className="settings-item-icon" style={{ marginTop: '2px' }}>
                                <Info size={18} />
                            </div>
                            <div className="settings-item-content">
                                <div className="settings-item-label">{config.title} Modülü</div>
                                <div className="settings-item-desc" style={{ marginTop: '8px', lineHeight: '1.6' }}>
                                    Bu sayfa, <strong>{config.title}</strong> modülüne özel ayarların yönetileceği alandır.
                                    Yeni özellikler eklendikçe burada ilgili ayar seçenekleri görünecektir.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// HR Module Settings
function HrModuleContent() {
    const { currentCompany } = useCompany()
    const [weekdayMultiplier, setWeekdayMultiplier] = useState(() => {
        return parseFloat(localStorage.getItem('hr_overtime_weekday_multiplier')) || 1.5
    })
    const [sundayMultiplier, setSundayMultiplier] = useState(() => {
        return parseFloat(localStorage.getItem('hr_overtime_sunday_multiplier')) || 1.5
    })
    const [holidayMultiplier, setHolidayMultiplier] = useState(() => {
        return parseFloat(localStorage.getItem('hr_overtime_holiday_multiplier')) || 2.0
    })
    const [gurbetMultiplier, setGurbetMultiplier] = useState(() => {
        return parseFloat(localStorage.getItem('hr_overtime_gurbet_multiplier')) || 1.0
    })
    const [weekdayHoursPerLeave, setWeekdayHoursPerLeave] = useState(() => {
        return parseFloat(localStorage.getItem('hr_overtime_weekday_hours_per_leave')) || 8
    })
    const [sundayDaysPerLeave, setSundayDaysPerLeave] = useState(() => {
        return parseFloat(localStorage.getItem('hr_overtime_sunday_days_per_leave')) || 1
    })
    const [holidayDaysPerLeave, setHolidayDaysPerLeave] = useState(() => {
        return parseFloat(localStorage.getItem('hr_overtime_holiday_days_per_leave')) || 1
    })
    const [defaultAdvanceAmount, setDefaultAdvanceAmount] = useState(() => {
        return parseFloat(localStorage.getItem('hr_default_advance_amount')) || 0
    })

    // Personnel Data States
    const [personnelSettings, setPersonnelSettings] = useState({
        departments: [],
        leaveTypes: [],
        docCategories: []
    })
    const [publicHolidays, setPublicHolidays] = useState([])
    const [loadingPersonnel, setLoadingPersonnel] = useState(false)
    const [personnelModal, setPersonnelModal] = useState({
        isOpen: false,
        type: '', // 'dept', 'leave', 'doc', 'holiday'
        item: null,
        value: '',
        date: '',
        status: 'active'
    })
    const [confirmDeletePersonnel, setConfirmDeletePersonnel] = useState(null)

    // Modal
    const [showModal, setShowModal] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [editValue, setEditValue] = useState('')

    const settingsData = [
        {
            id: 'weekday',
            label: 'Hafta İçi Mesai Katsayısı',
            description: 'Saatlik ücret × katsayı (Maaş ÷ 30 ÷ 10 × katsayı)',
            value: weekdayMultiplier,
            unit: 'x',
            storageKey: 'hr_overtime_weekday_multiplier'
        },
        {
            id: 'sunday',
            label: 'Pazar Mesai Katsayısı',
            description: 'Günlük ücret × katsayı (Maaş ÷ 30 × katsayı)',
            value: sundayMultiplier,
            unit: 'x',
            storageKey: 'hr_overtime_sunday_multiplier'
        },
        {
            id: 'holiday',
            label: 'Bayram Mesai Katsayısı',
            description: 'Günlük ücret × katsayı (Maaş ÷ 30 × katsayı)',
            value: holidayMultiplier,
            unit: 'x',
            storageKey: 'hr_overtime_holiday_multiplier'
        },
        {
            id: 'gurbet',
            label: 'Gurbet Mesai Katsayısı',
            description: 'Günlük ücret × katsayı (Maaş ÷ 30 × katsayı)',
            value: gurbetMultiplier,
            unit: 'x',
            storageKey: 'hr_overtime_gurbet_multiplier'
        },
        {
            id: 'weekday_leave',
            label: 'Hafta İçi Mesai → İzin',
            description: 'Kaç saat hafta içi mesai = 1 gün izin',
            value: weekdayHoursPerLeave,
            unit: ' saat',
            storageKey: 'hr_overtime_weekday_hours_per_leave'
        },
        {
            id: 'sunday_leave',
            label: 'Pazar Mesai → İzin',
            description: 'Kaç pazar mesai günü = 1 gün izin',
            value: sundayDaysPerLeave,
            unit: ' gün',
            storageKey: 'hr_overtime_sunday_days_per_leave'
        },
        {
            id: 'holiday_leave',
            label: 'Bayram Mesai → İzin',
            description: 'Kaç bayram mesai günü = 1 gün izin',
            value: holidayDaysPerLeave,
            unit: ' gün',
            storageKey: 'hr_overtime_holiday_days_per_leave'
        },
        {
            id: 'default_advance',
            label: 'Varsayılan Avans Tutarı',
            description: 'Ödeme eklerken avans seçildiğinde otomatik doldurulan tutar',
            value: defaultAdvanceAmount,
            unit: ' ₺',
            storageKey: 'hr_default_advance_amount'
        }
    ]

    const columns = [
        {
            key: 'label',
            label: 'Ayar',
            sortable: false,
            render: (val, item) => (
                <div>
                    <div style={{ fontWeight: '500' }}>{val}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.description}</div>
                </div>
            )
        },
        {
            key: 'value',
            label: 'Değer',
            sortable: false,
            render: (val, item) => (
                <span style={{ fontWeight: '600', color: 'var(--accent-primary)', fontSize: '15px' }}>
                    {val}{item.unit}
                </span>
            )
        }
    ]

    useEffect(() => {
        loadPersonnelSettings()
    }, [currentCompany])

    const loadPersonnelSettings = async () => {
        if (!currentCompany) return
        setLoadingPersonnel(true)
        try {
            const [depts, leaves, docs, holidays] = await Promise.all([
                window.electronAPI.getDepartments(currentCompany.id),
                window.electronAPI.getLeaveTypes(currentCompany.id),
                window.electronAPI.getDocumentCategories(currentCompany.id, 'employee'),
                window.electronAPI.getPublicHolidays(currentCompany.id)
            ])
            setPersonnelSettings({
                departments: depts.data || [],
                leaveTypes: leaves.data || [],
                docCategories: docs.data || []
            })
            setPublicHolidays(holidays.data || [])
        } catch (error) {
            console.error('Failed to load personnel settings:', error)
        }
        setLoadingPersonnel(false)
    }

    const handleSavePersonnelItem = async (e) => {
        if (e) e.preventDefault()
        if (!personnelModal.value.trim()) return

        try {
            let result
            if (personnelModal.type === 'dept') {
                result = personnelModal.item 
                    ? await window.electronAPI.updateDepartment({ id: personnelModal.item.id, name: personnelModal.value, status: personnelModal.status })
                    : await window.electronAPI.createDepartment({ companyId: currentCompany.id, name: personnelModal.value })
            } else if (personnelModal.type === 'leave') {
                result = personnelModal.item
                    ? await window.electronAPI.updateLeaveType({ id: personnelModal.item.id, name: personnelModal.value, status: personnelModal.status })
                    : await window.electronAPI.createLeaveType({ companyId: currentCompany.id, name: personnelModal.value })
            } else if (personnelModal.type === 'doc') {
                result = personnelModal.item
                    ? await window.electronAPI.updateDocumentCategory({ id: personnelModal.item.id, name: personnelModal.value, status: personnelModal.status })
                    : await window.electronAPI.createDocumentCategory({ companyId: currentCompany.id, name: personnelModal.value, targetType: 'employee' })
            } else if (personnelModal.type === 'holiday') {
                if (!personnelModal.date) return
                result = personnelModal.item
                    ? await window.electronAPI.updatePublicHoliday({ id: personnelModal.item.id, date: personnelModal.date, description: personnelModal.value, status: personnelModal.status })
                    : await window.electronAPI.createPublicHoliday({ companyId: currentCompany.id, date: personnelModal.date, description: personnelModal.value })
            }

            if (result && result.success) {
                setPersonnelModal({ isOpen: false, type: '', item: null, value: '', date: '', status: 'active' })
                loadPersonnelSettings()
            } else {
                alert('Kaydedilemedi: ' + (result?.error || 'Bilinmeyen Hata'))
            }
        } catch (err) {
            console.error('Save personnel item error:', err)
            alert('Kaydetme hatası: ' + err.message)
        }
    }

    const handleDeletePersonnelItem = async () => {
        if (!confirmDeletePersonnel) return
        try {
            let result
            if (confirmDeletePersonnel.type === 'dept') result = await window.electronAPI.deleteDepartment(confirmDeletePersonnel.id)
            else if (confirmDeletePersonnel.type === 'leave') result = await window.electronAPI.deleteLeaveType(confirmDeletePersonnel.id)
            else if (confirmDeletePersonnel.type === 'doc') result = await window.electronAPI.deleteDocumentCategory(confirmDeletePersonnel.id)
            else if (confirmDeletePersonnel.type === 'holiday') result = await window.electronAPI.deletePublicHoliday(confirmDeletePersonnel.id)

            if (result.success) {
                setConfirmDeletePersonnel(null)
                loadPersonnelSettings()
            }
        } catch (err) {
            console.error('Delete personnel item error:', err)
        }
    }

    const toggleStatus = async (type, item) => {
        const newStatus = item.status === 'passive' ? 'active' : 'passive'
        try {
            let result
            if (type === 'dept') result = await window.electronAPI.updateDepartment({ id: item.id, name: item.name, status: newStatus })
            else if (type === 'leave') result = await window.electronAPI.updateLeaveType({ id: item.id, name: item.name, status: newStatus })
            else if (type === 'doc') result = await window.electronAPI.updateDocumentCategory({ id: item.id, name: item.name, status: newStatus })
            else if (type === 'holiday') result = await window.electronAPI.updatePublicHoliday({ id: item.id, date: item.date, description: item.description, status: newStatus })

            if (result && result.success) {
                loadPersonnelSettings()
            }
        } catch (err) {
            console.error('Toggle status error:', err)
        }
    }

    const openEdit = (item) => {
        setEditingItem(item)
        setEditValue(String(item.value))
        setShowModal(true)
    }

    const handleSave = (e) => {
        e.preventDefault()
        const numVal = parseFloat(editValue)
        if (isNaN(numVal) || numVal <= 0) return

        localStorage.setItem(editingItem.storageKey, numVal.toString())

        if (editingItem.id === 'weekday') setWeekdayMultiplier(numVal)
        if (editingItem.id === 'sunday') setSundayMultiplier(numVal)
        if (editingItem.id === 'holiday') setHolidayMultiplier(numVal)
        if (editingItem.id === 'gurbet') setGurbetMultiplier(numVal)
        if (editingItem.id === 'weekday_leave') setWeekdayHoursPerLeave(numVal)
        if (editingItem.id === 'sunday_leave') setSundayDaysPerLeave(numVal)
        if (editingItem.id === 'holiday_leave') setHolidayDaysPerLeave(numVal)
        if (editingItem.id === 'default_advance') setDefaultAdvanceAmount(numVal)

        setShowModal(false)
        setEditingItem(null)
    }

    return (
        <>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '25px' }}>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">HAFTA İÇİ</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Clock size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{weekdayMultiplier}x</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Mesai katsayısı</div>
                    </div>
                </div>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">PAZAR</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Calculator size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{sundayMultiplier}x</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Mesai katsayısı</div>
                    </div>
                </div>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">BAYRAM</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Calculator size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{holidayMultiplier}x</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Mesai katsayısı</div>
                    </div>
                </div>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">GURBET</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Calculator size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{gurbetMultiplier}x</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Mesai katsayısı</div>
                    </div>
                </div>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">H.İÇİ → İZİN</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><CalendarCheck size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{weekdayHoursPerLeave} saat</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>= 1 gün izin</div>
                    </div>
                </div>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">PAZAR → İZİN</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><CalendarCheck size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{sundayDaysPerLeave} gün</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>= 1 gün izin</div>
                    </div>
                </div>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">BAYRAM → İZİN</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><CalendarCheck size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{holidayDaysPerLeave} gün</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>= 1 gün izin</div>
                    </div>
                </div>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">AVANS TUTARI</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Wallet size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{defaultAdvanceAmount > 0 ? `₺${defaultAdvanceAmount.toLocaleString('tr-TR')}` : 'Belirlenmedi'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Varsayılan avans</div>
                    </div>
                </div>
            </div>

            {/* Katsayı Ayarları Bölümü */}
            <div className="settings-section" style={{ marginTop: '30px' }}>
                <h3 className="settings-section-title">
                    <Calculator size={18} />
                    <span>Mesai ve İzin Hesaplama Katsayıları</span>
                </h3>
                
                <DataTable
                    persistenceKey="ModuleSettings_hr_table_0"
                    storageKey="module_settings_hr_cols"
                    columns={columns}
                    data={settingsData}
                    emptyMessage="Ayar bulunamadı."
                    searchable={false}
                    paginated={false}
                    actions={(item) => (
                        <button title="Düzenle" onClick={() => openEdit(item)}><Pencil size={16} /></button>
                    )}
                />
            </div>

            {/* Personel Tanımlamaları Bölümü */}
            <div className="settings-section" style={{ marginTop: '40px' }}>
                <h3 className="settings-section-title">
                    <Users size={18} />
                    <span>Personel Tanımlamaları</span>
                </h3>
                {!currentCompany ? (
                    <div className="alert alert-warning">
                        <AlertCircle size={18} />
                        <span>Tanımlamaları yönetmek için lütfen bir şirket seçin.</span>
                    </div>
                ) : (
                    <div className="personnel-settings-grid">
                        {/* Departments Section */}
                        <div className="personnel-card">
                            <div className="section-header">
                                <div className="section-title">
                                    <Briefcase size={16} />
                                    <span>Departman Türleri</span>
                                </div>
                                <button className="btn btn-icon-sm" onClick={() => setPersonnelModal({ isOpen: true, type: 'dept', item: null, value: '' })}>
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="settings-list">
                                {personnelSettings.departments.map(dept => (
                                    <div key={dept.id} className="settings-list-item" style={{ opacity: dept.status === 'passive' ? 0.6 : 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ textDecoration: dept.status === 'passive' ? 'line-through' : 'none' }}>{dept.name}</span>
                                            <button 
                                                className={`badge badge-${dept.status === 'passive' ? 'neutral' : 'success'}`} 
                                                style={{ border: 'none', cursor: 'pointer', fontSize: '10px', padding: '2px 6px' }}
                                                onClick={() => toggleStatus('dept', dept)}
                                            >
                                                {dept.status === 'passive' ? 'Pasif' : 'Aktif'}
                                            </button>
                                        </div>
                                        <div className="item-actions">
                                            <button onClick={() => setPersonnelModal({ isOpen: true, type: 'dept', item: dept, value: dept.name, date: '', status: dept.status || 'active' })}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="text-danger" onClick={() => setConfirmDeletePersonnel({ ...dept, type: 'dept' })}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {personnelSettings.departments.length === 0 && <div className="empty-list-msg">Departman tanımlanmamış.</div>}
                            </div>
                        </div>

                        {/* Leave Types Section */}
                        <div className="personnel-card">
                            <div className="section-header">
                                <div className="section-title">
                                    <CalendarCheck size={16} />
                                    <span>İzin Türleri</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <div className="info-tooltip-container">
                                        <button className="btn btn-icon-sm info-btn">
                                            <Info size={14} />
                                        </button>
                                        <div className="info-tooltip">
                                            <div style={{ fontWeight: 800, marginBottom: '10px', color: 'var(--accent-primary)', fontSize: '13px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Info size={14} /> 4857 Sayılı Kanun (İzinler)
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>• Evlilik İzni:</span>
                                                    <span style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>3 Gün</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>• Ölüm İzni:</span>
                                                    <span style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>3 Gün</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>• Babalık İzni:</span>
                                                    <span style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>5 Gün</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>• Engelli Çocuk:</span>
                                                    <span style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>10 Gün</span>
                                                </div>
                                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-light)' }}>
                                                    <div style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: '11px', marginBottom: '4px' }}>Yıllık Ücretli İzin (Kıdem)</div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>1-5 Yıl:</span>
                                                        <span style={{ color: 'var(--text-primary)' }}>14 Gün</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>5-15 Yıl:</span>
                                                        <span style={{ color: 'var(--text-primary)' }}>20 Gün</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>15+ Yıl:</span>
                                                        <span style={{ color: 'var(--text-primary)' }}>26 Gün</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="btn btn-icon-sm" onClick={() => setPersonnelModal({ isOpen: true, type: 'leave', item: null, value: '' })}>
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="settings-list">
                                {personnelSettings.leaveTypes.map(type => {
                                    const lower = type.name.toLowerCase();
                                    let hint = '';
                                    const isAdditiveAnnual = ['ekleme', 'ilave', 'artı', 'arttır', 'kazanılan', 'devir'].some(kw => lower.includes(kw)) && (lower.includes('yıllık') || lower === 'annual');
                                     
                                    if (isAdditiveAnnual) hint = 'Sistem: Yıllık izin bakiyesini arttırır';
                                    else if (lower.includes('yıllık')) hint = '1-5 yıl: 14 gün, 5-15 yıl: 20 gün, 15+ yıl: 26 gün';
                                    else if (lower.includes('evlilik')) hint = 'Yasal: 3 Gün';
                                    else if (lower.includes('ölüm')) hint = 'Yasal: 3 Gün';
                                    else if (lower.includes('babalık')) hint = 'Yasal: 5 Gün';
                                    else if (lower.includes('engelli')) hint = 'Yasal: 10 Gün';
                                    else if (lower.includes('mesai')) hint = 'Sistem: Otomatik mahsup için gereklidir';
                                    const isOfficial = !!hint;

                                    return (
                                        <div key={type.id} className="settings-list-item" style={{ opacity: type.status === 'passive' ? 0.6 : 1 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ textDecoration: type.status === 'passive' ? 'line-through' : 'none' }}>{type.name}</span>
                                                    <button 
                                                        className={`badge badge-${type.status === 'passive' ? 'neutral' : 'success'}`} 
                                                        style={{ border: 'none', cursor: 'pointer', fontSize: '10px', padding: '2px 6px' }}
                                                        onClick={() => toggleStatus('leave', type)}
                                                    >
                                                        {type.status === 'passive' ? 'Pasif' : 'Aktif'}
                                                    </button>
                                                </div>
                                                {hint && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hint}</span>}
                                            </div>
                                            <div className="item-actions">
                                                <button onClick={() => setPersonnelModal({ isOpen: true, type: 'leave', item: type, value: type.name, date: '', status: type.status || 'active' })}>
                                                    <Edit2 size={14} />
                                                </button>
                                                {!isOfficial && (
                                                    <button className="text-danger" onClick={() => setConfirmDeletePersonnel({ ...type, type: 'leave' })}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                                {isOfficial && (
                                                    <button className="text-muted" style={{ opacity: 0.5, cursor: 'not-allowed' }} title="Yasal izinler silinemez">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {personnelSettings.leaveTypes.length === 0 && <div className="empty-list-msg">İzin türü tanımlanmamış.</div>}
                            </div>
                        </div>

                        {/* Document Categories Section */}
                        <div className="personnel-card">
                            <div className="section-header">
                                <div className="section-title">
                                    <FileText size={16} />
                                    <span>Belge Kategorileri</span>
                                </div>
                                <button className="btn btn-icon-sm" onClick={() => setPersonnelModal({ isOpen: true, type: 'doc', item: null, value: '' })}>
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="settings-list">
                                {personnelSettings.docCategories.map(cat => (
                                    <div key={cat.id} className="settings-list-item" style={{ opacity: cat.status === 'passive' ? 0.6 : 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ textDecoration: cat.status === 'passive' ? 'line-through' : 'none' }}>{cat.name}</span>
                                            <button 
                                                className={`badge badge-${cat.status === 'passive' ? 'neutral' : 'success'}`} 
                                                style={{ border: 'none', cursor: 'pointer', fontSize: '10px', padding: '2px 6px' }}
                                                onClick={() => toggleStatus('doc', cat)}
                                            >
                                                {cat.status === 'passive' ? 'Pasif' : 'Aktif'}
                                            </button>
                                        </div>
                                        <div className="item-actions">
                                            <button onClick={() => setPersonnelModal({ isOpen: true, type: 'doc', item: cat, value: cat.name, date: '', status: cat.status || 'active' })}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="text-danger" onClick={() => setConfirmDeletePersonnel({ ...cat, type: 'doc' })}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {personnelSettings.docCategories.length === 0 && <div className="empty-list-msg">Belge kategorisi tanımlanmamış.</div>}
                            </div>
                        </div>

                        {/* Public Holidays Section */}
                        <div className="personnel-card">
                            <div className="section-header">
                                <div className="section-title">
                                    <CalendarCheck size={16} />
                                    <span>Resmi ve Özel Tatiller</span>
                                </div>
                                <button className="btn btn-icon-sm" onClick={() => setPersonnelModal({ isOpen: true, type: 'holiday', item: null, value: '', date: new Date().toISOString().split('T')[0] })}>
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="settings-list">
                                {publicHolidays.map(holiday => (
                                    <div key={holiday.id} className="settings-list-item" style={{ opacity: holiday.status === 'passive' ? 0.6 : 1 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ textDecoration: holiday.status === 'passive' ? 'line-through' : 'none' }}>{holiday.description}</span>
                                                <button 
                                                    className={`badge badge-${holiday.status === 'passive' ? 'neutral' : 'success'}`} 
                                                    style={{ border: 'none', cursor: 'pointer', fontSize: '10px', padding: '2px 6px' }}
                                                    onClick={() => toggleStatus('holiday', holiday)}
                                                >
                                                    {holiday.status === 'passive' ? 'Pasif' : 'Aktif'}
                                                </button>
                                            </div>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                {new Date(holiday.date).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                        <div className="item-actions">
                                            <button onClick={() => setPersonnelModal({ isOpen: true, type: 'holiday', item: holiday, value: holiday.description, date: new Date(holiday.date).toISOString().split('T')[0], status: holiday.status || 'active' })}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="text-danger" onClick={() => setConfirmDeletePersonnel({ ...holiday, name: holiday.description, type: 'holiday' })}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {publicHolidays.length === 0 && <div className="empty-list-msg">Tatil günü tanımlanmamış.</div>}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Katsayı Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingItem ? `${editingItem.label} Düzenle` : 'Düzenle'}
            >
                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label className="form-label">Katsayı Değeri</label>
                        <input
                            type="number"
                            className="form-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            min="0.1"
                            max="10"
                            step="0.1"
                            placeholder="Örn: 1.5"
                            autoFocus
                        />
                        {editingItem && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.6' }}>
                                {editingItem.id === 'weekday' && <>Hesaplama: Maaş ÷ 30 ÷ 10 × <strong>{editValue || '?'}</strong> = Saatlik mesai ücreti</>}
                                {editingItem.id === 'sunday' && <>Hesaplama: Maaş ÷ 30 × <strong>{editValue || '?'}</strong> = Günlük pazar mesai ücreti</>}
                                {editingItem.id === 'holiday' && <>Hesaplama: Maaş ÷ 30 × <strong>{editValue || '?'}</strong> = Günlük bayram mesai ücreti</>}
                                {editingItem.id === 'gurbet' && <>Hesaplama: Maaş ÷ 30 × <strong>{editValue || '?'}</strong> = Günlük gurbet mesai ücreti</>}
                                {editingItem.id === 'weekday_leave' && <><strong>{editValue || '?'}</strong> saat hafta içi mesai yapan personel 1 gün izin hak eder</>}
                                {editingItem.id === 'sunday_leave' && <><strong>{editValue || '?'}</strong> gün pazar mesai yapan personel 1 gün izin hak eder</>}
                                {editingItem.id === 'holiday_leave' && <><strong>{editValue || '?'}</strong> gün bayram mesai yapan personel 1 gün izin hak eder</>}
                                {editingItem.id === 'default_advance' && <>Avans işlemi eklerken tutar otomatik olarak <strong>₺{editValue || '0'}</strong> olarak doldurulacaktır. Değiştirilebilir.</>}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>İptal</button>
                        <button type="submit" className="btn btn-primary">
                            <Save size={15} />
                            Kaydet
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Personnel Definitions Add/Edit Modal */}
            <Modal
                isOpen={personnelModal.isOpen}
                onClose={() => setPersonnelModal({ isOpen: false, type: '', item: null, value: '', date: '', status: 'active' })}
                title={personnelModal.item ? 'Tanımlama Düzenle' : 'Yeni Tanımlama Ekle'}
                size="small"
            >
                <form onSubmit={handleSavePersonnelItem}>
                    {personnelModal.type === 'holiday' && (
                        <CustomInput 
                            label="Tarih *"
                            type="date"
                            value={personnelModal.date}
                            onChange={(val) => setPersonnelModal(prev => ({ ...prev, date: val }))}
                            required
                            style={{ marginBottom: '16px' }}
                        />
                    )}
                    <CustomInput 
                        label={personnelModal.type === 'dept' ? 'Departman Adı' : personnelModal.type === 'leave' ? 'İzin Türü Adı' : personnelModal.type === 'doc' ? 'Belge Kategori Adı' : 'Bayram / Tatil Nedeni'}
                        value={personnelModal.value}
                        onChange={(val) => setPersonnelModal(prev => ({ ...prev, value: val }))}
                        autoFocus={personnelModal.type !== 'holiday'}
                        required
                        maxLength={60}
                    />

                    {personnelModal.item && (
                        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Aktif / Pasif Durumu</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {personnelModal.status === 'active' ? 'Aktif - Seçim listelerinde listelenir' : 'Pasif - Seçim listelerinden gizlenir'}
                                </span>
                            </div>
                            <label className="toggle-switch" style={{ flexShrink: 0 }}>
                                <input 
                                    type="checkbox" 
                                    checked={personnelModal.status === 'active'} 
                                    onChange={(e) => setPersonnelModal(prev => ({ ...prev, status: e.target.checked ? 'active' : 'passive' }))} 
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setPersonnelModal({ isOpen: false, type: '', item: null, value: '', date: '', status: 'active' })}>Vazgeç</button>
                        <button type="submit" className="btn btn-primary">Kaydet</button>
                    </div>
                </form>
            </Modal>

            {/* Personnel Delete Confirm */}
            <ConfirmModal 
                isOpen={!!confirmDeletePersonnel}
                onClose={() => setConfirmDeletePersonnel(null)}
                onConfirm={handleDeletePersonnelItem}
                title="Tanımlamayı Sil?"
                message={`"${confirmDeletePersonnel?.name}" tanımını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
            />
        </>
    )
}

// Fleet Module Settings
function FleetModuleContent() {
    const { currentCompany } = useCompany()
    const [fleetSettings, setFleetSettings] = useState({
        vehicleTypes: [],
        docCategories: []
    })
    const [loading, setLoading] = useState(false)
    const [modal, setModal] = useState({
        isOpen: false,
        type: '', // 'vehicleType', 'doc'
        item: null,
        value: ''
    })
    const [confirmDelete, setConfirmDelete] = useState(null)

    useEffect(() => {
        loadFleetSettings()
    }, [currentCompany])

    const loadFleetSettings = async () => {
        if (!currentCompany) return
        setLoading(true)
        try {
            const [vtRes, dcRes] = await Promise.all([
                window.electronAPI.getVehicleTypes(currentCompany.id),
                window.electronAPI.getDocumentCategories(currentCompany.id, 'vehicle')
            ])
            setFleetSettings({
                vehicleTypes: vtRes.data || [],
                docCategories: dcRes.data || []
            })
        } catch (error) {
            console.error('Failed to load fleet settings:', error)
        }
        setLoading(false)
    }

    const handleSave = async (e) => {
        if (e) e.preventDefault()
        if (!modal.value.trim()) return

        try {
            let result
            if (modal.type === 'vehicleType') {
                result = modal.item
                    ? await window.electronAPI.updateVehicleType({ id: modal.item.id, name: modal.value })
                    : await window.electronAPI.createVehicleType({ companyId: currentCompany.id, name: modal.value })
            } else if (modal.type === 'doc') {
                result = modal.item
                    ? await window.electronAPI.updateDocumentCategory({ id: modal.item.id, name: modal.value })
                    : await window.electronAPI.createDocumentCategory({ companyId: currentCompany.id, name: modal.value, targetType: 'vehicle' })
            }

            if (result && result.success) {
                setModal({ isOpen: false, type: '', item: null, value: '' })
                loadFleetSettings()
            }
        } catch (err) {
            console.error('Save fleet settings error:', err)
        }
    }

    const handleDelete = async () => {
        if (!confirmDelete) return
        try {
            let result
            if (confirmDelete.type === 'vehicleType') {
                result = await window.electronAPI.deleteVehicleType(confirmDelete.id)
            } else if (confirmDelete.type === 'doc') {
                result = await window.electronAPI.deleteDocumentCategory(confirmDelete.id)
            }

            if (result && result.success) {
                setConfirmDelete(null)
                loadFleetSettings()
            }
        } catch (err) {
            console.error('Delete fleet settings error:', err)
        }
    }

    return (
        <div className="fade-in">
            <div className="settings-section">
                <h3 className="settings-section-title">
                    <Car size={18} />
                    <span>Araç Tanımlamaları</span>
                </h3>
                
                <div className="personnel-settings-grid">
                    {/* Vehicle Types Card */}
                    <div className="personnel-card">
                        <div className="section-header">
                            <div className="section-title">
                                <Sliders size={16} />
                                <span>Araç Türleri</span>
                            </div>
                            <button className="btn btn-icon-sm" onClick={() => setModal({ isOpen: true, type: 'vehicleType', item: null, value: '' })}>
                                <Plus size={14} />
                            </button>
                        </div>
                        <div className="settings-list">
                            {fleetSettings.vehicleTypes.map(type => (
                                <div key={type.id} className="settings-list-item">
                                    <span>{type.name}</span>
                                    <div className="item-actions">
                                        <button onClick={() => setModal({ isOpen: true, type: 'vehicleType', item: type, value: type.name })}>
                                            <Edit2 size={14} />
                                        </button>
                                        <button className="text-danger" onClick={() => setConfirmDelete({ ...type, type: 'vehicleType' })}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {fleetSettings.vehicleTypes.length === 0 && !loading && <div className="empty-list-msg">Araç türü tanımlanmamış.</div>}
                            {loading && <div className="empty-list-msg">Yükleniyor...</div>}
                        </div>
                    </div>

                    {/* Vehicle Document Categories Card */}
                    <div className="personnel-card">
                        <div className="section-header">
                            <div className="section-title">
                                <FileText size={16} />
                                <span>Araç Belge Kategorileri</span>
                            </div>
                            <button className="btn btn-icon-sm" onClick={() => setModal({ isOpen: true, type: 'doc', item: null, value: '' })}>
                                <Plus size={14} />
                            </button>
                        </div>
                        <div className="settings-list">
                            {fleetSettings.docCategories.map(cat => (
                                <div key={cat.id} className="settings-list-item">
                                    <span>{cat.name}</span>
                                    <div className="item-actions">
                                        <button onClick={() => setModal({ isOpen: true, type: 'doc', item: cat, value: cat.name })}>
                                            <Edit2 size={14} />
                                        </button>
                                        <button className="text-danger" onClick={() => setConfirmDelete({ ...cat, type: 'doc' })}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {fleetSettings.docCategories.length === 0 && !loading && <div className="empty-list-msg">Araç belge kategorisi tanımlanmamış.</div>}
                            {loading && <div className="empty-list-msg">Yükleniyor...</div>}
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ isOpen: false, type: '', item: null, value: '' })}
                title={
                    modal.type === 'vehicleType'
                        ? (modal.item ? 'Araç Türünü Düzenle' : 'Yeni Araç Türü Ekle')
                        : (modal.item ? 'Belge Kategorisini Düzenle' : 'Yeni Belge Kategorisi Ekle')
                }
                size="small"
            >
                <form onSubmit={handleSave}>
                    <CustomInput 
                        label={modal.type === 'vehicleType' ? 'Araç Türü Adı' : 'Kategori Adı'}
                        value={modal.value}
                        onChange={(val) => setModal(prev => ({ ...prev, value: val }))}
                        autoFocus
                        required
                        maxLength={60}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setModal({ isOpen: false, type: '', item: null, value: '' })}>Vazgeç</button>
                        <button type="submit" className="btn btn-primary">Kaydet</button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal 
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title={confirmDelete?.type === 'vehicleType' ? 'Araç Türünü Sil?' : 'Belge Kategorisini Sil?'}
                message={`"${confirmDelete?.name}" ${confirmDelete?.type === 'vehicleType' ? 'türünü' : 'kategorisini'} silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
            />
        </div>
    )
}

export { HrModuleContent, FleetModuleContent, DefaultModuleContent, moduleConfig }


export default function ModuleSettings() {
    const location = useLocation()

    const moduleKey = location.pathname.split('/module-settings/')[1] || 'fleet'
    const config = moduleConfig[moduleKey] || moduleConfig.fleet
    const ModuleIcon = config.icon

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{config.title} Ayarları</h1>
                    <p className="page-subtitle">{config.description}</p>
                </div>
            </div>

            {moduleKey === 'hr' ? (
                <HrModuleContent />
            ) : moduleKey === 'fleet' ? (
                <FleetModuleContent />
            ) : (
                <DefaultModuleContent config={config} ModuleIcon={ModuleIcon} />
            )}
        </div>
    )
}

