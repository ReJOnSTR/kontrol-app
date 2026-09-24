import { useState, useEffect } from 'react'
import TopProgressBar from '../components/TopProgressBar'
import { useCompany } from '../context/CompanyContext'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import EmployeeReportRenderer from '../components/EmployeeReportRenderer'
import { FileText, Printer, Building2, Download, Eye, Calendar, Layers, Settings, List, Filter, FileDown, User, ChevronDown } from 'lucide-react'
import { formatDate, formatCurrency, calculateRemainingLeaves, formatDayBalance, generateUniqueFileName } from '../utils/helpers'
import { usePersistentTab } from '../hooks/usePersistentTab'
import * as XLSX from 'xlsx'

export default function EmployeeReports() {
    const { currentCompany } = useCompany()
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)

    // Selection
    const [selectedIds, setSelectedIds] = useState([])
    const [selectedEmployees, setSelectedEmployees] = useState([]) // For report generation

    // Data
    const [reportDataList, setReportDataList] = useState([]) // Array of { employee, data }
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [loadingReport, setLoadingReport] = useState(false)
    const [reportType, setReportType] = useState('detail') // 'detail' or 'list'
    const [activeTab, setActiveTab] = usePersistentTab('EmployeeReports', 'all')
    const [departments, setDepartments] = useState(new Set())

    // Report Configuration
    const [config, setConfig] = useState({
        leaves: true,
        salaries: true,
        assignments: true,
        documents: true,
        remainingLeaves: true
    })

    const [listConfig, setListConfig] = useState({
        name: true,
        role: true,
        phone: true,
        startDate: true,
        status: true,
        salary: true,
        remainingLeaves: true
    })

    const [dateRange, setDateRange] = useState({
        start: '',
        end: ''
    })

    const [sidebarCollapsed, setSidebarCollapsed] = useState({
        reportType: false,
        contentSelection: false,
        dateFilter: false
    })

    // Handle printing
    const handlePrint = () => {
        const processedReportList = getProcessedReportList()
        const printData = {
            reports: processedReportList,
            config: config,
            listConfig: listConfig,
            dateRange: dateRange,
            companyName: currentCompany.name,
            reportType: reportType,
            isEmployeeReport: true // Tag for PrintPage
        }
        localStorage.setItem('printData', JSON.stringify(printData))
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.left = '-9999px';
        iframe.src = '#/print';
        document.body.appendChild(iframe);
        
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 3000);
    }

    const handlePdfDownload = async () => {
        const processedReportList = getProcessedReportList()
        const printData = {
            reports: processedReportList,
            config: config,
            listConfig: listConfig,
            dateRange: dateRange,
            companyName: currentCompany.name,
            reportType: reportType,
            isEmployeeReport: true,
            isPdfSave: true
        }
        localStorage.setItem('printData', JSON.stringify(printData))
        
        const companyStr = currentCompany?.name || '';
        const defaultFileName = generateUniqueFileName('Personel_Raporu', [companyStr], 'pdf');

        if (window.electronAPI && window.electronAPI.saveReportPdf) {
            try {
                setIsModalOpen(false)
                const result = await window.electronAPI.saveReportPdf('/print', { defaultPath: defaultFileName })
                if (result && !result.success && !result.canceled) {
                    alert('PDF Kaydedilirken Hata: ' + result.error)
                }
            } catch (e) {
                console.warn('PDF save failed:', e)
            }
        }
    }

    const handleExcelExport = () => {
        const processedReportList = getProcessedReportList()
        const wb = XLSX.utils.book_new()

        const addSheet = (name, data, columns) => {
            if (!data || data.length === 0) return
            const wsData = [
                columns.map(c => c.header),
                ...data.map(item => columns.map(c => c.value(item)))
            ]
            const ws = XLSX.utils.aoa_to_sheet(wsData)
            XLSX.utils.book_append_sheet(wb, ws, name)
        }

        if (reportType === 'list') {
            const listCols = []
            if (listConfig.name) listCols.push({ header: 'Ad Soyad', value: r => `${r.employee.first_name} ${r.employee.last_name}` })
            if (listConfig.role) listCols.push({ header: 'Görev', value: r => r.employee.position || '-' })
            listCols.push({ header: 'Departman', value: r => r.employee.department || '-' })
            if (listConfig.phone) listCols.push({ header: 'Telefon', value: r => r.employee.phone || '-' })
            if (listConfig.startDate) listCols.push({ header: 'İşe Giriş', value: r => formatDate(r.employee.start_date) })
            if (listConfig.status) listCols.push({ header: 'Durum', value: r => r.employee.status === 'active' ? 'Aktif' : 'Pasif' })
            if (listConfig.salary) listCols.push({ header: 'Maaş', value: r => r.employee.salary ? formatCurrency(r.employee.salary) : '-' })
            if (listConfig.remainingLeaves) {
                listCols.push({ header: 'Kalan İzin', value: r => formatDayBalance(calculateRemainingLeaves(r.employee, r.leaves)) })
            }

            addSheet('Personel Listesi', processedReportList, listCols)
        } else {
            if (config.leaves) {
                const allLeaves = processedReportList.flatMap(r => r.leaves.map(i => ({ ...i, employeeName: `${r.employee.first_name} ${r.employee.last_name}` })))
                addSheet('İzinler', allLeaves, [
                    { header: 'Personel', value: i => i.employeeName },
                    { header: 'Tür', value: i => i.type },
                    { header: 'Başlangıç', value: i => formatDate(i.start_date) },
                    { header: 'Bitiş', value: i => formatDate(i.end_date) },
                    { header: 'Süre', value: i => i.hours ? `${i.hours} Saat` : (i.days && i.days % 1 !== 0 ? `${Math.round(i.days * 8 * 100) / 100} Saat` : `${i.days} Gün`) }
                ])
            }

            if (config.salaries) {
                const allSalaries = processedReportList.flatMap(r => r.salaries.map(i => ({ ...i, employeeName: `${r.employee.first_name} ${r.employee.last_name}` })))
                addSheet('Hakedişler', allSalaries, [
                    { header: 'Personel', value: i => i.employeeName },
                    { header: 'Tarih', value: i => formatDate(i.payment_date || i.date) },
                    { header: 'Açıklama', value: i => `${i.period || ''} ${i.notes ? `(${i.notes})` : ''}`.trim() },
                    { header: 'Tutar', value: i => i.net_salary || i.amount }
                ])
            }
        }

        const companyStr = currentCompany?.name || '';
        const excelFileName = generateUniqueFileName('Personel_Raporu', [companyStr], 'xlsx');

        XLSX.writeFile(wb, excelFileName)
    }

    useEffect(() => {
        if (currentCompany) {
            loadEmployees()
        }
    }, [currentCompany])

    const loadEmployees = async () => {
        setLoading(true)
        try {
            const result = await window.electronAPI.getEmployees(currentCompany.id)
            if (result.success) {
                setEmployees(result.data)
                
                // Track departments for tabs
                const depts = new Set()
                result.data.forEach(e => {
                    if (e.department) depts.add(e.department)
                })
                setDepartments(depts)
            }
        } catch (error) {
            console.error('Error loading employees:', error)
        }
        setLoading(false)
    }

    const openReportModal = async (employeesToReport) => {
        setSelectedEmployees(employeesToReport)
        setIsModalOpen(true)
        setLoadingReport(true)
        setDateRange({ start: '', end: '' })

        try {
            const allReports = []

            await Promise.all(employeesToReport.map(async (employee) => {
                const [employeeResult, leaves, salaries, assignments, documents] = await Promise.all([
                    window.electronAPI.getEmployeeById(employee.id),
                    window.electronAPI.getLeaves(employee.id),
                    window.electronAPI.getSalaries(employee.id),
                    window.electronAPI.getEmployeeAssignments(employee.id),
                    window.electronAPI.getEmployeeDocuments(employee.id)
                ])

                allReports.push({
                    employee: employeeResult.success ? employeeResult.data : employee,
                    data: {
                        leaves: leaves.data || [],
                        salaries: salaries.data || [],
                        assignments: assignments.data || [],
                        documents: documents.data || []
                    }
                })
            }))

            setReportDataList(allReports)
        } catch (error) {
            console.error('Error fetching report data:', error)
        }
        setLoadingReport(false)
    }

    const handleBulkReport = () => {
        const toReport = employees.filter(e => selectedIds.includes(e.id))
        openReportModal(toReport)
    }

    const filterAndSort = (items, dateKey) => {
        if (!items) return []
        let filtered = [...items]

        if (dateRange.start || dateRange.end) {
            const startDate = dateRange.start ? new Date(dateRange.start) : null
            const endDate = dateRange.end ? new Date(dateRange.end) : null
            if (endDate) endDate.setHours(23, 59, 59, 999)

            filtered = filtered.filter(item => {
                if (!item[dateKey]) return true
                const d = new Date(item[dateKey])
                if (startDate && d < startDate) return false
                if (endDate && d > endDate) return false
                return true
            })
        }

        filtered.sort((a, b) => new Date(b[dateKey]) - new Date(a[dateKey]))
        return filtered
    }

    const getProcessedReportList = () => {
        return reportDataList.map(report => ({
            employee: report.employee,
            leaves: filterAndSort(report.data.leaves, 'start_date'),
            salaries: filterAndSort(report.data.salaries, 'payment_date'),
            assignments: filterAndSort(report.data.assignments, 'assign_date'),
            documents: report.data.documents // No date filter for documents usually, or maybe expiry?
        }))
    }

    const processedReportList = getProcessedReportList()

    const columns = [
        { 
            key: 'name', 
            label: 'Ad Soyad',
            render: (_, row) => <span style={{ fontWeight: 600 }}>{row.first_name} {row.last_name}</span>
        },
        { key: 'role', label: 'Görev' },
        { key: 'department', label: 'Departman' },
        { key: 'phone', label: 'Telefon' },
        { key: 'start_date', label: 'İşe Giriş', render: v => formatDate(v) }
    ]

    if (!currentCompany) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><Building2 /></div>
                <h2 className="empty-state-title">Şirket Seçilmedi</h2>
                <p className="empty-state-desc">Rapor almak için lütfen bir şirket seçin.</p>
            </div>
        )
    }

    return (
        <div>
            <TopProgressBar loading={loading} />
            <div className="page-header">
                <div>
                    <h1 className="page-title">Personel Raporları</h1>
                    <p style={{ marginTop: '5px', color: '#666' }}>Personel bazlı detaylı raporlama.</p>
                </div>

                {selectedIds.length > 0 && (
                    <button className="btn btn-primary" onClick={handleBulkReport}>
                        <Layers size={16} />
                        <span style={{ marginLeft: '6px' }}>Seçilenleri Raporla ({selectedIds.length})</span>
                    </button>
                )}
            </div>

            <div className="vehicle-tabs">
                <button
                    className={`vehicle-tab${activeTab === 'all' ? ' active' : ''}`}
                    onClick={() => setActiveTab('all')}
                >
                    Tümü <span className="vehicle-tab-count">{employees.length}</span>
                </button>
                {Array.from(departments).map(dept => (
                    <button 
                        key={dept}
                        className={`vehicle-tab${activeTab === dept ? ' active' : ''}`}
                        onClick={() => setActiveTab(dept)}
                    >
                        {dept} <span className="vehicle-tab-count">{employees.filter(e => e.department === dept).length}</span>
                    </button>
                ))}
            </div>

            <DataTable persistenceKey={`EmployeeReports_table_${activeTab}`}
                columns={columns}
                data={activeTab === 'all' ? employees : employees.filter(e => e.department === activeTab)}
                showSearch={true}
                selectable={true}
                onSelectionChange={setSelectedIds}
                actions={(employee) => (
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openReportModal([employee])}
                        title="Raporu Görüntüle"
                    >
                        <Eye size={16} />
                        <span style={{ marginLeft: '6px' }}>Görüntüle</span>
                    </button>
                )}
            />

            {/* Preview & Print Modal */}
            {isModalOpen && selectedEmployees.length > 0 && (
                <Modal
                    isOpen={true}
                    onClose={() => setIsModalOpen(false)}
                    title={selectedEmployees.length > 1 ? `${selectedEmployees.length} Personel İçin Toplu Rapor` : `Rapor: ${selectedEmployees[0].first_name} ${selectedEmployees[0].last_name}`}
                    size="fullscreen"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Kapat</button>
                            <button className="btn btn-success" onClick={handleExcelExport} style={{ marginRight: 'auto' }}>
                                <Download size={16} /> Excel'e Aktar
                            </button>
                            <button className="btn btn-primary" onClick={handlePdfDownload} style={{ gap: '6px' }}>
                                <FileDown size={16} /> PDF İndir
                            </button>
                            <button className="btn btn-primary" onClick={handlePrint} style={{ gap: '6px' }}>
                                <Printer size={16} /> Yazdır
                            </button>
                        </>
                    }
                >
                    <div style={{ display: 'flex', gap: '0', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                        {/* Configuration Sidebar */}
                        <div style={{ width: '280px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '0', flexShrink: 0, overflowY: 'auto', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}>
                            
                            {/* Report Type */}
                            <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <div 
                                    onClick={() => setSidebarCollapsed(prev => ({ ...prev, reportType: !prev.reportType }))}
                                    style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Settings size={14} style={{ color: 'var(--text-muted)' }} />
                                        <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rapor Türü</h4>
                                    </div>
                                    <ChevronDown 
                                        size={14} 
                                        style={{ 
                                            color: 'var(--text-muted)', 
                                            transform: sidebarCollapsed.reportType ? 'rotate(-90deg)' : 'none', 
                                            transition: 'transform 0.2s ease' 
                                        }} 
                                    />
                                </div>
                                {!sidebarCollapsed.reportType && (
                                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 10px', borderRadius: '8px', background: reportType === 'list' ? 'var(--accent-subtle)' : 'transparent', border: reportType === 'list' ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
                                            <input type="radio" name="reportType" checked={reportType === 'list'} onChange={() => setReportType('list')} style={{ display: 'none' }} />
                                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: reportType === 'list' ? '5px solid var(--accent-primary)' : '2px solid var(--border-light)', background: 'var(--bg-primary)' }} />
                                            <span style={{ fontSize: '13px' }}>Personel Listesi (Özet)</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 10px', borderRadius: '8px', background: reportType === 'detail' ? 'var(--accent-subtle)' : 'transparent', border: reportType === 'detail' ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
                                            <input type="radio" name="reportType" checked={reportType === 'detail'} onChange={() => setReportType('detail')} style={{ display: 'none' }} />
                                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: reportType === 'detail' ? '5px solid var(--accent-primary)' : '2px solid var(--border-light)', background: 'var(--bg-primary)' }} />
                                            <span style={{ fontSize: '13px' }}>Detaylı Personel Raporu</span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Content Toggles */}
                            <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <div 
                                    onClick={() => setSidebarCollapsed(prev => ({ ...prev, contentSelection: !prev.contentSelection }))}
                                    style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <List size={14} style={{ color: 'var(--text-muted)' }} />
                                        <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>İçerik Seçimi</h4>
                                    </div>
                                    <ChevronDown 
                                        size={14} 
                                        style={{ 
                                            color: 'var(--text-muted)', 
                                            transform: sidebarCollapsed.contentSelection ? 'rotate(-90deg)' : 'none', 
                                            transition: 'transform 0.2s ease' 
                                        }} 
                                    />
                                </div>
                                {!sidebarCollapsed.contentSelection && (
                                    <div style={{ padding: '12px 16px' }}>
                                        {reportType === 'detail' ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {[
                                                    { key: 'leaves', label: 'İzin Geçmişi' },
                                                    { key: 'salaries', label: 'Maaş / Hakedişler' },
                                                    { key: 'assignments', label: 'Zimmetler' },
                                                    { key: 'documents', label: 'Evraklar' },
                                                    { key: 'remainingLeaves', label: 'Kalan İzin Süresi' }
                                                ].map(item => (
                                                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', cursor: 'pointer' }}>
                                                        <span style={{ fontSize: '13px' }}>{item.label}</span>
                                                        <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                                            <input type="checkbox" checked={config[item.key]} onChange={e => setConfig({ ...config, [item.key]: e.target.checked })} />
                                                            <span className="toggle-slider"></span>
                                                        </label>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {[
                                                    { key: 'name', label: 'Ad Soyad' },
                                                    { key: 'role', label: 'Görev' },
                                                    { key: 'phone', label: 'Telefon' },
                                                    { key: 'startDate', label: 'Başlangıç T.' },
                                                    { key: 'status', label: 'Durum' },
                                                    { key: 'salary', label: 'Maaş' },
                                                    { key: 'remainingLeaves', label: 'Kalan İzin' }
                                                ].map(item => (
                                                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', cursor: 'pointer' }}>
                                                        <span style={{ fontSize: '13px' }}>{item.label}</span>
                                                        <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                                            <input type="checkbox" checked={listConfig[item.key]} onChange={e => setListConfig({ ...listConfig, [item.key]: e.target.checked })} />
                                                            <span className="toggle-slider"></span>
                                                        </label>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Date Filter */}
                            <div>
                                <div 
                                    onClick={() => setSidebarCollapsed(prev => ({ ...prev, dateFilter: !prev.dateFilter }))}
                                    style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                                        <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tarih Filtresi</h4>
                                    </div>
                                    <ChevronDown 
                                        size={14} 
                                        style={{ 
                                            color: 'var(--text-muted)', 
                                            transform: sidebarCollapsed.dateFilter ? 'rotate(-90deg)' : 'none', 
                                            transition: 'transform 0.2s ease' 
                                        }} 
                                    />
                                </div>
                                {!sidebarCollapsed.dateFilter && (
                                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <input type="date" className="form-input" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} style={{ fontSize: '12px' }} />
                                        <input type="date" className="form-input" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} style={{ fontSize: '12px' }} />
                                        {(dateRange.start || dateRange.end) && (
                                            <button className="btn btn-secondary btn-sm" onClick={() => setDateRange({ start: '', end: '' })}>Temizle</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Preview Area */}
                        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-tertiary)', padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {loadingReport ? (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Hazırlanıyor...</div>
                            ) : (
                                <EmployeeReportRenderer
                                    reports={processedReportList}
                                    config={config}
                                    listConfig={listConfig}
                                    dateRange={dateRange}
                                    companyName={currentCompany.name}
                                    reportType={reportType}
                                    isPreview={true}
                                />
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}
