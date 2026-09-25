import TopProgressBar from '../components/TopProgressBar'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCompany } from '../context/CompanyContext'
import { useTabs } from '../context/TabContext'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import EmployeeForm from '../components/forms/EmployeeForm'
import BulkDocumentGeneratorModal from '../components/BulkDocumentGeneratorModal'
import { formatCurrency, getEmployeeStatusInfo } from '../utils/helpers'
import { employeeService } from '../services'
import { Plus, Pencil, Trash2, Users, Building2, AlertCircle, Calendar, FileText, UserCheck, Archive, ArchiveRestore } from 'lucide-react'
import CreatePersonnelUserModal from '../components/personnel/CreatePersonnelUserModal'

const statusOptions = [
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Pasif' }
]

export default function Employees() {
    const { currentCompany } = useCompany()
    const navigate = useNavigate()
    const { openNewTab } = useTabs()
    const [searchParams, setSearchParams] = useSearchParams()
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [confirmModal, setConfirmModal] = useState(null)
    const [showArchived, setShowArchived] = useState(false)
    const [departments, setDepartments] = useState([])
    const [createLoginEmp, setCreateLoginEmp] = useState(null)
    const departmentOptions = departments
        .filter(d => d.status !== 'passive')
        .map(d => ({ value: d.name, label: d.name }))

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            openCreateModal()
            searchParams.delete('action')
            setSearchParams(searchParams, { replace: true })
        }
    }, [searchParams])

    useEffect(() => {
        if (currentCompany) {
            loadEmployees()
        } else {
            setEmployees([])
            setLoading(false)
        }
    }, [currentCompany, showArchived])

    // Real-time synchronization listener
    const loadEmployeesRef = useRef(null)
    useEffect(() => {
        loadEmployeesRef.current = loadEmployees
    })
    useEffect(() => {
        if (!currentCompany) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if (change?.table === 'employees') {
                console.log(`[RealTime] Employees reloading for change in ${change.table}`)
                loadEmployeesRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [currentCompany])

    const loadEmployees = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            const [empRes, deptRes] = await Promise.all([
                employeeService.getAll(currentCompany.id, showArchived ? 1 : 0),
                window.electronAPI.getDepartments(currentCompany.id)
            ])

            if (empRes.success) {
                const formattedData = (empRes.data || []).map(emp => ({
                    ...emp,
                    full_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
                }))
                setEmployees(formattedData)
            }

            if (deptRes.success) {
                setDepartments(deptRes.data || [])
            }
        } catch (err) {
            console.error('Failed to load employees:', err)
        }
        if (!isBackground) setLoading(false)
    }

    const [isBulkDocModalOpen, setIsBulkDocModalOpen] = useState(false)
    const [selectedEmpsForBulk, setSelectedEmpsForBulk] = useState([])
    const [clearBulkSelectionFn, setClearBulkSelectionFn] = useState(null)

    const openCreateModal = () => {
        setEditingEmployee(null)
        setError('')
        setIsModalOpen(true)
    }

    const openEditModal = (employee) => {
        setEditingEmployee(employee)
        setError('')
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        setEditingEmployee(null)
        setError('')
    }

    const handleSubmit = async (formData) => {
        setSaving(true)
        setError('')
        try {
            let result
            if (editingEmployee) {
                result = await employeeService.update({
                    id: editingEmployee.id,
                    ...formData
                })
            } else {
                result = await employeeService.create({
                    companyId: currentCompany.id,
                    ...formData
                })
            }
            if (result.success) {
                closeModal()
                loadEmployees()
            } else {
                setError(result.error || 'Bir hata oluştu.')
            }
        } catch (err) {
            setError('Beklenmeyen hata: ' + err.message)
        }
        setSaving(false)
    }

    const handleDeleteClick = (employee) => {
        setConfirmModal({
            title: 'Personel Sil',
            message: `"${employee.first_name} ${employee.last_name}" personelini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
            item: employee
        })
    }

    const handleBulkDeleteClick = (ids) => {
        setConfirmModal({
            title: 'Toplu Silme',
            message: `${ids.length} personeli silmek istediğinize emin misiniz?`,
            ids
        })
    }

    const handleBulkArchive = async (ids) => {
        if (!ids || ids.length === 0) return
        const newStatus = showArchived ? 0 : 1
        for (const id of ids) {
            await window.electronAPI.archiveItem('employees', id, newStatus)
        }
        loadEmployees()
    }

    const handleArchiveClick = async (employee) => {
        const newStatus = showArchived ? 0 : 1
        await window.electronAPI.archiveItem('employees', employee.id, newStatus)
        loadEmployees()
    }

    const handleConfirmDelete = async () => {
        try {
            if (confirmModal.ids) {
                for (const id of confirmModal.ids) {
                    await employeeService.delete(id)
                }
            } else {
                await employeeService.delete(confirmModal.item.id)
            }
            loadEmployees()
        } catch (err) {
            console.error('Delete failed:', err)
        }
        setConfirmModal(null)
    }

    const getStatusInfo = (status) => {
        if (status === 'active') return { label: 'Aktif', color: 'success' }
        return { label: 'Pasif', color: 'secondary' }
    }

    const columns = [
        {
            key: 'full_name',
            label: 'Ad Soyad & TC',
            render: (_, row) => (
                <div>
                    <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                        {row.first_name} {row.last_name}
                    </div>
                    {row.tc_no && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            TC: {row.tc_no}
                        </div>
                    )}
                </div>
            )
        },
        { key: 'position', label: 'Pozisyon' },
        { key: 'department', label: 'Departman' },
        { 
            key: 'phone', 
            label: 'Telefon',
            render: (val) => val ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{val}</span> : '-'
        },
        {
            key: 'salary',
            label: 'Maaş',
            align: 'right',
            render: (value) => value ? <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatCurrency(value)}</span> : '-'
        },
        {
            key: 'status',
            label: 'Durum',
            width: '100px',
            render: (value) => {
                const status = getEmployeeStatusInfo(value)
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
                    Personelleri görüntülemek için lütfen bir şirket seçin.
                </p>
            </div>
        )
    }

    return (
        <div>
            <TopProgressBar loading={loading} />
            <div className="page-header">
                <div>
                    <h1 className="page-title">Personeller</h1>
                    <p style={{ marginTop: '5px', color: '#666' }}>Personel yönetimi ve detayları.</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        <Plus size={18} />
                        Yeni Personel
                    </button>
                </div>
            </div>

            {/* Personnel Upcoming Alerts */}
            {currentCompany && !showArchived && (
                <div style={{ marginBottom: '25px' }}>
                    {(() => {
                        const { upcomingEvents } = useCompany()
                        const empEvents = (upcomingEvents || []).filter(e => {
                            if (e.eventType !== 'employee_document') return false
                            // If employees list is loaded, filter out any archived or non-active employee
                            const emp = employees.find(x => x.id === e.employeeId)
                            if (emp && (emp.is_archived === 1 || emp.status !== 'active')) return false
                            return true
                        })
                        const overdue = empEvents.filter(e => {
                            const d = Math.ceil((new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24))
                            return d < 0
                        })
                        const upcoming = empEvents.filter(e => {
                            const d = Math.ceil((new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24))
                            return d >= 0 && d <= 30
                        })

                        if (overdue.length === 0 && upcoming.length === 0) return null

                        return (
                            <div className="card" style={{ padding: '15px' }}>
                                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                    {overdue.length > 0 && (
                                        <div style={{ flex: 1, minWidth: '300px' }}>
                                            <h3 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--danger)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                                                <AlertCircle size={14} /> Geciken Belgeler ({overdue.length})
                                            </h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {overdue.map(e => (
                                                    <div key={e.id} onClick={() => navigate(`/employees/${e.employeeId}`)} style={{ cursor: 'pointer', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: '600' }}>{e.employeeName}</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{e.type}</div>
                                                        </div>
                                                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--danger)' }}>{Math.abs(Math.ceil((new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24)))} gün geçti</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {upcoming.length > 0 && (
                                        <div style={{ flex: 1, minWidth: '300px' }}>
                                            <h3 style={{ fontSize: '12px', fontWeight: '700', color: '#14b8a6', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                                                <Calendar size={14} /> Yaklaşan Belgeler (30 Gün) ({upcoming.length})
                                            </h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {upcoming.map(e => {
                                                    const d = Math.ceil((new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24))
                                                    let statusColor = '#14b8a6'
                                                    let bgStyle = 'rgba(20, 184, 166, 0.05)'
                                                    let borderStyle = '1px solid rgba(20, 184, 166, 0.15)'

                                                    if (d === 0) {
                                                        statusColor = '#fb923c'
                                                        bgStyle = 'rgba(249, 115, 22, 0.05)'
                                                        borderStyle = '1px solid rgba(249, 115, 22, 0.15)'
                                                    } else if (d <= 3) {
                                                        statusColor = '#facc15'
                                                        bgStyle = 'rgba(234, 179, 8, 0.05)'
                                                        borderStyle = '1px solid rgba(234, 179, 8, 0.15)'
                                                    }

                                                    return (
                                                        <div key={e.id} onClick={() => navigate(`/employees/${e.employeeId}`)} style={{ cursor: 'pointer', padding: '8px 12px', background: bgStyle, border: borderStyle, borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div>
                                                                <div style={{ fontSize: '13px', fontWeight: '600' }}>{e.employeeName}</div>
                                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{e.type}</div>
                                                            </div>
                                                            <span style={{ fontSize: '11px', fontWeight: '700', color: statusColor }}>{d === 0 ? 'Bugün' : `${d} gün kaldı`}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })()}
                </div>
            )}

            <DataTable persistenceKey="Employees_table_v2"
                initialSort={{ key: 'full_name', direction: 'asc' }}
                storageKey="employees_table_cols"
                columns={columns}
                data={employees}
                showSearch={true}
                showCheckboxes={true}
                emptyMessage={showArchived ? "Arşivlenmiş personel bulunmuyor." : "Henüz personel eklenmemiş."}
                searchPlaceholder="Ad, soyad, departman veya pozisyon ile ara..."
                searchKeys={['first_name', 'last_name', 'position', 'department', 'phone']}
                filters={[
                    {
                        key: 'department',
                        label: 'Departman',
                        options: departments.map(d => ({ value: d.name, label: d.name }))
                    },
                    {
                        key: 'status',
                        label: 'Durum',
                        options: statusOptions
                    }
                ]}
                onRowClick={(employee, e) => {
                    if (e.ctrlKey || e.metaKey) {
                        openNewTab(`/employees/${employee.id}`, true, `${employee.first_name} ${employee.last_name}`)
                    } else {
                        navigate(`/employees/${employee.id}`)
                    }
                }}
                onBulkDelete={handleBulkDeleteClick}
                onBulkArchive={handleBulkArchive}
                isArchiveView={showArchived}
                onToggleArchiveView={setShowArchived}
                customBulkActions={(selectedIds, clearSelection) => (
                    <button
                        type="button"
                        className="btn-bulk-action primary"
                        onClick={() => {
                            const selected = employees.filter(emp => selectedIds.includes(emp.id))
                            setSelectedEmpsForBulk(selected)
                            setClearBulkSelectionFn(() => clearSelection)
                            setIsBulkDocModalOpen(true)
                        }}
                    >
                        <FileText size={15} /> Belge Oluştur
                    </button>
                )}
                actions={(employee) => (
                    <>
                        <button title="Düzenle" onClick={() => openEditModal(employee)}>
                            <Pencil size={16} />
                        </button>
                        <button 
                            title={showArchived ? "Arşivden Çıkar" : "Arşivle"} 
                            onClick={() => handleArchiveClick(employee)}
                        >
                            {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                        </button>
                        <button title="Sil" className="danger" onClick={() => handleDeleteClick(employee)}>
                            <Trash2 size={16} />
                        </button>
                    </>
                )}
            />

            {employees.length === 0 && !loading && !showArchived && (
                <div className="empty-state" style={{ marginTop: '40px', border: 'none', background: 'transparent' }}>
                    <div className="empty-state-icon">
                        <Users />
                    </div>
                    <h2 className="empty-state-title">Henüz Personel Yok</h2>
                    <p className="empty-state-desc">
                        Bu şirkete ait personel bulunmuyor. İlk personelinizi ekleyin.
                    </p>
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        <Plus size={18} />
                        Personel Ekle
                    </button>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingEmployee ? 'Personel Düzenle' : 'Yeni Personel'}
                size="xl"
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
                <EmployeeForm 
                    initialData={editingEmployee} 
                    onSubmit={handleSubmit} 
                    onCancel={closeModal} 
                    saving={saving}
                    departmentOptions={departmentOptions}
                />
            </Modal>

            <ConfirmModal
                isOpen={!!confirmModal}
                onClose={() => setConfirmModal(null)}
                onConfirm={handleConfirmDelete}
                title={confirmModal?.title}
                message={confirmModal?.message}
            />
            <BulkDocumentGeneratorModal
                isOpen={isBulkDocModalOpen}
                onClose={() => {
                    setIsBulkDocModalOpen(false)
                    setSelectedEmpsForBulk([])
                }}
                selectedEmployees={selectedEmpsForBulk}
                company={currentCompany}
                onSuccess={() => {
                    if (clearBulkSelectionFn) clearBulkSelectionFn()
                }}
            />
            {createLoginEmp && (
                <CreatePersonnelUserModal 
                    isOpen={!!createLoginEmp}
                    employee={createLoginEmp}
                    onClose={() => setCreateLoginEmp(null)}
                    onSuccess={loadEmployees}
                />
            )}
        </div>
    )
}
