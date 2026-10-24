import React, { useState } from 'react'
import { 
    Briefcase, 
    Users, 
    Truck, 
    Wallet, 
    Building2, 
    BarChart3, 
    Settings,
    Shield,
    CheckCircle2,
    Crown,
    Calculator,
    Wrench,
    FileSearch,
    UserCheck,
    Eye,
    Check,
    Ban,
    ChevronDown,
    ChevronUp,
    SlidersHorizontal,
    Sparkles,
    UtensilsCrossed
} from 'lucide-react'

export const MODULE_DEFINITIONS = [
    { 
        key: 'works', 
        label: 'Puantaj & Saha İşleri', 
        description: 'Saha çalışma fişleri, saatlik & günlük iş kayıtları',
        icon: Briefcase,
        color: '#3b82f6',
        actions: [
            { key: 'works_view_prices', label: 'Fiyat & Tutarları Görme', description: 'Birim fiyat ve toplam hakediş tutarlarını görme' },
            { key: 'works_create', label: 'Yeni İş / Fiş Açma', description: 'Yeni çalışma fişi ve görev oluşturma' },
            { key: 'works_edit', label: 'Mevcut İşi Düzenleme', description: 'Açılmış işlerin detaylarını güncelleme' },
            { key: 'works_delete', label: 'İş Kaydı Silme', description: 'İş fişlerini ve kayıtlarını silme yetkisi' },
            { key: 'works_export', label: 'PDF / Excel Döküm Alma', description: 'Puantaj icmali ve iş fişi yazdırma' }
        ]
    },
    { 
        key: 'employees', 
        label: 'Personel & Bordro', 
        description: 'Personel listesi, izinler, mesailer ve maaş puantajları',
        icon: Users,
        color: '#10b981',
        actions: [
            { key: 'employees_view_salary', label: 'Maaş & Hakediş Tutarlarını Görme', description: 'Maaş, avans ve ödeme tutarlarını inceleme' },
            { key: 'employees_create', label: 'Personel Ekleme & Düzenleme', description: 'Yeni personel kaydetme ve kart güncelleme' },
            { key: 'employees_leaves', label: 'İzin Talepleri & Onay', description: 'İzin oluşturma ve onaylama' },
            { key: 'employees_overtime', label: 'Fazla Mesai Girişi', description: 'Personel mesai saatlerini işleme' },
            { key: 'employees_delete', label: 'Personel Silme / Arşivleme', description: 'Personel kartını sistemden silme yetkisi' }
        ]
    },
    { 
        key: 'vehicles', 
        label: 'Araçlar & Filo Yönetimi', 
        description: 'Vinç/kamyon filosu, periyodik bakım ve muayeneler',
        icon: Truck,
        color: '#f59e0b',
        actions: [
            { key: 'vehicles_maintenance', label: 'Bakım & Arıza Kaydı Girişi', description: 'Periyodik bakım ve arıza kaydı açma' },
            { key: 'vehicles_view_costs', label: 'Bakım / Servis Masraflarını Görme', description: 'Yedek parça ve fatura tutarlarını görme' },
            { key: 'vehicles_documents', label: 'Muayene & Sigorta Evrakları', description: 'Muayene ve sigorta takibi yapıp evrak yükleme' },
            { key: 'vehicles_tracking', label: 'Canlı GPS / Arvento Takibi', description: 'Araç anlık konum ve hız haritasını izleme' },
            { key: 'vehicles_delete', label: 'Araç Silme / Pasife Alma', description: 'Araç kartını filodan çıkarma yetkisi' }
        ]
    },
    { 
        key: 'customers', 
        label: 'Müşteriler & Cari', 
        description: 'Müşteri hesapları, cariler ve irtibatlar',
        icon: Building2,
        color: '#8b5cf6',
        actions: [
            { key: 'customers_view_balance', label: 'Cari Bakiye & Borç-Alacak Görme', description: 'Müşteri bakiye ve ekstresini inceleme' },
            { key: 'customers_create', label: 'Müşteri / Şantiye Tanımlama', description: 'Yeni firma ve irtibat tanımlama' },
            { key: 'customers_export', label: 'Cari Ekstre / Mutabakat İndirme', description: 'Finansal cari döküm alma' },
            { key: 'customers_delete', label: 'Müşteri Silme', description: 'Müşteri kartını sistemden silme yetkisi' }
        ]
    },
    { 
        key: 'finance', 
        label: 'Finans, Kasa & Çek', 
        description: 'Kasa/Banka hareketleri, tahsilatlar ve çekler',
        icon: Wallet,
        color: '#ec4899',
        actions: [
            { key: 'finance_cash', label: 'Kasa & Banka Hareketi İşleme', description: 'Gelir/gider ve transfer hareketi girme' },
            { key: 'finance_checks', label: 'Çek & Senet İşlemleri', description: 'Çek girişi ve tahsilat takibi' },
            { key: 'finance_view_all', label: 'Tüm Kasa & Bankaları Görme', description: 'Ana şirket hesaplarını kısıtlamasız görme' },
            { key: 'finance_delete', label: 'Finansal Hareket Silme', description: 'Kasa ve banka kayıtlarını silme yetkisi' }
        ]
    },
    { 
        key: 'reports', 
        label: 'Raporlar & Dökümler', 
        description: 'PDF raporları, hakediş icmalleri ve analizler',
        icon: BarChart3,
        color: '#06b6d4',
        actions: [
            { key: 'reports_financial', label: 'Finansal Kâr/Zarar Raporları', description: 'Ciro ve kârlılık grafiklerini görme' },
            { key: 'reports_operational', label: 'Saha & Operasyon Raporları', description: 'Makine ve personel çalışma analizleri' },
            { key: 'reports_export', label: 'Rapor Dışa Aktarma (Excel/PDF)', description: 'Rapor dökümlerini bilgisayara indirme' }
        ]
    },
    { 
        key: 'settings', 
        label: 'Şirket Ayarları', 
        description: 'Şirket profili, parametreler ve sistem ayarları',
        icon: Settings,
        color: '#64748b',
        actions: [
            { key: 'settings_company', label: 'Şirket Profili & Parametreler', description: 'Firma bilgileri ve sistem ayarlarını düzenleme' },
            { key: 'settings_users', label: 'Kullanıcı & Yetki Yönetimi', description: 'Şirket kullanıcıları açma ve yetkilendirme' },
            { key: 'settings_audit', label: 'Güvenlik & Denetim (Audit) Logları', description: 'Kim ne zaman ne yaptı loglarını inceleme' }
        ]
    },
    { 
        key: 'meals', 
        label: 'Yemek Fişi Takibi', 
        description: 'Günlük yemek fişleri, kişi sayısı takibi ve yemek raporları',
        icon: UtensilsCrossed,
        color: '#ef4444',
        actions: [
            { key: 'meals_create', label: 'Yeni Fiş Girişi', description: 'Günlük yemek katılım fişi kaydetme' },
            { key: 'meals_edit', label: 'Fiş Düzenleme', description: 'Kayıtlı yemek fişlerini güncelleme' },
            { key: 'meals_delete', label: 'Fiş Silme', description: 'Yemek fişlerini sistemden silme yetkisi' },
            { key: 'meals_settings', label: 'Ücret & Fiyat Ayarları', description: 'Kişi başı günlük yemek ücret tarifesini belirleme' }
        ]
    }
]

