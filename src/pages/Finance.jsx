import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import TopProgressBar from '../components/TopProgressBar'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import DataTable from '../components/DataTable'
import TransactionForm from '../components/forms/TransactionForm'
import { formatCurrency, formatDate } from '../utils/helpers'
import { Plus, Wallet, Banknote, FileSignature, ArrowDownRight, Trash2, Pencil, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Finance() {
    const { currentCompany } = useCompany()
    const { isAdmin, hasPermission } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()
    const [transactions, setTransactions] = useState([])
    const [stats, setStats] = useState({
        totalBalance: 0,
        cashBalance: 0,
        pendingChecks: 0,
        currentMonthOut: 0
    })
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTx, setEditingTx] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [confirmModal, setConfirmModal] = useState(null)
    const [showArchived, setShowArchived] = useState(false)
    const [filteredTransactions, setFilteredTransactions] = useState([])
    const [selectedIds, setSelectedIds] = useState([])

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            openCreateModal()
            searchParams.delete('action')
            setSearchParams(searchParams, { replace: true })
        }
    }, [searchParams])

    const filteredTotal = useMemo(() => {
        return filteredTransactions.reduce((sum, tx) => {
            return sum + (tx.type === 'IN' ? tx.amount : -tx.amount)
        }, 0)
    }, [filteredTransactions])

    const selectedTotal = useMemo(() => {
        const selectedTxs = transactions.filter(tx => selectedIds.includes(tx.id))
        return selectedTxs.reduce((sum, tx) => {
            return sum + (tx.type === 'IN' ? tx.amount : -tx.amount)
        }, 0)
    }, [selectedIds, transactions])

    const isFiltered = filteredTransactions.length > 0 && filteredTransactions.length < transactions.length

    useEffect(() => {
        if (currentCompany) {
            loadData()
        } else {
            setTransactions([])
            setStats({ totalBalance: 0, cashBalance: 0, pendingChecks: 0, currentMonthOut: 0 })
            setLoading(false)
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
            if (['transactions', 'recurring_transactions'].includes(change?.table)) {
                console.log(`[RealTime] Finance reloading for change in ${change.table}`)
                loadDataRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const loadData = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            const [txRes, statsRes] = await Promise.all([
                window.electronAPI.getAllFinance(currentCompany.id, showArchived ? 1 : 0),
                window.electronAPI.getFinanceStats(currentCompany.id)
            ])

            if (txRes.success) setTransactions(txRes.data)
            if (statsRes.success) setStats(statsRes.data)
        } catch (error) {
            console.error('Failed to load finance data:', error)
        }
        if (!isBackground) setLoading(false)
    }

    const resetForm = () => {
        setEditingTx(null)
        setError('')
    }

    const openCreateModal = () => {
        resetForm()
        setIsModalOpen(true)
    }

    const openEditModal = (tx) => {
        setEditingTx(tx)
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
            companyId: currentCompany.id
        }

        let result
        if (editingTx) {
            result = await window.electronAPI.updateFinance({ id: editingTx.id, ...payload })
        } else {
            result = await window.electronAPI.createFinance(payload)
        }

        setSaving(false)

        if (result.success) {
            closeModal()
            loadData()
        } else {
            setError(result.error)
        }
    }

    const handleDeleteClick = (tx) => {
        setConfirmModal({
            type: 'single',
            item: tx,
            title: 'İşlem Silme',
            message: 'Bu finansal işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve bakiyenizi etkileyecektir.'
        })
    }

    const handleConfirmDelete = async () => {
        if (!confirmModal) return

        if (confirmModal.type === 'single') {
            await window.electronAPI.deleteFinance(confirmModal.item.id)
        } else if (confirmModal.type === 'bulk') {
            for (const id of confirmModal.ids) {
                await window.electronAPI.deleteFinance(id)
            }
        }

        loadData()
        setConfirmModal(null)
    }

    const handleBulkDeleteClick = (ids) => {
        setConfirmModal({
            type: 'bulk',
            ids,
            title: 'Toplu İşlem Silme',
            message: `${ids.length} adet işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve bakiyenizi etkileyecektir.`
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

    // Prepare table columns
    const columns = useMemo(() => [
        {
            key: 'date',
            label: 'Tarih',
            sortable: true,
            render: (val) => formatDate(val)
        },
        {
            key: 'type',
            label: 'İşlem Türü',
            sortable: true,
            render: (val, row) => {
                const isIncome = val === 'IN'
                return (
                    <span className={`badge badge-${isIncome ? 'success' : 'danger'}`}>
                        {isIncome ? 'Gelir / Tahsilat' : 'Gider / Ödeme'}
                    </span>
                )
            }
        },
        {
            key: 'method',
            label: 'Yöntem',
            sortable: true,
            render: (val) => {
                switch (val) {
                    case 'CASH': return <span className="badge badge-info">Nakit</span>
                    case 'BANK': return <span className="badge badge-primary">Banka</span>
                    case 'CHECK': return <span className="badge badge-warning">Çek</span>
                    default: return <span className="badge badge-secondary">{val}</span>
                }
            }
        },
        {
            key: 'description',
            label: 'Açıklama',
            sortable: false
        },
        {
            key: 'details',
            label: 'Çek Detayı',
            sortable: false,
            render: (_, row) => {
                if (row.method === 'CHECK') {
                    return (
                        <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {row.check_number && <div>No: {row.check_number}</div>}
                            {row.check_due_date && <div>Vade: {formatDate(row.check_due_date)}</div>}
                            <span className={`badge badge-${row.status === 'PENDING' ? 'warning' : 'success'}`} style={{ alignSelf: 'flex-start', marginTop: '2px' }}>
                                {row.status === 'PENDING' ? 'Müşteride Bekliyor' : 'Tahsil Edildi'}
                            </span>
                        </div>
                    )
                }
                return '-'
            }
        },
        {
            key: 'amount',
            label: 'Tutar',
            sortable: true,
            render: (val, row) => {
                const isIncome = row.type === 'IN'
                return (
                    <div style={{
                        color: isIncome ? 'var(--success)' : 'var(--danger)',
                        fontWeight: '600'
                    }}>
                        {isIncome ? '+' : '-'}{formatCurrency(val)}
                    </div>
                )
            }
        }
    ], [])

    const searchKeys = useMemo(() => ['description', 'amount', 'method', 'check_number'], [])

    return (
        <div className="page-container fade-in">
            <TopProgressBar loading={loading} />

            <div className="page-header">
                <div>
                    <h1 className="page-title">Kasa & Banka Cüzdanı</h1>
                    <p className="page-subtitle">Kasa ve banka hesap hareketleri, gelir/gider detayları</p>
                </div>

                <div className="header-actions">
                    {(isAdmin || hasPermission('finance_cash') || hasPermission('finance', 'can_create')) && (
                        <button
                            className="btn btn-primary"
                            onClick={openCreateModal}
                            disabled={loading || !currentCompany}
                        >
                            <Plus size={18} />
                            Yeni İşlem
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '25px' }}>
                {/* Cash Balance */}
                <div className="stat-card" style={{ width: '300px', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">KASA BAKİYESİ</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><Banknote size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value">{formatCurrency(stats.cashBalance)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Güncel nakit tutarı
                        </div>
                    </div>
                </div>

                {/* Filtered Total Card */}
                {isFiltered && (
                    <div className="stat-card fade-in" style={{ 
                        width: '300px', 
                        flexDirection: 'column', 
                        alignItems: 'flex-start', 
                        gap: '10px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <div className="stat-label">FİLTRELENMİŞ TOPLAM</div>
                            <div className={`stat-icon ${filteredTotal >= 0 ? 'success' : 'danger'}`} style={{ width: '32px', height: '32px' }}>
                                <ArrowDownRight size={16} />
                            </div>
                        </div>
                        <div>
                            <div className="stat-value" style={{ color: filteredTotal >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {formatCurrency(filteredTotal)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {filteredTransactions.length} işlem baz alındı
                            </div>
                        </div>
                    </div>
                )}
                {/* Selected Total Card */}
                {selectedIds.length > 0 && (
                    <div className="stat-card fade-in" style={{ 
                        width: '300px', 
                        flexDirection: 'column', 
                        alignItems: 'flex-start', 
                        gap: '10px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <div className="stat-label" style={{ color: 'var(--warning)', opacity: 0.9 }}>SEÇİLEN TOPLAM</div>
                            <div className="stat-icon warning" style={{ width: '32px', height: '32px' }}>
                                <Check size={16} />
                            </div>
                        </div>
                        <div>
                            <div className="stat-value" style={{ color: 'var(--warning)' }}>
                                {formatCurrency(selectedTotal)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {selectedIds.length} öğe seçildi
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <DataTable persistenceKey="Finance_table_0"
                storageKey="finance_table_cols"
                columns={columns}
                data={transactions}
                onFilteredDataChange={setFilteredTransactions}
                onSelectionChange={setSelectedIds}
                loading={loading}
                searchPlaceholder="Açıklama, tutar veya yöntem ile ara..."
                searchKeys={searchKeys}
                emptyMessage={currentCompany ? "Henüz işlem bulunmuyor." : "Lütfen bir şirket seçin."}
                showSearch={true}
                showCheckboxes={true}
                onBulkDelete={handleBulkDeleteClick}
                onBulkArchive={handleBulkArchive}
                isArchiveView={showArchived}
                onToggleArchiveView={setShowArchived}
                showDateFilter={true}
                dateFilterKey="date"
                filters={[
                    {
                        key: 'type',
                        label: 'İşlem Türü',
                        options: [
                            { value: 'IN', label: 'Gelir' },
                            { value: 'OUT', label: 'Gider' }
                        ]
                    },
                    {
                        key: 'method',
                        label: 'Yöntem',
                        options: [
                            { value: 'CASH', label: 'Nakit' },
                            { value: 'BANK', label: 'Banka' }
                        ]
                    }
                ]}
                actions={(item) => (
                    <>
                        {(isAdmin || hasPermission('finance_cash') || hasPermission('finance', 'can_update')) && (
                            <button title="Düzenle" onClick={() => openEditModal(item)}><Pencil size={16} /></button>
                        )}
                        {(isAdmin || hasPermission('finance_delete') || hasPermission('finance', 'can_delete')) && (
                            <button title="Sil" className="danger" onClick={() => handleDeleteClick(item)}><Trash2 size={16} /></button>
                        )}
                    </>
                )}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingTx ? 'İşlemi Düzenle' : 'Yeni İşlem Ekle'}
            >
                {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}

                <TransactionForm
                    initialData={editingTx}
                    onSubmit={handleFormSubmit}
                    onCancel={closeModal}
                    loading={saving}
                    hideCheck={true}
                />
            </Modal>

            {confirmModal && (
                <ConfirmModal
                    isOpen={true}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setConfirmModal(null)}
                    confirmText="Evet, Sil"
                    cancelText="İptal"
                    isDanger={true}
                />
            )}
        </div>
    )
}
