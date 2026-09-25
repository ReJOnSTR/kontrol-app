import { useState, useEffect, useMemo, useRef } from 'react'
import TopProgressBar from '../components/TopProgressBar'
import { useCompany } from '../context/CompanyContext'
import { formatCurrency, formatDate, getDaysUntil } from '../utils/helpers'
import { ScrollableList } from '../components/DashboardComponents'
import {
    Users,
    Briefcase,
    Calendar,
    Wallet,
    UserCheck,
    Clock,
    UserMinus,
    TrendingUp,
    PlusCircle,
    FileText,
    PieChart as PieIcon,
    Cake,
    ArrowRight,
    Search,
    Settings,
    Save,
    GripVertical,
    Banknote,
    AlertTriangle
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts'
import Modal from '../components/Modal'

export default function PersonelDashboard() {
    const { currentCompany } = useCompany()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [employees, setEmployees] = useState([])
    const [upcomingDocs, setUpcomingDocs] = useState([])

    useEffect(() => {
        if (currentCompany) {
            loadData()
        }
    }, [currentCompany])

    // Real-time synchronization listener
    const loadDataRef = useRef(null)
    useEffect(() => {
        loadDataRef.current = loadData
    })
    useEffect(() => {
        if (!currentCompany) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if (['employees', 'leaves', 'overtimes', 'employee_documents'].includes(change?.table)) {
                console.log(`[RealTime] PersonelDashboard reloading for change in ${change.table}`)
                loadDataRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const loadData = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            const [empRes, passiveEmpRes, docRes] = await Promise.all([
                window.electronAPI.getEmployees(currentCompany.id, 0),
                window.electronAPI.getEmployees(currentCompany.id, 1),
                window.electronAPI.getUpcomingPersonnelDocuments(currentCompany.id)
            ])

            let allEmps = []
            if (empRes.success) allEmps = [...allEmps, ...(empRes.data || [])]
            if (passiveEmpRes.success) allEmps = [...allEmps, ...(passiveEmpRes.data || [])]

            setEmployees(allEmps)
            if (docRes.success) {
                const activeDocs = (docRes.data || []).filter(d => {
                    if (!d.employees) return false
                    if (d.employees.is_archived === 1 || (d.employees.status && d.employees.status !== 'active')) return false
                    return true
                })
                setUpcomingDocs(activeDocs)
            }
        } catch (error) {
            console.error(error)
        } finally {
            if (!isBackground) setLoading(false)
        }
    }

    // --- Computed Stats ---
    const stats = useMemo(() => {
        const active = employees.filter(e => e.status === 'active' && e.is_archived !== 1)
        const totalSalary = active.reduce((sum, e) => sum + (parseFloat(e.salary) || 0), 0)

        // Upcoming Birthdays (Next 30 days)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const birthdays = employees
            .filter(e => e.birth_date && e.status === 'active' && e.is_archived !== 1)
            .map(e => {
                const bDate = new Date(e.birth_date)
                const nextBday = new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate())
                if (nextBday < today) {
                    nextBday.setFullYear(today.getFullYear() + 1)
                }
                const diffTime = nextBday - today
                const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                return { ...e, daysUntil }
            })
            .filter(e => e.daysUntil <= 30)
            .sort((a, b) => a.daysUntil - b.daysUntil)

        // Department breakdown
        const deptMap = {}
        active.forEach(e => {
            const d = e.department || 'Diğer'
            deptMap[d] = (deptMap[d] || 0) + 1
        })
        const deptStats = Object.entries(deptMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)

        // Hiring trend (last 6 months)
        const hiringTrend = []
        for (let i = 5; i >= 0; i--) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const monthLabel = d.toLocaleString('tr-TR', { month: '2-digit' })
            const monthVal = d.getMonth() + 1
            const yearVal = d.getFullYear()

            const count = employees.filter(e => {
                if (!e.start_date) return false
                const sd = new Date(e.start_date)
                return sd.getMonth() + 1 === monthVal && sd.getFullYear() === yearVal
            }).length

            hiringTrend.push({ name: monthLabel, count })
        }

        // Seniority Distribution
        const seniorityMap = { '< 1 Yıl': 0, '1-3 Yıl': 0, '3-5 Yıl': 0, '5+ Yıl': 0 }
        active.forEach(e => {
            if (!e.start_date) {
                seniorityMap['< 1 Yıl']++
                return
            }
            const years = (today - new Date(e.start_date)) / (1000 * 60 * 60 * 24 * 365.25)
            if (years < 1) seniorityMap['< 1 Yıl']++
            else if (years < 3) seniorityMap['1-3 Yıl']++
            else if (years < 5) seniorityMap['3-5 Yıl']++
            else seniorityMap['5+ Yıl']++
        })
        const seniorityStats = Object.entries(seniorityMap).map(([name, count]) => ({ name, count }))

        return {
            total: employees.length,
            active: active.length,
            passive: employees.length - active.length,
            totalSalary,
            avgSalary: active.length > 0 ? totalSalary / active.length : 0,
            deptStats,
            birthdays,
            hiringTrend,
            seniorityStats
        }
    }, [employees])

    const allActions = useMemo(() => [
        { id: 'add-employee', label: 'Yeni Personel', icon: 'PlusCircle', path: '/employees?action=new', default: true },
        { id: 'employee-list', label: 'Personel Listesi', icon: 'Users', path: '/employees', default: true },
        { id: 'add-leave', label: 'Yeni İzin Talebi', icon: 'Calendar', path: '/leaves?action=new', default: true },
        { id: 'add-overtime', label: 'Yeni Mesai Ekle', icon: 'Clock', path: '/overtimes?action=new', default: true },
        { id: 'payroll', label: 'Maaş & Ödemeler', icon: 'Wallet', path: '/payroll', default: true },
        { id: 'search-employee', label: 'Personel Ara', icon: 'Search', path: '/employees', default: false },
        { id: 'reports', label: 'İK Raporları', icon: 'FileText', path: '/reports?tab=hr', default: false },
        { id: 'add-payment', label: 'Yeni Ödeme', icon: 'Banknote', path: '/payroll?action=new', default: false },
    ], [])

    const actionIconMap = {
        'PlusCircle': <PlusCircle size={18} color="var(--accent-primary)" />,
        'Users': <Users size={18} />,
        'Wallet': <Wallet size={18} />,
        'Search': <Search size={18} />,
        'FileText': <FileText size={18} />,
        'Banknote': <Banknote size={18} />,
        'Calendar': <Calendar size={18} />,
        'Clock': <Clock size={18} />
    }

    const [visibleActions, setVisibleActions] = useState(allActions.filter(a => a.default))
    const [showSettings, setShowSettings] = useState(false)
    const [tempActions, setTempActions] = useState([])
    const [draggedItemIndex, setDraggedItemIndex] = useState(null)

    // Load preferences
    useEffect(() => {
        if (currentCompany) {
            const saved = localStorage.getItem(`hr_dashboard_actions_${currentCompany.id}`)
            if (saved) {
                try {
                    const parsedIds = JSON.parse(saved)
                    const restored = parsedIds
                        .map(id => allActions.find(a => a.id === id))
                        .filter(Boolean)
                    if (restored.length > 0) setVisibleActions(restored)
                } catch (e) { console.error(e) }
            }
        }
    }, [currentCompany, allActions])

    const handleOpenSettings = () => {
        const visibleIds = new Set(visibleActions.map(a => a.id))
        const orderedVisible = visibleActions.map(a => ({ ...a, active: true }))
        const others = allActions.filter(a => !visibleIds.has(a.id)).map(a => ({ ...a, active: false }))
        setTempActions([...orderedVisible, ...others])
        setShowSettings(true)
    }

    const toggleAction = (id) => {
        setTempActions(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a))
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

    const saveSettings = () => {
        const selected = tempActions.filter(a => a.active)
        setVisibleActions(selected)
        localStorage.setItem(`hr_dashboard_actions_${currentCompany.id}`, JSON.stringify(selected.map(a => a.id)))
        setShowSettings(false)
    }

    const triggerAction = (action) => {
        if (action.path) {
            navigate(action.path)
        }
    }

    // Helper Component for Stats
    const StatCard = ({ label, value, subValue, icon: Icon, type }) => (
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                <div className={`stat-icon ${type}`} style={{ width: '36px', height: '36px', borderRadius: '10px' }}><Icon size={18} /></div>
            </div>
            <div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{value}</div>
                {subValue && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{subValue}</div>}
            </div>
        </div>
    )

    return (
        <div className="page-container fade-in" style={{ paddingBottom: '40px' }}>
            <TopProgressBar loading={loading} />

            <div className="page-header" style={{ marginBottom: '25px' }}>
                <div>
                    <h1 className="page-title">Personel Paneli</h1>
                    <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>İnsan kaynakları genel bakış ve yönetimi.</p>
                </div>
            </div>

            {/* Quick Actions Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>Hızlı İşlemler</h2>
                <button
                    onClick={handleOpenSettings}
                    className="btn btn-secondary"
                    style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                >
                    <Settings size={14} /> Özelleştir
                </button>
            </div>

            {/* Quick Actions Grid */}
            <div className={`quick-actions grid-responsive-${Math.min(visibleActions.length, 4)}`} style={{ marginBottom: '30px', gap: '16px' }}>
                {visibleActions.map(action => (
                    <button
                        key={action.id}
                        className="btn btn-secondary"
                        onClick={() => triggerAction(action)}
                        style={{ justifyContent: 'center', height: '44px', gap: '10px' }}
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

            {/* Stats Grid */}
            <div className="grid-responsive-3" style={{ marginBottom: '30px' }}>
                <StatCard
                    label="Toplam Personel"
                    value={stats.total}
                    subValue={`${stats.active} Aktif / ${stats.passive} Pasif`}
                    icon={Users}
                    type="primary"
                />
                <StatCard
                    label="Maaş Hakediş Yükü"
                    value={formatCurrency(stats.totalSalary)}
                    subValue="Bu ayki tahmini yük"
                    icon={Wallet}
                    type="success"
                />
                <StatCard
                    label="Ortalama Maaş"
                    value={formatCurrency(stats.avgSalary)}
                    subValue="Aktif personel ortalaması"
                    icon={TrendingUp}
                    type="info"
                />
            </div>

            {/* Middle Row: Documents & Birthdays */}
            <div className="grid-responsive-2-1" style={{ marginBottom: '25px' }}>
                {/* Upcoming Personnel Documents */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            Personele Ait Yaklaşan & Gecikmiş Belgeler
                        </h3>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                                <AlertTriangle size={14} />
                                Gecikmiş: {upcomingDocs.filter(e => getDaysUntil(e.expiry_date) < 0).length}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                                <Calendar size={14} />
                                Yaklaşan (30 Gün): {upcomingDocs.filter(e => {
                                    const d = getDaysUntil(e.expiry_date)
                                    return d >= 0 && d <= 30
                                }).length}
                            </span>
                        </div>
                    </div>

                    <div className="grid-responsive-1-auto-1" style={{ padding: '20px' }}>
                        {/* Overdue Column */}
                        <div>
                            <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--danger)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={14} /> Gecikenler
                            </h3>
                            <ScrollableList height="210px">
                                {upcomingDocs.filter(e => getDaysUntil(e.expiry_date) < 0).length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Geciken belge yok.</div>
                                ) : (
                                    upcomingDocs.filter(e => getDaysUntil(e.expiry_date) < 0).map((doc) => {
                                        const days = getDaysUntil(doc.expiry_date)
                                        return (
                                            <div
                                                key={doc.id}
                                                onClick={() => navigate(`/employees?tab=documents&id=${doc.employees?.id}`)}
                                                style={{
                                                    padding: '12px',
                                                    background: 'rgba(239, 68, 68, 0.03)',
                                                    border: '1px solid rgba(239, 68, 68, 0.15)',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    marginBottom: '8px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '700' }}>{doc.employees?.first_name} {doc.employees?.last_name}</span>
                                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--danger)' }}>{Math.abs(days)} gün geçti</span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{doc.category || 'Belge'} • {doc.file_name}</div>
                                            </div>
                                        )
                                    })
                                )}
                            </ScrollableList>
                        </div>

                        {/* Divider */}
                        <div style={{ width: '1px', background: 'var(--border-color)' }}></div>

                        {/* Upcoming Column */}
                        <div>
                            <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--warning)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={14} /> Yaklaşanlar (30 Gün)
                            </h3>
                            <ScrollableList height="210px">
                                {upcomingDocs.filter(e => {
                                    const days = getDaysUntil(e.expiry_date)
                                    return days >= 0 && days <= 30
                                }).length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Yaklaşan belge yok.</div>
                                ) : (
                                    upcomingDocs.filter(e => {
                                        const days = getDaysUntil(e.expiry_date)
                                        return days >= 0 && days <= 30
                                    }).map((doc) => {
                                        const days = getDaysUntil(doc.expiry_date)
                                        let statusColor = '#14b8a6' // 4-30 days teal
                                        let bgStyle = 'rgba(20, 184, 166, 0.04)'
                                        let borderStyle = '1px solid rgba(20, 184, 166, 0.2)'

                                        if (days === 0) {
                                            statusColor = '#fb923c' // Bugün - orange
                                            bgStyle = 'rgba(249, 115, 22, 0.05)'
                                            borderStyle = '1px solid rgba(249, 115, 22, 0.2)'
                                        } else if (days <= 3) {
                                            statusColor = '#facc15' // Acil - yellow
                                            bgStyle = 'rgba(234, 179, 8, 0.05)'
                                            borderStyle = '1px solid rgba(234, 179, 8, 0.2)'
                                        }

                                        return (
                                            <div
                                                key={doc.id}
                                                onClick={() => navigate(`/employees?tab=documents&id=${doc.employees?.id}`)}
                                                style={{
                                                    padding: '12px',
                                                    background: bgStyle,
                                                    border: borderStyle,
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    marginBottom: '8px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '700' }}>{doc.employees?.first_name} {doc.employees?.last_name}</span>
                                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: statusColor }}>{days === 0 ? 'Bugün' : `${days} gün kaldı`}</span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{doc.category || 'Belge'} • {doc.file_name}</div>
                                            </div>
                                        )
                                    })
                                )}
                            </ScrollableList>
                        </div>
                    </div>
                </div>

                {/* Upcoming Birthdays */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Cake size={18} color="var(--accent-primary)" /> Yaklaşan Doğum Günleri
                        </h3>
                        {stats.birthdays.length > 0 && (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--accent-primary)',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '600'
                            }}>
                                <Users size={14} />
                                Toplam: {stats.birthdays.length}
                            </span>
                        )}
                    </div>
                    <div style={{ padding: '20px' }}>
                        {stats.birthdays.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                                Yakın zamanda doğum günü yok.
                            </div>
                        ) : (
                            <ScrollableList height="210px">
                                {stats.birthdays.map((e, i) => {
                                    const isToday = e.daysUntil === 0
                                    const isTomorrow = e.daysUntil === 1

                                    let statusColor = 'var(--text-muted)'
                                    let bgStyle = 'var(--bg-secondary)'
                                    let borderStyle = '1px solid var(--border-color)'

                                    if (isToday) {
                                        statusColor = '#ef4444' // Celebrating/Urgent
                                        bgStyle = 'rgba(239, 68, 68, 0.05)'
                                        borderStyle = '1px solid rgba(239, 68, 68, 0.2)'
                                    } else if (isTomorrow) {
                                        statusColor = 'var(--warning)'
                                        bgStyle = 'rgba(245, 158, 11, 0.05)'
                                        borderStyle = '1px solid rgba(245, 158, 11, 0.2)'
                                    }

                                    return (
                                        <div
                                            key={i}
                                            onClick={() => navigate(`/employees?id=${e.id}`)}
                                            style={{
                                                padding: '12px',
                                                background: bgStyle,
                                                border: borderStyle,
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                marginBottom: '8px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                                    {e.first_name} {e.last_name}
                                                </span>
                                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: statusColor }}>
                                                    {isToday ? 'BUGÜN ' : isTomorrow ? 'Yarın' : `${e.daysUntil} gün kaldı`}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '0' }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    {new Date(e.birth_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                                                </span>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                                    {e.department || 'Genel'}
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

            {/* Bottom Row: Distribution Analysis */}
            <div className="grid-responsive-2">
                {/* Department Distribution */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <PieIcon size={16} color="var(--accent-primary)" />
                        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Departman Dağılımı</h3>
                    </div>
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {stats.deptStats.slice(0, 7).map((d, i) => (
                            <div key={i}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>{d.name}</span>
                                    <span style={{ fontSize: '12px', fontWeight: '700' }}>{d.count}</span>
                                </div>
                                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            width: `${(d.count / stats.active) * 100}%`,
                                            height: '100%',
                                            background: 'var(--accent-primary)',
                                            borderRadius: '3px'
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Seniority Distribution */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Clock size={18} color="var(--info)" /> Kıdem Dağılımı (Görev Süresi)
                        </h3>
                    </div>
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {stats.seniorityStats.map((s, i) => (
                            <div key={i}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>{s.name}</span>
                                    <span style={{ fontSize: '12px', fontWeight: '700' }}>{s.count} Personel</span>
                                </div>
                                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            width: `${(s.count / stats.active) * 100}%`,
                                            height: '100%',
                                            background: 'var(--info)',
                                            borderRadius: '3px'
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                        <div style={{ marginTop: '10px', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            Katılım tarihinden itibaren geçen süreye göre analiz edilmiştir.
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
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 0',
                                borderBottom: '1px solid var(--border-color)',
                                cursor: 'grab',
                                opacity: draggedItemIndex === index ? 0.3 : 1,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ color: 'var(--text-muted)', cursor: 'grab' }}>
                                    <GripVertical size={16} />
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{action.label}</span>
                            </div>

                            <div
                                onClick={() => toggleAction(action.id)}
                                style={{
                                    width: '36px',
                                    height: '20px',
                                    background: action.active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                                    borderRadius: '10px',
                                    padding: '2px',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: action.active ? 'flex-end' : 'flex-start'
                                }}>
                                <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>
        </div>
    )
}
