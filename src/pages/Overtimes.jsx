import TopProgressBar from '../components/TopProgressBar'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import { useTabs } from '../context/TabContext'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import CustomInput from '../components/CustomInput'
import CustomSelect from '../components/CustomSelect'
import MonthFilter from '../components/MonthFilter'
import ConfirmModal from '../components/ConfirmModal'
import CustomMultiSelect from '../components/CustomMultiSelect'
import { formatCurrency, getHistoricalBaseSalary, getHistoricalFullSalary, formatDateForInput } from '../utils/helpers'
import { Clock, Users, User, Building2, Wallet, Banknote, X, Plus, Calendar, Calculator, Trash2, ChevronRight, ChevronLeft, CheckCircle, Pencil, Search, Check } from 'lucide-react'
import { useToast } from '../context/ToastContext'

const paymentMethods = [
    { value: 'nakit', label: 'Nakit' },
    { value: 'kasa', label: 'Kasa' },
    { value: 'bank', label: 'Banka' }
]

const overtimeTypes = [
    { value: 'weekday', label: 'Hafta İçi Mesai' },
    { value: 'sunday', label: 'Pazar Mesaisi' },
    { value: 'holiday', label: 'Bayram Mesaisi' },
    { value: 'gurbet', label: 'Gurbet Mesaisi' }
]

const checkIsSundayRecord = (row) => {
    if (!row) return false;
    const typeStr = (row.type || row.overtime_type || '').toLowerCase();
    const notes = (row.notes || row.description || '').toUpperCase();
    if (typeStr === 'sunday' || typeStr === 'weekend' || notes.includes('[PAZAR]') || notes.includes('[HAFTA SONU]')) {
        return true;
    }
    if (typeStr === 'weekday' || typeStr === 'holiday' || typeStr === 'gurbet' || notes.includes('[BAYRAM]') || notes.includes('[GURBET]')) {
        return false;
    }
    if (row.date) {
        const d = new Date(row.date);
        if (!isNaN(d.getTime())) {
            return d.getDay() === 0;
        }
    }
    return false;
};

