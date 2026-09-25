import { useState, useEffect, useRef } from 'react'
import TopProgressBar from '../components/TopProgressBar'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import { useTabs } from '../context/TabContext'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import CustomSelect from '../components/CustomSelect'

import CustomInput from '../components/CustomInput'
import ConfirmModal from '../components/ConfirmModal'
import DocumentPreviewModal from '../components/DocumentPreviewModal'

import {
    formatCurrency, formatDate, getDaysUntilText, getStatusColor,
    getVehicleTypeLabel, getMaintenanceTypeLabel, getInsuranceTypeLabel,
    insuranceTypes, maintenanceTypes, serviceTypes, getVehicleStatusInfo
} from '../utils/helpers'
import {
    ArrowLeft,
    Car,
    Wrench,
    ClipboardCheck,
    Shield,
    UserCheck,
    Plus,
    Pencil,
    Trash2,
    Calendar,
    Settings,
    Building2,
    Activity,
    FileText,
    X,
    ExternalLink,
    Upload,
    Eye,
    Trash,
    ChevronRight,
    Folder,
    Archive,
    ArchiveRestore
} from 'lucide-react'
import VehicleForm from '../components/VehicleForm'
import FileUploader from '../components/FileUploader'
import MaintenanceForm from '../components/forms/MaintenanceForm'
import ServiceForm from '../components/forms/ServiceForm'
import InspectionForm from '../components/forms/InspectionForm'
import InsuranceForm from '../components/forms/InsuranceForm'
import { usePersistentTab } from '../hooks/usePersistentTab'
import AssignmentForm from '../components/forms/AssignmentForm'
import DocumentForm from '../components/forms/DocumentForm'

const StatCard = ({ label, value, valueColor }) => (
    <div style={{ 
        backgroundColor: 'var(--bg-secondary)', 
        padding: '14px 16px', 
        borderRadius: '12px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '4px',
        border: '1px solid var(--border-color)'
    }}>
        <div style={{ 
            fontSize: '11px', 
            color: 'var(--text-muted)', 
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.3px'
        }}>
            {label}
        </div>
        <div style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: valueColor || 'var(--text-primary)', 
            lineHeight: 1.2,
            letterSpacing: '-0.3px'
        }}>
            {value}
        </div>
    </div>
)

