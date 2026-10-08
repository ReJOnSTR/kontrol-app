import { useState, useEffect, useRef, useMemo } from 'react'
import TopProgressBar from '../components/TopProgressBar'
import { useCompany } from '../context/CompanyContext'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ReportRenderer from '../components/ReportRenderer'
import { FileText, Printer, Building2, Download, Eye, Calendar, Layers, Settings, List, Filter, FileDown, ChevronDown } from 'lucide-react'
import { formatDate, formatCurrency, getVehicleTypeLabel, getMaintenanceTypeLabel, getInsuranceTypeLabel, vehicleTypes, generateUniqueFileName, parseVehicleCapacity, compareVehicleCapacityDesc } from '../utils/helpers'
import { useReactToPrint } from 'react-to-print'
import { usePersistentTab } from '../hooks/usePersistentTab'
import * as XLSX from 'xlsx'

export default function Reports() {
    const { currentCompany } = useCompany()
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)

    // Selection
    const [selectedIds, setSelectedIds] = useState([])
    const [selectedVehicles, setSelectedVehicles] = useState([]) // For report generation

    // Data
    const [reportDataList, setReportDataList] = useState([]) // Array of { vehicle, data }
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [loadingReport, setLoadingReport] = useState(false)
    const [reportType, setReportType] = useState('detail') // 'detail' or 'list'
    const [activeTab, setActiveTab] = usePersistentTab('Reports', 'all')
    const [seenTypes, setSeenTypes] = useState(new Set())

    // Report Configuration
    const [config, setConfig] = useState({
        inventory: true,
        maintenance: true,
        services: true,
        insurance: true,
        inspection: true,
        periodicInspection: true
    })

    const [listConfig, setListConfig] = useState({
        plate: true,
        type: true,
        brand: true,
        model: true,
        year: true,
        km: true,
        status: true
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

    // Handle printing via new window
    const handlePrint = () => {
        const processedReportList = getProcessedReportList() // Get fresh filtered data
        const printData = {
            reports: processedReportList,
            config: config,
            listConfig: listConfig,
            dateRange: dateRange,
            companyName: currentCompany.name,
            reportType: reportType
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

    // Handle PDF download - no extra window, preserving high ton to low ton, high metre to low metre order
    const handlePdfDownload = async () => {
        const processedReportList = getProcessedReportList()
        const printData = {
            reports: processedReportList,
            config: config,
            listConfig: listConfig,
            dateRange: dateRange,
            companyName: currentCompany.name,
            reportType: reportType,
            isPdfSave: true
        }
        localStorage.setItem('printData', JSON.stringify(printData))
        
        const getReportPeriodText = (range) => {
            if (range?.start) {
                const d = new Date(range.start);
                if (!isNaN(d.getTime())) {
                    const m = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
                    return m.charAt(0).toUpperCase() + m.slice(1);
                }
            }
            const now = new Date();
            const m = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
            return m.charAt(0).toUpperCase() + m.slice(1);
        };

        const monthStr = getReportPeriodText(dateRange);
        const companyStr = currentCompany?.name || '';
        const defaultFileName = generateUniqueFileName('Is_Raporu', [companyStr, monthStr], 'pdf');

        const isElectronApp = typeof window !== 'undefined' && Boolean(
            window.electronAPI?.isElectron ||
            (window.electronAPI?.saveReportPdf && !window.electronAPI?.isMock)
        )

        if (isElectronApp && window.electronAPI?.saveReportPdf) {
            try {
                const result = await window.electronAPI.saveReportPdf('/print', { defaultPath: defaultFileName })
                if (result && !result.success && !result.canceled) {
                    alert('PDF Kaydedilirken Hata: ' + result.error)
                }
                if (result?.success) {
                    setIsModalOpen(false)
                }
            } catch (e) {
                console.warn('PDF save failed:', e)
            }
        } else {
            // Web browser mode: clean direct PDF export
            try {
                const previewEl = document.querySelector('.report-preview-pane') || 
                                  document.querySelector('.report-print-container') ||
                                  document.querySelector('.print-body');
                if (previewEl) {
                    const { exportElementToCleanPdf } = await import('../utils/pdfCleanExport');
                    await exportElementToCleanPdf(previewEl, defaultFileName, false);
                } else if (window.electronAPI?.saveReportPdf) {
                    await window.electronAPI.saveReportPdf('#/print', { defaultPath: defaultFileName });
                } else {
                    handlePrint();
                }
            } catch (err) {
                console.error('Web PDF Export failed:', err);
                handlePrint();
            }
        }
    }

    const handleExcelExport = () => {
        const processedReportList = getProcessedReportList()
        const wb = XLSX.utils.book_new()

        // Helper to add sheet
        const addSheet = (name, data, columns) => {
            if (!data || data.length === 0) return
            const wsData = [
                columns.map(c => c.header),
                ...data.map(item => columns.map(c => c.value(item)))
            ]
            const ws = XLSX.utils.aoa_to_sheet(wsData)
            XLSX.utils.book_append_sheet(wb, ws, name)
        }

        // Aggregate data from all vehicles
        if (config.inventory) {
            const allAssignments = processedReportList.flatMap(r => r.assignments.map(i => ({ ...i, plate: r.vehicle.plate })))
            addSheet('Envanter', allAssignments, [
                { header: 'Plaka', value: i => i.plate },
                { header: 'Malzeme', value: i => i.item_name },
                { header: 'Adet', value: i => i.quantity },
                { header: 'Sorumlu', value: i => i.assigned_to },
                { header: 'Veriliş T.', value: i => formatDate(i.start_date) },
                { header: 'Bitiş T.', value: i => formatDate(i.end_date) }
            ])
        }

        if (config.maintenance) {
            const allMaintenances = processedReportList.flatMap(r => r.maintenances.map(i => ({ ...i, plate: r.vehicle.plate })))
            addSheet('Bakımlar', allMaintenances, [
                { header: 'Plaka', value: i => i.plate },
                { header: 'Tarih', value: i => formatDate(i.date) },
                { header: 'Tür', value: i => getMaintenanceTypeLabel(i.type) },
                { header: 'Açıklama', value: i => i.description },
                { header: 'Maliyet', value: i => i.cost }
            ])
        }

        if (config.services) {
            const allServices = processedReportList.flatMap(r => r.services.map(i => ({ ...i, plate: r.vehicle.plate })))
            addSheet('Servisler', allServices, [
                { header: 'Plaka', value: i => i.plate },
                { header: 'Tarih', value: i => formatDate(i.date) },
                { header: 'Firma', value: i => i.service_name },
                { header: 'Tür', value: i => i.type },
                { header: 'Açıklama', value: i => i.description },
                { header: 'KM', value: i => i.km },
                { header: 'Maliyet', value: i => i.cost }
            ])
        }

        if (config.insurance) {
            const allInsurances = processedReportList.flatMap(r => r.insurances.map(i => ({ ...i, plate: r.vehicle.plate })))
            addSheet('Sigortalar', allInsurances, [
                { header: 'Plaka', value: i => i.plate },
                { header: 'Sigorta Şirketi', value: i => i.company },
                { header: 'Tür', value: i => getInsuranceTypeLabel(i.type) },
                { header: 'Başlangıç', value: i => formatDate(i.start_date) },
                { header: 'Bitiş', value: i => formatDate(i.end_date) },
                { header: 'Tutar', value: i => i.premium }
            ])
        }

        if (config.inspection) {
            const allInspections = processedReportList.flatMap(r => r.inspections.map(i => ({ ...i, plate: r.vehicle.plate })))
            addSheet('Muayeneler', allInspections, [
                { header: 'Plaka', value: i => i.plate },
                { header: 'Tarih', value: i => formatDate(i.inspection_date) },
                { header: 'Sonuç', value: i => i.result },
                { header: 'Sonraki Tarih', value: i => formatDate(i.next_inspection) },
                { header: 'Tutar', value: i => i.cost }
            ])
        }

        if (config.periodicInspection) {
            const allPeriodic = processedReportList.flatMap(r => r.periodicInspections.map(i => ({ ...i, plate: r.vehicle.plate })))
            addSheet('Periyodik Kontroller', allPeriodic, [
                { header: 'Plaka', value: i => i.plate },
                { header: 'Tarih', value: i => formatDate(i.inspection_date) },
                { header: 'Sonuç', value: i => i.result },
                { header: 'Sonraki Tarih', value: i => formatDate(i.next_inspection) },
                { header: 'Tutar', value: i => i.cost }
            ])
        }

        const sanitizeFileName = (str) => (str || '').replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_\-\s]/g, '').trim().replace(/\s+/g, '_');
        const getReportPeriodText = (range) => {
            if (range?.start) {
                const d = new Date(range.start);
                if (!isNaN(d.getTime())) {
                    const m = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
                    return m.charAt(0).toUpperCase() + m.slice(1);
                }
            }
            const now = new Date();
            const m = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
            return m.charAt(0).toUpperCase() + m.slice(1);
        };
        const monthStr = getReportPeriodText(dateRange);
        const companyStr = currentCompany?.name || '';
        const excelFileName = generateUniqueFileName('Is_Raporu', [companyStr, monthStr], 'xlsx');

        XLSX.writeFile(wb, excelFileName)
    }

    useEffect(() => {
        // HMR Fix: Ensure services key exists in config
        if (config.services === undefined) {
            setConfig(prev => ({ ...prev, services: true }))
        }

        if (currentCompany) {
            loadVehicles()
        } else {
            setVehicles([])
            setLoading(false)
        }
    }, [currentCompany])

    const loadVehicles = async () => {
        setLoading(true)
        try {
            const result = await window.electronAPI.getVehicles(currentCompany.id)
            if (result.success) {
                const sorted = (result.data || []).sort(compareVehicleCapacityDesc)
                setVehicles(sorted)
                
                // Track seen types for tabs
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
            console.error('Error loading vehicles:', error)
        }
        setLoading(false)
    }

    const openReportModal = async (vehiclesToReport) => {
        // vehiclesToReport is an array of vehicle objects sorted high ton -> low ton -> high metre -> low metre
        const sortedToReport = [...vehiclesToReport].sort(compareVehicleCapacityDesc)
        setSelectedVehicles(sortedToReport)
        setIsModalOpen(true)
        setLoadingReport(true)
        // Reset date range on new open
        setDateRange({ start: '', end: '' })

        try {
            // Fetch data for each vehicle in parallel preserving exact order
            const allReports = await Promise.all(sortedToReport.map(async (vehicle) => {
                let services = { data: [] }
                try {
                    if (window.electronAPI.getServicesByVehicle) {
                        services = await window.electronAPI.getServicesByVehicle(vehicle.id)
                    }
                } catch (e) {
                    console.warn('Services fetch failed:', e)
                }

                const [maintenances, inspections, insurances, assignments] = await Promise.all([
                    window.electronAPI.getMaintenancesByVehicle(vehicle.id),
                    window.electronAPI.getInspectionsByVehicle(vehicle.id),
                    window.electronAPI.getInsurancesByVehicle(vehicle.id),
                    window.electronAPI.getAssignmentsByVehicle(vehicle.id)
                ])

                return {
                    vehicle: vehicle,
                    data: {
                        maintenances: maintenances?.data || [],
                        inspections: (inspections?.data || []).filter(i => !i.type || i.type === 'traffic'),
                        periodicInspections: (inspections?.data || []).filter(i => i.type === 'periodic'),
                        insurances: insurances?.data || [],
                        assignments: assignments?.data || [],
                        services: services?.data || []
                    }
                }
            }))

            setReportDataList(allReports)
        } catch (error) {
            console.error('Error fetching report data:', error)
        }
        setLoadingReport(false)
    }

    const handleBulkReport = () => {
        const vehiclesToReport = vehicles
            .filter(v => selectedIds.includes(v.id))
            .sort(compareVehicleCapacityDesc)
        openReportModal(vehiclesToReport)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        setSelectedVehicles([])
        setReportDataList([])
    }

    // --- Helpers for Filtering & Sorting ---

    const filterAndSort = (items, dateKey) => {
        if (!items) return []
        let filtered = [...items]

        // Filter by Date Range
        if (dateRange.start || dateRange.end) {
            const startDate = dateRange.start ? new Date(dateRange.start) : null
            const endDate = dateRange.end ? new Date(dateRange.end) : null

            // Set endDate to end of day
            if (endDate) endDate.setHours(23, 59, 59, 999)

            filtered = filtered.filter(item => {
                if (!item[dateKey]) return true
                const d = new Date(item[dateKey])
                if (startDate && d < startDate) return false
                if (endDate && d > endDate) return false
                return true
            })
        }

        // Sort DESC (Newest First)
        filtered.sort((a, b) => new Date(b[dateKey]) - new Date(a[dateKey]))

        return filtered
    }

    // Process data for rendering (apply filters and ensure capacity descending sort)
    const getProcessedReportList = () => {
        const sortedList = [...reportDataList].sort((a, b) => compareVehicleCapacityDesc(a.vehicle, b.vehicle))
        return sortedList.map(report => ({
            vehicle: report.vehicle,
            assignments: filterAndSort(report.data.assignments, 'start_date'),
            maintenances: filterAndSort(report.data.maintenances, 'date'),
            services: filterAndSort(report.data.services, 'date'),
            insurances: filterAndSort(report.data.insurances, 'start_date'),
            inspections: filterAndSort(report.data.inspections, 'inspection_date'),
            periodicInspections: filterAndSort(report.data.periodicInspections, 'inspection_date')
        }))
    }

    const processedReportList = getProcessedReportList()

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

        // Sort ton options descending: e.g. 130 Ton -> 110 Ton -> 80 Ton -> ... -> 25 Ton
        const tonOptions = Array.from(tonMap.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([num, label]) => ({ value: String(num), label }))

        // Sort metre options descending: e.g. 47 Metre -> 45 Metre -> ... -> 26 Metre
        const metreOptions = Array.from(metreMap.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([num, label]) => ({ value: String(num), label }))

        const brandOptions = Array.from(brandSet)
            .sort((a, b) => a.localeCompare(b, 'tr'))
            .map(b => ({ value: b, label: b }))

        const otherModelOptions = Array.from(otherModelSet)
            .sort((a, b) => a.localeCompare(b, 'tr'))
            .map(m => ({ value: m, label: m }))

        const filters = []

        // 1. Kapasite Türü (Ton vs Metre vs Diğer)
        filters.push({
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
        })

        // 2. Tonaj Filtresi
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

        // 3. Metre Filtresi
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

        // 4. Marka Filtresi
        if (brandOptions.length > 0) {
            filters.push({
                key: 'brand',
                label: 'Marka',
                options: brandOptions,
                filterFn: (row, value) => row.brand?.trim().toLowerCase() === value.trim().toLowerCase()
            })
        }

        // 5. Diğer / Binek Model Filtresi
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

    const columns = [
        { key: 'plate', label: 'Plaka' },
        { key: 'brand', label: 'Marka' },
        { 
            key: 'model', 
            label: 'Model / Kapasite',
            sortFn: (a, b) => compareVehicleCapacityDesc(a, b)
        },
        { key: 'type', label: 'Tür', render: v => getVehicleTypeLabel(v) },
        { key: 'year', label: 'Yıl' }
    ]

    const sortedVehicles = useMemo(() => {
        const list = activeTab === 'all' 
            ? [...vehicles] 
            : activeTab === 'unassigned'
                ? vehicles.filter(v => !v.type)
                : vehicles.filter(v => v.type === activeTab)
        return list.sort(compareVehicleCapacityDesc)
    }, [vehicles, activeTab])

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
                    <h1 className="page-title">Araç Raporları</h1>
                    <p style={{ marginTop: '5px', color: '#666' }}>Detaylı raporlama ve çıktılar.</p>
                </div>

                {selectedIds.length > 0 && (
                    <button className="btn btn-primary" onClick={handleBulkReport}>
                        <Layers size={16} />
                        <span style={{ marginLeft: '6px' }}>Seçilenleri Raporla ({selectedIds.length})</span>
                    </button>
                )}
            </div>

            {vehicles.length > 0 && (() => {
                const typeSet = new Set()
                seenTypes.forEach(t => { if (t) typeSet.add(t) })
                vehicles.forEach(v => { if (v.type) typeSet.add(v.type) })

                const tabs = Array.from(typeSet)
                    .map(t => ({
                        value: t,
                        label: getVehicleTypeLabel(t),
                        count: vehicles.filter(v => v.type === t).length
                    }))
                    .filter(t => t.count > 0)

                const unassignedCount = vehicles.filter(v => !v.type).length
                if (unassignedCount > 0 && tabs.length > 0) {
                    tabs.push({
                        value: 'unassigned',
                        label: 'Belirtilmemiş',
                        count: unassignedCount
                    })
                }

                if (tabs.length === 0) return null

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
                )
            })()}

            <DataTable persistenceKey={`Reports_table_${activeTab}`}
                loading={loading}
                columns={columns}
                data={sortedVehicles}
                showSearch={true}
                searchPlaceholder="Plaka, marka, model veya kapasite ara..."
                searchKeys={['plate', 'brand', 'model', 'year']}
                selectable={true}
                filters={vehicleFilters}
                onSelectionChange={setSelectedIds}
                actions={(vehicle) => (
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openReportModal([vehicle])}
                        title="Raporu Görüntüle"
                    >
                        <Eye size={16} />
                        <span style={{ marginLeft: '6px' }}>Görüntüle</span>
                    </button>
                )}
            />

            {/* Preview & Print Modal */}
            {isModalOpen && selectedVehicles.length > 0 && (
                <Modal
                    isOpen={true}
                    onClose={closeModal}
                    title={selectedVehicles.length > 1 ? `${selectedVehicles.length} Araç İçin Toplu Rapor` : `Rapor: ${selectedVehicles[0].plate}`}
                    size="fullscreen"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={closeModal}>Kapat</button>
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
                        {/* Left: Configuration - Sticky Sidebar */}
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
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 10px', borderRadius: '8px', background: reportType === 'list' ? 'var(--accent-subtle)' : 'transparent', border: reportType === 'list' ? '1px solid var(--accent-primary)' : '1px solid transparent', transition: 'all 0.15s' }}>
                                            <input type="radio" name="reportType" checked={reportType === 'list'} onChange={() => setReportType('list')} style={{ display: 'none' }} />
                                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: reportType === 'list' ? '5px solid var(--accent-primary)' : '2px solid var(--border-light)', background: 'var(--bg-primary)', transition: 'all 0.15s', flexShrink: 0 }} />
                                            <span style={{ fontSize: '13px', fontWeight: reportType === 'list' ? 600 : 400, color: reportType === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Araç Listesi (Özet)</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 10px', borderRadius: '8px', background: reportType === 'detail' ? 'var(--accent-subtle)' : 'transparent', border: reportType === 'detail' ? '1px solid var(--accent-primary)' : '1px solid transparent', transition: 'all 0.15s' }}>
                                            <input type="radio" name="reportType" checked={reportType === 'detail'} onChange={() => setReportType('detail')} style={{ display: 'none' }} />
                                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: reportType === 'detail' ? '5px solid var(--accent-primary)' : '2px solid var(--border-light)', background: 'var(--bg-primary)', transition: 'all 0.15s', flexShrink: 0 }} />
                                            <span style={{ fontSize: '13px', fontWeight: reportType === 'detail' ? 600 : 400, color: reportType === 'detail' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Detaylı Araç Raporu</span>
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
                                                    { key: 'inventory', label: 'Demirbaş / Envanter' },
                                                    { key: 'maintenance', label: 'Bakım Geçmişi' },
                                                    { key: 'services', label: 'Servis / Tamir' },
                                                    { key: 'insurance', label: 'Sigorta Durumu' },
                                                    { key: 'inspection', label: 'Muayene Durumu' },
                                                    { key: 'periodicInspection', label: 'Periyodik Kontroller' }
                                                ].map(item => (
                                                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '7px 10px', borderRadius: '8px', transition: 'background 0.15s' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <span style={{ fontSize: '13px', color: config[item.key] ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: config[item.key] ? 500 : 400, transition: 'all 0.15s' }}>{item.label}</span>
                                                        <label className="toggle-switch" style={{ flexShrink: 0, transform: 'scale(0.8)' }} onClick={e => e.stopPropagation()}>
                                                            <input type="checkbox" checked={config[item.key]} onChange={e => setConfig({ ...config, [item.key]: e.target.checked })} />
                                                            <span className="toggle-slider"></span>
                                                        </label>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {[
                                                    { key: 'plate', label: 'Plaka' },
                                                    { key: 'type', label: 'Tür' },
                                                    { key: 'brand', label: 'Marka' },
                                                    { key: 'model', label: 'Model' },
                                                    { key: 'year', label: 'Yıl' },
                                                    { key: 'km', label: 'KM' },
                                                    { key: 'status', label: 'Durum' }
                                                ].map(item => (
                                                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '7px 10px', borderRadius: '8px', transition: 'background 0.15s' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <span style={{ fontSize: '13px', color: listConfig[item.key] ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: listConfig[item.key] ? 500 : 400, transition: 'all 0.15s' }}>{item.label}</span>
                                                        <label className="toggle-switch" style={{ flexShrink: 0, transform: 'scale(0.8)' }} onClick={e => e.stopPropagation()}>
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
                                        <div style={{ marginBottom: 0 }}>
                                            <label style={{ fontSize: '11px', marginBottom: '4px', display: 'block', color: 'var(--text-muted)', fontWeight: 500 }}>Başlangıç Tarihi</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={dateRange.start}
                                                onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                                                style={{ fontSize: '12px', padding: '6px 10px' }}
                                            />
                                        </div>
                                        <div style={{ marginBottom: 0 }}>
                                            <label style={{ fontSize: '11px', marginBottom: '4px', display: 'block', color: 'var(--text-muted)', fontWeight: 500 }}>Bitiş Tarihi</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={dateRange.end}
                                                onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                                                style={{ fontSize: '12px', padding: '6px 10px' }}
                                            />
                                        </div>
                                        {(dateRange.start || dateRange.end) && (
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => setDateRange({ start: '', end: '' })}
                                                style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}
                                            >
                                                Filtreyi Temizle
                                            </button>
                                        )}
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                            * Filtre tüm araçlara uygulanır.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Live Preview */}
                        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-tertiary)', padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.03)' }}>
                            {loadingReport ? (
                                <div style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                                    <div className="spinner"></div> {/* Assuming a spinner class exists, if not it just won't show anything besides text */}
                                    <div>Raporlar hazırlanıyor...</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20mm', alignItems: 'center', width: '100%' }}>
                                    <ReportRenderer
                                        reports={processedReportList}
                                        config={config}
                                        listConfig={listConfig}
                                        dateRange={dateRange}
                                        companyName={currentCompany.name}
                                        reportType={reportType}
                                        isPreview={true}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}