export default function Overtimes() {
    const { currentCompany, companySettings } = useCompany()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { openNewTab } = useTabs()
    const { showToast } = useToast()

    const getInitials = (name, surname) => {
        return `${(name || '').charAt(0)}${(surname || '').charAt(0)}`.toUpperCase()
    }
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const saved = localStorage.getItem(`overtimes_selected_month_${currentCompany?.id || 'default'}`)
        return saved || new Date().toISOString().slice(0, 7)
    })
    
    const [viewMode, setViewMode] = useState('entries') // 'entries' or 'summary'
    const [overtimeData, setOvertimeData] = useState([]) // Entries for the table
    const [summaryData, setSummaryData] = useState([]) // Summaries for stats and payments
    const [allEmployees, setAllEmployees] = useState([])
    const [displayData, setDisplayData] = useState([]) 
    const [loading, setLoading] = useState(true)
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    const [selectedRows, setSelectedRows] = useState([])
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        amount: '',
        paymentDate: formatDateForInput(new Date()),
        paymentMethod: 'kasa',
        notes: '',
        useRemaining: true,
        useAsLeave: false
    })

    const [overtimeModalOpen, setOvertimeModalOpen] = useState(false)

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            handleOpenOvertimeModal()
            searchParams.delete('action')
            setSearchParams(searchParams, { replace: true })
        }
    }, [searchParams])
    const [overtimeModalStep, setOvertimeModalStep] = useState(1) // 1: Select, 2: Process Queue
    const [overtimeQueue, setOvertimeQueue] = useState([]) // Array of formData objects
    const [overtimeQueueIndex, setOvertimeQueueIndex] = useState(0)
    
    const [overtimeFormData, setOvertimeFormData] = useState({
        employeeId: '',
        employeeIds: [], // For initial selection
        overtimeType: 'weekday',
        date: formatDateForInput(new Date()),
        hours: '',
        rate: 0,
        amount: '',
        notes: '',
        useAsLeave: false
    })

    const [searchFilter, setSearchFilter] = useState('')
    const [deptFilter, setDeptFilter] = useState('')

    const employeeDepartmentOptions = useMemo(() => {
        const depts = [...new Set(allEmployees.map(item => item.department).filter(Boolean))].sort()
        return depts.map(d => ({ value: d, label: d }))
    }, [allEmployees])

    const filteredEmployeesForSelection = useMemo(() => {
        return allEmployees.filter(emp => {
            const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLocaleLowerCase('tr-TR')
            const search = searchFilter.toLocaleLowerCase('tr-TR')
            const matchesSearch = fullName.includes(search) || (emp.department || '').toLocaleLowerCase('tr-TR').includes(search)
            const matchesDept = !deptFilter || emp.department === deptFilter
            return matchesSearch && matchesDept
        })
    }, [allEmployees, searchFilter, deptFilter])

    const handleSelectEmployee = (empId) => {
        setOvertimeFormData(prev => {
            const isSelected = prev.employeeIds.includes(empId)
            const newIds = isSelected 
                ? prev.employeeIds.filter(id => id !== empId) 
                : [...prev.employeeIds, empId]
            return { ...prev, employeeIds: newIds }
        })
    }

    const handleToggleAllEmployees = () => {
        setOvertimeFormData(prev => {
            const allFilteredIds = filteredEmployeesForSelection.map(e => e.id)
            const allSelected = allFilteredIds.every(id => prev.employeeIds.includes(id))
            
            let newIds
            if (allSelected) {
                newIds = prev.employeeIds.filter(id => !allFilteredIds.includes(id))
            } else {
                const missing = allFilteredIds.filter(id => !prev.employeeIds.includes(id))
                newIds = [...prev.employeeIds, ...missing]
            }
            return { ...prev, employeeIds: newIds }
        })
    }

    // Restore Month Persistence
    useEffect(() => {
        if (currentCompany) {
            const m = localStorage.getItem(`overtimes_selected_month_${currentCompany.id}`)
            if (m) setSelectedMonth(m)
        }
    }, [currentCompany])

    useEffect(() => {
        if (selectedMonth && currentCompany) {
            localStorage.setItem(`overtimes_selected_month_${currentCompany.id}`, selectedMonth)
        }
    }, [selectedMonth, currentCompany])

    const departmentOptions = useMemo(() => {
        const depts = [...new Set(overtimeData.map(item => item.department).filter(Boolean))].sort()
        return depts.map(d => ({ value: d, label: d }))
    }, [overtimeData])

    const displayStats = useMemo(() => {
        // Stats should be based on entries in displayData
        return displayData.reduce((acc, item) => ({
            totalHours: acc.totalHours + (item.hours || 0),
            totalAmount: acc.totalAmount + (item.amount || 0),
            totalPaid: acc.totalPaid + 0, // Paid is harder to track per entry, we'll use summaryData for this
            totalPending: acc.totalPending + 0
        }), { totalHours: 0, totalAmount: 0, totalPaid: 0, totalPending: 0 })
    }, [displayData])

    // Corrected stats to use summaryData for payments
    const totalStats = useMemo(() => {
        return summaryData.reduce((acc, item) => ({
            totalPaid: acc.totalPaid + (item.calc_paid || 0),
            totalPending: acc.totalPending + (item.calc_remaining || 0)
        }), { totalPaid: 0, totalPending: 0 })
    }, [summaryData])

    useEffect(() => {
        if (currentCompany) {
            loadOvertimes()
            loadAllEmployees()
        } else {
            setOvertimeData([])
            setAllEmployees([])
            setDisplayData([])
            setLoading(false)
        }
    }, [currentCompany, selectedMonth])

    // Real-time synchronization listener
    const reloadDataRef = useRef(null)
    useEffect(() => {
        reloadDataRef.current = () => {
            if (currentCompany) {
                loadOvertimes()
                loadAllEmployees()
            }
        }
    })
    useEffect(() => {
        if (!currentCompany) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if (['overtimes', 'employees'].includes(change?.table)) {
                console.log(`[RealTime] Overtimes reloading for change in ${change.table}`)
                reloadDataRef.current?.(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const loadAllEmployees = async () => {
        try {
            const result = await window.electronAPI.getEmployees(currentCompany.id)
            if (result.success) {
                setAllEmployees(result.data)
            }
        } catch (err) {
            console.error('Failed to load employees:', err)
        }
    }

    const loadOvertimes = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            // We use the same payroll summary API as it returns overtimes and salaries for the month
            const result = await window.electronAPI.getPayrollSummary(currentCompany.id, selectedMonth)
            if (result.success && result.data) {
                const flatEntries = []
                const summaries = result.data.map(emp => {
                    const otEntries = (emp.overtimes || [])
                        .filter(o => !(o.notes && o.notes.includes('[İZİN OLARAK KULLANILDI]')));
                    
                    // Add to flat list
                    otEntries.forEach(ot => {
                        flatEntries.push({
                            ...ot,
                            employeeId: emp.id,
                            first_name: emp.first_name,
                            last_name: emp.last_name,
                            department: emp.department,
                            position: emp.position
                        })
                    })

                    let otHours = 0;
                    let otDays = 0;
                    let otHolidays = 0;
                    let otGurbet = 0;
                    const weekdayRate = calcOvertimeRate('weekday', emp);

                    otEntries.forEach(o => {
                        const typeStr = (o.type || o.overtime_type || '').toLowerCase();
                        const isHoliday = (o.notes && o.notes.includes('[BAYRAM]')) || typeStr === 'holiday' || typeStr === 'bayram';
                        const isGurbet = (o.notes && o.notes.includes('[GURBET]')) || typeStr === 'gurbet';
                        if (isHoliday) {
                            otHolidays += (o.hours || 0);
                        } else if (isGurbet) {
                            otGurbet += (o.hours || 0);
                        } else {
                            const isSunday = checkIsSundayRecord(o);
                            if (isSunday) {
                                otDays += (o.hours || 0);
                            } else {
                                otHours += (o.hours || 0);
                            }
                        }
                    });

                    const otAmount = otEntries.reduce((sum, o) => sum + (o.amount || 0), 0);
                    
                    const paidAmount = (emp.salaries || [])
                        .filter(s => s.status === 'paid' && s.period === 'overtime_pay')
                        .reduce((sum, s) => sum + (s.net_salary || 0), 0);
                    
                    const remainingPay = otAmount - paidAmount;

                    return {
                        ...emp,
                        calc_hours: otHours,
                        calc_days: otDays,
                        calc_holidays: otHolidays,
                        calc_gurbet: otGurbet,
                        calc_required: otAmount,
                        calc_paid: paidAmount,
                        calc_remaining: remainingPay
                    };
                }).filter(emp => emp.calc_required > 0 || emp.calc_paid > 0);

                setOvertimeData(flatEntries)
                setSummaryData(summaries)
            }
        } catch (err) {
            console.error('Failed to load overtime summary:', err)
        }
        if (!isBackground) setLoading(false)
    }

    const calcOvertimeRate = (type, employee) => {
        if (!employee) return 0
        // Use full monthly base salary (unprorated) for overtime unit rate calculation
        const activeSalary = getHistoricalFullSalary(employee, selectedMonth)
        if (!activeSalary) return 0
        
        const dailyRate = activeSalary / 30
        const hourlyRate = dailyRate / 10
        
        const hrSettings = companySettings?.hr || {}
        const weekdayMultiplier = hrSettings.weekdayMultiplier !== undefined ? hrSettings.weekdayMultiplier : (parseFloat(localStorage.getItem('hr_overtime_weekday_multiplier')) || 1.5)
        const sundayMultiplier = hrSettings.sundayMultiplier !== undefined ? hrSettings.sundayMultiplier : (parseFloat(localStorage.getItem('hr_overtime_sunday_multiplier')) || 1.5)
        const holidayMultiplier = hrSettings.holidayMultiplier !== undefined ? hrSettings.holidayMultiplier : (parseFloat(localStorage.getItem('hr_overtime_holiday_multiplier')) || 2.0)
        const gurbetMultiplier = hrSettings.gurbetMultiplier !== undefined ? hrSettings.gurbetMultiplier : (parseFloat(localStorage.getItem('hr_overtime_gurbet_multiplier')) || 1.0)
        
        if (type === 'weekday') return Math.round(hourlyRate * weekdayMultiplier * 100) / 100
        if (type === 'sunday') return Math.round(dailyRate * sundayMultiplier * 100) / 100
        if (type === 'holiday') return Math.round(dailyRate * holidayMultiplier * 100) / 100
        if (type === 'gurbet') return Math.round(dailyRate * gurbetMultiplier * 100) / 100
        return 0
    }

    const updateOvertimeField = (key, value) => {
        // If we are in Step 2 (Queue), update the item in the queue
        if (overtimeModalStep === 2 && overtimeQueue.length > 0) {
            setOvertimeQueue(prev => prev.map((item, idx) => {
                if (idx !== overtimeQueueIndex) return item
                
                const newItem = { ...item, [key]: value }
                
                // If type changes, recalculate rate
                if (key === 'overtimeType') {
                    newItem.rate = calcOvertimeRate(value, newItem.employee)
                }

                // Auto-calculate amount
                if (key === 'hours' || key === 'overtimeType' || key === 'rate') {
                    const hours = parseFloat(newItem.hours) || 0
                    const rate = newItem.rate
                    newItem.amount = hours > 0 ? Math.round(hours * rate * 100) / 100 : ''
                }
                return newItem
            }))
            return
        }

        // Otherwise update the main formData (Step 1)
        setOvertimeFormData(prev => {
            const newData = { ...prev, [key]: value }
            
            if (newData.employeeId && (key === 'hours' || key === 'overtimeType' || key === 'rate' || key === 'employeeId')) {
                const hours = parseFloat(newData.hours) || 0
                let rate = newData.rate
                
                if (key === 'overtimeType' || key === 'employeeId') {
                    const empId = newData.employeeId
                    const type = newData.overtimeType
                    const emp = allEmployees.find(e => e.id === parseInt(empId)) || overtimeData.find(e => e.id === parseInt(empId))
                    if (emp) {
                        rate = calcOvertimeRate(type, emp)
                        newData.rate = rate
                    }
                }
                
                if (hours > 0 && rate > 0) {
                    newData.amount = Math.round(hours * rate * 100) / 100
                }
            }
            return newData
        })
    }

    const handleOpenOvertimeModal = (row = null) => {
        setSearchFilter('')
        setDeptFilter('')
        // If row has 'employeeId' but no 'id', it's likely a summary row being used to ADD a new entry for that employee
        // If row has both 'id' and 'employeeId', it's an EXISTING record being EDITED
        const isEditing = row && row.id && row.employeeId
        
        const empId = row ? (isEditing ? row.employeeId : row.id) : (selectedRows.length === 1 ? selectedRows[0] : '')
        const empIds = row ? [] : (selectedRows.length > 1 ? selectedRows : [])
        
        const emp = empId ? (allEmployees.find(e => e.id === empId) || overtimeData.find(e => e.id === empId)) : null
        
        // Determine type for editing
        let overtimeType = 'weekday'
        if (row) {
            const typeStr = (row.type || row.overtime_type || '').toLowerCase();
            const isHoliday = (row.notes && row.notes.includes('[BAYRAM]')) || typeStr === 'holiday' || typeStr === 'bayram';
            const isGurbet = (row.notes && row.notes.includes('[GURBET]')) || typeStr === 'gurbet';
            if (isHoliday) {
                overtimeType = 'holiday'
            } else if (isGurbet) {
                overtimeType = 'gurbet'
            } else if (checkIsSundayRecord(row)) {
                overtimeType = 'sunday'
            }
        }

        const rate = isEditing ? row.rate : (emp ? calcOvertimeRate('weekday', emp) : 0)

        setOvertimeFormData({
            employeeId: empId,
            employeeIds: empIds,
            overtimeType: overtimeType,
            date: isEditing ? formatDateForInput(row.date) : formatDateForInput(new Date()),
            hours: isEditing ? row.hours : '',
            rate: rate,
            amount: isEditing ? row.amount : '',
            notes: isEditing ? (row.notes || '') : '',
            useAsLeave: isEditing ? (row.notes && row.notes.includes('[İZİN OLARAK KULLANILDI]')) : false
        })
        
        setOvertimeQueue([])
        setOvertimeQueueIndex(0)
        setOvertimeModalStep(empId ? 2 : 1)
        
        if (empId) {
            setOvertimeQueue([{
                id: isEditing ? row.id : undefined, // Keep the record ID if editing
                employeeId: empId,
                employee: emp,
                overtimeType: overtimeType,
                date: isEditing ? formatDateForInput(row.date) : formatDateForInput(new Date()),
                hours: isEditing ? row.hours : '',
                rate,
                amount: isEditing ? row.amount : '',
                notes: isEditing ? (row.notes || '') : '',
                useAsLeave: isEditing ? (row.notes && row.notes.includes('[İZİN OLARAK KULLANILDI]')) : false,
                isSaved: false
            }])
        }
        setOvertimeModalOpen(true)
    }

    const startProcessingQueue = () => {
        if (overtimeFormData.employeeIds.length === 0) return
        
        const newQueue = overtimeFormData.employeeIds.map(id => {
            const emp = allEmployees.find(e => e.id === id) || overtimeData.find(e => e.id === id)
            const rate = emp ? calcOvertimeRate('weekday', emp) : 0
            return {
                employeeId: id,
                employee: emp,
                overtimeType: 'weekday',
                date: formatDateForInput(new Date()),
                hours: '',
                rate,
                amount: '',
                notes: '',
                useAsLeave: false,
                isSaved: false
            }
        })
        setOvertimeQueue(newQueue)
        setOvertimeQueueIndex(0)
        setOvertimeModalStep(2)
    }

    const applyToAll = () => {
        const current = overtimeQueue[overtimeQueueIndex]
        setOvertimeQueue(prev => prev.map((item, idx) => {
            if (item.isSaved) return item
            // Recalculate rate and amount for each based on the shared type/hours
            const rate = item.employee ? calcOvertimeRate(current.overtimeType, item.employee) : 0
            const hours = parseFloat(current.hours) || 0
            const amount = Math.round(hours * rate * 100) / 100
            
            return {
                ...item,
                overtimeType: current.overtimeType,
                date: current.date,
                hours: current.hours,
                notes: current.notes,
                useAsLeave: current.useAsLeave,
                rate,
                amount
            }
        }))
    }

    const handleBulkOvertimeSubmit = async (e) => {
        if (e) e.preventDefault()
        setSaving(true)
        try {
            const marker = '[İZİN OLARAK KULLANILDI]'
            
            const targetItems = overtimeQueue.filter(item => !item.isSaved)
            
            for (const item of targetItems) {
                let finalNotes = item.notes || ''
                const leaveMarker = '[İZİN OLARAK KULLANILDI]'
                const holidayMarker = '[BAYRAM]'
                const gurbetMarker = '[GURBET]'
                
                // Ensure markers are in sync
                finalNotes = finalNotes.replace(holidayMarker, '').replace(gurbetMarker, '').trim()
                if (item.overtimeType === 'holiday') {
                    finalNotes = (holidayMarker + ' ' + finalNotes).trim()
                } else if (item.overtimeType === 'gurbet') {
                    finalNotes = (gurbetMarker + ' ' + finalNotes).trim()
                }
                
                if (item.useAsLeave && !finalNotes.includes(leaveMarker)) {
                    finalNotes = (leaveMarker + ' ' + finalNotes).trim()
                } else if (!item.useAsLeave && finalNotes.includes(leaveMarker)) {
                    finalNotes = finalNotes.replace(leaveMarker, '').trim()
                }

                const payload = {
                    employeeId: item.employeeId,
                    date: item.date,
                    hours: parseFloat(item.hours) || 0,
                    rate: item.rate,
                    amount: item.amount,
                    notes: finalNotes || null
                }

                if (item.id) {
                    await window.electronAPI.updateOvertime({ id: item.id, ...payload })
                } else {
                    await window.electronAPI.createOvertime(payload)
                }
            }

            setOvertimeModalOpen(false)
            loadOvertimes()
            setSelectedRows([])
        } catch (error) {
            console.error(error)
            showToast('Mesai kaydedilirken hata oluştu', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleOpenPaymentModal = (row = null) => {
        if (row) {
            setSelectedRows([row.id])
            setFormData({
                amount: row.calc_remaining > 0 ? row.calc_remaining : '',
                paymentDate: formatDateForInput(new Date()),
                paymentMethod: 'kasa',
                notes: '',
                useRemaining: true,
                useAsLeave: false,
                salary_month: selectedMonth
            })
        } else {
            setFormData({
                amount: '',
                paymentDate: formatDateForInput(new Date()),
                paymentMethod: 'kasa',
                notes: '',
                useRemaining: true,
                useAsLeave: false,
                salary_month: selectedMonth
            })
        }
        setModalOpen(true)
    }

    const handlePaymentSubmit = async (e) => {
        e.preventDefault()
        if (selectedRows.length === 0) return
        setSaving(true)
        
        try {
            if (formData.useAsLeave) {
                // ASSIGN AS LEAVE LOGIC
                const marker = '[İZİN OLARAK KULLANILDI]'
                
                for (const id of selectedRows) {
                    // Check if it's a summary ID (employeeId) or entry ID
                    // In bulk payment, selectedRows contains entry IDs now.
                    const entry = overtimeData.find(e => e.id === id)
                    if (!entry) continue

                    let finalNotes = entry.notes || ''
                    if (!finalNotes.includes(marker)) {
                        finalNotes = (marker + ' ' + finalNotes).trim()
                    }
                    
                    await window.electronAPI.updateOvertime({
                        id: entry.id,
                        employeeId: entry.employeeId,
                        date: entry.date,
                        hours: entry.hours,
                        rate: entry.rate,
                        amount: entry.amount,
                        notes: finalNotes || null
                    })
                }
            } else {
                // REGULAR PAYMENT LOGIC
                // We need to group selected entries by employee to make a single payment for each
                const employeeGroups = {}
                selectedRows.forEach(id => {
                    const entry = overtimeData.find(e => e.id === id)
                    if (entry) {
                        if (!employeeGroups[entry.employeeId]) employeeGroups[entry.employeeId] = 0
                        employeeGroups[entry.employeeId] += entry.amount
                    }
                })

                for (const [empId, amount] of Object.entries(employeeGroups)) {
                    const empSummary = summaryData.find(s => s.id === parseInt(empId))
                    if (!empSummary) continue

                    let finalAmount = amount
                    if (formData.useRemaining) {
                        finalAmount = empSummary.calc_remaining
                    }

                    if (finalAmount > 0) {
                        await window.electronAPI.createSalary({
                            employeeId: parseInt(empId),
                            period: 'overtime_pay',
                            baseSalary: 0,
                            bonus: 0,
                            deduction: 0,
                            netSalary: finalAmount,
                            paymentDate: formData.paymentDate,
                            salaryMonth: formData.salary_month || selectedMonth,
                            status: 'paid',
                            paymentMethod: formData.paymentMethod,
                            notes: formData.notes
                        })
                    }
                }
            }
            setModalOpen(false)
            setPaymentModalOpen(false)
            loadOvertimes()
        } catch (err) {
            console.error('Failed to process payment:', err)
            alert('İşlem sırasında bir hata oluştu.')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteConfirm) return
        try {
            const res = await window.electronAPI.deleteOvertime(deleteConfirm)
            if (res.success) {
                setDeleteConfirm(null)
                loadOvertimes()
                showToast('Mesai silindi.', 'success')
            }
        } catch (err) {
            console.error('Failed to delete overtime:', err)
        }
    }

    const handleBulkDelete = async (ids) => {
        if (!ids || ids.length === 0) return
        if (!confirm(`${ids.length} adet mesaiyi silmek istediğinize emin misiniz?`)) return

        setSaving(true)
        try {
            let successCount = 0
            for (const id of ids) {
                const res = await window.electronAPI.deleteOvertime(id)
                if (res.success) successCount++
            }
            if (successCount > 0) {
                loadOvertimes()
                showToast(`${successCount} mesai kaydı silindi.`, 'success')
            }
        } catch (err) {
            console.error('Bulk delete failed:', err)
        }
        setSaving(false)
    }

    const columns = useMemo(() => [
        {
            key: 'date',
            label: 'Tarih',
            render: (val) => val ? new Date(val).toLocaleDateString('tr-TR') : '-',
            width: '100px'
        },
        {
            key: 'name',
            label: 'Ad Soyad',
            width: '200px',
            searchValue: (row) => `${row.first_name} ${row.last_name}`,
            render: (_, row) => (
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                    {row.first_name} {row.last_name}
                </span>
            )
        },
        {
            key: 'rate',
            label: 'Tür',
            width: '100px',
            render: (v, row) => {
                const isHoliday = row.notes && row.notes.includes('[BAYRAM]')
                if (isHoliday) {
                    return (
                        <span style={{ 
                            fontSize: '11px', 
                            fontWeight: '600', 
                            color: 'var(--warning)',
                            textTransform: 'uppercase'
                        }}>
                            Bayram
                        </span>
                    )
                }
                const isGurbet = row.notes && row.notes.includes('[GURBET]')
                if (isGurbet) {
                    return (
                        <span style={{ 
                            fontSize: '11px', 
                            fontWeight: '600', 
                            color: 'var(--success)',
                            textTransform: 'uppercase'
                        }}>
                            Gurbet
                        </span>
                    )
                }
                const isSunday = checkIsSundayRecord(row)
                return (
                    <span style={{ 
                        fontSize: '11px', 
                        fontWeight: '600', 
                        color: isSunday ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        textTransform: 'uppercase'
                    }}>
                        {isSunday ? 'Pazar' : 'Hafta İçi'}
                    </span>
                )
            }
        },
        {
            key: 'department',
            label: 'Departman',
            width: '150px',
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
            key: 'hours',
            label: 'Süre',
            width: '120px',
            render: (value, row) => {
                const typeStr = (row.type || row.overtime_type || '').toLowerCase();
                const isHoliday = (row.notes && row.notes.includes('[BAYRAM]')) || typeStr === 'holiday' || typeStr === 'bayram';
                const isGurbet = (row.notes && row.notes.includes('[GURBET]')) || typeStr === 'gurbet';
                const isSunday = !isHoliday && !isGurbet && checkIsSundayRecord(row);
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            {value || 0} {isSunday || isHoliday || isGurbet ? 'Gün' : 'Saat'}
                        </span>
                    </div>
                )
            }
        },
        {
            key: 'amount',
            label: 'Hakediş',
            width: '120px',
            render: (value) => (
                <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
                    {formatCurrency(value || 0)}
                </span>
            )
        },
        {
            key: 'notes',
            label: 'Notlar',
            width: '200px',
            render: (val) => val ? (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '200px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={val}>
                    {val}
                </span>
            ) : <span style={{ color: 'var(--text-muted)' }}>-</span>
        },
        {
            key: 'calc_paid',
            label: 'Ödenen (Ay)',
            width: '120px',
            render: (_, row) => {
                const summary = summaryData.find(s => s.id === row.employeeId)
                return (
                    <span style={{ fontWeight: '600', color: 'var(--success)' }}>
                        {formatCurrency(summary?.calc_paid || 0)}
                    </span>
                )
            }
        },
        {
            key: 'calc_remaining',
            label: 'Kalan (Ay)',
            width: '120px',
            render: (_, row) => {
                const summary = summaryData.find(s => s.id === row.employeeId)
                const value = summary?.calc_remaining || 0
                return (
                    <span style={{ 
                        fontWeight: '700', 
                        color: value > 0 ? 'var(--danger)' : (value < 0 ? 'var(--info)' : 'var(--success)'), 
                        fontSize: '14px' 
                    }}>
                        {formatCurrency(value)}
                    </span>
                )
            }
        },
        {
            key: 'status',
            label: 'Durum',
            width: '150px',
            render: (_, row) => {
                const summary = summaryData.find(s => s.id === row.employeeId)
                const val = summary?.calc_remaining || 0
                if (row.notes && row.notes.includes('[İZİN OLARAK KULLANILDI]')) return <span className="badge badge-info">İzin Olarak Atandı</span>
                if (val > 0) return <span className="badge badge-danger">Ödeme Bekliyor</span>
                if (val < 0) return <span className="badge badge-info">Fazla Ödeme</span>
                return <span className="badge badge-success">Tamamlandı</span>
            }
        }
    ], [allEmployees, summaryData, selectedMonth])

    const summaryColumns = useMemo(() => [
        {
            key: 'name',
            label: 'Ad Soyad',
            width: '250px',
            searchValue: (row) => `${row.first_name} ${row.last_name}`,
            render: (_, row) => (
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                    {row.first_name} {row.last_name}
                </span>
            )
        },
        {
            key: 'calc_hours',
            label: 'Toplam Süre',
            width: '180px',
            render: (_, row) => (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    {row.calc_hours > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontWeight: '600' }}>{Math.round(row.calc_hours * 100) / 100} Saat</span>
                        </div>
                    )}
                    {row.calc_days > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                            <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>{Math.round(row.calc_days * 100) / 100} Pazar</span>
                        </div>
                    )}
                    {row.calc_holidays > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={14} style={{ color: 'var(--warning)' }} />
                            <span style={{ fontWeight: '600', color: 'var(--warning)' }}>{Math.round(row.calc_holidays * 100) / 100} Bayram</span>
                        </div>
                    )}
                    {row.calc_gurbet > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={14} style={{ color: 'var(--success)' }} />
                            <span style={{ fontWeight: '600', color: 'var(--success)' }}>{Math.round(row.calc_gurbet * 100) / 100} Gurbet</span>
                        </div>
                    )}
                    {(row.calc_hours === 0 && row.calc_days === 0 && row.calc_holidays === 0 && row.calc_gurbet === 0) && (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                    )}
                </div>
            )
        },
        {
            key: 'calc_required',
            label: 'Hak Edilen',
            width: '150px',
            render: (val) => (
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(val)}</span>
            )
        },
        {
            key: 'calc_paid',
            label: 'Ödenen',
            width: '150px',
            render: (val) => (
                <span style={{ fontWeight: '600', color: 'var(--success)' }}>{formatCurrency(val)}</span>
            )
        },
        {
            key: 'calc_remaining',
            label: 'Kalan Ödeme',
            width: '150px',
            render: (val) => (
                <span style={{ 
                    fontWeight: '800', 
                    color: val > 0 ? 'var(--danger)' : 'var(--success)',
                    fontSize: '14px'
                }}>
                    {formatCurrency(val)}
                </span>
            )
        },
        {
            key: 'status_summary',
            label: 'Durum',
            width: '150px',
            render: (_, row) => {
                const val = row.calc_remaining || 0
                if (val > 0) return <span className="badge badge-danger">Ödeme Bekliyor</span>
                if (val < 0) return <span className="badge badge-info">Fazla Ödeme</span>
                return <span className="badge badge-success">Tamamlandı</span>
            }
        }
    ], [])

    const StatCard = ({ title, value, icon: Icon, color, bgColor, isDanger }) => (
        <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            border: `1px solid var(--border-color)`
        }}>
            <div style={{
                backgroundColor: isDanger ? 'var(--danger-bg)' : (bgColor || 'var(--accent-subtle)'),
                color: isDanger ? 'var(--danger)' : color,
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                <Icon size={22} />
            </div>
            <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
                    {title}
                </div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: isDanger ? 'var(--danger)' : 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                    {value}
                </div>
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
                    Mesai tablosunu görüntülemek için lütfen bir şirket seçin.
                </p>
            </div>
        )
    }

    return (
        <div>
            <TopProgressBar loading={loading} />
            <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">Mesai Tablosu</h1>
                    <p style={{ marginTop: '5px', color: 'var(--text-secondary)' }}>Personellerin aylık mesai saatleri ve ödemeleri.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="btn btn-primary" onClick={() => handleOpenOvertimeModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} /> Mesai Ekle
                    </button>
                    <div style={{ width: '240px' }}>
                        <MonthFilter 
                            value={selectedMonth} 
                            onChange={setSelectedMonth} 
                        />
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ 
                display: 'flex', 
                gap: '8px', 
                marginBottom: '20px', 
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '2px'
            }}>
                <button 
                    onClick={() => setViewMode('entries')}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 600,
                        backgroundColor: 'transparent',
                        color: viewMode === 'entries' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        border: 'none',
                        borderBottom: viewMode === 'entries' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                        borderRadius: 0,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} /> Bireysel Kayıtlar
                    </div>
                </button>
                <button 
                    onClick={() => setViewMode('summary')}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 600,
                        backgroundColor: 'transparent',
                        color: viewMode === 'summary' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        border: 'none',
                        borderBottom: viewMode === 'summary' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                        borderRadius: 0,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={16} /> Personel Özeti
                    </div>
                </button>
            </div>

            {/* Top Summaries */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '25px' }}>
                <StatCard 
                    title="Toplam Mesai Saati" 
                    value={`${displayStats.totalHours} Saat`} 
                    icon={Clock} 
                    color="var(--accent-primary)" 
                    bgColor="var(--accent-subtle)"
                />
                <StatCard 
                    title="Toplam Mesai Ücreti" 
                    value={formatCurrency(displayStats.totalAmount)} 
                    icon={Calculator} 
                    color="var(--info)" 
                    bgColor="var(--info-bg)"
                />
                <StatCard 
                    title="Ödenen Mesai" 
                    value={formatCurrency(totalStats.totalPaid)} 
                    icon={Wallet} 
                    color="var(--success)" 
                    bgColor="var(--success-bg)"
                />
                <StatCard 
                    title="Kalan Mesai Ödemesi" 
                    value={formatCurrency(totalStats.totalPending)} 
                    icon={Banknote} 
                    color="var(--warning)" 
                    bgColor="var(--warning-bg)"
                    isDanger={totalStats.totalPending > 0} 
                />
            </div>

            {/* Data Table */}
            {viewMode === 'entries' ? (
                <DataTable 
                    persistenceKey="overtimes_table_v2"
                    columns={columns}
                    data={overtimeData}
                    onBulkDelete={handleBulkDelete}
                    onFilteredDataChange={setDisplayData}
                    actions={(row) => (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => handleOpenOvertimeModal(row)} title="Düzenle">
                                <Pencil size={16} />
                            </button>
                            <button className="danger" onClick={() => setDeleteConfirm(row.id)} title="Sil">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                    filters={[
                        {
                            key: 'department',
                            label: 'Departman',
                            options: departmentOptions
                        }
                    ]}
                />
            ) : (
                <DataTable 
                    persistenceKey="overtimes_summary_table"
                    columns={summaryColumns}
                    data={summaryData}
                    showCheckboxes={false}
                    actions={(row) => (
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                                className="btn-icon" 
                                title="Ödeme Yap" 
                                onClick={() => handleOpenPaymentModal(row)}
                                disabled={row.calc_remaining <= 0}
                            >
                                <Banknote size={16} />
                            </button>
                            <button 
                                className="btn-icon" 
                                title="Personel Detayı" 
                                onClick={() => navigate(`/employees/${row.id}`)}
                            >
                                <User size={16} />
                            </button>
                        </div>
                    )}
                />
            )}

            {/* Payment Modal */}
            <Modal 
                isOpen={modalOpen} 
                onClose={() => setModalOpen(false)} 
                title={selectedRows.length > 1 ? `Toplu Mesai Ödemesi (${selectedRows.length} Personel)` : 'Mesai Ödemesi Yap'}
            >
                <form onSubmit={handlePaymentSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* Assign as Leave Toggle Card */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px',
                            background: formData.useAsLeave ? 'var(--info-bg)' : 'var(--bg-tertiary)',
                            border: `1px solid ${formData.useAsLeave ? 'var(--info)' : 'var(--border-color)'}`,
                            borderRadius: 'var(--radius-sm)', transition: 'all 0.2s ease', cursor: 'pointer',
                            boxShadow: formData.useAsLeave ? '0 4px 12px rgba(14, 165, 233, 0.1)' : 'none'
                        }} onClick={() => setFormData({ ...formData, useAsLeave: !formData.useAsLeave })}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px', 
                                backgroundColor: formData.useAsLeave ? 'var(--info)' : 'var(--bg-secondary)',
                                color: formData.useAsLeave ? '#fff' : 'var(--text-muted)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                            }}>
                                <Calendar size={20} />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: formData.useAsLeave ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                    Mesaiyi İzin Olarak Ata
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {formData.useAsLeave 
                                        ? 'Bu ayki mesailer hakedişten düşülerek izin bakiyesine eklenecek.' 
                                        : 'Mesai hakedişi nakit ödeme olarak kaydedilecek.'}
                                </span>
                            </div>
                            <label className="toggle-switch" style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={formData.useAsLeave} onChange={(e) => setFormData({ ...formData, useAsLeave: e.target.checked })} />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {!formData.useAsLeave ? (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

                                    <CustomInput
                                        label="Tutar (₺) *"
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        max={999999999}
                                        maxLength={14}
                                        value={formData.amount}
                                        onChange={(val) => setFormData({ ...formData, amount: val })}
                                        required={!formData.useRemaining}
                                        disabled={formData.useRemaining}
                                        placeholder={formData.useRemaining ? "Bakiyeler otomatik hesaplanacak" : "Tutar girin..."}
                                    />
                                </div>

                                {/* Otomatik Bakiye Toggle Card */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 14px',
                                    background: formData.useRemaining ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                    border: `1px solid ${formData.useRemaining ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    borderRadius: 'var(--radius-sm)', transition: 'background 0.15s ease, border-color 0.15s ease', cursor: 'pointer'
                                }} onClick={() => setFormData({ ...formData, useRemaining: !formData.useRemaining, amount: !formData.useRemaining ? '' : formData.amount })}>
                                    <label className="toggle-switch" style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={formData.useRemaining} onChange={(e) => setFormData({ ...formData, useRemaining: e.target.checked, amount: e.target.checked ? '' : formData.amount })} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bakiye Eşitleme</span>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: formData.useRemaining ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                            {formData.useRemaining ? 'Personel Mesai Bakiyesini Sıfırla' : 'Sabit Tutar Ödemesi Yap'}
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ 
                                padding: '16px', borderRadius: '12px', border: '1px dashed var(--info)', 
                                backgroundColor: 'var(--info-bg-subtle)', color: 'var(--text-secondary)',
                                fontSize: '13px', lineHeight: '1.6'
                            }}>
                                <strong>Bilgi:</strong> Seçilen personellerin <strong>{selectedMonth}</strong> dönemine ait tüm aktif mesaileri "İzin Olarak Kullanıldı" şeklinde işaretlenecektir. Bu işlem mesai hakedişini sıfırlar ve personelin izin bakiyesinde kullanılabilir süre oluşturur.
                            </div>
                        )}

                        <div>
                            <CustomInput
                                label="Notlar"
                                type="textarea"
                                rows={2}
                                value={formData.notes}
                                onChange={(val) => setFormData({ ...formData, notes: val })}
                                placeholder={formData.useAsLeave ? "İzin ataması için ek not..." : "Mesai ödemesi açıklaması..."}
                                maxLength={300}
                            />
                        </div>
                    </div>

                    <div className="modal-actions" style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>İptal</button>
                        <button type="submit" className={`btn btn-${formData.useAsLeave ? 'info' : 'primary'}`} disabled={saving}>
                            {saving ? 'Kaydediliyor...' : (formData.useAsLeave ? 'İzin Olarak Kaydet' : 'Ödemeyi Kaydet')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Overtime Modal with Stepper and Queue */}
            <Modal 
                isOpen={overtimeModalOpen} 
                onClose={() => setOvertimeModalOpen(false)} 
                title={overtimeFormData.employeeId ? 'Mesai Ekle' : `Toplu Mesai Ekle`}
                size="medium"
            >
                <div style={{ overflow: 'hidden', position: 'relative' }}>
                    {/* Stepper Header */}
                    {!overtimeFormData.employeeId && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: overtimeModalStep === 1 ? 1 : 0.6, transition: 'opacity 0.2s' }}>
                                    <span style={{ 
                                        fontSize: '11px', 
                                        fontWeight: 700, 
                                        background: overtimeModalStep === 1 ? 'var(--accent-primary)' : 'var(--success)', 
                                        color: '#fff', 
                                        width: '20px', 
                                        height: '20px', 
                                        borderRadius: '50%', 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center' 
                                    }}>
                                        {overtimeModalStep > 1 ? '✓' : '1'}
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: overtimeModalStep === 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}>Personel Seçimi</span>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: overtimeModalStep === 2 ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                                    <span style={{ 
                                        fontSize: '11px', 
                                        fontWeight: 700, 
                                        background: overtimeModalStep === 2 ? 'var(--accent-primary)' : 'var(--bg-tertiary)', 
                                        color: overtimeModalStep === 2 ? '#fff' : 'var(--text-secondary)', 
                                        width: '20px', 
                                        height: '20px', 
                                        borderRadius: '50%', 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        border: overtimeModalStep === 2 ? 'none' : '1px solid var(--border-color)'
                                    }}>
                                        2
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: overtimeModalStep === 2 ? 'var(--text-primary)' : 'var(--text-muted)' }}>Mesai Girişi</span>
                                </div>
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '8px', 
                                padding: '0 4px',
                                opacity: overtimeModalStep === 2 ? 1 : 0,
                                visibility: overtimeModalStep === 2 ? 'visible' : 'hidden',
                                transition: 'all 0.3s ease',
                                height: '28px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>İşlem Sırası: {overtimeQueueIndex + 1} / {Math.max(overtimeQueue.length, 1)}</span>
                                    <span style={{ color: 'var(--accent-primary)' }}>%{Math.round(((overtimeQueueIndex + 1) / Math.max(overtimeQueue.length, 1)) * 100)}</span>
                                </div>
                                <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'var(--accent-primary)', width: `${((overtimeQueueIndex + 1) / Math.max(overtimeQueue.length, 1)) * 100}%`, transition: 'width 0.3s' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ 
                        display: 'flex', 
                        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: overtimeModalStep === 1 ? 'translateX(0)' : 'translateX(-100%)',
                        height: '480px'
                    }}>
                        {/* Step 1: Selection */}
                        <div style={{ minWidth: '100%', padding: '2px', height: '100%' }}>
                            <form onSubmit={(e) => { e.preventDefault(); startProcessingQueue(); }} style={{ height: '100%' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px', alignItems: 'center' }}>
                                        <div className="search-box" style={{ height: '36px', minWidth: 'auto', boxSizing: 'border-box' }}>
                                            <Search size={16} />
                                            <input 
                                                type="text"
                                                placeholder="İsim veya departman ara..."
                                                value={searchFilter}
                                                onChange={(e) => setSearchFilter(e.target.value)}
                                                style={{ height: '100%', padding: 0 }}
                                            />
                                            {searchFilter && (
                                                <button type="button" className="search-clear" onClick={() => setSearchFilter('')} style={{ display: 'flex', alignItems: 'center' }}>
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <CustomSelect 
                                            value={deptFilter}
                                            options={[
                                                { value: '', label: 'Tüm Departmanlar' },
                                                ...employeeDepartmentOptions
                                            ]}
                                            onChange={setDeptFilter}
                                            floatingLabel={false}
                                            style={{ marginBottom: 0 }}
                                        />
                                    </div>

                                    <div 
                                        className="employee-select-list" 
                                        style={{ 
                                            position: 'relative', 
                                            width: '100%', 
                                            border: '1px solid var(--border-color)', 
                                            borderRadius: 'var(--radius-md)', 
                                            height: '220px', 
                                            overflowY: 'auto', 
                                            background: 'var(--bg-secondary)', 
                                            boxShadow: 'none',
                                            flexShrink: 0
                                        }}
                                    >
                                        <div style={{ 
                                            padding: '10px 14px', 
                                            borderBottom: '1px solid var(--border-color)', 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            fontSize: '13px',
                                            position: 'sticky',
                                            top: 0,
                                            zIndex: 2
                                        }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Personel Listesi ({filteredEmployeesForSelection.length})</span>
                                            <button 
                                                type="button" 
                                                onClick={handleToggleAllEmployees}
                                                style={{ 
                                                    background: 'none', 
                                                    border: 'none', 
                                                    color: 'var(--accent-primary)', 
                                                    fontWeight: 600, 
                                                    fontSize: '12px', 
                                                    cursor: 'pointer' 
                                                }}
                                            >
                                                {overtimeFormData.employeeIds.length === filteredEmployeesForSelection.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {filteredEmployeesForSelection.map(emp => {
                                                const isChecked = overtimeFormData.employeeIds.includes(emp.id)
                                                return (
                                                    <div 
                                                        key={emp.id}
                                                        className={`custom-select-option ${isChecked ? 'selected' : ''}`}
                                                        onClick={() => handleSelectEmployee(emp.id)}
                                                        style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '12px', 
                                                            padding: '10px 14px', 
                                                            borderBottom: '1px solid var(--border-color)',
                                                            justifyContent: 'flex-start',
                                                            borderRadius: 0
                                                        }}
                                                    >
                                                        <div 
                                                            className={`checkbox ${isChecked ? 'checked' : ''}`}
                                                            style={{ flexShrink: 0 }}
                                                        >
                                                            {isChecked && <Check size={12} style={{ color: '#fff' }} />}
                                                        </div>
                                                        
                                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                                                                {emp.first_name} {emp.last_name}
                                                            </span>
                                                            {emp.department && (
                                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                                    {emp.department}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {filteredEmployeesForSelection.length === 0 && (
                                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                                    Personel bulunamadı
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Selection Stats */}
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '12px',
                                        padding: '12px 16px', 
                                        borderRadius: 'var(--radius-md)', 
                                        background: 'var(--accent-subtle)', 
                                        border: '1px solid rgba(20, 184, 166, 0.2)',
                                    }}>
                                        <Users size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                {overtimeFormData.employeeIds.length > 0 
                                                    ? `${overtimeFormData.employeeIds.length} personel seçildi.` 
                                                    : 'Lütfen mesai eklemek istediğiniz personelleri seçin.'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="modal-actions" style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px' }}>
                                        <button type="button" className="btn btn-secondary" onClick={() => setOvertimeModalOpen(false)}>Vazgeç</button>
                                        <button type="submit" className="btn btn-primary" disabled={overtimeFormData.employeeIds.length === 0} style={{ padding: '0 25px', gap: '10px' }}>
                                            İşleme Başla <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Step 2: Individual Processing Queue */}
                        <div style={{ minWidth: '100%', padding: '2px', height: '100%' }}>
                            {overtimeQueue.length > 0 && (
                                <form onSubmit={handleBulkOvertimeSubmit} style={{ height: '100%' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
                                        {/* Navigation and Current Employee Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                <div style={{ 
                                                    width: '40px', 
                                                    height: '40px', 
                                                    borderRadius: 'var(--radius-sm)', 
                                                    background: 'var(--accent-subtle)', 
                                                    color: 'var(--accent-primary)', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    fontWeight: 700,
                                                    fontSize: '13px',
                                                    flexShrink: 0,
                                                    border: '1px solid rgba(20, 184, 166, 0.2)'
                                                }}>
                                                    {getInitials(overtimeQueue[overtimeQueueIndex].employee?.first_name, overtimeQueue[overtimeQueueIndex].employee?.last_name)}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>İşlenen Personel</span>
                                                        {overtimeQueue[overtimeQueueIndex].employee?.department && (
                                                            <span style={{ 
                                                                fontSize: '10px', 
                                                                fontWeight: 600, 
                                                                color: 'var(--text-secondary)', 
                                                                background: 'var(--bg-tertiary)', 
                                                                padding: '2px 6px', 
                                                                borderRadius: 'var(--radius-xs)', 
                                                                border: '1px solid var(--border-color)' 
                                                            }}>{overtimeQueue[overtimeQueueIndex].employee.department}</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {overtimeQueue[overtimeQueueIndex].employee?.first_name} {overtimeQueue[overtimeQueueIndex].employee?.last_name}
                                                    </div>
                                                </div>
                                            </div>

                                            {!overtimeFormData.employeeId && (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button 
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        disabled={overtimeQueueIndex === 0} 
                                                        onClick={() => setOvertimeQueueIndex(prev => prev - 1)}
                                                        style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <ChevronLeft size={20} />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        disabled={overtimeQueueIndex === overtimeQueue.length - 1} 
                                                        onClick={() => setOvertimeQueueIndex(prev => prev + 1)}
                                                        style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <ChevronRight size={20} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Standard Inputs */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                            <CustomSelect 
                                                label="Mesai Türü *" 
                                                value={overtimeQueue[overtimeQueueIndex].overtimeType} 
                                                options={overtimeTypes} 
                                                onChange={(val) => updateOvertimeField('overtimeType', val)} 
                                            />
                                            <CustomInput 
                                                label="Tarih *" 
                                                type="date" 
                                                value={overtimeQueue[overtimeQueueIndex].date} 
                                                onChange={(val) => updateOvertimeField('date', val)} 
                                                required 
                                            />
                                            <CustomInput 
                                                label={overtimeQueue[overtimeQueueIndex].overtimeType === 'weekday' ? 'Süre (Saat) *' : 'Süre (Gün) *'} 
                                                type="number" 
                                                value={overtimeQueue[overtimeQueueIndex].hours} 
                                                onChange={(val) => updateOvertimeField('hours', val)} 
                                                step="0.5" 
                                                min={0} 
                                                max={24}
                                                required 
                                            />
                                        </div>

                                        {/* Payment style toggle & earnings */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                                            {/* Toggle Card */}
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 14px',
                                                background: overtimeQueue[overtimeQueueIndex].useAsLeave ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                                border: `1px solid ${overtimeQueue[overtimeQueueIndex].useAsLeave ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                                borderRadius: 'var(--radius-sm)', transition: 'background 0.15s ease, border-color 0.15s ease', cursor: 'pointer'
                                            }} onClick={() => updateOvertimeField('useAsLeave', !overtimeQueue[overtimeQueueIndex].useAsLeave)}>
                                                <label className="toggle-switch" style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                                    <input type="checkbox" checked={overtimeQueue[overtimeQueueIndex].useAsLeave} onChange={(e) => updateOvertimeField('useAsLeave', e.target.checked)} />
                                                    <span className="toggle-slider"></span>
                                                </label>
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ödeme Şekli</span>
                                                    <span style={{ fontSize: '14px', fontWeight: 600, color: overtimeQueue[overtimeQueueIndex].useAsLeave ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                        {overtimeQueue[overtimeQueueIndex].useAsLeave ? 'İzin Olarak' : 'Nakit Hakediş'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Hakediş Editable Input */}
                                            <div style={{ 
                                                padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)',
                                                border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center'
                                            }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Hakediş Tutar (TL)</span>
                                                {overtimeQueue[overtimeQueueIndex].useAsLeave ? (
                                                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)' }}>İzin Hakedişi</span>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        maxLength={12}
                                                        value={overtimeQueue[overtimeQueueIndex].amount ?? ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(',', '.')
                                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                updateOvertimeField('amount', val)
                                                            }
                                                        }}
                                                        placeholder="0.00"
                                                        style={{
                                                            fontSize: '15px',
                                                            fontWeight: 700,
                                                            color: 'var(--accent-primary)',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            borderBottom: '1.5px dashed var(--accent-primary)',
                                                            outline: 'none',
                                                            width: '100%',
                                                            padding: '2px 0'
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <CustomInput 
                                                label="Notlar" 
                                                type="textarea" 
                                                value={overtimeQueue[overtimeQueueIndex].notes} 
                                                onChange={(val) => updateOvertimeField('notes', val)} 
                                                rows={1} 
                                                placeholder="Opsiyonel not..."
                                                maxLength={300}
                                            />
                                        </div>

                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            paddingTop: '15px',
                                            marginTop: 'auto',
                                            borderTop: '1px solid var(--border-color)' 
                                        }}>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                {!overtimeFormData.employeeId && (
                                                    <button type="button" className="btn btn-secondary" onClick={() => setOvertimeModalStep(1)}>
                                                        Değiştir
                                                    </button>
                                                )}
                                                {overtimeQueue.length > 1 && (
                                                    <button 
                                                        type="button" 
                                                        className="btn btn-ghost" 
                                                        style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '13px' }}
                                                        onClick={applyToAll}
                                                        title="Bu değerleri henüz kaydedilmemiş tüm personellere uygula"
                                                    >
                                                        Tümüne Uygula
                                                    </button>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button type="button" className="btn btn-secondary" onClick={() => setOvertimeModalOpen(false)}>Vazgeç</button>
                                                <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0 30px' }}>
                                                    {saving ? 'Kaydediliyor...' : 'Tümünü Kaydet'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
            {/* Delete Confirmation */}
            <ConfirmModal 
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={handleDelete}
                title="Mesai Kaydını Sil"
                message="Bu mesai kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
                confirmText="Sil"
            />
        </div>
    )
}