export default function VehicleDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { currentCompany } = useCompany()
    const { updateTabInfo } = useTabs()

    const [vehicle, setVehicle] = useState(null)
    const [activeTab, setActiveTab] = usePersistentTab('VehicleDetail', 'maintenance')
    const [tabsRef] = useState({})
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
    const [loading, setLoading] = useState(true)

    // Data states
    const [maintenances, setMaintenances] = useState([])
    const [inspections, setInspections] = useState([])
    const [insurances, setInsurances] = useState([])
    const [assignments, setAssignments] = useState([])
    const [services, setServices] = useState([])
    const [documents, setDocuments] = useState([])

    // Preview state
    const [previewDoc, setPreviewDoc] = useState(null)

    // Upload Modal state
    const [uploadModalOpen, setUploadModalOpen] = useState(false)
    const [selectedUploadFile, setSelectedUploadFile] = useState(null)

    // Modal states
    const [modalType, setModalType] = useState(null)
    const [editingItem, setEditingItem] = useState(null)
    const [formData, setFormData] = useState({})

    // File upload state for operation modals
    const [selectedFile, setSelectedFile] = useState(null)

    const [activeUploadContext, setActiveUploadContext] = useState(null) // { type, id }
    const [showArchived, setShowArchived] = useState(false)

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    
    // Document Edit states
    const [editDocModalOpen, setEditDocModalOpen] = useState(false)
    const [editingDoc, setEditingDoc] = useState(null)
    const [uploadFileName, setUploadFileName] = useState('')
    const [uploadStartDate, setUploadStartDate] = useState('')
    const [uploadEndDate, setUploadEndDate] = useState('')
    const [documentCategories, setDocumentCategories] = useState([])
    const [documentFolders, setDocumentFolders] = useState([])
    const [customFolders, setCustomFolders] = useState([])
    const [currentFolder, setCurrentFolder] = useState(null)
    const [uploadCategory, setUploadCategory] = useState('')
    const [uploadFolder, setUploadFolder] = useState('')

    // Bulk Move and Folder Operations States
    const [bulkMoveIds, setBulkMoveIds] = useState([])
    const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false)
    const [bulkMoveSelectedFolder, setBulkMoveSelectedFolder] = useState('')
    const [bulkMoveClearSelection, setBulkMoveClearSelection] = useState(null)

    // Folder Modal States
    const [folderModalOpen, setFolderModalOpen] = useState(false)
    const [folderModalMode, setFolderModalMode] = useState('create') // 'create' | 'rename'
    const [folderModalValue, setFolderModalValue] = useState('')
    const [folderModalOldValue, setFolderModalOldValue] = useState('')

    // Confirm Modal state
    const [confirmModal, setConfirmModal] = useState(null) // { type, item, ids, title, message }

    useEffect(() => {
        if (currentCompany) {
            loadVehicleData()
            loadCategories()
            loadFolders()
        }
    }, [currentCompany, id, showArchived])

    // Real-time synchronization listener
    const loadVehicleDataRef = useRef(null)
    useEffect(() => {
        loadVehicleDataRef.current = loadVehicleData
    })
    useEffect(() => {
        if (!id) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if ([
                'vehicles', 'maintenances', 'inspections', 'insurances',
                'assignments', 'services', 'documents'
            ].includes(change?.table)) {
                console.log(`[RealTime] VehicleDetail reloading for change in ${change.table}`)
                loadVehicleDataRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [id])

    const loadCategories = async () => {
        if (!currentCompany) return
        try {
            const res = await window.electronAPI.getDocumentCategories(currentCompany.id, 'vehicle')
            if (res.success) {
                setDocumentCategories(res.data.map(t => ({ value: t.name, label: t.name, id: t.id })))
            }
        } catch (error) {
            console.error('Failed to load categories:', error)
        }
    }

    const loadFolders = async () => {
        if (!currentCompany || !id) return
        try {
            const res = await window.electronAPI.getDocumentFolders(currentCompany.id, 'vehicle', id)
            if (res.success) {
                setDocumentFolders(res.data.map(t => ({ value: t.name, label: t.name, id: t.id, is_archived: t.is_archived })))
            }
        } catch (error) {
            console.error('Failed to load folders:', error)
        }
    }

    const handleOpenCreateFolder = () => {
        setFolderModalMode('create')
        setFolderModalValue('')
        setFolderModalOpen(true)
    }

    const handleOpenRenameFolder = (oldName) => {
        setFolderModalMode('rename')
        setFolderModalValue(oldName)
        setFolderModalOldValue(oldName)
        setFolderModalOpen(true)
    }

    const handleFolderSubmit = async () => {
        const name = folderModalValue.trim()
        if (!name) return

        const exists = documentFolders.some(f => f.value.toLowerCase() === name.toLowerCase())
        if (exists && (folderModalMode === 'create' || name !== folderModalOldValue)) {
            alert('Bu isimde bir klasör zaten mevcut!')
            return
        }

        setSaving(true)
        try {
            if (folderModalMode === 'create') {
                const res = await window.electronAPI.createDocumentFolder({
                    companyId: currentCompany.id,
                    name: name,
                    relatedType: 'vehicle',
                    relatedId: id
                })
                if (res.success) {
                    loadFolders()
                    setCurrentFolder(name)
                    setFolderModalOpen(false)
                } else {
                    alert('Klasör oluşturulurken hata oluştu: ' + res.error)
                }
            } else if (folderModalMode === 'rename') {
                const folderObj = documentFolders.find(f => f.value === folderModalOldValue)
                if (folderObj) {
                    await window.electronAPI.updateDocumentFolder({ id: folderObj.id, name: name })
                } else {
                    await window.electronAPI.createDocumentFolder({ companyId: currentCompany.id, name: name })
                }
                const docsToUpdate = documents.filter(d => d.folder === folderModalOldValue)
                for (const d of docsToUpdate) {
                    await window.electronAPI.updateDocument({
                        id: d.id,
                        fileName: d.file_name,
                        startDate: d.start_date ? new Date(d.start_date).toISOString().split('T')[0] : null,
                        endDate: d.end_date ? new Date(d.end_date).toISOString().split('T')[0] : null,
                        folder: name
                    })
                }
                setCustomFolders(prev => prev.map(f => f === folderModalOldValue ? name : f))
                setCurrentFolder(name)
                loadFolders()
                loadVehicleData()
                setFolderModalOpen(false)
            }
        } catch (err) {
            console.error('Folder action error:', err)
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteFolder = (folderName) => {
        const folderObj = documentFolders.find(f => f.value === folderName)
        
        setConfirmModal({
            title: 'Klasör Silme Onayı',
            message: `"${folderName}" klasörünü silmek istediğinize emin misiniz? Klasör içindeki dosyalar silinmeyecek, Klasörsüz olacaktır.`,
            confirmText: 'Sil',
            styleType: 'danger',
            onConfirm: async () => {
                setSaving(true)
                try {
                    if (folderObj) {
                        await window.electronAPI.deleteDocumentFolder(folderObj.id)
                    }
                    const docsToUpdate = documents.filter(d => d.folder === folderName)
                    for (const d of docsToUpdate) {
                        await window.electronAPI.updateDocument({
                            id: d.id,
                            fileName: d.file_name,
                            startDate: d.start_date ? new Date(d.start_date).toISOString().split('T')[0] : null,
                            endDate: d.end_date ? new Date(d.end_date).toISOString().split('T')[0] : null,
                            folder: null
                        })
                    }
                    setCustomFolders(prev => prev.filter(f => f !== folderName))
                    setCurrentFolder(null)
                    loadFolders()
                    loadVehicleData()
                } catch (err) {
                    console.error('Delete folder error:', err)
                } finally {
                    setSaving(false)
                    setConfirmModal(null)
                }
            }
        })
    }

    const handleBulkMoveConfirm = async () => {
        if (!bulkMoveIds || bulkMoveIds.length === 0) return
        setSaving(true)
        try {
            for (const id of bulkMoveIds) {
                if (typeof id === 'string' && id.startsWith('folder_')) {
                    const folderNameStr = id.replace('folder_', '')
                    const folderObj = documentFolders.find(f => String(f.id) === String(folderNameStr) || f.value === folderNameStr)
                    const targetFolderName = folderObj?.value || folderNameStr
                    const docsInFolder = documents.filter(d => d.folder === targetFolderName)
                    for (const d of docsInFolder) {
                        await window.electronAPI.updateDocument({
                            id: d.id,
                            fileName: d.file_name,
                            startDate: d.start_date ? new Date(d.start_date).toISOString().split('T')[0] : null,
                            endDate: d.end_date ? new Date(d.end_date).toISOString().split('T')[0] : null,
                            folder: bulkMoveSelectedFolder || null
                        })
                    }
                    continue
                }
                const doc = documents.find(d => Number(d.id) === Number(id) || d.id === id)
                if (doc) {
                    await window.electronAPI.updateDocument({
                        id: doc.id,
                        fileName: doc.file_name,
                        startDate: doc.start_date ? new Date(d.start_date).toISOString().split('T')[0] : null,
                        endDate: doc.end_date ? new Date(d.end_date).toISOString().split('T')[0] : null,
                        folder: bulkMoveSelectedFolder || null
                    })
                }
            }
            if (bulkMoveClearSelection) bulkMoveClearSelection()
            setBulkMoveModalOpen(false)
            setBulkMoveSelectedFolder('')
            loadFolders()
            loadVehicleData()
        } catch (err) {
            console.error('Bulk move error:', err)
            alert('Belgeler taşınırken hata oluştu.')
        } finally {
            setSaving(false)
        }
    }

    // Calculate indicator position
    useEffect(() => {
        const activeElement = tabsRef[activeTab]
        if (activeElement) {
            setIndicatorStyle({
                left: activeElement.offsetLeft,
                width: activeElement.offsetWidth
            })
        }
    }, [activeTab, tabsRef, maintenances, services, inspections, insurances, assignments, documents]) // Recalculate if counts change

    const loadVehicleData = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            const [vehicleRes, maintRes, inspRes, insRes, assignRes, servRes, docsRes] = await Promise.all([
                window.electronAPI.getVehicleById(parseInt(id)),
                window.electronAPI.getMaintenancesByVehicle(parseInt(id)),
                window.electronAPI.getInspectionsByVehicle(parseInt(id)),
                window.electronAPI.getInsurancesByVehicle(parseInt(id)),
                window.electronAPI.getAssignmentsByVehicle(parseInt(id)),
                window.electronAPI.getServicesByVehicle(parseInt(id)),
                window.electronAPI.getDocumentsByVehicle(parseInt(id), showArchived ? 1 : 0)
            ])

            if (vehicleRes.success) {
                const v = vehicleRes.data
                setVehicle(v)
                updateTabInfo(`/vehicles/${id}`, { label: `${v.plate} ${v.brand} ${v.model}` })
            }
            if (maintRes.success) setMaintenances(maintRes.data)
            if (inspRes.success) setInspections(inspRes.data)
            if (insRes.success) setInsurances(insRes.data)
            if (assignRes.success) setAssignments(assignRes.data)
            if (servRes.success) setServices(servRes.data)
            if (docsRes.success) setDocuments(docsRes.data)
            if (insRes.success) setInsurances(insRes.data)
            if (assignRes.success) setAssignments(assignRes.data)
            if (servRes.success) setServices(servRes.data)
        } catch (error) {
            console.error('Failed to load vehicle data:', error)
        }
        if (!isBackground) setLoading(false)
    }

    const handleArchiveFolder = async (folderId, isArchived) => {
        try {
            const res = await window.electronAPI.archiveItem('document_folders', folderId, isArchived ? 1 : 0)
            if (res.success) {
                loadFolders()
            }
        } catch (err) {
            console.error('Folder archive failed:', err)
        }
    }

    const handleBulkArchiveDocs = async (ids, isArchived) => {
        try {
            for (const id of ids) {
                if (typeof id === 'string' && id.startsWith('folder_')) {
                    const folderIdStr = id.replace('folder_', '')
                    const folderObj = documentFolders.find(f => String(f.id) === String(folderIdStr) || f.value === folderIdStr)
                    if (folderObj) {
                        await window.electronAPI.archiveItem('document_folders', folderObj.id, isArchived ? 1 : 0)
                    }
                } else {
                    await window.electronAPI.archiveItem('documents', id, isArchived ? 1 : 0)
                }
            }
            loadVehicleData()
            loadFolders()
        } catch (err) {
            console.error('Bulk archive failed:', err)
        }
    }

    useEffect(() => {
        setShowArchived(false)
    }, [activeTab])

    const openAddModal = (type) => {
        setModalType(type)
        setEditingItem(null)
        setError('')
    }

    const openEditModal = (type, item) => {
        setModalType(type)
        setEditingItem(item)
        setError('')
    }

    const closeModal = () => {
        setModalType(null)
        setEditingItem(null)
        // setFormData({}) // Not needed
        setError('')
    }

    const handleVehicleSave = async (data) => {
        setSaving(true)
        setError('')

        try {
            const result = await window.electronAPI.updateVehicle({
                id: vehicle.id,
                ...data,
                year: data.year ? parseInt(data.year) : null
            })

            if (result.success) {
                closeModal()
                loadVehicleData()
            } else {
                setError(result.error)
            }
        } catch (err) {
            console.error('Vehicle save error:', err)
            setError('Bağlantı hatası')
        }
        setSaving(false)
    }

    const handleOperationSubmit = async (data) => {
        setSaving(true)
        setError('')

        let result
        let newId
        const vehicleId = parseInt(id)

        try {
            if (modalType === 'maintenance') {
                // Format data if needed (though schemas handle most coercion now)
                // Ensure vehicleId is number
                const payload = { ...data, vehicleId: parseInt(data.vehicleId), cost: data.cost ? parseFloat(data.cost) : 0, nextKm: data.nextKm ? parseInt(data.nextKm) : null }

                if (editingItem) {
                    result = await window.electronAPI.updateMaintenance({ id: editingItem.id, ...payload })
                    newId = editingItem.id
                } else {
                    result = await window.electronAPI.createMaintenance(payload)
                    newId = result.lastInsertRowid
                }
            } else if (modalType === 'inspection') {
                const payload = { ...data, vehicleId: parseInt(data.vehicleId), cost: data.cost ? parseFloat(data.cost) : 0, type: 'traffic' }

                if (editingItem) {
                    result = await window.electronAPI.updateInspection({ id: editingItem.id, ...payload })
                    newId = editingItem.id
                } else {
                    result = await window.electronAPI.createInspection(payload)
                    newId = result.lastInsertRowid
                }
            } else if (modalType === 'periodic_inspection') {
                const payload = { ...data, vehicleId: parseInt(data.vehicleId), cost: data.cost ? parseFloat(data.cost) : 0, type: 'periodic' }

                if (editingItem) {
                    result = await window.electronAPI.updateInspection({ id: editingItem.id, ...payload })
                    newId = editingItem.id
                } else {
                    result = await window.electronAPI.createInspection(payload)
                    newId = result.lastInsertRowid
                }
            } else if (modalType === 'insurance') {
                const payload = { ...data, vehicleId: parseInt(data.vehicleId), premium: data.premium ? parseFloat(data.premium) : 0 }

                if (editingItem) {
                    result = await window.electronAPI.updateInsurance({ id: editingItem.id, ...payload })
                    newId = editingItem.id
                } else {
                    result = await window.electronAPI.createInsurance(payload)
                    newId = result.lastInsertRowid
                }
            } else if (modalType === 'assignment') {
                const payload = { ...data, vehicleId: parseInt(data.vehicleId), quantity: parseInt(data.quantity) || 1 }

                if (editingItem) {
                    result = await window.electronAPI.updateAssignment({ id: editingItem.id, ...payload })
                    newId = editingItem.id
                } else {
                    result = await window.electronAPI.createAssignment(payload)
                    newId = result.lastInsertRowid
                }
            } else if (modalType === 'service') {
                const payload = { ...data, vehicleId: parseInt(data.vehicleId), cost: data.cost ? parseFloat(data.cost) : 0, km: data.km ? parseInt(data.km) : null }

                if (editingItem) {
                    result = await window.electronAPI.updateService({ id: editingItem.id, ...payload })
                    newId = editingItem.id
                } else {
                    result = await window.electronAPI.createService(payload)
                    newId = result.lastInsertRowid
                }
            }

            if (result?.success) {
                closeModal()
                loadVehicleData()
            } else {
                setError(result?.error || 'İşlem başarısız')
            }
        } catch (err) {
            console.error(err)
            setError('Bağlantı hatası')
        } finally {
            setSaving(false)
        }
    }

    const getTableName = (type) => {
        switch (type) {
            case 'maintenance': return 'maintenances'
            case 'service': return 'services'
            case 'inspection': return 'inspections'
            case 'periodic_inspection': return 'inspections'
            case 'insurance': return 'insurances'
            case 'assignment': return 'assignments'
            case 'vehicle': return 'vehicles'
            default: return type + 's'
        }
    }

    const handleBulkArchive = async (ids) => {
        if (!ids || ids.length === 0) return

        const tableName = getTableName(activeTab)
        const newStatus = showArchived ? 0 : 1

        for (const id of ids) {
            await window.electronAPI.archiveItem(tableName, id, newStatus)
        }

        loadVehicleData()
    }

    const handleDeleteClick = (type, item, ids = null) => {
        let title = 'Silme Onayı'
        let message = 'Bu kaydı silmek istediğinize emin misiniz?'

        if (ids) {
            title = 'Toplu Silme Onayı'
            message = `${ids.length} adet kaydı silmek istediğinize emin misiniz?`
        } else {
            if (type === 'maintenance') message = 'Bu bakım kaydını silmek istediğinize emin misiniz?'
            if (type === 'inspection') message = 'Bu muayene kaydını silmek istediğinize emin misiniz?'
            if (type === 'periodic_inspection') message = 'Bu periyodik kontrol kaydını silmek istediğinize emin misiniz?'
            if (type === 'insurance') message = 'Bu sigorta kaydını silmek istediğinize emin misiniz?'
            if (type === 'assignment') message = 'Bu zimmet kaydını silmek istediğinize emin misiniz?'
            if (type === 'service') message = 'Bu servis kaydını silmek istediğinize emin misiniz?'
            if (type === 'documents') {
                title = 'Belge Sil'
                message = 'Bu belgeyi silmek istediğinize emin misiniz?'
            }
        }

        setConfirmModal({ type, item, ids, title, message })
    }

    const handleConfirmDelete = async () => {
        if (!confirmModal) return

        const { type, item, ids } = confirmModal
        let result = { success: true }

        if (ids) {
            // Bulk delete
            for (const id of ids) {
                let res
                if (type === 'maintenance') res = await window.electronAPI.deleteMaintenance(id)
                else if (type === 'inspection') res = await window.electronAPI.deleteInspection(id)
                else if (type === 'periodic_inspection') res = await window.electronAPI.deleteInspection(id)
                else if (type === 'insurance') res = await window.electronAPI.deleteInsurance(id)
                else if (type === 'assignment') res = await window.electronAPI.deleteAssignment(id)
                else if (type === 'service') res = await window.electronAPI.deleteService(id)
                else if (type === 'documents') {
                    if (typeof id === 'string' && id.startsWith('folder_')) {
                        const folderIdStr = id.replace('folder_', '')
                        const folderObj = documentFolders.find(f => String(f.id) === String(folderIdStr) || f.value === folderIdStr)
                        if (folderObj) {
                            res = await window.electronAPI.deleteDocumentFolder(folderObj.id)
                        }
                        const docsToUpdate = documents.filter(d => d.folder === (folderObj?.value || folderIdStr))
                        for (const d of docsToUpdate) {
                            await window.electronAPI.updateDocument({
                                id: d.id,
                                fileName: d.file_name,
                                startDate: d.start_date ? new Date(d.start_date).toISOString().split('T')[0] : null,
                                endDate: d.end_date ? new Date(d.end_date).toISOString().split('T')[0] : null,
                                folder: null
                            })
                        }
                        res = { success: true }
                    } else {
                        res = await window.electronAPI.deleteDocument(id)
                    }
                }

                if (!res?.success) {
                    result = res // Capture error if any fails
                    break
                }
            }
        } else {
            // Single delete
            if (type === 'maintenance') result = await window.electronAPI.deleteMaintenance(item.id)
            else if (type === 'inspection') result = await window.electronAPI.deleteInspection(item.id)
            else if (type === 'periodic_inspection') result = await window.electronAPI.deleteInspection(item.id)
            else if (type === 'insurance') result = await window.electronAPI.deleteInsurance(item.id)
            else if (type === 'assignment') result = await window.electronAPI.deleteAssignment(item.id)
            else if (type === 'service') result = await window.electronAPI.deleteService(item.id)
            else if (type === 'documents') result = await window.electronAPI.deleteDocument(item.id)
        }

        setConfirmModal(null)
        if (result?.success) {
            await loadFolders()
            await loadVehicleData()
        }
    }


    if (!vehicle) {
        return (
            <div className="empty-state">
                <h2 className="empty-state-title">Araç Bulunamadı</h2>
                <button className="btn btn-primary" onClick={() => navigate('/vehicles')}>
                    Araçlara Dön
                </button>
            </div>
        )
    }

    const statusInfo = getVehicleStatusInfo(vehicle.status)

    // Calculate quick stats (Traffic Inspection)
    const trafficInspections = inspections.filter(i => i.type !== 'periodic')
    // Get latest traffic inspection
    const lastTrafficInspection = trafficInspections.sort((a, b) => new Date(b.inspection_date) - new Date(a.inspection_date))[0]

    const nextInspectionDate = lastTrafficInspection ? new Date(lastTrafficInspection.next_inspection) : (vehicle.next_inspection ? new Date(vehicle.next_inspection) : null)
    const inspectionDays = nextInspectionDate ? Math.ceil((nextInspectionDate - new Date()) / (1000 * 60 * 60 * 24)) : null
    const upcomingInspection = inspectionDays !== null && inspectionDays <= 30

    const activeInsurance = insurances.find(i => new Date(i.end_date) > new Date())
    const insuranceDays = activeInsurance ? Math.ceil((new Date(activeInsurance.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null
    const upcomingInsurance = insuranceDays !== null && insuranceDays <= 30

    const currentAssignment = assignments.find(a => !a.end_date)

    const periodicInspections = inspections.filter(i => i.type === 'periodic')

    const handleOpenUpload = (type, relatedId = null) => {
        setActiveUploadContext({ type, id: relatedId })
        setUploadModalOpen(true)
        setSelectedUploadFile(null)
    }

    const handleSelectUploadFile = async () => {
        try {
            const result = await window.electronAPI.selectFile()
            if (!result.canceled && result.filePaths.length > 0) {
                const filePath = result.filePaths[0]
                const fileName = filePath.split(/[\\/]/).pop()
                setSelectedUploadFile({ path: filePath, name: fileName })
            }
        } catch (err) {
            console.error(err)
        }
    }

    const handleUploadConfirm = async (docs) => {
        if (!docs || docs.length === 0) return

        setSaving(true)
        try {
            for (const doc of docs) {
                await window.electronAPI.addDocument({
                    vehicleId: parseInt(id),
                    relatedType: activeUploadContext?.type || 'vehicle',
                    relatedId: (activeUploadContext?.id !== null && activeUploadContext?.id !== undefined) ? parseInt(activeUploadContext.id) : parseInt(id),
                    filePath: doc.path,
                    fileName: doc.displayName,
                    docType: doc.docType,
                    startDate: doc.startDate,
                    endDate: doc.endDate
                })
            }
            await loadVehicleData()
        } catch (err) {
            console.error('Document upload error:', err)
            alert('Dosyalar yüklenirken bir hata oluştu.')
        } finally {
            setSaving(false)
        }
    }

    const handleEditDoc = (doc) => {
        setEditingDoc(doc)
        setUploadFileName(doc.file_name || '')
        setUploadStartDate(doc.start_date ? new Date(doc.start_date).toISOString().split('T')[0] : '')
        setUploadEndDate(doc.end_date ? new Date(doc.end_date).toISOString().split('T')[0] : '')
        setUploadCategory(doc.category || doc.doc_type || '')
        setUploadFolder(doc.folder || '')
        setEditDocModalOpen(true)
    }

    const handleUpdateDocConfirm = async () => {
        if (!editingDoc) return
        setSaving(true)
        try {
            const res = await window.electronAPI.updateDocument({
                id: editingDoc.id,
                fileName: uploadFileName,
                startDate: uploadStartDate || null,
                endDate: uploadEndDate || null,
                category: uploadCategory || null,
                docType: uploadCategory || null,
                folder: uploadFolder || null
            })
            if (res.success) {
                setEditDocModalOpen(false)
                loadVehicleData()
            }
        } catch (err) {
            console.error('Update document failed:', err)
        } finally {
            setSaving(false)
        }
    }

    const handleDocumentOpen = async (docOrPath) => {
        let fileName = docOrPath
        let docObject = null

        if (typeof docOrPath === 'object') {
            fileName = docOrPath.file_path || docOrPath.file_name || docOrPath.name
            docObject = docOrPath
        }

        if (!fileName) {
            alert('Dosya adı bulunamadı!')
            return
        }

        try {
            const res = await window.electronAPI.readDocumentData(fileName)
            if (res && res.success) {
                setPreviewDoc({
                    data: res.data,
                    type: res.type,
                    name: docObject?.file_name || fileName.split(/[\\/]/).pop(),
                    path: res.path || fileName,
                    ext: res.ext,
                    doc: docObject
                })
                return
            }
        } catch (err) {
            console.error('Failed to read document data:', err)
        }

        setPreviewDoc({
            name: docObject?.file_name || fileName.split(/[\\/]/).pop(),
            path: fileName,
            doc: docObject
        })
    }

    const getDocument = (type, relatedId) => {
        const types = (type === 'inspection' || type === 'periodic_inspection') ? ['inspection', 'periodic_inspection'] : [type]
        const found = documents.find(d => types.includes(d.related_type) && Number(d.related_id) === Number(relatedId))
        if (found) return found
        if (type === 'maintenance') {
            const m = maintenances.find(item => item.id === relatedId)
            if (m?.file_path) return { id: null, file_name: m.file_path, file_path: m.file_path, file_type: '.' + (m.file_path.split('.').pop() || ''), related_type: type, related_id: relatedId }
        } else if (type === 'inspection' || type === 'periodic_inspection') {
            const i = inspections.find(item => item.id === relatedId)
            if (i?.file_path) return { id: null, file_name: i.file_path, file_path: i.file_path, file_type: '.' + (i.file_path.split('.').pop() || ''), related_type: type, related_id: relatedId }
        } else if (type === 'insurance') {
            const ins = insurances.find(item => item.id === relatedId)
            if (ins?.file_path) return { id: null, file_name: ins.file_path, file_path: ins.file_path, file_type: '.' + (ins.file_path.split('.').pop() || ''), related_type: type, related_id: relatedId }
        } else if (type === 'service') {
            const s = services.find(item => item.id === relatedId)
            if (s?.file_path) return { id: null, file_name: s.file_path, file_path: s.file_path, file_type: '.' + (s.file_path.split('.').pop() || ''), related_type: type, related_id: relatedId }
        } else if (type === 'assignment') {
            const a = assignments.find(item => item.id === relatedId)
            if (a?.file_path) return { id: null, file_name: a.file_path, file_path: a.file_path, file_type: '.' + (a.file_path.split('.').pop() || ''), related_type: type, related_id: relatedId }
        }
        return null
    }

    const hasDocument = (type, relatedId) => {
        return !!getDocument(type, relatedId)
    }

    const renderDocumentCell = (type, row) => {
        const doc = getDocument(type, row.id)
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                {doc ? (
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
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(type, row) }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            border: '1px dashed var(--border-color)', background: 'transparent',
                            padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
                            color: 'var(--text-muted)', fontSize: '11px', width: 'fit-content', justifyContent: 'center',
                            transition: 'all 0.2s',
                            zIndex: 10,
                            position: 'relative'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                        title="Dosya Ekle"
                        type="button"
                    >
                        <Plus size={12} />
                        <span>Ekle</span>
                    </button>
                )}
            </div>
        )
    }

    const tabs = [
        { id: 'maintenance', label: 'Bakım', icon: Wrench, count: maintenances.length },
        { id: 'service', label: 'Servis', icon: Settings, count: services.length },
        { id: 'inspection', label: 'Muayene', icon: ClipboardCheck, count: trafficInspections.length },
        { id: 'periodic_inspection', label: 'Periyodik', icon: Activity, count: periodicInspections.length },
        { id: 'insurance', label: 'Sigorta', icon: Shield, count: insurances.length },
        { id: 'assignment', label: 'Zimmet', icon: UserCheck, count: assignments.length },
        { id: 'documents', label: 'Belgeler', icon: FileText, count: documents.length }
    ]

    const resultOptions = [
        { value: 'passed', label: 'Geçti' },
        { value: 'failed', label: 'Kaldı' },
        { value: 'conditional', label: 'Şartlı Geçti' }
    ]

    const serviceTypes = [
        { value: 'Genel Bakım', label: 'Genel Bakım' },
        { value: 'Arıza', label: 'Arıza/Tamir' },
        { value: 'Lastik', label: 'Lastik Değişimi/Tamiri' },
        { value: 'Kaporta', label: 'Kaporta/Boya' },
        { value: 'Elektrik', label: 'Elektrik Aksamı' },
        { value: 'Diğer', label: 'Diğer' }
    ]

    return (
        <div>
            <TopProgressBar loading={loading} />
            {/* Header / Breadcrumb / Actions */}
            <div style={{ marginBottom: '24px' }}>


                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div className="employee-avatar" style={{ 
                            width: '72px', height: '72px', fontSize: '28px', 
                            borderRadius: '20px', backgroundColor: 'var(--bg-tertiary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--primary)', fontWeight: '600',
                            border: '1px solid var(--border-color)',
                            flexShrink: 0
                        }}>
                            <Car size={32} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 8px 0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
                                {vehicle.plate}
                            </h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                                <span className={`badge badge-${statusInfo.color}`}>{statusInfo.label}</span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '14px', textTransform: 'uppercase' }}>
                                    {vehicle.brand} {vehicle.model} • {vehicle.year || '-'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={() => openEditModal('vehicle', vehicle)}>
                            <Pencil size={18} /> Düzenle
                        </button>
                    </div>
                </div>
            </div>


            {/* Vehicle Info Section - Minimal */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                {/* Temel Araç Bilgileri */}
                <div className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Settings size={13} /> Temel Bilgiler
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Araç Türü</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{getVehicleTypeLabel(vehicle.type)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Yıl</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{vehicle.year || '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Marka</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{vehicle.brand || '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Model</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{vehicle.model || '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Renk</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{vehicle.color || '-'}</div>
                        </div>
                    </div>
                </div>

                {/* Diğer Bilgiler */}
                <div className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={13} /> Diğer Bilgiler
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Kilometre</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{vehicle.current_km ? vehicle.current_km.toLocaleString('tr-TR') + ' KM' : '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Yakıt Türü</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{vehicle.fuel_type || '-'}</div>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Notlar</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{vehicle.notes || '-'}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs - Modern Segmented Control Style */}
            <div style={{
                marginBottom: '24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                gap: '24px',
                overflowX: 'auto',
                paddingBottom: '0',
                position: 'relative'
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        ref={el => tabsRef[tab.id] = el}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 4px',
                            background: 'transparent',
                            border: 'none',
                            color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: '14px',
                            marginBottom: '0',
                            whiteSpace: 'nowrap',
                            position: 'relative',
                            zIndex: 1
                        }}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}

                {/* Sliding Indicator */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                    height: '2px',
                    backgroundColor: 'var(--accent-primary)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 2
                }} />
            </div>

            {/* Tab Content */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {tabs.find(t => t.id === activeTab)?.label} Kayıtları
                    </h3>
                    {activeTab === 'documents' ? (
                        !showArchived && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button 
                                    onClick={handleOpenCreateFolder} 
                                    className="btn btn-secondary" 
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Plus size={16} /> Yeni Klasör
                                </button>
                                <button 
                                    onClick={() => handleOpenUpload('vehicle')} 
                                    className="btn btn-primary" 
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <Plus size={16} /> Belge Ekle
                                </button>
                            </div>
                        )
                    ) : (
                        !showArchived && (
                            <button className="btn btn-primary" onClick={() => openAddModal(activeTab)}>
                                <Plus size={18} /> Ekle
                            </button>
                        )
                    )}
                </div>

                {activeTab === 'maintenance' && (
                    <div className="tab-pane">
                        <DataTable persistenceKey="VehicleDetail_table_0"
                            columns={[
                                { key: 'type', label: 'Tür', render: v => getMaintenanceTypeLabel(v) },
                                { key: 'description', label: 'Açıklama' },
                                { key: 'date', label: 'Tarih', render: v => formatDate(v) },
                                { key: 'cost', label: 'Maliyet', render: v => formatCurrency(v) },
                                ...(showArchived ? [] : [
                                    { key: 'next_date', label: 'Sonraki', render: v => v ? <span className={`badge badge-${getStatusColor(v)}`}>{getDaysUntilText(v)}</span> : '-' }
                                ]),
                                {
                                    key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell('maintenance', row)
                                }
                            ]}
                            data={maintenances.filter(m => showArchived ? m.is_archived : !m.is_archived)}
                            emptyMessage={showArchived ? "Arşivlenmiş bakım kaydı yok" : "Aktif bakım kaydı yok"}
                            filters={[
                                {
                                    key: 'type',
                                    label: 'Bakım Türü',
                                    options: maintenanceTypes
                                }
                            ]}
                            onBulkDelete={(ids) => handleDeleteClick('maintenance', null, ids)}
                            onBulkArchive={handleBulkArchive}
                            isArchiveView={showArchived}
                            onToggleArchiveView={setShowArchived}
                            actions={(item) => (
                                <>
                                    <button onClick={() => openEditModal('maintenance', item)}><Pencil size={16} /></button>
                                    <button className="danger" onClick={() => handleDeleteClick('maintenance', item)}><Trash2 size={16} /></button>
                                </>
                            )}
                        />
                    </div>
                )}

                {activeTab === 'service' && (
                    <div className="tab-pane">
                        <DataTable persistenceKey="VehicleDetail_table_1"
                            columns={[
                                { key: 'type', label: 'İşlem' },
                                { key: 'service_name', label: 'Servis Yeri' },
                                { key: 'description', label: 'Açıklama' },
                                { key: 'date', label: 'Tarih', render: v => formatDate(v) },
                                { key: 'cost', label: 'Maliyet', render: v => formatCurrency(v) },
                                {
                                    key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell('service', row)
                                }
                            ]}
                            data={services.filter(s => showArchived ? s.is_archived : !s.is_archived)}
                            emptyMessage={showArchived ? "Arşivlenmiş servis kaydı yok" : "Aktif servis kaydı yok"}
                            filters={[
                                {
                                    key: 'type',
                                    label: 'Servis İşlemi',
                                    options: serviceTypes
                                }
                            ]}
                            onBulkDelete={(ids) => handleDeleteClick('service', null, ids)}
                            onBulkArchive={handleBulkArchive}
                            isArchiveView={showArchived}
                            onToggleArchiveView={setShowArchived}
                            actions={(item) => (
                                <>
                                    <button onClick={() => openEditModal('service', item)}><Pencil size={16} /></button>
                                    <button className="danger" onClick={() => handleDeleteClick('service', item)}><Trash2 size={16} /></button>
                                </>
                            )}
                        />
                    </div>
                )}


                {
                    activeTab === 'inspection' && (
                        <div className="tab-pane">
                            <DataTable persistenceKey="VehicleDetail_table_2"
                                columns={[
                                    { key: 'inspection_date', label: 'Tarih', render: v => formatDate(v) },
                                    { key: 'result', label: 'Sonuç', render: v => <span className={`badge badge-${v === 'passed' ? 'success' : v === 'failed' ? 'danger' : 'warning'}`}>{resultOptions.find(r => r.value === v)?.label || v}</span> },
                                    { key: 'cost', label: 'Ücret', render: v => formatCurrency(v) },
                                    ...(showArchived ? [] : [
                                        { key: 'next_inspection', label: 'Sonraki', render: v => v ? <span className={`badge badge-${getStatusColor(v)}`}>{getDaysUntilText(v)}</span> : '-' }
                                    ]),
                                    {
                                        key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell('inspection', row)
                                    }
                                ]}
                                data={trafficInspections.filter(i => showArchived ? i.is_archived : !i.is_archived)}
                                emptyMessage={showArchived ? "Arşivlenmiş muayene kaydı yok" : "Aktif muayene kaydı yok"}
                                filters={[
                                    {
                                        key: 'result',
                                        label: 'Sonuç',
                                        options: resultOptions
                                    }
                                ]}
                                onBulkDelete={(ids) => handleDeleteClick('inspection', null, ids)}
                                onBulkArchive={handleBulkArchive}
                                isArchiveView={showArchived}
                                onToggleArchiveView={setShowArchived}
                                actions={(item) => (
                                    <>
                                        <button onClick={() => openEditModal('inspection', item)}><Pencil size={16} /></button>
                                        <button className="danger" onClick={() => handleDeleteClick('inspection', item)}><Trash2 size={16} /></button>
                                    </>
                                )}
                            />
                        </div>
                    )
                }

                {
                    activeTab === 'periodic_inspection' && (
                        <div className="tab-pane">
                            <DataTable persistenceKey="VehicleDetail_table_3"
                                columns={[
                                    { key: 'inspection_date', label: 'Tarih', render: v => formatDate(v) },
                                    { key: 'result', label: 'Sonuç', render: v => <span className={`badge badge-${v === 'passed' ? 'success' : v === 'failed' ? 'danger' : 'warning'}`}>{resultOptions.find(r => r.value === v)?.label || v}</span> },
                                    { key: 'cost', label: 'Ücret', render: v => formatCurrency(v) },
                                    ...(showArchived ? [] : [
                                        { key: 'next_inspection', label: 'Sonraki', render: v => v ? <span className={`badge badge-${getStatusColor(v)}`}>{getDaysUntilText(v)}</span> : '-' }
                                    ]),
                                    {
                                        key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell('periodic_inspection', row)
                                    }
                                ]}
                                data={periodicInspections.filter(i => showArchived ? i.is_archived : !i.is_archived)}
                                emptyMessage={showArchived ? "Arşivlenmiş periyodik kontrol kaydı yok" : "Aktif periyodik kontrol kaydı yok"}
                                filters={[
                                    {
                                        key: 'result',
                                        label: 'Sonuç',
                                        options: resultOptions
                                    }
                                ]}
                                onBulkDelete={(ids) => handleDeleteClick('periodic_inspection', null, ids)}
                                onBulkArchive={handleBulkArchive}
                                isArchiveView={showArchived}
                                onToggleArchiveView={setShowArchived}
                                actions={(item) => (
                                    <>
                                        <button onClick={() => openEditModal('periodic_inspection', item)}><Pencil size={16} /></button>
                                        <button className="danger" onClick={() => handleDeleteClick('periodic_inspection', item)}><Trash2 size={16} /></button>
                                    </>
                                )}
                            />
                        </div>
                    )
                }

                {
                    activeTab === 'insurance' && (
                        <div className="tab-pane">
                            <DataTable persistenceKey="VehicleDetail_table_4"
                                columns={[
                                    { key: 'company', label: 'Şirket' },
                                    { key: 'type', label: 'Tür', render: v => getInsuranceTypeLabel(v) },
                                    { key: 'start_date', label: 'Başlangıç', render: v => formatDate(v) },
                                    ...(showArchived ? [
                                        { key: 'end_date', label: 'Bitiş Tarihi', render: v => formatDate(v) }
                                    ] : [
                                        { key: 'end_date', label: 'Bitiş', render: v => v ? <span className={`badge badge-${getStatusColor(v)}`}>{getDaysUntilText(v)}</span> : '-' }
                                    ]),
                                    { key: 'premium', label: 'Prim', render: v => formatCurrency(v) },
                                    {
                                        key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell('insurance', row)
                                    }
                                ]}
                                data={insurances.filter(i => showArchived ? i.is_archived : !i.is_archived)}
                                emptyMessage={showArchived ? "Arşivlenmiş sigorta kaydı yok" : "Aktif sigorta kaydı yok"}
                                filters={[
                                    {
                                        key: 'type',
                                        label: 'Poliçe Türü',
                                        options: insuranceTypes
                                    }
                                ]}
                                onBulkDelete={(ids) => handleDeleteClick('insurance', null, ids)}
                                onBulkArchive={handleBulkArchive}
                                isArchiveView={showArchived}
                                onToggleArchiveView={setShowArchived}
                                actions={(item) => (
                                    <>
                                        <button onClick={() => openEditModal('insurance', item)}><Pencil size={16} /></button>
                                        <button className="danger" onClick={() => handleDeleteClick('insurance', item)}><Trash2 size={16} /></button>
                                    </>
                                )}
                            />
                        </div>
                    )
                }

                {
                    activeTab === 'assignment' && (
                        <div className="tab-pane">
                            <DataTable persistenceKey="VehicleDetail_table_5"
                                columns={[
                                    { key: 'item_name', label: 'Malzeme' },
                                    { key: 'quantity', label: 'Adet' },
                                    { key: 'assigned_to', label: 'Sorumlu' },
                                    { key: 'start_date', label: 'Başlangıç', render: v => formatDate(v) },
                                    { key: 'end_date', label: 'Bitiş', render: v => v ? formatDate(v) : <span className="badge badge-success">Aktif</span> },
                                    {
                                        key: 'has_file', label: 'Belge', width: '100px', align: 'center', render: (_, row) => renderDocumentCell('assignment', row)
                                    }
                                ]}
                                data={assignments.filter(a => showArchived ? a.is_archived : !a.is_archived)}
                                emptyMessage={showArchived ? "Arşivlenmiş zimmet kaydı yok" : "Aktif zimmet kaydı yok"}
                                onBulkDelete={(ids) => handleDeleteClick('assignment', null, ids)}
                                onBulkArchive={handleBulkArchive}
                                isArchiveView={showArchived}
                                onToggleArchiveView={setShowArchived}
                                actions={(item) => (
                                    <>
                                        <button onClick={() => openEditModal('assignment', item)}><Pencil size={16} /></button>
                                        <button className="danger" onClick={() => handleDeleteClick('assignment', item)}><Trash2 size={16} /></button>
                                    </>
                                )}
                            />
                        </div>
                    )
                }

                {
                    activeTab === 'documents' && (
                        <div className="tab-pane">
                            {/* Klasör Yolu Navigasyonu */}
                            {currentFolder && (
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '4px', 
                                    marginBottom: '16px',
                                    padding: '10px 16px',
                                    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color)',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                }}>
                                    <button 
                                        onClick={() => setCurrentFolder(null)} 
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '6px', 
                                            padding: '5px 12px', 
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            height: 'auto',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            color: 'var(--text-secondary)',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'var(--accent-subtle)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-primary)'; }}
                                    >
                                        <Folder size={14} />
                                        Tüm Dosyalar
                                    </button>
                                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        padding: '5px 12px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: 'var(--accent-primary)',
                                        background: 'var(--accent-subtle)',
                                        borderRadius: '8px',
                                        border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)'
                                    }}>
                                        <Folder size={14} style={{ fill: 'color-mix(in srgb, var(--accent-primary) 30%, transparent)' }} />
                                        {currentFolder}
                                    </div>
                                </div>
                            )}

                            <DataTable persistenceKey="VehicleDetail_table_6"
                                columns={[
                                    { 
                                        key: 'file_name', 
                                        label: 'Belge Adı',
                                        render: (v, row) => {
                                            if (row.isFolder) {
                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                                        <Folder size={18} style={{ color: 'var(--accent-primary)', fill: 'var(--accent-subtle)' }} />
                                                        <span>{v}</span>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FileText size={18} style={{ color: 'var(--text-secondary)' }} />
                                                    <span>{v}</span>
                                                </div>
                                            );
                                        }
                                    },
                                    { 
                                        key: 'category', 
                                        label: 'Kategori', 
                                        render: (v, row) => row.isFolder ? '' : (row.category || row.doc_type || <span className="text-muted">Kategorisiz</span>) 
                                    },
                                    { 
                                        key: 'folder', 
                                        label: 'Klasör', 
                                        render: (v, row) => row.isFolder ? '' : (row.folder || <span className="text-muted">Klasörsüz</span>) 
                                    },
                                    { key: 'start_date', label: 'Başlangıç', render: (v, row) => row.isFolder ? '' : (v ? formatDate(v) : '-') },
                                    { key: 'end_date', label: 'Bitiş', render: (v, row) => row.isFolder ? '' : (v ? formatDate(v) : '-') },
                                    {
                                        key: 'related_info', label: 'İlgili Kayıt', width: '200px', render: (_, row) => {
                                            if (row.isFolder) return '';
                                            if (row.related_type === 'vehicle') return <span className="badge badge-primary">Araç Geneli</span>;

                                            let info = null;
                                            if (row.related_type === 'maintenance') {
                                                const item = maintenances.find(m => m.id === row.related_id);
                                                if (item) info = `Bakım: ${getMaintenanceTypeLabel(item.type)} (${formatDate(item.date)})`;
                                            } else if (row.related_type === 'service') {
                                                const item = services.find(s => s.id === row.related_id);
                                                if (item) info = `Servis: ${item.service_name} (${formatDate(item.date)})`;
                                            } else if (row.related_type === 'inspection') {
                                                const item = trafficInspections.find(i => i.id === row.related_id);
                                                if (item) info = `Muayene: ${formatDate(item.inspection_date)}`;
                                            } else if (row.related_type === 'periodic_inspection') {
                                                const item = periodicInspections.find(i => i.id === row.related_id);
                                                if (item) info = `Periyodik: ${formatDate(item.inspection_date)}`;
                                            } else if (row.related_type === 'insurance') {
                                                const item = insurances.find(i => i.id === row.related_id);
                                                if (item) info = `Sigorta: ${insuranceTypes.find(t => t.value === item.type)?.label || item.type} (${item.company})`;
                                            } else if (row.related_type === 'assignment') {
                                                const item = assignments.find(a => a.id === row.related_id);
                                                if (item) info = `Zimmet: ${item.item_name} (${item.assigned_to || '-'})`;
                                            }

                                            return info ? (
                                                <span style={{ fontSize: '12px' }}>{info}</span>
                                            ) : (
                                                <span className="text-muted">{row.related_type}</span>
                                            );
                                        }
                                    },
                                    { key: 'created_at', label: 'Yükleme Tarihi', render: (v, row) => row.isFolder ? '' : formatDate(v) },
                                    { key: 'file_type', label: 'Tür', render: (v, row) => row.isFolder ? 'Klasör' : (v || '-') }
                                ]}
                                data={(() => {
                                    const filtered = documents.filter(d => showArchived ? d.is_archived === 1 : !d.is_archived);
                                    if (currentFolder === null) {
                                        const filteredFolders = documentFolders.filter(f => 
                                            showArchived ? f.is_archived === 1 : f.is_archived !== 1
                                        );
                                        const existingFolderNames = new Set(filteredFolders.map(f => f.value));
                                        const dynamicFolderNames = Array.from(new Set(filtered.map(d => d.folder).filter(Boolean)))
                                            .filter(folderName => !existingFolderNames.has(folderName));

                                        const folderRows = [
                                            ...filteredFolders.map(f => ({
                                                id: `folder_${f.id}`,
                                                file_name: f.value,
                                                isFolder: true,
                                                category: '',
                                                folder: '',
                                                related_info: '',
                                                created_at: null,
                                                file_type: 'Klasör'
                                            })),
                                            ...dynamicFolderNames.map(name => ({
                                                id: `folder_${name}`,
                                                file_name: name,
                                                isFolder: true,
                                                category: '',
                                                folder: '',
                                                related_info: '',
                                                created_at: null,
                                                file_type: 'Klasör'
                                            }))
                                        ];
                                        const fileRows = filtered.filter(d => !d.folder);
                                        return [...folderRows, ...fileRows];
                                    }
                                    return filtered.filter(d => d.folder === currentFolder);
                                })()}
                                emptyMessage={showArchived ? "Arşivlenmiş belge bulunmuyor" : "Belge bulunamadı"}
                                onRowClick={(row) => {
                                    if (row.isFolder) {
                                        setCurrentFolder(row.file_name);
                                    } else {
                                        handleDocumentOpen(row.file_path);
                                    }
                                }}
                                onBulkDelete={(ids) => handleDeleteClick('documents', null, ids)}
                                isArchiveView={showArchived}
                                onToggleArchiveView={setShowArchived}
                                onBulkArchive={(ids) => handleBulkArchiveDocs(ids, !showArchived)}
                                customBulkActions={(selectedIds, clearSelection) => (
                                    <button 
                                        className="btn-bulk-action secondary" 
                                        onClick={() => {
                                            setBulkMoveIds(selectedIds);
                                            setBulkMoveClearSelection(() => clearSelection);
                                            setBulkMoveModalOpen(true);
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Folder size={15} />
                                        Klasöre Taşı
                                    </button>
                                )}
                                actions={(item) => {
                                    if (item.isFolder) {
                                        const folderObj = documentFolders.find(f => f.value === item.file_name)
                                        return !showArchived ? (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenRenameFolder(item.file_name) }} title="Klasör Adını Değiştir"><Pencil size={16} /></button>
                                                {folderObj && <button onClick={(e) => { e.stopPropagation(); handleArchiveFolder(folderObj.id, true) }} title="Klasörü Arşivle"><Archive size={16} /></button>}
                                                <button className="danger" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(item.file_name) }} title="Klasörü Sil"><Trash2 size={16} /></button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {folderObj && <button onClick={(e) => { e.stopPropagation(); handleArchiveFolder(folderObj.id, false) }} title="Arşivden Çıkar"><ArchiveRestore size={16} /></button>}
                                                <button className="danger" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(item.file_name) }} title="Klasörü Sil"><Trash2 size={16} /></button>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={(e) => { e.stopPropagation(); handleDocumentOpen(item.file_path) }} title="Aç"><FileText size={16} /></button>
                                            {!showArchived && <button onClick={(e) => { e.stopPropagation(); handleEditDoc(item) }} title="Düzenle"><Pencil size={16} /></button>}
                                            <button className="danger" onClick={(e) => { e.stopPropagation(); handleDeleteClick('documents', item) }} title="Sil"><Trash2 size={16} /></button>
                                        </div>
                                    );
                                }}
                            />
                        </div>
                    )
                }
            </div >

            {/* Dynamic Modal */}
            < Modal
                isOpen={!!modalType
                }
                onClose={closeModal}
                title={modalType === 'vehicle' ? 'Araç Düzenle' : `${editingItem ? 'Düzenle' : 'Yeni'} ${tabs.find(t => t.id === modalType)?.label || ''}`}
                size={modalType === 'vehicle' ? 'xl' : 'lg'}
                footer={null}
            >
                {modalType === 'vehicle' ? (
                    <VehicleForm
                        initialData={editingItem}
                        onSubmit={handleVehicleSave}
                        onCancel={closeModal}
                        loading={saving}
                    />
                ) : (
                    <>
                        {modalType === 'maintenance' && (
                            <MaintenanceForm
                                initialData={editingItem}
                                onSubmit={handleOperationSubmit}
                                onCancel={closeModal}
                                vehicles={vehicle ? [vehicle] : []}
                                loading={saving}
                            />
                        )}

                        {modalType === 'service' && (
                            <ServiceForm
                                initialData={editingItem}
                                onSubmit={handleOperationSubmit}
                                onCancel={closeModal}
                                vehicles={vehicle ? [vehicle] : []}
                                loading={saving}
                            />
                        )}

                        {(modalType === 'inspection' || modalType === 'periodic_inspection') && (
                            <InspectionForm
                                initialData={editingItem}
                                onSubmit={handleOperationSubmit}
                                onCancel={closeModal}
                                vehicles={vehicle ? [vehicle] : []}
                                type={modalType === 'inspection' ? 'traffic' : 'periodic'}
                                loading={saving}
                            />
                        )}

                        {modalType === 'insurance' && (
                            <InsuranceForm
                                initialData={editingItem}
                                onSubmit={handleOperationSubmit}
                                onCancel={closeModal}
                                vehicles={vehicle ? [vehicle] : []}
                                loading={saving}
                            />
                        )}

                        {modalType === 'assignment' && (
                            <AssignmentForm
                                initialData={editingItem}
                                onSubmit={handleOperationSubmit}
                                onCancel={closeModal}
                                vehicles={vehicle ? [vehicle] : []}
                                loading={saving}
                            />
                        )}
                    </>
                )}
            </Modal >

            <ConfirmModal
                isOpen={!!confirmModal}
                onClose={() => setConfirmModal(null)}
                onConfirm={confirmModal?.onConfirm || handleConfirmDelete}
                title={confirmModal?.title}
                message={confirmModal?.message}
                confirmText={confirmModal?.confirmText}
                confirmButtonClass={confirmModal?.confirmButtonClass}
            />

            {/* Document Preview Modal */}
            <DocumentPreviewModal
                doc={previewDoc}
                onClose={() => setPreviewDoc(null)}
                onDelete={previewDoc?.doc ? () => {
                    setPreviewDoc(null)
                    handleDeleteClick('documents', previewDoc.doc)
                } : null}
            />

            {/* Upload Modal */}
            {
                uploadModalOpen && (
                    <Modal
                        isOpen={uploadModalOpen}
                        onClose={() => setUploadModalOpen(false)}
                        title="Belge Yükle"
                        size="lg"
                    >
                        <DocumentForm
                            onSubmit={handleUploadConfirm}
                            onCancel={() => setUploadModalOpen(false)}
                            loading={saving}
                            targetType="vehicle"
                        />
                    </Modal>
                )
            }

            {/* Document Edit Modal */}
            <Modal
                isOpen={editDocModalOpen}
                onClose={() => setEditDocModalOpen(false)}
                title="Belge Bilgilerini Düzenle"
                size="md"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <CustomInput 
                        label="Dosya Adı *"
                        value={uploadFileName}
                        onChange={setUploadFileName}
                        maxLength={120}
                        required
                    />
                    <CustomSelect 
                        label="Kategori"
                        value={uploadCategory}
                        onChange={setUploadCategory}
                        options={documentCategories}
                        placeholder="Kategori seçin..."
                    />
                    <CustomSelect 
                        label="Klasör"
                        value={uploadFolder}
                        onChange={setUploadFolder}
                        options={documentFolders}
                        placeholder="Klasör seçin..."
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <CustomInput 
                            label="Başlangıç Tarihi"
                            type="date"
                            value={uploadStartDate}
                            onChange={setUploadStartDate}
                        />
                        <CustomInput 
                            label="Bitiş Tarihi"
                            type="date"
                            value={uploadEndDate}
                            onChange={setUploadEndDate}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button className="btn btn-secondary" onClick={() => setEditDocModalOpen(false)}>İptal</button>
                        <button 
                            className="btn btn-primary" 
                            disabled={saving || !uploadFileName} 
                            onClick={handleUpdateDocConfirm}
                        >
                            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                        </button>
                    </div>
                </div>
            </Modal>

            {bulkMoveModalOpen && (
                <Modal
                    isOpen={bulkMoveModalOpen}
                    onClose={() => setBulkMoveModalOpen(false)}
                    title="Belgeleri Klasöre Taşı"
                    size="md"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                            Seçilen {bulkMoveIds.length} belgeyi hangi klasöre taşımak istiyorsunuz?
                        </p>
                        <CustomSelect 
                            label="Hedef Klasör"
                            value={bulkMoveSelectedFolder}
                            onChange={setBulkMoveSelectedFolder}
                            options={[
                                { value: '', label: 'Klasörsüz (Klasörden Çıkart)' },
                                ...documentFolders
                            ]}
                            placeholder="Klasör seçin..."
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                            <button className="btn btn-secondary" onClick={() => setBulkMoveModalOpen(false)}>İptal</button>
                            <button 
                                className="btn btn-primary" 
                                disabled={saving} 
                                onClick={handleBulkMoveConfirm}
                            >
                                {saving ? 'Taşınıyor...' : 'Klasöre Taşı'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {folderModalOpen && (
                <Modal
                    isOpen={folderModalOpen}
                    onClose={() => setFolderModalOpen(false)}
                    title={folderModalMode === 'create' ? 'Yeni Klasör Oluştur' : 'Klasör Adını Değiştir'}
                    size="sm"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <CustomInput
                            label="Klasör Adı"
                            value={folderModalValue}
                            onChange={setFolderModalValue}
                            placeholder="Klasör adı girin..."
                            required
                            maxLength={50}
                            autoFocus
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                            <button className="btn btn-secondary" onClick={() => setFolderModalOpen(false)}>İptal</button>
                            <button 
                                className="btn btn-primary" 
                                disabled={saving || !folderModalValue.trim()} 
                                onClick={handleFolderSubmit}
                            >
                                {saving ? 'Kaydediliyor...' : (folderModalMode === 'create' ? 'Klasör Oluştur' : 'Kaydet')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div >
    )
}
