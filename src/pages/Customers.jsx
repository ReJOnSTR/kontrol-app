import { useState, useEffect, useRef } from 'react'
import { Plus, Users, Pencil, Trash2, Building2, Phone, Mail, MapPin, DollarSign, Archive, ArchiveRestore, FileText } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import { useTabs } from '../context/TabContext'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import CustomerForm from '../components/forms/CustomerForm'
import CustomerDocumentGeneratorModal from '../components/CustomerDocumentGeneratorModal'
import { formatCurrency } from '../utils/helpers'

export default function Customers() {
    const { currentCompany } = useCompany()
    const navigate = useNavigate()
    const { openNewTab } = useTabs()
    const [searchParams, setSearchParams] = useSearchParams()
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState(null)
    const [saving, setSaving] = useState(false)
    const [confirmModal, setConfirmModal] = useState(null)
    const [showArchived, setShowArchived] = useState(false)
    const [selectedDocCustomer, setSelectedDocCustomer] = useState(null)
    const [isDocModalOpen, setIsDocModalOpen] = useState(false)

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            setEditingCustomer(null)
            setIsModalOpen(true)
            searchParams.delete('action')
            setSearchParams(searchParams, { replace: true })
        }
    }, [searchParams])

    useEffect(() => {
        if (currentCompany) {
            loadCustomers()
        }
    }, [currentCompany, showArchived])

    // Real-time synchronization listener
    const loadCustomersRef = useRef(null)
    useEffect(() => {
        loadCustomersRef.current = loadCustomers
    })
    useEffect(() => {
        if (!currentCompany) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if (change?.table === 'customers') {
                console.log(`[RealTime] Customers reloading for change in ${change.table}`)
                loadCustomersRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const loadCustomers = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            const result = await window.electronAPI.getCustomers(currentCompany.id, showArchived ? 1 : 0)
            if (result.success) {
                setCustomers(result.data)
            }
        } catch (error) {
            console.error('Failed to load customers:', error)
        }
        if (!isBackground) setLoading(false)
    }

    const openCreateModal = () => {
        setEditingCustomer(null)
        setIsModalOpen(true)
    }

    const openEditModal = (customer) => {
        setEditingCustomer(customer)
        setIsModalOpen(true)
    }

    const handleFormSubmit = async (formData) => {
        setSaving(true)
        try {
            let result
            if (editingCustomer) {
                result = await window.electronAPI.updateCustomer({
                    id: editingCustomer.id,
                    ...formData
                })
            } else {
                result = await window.electronAPI.createCustomer({
                    companyId: currentCompany.id,
                    ...formData
                })
            }

            if (result.success) {
                setIsModalOpen(false)
                loadCustomers()
            } else {
                alert('Kaydetme başarısız: ' + result.error)
            }
        } catch (error) {
            console.error('Error saving customer:', error)
        }
        setSaving(false)
    }

    const handleDeleteClick = (customer) => {
        setConfirmModal({
            title: 'Müşteri Sil',
            message: `"${customer.name}" isimli müşteriyi silmek istediğinize emin misiniz? Bu müşteriye ait iş/proje kayıtları bozulabilir.`,
            item: customer
        })
    }

    const handleBulkDeleteClick = (ids) => {
        setConfirmModal({
            title: 'Toplu Silme',
            message: `${ids.length} müşteriyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
            ids
        })
    }

    const handleBulkArchive = async (ids) => {
        if (!ids || ids.length === 0) return
        const newStatus = showArchived ? 0 : 1
        for (const id of ids) {
            await window.electronAPI.archiveItem('customers', id, newStatus)
        }
        loadCustomers()
    }

    const handleArchiveClick = async (customer) => {
        const newStatus = showArchived ? 0 : 1
        await window.electronAPI.archiveItem('customers', customer.id, newStatus)
        loadCustomers()
    }

    const handleConfirmDelete = async () => {
        if (!confirmModal) return
        try {
            if (confirmModal.ids) {
                for (const id of confirmModal.ids) {
                    await window.electronAPI.deleteCustomer(id)
                }
                loadCustomers()
            } else {
                const result = await window.electronAPI.deleteCustomer(confirmModal.item.id)
                if (result.success) {
                    loadCustomers()
                } else {
                    alert('Silme işlemi başarısız: ' + result.error)
                }
            }
        } catch (error) {
            console.error('Delete failed:', error)
        }
        setConfirmModal(null)
    }

    // Stats
    const stats = customers.reduce((acc, c) => {
        acc.totalReceivables += c.total_receivable || 0;
        acc.totalVolume += c.total_volume || 0;
        acc.totalWorks += c.work_count || 0;
        return acc;
    }, { totalReceivables: 0, totalVolume: 0, totalWorks: 0 })

    const columns = [
        {
            key: 'name',
            label: 'Müşteri Adı & İletişim',
            render: (v, row) => (
                <div>
                    <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-primary)' }}>{v}</div>
                    {(row.phone || row.email) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                            {row.phone && <span>Tel: {row.phone}</span>}
                            {row.email && <span>{row.phone ? '• ' : ''}{row.email}</span>}
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'work_count',
            label: 'Toplam İş',
            width: '110px',
            render: (v) => <span className="badge badge-neutral">{v || 0} İş</span>
        },
        {
            key: 'total_volume',
            label: 'Bu Ayki Hacim',
            align: 'right',
            render: (v) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatCurrency(v || 0)}</span>
        },
        {
            key: 'total_receivable',
            label: 'Açık Bakiye',
            align: 'right',
            render: (v) => (
                <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: 600, 
                    color: v > 0 ? '#f87171' : (v < 0 ? '#34d399' : 'var(--text-muted)') 
                }}>
                    {formatCurrency(v || 0)}
                </span>
            )
        }
    ]

    if (!currentCompany && !loading) return null

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Müşteri (Cari) Yönetimi</h1>
                    <p className="page-subtitle">Müşterilerinizi, bakiyelerini ve iletişim bilgilerini yönetin.</p>
                </div>
                <button className="btn btn-primary" onClick={openCreateModal}>
                    <Plus size={18} /> Yeni Müşteri
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-icon primary">
                        <Users />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{customers.length}</div>
                        <div className="stat-label">Toplam Müşteri</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon info">
                        <Building2 />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.totalWorks}</div>
                        <div className="stat-label">Bağlı İş & Projeler</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon warning">
                        <DollarSign />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{formatCurrency(stats.totalVolume)}</div>
                        <div className="stat-label">Bu Ayki İşlem Hacmi</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className={`stat-icon ${stats.totalReceivables > 0 ? 'danger' : 'success'}`}>
                        <DollarSign />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value" style={{ color: stats.totalReceivables > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(stats.totalReceivables)}</div>
                        <div className="stat-label">Açık Bakiye</div>
                    </div>
                </div>
            </div>

            <DataTable persistenceKey="Customers_table_0"
                columns={columns}
                data={customers}
                emptyMessage="Henüz müşteri kaydı bulunamadı"
                showSearch={true}
                searchPlaceholder="Müşteri adı, mail veya telefon ara..."
                searchKeys={['name', 'phone', 'email']}
                onRowClick={(customer, e) => {
                    if (e.ctrlKey || e.metaKey) {
                        openNewTab(`/customers/${customer.id}`, true, customer.name)
                    } else {
                        navigate(`/customers/${customer.id}`)
                    }
                }}
                showCheckboxes={true}
                onBulkDelete={handleBulkDeleteClick}
                onBulkArchive={handleBulkArchive}
                isArchiveView={showArchived}
                onToggleArchiveView={setShowArchived}
                actions={(item) => (
                    <>
                        <button className="btn-icon" title="Belge Oluştur" onClick={() => { setSelectedDocCustomer(item); setIsDocModalOpen(true); }}><FileText size={16} /></button>
                        <button className="btn-icon" title="Düzenle" onClick={() => openEditModal(item)}><Pencil size={16} /></button>
                        <button 
                            className="btn-icon" 
                            title={showArchived ? "Arşivden Çıkar" : "Arşivle"} 
                            onClick={() => handleArchiveClick(item)}
                        >
                            {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                        </button>
                        <button className="btn-icon danger" title="Sil" onClick={() => handleDeleteClick(item)}><Trash2 size={16} /></button>
                    </>
                )}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingCustomer ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'}
                footer={null}
            >
                <CustomerForm
                    initialData={editingCustomer}
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsModalOpen(false)}
                    loading={saving}
                />
            </Modal>
            {confirmModal && (
                <ConfirmModal 
                    isOpen={!!confirmModal} 
                    onClose={() => setConfirmModal(null)} 
                    onConfirm={confirmModal?.onConfirm} 
                    title={confirmModal?.title} 
                    message={confirmModal?.message} 
                    confirmText={confirmModal?.confirmText}
                    type={confirmModal?.styleType}
                />
            )}

            {isDocModalOpen && selectedDocCustomer && (
                <CustomerDocumentGeneratorModal
                    isOpen={isDocModalOpen}
                    onClose={() => {
                        setIsDocModalOpen(false)
                        setSelectedDocCustomer(null)
                    }}
                    customer={selectedDocCustomer}
                    company={currentCompany}
                    onSuccess={() => {
                        loadCustomers()
                    }}
                />
            )}
        </div>
    )
}
