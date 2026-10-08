import { z } from 'zod';

export const employeeSchema = z.object({
    first_name: z.string().min(2, 'Ad en az 2 karakter olmalıdır').max(50, 'Ad en fazla 50 karakter olabilir'),
    last_name: z.string().min(2, 'Soyad en az 2 karakter olmalıdır').max(50, 'Soyad en fazla 50 karakter olabilir'),
    tc_no: z.string().regex(/^[0-9]{11}$/, 'T.C. Kimlik No 11 haneli olmalıdır').optional().or(z.literal('')),
    phone: z.string().max(25, 'Telefon en fazla 25 karakter olabilir').optional().or(z.literal('')),
    email: z.string().email('Geçerli bir e-posta adresi giriniz').optional().or(z.literal('')),
    position: z.string().max(80, 'Pozisyon en fazla 80 karakter olabilir').optional().or(z.literal('')),
    department: z.string().max(80, 'Departman en fazla 80 karakter olabilir').optional().or(z.literal('')),
    start_date: z.string().min(1, 'İşe başlama tarihi seçilmelidir').optional().or(z.literal('')),
    end_date: z.string().optional().or(z.literal('')),
    salary: z.coerce.number({ invalid_type_error: 'Geçerli bir maaş tutarı giriniz' })
        .min(0, 'Maaş 0 dan küçük olamaz')
        .max(10000000, 'Maaş en fazla 10.000.000 olabilir')
        .default(0),
    status: z.enum(['active', 'inactive', 'on_leave', 'terminated']).default('active'),
    iban: z.string().max(34, 'IBAN en fazla 34 karakter olabilir').optional().or(z.literal('')),
    notes: z.string().max(1000, 'Notlar en fazla 1000 karakter olabilir').optional().or(z.literal(''))
});
