import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import TopProgressBar from '../components/TopProgressBar'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import TransactionForm from '../components/forms/TransactionForm'
import ConfirmModal from '../components/ConfirmModal'
import { Plus, Pencil, Trash2, FileSignature, AlertCircle, CheckCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '../utils/helpers'

export default function Checks() {
    const { currentCompany } = useCompany()
    const [searchParams, setSearchParams] = useSearchParams()
    const [checks, setChecks] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [confirmModal, setConfirmModal] = useState(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTx, setEditingTx] = useState(null)
    const [saving, setSaving] = useState(false)
    const [showArchived, setShowArchived] = useState(false)

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            openCreateModal()
            searchParams.delete('action')
            setSearchParams(searchParams, { replace: true })
        }
    }, [searchParams])
    const [stats, setStats] = useState({
        approaching: 0,
        unpaid: 0,
        cashed: 0
    })

    const loadData = async () => {
        if (!currentCompany) return
        setLoading(true)
        try {
            const data = await window.electronAPI.getChecks(currentCompany.id, showArchived ? 1 : 0)
            if (data.success) {
                setChecks(data.data)

                // Calculate Stats
                let approaching = 0
                let unpaid = 0
                let cashed = 0

                const today = new Date()

                data.data.forEach(check => {
                    const isIncome = check.type === 'IN'
                    if (check.status === 'PENDING') {
                        // Eğer gelir çekiyse ödenmemiş olarak say
                        if (isIncome) unpaid += check.amount

                        // Vadesi gelmiş ve yaklaşanlar (gelecek 30 gün)
                        if (check.check_due_date) {
                            const dueDate = new Date(check.check_due_date)
                            const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
                            if (diffDays >= 0 && diffDays <= 30) {
                                approaching += check.amount
                            }
                        }
                    } else if (check.status === 'COMPLETED') {
                        if (isIncome) cashed += check.amount
                    }
                })

                setStats({ approaching, unpaid, cashed })
            } else {
                setError(data.error)
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()

        const cleanup = window.electronAPI.onDbUpdate((update) => {
            if (update.table === 'transactions') {
                loadData()
            }
        })

        return cleanup
    }, [currentCompany, showArchived])

    const handleStatusUpgrade = async (item) => {
        setConfirmModal({
            type: 'status',
            item,
            title: 'Çek Tahsil Edildi',
            message: `Bu ${item.type === 'IN' ? 'alınan' : 'verilen'} çeki tahsil edildi / ödendi olarak işaretlemek istediğinize emin misiniz?`
        })
    }

    const handleDeleteClick = (item) => {
        setConfirmModal({
            type: 'delete',
            item,
            title: 'Çeki Sil',
            message: 'Bu çek kaydını silmek istediğinize emin misiniz? Geri alınamaz.'
        })
    }

    const handleConfirm = async () => {
        if (!confirmModal) return

        if (confirmModal.type === 'delete') {
            await window.electronAPI.deleteFinance(confirmModal.item.id)
        } else if (confirmModal.type === 'status') {
            await window.electronAPI.updateCheckStatus({ id: confirmModal.item.id, status: 'COMPLETED' })
        } else if (confirmModal.type === 'bulk_delete') {
            for (const id of confirmModal.ids) {
                await window.electronAPI.deleteFinance(id)
            }
        }

        loadData()
        setConfirmModal(null)
    }

    const handleBulkDeleteClick = (ids) => {
        setConfirmModal({
            type: 'bulk_delete',
            ids,
            title: 'Toplu Çek Silme',
            message: `${ids.length} adet çeki silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        })
    }

    const handleBulkArchive = async (ids) => {
        if (!ids || ids.length === 0) return
        const newStatus = showArchived ? 0 : 1
        for (const id of ids) {
            await window.electronAPI.archiveItem('transactions', id, newStatus)
        }
        loadData()
    }

    const openAddModal = () => {
        setEditingTx(null)
        setError(null)
        setIsModalOpen(true)
    }

    const openEditModal = (item) => {
        setEditingTx(item)
        setError(null)
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        setEditingTx(null)
        setError(null)
    }

    const handleFormSubmit = async (data) => {
        setSaving(true)
        setError(null)
        try {
            const txData = {
                ...data,
                companyId: currentCompany.id
            }

            let result
            if (editingTx) {
                result = await window.electronAPI.updateFinance({ ...txData, id: editingTx.id })
            } else {
                result = await window.electronAPI.createFinance(txData)
            }

            if (result.success) {
                closeModal()
                loadData()
            } else {
                setError(result.error || 'İşlem kaydedilirken bir hata oluştu.')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const columns = useMemo(() => [
        {
            key: 'type',
            label: 'Çek Türü',
            sortable: true,
            render: (val) => {
                const isIncome = val === 'IN'
                return (
                    <span className={`badge badge-${isIncome ? 'primary' : 'warning'}`}>
                        {isIncome ? 'Alınan Çek' : 'Verilen Çek'}
                    </span>
                )
            }
        },
        {
            key: 'check_number',
            label: 'Çek No',
            sortable: true,
            render: (val) => val || '-'
        },
        {
            key: 'check_due_date',
            label: 'Vade Tarihi',
            sortable: true,
            render: (val) => {
                if (!val) return '-'

                // Color formatting logic based on due date matching email notification motor
                const due = new Date(val)
                const today = new Date()
                const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))

                let textColor = 'inherit'
                if (diffDays < 0) textColor = '#ef4444' // Geçmiş vade
                else if (diffDays === 0) textColor = '#fb923c' // Bugün
                else if (diffDays <= 3) textColor = '#facc15' // Acil
                else if (diffDays <= 30) textColor = '#14b8a6' // Yaklaşan (30 gün)

                const subText = diffDays < 0 ? `${Math.abs(diffDays)} gün geçti` : diffDays === 0 ? 'Bugün' : `${diffDays} gün kaldı`

                return (
                    <div>
                        <span style={{ color: textColor, fontWeight: '600' }}>{formatDate(val)}</span>
                        <div style={{ fontSize: '10.5px', color: textColor, opacity: 0.9 }}>{subText}</div>
                    </div>
                )
            }
        },
        {
            key: 'amount',
            label: 'Tutar',
            sortable: true,
            render: (val, row) => (
                <div style={{ fontWeight: '600' }}>{formatCurrency(val)}</div>
            )
        },
        {
            key: 'description',
            label: 'Açıklama / Sahibi',
            sortable: true
        },
        {
            key: 'status',
            label: 'Durum',
            sortable: true,
            render: (val) => {
                if (val === 'COMPLETED') return <span className="badge badge-success">Tahsil Edildi</span>
                return <span className="badge badge-warning">Bekliyor</span>
            }
        }
    ], [])

    return (
        <div className="page-container fade-in">
            <TopProgressBar loading={loading} />

            <div className="page-header">
                <div>
                    <h1 className="page-title">Çek & Senet Portföyü</h1>
                    <p className="page-subtitle">Kasadaki müşteri çekleri ve tedarikçi senetlerinin takibi</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Plus size={20} />
                        Yeni Çek Ekle
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '25px' }}>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">BEKLEYEN ÇEKLER</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><FileSignature size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value">{formatCurrency(stats.unpaid)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Toplam tahsil edilecek tutar
                        </div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">VADESİ YAKLAŞANLAR (30 GÜN)</div>
                        <div className="stat-icon" style={{ width: '32px', height: '32px', background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6' }}><AlertCircle size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value">{formatCurrency(stats.approaching)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            30 gün içinde vadesi gelen tahsilatlar
                        </div>
                    </div>
                </div>

                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">TAHSİL EDİLEN ÇEKLER</div>
                        <div className="stat-icon success" style={{ width: '32px', height: '32px' }}><CheckCircle size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value">{formatCurrency(stats.cashed)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Başarıyla nakite dönenler
                        </div>
                    </div>
                </div>
            </div>

            <DataTable persistenceKey="Checks_table_0"
                storageKey="checks_table_cols"
                columns={columns}
                data={checks}
                loading={loading}
                searchPlaceholder="Çek no veya açıklama ile ara..."
                searchKeys={['description', 'check_number']}
                emptyMessage="Sistemde henüz bir çek bulunmuyor."
                showSearch={true}
                showCheckboxes={true}
                onBulkDelete={handleBulkDeleteClick}
                onBulkArchive={handleBulkArchive}
                isArchiveView={showArchived}
                onToggleArchiveView={setShowArchived}
                showDateFilter={true}
                dateFilterKey="check_due_date"
                filters={[
                    {
                        key: 'type',
                        label: 'Çek Türü',
                        options: [
                            { value: 'IN', label: 'Alınan Çek' },
                            { value: 'OUT', label: 'Verilen Çek' }
                        ]
                    },
                    {
                        key: 'status',
                        label: 'Durum',
                        options: [
                            { value: 'PENDING', label: 'Bekleyen' },
                            { value: 'COMPLETED', label: 'Tahsil Edilmiş' }
                        ]
                    }
                ]}
                actions={(item) => (
                    <>
                        {item.status !== 'COMPLETED' && (
                            <button
                                title="Tahsil Edildi İşaretle"
                                style={{ color: 'var(--success)' }}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleStatusUpgrade(item)
                                }}
                            >
                                <CheckCircle size={16} />
                            </button>
                        )}
                        <button title="Düzenle" onClick={(e) => { e.stopPropagation(); openEditModal(item); }}>
                            <Pencil size={16} />
                        </button>
                        <button title="Sil" className="danger" onClick={(e) => { e.stopPropagation(); handleDeleteClick(item); }}>
                            <Trash2 size={16} />
                        </button>
                    </>
                )}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingTx ? 'Çeki Düzenle' : 'Yeni Çek Ekle'}
            >
                {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}

                <TransactionForm
                    initialData={editingTx}
                    onSubmit={handleFormSubmit}
                    onCancel={closeModal}
                    loading={saving}
                    onlyCheck={true}
                />
            </Modal>

            {confirmModal && (
                <ConfirmModal
                    isOpen={true}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmModal(null)}
                    confirmText="Onayla"
                    cancelText="İptal"
                    isDanger={confirmModal.type === 'delete'}
                />
            )}
        </div>
    )
}
