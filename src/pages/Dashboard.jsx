import { useState, useEffect, useRef } from 'react'
import TopProgressBar from '../components/TopProgressBar'
import { useCompany } from '../context/CompanyContext'
import { formatDate, getDaysUntil, getDaysUntilText, getStatusColor, formatCurrency, getVehicleTypeLabel } from '../utils/helpers'
import {
    Car,
    Activity,
    ClipboardCheck,
    Shield,
    AlertTriangle,
    Calendar,
    Building2,
    Wallet,
    TrendingUp,
    PlusCircle,
    Wrench,
    ArrowRight,
    Gauge
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { DashboardSkeleton } from '../components/Skeleton'
import Modal from '../components/Modal'
import { Settings, Save, GripVertical } from 'lucide-react'
import { ScrollableList } from '../components/DashboardComponents'



export default function Dashboard() {
    const { currentCompany, loading: companyLoading, upcomingEvents, loadUpcomingEvents } = useCompany()
    const navigate = useNavigate()

    // PC Listeners
    useEffect(() => {
        const handleAction = (action) => {
            if (action === 'new-vehicle') {
                navigate('/vehicles')
            } else if (action === 'search') {
                // Trigger global search focus if implemented
            }
        }

        const handleNavigate = (route) => {
            navigate(route)
        }

        if (window.electronAPI && window.electronAPI.onTriggerAction) {
            window.electronAPI.onTriggerAction(handleAction)
            window.electronAPI.onNavigate(handleNavigate)
        }

        return () => {
            if (window.electronAPI && window.electronAPI.removePCListeners) {
                window.electronAPI.removePCListeners()
            }
        }
    }, [navigate])

    const [stats, setStats] = useState(null)
    const [recent, setRecent] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (currentCompany) {
            loadDashboardData()
            loadActionPreferences()
            loadUpcomingEvents() // Refresh upcoming events when returning to Dashboard tab
        } else {
            setStats(null)
            setRecent([])
            setLoading(false)
        }
    }, [currentCompany])

    // Auto-refresh: window focus (başka sayfadan dönünce) + 60 saniyelik polling
    useEffect(() => {
        if (!currentCompany) return

        const handleFocus = () => loadDashboardData(true)
        window.addEventListener('focus', handleFocus)

        const interval = setInterval(() => loadDashboardData(true), 60_000)

        return () => {
            window.removeEventListener('focus', handleFocus)
            clearInterval(interval)
        }
    }, [currentCompany])

    // Real-time synchronization listener
    const loadDashboardDataRef = useRef(null)
    const loadUpcomingEventsRef = useRef(null)
    useEffect(() => {
        loadDashboardDataRef.current = loadDashboardData
        loadUpcomingEventsRef.current = loadUpcomingEvents
    })
    useEffect(() => {
        if (!currentCompany) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if ([
                'vehicles', 'maintenances', 'inspections', 'insurances',
                'services', 'assignments', 'employees', 'works',
                'documents', 'transactions'
            ].includes(change?.table)) {
                console.log(`[RealTime] Dashboard reloading for change in ${change.table}`)
                loadDashboardDataRef.current(true)
                if (typeof loadUpcomingEventsRef.current === 'function') {
                    loadUpcomingEventsRef.current()
                }
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])


    // --- Quick Actions Logic ---
    const allActions = [
        { id: 'add-vehicle', label: 'Araç Ekle', path: '/vehicles?action=new', icon: 'Car', default: true },
        { id: 'add-maintenance', label: 'Bakım Ekle', path: '/maintenance?action=new', icon: 'Wrench', default: true },
        { id: 'add-service', label: 'Servis Ekle', path: '/services?action=new', icon: 'Hammer', default: true },
        { id: 'get-report', label: 'Rapor Al', path: '/reports?tab=fleet', icon: 'FileText', default: true },
        { id: 'add-inspection', label: 'Muayene Ekle', path: '/inspections?action=new', icon: 'Clipboard', default: false },
        { id: 'add-insurance', label: 'Sigorta Ekle', path: '/insurance?action=new', icon: 'Shield', default: false },
        { id: 'periodic', label: 'Periyodik Kontrol', path: '/periodic-inspections?action=new', icon: 'Clock', default: false },
    ]

    const actionIconMap = {
        'Car': <PlusCircle size={18} />,
        'Wrench': <PlusCircle size={18} />,
        'Hammer': <PlusCircle size={18} />,
        'FileText': <ClipboardCheck size={18} />,
        'Clipboard': <PlusCircle size={18} />,
        'Shield': <Shield size={18} />,
        'Clock': <Wrench size={18} />
    }

    const [visibleActions, setVisibleActions] = useState(allActions.filter(a => a.default))
    const [showSettings, setShowSettings] = useState(false)
    const [tempActions, setTempActions] = useState([])
    const [draggedItemIndex, setDraggedItemIndex] = useState(null)

    const triggerAction = (action) => {
        if (action.path) {
            navigate(action.path)
        }
    }

    const loadActionPreferences = () => {
        const saved = localStorage.getItem(`dashboard_actions_${currentCompany?.id}`)
        if (saved) {
            try {
                const parsedIds = JSON.parse(saved)
                const restored = parsedIds
                    .map(id => allActions.find(a => a.id === id))
                    .filter(Boolean)

                if (restored.length > 0) {
                    setVisibleActions(restored)
                } else {
                    setVisibleActions(allActions.filter(a => a.default))
                }
            } catch (e) {
                console.error("Failed to parse saved actions", e)
                setVisibleActions(allActions.filter(a => a.default))
            }
        }
    }

    const handleOpenSettings = () => {
        const visibleIds = new Set(visibleActions.map(a => a.id))

        const orderedVisible = visibleActions.map(a => ({ ...a, active: true }))
        const others = allActions.filter(a => !visibleIds.has(a.id)).map(a => ({ ...a, active: false }))

        setTempActions([...orderedVisible, ...others])
    }

    const toggleAction = (id) => {
        setTempActions(prev => prev.map(a =>
            a.id === id ? { ...a, active: !a.active } : a
        ))
    }

    const onDragStart = (e, index) => {
        setDraggedItemIndex(index)
        e.dataTransfer.effectAllowed = "move"
    }

    const onDragOver = (e, index) => {
        e.preventDefault()
        if (draggedItemIndex === null || draggedItemIndex === index) return

        const newItems = [...tempActions]
        const draggedItem = newItems[draggedItemIndex]
        newItems.splice(draggedItemIndex, 1)
        newItems.splice(index, 0, draggedItem)

        setTempActions(newItems)
        setDraggedItemIndex(index)
    }

    const onDragEnd = () => {
        setDraggedItemIndex(null)
    }

    const saveSettings = () => {
        const selected = tempActions.filter(a => a.active)
        setVisibleActions(selected)
        localStorage.setItem(`dashboard_actions_${currentCompany?.id}`, JSON.stringify(selected.map(a => a.id)))
        setShowSettings(false)
    }

    useEffect(() => {
        if (showSettings) {
            handleOpenSettings()
        }
    }, [showSettings])



    const loadDashboardData = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            const [statsResult, recentResult] = await Promise.all([
                window.electronAPI.getDashboardStats(currentCompany.id),
                window.electronAPI.getRecentActivity(currentCompany.id)
            ])

            if (statsResult.success) setStats(statsResult.data)
            if (recentResult.success) setRecent(recentResult.data)
        } catch (error) {
            console.error('Dashboard data error:', error)
        }
        if (!isBackground) setLoading(false)
    }


    if (!currentCompany) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">
                    <Building2 />
                </div>
                <h2 className="empty-state-title">Şirket Seçilmedi</h2>
                <p className="empty-state-desc">
                    Dashboard'ı görüntülemek için lütfen bir şirket seçin veya yeni bir şirket oluşturun.
                </p>
            </div>
        )
    }

    // Data is already processed and sorted by backend
    // Filter out non-fleet events for the Fleet Dashboard (Finance and Personnel)
    const allUpcoming = (upcomingEvents || []).filter(e => 
        e.eventType !== 'finance_check' && 
        e.eventType !== 'employee_document'
    )

    // Helper to get count by keywords
    const getCount = (typeKeywords) => {
        return allUpcoming.filter(e =>
            typeKeywords.some(keyword => e.type?.toLowerCase().includes(keyword.toLowerCase()))
        ).length
    }

    const counts = {
        maintenance: getCount(['Bakım', 'Maintenance']),
        inspection: getCount(['Muayene', 'Inspection', 'Tüvtürk']),
        periodic: getCount(['Periyodik', 'Periodic']),
        insurance: getCount(['Sigorta', 'Insurance', 'Kasko', 'Trafik'])
    }

    // Calculate percentages for cost distribution
    const totalCost = stats?.monthlyCost || 0
    const calculatePct = (val) => totalCost > 0 ? ((val || 0) / totalCost) * 100 : 0

    const costPcts = {
        service: calculatePct(stats?.costDistribution?.service),
        maintenance: calculatePct(stats?.costDistribution?.maintenance),
        inspection: calculatePct(stats?.costDistribution?.inspection),
        insurance: calculatePct(stats?.costDistribution?.insurance),
    }

    return (
        <div style={{ paddingBottom: '40px' }}>
            <TopProgressBar loading={companyLoading || loading} />
            {(companyLoading || loading) && <DashboardSkeleton />}
            {!(companyLoading || loading) && <div>
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Filo Dashboard</h1>
                        <p style={{ marginTop: '5px', color: 'var(--text-muted)' }}>Filo durum özeti ve performans metrikleri.</p>
                    </div>
                </div>

                {/* Quick Actions Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>Hızlı İşlemler</h2>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="btn btn-secondary"
                        style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                    >
                        <Settings size={14} /> Özelleştir
                    </button>
                </div>

                {/* Quick Actions Grid */}
                <div className={`quick-actions grid-responsive-${Math.min(visibleActions.length, 4)}`} style={{ marginBottom: '25px', gap: '16px' }}>
                    {visibleActions.map(action => (
                        <button
                            key={action.id}
                            style={{ justifyContent: 'center', height: '44px', gap: '10px' }}
                            onClick={() => triggerAction(action)}
                            className="btn btn-secondary"
                        >
                            <span style={{ display: 'flex', alignItems: 'center' }}>
                                {actionIconMap[action.icon]}
                            </span>
                            {action.label}
                        </button>
                    ))}
                    {visibleActions.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', background: 'var(--bg-tertiary)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            Görüntülenecek kısayol seçilmedi. Özelleştir butonundan ekleyebilirsiniz.
                        </div>
                    )}
                </div>

                {/* Main Stats Grid */}
                {/* Main Stats Grid */}
                <div className="grid-responsive-2" style={{ marginBottom: '25px', gap: '20px' }}>
                    {/* Total Vehicles */}
                    <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <div className="stat-label">TOPLAM ARAÇ</div>
                            <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Car size={16} /></div>
                        </div>
                        <div>
                            <div className="stat-value">{stats?.totalVehicles || 0}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    <span className="text-success" style={{ fontWeight: '600' }}>{stats?.activeVehicles || 0}</span> Aktif
                                </div>
                            </div>
                        </div>
                        {stats?.typeBreakdown?.length > 0 && (
                            <div style={{ width: '100%', marginTop: '5px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {stats.typeBreakdown.map(t => (
                                    <div key={t.type} style={{ fontSize: '10px', fontWeight: '500', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ color: 'var(--accent-primary)', fontWeight: '700' }}>{t.count}</span>
                                        <span>{getVehicleTypeLabel(t.type)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Monthly Cost */}
                    <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <div className="stat-label">BU AY HARCAMA</div>
                            <div className="stat-icon success" style={{ width: '32px', height: '32px' }}><Wallet size={16} /></div>
                        </div>
                        <div style={{ width: '100%' }}>
                            <div className="stat-value" style={{ fontSize: '22px' }}>{formatCurrency(stats?.monthlyCost || 0)}</div>
                            {/* Cost Distribution Bar */}
                            <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginTop: '10px', background: 'var(--bg-tertiary)', cursor: 'default' }}>
                                <div
                                    style={{ width: `${costPcts.service}%`, background: '#3b82f6' }}
                                    title={`Servis: ${formatCurrency(stats?.costDistribution?.service || 0)} (%${Math.round(costPcts.service)})`}
                                ></div>
                                <div
                                    style={{ width: `${costPcts.maintenance}%`, background: '#f59e0b' }}
                                    title={`Bakım: ${formatCurrency(stats?.costDistribution?.maintenance || 0)} (%${Math.round(costPcts.maintenance)})`}
                                ></div>
                                <div
                                    style={{ width: `${costPcts.inspection}%`, background: '#10b981' }}
                                    title={`Muayene: ${formatCurrency(stats?.costDistribution?.inspection || 0)} (%${Math.round(costPcts.inspection)})`}
                                ></div>
                                <div
                                    style={{ width: `${costPcts.insurance}%`, background: 'rgba(16, 185, 129, 0.4)' }}
                                    title={`Sigorta: ${formatCurrency(stats?.costDistribution?.insurance || 0)} (%${Math.round(costPcts.insurance)})`}
                                ></div>
                            </div>

                            {/* Legend */}
                            {totalCost > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                    {[
                                        { label: 'Servis', color: '#3b82f6', val: stats?.costDistribution?.service },
                                        { label: 'Bakım', color: '#f59e0b', val: stats?.costDistribution?.maintenance },
                                        { label: 'Muayene', color: '#10b981', val: stats?.costDistribution?.inspection },
                                        { label: 'Sigorta', color: 'rgba(16, 185, 129, 0.4)', val: stats?.costDistribution?.insurance }
                                    ].filter(item => item.val > 0).map(item => (
                                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color }}></div>
                                            {item.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Dashboard Content Grid */}
                <div className="grid-responsive-2-1" style={{ gap: '20px' }}>

                    {/* Left Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>



                        {/* Upcoming Alerts */}
                        <div className="card">
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    Yaklaşan & Gecikmiş İşlemler
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                                        <AlertTriangle size={14} />
                                        Gecikmiş: {allUpcoming.filter(e => getDaysUntil(e.date) < 0).length}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                                        <Calendar size={14} />
                                        Yaklaşan (30 Gün): {allUpcoming.filter(e => {
                                            const d = getDaysUntil(e.date)
                                            return d >= 0 && d <= 30
                                        }).length}
                                    </span>
                                </div>
                            </div>

                            <div className="grid-responsive-1-auto-1" style={{ gap: '20px' }}>
                                {/* Overdue Column */}
                                <div>
                                    <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--danger)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <AlertTriangle size={14} />
                                        Geciken İşlemler
                                    </h3>
                                    {allUpcoming.filter(e => getDaysUntil(e.date) < 0).length === 0 ? (
                                        <div style={{ padding: '15px', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', textAlign: 'center' }}>
                                            Geciken işlem yok
                                        </div>
                                    ) : (
                                        <ScrollableList height="200px">
                                            {allUpcoming.filter(e => getDaysUntil(e.date) < 0).map((event, index) => {
                                                const days = getDaysUntil(event.date)
                                                return (
                                                    <div key={`${event.eventType}-${event.id}-${index}`} style={{
                                                        padding: '10px 12px',
                                                        background: 'rgba(239, 68, 68, 0.05)',
                                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                                        borderRadius: '6px',
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                                                {event.eventType === 'employee_document' ? event.employeeName : event.eventType === 'finance_check' ? 'Finansal İşlem' : event.plate}
                                                            </span>
                                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--danger)' }}>
                                                                {Math.abs(days)} gün geçti
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                                {event.eventType === 'employee_document' ? 'Personel Belgesi' : event.eventType === 'finance_check' ? formatCurrency(event.amount) : `${event.brand} ${event.model}`}
                                                            </span>
                                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                                                {event.type}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </ScrollableList>
                                    )}
                                </div>

                                {/* Divider */}
                                <div style={{ width: '1px', background: 'var(--border-color)' }}></div>

                                {/* Upcoming Column */}
                                <div>
                                    <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--warning)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Calendar size={14} />
                                        Yaklaşan İşlemler (30 Gün)
                                    </h3>
                                    {allUpcoming.filter(e => {
                                        const days = getDaysUntil(e.date)
                                        return days >= 0 && days <= 30
                                    }).length === 0 ? (
                                        <div style={{ padding: '15px', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', textAlign: 'center' }}>
                                            Yaklaşan işlem yok
                                        </div>
                                    ) : (
                                        <ScrollableList height="200px">
                                            {allUpcoming.filter(e => {
                                                const days = getDaysUntil(e.date)
                                                return days >= 0 && days <= 30
                                            }).map((event, index) => {
                                                const days = getDaysUntil(event.date)
                                                
                                                let statusColor = '#14b8a6' // 4-30 days teal
                                                let bgStyle = 'rgba(20, 184, 166, 0.05)'
                                                let borderStyle = '1px solid rgba(20, 184, 166, 0.2)'
                                                
                                                if (days === 0) {
                                                    statusColor = '#fb923c' // Bugün - orange
                                                    bgStyle = 'rgba(249, 115, 22, 0.08)'
                                                    borderStyle = '1px solid rgba(249, 115, 22, 0.25)'
                                                } else if (days <= 3) {
                                                    statusColor = '#facc15' // Acil - yellow
                                                    bgStyle = 'rgba(234, 179, 8, 0.08)'
                                                    borderStyle = '1px solid rgba(234, 179, 8, 0.25)'
                                                }

                                                return (
                                                    <div key={`${event.eventType}-${event.id}-${index}`} style={{
                                                        padding: '10px 12px',
                                                        background: bgStyle,
                                                        border: borderStyle,
                                                        borderRadius: '6px',
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                                                {event.eventType === 'employee_document' ? event.employeeName : event.eventType === 'finance_check' ? 'Finansal İşlem' : event.plate}
                                                            </span>
                                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: statusColor }}>
                                                                {days === 0 ? 'Bugün' : `${days} gün kaldı`}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                                {event.eventType === 'employee_document' ? 'Personel Belgesi' : event.eventType === 'finance_check' ? formatCurrency(event.amount) : `${event.brand} ${event.model}`}
                                                            </span>
                                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                                                {event.type}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </ScrollableList>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Fleet Status Distribution */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">Filo Durumu</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--success)' }}></div>
                                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Aktif</span>
                                    </div>
                                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{stats?.statusBreakdown?.active || 0}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--danger)' }}></div>
                                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Pasif/Satıldı</span>
                                    </div>
                                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{stats?.statusBreakdown?.passive || 0}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--warning)' }}></div>
                                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Bakımda</span>
                                    </div>
                                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{stats?.statusBreakdown?.maintenance || 0}</span>
                                </div>
                            </div>
                        </div>



                    </div>
                </div>

                {/* Customization Modal */}
                <Modal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    title="Hızlı İşlemler Ayarları"
                    size="default"
                    footer={
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
                            <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={saveSettings}>
                                <Save size={16} /> Kaydet
                            </button>
                        </div>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', padding: '5px' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            Dashboard'da görmek istediğiniz kısayolları seçin. Sıralamak için sürükleyip bırakabilirsiniz.
                        </p>
                        {tempActions.map((action, index) => (
                            <div
                                key={action.id}
                                draggable
                                onDragStart={(e) => onDragStart(e, index)}
                                onDragOver={(e) => onDragOver(e, index)}
                                onDragEnd={onDragEnd}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 0',
                                    borderBottom: '1px solid var(--border-color)',
                                    cursor: 'grab',
                                    opacity: draggedItemIndex === index ? 0.3 : 1,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        color: 'var(--text-muted)',
                                        cursor: 'grab',
                                        width: '24px',
                                        display: 'flex',
                                        justifyContent: 'center'
                                    }}>
                                        <GripVertical size={16} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {/* Single uniform icon for all list items */}
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '6px',
                                            background: 'var(--bg-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            <Settings size={16} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{action.label}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Switch Toggle - Minimal */}
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation() // Prevent drag trigger
                                        toggleAction(action.id)
                                    }}
                                    style={{
                                        width: '36px',
                                        height: '20px',
                                        background: action.active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                                        borderRadius: '99px',
                                        padding: '2px',
                                        transition: 'background 0.2s ease',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}>
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        background: '#fff',
                                        borderRadius: '50%',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                        transform: action.active ? 'translateX(16px)' : 'translateX(0)',
                                        transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
                                    }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Modal>
            </div>
            }
        </div>
    )
}
