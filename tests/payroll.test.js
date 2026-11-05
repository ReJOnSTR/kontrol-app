import { describe, it, expect } from 'vitest'
import { isSalaryInMonth, calculateEmployeeMonthlyPayroll, calculateEmployeeMonthlyOvertime, SALARY_ALLOWED_PERIODS } from '../src/utils/payrollCalculator'
import { getHistoricalBaseSalary } from '../src/utils/helpers'

describe('Payroll Calculator & Financial Logic', () => {
    it('should validate allowed salary periods', () => {
        expect(SALARY_ALLOWED_PERIODS).toContain('salary')
        expect(SALARY_ALLOWED_PERIODS).toContain('advance')
        expect(SALARY_ALLOWED_PERIODS).toContain('bonus')
        expect(SALARY_ALLOWED_PERIODS).toContain('loan_payment')
    })

    it('should correctly determine if a salary record belongs to target month', () => {
        const recordExplicitMonth = { salary_month: '2026-10', period: 'salary' }
        expect(isSalaryInMonth(recordExplicitMonth, '2026-10')).toBe(true)
        expect(isSalaryInMonth(recordExplicitMonth, '2026-09')).toBe(false)

        const recordByPaymentDate = { payment_date: '2026-10-15', period: 'advance' }
        expect(isSalaryInMonth(recordByPaymentDate, '2026-10')).toBe(true)
        expect(isSalaryInMonth(recordByPaymentDate, '2026-11')).toBe(false)
    })

    it('should calculate net balance accurately for basic salary, advances and overtime', () => {
        const employee = {
            id: 1,
            first_name: 'Ahmet',
            last_name: 'Yılmaz',
            salary: 30000,
            base_salary: 30000
        }

        const salaries = [
            { id: 1, period: 'salary', net_salary: 30000, salary_month: '2026-10', status: 'paid' },
            { id: 2, period: 'advance', net_salary: 5000, salary_month: '2026-10', status: 'paid' },
            { id: 3, period: 'bonus', net_salary: 2000, salary_month: '2026-10', status: 'paid' }
        ]

        const overtimes = [
            { id: 10, hours: 10, total_amount: 1500, date: '2026-10-05', is_converted_to_leave: 0 }
        ]

        const result = calculateEmployeeMonthlyPayroll(employee, salaries, overtimes, '2026-10')

        expect(result.baseSalaryTarget).toBe(30000)
        expect(result.paidAdvance).toBe(5000)
        expect(result.paidBonus).toBe(2000)
        expect(result.totalOtTarget).toBe(1500)
        expect(result.paidSalary).toBe(30000)
    })

    it('should ignore overtimes converted to leave in financial calculations', () => {
        const employee = { id: 2, salary: 20000, base_salary: 20000 }
        const overtimes = [
            { id: 1, hours: 8, total_amount: 1000, date: '2026-10-01', is_converted_to_leave: 1 }
        ]
        const result = calculateEmployeeMonthlyPayroll(employee, [], overtimes, '2026-10')
        expect(result.totalOtTarget).toBe(0)
    })

    it('should calculate monthly overtime breakdown and balance accurately', () => {
        const employee = { id: 1, first_name: 'Mehmet', last_name: 'Demir' }
        const overtimes = [
            { id: 1, date: '2026-10-02', type: 'weekday', hours: 5, amount: 500 },
            { id: 2, date: '2026-10-04', type: 'sunday', hours: 1, amount: 800 },
            { id: 3, date: '2026-10-29', type: 'holiday', hours: 1, amount: 1000, notes: '[BAYRAM]' },
            { id: 4, date: '2026-10-10', type: 'weekday', hours: 4, amount: 400, notes: '[İZİN OLARAK KULLANILDI]' },
            { id: 5, date: '2026-11-01', type: 'weekday', hours: 3, amount: 300 } // Different month
        ]
        const salaries = [
            { id: 10, period: 'overtime_pay', net_salary: 1300, salary_month: '2026-10', status: 'paid' }
        ]

        const result = calculateEmployeeMonthlyOvertime(employee, salaries, overtimes, '2026-10')
        expect(result.entriesCount).toBe(3)
        expect(result.weekdayHours).toBe(5)
        expect(result.sundayDays).toBe(1)
        expect(result.holidayDays).toBe(1)
        expect(result.totalAmount).toBe(2300)
        expect(result.totalPaid).toBe(1300)
        expect(result.remainingAmount).toBe(1000)
    })

    it('should correctly calculate full month salary and prorated mid-month hire salary', () => {
        // Full month employee in a 31-day month (October)
        const fullEmployee = {
            id: 100,
            salary: 60000,
            start_date: '2025-01-01'
        }
        expect(getHistoricalBaseSalary(fullEmployee, '2026-10')).toBe(60000)
        expect(getHistoricalBaseSalary(fullEmployee, '2026-11')).toBe(60000)

        // Mid-month hire on 23rd October (9 calendar days: 23-31 October)
        const midMonthEmployee = {
            id: 156,
            salary: 27085.50,
            start_date: '2026-10-23'
        }
        // Daily rate = 27085.50 / 30 = 902.85; 9 days = 8125.65
        expect(getHistoricalBaseSalary(midMonthEmployee, '2026-10')).toBe(8125.65)
        // Next month (November, full month)
        expect(getHistoricalBaseSalary(midMonthEmployee, '2026-11')).toBe(27085.50)

        // Mid-month exit on 15th October (15 calendar days: 1-15 October)
        const exitingEmployee = {
            id: 157,
            salary: 60000,
            start_date: '2025-01-01',
            end_date: '2026-10-15'
        }
        expect(getHistoricalBaseSalary(exitingEmployee, '2026-10')).toBe(30000)
    })
})
