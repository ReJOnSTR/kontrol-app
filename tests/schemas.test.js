import { describe, it, expect } from 'vitest';
import { employeeSchema, salarySchema, leaveSchema, overtimeSchema } from '../src/schemas';

describe('Zod Schema Validations', () => {
    describe('employeeSchema', () => {
        it('validates a valid employee object', () => {
            const valid = {
                first_name: 'Ahmet',
                last_name: 'Kaya',
                email: 'ahmet@example.com',
                salary: 45000,
                status: 'active'
            };
            const result = employeeSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });

        it('rejects employee with short name or invalid email', () => {
            const invalid = {
                first_name: 'A',
                last_name: 'K',
                email: 'not-an-email'
            };
            const result = employeeSchema.safeParse(invalid);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.length).toBeGreaterThan(0);
            }
        });
    });

    describe('salarySchema', () => {
        it('validates correct salary & advance transactions', () => {
            const advance = {
                employee_id: 1,
                period: 'advance',
                net_salary: 5000,
                salary_month: '2026-10',
                status: 'paid'
            };
            const result = salarySchema.safeParse(advance);
            expect(result.success).toBe(true);
        });

        it('rejects salary with negative or zero amount', () => {
            const invalid = {
                employee_id: 1,
                period: 'salary',
                net_salary: 0
            };
            const result = salarySchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });
    });

    describe('leaveSchema', () => {
        it('validates approved leave duration', () => {
            const validLeave = {
                employee_id: 5,
                type: 'annual',
                start_date: '2026-10-10',
                end_date: '2026-10-15',
                days: 5,
                status: 'approved'
            };
            const result = leaveSchema.safeParse(validLeave);
            expect(result.success).toBe(true);
        });

        it('rejects leave when end_date is before start_date', () => {
            const invalidLeave = {
                employee_id: 5,
                type: 'annual',
                start_date: '2026-10-15',
                end_date: '2026-10-10',
                days: 5
            };
            const result = leaveSchema.safeParse(invalidLeave);
            expect(result.success).toBe(false);
        });
    });

    describe('overtimeSchema', () => {
        it('validates overtime entry with hour and rate', () => {
            const validOt = {
                employee_id: 12,
                date: '2026-10-05',
                hours: 4,
                rate: 1.5,
                amount: 750
            };
            const result = overtimeSchema.safeParse(validOt);
            expect(result.success).toBe(true);
        });

        it('rejects overtime exceeding 24 hours in a single entry', () => {
            const invalidOt = {
                employee_id: 12,
                date: '2026-10-05',
                hours: 30
            };
            const result = overtimeSchema.safeParse(invalidOt);
            expect(result.success).toBe(false);
        });
    });
});