export const ROLE_PRESETS = [
    {
        id: 'company_admin',
        label: 'Şirket Yöneticisi',
        icon: Crown,
        color: '#f59e0b',
        subtext: 'Tüm modüllerde tam silme, düzenleme ve yönetim yetkisi',
        levels: {
            works: 'editor',
            works_view_prices: true,
            works_create: true,
            works_edit: true,
            works_delete: true,
            works_export: true,

            employees: 'editor',
            employees_view_salary: true,
            employees_create: true,
            employees_leaves: true,
            employees_overtime: true,
            employees_delete: true,

            vehicles: 'editor',
            vehicles_maintenance: true,
            vehicles_view_costs: true,
            vehicles_documents: true,
            vehicles_tracking: true,
            vehicles_delete: true,

            customers: 'editor',
            customers_view_balance: true,
            customers_create: true,
            customers_export: true,
            customers_delete: true,

            finance: 'editor',
            finance_cash: true,
            finance_checks: true,
            finance_view_all: true,
            finance_delete: true,

            meals: 'editor',
            meals_create: true,
            meals_edit: true,
            meals_delete: true,
            meals_settings: true,

            reports: 'editor',
            reports_financial: true,
            reports_operational: true,
            reports_export: true,

            settings: 'editor',
            settings_company: true,
            settings_users: true,
            settings_audit: true
        }
    },
    {
        id: 'manager',
        label: 'Operasyon & Puantör',
        icon: Briefcase,
        color: '#0ea5e9',
        subtext: 'Saha işleri ve araç operasyonu (Fiyat, Kasa ve Ayarlar kapalı)',
        levels: {
            works: 'editor',
            works_view_prices: false,
            works_create: true,
            works_edit: true,
            works_delete: false,
            works_export: true,

            employees: 'viewer',
            employees_view_salary: false,
            employees_create: false,
            employees_leaves: true,
            employees_overtime: true,
            employees_delete: false,

            vehicles: 'editor',
            vehicles_maintenance: true,
            vehicles_view_costs: false,
            vehicles_documents: true,
            vehicles_tracking: true,
            vehicles_delete: false,

            customers: 'viewer',
            customers_view_balance: false,
            customers_create: true,
            customers_export: false,
            customers_delete: false,

            finance: 'none',
            finance_cash: false,
            finance_checks: false,
            finance_view_all: false,
            finance_delete: false,

            meals: 'editor',
            meals_create: true,
            meals_edit: true,
            meals_delete: false,
            meals_settings: false,

            reports: 'viewer',
            reports_financial: false,
            reports_operational: true,
            reports_export: true,

            settings: 'none',
            settings_company: false,
            settings_users: false,
            settings_audit: false
        }
    },
    {
        id: 'accountant',
        label: 'Ön Muhasebe & Finans',
        icon: Calculator,
        color: '#10b981',
        subtext: 'Kasa, cari, çek, tahsilat, fatura ve personel bordroları',
        levels: {
            works: 'viewer',
            works_view_prices: true,
            works_create: false,
            works_edit: false,
            works_delete: false,
            works_export: true,

            employees: 'editor',
            employees_view_salary: true,
            employees_create: true,
            employees_leaves: true,
            employees_overtime: true,
            employees_delete: false,

            vehicles: 'viewer',
            vehicles_maintenance: false,
            vehicles_view_costs: true,
            vehicles_documents: true,
            vehicles_tracking: false,
            vehicles_delete: false,

            customers: 'editor',
            customers_view_balance: true,
            customers_create: true,
            customers_export: true,
            customers_delete: false,

            finance: 'editor',
            finance_cash: true,
            finance_checks: true,
            finance_view_all: true,
            finance_delete: false,

            meals: 'editor',
            meals_create: true,
            meals_edit: true,
            meals_delete: false,
            meals_settings: true,

            reports: 'editor',
            reports_financial: true,
            reports_operational: true,
            reports_export: true,

            settings: 'none',
            settings_company: false,
            settings_users: false,
            settings_audit: false
        }
    },
    {
        id: 'maintenance',
        label: 'Kademe & Bakım Şefi',
        icon: Wrench,
        color: '#f97316',
        subtext: 'Araç bakımı, muayene, sigorta ve arıza yönetimi',
        levels: {
            works: 'none',
            works_view_prices: false,
            works_create: false,
            works_edit: false,
            works_delete: false,
            works_export: false,

            employees: 'none',
            employees_view_salary: false,
            employees_create: false,
            employees_leaves: false,
            employees_overtime: false,
            employees_delete: false,

            vehicles: 'editor',
            vehicles_maintenance: true,
            vehicles_view_costs: true,
            vehicles_documents: true,
            vehicles_tracking: true,
            vehicles_delete: false,

            customers: 'none',
            customers_view_balance: false,
            customers_create: false,
            customers_export: false,
            customers_delete: false,

            finance: 'none',
            finance_cash: false,
            finance_checks: false,
            finance_view_all: false,
            finance_delete: false,

            meals: 'none',
            meals_create: false,
            meals_edit: false,
            meals_delete: false,
            meals_settings: false,

            reports: 'viewer',
            reports_financial: false,
            reports_operational: true,
            reports_export: true,

            settings: 'none',
            settings_company: false,
            settings_users: false,
            settings_audit: false
        }
    },
    {
        id: 'auditor',
        label: 'Mali Müşavir / Denetçi',
        icon: FileSearch,
        color: '#a855f7',
        subtext: 'Tüm modülleri sadece inceler (Silme/Değiştirme kapalı)',
        levels: {
            works: 'viewer',
            works_view_prices: true,
            works_create: false,
            works_edit: false,
            works_delete: false,
            works_export: true,

            employees: 'viewer',
            employees_view_salary: true,
            employees_create: false,
            employees_leaves: false,
            employees_overtime: false,
            employees_delete: false,

            vehicles: 'viewer',
            vehicles_maintenance: false,
            vehicles_view_costs: true,
            vehicles_documents: true,
            vehicles_tracking: false,
            vehicles_delete: false,

            customers: 'viewer',
            customers_view_balance: true,
            customers_create: false,
            customers_export: true,
            customers_delete: false,

            finance: 'viewer',
            finance_cash: false,
            finance_checks: false,
            finance_view_all: true,
            finance_delete: false,

            meals: 'viewer',
            meals_create: false,
            meals_edit: false,
            meals_delete: false,
            meals_settings: false,

            reports: 'viewer',
            reports_financial: true,
            reports_operational: true,
            reports_export: true,

            settings: 'none',
            settings_company: false,
            settings_users: false,
            settings_audit: false
        }
    },
    {
        id: 'personnel',
        label: 'Saha Personeli / Şoför',
        icon: UserCheck,
        color: '#06b6d4',
        subtext: 'Sadece kendine atanan işleri ve izinlerini görür',
        levels: {
            works: 'none',
            works_view_prices: false,
            works_create: false,
            works_edit: false,
            works_delete: false,
            works_export: false,

            employees: 'none',
            employees_view_salary: false,
            employees_create: false,
            employees_leaves: false,
            employees_overtime: false,
            employees_delete: false,

            vehicles: 'none',
            vehicles_maintenance: false,
            vehicles_view_costs: false,
            vehicles_documents: false,
            vehicles_tracking: false,
            vehicles_delete: false,

            customers: 'none',
            customers_view_balance: false,
            customers_create: false,
            customers_export: false,
            customers_delete: false,

            finance: 'none',
            finance_cash: false,
            finance_checks: false,
            finance_view_all: false,
            finance_delete: false,

            meals: 'none',
            meals_create: false,
            meals_edit: false,
            meals_delete: false,
            meals_settings: false,

            reports: 'none',
            reports_financial: false,
            reports_operational: false,
            reports_export: false,

            settings: 'none',
            settings_company: false,
            settings_users: false,
            settings_audit: false
        }
    }
]

