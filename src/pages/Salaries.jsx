import React, { useState, useEffect } from 'react'
import DataTable from '../components/DataTable'
import { useCompany } from '../context/CompanyContext'
import { formatCurrency, formatDate, getHistoricalBaseSalary } from '../utils/helpers'
import CustomSelect from '../components/CustomSelect'
import CustomInput from '../components/CustomInput'
import MonthFilter from '../components/MonthFilter'
import Modal from '../components/Modal'
import { DollarSign, Wallet, AlertCircle, CreditCard, CheckCircle, Calculator, Calendar as CalendarIcon, FileText, X, Printer, Pencil, Trash2, Edit2, Archive } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import ConfirmModal from '../components/ConfirmModal'

export default function Salaries() {
    const { currentCompany } = useCompany()
    const { showToast } = useToast()
    const [employees, setEmployees] = useState([])
    const [movements, setMovements] = useState([])
    const [overtimes, setOvertimes] = useState([])
    const [salaries, setSalaries] = useState([])
    const [loading, setLoading] = useState(true)

    // Month Selection (YYYY-MM)
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

    // Derived Payroll Data
    const [payrollData, setPayrollData] = useState([])

    // Detail Modal State
    const [selectedPayroll, setSelectedPayroll] = useState(null)

    // New Payment Modal State
    // data: employee object
    const [paymentModal, setPaymentModal] = useState({
        isOpen: false,
        mode: 'create', // create, edit
        movementId: null,
        employee: null,
        amount: '',
        type: 'payment', // payment, advance
        subType: 'Maaş Ödemesi', // for description if type is payment
        method: 'bank',
        date: new Date().toISOString().split('T')[0],
        description: ''
    })

    // Salary Edit Modal
    const [salaryModal, setSalaryModal] = useState({
        isOpen: false,
        employee: null,
        amount: '',
        date: ''
    })

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    })

    const loadData = async () => {
        if (!currentCompany) return
        setLoading(true)
        try {
            const [empResult, archiveResult, moveResult, overtimeResult, salaryResult] = await Promise.all([
                window.electronAPI.getEmployees(currentCompany.id, 0),
                window.electronAPI.getEmployees(currentCompany.id, 1),
                window.electronAPI.getAllEmployeeMovements(currentCompany.id),
                window.electronAPI.getAllOvertimes(currentCompany.id),
                window.electronAPI.getSalariesByCompany(currentCompany.id)
            ])

            if (empResult.success) {
                let merged = empResult.data || []
                if (archiveResult.success && archiveResult.data) {
                    merged = [...merged, ...archiveResult.data]
                }
                setEmployees(merged)
            }
            if (moveResult.success) {
                setMovements(moveResult.data)
            }
            if (overtimeResult.success) {
                setOvertimes(overtimeResult.data)
            }
            if (salaryResult.success) {
                setSalaries(salaryResult.data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    // Helper: Calculate suggested amount based on type
    const calculateSuggestedAmount = (emp, subType) => {
        if (!emp) return ''

        let target = 0
        let paid = 0

        if (subType === 'Maaş Ödemesi') {
            target = emp.salaryAmount
            // Paid: Generic payments with 'Maaş', Legacy Paid Salaries
            const paidGeneric = emp.items
                .filter(i => i.type === 'payment' && (i.description || '').includes('Maaş'))
                .reduce((sum, i) => sum + i.amount, 0)
            const paidLegacy = emp.items
                .filter(i => i.type === 'salary' && i.is_paid)
                .reduce((sum, i) => sum + i.amount, 0)

            paid = paidGeneric + paidLegacy

        } else if (subType === 'Mesai Ödemesi') {
            target = emp.overtime_amount
            paid = emp.items
                .filter(i => i.type === 'payment' && (i.description || '').includes('Mesai'))
                .reduce((sum, i) => sum + i.amount, 0)

        } else if (subType === 'Prim Ödemesi') {
            target = emp.bonuses
            // Paid: Generic payments with 'Prim', Legacy Paid Bonuses
            const paidGeneric = emp.items
                .filter(i => i.type === 'payment' && (i.description || '').includes('Prim'))
                .reduce((sum, i) => sum + i.amount, 0)
            const paidLegacy = emp.items
                .filter(i => i.type === 'bonus' && i.is_paid)
                .reduce((sum, i) => sum + i.amount, 0)

            paid = paidGeneric + paidLegacy
        } else {
            // Fallback to total remaining
            return Math.max(0, emp.remaining)
        }

        return Math.max(0, target - paid)
    }

    const openPaymentModal = (employee, remainingAmount) => {
        // Default to Maaş logic
        const initialSubType = 'Maaş Ödemesi'
        const suggested = calculateSuggestedAmount(employee, initialSubType)

        setPaymentModal({
            isOpen: true,
            mode: 'create',
            employee: employee,
            amount: suggested > 0 ? suggested : '',
            type: 'payment',
            subType: initialSubType,
            method: 'bank',
            date: new Date().toISOString().split('T')[0],
            description: ''
        })
    }

    const openEditPaymentModal = (item, employee) => {
        // Parse description for subType
        let subType = 'Diğer Ödeme'
        let desc = item.description || ''

        if (desc.startsWith('Maaş Ödemesi')) subType = 'Maaş Ödemesi'
        else if (desc.startsWith('Mesai Ödemesi')) subType = 'Mesai Ödemesi'
        else if (desc.startsWith('Prim Ödemesi')) subType = 'Prim Ödemesi'

        // Remove Subtype from description for display
        const cleanDesc = desc.replace(subType, '').replace(/^ - /, '')

        setPaymentModal({
            isOpen: true,
            mode: 'edit',
            movementId: item.id,
            employee: employee,
            amount: item.amount,
            type: item.type, // payment or advance
            subType: subType,
            method: item.payment_method || 'cash',
            date: item.date,
            description: cleanDesc
        })
    }

    const handleSalaryEdit = (employee, currentAmount) => {
        setSalaryModal({
            isOpen: true,
            employee: employee,
            amount: currentAmount,
            date: `${selectedMonth}-15` // Default to mid-month
        })
    }

    const handleSaveSalary = async () => {
        if (!salaryModal.employee || !salaryModal.amount) return

        try {
            // Check if salary record exists
            const existingRecord = movements.find(m =>
                m.employee_id === salaryModal.employee.id &&
                m.type === 'salary' &&
                m.date.startsWith(selectedMonth)
            )

            let result;
            if (existingRecord) {
                // Update
                result = await window.electronAPI.updateEmployeeMovement({
                    ...existingRecord,
                    amount: parseFloat(salaryModal.amount)
                })
            } else {
                // Create
                result = await window.electronAPI.addEmployeeMovement({
                    employeeId: salaryModal.employee.id,
                    type: 'salary',
                    amount: parseFloat(salaryModal.amount),
                    date: salaryModal.date,
                    description: 'Maaş Hakedişi',
                    isPaid: false,
                    paymentMethod: 'cash' // Irrelevant for accrual
                })
            }

            if (result.success) {
                showToast('Hakediş güncellendi', 'success')
                setSalaryModal({ ...salaryModal, isOpen: false })
                loadData()
            } else {
                showToast('Hata: ' + result.error, 'error')
            }
        } catch (e) { console.error(e) }
    }

    // Sync selectedPayroll with updated data
    useEffect(() => {
        if (selectedPayroll) {
            const updated = payrollData.find(p => p.id === selectedPayroll.id)
            if (updated) {
                setSelectedPayroll(updated)
            } else {
                // If employee removed or filtered out, close modal
                setSelectedPayroll(null)
            }
        }
    }, [payrollData])

    const handleDeleteMovement = async (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Ödemeyi Sil',
            message: 'Bu ödeme kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
            onConfirm: async () => {
                try {
                    const result = await window.electronAPI.deleteEmployeeMovement(id)
                    if (result.success) {
                        showToast('Kayıt silindi', 'success')
                        loadData()
                        // Modal will auto-update via useEffect
                        setConfirmModal({ ...confirmModal, isOpen: false })
                    } else {
                        showToast('Hata: ' + result.error, 'error')
                    }
                } catch (error) {
                    showToast('Hata', 'error')
                }
            }
        })
    }

    const handleConfirmPayment = async () => {
        if (!paymentModal.employee || !paymentModal.amount) return

        try {
            const isAdvance = paymentModal.type === 'advance'
            const finalType = isAdvance ? 'advance' : 'payment'

            let finalDesc = paymentModal.description
            if (!isAdvance && paymentModal.subType) {
                finalDesc = `${paymentModal.subType}${paymentModal.description ? ' - ' + paymentModal.description : ''}`
            }

            let result;
            if (paymentModal.mode === 'edit') {
                result = await window.electronAPI.updateEmployeeMovement({
                    id: paymentModal.movementId,
                    employeeId: paymentModal.employee.id, // Needed? check db info
                    type: finalType,
                    amount: parseFloat(paymentModal.amount),
                    date: paymentModal.date,
                    description: finalDesc,
                    isPaid: true,
                    paymentMethod: paymentModal.method
                })
            } else {
                result = await window.electronAPI.addEmployeeMovement({
                    employeeId: paymentModal.employee.id,
                    type: finalType,
                    amount: parseFloat(paymentModal.amount),
                    date: paymentModal.date,
                    description: finalDesc,
                    isPaid: true,
                    paymentMethod: paymentModal.method
                })
            }

            if (result.success) {
                showToast('İşlem başarılı', 'success')
                setPaymentModal({ ...paymentModal, isOpen: false })
                loadData()
                // Update detail view if open
                if (selectedPayroll && selectedPayroll.id === paymentModal.employee.id) {
                    // Close for now to refresh state easily
                    setSelectedPayroll(null)
                }
            } else {
                showToast('Hata: ' + result.error, 'error')
            }
        } catch (error) {
            showToast('Bir hata oluştu', 'error')
        }
    }

    const handleCarryOver = async (emp, remainingAmount) => {
        const getNextMonth = (monthStr) => {
            const [year, month] = monthStr.split('-').map(Number)
            const nextDate = new Date(year, month, 1)
            const y = nextDate.getFullYear()
            const m = String(nextDate.getMonth() + 1).padStart(2, '0')
            return `${y}-${m}`
        }
        const nextMonth = getNextMonth(selectedMonth)
        const existing = salaries.find(s => s.employee_id === emp.id && s.salary_month === nextMonth && s.period === 'carryover')

        if (existing) {
            setConfirmModal({
                isOpen: true,
                title: 'Devri İptal Et',
                message: `Gelecek aya yapılan ${formatCurrency(existing.net_salary)} tutarındaki devri iptal etmek istediğinize emin misiniz?`,
                onConfirm: async () => {
                    try {
                        const res = await window.electronAPI.deleteSalary(existing.id)
                        if (res.success) {
                            showToast('Devir işlemi iptal edildi.', 'success')
                            loadData()
                            setSelectedPayroll(null)
                        } else {
                            showToast(res.error || 'İptal edilemedi.', 'error')
                        }
                    } catch (e) {
                        showToast(e.message, 'error')
                    }
                    setConfirmModal({ isOpen: false })
                }
            })
        } else {
            if (remainingAmount === 0) {
                showToast('Kalan bakiye 0 olduğu için devredilemez.', 'warning')
                return
            }

            setConfirmModal({
                isOpen: true,
                title: remainingAmount < -0.1 ? 'Avans Fazlasını Devret' : 'Bakiyeyi Devret',
                message: remainingAmount < -0.1 
                    ? `${selectedMonth} ayındaki ${formatCurrency(Math.abs(remainingAmount))} tutarındaki fazla ödeme (avans fazlası), ${nextMonth} ayına mahsup edilmek üzere devredilecek. Onaylıyor musunuz?`
                    : `${selectedMonth} ayından kalan ${formatCurrency(remainingAmount)} bakiye ${nextMonth} ayına devredilecek. Onaylıyor musunuz?`,
                onConfirm: async () => {
                    try {
                        const data = {
                            employeeId: parseInt(emp.id),
                            period: 'carryover',
                            baseSalary: 0,
                            bonus: 0,
                            deduction: 0,
                            netSalary: remainingAmount,
                            paymentDate: `${nextMonth}-01`,
                            salaryMonth: nextMonth,
                            status: 'paid',
                            paymentMethod: 'other',
                            notes: remainingAmount < -0.1 
                                ? `${selectedMonth} ayından devreden avans fazlası (kesinti)` 
                                : `${selectedMonth} ayından devreden bakiye`
                        }

                        const res = await window.electronAPI.createSalary(data)
                        if (res.success) {
                            showToast('Bakiye devredildi.', 'success')
                            loadData()
                            setSelectedPayroll(null)
                        } else {
                            showToast(res.error || 'Devir başarısız.', 'error')
                        }
                    } catch (e) {
                        showToast(e.message, 'error')
                    }
                    setConfirmModal({ isOpen: false })
                }
            })
        }
    }

    useEffect(() => {
        loadData()
        const unsub = window.electronAPI.onDbUpdate((change) => {
            if (
                change?.table === 'salaries' ||
                change?.table === 'employee_movements' ||
                change?.table === 'overtimes' ||
                change?.table === 'employees'
            ) {
                loadData()
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    // Process Data for Payroll Table
    useEffect(() => {
        if (!employees.length) {
            setPayrollData([])
            return
        }

        // 1. Filter movements and salaries for selected month
        const monthlyMovements = movements.filter(m => m.date.startsWith(selectedMonth))
        const monthlyOvertimes = overtimes.filter(o => o.date.startsWith(selectedMonth))
        
        const monthlySalaries = salaries.filter(s => {
            if (s.salary_month) {
                return s.salary_month === selectedMonth
            }
            if (!s.payment_date && !s.created_at) return false
            try {
                const d = s.payment_date || s.created_at
                const dStr = typeof d === 'string' ? d : new Date(d).toISOString()
                return dStr.startsWith(selectedMonth)
            } catch (e) {
                return false
            }
        })

        const getNextMonth = (monthStr) => {
            const [year, month] = monthStr.split('-').map(Number)
            const nextDate = new Date(year, month, 1)
            const y = nextDate.getFullYear()
            const m = String(nextDate.getMonth() + 1).padStart(2, '0')
            return `${y}-${m}`
        }
        const nextMonth = getNextMonth(selectedMonth)

        const filteredEmployees = employees.filter(emp => {
            const startMonth = emp.start_date ? new Date(emp.start_date).toISOString().slice(0, 7) : null
            const endMonth = emp.end_date ? new Date(emp.end_date).toISOString().slice(0, 7) : null

            // 1. Skip if before start date
            if (startMonth && selectedMonth < startMonth) {
                return false
            }

            // 2. Skip if after end date
            if (endMonth && selectedMonth > endMonth) {
                return false
            }

            // 3. Skip if passive/archived and no end_date, unless they have records in this month
            if (emp.status !== 'active' && !emp.end_date) {
                const hasMovements = monthlyMovements.some(m => m.employee_id === emp.id)
                const hasOvertimes = monthlyOvertimes.some(o => o.employee_id === emp.id)
                const hasSalaries = monthlySalaries.some(s => s.employee_id === emp.id)
                if (!hasMovements && !hasOvertimes && !hasSalaries) {
                    return false
                }
            }

            return true
        })

        const data = filteredEmployees.map(emp => {
            // Stats buckets
            let advances = 0
            let bonuses = 0
            let expenses = 0
            let payments = 0
            let overtimeAmount = 0
            let overtimeHours = 0
            let items = []

            // Find Salary Movement (Accrual)
            const salaryRecord = monthlyMovements.find(m => m.employee_id === emp.id && m.type === 'salary')

            // Base Salary Logic: Priority to Movement, fallback to Historical Salary
            const baseSalary = salaryRecord ? salaryRecord.amount : getHistoricalBaseSalary(emp, selectedMonth)

            // Helper to add to correct bucket
            let bankPaid = 0
            let cashPaid = 0

            const addToPaidBucket = (amount, method) => {
                const val = parseFloat(amount) || 0
                if (method === 'bank') bankPaid += val
                else cashPaid += val
            }

            // --- 1. Calculate TARGET (Borç) ---
            // Salary + Bonus + Overtime + Carryover

            // Sum Bonuses (Accruals)
            monthlyMovements.filter(m => m.employee_id === emp.id && m.type === 'bonus').forEach(m => {
                bonuses += m.amount
                items.push(m)
                if (m.is_paid) {
                    addToPaidBucket(m.amount, m.payment_method)
                }
            })

            // Sum Overtimes
            monthlyOvertimes.filter(o => o.employee_id === emp.id).forEach(o => {
                overtimeAmount += o.amount
                overtimeHours += o.hours
                items.push({ ...o, type: 'overtime' })
            })

            // Sum Expenses
            monthlyMovements.filter(m => m.employee_id === emp.id && m.type === 'expense').forEach(m => {
                expenses += m.amount
                items.push(m)
                if (m.is_paid) {
                    addToPaidBucket(m.amount, m.payment_method)
                }
            })

            // Carryover (incoming devir from previous month)
            const empSalaries = monthlySalaries.filter(s => s.employee_id === emp.id)
            const carryOverAmount = empSalaries
                .filter(s => s.period === 'carryover' && s.status === 'paid')
                .reduce((sum, s) => sum + (s.net_salary || 0), 0)

            const totalTarget = baseSalary + bonuses + overtimeAmount + expenses + carryOverAmount

            // --- 2. Calculate PAID (Alacak/Ödenen) ---

            // A. 'payment' and 'salary' records
            monthlyMovements.filter(m => m.employee_id === emp.id && (m.type === 'payment' || m.type === 'salary')).forEach(m => {
                payments += m.amount
                addToPaidBucket(m.amount, m.payment_method)
                items.push(m)
            })

            // B. 'advance' records (Avans)
            monthlyMovements.filter(m => m.employee_id === emp.id && m.type === 'advance').forEach(m => {
                advances += m.amount
                addToPaidBucket(m.amount, m.payment_method)
                items.push(m)
            })

            // Carryover outbound (transferred out to the next month)
            const outboundCarryOver = salaries.find(s => s.employee_id === emp.id && s.salary_month === nextMonth && s.period === 'carryover')
            const outboundCarryOverAmount = outboundCarryOver ? (outboundCarryOver.net_salary || 0) : 0

            const totalPaid = bankPaid + cashPaid
            const remaining = totalTarget - totalPaid - outboundCarryOverAmount

            return {
                id: emp.id,
                employee_name: emp.name,
                employee_surname: emp.surname,
                department: emp.department,
                salaryAmount: baseSalary,
                salaryRecord,
                advances,
                bonuses,
                expenses,
                overtime_amount: overtimeAmount,
                overtime_hours: overtimeHours,
                carryOverAmount,
                outboundCarryOverAmount,
                totalTarget,
                remaining,
                isPaid: remaining <= 0.1, // Float tolerance
                bankPaid,
                cashPaid,
                items
            }
        })

        setPayrollData(data)

    }, [employees, movements, overtimes, salaries, selectedMonth])

    // Stats for the selected MONTH
    const stats = {
        totalTarget: payrollData.reduce((acc, curr) => acc + curr.totalTarget, 0),
        totalBaseTarget: payrollData.reduce((acc, curr) => acc + (curr.salaryAmount + curr.bonuses + curr.overtime_amount + curr.expenses), 0),
        totalInboundCarryOver: payrollData.reduce((acc, curr) => acc + curr.carryOverAmount, 0),
        totalOutboundCarryOver: payrollData.reduce((acc, curr) => acc + curr.outboundCarryOverAmount, 0),
        totalPaid: payrollData.reduce((acc, curr) => acc + (curr.bankPaid + curr.cashPaid), 0),
        totalBank: payrollData.reduce((acc, curr) => acc + curr.bankPaid, 0),
        totalCash: payrollData.reduce((acc, curr) => acc + curr.cashPaid, 0),
        totalRemaining: payrollData.reduce((acc, curr) => acc + Math.max(0, curr.remaining), 0),
        totalOverpaid: payrollData.reduce((acc, curr) => acc + (curr.remaining < -0.1 ? Math.abs(curr.remaining) : 0), 0)
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Aylık Maaş Yönetimi</h1>
                    <p className="page-subtitle">Dönemsel maaş takibi, mesai ve ödemeler</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '240px' }}>
                        <MonthFilter
                            value={selectedMonth}
                            onChange={setSelectedMonth}
                        />
                    </div>

                    <button className="btn btn-secondary" onClick={loadData}>
                        Yenile
                    </button>
                </div>
            </div>

            {/* KPI Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-icon primary">
                        <Calculator />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{formatCurrency(stats.totalTarget)}</div>
                        <div className="stat-label">Ödenmesi Gereken</div>
                        {stats.totalInboundCarryOver !== 0 && (
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                                Gelen Devir: {stats.totalInboundCarryOver > 0 ? '+' : ''}{formatCurrency(stats.totalInboundCarryOver)}
                            </div>
                        )}
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon success">
                        <CheckCircle />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(stats.totalPaid)}</div>
                        <div className="stat-label">Toplam Ödenen</div>
                        {stats.totalOutboundCarryOver !== 0 && (
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                                Giden Devir: {formatCurrency(stats.totalOutboundCarryOver)}
                            </div>
                        )}
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon info">
                        <CreditCard />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{formatCurrency(stats.totalBank)}</div>
                        <div className="stat-label">Bankadan Ödenen</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon warning">
                        <Wallet />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{formatCurrency(stats.totalCash)}</div>
                        <div className="stat-label">Elden Ödenen</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon danger">
                        <AlertCircle />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value" style={{ color: stats.totalRemaining > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                            {formatCurrency(stats.totalRemaining)}
                        </div>
                        <div className="stat-label">Kalan Ödeme</div>
                        {stats.totalOverpaid > 0 && (
                            <div style={{ fontSize: '10.5px', color: 'var(--accent-primary)', marginTop: '2px', fontWeight: 600 }}>
                                Fazla Avans: +{formatCurrency(stats.totalOverpaid)}
                            </div>
                        )}
                        {stats.totalOutboundCarryOver !== 0 && (
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                                Aktarılan: {formatCurrency(stats.totalOutboundCarryOver)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {payrollData.length === 0 && !loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <p>Bu ay için personel kaydı bulunamadı.</p>
                </div>
            ) : (
                <DataTable
                    loading={loading}
                    persistenceKey="salaries_table"
                    columns={[
                        { 
                            key: 'employee_name', 
                            label: 'Personel', 
                            searchValue: (r) => `${r.employee_name} ${r.employee_surname}`,
                            render: (_, r) => <span style={{ fontWeight: 600 }}>{r.employee_name} {r.employee_surname}</span> 
                        },
                        { key: 'department', label: 'Departman', render: (v) => v || '-' },
                        {
                            key: 'salaryAmount',
                            label: 'Sabit Maaş',
                            render: (v) => <span style={{ fontWeight: 600 }}>{formatCurrency(v)}</span>
                        },
                        {
                            key: 'overtime_amount',
                            label: 'Mesai',
                            render: (v) => <span style={{ color: 'var(--success)' }}>{v > 0 ? '+' : ''}{formatCurrency(v)}</span>
                        },
                        {
                            key: 'bonuses',
                            label: 'Prim',
                            render: (v) => <span style={{ color: 'var(--success)' }}>{v > 0 ? '+' : ''}{formatCurrency(v)}</span>
                        },
                        {
                            key: 'expenses',
                            label: 'Harcama',
                            render: (v) => <span style={{ color: 'var(--success)' }}>{v > 0 ? '+' : ''}{formatCurrency(v)}</span>
                        },
                        {
                            key: 'carryOverAmount',
                            label: 'Devir',
                            render: (v) => {
                                if (!v) return <span style={{ color: 'var(--text-muted)' }}>-</span>
                                const isNegative = v < 0
                                return <span style={{ fontWeight: 600, color: isNegative ? 'var(--danger)' : 'var(--success)' }}>
                                    {v > 0 ? '+' : ''}{formatCurrency(v)}
                                </span>
                            }
                        },
                        {
                            key: 'outboundCarryOverAmount',
                            label: 'Sonraki Devir',
                            render: (v) => {
                                if (!v) return <span style={{ color: 'var(--text-muted)' }}>-</span>
                                const isNegative = v < 0
                                return <span style={{ fontWeight: 600, color: isNegative ? 'var(--danger)' : 'var(--success)' }}>
                                    {v > 0 ? '+' : ''}{formatCurrency(v)}
                                </span>
                            }
                        },
                        {
                            key: 'totalTarget',
                            label: 'Toplam Tutar',
                            render: (v) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(v)}</span>
                        },
                        {
                            key: 'bankPaid',
                            label: 'Bankadan',
                            render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v > 0 ? formatCurrency(v) : '-'}</span>
                        },
                        {
                            key: 'cashPaid',
                            label: 'Elden',
                            render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v > 0 ? formatCurrency(v) : '-'}</span>
                        },
                        {
                            key: 'remaining',
                            label: 'Kalan',
                            render: (v) => {
                                if (v > 0.1) {
                                    return <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '15px' }}>{formatCurrency(v)}</span>
                                }
                                if (v < -0.1) {
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '14px' }}>
                                                +{formatCurrency(Math.abs(v))}
                                            </span>
                                            <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 600, background: 'var(--accent-subtle)', padding: '1px 5px', borderRadius: '4px', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                                Fazla Avans
                                            </span>
                                        </div>
                                    )
                                }
                                return <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '14px' }}>0,00 ₺</span>
                            }
                        },
                        {
                            key: 'status',
                            label: 'Durum',
                            render: (_, r) => {
                                if (r.outboundCarryOverAmount !== 0) {
                                    return <span className="badge badge-info" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-primary)' }}>Devredildi</span>
                                }
                                if (r.remaining < -0.1) {
                                    return <span className="badge badge-info" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-primary)', fontWeight: 600 }}>Fazla Ödeme</span>
                                }
                                if (Math.abs(r.remaining) <= 0.1) {
                                    return <span className="badge badge-success">Tamamlandı</span>
                                }
                                if (r.bankPaid > 0 || r.cashPaid > 0) {
                                    return <span className="badge badge-warning">Kısmi Ödeme</span>
                                }
                                return <span className="badge badge-danger">Ödenmedi</span>
                            }
                        },
                    ]}
                    data={payrollData}
                    filters={[
                        {
                            key: 'status',
                            label: 'Durum',
                            options: [
                                { value: 'Tamamlandı', label: 'Tamamlandı' },
                                { value: 'Fazla Ödeme', label: 'Fazla Ödeme (Avans)' },
                                { value: 'Kısmi Ödeme', label: 'Kısmi Ödeme' },
                                { value: 'Ödenmedi', label: 'Ödenmedi' },
                                { value: 'Devredildi', label: 'Devredildi' }
                            ],
                            // Custom filter function for the calculated status
                            filterFn: (row, value) => {
                                let statusStr = 'Ödenmedi';
                                if (row.outboundCarryOverAmount !== 0) statusStr = 'Devredildi';
                                else if (row.remaining < -0.1) statusStr = 'Fazla Ödeme';
                                else if (Math.abs(row.remaining) <= 0.1) statusStr = 'Tamamlandı';
                                else if (row.bankPaid > 0 || row.cashPaid > 0) statusStr = 'Kısmi Ödeme';
                                return statusStr === value;
                            }
                        }
                    ]}
                    actions={(r) => (
                        <div className="action-btns">
                            <button
                                className="btn-icon"
                                title="Bordro Detayı"
                                onClick={() => setSelectedPayroll(r)}
                            >
                                <FileText size={16} />
                            </button>
                            {r.remaining > 0 && (
                                <button
                                    className="btn btn-primary btn-sm btn-icon-only" // Add btn-icon-only class if needed or inline style
                                    onClick={() => openPaymentModal(r, r.remaining)}
                                    title="Ödeme Yap"
                                    style={{ padding: '6px' }}
                                >
                                    <Wallet size={16} />
                                </button>
                            )}
                        </div>
                    )}
                />
            )}

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedPayroll}
                onClose={() => setSelectedPayroll(null)}
                title="Maaş Bordrosu Detayı"
                maxWidth="600px"
            >
                {selectedPayroll && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="detail-row">
                            <span className="text-muted">Personel</span>
                            <strong>{selectedPayroll.employee_name} {selectedPayroll.employee_surname}</strong>
                        </div>
                        <div className="detail-row">
                            <span className="text-muted">Dönem</span>
                            <strong>{selectedMonth}</strong>
                        </div>
                        <hr className="divider" />

                        {/* Accruals */}
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>HAKEDİŞLER</div>
                        <div className="detail-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>Temel Maaş:</span>
                            </div>
                            <span>{formatCurrency(selectedPayroll.salaryAmount)}</span>
                        </div>
                        {selectedPayroll.overtime_amount > 0 && (
                            <div className="detail-row success-text">
                                <span>Mesai ({selectedPayroll.overtime_hours} saat):</span>
                                <span>+{formatCurrency(selectedPayroll.overtime_amount)}</span>
                            </div>
                        )}
                        {selectedPayroll.items.filter(i => i.type === 'bonus').map((item, idx) => (
                            <div key={idx} className="detail-row success-text">
                                <span>Prim ({item.description || 'Ek Ödeme'}):</span>
                                <span>+{formatCurrency(item.amount)}</span>
                            </div>
                        ))}
                        {selectedPayroll.items.filter(i => i.type === 'expense').map((item, idx) => (
                            <div key={idx} className="detail-row success-text">
                                <span>Harcama ({item.description || 'Gider Fişi'}):</span>
                                <span>+{formatCurrency(item.amount)}</span>
                            </div>
                        ))}
                        {selectedPayroll.carryOverAmount !== 0 && (
                            <div className={`detail-row ${selectedPayroll.carryOverAmount > 0 ? 'success-text' : 'danger-text'}`}>
                                <span>Devreden Bakiye:</span>
                                <span>{selectedPayroll.carryOverAmount > 0 ? '+' : ''}{formatCurrency(selectedPayroll.carryOverAmount)}</span>
                            </div>
                        )}
                        <div className="detail-row total-row" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '4px' }}>
                            <span>Toplam Hakediş:</span>
                            <span>{formatCurrency(selectedPayroll.totalTarget)}</span>
                        </div>

                        {/* Payments & Advances */}
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', marginTop: '12px' }}>ÖDEME HAREKETLERİ</div>

                        <div className="payments-container">
                            <div className="payments-header">
                                <div style={{ flex: 1 }}>Açıklama</div>
                                <div style={{ width: '90px' }}>Tarih</div>
                                <div style={{ width: '90px', textAlign: 'right' }}>Tutar</div>
                                <div style={{ width: '60px', textAlign: 'center' }}>İşlem</div>
                            </div>

                            <div className="payments-list">
                                {selectedPayroll.items.filter(i => i.type === 'payment' || i.type === 'advance' || i.type === 'salary').length === 0 && (
                                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        Henüz ödeme kaydı yok.
                                    </div>
                                )}
                                {selectedPayroll.items
                                    .filter(i => i.type === 'payment' || i.type === 'advance' || i.type === 'salary')
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                                    .map((item, idx) => (
                                        <div key={idx} className="payment-row">
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                    {item.type === 'advance' ? 'Avans' : (item.type === 'salary' ? 'Maaş Ödemesi' : (item.description || 'Ödeme'))}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    {item.payment_method === 'bank' ? <CreditCard size={10} /> : <Wallet size={10} />}
                                                    <span>{item.payment_method === 'bank' ? 'Banka' : 'Nakit'}</span>
                                                </div>
                                            </div>
                                            <div style={{ width: '90px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                {formatDate(item.date)}
                                            </div>
                                            <div style={{ width: '90px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {formatCurrency(item.amount)}
                                            </div>
                                            <div style={{ width: '60px', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                                <button className="btn-icon-tiny" title="Düzenle" onClick={() => openEditPaymentModal(item, selectedPayroll)}>
                                                    <Edit2 size={13} />
                                                </button>
                                                <button className="btn-icon-tiny danger" title="Sil" onClick={() => handleDeleteMovement(item.id)}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        <style>{`
                            .payments-container {
                                border: 1px solid var(--border-color);
                                border-radius: 8px;
                                overflow: hidden;
                                background: var(--bg-card);
                            }
                            .payments-header {
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                padding: 12px 16px;
                                background: var(--bg-secondary);
                                border-bottom: 1px solid var(--border-color);
                                font-size: 11px;
                                font-weight: 600;
                                color: var(--text-secondary);
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                            }
                            .payments-list {
                                max-height: 250px; 
                                overflow-y: auto;
                            }
                            .payment-row {
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                padding: 12px 16px;
                                border-bottom: 1px solid var(--border-color);
                                transition: background 0.1s;
                            }
                            .payment-row:last-child {
                                border-bottom: none;
                            }
                            .payment-row:hover {
                                background: var(--bg-hover);
                            }
                            .btn-icon-tiny {
                                width: 28px; height: 28px;
                                display: flex; align-items: center; justify-content: center;
                                border: none; background: transparent;
                                color: var(--text-muted); border-radius: 4px;
                                cursor: pointer; transition: all 0.2s;
                            }
                            .btn-icon-tiny:hover { background: var(--bg-tertiary); color: var(--text-primary); }
                            .btn-icon-tiny.danger:hover { background: var(--danger-bg); color: var(--danger); }
                        `}</style>

                        {selectedPayroll.outboundCarryOverAmount !== 0 && (
                            <div className="detail-row warning-text" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '4px' }}>
                                <span>Sonraki Aya Devredilen:</span>
                                <span>{formatCurrency(selectedPayroll.outboundCarryOverAmount)}</span>
                            </div>
                        )}

                        <div className="detail-row total-row" style={{ 
                            marginTop: '12px', 
                            fontSize: '18px', 
                            color: selectedPayroll.remaining > 0.1 ? 'var(--danger)' : selectedPayroll.remaining < -0.1 ? 'var(--accent-primary)' : 'var(--text-primary)' 
                        }}>
                            <span>{selectedPayroll.remaining < -0.1 ? 'Fazla Ödeme (Avans Fazlası):' : 'Kalan Ödeme:'}</span>
                            <span style={{ fontWeight: 700 }}>
                                {selectedPayroll.remaining < -0.1 
                                    ? `+${formatCurrency(Math.abs(selectedPayroll.remaining))}` 
                                    : formatCurrency(selectedPayroll.remaining)}
                            </span>
                        </div>

                        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
                            {(() => {
                                const getNextMonth = (monthStr) => {
                                    const [year, month] = monthStr.split('-').map(Number)
                                    const nextDate = new Date(year, month, 1)
                                    const y = nextDate.getFullYear()
                                    const m = String(nextDate.getMonth() + 1).padStart(2, '0')
                                    return `${y}-${m}`
                                }
                                const nextMonth = getNextMonth(selectedMonth)
                                const hasCarryOver = salaries.some(s => s.employee_id === selectedPayroll.id && s.salary_month === nextMonth && s.period === 'carryover')
                                const remainingBeforeCarry = selectedPayroll.totalTarget - (selectedPayroll.bankPaid + selectedPayroll.cashPaid)
                                
                                return (
                                    <button 
                                        className="btn"
                                        style={{ 
                                            marginRight: 'auto', 
                                            background: hasCarryOver ? 'rgba(239, 68, 68, 0.1)' : 'var(--accent-subtle)', 
                                            color: hasCarryOver ? 'var(--danger)' : 'var(--accent-primary)',
                                            border: `1px solid ${hasCarryOver ? 'var(--danger)' : 'var(--accent-primary)'}`
                                        }}
                                        onClick={() => handleCarryOver(selectedPayroll, remainingBeforeCarry)}
                                    >
                                        {hasCarryOver ? 'Devri İptal Et' : (remainingBeforeCarry < -0.1 ? 'Avans Fazlasını Sonraki Aya Devret' : 'Sonraki Aya Devret')}
                                    </button>
                                )
                            })()}
                            <button className="btn btn-secondary" onClick={() => window.print()}>
                                <Printer size={16} /> Yazdır
                            </button>
                            <button className="btn btn-primary" onClick={() => setSelectedPayroll(null)}>Kapat</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Payment Modal */}
            <Modal
                isOpen={paymentModal.isOpen}
                onClose={() => setPaymentModal({ ...paymentModal, isOpen: false })}
                title={paymentModal.mode === 'edit' ? 'Ödemeyi Düzenle' : 'Ödeme Yap'}
                maxWidth="450px"
            >
                {paymentModal.employee && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-row">
                            <CustomInput
                                label="Ödenecek Tutar"
                                format="currency"
                                required
                                value={paymentModal.amount}
                                onChange={(val) => setPaymentModal({ ...paymentModal, amount: val })}
                                maxLength={14}
                            />
                            <CustomInput
                                label="Tarih"
                                type="date"
                                value={paymentModal.date}
                                onChange={(val) => setPaymentModal({ ...paymentModal, date: val })}
                            />
                        </div>

                        <div className="form-row">
                            <CustomSelect
                                label="Ödeme Türü"
                                value={paymentModal.type}
                                onChange={(val) => {
                                    const isAdvance = val === 'advance'
                                    const defaultAdvance = parseFloat(localStorage.getItem('hr_default_advance_amount')) || 0
                                    const suggested = isAdvance 
                                        ? (defaultAdvance > 0 ? defaultAdvance : '') 
                                        : calculateSuggestedAmount(paymentModal.employee, paymentModal.subType)
                                    setPaymentModal({ 
                                        ...paymentModal, 
                                        type: val,
                                        amount: suggested
                                    })
                                }}
                                options={[
                                    { value: 'payment', label: 'Ödeme Yap' },
                                    { value: 'advance', label: 'Avans Ver' }
                                ]}
                            />
                            {paymentModal.type === 'payment' && (
                                <CustomSelect
                                    label="Detay"
                                    value={paymentModal.subType}
                                    onChange={(val) => {
                                        // Auto-fill amount based on logic
                                        const suggested = calculateSuggestedAmount(paymentModal.employee, val)
                                        setPaymentModal({
                                            ...paymentModal,
                                            subType: val,
                                            amount: suggested > 0 ? suggested : ''
                                        })
                                    }}
                                    options={[
                                        { value: 'Maaş Ödemesi', label: 'Maaş Ödemesi' },
                                        { value: 'Mesai Ödemesi', label: 'Mesai Ödemesi' },
                                        { value: 'Prim Ödemesi', label: 'Prim Ödemesi' },
                                        { value: 'Harcırah Ödemesi', label: 'Harcırah Ödemesi' },
                                        { value: 'Yol Ücreti', label: 'Yol Ücreti' },
                                        { value: 'Yemek Ücreti', label: 'Yemek Ücreti' },
                                        { value: 'Avans Ödemesi', label: 'Avans Ödemesi' },
                                        { value: 'Borç Ödemesi', label: 'Borç Ödemesi' },
                                        { value: 'Devir Bakiyesi', label: 'Devir Bakiyesi' },
                                        { value: 'Diğer Ödeme', label: 'Diğer Ödeme' }
                                    ]}
                                />
                            )}
                        </div>

                        {/* Helper Text for Suggestion */}
                        {paymentModal.type === 'payment' && (
                            <div style={{ 
                                fontSize: '13px', 
                                color: (paymentModal.employee?.remaining || 0) < -0.1 ? 'var(--accent-primary)' : 'var(--danger)', 
                                marginTop: '-8px', 
                                marginBottom: '8px', 
                                textAlign: 'right', 
                                fontWeight: 600 
                            }}>
                                {(paymentModal.employee?.remaining || 0) < -0.1 
                                    ? `Fazla Ödeme (Avans): +${formatCurrency(Math.abs(paymentModal.employee?.remaining || 0))}` 
                                    : `Toplam Kalan Ödeme: ${formatCurrency(paymentModal.employee?.remaining || 0)}`}
                            </div>
                        )}

                        {/* Payment Method Toggle */}
                        <div className="payment-method-toggle">
                            <label className="input-label">Ödeme Yöntemi</label>
                            <div className="toggle-container">
                                <button
                                    className={`toggle-btn ${paymentModal.method === 'nakit' ? 'active' : ''}`}
                                    onClick={() => setPaymentModal({ ...paymentModal, method: 'nakit' })}
                                >
                                    <Wallet size={18} />
                                    <span>Nakit</span>
                                </button>
                                <button
                                    className={`toggle-btn ${paymentModal.method === 'kasa' ? 'active' : ''}`}
                                    onClick={() => setPaymentModal({ ...paymentModal, method: 'kasa' })}
                                >
                                    <Wallet size={18} />
                                    <span>Kasa</span>
                                </button>
                                <button
                                    className={`toggle-btn ${paymentModal.method === 'bank' ? 'active' : ''}`}
                                    onClick={() => setPaymentModal({ ...paymentModal, method: 'bank' })}
                                >
                                    <CreditCard size={18} />
                                    <span>Banka</span>
                                </button>
                            </div>
                        </div>

                        <CustomInput
                            label="Açıklama"
                            value={paymentModal.description}
                            onChange={(val) => setPaymentModal({ ...paymentModal, description: val })}
                            maxLength={250}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => setPaymentModal({ ...paymentModal, isOpen: false })}>İptal</button>
                            <button className="btn btn-primary" onClick={handleConfirmPayment}>
                                <CheckCircle size={16} /> Kaydet
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Salary Amount Modal */}
            <Modal
                isOpen={salaryModal.isOpen}
                onClose={() => setSalaryModal({ ...salaryModal, isOpen: false })}
                title="Maaş Hakedişini Düzenle"
                maxWidth="350px"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Bu işlem, personelin <strong>{selectedMonth}</strong> dönemi için hakediş tutarını güncelleyecektir.
                    </p>
                    <CustomInput
                        label="Hakediş Tutarı"
                        format="currency"
                        required
                        value={salaryModal.amount}
                        onChange={(val) => setSalaryModal({ ...salaryModal, amount: val })}
                        maxLength={14}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={() => setSalaryModal({ ...salaryModal, isOpen: false })}>İptal</button>
                        <button className="btn btn-primary" onClick={handleSaveSalary}>Kaydet</button>
                    </div>
                </div>
            </Modal>

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
            />

            <style>{`
                .btn-icon-tiny {
                    background: transparent; border: none; padding: 4px;
                    color: var(--text-muted); cursor: pointer; border-radius: 4px;
                    display: flex; align-items: center; justify-content: center;
                }
                .btn-icon-tiny:hover { background: var(--bg-hover); color: var(--text-primary); }
                .btn-icon-tiny.danger:hover { background: var(--danger-subtle); color: var(--danger-color); }
                
                .toggle-container {
                    display: flex; gap: 8px; margin-top: 4px;
                }
                .toggle-btn {
                    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
                    padding: 12px; border: 1px solid var(--border-color); border-radius: 8px;
                    background: var(--bg-card); color: var(--text-muted); cursor: pointer;
                    transition: all 0.2s;
                }
                .toggle-btn.active {
                    border-color: var(--accent-primary);
                    background: var(--accent-subtle);
                    color: var(--accent-primary);
                    font-weight: 600;
                }
                .detail-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; padding: 4px 0; }
                .divider { border-color: var(--border-color); margin: 8px 0; opacity: 0.5; }
                .success-text { color: var(--success); }
                .danger-text { color: var(--danger); }
                .warning-text { color: var(--warning); }
                .text-muted { color: var(--text-muted); }
                .total-row { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-top: 4px; }
            `}</style>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #root { display: none; }
                    .print-only-payroll, .print-only-payroll * { visibility: visible; }
                    .print-only-payroll {
                        display: block !important;
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background: white;
                        z-index: 9999;
                        padding: 40px;
                        box-sizing: border-box;
                        font-family: 'Segoe UI', 'Inter', sans-serif;
                        color: black;
                    }
                    .print-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
                    .company-name { font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                    .doc-title { font-size: 18px; font-weight: 600; text-align: right; line-height: 1.4; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
                    .info-item { display: flex; flex-direction: column; gap: 5px; }
                    .info-label { font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
                    .info-value { font-size: 14px; font-weight: 600; color: #000; }
                    .tables-container { display: flex; gap: 40px; margin-bottom: 30px; }
                    .print-table { flex: 1; border-collapse: collapse; width: 100%; }
                    .print-table th { text-align: left; border-bottom: 2px solid #000; padding: 10px 4px; font-size: 12px; text-transform: uppercase; font-weight: 700; }
                    .print-table td { border-bottom: 1px solid #eee; padding: 8px 4px; font-size: 13px; }
                    .amount-col { text-align: right; }
                    .total-section { display: flex; justify-content: flex-end; margin-top: 20px; border-top: 2px solid #000; padding-top: 20px; }
                    .summary-box { width: 300px; }
                    .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
                    .summary-row.final { font-size: 18px; font-weight: 700; border-top: 2px solid #000; padding-top: 15px; margin-top: 10px; }
                    .signatures { margin-top: 80px; display: flex; justify-content: space-between; padding: 0 40px; }
                    .sign-box { width: 200px; text-align: center; }
                    .sign-line { border-top: 1px solid #000; margin-top: 60px; padding-top: 10px; font-size: 13px; }
                    .sign-title { font-weight: 700; margin-bottom: 5px; font-size: 14px; }
                    .legal-text { margin-top: 120px; font-size: 11px; color: #555; text-align: center; font-style: italic; border-top: 1px solid #eee; padding-top: 20px; }
                }
            `}</style>

            {/* Print Layout */}
            {selectedPayroll && (
                <div className="print-only-payroll" style={{ display: 'none' }}>
                    <div className="print-header">
                        <div className="company-name">{currentCompany?.name || 'FİRMA ADI'}</div>
                        <div className="doc-title">
                            MAAŞ BORDROSU<br />
                            <span style={{ fontSize: '14px', fontWeight: 400 }}>{new Date(selectedMonth + '-01').toLocaleDateString('tr-TR', { month: '2-digit', year: 'numeric' }).toLocaleUpperCase('tr-TR')}</span>
                        </div>
                    </div>

                    <div className="info-grid">
                        <div className="info-item">
                            <span className="info-label">Personel</span>
                            <span className="info-value">{selectedPayroll.employee_name} {selectedPayroll.employee_surname}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Bölüm / Görev</span>
                            <span className="info-value">{selectedPayroll.department || '-'}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Dönem</span>
                            <span className="info-value">{new Date(selectedMonth + '-01').toLocaleDateString('tr-TR', { month: '2-digit', year: 'numeric' })}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Düzenleme Tarihi & Saati</span>
                            <span className="info-value">{new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>

                    <div className="tables-container">
                        {/* Earnings */}
                        <div style={{ flex: 1 }}>
                            <h4 style={{ borderBottom: '1px solid #000', paddingBottom: '5px', marginBottom: '10px', fontSize: '14px', margin: '0 0 10px 0' }}>HAKEDİŞLER</h4>
                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th>Açıklama</th>
                                        <th className="amount-col">Tutar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Net Maaş</td>
                                        <td className="amount-col">{formatCurrency(selectedPayroll.salaryRecord ? selectedPayroll.salaryRecord.amount : selectedPayroll.salaryAmount)}</td>
                                    </tr>
                                    {selectedPayroll.overtime_amount > 0 && (
                                        <tr>
                                            <td>Fazla Mesai ({selectedPayroll.overtime_hours} Saat)</td>
                                            <td className="amount-col">{formatCurrency(selectedPayroll.overtime_amount)}</td>
                                        </tr>
                                    )}
                                    {selectedPayroll.bonuses > 0 && (
                                        <tr>
                                            <td>Prim / İkramiye</td>
                                            <td className="amount-col">{formatCurrency(selectedPayroll.bonuses)}</td>
                                        </tr>
                                    )}
                                    {selectedPayroll.expenses > 0 && (
                                        <tr>
                                            <td>Harcama İadesi</td>
                                            <td className="amount-col">{formatCurrency(selectedPayroll.expenses)}</td>
                                        </tr>
                                    )}
                                    {selectedPayroll.carryOverAmount !== 0 && (
                                        <tr>
                                            <td>Devreden Bakiye</td>
                                            <td className="amount-col">{selectedPayroll.carryOverAmount > 0 ? '+' : ''}{formatCurrency(selectedPayroll.carryOverAmount)}</td>
                                        </tr>
                                    )}
                                    <tr style={{ fontWeight: 700, backgroundColor: '#f0f0f0' }}>
                                        <td>TOPLAM HAKEDİŞ</td>
                                        <td className="amount-col">{formatCurrency(selectedPayroll.totalTarget)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Payments */}
                        <div style={{ flex: 1 }}>
                            <h4 style={{ borderBottom: '1px solid #000', paddingBottom: '5px', marginBottom: '10px', fontSize: '14px', margin: '0 0 10px 0' }}>ÖDEMELER / AVANSLAR</h4>
                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th>Açıklama</th>
                                        <th className="amount-col">Tutar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedPayroll.advances > 0 && (
                                        <tr>
                                            <td>Avanslar Toplamı</td>
                                            <td className="amount-col">{formatCurrency(selectedPayroll.advances)}</td>
                                        </tr>
                                    )}
                                    {selectedPayroll.items
                                        .filter(i => (i.type === 'payment' || i.type === 'salary') && !i.is_advance)
                                        .map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{item.type === 'salary' ? 'Maaş Ödemesi' : (item.description || 'Ödeme')}</td>
                                                <td className="amount-col">{formatCurrency(item.amount)}</td>
                                            </tr>
                                        ))}
                                    <tr style={{ fontWeight: 700, backgroundColor: '#f0f0f0' }}>
                                        <td>TOPLAM ÖDENEN</td>
                                        <td className="amount-col">{formatCurrency(selectedPayroll.totalPaid)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="total-section">
                        <div className="summary-box">
                            <div className="summary-row">
                                <span>TOPLAM HAKEDİŞ</span>
                                <span>{formatCurrency(selectedPayroll.totalTarget)}</span>
                            </div>
                            <div className="summary-row">
                                <span>TOPLAM ÖDENEN</span>
                                <span>{formatCurrency(selectedPayroll.totalPaid)}</span>
                            </div>
                            {selectedPayroll.outboundCarryOverAmount !== 0 && (
                                <div className="summary-row">
                                    <span>SONRAKİ AYA DEVREDİLEN</span>
                                    <span>{formatCurrency(selectedPayroll.outboundCarryOverAmount)}</span>
                                </div>
                            )}
                            <div className="summary-row final">
                                <span>{selectedPayroll.remaining < -0.1 ? 'FAZLA ÖDEME (AVANS FAZLASI)' : 'KALAN BAKİYE'}</span>
                                <span>
                                    {selectedPayroll.remaining < -0.1 
                                        ? `+${formatCurrency(Math.abs(selectedPayroll.remaining))}` 
                                        : formatCurrency(selectedPayroll.remaining)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="signatures">
                        <div className="sign-box">
                            <div className="sign-title">TESLİM EDEN (İŞVEREN)</div>
                            <div style={{ fontSize: '14px', marginTop: '5px' }}>{currentCompany?.name}</div>
                            <div className="sign-line">İmza / Kaşe</div>
                        </div>
                        <div className="sign-box">
                            <div className="sign-title">TESLİM ALAN (PERSONEL)</div>
                            <div style={{ fontSize: '14px', marginTop: '5px' }}>{selectedPayroll.employee_name} {selectedPayroll.employee_surname}</div>
                            <div className="sign-line">İmza</div>
                        </div>
                    </div>

                    <div className="legal-text">
                        "İşbu bordroda belirtilen tutarı ve tüm yasal haklarımı eksiksiz olarak teslim aldım. Hesaplamalara itirazım yoktur."
                    </div>
                </div>
            )}
        </div>
    )
}
