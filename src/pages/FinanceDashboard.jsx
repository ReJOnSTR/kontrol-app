import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import TopProgressBar from '../components/TopProgressBar'
import Modal from '../components/Modal'
import { Wallet, Banknote, FileSignature, ArrowDownRight, PlusCircle, PenTool, GripVertical, Settings, Save, FileText, TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../utils/helpers'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function FinanceDashboard() {
    const { currentCompany } = useCompany()
    const [loading, setLoading] = useState(true)
    const [transactions, setTransactions] = useState([])
    const [checks, setChecks] = useState([])

    // Quick Action States
    const navigate = useNavigate()

    const allActions = [
        { id: 'add-transaction', label: 'Gelir / Gider Ekle', path: '/finance?action=new', icon: 'PlusCircle', default: true },
        { id: 'add-check', label: 'Çek / Senet Ekle', path: '/checks?action=new', icon: 'PenTool', default: true },
        { id: 'go-finance', label: 'Kasa Defterine Git', path: '/finance', icon: 'Banknote', default: true },
        { id: 'go-checks', label: 'Portföy\'e Git', path: '/checks', icon: 'FileSignature', default: true },
        { id: 'go-reports', label: 'Finans Raporu Al', path: '/reports?tab=finance', icon: 'FileText', default: false }
    ]

    const actionIconMap = {
        'PlusCircle': <PlusCircle size={18} />,
        'PenTool': <PenTool size={18} />,
        'Banknote': <Banknote size={18} />,
        'FileSignature': <FileSignature size={18} />,
        'FileText': <FileText size={18} />
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
        const saved = localStorage.getItem(`finance_actions_${currentCompany?.id}`)
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
        } else {
            setVisibleActions(allActions.filter(a => a.default))
        }
    }

    useEffect(() => {
        if (currentCompany) {
            loadData()
            loadActionPreferences()
        } else {
            setTransactions([])
            setChecks([])
            setVisibleActions(allActions.filter(a => a.default))
            setLoading(false)
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
            if (['transactions', 'recurring_transactions'].includes(change?.table)) {
                console.log(`[RealTime] FinanceDashboard reloading for change in ${change.table}`)
                loadDataRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const handleOpenSettings = () => {
        const visibleIds = new Set(visibleActions.map(a => a.id))

        const orderedVisible = visibleActions.map(a => ({ ...a, active: true }))
        const others = allActions.filter(a => !visibleIds.has(a.id)).map(a => ({ ...a, active: false }))

        setTempActions([...orderedVisible, ...others])
    }

    useEffect(() => {
        if (showSettings) {
            handleOpenSettings()
        }
    }, [showSettings])

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
        localStorage.setItem(`finance_actions_${currentCompany?.id}`, JSON.stringify(selected.map(a => a.id)))
        setShowSettings(false)
    }

    const loadData = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            const [txRes, checksRes] = await Promise.all([
                window.electronAPI.getAllFinance(currentCompany.id),
                window.electronAPI.getChecks(currentCompany.id)
            ])
            if (txRes.success) {
                const cashOnly = (txRes.data || []).filter(tx => tx.method === 'CASH')
                setTransactions(cashOnly)
            }
            if (checksRes.success) setChecks(checksRes.data || [])
        } catch (error) {
            console.error('Failed to load finance data:', error)
        }
        if (!isBackground) setLoading(false)
    }

    // ===== Computed Data =====

    // Stats from transactions only (no checks)
    const computedStats = (() => {
        let totalBalance = 0
        let currentMonthIn = 0
        let currentMonthOut = 0

        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        transactions.forEach(tx => {
            const val = tx.type === 'IN' ? tx.amount : -tx.amount
            if (tx.status === 'COMPLETED') totalBalance += val

            const txDate = new Date(tx.date)
            if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
                if (tx.type === 'IN') currentMonthIn += tx.amount
                else currentMonthOut += tx.amount
            }
        })

        return { totalBalance, currentMonthIn, currentMonthOut }
    })()

    // Monthly chart data (last 6 months)
    const monthlyData = (() => {
        const months = []
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            months.push({
                month: d.getMonth(),
                year: d.getFullYear(),
                label: d.toLocaleDateString('tr-TR', { month: '2-digit' }),
                Gelir: 0,
                Gider: 0,
            })
        }

        // Only regular transactions (no checks)
        transactions.forEach(tx => {
            const txDate = new Date(tx.date)
            const m = months.find(m => m.month === txDate.getMonth() && m.year === txDate.getFullYear())
            if (m) {
                if (tx.type === 'IN') m.Gelir += tx.amount
                else m.Gider += tx.amount
            }
        })

        return months
    })()

    // Recent transactions (last 5)
    const recentTransactions = [...transactions]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)

    // Upcoming checks (next 7 days pending)
    const upcomingChecks = checks
        .filter(c => c.status === 'PENDING' && c.check_due_date)
        .map(c => {
            const due = new Date(c.check_due_date)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
            return { ...c, daysLeft: diff }
        })
        .filter(c => c.daysLeft <= 30)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5)

    // Net profit
    const netProfit = computedStats.currentMonthIn - computedStats.currentMonthOut

    // Previous month comparison
    const prevMonthData = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2] : null
    const prevNet = prevMonthData ? prevMonthData.Gelir - prevMonthData.Gider : 0
    const netChange = prevNet !== 0 ? ((netProfit - prevNet) / Math.abs(prevNet)) * 100 : 0

    return (
        <div className="page-container fade-in" style={{ paddingBottom: '40px' }}>
            <TopProgressBar loading={loading} />

            <div className="page-header">
                <div>
                    <h1 className="page-title">Finans Dashboard</h1>
                    <p className="page-subtitle">Şirket genel finansal durumunu, gelir/gider akışını ve kasa bakiyelerini görüntüleyin.</p>
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
            <div className={`quick-actions grid-responsive-${Math.min(Math.max(visibleActions.length, 1), 4)}`} style={{ marginBottom: '30px', gap: '16px' }}>
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

            {/* Stat Cards Row */}
            <div className="grid-responsive-3" style={{ marginBottom: '25px', gap: '15px' }}>
                {/* Total Balance */}
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">KASA BAKİYE</div>
                        <div className={`stat-icon ${computedStats.totalBalance >= 0 ? "success" : "danger"}`} style={{ width: '32px', height: '32px' }}><Wallet size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value">{formatCurrency(computedStats.totalBalance)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Kasa bakiyesi
                        </div>
                    </div>
                </div>

                {/* Monthly Income */}
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">BU AY GELİR</div>
                        <div className="stat-icon success" style={{ width: '32px', height: '32px' }}><TrendingUp size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ color: 'var(--success)' }}>+{formatCurrency(computedStats.currentMonthIn)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Toplam girişler
                        </div>
                    </div>
                </div>

                {/* Monthly Expense */}
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">BU AY GİDER</div>
                        <div className="stat-icon danger" style={{ width: '32px', height: '32px' }}><TrendingDown size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ color: 'var(--danger)' }}>-{formatCurrency(computedStats.currentMonthOut)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Toplam çıkışlar
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg, 12px)',
                padding: '20px',
                marginBottom: '25px'
            }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
                    Aylık Gelir / Gider
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                        <Tooltip
                            formatter={(value) => formatCurrency(value)}
                            contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                            cursor={{ fill: 'var(--bg-tertiary, rgba(0,0,0,0.05))' }}
                        />
                        <Bar dataKey="Gelir" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="Gider" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Bottom Row: Recent Transactions + Upcoming Checks */}
            <div className="grid-responsive-2" style={{ gap: '20px' }}>
                {/* Recent Transactions */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Son İşlemler</h3>
                        <button className="btn btn-secondary" style={{ height: '26px', padding: '0 10px', fontSize: '11px' }} onClick={() => navigate('/finance')}>
                            Tümü
                        </button>
                    </div>
                    {recentTransactions.length > 0 ? (
                        <div>
                            {recentTransactions.map((tx, i) => (
                                <div key={tx.id} style={{
                                    padding: '12px 20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    borderBottom: i < recentTransactions.length - 1 ? '1px solid var(--border-color)' : 'none',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '6px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: tx.type === 'IN' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                            color: tx.type === 'IN' ? '#10b981' : '#ef4444'
                                        }}>
                                            {tx.type === 'IN' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                                                {tx.description || (tx.type === 'IN' ? 'Gelir' : 'Gider')}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {new Date(tx.date).toLocaleDateString('tr-TR')}
                                            </div>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontWeight: '600', fontSize: '13px',
                                        color: tx.type === 'IN' ? 'var(--success)' : 'var(--danger)'
                                    }}>
                                        {tx.type === 'IN' ? '+' : '-'}{formatCurrency(tx.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            Henüz işlem bulunmuyor
                        </div>
                    )}
                </div>

                {/* Upcoming Checks */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Yaklaşan Çek Vadeleri (30 Gün)</h3>
                        <button className="btn btn-secondary" style={{ height: '26px', padding: '0 10px', fontSize: '11px' }} onClick={() => navigate('/checks')}>
                            Tümü
                        </button>
                    </div>
                    {upcomingChecks.length > 0 ? (
                        <div>
                            {upcomingChecks.map((check, i) => {
                                let badgeColor = '#14b8a6'
                                let badgeBg = 'rgba(20, 184, 166, 0.1)'
                                let badgeText = `${check.daysLeft} gün kaldı`

                                if (check.daysLeft < 0) {
                                    badgeColor = '#ef4444'
                                    badgeBg = 'rgba(239, 68, 68, 0.1)'
                                    badgeText = 'VADESİ GEÇTİ'
                                } else if (check.daysLeft === 0) {
                                    badgeColor = '#fb923c'
                                    badgeBg = 'rgba(249, 115, 22, 0.1)'
                                    badgeText = 'BUGÜN'
                                } else if (check.daysLeft <= 3) {
                                    badgeColor = '#facc15'
                                    badgeBg = 'rgba(234, 179, 8, 0.1)'
                                    badgeText = `${check.daysLeft} gün kaldı`
                                }

                                return (
                                <div key={check.id} style={{
                                    padding: '12px 20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    borderBottom: i < upcomingChecks.length - 1 ? '1px solid var(--border-color)' : 'none',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '6px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: badgeBg,
                                            color: badgeColor
                                        }}>
                                            {check.daysLeft <= 3 ? <AlertTriangle size={14} /> : <Clock size={14} />}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                                                {check.check_number || check.description || 'Çek'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {new Date(check.check_due_date).toLocaleDateString('tr-TR')}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>
                                            {formatCurrency(check.amount)}
                                        </div>
                                        <div style={{
                                            fontSize: '10px', fontWeight: '600',
                                            color: badgeColor,
                                        }}>
                                            {badgeText}
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    ) : (
                        <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            Yaklaşan vade bulunmuyor
                        </div>
                    )}
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
                                        {actionIconMap[action.icon] || <Settings size={16} />}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{action.label}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Custom Switch Toggle */}
                            <div
                                onClick={(e) => {
                                    e.stopPropagation()
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
                                    transition: 'transform 0.2s ease'
                                }} />
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>
        </div>
    )
}
