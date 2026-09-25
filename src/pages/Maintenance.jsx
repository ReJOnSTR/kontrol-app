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
// FileUploader removed
import MaintenanceForm from '../components/forms/MaintenanceForm'
import {
    maintenanceTypes,
    getMaintenanceTypeLabel,
    getVehicleTypeLabel,
    formatDate,
    formatCurrency,
    getDaysUntilText,
    getStatusColor
} from '../utils/helpers'
import { Plus, Pencil, Trash2, Wrench, Building2, Eye, Archive, ArchiveRestore } from 'lucide-react'
import DocumentPreviewModal from '../components/DocumentPreviewModal'
import BatchOperationModal from '../components/BatchOperationModal'

export default function Maintenance() {
    const { currentCompany } = useCompany()
    const [searchParams, setSearchParams] = useSearchParams()
    const [maintenances, setMaintenances] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingMaintenance, setEditingMaintenance] = useState(null)
    // formData removed
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [activeTab, setActiveTab] = usePersistentTab('Maintenance', 'all')

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
            setMaintenances([])
            setVehicles([])
            setLoading(false)
        }
    }, [currentCompany, showArchived]) // Reload when archive toggle changes

    // Real-time synchronization listener
    const loadDataRef = useRef(null)
    useEffect(() => {
        loadDataRef.current = loadData
    })
    useEffect(() => {
        if (!currentCompany) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if (['maintenances', 'vehicles', 'documents'].includes(change?.table)) {
                console.log(`[RealTime] Maintenance reloading for change in ${change.table}`)
                loadDataRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const loadData = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            const [maintResult, vehiclesResult, documentsResult] = await Promise.all([
                window.electronAPI.getAllMaintenances(currentCompany.id, showArchived ? 1 : 0),
                window.electronAPI.getVehicles(currentCompany.id),
                window.electronAPI.getAllDocuments(currentCompany.id)
            ])

            if (maintResult.success) setMaintenances(maintResult.data)
            if (vehiclesResult.success) setVehicles(vehiclesResult.data)
            if (documentsResult.success) setDocuments(documentsResult.data)
        } catch (error) {
            console.error('Failed to load data:', error)
        }
        if (!isBackground) setLoading(false)
    }

    const resetForm = () => {
        setEditingMaintenance(null)
        setError('')
    }

    const openCreateModal = () => {
        resetForm()
        setIsModalOpen(true)
    }

    const openEditModal = (maintenance) => {
        setEditingMaintenance(maintenance)
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        resetForm()
    }

    const handleFormSubmit = async (data) => {
        setError('')
        setSaving(true)

        // Ensure proper types
        const payload = {
            ...data,
            vehicleId: parseInt(data.vehicleId),
            cost: data.cost ? parseFloat(data.cost) : 0,
            nextKm: data.nextKm ? parseInt(data.nextKm) : null
        }

        let result
        if (editingMaintenance) {
            result = await window.electronAPI.updateMaintenance({ id: editingMaintenance.id, ...payload })
        } else {
            result = await window.electronAPI.createMaintenance(payload)
        }

        setSaving(false)

        if (result.success) {
            closeModal()
            loadData()
        } else {
            setError(result.error)
        }
    }

    const handleDeleteClick = (maintenance) => {
        setConfirmModal({
            type: 'single',
            item: maintenance,
            title: 'Bakım Silme',
            message: 'Bu bakım kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'
        })
    }

    const handleBulkDeleteClick = (ids) => {
        setConfirmModal({
            type: 'bulk',
            ids: ids,
            title: 'Toplu Silme',
            message: `${ids.length} bakım kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        })
    }

    const handleConfirmDelete = async () => {
        if (!confirmModal) return

        if (confirmModal.type === 'single') {
            await window.electronAPI.deleteMaintenance(confirmModal.item.id)
        } else if (confirmModal.type === 'bulk') {
            for (const id of confirmModal.ids) {
                await window.electronAPI.deleteMaintenance(id)
            }
        }

        if (confirmModal.type === 'bulk' || confirmModal.type === 'single') loadData()
        setConfirmModal(null)
    }

    const handleBulkArchive = async (ids) => {
        if (!ids || ids.length === 0) return

        // Calculate new archive status (toggle)
        const newStatus = showArchived ? 0 : 1

        for (const id of ids) {
            await window.electronAPI.archiveItem('maintenances', id, newStatus)
        }
        loadData()
    }

    const handleArchiveClick = async (item) => {
        const newStatus = showArchived ? 0 : 1
        await window.electronAPI.archiveItem('maintenances', item.id, newStatus)
        loadData()
    }

    const activeColumns = [
        { key: 'vehicle_plate', label: 'Plaka' },
        { key: 'model', label: 'Model' },
        {
            key: 'type',
            label: 'Bakım Türü',
            render: (value) => getMaintenanceTypeLabel(value)
        },
        {
            key: 'date',
            label: 'Bakım Tarihi',
            render: (value) => formatDate(value)
        },
        {
            key: 'next_date',
            label: 'Sonraki Bakım',
            render: (value) => formatDate(value)
        },
        {
            key: 'next_date_status',
            label: 'Kalan Süre',
            render: (_, item) => {
                if (!item.next_date) return '-'
                const value = item.next_date
                const color = getStatusColor(value)
                return <span className={`badge badge-${color}`}>{getDaysUntilText(value)}</span>
            }
        },
        {
            key: 'cost',
            label: 'Maliyet',
            render: (value) => formatCurrency(value)
        },
        {
            key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell(row)
        }
    ]

    const archivedColumns = [
        { key: 'vehicle_plate', label: 'Plaka' },
        { key: 'model', label: 'Model' },
        {
            key: 'type',
            label: 'Bakım Türü',
            render: (value) => getMaintenanceTypeLabel(value)
        },
        {
            key: 'date',
            label: 'Bakım Tarihi',
            render: (value) => formatDate(value)
        },
        // In archive, next_date is just historical info
        {
            key: 'next_date',
            label: 'Planlanan Sonraki',
            render: (value) => formatDate(value)
        },
        {
            key: 'cost',
            label: 'Maliyet',
            render: (value) => formatCurrency(value)
        },
        {
            key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell(row)
        }
    ]

    const columns = showArchived ? archivedColumns : activeColumns

    // Document Helpers
    const getDocument = (maintId) => {
        const found = documents.find(d => d.related_type === 'maintenance' && Number(d.related_id) === Number(maintId))
        if (found) return found
        const maint = maintenances.find(m => m.id === maintId)
        if (maint?.file_path) {
            return {
                id: null,
                file_name: maint.file_path,
                file_path: maint.file_path,
                file_type: '.' + (maint.file_path.split('.').pop() || ''),
                related_type: 'maintenance',
                related_id: maintId
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
            const res = await window.electronAPI.readDocumentData(doc.file_path)
            if (res.success) {
                setPreviewDoc({
                    id: doc.id,
                    name: doc.file_name,
                    path: doc.file_path,
                    data: res.data
                })
            } else {
                setPreviewDoc({
                    id: doc.id,
                    name: doc.file_name,
                    path: doc.file_path,
                    notFound: true,
                    error: res.error
                })
            }
        } else {
            const result = await window.electronAPI.openDocument(doc.file_path)
            if (!result.success) {
                setPreviewDoc({
                    id: doc.id,
                    name: doc.file_name,
                    path: doc.file_path,
                    notFound: true,
                    error: result.error
                })
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
                    result = await window.electronAPI.updateMaintenance({ id: previewDoc.related_id, filePath: null })
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

    if (!currentCompany) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><Building2 /></div>
                <h2 className="empty-state-title">Şirket Seçilmedi</h2>
                <p className="empty-state-desc">Bakım kayıtlarını görüntülemek için lütfen bir şirket seçin.</p>
            </div>
        )
    }

    const handleBatchSaveItem = async (vehicleId, data) => {
        const payload = {
            companyId: currentCompany.id,
            vehicleId: vehicleId,
            type: data.type,
            description: data.description,
            date: data.date,
            cost: data.cost ? parseFloat(data.cost) : null,
            km: data.km ? parseInt(data.km) : null,
            nextKm: data.nextKm ? parseInt(data.nextKm) : null,
            nextDate: data.nextDate || null,
            notes: data.notes
        }

        const result = await window.electronAPI.createMaintenance(payload)

        if (result.success) {
            if (data.filePath) {
                await window.electronAPI.addDocument({
                    vehicleId: vehicleId,
                    relatedType: 'maintenance',
                    relatedId: result.data.id,
                    filePath: data.filePath
                })
            }
            
            const res = await window.electronAPI.getAllMaintenances(currentCompany.id, showArchived ? 1 : 0)
            if (res.success) setMaintenances(res.data)
            
            const docsRes = await window.electronAPI.getAllDocuments(currentCompany.id)
            if (docsRes.success) setDocuments(docsRes.data)
            
            return true
        } else {
            alert('Kayıt kaydedilirken hata oluştu: ' + result.error)
            return false
        }
    }
    return (
        <div>
            <TopProgressBar loading={loading} />
            <div className="page-header">
                <div>
                    <h1 className="page-title">Araç Bakımları</h1>
                    <p style={{ marginTop: '5px', color: '#666' }}>Araç bakım ve onarım takibi.</p>
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
                const existingTypes = [...new Set(vehicles.filter(v => (activeTab === 'all' || activeTab === v.type)).map(v => v.type).filter(Boolean))];
                // If we have any vehicles, we might have tabs. If no vehicles, show nothing.
                if (vehicles.length === 0) return null;
                
                const tabs = [...new Set(vehicles.map(v => v.type).filter(Boolean))].map(t => ({ 
                    value: t, 
                    label: getVehicleTypeLabel(t), 
                    count: maintenances.filter(m => { const v = vehicles.find(vv => vv.id === m.vehicle_id); return v && v.type === t; }).length 
                }));
                
                return (
                    <div className="vehicle-tabs">
                        <button className={`vehicle-tab${activeTab === 'all' ? ' active' : ''}`} onClick={() => setActiveTab('all')}>
                            Tümü <span className="vehicle-tab-count">{maintenances.length}</span>
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
                data={activeTab === 'all' ? maintenances : maintenances.filter(m => { const v = vehicles.find(vv => vv.id === m.vehicle_id); return v && v.type === activeTab; })}
                persistenceKey={`maintenance_table_${activeTab}`}
                showSearch={true}
                showCheckboxes={true}
                showDateFilter={true}
                dateFilterKey="date"
                emptyMessage={showArchived ? "Arşivlenmiş bakım kaydı bulunmuyor." : "Henüz bakım kaydı bulunmuyor."}
                searchKeys={['plate', 'vendor', 'type', 'status', 'description']}
                filters={[
                    {
                        key: 'status',
                        label: 'Durum',
                        options: [
                            { value: 'completed', label: 'Tamamlandı' },
                            { value: 'pending', label: 'Bekliyor' },
                            { value: 'in_progress', label: 'Devam Ediyor' }
                        ]
                    }
                ]}
                onBulkDelete={handleBulkDeleteClick}
                onBulkArchive={handleBulkArchive}
                isArchiveView={showArchived}
                onToggleArchiveView={setShowArchived}
                initialSort={{ key: 'next_date', direction: 'asc' }}
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

            {maintenances.length === 0 && vehicles.length === 0 && !loading && !showArchived && (
                <div className="empty-state" style={{ marginTop: '40px', border: 'none', background: 'transparent' }}>
                    <div className="empty-state-icon"><Wrench /></div>
                    <h2 className="empty-state-title">Bakım Kaydı Yok</h2>
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
                title={editingMaintenance ? 'Bakım Düzenle' : 'Yeni Bakım'}
                size="lg"
                footer={null}
            >
                <MaintenanceForm
                    initialData={editingMaintenance}
                    onSubmit={handleFormSubmit}
                    onCancel={closeModal}
                    vehicles={vehicles}
                    loading={saving}
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
                title="Toplu Bakım Kaydı Ekle"
                vehicles={vehicles}
                formComponent={MaintenanceForm}
                onSaveItem={handleBatchSaveItem}
            />
        </div>
    )
}
