import { useState, useEffect } from 'react'
import CustomInput from '../CustomInput'
import CustomSelect from '../CustomSelect'
import CustomMultiSelect from '../CustomMultiSelect'
import SignaturePadModal from '../SignaturePadModal'
import { formatDateForInput, formatCurrency } from '../../utils/helpers'
import { useTabs } from '../../context/TabContext'
import { Edit3, Trash2 } from 'lucide-react'

const statusOptions = [
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Pasif' }
]

const weekDays = [
    { value: 1, label: 'Pazartesi' },
    { value: 2, label: 'Salı' },
    { value: 3, label: 'Çarşamba' },
    { value: 4, label: 'Perşembe' },
    { value: 5, label: 'Cuma' },
    { value: 6, label: 'Cumartesi' },
    { value: 0, label: 'Pazar' }
]

const defaultDepartments = [
    { value: 'Yönetim', label: 'Yönetim' },
    { value: 'Şoför / Sürücü', label: 'Şoför / Sürücü' },
    { value: 'Operasyon & Lojistik', label: 'Operasyon & Lojistik' },
    { value: 'Muhasebe & Finans', label: 'Muhasebe & Finans' },
    { value: 'Teknik & Bakım', label: 'Teknik & Bakım' },
    { value: 'Satış & Pazarlama', label: 'Satış & Pazarlama' },
    { value: 'İnsan Kaynakları', label: 'İnsan Kaynakları' },
    { value: 'Depo & Sevkiyat', label: 'Depo & Sevkiyat' },
    { value: 'Diğer', label: 'Diğer' }
]

