import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { 
    Settings, Info, ToggleLeft, Sliders, Bell, Database, Shield, Palette, 
    Clock, Calculator, Pencil, Save, CalendarCheck, Users, Plus, Trash2, 
    Edit2, Briefcase, FileText, AlertCircle, Car, Wallet, Coins, Percent, 
    Calendar, CheckCircle2, ShieldCheck, ArrowRight
} from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import DataTable from '../components/DataTable'
import CustomInput from '../components/CustomInput'
import CustomSelect from '../components/CustomSelect'
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
    const { currentCompany, companySettings, updateCompanySettings } = useCompany()
    const [weekdayMultiplier, setWeekdayMultiplier] = useState(1.5)
    const [sundayMultiplier, setSundayMultiplier] = useState(1.5)
    const [holidayMultiplier, setHolidayMultiplier] = useState(2.0)
    const [gurbetMultiplier, setGurbetMultiplier] = useState(1.0)
    const [weekdayHoursPerLeave, setWeekdayHoursPerLeave] = useState(8)
    const [sundayDaysPerLeave, setSundayDaysPerLeave] = useState(1)
    const [holidayDaysPerLeave, setHolidayDaysPerLeave] = useState(1)
    const [defaultAdvanceAmount, setDefaultAdvanceAmount] = useState(0)

    useEffect(() => {
        if (companySettings?.hr) {
            const hr = companySettings.hr
            if (hr.weekdayMultiplier !== undefined) setWeekdayMultiplier(hr.weekdayMultiplier)
            if (hr.sundayMultiplier !== undefined) setSundayMultiplier(hr.sundayMultiplier)
            if (hr.holidayMultiplier !== undefined) setHolidayMultiplier(hr.holidayMultiplier)
            if (hr.gurbetMultiplier !== undefined) setGurbetMultiplier(hr.gurbetMultiplier)
            if (hr.weekdayHoursPerLeave !== undefined) setWeekdayHoursPerLeave(hr.weekdayHoursPerLeave)
            if (hr.sundayDaysPerLeave !== undefined) setSundayDaysPerLeave(hr.sundayDaysPerLeave)
            if (hr.holidayDaysPerLeave !== undefined) setHolidayDaysPerLeave(hr.holidayDaysPerLeave)
            if (hr.defaultAdvanceAmount !== undefined) setDefaultAdvanceAmount(hr.defaultAdvanceAmount)
        } else {
            setWeekdayMultiplier(parseFloat(localStorage.getItem('hr_overtime_weekday_multiplier')) || 1.5)
            setSundayMultiplier(parseFloat(localStorage.getItem('hr_overtime_sunday_multiplier')) || 1.5)
            setHolidayMultiplier(parseFloat(localStorage.getItem('hr_overtime_holiday_multiplier')) || 2.0)
            setGurbetMultiplier(parseFloat(localStorage.getItem('hr_overtime_gurbet_multiplier')) || 1.0)
            setWeekdayHoursPerLeave(parseFloat(localStorage.getItem('hr_overtime_weekday_hours_per_leave')) || 8)
            setSundayDaysPerLeave(parseFloat(localStorage.getItem('hr_overtime_sunday_days_per_leave')) || 1)
            setHolidayDaysPerLeave(parseFloat(localStorage.getItem('hr_overtime_holiday_days_per_leave')) || 1)
            setDefaultAdvanceAmount(parseFloat(localStorage.getItem('hr_default_advance_amount')) || 0)
        }
    }, [companySettings])

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

    const handleSave = async (e) => {
        e.preventDefault()
        const numVal = parseFloat(editValue)
        if (isNaN(numVal) || numVal < 0) return

        let updatedWeekday = weekdayMultiplier
        let updatedSunday = sundayMultiplier
        let updatedHoliday = holidayMultiplier
        let updatedGurbet = gurbetMultiplier
        let updatedWeekdayLeave = weekdayHoursPerLeave
        let updatedSundayLeave = sundayDaysPerLeave
        let updatedHolidayLeave = holidayDaysPerLeave
        let updatedDefaultAdvance = defaultAdvanceAmount

        if (editingItem.id === 'weekday') { setWeekdayMultiplier(numVal); updatedWeekday = numVal; }
        if (editingItem.id === 'sunday') { setSundayMultiplier(numVal); updatedSunday = numVal; }
        if (editingItem.id === 'holiday') { setHolidayMultiplier(numVal); updatedHoliday = numVal; }
        if (editingItem.id === 'gurbet') { setGurbetMultiplier(numVal); updatedGurbet = numVal; }
        if (editingItem.id === 'weekday_leave') { setWeekdayHoursPerLeave(numVal); updatedWeekdayLeave = numVal; }
        if (editingItem.id === 'sunday_leave') { setSundayDaysPerLeave(numVal); updatedSundayLeave = numVal; }
        if (editingItem.id === 'holiday_leave') { setHolidayDaysPerLeave(numVal); updatedHolidayLeave = numVal; }
        if (editingItem.id === 'default_advance') { setDefaultAdvanceAmount(numVal); updatedDefaultAdvance = numVal; }

        localStorage.setItem(editingItem.storageKey, numVal.toString())

        if (updateCompanySettings) {
            await updateCompanySettings({
                hr: {
                    weekdayMultiplier: updatedWeekday,
                    sundayMultiplier: updatedSunday,
                    holidayMultiplier: updatedHoliday,
                    gurbetMultiplier: updatedGurbet,
                    weekdayHoursPerLeave: updatedWeekdayLeave,
                    sundayDaysPerLeave: updatedSundayLeave,
                    holidayDaysPerLeave: updatedHolidayLeave,
                    defaultAdvanceAmount: updatedDefaultAdvance
                }
            })
        }

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

const CURRENCY_OPTIONS = [
    { value: 'TRY', label: 'Türk Lirası (₺ TRY)' },
    { value: 'USD', label: 'Amerikan Doları ($ USD)' },
    { value: 'EUR', label: 'Euro (€ EUR)' }
]

const VAT_OPTIONS = [
    { value: 20, label: '%20 Standart Oran' },
    { value: 10, label: '%10 İndirimli Oran' },
    { value: 1, label: '%1 Özel Oran' },
    { value: 0, label: '%0 KDV Muaf' }
]

const WORK_STATUS_OPTIONS = [
    { value: 'pending', label: 'Beklemede (Onay / Planlama bekliyor)' },
    { value: 'in_progress', label: 'Devam Ediyor (Hemen operasyonda)' }
]

// Finance Module Settings
function FinanceModuleContent() {
    const { currentCompany, companySettings, updateCompanySettings } = useCompany()
    const [finance, setFinance] = useState({
        defaultCurrency: 'TRY',
        defaultVatRate: 20,
        invoiceDueReminderDays: 7,
        checkDueReminderDays: 15,
        expenseApprovalLimit: 5000
    })
    const [saving, setSaving] = useState(false)
    const [savedMsg, setSavedMsg] = useState(false)

    useEffect(() => {
        if (companySettings?.finance) {
            setFinance(prev => ({ ...prev, ...companySettings.finance }))
        }
    }, [companySettings])

    const handleSave = async (e) => {
        if (e) e.preventDefault()
        setSaving(true)
        try {
            await updateCompanySettings({ finance })
            setSavedMsg(true)
            setTimeout(() => setSavedMsg(false), 2500)
        } catch (err) {
            console.error('Failed to save finance settings:', err)
        }
        setSaving(false)
    }

    const currencySymbol = finance.defaultCurrency === 'USD' ? '$' : finance.defaultCurrency === 'EUR' ? '€' : '₺'

    return (
        <div>
            {/* Stat Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '25px' }}>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">PARA BİRİMİ</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Coins size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{finance.defaultCurrency}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Varsayılan işlem birimi</div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">STANDART KDV</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Percent size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>%{finance.defaultVatRate}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Varsayılan vergi oranı</div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">FATURA VADESİ</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Calendar size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{finance.invoiceDueReminderDays} Gün</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Erken uyarı eşiği</div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">ÇEK / SENET VADESİ</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Clock size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{finance.checkDueReminderDays} Gün</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Tahsilat/ödeme uyarısı</div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">ONAY EŞİK LİMİTİ</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><ShieldCheck size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{currencySymbol}{Number(finance.expenseApprovalLimit || 0).toLocaleString('tr-TR')}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Yönetici onayı eşiği</div>
                    </div>
                </div>
            </div>

            {/* Layout Cards */}
            <div className="settings-layout">
                <div className="settings-column" style={{ flex: '1 1 580px' }}>
                    <div className="settings-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 className="settings-card-title" style={{ margin: 0 }}>
                                <Wallet size={20} className="text-primary" style={{ verticalAlign: 'middle', marginRight: '8px' }} /> 
                                Finans & Fatura Tercihleri
                            </h2>
                            {savedMsg && (
                                <span style={{ color: 'var(--success-color)', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <CheckCircle2 size={16} /> Veritabanına Kaydedildi
                                </span>
                            )}
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="settings-list">
                                <div className="settings-item">
                                    <div className="settings-item-content">
                                        <div className="settings-item-label">Varsayılan Para Birimi</div>
                                        <div className="settings-item-desc">İşlemlerde, kasada ve cari hesap hareketlerinde standart seçilen birim</div>
                                    </div>
                                    <div style={{ width: '230px' }}>
                                        <CustomSelect 
                                            value={finance.defaultCurrency} 
                                            options={CURRENCY_OPTIONS}
                                            onChange={(val) => setFinance({ ...finance, defaultCurrency: val })}
                                            floatingLabel={false}
                                            hidePlaceholderOption
                                            style={{ margin: 0 }}
                                        />
                                    </div>
                                </div>

                                <div className="settings-item">
                                    <div className="settings-item-content">
                                        <div className="settings-item-label">Standart KDV Oranı</div>
                                        <div className="settings-item-desc">Yeni fatura ve harcama kayıtlarında otomatik uygulanan vergi oranı</div>
                                    </div>
                                    <div style={{ width: '230px' }}>
                                        <CustomSelect 
                                            value={finance.defaultVatRate} 
                                            options={VAT_OPTIONS}
                                            onChange={(val) => setFinance({ ...finance, defaultVatRate: Number(val) })}
                                            floatingLabel={false}
                                            hidePlaceholderOption
                                            style={{ margin: 0 }}
                                        />
                                    </div>
                                </div>

                                <div className="settings-item">
                                    <div className="settings-item-content">
                                        <div className="settings-item-label">Fatura Vade Hatırlatma Eşiği</div>
                                        <div className="settings-item-desc">Vadesine bu kadar gün kalan faturalar kontrol paneli ve bildirimlere düşer</div>
                                    </div>
                                    <div style={{ width: '130px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input 
                                            type="number"
                                            min="1"
                                            max="90"
                                            className="form-input text-center"
                                            value={finance.invoiceDueReminderDays}
                                            onChange={(e) => setFinance({ ...finance, invoiceDueReminderDays: Math.max(1, parseInt(e.target.value) || 1) })}
                                            style={{ padding: '8px 10px', fontWeight: '600' }}
                                        />
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gün</span>
                                    </div>
                                </div>

                                <div className="settings-item">
                                    <div className="settings-item-content">
                                        <div className="settings-item-label">Çek / Senet Vade Hatırlatma Eşiği</div>
                                        <div className="settings-item-desc">Ödeme veya tahsilat vadesi yaklaşan çeklerin uyarı verilme süresi</div>
                                    </div>
                                    <div style={{ width: '130px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input 
                                            type="number"
                                            min="1"
                                            max="90"
                                            className="form-input text-center"
                                            value={finance.checkDueReminderDays}
                                            onChange={(e) => setFinance({ ...finance, checkDueReminderDays: Math.max(1, parseInt(e.target.value) || 1) })}
                                            style={{ padding: '8px 10px', fontWeight: '600' }}
                                        />
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gün</span>
                                    </div>
                                </div>

                                <div className="settings-item">
                                    <div className="settings-item-content">
                                        <div className="settings-item-label">Harcama Onay Eşik Limiti</div>
                                        <div className="settings-item-desc">Bu tutarın üzerindeki masraf ve harcamalar yönetici onayı gerektirir</div>
                                    </div>
                                    <div style={{ width: '150px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)' }}>{currencySymbol}</span>
                                        <input 
                                            type="number"
                                            min="0"
                                            step="500"
                                            className="form-input"
                                            value={finance.expenseApprovalLimit}
                                            onChange={(e) => setFinance({ ...finance, expenseApprovalLimit: Math.max(0, parseInt(e.target.value) || 0) })}
                                            style={{ padding: '8px 10px', fontWeight: '600' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                                <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: '170px' }}>
                                    <Save size={16} style={{ marginRight: '6px' }} />
                                    {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="settings-column" style={{ flex: '1 1 320px' }}>
                    <div className="settings-card">
                        <h2 className="settings-card-title">
                            <Info size={18} className="text-primary" style={{ verticalAlign: 'middle', marginRight: '8px' }} /> 
                            Kurumsal Politika
                        </h2>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ margin: 0 }}>
                                Bu sayfada belirlenen kurallar doğrudan <strong>{currentCompany?.name || 'Seçili Şirket'}</strong> kurum profiline bağlıdır.
                            </p>
                            <p style={{ margin: 0 }}>
                                Sistemdeki tüm yetkili muhasebe ve filo sorumluları fatura, çek ve onay limitlerinde aynı kuralları görür.
                            </p>
                            <div style={{ padding: '12px', background: 'rgba(var(--accent-primary-rgb), 0.05)', borderRadius: '8px', border: '1px solid rgba(var(--accent-primary-rgb), 0.15)', marginTop: '8px' }}>
                                <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '4px' }}>💡 İpucu:</strong>
                                Eşik günleri kontrol panelindeki yaklaşan etkinlikler widget'ında anında filtreleme kriteri olarak kullanılır.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Works Module Settings
function WorksModuleContent() {
    const { currentCompany, companySettings, updateCompanySettings } = useCompany()
    const [works, setWorks] = useState({
        defaultStatus: 'pending',
        requireCustomerApproval: false,
        autoArchiveCompletedDays: 30
    })
    const [saving, setSaving] = useState(false)
    const [savedMsg, setSavedMsg] = useState(false)

    useEffect(() => {
        if (companySettings?.works) {
            setWorks(prev => ({ ...prev, ...companySettings.works }))
        }
    }, [companySettings])

    const handleSave = async (e) => {
        if (e) e.preventDefault()
        setSaving(true)
        try {
            await updateCompanySettings({ works })
            setSavedMsg(true)
            setTimeout(() => setSavedMsg(false), 2500)
        } catch (err) {
            console.error('Failed to save works settings:', err)
        }
        setSaving(false)
    }

    return (
        <div>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '25px' }}>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">BAŞLANGIÇ STATÜSÜ</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Briefcase size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '20px' }}>
                            {works.defaultStatus === 'in_progress' ? 'Devam Ediyor' : 'Beklemede'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Yeni iş başlangıç hali</div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">MÜŞTERİ ONAYI</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><CheckCircle2 size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '20px' }}>
                            {works.requireCustomerApproval ? 'Zorunlu' : 'İsteğe Bağlı'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Saha/Operasyon onayı</div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">OTOMATİK ARŞİV</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Clock size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '20px' }}>{works.autoArchiveCompletedDays} Gün</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Tamamlanan iş arşivi</div>
                    </div>
                </div>
            </div>

            <div className="settings-layout">
                <div className="settings-column" style={{ flex: '1 1 580px' }}>
                    <div className="settings-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 className="settings-card-title" style={{ margin: 0 }}>
                                <Briefcase size={20} className="text-primary" style={{ verticalAlign: 'middle', marginRight: '8px' }} /> 
                                İş & Operasyon Tercihleri
                            </h2>
                            {savedMsg && (
                                <span style={{ color: 'var(--success-color)', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <CheckCircle2 size={16} /> Veritabanına Kaydedildi
                                </span>
                            )}
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="settings-list">
                                <div className="settings-item">
                                    <div className="settings-item-content">
                                        <div className="settings-item-label">Yeni İş Varsayılan Başlangıç Durumu</div>
                                        <div className="settings-item-desc">Yeni bir iş veya görev açıldığında atanacak varsayılan durum</div>
                                    </div>
                                    <div style={{ width: '250px' }}>
                                        <CustomSelect 
                                            value={works.defaultStatus} 
                                            options={WORK_STATUS_OPTIONS}
                                            onChange={(val) => setWorks({ ...works, defaultStatus: val })}
                                            floatingLabel={false}
                                            hidePlaceholderOption
                                            style={{ margin: 0 }}
                                        />
                                    </div>
                                </div>

                                <div className="settings-item">
                                    <div className="settings-item-content">
                                        <div className="settings-item-label">Müşteri Onayı Zorunlu</div>
                                        <div className="settings-item-desc">İş tamamlanmadan önce müşterinin teslim onayı gereksinimi</div>
                                    </div>
                                    <label className="toggle-switch">
                                        <input 
                                            type="checkbox" 
                                            checked={works.requireCustomerApproval} 
                                            onChange={(e) => setWorks({ ...works, requireCustomerApproval: e.target.checked })} 
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>

                                <div className="settings-item">
                                    <div className="settings-item-content">
                                        <div className="settings-item-label">Tamamlanan İşleri Otomatik Arşivleme</div>
                                        <div className="settings-item-desc">Tamamlanan işler belirtilen gün sonra ana listeden arşive aktarılır</div>
                                    </div>
                                    <div style={{ width: '130px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input 
                                            type="number" 
                                            min="7" 
                                            max="365" 
                                            className="form-input text-center"
                                            value={works.autoArchiveCompletedDays} 
                                            onChange={(e) => setWorks({ ...works, autoArchiveCompletedDays: Math.max(7, parseInt(e.target.value) || 7) })}
                                            style={{ padding: '8px 10px', fontWeight: '600' }}
                                        />
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gün</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                                <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: '170px' }}>
                                    <Save size={16} style={{ marginRight: '6px' }} />
                                    {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="settings-column" style={{ flex: '1 1 320px' }}>
                    <div className="settings-card">
                        <h2 className="settings-card-title">
                            <Info size={18} className="text-primary" style={{ verticalAlign: 'middle', marginRight: '8px' }} /> 
                            Operasyon Akışı
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '13px' }}>
                            Operasyon ve saha işlerinizin otomatik statü döngülerini şirket politikalarınıza göre yönetebilirsiniz.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Customers Module Settings
function CustomersModuleContent() {
    const { currentCompany, companySettings, updateCompanySettings } = useCompany()
    const [customers, setCustomers] = useState({
        defaultPaymentTermDays: 30,
        creditLimitWarning: true
    })
    const [saving, setSaving] = useState(false)
    const [savedMsg, setSavedMsg] = useState(false)

    useEffect(() => {
        if (companySettings?.customers) {
            setCustomers(prev => ({ ...prev, ...companySettings.customers }))
        }
    }, [companySettings])

    const handleSave = async (e) => {
        if (e) e.preventDefault()
        setSaving(true)
        try {
            await updateCompanySettings({ customers })
            setSavedMsg(true)
            setTimeout(() => setSavedMsg(false), 2500)
        } catch (err) {
            console.error('Failed to save customers settings:', err)
        }
        setSaving(false)
    }

    return (
        <div>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '25px' }}>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">STANDART VADE</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Calendar size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '20px' }}>{customers.defaultPaymentTermDays} Gün</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Yeni cari standart vadesi</div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">RİSK LİMİTİ KONTROLÜ</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><ShieldCheck size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '20px' }}>
                            {customers.creditLimitWarning ? 'Aktif' : 'Pasif'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Bakiye aşım uyarısı</div>
                    </div>
                </div>
            </div>

            <div className="settings-layout">
                <div className="settings-column" style={{ flex: '1 1 580px' }}>
                    <div className="settings-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 className="settings-card-title" style={{ margin: 0 }}>
                                <Users size={20} className="text-primary" style={{ verticalAlign: 'middle', marginRight: '8px' }} /> 
                                Müşteri & Cari Tercihleri
                            </h2>
                            {savedMsg && (
                                <span style={{ color: 'var(--success-color)', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <CheckCircle2 size={16} /> Veritabanına Kaydedildi
                                </span>
                            )}
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="settings-list">
                                <div className="settings-item">
                                    <div className="settings-item-content">
                                        <div className="settings-item-label">Varsayılan Cari Ödeme Vadesi</div>
                                        <div className="settings-item-desc">Yeni müşteri veya cari kaydında otomatik tanımlanan standart vade süresi</div>
                                    </div>
                                    <div style={{ width: '130px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max="180" 
                                            className="form-input text-center"
                                            value={customers.defaultPaymentTermDays} 
                                            onChange={(e) => setCustomers({ ...customers, defaultPaymentTermDays: Math.max(0, parseInt(e.target.value) || 0) })}
                                            style={{ padding: '8px 10px', fontWeight: '600' }}
                                        />
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gün</span>
                                    </div>
                                </div>

                                <div className="settings-item">
                                    <div className="settings-item-content">
                                        <div className="settings-item-label">Risk & Kredi Limiti Aşım Uyarısı</div>
                                        <div className="settings-item-desc">Müşterinin bakiyesi belirlenen risk limitini aştığında işlem anında uyarı ver</div>
                                    </div>
                                    <label className="toggle-switch">
                                        <input 
                                            type="checkbox" 
                                            checked={customers.creditLimitWarning} 
                                            onChange={(e) => setCustomers({ ...customers, creditLimitWarning: e.target.checked })} 
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                                <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: '170px' }}>
                                    <Save size={16} style={{ marginRight: '6px' }} />
                                    {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="settings-column" style={{ flex: '1 1 320px' }}>
                    <div className="settings-card">
                        <h2 className="settings-card-title">
                            <Info size={18} className="text-primary" style={{ verticalAlign: 'middle', marginRight: '8px' }} /> 
                            Cari Risk Yönetimi
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '13px' }}>
                            Cari hesaplarınız için şirket geneli standart vade ve risk kontrollerini buradan belirleyebilirsiniz.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export { HrModuleContent, FleetModuleContent, FinanceModuleContent, WorksModuleContent, CustomersModuleContent, DefaultModuleContent, moduleConfig }


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
            ) : moduleKey === 'finance' ? (
                <FinanceModuleContent />
            ) : moduleKey === 'works' ? (
                <WorksModuleContent />
            ) : moduleKey === 'customers' ? (
                <CustomersModuleContent />
            ) : (
                <DefaultModuleContent config={config} ModuleIcon={ModuleIcon} />
            )}
        </div>
    )
}


