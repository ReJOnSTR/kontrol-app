import { getHistoricalBaseSalary } from './helpers'

/**
 * Unified Single Source of Truth for Payroll & Salary Calculations
 */

export const SALARY_ALLOWED_PERIODS = [
    'salary',
    'overtime_pay',
    'advance',
    'bonus',
    'expense',
    'travel',
    'food',
    'other',
    'carryover',
    'loan_payment'
]

/**
 * Check if a salary record belongs to the target month
 */
export function isSalaryInMonth(record, targetMonth) {
    if (!record || !targetMonth) return false
    if (record.period && !SALARY_ALLOWED_PERIODS.includes(record.period) && record.period !== 'loan') {
        return false
    }
    if (record.salary_month) {
        return record.salary_month === targetMonth
    }
    if (!record.payment_date && !record.created_at) return false
    try {
        const d = record.payment_date || record.created_at
        const dStr = typeof d === 'string' ? d : new Date(d).toISOString()
        return dStr.startsWith(targetMonth)
    } catch (e) {
        return false
    }
}

/**
 * Calculate full month financial metrics for a single employee
 * 
 * @param {Object} employee - Employee object with base salary & salary history
 * @param {Array} salaries - All salary/payment records for this employee
 * @param {Array} overtimes - All overtime records for this employee
 * @param {string} targetMonth - 'YYYY-MM' format
 * @param {number} outboundCarryover - Optional carryover to next month
 */
export function calculateEmployeeMonthlyPayroll(employee, salaries = [], overtimes = [], targetMonth, outboundCarryover = 0) {
    if (!targetMonth) {
        targetMonth = new Date().toISOString().slice(0, 7)
    }

    // 1. Filter monthly salary records
    const monthlySalaries = (salaries || []).filter(s => isSalaryInMonth(s, targetMonth))

    // 2. Filter monthly active overtimes (excluding those converted to leave)
    const monthlyOvertimes = (overtimes || []).filter(o => {
        if (!o || !o.date) return false
        const dStr = typeof o.date === 'string' ? o.date : new Date(o.date).toISOString()
        if (!dStr.startsWith(targetMonth)) return false
        if (o.notes && o.notes.includes('[İZİN OLARAK KULLANILDI]')) return false
        if (o.is_converted_to_leave) return false
        return true
    })

    // 3. Base Historical Salary & Overtime Targets
    const baseSalaryTarget = getHistoricalBaseSalary(employee, targetMonth) || 0
    const totalOtTarget = monthlyOvertimes.reduce((sum, o) => sum + (o.amount ?? o.total_amount ?? 0), 0)

    // 4. Incoming Carryover from previous month
    const incomingCarryover = monthlySalaries
        .filter(s => s.period === 'carryover' && s.status === 'paid')
        .reduce((sum, s) => sum + (s.net_salary || 0), 0)

    // 5. Extra Earnings Targets (Bonus, Expense/Harcırah, Travel, Food, Other)
    const totalBonusTarget = monthlySalaries.filter(s => s.period === 'bonus').reduce((sum, s) => sum + (s.net_salary || 0), 0)
    const totalExpenseTarget = monthlySalaries.filter(s => s.period === 'expense' || s.period === 'travel' || s.period === 'food').reduce((sum, s) => sum + (s.net_salary || 0), 0)
    const totalOtherTarget = monthlySalaries.filter(s => s.period === 'other').reduce((sum, s) => sum + (s.net_salary || 0), 0)
    const extraEarningsTarget = totalBonusTarget + totalExpenseTarget + totalOtherTarget

    // 6. Net Target (Total Payable / Hak Edilen Toplam Tutar)
    const netTarget = baseSalaryTarget + totalOtTarget + incomingCarryover + extraEarningsTarget

    // 7. Paid Breakdowns
    const paidSalary = monthlySalaries.filter(s => s.status === 'paid' && s.period === 'salary').reduce((sum, s) => sum + (s.net_salary || 0), 0)
    const paidOt = monthlySalaries.filter(s => s.status === 'paid' && s.period === 'overtime_pay').reduce((sum, s) => sum + (s.net_salary || 0), 0)
    const paidAdvance = monthlySalaries.filter(s => s.status === 'paid' && s.period === 'advance').reduce((sum, s) => sum + (s.net_salary || 0), 0)
    const paidBonus = monthlySalaries.filter(s => s.status === 'paid' && s.period === 'bonus').reduce((sum, s) => sum + (s.net_salary || 0), 0)
    const paidExpense = monthlySalaries.filter(s => s.status === 'paid' && (s.period === 'expense' || s.period === 'travel' || s.period === 'food')).reduce((sum, s) => sum + (s.net_salary || 0), 0)
    const paidOther = monthlySalaries.filter(s => s.status === 'paid' && s.period === 'other').reduce((sum, s) => sum + (s.net_salary || 0), 0)
    const paidLoanDeduction = monthlySalaries.filter(s => s.status === 'paid' && s.period === 'loan_payment' && s.payment_method === 'salary_deduction').reduce((sum, s) => sum + (s.net_salary || 0), 0)

    const totalPaid = paidSalary + paidOt + paidAdvance + paidBonus + paidExpense + paidOther + paidLoanDeduction

    // 8. Net Remaining Balance (Kalan Bakiye & Fazla Ödeme)
    const rawRemaining = netTarget - totalPaid - outboundCarryover
    const netRemaining = Math.max(0, rawRemaining)
    const isOverpaid = rawRemaining < -0.1
    const overpaidAmount = isOverpaid ? Math.abs(rawRemaining) : 0

    // 9. Payment Metadata & Progress
    const paidRecords = monthlySalaries.filter(s => s.status === 'paid' && (s.payment_date || s.created_at))
    const lastPaidDate = paidRecords.length > 0
        ? new Date(Math.max(...paidRecords.map(r => new Date(r.payment_date || r.created_at))))
        : null

    const pendingCount = monthlySalaries.filter(s => s.status === 'pending').length
    const progress = netTarget > 0 ? Math.min(100, Math.round((totalPaid / netTarget) * 100)) : 0

    // 10. Active Loan / Debt Cycle Calculation
    const sortedLoans = (salaries || [])
        .filter(s => s.status === 'paid' && (s.period === 'loan' || s.period === 'loan_payment'))
        .sort((a, b) => new Date(a.payment_date || a.created_at) - new Date(b.payment_date || b.created_at))

    let activeLoanTaken = 0
    let activeLoanPaid = 0

    for (const s of sortedLoans) {
        if (s.period === 'loan') {
            activeLoanTaken += (s.net_salary || 0)
        } else if (s.period === 'loan_payment') {
            activeLoanPaid += (s.net_salary || 0)
        }
        if (activeLoanTaken > 0 && (activeLoanTaken - activeLoanPaid) <= 0) {
            activeLoanTaken = 0
            activeLoanPaid = 0
        }
    }

    const activeRemainingLoan = activeLoanTaken - activeLoanPaid
    const hasLoanHistory = sortedLoans.length > 0

    return {
        monthlySalaries,
        monthlyOvertimes,
        baseSalaryTarget,
        totalOtTarget,
        incomingCarryover,
        totalBonusTarget,
        totalExpenseTarget,
        totalOtherTarget,
        extraEarningsTarget,
        netTarget,
        paidSalary,
        paidOt,
        paidAdvance,
        paidBonus,
        paidExpense,
        paidOther,
        paidLoanDeduction,
        totalPaid,
        netRemaining,
        rawRemaining,
        isOverpaid,
        overpaidAmount,
        lastPaidDate,
        pendingCount,
        progress,
        activeRemainingLoan,
        hasLoanHistory
    }
}
