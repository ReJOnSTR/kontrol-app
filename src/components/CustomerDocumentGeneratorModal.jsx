import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import CustomInput from './CustomInput'
import CustomSelect from './CustomSelect'
import StampSignaturePreview, { STAMP_DEFAULTS } from './StampSignaturePreview'
import { FileText, Download, Check, ArrowLeft, Stamp, Plus, Trash2, X, Truck } from 'lucide-react'
import { customerDocumentTemplates } from '../utils/customerDocumentTemplates'
import { formatDate, formatDateForInput, generateUniqueFileName } from '../utils/helpers'

const UNIT_OPTIONS = ['Gün', 'Saat', 'Sefer', 'Adet', 'Ay', 'Hafta', 'İş', 'Ton', 'Metre', 'Takım']



export default function CustomerDocumentGeneratorModal({ isOpen, onClose, customer, company, onSuccess }) {
    const [selectedTemplate, setSelectedTemplate] = useState(customerDocumentTemplates[0])
    const [placeholders, setPlaceholders] = useState({})
    const [content, setContent] = useState('')
    const [title, setTitle] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    // 'edit' | 'stamp-preview'
    const [step, setStep] = useState('edit')
    const [includeStamp, setIncludeStamp] = useState(true)
    const [vehicles, setVehicles] = useState([])
    const [stampSettings, setStampSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('lastStampSettings')
            return saved ? { ...STAMP_DEFAULTS, ...JSON.parse(saved) } : STAMP_DEFAULTS
        } catch (e) {
            return STAMP_DEFAULTS
        }
    })
    const [generatingMode, setGeneratingMode] = useState(null) // 'silent' | 'download' | null
    const tabsRef = useRef({})
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

    useEffect(() => {
        const updateIndicator = () => {
            const activeElement = tabsRef.current[selectedTemplate?.id]
            if (activeElement) {
                setIndicatorStyle({ left: activeElement.offsetLeft, width: activeElement.offsetWidth })
            }
        }
        updateIndicator()
        const timer = setTimeout(updateIndicator, 60)
        return () => clearTimeout(timer)
    }, [selectedTemplate?.id, step, isOpen])

    // Load fleet vehicles for instant addition
    useEffect(() => {
        if (company?.id && window.electronAPI?.getVehicles) {
            window.electronAPI.getVehicles(company.id, 0).then(res => {
                if (res?.success && Array.isArray(res.data)) {
                    setVehicles(res.data)
                }
            }).catch(err => console.error('Failed to load fleet vehicles:', err))
        }
    }, [company?.id])

    // Proposal specific state (Multi-rate flexible pricing without grand total)
    const [priceColumns, setPriceColumns] = useState([
        { id: 'daily', label: 'Günlük Fiyat' },
        { id: 'monthly', label: 'Aylık Fiyat' },
        { id: 'hourly', label: 'Saatlik / Mesai' }
    ])
    const [proposalItems, setProposalItems] = useState([
        { 
            id: '1', 
            description: '50 Tonluk Teleskopik Mobil Vinç', 
            condition: 'Operatör dahil, yakıt hariç',
            prices: { daily: '25.000 ₺', monthly: '350.000 ₺', hourly: '4.500 ₺ (Min. 4 Saat)' }
        },
        { 
            id: '2', 
            description: 'Sepetli Platform (30 Metre)', 
            condition: 'Operatörlü, tek vardiya',
            prices: { daily: '15.000 ₺', monthly: '220.000 ₺', hourly: '2.500 ₺' }
        }
    ])
    const [showConditionColumn, setShowConditionColumn] = useState(false)
    const [proposalTerms, setProposalTerms] = useState('')

    useEffect(() => {
        localStorage.setItem('lastStampSettings', JSON.stringify(stampSettings))
    }, [stampSettings])

    useEffect(() => {
        if (selectedTemplate?.id === 'customer_proposal') {
            if (selectedTemplate.priceColumns) {
                setPriceColumns(selectedTemplate.priceColumns)
            }
            if (selectedTemplate.defaultItems) {
                setProposalItems(selectedTemplate.defaultItems)
            }
            if (selectedTemplate.defaultTerms) {
                setProposalTerms(selectedTemplate.defaultTerms)
            }
            if (selectedTemplate.defaultShowConditionColumn !== undefined) {
                setShowConditionColumn(selectedTemplate.defaultShowConditionColumn)
            }
        }
    }, [selectedTemplate])

    useEffect(() => {
        if (selectedTemplate && customer && company) {
            const initialPlaceholders = {}
            selectedTemplate.placeholders.forEach(p => {
                if (p.source === 'customer') {
                    if (p.key === 'customerName') initialPlaceholders[p.key] = customer.name || ''
                    else {
                        const custKey = p.keyInCust || p.key
                        const value = customer[custKey] || ''
                        initialPlaceholders[p.key] = (p.type === 'date' || custKey.includes('date')) && value ? formatDateForInput(value) : value
                    }
                } else if (p.source === 'company') {
                    const compKey = p.keyInComp || p.key
                    let value = company[compKey] || ''
                    if (p.key === 'companyTax' && company.tax_office) {
                        value = `${company.tax_office} / ${company.tax_number || ''}`
                    }
                    initialPlaceholders[p.key] = value
                } else {
                    if (p.default === 'today') {
                        initialPlaceholders[p.key] = new Date().toISOString().split('T')[0]
                    } else if (p.default === 'today+3m') {
                        const d = new Date()
                        d.setMonth(d.getMonth() + 3)
                        initialPlaceholders[p.key] = d.toISOString().split('T')[0]
                    } else {
                        initialPlaceholders[p.key] = p.default || ''
                    }
                }
            })

            // If template has balanceAmount or balanceType and customer has balance
            if (customer.balance !== undefined && (!initialPlaceholders.balanceAmount || initialPlaceholders.balanceAmount === '0,00 ₺')) {
                const bal = Number(customer.balance) || 0
                initialPlaceholders.balanceAmount = Math.abs(bal).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'
                initialPlaceholders.balanceType = bal > 0 ? 'BORÇ (Alacağımız)' : (bal < 0 ? 'ALACAK (Borcumuz)' : 'BAKİYE SIFIR')
            }

            setPlaceholders(initialPlaceholders)
            setTitle(selectedTemplate.title)
        }
    }, [selectedTemplate, customer, company])

    useEffect(() => {
        if (placeholders.startDate && placeholders.endDate && 'days' in placeholders) {
            const start = new Date(placeholders.startDate)
            const end = new Date(placeholders.endDate)
            if (!isNaN(start) && !isNaN(end) && end >= start) {
                const diffTime = end - start
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
                if (placeholders.days !== diffDays.toString()) {
                    setPlaceholders(prev => ({ ...prev, days: diffDays.toString() }))
                }
            }
        }
    }, [placeholders.startDate, placeholders.endDate])

    useEffect(() => {
        if (selectedTemplate && selectedTemplate.content) {
            let newContent = selectedTemplate.content
            Object.entries(placeholders).forEach(([key, value]) => {
                const displayValue = key.toLowerCase().includes('date') && value ? formatDate(value) : value
                newContent = newContent.replace(new RegExp(`{{${key}}}`, 'g'), displayValue || `[${key}]`)
            })
            setContent(newContent)
        }
    }, [placeholders, selectedTemplate])

    // Reset step when modal closes
    useEffect(() => {
        if (!isOpen) {
            setStep('edit')
            setShowAddColInput(false)
            setNewColTitle('')
        }
    }, [isOpen])

    // Proposal column and item handlers
    const handleAddColumn = () => {
        const newColId = 'col_' + Date.now()
        const colNum = priceColumns.length + 1
        const defaultLabel = `Fiyat ${colNum}`
        setPriceColumns(prev => [...prev, { id: newColId, label: defaultLabel }])
        setProposalItems(prev => prev.map(item => ({
            ...item,
            prices: {
                ...(item.prices || {}),
                [newColId]: ''
            }
        })))
    }

    const handleUpdateColumnLabel = (colId, newLabel) => {
        setPriceColumns(prev => prev.map(c => String(c.id) === String(colId) ? { ...c, label: newLabel } : c))
    }

    const handleRemoveColumn = (colId) => {
        if (priceColumns.length <= 1) {
            alert('Teklifte en az 1 fiyat sütunu bulunmalıdır.')
            return
        }
        setPriceColumns(prev => prev.filter(c => String(c.id) !== String(colId)))
    }

    const handleAddItem = () => {
        const initialPrices = {}
        priceColumns.forEach(c => { initialPrices[c.id] = '' })
        setProposalItems(prev => [
            ...prev,
            { 
                id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6), 
                description: '', 
                condition: '', 
                prices: initialPrices 
            }
        ])
    }

    const handleRemoveItem = (id) => {
        if (proposalItems.length <= 1) {
            // Son kalem silinmek istendiğinde satırı temizle (kullanıcıyı engelleme)
            const initialPrices = {}
            priceColumns.forEach(c => { initialPrices[c.id] = '' })
            setProposalItems([{
                id: 'item_' + Date.now(),
                description: '',
                condition: '',
                prices: initialPrices
            }])
            return
        }
        setProposalItems(prev => prev.filter(it => String(it.id) !== String(id)))
    }

    const handleUpdateItem = (id, field, value) => {
        setProposalItems(prev => prev.map(it => {
            if (it.id !== id) return it
            return {
                ...it,
                [field]: value
            }
        }))
    }

    const handleUpdateItemPrice = (id, colId, value) => {
        setProposalItems(prev => prev.map(it => {
            if (it.id !== id) return it
            return {
                ...it,
                prices: {
                    ...(it.prices || {}),
                    [colId]: value
                }
            }
        }))
    }

    const isProposal = selectedTemplate?.id === 'customer_proposal'

    const handleAddVehicleItem = (vehicle) => {
        if (!vehicle) return
        const initialPrices = {}
        priceColumns.forEach(c => { initialPrices[c.id] = '' })
        const desc = `${vehicle.plate || ''} - ${vehicle.brand || ''} ${vehicle.model || ''} (${vehicle.type || 'Vinç'})`.trim()
        setProposalItems(prev => [
            ...prev,
            {
                id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                description: desc,
                condition: 'Operatörlü, tek vardiya',
                prices: initialPrices
            }
        ])
    }



    const handleGenerate = async (isSilent = false) => {
        setGeneratingMode(isSilent ? 'silent' : 'download')
        setIsGenerating(true)
        try {
            const finalStampSettings = {
                ...stampSettings,
                includeStamp,
                showSignatures: includeStamp,
                showStamp: includeStamp && stampSettings.showStamp !== false,
                showSignature: includeStamp && stampSettings.showSignature !== false,
                stampEnabled: includeStamp && !!company.stamp_path && stampSettings.stampEnabled !== false,
                companySignatureEnabled: includeStamp && !!company.signature_path && stampSettings.companySignatureEnabled !== false
            }

            const printData = {
                templateId: selectedTemplate.id,
                title,
                content: isProposal ? '' : content,
                customerName: customer.name,
                customerAddress: customer.address,
                customerTax: customer.tax_office ? `${customer.tax_office} / ${customer.tax_number || ''}` : customer.tax_number,
                companyName: company.name,
                companyAddress: company.address,
                companySgk: company.sgk_no,
                companyTax: company.tax_office ? `${company.tax_office} / ${company.tax_number || ''}` : company.tax_number,
                includeStamp,
                showSignatures: includeStamp,
                companySignaturePath: includeStamp ? company.signature_path : null,
                companyStampPath: includeStamp ? company.stamp_path : null,
                placeholders,
                stampSettings: finalStampSettings,
                // Multi-rate proposal fields (No total / sum)
                priceColumns: isProposal ? priceColumns : undefined,
                showConditionColumn: isProposal ? showConditionColumn : undefined,
                items: isProposal ? proposalItems : undefined,
                terms: isProposal ? proposalTerms : undefined,
            }
            
            localStorage.setItem('printDocData', JSON.stringify(printData))
            
            const custStr = customer?.name ? customer.name.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, '_').substring(0, 30) : 'Musteri'
            const docTitleStr = title || selectedTemplate?.name || 'Resmi_Belge'
            const defaultFileName = generateUniqueFileName('Belge', [custStr, docTitleStr], 'pdf')

            const result = await window.electronAPI.saveReportPdf('/print-document', { silent: isSilent, defaultPath: defaultFileName })
            if (result && result.success && result.filePath) {
                if (isSilent) {
                    const baseName = result.filePath.split('/').pop().split('\\').pop()
                    const docName = baseName || `${docTitleStr}.pdf`
                    
                    try {
                        const createResult = await window.electronAPI.addDocument({
                            relatedType: 'customer',
                            relatedId: customer.id,
                            fileName: docName,
                            filePath: result.filePath,
                            category: selectedTemplate.name || 'Resmi Belge',
                            docType: selectedTemplate.name || 'Resmi Belge',
                            startDate: new Date().toISOString().split('T')[0]
                        })
                        if (createResult && createResult.success && onSuccess) {
                            onSuccess()
                        } else if (onSuccess) {
                            onSuccess()
                        }
                    } catch (err) {
                        console.error('Failed to create customer document:', err)
                        if (!isSilent) {
                            alert('Belge, PDF olarak kaydedildi ancak müşteri belgelerine eklenemedi.')
                        } else {
                            alert('Belge kayıtlarına eklenirken hata oluştu.')
                        }
                    }
                }
                
                if (isSilent) {
                    onClose()
                }
            } else if (result && !result.success && !result.canceled) {
                alert('Belge oluşturulurken hata oluştu: ' + result.error)
            }
        } catch (error) {
            console.error('Document generation failed:', error)
            alert('Beklenmedik bir hata oluştu.')
        }
        setIsGenerating(false)
        setGeneratingMode(null)
    }

    if (!customer || !company) return null

    const hasStampOrSig = company.stamp_path || company.signature_path

    const modalFooter = step === 'edit' ? (
        <>
            <button onClick={onClose} className="btn btn-secondary">İptal</button>
            {hasStampOrSig && includeStamp && (
                <button
                    type="button"
                    onClick={() => setStep('stamp-preview')}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Stamp size={16} />
                    Kaşe Konumu Düzenle
                </button>
            )}
            <button 
                type="button"
                onClick={() => handleGenerate(true)} 
                disabled={isGenerating} 
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                <FileText size={16} />
                {isGenerating && generatingMode === 'silent' ? 'Kaydediliyor...' : 'Belge Kayıtlarına Ekle'}
            </button>
            <button 
                type="button"
                onClick={() => handleGenerate(false)} 
                disabled={isGenerating} 
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                {isGenerating && generatingMode === 'download' ? 'Hazırlanıyor...' : (
                    <>
                        <Download size={18} />
                        PDF Olarak İndir
                    </>
                )}
            </button>
        </>
    ) : (
        <>
            <button
                type="button"
                onClick={() => setStep('edit')}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                <ArrowLeft size={16} />
                Geri Dön
            </button>
            <button 
                type="button"
                onClick={() => handleGenerate(true)} 
                disabled={isGenerating} 
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                <FileText size={16} />
                {isGenerating && generatingMode === 'silent' ? 'Kaydediliyor...' : 'Belge Kayıtlarına Ekle'}
            </button>
            <button 
                type="button"
                onClick={() => handleGenerate(false)} 
                disabled={isGenerating} 
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                {isGenerating && generatingMode === 'download' ? 'Hazırlanıyor...' : (
                    <>
                        <Download size={18} />
                        PDF Olarak İndir
                    </>
                )}
            </button>
        </>
    )

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={step === 'stamp-preview' ? 'Kaşe & İmza Konumlandırma — PDF Önizleme' : 'Müşteri Belgesi Oluştur'}
            size={step === 'stamp-preview' ? 'fullscreen' : 'xl'}
            footer={modalFooter}
        >
            {step === 'edit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Sekmeler (Standart Sekme Tasarımı) */}
                    <div className="doc-modal-tabs">
                        {customerDocumentTemplates.map(t => {
                            const isSelected = selectedTemplate.id === t.id
                            return (
                                <button
                                    key={t.id}
                                    ref={el => tabsRef.current[t.id] = el}
                                    type="button"
                                    onClick={() => setSelectedTemplate(t)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '12px 4px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        marginBottom: '0',
                                        whiteSpace: 'nowrap',
                                        position: 'relative',
                                        zIndex: 1,
                                        transition: 'color 0.2s ease'
                                    }}
                                    onMouseEnter={e => {
                                        if (!isSelected) e.currentTarget.style.color = 'var(--text-primary)'
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSelected) e.currentTarget.style.color = 'var(--text-secondary)'
                                    }}
                                >
                                    <FileText size={16} color={isSelected ? 'var(--accent-primary)' : 'currentColor'} />
                                    <span>{t.name}</span>
                                </button>
                            )
                        })}

                        {/* Sliding Indicator */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: indicatorStyle.left,
                            width: indicatorStyle.width,
                            height: '2px',
                            backgroundColor: 'var(--accent-primary)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            zIndex: 2
                        }} />
                    </div>

                    {/* Proposal Mode: Kompakt, Profesyonel ve Bütünleşik Teklif Formu */}
                    {isProposal ? (
                        <div style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            {/* Belge Başlığı, Teklif No ve Şirket Kaşe Onayı */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '260px' }}>
                                    <input 
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        maxLength={120}
                                        placeholder="FİYAT TEKLİF FORMU"
                                        className="form-input"
                                        style={{
                                            fontSize: '16px',
                                            fontWeight: 700,
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase',
                                            height: '38px'
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Teklif No:</span>
                                    <input
                                        type="text"
                                        value={placeholders.proposalNo || ''}
                                        onChange={(e) => setPlaceholders(p => ({ ...p, proposalNo: e.target.value }))}
                                        placeholder="TEK-2026-001"
                                        className="form-input"
                                        style={{
                                            width: '140px',
                                            height: '38px',
                                            fontSize: '13px',
                                            fontWeight: 600
                                        }}
                                    />
                                </div>
                                {hasStampOrSig && (
                                    <label
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '9px',
                                            height: '38px',
                                            padding: '0 12px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            transition: 'border-color var(--transition-fast)',
                                            flexShrink: 0
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                    >
                                        <Stamp size={15} style={{ color: includeStamp ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                                        <span style={{
                                            fontSize: '12.5px',
                                            fontWeight: 500,
                                            color: includeStamp ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            Kaşe &amp; İmza Alanı
                                        </span>
                                        <span className="toggle-switch" style={{ transform: 'scale(0.72)', transformOrigin: 'center center', margin: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={includeStamp}
                                                onChange={(e) => setIncludeStamp(e.target.checked)}
                                            />
                                            <span className="toggle-slider"></span>
                                        </span>
                                    </label>
                                )}
                            </div>

                            {/* Bütünleşik Teklif Üst Bilgileri Grid'i */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                padding: '14px 16px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-color)',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '10px 14px'
                            }}>
                                <CustomInput
                                    label="Müşteri / Firma Adı"
                                    value={placeholders.customerName || customer.name || ''}
                                    onChange={(val) => setPlaceholders(p => ({ ...p, customerName: val }))}
                                    style={{ marginBottom: 0 }}
                                />
                                <CustomInput
                                    label="İlgili Kişi / Yetkili"
                                    value={placeholders.attentionPerson || ''}
                                    onChange={(val) => setPlaceholders(p => ({ ...p, attentionPerson: val }))}
                                    placeholder="Örn: Ahmet Bey"
                                    style={{ marginBottom: 0 }}
                                />
                                <CustomInput
                                    label="Teklif Tarihi"
                                    type="date"
                                    value={placeholders.proposalDate || ''}
                                    onChange={(val) => setPlaceholders(p => ({ ...p, proposalDate: val }))}
                                    style={{ marginBottom: 0 }}
                                />
                                <CustomInput
                                    label="Geçerlilik Süresi"
                                    value={placeholders.validityDays || ''}
                                    onChange={(val) => setPlaceholders(p => ({ ...p, validityDays: val }))}
                                    placeholder="15 Gün"
                                    style={{ marginBottom: 0 }}
                                />
                                <CustomInput
                                    label="Çalışma / Şantiye Sahası"
                                    value={placeholders.workLocation || ''}
                                    onChange={(val) => setPlaceholders(p => ({ ...p, workLocation: val }))}
                                    style={{ marginBottom: 0 }}
                                />
                                <CustomInput
                                    label="Hazırlayan Yetkili"
                                    value={placeholders.preparedBy || ''}
                                    onChange={(val) => setPlaceholders(p => ({ ...p, preparedBy: val }))}
                                    style={{ marginBottom: 0 }}
                                />
                            </div>

                            {/* Tarife Tablosu ve Hızlı Araç Ekleme Toolbar */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Tarife ve Fiyat Kalemleri
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--accent-primary)', background: 'var(--accent-subtle)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                            {proposalItems.length} Kalem
                                        </span>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-secondary)', userSelect: 'none', marginLeft: '6px' }}>
                                            <input
                                                type="checkbox"
                                                checked={showConditionColumn}
                                                onChange={(e) => setShowConditionColumn(e.target.checked)}
                                                style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                                            />
                                            <span>Çalışma Koşulu / Vardiya</span>
                                        </label>
                                    </div>

                                    {/* Hızlı Ekleme Eylemleri */}
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        {vehicles.length > 0 && (
                                            <div style={{ width: '210px' }}>
                                                <CustomSelect
                                                    value=""
                                                    placeholder="Filodan Vinç Ekle..."
                                                    className="filter-select-custom"
                                                    floatingLabel={false}
                                                    hidePlaceholderOption={true}
                                                    options={vehicles.map(v => ({
                                                        value: String(v.id),
                                                        label: `${v.plate || ''} ${v.brand || ''} ${v.model || ''}`.trim()
                                                    }))}
                                                    onChange={(val) => {
                                                        if (val) {
                                                            const v = vehicles.find(item => String(item.id) === String(val))
                                                            if (v) handleAddVehicleItem(v)
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}


                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={handleAddColumn}
                                            style={{ height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Plus size={14} />
                                            <span>Sütun Ekle</span>
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={handleAddItem}
                                            style={{ height: '32px', padding: '0 14px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Plus size={14} />
                                            <span>Kalem Ekle</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Tarife Tablosu */}
                                <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', overflowX: 'auto' }}>
                                    <table className="data-table" style={{ width: '100%', tableLayout: 'auto' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '36px', textAlign: 'center' }}>
                                                    #
                                                </th>
                                                <th style={{ minWidth: '220px' }}>
                                                    Hizmet / Makine / Vinç Kalemi
                                                </th>
                                                {priceColumns.map(col => (
                                                    <th key={col.id} style={{ minWidth: '135px', textAlign: 'center', padding: '6px 8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%' }}>
                                                            <input
                                                                type="text"
                                                                value={col.label}
                                                                onChange={(e) => handleUpdateColumnLabel(col.id, e.target.value)}
                                                                placeholder="Sütun Adı..."
                                                                title="Sütun adını değiştirmek için tıklayın"
                                                                style={{
                                                                    height: '24px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    textAlign: 'center',
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.4px',
                                                                    padding: '0 4px',
                                                                    width: '100%',
                                                                    maxWidth: '120px',
                                                                    background: 'transparent',
                                                                    border: '1px solid transparent',
                                                                    borderRadius: '3px',
                                                                    color: 'var(--text-secondary)',
                                                                    cursor: 'pointer',
                                                                    outline: 'none',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                                onFocus={(e) => {
                                                                    e.target.style.background = 'var(--bg-primary)'
                                                                    e.target.style.borderColor = 'var(--accent-primary)'
                                                                    e.target.style.color = 'var(--text-primary)'
                                                                    e.target.style.cursor = 'text'
                                                                }}
                                                                onBlur={(e) => {
                                                                    e.target.style.background = 'transparent'
                                                                    e.target.style.borderColor = 'transparent'
                                                                    e.target.style.color = 'var(--text-secondary)'
                                                                    e.target.style.cursor = 'pointer'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (document.activeElement !== e.target) {
                                                                        e.target.style.borderColor = 'var(--border-color)'
                                                                        e.target.style.background = 'rgba(255, 255, 255, 0.03)'
                                                                    }
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (document.activeElement !== e.target) {
                                                                        e.target.style.borderColor = 'transparent'
                                                                        e.target.style.background = 'transparent'
                                                                    }
                                                                }}
                                                            />
                                                            {priceColumns.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleRemoveColumn(col.id)
                                                                    }}
                                                                    title={`${col.label} sütununu sil`}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        width: '18px',
                                                                        height: '18px',
                                                                        borderRadius: '4px',
                                                                        border: 'none',
                                                                        background: 'transparent',
                                                                        color: 'var(--text-muted)',
                                                                        cursor: 'pointer',
                                                                        padding: 0,
                                                                        flexShrink: 0,
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.color = 'var(--danger)'
                                                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.color = 'var(--text-muted)'
                                                                        e.currentTarget.style.background = 'transparent'
                                                                    }}
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </th>
                                                ))}
                                                {showConditionColumn && (
                                                    <th style={{ minWidth: '180px' }}>
                                                        Çalışma Koşulu / Not
                                                    </th>
                                                )}
                                                <th style={{ width: '48px', textAlign: 'center' }}>
                                                    Sil
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {proposalItems.map((item, index) => (
                                                <tr key={item.id}>
                                                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>
                                                        {index + 1}
                                                    </td>
                                                    <td style={{ padding: '6px 8px' }}>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            value={item.description}
                                                            onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault()
                                                                    handleAddItem()
                                                                }
                                                            }}
                                                            placeholder="Örn: 50 Ton Teleskopik Mobil Vinç"
                                                            style={{
                                                                height: '32px',
                                                                fontSize: '12.5px',
                                                                padding: '4px 10px'
                                                            }}
                                                        />
                                                    </td>
                                                    {priceColumns.map(col => (
                                                        <td key={col.id} style={{ padding: '6px 8px' }}>
                                                            <input
                                                                type="text"
                                                                className="form-input"
                                                                value={item.prices?.[col.id] || ''}
                                                                onChange={(e) => handleUpdateItemPrice(item.id, col.id, e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault()
                                                                        handleAddItem()
                                                                    }
                                                                }}
                                                                placeholder="0,00 ₺"
                                                                style={{
                                                                    height: '32px',
                                                                    fontSize: '12.5px',
                                                                    padding: '4px 10px',
                                                                    textAlign: 'right',
                                                                    fontWeight: 600
                                                                }}
                                                            />
                                                        </td>
                                                    ))}
                                                    {showConditionColumn && (
                                                        <td style={{ padding: '6px 8px' }}>
                                                            <input
                                                                type="text"
                                                                className="form-input"
                                                                value={item.condition || ''}
                                                                onChange={(e) => handleUpdateItem(item.id, 'condition', e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault()
                                                                        handleAddItem()
                                                                    }
                                                                }}
                                                                placeholder="Örn: 8 saat, operatörlü"
                                                                style={{
                                                                    height: '32px',
                                                                    fontSize: '12.5px',
                                                                    padding: '4px 10px'
                                                                }}
                                                            />
                                                        </td>
                                                    )}
                                                    <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                                                        <button
                                                            type="button"
                                                            className="btn-icon danger"
                                                            onClick={() => handleRemoveItem(item.id)}
                                                            title={proposalItems.length > 1 ? "Bu kalemi sil" : "Satırı temizle"}
                                                            style={{ width: '28px', height: '28px', margin: '0 auto' }}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* KDV Notu ve Teklif Şartları (2 Kolon) */}
                            {/* Teklif Şartları */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Teklif Şartları &amp; Hükümler
                                </label>
                                <textarea
                                    rows={3}
                                    className="form-textarea"
                                    value={proposalTerms}
                                    onChange={(e) => setProposalTerms(e.target.value)}
                                    placeholder="Teklif şartları, ödeme koşulları ve İSG sorumlulukları..."
                                    style={{
                                        minHeight: '75px',
                                        fontSize: '12.5px',
                                        lineHeight: 1.5,
                                        padding: '8px 12px'
                                    }}
                                />
                            </div>


                        </div>
                    ) : (
                        /* Standart Belge Şablonları (Sözleşme, Cari Mutabakat, Teslim Tutanağı, Serbest Yazı) */
                        <div style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            {/* Üst Başlık Satırı (Teklif Sekmesi ile Birebir Aynı) */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '16px',
                                borderBottom: '1px solid var(--border-color)',
                                paddingBottom: '14px',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{ flex: 1, minWidth: '260px' }}>
                                    <input 
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        maxLength={120}
                                        placeholder={selectedTemplate.title}
                                        className="form-input"
                                        style={{
                                            fontSize: '16px',
                                            fontWeight: 700,
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase',
                                            height: '38px'
                                        }}
                                    />
                                </div>

                                {/* Belge / Sözleşme No (Varsa) */}
                                {placeholders.contractNo !== undefined && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                                            Sözleşme No:
                                        </span>
                                        <input
                                            type="text"
                                            value={placeholders.contractNo || ''}
                                            onChange={(e) => setPlaceholders(p => ({ ...p, contractNo: e.target.value }))}
                                            placeholder="SOZ-..."
                                            className="form-input"
                                            style={{
                                                width: '140px',
                                                height: '38px',
                                                fontSize: '13px',
                                                fontWeight: 600
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Şirket Kaşe & İmzası Onayı (Teklif Sekmesiyle Aynı) */}
                                {hasStampOrSig && (
                                    <label
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '9px',
                                            height: '38px',
                                            padding: '0 12px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            transition: 'border-color var(--transition-fast)',
                                            flexShrink: 0
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                    >
                                        <Stamp size={15} style={{ color: includeStamp ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                                        <span style={{
                                            fontSize: '12.5px',
                                            fontWeight: 500,
                                            color: includeStamp ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            Kaşe &amp; İmza Alanı
                                        </span>
                                        <span className="toggle-switch" style={{ transform: 'scale(0.72)', transformOrigin: 'center center', margin: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={includeStamp}
                                                onChange={(e) => setIncludeStamp(e.target.checked)}
                                            />
                                            <span className="toggle-slider"></span>
                                        </span>
                                    </label>
                                )}
                            </div>

                            {/* Belge İçerikleri & Bilgileri Grid'i */}
                            {selectedTemplate.placeholders && selectedTemplate.placeholders.filter(p => p.key !== 'contractNo').length > 0 && (
                                <div style={{
                                    background: 'var(--bg-tertiary)',
                                    padding: '14px 16px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Belge İçerikleri
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '10px 14px'
                                    }}>
                                        {selectedTemplate.placeholders
                                            .filter(p => p.key !== 'contractNo')
                                            .map(p => (
                                                <CustomInput
                                                    key={p.key}
                                                    label={p.label}
                                                    type={p.type || 'text'}
                                                    value={placeholders[p.key] || ''}
                                                    onChange={(val) => setPlaceholders(prev => ({ ...prev, [p.key]: val }))}
                                                    maxLength={200}
                                                    style={{ marginBottom: 0 }}
                                                />
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Belge Metni & Maddeleri Düzenleyici */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {selectedTemplate.id === 'customer_contract' ? 'Sözleşme Maddeleri & Şartları' : 
                                         selectedTemplate.id === 'customer_reconciliation' ? 'Mutabakat Metni' : 
                                         selectedTemplate.id === 'customer_delivery' ? 'Tutanak Metni & Notlar' : 'Yazı / Bildirim Metni'}
                                    </label>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                                        Metin doğrudan düzenlenebilir
                                    </span>
                                </div>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    maxLength={10000}
                                    className="form-textarea"
                                    style={{
                                        minHeight: '260px',
                                        fontSize: '13px',
                                        lineHeight: '1.6',
                                        padding: '12px 14px'
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {step === 'stamp-preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <StampSignaturePreview
                        docData={{
                            templateId: selectedTemplate.id,
                            title,
                            content: isProposal ? '' : content,
                            customerName: customer.name,
                            customerAddress: customer.address,
                            customerTax: customer.tax_office ? `${customer.tax_office} / ${customer.tax_number || ''}` : customer.tax_number,
                            companyName: company.name,
                            companyAddress: company.address,
                            companySgk: company.sgk_no,
                            companyTax: company.tax_office ? `${company.tax_office} / ${company.tax_number || ''}` : company.tax_number,
                            placeholders,
                            includeStamp,
                            showSignatures: includeStamp,
                            priceColumns: isProposal ? priceColumns : undefined,
                            showConditionColumn: isProposal ? showConditionColumn : undefined,
                            items: isProposal ? proposalItems : undefined,
                            terms: isProposal ? proposalTerms : undefined
                        }}
                        company={company}
                        settings={stampSettings}
                        onChange={setStampSettings}
                    />
                </div>
            )}
        </Modal>
    )
}
