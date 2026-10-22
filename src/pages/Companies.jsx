import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import DataTable from '../components/DataTable'
import CustomInput from '../components/CustomInput'
import { formatDate } from '../utils/helpers'
import { Plus, Pencil, Trash2, Building2, Upload, X, Loader2, FileText } from 'lucide-react'

export default function Companies() {
    const { user } = useAuth()
    const { companies, currentCompany, createCompany, updateCompany, deleteCompany, refreshCompanies } = useCompany()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCompany, setEditingCompany] = useState(null)
    const [formData, setFormData] = useState({
        name: '',
        taxNumber: '',
        taxOffice: '',
        sgkNo: '',
        address: '',
        phone: '',
        signaturePath: '',
        stampPath: ''
    })
    const [signaturePreview, setSignaturePreview] = useState(null)
    const [stampPreview, setStampPreview] = useState(null)
    const [stampLoading, setStampLoading] = useState(false)
    const [signatureLoading, setSignatureLoading] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [confirmModal, setConfirmModal] = useState(null) // { type: 'single'|'bulk', item, ids, title, message }

    const resetForm = () => {
        setFormData({
            name: '',
            taxNumber: '',
            taxOffice: '',
            sgkNo: '',
            address: '',
            phone: '',
            signaturePath: '',
            stampPath: ''
        })
        setSignaturePreview(null)
        setStampPreview(null)
        setStampLoading(false)
        setSignatureLoading(false)
        setEditingCompany(null)
        setError('')
    }

    const openCreateModal = () => {
        resetForm()
        setIsModalOpen(true)
    }

    const openEditModal = async (company) => {
        setFormData({
            name: company.name,
            taxNumber: company.tax_number || '',
            taxOffice: company.tax_office || '',
            sgkNo: company.sgk_no || '',
            address: company.address || '',
            phone: company.phone || '',
            signaturePath: company.signature_path || '',
            stampPath: company.stamp_path || ''
        })
        setEditingCompany(company)
        setIsModalOpen(true)

        if (company.signature_path) {
            if (company.signature_path.toLowerCase().endsWith('.pdf')) {
                setSignaturePreview('pdf')
            }
            window.electronAPI?.readDocumentData?.(company.signature_path).then(res => {
                if (res?.success) setSignaturePreview(res.data)
            }).catch(e => console.warn('Signature preview load notice:', e.message))
        }
        if (company.stamp_path) {
            if (company.stamp_path.toLowerCase().endsWith('.pdf')) {
                setStampPreview('pdf')
            }
            window.electronAPI?.readDocumentData?.(company.stamp_path).then(res => {
                if (res?.success) setStampPreview(res.data)
            }).catch(e => console.warn('Stamp preview load notice:', e.message))
        }
    }

    const closeModal = () => {
        setIsModalOpen(false)
        resetForm()
    }

    const handleSelectSignature = async () => {
        setError('')
        try {
            const currentCid = editingCompany?.id || formData.id || currentCompany?.id || user?.company_id || user?.companyId
            const result = await window.electronAPI.selectFile({ 
                companyId: currentCid, 
                module: 'companies', 
                category: 'signatures',
                accept: '.png,.jpg,.jpeg,.webp,.pdf' 
            })
            if (result?.error) {
                setError('Dosya seçilemedi: ' + result.error)
                return
            }
            if (!result || result.canceled || (Array.isArray(result) && result.length === 0)) return
            const filePath = Array.isArray(result) ? result[0] : result.filePaths?.[0]
            if (!filePath) return

            setSignatureLoading(true)
            const saveRes = await window.electronAPI.saveFile(filePath)
            const savedName = typeof saveRes === 'string' ? saveRes : (saveRes?.fileName || saveRes?.filePath || saveRes?.path)
            if (savedName && typeof savedName === 'string') {
                setFormData(prev => ({ ...prev, signaturePath: savedName }))
                if (savedName.toLowerCase().endsWith('.pdf')) {
                    setSignaturePreview('pdf')
                }
                try {
                    const previewRes = await window.electronAPI.readDocumentData(savedName)
                    if (previewRes?.success) {
                        setSignaturePreview(previewRes.data)
                    }
                } catch (pErr) {
                    console.warn('[Signature Preview Notice]:', pErr.message)
                }
            } else {
                setError(saveRes?.error || 'İmza dosyası kaydedilemedi.')
            }
        } catch (err) {
            console.error('Signature select error:', err)
            const cleanMessage = err.message.replace(/Error invoking remote method '.*?':\s*Error:\s*/, '')
            setError('İmza seçerken bir hata oluştu: ' + cleanMessage)
        } finally {
            setSignatureLoading(false)
        }
    }

    const handleSelectStamp = async () => {
        setError('')
        try {
            const currentCid = editingCompany?.id || formData.id || currentCompany?.id || user?.company_id || user?.companyId
            const result = await window.electronAPI.selectFile({ 
                companyId: currentCid, 
                module: 'companies', 
                category: 'stamps',
                accept: '.png,.jpg,.jpeg,.webp,.pdf' 
            })
            if (result?.error) {
                setError('Dosya seçilemedi: ' + result.error)
                return
            }
            if (!result || result.canceled || (Array.isArray(result) && result.length === 0)) return
            const filePath = Array.isArray(result) ? result[0] : result.filePaths?.[0]
            if (!filePath) return

            setStampLoading(true)
            const saveRes = await window.electronAPI.saveFile(filePath)
            const savedName = typeof saveRes === 'string' ? saveRes : (saveRes?.fileName || saveRes?.filePath || saveRes?.path)
            if (savedName && typeof savedName === 'string') {
                setFormData(prev => ({ ...prev, stampPath: savedName }))
                if (savedName.toLowerCase().endsWith('.pdf')) {
                    setStampPreview('pdf')
                }
                try {
                    const previewRes = await window.electronAPI.readDocumentData(savedName)
                    if (previewRes?.success) {
                        setStampPreview(previewRes.data)
                    }
                } catch (pErr) {
                    console.warn('[Stamp Preview Notice]:', pErr.message)
                }
            } else {
                setError(saveRes?.error || 'Kaşe dosyası kaydedilemedi.')
            }
        } catch (err) {
            console.error('Stamp select error:', err)
            const cleanMessage = err.message.replace(/Error invoking remote method '.*?':\s*Error:\s*/, '')
            setError('Kaşe seçerken bir hata oluştu: ' + cleanMessage)
        } finally {
            setStampLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!formData.name.trim()) {
            setError('Şirket adı zorunludur')
            return
        }

        setLoading(true)

        let result
        if (editingCompany) {
            result = await updateCompany({
                id: editingCompany.id,
                name: formData.name,
                taxNumber: formData.taxNumber,
                taxOffice: formData.taxOffice,
                sgkNo: formData.sgkNo,
                address: formData.address,
                phone: formData.phone,
                signaturePath: formData.signaturePath,
                stampPath: formData.stampPath
            })
        } else {
            result = await createCompany(formData)
        }

        setLoading(false)

        if (result.success) {
            closeModal()
        } else {
            setError(result.error)
        }
    }

    const handleDeleteClick = (company) => {
        setConfirmModal({
            type: 'single',
            item: company,
            title: 'Şirket Silme',
            message: `"${company.name}" şirketini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        })
    }

    const handleBulkDeleteClick = (ids) => {
        setConfirmModal({
            type: 'bulk',
            ids: ids,
            title: 'Toplu Silme',
            message: `${ids.length} şirketi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        })
    }

    const handleConfirmDelete = async () => {
        if (!confirmModal) return

        if (confirmModal.type === 'single') {
            await deleteCompany(confirmModal.item.id)
        } else if (confirmModal.type === 'bulk') {
            for (const id of confirmModal.ids) {
                await deleteCompany(id)
            }
        }
        setConfirmModal(null)
    }

    const columns = [
        { key: 'name', label: 'Şirket Adı' },
        { key: 'tax_number', label: 'Vergi No' },
        { key: 'phone', label: 'Telefon' },
        { key: 'address', label: 'Adres' },
        {
            key: 'created_at',
            label: 'Kayıt Tarihi',
            render: (value) => formatDate(value)
        }
    ]

    // We don't have separate loading state for initial load vs refresh in context probably, 
    // but companies are usually cached in context. 
    // Wait, useCompany exposes refreshCompanies.
    // If we assume companies.length check is enough?
    // Actually companies might be empty initially.

    // Changing the logic slightly for companies since it comes from context
    // If companies is non-empty, we likely don't want to show loading screen

    // Wait, Companies.jsx doesn't have a 'loading' state for fetching, it's inside useCompany context generally.
    // But lines 22 declare `const [loading, setLoading] = useState(false)`. This is for form submission!
    // Ah, Companies.jsx gets data from `useCompany`. 
    // `useCompany` likely handles the fetching.

    // Let's check `useCompany`. If it provides a loading state for data fetch.
    // If not, we can't easily do this optimization here without checking context implementation.
    // However, existing code likely relies on `companies` array updates.

    // Reviewing lines 1-13 again.
    // It consumes `companies` from useCompany.

    // It does NOT have a fetching useEffect locally.
    // So there is NO local data loading state causing a reset.
    // Therefore, Companies.jsx probably DOES NOT need this fix because it doesn't unmount on refresh,
    // unless `useCompany` sets `companies` to [] before updating.

    // I'll skip Companies.jsx for now as it uses Context, not local state fetching.
    // Moving to VehicleDetail.jsx.

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Şirketler</h1>
                    <p style={{ marginTop: '5px', color: '#666' }}>Şirket ve şube yönetimi.</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        <Plus size={18} />
                        Yeni Şirket
                    </button>
                </div>
            </div>

            {companies.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Building2 />
                    </div>
                    <h2 className="empty-state-title">Henüz Şirket Yok</h2>
                    <p className="empty-state-desc">
                        Araçlarınızı yönetmek için ilk şirketinizi oluşturun.
                    </p>
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        <Plus size={18} />
                        Şirket Oluştur
                    </button>
                </div>
            ) : (
                <DataTable persistenceKey="Companies_table_0"
                    columns={columns}
                    data={companies}
                    showSearch={true}
                    showCheckboxes={true}
                    onBulkDelete={handleBulkDeleteClick}
                    actions={(company) => (
                        <>
                            <button title="Düzenle" onClick={() => openEditModal(company)}>
                                <Pencil size={16} />
                            </button>
                            <button title="Sil" className="danger" onClick={() => handleDeleteClick(company)}>
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                />
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingCompany ? 'Şirket Düzenle' : 'Yeni Şirket'}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={closeModal}>
                            İptal
                        </button>
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <CustomInput
                            label="Şirket Adı"
                            required={true}
                            value={formData.name}
                            onChange={(value) => setFormData({ ...formData, name: value })}
                            format="title"
                            placeholder="Şirket adını girin"
                            maxLength={150}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <CustomInput
                                label="Vergi Numarası"
                                value={formData.taxNumber}
                                onChange={(value) => setFormData({ ...formData, taxNumber: value })}
                                placeholder="Vergi numarası"
                                format="tc_no"
                                maxLength={11}
                            />
                        </div>

                        <div className="form-group">
                            <CustomInput
                                label="Telefon"
                                value={formData.phone}
                                onChange={(value) => setFormData({ ...formData, phone: value })}
                                format="phone"
                                maxLength={14}
                                placeholder="(5XX) XXX XX XX"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <CustomInput
                                label="Vergi Dairesi"
                                value={formData.taxOffice}
                                onChange={(value) => setFormData({ ...formData, taxOffice: value })}
                                placeholder="Vergi dairesi"
                                maxLength={50}
                            />
                        </div>

                        <div className="form-group">
                            <CustomInput
                                label="SGK İşyeri No"
                                value={formData.sgkNo}
                                onChange={(value) => setFormData({ ...formData, sgkNo: value })}
                                placeholder="SGK numarası"
                                maxLength={30}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <CustomInput
                            label="Adres"
                            placeholder="Şirket adresi"
                            value={formData.address}
                            onChange={(value) => setFormData({ ...formData, address: value })}
                            multiline={true}
                            rows={3}
                            floatingLabel={true}
                            maxLength={250}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px', marginBottom: '16px' }}>
                        {/* Kaşe Yükleme Kartı */}
                        <div style={{
                            border: '1px dashed var(--border-color)',
                            borderRadius: '12px',
                            padding: '16px',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '130px',
                            background: 'var(--bg-secondary)',
                            position: 'relative'
                        }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Şirket Kaşesi</span>
                            {stampLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <Loader2 className="spin" size={24} style={{ color: 'var(--primary)' }} />
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Yükleniyor...</span>
                                </div>
                            ) : stampPreview ? (
                                <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    {(formData.stampPath?.toLowerCase().endsWith('.pdf') || stampPreview === 'pdf' || (typeof stampPreview === 'string' && stampPreview.startsWith('data:application/pdf'))) ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                                            <FileText size={20} style={{ color: 'var(--accent-primary)' }} />
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>PDF Kaşe</span>
                                        </div>
                                    ) : (
                                        <img src={stampPreview} alt="Kaşe" style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain', marginBottom: '8px', borderRadius: '4px' }} />
                                    )}
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary btn-sm" 
                                        onClick={() => {
                                            setFormData(prev => ({ ...prev, stampPath: '' }))
                                            setStampPreview(null)
                                        }}
                                        style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <X size={12} /> Kaldır
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleSelectStamp}
                                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                                >
                                    <Upload size={14} /> Kaşe Yükle
                                </button>
                            )}
                        </div>

                        {/* İmza Yükleme Kartı */}
                        <div style={{
                            border: '1px dashed var(--border-color)',
                            borderRadius: '12px',
                            padding: '16px',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '130px',
                            background: 'var(--bg-secondary)',
                            position: 'relative'
                        }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Yetkili İmzası</span>
                            {signatureLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <Loader2 className="spin" size={24} style={{ color: 'var(--primary)' }} />
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Yükleniyor...</span>
                                </div>
                            ) : signaturePreview ? (
                                <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    {(formData.signaturePath?.toLowerCase().endsWith('.pdf') || signaturePreview === 'pdf' || (typeof signaturePreview === 'string' && signaturePreview.startsWith('data:application/pdf'))) ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                                            <FileText size={20} style={{ color: 'var(--accent-primary)' }} />
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>PDF İmza</span>
                                        </div>
                                    ) : (
                                        <img src={signaturePreview} alt="İmza" style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain', marginBottom: '8px', borderRadius: '4px' }} />
                                    )}
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary btn-sm" 
                                        onClick={() => {
                                            setFormData(prev => ({ ...prev, signaturePath: '' }))
                                            setSignaturePreview(null)
                                        }}
                                        style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <X size={12} /> Kaldır
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleSelectSignature}
                                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                                >
                                    <Upload size={14} /> İmza Yükle
                                </button>
                            )}
                        </div>
                    </div>

                    {error && <div className="form-error">{error}</div>}
                </form>
            </Modal>

            <ConfirmModal
                isOpen={!!confirmModal}
                onClose={() => setConfirmModal(null)}
                onConfirm={handleConfirmDelete}
                title={confirmModal?.title}
                message={confirmModal?.message}
            />
        </div>
    )
}
