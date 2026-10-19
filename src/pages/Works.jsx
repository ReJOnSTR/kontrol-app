import React, { useState, useEffect, useMemo, useRef } from 'react' // Trigger recompilation
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { useTabs } from '../context/TabContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import WorkForm from '../components/forms/WorkForm'
import { Plus, CheckCircle, Clock, AlertCircle, Calendar, Pencil, Trash2, MapPin, Truck, User, ArrowRight, Archive, ArchiveRestore } from 'lucide-react'
import { formatDate, formatCurrency, getWorkStatusLabel, getWorkStatusColor } from '../utils/helpers'
import { dataCache } from '../utils/dataCache'

export default function Works() {
    const { user, isAdmin, hasPermission } = useAuth()
    const { currentCompany } = useCompany()
    const { openNewTab } = useTabs()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const [works, setWorks] = useState([])
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingWork, setEditingWork] = useState(null)
    const [saving, setSaving] = useState(false)
    const [confirmModal, setConfirmModal] = useState(null)
    const [showArchived, setShowArchived] = useState(false)

    // Permissions
    const canViewPrices = isAdmin || hasPermission('works_view_prices') || hasPermission('works', 'can_view_prices')
    const canCreate = isAdmin || hasPermission('works_create', 'can_create') || hasPermission('works', 'can_create')
    const canEdit = isAdmin || hasPermission('works_edit', 'can_update') || hasPermission('works', 'can_update')
    const canDelete = isAdmin || hasPermission('works_delete', 'can_delete') || hasPermission('works', 'can_delete')

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            setEditingWork(null)
            setIsModalOpen(true)
            searchParams.delete('action')
            setSearchParams(searchParams, { replace: true })
        }
    }, [searchParams])

    useEffect(() => {
        if (currentCompany) {
            loadData()
        }
    }, [currentCompany, showArchived])

    // Real-time synchronization listener
    const loadDataRef = useRef(null)
    useEffect(() => {
        loadDataRef.current = loadData
    })
    useEffect(() => {
        if (!currentCompany) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if (['works', 'work_items', 'customers'].includes(change?.table)) {
                console.log(`[RealTime] Works reloading for change in ${change.table}`)
                loadDataRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const loadData = async (isBackground = false) => {
        const cacheKey = `works_${currentCompany?.id}_${showArchived ? 1 : 0}`
        const cached = dataCache.get(cacheKey)
        if (cached && !isBackground) {
            setWorks(cached.works)
            if (cached.customers) setCustomers(cached.customers)
            setLoading(false)
            isBackground = true
        } else if (!isBackground) {
            setLoading(true)
        }

        try {
            const [worksRes, customersRes] = await Promise.all([
                window.electronAPI.getWorks(currentCompany.id, showArchived ? 1 : 0),
                window.electronAPI.getCustomers(currentCompany.id)
            ])
            if (worksRes.success) setWorks(worksRes.data)
            if (customersRes.success) setCustomers(customersRes.data)

            if (worksRes.success && customersRes.success) {
                dataCache.set(cacheKey, {
                    works: worksRes.data,
                    customers: customersRes.data
                })
            }
        } catch (error) {
            console.error('Veri yüklenirken hata:', error)
        }
        if (!isBackground) setLoading(false)
    }

    const handleFormSubmit = async (data) => {
        setSaving(true)
        const payload = {
            ...data,
            companyId: currentCompany.id
        }

        let result
        if (editingWork) {
            result = await window.electronAPI.updateWork({ id: editingWork.id, ...payload })
        } else {
            result = await window.electronAPI.createWork(payload)
        }

        if (result.success) {
            setIsModalOpen(false)
            loadData()
        } else {
            alert('Hata: ' + result.error)
        }
        setSaving(false)
    }

    const handleDeleteClick = (work) => {
        setConfirmModal({
            title: 'İşi Sil',
            message: 'Bu iş kaydını ve bağlı tüm detayları silmek istediğinize emin misiniz?',
            onConfirm: async () => {
                const result = await window.electronAPI.deleteWork(work.id)
                if (result.success) {
                    loadData()
                    setConfirmModal(null)
                } else {
                    alert('Silme hatası: ' + result.error)
                }
            }
        })
    }

    const handleBulkDeleteClick = (ids) => {
        setConfirmModal({
            title: 'Toplu Silme',
            message: `${ids.length} iş kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
            onConfirm: async () => {
                const res = await window.electronAPI.deleteWorks(ids)
                if (res.success) {
                    loadData()
                    setConfirmModal(null)
                } else {
                    alert('Silme hatası: ' + res.error)
                }
            }
        })
    }

    const handleBulkArchive = async (ids) => {
        if (!ids || ids.length === 0) return
        const newStatus = showArchived ? 0 : 1
        const res = await window.electronAPI.archiveWorks(ids, newStatus)
        if (res.success) {
            loadData()
        } else {
            alert('Arşivleme hatası: ' + res.error)
        }
    }

    const handleArchiveClick = async (work) => {
        const newStatus = showArchived ? 0 : 1
        const res = await window.electronAPI.archiveWorks([work.id], newStatus)
        if (res.success) {
            loadData()
        } else {
            alert('Arşivleme hatası: ' + res.error)
        }
    }

    const openCreateModal = () => {
        setEditingWork(null)
        setIsModalOpen(true)
    }

    const openEditModal = (work) => {
        setEditingWork(work)
        setIsModalOpen(true)
    }

    const handleRowClick = (row, e) => {
        if (e.ctrlKey || e.metaKey) {
            openNewTab(`/works/${row.id}`, true, `İş: ${row.customer}`)
        } else {
            navigate(`/works/${row.id}`)
        }
    }

    // Stats
    const stats = useMemo(() => {
        const total = works.length
        const pending = works.filter(w => w.status === 'pending').length
        const inProgress = works.filter(w => w.status === 'in_progress').length
        const completed = works.filter(w => w.status === 'completed').length
        return { total, pending, inProgress, completed }
    }, [works])

    const columns = [
        {
            key: 'status',
            label: 'Durum',
            width: '120px',
            render: (v) => (
                <span className={`badge badge-${getWorkStatusColor(v)}`}>
                    {getWorkStatusLabel(v)}
                </span>
            )
        },
        {
            key: 'date_range',
            label: 'Tarih Aralığı',
            width: '120px',
            render: (_, row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '12px' }}>
                        {/* Vertical Timeline Indicator */}
                        <div style={{ position: 'absolute', left: 0, top: '6px', bottom: row.start_date !== row.end_date ? '6px' : 'auto', height: row.start_date === row.end_date ? '0px' : 'auto', width: '2px', background: 'var(--border-color)', borderRadius: '2px' }}>
                            <div style={{ position: 'absolute', left: '-2px', top: '-2px', width: '6px', height: '6px', borderRadius: '50%', border: '1.5px solid var(--accent-primary)', background: 'var(--bg-primary)' }} />
                            {row.start_date !== row.end_date && (
                                <div style={{ position: 'absolute', left: '-2px', bottom: '-2px', width: '6px', height: '6px', borderRadius: '50%', border: '1.5px solid var(--text-muted)', background: 'var(--bg-primary)' }} />
                            )}
                        </div>

                        <span style={{ fontSize: '11.5px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: '1.3' }}>
                            {formatDate(row.start_date)}
                        </span>
                        {row.start_date !== row.end_date && (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.3', marginTop: '2px' }}>
                                {formatDate(row.end_date)}
                            </span>
                        )}
                    </div>
                    {(row.total_days > 0) && (
                        <div style={{ marginLeft: 'auto', padding: '4px 6px', background: 'var(--accent-subtle)', color: 'var(--accent-primary)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            {row.total_days} Gün
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'customer',
            label: 'Müşteri',
            render: (_v, row) => <span style={{ fontWeight: 600 }}>{row.customer_name || row.customer}</span>
        },
        {
            key: 'title',
            label: 'İş Detayı',
            render: (v, row) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{v}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{row.location ? row.location : row.description}</div>
                </div>
            )
        },
        {
            key: 'item_count',
            label: 'Kayıt',
            render: (v) => <span className="badge badge-neutral">{v || 0} Adet</span>
        },
        {
            key: 'total_days',
            label: 'Toplam Süre',
            render: (v, row) => {
                if (row.duration_text) return row.duration_text;
                const items = row.work_items || [];
                if (items.length > 0) {
                    let gunCount = 0;
                    let saatCount = 0;
                    items.forEach(item => {
                        const isH = (item.description || '').toUpperCase().includes('[SAATLİK]') || item.pricingType === 'hourly';
                        const h = Number(item.hours) || 0;
                        if (isH) saatCount += h;
                        else gunCount += h;
                    });
                    if (gunCount > 0 && saatCount > 0) return `${gunCount} Gün + ${saatCount} Saat`;
                    if (saatCount > 0) return `${saatCount} Saat`;
                    if (gunCount > 0) return `${gunCount} Gün`;
                }
                const isHourly = row.is_hourly;
                const displayVal = row.total_hours || v || 0;
                if (!displayVal) return '-';
                return `${displayVal} ${isHourly ? 'Saat' : 'Gün'}`;
            }
        },
        {
            key: 'total_price',
            label: 'Toplam Tutar',
            render: (v) => (
                <span className="font-semibold text-success">
                    {canViewPrices ? formatCurrency(v || 0) : '•••••• ₺'}
                </span>
            )
        }
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">İş Takibi (Vinç)</h1>
                    <p className="page-subtitle">Vinç kiralama ve iş emri yönetimi</p>
                </div>
                {canCreate && (
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        <Plus size={18} /> Yeni İş
                    </button>
                )}
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-icon warning">
                        <Clock />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.inProgress}</div>
                        <div className="stat-label">Devam Eden</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon neutral">
                        <AlertCircle />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.pending}</div>
                        <div className="stat-label">Bekleyen</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon success">
                        <CheckCircle />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.completed}</div>
                        <div className="stat-label">Tamamlanan</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon primary">
                        <Calendar />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.total}</div>
                        <div className="stat-label">Toplam İş</div>
                    </div>
                </div>
            </div>

            <DataTable persistenceKey="Works_table_0"
                loading={loading}
                key="works-table"
                columns={columns}
                data={works}
                filters={[
                    {
                        key: 'status',
                        label: 'Durum Filtresi',
                        options: [
                            { value: 'pending', label: 'Bekliyor' },
                            { value: 'in_progress', label: 'Devam Ediyor' },
                            { value: 'completed', label: 'Tamamlandı' },
                            { value: 'paid', label: 'Ödendi / Tahsil Edildi' },
                            { value: 'cancelled', label: 'İptal' }
                        ]
                    }
                ]}
                emptyMessage="Henüz iş kaydı bulunamadı"
                showSearch={true}
                showCheckboxes={canDelete}
                showDateFilter={true}
                dateFilterKey="start_date"
                dateFilterEndKey="end_date"
                onRowClick={handleRowClick}
                onBulkDelete={canDelete ? handleBulkDeleteClick : undefined}
                onBulkArchive={canEdit ? handleBulkArchive : undefined}
                isArchiveView={showArchived}
                onToggleArchiveView={setShowArchived}
                actions={(item) => (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                            <button className="btn-icon" title="Düzenle" onClick={(e) => { e.stopPropagation(); openEditModal(item) }}>
                                <Pencil size={16} />
                            </button>
                        )}
                        {canEdit && (
                            <button 
                                className="btn-icon" 
                                title={showArchived ? "Arşivden Çıkar" : "Arşivle"} 
                                onClick={(e) => { e.stopPropagation(); handleArchiveClick(item) }}
                            >
                                {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                            </button>
                        )}
                        {canDelete && (
                            <button className="btn-icon danger" title="Sil" onClick={(e) => { e.stopPropagation(); handleDeleteClick(item) }}>
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                )}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingWork ? 'İşi Düzenle' : 'Yeni İş Ekle'}
                footer={null}
            >
                <WorkForm
                    initialData={editingWork}
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsModalOpen(false)}
                    loading={saving}
                    customers={customers}
                />
            </Modal>

            <ConfirmModal
                isOpen={!!confirmModal}
                onClose={() => setConfirmModal(null)}
                onConfirm={confirmModal?.onConfirm}
                title={confirmModal?.title}
                message={confirmModal?.message}
                type="danger"
            />
        </div>
    )
}
