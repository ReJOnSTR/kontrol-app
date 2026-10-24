import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { inspectionSchema } from '../../schemas/inspectionSchema'
import CustomInput from '../CustomInput'
import CustomSelect from '../CustomSelect'
import { formatDateForInput } from '../../utils/helpers'
import { AlertCircle } from 'lucide-react'
import FileAttachmentInput from '../FileAttachmentInput'

export default function InspectionForm({ initialData, onSubmit, onCancel, vehicles, type = 'traffic', loading, error }) {
    const {
        control,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(inspectionSchema),
        defaultValues: {
            vehicleId: '',
            inspectionDate: formatDateForInput(new Date()),
            nextInspection: '',
            result: '',
            cost: '',
            notes: '',
            filePath: null
        }
    })

    const inspectionDate = watch('inspectionDate')

    useEffect(() => {
        if (initialData) {
            reset({
                vehicleId: initialData.vehicle_id || initialData.vehicleId || '',
                inspectionDate: formatDateForInput(initialData.inspection_date || initialData.inspectionDate) || formatDateForInput(new Date()),
                nextInspection: formatDateForInput(initialData.next_inspection || initialData.nextInspection) || '',
                result: initialData.result || '',
                cost: initialData.cost || '',
                notes: initialData.notes || '',
                filePath: initialData.file_path || initialData.filePath || null
            })
        } else {
            reset({
                vehicleId: '',
                inspectionDate: formatDateForInput(new Date()),
                nextInspection: '',
                result: '',
                cost: '',
                notes: '',
                filePath: null
            })
        }

        if (vehicles && vehicles.length === 1 && !initialData) {
            setValue('vehicleId', vehicles[0].id)
        }
    }, [initialData, reset, vehicles, setValue])

    // Auto-calculate next inspection date (+1 year) when inspection date changes
    useEffect(() => {
        if (inspectionDate) {
            setValue('nextInspection', formatDateForInput(new Date(inspectionDate).setFullYear(new Date(inspectionDate).getFullYear() + 1)))
        }
    }, [inspectionDate, setValue])

    const onFormSubmit = (data) => {
        onSubmit(data)
    }

    const resultOptions = type === 'traffic'
        ? [
            { value: 'passed', label: 'Geçti' },
            { value: 'failed', label: 'Kaldı' },
            { value: 'conditional', label: 'Şartlı Geçti' }
        ]
        : [
            { value: 'passed', label: 'Uygundur' },
            { value: 'failed', label: 'Uygun Değildir' },
            { value: 'conditional', label: 'Eksikler Var' }
        ]

    const labelDate = type === 'traffic' ? 'Muayene Tarihi' : 'Kontrol Tarihi'
    const labelNextDate = type === 'traffic' ? 'Sonraki Muayene' : 'Sonraki Kontrol'

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            {error && (
                <div style={{
                    padding: '12px 16px',
                    background: 'var(--danger-bg)',
                    color: 'var(--danger)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    marginBottom: '16px',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    lineHeight: '1.4'
                }}>
                    <AlertCircle size={20} className="flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="form-row">
                <Controller
                    name="vehicleId"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Araç"
                            required={true}
                            className="form-select-custom"
                            value={field.value}
                            onChange={field.onChange}
                            options={vehicles.map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` }))}
                            placeholder="Araç seçin"
                            error={errors.vehicleId?.message}
                            disabled={vehicles.length === 1}
                        />
                    )}
                />
                <Controller
                    name="result"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Sonuç"
                            className="form-select-custom"
                            value={field.value}
                            onChange={field.onChange}
                            options={resultOptions}
                            placeholder="Sonuç Seçin"
                            error={errors.result?.message}
                        />
                    )}
                />
            </div>

            <div className="form-row">
                <Controller
                    name="inspectionDate"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label={labelDate}
                            type="date"
                            required={true}
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.inspectionDate?.message}
                        />
                    )}
                />
                <Controller
                    name="nextInspection"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label={labelNextDate}
                            type="date"
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.nextInspection?.message}
                        />
                    )}
                />
            </div>

            <div className="form-group">
                <Controller
                    name="cost"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label="Maliyet (₺)"
                            format="currency"
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="0.00"
                            error={errors.cost?.message}
                            maxLength={12}
                        />
                    )}
                />
            </div>

            <div className="form-group">
                <Controller
                    name="notes"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label="Notlar"
                            value={field.value}
                            onChange={field.onChange}
                            multiline={true}
                            rows={3}
                            error={errors.notes?.message}
                            maxLength={500}
                        />
                    )}
                />
            </div>

            <div className="form-group">
                <Controller
                    name="filePath"
                    control={control}
                    render={({ field }) => (
                        <FileAttachmentInput
                            label="Muayene Raporu / Belgesi"
                            value={field.value}
                            onChange={field.onChange}
                        />
                    )}
                />
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    İptal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
            </div>
        </form>
    )
}
