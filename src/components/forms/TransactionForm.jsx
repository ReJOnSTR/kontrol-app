import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { transactionSchema } from '../../schemas/transactionSchema'
import CustomInput from '../CustomInput'
import CustomSelect from '../CustomSelect'
import { formatDateForInput } from '../../utils/helpers'

const transactionTypes = [
    { value: 'IN', label: 'Gelir (Giren)' },
    { value: 'OUT', label: 'Gider (Çıkan)' }
]

const transactionMethods = [
    { value: 'CASH', label: 'Nakit' },
    { value: 'BANK', label: 'Banka' },
    { value: 'CHECK', label: 'Çek' }
]

export default function TransactionForm({ initialData, onSubmit, onCancel, loading, hideCheck = false, onlyCheck = false }) {
    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            type: 'IN',
            method: onlyCheck ? 'CHECK' : 'CASH',
            amount: '',
            date: formatDateForInput(new Date()),
            description: '',
            checkNumber: '',
            checkDueDate: '',
            status: 'COMPLETED'
        }
    })

    const selectedMethod = watch('method')

    useEffect(() => {
        if (initialData) {
            reset({
                type: initialData.type || 'IN',
                method: initialData.method || (onlyCheck ? 'CHECK' : 'CASH'),
                amount: initialData.amount || '',
                date: formatDateForInput(initialData.date) || formatDateForInput(new Date()),
                description: initialData.description || '',
                checkNumber: initialData.check_number || initialData.checkNumber || '',
                checkDueDate: formatDateForInput(initialData.check_due_date || initialData.checkDueDate),
                status: initialData.status || 'COMPLETED'
            })
        } else {
            reset({
                type: 'IN',
                method: onlyCheck ? 'CHECK' : 'CASH',
                amount: '',
                date: formatDateForInput(new Date()),
                description: '',
                checkNumber: '',
                checkDueDate: '',
                status: 'COMPLETED'
            })
        }
    }, [initialData, reset, onlyCheck])

    const onFormSubmit = (data) => {
        // Prepare data
        const payload = {
            ...data,
            status: data.method === 'CHECK' ? 'PENDING' : 'COMPLETED' // Çekler varsayılan PENDING olur
        }
        onSubmit(payload)
    }

    return (
        <form onSubmit={handleSubmit(onFormSubmit)}>
            {/* Type Switcher */}
            <Controller
                name="type"
                control={control}
                render={({ field }) => (
                    <div style={{
                        display: 'flex',
                        background: 'var(--bg-secondary)',
                        padding: '4px',
                        borderRadius: '12px',
                        marginBottom: '20px'
                    }}>
                        <button
                            type="button"
                            onClick={() => field.onChange('IN')}
                            style={{
                                flex: 1,
                                padding: '10px 0',
                                borderRadius: '10px',
                                border: 'none',
                                background: field.value === 'IN' ? 'var(--bg-primary)' : 'transparent',
                                color: field.value === 'IN' ? 'var(--success)' : 'var(--text-secondary)',
                                fontWeight: '500',
                                boxShadow: field.value === 'IN' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            Gelir İşlemi
                        </button>
                        <button
                            type="button"
                            onClick={() => field.onChange('OUT')}
                            style={{
                                flex: 1,
                                padding: '10px 0',
                                borderRadius: '10px',
                                border: 'none',
                                background: field.value === 'OUT' ? 'var(--bg-primary)' : 'transparent',
                                color: field.value === 'OUT' ? 'var(--danger)' : 'var(--text-secondary)',
                                fontWeight: '500',
                                boxShadow: field.value === 'OUT' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            Gider İşlemi
                        </button>
                    </div>
                )}
            />
            {errors.type?.message && (
                <div className="input-error-msg" style={{ marginTop: '-15px', marginBottom: '15px' }}>{errors.type.message}</div>
            )}

            <div className="form-row">
                <Controller
                    name="amount"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label="Tutar (₺)"
                            format="currency"
                            required={true}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="0.00"
                            error={errors.amount?.message}
                            maxLength={14}
                        />
                    )}
                />
                <Controller
                    name="date"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label="İşlem Tarihi"
                            type="date"
                            required={true}
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.date?.message}
                        />
                    )}
                />
            </div>

            {!onlyCheck && (
                <div className="form-row">
                    <Controller
                        name="method"
                        control={control}
                        render={({ field }) => {
                            const availableMethods = hideCheck
                                ? transactionMethods.filter(m => m.value !== 'CHECK')
                                : transactionMethods

                            return (
                                <CustomSelect
                                    label="Ödeme Yöntemi"
                                    required={true}
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={availableMethods}
                                    placeholder="Seçiniz"
                                    error={errors.method?.message}
                                />
                            )
                        }}
                    />
                    <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                            <CustomInput
                                label="Açıklama"
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="İşlem detayı vb."
                                error={errors.description?.message}
                                maxLength={250}
                            />
                        )}
                    />
                </div>
            )}

            {(onlyCheck || selectedMethod === 'CHECK') && (
                <div className="form-row">
                    <Controller
                        name="checkNumber"
                        control={control}
                        render={({ field }) => (
                            <CustomInput
                                label="Çek Numarası"
                                value={field.value}
                                onChange={field.onChange}
                                format="uppercase"
                                placeholder="Opsiyonel"
                                error={errors.checkNumber?.message}
                                maxLength={50}
                            />
                        )}
                    />
                    <Controller
                        name="checkDueDate"
                        control={control}
                        render={({ field }) => (
                            <CustomInput
                                label="Vade Tarihi"
                                type="date"
                                required={true}
                                value={field.value}
                                onChange={field.onChange}
                                error={errors.checkDueDate?.message}
                            />
                        )}
                    />
                </div>
            )}

            {onlyCheck && (
                <div className="form-group">
                    <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                            <CustomInput
                                label="Açıklama / Sahibi"
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Çek detayları..."
                                error={errors.description?.message}
                                maxLength={250}
                            />
                        )}
                    />
                </div>
            )}

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onCancel}
                    disabled={loading}
                >
                    İptal
                </button>
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                >
                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
            </div>
        </form>
    )
}