export default function EmployeeForm({ initialData, onSubmit, onCancel, saving, departmentOptions = [], onEditSalary }) {
    const { openNewTab } = useTabs()
    const [offDays, setOffDays] = useState([0])
    const [isSigPadOpen, setIsSigPadOpen] = useState(false)

    const resolvedDeptOptions = (departmentOptions || []).length > 0 
        ? (departmentOptions || []).map(d => typeof d === 'string' ? { value: d, label: d } : { value: d.name || d.value || d.label, label: d.label || d.name || d.value }).filter(d => d.value)
        : defaultDepartments;
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        tcNo: '',
        phone: '',
        email: '',
        position: '',
        department: '',
        startDate: '',
        endDate: '',
        birthDate: '',
        salary: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        pastUsedLeaves: '',
        status: 'active',
        iban: '',
        notes: '',
        signaturePath: ''
    })

    const [salaryChanged, setSalaryChanged] = useState(false)

    useEffect(() => {
        if (initialData) {
            setForm({
                firstName: initialData.first_name || '',
                lastName: initialData.last_name || '',
                tcNo: initialData.tc_no || '',
                phone: initialData.phone || '',
                email: initialData.email || '',
                position: initialData.position || '',
                department: initialData.department || '',
                startDate: formatDateForInput(initialData.start_date),
                endDate: formatDateForInput(initialData.end_date),
                birthDate: formatDateForInput(initialData.birth_date),
                salary: initialData.salary || '',
                effectiveDate: formatDateForInput(new Date()),
                pastUsedLeaves: initialData.past_used_leaves || '',
                status: initialData.status || 'active',
                iban: initialData.iban || '',
                notes: initialData.notes || '',
                signaturePath: initialData.signature_path || initialData.signaturePath || ''
            })
            const initialOffDays = (initialData.off_days || '0')
                .split(',')
                .map(d => parseInt(d))
                .filter(d => !isNaN(d))
            setOffDays(initialOffDays)
            setSalaryChanged(false)
        } else {
            setOffDays([0])
        }
    }, [initialData])

    const handleChange = (key, value) => {
        setForm(prev => {
            const next = { ...prev, [key]: value }
            if (key === 'status' && (value === 'inactive' || value === 'passive') && !prev.endDate) {
                next.endDate = new Date().toISOString().split('T')[0]
            } else if (key === 'status' && value === 'active') {
                next.endDate = ''
            }
            if (key === 'salary' && initialData) {
                setSalaryChanged(parseFloat(value || 0) !== parseFloat(initialData.salary || 0))
            }
            return next
        })
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit({
            ...form,
            offDays: offDays.join(',')
        })
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="form-grid form-grid-2">
                <CustomInput
                    label="Ad *"
                    value={form.firstName}
                    onChange={(val) => handleChange('firstName', val)}
                    required
                    maxLength={50}
                />
                <CustomInput
                    label="Soyad *"
                    value={form.lastName}
                    onChange={(val) => handleChange('lastName', val)}
                    required
                    maxLength={50}
                />
                <CustomInput
                    label="TC Kimlik No"
                    format="tc_no"
                    value={form.tcNo}
                    onChange={(val) => handleChange('tcNo', val)}
                    maxLength={11}
                />
                <CustomInput
                    label="Telefon"
                    format="phone"
                    value={form.phone}
                    onChange={(val) => handleChange('phone', val)}
                    maxLength={14}
                />
                <CustomInput
                    label="E-posta"
                    type="email"
                    value={form.email}
                    onChange={(val) => handleChange('email', val)}
                    maxLength={100}
                />
                <CustomInput
                    label="IBAN"
                    format="iban"
                    value={form.iban}
                    onChange={(val) => handleChange('iban', val)}
                    maxLength={32}
                    placeholder="TR__ ____ ____ ____ ____ ____ __"
                />
                <CustomInput
                    label="Pozisyon / Unvan"
                    value={form.position}
                    onChange={(val) => handleChange('position', val)}
                    maxLength={100}
                />
                <CustomSelect
                    label="Departman"
                    value={form.department}
                    onChange={(val) => handleChange('department', val)}
                    options={resolvedDeptOptions}
                    placeholder="Seçiniz..."
                    creatable={true}
                />
                <CustomInput
                    label="İşe Başlama Tarihi"
                    type="date"
                    value={form.startDate}
                    onChange={(val) => handleChange('startDate', val)}
                />
                <CustomInput
                    label="Doğum Tarihi"
                    type="date"
                    value={form.birthDate}
                    onChange={(val) => handleChange('birthDate', val)}
                />
                {initialData ? (
                    <div className="form-group floating-label-group has-value" style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="form-input" style={{ 
                                flex: 1, 
                                display: 'flex', 
                                alignItems: 'center', 
                                background: 'var(--bg-tertiary)', 
                                opacity: 0.7,
                                cursor: 'not-allowed',
                                position: 'relative',
                                height: '40px'
                            }}>
                                {form.salary ? formatCurrency(form.salary) : '-'}
                                <span style={{ position: 'absolute', right: '12px', color: 'var(--text-muted)' }}>₺</span>
                            </div>
                            <button 
                                type="button" 
                                className="btn btn-secondary"
                                style={{ height: '40px' }}
                                onClick={() => {
                                    if (onEditSalary) {
                                        onEditSalary()
                                    } else {
                                        openNewTab('/payroll', false, 'Maaş Tablosu')
                                    }
                                }}
                            >
                                Maaş Düzenle
                            </button>
                        </div>
                        <label className="form-label">Maaş (₺)</label>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                            Maaş güncellemeleri için Maaş Tablosu sayfasını kullanın.
                        </span>
                    </div>
                ) : (
                    <CustomInput
                        label="Maaş (₺)"
                        format="currency"
                        value={form.salary}
                        onChange={(val) => handleChange('salary', val)}
                        maxLength={12}
                    />
                )}
                {salaryChanged && (
                    <CustomInput
                        label="Maaş Zammı Geçerlilik Tarihi (Hangi Günden İtibaren)"
                        type="date"
                        value={form.effectiveDate}
                        onChange={(val) => handleChange('effectiveDate', val)}
                        required
                    />
                )}
                <CustomInput
                    label="Geçmiş Kullanılan Yıllık İzin (Gün)"
                    type="number"
                    value={form.pastUsedLeaves}
                    onChange={(val) => handleChange('pastUsedLeaves', val)}
                    min={0}
                    max={365}
                    maxLength={3}
                />
                <CustomSelect
                    label="Durum"
                    value={form.status}
                    onChange={(val) => handleChange('status', val)}
                    options={statusOptions}
                />
                {(form.status === 'inactive' || form.status === 'passive') && (
                    <CustomInput
                        label="İşten Çıkış Tarihi"
                        type="date"
                        value={form.endDate}
                        onChange={(val) => handleChange('endDate', val)}
                    />
                )}
                <CustomMultiSelect
                    label="Haftalık İzin Günleri (Of Günleri)"
                    value={offDays}
                    onChange={setOffDays}
                    options={weekDays}
                    placeholder="Seçiniz..."
                />
            </div>

            <div style={{ marginTop: '16px' }}>
                <CustomInput
                    label="Notlar"
                    value={form.notes}
                    onChange={(val) => handleChange('notes', val)}
                    type="textarea"
                    rows={3}
                    maxLength={500}
                />
            </div>

            {/* Personel İmzası Bölümü */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    Personel İmzası (Resmi Evraklar İçin)
                </label>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px 16px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)'
                }}>
                    {form.signaturePath ? (
                        <div style={{
                            height: '50px',
                            padding: '4px 12px',
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                            <img
                                src={form.signaturePath}
                                alt="Personel İmzası"
                                style={{ maxHeight: '42px', objectFit: 'contain' }}
                            />
                        </div>
                    ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Henüz kayıtlı bir personel imzası bulunmuyor.
                        </span>
                    )}

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setIsSigPadOpen(true)}
                            style={{ gap: '6px' }}
                        >
                            <Edit3 size={14} /> {form.signaturePath ? 'İmzayı Değiştir / Çiz' : 'İmza Ekle'}
                        </button>
                        {form.signaturePath && (
                            <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleChange('signaturePath', '')}
                                title="İmzayı Sil"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <SignaturePadModal
                isOpen={isSigPadOpen}
                onClose={() => setIsSigPadOpen(false)}
                initialSignature={form.signaturePath}
                onSave={(sigData) => handleChange('signaturePath', sigData)}
                title="Personel İmzası Ekle / Düzenle"
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Vazgeç</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Kaydediliyor...' : (initialData ? 'Güncelle' : 'Kaydet')}
                </button>
            </div>
        </form>
    )
}
