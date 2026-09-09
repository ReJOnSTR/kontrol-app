import { z } from 'zod';

export const workHeaderSchema = z.object({
    title: z.string().min(1, 'İş başlığı zorunludur').max(100, 'İş başlığı en fazla 100 karakter olabilir'),
    customerId: z.union([z.string(), z.number()]).optional().nullable().transform((val) => (val === '' ? null : Number(val))),
    customer: z.string().max(100, 'Müşteri adı en fazla 100 karakter olabilir').optional(),
    description: z.string().max(500, 'Açıklama en fazla 500 karakter olabilir').optional(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    location: z.string().max(200, 'Konum en fazla 200 karakter olabilir').optional(),
    work_start_time: z.string().optional().default('08:00'),
    work_end_time: z.string().optional().default('17:00'),
    disable_overtime: z.boolean().optional().default(false),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
    pazar_multiplier: z.union([z.string(), z.number()]).optional().default(1.5).transform((val) => {
        const num = Number(val) || 1.5;
        return Math.min(Math.max(num, 0), 10);
    }),
    mesai_multiplier: z.union([z.string(), z.number()]).optional().default(1.5).transform((val) => {
        const num = Number(val) || 1.5;
        return Math.min(Math.max(num, 0), 10);
    })
});

export const workItemSchema = z.object({
    date: z.string().min(1, 'Tarih zorunludur'),
    receiptNo: z.union([z.string(), z.number()]).optional().transform(val => val ? String(val).slice(0, 20) : ''),
    vehicleId: z.union([z.string(), z.number()]).optional().nullable().transform((val) => {
        if (val === '' || val === null || val === undefined) return null;
        const num = Number(val);
        return isNaN(num) ? val : num;
    }),
    employeeId: z.union([z.string(), z.number()]).optional().nullable().transform((val) => {
        if (val === '' || val === null || val === undefined) return null;
        const num = Number(val);
        return isNaN(num) ? val : num;
    }),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    hours: z.union([z.string(), z.number()]).optional().transform((val) => Math.min(Math.max(Number(val) || 0, 0), 24)),
    overtimeHours: z.union([z.string(), z.number()]).optional().transform((val) => Math.min(Math.max(Number(val) || 0, 0), 24)),
    unitPrice: z.union([z.string(), z.number()]).optional().transform((val) => Math.min(Math.max(Number(val) || 0, 0), 999999999)),
    description: z.string().max(250, 'Açıklama en fazla 250 karakter olabilir').optional()
});

