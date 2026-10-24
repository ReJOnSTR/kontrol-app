import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { assignmentSchema } from '../../schemas/assignmentSchema'
import CustomInput from '../CustomInput'
import CustomSelect from '../CustomSelect'
import FileAttachmentInput from '../FileAttachmentInput'
import { formatDateForInput } from '../../utils/helpers'

export default function AssignmentForm({ initialData, onSubmit, onCancel, vehicles, loading }) {
    const {
        control,
        handleSubmit,
        reset,
        setValue,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(assignmentSchema),
        defaultValues: {
            vehicleId: '',
            itemName: '',
            quantity: '1',
            assignedTo: '',
            department: '',
            startDate: formatDateForInput(new Date()),
            endDate: '',
            notes: '',
            filePath: null
        }
    })

    useEffect(() => {
        if (initialData) {
            reset({
                vehicleId: initialData.vehicle_id || initialData.vehicleId || '',
                itemName: initialData.item_name || initialData.itemName || '',
                quantity: initialData.quantity || '1',
                assignedTo: initialData.assigned_to || initialData.assignedTo || '',
                department: initialData.department || '',
                startDate: formatDateForInput(initialData.start_date || initialData.startDate) || formatDateForInput(new Date()),
                endDate: formatDateForInput(initialData.end_date || initialData.endDate),
                notes: initialData.notes || '',
                filePath: initialData.file_path || initialData.filePath || null
            })
        } else {
            reset({
                vehicleId: '',
                itemName: '',
                quantity: '1',
                assignedTo: '',
                department: '',
                startDate: formatDateForInput(new Date()),
                endDate: '',
                notes: '',
                filePath: null
            })
        }

        if (vehicles && vehicles.length === 1 && !initialData) {
            setValue('vehicleId', vehicles[0].id)
        }
    }, [initialData, reset, vehicles, setValue])

    const onFormSubmit = (data) => {
        onSubmit(data)
    }

    return (
        <form onSubmit={handleSubmit(onFormSubmit)}>
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

            <div className="form-row" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <Controller
                    name="itemName"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label="Malzeme/Demirbaş Adı"
                            required={true}
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.itemName?.message}
                            maxLength={100}
                        />
                    )}
                />
                <Controller
                    name="quantity"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label="Adet"
                            format="numeric"
                            min={1}
                            max={9999}
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.quantity?.message}
                            maxLength={4}
                        />
                    )}
                />
            </div>

            <div className="form-row">
                <Controller
                    name="assignedTo"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label="Sorumlu Kişi (Opsiyonel)"
                            value={field.value}
                            onChange={field.onChange}
                            format="title"
                            error={errors.assignedTo?.message}
                            maxLength={100}
                        />
                    )}
                />
                <Controller
                    name="department"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label="Departman"
                            value={field.value}
                            onChange={field.onChange}
                            format="title"
                            error={errors.department?.message}
                            maxLength={50}
                        />
                    )}
                />
            </div>

            <div className="form-row">
                <Controller
                    name="startDate"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label="Başlangıç Tarihi"
                            type="date"
                            required={true}
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.startDate?.message}
                        />
                    )}
                />
                <Controller
                    name="endDate"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label="Bitiş Tarihi"
                            type="date"
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.endDate?.message}
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

            <Controller
                name="filePath"
                control={control}
                render={({ field }) => (
                    <FileAttachmentInput
                        value={field.value}
                        onChange={field.onChange}
                        label="Belge/Dosya Ekleyin"
                    />
                )}
            />

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
