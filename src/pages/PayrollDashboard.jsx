import TopProgressBar from '../components/TopProgressBar'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import { useTabs } from '../context/TabContext'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import CustomInput from '../components/CustomInput'
import CustomSelect from '../components/CustomSelect'
import MonthFilter from '../components/MonthFilter'
import { formatCurrency, getHistoricalBaseSalary, formatDateForInput } from '../utils/helpers'
import { Banknote, Users, Building2, Wallet, Clock, X, Plus, ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react'

import { calculateEmployeeMonthlyPayroll } from '../utils/payrollCalculator'

const paymentTypes = [
    { value: 'salary', label: 'Maaş' },
    { value: 'bonus', label: 'Prim' },
    { value: 'advance', label: 'Avans' },
    { value: 'loan', label: 'Borç Alma' },
    { value: 'loan_payment', label: 'Borç Ödeme' },
    { value: 'overtime_pay', label: 'Mesai Ücreti' },
    { value: 'expense', label: 'Harcırah' },
    { value: 'travel', label: 'Yol Ücreti' },
    { value: 'food', label: 'Yemek Ücreti' },
    { value: 'carryover', label: 'Devir Bakiyesi' },
    { value: 'other', label: 'Diğer' }
]

const paymentMethods = [
    { value: 'nakit', label: 'Nakit' },
    { value: 'kasa', label: 'Kasa' },
    { value: 'bank', label: 'Banka' },
    { value: 'salary_deduction', label: 'Maaştan Düşme' }
]

export default function PayrollDashboard() {
    const { currentCompany } = useCompany()
    const navigate = useNavigate()
    const { openNewTab } = useTabs()
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const saved = localStorage.getItem(`payroll_selected_month_${currentCompany?.id || 'default'}`)
        return saved || new Date().toISOString().slice(0, 7)
    })
    
    const [payrollData, setPayrollData] = useState([])
    const [displayData, setDisplayData] = useState([]) // Data after table-top filters
    const [loading, setLoading] = useState(true)
    const [advanceStats, setAdvanceStats] = useState({ currentMonth: 0, avg3Month: 0, months: [], potentialTotal: 0, activeCount: 0 })

    const [selectedRows, setSelectedRows] = useState([])
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        period: 'salary',
        amount: '',
        paymentDate: formatDateForInput(new Date()),
        paymentMethod: 'nakit',
        status: 'paid',
        notes: '',
        useRemaining: false
    })

    // Restore Month Persistence
    useEffect(() => {
        if (currentCompany) {
            const m = localStorage.getItem(`payroll_selected_month_${currentCompany.id}`)
            if (m) setSelectedMonth(m)
        }
    }, [currentCompany])

    useEffect(() => {
        if (selectedMonth && currentCompany) {
            localStorage.setItem(`payroll_selected_month_${currentCompany.id}`, selectedMonth)
        }
    }, [selectedMonth, currentCompany])

    // Derive available departments for the filter dropdown
    const departmentOptions = useMemo(() => {
        const depts = [...new Set(payrollData.map(item => item.department).filter(Boolean))].sort()
        return depts.map(d => ({ value: d, label: d }))
    }, [payrollData])

    // Derive stats from displayData (dynamically updated by DataTable filters)
    const displayStats = useMemo(() => {
        return displayData.reduce((acc, item) => ({
            totalCurrentSalary: acc.totalCurrentSalary + (item.calc_base || 0),
            totalOvertimes: acc.totalOvertimes + (item.calc_overtimes || 0),
            totalExtra: acc.totalExtra + (item.calc_extra || 0),
            totalRequired: acc.totalRequired + (item.calc_required || 0),
            totalPaid: acc.totalPaid + (item.calc_paid || 0),
            totalPending: acc.totalPending + (item.calc_remaining || 0),
            totalIncomingCarryover: acc.totalIncomingCarryover + (item.calc_incoming_carryover || 0),
            totalOutboundCarryover: acc.totalOutboundCarryover + (item.calc_outbound_carryover || 0)
        }), { totalCurrentSalary: 0, totalOvertimes: 0, totalExtra: 0, totalRequired: 0, totalPaid: 0, totalPending: 0, totalIncomingCarryover: 0, totalOutboundCarryover: 0 })
    }, [displayData])

    useEffect(() => {
        if (currentCompany) {
            loadPayroll()
        } else {
            setPayrollData([])
            setDisplayData([])
            setLoading(false)
        }
    }, [currentCompany, selectedMonth])

    // Real-time synchronization listener
    const loadPayrollRef = useRef(null)
    useEffect(() => {
        loadPayrollRef.current = loadPayroll
    })
    useEffect(() => {
        if (!currentCompany) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if (['salaries', 'employees'].includes(change?.table)) {
                console.log(`[RealTime] PayrollDashboard reloading for change in ${change.table}`)
                loadPayrollRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const getNextMonth = (monthStr) => {
        const [year, month] = monthStr.split('-').map(Number)
        const nextDate = new Date(year, month, 1)
        const y = nextDate.getFullYear()
        const m = String(nextDate.getMonth() + 1).padStart(2, '0')
        return `${y}-${m}`
    }

    const getPrevMonths = (monthStr, count) => {
        const months = []
        let [year, month] = monthStr.split('-').map(Number)
        for (let i = 0; i < count; i++) {
            month -= 1
            if (month < 1) { month = 12; year -= 1 }
            months.push(`${year}-${String(month).padStart(2, '0')}`)
        }
        return months
    }

    const loadPayroll = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            const nextMonth = getNextMonth(selectedMonth)
            // Fetch current month data + next month data (for outbound carryover) + all salaries for advance stats
            const [result, nextMonthResult, allSalariesResult] = await Promise.all([
                window.electronAPI.getPayrollSummary(currentCompany.id, selectedMonth),
                window.electronAPI.getPayrollSummary(currentCompany.id, nextMonth),
                window.electronAPI.getSalariesByCompany(currentCompany.id)
            ])

            // --- Calculate advance stats from previous months ---
            let currentMonthAdvance = 0
            let avg = 0
            let monthlyAdvances = []
            if (allSalariesResult.success && allSalariesResult.data) {
                const allSalaries = allSalariesResult.data
                const prev3Months = getPrevMonths(selectedMonth, 3)

                // Current month advance total
                currentMonthAdvance = allSalaries
                    .filter(s => s.salary_month === selectedMonth && s.period === 'advance' && s.status === 'paid')
                    .reduce((sum, s) => sum + (s.net_salary || 0), 0)

                // Previous months advance totals
                monthlyAdvances = prev3Months.map(m => {
                    const total = allSalaries
                        .filter(s => s.salary_month === m && s.period === 'advance' && s.status === 'paid')
                        .reduce((sum, s) => sum + (s.net_salary || 0), 0)
                    return { month: m, total }
                })

                const monthsWithData = monthlyAdvances.filter(m => m.total > 0)
                avg = monthsWithData.length > 0
                    ? monthsWithData.reduce((sum, m) => sum + m.total, 0) / monthsWithData.length
                    : 0
            }

            const defaultAdvance = parseFloat(localStorage.getItem('hr_default_advance_amount')) || 0
            const activeCount = (result.success && result.data) ? result.data.length : 0
            const potentialTotal = activeCount * defaultAdvance

            setAdvanceStats({
                currentMonth: currentMonthAdvance,
                avg3Month: avg,
                months: monthlyAdvances,
                potentialTotal,
                activeCount
            })

            if (result.success && result.data) {
                // Build a map of next month's carryover records per employee
                const nextMonthCarryoverMap = {}
                if (nextMonthResult.success && nextMonthResult.data) {
                    nextMonthResult.data.forEach(emp => {
                        const carryovers = (emp.salaries || []).filter(s => s.period === 'carryover' && s.status === 'paid')
                        if (carryovers.length > 0) {
                            nextMonthCarryoverMap[emp.id] = carryovers.reduce((sum, s) => sum + (s.net_salary || 0), 0)
                        }
                    })
                }

                const processedData = result.data.map(emp => {
                    const outboundCarryover = nextMonthCarryoverMap[emp.id] || 0
                    const calc = calculateEmployeeMonthlyPayroll(
                        emp,
                        emp.salaries || [],
                        emp.overtimes || [],
                        selectedMonth,
                        outboundCarryover
                    )

                    return {
                        ...emp,
                        calc_base: calc.baseSalaryTarget,
                        calc_overtimes: calc.totalOtTarget,
                        calc_extra: calc.extraEarningsTarget,
                        calc_incoming_carryover: calc.incomingCarryover,
                        calc_outbound_carryover: outboundCarryover,
                        calc_required: calc.netTarget,
                        calc_paid: calc.totalPaid,
                        calc_remaining: calc.netRemaining
                    };
                });

                setPayrollData(processedData)

            }
        } catch (err) {
            console.error('Failed to load payroll summary:', err)
        }
        if (!isBackground) setLoading(false)
    }

    const handleOpenPaymentModal = (row = null) => {
        if (row) {
            setSelectedRows([row.id])
            setFormData({
                period: 'salary',
                amount: row.calc_remaining > 0 ? row.calc_remaining : '',
                paymentDate: formatDateForInput(new Date()),
                paymentMethod: 'kasa',
                status: 'paid',
                notes: '',
                useRemaining: false,
                salary_month: selectedMonth
            })
        } else {
            const defaultAdvance = parseFloat(localStorage.getItem('hr_default_advance_amount')) || 0
            setFormData({
                period: 'advance',
                amount: defaultAdvance > 0 ? defaultAdvance : '',
                paymentDate: formatDateForInput(new Date()),
                paymentMethod: 'kasa',
                status: 'paid',
                notes: '',
                useRemaining: false,
                salary_month: selectedMonth
            })
        }
        setModalOpen(true)
    }

    const handlePeriodChange = (val) => {
        setFormData(prev => {
            const isSalaryOrOvertime = val === 'salary' || val === 'overtime_pay'
            const isAdvance = val === 'advance'
            let newAmount = prev.amount
            
            if (isAdvance) {
                const defaultAdvance = parseFloat(localStorage.getItem('hr_default_advance_amount')) || 0
                newAmount = defaultAdvance > 0 ? defaultAdvance : prev.amount
            } else if (isSalaryOrOvertime) {
                newAmount = ''
            }
            
            return {
                ...prev,
                period: val,
                useRemaining: isSalaryOrOvertime ? true : false,
                amount: newAmount
            }
        })
    }

    const handlePaymentSubmit = async (e) => {
        e.preventDefault()
        if (selectedRows.length === 0) return
        setSaving(true)
        
        try {
            for (const empId of selectedRows) {
                const emp = payrollData.find(e => e.id === empId)
                if (!emp) continue

                let finalAmount = parseFloat(formData.amount) || 0
                if (formData.useRemaining) {
                    finalAmount = emp.calc_remaining
                }

                if (finalAmount !== 0) {
                    await window.electronAPI.createSalary({
                        employeeId: emp.id,
                        period: formData.period,
                        baseSalary: 0,
                        bonus: 0,
                        deduction: 0,
                        netSalary: finalAmount,
                        paymentDate: formData.paymentDate,
                        salaryMonth: formData.salary_month || selectedMonth,
                        status: formData.status,
                        paymentMethod: formData.paymentMethod,
                        notes: formData.notes
                    })
                }
            }
            setModalOpen(false)
            setSelectedRows([])
            loadPayroll()
        } catch (error) {
            console.error('Payment failed:', error)
            alert('İşlem sırasında bir hata oluştu.')
        } finally {
            setSaving(false)
        }
    }

    const columns = [
        {
            key: 'name',
            label: 'Ad Soyad',
            render: (_, row) => (
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                    {row.first_name} {row.last_name}
                </span>
            )
        },
        {
            key: 'department',
            label: 'Departman',
            render: (value) => value ? (
                <span style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    border: '1px solid var(--border-color)'
                }}>
                    {value}
                </span>
            ) : <span style={{ color: 'var(--text-muted)', paddingLeft: '10px' }}>-</span>

        },
        {
            key: 'calc_base',
            label: 'Aylık Maaş',
            render: (value) => (
                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                    {formatCurrency(value || 0)}
                </span>
            )
        },
        {
            key: 'calc_overtimes',
            label: 'Mesailer',
            render: (value) => (
                <span style={{ color: value > 0 ? 'var(--secondary-color)' : 'var(--text-muted)' }}>
                    {value > 0 ? formatCurrency(value) : '-'}
                </span>
            )
        },
        {
            key: 'calc_incoming_carryover',
            label: 'Gelen Devir',
            render: (value) => {
                if (!value) return <span style={{ color: 'var(--text-muted)' }}>-</span>
                return (
                    <span style={{ fontWeight: '600', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <ArrowDownRight size={13} />
                        {formatCurrency(value)}
                    </span>
                )
            }
        },
        {
            key: 'calc_required',
            label: 'Hak Ediş',
            render: (value) => (
                <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
                    {formatCurrency(value || 0)}
                </span>
            )
        },
        {
            key: 'calc_paid',
            label: 'Ödenen',
            render: (value) => (
                <span style={{ fontWeight: '600', color: 'var(--success)' }}>
                    {formatCurrency(value || 0)}
                </span>
            )
        },
        {
            key: 'calc_outbound_carryover',
            label: 'Giden Devir',
            render: (value) => {
                if (!value) return <span style={{ color: 'var(--text-muted)' }}>-</span>
                return (
                    <span style={{ fontWeight: '600', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <ArrowUpRight size={13} />
                        {formatCurrency(value)}
                    </span>
                )
            }
        },
        {
            key: 'calc_remaining',
            label: 'Durum / Bakiye',
            render: (value, row) => {
                // If there's outbound carryover and remaining is near 0, show "Devredildi"
                if (row.calc_outbound_carryover > 0 && Math.abs(value) < 0.1) {
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)' }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor' }}></div>
                            <span style={{ fontSize: '12px', fontWeight: '500' }}>Devredildi</span>
                        </div>
                    )
                }
                if (value > 0) {
                    return (
                        <span style={{ color: 'var(--danger)', fontWeight: '600', fontSize: '13px' }}>
                            {formatCurrency(value)}
                        </span>
                    )
                } else if (value < -0.1) {
                    const overpaidAmount = Math.abs(value)
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)' }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor' }}></div>
                            <span style={{ fontWeight: '700', fontSize: '13px' }}>+{formatCurrency(overpaidAmount)}</span>
                            <span style={{ fontSize: '10px', background: 'var(--accent-subtle)', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>Fazla Avans</span>
                        </div>
                    )
                } else {
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', opacity: 0.8 }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor' }}></div>
                            <span style={{ fontSize: '12px', fontWeight: '500' }}>Ödendi</span>
                        </div>
                    )
                }
            }
        }
    ]

    // Summary Card Component
    const StatCard = ({ title, value, icon: Icon, color, bgColor, isDanger, subtitle }) => (
        <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            border: `1px solid var(--border-color)`
        }}>
            <div style={{
                backgroundColor: isDanger ? 'var(--danger-bg)' : (bgColor || 'var(--accent-subtle)'),
                color: isDanger ? 'var(--danger)' : color,
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                <Icon size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
                    {title}
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: isDanger ? 'var(--danger)' : 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                    {value}
                </div>
                {subtitle && (
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                        {subtitle}
                    </div>
                )}
            </div>
        </div>
    )

    if (!currentCompany) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">
                    <Building2 />
                </div>
                <h2 className="empty-state-title">Şirket Seçilmedi</h2>
                <p className="empty-state-desc">
                    Maaş tablosunu görüntülemek için lütfen bir şirket seçin.
                </p>
            </div>
        )
    }

    return (
        <div>
            <TopProgressBar loading={loading} />
            <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">Maaş & Ödeme Tablosu</h1>
                    <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>Tüm personellerin maaş bakiyeleri ve ödeme durumları.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '240px' }}>
                        <MonthFilter 
                            value={selectedMonth} 
                            onChange={setSelectedMonth} 
                        />
                    </div>
                </div>
            </div>

            {/* Top Summaries */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '30px' }}>
                <StatCard 
                    title="Toplam Hak Ediş" 
                    value={formatCurrency(displayStats.totalRequired)} 
                    icon={Users} 
                    color="var(--accent-primary)" 
                    bgColor="var(--accent-subtle)"
                    subtitle={`Baz Maaş: ${formatCurrency(displayStats.totalCurrentSalary)}${displayStats.totalExtra > 0 ? ` • Ek: +${formatCurrency(displayStats.totalExtra)}` : ''}`}
                />
                <StatCard 
                    title="Seçili Mesai" 
                    value={formatCurrency(displayStats.totalOvertimes)} 
                    icon={Clock} 
                    color="var(--info)" 
                    bgColor="var(--info-bg)"
                    subtitle={displayStats.totalIncomingCarryover > 0 ? `Gelen Devir: +${formatCurrency(displayStats.totalIncomingCarryover)}` : null}
                />
                <StatCard 
                    title="Seçili Ödenen" 
                    value={formatCurrency(displayStats.totalPaid)} 
                    icon={Wallet} 
                    color="var(--success)" 
                    bgColor="var(--success-bg)"
                    subtitle={displayStats.totalOutboundCarryover > 0 ? `Giden Devir: ${formatCurrency(displayStats.totalOutboundCarryover)}` : null}
                />
                <StatCard 
                    title="Seçili Kalan Bakiye" 
                    value={formatCurrency(displayStats.totalPending)} 
                    icon={Banknote} 
                    color="var(--warning)" 
                    bgColor="var(--warning-bg)"
                    isDanger={displayStats.totalPending > 0}
                />
                <StatCard 
                    title="Toplam Avans"
                    value={formatCurrency(advanceStats.currentMonth)} 
                    icon={TrendingUp} 
                    color="var(--secondary-color)" 
                    bgColor="var(--secondary-bg, rgba(139, 92, 246, 0.1))"
                    subtitle={`Alınabilir Toplam: ${formatCurrency(advanceStats.potentialTotal || 0).replace(',00', '')}`}
                />
            </div>

            {/* Data Table */}
            <DataTable 
                loading={loading}
                persistenceKey="Payroll_table_v2"
                storageKey="payroll_table_cols"
                columns={columns}
                data={payrollData}
                onFilteredDataChange={setDisplayData}
                filters={[
                    {
                        key: 'department',
                        label: 'Departman',
                        options: departmentOptions
                    },
                    {
                        key: 'payment_status',
                        label: 'Ödeme Durumu',
                        options: [
                            { value: 'pending', label: 'Eksik Ödeme' },
                            { value: 'paid', label: 'Ödenenler' },
                            { value: 'overpaid', label: 'Fazla Ödeme' },
                            { value: 'carried', label: 'Devredildi' }
                        ],
                        filterFn: (row, value) => {
                            if (value === 'carried') return row.calc_outbound_carryover > 0 && Math.abs(row.calc_remaining) < 0.1
                            if (value === 'pending') return row.calc_remaining > 0
                            if (value === 'paid') return row.calc_remaining === 0
                            if (value === 'overpaid') return row.calc_remaining < 0
                            return true
                        }
                    }
                ]}
                showSearch={true}
                searchPlaceholder="Personel Ara..."
                searchKeys={['first_name', 'last_name', 'department']}
                onSelectionChange={setSelectedRows}
                customBulkActions={(selectedIds, clearSelection) => (
                    <button 
                        className="btn-bulk-action primary" 
                        onClick={() => handleOpenPaymentModal()}
                    >
                        <Wallet size={15} />
                        Toplu İşlem Yap
                    </button>
                )}
                actions={(row) => (
                    <button 
                        className="btn-icon" 
                        title="Hızlı Ödeme Ekle" 
                        onClick={(e) => {
                            e.stopPropagation()
                            handleOpenPaymentModal(row)
                        }}
                    >
                        <Wallet size={16} />
                    </button>
                )}
                onRowClick={(item, e) => {
                    if (e.ctrlKey || e.metaKey) {
                        openNewTab(`/employees/${item.id}`, true, `${item.first_name} ${item.last_name}`)
                    } else {
                        navigate(`/employees/${item.id}`)
                    }
                }}
            />

            {/* Payment Modal */}
            <Modal 
                isOpen={modalOpen} 
                onClose={() => setModalOpen(false)} 
                title={selectedRows.length > 1 ? `Toplu İşlem (${selectedRows.length} Personel)` : 'İşlem Ekle'}
            >
                <form onSubmit={handlePaymentSubmit}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <CustomSelect
                                        label="Ödeme Türü *"
                                        value={formData.period}
                                        onChange={handlePeriodChange}
                                        options={paymentTypes}
                                        required
                                    />

                                    <CustomInput
                                        label="Tutar *"
                                        format="currency"
                                        value={formData.amount}
                                        onChange={(val) => setFormData({ ...formData, amount: val })}
                                        required={!formData.useRemaining}
                                        disabled={formData.useRemaining}
                                        maxLength={14}
                                        placeholder={formData.useRemaining ? "Bakiyeler otomatik hesaplanacak" : "Elle tutar girin..."}
                                    />

                                    <CustomInput
                                        label="Ödeme Tarihi"
                                        type="date"
                                        value={formData.paymentDate}
                                        onChange={(val) => setFormData({ ...formData, paymentDate: val })}
                                        required
                                    />

                                    <CustomInput
                                        label="Ait Olduğu Ay"
                                        type="month"
                                        value={formData.salary_month || selectedMonth}
                                        onChange={(val) => setFormData({ ...formData, salary_month: val })}
                                    />

                                    <CustomSelect
                                        label="Ödeme Kanalı"
                                        value={formData.paymentMethod}
                                        onChange={(val) => setFormData({ ...formData, paymentMethod: val })}
                                        options={paymentMethods}
                                        required
                                    />
                                </div>

                                {/* Otomatik Bakiye Toggle Card */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 14px', marginTop: '16px',
                                    background: formData.useRemaining ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                    border: `1px solid ${formData.useRemaining ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    borderRadius: 'var(--radius-sm)', transition: 'background 0.15s ease, border-color 0.15s ease', cursor: 'pointer'
                                }} onClick={() => setFormData({ ...formData, useRemaining: !formData.useRemaining, amount: !formData.useRemaining ? '' : formData.amount })}>
                                    <label className="toggle-switch" style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={formData.useRemaining} onChange={(e) => setFormData({ ...formData, useRemaining: e.target.checked, amount: e.target.checked ? '' : formData.amount })} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Otomatik Hesaplama</span>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: formData.useRemaining ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                            {formData.useRemaining ? 'Personel Bakiyelerini Otomatik Çek' : 'Sabit Tutar Girişi Yap'}
                                        </span>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 14px', marginTop: '12px',
                                    background: formData.status === 'paid' ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                    border: `1px solid ${formData.status === 'paid' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    borderRadius: 'var(--radius-sm)', transition: 'background 0.15s ease, border-color 0.15s ease', cursor: 'pointer'
                                }} onClick={() => setFormData({ ...formData, status: formData.status === 'paid' ? 'pending' : 'paid' })}>
                                    <label className="toggle-switch" style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={formData.status === 'paid'} onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'paid' : 'pending' })} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ödeme Durumu</span>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: formData.status === 'paid' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                            {formData.status === 'paid' ? 'Ödendi' : 'Bekliyor'}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ marginTop: '16px' }}>
                                    <CustomInput
                                        label="Notlar"
                                        type="textarea"
                                        rows={2}
                                        value={formData.notes}
                                        onChange={(val) => setFormData({ ...formData, notes: val })}
                                        maxLength={300}
                                        placeholder="Eklemek istediğiniz notlar..."
                                    />
                                </div>

                    <div className="modal-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>İptal</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Kaydediliyor...' : 'İşlemi Kaydet'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}


