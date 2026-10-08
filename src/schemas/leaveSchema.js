import { z } from 'zod';

export const leaveSchema = z.object({
    employee_id: z.coerce.number().positive('Personel seçimi zorunludur'),
    type: z.string().min(1, 'İzin tipi seçilmelidir').default('annual'),
    start_date: z.string().min(1, 'Başlangıç tarihi seçilmelidir'),
    end_date: z.string().min(1, 'Bitiş tarihi seçilmelidir'),
    days: z.coerce.number().min(0.5, 'İzin süresi en az 0.5 gün olmalıdır').max(365, 'İzin süresi en fazla 365 gün olabilir'),
    hours: z.coerce.number().min(0).max(24).optional().nullable(),
    status: z.enum(['pending', 'approved', 'rejected']).default('approved'),
    notes: z.string().max(500, 'Notlar en fazla 500 karakter olabilir').optional().or(z.literal(''))
}).refine(data => {
    if (data.start_date && data.end_date) {
        return new Date(data.end_date) >= new Date(data.start_date);
    }
    return true;
}, {
    message: 'Bitiş tarihi başlangıç tarihinden önce olamaz',
    path: ['end_date']
});
