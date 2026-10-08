import { useState, useEffect } from 'react'
import CustomInput from '../CustomInput'

export default function CustomerForm({ initialData = null, onSubmit, onCancel, loading = false }) {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        tax_number: '',
        tax_office: '',
        notes: ''
    })

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                phone: initialData.phone || '',
                email: initialData.email || '',
                address: initialData.address || '',
                tax_number: initialData.tax_number || '',
                tax_office: initialData.tax_office || '',
                notes: initialData.notes || ''
            })
        }
    }, [initialData])

    const handleChange = (key, value) => {
        setFormData(prev => ({
            ...prev,
            [key]: value
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.name.trim()) {
            alert('Müşteri adı/ünvanı zorunludur.')
            return
        }
        onSubmit(formData)
    }

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <CustomInput
                    label="Müşteri Adı / Ünvanı"
                    required
                    value={formData.name}
                    onChange={val => handleChange('name', val)}
                    placeholder="Müşteri Adı veya Firma Ünvanı"
                    maxLength={100}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <CustomInput
                        label="Telefon"
                        format="phone"
                        value={formData.phone}
                        onChange={val => handleChange('phone', val)}
                        placeholder="(5XX) XXX XX XX"
                    />
                    <CustomInput
                        label="E-Posta"
                        type="email"
                        value={formData.email}
                        onChange={val => handleChange('email', val)}
                        placeholder="ornek@firma.com"
                        maxLength={100}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <CustomInput
                        label="Vergi Numarası / T.C. Kimlik"
                        format="tc_no"
                        value={formData.tax_number}
                        onChange={val => handleChange('tax_number', val)}
                        maxLength={11}
                        placeholder="Vergi No veya TCKN"
                    />
                    <CustomInput
                        label="Vergi Dairesi"
                        value={formData.tax_office}
                        onChange={val => handleChange('tax_office', val)}
                        placeholder="Vergi Dairesi"
                        maxLength={50}
                    />
                </div>

                <CustomInput
                    label="Açık Adres"
                    type="textarea"
                    value={formData.address}
                    onChange={val => handleChange('address', val)}
                    rows={2}
                    placeholder="Müşteri açık adresi..."
                    maxLength={250}
                />

                <CustomInput
                    label="Notlar"
                    type="textarea"
                    value={formData.notes}
                    onChange={val => handleChange('notes', val)}
                    rows={3}
                    placeholder="Özel notlar..."
                    maxLength={500}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
                    İptal
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
            </div>
        </form>
    )
}
