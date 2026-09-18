import TopProgressBar from '../components/TopProgressBar'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import DataTable from '../components/DataTable'
import CustomSelect from '../components/CustomSelect'
import CustomInput from '../components/CustomInput'

import { formatDate, getVehicleTypeLabel } from '../utils/helpers'
import { Plus, Check, Truck, Pencil, Trash2, Calendar, FileText, LayoutList, Building2 } from 'lucide-react'
import { usePersistentTab } from '../hooks/usePersistentTab'
import DocumentPreviewModal from '../components/DocumentPreviewModal'
import AssignmentForm from '../components/forms/AssignmentForm'
import BatchOperationModal from '../components/BatchOperationModal'

export default function Assignments() {
    const { currentCompany } = useCompany()
    const [searchParams, setSearchParams] = useSearchParams()
    const [assignments, setAssignments] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingAssignment, setEditingAssignment] = useState(null)
    // formData removed
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [activeTab, setActiveTab] = usePersistentTab('Assignments', 'all')
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
            setAssignments([])
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
            if (['assignments', 'vehicles', 'documents'].includes(change?.table)) {
                console.log(`[RealTime] Assignments reloading for change in ${change.table}`)
                loadDataRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const loadData = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            const [assignResult, vehiclesResult, documentsResult] = await Promise.all([
                window.electronAPI.getAllAssignments(currentCompany.id, showArchived ? 1 : 0),
                window.electronAPI.getVehicles(currentCompany.id),
                window.electronAPI.getAllDocuments(currentCompany.id)
            ])

            if (assignResult.success) setAssignments(assignResult.data)
            if (vehiclesResult.success) setVehicles(vehiclesResult.data)
            if (documentsResult.success) setDocuments(documentsResult.data)
        } catch (error) {
            console.error('Failed to load data:', error)
        }
        if (!isBackground) setLoading(false)
    }

    const resetForm = () => {
        setEditingAssignment(null)
        setError('')
    }

    const openCreateModal = () => {
        resetForm()
        setIsModalOpen(true)
    }

    const openEditModal = (assignment) => {
        setEditingAssignment(assignment)
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
            quantity: parseInt(data.quantity) || 1
        }

        let result
        if (editingAssignment) {
            result = await window.electronAPI.updateAssignment({ id: editingAssignment.id, ...payload })
        } else {
            result = await window.electronAPI.createAssignment(payload)
        }

        setSaving(false)

        if (result.success) {
            closeModal()
            loadData()
        } else {
            setError(result.error)
        }
    }

    const handleDeleteClick = (assignment) => {
        setConfirmModal({
            type: 'single',
            item: assignment,
            title: 'Zimmet Silme',
            message: 'Bu zimmet kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'
        })
    }

    const handleBulkDeleteClick = (ids) => {
        setConfirmModal({
            type: 'bulk',
            ids: ids,
            title: 'Toplu Silme',
            message: `${ids.length} zimmet kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        })
    }

    const handleConfirmDelete = async () => {
        if (!confirmModal) return

        if (confirmModal.type === 'single') {
            await window.electronAPI.deleteAssignment(confirmModal.item.id)
        } else if (confirmModal.type === 'bulk') {
            for (const id of confirmModal.ids) {
                await window.electronAPI.deleteAssignment(id)
            }
        }

        if (confirmModal.type === 'bulk' || confirmModal.type === 'single') loadData()
        setConfirmModal(null)
    }

    const handleBulkArchive = async (ids) => {
        if (!ids || ids.length === 0) return

        const newStatus = showArchived ? 0 : 1

        for (const id of ids) {
            await window.electronAPI.archiveItem('assignments', id, newStatus)
        }
        loadData()
    }

    const activeColumns = [
        { key: 'vehicle_plate', label: 'Araç Plaka' },
        { key: 'model', label: 'Araç Model' },
        { key: 'driver_name', label: 'Sürücü Adı' },
        { key: 'driver_phone', label: 'Telefon' },
        {
            key: 'start_date',
            label: 'Başlangıç Tarihi',
            render: (value) => formatDate(value)
        },
        {
            key: 'end_date',
            label: 'Bitiş Tarihi',
            render: (value) => value ? formatDate(value) : '-'
        },
        {
            key: 'notes',
            label: 'Notlar',
            render: (value) => value || '-'
        },
        {
            key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell(row)
        }
    ]

    const archivedColumns = [
        { key: 'vehicle_plate', label: 'Araç Plaka' },
        { key: 'model', label: 'Araç Model' },
        { key: 'driver_name', label: 'Sürücü Adı' },
        {
            key: 'start_date',
            label: 'Başlangıç Tarihi',
            render: (value) => formatDate(value)
        },
        {
            key: 'end_date',
            label: 'Bitiş Tarihi',
            render: (value) => formatDate(value)
        },
        {
            key: 'notes',
            label: 'Notlar',
            render: (value) => value || '-'
        },
        {
            key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell(row)
        }
    ]

    const columns = showArchived ? archivedColumns : activeColumns

    // Document Helpers
    const getDocument = (assignId) => {
        const found = documents.find(d => d.related_type === 'assignment' && Number(d.related_id) === Number(assignId))
        if (found) return found
        const assign = assignments.find(a => a.id === assignId)
        if (assign?.file_path) {
            return {
                id: null,
                file_name: assign.file_path,
                file_path: assign.file_path,
                file_type: '.' + (assign.file_path.split('.').pop() || ''),
                related_type: 'assignment',
                related_id: assignId
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
                    result = await window.electronAPI.updateAssignment({ id: previewDoc.related_id, filePath: null })
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
                <p className="empty-state-desc">Zimmet kayıtlarını görüntülemek için lütfen bir şirket seçin.</p>
            </div>
        )
    }
    const handleBatchSaveItem = async (vehicleId, data) => {
        const payload = {
            companyId: currentCompany.id,
            vehicleId: vehicleId,
            employeeId: parseInt(data.employeeId),
            assignedDate: data.assignedDate,
            notes: data.notes
        }

        const result = await window.electronAPI.createAssignment(payload)

        if (result.success) {
            if (data.filePath) {
                await window.electronAPI.addDocument({
                    vehicleId: vehicleId,
                    relatedType: 'assignment',
                    relatedId: result.data.id,
                    filePath: data.filePath
                })
            }
            
            const assignmentsRes = await window.electronAPI.getAllAssignments(currentCompany.id, showArchived ? 1 : 0)
            if (assignmentsRes.success) setAssignments(assignmentsRes.data)
            
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
                    <h1 className="page-title">Zimmet Yönetimi</h1>
                    <p style={{ marginTop: '5px', color: '#666' }}>Araç sürücü zimmetleri.</p>
                </div>
                <div className="page-actions" style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => setBatchModalOpen(true)} disabled={vehicles.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={16} />
                        Toplu Ekle
                    </button>
                    <button className="btn btn-primary" onClick={openCreateModal} disabled={vehicles.length === 0}>
                        <Plus size={18} />
                        Yeni Zimmet
                    </button>
                </div>
            </div>

            {/* Dynamic Vehicle Type Tabs */}
            {(() => {
                const existingTypes = [...new Set(vehicles.map(v => v.type).filter(Boolean))];
                const tabs = existingTypes.map(t => ({ value: t, label: getVehicleTypeLabel(t), count: assignments.filter(a => { const v = vehicles.find(vv => vv.id === a.vehicle_id); return v && v.type === t; }).length }));
                
                return (
                    <div className="vehicle-tabs">
                        <button className={`vehicle-tab${activeTab === 'all' ? ' active' : ''}`} onClick={() => setActiveTab('all')}>
                            Tümü <span className="vehicle-tab-count">{assignments.length}</span>
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
                data={activeTab === 'all' ? assignments : assignments.filter(a => { const v = vehicles.find(vv => vv.id === a.vehicle_id); return v && v.type === activeTab; })}
                persistenceKey={`assignments_table_${activeTab}`}
                showSearch={true}
                showCheckboxes={true}
                showDateFilter={true}
                dateFilterKey="start_date"
                searchKeys={['vehicle_plate', 'model', 'driver_name', 'driver_phone', 'notes']}
                filters={[
                    {
                        key: 'status',
                        label: 'Durum',
                        options: [
                            { value: 'active', label: 'Aktif' },
                            { value: 'returned', label: 'İade Edildi' }
                        ]
                    }
                ]}
                onBulkDelete={handleBulkDeleteClick}
                onBulkArchive={handleBulkArchive}
                isArchiveView={showArchived}
                onToggleArchiveView={setShowArchived}
                actions={(item) => (
                    <>
                        <button title="Düzenle" onClick={() => openEditModal(item)}><Pencil size={16} /></button>
                        <button title="Sil" className="danger" onClick={() => handleDeleteClick(item)}><Trash2 size={16} /></button>
                    </>
                )}
            />

            {assignments.length === 0 && vehicles.length === 0 && (
                <div className="empty-state" style={{ marginTop: '24px' }}>
                    <div className="empty-state-icon"><LayoutList /></div>
                    <h2 className="empty-state-title">Zimmet Kaydı Yok</h2>
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
                title={editingAssignment ? 'Demirbaş Düzenle' : 'Yeni Demirbaş/Zimmet'}
                footer={null}
            >
                <AssignmentForm
                    initialData={editingAssignment}
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
                title="Toplu Zimmet Kaydı Ekle"
                vehicles={vehicles}
                formComponent={AssignmentForm}
                onSaveItem={handleBatchSaveItem}
            />
        </div>
    )
}
