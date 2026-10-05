import { useState, useEffect, useMemo, useRef } from 'react' // Re-saved for sync
import { useParams, useNavigate, Link } from 'react-router-dom' // Even though we use tabs, we might get ID from props
import { useTabs } from '../context/TabContext'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import CustomSelect from '../components/CustomSelect'
import CustomInput from '../components/CustomInput'
import ConfirmModal from '../components/ConfirmModal'
import { ArrowLeft, Plus, Pencil, Trash2, Calendar, Clock, Truck, User, DollarSign, FileText, Printer, Download, FileDown, Settings, Wallet, ChevronDown, Save, Briefcase, CheckCircle2, AlertCircle, Info, Tag, Layers, RotateCcw, Sliders, ChevronRight, Check } from 'lucide-react'
import { formatDate, formatCurrency, safeSetLocalStorage, generateUniqueFileName } from '../utils/helpers'
import { calculateWorkStats } from '../utils/workCalculations'
import { workItemSchema } from '../schemas/workSchema'
import WorkPdfReport from './WorkPdfReport'
import { exportWorkToExcel } from '../utils/excelExport'

const WORK_COLOR_OPTIONS = [
    { id: '', label: 'Standart', desc: 'Varsayılan temiz satır', color: 'var(--border-color)', bg: 'var(--bg-tertiary)' },
    { id: 'red', label: 'Kırmızı', desc: 'Resmi Tatil / Özel Vurgu', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    { id: 'orange', label: 'Turuncu', desc: 'Cumartesi / Yarım Gün', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
    { id: 'blue', label: 'Mavi', desc: 'Gece Vardiyası', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    { id: 'green', label: 'Yeşil', desc: 'Özel Saha Görüşmesi', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    { id: 'purple', label: 'Mor', desc: 'Özel Durum', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' }
]

export default function WorkDetails(props) {
    const { id: urlId } = useParams()
    const id = props.id || urlId
    const navigate = useNavigate()
    const { openNewTab, replaceTab, activeTabId, closeTab, updateTabInfo } = useTabs()
    const [work, setWork] = useState(null)
    const [loading, setLoading] = useState(true)
    const [vehicles, setVehicles] = useState([])
    const [employees, setEmployees] = useState([])
    const [isPdfModalOpen, setPdfModalOpen] = useState(false)
    const [savingPdf, setSavingPdf] = useState(false)

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [modalError, setModalError] = useState('')
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
    const [isDaySettingsModalOpen, setIsDaySettingsModalOpen] = useState(false)
    const [isBulkDaySettingsModalOpen, setIsBulkDaySettingsModalOpen] = useState(false)

    // Bulk Form State
    const [bulkFormData, setBulkFormData] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        receiptNo: '',
        vehicleId: '',
        employeeId: '',
        startTime: '',
        endTime: '',
        hours: 0,
        overtimeHours: 0,
        pricingType: 'daily',
        monthlyPrice: '',
        unitPrice: '',
        sundayAction: 'zero', // 'zero' (Çalışılmadı 0 Gün - 0 TL), 'skip' (Pazarları atla), 'work' (Normal çalışma)
        additions: [],
        description: ''
    })

    const [curBulkAdditionType, setCurBulkAdditionType] = useState('Yol')
    const [curBulkAdditionPrice, setCurBulkAdditionPrice] = useState('')

    // Confirm Delete State
    const [confirmModal, setConfirmModal] = useState(null)
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)
    const [savingToSystem, setSavingToSystem] = useState(false)
    const [showPrices, setShowPrices] = useState(true)
    const [showGrandTotal, setShowGrandTotal] = useState(true)
    const [showWorkTitle, setShowWorkTitle] = useState(true)
    const [selectedIds, setSelectedIds] = useState([])
    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false)
    const [isBulkStatusDropdownOpen, setIsBulkStatusDropdownOpen] = useState(false)
    const bulkStatusDropdownRef = useRef(null)
    const [bulkEditFormData, setBulkEditFormData] = useState({
        date: '',
        receiptNo: '',
        vehicleId: '',
        employeeId: '',
        startTime: '',
        endTime: '',
        hours: '',
        overtimeHours: '',
        pricingType: '',
        unitPrice: '',
        description: '',
        workStatus: '', // '' (Değiştirme), 'normal' (Normal Çalışma 1 Gün), 'zero' (Çalışılmadı 0 Gün - 0 TL)
        customColor: '', // '' (Değiştirme), 'none' (Kaldır), 'red', 'orange', 'blue', 'green', 'purple'
        multiplier: '', // '' (Değiştirme), '1' (Kaldır), '1.5', '2', etc.
        _manualHours: false,
        _manualOvertime: false
    })
    const [showKdv, setShowKdv] = useState(false)
    const [kdvRate, setKdvRate] = useState(20)
    const [generatingPdf, setGeneratingPdf] = useState(false)
    const [pazarMultiplier, setPazarMultiplier] = useState("1.5")
    const [mesaiMultiplier, setMesaiMultiplier] = useState("1.5")
    const [pageBreakMode, setPageBreakMode] = useState('fit_page')
    const [rowsPerPage, setRowsPerPage] = useState(20)
    const [manualBreakIds, setManualBreakIds] = useState([])
    const [customScale, setCustomScale] = useState(null)
    const [orientation, setOrientation] = useState('portrait')
    const [tableDensity, setTableDensity] = useState('normal')
    const [showBreakTools, setShowBreakTools] = useState(false)
    const [showCustomScaleSlider, setShowCustomScaleSlider] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState({
        options: false,
        multipliers: false,
        pageBreak: false
    })

    useEffect(() => {
        if (work?.id) {
            try {
                let parsed = null
                if (work.pdf_settings) {
                    parsed = typeof work.pdf_settings === 'string' ? JSON.parse(work.pdf_settings) : work.pdf_settings
                } else {
                    const s = localStorage.getItem(`pdfPageBreakSettings_${work.id}`)
                    if (s) parsed = JSON.parse(s)
                }
                if (parsed) {
                    if (parsed.pageBreakMode) setPageBreakMode(parsed.pageBreakMode)
                    if (parsed.rowsPerPage) setRowsPerPage(parsed.rowsPerPage)
                    if (parsed.manualBreakIds) setManualBreakIds(parsed.manualBreakIds)
                    if (parsed.customScale !== undefined) setCustomScale(parsed.customScale)
                    if (parsed.orientation) setOrientation(parsed.orientation)
                    if (parsed.tableDensity) setTableDensity(parsed.tableDensity)
                    if (parsed.showWorkTitle !== undefined) setShowWorkTitle(parsed.showWorkTitle)
                }
            } catch (e) {}
        }
    }, [work?.id, work?.pdf_settings])

    const savePdfBreakSettings = (newSettings) => {
        if (!work?.id) return
        try {
            const cur = JSON.parse(localStorage.getItem(`pdfPageBreakSettings_${work.id}`) || '{}')
            const updated = {
                pageBreakMode: newSettings.pageBreakMode !== undefined ? newSettings.pageBreakMode : pageBreakMode,
                rowsPerPage: newSettings.rowsPerPage !== undefined ? newSettings.rowsPerPage : rowsPerPage,
                manualBreakIds: newSettings.manualBreakIds !== undefined ? newSettings.manualBreakIds : manualBreakIds,
                customScale: newSettings.customScale !== undefined ? newSettings.customScale : customScale,
                tableDensity: newSettings.tableDensity !== undefined ? newSettings.tableDensity : tableDensity,
                showWorkTitle: newSettings.showWorkTitle !== undefined ? newSettings.showWorkTitle : showWorkTitle,
                ...newSettings
            }
            const jsonStr = JSON.stringify(updated)
            localStorage.setItem(`pdfPageBreakSettings_${work.id}`, jsonStr)

            // Persist to PostgreSQL / SQLite database
            const api = window.electronAPI || window.api
            if (api && api.updateWork) {
                api.updateWork({ id: work.id, pdf_settings: jsonStr }).catch(() => {})
            }
        } catch (e) {}
    }

    // Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        receiptNo: '',
        vehicleId: '',
        employeeId: '',
        startTime: '',
        endTime: '',
        hours: 0,
        overtimeHours: 0,
        pricingType: 'daily',
        unitPrice: '',
        additions: [], // Array of { type: 'Yol', price: 100 }
        description: ''
    })

    const [curAdditionType, setCurAdditionType] = useState('Yol')
    const [curAdditionPrice, setCurAdditionPrice] = useState('')

    useEffect(() => {
        loadData()
    }, [id])

    // Real-time synchronization listener
    const loadDataRef = useRef(null)
    useEffect(() => {
        loadDataRef.current = loadData
    })
    useEffect(() => {
        if (!id) return
        const unsub = window.electronAPI?.onDbUpdate?.((change) => {
            if (['works', 'work_items', 'customers', 'employees', 'vehicles'].includes(change?.table)) {
                console.log(`[RealTime] WorkDetails reloading for change in ${change.table}`)
                loadDataRef.current(true)
            }
        })
        return () => { if (unsub) unsub() }
    }, [id])

    // Close bulk status dropdown on click outside or escape
    useEffect(() => {
        if (!isBulkStatusDropdownOpen) return
        const handleClickOutside = (e) => {
            if (bulkStatusDropdownRef.current && !bulkStatusDropdownRef.current.contains(e.target)) {
                setIsBulkStatusDropdownOpen(false)
            }
        }
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsBulkStatusDropdownOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [isBulkStatusDropdownOpen])

    const calculateAutoHours = (startTime, endTime, pricingType) => {
        if (!startTime || !endTime) return { hours: 1, overtimeHours: 0 };

        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        let diffHours = endH - startH + (endM - startM) / 60;
        if (diffHours < 0) diffHours += 24;

        let calculatedHours = 1;
        let calculatedOvertime = 0;

        if (pricingType === 'hourly') {
            calculatedHours = parseFloat(diffHours.toFixed(2));
            calculatedOvertime = 0;
        } else if (work?.disable_overtime) {
            calculatedHours = 1;
            calculatedOvertime = 0;
        } else {
            // 'daily' or 'monthly' pricing
            // Standard Window from work settings, defaulting to 08:00 - 17:00 (9 hours total)
            const workStartStr = work?.work_start_time || '08:00';
            const workEndStr = work?.work_end_time || '17:00';
            
            const [wSH, wSM] = workStartStr.split(':').map(Number);
            const [wEH, wEM] = workEndStr.split(':').map(Number);
            
            const workStart = wSH + (wSM / 60);
            const workEnd = wEH + (wEM / 60);
            
            const currentStart = startH + (startM / 60);
            const currentEnd = endH + (endM / 60);

            let standardOverlap = 0;
            if (currentEnd >= currentStart) {
                // Same day interval
                standardOverlap = Math.max(0, Math.min(currentEnd, workEnd) - Math.max(currentStart, workStart));
            } else {
                // Overnight interval (spans midnight)
                const day1Overlap = Math.max(0, Math.min(24, workEnd) - Math.max(currentStart, workStart));
                const day2Overlap = Math.max(0, Math.min(currentEnd, workEnd) - Math.max(0, workStart));
                standardOverlap = day1Overlap + day2Overlap;
            }

            const overtimeHours = Math.max(0, diffHours - standardOverlap);
            calculatedHours = 1;
            calculatedOvertime = parseFloat(Math.min(diffHours, overtimeHours).toFixed(2));
        }

        return { hours: calculatedHours, overtimeHours: calculatedOvertime };
    }

    // Auto-calculate hours for single form
    useEffect(() => {
        if (!isModalOpen) return;
        if (formData._manualHours) return;
        if (formData.startTime && formData.endTime) {
            const result = calculateAutoHours(formData.startTime, formData.endTime, formData.pricingType);
            setFormData(prev => prev._manualHours ? prev : ({ ...prev, ...result }));
        }
    }, [formData.startTime, formData.endTime, formData.pricingType, isModalOpen, work, formData._manualHours])

    // Auto-calculate hours for bulk form
    useEffect(() => {
        if (!isBulkModalOpen) return;
        if (bulkFormData._manualHours) return;
        const result = calculateAutoHours(bulkFormData.startTime, bulkFormData.endTime, bulkFormData.pricingType);
        setBulkFormData(prev => prev._manualHours ? prev : ({ ...prev, ...result }));
    }, [bulkFormData.startTime, bulkFormData.endTime, bulkFormData.pricingType, isBulkModalOpen, work, bulkFormData._manualHours])

    // Auto-calculate hours for bulk edit modal
    useEffect(() => {
        if (!isBulkEditModalOpen) return;
        if (bulkEditFormData.startTime && bulkEditFormData.endTime) {
            const result = calculateAutoHours(bulkEditFormData.startTime, bulkEditFormData.endTime, bulkEditFormData.pricingType);
            setBulkEditFormData(prev => ({
                ...prev,
                hours: prev._manualHours ? prev.hours : String(result.hours),
                overtimeHours: prev._manualOvertime ? prev.overtimeHours : String(result.overtimeHours)
            }));
        }
    }, [bulkEditFormData.startTime, bulkEditFormData.endTime, bulkEditFormData.pricingType, isBulkEditModalOpen, work])



    const loadData = async (isBackground = false) => {
        if (!isBackground) setLoading(true)
        try {
            // Load Work Details
            const workRes = await window.electronAPI.getWorkDetails(id)
            if (workRes.success) {
                setWork(workRes.data)
                setPazarMultiplier(workRes.data.pazar_multiplier !== undefined && workRes.data.pazar_multiplier !== null ? String(workRes.data.pazar_multiplier) : "1.5")
                setMesaiMultiplier(workRes.data.mesai_multiplier !== undefined && workRes.data.mesai_multiplier !== null ? String(workRes.data.mesai_multiplier) : "1.5")
                updateTabInfo(`/works/${id}`, { label: workRes.data.title || 'İş Detayı' })

                // Load Resources for Dropdowns using companyId
                if (workRes.data.company_id) {
                    const [vehiclesRes, employeesRes] = await Promise.all([
                        window.electronAPI.getVehicles(workRes.data.company_id),
                        window.electronAPI.getEmployees(workRes.data.company_id)
                    ])

                    if (vehiclesRes.success) setVehicles(vehiclesRes.data)
                    if (employeesRes.success) setEmployees(employeesRes.data)
                }
            } else {
                console.error('Failed to load work:', workRes.error)
            }

        } catch (error) {
            console.error('Error loading data:', error)
        }
        if (!isBackground) setLoading(false)
    }

    const getCompactWorkData = (w, vehiclesList = []) => {
        if (!w) return null;
        const vMap = {};
        (vehiclesList || []).forEach(v => {
            if (v && v.id) vMap[String(v.id)] = v;
        });

        const customerName = w.customer_name || w.customers?.name || (typeof w.customer === 'object' ? w.customer?.name : w.customer) || '';

        return {
            id: w.id,
            title: w.title,
            work_no: w.work_no,
            date: w.date,
            description: w.description,
            customer_id: w.customer_id,
            customer_name: customerName,
            customer: w.customer,
            customers: w.customers ? { id: w.customers.id, name: w.customers.name, phone: w.customers.phone } : (customerName ? { name: customerName } : null),
            company_id: w.company_id,
            company_name: w.company_name || w.company?.name || '',
            company: w.company ? { name: w.company.name, phone: w.company.phone } : null,
            pazar_multiplier: w.pazar_multiplier,
            mesai_multiplier: w.mesai_multiplier,
            vehiclesList: (vehiclesList || []).map(v => ({ id: v.id, name: v.name, plate: v.plate, brand: v.brand, model: v.model })),
            vehicles: (vehiclesList || []).map(v => ({ id: v.id, name: v.name, plate: v.plate, brand: v.brand, model: v.model })),
            items: (w.items || []).map(item => {
                const vObj = item.vehicle || item.vehicles || (item.vehicle_id ? vMap[String(item.vehicle_id)] : null);
                const plateStr = item.plate || vObj?.plate || item.custom_vehicle || vObj?.name || '';
                const modelStr = item.model || vObj?.model || vObj?.brand || '';
                const brandStr = item.brand || vObj?.brand || '';
                const nameStr = item.vehicle_name || vObj?.name || plateStr;

                return {
                    id: item.id,
                    date: item.date,
                    receipt_no: item.receipt_no,
                    start_time: item.start_time,
                    end_time: item.end_time,
                    hours: item.hours,
                    overtime_hours: item.overtime_hours,
                    unit_price: item.unit_price,
                    unitPriceVal: item.unitPriceVal,
                    isPazar: item.isPazar,
                    isAylik: item.isAylik,
                    description: item.description,
                    vehicle_id: item.vehicle_id,
                    plate: plateStr,
                    brand: brandStr,
                    model: modelStr,
                    custom_vehicle: item.custom_vehicle || '',
                    vehicle_name: nameStr,
                    vehicle: vObj ? { id: vObj.id, name: vObj.name, plate: vObj.plate, brand: vObj.brand, model: vObj.model } : null,
                    vehicles: vObj ? { id: vObj.id, name: vObj.name, plate: vObj.plate, brand: vObj.brand, model: vObj.model } : null
                };
            })
        };
    };

    const handleSaveToSystem = async () => {
        if (!window.electronAPI?.saveReportPdf) {
            alert('PDF Kaydetme özelliği sadece masaüstü uygulamasında geçerlidir.')
            return
        }

        // Store the print configuration safely in localStorage
        safeSetLocalStorage('printData', JSON.stringify({
            isWorkReport: true,
            work: getCompactWorkData(work, vehicles),
            showPrices: showPrices,
            showWorkTitle: showWorkTitle,
            showKdv: showKdv,
            kdvRate: kdvRate,
            pazarMultiplier: pazarMultiplier,
            mesaiMultiplier: mesaiMultiplier,
            pageBreakMode: pageBreakMode,
            rowsPerPage: rowsPerPage,
            manualBreakIds: manualBreakIds,
            customScale: customScale,
            orientation: orientation,
            tableDensity: tableDensity,
            isPdfSave: true
        }))

        setSavingToSystem(true)
        try {
            // Generate PDF silently in temp folder
            const res = await window.electronAPI.saveReportPdf('/print', { silent: true, landscape: orientation === 'landscape' })
            if (res && res.success && res.filePath) {
                // Save the PDF as a document linked to this work
                const docRes = await window.electronAPI.addDocument({
                    vehicleId: work.vehicle_id || null,
                    relatedType: 'work',
                    relatedId: work.id,
                    filePath: res.filePath,
                    fileName: generateUniqueFileName('Is_Raporu', [work.title || work.work_no], 'pdf')
                })

                if (docRes.success) {
                    setIsReportModalOpen(false)
                    alert('Rapor sisteme başarıyla kaydedildi.')
                } else {
                    alert('Rapor sisteme eklenirken hata: ' + docRes.error)
                }
            } else {
                alert('PDF Raporu oluşturulurken hata: ' + (res?.error || 'Bilinmeyen hata'))
            }
        } catch (err) {
            console.error('Save report to system error:', err)
            alert('Hata: ' + err.message)
        } finally {
            setSavingToSystem(false)
        }
    }

    const handleBack = () => {
        // Go back to the works list in the same tab
        navigate('/works')
    }

    // --- Modal Handlers ---

    const openBulkAddModal = () => {
        setBulkFormData({
            startDate: work?.start_date ? new Date(work.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            endDate: work?.end_date ? new Date(work.end_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            receiptNo: '',
            vehicleId: '',
            employeeId: '',
            startTime: '08:00',
            endTime: '17:00',
            hours: 1, // Default Normal Gün Sayısı
            overtimeHours: 0,
            pricingType: 'daily',
            monthlyPrice: '',
            unitPrice: '',
            sundayAction: 'zero',
            travelEnabled: false,
            travelPrice: '',
            description: ''
        })
        setModalError('')
        setIsBulkModalOpen(true)
    }

    const openBulkEditModal = () => {
        setBulkEditFormData({
            date: '',
            receiptNo: '',
            vehicleId: '',
            employeeId: '',
            startTime: '',
            endTime: '',
            hours: '',
            overtimeHours: '',
            pricingType: '',
            unitPrice: '',
            description: '',
            workStatus: '',
            customColor: '',
            multiplier: '',
            _manualHours: false,
            _manualOvertime: false
        })
        setModalError('')
        setIsBulkEditModalOpen(true)
    }

    const openAddModal = () => {
        setEditingItem(null)
        setFormData({
            date: new Date().toISOString().split('T')[0],
            receiptNo: '',
            vehicleId: '',
            employeeId: '',
            startTime: '08:00',
            endTime: '17:00',
            hours: 1, // Default Normal Gün Sayısı
            overtimeHours: 0,
            pricingType: 'daily',
            unitPrice: '',
            multiplier: '1',
            customColor: '',
            travelEnabled: false,
            travelPrice: '',
            description: '',
            _manualHours: false,
            _manualOvertime: false
        })
        setShowAdvancedOptions(false)
        setModalError('')
        setIsModalOpen(true)
    }

    const openEditModal = (item) => {
        setEditingItem(item)
        let determinedPricingType = 'daily';
        let desc = item.description || '';
        
        if (desc.startsWith('[SAATLİK] ')) {
            determinedPricingType = 'hourly';
            desc = desc.replace('[SAATLİK] ', '');
        } else if (desc.startsWith('[AYLIK] ')) {
            determinedPricingType = 'monthly';
            desc = desc.replace('[AYLIK] ', '');
        }

        // Parse multiplier tag
        let multiplier = '1';
        const multMatch = desc.match(/\[KATSAYI:([^\]]+)\]/);
        if (multMatch) {
            multiplier = multMatch[1];
            desc = desc.replace(multMatch[0], '').trim();
        }

        // Parse custom color tag
        let customColor = '';
        const colorMatch = desc.match(/\[RENK:([^\]]+)\]/);
        if (colorMatch) {
            customColor = colorMatch[1];
            desc = desc.replace(colorMatch[0], '').trim();
        }

        // Parse custom addition tags
        const additionMatches = desc.matchAll(/\[EK:([^:]+):([^\]]+)\]/g);
        const additions = [];
        
        for (const match of additionMatches) {
            additions.push({
                type: match[1],
                price: parseFloat(match[2]) || 0
            });
            // Remove the tag from description
            desc = desc.replace(match[0], '').trim();
        }
        
        // Handle legacy travel_price if no additions found
        const hasTravelPrice = (item.travel_price || 0) > 0;
        if (additions.length === 0 && hasTravelPrice) {
            additions.push({
                type: 'Yol',
                price: item.travel_price
            });
        }

        if ((multiplier && multiplier !== '1') || customColor) {
            setShowAdvancedOptions(true)
        } else {
            setShowAdvancedOptions(false)
        }

        setFormData({
            date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            receiptNo: item.receipt_no || '',
            vehicleId: item.vehicle_id || item.custom_vehicle || '',
            employeeId: item.employee_id || item.custom_employee || '',
            startTime: item.start_time || '',
            endTime: item.end_time || '',
            hours: item.hours !== undefined && item.hours !== null ? item.hours : 0,
            overtimeHours: item.overtime_hours !== undefined && item.overtime_hours !== null ? item.overtime_hours : 0,
            pricingType: determinedPricingType,
            unitPrice: item.unit_price || 0,
            multiplier: multiplier,
            customColor: customColor,
            additions: additions,
            description: desc,
            _manualHours: true,
            _manualOvertime: true
        })
        setModalError('')
        setIsModalOpen(true)
    }

    const handleModalSubmit = async (e) => {
        e.preventDefault()
        setModalError('')

        try {
            const parsed = workItemSchema.parse(formData)

            let finalDesc = parsed.description || '';

            // Clean or assign holiday tags based on parsed.hours
            if (Number(parsed.hours) > 0) {
                finalDesc = finalDesc
                    .replace(/\[TATİL\]\s*/gi, '')
                    .replace(/\[ÇALIŞILMADI\]\s*/gi, '')
                    .replace(/\[PAZAR TATİLİ\]\s*/gi, '')
                    .trim();
            } else if (Number(parsed.hours) === 0) {
                if (!/\[(TATİL|ÇALIŞILMADI|PAZAR TATİLİ)\]/i.test(finalDesc)) {
                    finalDesc = `[TATİL] ${finalDesc}`.trim();
                }
            }

            if (formData.pricingType === 'hourly' && !finalDesc.startsWith('[SAATLİK]')) {
                finalDesc = '[SAATLİK] ' + finalDesc;
            } else if (formData.pricingType === 'monthly' && !finalDesc.startsWith('[AYLIK]')) {
                finalDesc = '[AYLIK] ' + finalDesc;
            }

            if (formData.multiplier && parseFloat(formData.multiplier) !== 1) {
                finalDesc = `[KATSAYI:${formData.multiplier}] ` + finalDesc;
            }

            if (formData.customColor) {
                finalDesc = `[RENK:${formData.customColor}] ` + finalDesc;
            }

            // Append custom addition tags
            if (formData.additions && formData.additions.length > 0) {
                formData.additions.forEach(add => {
                    finalDesc = `[EK:${add.type}:${add.price}] ` + finalDesc;
                });
            }

            const payload = {
                ...parsed,
                unitPrice: parsed.unitPrice,
                description: finalDesc,
                // Still save to travelPrice if 'Yol' is in the list for backward compatibility
                travelPrice: (formData.additions || []).find(add => add.type === 'Yol')?.price || 0,
                workId: id
            }

            let result
            if (editingItem) {
                // Single item update
                result = await window.electronAPI.updateWorkItem({ ...payload, id: editingItem.id })
            } else {
                // Standard single item add
                result = await window.electronAPI.addWorkItem(payload)
            }

            if (result.success) {
                setIsModalOpen(false)
                loadData()
            } else {
                setModalError(result.error)
            }
        } catch (err) {
            if (err.errors) {
                setModalError(err.errors[0].message)
            } else {
                setModalError(err.message)
            }
        }
    }

    const handleBulkSubmit = async (e) => {
        e.preventDefault()
        setModalError('')

        try {
            if (!bulkFormData.startDate || !bulkFormData.endDate) {
                setModalError('Başlangıç ve bitiş tarihi zorunludur.')
                return
            }

            const [sYear, sMonth, sDay] = bulkFormData.startDate.split('-').map(Number);
            const [eYear, eMonth, eDay] = bulkFormData.endDate.split('-').map(Number);
            let currentDate = new Date(sYear, sMonth - 1, sDay, 12, 0, 0);
            const end = new Date(eYear, eMonth - 1, eDay, 12, 0, 0);

            if (currentDate > end) {
                setModalError('Bitiş tarihi başlangıç tarihinden küçük olamaz.')
                return
            }

            const payloadList = []

            let finalUnitPrice = bulkFormData.unitPrice ? parseFloat(bulkFormData.unitPrice) : 0;
            if (bulkFormData.pricingType === 'monthly' && bulkFormData.monthlyPrice) {
                // Aylar 26 gündür (Pazar hariç) - Tam oran (yuvarlama hatası olmadan)
                finalUnitPrice = parseFloat(bulkFormData.monthlyPrice) / 26;
            }

            const sundayMode = bulkFormData.sundayAction || 'zero';

            while (currentDate <= end) {
                const dayOfWeek = currentDate.getDay(); // 0 is Sunday
                const isSunday = (dayOfWeek === 0);

                if (isSunday && sundayMode === 'skip') {
                    // Pazar gününü puantaja hiç ekleme
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue;
                }

                let itemDesc = bulkFormData.description || '';
                if (bulkFormData.pricingType === 'monthly') {
                    const monthlyVal = parseFloat(bulkFormData.monthlyPrice) || 0;
                    if (monthlyVal > 0 && !itemDesc.includes('[AYLIK:')) {
                        itemDesc = itemDesc ? `[AYLIK:${monthlyVal}] ${itemDesc}` : `[AYLIK:${monthlyVal}]`;
                    } else if (!itemDesc.includes('[AYLIK]')) {
                        itemDesc = itemDesc ? `[AYLIK] ${itemDesc}` : '[AYLIK]';
                    }
                }

                let itemHours = bulkFormData.hours ? parseFloat(bulkFormData.hours) : 1;
                let itemOvertime = bulkFormData.overtimeHours ? parseFloat(bulkFormData.overtimeHours) : 0;
                let itemUnitPrice = finalUnitPrice;
                let itemStartTime = bulkFormData.startTime;
                let itemEndTime = bulkFormData.endTime;

                if (isSunday && sundayMode === 'zero') {
                    // Pazar günü çalışılmadı (0 Gün - 0 TL)
                    itemHours = 0;
                    itemOvertime = 0;
                    itemUnitPrice = 0;
                    itemStartTime = '';
                    itemEndTime = '';
                    if (!itemDesc.includes('PAZAR')) {
                        itemDesc = itemDesc ? `[PAZAR TATİLİ] ${itemDesc}` : '[PAZAR TATİLİ]';
                    }
                }

                // Additions tags (only if not Sunday zero)
                if (!isSunday || sundayMode !== 'zero') {
                    if (bulkFormData.additions && bulkFormData.additions.length > 0) {
                        bulkFormData.additions.forEach(add => {
                            if (add.type && add.price) {
                                itemDesc = `[EK:${add.type}:${add.price}] ` + itemDesc;
                            }
                        });
                    } else if (bulkFormData.additionEnabled && bulkFormData.additionType && bulkFormData.additionPrice) {
                        itemDesc = `[EK:${bulkFormData.additionType}:${bulkFormData.additionPrice}] ` + itemDesc;
                    }
                }

                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

                payloadList.push({
                    workId: id,
                    date: dateStr,
                    receiptNo: bulkFormData.receiptNo,
                    vehicleId: bulkFormData.vehicleId,
                    employeeId: bulkFormData.employeeId,
                    startTime: itemStartTime,
                    endTime: itemEndTime,
                    hours: itemHours,
                    overtimeHours: itemOvertime,
                    unitPrice: itemUnitPrice,
                    travelPrice: (bulkFormData.additionEnabled && bulkFormData.additionType === 'Yol' && (!isSunday || sundayMode !== 'zero')) ? (parseFloat(bulkFormData.additionPrice) || 0) : 0,
                    description: itemDesc || null
                })

                currentDate.setDate(currentDate.getDate() + 1)
            }

            const result = await window.electronAPI.addBulkWorkItems(payloadList)

            if (result.success) {
                setIsBulkModalOpen(false)
                loadData()
            } else {
                setModalError(result.error)
            }
        } catch (err) {
            setModalError(err.message)
        }
    }

    // --- Delete Handlers ---

    const handleBulkEditSubmit = async (e) => {
        e.preventDefault()
        setModalError('')

        // Filter out empty fields
        const updates = {}
        if (bulkEditFormData.date && bulkEditFormData.date !== '') updates.date = bulkEditFormData.date
        if (bulkEditFormData.receiptNo !== '') updates.receiptNo = bulkEditFormData.receiptNo
        if (bulkEditFormData.vehicleId !== '') {
            const num = Number(bulkEditFormData.vehicleId)
            updates.vehicleId = isNaN(num) ? bulkEditFormData.vehicleId : num
        }
        if (bulkEditFormData.employeeId !== '') {
            const num = Number(bulkEditFormData.employeeId)
            updates.employeeId = isNaN(num) ? bulkEditFormData.employeeId : num
        }
        if (bulkEditFormData.startTime && bulkEditFormData.startTime !== '') updates.startTime = bulkEditFormData.startTime
        if (bulkEditFormData.endTime && bulkEditFormData.endTime !== '') updates.endTime = bulkEditFormData.endTime
        if (bulkEditFormData.hours !== '' && bulkEditFormData.hours !== undefined && bulkEditFormData.hours !== null) {
            updates.hours = parseFloat(bulkEditFormData.hours)
        }
        if (bulkEditFormData.overtimeHours !== '' && bulkEditFormData.overtimeHours !== undefined && bulkEditFormData.overtimeHours !== null) {
            updates.overtimeHours = parseFloat(bulkEditFormData.overtimeHours)
        }
        if (bulkEditFormData.pricingType !== '') updates.pricingType = bulkEditFormData.pricingType
        if (bulkEditFormData.unitPrice !== '') updates.unitPrice = parseFloat(bulkEditFormData.unitPrice)
        if (bulkEditFormData.description !== '') updates.description = bulkEditFormData.description

        if (Object.keys(updates).length === 0 && !bulkEditFormData.workStatus && !bulkEditFormData.customColor && !bulkEditFormData.multiplier) {
            setModalError('Lütfen en az bir alanı doldurun veya bir işlem seçin.')
            return
        }

        try {
            const results = await Promise.all(selectedIds.map(async (id) => {
                const existingItem = work.items.find(item => item.id === id)
                if (!existingItem) return { success: false, error: 'Kayıt bulunamadı' }

                let itemDesc = updates.description !== undefined ? updates.description : (existingItem.description || '');

                if (updates.pricingType !== undefined) {
                    itemDesc = itemDesc.replace(/\[SAATLİK\]\s*/g, '').replace(/\[AYLIK\]\s*/g, '');
                    if (updates.pricingType === 'hourly') {
                        itemDesc = '[SAATLİK] ' + itemDesc;
                    } else if (updates.pricingType === 'monthly') {
                        itemDesc = '[AYLIK] ' + itemDesc;
                    }
                }

                const itemPricingType = updates.pricingType || (itemDesc.includes('[SAATLİK]') || existingItem.pricingType === 'hourly' ? 'hourly' : (itemDesc.includes('[AYLIK]') || existingItem.pricingType === 'monthly' ? 'monthly' : 'daily'));

                let finalStartTime = updates.startTime !== undefined ? updates.startTime : existingItem.start_time;
                let finalEndTime = updates.endTime !== undefined ? updates.endTime : existingItem.end_time;
                let finalHours = existingItem.hours;
                let finalOvertime = existingItem.overtime_hours;
                let finalUnitPrice = updates.unitPrice !== undefined ? updates.unitPrice : existingItem.unit_price;

                if (bulkEditFormData.workStatus === 'zero') {
                    // 0 Gün, 0 TL, Tatil
                    finalHours = 0;
                    finalOvertime = 0;
                    finalStartTime = '';
                    finalEndTime = '';
                    finalUnitPrice = 0;
                    if (!itemDesc.includes('TATİL') && !itemDesc.includes('ÇALIŞILMADI')) {
                        itemDesc = `[TATİL] ${itemDesc}`.trim();
                    }
                } else if (bulkEditFormData.workStatus === 'normal') {
                    // Normal Gün (1 Gün)
                    finalHours = updates.hours !== undefined ? updates.hours : 1;
                    finalOvertime = updates.overtimeHours !== undefined ? updates.overtimeHours : 0;
                    finalStartTime = updates.startTime !== undefined ? updates.startTime : (existingItem.start_time || work?.work_start_time || '08:00');
                    finalEndTime = updates.endTime !== undefined ? updates.endTime : (existingItem.end_time || work?.work_end_time || '17:00');

                    // Tatil etiketlerini temizle
                    itemDesc = itemDesc
                        .replace(/\[TATİL\]\s*/gi, '')
                        .replace(/\[ÇALIŞILMADI\]\s*/gi, '')
                        .replace(/\[PAZAR TATİLİ\]\s*/gi, '')
                        .trim();

                    if (updates.unitPrice !== undefined) {
                        finalUnitPrice = updates.unitPrice;
                    } else if (Number(existingItem.unit_price) === 0) {
                        const targetVehId = updates.vehicleId !== undefined ? updates.vehicleId : (existingItem.vehicle_id || existingItem.custom_vehicle);
                        const stdP = getVehicleStandardPrice(targetVehId);
                        if (stdP) finalUnitPrice = parseFloat(stdP);
                    }
                } else {
                    if (updates.hours !== undefined) {
                        finalHours = updates.hours;
                    } else if (updates.startTime !== undefined || updates.endTime !== undefined) {
                        const autoH = calculateAutoHours(finalStartTime, finalEndTime, itemPricingType);
                        finalHours = autoH.hours;
                    }

                    if (updates.overtimeHours !== undefined) {
                        finalOvertime = updates.overtimeHours;
                    } else if (updates.startTime !== undefined || updates.endTime !== undefined) {
                        const autoH = calculateAutoHours(finalStartTime, finalEndTime, itemPricingType);
                        finalOvertime = autoH.overtimeHours;
                    }
                }

                // Toplu Gün Rengi Uygulama
                if (bulkEditFormData.customColor) {
                    itemDesc = itemDesc.replace(/\[RENK:[^\]]+\]\s*/g, '').trim();
                    if (bulkEditFormData.customColor !== 'none') {
                        itemDesc = `[RENK:${bulkEditFormData.customColor}] ` + itemDesc;
                    }
                }

                // Toplu Manuel Katsayı Uygulama
                if (bulkEditFormData.multiplier) {
                    itemDesc = itemDesc.replace(/\[KATSAYI:[^\]]+\]\s*/g, '').trim();
                    if (bulkEditFormData.multiplier !== '1' && bulkEditFormData.multiplier !== 'none') {
                        itemDesc = `[KATSAYI:${bulkEditFormData.multiplier}] ` + itemDesc;
                    }
                }

                const finalPayload = {
                    id: id,
                    date: updates.date !== undefined ? updates.date : existingItem.date,
                    receiptNo: updates.receiptNo !== undefined ? updates.receiptNo : existingItem.receipt_no,
                    vehicleId: updates.vehicleId !== undefined ? updates.vehicleId : (existingItem.vehicle_id || existingItem.custom_vehicle),
                    employeeId: updates.employeeId !== undefined ? updates.employeeId : (existingItem.employee_id || existingItem.custom_employee),
                    startTime: finalStartTime,
                    endTime: finalEndTime,
                    hours: finalHours,
                    overtimeHours: finalOvertime,
                    unitPrice: finalUnitPrice,
                    travelPrice: existingItem.travel_price,
                    description: itemDesc
                }
                
                return await window.electronAPI.updateWorkItem(finalPayload)
            }))

            const failed = results.filter(r => !r.success)
            if (failed.length > 0) {
                setModalError(`${failed.length} kayıt güncellenemedi.`)
            } else {
                setIsBulkEditModalOpen(false)
                setSelectedIds([]) // Clear selection
                loadData()
            }
        } catch (err) {
            setModalError(err.message)
        }
    }

    const handleBulkSetZeroDays = async () => {
        if (!selectedIds || selectedIds.length === 0) return;
        const confirmMsg = `Seçili ${selectedIds.length} adet kaydı "Çalışılmadı (0 Gün - 0 TL)" olarak ayarlamak istediğinize emin misiniz?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            setLoading(true);
            await Promise.all(selectedIds.map(async (selectedId) => {
                const existingItem = (work.items || []).find(item => item.id === selectedId);
                if (!existingItem) return;

                let itemDesc = existingItem.description || '';
                if (!itemDesc.includes('TATİL') && !itemDesc.includes('ÇALIŞILMADI')) {
                    itemDesc = `[TATİL] ${itemDesc}`.trim();
                }

                const finalPayload = {
                    id: selectedId,
                    date: existingItem.date,
                    receiptNo: existingItem.receipt_no,
                    vehicleId: existingItem.vehicle_id || existingItem.custom_vehicle,
                    employeeId: existingItem.employee_id || existingItem.custom_employee,
                    startTime: '',
                    endTime: '',
                    hours: 0,
                    overtimeHours: 0,
                    unitPrice: 0,
                    travelPrice: 0,
                    description: itemDesc
                };
                return await window.electronAPI.updateWorkItem(finalPayload);
            }));

            setSelectedIds([]);
            await loadData();
        } catch (err) {
            alert('İşlem sırasında hata oluştu: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    const getVehicleStandardPrice = (vehicleId) => {
        if (!vehicleId) return '';
        if (work?.items) {
            const match = work.items.find(i => 
                (String(i.vehicle_id) === String(vehicleId) || String(i.custom_vehicle) === String(vehicleId)) && 
                Number(i.unit_price) > 0 && 
                Number(i.hours) > 0
            );
            if (match) return String(match.unit_price);
        }
        const vObj = vehicles.find(v => String(v.id) === String(vehicleId));
        if (vObj && (vObj.standard_rate || vObj.daily_price || vObj.unit_price)) {
            return String(vObj.standard_rate || vObj.daily_price || vObj.unit_price);
        }
        return '';
    }

    const handleBulkSetNormalDays = async () => {
        if (!selectedIds || selectedIds.length === 0) return;
        const confirmMsg = `Seçili ${selectedIds.length} adet kaydı tekrar "Normal Çalışma (1 Gün)" durumuna getirmek istediğinize emin misiniz?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            setLoading(true);
            const defaultStart = work?.work_start_time || '08:00';
            const defaultEnd = work?.work_end_time || '17:00';

            await Promise.all(selectedIds.map(async (selectedId) => {
                const existingItem = (work.items || []).find(item => item.id === selectedId);
                if (!existingItem) return;

                // Clean holiday tags from description
                let itemDesc = (existingItem.description || '')
                    .replace(/\[TATİL\]\s*/gi, '')
                    .replace(/\[ÇALIŞILMADI\]\s*/gi, '')
                    .replace(/\[PAZAR TATİLİ\]\s*/gi, '')
                    .trim();

                // If unitPrice was 0, restore it from vehicle standard price
                let restoredUnitPrice = Number(existingItem.unit_price) || 0;
                if (restoredUnitPrice === 0) {
                    const stdP = getVehicleStandardPrice(existingItem.vehicle_id || existingItem.custom_vehicle);
                    if (stdP) restoredUnitPrice = parseFloat(stdP);
                }

                const finalPayload = {
                    id: selectedId,
                    date: existingItem.date,
                    receiptNo: existingItem.receipt_no,
                    vehicleId: existingItem.vehicle_id || existingItem.custom_vehicle,
                    employeeId: existingItem.employee_id || existingItem.custom_employee,
                    startTime: existingItem.start_time || defaultStart,
                    endTime: existingItem.end_time || defaultEnd,
                    hours: 1,
                    overtimeHours: 0,
                    unitPrice: restoredUnitPrice,
                    travelPrice: existingItem.travel_price,
                    description: itemDesc || null
                };
                return await window.electronAPI.updateWorkItem(finalPayload);
            }));

            setSelectedIds([]);
            await loadData();
        } catch (err) {
            alert('İşlem sırasında hata oluştu: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleDeleteClick = (item) => {
        setConfirmModal({
            item,
            title: 'Kaydı Sil',
            message: 'Bu iş detay kaydını silmek istediğinize emin misiniz?'
        })
    }

    const handleConfirmDelete = async () => {
        if (!confirmModal) return

        if (confirmModal.isBulk) {
            const result = await window.electronAPI.deleteBulkWorkItems(confirmModal.ids)
            if (result.success) {
                setConfirmModal(null)
                loadData()
            } else {
                alert('Silme işlemi başarısız: ' + result.error)
            }
        } else {
            const result = await window.electronAPI.deleteWorkItem(confirmModal.item.id)
            if (result.success) {
                setConfirmModal(null)
                loadData()
            } else {
                alert('Silme işlemi başarısız: ' + result.error)
            }
        }
    }

    const handleBulkDelete = (selectedIds) => {
        setConfirmModal({
            isBulk: true,
            ids: selectedIds,
            title: 'Seçili Kayıtları Sil',
            message: `${selectedIds.length} adet iş detay kaydını silmek istediğinize emin misiniz?`
        })
    }

    const handleSavePdf = async () => {
        if (!window.electronAPI?.saveReportPdf) {
            alert('PDF Kaydetme özelliği sadece masaüstü uygulamasında geçerlidir.')
            return
        }

        const sanitizeFileName = (str) => (str || '').replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_\-\s]/g, '').trim().replace(/\s+/g, '_');
        const getWorkMonthLabel = (workObj) => {
            if (workObj?.date) {
                const d = new Date(workObj.date);
                if (!isNaN(d.getTime())) {
                    const m = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
                    return m.charAt(0).toUpperCase() + m.slice(1);
                }
            }
            const now = new Date();
            const m = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
            return m.charAt(0).toUpperCase() + m.slice(1);
        };

        const monthStr = getWorkMonthLabel(work);
        const compStr = work?.company_name || work?.company?.name || '';
        const workNoStr = work?.work_no || work?.title || 'Is_Raporu';

        const defaultFileName = generateUniqueFileName('Is_Raporu', [compStr, workNoStr, monthStr], 'pdf');

        safeSetLocalStorage('printData', JSON.stringify({
            isWorkReport: true,
            work: getCompactWorkData(work, vehicles),
            showPrices: showPrices,
            showWorkTitle: showWorkTitle,
            showKdv: showKdv,
            kdvRate: kdvRate,
            pazarMultiplier: pazarMultiplier,
            mesaiMultiplier: mesaiMultiplier,
            pageBreakMode: pageBreakMode,
            rowsPerPage: rowsPerPage,
            manualBreakIds: manualBreakIds,
            customScale: customScale,
            orientation: orientation,
            tableDensity: tableDensity,
            isPdfSave: true
        }))

        setGeneratingPdf(true)
        try {
            const res = await window.electronAPI.saveReportPdf('/print', { defaultPath: defaultFileName, landscape: orientation === 'landscape' })
            if (res && res.success && !res.isWeb) {
                alert('PDF başarıyla kaydedildi:\n' + res.filePath)
            } else if (res && !res.success && !res.canceled) {
                alert('PDF Kaydedilirken Hata: ' + (res.error || 'Bilinmeyen hata'))
            }
        } catch (err) {
            console.error('PDF Save Error:', err)
            alert('PDF Kaydetme Hatası: ' + err.message)
        } finally {
            setGeneratingPdf(false)
        }
    }

    const handlePrintReport = () => {
        safeSetLocalStorage('printData', JSON.stringify({
            isWorkReport: true,
            work: getCompactWorkData(work, vehicles),
            showPrices: showPrices,
            showWorkTitle: showWorkTitle,
            showKdv: showKdv,
            kdvRate: kdvRate,
            pazarMultiplier: pazarMultiplier,
            mesaiMultiplier: mesaiMultiplier,
            pageBreakMode: pageBreakMode,
            rowsPerPage: rowsPerPage,
            manualBreakIds: manualBreakIds,
            customScale: customScale,
            orientation: orientation,
            tableDensity: tableDensity,
            isPdfSave: false
        }))
        
        const printWin = window.open('#/print', '_blank', 'width=1050,height=800');
        if (!printWin) {
            window.print();
        }
    }

    const handleExportExcel = () => {
        exportWorkToExcel(work, vehicles, {
            showPrices,
            showWorkTitle,
            showKdv,
            kdvRate,
            pazarMultiplier,
            mesaiMultiplier
        });
    }

    const [filteredItems, setFilteredItems] = useState([])
    const [selectedVehicleFilter, setSelectedVehicleFilter] = useState('ALL')

    const availableVehiclesInWork = useMemo(() => {
        if (!work?.items) return []
        const map = new Map()
        work.items.forEach(item => {
            const vehicleKey = item.vehicle_id ? String(item.vehicle_id) : (item.custom_vehicle ? `custom_${item.custom_vehicle}` : 'diger')
            if (!map.has(vehicleKey)) {
                let label = 'Diğer / Ekipman'
                if (item.plate) {
                    label = `${item.plate}${item.model ? ` (${item.model})` : ''}`
                } else if (item.custom_vehicle) {
                    label = item.custom_vehicle
                }
                map.set(vehicleKey, {
                    key: vehicleKey,
                    label: label,
                    count: 0
                })
            }
            map.get(vehicleKey).count += 1
        })
        return Array.from(map.values())
    }, [work?.items])

    const vehicleFilteredItems = useMemo(() => {
        const items = work?.items || []
        if (selectedVehicleFilter === 'ALL') return items
        return items.filter(item => {
            const itemKey = item.vehicle_id ? String(item.vehicle_id) : (item.custom_vehicle ? `custom_${item.custom_vehicle}` : 'diger')
            return itemKey === selectedVehicleFilter
        })
    }, [work?.items, selectedVehicleFilter])

    // Update filtered items when work.items changes
    useEffect(() => {
        if (work?.items) {
            setFilteredItems(work.items)
        }
    }, [work?.items])

    // --- Calculations based on filtered items (shared with PDF report) ---
    const stats = useMemo(() => {
        const items = filteredItems.length > 0 ? filteredItems : (work?.items || [])
        const calc = calculateWorkStats(items, pazarMultiplier, mesaiMultiplier)

        // Date range from filtered items
        let dateRangeText = `${formatDate(work?.start_date)} - ${formatDate(work?.end_date)}`
        if (items.length > 0) {
            const dates = items.filter(item => item.date).map(item => new Date(item.date).getTime())
            if (dates.length > 0) {
                const minDate = new Date(Math.min(...dates))
                const maxDate = new Date(Math.max(...dates))
                dateRangeText = `${formatDate(minDate)} - ${formatDate(maxDate)}`
            }
        }

        const isHourly = items.length > 0 && items.some(item => (item.description || '').toUpperCase().includes('[SAATLİK]') || item.pricingType === 'hourly')

        return { ...calc, dateRangeText, isHourly }
    }, [filteredItems, work, pazarMultiplier, mesaiMultiplier])

    if (loading) return <div className="p-8 text-center">Yükleniyor...</div>
    if (!work) return <div className="p-8 text-center">İş bulunamadı.</div>

    return (
        <div className="page-container">
            {/* Executive Detail Header */}
            <div className="detail-header-card">
                <div className="detail-header-top">
                    <button type="button" className="detail-back-btn" onClick={() => navigate('/works')}>
                        <ArrowLeft size={14} /> İşler & Operasyon
                    </button>
                    <div className="detail-header-top-right">
                        <span className={`badge badge-${getStatusColor(work.status)}`}>
                            {work.status === 'pending' ? 'Bekliyor' :
                                work.status === 'in_progress' ? 'Devam Ediyor' :
                                    work.status === 'completed' ? 'Tamamlandı' : 'İptal'}
                        </span>
                    </div>
                </div>

                <div className="detail-header-main">
                    <div className="detail-header-identity">
                        <div className="detail-avatar-box">
                            <Briefcase size={26} />
                        </div>
                        <div className="detail-title-group">
                            <h1 className="page-title">{work.title}</h1>
                            <div className="detail-chips-row">
                                <span className="detail-chip">
                                    <User size={13} /> 
                                    {work.customer_id ? (
                                        <Link to={`/customers/${work.customer_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                            {work.customer_name || work.customer}
                                        </Link>
                                    ) : (
                                        work.customer_name || work.customer
                                    )}
                                </span>
                                <span className="detail-chip">
                                    <Calendar size={13} /> {stats.dateRangeText}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hero Dashboard Style */}
            <div className="work-hero-container">
                {/* Sol Taraf: Finansal Hero Kart */}
                <div className="stat-card work-hero-card">
                    {/* Arka plan süsü */}
                    <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.05, transform: 'scale(2)', pointerEvents: 'none' }}>
                        <DollarSign size={100} />
                    </div>

                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <DollarSign size={16} className="text-success" />
                            Genel Toplam Tutar
                        </div>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1 }} title={formatCurrency(stats.grandTotal)}>
                            {formatCurrency(stats.grandTotal)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>Tüm mesai, pazar ve ek ödemeler dahil</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '32px', position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={14} className="text-warning" /> Mesai & Pazar
                            </span>
                            <span style={{ fontSize: '14px', color: 'var(--warning)', fontWeight: 700 }}>{formatCurrency(stats.totalMesaiPriceAmount + stats.totalPazarPriceAmount)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Wallet size={14} style={{ color: '#8b5cf6' }} /> Ek Ödemeler
                            </span>
                            <span style={{ fontSize: '14px', color: '#8b5cf6', fontWeight: 700 }}>{formatCurrency(stats.totalEkOdemeler)}</span>
                        </div>
                    </div>
                </div>

                {/* Sağ Taraf: Operasyonel Grid */}
                <div className="work-hero-grid">
                    {/* Toplam Kayıt */}
                    <div className="stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                            <FileText size={14} className="text-info" /> Toplam Kayıt
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.itemCount} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>Adet</span></div>
                    </div>

                    {/* Aktif Araç */}
                    <div className="stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                            <Truck size={14} className="text-info" /> Aktif Araç
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.uniqueVehicles.size} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>Araç</span></div>
                    </div>

                    {/* Personel */}
                    <div className="stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                            <User size={14} className="text-info" /> Personel
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.uniqueEmployees.size} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>Kişi</span></div>
                    </div>

                    {/* Toplam Süre */}
                    <div className="stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                            <Calendar size={14} className="text-success" /> Toplam Süre
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.durationText}</div>
                    </div>

                    {/* Normal Mesai */}
                    <div className="stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                            <Clock size={14} className="text-warning" /> Normal Mesai
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.totalOvertime} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>Saat</span></div>
                    </div>

                    {/* Pazar Mesai */}
                    <div className="stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                            <Calendar size={14} className="text-danger" /> Pazar Mesai
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.totalPazarDayCount} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>Gün</span></div>
                    </div>
                </div>
            </div>

            {/* Items Table Header */}
            <div className="page-header" style={{ marginTop: '24px', marginBottom: '16px' }}>
                <div>
                    <h3 className="page-title">Puantaj Kayıtları</h3>
                </div>
                <div className="page-actions">
                    <button onClick={openBulkAddModal} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                        <Calendar size={16} /> Hızlı Üretim (Toplu Ekle)
                    </button>
                    <button onClick={() => setIsReportModalOpen(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} /> Raporu Görüntüle
                    </button>
                    <button onClick={openAddModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={16} /> Yeni Kayıt
                    </button>
                </div>
            </div>

            <DataTable persistenceKey="WorkDetails_table_0"
                columns={[
                    { 
                        label: 'TARİH', 
                        key: 'date', 
                        render: (val) => {
                            const isPazar = val ? new Date(val).getDay() === 0 : false;
                            return (
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px',
                                    color: isPazar ? 'var(--danger)' : 'inherit',
                                    fontWeight: isPazar ? '600' : 'normal'
                                }}>
                                    <span>{formatDate(val)}</span>
                                    {isPazar && (
                                        <span style={{ 
                                            fontSize: '10px', 
                                            background: 'var(--danger-bg)', 
                                            color: 'var(--danger)', 
                                            padding: '2px 6px', 
                                            borderRadius: '4px',
                                            border: '1px solid rgba(239, 68, 68, 0.2)'
                                        }}>
                                            PAZAR
                                        </span>
                                    )}
                                </div>
                            );
                        }
                    },
                    { label: 'FİŞ NO', key: 'receipt_no' },
                    { label: 'MAKİNA', key: 'vehicle_id', searchValue: (row) => `${row.plate || ''} ${row.custom_vehicle || ''} ${row.brand || ''} ${row.model || ''}`, render: (val, row) => row.plate || row.custom_vehicle || '-' },
                    { label: 'PERSONEL', key: 'employee_id', searchValue: (row) => `${row.employee_name || ''} ${row.employee_surname || ''} ${row.custom_employee || ''}`, render: (val, row) => row.employee_name ? `${row.employee_name} ${row.employee_surname}` : (row.custom_employee || '-') },
                    {
                        label: 'ÇALIŞMA SÜRESİ', key: 'start_time', render: (val, row) => (
                            <div style={{ fontSize: '12px' }}>
                                {row.start_time && row.end_time ? `${row.start_time} - ${row.end_time}` : '-'}
                            </div>
                        )
                    },
                    {
                        label: 'SÜRE', key: 'hours', render: (val, row) => {
                            const descUpper = (row.description || '').toUpperCase();
                            const isHourly = row.pricingType === 'hourly' || descUpper.includes('[SAATLİK]') || row.unit === 'saat';
                            const unitLabel = isHourly ? 'Saat' : 'Gün';
                            const isZero = Number(row.hours) === 0;

                            if (isZero) {
                                const dateObj = new Date(row.date);
                                const isSunday = !isNaN(dateObj.getTime()) && dateObj.getDay() === 0;
                                const isPazar = isSunday || descUpper.includes('PAZAR');
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span style={{ 
                                            fontSize: '11px', 
                                            fontWeight: 600, 
                                            background: isPazar ? 'rgba(234, 88, 12, 0.09)' : 'rgba(239, 68, 68, 0.08)', 
                                            color: isPazar ? '#ea580c' : '#dc2626', 
                                            padding: '2px 8px', 
                                            borderRadius: '12px',
                                            border: `1px solid ${isPazar ? 'rgba(234, 88, 12, 0.22)' : 'rgba(239, 68, 68, 0.2)'}`
                                        }}>
                                            {isPazar ? '0 Gün (Pazar Tatili)' : '0 Gün (Tatil)'}
                                        </span>
                                    </div>
                                );
                            }

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span>{row.hours ?? 0} {unitLabel}</span>
                                </div>
                            );
                        }
                    },
                    {
                        label: 'FAZLA MESAİ', key: 'overtime_hours', render: (val, row) => (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {row.overtime_hours > 0 ? <span className="text-warning">{row.overtime_hours}</span> : '-'}
                            </div>
                        )
                    },
                    {
                        label: 'FİYAT', key: 'unit_price', render: (val, row) => {
                            if (Number(row.hours) === 0 && Number(row.overtime_hours) === 0) return '-';

                            const desc = row.description || '';
                            const kMatch = desc.match(/\[KATSAYI:([^\]]+)\]/);
                            const baseP = Number(row.unit_price) || Number(row.unitPriceVal) || 0;
                            
                            let finalPrice = baseP;
                            let badgeText = null;
                            let isCalculated = false;

                            if (kMatch) {
                                const multVal = parseFloat(kMatch[1]) || 1;
                                finalPrice = multVal === 1 ? baseP : Number((baseP * multVal).toFixed(6));
                                badgeText = multVal !== 1 ? `${multVal}x` : null;
                                isCalculated = multVal !== 1;
                            } else {
                                const dateObj = new Date(row.date);
                                const isSunday = !isNaN(dateObj.getTime()) && dateObj.getDay() === 0;
                                const isPazar = isSunday || desc.toUpperCase().includes('PAZAR');
                                if (isPazar) {
                                    const pazarMult = pazarMultiplier ? parseFloat(pazarMultiplier) : 1.5;
                                    finalPrice = pazarMult === 1 ? baseP : Number((baseP * pazarMult).toFixed(6));
                                    badgeText = pazarMult !== 1 ? `${pazarMult}x` : null;
                                    isCalculated = pazarMult !== 1;
                                }
                            }

                            if (finalPrice <= 0) return '-';

                            return (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <span>{formatCurrency(finalPrice)}</span>
                                    {badgeText && (
                                        <span style={{
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            padding: '1px 5px',
                                            borderRadius: '4px',
                                            background: 'var(--accent-subtle)',
                                            color: 'var(--accent-primary)'
                                        }}>
                                            {badgeText}
                                        </span>
                                    )}
                                </div>
                            );
                        }
                    },
                    { label: 'AÇIKLAMA', key: 'description', render: (val) => <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px', display: 'inline-block' }}>{val}</span> }
                ]}
                data={work.items || []}
                filters={[
                    {
                        key: 'vehicle_filter',
                        label: 'Tüm Araçlar',
                        options: availableVehiclesInWork.map(v => ({
                            value: v.key,
                            label: `${v.label} (${v.count})`
                        })),
                        filterFn: (row, value) => {
                            const itemKey = row.vehicle_id ? String(row.vehicle_id) : (row.custom_vehicle ? `custom_${row.custom_vehicle}` : 'diger');
                            return itemKey === value;
                        }
                    }
                ]}
                showSearch={true}
                showDateFilter={true}
                dateFilterKey="date"
                showRowNumbers={true}
                selectable={true}
                onSelectionChange={setSelectedIds}
                customBulkActions={() => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                        {/* Menü Şeklinde Açılan Çalışma Durumu Seçimi */}
                        <div ref={bulkStatusDropdownRef} style={{ position: 'relative' }}>
                            <button 
                                type="button" 
                                className="btn-bulk-action"
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '6px', 
                                    background: isBulkStatusDropdownOpen ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.12)', 
                                    color: '#fff', 
                                    border: '1px solid rgba(255, 255, 255, 0.25)',
                                    fontWeight: '600',
                                    borderRadius: '20px',
                                    padding: '8px 14px',
                                    cursor: 'pointer'
                                }} 
                                onClick={() => setIsBulkStatusDropdownOpen(prev => !prev)}
                                title="Seçili kayıtların çalışma durumunu toplu olarak belirleyin"
                            >
                                <Briefcase size={14} style={{ color: isBulkStatusDropdownOpen ? '#fff' : 'var(--accent-primary)' }} />
                                <span>Durum Belirle</span>
                                <ChevronDown size={14} style={{ transform: isBulkStatusDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </button>

                            {isBulkStatusDropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: 'calc(100% + 10px)',
                                    left: '0',
                                    background: 'var(--bg-primary, #1e1e24)',
                                    border: '1px solid rgba(255, 255, 255, 0.16)',
                                    borderRadius: '12px',
                                    padding: '6px',
                                    minWidth: '250px',
                                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.65)',
                                    backdropFilter: 'blur(16px)',
                                    WebkitBackdropFilter: 'blur(16px)',
                                    zIndex: 1000,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}>
                                    <div style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        color: 'var(--text-muted, #a1a1aa)',
                                        padding: '6px 10px 4px 10px',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Çalışma Durumu Seçin
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsBulkStatusDropdownOpen(false);
                                            handleBulkSetNormalDays();
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-primary, #fff)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.18)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '6px',
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#10b981',
                                            flexShrink: 0
                                        }}>
                                            <CheckCircle2 size={16} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>Normal Çalışma (1 Gün)</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #a1a1aa)' }}>1 Gün ve standart birim fiyat</div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsBulkStatusDropdownOpen(false);
                                            handleBulkSetZeroDays();
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-primary, #fff)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '6px',
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#ef4444',
                                            flexShrink: 0
                                        }}>
                                            <AlertCircle size={16} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>Çalışılmadı / Tatil (0 Gün)</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #a1a1aa)' }}>0 Gün ve 0 TL tatil kaydı</div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>

                        <button 
                            type="button" 
                            className="btn-bulk-action secondary" 
                            onClick={openBulkEditModal}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            title="Seçili kayıtları toplu düzenleme penceresinde açar"
                        >
                            <Pencil size={14} />
                            Düzenle
                        </button>
                    </div>
                )}
                actions={(row) => (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                        <button className="btn-icon" title="Düzenle" onClick={(e) => { e.stopPropagation(); openEditModal(row) }}><Pencil size={16} /></button>
                        <button className="btn-icon danger" title="Sil" onClick={(e) => { e.stopPropagation(); handleDeleteClick(row) }}><Trash2 size={16} /></button>
                    </div>
                )}
                onBulkDelete={handleBulkDelete}
                onFilteredDataChange={setFilteredItems}
                rowClassName={(row) => {
                    const desc = row.description || '';
                    if (desc.includes('[RENK:red]') || (row.date && new Date(row.date).getDay() === 0)) return 'pazar-row';
                    if (desc.includes('[RENK:orange]')) return 'orange-row';
                    if (desc.includes('[RENK:blue]')) return 'blue-row';
                    if (desc.includes('[RENK:green]')) return 'green-row';
                    if (desc.includes('[RENK:purple]')) return 'purple-row';
                    return '';
                }}
            />

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingItem ? 'Kaydı Düzenle' : 'Yeni Çalışma Kaydı Ekle'}
            >
                <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {modalError && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '14px' }}>{modalError}</div>}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <CustomInput
                            label="Tarih"
                            type="date"
                            value={formData.date}
                            onChange={(val) => setFormData({ ...formData, date: val })}
                            required
                        />
                        <CustomInput
                            label="Fiş No"
                            type="text"
                            value={formData.receiptNo}
                            onChange={(val) => setFormData({ ...formData, receiptNo: val })}
                            maxLength={20}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <CustomSelect
                            label="Araç"
                            value={formData.vehicleId}
                            onChange={(val) => {
                                const stdPrice = getVehicleStandardPrice(val);
                                setFormData(prev => ({
                                    ...prev,
                                    vehicleId: val,
                                    unitPrice: (!prev.unitPrice || parseFloat(prev.unitPrice) === 0) && stdPrice ? stdPrice : prev.unitPrice
                                }));
                            }}
                            options={vehicles.filter(v => v.type !== 'automobile').map(v => ({ value: v.id, label: `${v.plate} - ${v.brand || ''} ${v.model || ''}` }))}
                            creatable={true}
                        />
                        <CustomSelect
                            label="Personel"
                            value={formData.employeeId}
                            onChange={(val) => setFormData({ ...formData, employeeId: val })}
                            options={employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
                            creatable={true}
                        />
                    </div>

                    {/* Çalışma Durumu & Gün Ayarları Butonu (Ayrı Pencere Açıcı) */}
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setIsDaySettingsModalOpen(true)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsDaySettingsModalOpen(true) }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: Number(formData.hours) === 0 
                                ? 'rgba(239, 68, 68, 0.08)' 
                                : (formData.customColor || (formData.multiplier && formData.multiplier !== '1'))
                                    ? 'var(--accent-subtle)'
                                    : 'var(--bg-secondary)',
                            border: '1px solid ' + (Number(formData.hours) === 0 
                                ? 'rgba(239, 68, 68, 0.4)' 
                                : (formData.customColor || (formData.multiplier && formData.multiplier !== '1'))
                                    ? 'var(--accent-primary)'
                                    : 'var(--border-color)'),
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: Number(formData.hours) === 0 ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: Number(formData.hours) === 0 ? '#ef4444' : 'var(--accent-primary)',
                                flexShrink: 0
                            }}>
                                <Sliders size={16} />
                            </div>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    Çalışma Durumu & Gün Ayarları
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {Number(formData.hours) === 0 
                                        ? '⛔ 0 Gün / 0 TL (Tatil) işaretlendi • Değiştirmek için tıkla' 
                                        : '🟢 Normal Çalışma (1 Gün) • Katsayı, renk veya tatil ayarları'}
                                </div>
                            </div>
                        </div>

                        {/* Canlı Rozetler ve Ayarla Butonu */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '12px',
                                background: Number(formData.hours) === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: Number(formData.hours) === 0 ? '#ef4444' : '#10b981',
                                border: `1px solid ${Number(formData.hours) === 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                            }}>
                                {Number(formData.hours) === 0 ? '⛔ 0 Gün' : '🟢 1 Gün'}
                            </span>

                            {formData.multiplier && formData.multiplier !== '1' && (
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    color: '#3b82f6',
                                    border: '1px solid rgba(59, 130, 246, 0.3)'
                                }}>
                                    ⚡ {formData.multiplier}x
                                </span>
                            )}

                            {formData.customColor && (
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    background: formData.customColor === 'red' ? 'rgba(239, 68, 68, 0.15)'
                                        : formData.customColor === 'orange' ? 'rgba(249, 115, 22, 0.15)'
                                        : formData.customColor === 'blue' ? 'rgba(59, 130, 246, 0.15)'
                                        : formData.customColor === 'green' ? 'rgba(16, 185, 129, 0.15)'
                                        : 'rgba(168, 85, 247, 0.15)',
                                    color: formData.customColor === 'red' ? '#ef4444'
                                        : formData.customColor === 'orange' ? '#f97316'
                                        : formData.customColor === 'blue' ? '#3b82f6'
                                        : formData.customColor === 'green' ? '#10b981'
                                        : '#a855f7',
                                    border: '1px solid currentColor'
                                }}>
                                    ● {WORK_COLOR_OPTIONS.find(c => c.id === formData.customColor)?.label || formData.customColor}
                                </span>
                            )}

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11px',
                                color: 'var(--accent-primary)',
                                fontWeight: 700,
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'var(--accent-subtle)',
                                marginLeft: '2px'
                            }}>
                                <span>Ayarla</span>
                                <ChevronRight size={13} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <CustomInput
                                type="time"
                                label="Başlangıç Saati"
                                value={formData.startTime}
                                onChange={(val) => setFormData({ ...formData, startTime: val, _manualHours: false, _manualOvertime: false })}
                            />
                            <CustomInput
                                type="time"
                                label="Bitiş Saati"
                                value={formData.endTime}
                                onChange={(val) => setFormData({ ...formData, endTime: val, _manualHours: false, _manualOvertime: false })}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <CustomSelect
                                label="Fiyatlandırma"
                                value={formData.pricingType}
                                onChange={(val) => setFormData({ ...formData, pricingType: val })}
                                options={[
                                    { value: 'daily', label: 'Günlük' },
                                    { value: 'hourly', label: 'Saatlik' },
                                    { value: 'monthly', label: 'Aylık' }
                                ]}
                            />
                            <CustomInput
                                label={formData.pricingType === 'monthly' ? "Günlük Birim Fiyat" : (formData.pricingType === 'hourly' ? "Saatlik Birim Fiyat" : "Birim Fiyat")}
                                format="currency"
                                maxDecimals={6}
                                maxLength={18}
                                value={formData.unitPrice}
                                onChange={(val) => setFormData({ ...formData, unitPrice: val })}
                            />
                        </div>
                    </div>

                    {/* Çalışma Süresi & Mesai */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '10px 12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={15} style={{ color: 'var(--accent-primary)' }} />
                                Çalışma Süresi & Mesai
                            </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <CustomInput
                                type="number"
                                step="any"
                                min={0}
                                label={formData.pricingType === 'hourly' ? "Çalışma Süresi (Saat)" : "Çalışma Süresi (Gün Sayısı)"}
                                value={formData.hours ?? 0}
                                onChange={(val) => setFormData({ ...formData, hours: val === '' ? '' : parseFloat(val), _manualHours: true })}
                            />
                            <CustomInput
                                type="number"
                                step="any"
                                min={0}
                                label="Fazla Mesai (Saat)"
                                value={formData.overtimeHours ?? 0}
                                onChange={(val) => setFormData({ ...formData, overtimeHours: val === '' ? '' : parseFloat(val), _manualOvertime: true })}
                            />
                        </div>
                    </div>

                    {/* Yol (Travel) Add-on */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '10px 12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Wallet size={15} style={{ color: 'var(--accent-primary)' }} /> Ek Ödemeler
                            </span>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: 'var(--accent-primary)',
                                background: 'var(--accent-subtle)',
                                border: '1px solid var(--accent-primary)',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-full)',
                                display: 'inline-flex',
                                alignItems: 'center'
                            }}>
                                Toplam: {formatCurrency(Math.round((formData.additions || []).reduce((sum, add) => sum + (parseFloat(add.price) || 0), 0)))}
                            </span>
                        </div>

                        {/* Quick Selection Tags */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '0 0 2px 0' }}>
                            {['Yol', 'Yemek', 'Mesai', 'Prim', 'Avans', 'Diğer'].map(type => {
                                const isActive = curAdditionType === type;
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => {
                                            setCurAdditionType(type);
                                            if (curAdditionPrice && parseFloat(curAdditionPrice) > 0) {
                                                setFormData({
                                                    ...formData,
                                                    additions: [...(formData.additions || []), { type, price: parseFloat(curAdditionPrice) || 0 }]
                                                });
                                                setCurAdditionPrice('');
                                            }
                                        }}
                                        style={{
                                            padding: '4px 10px',
                                            fontSize: '11px',
                                            borderRadius: 'var(--radius-full)',
                                            border: '1px solid ' + (isActive ? 'var(--accent-primary)' : 'var(--border-color)'),
                                            background: isActive ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                            color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            fontWeight: isActive ? '600' : '500',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {type}
                                    </button>
                                );
                            })}
                        </div>
                        
                        {/* List of current additions as Clean Chips inside a scrollable box */}
                        <div style={{ 
                            height: '42px', 
                            overflowX: 'auto', 
                            overflowY: 'hidden',
                            border: '1px solid var(--border-color)', 
                            borderRadius: 'var(--radius-sm)', 
                            background: 'var(--bg-primary)', 
                            padding: '0 8px',
                            display: 'flex',
                            flexWrap: 'nowrap',
                            alignItems: 'center',
                            justifyContent: (formData.additions && formData.additions.length > 3) ? 'flex-start' : 'center',
                            gap: '6px',
                            width: '100%'
                        }}>
                            {formData.additions && formData.additions.length > 0 ? (
                                formData.additions.map((add, idx) => (
                                    <div key={idx} style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px',
                                        background: 'var(--bg-secondary)', 
                                        padding: '4px 10px', 
                                        borderRadius: 'var(--radius-full)', 
                                        border: '1px solid var(--border-color)',
                                        fontSize: '11px',
                                        color: 'var(--text-primary)',
                                        height: '24px'
                                    }}>
                                        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{add.type}</span>
                                        <span style={{ fontWeight: 700, color: 'var(--accent-primary)', marginLeft: '2px' }}>{formatCurrency(add.price)}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const newList = [...formData.additions];
                                                newList.splice(idx, 1);
                                                setFormData({ ...formData, additions: newList });
                                            }}
                                            style={{ 
                                                border: 'none', 
                                                background: 'transparent', 
                                                color: 'var(--text-muted)', 
                                                cursor: 'pointer', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                padding: '2px',
                                                marginLeft: '4px',
                                                borderRadius: '50%',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.color = 'var(--text-error)';
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.color = 'var(--text-muted)';
                                                e.currentTarget.style.background = 'transparent';
                                            }}
                                        >
                                            <Plus size={12} style={{ transform: 'rotate(45deg)' }} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div style={{ 
                                    fontSize: '11px', 
                                    color: 'var(--text-muted)', 
                                    width: '100%', 
                                    height: '100%', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center' 
                                }}>
                                    Ek ödeme bulunmuyor.
                                </div>
                            )}
                        </div>

                        {/* Modern Input Group for adding new addition using CustomInput */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', width: '100%', marginTop: '0' }}>
                            <div style={{ flex: 1 }}>
                                <CustomInput
                                    label="Ek Ödeme Türü"
                                    value={curAdditionType}
                                    onChange={(val) => setCurAdditionType(val)}
                                    placeholder="Tür (Örn: Yol, Yemek)"
                                    className="mb-0"
                                    maxLength={50}
                                />
                            </div>
                            <div style={{ width: '120px' }}>
                                <CustomInput
                                    label="Fiyat ₺"
                                    format="currency"
                                    maxDecimals={6}
                                    maxLength={18}
                                    value={curAdditionPrice}
                                    onChange={(val) => setCurAdditionPrice(val)}
                                    placeholder="0,00"
                                    className="mb-0"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!curAdditionType) return;
                                    const addPrice = parseFloat(curAdditionPrice) || 0;
                                    setFormData({
                                        ...formData,
                                        additions: [...(formData.additions || []), { type: curAdditionType, price: addPrice }]
                                    });
                                    setCurAdditionType('Yol');
                                    setCurAdditionPrice('');
                                }}
                                className="btn btn-primary"
                                style={{
                                    height: '40px',
                                    padding: '0 16px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: '600',
                                    fontSize: '13px',
                                    borderRadius: 'var(--radius-sm)'
                                }}
                            >
                                <Plus size={16} /> Ekle
                            </button>
                        </div>
                    </div>

                    <CustomInput
                        label="Açıklama"
                        type="text"
                        value={formData.description}
                        onChange={(val) => setFormData({ ...formData, description: val })}
                        maxLength={250}
                    />

                    <div className="modal-footer">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">İptal</button>
                        <button type="submit" className="btn btn-primary">{editingItem ? 'Güncelle' : 'Ekle'}</button>
                    </div>
                </form>
            </Modal>

            {/* Özel Ayarlar Penceresi: Çalışma Durumu, Gün Rengi & Manuel Katsayı */}
            <Modal
                isOpen={isDaySettingsModalOpen}
                onClose={() => setIsDaySettingsModalOpen(false)}
                title="Çalışma Durumu & Özel Gün Ayarları"
                size="md"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* 1. Bölüm: Çalışma Durumu */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Briefcase size={15} style={{ color: 'var(--accent-primary)' }} />
                            1. Çalışma Durumu (Puantaj & Gün Hesabı)
                        </label>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                            Bu günün puantaj kaydında çalışılmış (1 gün) veya tatil/çalışılmadı (0 gün) sayılacağını belirleyin:
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                            {/* 🟢 Normal Çalışma */}
                            <button
                                type="button"
                                onClick={() => {
                                    const stdPrice = getVehicleStandardPrice(formData.vehicleId);
                                    const restoredPrice = (formData._savedUnitPrice && parseFloat(formData._savedUnitPrice) > 0)
                                        ? formData._savedUnitPrice
                                        : (formData.unitPrice && parseFloat(formData.unitPrice) > 0 ? formData.unitPrice : (stdPrice || ''));
                                    setFormData(prev => ({
                                        ...prev,
                                        startTime: prev.startTime || work?.work_start_time || '08:00',
                                        endTime: prev.endTime || work?.work_end_time || '17:00',
                                        hours: 1,
                                        overtimeHours: 0,
                                        unitPrice: restoredPrice,
                                        _savedUnitPrice: undefined,
                                        description: (prev.description || '')
                                            .replace(/\[TATİL\]\s*/gi, '')
                                            .replace(/\[ÇALIŞILMADI\]\s*/gi, '')
                                            .replace(/\[PAZAR TATİLİ\]\s*/gi, '')
                                            .trim(),
                                        _manualHours: false,
                                        _manualOvertime: false
                                    }));
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    padding: '10px 12px',
                                    borderRadius: 'var(--radius-md)',
                                    border: Number(formData.hours) > 0 ? '2px solid #10b981' : '1px solid var(--border-color)',
                                    background: Number(formData.hours) > 0 ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-tertiary)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px', color: Number(formData.hours) > 0 ? '#10b981' : 'var(--text-primary)' }}>
                                    <CheckCircle2 size={16} />
                                    Normal Çalışma (1 Gün)
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Standart saatler ve araç birim fiyatı geçerli olur.
                                </div>
                            </button>

                            {/* ⛔ Çalışılmadı / Tatil */}
                            <button
                                type="button"
                                onClick={() => {
                                    setFormData(prev => ({
                                        ...prev,
                                        _savedUnitPrice: prev.unitPrice && parseFloat(prev.unitPrice) > 0 ? prev.unitPrice : prev._savedUnitPrice,
                                        startTime: '',
                                        endTime: '',
                                        hours: 0,
                                        overtimeHours: 0,
                                        unitPrice: 0,
                                        _manualHours: true,
                                        _manualOvertime: true,
                                        description: (prev.description || '').includes('TATİL') || (prev.description || '').includes('ÇALIŞILMADI') || (prev.description || '').includes('PAZAR TATİLİ')
                                            ? prev.description 
                                            : `[TATİL] ${prev.description || ''}`.trim()
                                    }));
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    padding: '10px 12px',
                                    borderRadius: 'var(--radius-md)',
                                    border: Number(formData.hours) === 0 ? '2px solid #ef4444' : '1px solid var(--border-color)',
                                    background: Number(formData.hours) === 0 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-tertiary)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px', color: Number(formData.hours) === 0 ? '#ef4444' : 'var(--text-primary)' }}>
                                    <AlertCircle size={16} />
                                    Çalışılmadı / Tatil (0 Gün)
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Puantajda 0 gün ve 0 TL yazılır, [TATİL] eklenir.
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* 2. Bölüm: Manuel Katsayı */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Layers size={15} style={{ color: 'var(--accent-primary)' }} />
                                2. Manuel Katsayı (Birim Fiyat Çarpanı)
                            </label>
                            {formData.multiplier && formData.multiplier !== '1' && (
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, multiplier: '1' }))}
                                    style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Standarta Sıfırla (1x)
                                </button>
                            )}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                            Normal birim fiyat üzerine uygulanacak çarpan oranını seçin:
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                            {[
                                { id: '1', label: '1x (Standart)' },
                                { id: '1.25', label: '1.25x (%25 Zammı)' },
                                { id: '1.5', label: '1.5x (Mesaili / Pazar)' },
                                { id: '2', label: '2x (Çift Mesai / Bayram)' },
                                { id: '2.5', label: '2.5x' },
                                { id: '3', label: '3x' }
                            ].map(mult => {
                                const isSelected = String(formData.multiplier || '1') === mult.id;
                                return (
                                    <button
                                        key={mult.id}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, multiplier: mult.id }))}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '16px',
                                            fontSize: '12px',
                                            fontWeight: isSelected ? 700 : 500,
                                            cursor: 'pointer',
                                            border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                            background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {mult.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Custom Multiplier Input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Farklı Katsayı:</span>
                            <div style={{ width: '90px' }}>
                                <CustomInput
                                    type="number"
                                    step="0.05"
                                    min="0.1"
                                    max="10"
                                    value={formData.multiplier || '1'}
                                    onChange={(val) => setFormData(prev => ({ ...prev, multiplier: val }))}
                                    className="mb-0"
                                />
                            </div>
                            {parseFloat(formData.multiplier) > 0 && parseFloat(formData.multiplier) !== 1 && (
                                <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    Etkili Birim: {formatCurrency(Math.round((parseFloat(formData.unitPrice) || 0) * parseFloat(formData.multiplier)))}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 3. Bölüm: Gün Rengi / Satır Vurgusu */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Tag size={15} style={{ color: 'var(--accent-primary)' }} />
                                3. Gün Rengi (Tablo & PDF Satır Vurgusu)
                            </label>
                            {formData.customColor && (
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, customColor: '' }))}
                                    style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Rengi Kaldır (Standart)
                                </button>
                            )}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                            Tabloda ve raporda bu günün satırına uygulanacak rengi seçin:
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
                            {WORK_COLOR_OPTIONS.map(col => {
                                const isSelected = (formData.customColor || '') === col.id;
                                return (
                                    <button
                                        key={col.id}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, customColor: col.id }))}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 10px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: isSelected ? (col.id ? `2px solid ${col.color}` : '2px solid var(--accent-primary)') : '1px solid var(--border-color)',
                                            background: isSelected ? (col.bg || 'var(--accent-subtle)') : 'var(--bg-tertiary)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {col.id ? (
                                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                                        ) : (
                                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px dashed var(--text-muted)', flexShrink: 0 }} />
                                        )}
                                        <div>
                                            <div style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 600, color: isSelected ? (col.id ? col.color : 'var(--accent-primary)') : 'var(--text-primary)' }}>
                                                {col.label}
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{col.desc}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 4. Bölüm: Canlı Tablo Önizlemesi */}
                    <div style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        background: formData.customColor === 'red' ? 'rgba(239, 68, 68, 0.1)'
                            : formData.customColor === 'orange' ? 'rgba(249, 115, 22, 0.1)'
                            : formData.customColor === 'blue' ? 'rgba(59, 130, 246, 0.1)'
                            : formData.customColor === 'green' ? 'rgba(16, 185, 129, 0.1)'
                            : formData.customColor === 'purple' ? 'rgba(168, 85, 247, 0.1)'
                            : 'var(--bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Tablo Görünümü:</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formData.date || 'Seçili Tarih'}</span>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '8px',
                                background: Number(formData.hours) === 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                color: Number(formData.hours) === 0 ? '#ef4444' : '#10b981'
                            }}>
                                {Number(formData.hours) === 0 ? '0 Gün (Tatil)' : '1 Gün'}
                            </span>
                            {formData.multiplier && formData.multiplier !== '1' && (
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '8px',
                                    background: 'rgba(59, 130, 246, 0.2)',
                                    color: '#3b82f6'
                                }}>
                                    {formData.multiplier}x
                                </span>
                            )}
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                            {Number(formData.hours) === 0 ? '0,00 ₺' : formatCurrency(Math.round((parseFloat(formData.unitPrice) || 0) * (parseFloat(formData.multiplier) || 1)))}
                        </div>
                    </div>

                    <div className="modal-footer" style={{ marginTop: '4px', padding: 0 }}>
                        <button
                            type="button"
                            onClick={() => setIsDaySettingsModalOpen(false)}
                            className="btn btn-primary"
                            style={{ width: '100%', height: '42px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            <Check size={16} /> Ayarları Uygula ve Kapat
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Bulk Add Modal */}
            <Modal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                title="Hızlı Üretim (Toplu Kayıt Ekle)"
            >
                <form onSubmit={handleBulkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {modalError && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '14px' }}>{modalError}</div>}

                    <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        Seçtiğiniz <strong>Başlangıç</strong> ve <strong>Bitiş</strong> tarihi aralığındaki her bir gün için ayrı bir puantaj kaydı oluşturulacaktır.<br />
                        <em>İpucu: Pazar günlerini aşağıdan "Çalışılmadı (0 Gün - 0 TL)" olarak seçebilir veya puantaj tablosundan istediğiniz günleri tek tıkla 0 gün yapabilirsiniz.</em>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <CustomInput
                            label="Başlangıç Tarihi"
                            type="date"
                            value={bulkFormData.startDate}
                            onChange={(val) => {
                                const updates = { startDate: val };
                                if (bulkFormData.pricingType === 'monthly') {
                                    const d = new Date(val);
                                    d.setDate(d.getDate() + 29);
                                    updates.endDate = d.toISOString().split('T')[0];
                                }
                                setBulkFormData({ ...bulkFormData, ...updates });
                            }}
                            required
                        />
                        <CustomInput
                            label="Bitiş Tarihi"
                            type="date"
                            value={bulkFormData.endDate}
                            onChange={(val) => setBulkFormData({ ...bulkFormData, endDate: val })}
                            required
                        />
                        <CustomInput
                            label="Fiş No"
                            type="text"
                            value={bulkFormData.receiptNo}
                            onChange={(val) => setBulkFormData({ ...bulkFormData, receiptNo: val })}
                            maxLength={20}
                        />
                    </div>

                    {/* Pazar Günleri Ayarı */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        padding: '10px 12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={15} style={{ color: 'var(--danger)' }} />
                            Pazar Günleri İşlemi
                        </label>
                        <CustomSelect
                            value={bulkFormData.sundayAction || 'zero'}
                            onChange={(val) => setBulkFormData({ ...bulkFormData, sundayAction: val })}
                            options={[
                                { value: 'zero', label: '⛔ Pazar Günlerini Çalışılmadı Olarak Ekle (0 Gün - 0 TL)' },
                                { value: 'skip', label: '⏭️ Pazar Günlerini Atla (Puantaja Hiç Ekleme)' },
                                { value: 'work', label: '💼 Normal Çalışma Olarak Ekle' }
                            ]}
                        />
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {bulkFormData.sundayAction === 'zero' && 'Pazar günleri puantajda 0 Gün ve 0 TL olarak listelenir, silmeye gerek kalmaz ve resmi olarak belgelenir.'}
                            {bulkFormData.sundayAction === 'skip' && 'Pazar günleri puantaj tablosuna hiç yazılmaz, sadece iş günleri eklenir.'}
                            {bulkFormData.sundayAction === 'work' && 'Pazar günleri normal çalışma gibi (1 gün ve pazar katsayısı ile) hesaplanarak eklenir.'}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <CustomSelect
                            label="Araç"
                            value={bulkFormData.vehicleId}
                            onChange={(val) => setBulkFormData({ ...bulkFormData, vehicleId: val })}
                            options={vehicles.filter(v => v.type !== 'automobile').map(v => ({ value: v.id, label: `${v.plate} - ${v.brand || ''} ${v.model || ''}` }))}
                            creatable={true}
                        />
                        <CustomSelect
                            label="Personel"
                            value={bulkFormData.employeeId}
                            onChange={(val) => setBulkFormData({ ...bulkFormData, employeeId: val })}
                            options={employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
                            creatable={true}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <CustomInput
                                type="time"
                                label="Başlangıç Saati"
                                value={bulkFormData.startTime}
                                onChange={(val) => setBulkFormData({ ...bulkFormData, startTime: val, _manualHours: false, _manualOvertime: false })}
                            />
                            <CustomInput
                                type="time"
                                label="Bitiş Saati"
                                value={bulkFormData.endTime}
                                onChange={(val) => setBulkFormData({ ...bulkFormData, endTime: val, _manualHours: false, _manualOvertime: false })}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <CustomSelect
                                label="Fiyatlandırma"
                                value={bulkFormData.pricingType}
                                onChange={(val) => {
                                    const updates = { pricingType: val };
                                    if (val === 'monthly') {
                                        const d = new Date(bulkFormData.startDate);
                                        d.setDate(d.getDate() + 29);
                                        updates.endDate = d.toISOString().split('T')[0];
                                    }
                                    setBulkFormData({ ...bulkFormData, ...updates });
                                }}
                                options={[
                                    { value: 'daily', label: 'Günlük' },
                                    { value: 'monthly', label: 'Aylık' }
                                ]}
                            />
                            {bulkFormData.pricingType === 'monthly' ? (
                                <CustomInput
                                    label="Aylık Tutar"
                                    format="currency"
                                    maxDecimals={6}
                                    maxLength={18}
                                    value={bulkFormData.monthlyPrice}
                                    onChange={(val) => setBulkFormData({ ...bulkFormData, monthlyPrice: val })}
                                />
                            ) : (
                                <CustomInput
                                    label="Birim Fiyat"
                                    format="currency"
                                    maxDecimals={6}
                                    maxLength={18}
                                    value={bulkFormData.unitPrice}
                                    onChange={(val) => setBulkFormData({ ...bulkFormData, unitPrice: val })}
                                />
                            )}
                        </div>
                    </div>

                    {/* Çalışma Süresi & Fazla Mesai Saati */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <CustomInput
                            type="number"
                            step="any"
                            min={0}
                            label={bulkFormData.pricingType === 'hourly' ? "Çalışma Süresi (Saat)" : "Çalışma Süresi (Gün Sayısı)"}
                            value={bulkFormData.hours ?? 1}
                            onChange={(val) => setBulkFormData({ ...bulkFormData, hours: val === '' ? '' : parseFloat(val), _manualHours: true })}
                        />
                        <CustomInput
                            type="number"
                            step="any"
                            min={0}
                            label="Fazla Mesai (Saat)"
                            value={bulkFormData.overtimeHours ?? 0}
                            onChange={(val) => setBulkFormData({ ...bulkFormData, overtimeHours: val === '' ? '' : parseFloat(val), _manualOvertime: true })}
                        />
                    </div>

                    {/* Yol (Travel) Add-on Replaced with Dynamic Additions */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '10px 12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Wallet size={15} style={{ color: 'var(--accent-primary)' }} /> Ek Ödemeler
                            </span>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: 'var(--accent-primary)',
                                background: 'var(--accent-subtle)',
                                border: '1px solid var(--accent-primary)',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-full)',
                                display: 'inline-flex',
                                alignItems: 'center'
                            }}>
                                Toplam: {formatCurrency(Math.round((bulkFormData.additions || []).reduce((sum, add) => sum + (parseFloat(add.price) || 0), 0)))}
                            </span>
                        </div>

                        {/* Quick Selection Tags */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '0 0 2px 0' }}>
                            {['Yol', 'Yemek', 'Mesai', 'Prim', 'Avans', 'Diğer'].map(type => {
                                const isActive = curBulkAdditionType === type;
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => {
                                            setCurBulkAdditionType(type);
                                            if (curBulkAdditionPrice && parseFloat(curBulkAdditionPrice) > 0) {
                                                setBulkFormData({
                                                    ...bulkFormData,
                                                    additions: [...(bulkFormData.additions || []), { type, price: parseFloat(curBulkAdditionPrice) || 0 }]
                                                });
                                                setCurBulkAdditionPrice('');
                                            }
                                        }}
                                        style={{
                                            padding: '4px 10px',
                                            fontSize: '11px',
                                            borderRadius: 'var(--radius-full)',
                                            border: '1px solid ' + (isActive ? 'var(--accent-primary)' : 'var(--border-color)'),
                                            background: isActive ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                            color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            fontWeight: isActive ? '600' : '500',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {type}
                                    </button>
                                );
                            })}
                        </div>
                        
                        {/* List of current additions as Clean Chips inside a scrollable box */}
                        <div style={{ 
                            height: '42px', 
                            overflowX: 'auto', 
                            overflowY: 'hidden',
                            border: '1px solid var(--border-color)', 
                            borderRadius: 'var(--radius-sm)', 
                            background: 'var(--bg-primary)', 
                            padding: '0 8px',
                            display: 'flex',
                            flexWrap: 'nowrap',
                            alignItems: 'center',
                            justifyContent: (bulkFormData.additions && bulkFormData.additions.length > 3) ? 'flex-start' : 'center',
                            gap: '6px',
                            width: '100%'
                        }}>
                            {bulkFormData.additions && bulkFormData.additions.length > 0 ? (
                                bulkFormData.additions.map((add, idx) => (
                                    <div key={idx} style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px',
                                        background: 'var(--bg-secondary)', 
                                        padding: '4px 10px', 
                                        borderRadius: 'var(--radius-full)', 
                                        border: '1px solid var(--border-color)',
                                        fontSize: '11px',
                                        color: 'var(--text-primary)',
                                        height: '24px'
                                    }}>
                                        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{add.type}</span>
                                        <span style={{ fontWeight: 700, color: 'var(--accent-primary)', marginLeft: '2px' }}>{formatCurrency(add.price)}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const newList = [...bulkFormData.additions];
                                                newList.splice(idx, 1);
                                                setBulkFormData({ ...bulkFormData, additions: newList });
                                            }}
                                            style={{ 
                                                border: 'none', 
                                                background: 'transparent', 
                                                color: 'var(--text-muted)', 
                                                cursor: 'pointer', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                padding: '2px',
                                                marginLeft: '4px',
                                                borderRadius: '50%',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.color = 'var(--text-error)';
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.color = 'var(--text-muted)';
                                                e.currentTarget.style.background = 'transparent';
                                            }}
                                        >
                                            <Plus size={12} style={{ transform: 'rotate(45deg)' }} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div style={{ 
                                    fontSize: '11px', 
                                    color: 'var(--text-muted)', 
                                    width: '100%', 
                                    height: '100%', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center' 
                                }}>
                                    Ek ödeme bulunmuyor.
                                </div>
                            )}
                        </div>

                        {/* Modern Input Group for adding new addition using CustomInput */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', width: '100%', marginTop: '0' }}>
                            <div style={{ flex: 1 }}>
                                <CustomInput
                                    label="Ek Ödeme Türü"
                                    value={curBulkAdditionType}
                                    onChange={(val) => setCurBulkAdditionType(val)}
                                    placeholder="Tür (Örn: Yol, Yemek)"
                                    maxLength={50}
                                    className="mb-0"
                                />
                            </div>
                            <div style={{ width: '120px' }}>
                                <CustomInput
                                    label="Fiyat ₺"
                                    format="currency"
                                    maxDecimals={6}
                                    maxLength={18}
                                    value={curBulkAdditionPrice}
                                    onChange={(val) => setCurBulkAdditionPrice(val)}
                                    placeholder="0,00"
                                    className="mb-0"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!curBulkAdditionType) return;
                                    const addPrice = parseFloat(curBulkAdditionPrice) || 0;
                                    setBulkFormData({
                                        ...bulkFormData,
                                        additions: [...(bulkFormData.additions || []), { type: curBulkAdditionType, price: addPrice }]
                                    });
                                    setCurBulkAdditionType('Yol');
                                    setCurBulkAdditionPrice('');
                                }}
                                className="btn btn-primary"
                                style={{
                                    height: '40px',
                                    padding: '0 16px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: '600',
                                    fontSize: '13px',
                                    borderRadius: 'var(--radius-sm)'
                                }}
                            >
                                <Plus size={16} /> Ekle
                            </button>
                        </div>
                    </div>

                    <CustomInput
                        label="Ortak Açıklama"
                        type="text"
                        value={bulkFormData.description}
                        onChange={(val) => setBulkFormData({ ...bulkFormData, description: val })}
                        maxLength={250}
                    />

                    <div className="modal-footer">
                        <button type="button" onClick={() => setIsBulkModalOpen(false)} className="btn btn-secondary">İptal</button>
                        <button type="submit" className="btn btn-primary">Toplu Oluştur</button>
                    </div>
                </form>
            </Modal>

            {/* Bulk Edit Modal */}
            <Modal
                isOpen={isBulkEditModalOpen}
                onClose={() => setIsBulkEditModalOpen(false)}
                title={`Toplu Düzenle (${selectedIds.length} Kayıt)`}
            >
                <form onSubmit={handleBulkEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {modalError && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '14px' }}>{modalError}</div>}

                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Boş bıraktığınız alanlar mevcut kayıtlarda değiştirilmeyecektir.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <CustomInput
                            label="Tarih"
                            type="date"
                            value={bulkEditFormData.date}
                            onChange={(val) => setBulkEditFormData({ ...bulkEditFormData, date: val })}
                        />
                        <CustomInput
                            label="Fiş No"
                            type="text"
                            value={bulkEditFormData.receiptNo}
                            onChange={(val) => setBulkEditFormData({ ...bulkEditFormData, receiptNo: val })}
                            maxLength={20}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <CustomSelect
                            label="Makina / Araç"
                            value={bulkEditFormData.vehicleId}
                            onChange={(val) => setBulkEditFormData({ ...bulkEditFormData, vehicleId: val })}
                            options={[
                                { value: '', label: 'Değiştirme (Mevcut kalsın)' },
                                ...vehicles.map(v => ({ value: v.id, label: `${v.plate} (${v.brand})` }))
                            ]}
                            creatable={true}
                        />
                        <CustomSelect
                            label="Personel"
                            value={bulkEditFormData.employeeId}
                            onChange={(val) => setBulkEditFormData({ ...bulkEditFormData, employeeId: val })}
                            options={[
                                { value: '', label: 'Değiştirme (Mevcut kalsın)' },
                                ...employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))
                            ]}
                            creatable={true}
                        />
                    </div>

                    {/* Toplu Çalışma Durumu & Gün Ayarları Butonu (Ayrı Pencere Açıcı) */}
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setIsBulkDaySettingsModalOpen(true)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsBulkDaySettingsModalOpen(true) }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: (bulkEditFormData.workStatus || bulkEditFormData.customColor || bulkEditFormData.multiplier) ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                            border: '1px solid ' + ((bulkEditFormData.workStatus || bulkEditFormData.customColor || bulkEditFormData.multiplier) ? 'var(--accent-primary)' : 'var(--border-color)'),
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--accent-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Sliders size={16} />
                            </div>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    Toplu Çalışma Durumu, Renk & Katsayı Ayarları
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    Seçili {(selectedIds || []).length} kayıt için durum, katsayı ve renk belirleyin
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {bulkEditFormData.workStatus ? (
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    background: bulkEditFormData.workStatus === 'zero' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                    color: bulkEditFormData.workStatus === 'zero' ? '#ef4444' : '#10b981',
                                    border: `1px solid ${bulkEditFormData.workStatus === 'zero' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                                }}>
                                    {bulkEditFormData.workStatus === 'zero' ? '⛔ 0 Gün (Tatil)' : '🟢 1 Gün (Normal)'}
                                </span>
                            ) : null}

                            {bulkEditFormData.multiplier ? (
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    color: '#3b82f6',
                                    border: '1px solid rgba(59, 130, 246, 0.3)'
                                }}>
                                    ⚡ {bulkEditFormData.multiplier}x
                                </span>
                            ) : null}

                            {bulkEditFormData.customColor ? (
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    background: bulkEditFormData.customColor === 'none' ? 'var(--bg-tertiary)'
                                        : bulkEditFormData.customColor === 'red' ? 'rgba(239, 68, 68, 0.15)'
                                        : bulkEditFormData.customColor === 'orange' ? 'rgba(249, 115, 22, 0.15)'
                                        : bulkEditFormData.customColor === 'blue' ? 'rgba(59, 130, 246, 0.15)'
                                        : bulkEditFormData.customColor === 'green' ? 'rgba(16, 185, 129, 0.15)'
                                        : 'rgba(168, 85, 247, 0.15)',
                                    color: bulkEditFormData.customColor === 'none' ? 'var(--text-muted)'
                                        : bulkEditFormData.customColor === 'red' ? '#ef4444'
                                        : bulkEditFormData.customColor === 'orange' ? '#f97316'
                                        : bulkEditFormData.customColor === 'blue' ? '#3b82f6'
                                        : bulkEditFormData.customColor === 'green' ? '#10b981'
                                        : '#a855f7',
                                    border: '1px solid currentColor'
                                }}>
                                    ● {bulkEditFormData.customColor === 'none' ? 'Renk Kaldır' : (WORK_COLOR_OPTIONS.find(c => c.id === bulkEditFormData.customColor)?.label || bulkEditFormData.customColor)}
                                </span>
                            ) : null}

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11px',
                                color: 'var(--accent-primary)',
                                fontWeight: 700,
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'var(--accent-subtle)',
                                marginLeft: '2px'
                            }}>
                                <span>Ayarla</span>
                                <ChevronRight size={13} />
                            </div>
                        </div>
                    </div>

                    {/* Çalışma Saatleri (Başlangıç - Bitiş) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <CustomInput
                            type="time"
                            label="Başlangıç Saati"
                            value={bulkEditFormData.startTime}
                            onChange={(val) => setBulkEditFormData({ ...bulkEditFormData, startTime: val, _manualHours: false, _manualOvertime: false })}
                        />
                        <CustomInput
                            type="time"
                            label="Bitiş Saati"
                            value={bulkEditFormData.endTime}
                            onChange={(val) => setBulkEditFormData({ ...bulkEditFormData, endTime: val, _manualHours: false, _manualOvertime: false })}
                        />
                    </div>

                    {/* Süre / Gün & Fazla Mesai Saati */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <CustomInput
                            type="number"
                            step="any"
                            min={0}
                            label="Çalışma Saati / Gün Sayısı"
                            placeholder="Değiştirme (Boş bırakılabilir)"
                            value={bulkEditFormData.hours}
                            onChange={(val) => setBulkEditFormData({ ...bulkEditFormData, hours: val, _manualHours: true })}
                        />
                        <CustomInput
                            type="number"
                            step="any"
                            min={0}
                            label="Fazla Mesai (Saat)"
                            placeholder="Değiştirme (Boş bırakılabilir)"
                            value={bulkEditFormData.overtimeHours}
                            onChange={(val) => setBulkEditFormData({ ...bulkEditFormData, overtimeHours: val, _manualOvertime: true })}
                        />
                    </div>

                    {/* Fiyatlandırma & Birim Fiyat */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <CustomSelect
                            label="Fiyatlandırma"
                            value={bulkEditFormData.pricingType}
                            onChange={(val) => setBulkEditFormData({ ...bulkEditFormData, pricingType: val })}
                            options={[
                                { value: '', label: 'Değiştirme (Mevcut kalsın)' },
                                { value: 'daily', label: 'Günlük' },
                                { value: 'hourly', label: 'Saatlik' },
                                { value: 'monthly', label: 'Aylık' }
                            ]}
                        />
                        <CustomInput
                            label="Birim Fiyat"
                            format="currency"
                            maxDecimals={6}
                            maxLength={18}
                            placeholder="Değiştirme"
                            value={bulkEditFormData.unitPrice}
                            onChange={(val) => setBulkEditFormData({ ...bulkEditFormData, unitPrice: val })}
                        />
                    </div>

                    {/* Ek Ödemeler (Disabled representation) */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '10px 12px',
                        background: 'var(--bg-secondary)',
                        border: '1px dashed var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        opacity: 0.6
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Wallet size={15} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                                Ek Ödemeler (Toplu düzenlemede kullanılamaz)
                            </span>
                        </div>
                    </div>

                    <CustomInput
                        label="Açıklama"
                        type="text"
                        value={bulkEditFormData.description}
                        onChange={(val) => setBulkEditFormData({ ...bulkEditFormData, description: val })}
                        maxLength={250}
                    />

                    <div className="modal-footer">
                        <button type="button" onClick={() => setIsBulkEditModalOpen(false)} className="btn btn-secondary">İptal</button>
                        <button type="submit" className="btn btn-primary">Toplu Güncelle</button>
                    </div>
                </form>
            </Modal>

            {/* Toplu Özel Ayarlar Penceresi: Çalışma Durumu, Gün Rengi & Manuel Katsayı */}
            <Modal
                isOpen={isBulkDaySettingsModalOpen}
                onClose={() => setIsBulkDaySettingsModalOpen(false)}
                title="Toplu Çalışma Durumu, Renk & Katsayı Ayarları"
                size="md"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* 1. Bölüm: Toplu Çalışma Durumu */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Briefcase size={15} style={{ color: 'var(--accent-primary)' }} />
                                1. Toplu Çalışma Durumu
                            </label>
                            {bulkEditFormData.workStatus && (
                                <button
                                    type="button"
                                    onClick={() => setBulkEditFormData(prev => ({ ...prev, workStatus: '' }))}
                                    style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Değiştirme (Kalsın)
                                </button>
                            )}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                            Seçili {(selectedIds || []).length} kaydın çalışma durumunu belirleyin:
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
                            <button
                                type="button"
                                onClick={() => setBulkEditFormData(prev => ({ ...prev, workStatus: '' }))}
                                style={{
                                    padding: '8px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '12px',
                                    fontWeight: bulkEditFormData.workStatus === '' ? 700 : 500,
                                    border: bulkEditFormData.workStatus === '' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                    background: bulkEditFormData.workStatus === '' ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                    color: bulkEditFormData.workStatus === '' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                ⚪ Değiştirme (Kalsın)
                            </button>

                            <button
                                type="button"
                                onClick={() => setBulkEditFormData(prev => ({
                                    ...prev,
                                    workStatus: 'normal',
                                    hours: prev.hours || '1',
                                    startTime: prev.startTime || work?.work_start_time || '08:00',
                                    endTime: prev.endTime || work?.work_end_time || '17:00'
                                }))}
                                style={{
                                    padding: '8px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '12px',
                                    fontWeight: bulkEditFormData.workStatus === 'normal' ? 700 : 500,
                                    border: bulkEditFormData.workStatus === 'normal' ? '2px solid #10b981' : '1px solid var(--border-color)',
                                    background: bulkEditFormData.workStatus === 'normal' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                                    color: bulkEditFormData.workStatus === 'normal' ? '#10b981' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                🟢 Normal (1 Gün)
                            </button>

                            <button
                                type="button"
                                onClick={() => setBulkEditFormData(prev => ({
                                    ...prev,
                                    workStatus: 'zero',
                                    hours: '0',
                                    overtimeHours: '0',
                                    startTime: '',
                                    endTime: '',
                                    unitPrice: '0'
                                }))}
                                style={{
                                    padding: '8px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '12px',
                                    fontWeight: bulkEditFormData.workStatus === 'zero' ? 700 : 500,
                                    border: bulkEditFormData.workStatus === 'zero' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                                    background: bulkEditFormData.workStatus === 'zero' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-tertiary)',
                                    color: bulkEditFormData.workStatus === 'zero' ? '#ef4444' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                ⛔ Tatil (0 Gün - 0 TL)
                            </button>
                        </div>
                    </div>

                    {/* 2. Bölüm: Toplu Manuel Katsayı */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Layers size={15} style={{ color: 'var(--accent-primary)' }} />
                                2. Toplu Manuel Katsayı (Çarpan)
                            </label>
                            {bulkEditFormData.multiplier && (
                                <button
                                    type="button"
                                    onClick={() => setBulkEditFormData(prev => ({ ...prev, multiplier: '' }))}
                                    style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Değiştirme (Kalsın)
                                </button>
                            )}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                            Seçili kayıtlara uygulanacak çarpan oranı:
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                            {[
                                { id: '', label: 'Değiştirme (Kalsın)' },
                                { id: '1', label: '1x (Standart / Kaldır)' },
                                { id: '1.25', label: '1.25x (%25 Zammı)' },
                                { id: '1.5', label: '1.5x (Mesaili / Pazar)' },
                                { id: '2', label: '2x (Çift Mesai / Bayram)' },
                                { id: '2.5', label: '2.5x' },
                                { id: '3', label: '3x' }
                            ].map(mult => {
                                const isSelected = (bulkEditFormData.multiplier || '') === mult.id;
                                return (
                                    <button
                                        key={mult.id}
                                        type="button"
                                        onClick={() => setBulkEditFormData(prev => ({ ...prev, multiplier: mult.id }))}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '16px',
                                            fontSize: '12px',
                                            fontWeight: isSelected ? 700 : 500,
                                            cursor: 'pointer',
                                            border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                            background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {mult.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. Bölüm: Toplu Gün Rengi */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Tag size={15} style={{ color: 'var(--accent-primary)' }} />
                                3. Toplu Gün Rengi / Satır Vurgusu
                            </label>
                            {bulkEditFormData.customColor && (
                                <button
                                    type="button"
                                    onClick={() => setBulkEditFormData(prev => ({ ...prev, customColor: '' }))}
                                    style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Değiştirme (Kalsın)
                                </button>
                            )}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                            Seçili kayıtların satır rengini değiştirin veya mevcut olanları kaldırın:
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
                            {[
                                { id: '', label: 'Değiştirme', desc: 'Kalsın', color: 'var(--border-color)', bg: 'var(--bg-tertiary)' },
                                { id: 'none', label: 'Rengi Kaldır', desc: 'Standart yap', color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' },
                                { id: 'red', label: 'Kırmızı', desc: 'Resmi Tatil', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
                                { id: 'orange', label: 'Turuncu', desc: 'Cumartesi / Yarım', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
                                { id: 'blue', label: 'Mavi', desc: 'Gece Vardiyası', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
                                { id: 'green', label: 'Yeşil', desc: 'Özel Saha', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
                                { id: 'purple', label: 'Mor', desc: 'Özel Durum', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' }
                            ].map(col => {
                                const isSelected = (bulkEditFormData.customColor || '') === col.id;
                                return (
                                    <button
                                        key={col.id}
                                        type="button"
                                        onClick={() => setBulkEditFormData(prev => ({ ...prev, customColor: col.id }))}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 10px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: isSelected ? (col.color ? `2px solid ${col.color}` : '2px solid var(--accent-primary)') : '1px solid var(--border-color)',
                                            background: isSelected ? (col.bg || 'var(--accent-subtle)') : 'var(--bg-tertiary)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {col.id && col.id !== 'none' ? (
                                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                                        ) : (
                                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px dashed var(--text-muted)', flexShrink: 0 }} />
                                        )}
                                        <div>
                                            <div style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 600, color: isSelected ? (col.color || 'var(--accent-primary)') : 'var(--text-primary)' }}>
                                                {col.label}
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{col.desc}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="modal-footer" style={{ marginTop: '4px', padding: 0 }}>
                        <button
                            type="button"
                            onClick={() => setIsBulkDaySettingsModalOpen(false)}
                            className="btn btn-primary"
                            style={{ width: '100%', height: '42px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            <Check size={16} /> Toplu Ayarları Uygula ve Kapat
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={!!confirmModal}
                title={confirmModal?.title}
                message={confirmModal?.message}
                onConfirm={handleConfirmDelete}
                onClose={() => setConfirmModal(null)}
                type="danger"
            />

            {/* Report Preview Modal */}
            <Modal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                title={`Puantaj Raporu: ${work.title}`}
                size="fullscreen"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsReportModalOpen(false)}>Kapat</button>
                        <div style={{ marginRight: 'auto' }}></div>
                        <button className="btn btn-success" onClick={handleSaveToSystem} disabled={savingToSystem || generatingPdf} style={{ gap: '6px' }}>
                            <Save size={16} /> {savingToSystem ? 'Kaydediliyor...' : 'Sisteme Kaydet'}
                        </button>
                        <button className="btn" onClick={handleExportExcel} style={{ gap: '6px', backgroundColor: '#10b981', borderColor: '#10b981', color: '#fff' }}>
                            <Download size={16} /> Excel Olarak İndir
                        </button>
                        <button className="btn btn-primary" onClick={handleSavePdf} disabled={savingToSystem || generatingPdf} style={{ gap: '6px' }}>
                            <FileDown size={16} /> {generatingPdf ? 'Hazırlanıyor...' : 'PDF Olarak Kaydet'}
                        </button>
                        <button className="btn btn-primary" onClick={handlePrintReport} disabled={savingToSystem} style={{ gap: '6px' }}>
                            <Printer size={16} /> Yazdır
                        </button>
                    </>
                }
            >
                <div style={{ display: 'flex', gap: '0', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                    {/* Left: Configuration - Sticky Sidebar */}
                    <div style={{ width: '280px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '0', flexShrink: 0, overflowY: 'auto', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}>
                        
                        {/* Content Toggles */}
                        <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <div 
                                onClick={() => setSidebarCollapsed(prev => ({ ...prev, options: !prev.options }))}
                                style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Settings size={14} style={{ color: 'var(--text-muted)' }} />
                                    <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rapor Seçenekleri</h4>
                                </div>
                                <ChevronDown 
                                    size={14} 
                                    style={{ 
                                        color: 'var(--text-muted)', 
                                        transform: sidebarCollapsed.options ? 'rotate(-90deg)' : 'none', 
                                        transition: 'transform 0.2s ease' 
                                    }} 
                                />
                            </div>
                            {!sidebarCollapsed.options && (
                                <div style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '7px 10px', borderRadius: '8px', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ fontSize: '13px', color: showPrices ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: showPrices ? 500 : 400, transition: 'all 0.15s' }}>Tabloda Fiyatları Göster</span>
                                            <label className="toggle-switch" style={{ flexShrink: 0, transform: 'scale(0.8)' }} onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" checked={showPrices} onChange={e => setShowPrices(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </label>

                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '7px 10px', borderRadius: '8px', transition: 'background 0.15s', marginTop: '4px' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ fontSize: '13px', color: showGrandTotal ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: showGrandTotal ? 500 : 400, transition: 'all 0.15s' }}>Genel Toplam Kutusunu Göster</span>
                                            <label className="toggle-switch" style={{ flexShrink: 0, transform: 'scale(0.8)' }} onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" checked={showGrandTotal} onChange={e => setShowGrandTotal(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </label>

                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '7px 10px', borderRadius: '8px', transition: 'background 0.15s', marginTop: '4px' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ fontSize: '13px', color: showKdv ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: showKdv ? 500 : 400, transition: 'all 0.15s' }}>KDV Ekle (+%20)</span>
                                            <label className="toggle-switch" style={{ flexShrink: 0, transform: 'scale(0.8)' }} onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" checked={showKdv} onChange={e => setShowKdv(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </label>

                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '7px 10px', borderRadius: '8px', transition: 'background 0.15s', marginTop: '4px' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ fontSize: '13px', color: showWorkTitle ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: showWorkTitle ? 500 : 400, transition: 'all 0.15s' }}>İş Tanımını Göster</span>
                                            <label className="toggle-switch" style={{ flexShrink: 0, transform: 'scale(0.8)' }} onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" checked={showWorkTitle} onChange={e => {
                                                    setShowWorkTitle(e.target.checked);
                                                    savePdfBreakSettings({ showWorkTitle: e.target.checked });
                                                }} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Katsayı Ayarları */}
                        <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <div 
                                onClick={() => setSidebarCollapsed(prev => ({ ...prev, multipliers: !prev.multipliers }))}
                                style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Settings size={14} style={{ color: 'var(--text-muted)' }} />
                                    <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mesai Katsayıları</h4>
                                </div>
                                <ChevronDown 
                                    size={14} 
                                    style={{ 
                                        color: 'var(--text-muted)', 
                                        transform: sidebarCollapsed.multipliers ? 'rotate(-90deg)' : 'none', 
                                        transition: 'transform 0.2s ease' 
                                    }} 
                                />
                            </div>
                            {!sidebarCollapsed.multipliers && (
                                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', marginBottom: '4px', display: 'block', color: 'var(--text-muted)', fontWeight: 500 }}>Pazar Katsayısı</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="10"
                                            className="form-input"
                                            value={pazarMultiplier}
                                            onChange={(e) => setPazarMultiplier(e.target.value)}
                                            onBlur={async () => {
                                                const numVal = parseFloat(pazarMultiplier);
                                                if (!isNaN(numVal) && work?.id) {
                                                    await window.electronAPI.updateWork({ id: work.id, pazar_multiplier: Math.min(Math.max(numVal, 0), 10) });
                                                }
                                            }}
                                            style={{ fontSize: '12px', padding: '6px 10px', width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', marginBottom: '4px', display: 'block', color: 'var(--text-muted)', fontWeight: 500 }}>Mesai Farkı Katsayısı</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="10"
                                            className="form-input"
                                            value={mesaiMultiplier}
                                            onChange={(e) => setMesaiMultiplier(e.target.value)}
                                            onBlur={async () => {
                                                const numVal = parseFloat(mesaiMultiplier);
                                                if (!isNaN(numVal) && work?.id) {
                                                    await window.electronAPI.updateWork({ id: work.id, mesai_multiplier: Math.min(Math.max(numVal, 0), 10) });
                                                }
                                            }}
                                            style={{ fontSize: '12px', padding: '6px 10px', width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sayfa Düzeni ve Bölme Ayarları */}
                        <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <div 
                                onClick={() => setSidebarCollapsed(prev => ({ ...prev, pageBreak: !prev.pageBreak }))}
                                style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileText size={14} style={{ color: 'var(--text-muted)' }} />
                                    <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sayfa Düzeni ve Bölme</h4>
                                </div>
                                <ChevronDown 
                                    size={14} 
                                    style={{ 
                                        color: 'var(--text-muted)', 
                                        transform: sidebarCollapsed.pageBreak ? 'rotate(-90deg)' : 'none', 
                                        transition: 'transform 0.2s ease' 
                                    }} 
                                />
                            </div>
                            {!sidebarCollapsed.pageBreak && (
                                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {/* Sayfa Düzeni ve Sığdırma */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Sayfa Düzeni ve Sığdırma
                                        </label>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <button
                                                type="button"
                                                className={`btn ${pageBreakMode === 'fit_page' ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={() => {
                                                    setPageBreakMode('fit_page');
                                                    setCustomScale(null);
                                                    savePdfBreakSettings({ pageBreakMode: 'fit_page', customScale: null });
                                                }}
                                                style={{ 
                                                    fontSize: '11.5px', 
                                                    padding: '9px 12px', 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between', 
                                                    alignItems: 'center',
                                                    borderRadius: '6px'
                                                }}
                                                title="Tüm raporu otomatik ölçekleyerek tam 1 A4 sayfasına sığdırır"
                                            >
                                                <span style={{ fontWeight: 600 }}>1 Sayfaya Sığdır</span>
                                                <span style={{ fontSize: '10px', opacity: 0.75 }}>Otomatik Ölçek</span>
                                            </button>

                                            <button
                                                type="button"
                                                className={`btn ${(pageBreakMode === 'auto' && !customScale) ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={() => {
                                                    setPageBreakMode('auto');
                                                    setCustomScale(null);
                                                    savePdfBreakSettings({ pageBreakMode: 'auto', customScale: null });
                                                }}
                                                style={{ 
                                                    fontSize: '11.5px', 
                                                    padding: '9px 12px', 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between', 
                                                    alignItems: 'center',
                                                    borderRadius: '6px'
                                                }}
                                                title="Doğal %100 ölçekle standart akış"
                                            >
                                                <span style={{ fontWeight: 600 }}>Standart (%100)</span>
                                                <span style={{ fontSize: '10px', opacity: 0.75 }}>Doğal Akış</span>
                                            </button>

                                            <button
                                                type="button"
                                                className={`btn ${pageBreakMode === 'vehicle' ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={() => {
                                                    setPageBreakMode('vehicle');
                                                    setCustomScale(null);
                                                    savePdfBreakSettings({ pageBreakMode: 'vehicle', customScale: null });
                                                }}
                                                style={{ 
                                                    fontSize: '11.5px', 
                                                    padding: '9px 12px', 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between', 
                                                    alignItems: 'center',
                                                    borderRadius: '6px'
                                                }}
                                                title="Her iş makinesini/aracı ayrı bir sayfadan başlatır"
                                            >
                                                <span style={{ fontWeight: 600 }}>Araç Başına Sayfa</span>
                                                <span style={{ fontSize: '10px', opacity: 0.75 }}>Araçları Böl</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Tablo Yoğunluğu ve Sayfa Yönü Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>
                                            <label style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 500 }}>
                                                Tablo Yoğunluğu
                                            </label>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm ${tableDensity !== 'compact' ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => {
                                                        setTableDensity('normal');
                                                        savePdfBreakSettings({ tableDensity: 'normal' });
                                                    }}
                                                    style={{ flex: 1, fontSize: '10.5px', padding: '6px 4px' }}
                                                >
                                                    Normal
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm ${tableDensity === 'compact' ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => {
                                                        setTableDensity('compact');
                                                        savePdfBreakSettings({ tableDensity: 'compact' });
                                                    }}
                                                    style={{ flex: 1, fontSize: '10.5px', padding: '6px 4px' }}
                                                    title="Satır boşluklarını daraltarak daha çok satır sığdırır"
                                                >
                                                    Kompakt
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 500 }}>
                                                Sayfa Yönü
                                            </label>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm ${orientation === 'portrait' ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => {
                                                        setOrientation('portrait');
                                                        savePdfBreakSettings({ orientation: 'portrait' });
                                                    }}
                                                    style={{ flex: 1, fontSize: '10.5px', padding: '6px 4px' }}
                                                >
                                                    Dikey
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm ${orientation === 'landscape' ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => {
                                                        setOrientation('landscape');
                                                        savePdfBreakSettings({ orientation: 'landscape' });
                                                    }}
                                                    style={{ flex: 1, fontSize: '10.5px', padding: '6px 4px' }}
                                                >
                                                    Yatay
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Live Preview */}
                    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-tertiary)', padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20mm', alignItems: 'center', width: '100%' }}>
                            <WorkPdfReport 
                                propWork={work} 
                                noHeader={true} 
                                isPreview={true} 
                                showPricesProp={showPrices} 
                                showGrandTotalProp={showGrandTotal}
                                showKdvProp={showKdv} 
                                kdvRateProp={kdvRate}
                                pazarMultiplierProp={pazarMultiplier}
                                mesaiMultiplierProp={mesaiMultiplier}
                                pageBreakModeProp={pageBreakMode}
                                rowsPerPageProp={rowsPerPage}
                                manualBreakIdsProp={manualBreakIds}
                                customScaleProp={customScale}
                                orientationProp={orientation}
                                tableDensityProp={tableDensity}
                                showWorkTitleProp={showWorkTitle}
                                onToggleManualBreakProp={(itemId) => {
                                    const next = manualBreakIds.includes(itemId) 
                                        ? manualBreakIds.filter(i => i !== itemId) 
                                        : [...manualBreakIds, itemId];
                                    setManualBreakIds(next);
                                    savePdfBreakSettings({ manualBreakIds: next });
                                }}
                                showBreakToolsProp={showBreakTools}
                            />
                        </div>
                    </div>
                </div>
            </Modal>

        </div>
    )
}

function getStatusColor(status) {
    switch (status) {
        case 'pending': return 'warning'
        case 'in_progress': return 'info'
        case 'completed': return 'success'
        case 'cancelled': return 'important' // or danger based on css
        default: return 'secondary'
    }
}
