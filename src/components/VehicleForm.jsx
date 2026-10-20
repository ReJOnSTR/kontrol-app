
import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehicleSchema } from '../schemas/vehicleSchema'
import CustomInput from './CustomInput'
import CustomSelect from './CustomSelect'
import { Car, Building2 } from 'lucide-react'
import { vehicleStatuses } from '../utils/helpers'
import { useCompany } from '../context/CompanyContext'

const defaultVehicleTypes = [
    { value: 'Otomobil', label: 'Otomobil' },
    { value: 'Kamyon', label: 'Kamyon' },
    { value: 'Kamyonet', label: 'Kamyonet' },
    { value: 'TIR / Çekici', label: 'TIR / Çekici' },
    { value: 'Minibüs', label: 'Minibüs' },
    { value: 'Otobüs', label: 'Otobüs' },
    { value: 'Dorse', label: 'Dorse' },
    { value: 'İş Makinesi', label: 'İş Makinesi' },
    { value: 'Motosiklet', label: 'Motosiklet' },
    { value: 'Diğer', label: 'Diğer' }
]

export default function VehicleForm({ initialData, onSubmit, onCancel, loading }) {
    const [vehicleTypes, setVehicleTypes] = useState(defaultVehicleTypes)
    const { currentCompany } = useCompany()

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(vehicleSchema),
        defaultValues: {
            type: defaultVehicleTypes[0].value,
            plate: '',
            brand: '',
            model: '',
            year: '',
            color: '',
            km: 0,
            status: 'active',
            notes: '',
            image: ''
        }
    })

    useEffect(() => {
        const loadTypes = async () => {
            if (currentCompany) {
                try {
                    const res = await window.electronAPI.getVehicleTypes(currentCompany.id)
                    if (res?.success && (res.data || []).length > 0) {
                        const mapped = res.data.map(t => ({ value: t.name, label: t.name }))
                        setVehicleTypes(mapped)
                        if (!initialData) {
                            reset(prev => ({ ...prev, type: prev.type || mapped[0]?.value || defaultVehicleTypes[0].value }))
                        }
                    } else {
                        setVehicleTypes(defaultVehicleTypes)
                        if (!initialData) {
                            reset(prev => ({ ...prev, type: prev.type || defaultVehicleTypes[0].value }))
                        }
                    }
                } catch (e) {
                    setVehicleTypes(defaultVehicleTypes)
                }
            }
        }
        loadTypes()
    }, [currentCompany, initialData, reset])

    useEffect(() => {
        if (initialData) {
            reset({
                type: initialData.type || '',
                plate: initialData.plate || '',
                brand: initialData.brand || '',
                model: initialData.model || '',
                year: initialData.year ? initialData.year.toString() : '',
                color: initialData.color || '',
                km: initialData.km || 0,
                status: initialData.status || 'active',
                notes: initialData.notes || '',
                image: initialData.image || ''
            })
        }
    }, [initialData, reset])

    const onFormSubmit = (data) => {
        console.log('Form Submitted (Valid):', data)
        onSubmit(data)
    }

    return (
        <form onSubmit={handleSubmit(onFormSubmit)}>
            <div className="form-grid-2 vehicle-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                {/* LEFT COLUMN: Basic Info */}
                <div>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Car size={15} /> Temel Bilgiler
                    </div>

                    <div className="form-row">
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Araç Türü"
                                    className="form-select-custom"
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={vehicleTypes}
                                    placeholder="Seçiniz"
                                    error={errors.type?.message}
                                    creatable={true}
                                />
                            )}
                        />
                        <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Durum"
                                    className="form-select-custom"
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={vehicleStatuses}
                                    placeholder="Seçiniz"
                                    error={errors.status?.message}
                                />
                            )}
                        />
                    </div>

                    <div className="form-group">
                        <Controller
                            name="plate"
                            control={control}
                            render={({ field }) => (
                                <CustomInput
                                    label="Plaka"
                                    required={true}
                                    value={field.value}
                                    onChange={field.onChange}
                                    format="plate"
                                    maxLength={15}
                                    placeholder="34 ABC 123"
                                    floatingLabel={true}
                                    error={errors.plate?.message}
                                />
                            )}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <Controller
                                name="brand"
                                control={control}
                                render={({ field }) => (
                                    <CustomInput
                                        label="Marka"
                                        value={field.value}
                                        onChange={field.onChange}
                                        format="title"
                                        placeholder="Örn: Ford"
                                        floatingLabel={true}
                                        error={errors.brand?.message}
                                        maxLength={50}
                                    />
                                )}
                            />
                        </div>
                        <div className="form-group">
                            <Controller
                                name="model"
                                control={control}
                                render={({ field }) => (
                                    <CustomInput
                                        label="Model"
                                        value={field.value}
                                        onChange={field.onChange}
                                        format="title"
                                        placeholder="Örn: Focus"
                                        floatingLabel={true}
                                        error={errors.model?.message}
                                        maxLength={50}
                                    />
                                )}
                            />
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Details */}
                <div>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Building2 size={15} /> Teknik Detaylar
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <Controller
                                name="year"
                                control={control}
                                render={({ field }) => (
                                    <CustomInput
                                        label="Yıl"
                                        type="number"
                                        min={1900}
                                        max={new Date().getFullYear() + 1}
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="2024"
                                        floatingLabel={true}
                                        error={errors.year?.message}
                                    />
                                )}
                            />
                        </div>
                        <div className="form-group">
                            <Controller
                                name="km"
                                control={control}
                                render={({ field }) => (
                                    <CustomInput
                                        label="Kilometre"
                                        type="number"
                                        min={0}
                                        max={2000000}
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="0"
                                        floatingLabel={true}
                                        error={errors.km?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <Controller
                            name="color"
                            control={control}
                            render={({ field }) => (
                                <CustomInput
                                    label="Renk"
                                    value={field.value}
                                    onChange={field.onChange}
                                    format="title"
                                    placeholder="Örn: Beyaz"
                                    floatingLabel={true}
                                    error={errors.color?.message}
                                    maxLength={30}
                                />
                            )}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <Controller
                            name="notes"
                            control={control}
                            render={({ field }) => (
                                <CustomInput
                                    label="Araç Notları"
                                    value={field.value}
                                    onChange={field.onChange}
                                    multiline={true}
                                    rows={3}
                                    floatingLabel={true}
                                    placeholder="Araç hakkında ek bilgiler..."
                                    maxLength={500}
                                />
                            )}
                        />
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
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
