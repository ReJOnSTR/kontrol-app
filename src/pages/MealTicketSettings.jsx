import { useState, useEffect, useCallback } from 'react'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'
import TopProgressBar from '../components/TopProgressBar'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import CustomInput from '../components/CustomInput'
import ConfirmModal from '../components/ConfirmModal'
import { Save, CircleDollarSign, Pencil, Trash2 } from 'lucide-react'

export default function MealTicketSettings() {
    const { currentCompany } = useCompany()
    const { isAdmin, hasPermission } = useAuth()
    const canEditSettings = isAdmin || hasPermission('meals_settings') || hasPermission('meals', 'can_update')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [pricePerPerson, setPricePerPerson] = useState(0)
    const [showModal, setShowModal] = useState(false)
    const [editValue, setEditValue] = useState('')
    const [editDate, setEditDate] = useState('')
    const [editingRecord, setEditingRecord] = useState(null) // null for new, 'active' for active, log object for past
    const [priceHistory, setPriceHistory] = useState([])
    const [confirmModal, setConfirmModal] = useState(null)

    const handleDeleteClick = (item) => {
        setConfirmModal({
            item,
            title: 'Fiyat Geçmişi Silme',
            message: `${new Date(item.change_date).toLocaleDateString('tr-TR')} tarihli fiyat geçmişi kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        })
    }

    const handleConfirmDelete = async () => {
        if (!confirmModal) return
        try {
            const result = await window.electronAPI.deleteMealPriceHistory(confirmModal.item.id)
            if (result.success) {
                setConfirmModal(null)
                loadSettings()
            }
        } catch (err) {
            console.error('Failed to delete price history:', err)
        }
    }

    const loadSettings = useCallback(async () => {
        if (!currentCompany) return
        setLoading(true)
        try {
            const [priceRes, historyRes] = await Promise.all([
                window.electronAPI.getMealPrice(currentCompany.id),
                window.electronAPI.getMealPriceHistory(currentCompany.id)
            ])
            if (priceRes.success) {
                setPricePerPerson(priceRes.data.price_per_person || 0)
            }
            if (historyRes.success) {
                setPriceHistory(historyRes.data || [])
            }
        } catch (err) {
            console.error('Failed to load meal settings:', err)
        }
        setLoading(false)
    }, [currentCompany])

    useEffect(() => {
        if (currentCompany) loadSettings()
    }, [currentCompany, loadSettings])

    useEffect(() => {
        const unsub = window.electronAPI.onDbUpdate((change) => {
            if (change?.table === 'meal_settings') loadSettings()
        })
        return () => { if (unsub) unsub() }
    }, [loadSettings])

    const openCreate = () => {
        setEditingRecord(null)
        setEditValue('')
        setEditDate(new Date().toISOString().split('T')[0])
        setShowModal(true)
    }

    const openEditActive = () => {
        setEditingRecord('active')
        setEditValue(String(pricePerPerson || ''))
        const activeDate = priceHistory.length > 0 ? priceHistory[0].change_date : (currentCompany?.created_at || new Date())
        setEditDate(new Date(activeDate).toISOString().split('T')[0])
        setShowModal(true)
    }

    const openEditPast = (record) => {
        setEditingRecord(record)
        setEditValue(String(record.old_price))
        setEditDate(new Date(record.change_date).toISOString().split('T')[0])
        setShowModal(true)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const price = parseFloat(editValue) || 0
            let result
            if (editingRecord === 'active' || editingRecord === null) {
                result = await window.electronAPI.setMealPrice({
                    companyId: currentCompany.id,
                    pricePerPerson: price,
                    changeDate: editDate
                })
            } else {
                result = await window.electronAPI.updateMealPriceHistory({
                    id: editingRecord.id,
                    price: price,
                    date: editDate
                })
            }
            if (result.success) {
                setShowModal(false)
                loadSettings()
            }
        } catch (err) {
            console.error('Failed to save meal price:', err)
        }
        setSaving(false)
    }

    const formatCurrency = (val) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0)

    // Construct unified pricing history table data
    const tableData = []
    if (pricePerPerson !== undefined && pricePerPerson !== null) {
        const activeDate = priceHistory.length > 0 ? priceHistory[0].change_date : (currentCompany?.created_at || new Date())
        tableData.push({
            id: 'active',
            price: pricePerPerson,
            date: activeDate,
            status: 'active',
            statusLabel: 'Aktif'
        })
    }

    priceHistory.forEach((hist) => {
        tableData.push({
            id: hist.id,
            price: hist.old_price,
            date: hist.change_date,
            status: 'past',
            statusLabel: 'Geçmiş',
            dbRecord: hist
        })
    })

    const columns = [
        {
            key: 'price',
            label: 'Birim Ücret',
            sortable: false,
            render: (val) => (
                <span style={{ fontWeight: '600', color: 'var(--primary)', fontSize: '15px' }}>
                    {formatCurrency(val)}
                </span>
            )
        },
        {
            key: 'date',
            label: 'Tarih',
            sortable: false,
            render: (val) => new Date(val).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        },
        {
            key: 'statusLabel',
            label: 'Durum',
            sortable: false,
            render: (val, item) => (
                <span className={`badge badge-${item.status === 'active' ? 'success' : 'neutral'}`}>
                    {val}
                </span>
            )
        }
    ]

    return (
        <div className="page-container fade-in">
            <TopProgressBar loading={loading} />

            <div className="page-header">
                <div>
                    <h1 className="page-title">Ücret Ayarları</h1>
                    <p className="page-subtitle">Kişi başı yemek ücreti ve maliyet hesaplama</p>
                </div>
                {canEditSettings && (
                    <div className="header-actions">
                        <button className="btn btn-primary" onClick={openCreate}>
                            <Pencil size={15} style={{ marginRight: '6px' }} />
                            Yeni Fiyat Ekle
                        </button>
                    </div>
                )}
            </div>

            {/* Stat Card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '25px', maxWidth: '300px' }}>
                <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div className="stat-label">GÜNCEL ÜCRET</div>
                        <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><CircleDollarSign size={16} /></div>
                    </div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '22px' }}>{pricePerPerson > 0 ? formatCurrency(pricePerPerson) : '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Kişi başı yemek ücreti</div>
                    </div>
                </div>
            </div>

            <DataTable persistenceKey="MealTicketSettings_table_unified"
                storageKey="meal_ticket_settings_table_cols"
                columns={columns}
                data={tableData}
                loading={loading}
                emptyMessage="Kayıt bulunamadı."
                searchable={false}
                paginated={true}
                pageSize={10}
                actions={canEditSettings ? (item) => (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {item.status === 'active' ? (
                            <button title="Düzenle / Güncelle" onClick={openEditActive}><Pencil size={16} /></button>
                        ) : (
                            <>
                                <button title="Düzenle" onClick={() => openEditPast(item.dbRecord)}><Pencil size={16} /></button>
                                <button title="Sil" className="danger" onClick={() => handleDeleteClick(item.dbRecord)}><Trash2 size={16} /></button>
                            </>
                        )}
                    </div>
                ) : undefined}
            />

            {/* Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingRecord === null ? "Yeni Fiyat Ekle" : "Fiyat Ayarlarını Düzenle"}
            >
                <form onSubmit={handleSave}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <CustomInput
                            label="Birim Ücret (₺)"
                            format="currency"
                            value={editValue}
                            onChange={(val) => setEditValue(val)}
                            placeholder="Örn: 250.00"
                            autoFocus
                            required
                            maxLength={10}
                        />

                        <CustomInput
                            label="Değişim Tarihi"
                            type="date"
                            value={editDate}
                            onChange={(val) => setEditDate(val)}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>İptal</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            <Save size={15} />
                            {saving ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                    </div>
                </form>
            </Modal>

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
