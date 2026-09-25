import TopProgressBar from '../components/TopProgressBar'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import DataTable from '../components/DataTable'
import CustomSelect from '../components/CustomSelect'
import CustomInput from '../components/CustomInput'
import { usePersistentTab } from '../hooks/usePersistentTab'
import InsuranceForm from '../components/forms/InsuranceForm'

import {
    insuranceTypes,
    getInsuranceTypeLabel,
    formatDate,
    formatCurrency,
    getDaysUntilText,
    getStatusColor,
    getVehicleTypeLabel
} from '../utils/helpers'
import { Plus, Pencil, Trash2, Shield, Building2, Eye, Archive, ArchiveRestore } from 'lucide-react'
import DocumentPreviewModal from '../components/DocumentPreviewModal'
import BatchOperationModal from '../components/BatchOperationModal'

export default function Insurance() {
    const { currentCompany } = useCompany()
    const [searchParams, setSearchParams] = useSearchParams()
    const [insurances, setInsurances] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingInsurance, setEditingInsurance] = useState(null)
    // formData removed
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = usePersistentTab('Insurance', 'all')
    const [error, setError] = useState('')
    const [confirmModal, setConfirmModal] = useState(null) // { type: 'single'|'bulk', item, ids, title, message }

    // Archive State
    const [showArchived, setShowArchived] = useState(false)

    // Document State
    const [documents, setDocuments] = useState([])
    const [previewDoc, setPreviewDoc] = useState(null)
    const [batchModalOpen, setBatchModalOpen] = useState(false)

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            openCreateModal()
            searchParams.delete('action')
            setSearchParams(searchParams, { replace: true })
        }
    }, [searchParams])

    useEffect(() => {
        if (currentCompany) {
            loadData()
        } else {
            setInsurances([])
            setVehicles([])
            setLoading(false)
        }
    }, [currentCompany, showArchived]) // Reload on toggle

    // Real-time synchronization listener
    const loadDataRef = useRef(null)
    useEffect(() => {
        loadDataRef.current = loadData
    })
    useEffect(() => {
        if (!currentCompany) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if (['insurances', 'vehicles', 'documents'].includes(change?.table)) {
                console.log(`[RealTime] Insurance reloading for change in ${change.table}`)
                loadDataRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const loadData = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            const [insResult, vehiclesResult, documentsResult] = await Promise.all([
                window.electronAPI.getAllInsurances(currentCompany.id, showArchived ? 1 : 0),
                window.electronAPI.getVehicles(currentCompany.id),
                window.electronAPI.getAllDocuments(currentCompany.id)
            ])

            if (insResult.success) setInsurances(insResult.data)
            if (vehiclesResult.success) setVehicles(vehiclesResult.data)
            if (documentsResult.success) setDocuments(documentsResult.data)
        } catch (error) {
            console.error('Failed to load data:', error)
        }
        if (!isBackground) setLoading(false)
    }

    const resetForm = () => {
        setEditingInsurance(null)
        setError('')
    }

    const openCreateModal = () => {
        resetForm()
        setIsModalOpen(true)
    }

    const openEditModal = (insurance) => {
        setEditingInsurance(insurance)
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        resetForm()
    }

    const handleFormSubmit = async (data) => {
        setError('')
        setSaving(true)

        const payload = {
            ...data,
            vehicleId: parseInt(data.vehicleId),
            premium: data.premium ? parseFloat(data.premium) : 0
        }

        let result
        if (editingInsurance) {
            result = await window.electronAPI.updateInsurance({ id: editingInsurance.id, ...payload })
        } else {
            result = await window.electronAPI.createInsurance(payload)
        }

        setSaving(false)

        if (result.success) {
            closeModal()
            loadData()
        } else {
            setError(result.error)
        }
    }

    const handleDeleteClick = (insurance) => {
        setConfirmModal({
            type: 'single',
            item: insurance,
            title: 'Sigorta Silme',
            message: 'Bu sigorta kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'
        })
    }

    const handleBulkDeleteClick = (ids) => {
        setConfirmModal({
            type: 'bulk',
            ids: ids,
            title: 'Toplu Silme',
            message: `${ids.length} sigorta kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        })
    }

    const handleConfirmDelete = async () => {
        if (!confirmModal) return

        if (confirmModal.type === 'single') {
            await window.electronAPI.deleteInsurance(confirmModal.item.id)
        } else if (confirmModal.type === 'bulk') {
            for (const id of confirmModal.ids) {
                await window.electronAPI.deleteInsurance(id)
            }
        }

        if (confirmModal.type === 'bulk' || confirmModal.type === 'single') loadData()
        setConfirmModal(null)
    }

    const handleBulkArchive = async (ids) => {
        if (!ids || ids.length === 0) return

        const newStatus = showArchived ? 0 : 1

        for (const id of ids) {
            await window.electronAPI.archiveItem('insurances', id, newStatus)
        }
        loadData()
    }

    const handleArchiveClick = async (item) => {
        const newStatus = showArchived ? 0 : 1
        await window.electronAPI.archiveItem('insurances', item.id, newStatus)
        loadData()
    }

    const activeColumns = [
        { key: 'vehicle_plate', label: 'Plaka' },
        { key: 'model', label: 'Model' },
        { key: 'company', label: 'Sigorta Şirketi' },
        {
            key: 'type',
            label: 'Tür',
            render: (value) => getInsuranceTypeLabel(value)
        },
        {
            key: 'start_date',
            label: 'Başlangıç',
            render: (value) => formatDate(value)
        },
        {
            key: 'end_date',
            label: 'Bitiş Tarihi',
            render: (value) => formatDate(value)
        },
        {
            key: 'end_date_status',
            label: 'Kalan Süre',
            render: (_, item) => {
                if (!item.end_date) return '-'
                const value = item.end_date
                const color = getStatusColor(value)
                return <span className={`badge badge-${color}`}>{getDaysUntilText(value)}</span>
            }
        },
        {
            key: 'premium',
            label: 'Prim',
            render: (value) => formatCurrency(value)
        },
        {
            key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell(row)
        }
    ]

    const archivedColumns = [
        { key: 'vehicle_plate', label: 'Plaka' },
        { key: 'model', label: 'Model' },
        { key: 'company', label: 'Sigorta Şirketi' },
        {
            key: 'type',
            label: 'Tür',
            render: (value) => getInsuranceTypeLabel(value)
        },
        {
            key: 'start_date',
            label: 'Başlangıç',
            render: (value) => formatDate(value)
        },
        {
            key: 'end_date',
            label: 'Bitiş Tarihi',
            render: (value) => formatDate(value)
        },
        {
            key: 'premium',
            label: 'Prim',
            render: (value) => formatCurrency(value)
        },
        {
            key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell(row)
        }
    ]

    const columns = showArchived ? archivedColumns : activeColumns

    // Document Helpers
    const getDocument = (insuranceId) => {
        const found = documents.find(d => d.related_type === 'insurance' && Number(d.related_id) === Number(insuranceId))
        if (found) return found
        const ins = insurances.find(i => i.id === insuranceId)
        if (ins?.file_path) {
            return {
                id: null,
                file_name: ins.file_path,
                file_path: ins.file_path,
                file_type: '.' + (ins.file_path.split('.').pop() || ''),
                related_type: 'insurance',
                related_id: insuranceId
            }
        }
        return null
    }

    const renderDocumentCell = (row) => {
        const doc = getDocument(row.id)
        if (doc) {
            return (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <div
                        onClick={(e) => { e.stopPropagation(); handleDocumentOpen(doc) }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 8px', borderRadius: '6px',
                            background: 'var(--accent-subtle)', color: 'var(--accent-primary)',
                            fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: '1px solid transparent',
                            transition: 'all 0.2s', width: 'fit-content'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                        title={doc.file_name}
                    >
                        <Eye size={12} />
                        <span>Gör</span>
                    </div>
                </div>
            )
        } else {
            return (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(row) }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            border: '1px dashed var(--border-color)', background: 'transparent',
                            padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
                            color: 'var(--text-muted)', fontSize: '11px', width: 'fit-content', justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                        title="Dosya Ekle"
                    >
                        <Plus size={12} />
                        <span>Ekle</span>
                    </button>
                </div>
            )
        }
    }

    const handleDocumentOpen = async (doc) => {
        if (!doc) return

        const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(doc.file_type?.toLowerCase())
        const isPdf = doc.file_type?.toLowerCase() === '.pdf'

        if (isImage || isPdf) {
            const result = await window.electronAPI.readDocumentData(doc.file_path)
            if (result.success) {
                setPreviewDoc({ ...doc, data: result.data, name: doc.file_name, path: doc.file_path })
            } else {
                setPreviewDoc({ ...doc, notFound: true, error: result.error, name: doc.file_name, path: doc.file_path })
            }
        } else {
            const error = await window.electronAPI.openDocument(doc.file_path)
            if (error) {
                setPreviewDoc({ ...doc, notFound: true, error: typeof error === 'string' ? error : 'Dosya açılamadı', name: doc.file_name, path: doc.file_path })
            }
        }
    }

    const handleDocumentDelete = async () => {
        if (!previewDoc) return
        setConfirmModal({
            title: 'Belgeyi Sil',
            message: 'Bu belgeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
            confirmText: 'Sil',
            type: 'danger',
            onConfirm: async () => {
                let result
                if (previewDoc.id) {
                    result = await window.electronAPI.deleteDocument(previewDoc.id)
                } else if (previewDoc.related_id) {
                    result = await window.electronAPI.updateInsurance({ id: previewDoc.related_id, filePath: null })
                }
                if (result?.success) {
                    loadData()
                    setPreviewDoc(null)
                    setConfirmModal(null)
                } else {
                    alert('Silme hatası: ' + (result?.error || 'Bilinmeyen hata'))
                }
            }
        })
    }

    const handleBatchSaveItem = async (vehicleId, data) => {
        const payload = {
            companyId: currentCompany.id,
            vehicleId: vehicleId,
            type: data.type,
            insuranceCompany: data.insuranceCompany,
            policyNumber: data.policyNumber,
            startDate: data.startDate,
            endDate: data.endDate,
            cost: data.cost ? parseFloat(data.cost) : null,
            notes: data.notes
        }

        const result = await window.electronAPI.createInsurance(payload)

        if (result.success) {
            if (data.filePath) {
                await window.electronAPI.addDocument({
                    vehicleId: vehicleId,
                    relatedType: 'insurance',
                    relatedId: result.data.id,
                    filePath: data.filePath
                })
            }
            
            const res = await window.electronAPI.getAllInsurances(currentCompany.id, showArchived ? 1 : 0)
            if (res.success) setInsurances(res.data)
            
            const docsRes = await window.electronAPI.getAllDocuments(currentCompany.id)
            if (docsRes.success) setDocuments(docsRes.data)
            
            return true
        } else {
            alert('Kayıt kaydedilirken hata oluştu: ' + result.error)
            return false
        }
    }

    if (!currentCompany) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><Building2 /></div>
                <h2 className="empty-state-title">Şirket Seçilmedi</h2>
                <p className="empty-state-desc">Sigorta kayıtlarını görüntülemek için lütfen bir şirket seçin.</p>
            </div>
        )
    }


    return (
        <div>
            <TopProgressBar loading={loading} />
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sigorta Yönetimi</h1>
                    <p style={{ marginTop: '5px', color: '#666' }}>Sigorta poliçe takibi.</p>
                </div>
                <div className="page-actions" style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => setBatchModalOpen(true)} disabled={vehicles.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={16} />
                        Toplu Ekle
                    </button>
                    <button className="btn btn-primary" onClick={openCreateModal} disabled={vehicles.length === 0}>
                        <Plus size={18} />
                        Yeni Ekle
                    </button>
                </div>
            </div>

            {/* Dynamic Vehicle Type Tabs */}
            {(() => {
                const existingTypes = [...new Set(vehicles.map(v => v.type).filter(Boolean))];
                if (vehicles.length === 0) return null;

                const tabs = existingTypes.map(t => ({ 
                    value: t, 
                    label: getVehicleTypeLabel(t), 
                    count: insurances.filter(i => { const v = vehicles.find(vv => vv.id === i.vehicle_id); return v && v.type === t; }).length 
                }));
                
                return (
                    <div className="vehicle-tabs">
                        <button className={`vehicle-tab${activeTab === 'all' ? ' active' : ''}`} onClick={() => setActiveTab('all')}>
                            Tümü <span className="vehicle-tab-count">{insurances.length}</span>
                        </button>
                        {tabs.map(tab => (
                            <button key={tab.value} className={`vehicle-tab${activeTab === tab.value ? ' active' : ''}`} onClick={() => setActiveTab(tab.value)}>
                                {tab.label} <span className="vehicle-tab-count">{tab.count}</span>
                            </button>
                        ))}
                    </div>
                );
            })()}

            <DataTable
                columns={columns}
                data={activeTab === 'all' ? insurances : insurances.filter(i => { const v = vehicles.find(vv => vv.id === i.vehicle_id); return v && v.type === activeTab; })}
                persistenceKey={`insurance_table_${activeTab}`}
                showSearch={true}
                showCheckboxes={true}
                showDateFilter={true}
                dateFilterKey="start_date"
                emptyMessage={showArchived ? "Arşivlenmiş sigorta kaydı bulunmuyor." : "Henüz sigorta kaydı bulunmuyor."}
                filters={[
                    {
                        key: 'type',
                        label: 'Sigorta Türü',
                        options: insuranceTypes
                    }
                ]}
                onBulkDelete={handleBulkDeleteClick}
                onBulkArchive={handleBulkArchive}
                isArchiveView={showArchived}
                onToggleArchiveView={setShowArchived}
                initialSort={{ key: 'end_date', direction: 'asc' }}
                actions={(item) => (
                    <>
                        <button title="Düzenle" onClick={() => openEditModal(item)}><Pencil size={16} /></button>
                        <button 
                            title={showArchived ? "Arşivden Çıkar" : "Arşivle"} 
                            onClick={() => handleArchiveClick(item)}
                        >
                            {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                        </button>
                        <button title="Sil" className="danger" onClick={() => handleDeleteClick(item)}><Trash2 size={16} /></button>
                    </>
                )}
            />

            {insurances.length === 0 && vehicles.length === 0 && !loading && !showArchived && (
                <div className="empty-state" style={{ marginTop: '40px', border: 'none', background: 'transparent' }}>
                    <div className="empty-state-icon"><Shield /></div>
                    <h2 className="empty-state-title">Sigorta Kaydı Yok</h2>
                    <p className="empty-state-desc">Önce araç eklemeniz gerekiyor.</p>
                    <div style={{ marginTop: '16px' }}>
                        <button className="btn btn-primary" onClick={() => window.location.href = '#/vehicles'}>
                            <Plus size={18} />
                            Araç Ekle
                        </button>
                    </div>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingInsurance ? 'Sigorta Düzenle' : 'Yeni Sigorta'}
                size="lg"
                footer={null}
            >
                <InsuranceForm
                    initialData={editingInsurance}
                    onSubmit={handleFormSubmit}
                    onCancel={closeModal}
                    vehicles={vehicles}
                    error={error}
                />
            </Modal>

            <ConfirmModal
                isOpen={!!confirmModal}
                onClose={() => setConfirmModal(null)}
                onConfirm={handleConfirmDelete}
                title={confirmModal?.title}
                message={confirmModal?.message}
            />

            <DocumentPreviewModal
                doc={previewDoc}
                onClose={() => setPreviewDoc(null)}
                onDelete={handleDocumentDelete}
            />

            <BatchOperationModal
                isOpen={batchModalOpen}
                onClose={() => setBatchModalOpen(false)}
                title="Toplu Sigorta Ekle"
                vehicles={vehicles}
                formComponent={InsuranceForm}
                onSaveItem={handleBatchSaveItem}
            />
        </div>
    )
}
