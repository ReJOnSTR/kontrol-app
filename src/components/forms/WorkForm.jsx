import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { workHeaderSchema } from '../../schemas/workSchema'
import CustomInput from '../CustomInput'
import CustomSelect from '../CustomSelect'
import SearchableSelect from '../SearchableSelect'
import Modal from '../Modal'
import { Settings } from 'lucide-react'

const statusOptions = [
    { value: 'pending', label: 'Bekliyor' },
    { value: 'in_progress', label: 'Devam Ediyor' },
    { value: 'completed', label: 'Tamamlandı' },
    { value: 'cancelled', label: 'İptal Edildi' }
]

export default function WorkForm({ initialData, onSubmit, onCancel, loading, customers = [], disableCustomerSelect = false }) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(workHeaderSchema),
        defaultValues: {
            title: '',
            customerId: '',
            customer: '',
            description: '',
            status: 'pending',
            location: '',
            work_start_time: '08:00',
            work_end_time: '17:00',
            disable_overtime: false,
            pazar_multiplier: 1.5,
            mesai_multiplier: 1.5
        }
    })

    const watchDisableOvertime = watch('disable_overtime')

    useEffect(() => {
        if (initialData) {
            reset({
                title: initialData.title || '',
                customerId: initialData.customer_id || '',
                customer: initialData.customer || '',
                description: initialData.description || '',
                status: initialData.status || 'pending',
                location: initialData.location || '',
                work_start_time: initialData.work_start_time || '08:00',
                work_end_time: initialData.work_end_time || '17:00',
                disable_overtime: !!initialData.disable_overtime,
                pazar_multiplier: initialData.pazar_multiplier !== undefined && initialData.pazar_multiplier !== null ? initialData.pazar_multiplier : 1.5,
                mesai_multiplier: initialData.mesai_multiplier !== undefined && initialData.mesai_multiplier !== null ? initialData.mesai_multiplier : 1.5
            })
        } else {
            reset({
                title: '',
                customerId: '',
                customer: '',
                description: '',
                status: 'pending',
                location: '',
                work_start_time: '08:00',
                work_end_time: '17:00',
                disable_overtime: false,
                pazar_multiplier: 1.5,
                mesai_multiplier: 1.5
            })
        }
    }, [initialData, reset])

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-row">
                <div className="form-group">
                    <Controller
                        name="title"
                        control={control}
                        render={({ field }) => (
                            <CustomInput
                                label="İş Başlığı"
                                required={true}
                                value={field.value}
                                onChange={field.onChange}
                                error={errors.title?.message}
                                placeholder="Örn: Vinç Kiralama"
                                maxLength={100}
                                format="title"
                            />
                        )}
                    />
                </div>
                <div className="form-group">
                    <Controller
                        name="customerId"
                        control={control}
                        render={({ field }) => (
                            <SearchableSelect
                                label="Müşteri / Cari Seçimi"
                                className="form-select-custom"
                                value={field.value}
                                onChange={(val) => {
                                    field.onChange(val);
                                    // Update the legacy customer text field to match the selected customer's name
                                    const selectedCustomer = customers.find(c => String(c.id) === String(val))
                                    if(selectedCustomer) {
                                        reset(formValues => ({ ...formValues, customer: selectedCustomer.name }))
                                    }
                                }}
                                options={customers.map(c => ({ value: c.id, label: c.name }))}
                                placeholder="Arama yapın..."
                                error={errors.customerId?.message}
                                disabled={disableCustomerSelect}
                            />
                        )}
                    />
                </div>
            </div>

            <div className="form-row">
                <div className="form-group">
                    <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Durum"
                                className="form-select-custom"
                                value={field.value}
                                onChange={field.onChange}
                                options={statusOptions}
                                error={errors.status?.message}
                            />
                        )}
                    />
                </div>
                <div className="form-group">
                    <Controller
                        name="location"
                        control={control}
                        render={({ field }) => (
                            <CustomInput
                                label="Konum / Adres"
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="İşin yapılacağı yer"
                                error={errors.location?.message}
                                maxLength={200}
                                format="title"
                            />
                        )}
                    />
                </div>
            </div>

            <div className="form-row">
                <div className="form-group">
                    <Controller
                        name="work_start_time"
                        control={control}
                        render={({ field }) => (
                            <CustomInput
                                label="Standart Mesai Başlangıç"
                                type="time"
                                value={field.value}
                                onChange={field.onChange}
                                error={errors.work_start_time?.message}
                                disabled={watchDisableOvertime}
                            />
                        )}
                    />
                </div>
                <div className="form-group">
                    <Controller
                        name="work_end_time"
                        control={control}
                        render={({ field }) => (
                            <CustomInput
                                label="Standart Mesai Bitiş"
                                type="time"
                                value={field.value}
                                onChange={field.onChange}
                                error={errors.work_end_time?.message}
                                disabled={watchDisableOvertime}
                            />
                        )}
                    />
                </div>
            </div>

            <div style={{
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Mesaileri Sayma (Fazla Mesai Hesaplanmasın)
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        Aktif edildiğinde bu işe ait günlük puantaj kayıtlarında fazla mesai süresi 0 kabul edilir.
                    </span>
                </div>
                <Controller
                    name="disable_overtime"
                    control={control}
                    render={({ field }) => (
                        <label className="toggle-switch" style={{ flexShrink: 0 }}>
                            <input
                                type="checkbox"
                                checked={!!field.value}
                                onChange={(e) => field.onChange(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    )}
                />
            </div>

            <div className="form-row" style={{ marginBottom: '16px' }}>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setIsSettingsOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'auto', padding: '8px 16px' }}
                    >
                        <Settings size={16} /> Katsayı Ayarları
                    </button>
                </div>
            </div>

            <Modal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                title="İş Katsayı Ayarları"
                size="sm"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        Bu işe özel olarak pazar günü mesai katsayısını ve fazla mesai farkı katsayısını değiştirebilirsiniz.
                    </div>
                    <div className="form-group">
                        <Controller
                            name="pazar_multiplier"
                            control={control}
                            render={({ field }) => (
                                <CustomInput
                                    label="Pazar Mesai Katsayısı"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    maxLength={4}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.pazar_multiplier?.message}
                                    placeholder="Örn: 1.5"
                                />
                            )}
                        />
                    </div>
                    <div className="form-group">
                        <Controller
                            name="mesai_multiplier"
                            control={control}
                            render={({ field }) => (
                                <CustomInput
                                    label="Mesai Farkı Katsayısı"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    maxLength={4}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.mesai_multiplier?.message}
                                    placeholder="Örn: 1.5"
                                />
                            )}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button type="button" className="btn btn-primary" onClick={() => setIsSettingsOpen(false)}>
                            Uygula
                        </button>
                    </div>
                </div>
            </Modal>

            <div className="form-group">
                <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                        <CustomInput
                            label="Not"
                            value={field.value}
                            onChange={field.onChange}
                            multiline={true}
                            rows={3}
                            placeholder="Raporun altında görünecek not..."
                            error={errors.description?.message}
                            maxLength={1000}
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
