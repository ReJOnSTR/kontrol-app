import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'
import TopProgressBar from '../components/TopProgressBar'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import CustomInput from '../components/CustomInput'
import { UtensilsCrossed, Users, CalendarDays, Plus, Pencil, Trash2, Settings, TrendingUp } from 'lucide-react'

export default function MealTickets() {
    const { currentCompany } = useCompany()
    const { isAdmin, hasPermission } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()

    const canCreate = isAdmin || hasPermission('meals_create', 'can_create') || hasPermission('meals', 'can_create')
    const canEdit = isAdmin || hasPermission('meals_edit', 'can_update') || hasPermission('meals', 'can_update')
    const canDelete = isAdmin || hasPermission('meals_delete', 'can_delete') || hasPermission('meals', 'can_delete')
    const [tickets, setTickets] = useState([])
    const [stats, setStats] = useState({ totalThisMonth: 0, todayCount: 0, ticketCountThisMonth: 0, pricePerPerson: 0, totalCostThisMonth: 0 })
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingTicket, setEditingTicket] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            setEditingTicket(null)
            setFormDate(new Date().toISOString().split('T')[0])
            setFormCount('')
            setFormNotes('')
            setShowModal(true)
            searchParams.delete('action')
            setSearchParams(searchParams, { replace: true })
        }
    }, [searchParams])

    // Delete confirm
    const [confirmModal, setConfirmModal] = useState(null)
    const [showArchived, setShowArchived] = useState(false)

    // Form state
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
    const [formCount, setFormCount] = useState('')
    const [formNotes, setFormNotes] = useState('')

    const loadData = useCallback(async () => {
        if (!currentCompany) return
        setLoading(true)
        try {
            const [ticketRes, statsRes] = await Promise.all([
                window.electronAPI.getMealTickets(currentCompany.id, showArchived ? 1 : 0),
                window.electronAPI.getMealTicketStats(currentCompany.id)
            ])
            if (ticketRes.success) setTickets(ticketRes.data)
            if (statsRes.success) setStats(statsRes.data)
        } catch (err) {
            console.error('Failed to load meal tickets:', err)
        }
        setLoading(false)
    }, [currentCompany])

    useEffect(() => {
        if (currentCompany) {
            loadData()
        } else {
            setTickets([])
            setStats({ totalThisMonth: 0, todayCount: 0, ticketCountThisMonth: 0, pricePerPerson: 0, totalCostThisMonth: 0 })
            setLoading(false)
        }
    }, [currentCompany, loadData])

    useEffect(() => {
        const unsub = window.electronAPI.onDbUpdate((change) => {
            if (change?.table === 'meal_tickets' || change?.table === 'meal_settings') loadData()
        })
        return () => { if (unsub) unsub() }
    }, [loadData, showArchived])

    const openCreateModal = () => {
        setEditingTicket(null)
        setFormDate(new Date().toISOString().split('T')[0])
        setFormCount('')
        setFormNotes('')
        setError('')
        setShowModal(true)
    }

    const openEditModal = (ticket) => {
        setEditingTicket(ticket)
        setFormDate(ticket.date)
        setFormCount(String(ticket.person_count))
        setFormNotes(ticket.notes || '')
        setError('')
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        const count = parseInt(formCount)
        if (!formDate || !count || count < 1) {
            setError('Tarih ve kişi sayısı gereklidir.')
            return
        }

        setSaving(true)
        try {
            let result
            if (editingTicket) {
                result = await window.electronAPI.updateMealTicket({
                    id: editingTicket.id,
                    date: formDate,
                    personCount: count,
                    notes: formNotes
                })
            } else {
                result = await window.electronAPI.createMealTicket({
                    companyId: currentCompany.id,
                    date: formDate,
                    personCount: count,
                    notes: formNotes
                })
            }

            if (result.success) {
                setShowModal(false)
                loadData()
            } else {
                setError(result.error || 'Bir hata oluştu.')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteClick = (ticket) => {
        setConfirmModal({
            item: ticket,
            title: 'Yemek Fişi Silme',
            message: `${formatDate(ticket.date)} tarihli, ${ticket.person_count} kişilik yemek fişini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        })
    }

    const handleConfirmDelete = async () => {
        if (!confirmModal) return
        if (confirmModal.ids) {
            for (const id of confirmModal.ids) {
                await window.electronAPI.deleteMealTicket(id)
            }
        } else {
            await window.electronAPI.deleteMealTicket(confirmModal.item.id)
        }
        loadData()
        setConfirmModal(null)
    }

    const handleBulkDeleteClick = (ids) => {
        setConfirmModal({
            title: 'Toplu Silme',
            ids,
            message: `${ids.length} adet yemek fişini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        })
    }

    const handleBulkArchive = async (ids) => {
        if (!ids || ids.length === 0) return
        const newStatus = showArchived ? 0 : 1
        for (const id of ids) {
            await window.electronAPI.archiveItem('meal_tickets', id, newStatus)
        }
        loadData()
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        const d = new Date(dateStr)
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(val || 0)
    }

    const columns = useMemo(() => [
        {
            key: 'date',
            label: 'Tarih',
            sortable: true,
            render: (val) => (
                <span style={{ fontWeight: '500' }}>{formatDate(val)}</span>
            )
        },
        {
            key: 'person_count',
            label: 'Kişi Sayısı',
            sortable: true,
            render: (val, item) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={14} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: '600', fontSize: '15px' }}>{val}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>kişi</span>
                    </div>
                    {item.price_per_person > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '20px' }}>
                            Birim: {formatCurrency(item.price_per_person)}
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'cost',
            label: 'Tutar',
            sortable: false,
            render: (_val, item) => {
                const price = item.price_per_person !== undefined && item.price_per_person !== null
                    ? item.price_per_person
                    : (stats.pricePerPerson || 0)
                const cost = (item.person_count || 0) * price
                return cost > 0
                    ? <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{formatCurrency(cost)}</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
            }
        },
        {
            key: 'notes',
            label: 'Notlar',
            sortable: false,
            render: (val) => val || <span style={{ color: 'var(--text-muted)' }}>-</span>
        }
    ], [stats.pricePerPerson])

    const currentMonthName = new Date().toLocaleDateString('tr-TR', { month: '2-digit', year: 'numeric' })

    return (
        <div className="page-container fade-in">
            <TopProgressBar loading={loading} />

            <div className="page-header">
                <div>
                    <h1 className="page-title">Yemek Fişleri</h1>
                    <p className="page-subtitle">Günlük yemek katılım takibi ve fiş yönetimi</p>
                </div>
                {canCreate && (
                    <div className="header-actions">
                        <button
                            className="btn btn-primary"
                            onClick={openCreateModal}
                            disabled={loading || !currentCompany}
                        >
                            <Plus size={18} />
                            Yeni Fiş
                        </button>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '25px' }}>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">BUGÜN</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><UtensilsCrossed size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value">{stats.todayCount} <span style={{ fontSize: '14px', fontWeight: '400' }}>kişi</span></div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Bugün yemeğe giden</div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">BU AY TOPLAM</div>
                        <div className="stat-icon success" style={{ width: '32px', height: '32px' }}><Users size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value">{stats.totalThisMonth} <span style={{ fontSize: '14px', fontWeight: '400' }}>kişi</span></div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{currentMonthName} toplamı</div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">KİŞİ BAŞI ÜCRET</div>
                        <div className="stat-icon warning" style={{ width: '32px', height: '32px' }}><Settings size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '20px' }}>{formatCurrency(stats.pricePerPerson)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Kişi başı yemek ücreti</div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">BU AY MALİYET</div>
                        <div className="stat-icon danger" style={{ width: '32px', height: '32px' }}><TrendingUp size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '20px' }}>{formatCurrency(stats.totalCostThisMonth)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {stats.totalThisMonth} kişi × {formatCurrency(stats.pricePerPerson)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <DataTable persistenceKey="MealTickets_table_0"
                storageKey="meal_tickets_table_cols"
                columns={columns}
                data={tickets}
                loading={loading}
                searchPlaceholder="Tarih veya not ile ara..."
                searchKeys={['date', 'notes']}
                emptyMessage={currentCompany ? "Henüz yemek fişi bulunmuyor." : "Lütfen bir şirket seçin."}
                showSearch={true}
                showCheckboxes={canDelete}
                onBulkDelete={canDelete ? handleBulkDeleteClick : undefined}
                onBulkArchive={canEdit ? handleBulkArchive : undefined}
                isArchiveView={showArchived}
                onToggleArchiveView={setShowArchived}
                showDateFilter={true}
                dateFilterKey="date"
                actions={(item) => (
                    <>
                        {canEdit && <button title="Düzenle" onClick={() => openEditModal(item)}><Pencil size={16} /></button>}
                        {canDelete && <button title="Sil" className="danger" onClick={() => handleDeleteClick(item)}><Trash2 size={16} /></button>}
                    </>
                )}
            />

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingTicket ? "Yemek Fişi Düzenle" : "Yeni Yemek Fişi"}
            >
                <form onSubmit={handleSubmit}>
                    {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <CustomInput
                            label="Tarih"
                            type="date"
                            value={formDate}
                            onChange={(val) => setFormDate(val)}
                            required
                        />

                        <CustomInput
                            label="Kişi Sayısı"
                            format="numeric"
                            value={formCount}
                            onChange={(val) => setFormCount(val)}
                            placeholder="Kaç kişi yemeğe gitti?"
                            required
                            maxLength={4}
                        />

                        <CustomInput
                            label="Notlar"
                            multiline={true}
                            rows={3}
                            value={formNotes}
                            onChange={(val) => setFormNotes(val)}
                            placeholder="Ekstra bilgi (opsiyonel)"
                            maxLength={250}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>İptal</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Kaydediliyor...' : (editingTicket ? 'Güncelle' : 'Kaydet')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirm Modal */}
            {confirmModal && (
                <ConfirmModal
                    isOpen={true}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    onConfirm={handleConfirmDelete}
                    onClose={() => setConfirmModal(null)}
                    confirmText="Evet, Sil"
                    cancelText="İptal"
                    type="danger"
                />
            )}
        </div>
    )
}
