import TopProgressBar from '../components/TopProgressBar'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import { useTabs } from '../context/TabContext'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import DataTable from '../components/DataTable'
import CustomSelect from '../components/CustomSelect'
import CustomInput from '../components/CustomInput'
import {
    vehicleTypes,
    vehicleStatuses,
    getVehicleTypeLabel,
    getVehicleStatusInfo,
    parseVehicleCapacity,
    compareVehicleCapacityDesc
} from '../utils/helpers'
import { Plus, Pencil, Trash2, Car, Building2, AlertCircle, Archive, ArchiveRestore } from 'lucide-react'
import VehicleForm from '../components/VehicleForm'
import { usePersistentTab } from '../hooks/usePersistentTab'
import { useAuth } from '../context/AuthContext'
import { dataCache } from '../utils/dataCache'

export default function Vehicles() {
    const navigate = useNavigate()
    const { currentCompany } = useCompany()
    const { isAdmin, hasPermission } = useAuth()
    const { openNewTab } = useTabs()
    const [searchParams, setSearchParams] = useSearchParams()
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingVehicle, setEditingVehicle] = useState(null)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = usePersistentTab('Vehicles', 'all')
    const [error, setError] = useState('')
    const [confirmModal, setConfirmModal] = useState(null) // { type: 'single'|'bulk', item, ids, title, message }
    
    // Seen Vehicle Types for Tabs History
    const [seenTypes, setSeenTypes] = useState(new Set())

    // Archive State
    const [showArchived, setShowArchived] = useState(false)

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            openCreateModal()
            searchParams.delete('action')
            setSearchParams(searchParams, { replace: true })
        }
    }, [searchParams])

    useEffect(() => {
        if (currentCompany) {
            loadVehicles()
        } else {
            setVehicles([])
            setLoading(false)
        }
    }, [currentCompany, showArchived])

    // Real-time synchronization listener
    const loadVehiclesRef = useRef(null)
    useEffect(() => {
        loadVehiclesRef.current = loadVehicles
    })
    useEffect(() => {
        if (!currentCompany) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if ([
                'vehicles', 'maintenances', 'inspections', 'insurances',
                'services', 'assignments'
            ].includes(change?.table)) {
                console.log(`[RealTime] Vehicles reloading for change in ${change.table}`)
                loadVehiclesRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const loadVehicles = async (isBackground = false) => {
        const cacheKey = `vehicles_${currentCompany?.id}_${showArchived ? 1 : 0}`
        const cached = dataCache.get(cacheKey)
        if (cached && !isBackground) {
            setVehicles(cached)
            setLoading(false)
            isBackground = true
        } else if (!isBackground) {
            setLoading(true)
        }

        try {
            const result = await window.electronAPI.getVehicles(currentCompany.id, showArchived ? 1 : 0)
            if (result.success) {
                const sorted = (result.data || []).sort(compareVehicleCapacityDesc)
                setVehicles(sorted)
                dataCache.set(cacheKey, sorted)
                
                // Track newly seen vehicle types from the result data to persist tabs
                if (result.data.length > 0) {
                    setSeenTypes(prev => {
                        const next = new Set(prev)
                        result.data.forEach(v => {
                            if (v.type) next.add(v.type)
                        })
                        return next
                    })
                }
            }
        } catch (error) {
            console.error('Failed to load vehicles:', error)
        }
        if (!isBackground) setLoading(false)
    }

    const resetForm = () => {
        setEditingVehicle(null)
        setError('')
    }

    const openCreateModal = () => {
        resetForm()
        setIsModalOpen(true)
    }

    const openEditModal = (vehicle) => {
        setEditingVehicle(vehicle)
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        resetForm()
    }

    const handleSubmit = async (formData) => {
        setSaving(true)
        setError('')

        // No need to validate here as VehicleForm handles it
        // and only calls onSubmit if valid.

        setSaving(true)

        let result
        if (editingVehicle) {
            result = await window.electronAPI.updateVehicle({
                id: editingVehicle.id,
                ...formData,
                year: formData.year ? parseInt(formData.year) : null
            })
        } else {
            result = await window.electronAPI.createVehicle({
                companyId: currentCompany.id,
                ...formData,
                year: formData.year ? parseInt(formData.year) : null
            })
        }

        setSaving(false)

        if (result.success) {
            closeModal()
            loadVehicles()
        } else {
            setError(result.error)
        }
    }

    const handleDeleteClick = (vehicle) => {
        setConfirmModal({
            type: 'single',
            item: vehicle,
            title: 'Araç Silme',
            message: `"${vehicle.plate}" plakalı aracı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        })
    }

    const handleBulkDeleteClick = (ids) => {
        setConfirmModal({
            type: 'bulk',
            ids: ids,
            title: 'Toplu Silme',
            message: `${ids.length} aracı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        })
    }

    const handleConfirmDelete = async () => {
        if (!confirmModal) return

        if (confirmModal.type === 'single') {
            await window.electronAPI.deleteVehicle(confirmModal.item.id)
        } else if (confirmModal.type === 'bulk') {
            for (const id of confirmModal.ids) {
                await window.electronAPI.deleteVehicle(id)
            }
        }

        setConfirmModal(null)
        loadVehicles()
    }

    const handleBulkArchive = async (ids) => {
        if (!ids || ids.length === 0) return

        const newStatus = showArchived ? 0 : 1

        for (const id of ids) {
            await window.electronAPI.archiveItem('vehicles', id, newStatus)
        }
        loadVehicles()
    }

    const handleArchiveClick = async (vehicle) => {
        const newStatus = showArchived ? 0 : 1
        await window.electronAPI.archiveItem('vehicles', vehicle.id, newStatus)
        loadVehicles()
    }

    // PC Context Menu Listener
    useEffect(() => {
        const handleContextAction = (action) => {
            // action format: "edit:123" or "delete:123"
            if (!action) return
            const [type, id] = action.split(':')
            const vehicle = vehicles.find(v => v.id == id)
            if (!vehicle) return

            if (type === 'edit') {
                openEditModal(vehicle)
            } else if (type === 'delete') {
                handleDeleteClick(vehicle)
            }
        }

        if (window.electronAPI && window.electronAPI.onContextAction) {
            window.electronAPI.onContextAction(handleContextAction)
        }

        return () => {
            if (window.electronAPI && window.electronAPI.removePCListeners) {
                window.electronAPI.removePCListeners() // Warning: this removes ALL pc listeners including dashboard ones if shared. 
                // Better implementation would be granular, but for now it's okay if pages are unmounted.
                // Actually invoke removePCListeners only removes listeners from ipcRenderer, which is fine as component unmounts.
            }
        }
    }, [vehicles])

    const handleContextMenu = (e, vehicle) => {
        // Define menu items
        const menuItems = [
            { label: `${vehicle.plate} - ${vehicle.brand} ${vehicle.model}`, enabled: false },
            { type: 'separator' },
            { id: `edit:${vehicle.id}`, label: 'Düzenle' },
            { id: `delete:${vehicle.id}`, label: 'Sil' },
            { type: 'separator' },
            { id: `detail:${vehicle.id}`, label: 'Detayları Gör', click: () => navigate(`/vehicles/${vehicle.id}`) }
        ]

        // This 'click' property won't work over IPC for `detail`.
        // We need to handle `detail` in handleContextAction on main or renderer.
        // Actually IPC menu click sends back 'context-action' event with ID.
        // So we should handle 'detail:...' in handleContextAction above.

        if (window.electronAPI && window.electronAPI.showContextMenu) {
            window.electronAPI.showContextMenu(menuItems)
        }
    }

    const columns = [
        { 
            key: 'plate', 
            label: 'Plaka',
            render: (val, r) => (
                <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        {val}
                    </span>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {r.brand || '-'}
                    </div>
                </div>
            )
        },
        {
            key: 'model',
            label: 'Model / Kapasite',
            sortFn: (a, b) => compareVehicleCapacityDesc(a, b),
            render: (val) => {
                const parsed = parseVehicleCapacity(val)
                return (
                    <div>
                        {parsed.type !== 'other' ? (
                            <span style={{ fontWeight: 600, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                                {parsed.value}
                            </span>
                        ) : (
                            <span>{val || '-'}</span>
                        )}
                    </div>
                )
            }
        },
        {
            key: 'type',
            label: 'Tür',
            render: (value) => getVehicleTypeLabel(value)
        },
        { 
            key: 'year', 
            label: 'Yıl',
            width: '90px',
            render: (val) => val ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{val}</span> : '-'
        },
        {
            key: 'status',
            label: 'Durum',
            width: '110px',
            render: (value) => {
                const status = getVehicleStatusInfo(value)
                return <span className={`badge badge-${status.color}`}>{status.label}</span>
            }
        }
    ]

    if (!currentCompany) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">
                    <Building2 />
                </div>
                <h2 className="empty-state-title">Şirket Seçilmedi</h2>
                <p className="empty-state-desc">
                    Araçları görüntülemek için lütfen bir şirket seçin.
                </p>
            </div>
        )
    }


    const vehicleFilters = useMemo(() => {
        const tonMap = new Map()
        const metreMap = new Map()
        const brandSet = new Set()
        const otherModelSet = new Set()

        vehicles.forEach(v => {
            if (v.brand?.trim()) brandSet.add(v.brand.trim())
            if (v.model?.trim()) {
                const parsed = parseVehicleCapacity(v.model)
                if (parsed.type === 'ton' && parsed.num !== null) {
                    tonMap.set(parsed.num, parsed.value)
                } else if (parsed.type === 'metre' && parsed.num !== null) {
                    metreMap.set(parsed.num, parsed.value)
                } else {
                    otherModelSet.add(v.model.trim())
                }
            }
        })

        const tonOptions = Array.from(tonMap.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([num, label]) => ({ value: String(num), label }))

        const metreOptions = Array.from(metreMap.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([num, label]) => ({ value: String(num), label }))

        const brandOptions = Array.from(brandSet)
            .sort((a, b) => a.localeCompare(b, 'tr'))
            .map(b => ({ value: b, label: b }))

        const otherModelOptions = Array.from(otherModelSet)
            .sort((a, b) => a.localeCompare(b, 'tr'))
            .map(m => ({ value: m, label: m }))

        const filters = [
            {
                key: 'status',
                label: 'Durum',
                options: [
                    { value: 'active', label: 'Aktif' },
                    { value: 'maintenance', label: 'Bakımda' },
                    { value: 'inactive', label: 'Pasif' }
                ]
            },
            {
                key: 'capacityType',
                label: 'Kapasite Türü',
                options: [
                    { value: 'ton', label: 'Tonajlı (Ton)' },
                    { value: 'metre', label: 'Metreli (Metre)' },
                    { value: 'other', label: 'Standart / Binek Model' }
                ],
                filterFn: (row, value) => {
                    const parsed = parseVehicleCapacity(row.model)
                    return parsed.type === value
                }
            }
        ]

        if (tonOptions.length > 0) {
            filters.push({
                key: 'tonCapacity',
                label: 'Tonaj (Ton)',
                options: tonOptions,
                filterFn: (row, value) => {
                    const parsed = parseVehicleCapacity(row.model)
                    return parsed.type === 'ton' && String(parsed.num) === String(value)
                }
            })
        }

        if (metreOptions.length > 0) {
            filters.push({
                key: 'metreCapacity',
                label: 'Uzunluk (Metre)',
                options: metreOptions,
                filterFn: (row, value) => {
                    const parsed = parseVehicleCapacity(row.model)
                    return parsed.type === 'metre' && String(parsed.num) === String(value)
                }
            })
        }

        if (brandOptions.length > 0) {
            filters.push({
                key: 'brand',
                label: 'Marka',
                options: brandOptions,
                filterFn: (row, value) => row.brand?.trim().toLowerCase() === value.trim().toLowerCase()
            })
        }

        if (otherModelOptions.length > 0) {
            filters.push({
                key: 'otherModel',
                label: 'Model (Binek)',
                options: otherModelOptions,
                filterFn: (row, value) => row.model?.trim().toLowerCase() === value.trim().toLowerCase()
            })
        }

        return filters
    }, [vehicles])

    return (
        <div>
            <TopProgressBar loading={loading} />
            <div className="page-header">
                <div>
                    <h1 className="page-title">Araçlar</h1>
                    <p style={{ marginTop: '5px', color: '#666' }}>Araç filosu yönetimi ve detayları.</p>
                </div>
                <div className="page-actions">
                    {(isAdmin || hasPermission('vehicles', 'can_create')) && (
                        <button className="btn btn-primary" onClick={openCreateModal}>
                            <Plus size={18} />
                            Yeni Araç
                        </button>
                    )}
                </div>
            </div>

            {/* Dynamic Vehicle Type Tabs */}
            {seenTypes.size > 0 && (() => {
                const existingTypes = Array.from(seenTypes)
                const tabs = existingTypes.map(t => ({ value: t, label: getVehicleTypeLabel(t), count: vehicles.filter(v => v.type === t).length }));
                return (
                    <div className="vehicle-tabs">
                        <button
                            className={`vehicle-tab${activeTab === 'all' ? ' active' : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            Tümü <span className="vehicle-tab-count">{vehicles.length}</span>
                        </button>
                        {tabs.map(tab => (
                            <button
                                key={tab.value}
                                className={`vehicle-tab${activeTab === tab.value ? ' active' : ''}`}
                                onClick={() => setActiveTab(tab.value)}
                            >
                                {tab.label} <span className="vehicle-tab-count">{tab.count}</span>
                            </button>
                        ))}
                    </div>
                );
            })()}

            <DataTable persistenceKey={`Vehicles_table_${activeTab}`}
                columns={columns}
                loading={loading}
                data={(activeTab === 'all' ? vehicles : vehicles.filter(v => v.type === activeTab)).sort(compareVehicleCapacityDesc)}
                showSearch={true}
                showCheckboxes={true}
                onBulkArchive={handleBulkArchive}
                isArchiveView={showArchived}
                onToggleArchiveView={setShowArchived}
                emptyMessage={showArchived ? "Arşivlenmiş araç bulunmuyor." : "Bu kategoride henüz araç bulunmuyor."}
                searchPlaceholder="Plaka, marka, model veya kapasite ara..."
                searchKeys={['plate', 'brand', 'model', 'year']}
                filters={vehicleFilters}
                onRowClick={(vehicle, e) => {
                    if (e.ctrlKey || e.metaKey) {
                        openNewTab(`/vehicles/${vehicle.id}`, true, `${vehicle.plate} ${vehicle.brand} ${vehicle.model}`)
                    } else {
                        navigate(`/vehicles/${vehicle.id}`)
                    }
                }}
                onBulkDelete={handleBulkDeleteClick}
                onContextMenu={handleContextMenu}
                actions={(vehicle) => (
                    <>
                        {(isAdmin || hasPermission('vehicles', 'can_update')) && (
                            <button title="Düzenle" onClick={() => openEditModal(vehicle)}>
                                <Pencil size={16} />
                            </button>
                        )}
                        <button 
                            title={showArchived ? "Arşivden Çıkar" : "Arşivle"} 
                            onClick={() => handleArchiveClick(vehicle)}
                        >
                            {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                        </button>
                        {(isAdmin || hasPermission('vehicles_delete') || hasPermission('vehicles', 'can_delete')) && (
                            <button title="Sil" className="danger" onClick={() => handleDeleteClick(vehicle)}>
                                <Trash2 size={16} />
                            </button>
                        )}
                    </>
                )}
            />

            {vehicles.length === 0 && !loading && !showArchived && seenTypes.size === 0 && (
                <div className="empty-state" style={{ marginTop: '40px', border: 'none', background: 'transparent' }}>
                    <div className="empty-state-icon">
                        <Car />
                    </div>
                    <h2 className="empty-state-title">Henüz Araç Yok</h2>
                    <p className="empty-state-desc">
                        Bu şirkete ait araç bulunmuyor. İlk aracınızı ekleyin.
                    </p>
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        <Plus size={18} />
                        Araç Ekle
                    </button>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingVehicle ? 'Araç Düzenle' : 'Yeni Araç'}
                size="lg"
                footer={null}
            >
                {error && (
                    <div style={{
                        backgroundColor: 'var(--danger-bg)',
                        color: 'var(--danger)',
                        border: '1px solid var(--danger)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '14px',
                        marginBottom: '20px'
                    }}>
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}
                <VehicleForm
                    initialData={editingVehicle}
                    onSubmit={handleSubmit}
                    onCancel={closeModal}
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
        </div>
    )
}
