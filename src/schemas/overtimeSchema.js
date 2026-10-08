import { z } from 'zod';

export const overtimeSchema = z.object({
    employee_id: z.coerce.number().positive('Personel seçimi zorunludur'),
    date: z.string().min(1, 'Mesai tarihi seçilmelidir'),
    hours: z.coerce.number({ invalid_type_error: 'Geçerli bir saat giriniz' })
        .positive('Mesai saati 0 dan büyük olmalıdır')
        .max(24, 'Mesai saati bir gün için en fazla 24 olabilir'),
    rate: z.coerce.number().min(1, 'Mesai katsayısı en az 1 olabilir').max(5, 'Mesai katsayısı en fazla 5 olabilir').default(1.5),
    amount: z.coerce.number().min(0, 'Tutar 0 dan küçük olamaz').optional().default(0),
    notes: z.string().max(500, 'Notlar en fazla 500 karakter olabilir').optional().or(z.literal(''))
});
