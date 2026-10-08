import { z } from 'zod';

export const salarySchema = z.object({
    employee_id: z.coerce.number().positive('Personel seçimi zorunludur'),
    period: z.enum([
        'salary',
        'overtime_pay',
        'advance',
        'bonus',
        'expense',
        'travel',
        'food',
        'carryover',
        'loan_payment',
        'other'
    ], { required_error: 'Ödeme türü seçilmelidir' }),
    net_salary: z.coerce.number({ invalid_type_error: 'Geçerli bir tutar giriniz' })
        .positive('Tutar 0 dan büyük olmalıdır')
        .max(10000000, 'Tutar en fazla 10.000.000 olabilir'),
    payment_date: z.string().min(1, 'Ödeme tarihi seçilmelidir').optional().or(z.literal('')),
    salary_month: z.string().regex(/^\d{4}-\d{2}$/, 'Maaş dönemi YYYY-AA formatında olmalıdır').optional().or(z.literal('')),
    status: z.enum(['paid', 'pending', 'cancelled']).default('paid'),
    payment_method: z.enum(['cash', 'bank', 'check', 'salary_deduction']).default('cash'),
    notes: z.string().max(500, 'Notlar en fazla 500 karakter olabilir').optional().or(z.literal(''))
});
