import { describe, it, expect } from 'vitest'
import { isSalaryInMonth, calculateEmployeeMonthlyPayroll, SALARY_ALLOWED_PERIODS } from '../src/utils/payrollCalculator'

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
})