export default function PermissionMatrix({
    selectedPreset,
    onPresetChange,
    permissionLevels = {},
    onLevelChange,
    readOnly = false
}) {
    const [expandedModules, setExpandedModules] = useState({})

    const toggleExpand = (modKey) => {
        setExpandedModules(prev => ({
            ...prev,
            [modKey]: !prev[modKey]
        }))
    }

    // Handles changing the top-level segmented status (none, viewer, editor)
    const handleModuleStatusChange = (mod, level) => {
        if (readOnly || !onLevelChange) return

        // Compute new action defaults for this module
        const updatedPermissions = {
            [mod.key]: level
        }

        if (mod.actions) {
            mod.actions.forEach(act => {
                if (level === 'none') {
                    updatedPermissions[act.key] = false
                } else if (level === 'viewer') {
                    // Turn on view and export actions by default, turn off edit/delete
                    const isViewOrExport = act.key.includes('view') || act.key.includes('export') || act.key.includes('tracking') || act.key.includes('audit')
                    updatedPermissions[act.key] = isViewOrExport
                } else if (level === 'editor') {
                    // Turn on create, edit, view actions by default (keep delete as true for editor)
                    updatedPermissions[act.key] = true
                }
            })
        }

        // Call onLevelChange for each key or batch
        Object.entries(updatedPermissions).forEach(([k, v]) => {
            onLevelChange(k, v)
        })
    }
    return (
        <div className="permission-matrix-split-container">
            {/* Left Column: Role Preset Cards */}
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '6px 8px 8px 8px',
                    borderBottom: '1px solid var(--border-color)',
                    marginBottom: '4px'
                }}>
                    Rol Şablonu
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {ROLE_PRESETS.map((preset) => {
                        const isSelected = selectedPreset === preset.id
                        const PresetIcon = preset.icon || Shield
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => onPresetChange && onPresetChange(preset.id, preset.levels)}
                                disabled={readOnly}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 10px',
                                    borderRadius: '7px',
                                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                    background: isSelected ? 'var(--bg-card)' : 'transparent',
                                    cursor: readOnly ? 'default' : 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    width: '100%',
                                    boxShadow: isSelected ? '0 1px 4px rgba(0,0,0,0.12)' : 'none'
                                }}
                            >
                                <div style={{
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isSelected ? `${preset.color}20` : 'var(--bg-tertiary)',
                                    color: isSelected ? preset.color : 'var(--text-muted)',
                                    flexShrink: 0,
                                    transition: 'all 0.15s ease'
                                }}>
                                    <PresetIcon size={15} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '13px',
                                        fontWeight: isSelected ? 700 : 500,
                                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {preset.label}
                                    </div>
                                    <div style={{
                                        fontSize: '11px',
                                        color: 'var(--text-muted)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {preset.subtext}
                                    </div>
                                </div>
                                {/* Clean Radio Dot */}
                                <div style={{
                                    width: '15px',
                                    height: '15px',
                                    borderRadius: '50%',
                                    border: isSelected ? '1.5px solid var(--accent-primary)' : '1.5px solid var(--border-color)',
                                    background: isSelected ? 'var(--accent-primary)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    transition: 'all 0.15s ease'
                                }}>
                                    {isSelected && (
                                        <div style={{
                                            width: '5px',
                                            height: '5px',
                                            borderRadius: '50%',
                                            background: '#ffffff'
                                        }} />
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Right Column: Permission Matrix Table with Accordion Detail Granular Controls */}
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{
                            borderBottom: '1px solid var(--border-color)',
                            background: 'var(--bg-card)'
                        }}>
                            <th style={{
                                padding: '10px 16px',
                                textAlign: 'left',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Modül
                            </th>
                            <th style={{
                                padding: '10px 16px',
                                textAlign: 'right',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                width: '220px'
                            }}>
                                Erişim Seviyesi
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {MODULE_DEFINITIONS.map((mod, idx) => {
                            const Icon = mod.icon
                            const currentLevel = permissionLevels[mod.key] || 'none'
                            const isExpanded = !!expandedModules[mod.key]
                            
                            // Count active granular sub-actions
                            const totalActions = mod.actions?.length || 0
                            const activeActions = mod.actions?.filter(act => !!permissionLevels[act.key]).length || 0

                            return (
                                <React.Fragment key={mod.key}>
                                    <tr 
                                        style={{ 
                                            borderTop: idx !== 0 ? '1px solid var(--border-color)' : 'none',
                                            background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                                            transition: 'background 0.15s ease'
                                        }}
                                    >
                                        {/* Module Info */}
                                        <td style={{ padding: '8px 16px', verticalAlign: 'middle' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: `${mod.color}15`,
                                                    color: mod.color,
                                                    flexShrink: 0
                                                }}>
                                                    <Icon size={14} />
                                                </div>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                                                            {mod.label}
                                                        </span>
                                                        {/* Granular Sub-Action Expander Button */}
                                                        {totalActions > 0 && currentLevel !== 'none' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleExpand(mod.key)}
                                                                style={{
                                                                    border: 'none',
                                                                    background: isExpanded ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-tertiary)',
                                                                    color: isExpanded ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 500,
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                            >
                                                                <span>{activeActions}/{totalActions} detay yetki</span>
                                                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                                                        {mod.description}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Tactile Segmented Pill Switcher with Subtle Semantic Tones */}
                                        <td style={{ padding: '8px 16px', textAlign: 'right', verticalAlign: 'middle', width: '220px' }}>
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                background: 'var(--bg-tertiary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '7px',
                                                padding: '2px',
                                                gap: '2px',
                                                height: '32px'
                                            }}>
                                                {/* None (Yok) */}
                                                <button
                                                    type="button"
                                                    disabled={readOnly}
                                                    onClick={() => handleModuleStatusChange(mod, 'none')}
                                                    style={{
                                                        border: currentLevel === 'none' ? '1px solid var(--border-color)' : '1px solid transparent',
                                                        borderRadius: '5px',
                                                        padding: '0 11px',
                                                        height: '100%',
                                                        fontSize: '12px',
                                                        fontWeight: currentLevel === 'none' ? 600 : 400,
                                                        background: currentLevel === 'none' ? 'var(--bg-card)' : 'transparent',
                                                        color: currentLevel === 'none' ? 'var(--text-primary)' : 'var(--text-muted)',
                                                        boxShadow: currentLevel === 'none' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                        cursor: readOnly ? 'default' : 'pointer',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    Yok
                                                </button>

                                                {/* Viewer (Oku) - Soft Sky/Blue */}
                                                <button
                                                    type="button"
                                                    disabled={readOnly}
                                                    onClick={() => handleModuleStatusChange(mod, 'viewer')}
                                                    style={{
                                                        border: currentLevel === 'viewer' ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid transparent',
                                                        borderRadius: '5px',
                                                        padding: '0 11px',
                                                        height: '100%',
                                                        fontSize: '12px',
                                                        fontWeight: currentLevel === 'viewer' ? 600 : 400,
                                                        background: currentLevel === 'viewer' ? 'rgba(14, 165, 233, 0.18)' : 'transparent',
                                                        color: currentLevel === 'viewer' ? '#38bdf8' : 'var(--text-muted)',
                                                        boxShadow: currentLevel === 'viewer' ? '0 1px 3px rgba(14,165,233,0.15)' : 'none',
                                                        cursor: readOnly ? 'default' : 'pointer',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    Oku
                                                </button>

                                                {/* Editor (Düzenle) - Soft Emerald */}
                                                <button
                                                    type="button"
                                                    disabled={readOnly}
                                                    onClick={() => handleModuleStatusChange(mod, 'editor')}
                                                    style={{
                                                        border: currentLevel === 'editor' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid transparent',
                                                        borderRadius: '5px',
                                                        padding: '0 11px',
                                                        height: '100%',
                                                        fontSize: '12px',
                                                        fontWeight: currentLevel === 'editor' ? 600 : 400,
                                                        background: currentLevel === 'editor' ? 'rgba(34, 197, 94, 0.18)' : 'transparent',
                                                        color: currentLevel === 'editor' ? '#4ade80' : 'var(--text-muted)',
                                                        boxShadow: currentLevel === 'editor' ? '0 1px 3px rgba(34,197,94,0.15)' : 'none',
                                                        cursor: readOnly ? 'default' : 'pointer',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    Düzenle
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Granular Sub-Action Accordion Drawer */}
                                    {isExpanded && currentLevel !== 'none' && totalActions > 0 && (
                                        <tr>
                                            <td colSpan={2} style={{ padding: '4px 16px 14px 16px', background: 'rgba(0, 0, 0, 0.08)' }}>
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                                                    gap: '8px',
                                                    padding: '10px 12px',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border-color)'
                                                }}>
                                                    {mod.actions.map(act => {
                                                        const isActionActive = !!permissionLevels[act.key]
                                                        return (
                                                            <button
                                                                key={act.key}
                                                                type="button"
                                                                disabled={readOnly}
                                                                onClick={() => onLevelChange && onLevelChange(act.key, !isActionActive)}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'flex-start',
                                                                    gap: '8px',
                                                                    padding: '7px 9px',
                                                                    borderRadius: '6px',
                                                                    border: isActionActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                                                    background: isActionActive ? 'var(--bg-card)' : 'transparent',
                                                                    cursor: readOnly ? 'default' : 'pointer',
                                                                    textAlign: 'left',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                            >
                                                                {/* Checkbox box */}
                                                                <div style={{
                                                                    width: '16px',
                                                                    height: '16px',
                                                                    borderRadius: '4px',
                                                                    border: isActionActive ? '1px solid var(--accent-primary)' : '1.5px solid var(--border-color)',
                                                                    background: isActionActive ? 'var(--accent-primary)' : 'transparent',
                                                                    color: '#ffffff',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    flexShrink: 0,
                                                                    marginTop: '1px'
                                                                }}>
                                                                    {isActionActive && <Check size={11} strokeWidth={3} />}
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{
                                                                        fontSize: '12px',
                                                                        fontWeight: isActionActive ? 600 : 500,
                                                                        color: isActionActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                                                                    }}>
                                                                        {act.label}
                                                                    </div>
                                                                    <div style={{
                                                                        fontSize: '10.5px',
                                                                        color: 'var(--text-muted)',
                                                                        lineHeight: 1.25,
                                                                        marginTop: '1px'
                                                                    }}>
                                                                        {act.description}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
