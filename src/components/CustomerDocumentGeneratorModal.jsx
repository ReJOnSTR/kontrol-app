import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import CustomInput from './CustomInput'
import CustomSelect from './CustomSelect'
import StampSignaturePreview, { STAMP_DEFAULTS } from './StampSignaturePreview'
import { FileText, Download, Check, ArrowLeft, Stamp, Plus, Trash2, X, Truck, RotateCcw, ChevronUp, ChevronDown, Eye } from 'lucide-react'
import { customerDocumentTemplates, DEFAULT_CONTRACT_ANNEX_ITEMS, DEFAULT_CONTRACT_NOTICE, DEFAULT_CONTRACT_ARTICLES } from '../utils/customerDocumentTemplates'
import { formatDate, formatDateForInput, generateUniqueFileName } from '../utils/helpers'

const UNIT_OPTIONS = ['Gün', 'Saat', 'Sefer', 'Adet', 'Ay', 'Hafta', 'İş', 'Ton', 'Metre', 'Takım']

export default function CustomerDocumentGeneratorModal({ isOpen, onClose, customer, company, onSuccess }) {
    const [selectedTemplate, setSelectedTemplate] = useState(customerDocumentTemplates[0])
    const [placeholders, setPlaceholders] = useState({})
    const [content, setContent] = useState('')
    const [title, setTitle] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    // 'edit' | 'preview' | 'stamp-preview'
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
    const [proposalItems, setProposalItems] = useState([])
    const [showConditionColumn, setShowConditionColumn] = useState(false)
    const [proposalTerms, setProposalTerms] = useState('')

    // Contract specific state
    const [includeContractAnnex, setIncludeContractAnnex] = useState(true)
    const [contractAnnexItems, setContractAnnexItems] = useState(DEFAULT_CONTRACT_ANNEX_ITEMS)
    const [contractNotice, setContractNotice] = useState(DEFAULT_CONTRACT_NOTICE)
    const [contractArticles, setContractArticles] = useState(DEFAULT_CONTRACT_ARTICLES)

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
        } else if (selectedTemplate?.id === 'customer_contract') {
            setIncludeContractAnnex(true)
            setContractAnnexItems(DEFAULT_CONTRACT_ANNEX_ITEMS)
            setContractNotice(DEFAULT_CONTRACT_NOTICE)
            setContractArticles(DEFAULT_CONTRACT_ARTICLES)
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
    const isContract = selectedTemplate?.id === 'customer_contract'

    const handleAddAnnexItem = () => {
        const nextId = String(Date.now())
        setContractAnnexItems(prev => [
            ...prev,
            { id: nextId, name: '', dailyPrice: '', monthlyPrice: '' }
        ])
    }

    const handleUpdateAnnexItem = (id, field, value) => {
        setContractAnnexItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
    }

    const handleRemoveAnnexItem = (id) => {
        if (contractAnnexItems.length <= 1) {
            setContractAnnexItems([{ id: 'annex_' + Date.now(), name: '', dailyPrice: '', monthlyPrice: '' }])
            return
        }
        setContractAnnexItems(prev => prev.filter(item => item.id !== id))
    }

    const handleAddVehicleToContractAnnex = (vehicle) => {
        if (!vehicle) return
        const desc = `${vehicle.plate ? vehicle.plate + ' - ' : ''}${vehicle.brand || ''} ${vehicle.model || ''} (${vehicle.type || 'İş Makinası'})`.trim()
        setContractAnnexItems(prev => [
            ...prev,
            { id: 'v_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6), name: desc, dailyPrice: '', monthlyPrice: '' }
        ])
    }

    const handleUpdateArticle = (idx, newText) => {
        setContractArticles(prev => prev.map((art, i) => i === idx ? { ...art, text: newText } : art))
    }

    const handleAddArticle = (defaultText = '') => {
        setContractArticles(prev => {
            const closingIdx = prev.findIndex(a => a.text?.toLowerCase().includes('suret halinde') || a.text?.toLowerCase().includes('ibaret olup'))
            const newArt = {
                num: prev.length + 1,
                text: defaultText || ''
            }
            let updated
            if (closingIdx !== -1 && closingIdx === prev.length - 1) {
                // Kapanış maddesinden hemen önce ekle
                updated = [...prev.slice(0, closingIdx), newArt, prev[closingIdx]]
            } else {
                updated = [...prev, newArt]
            }
            return updated.map((art, i) => ({ ...art, num: i + 1 }))
        })
    }

    const handleRemoveArticle = (idx) => {
        setContractArticles(prev => {
            const filtered = prev.filter((_, i) => i !== idx)
            return filtered.map((art, i) => ({ ...art, num: i + 1 }))
        })
    }

    const handleMoveArticle = (idx, direction) => {
        setContractArticles(prev => {
            const targetIdx = idx + direction
            if (targetIdx < 0 || targetIdx >= prev.length) return prev
            const updated = [...prev]
            const [moved] = updated.splice(idx, 1)
            updated.splice(targetIdx, 0, moved)
            return updated.map((art, i) => ({ ...art, num: i + 1 }))
        })
    }

    const handleResetArticles = () => {
        setContractArticles(DEFAULT_CONTRACT_ARTICLES)
    }

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
                isContract,
                title,
                content: (isProposal || isContract) ? '' : content,
                customerName: customer.name,
                customerAddress: customer.address,
                customerPhone: placeholders.customerPhone || customer.phone || '',
                customerEmail: placeholders.customerEmail || customer.email || '',
                customerTax: customer.tax_office ? `${customer.tax_office} / ${customer.tax_number || ''}` : customer.tax_number,
                customerTaxOffice: customer.tax_office,
                customerTaxNumber: customer.tax_number,
                companyName: company.name || 'SAK PETROL OTOMOTİV TİCARET LİMİTED ŞİRKETİ',
                companyAddress: company.address || 'Atatürk Bul. Şaban Oğlu Mah. No: 304 Tekkeköy/Samsun',
                companyPhone: placeholders.companyPhone || company.phone || '0 (532) 766 75 85',
                companyEmail: placeholders.companyEmail || 'hasan@sakvinc.com.tr',
                companySgk: company.sgk_no,
                companyTax: company.tax_office ? `${company.tax_office} / ${company.tax_number || ''}` : (company.tax_number || '739 005 9946'),
                companyTaxOffice: company.tax_office || '19 Mayıs',
                companyTaxNumber: company.tax_number || '739 005 9946',
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
                // Contract fields
                includeContractAnnex: isContract ? includeContractAnnex : undefined,
                contractAnnexItems: isContract ? contractAnnexItems : undefined,
                contractNotice: isContract ? contractNotice : undefined,
                contractArticles: isContract ? contractArticles : undefined,
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

    let modalFooter = null
    if (step === 'edit') {
        modalFooter = (
            <>
                <button onClick={onClose} className="btn btn-secondary">İptal</button>
                <button
                    type="button"
                    onClick={() => setStep('preview')}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Eye size={16} />
                    Önizleme
                </button>
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
        )
    } else if (step === 'preview') {
        modalFooter = (
            <>
                <button
                    type="button"
                    onClick={() => setStep('edit')}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <ArrowLeft size={16} />
                    Düzenlemeye Dön
                </button>
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
        )
    } else {
        modalFooter = (
            <>
                <button
                    type="button"
                    onClick={() => setStep('edit')}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <ArrowLeft size={16} />
                    Düzenlemeye Dön
                </button>
                <button
                    type="button"
                    onClick={() => setStep('preview')}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Eye size={16} />
                    Önizleme
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
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                step === 'stamp-preview' 
                    ? 'Kaşe & İmza Konumlandırma — PDF Önizleme' 
                    : step === 'preview'
                    ? 'Belge Önizleme (A4)'
                    : 'Müşteri Belgesi Oluştur'
            }
            size={step === 'edit' ? 'xl' : 'fullscreen'}
            bodyStyle={step !== 'edit' ? { display: 'flex', flexDirection: 'column', height: '100%', padding: 0, overflow: 'hidden' } : undefined}
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
                                            {proposalItems.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={priceColumns.length + (showConditionColumn ? 3 : 2)}
                                                        style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)' }}
                                                    >
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 500 }}>Henüz teklif kalemi eklenmedi.</p>
                                                            <button
                                                                type="button"
                                                                onClick={handleAddItem}
                                                                className="btn btn-secondary"
                                                                style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                            >
                                                                <Plus size={14} /> İlk Kalemi Ekle
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                proposalItems.map((item, index) => (
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
                                                                title="Bu kalemi sil"
                                                                style={{ width: '28px', height: '28px', margin: '0 auto' }}
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
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
                    ) : isContract ? (
                        /* Özel İş Makinası Kira Sözleşmesi Derleyicisi (1-4 Sayfa Bütünleşik) */
                        <div style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            {/* Üst Başlık Satırı & Kaşe & İmza Toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '260px' }}>
                                    <input 
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        maxLength={140}
                                        placeholder="SAK PETROL OTOMATİV LTD. ŞTİ. İŞ MAKİNASI KİRA SÖZLEŞMESİ"
                                        className="form-input"
                                        style={{
                                            fontSize: '15px',
                                            fontWeight: 700,
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase',
                                            height: '38px'
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Sözleşme No:</span>
                                    <input
                                        type="text"
                                        value={placeholders.contractNo || ''}
                                        onChange={(e) => setPlaceholders(p => ({ ...p, contractNo: e.target.value }))}
                                        placeholder="SOZ-2026-..."
                                        className="form-input"
                                        style={{
                                            width: '150px',
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
                                            flexShrink: 0
                                        }}
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

                            {/* 1. KART: TARAFLARA İLİŞKİN BİLGİLER (Sayfa 1) */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                padding: '16px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    1. Taraflara İlişkin Bilgiler (Sayfa 1)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                                    {/* KİRALAYAN */}
                                    <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>KİRALAYAN (FİRMA)</span>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{company?.name || 'SAK PETROL OTOMOTİV TİCARET LİMİTED ŞİRKETİ'}</div>
                                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{company?.address || 'Atatürk Bul. Şaban Oğlu Mah. No: 304 Tekkeköy/Samsun'}</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                                            <CustomInput
                                                label="Telefon"
                                                value={placeholders.companyPhone || '0 (532) 766 75 85'}
                                                onChange={(val) => setPlaceholders(p => ({ ...p, companyPhone: val }))}
                                                style={{ marginBottom: 0 }}
                                            />
                                            <CustomInput
                                                label="E-Posta"
                                                value={placeholders.companyEmail || 'hasan@sakvinc.com.tr'}
                                                onChange={(val) => setPlaceholders(p => ({ ...p, companyEmail: val }))}
                                                style={{ marginBottom: 0 }}
                                            />
                                        </div>
                                    </div>
                                    {/* KİRACI */}
                                    <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>KİRACI (MÜŞTERİ)</span>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{customer?.name}</div>
                                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{customer?.address || '-'}</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                                            <CustomInput
                                                label="Telefon"
                                                value={placeholders.customerPhone !== undefined ? placeholders.customerPhone : (customer.phone || '')}
                                                onChange={(val) => setPlaceholders(p => ({ ...p, customerPhone: val }))}
                                                style={{ marginBottom: 0 }}
                                            />
                                            <CustomInput
                                                label="E-Posta"
                                                value={placeholders.customerEmail !== undefined ? placeholders.customerEmail : (customer.email || '')}
                                                onChange={(val) => setPlaceholders(p => ({ ...p, customerEmail: val }))}
                                                style={{ marginBottom: 0 }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. KART: SÖZLEŞME TARİHLERİ VE ÖDEME KOŞULLARI (Sayfa 2) */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                padding: '16px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    2. Tarih ve Ödeme Şartları (Sayfa 2)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px 14px' }}>
                                    <CustomInput
                                        label="Sözleşme Başlama Tarihi"
                                        type="date"
                                        value={placeholders.startDate || ''}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, startDate: val }))}
                                        style={{ marginBottom: 0 }}
                                    />
                                    <CustomInput
                                        label="İşe Başlama Tarihi"
                                        type="date"
                                        value={placeholders.workStartDate || ''}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, workStartDate: val }))}
                                        style={{ marginBottom: 0 }}
                                    />
                                    <CustomInput
                                        label="İşi Bitirme Tarihi"
                                        type="date"
                                        value={placeholders.workEndDate || ''}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, workEndDate: val }))}
                                        style={{ marginBottom: 0 }}
                                    />
                                    <CustomInput
                                        label="Ödeme Vadesi (İş Günü)"
                                        value={placeholders.paymentDays || '20'}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, paymentDays: val }))}
                                        placeholder="20"
                                        style={{ marginBottom: 0 }}
                                    />
                                    <CustomInput
                                        label="Banka Adı"
                                        value={placeholders.bankName || 'HALK BANKASI'}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, bankName: val }))}
                                        style={{ marginBottom: 0 }}
                                    />
                                    <CustomInput
                                        label="Banka IBAN No"
                                        value={placeholders.bankIban || 'TR68 0001 2001 3860 0010 1005 09'}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, bankIban: val }))}
                                        style={{ marginBottom: 0 }}
                                    />
                                </div>
                            </div>

                            {/* 3. KART: ÇALIŞMA VE ÖZEL ŞART PARAMETRELERİ */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                padding: '16px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    3. Çalışma &amp; Mesai Parametreleri
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px 14px' }}>
                                    <CustomInput
                                        label="Çalışma Süresi (Ay)"
                                        value={placeholders.rentalDurationMonths || '3'}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, rentalDurationMonths: val }))}
                                        placeholder="3"
                                        style={{ marginBottom: 0 }}
                                    />
                                    <CustomInput
                                        label="Aylık Çalışma Günü"
                                        value={placeholders.monthlyWorkingDays || '26'}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, monthlyWorkingDays: val }))}
                                        placeholder="26"
                                        style={{ marginBottom: 0 }}
                                    />
                                    <CustomInput
                                        label="Günlük Çalışma Saati"
                                        value={placeholders.dailyWorkingHours || '8'}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, dailyWorkingHours: val }))}
                                        placeholder="8"
                                        style={{ marginBottom: 0 }}
                                    />
                                    <CustomInput
                                        label="Mesai Saat Aralığı"
                                        value={placeholders.workingHoursRange || '08:00/17:00'}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, workingHoursRange: val }))}
                                        placeholder="08:00/17:00"
                                        style={{ marginBottom: 0 }}
                                    />
                                    <CustomInput
                                        label="Pazar &amp; Fazla Mesai Farkı (%)"
                                        value={placeholders.overtimeRate || '50'}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, overtimeRate: val }))}
                                        placeholder="50"
                                        style={{ marginBottom: 0 }}
                                    />
                                    <CustomInput
                                        label="Yetkili Mahkeme / İl"
                                        value={placeholders.legalCity || 'SAMSUN'}
                                        onChange={(val) => setPlaceholders(p => ({ ...p, legalCity: val }))}
                                        placeholder="SAMSUN"
                                        style={{ marginBottom: 0 }}
                                    />
                                </div>
                            </div>

                            {/* 4. KART: SÖZLEŞME EKLERİ (İŞ MAKİNALARI FİYAT LİSTESİ TABLOSU - SAYFA 4) */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                padding: '16px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '14px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            4. Sözleşme Ekleri (Fiyat Listesi Tablosu — Sayfa 4)
                                        </div>
                                    </div>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: includeContractAnnex ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                            {includeContractAnnex ? 'Ek Tablosu Dahil (4 Sayfa)' : 'Ek Tablosu Hariç (3 Sayfa)'}
                                        </span>
                                        <span className="toggle-switch" style={{ transform: 'scale(0.72)', transformOrigin: 'center center', margin: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={includeContractAnnex}
                                                onChange={(e) => setIncludeContractAnnex(e.target.checked)}
                                            />
                                            <span className="toggle-slider"></span>
                                        </span>
                                    </label>
                                </div>

                                {includeContractAnnex && (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                                {contractAnnexItems.length} adet iş makinesi listeleniyor. Fiyatları doğrudan düzenleyebilirsiniz.
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {vehicles.length > 0 && (
                                                    <CustomSelect
                                                        placeholder="+ Filodan Araç Ekle"
                                                        options={vehicles.map(v => ({
                                                            value: String(v.id),
                                                            label: `${v.plate ? v.plate + ' - ' : ''}${v.brand || ''} ${v.model || ''} (${v.type || 'İş Makinası'})`.trim()
                                                        }))}
                                                        value=""
                                                        onChange={(vId) => {
                                                            const found = vehicles.find(v => String(v.id) === String(vId))
                                                            if (found) handleAddVehicleToContractAnnex(found)
                                                        }}
                                                        style={{ width: '200px', marginBottom: 0 }}
                                                    />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleAddAnnexItem}
                                                    className="btn btn-secondary"
                                                    style={{ height: '34px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px' }}
                                                >
                                                    <Plus size={14} />
                                                    <span>Yeni Kalem Ekle</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{
                                            maxHeight: '340px',
                                            overflowY: 'auto',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            background: 'var(--bg-secondary)'
                                        }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                <thead>
                                                    <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                                        <th style={{ width: '40px', padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>#</th>
                                                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>İş Makinaları</th>
                                                        <th style={{ width: '150px', padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Günlük (₺)</th>
                                                        <th style={{ width: '150px', padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Aylık (₺)</th>
                                                        <th style={{ width: '44px', padding: '8px 8px', textAlign: 'center' }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {contractAnnexItems.map((item, idx) => (
                                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                            <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{idx + 1}</td>
                                                            <td style={{ padding: '6px 10px' }}>
                                                                <input
                                                                    type="text"
                                                                    className="form-input"
                                                                    value={item.name || ''}
                                                                    onChange={(e) => handleUpdateAnnexItem(item.id, 'name', e.target.value)}
                                                                    placeholder="Örn: 35 TON HİYAP VİNÇ"
                                                                    style={{ height: '32px', fontSize: '12px' }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '6px 10px' }}>
                                                                <input
                                                                    type="text"
                                                                    className="form-input"
                                                                    value={item.dailyPrice || ''}
                                                                    onChange={(e) => handleUpdateAnnexItem(item.id, 'dailyPrice', e.target.value)}
                                                                    placeholder="₺ 15.000,00"
                                                                    style={{ height: '32px', fontSize: '12px', textAlign: 'right' }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '6px 10px' }}>
                                                                <input
                                                                    type="text"
                                                                    className="form-input"
                                                                    value={item.monthlyPrice || ''}
                                                                    onChange={(e) => handleUpdateAnnexItem(item.id, 'monthlyPrice', e.target.value)}
                                                                    placeholder="₺ 235.000,00"
                                                                    style={{ height: '32px', fontSize: '12px', textAlign: 'right' }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveAnnexItem(item.id)}
                                                                    className="btn btn-ghost"
                                                                    title="Sil"
                                                                    style={{ padding: '4px', color: 'var(--danger-color, #ef4444)' }}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* 5. KART: TEBLİGAT NOTU VE ÖZEL ŞARTLAR METNİ */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                padding: '16px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        5. Tebligat Hükmü ve Özel Şart Maddeleri ({contractArticles.length} Madde)
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={handleResetArticles}
                                            title="Tüm maddeleri varsayılan 14 maddeye sıfırla"
                                            style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                                        >
                                            <RotateCcw size={12} />
                                            Varsayılana Sıfırla
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleAddArticle('')}
                                            style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}
                                        >
                                            <Plus size={13} />
                                            Yeni Madde Ekle
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Tebligat ve Geçerlilik Hükmü (Sayfa 1 NOT Metni)
                                    </label>
                                    <textarea
                                        className="form-textarea"
                                        value={contractNotice}
                                        onChange={(e) => setContractNotice(e.target.value)}
                                        rows={3}
                                        style={{ fontSize: '12px', lineHeight: 1.6 }}
                                    />
                                </div>

                                {/* Hızlı Şablon Maddeleri */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '2px' }}>
                                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Örnek Madde Şablonları:
                                    </span>
                                    {[
                                        { label: '+ Nakliye Masrafları', text: 'Kiralanan makine ve aparatların çalışma sahasına nakliyesi ile iş bitiminde tahliyesi masrafları kiracı firmaya aittir.' },
                                        { label: '+ Şantiye Güvenliği & İzinler', text: 'Çalışma sahası ve çevresinde gerekli tüm iş güvenliği tedbirlerinin alınması, trafik izinleri ve şantiye emniyeti kiracı sorumluluğundadır.' },
                                        { label: '+ Gecikme Faizi', text: 'Kira bedeli faturalarının vadesinde ödenmemesi halinde aylık %5 kanuni temerrüt ve gecikme faizi uygulanacaktır.' },
                                        { label: '+ Zemin ve Yol Emniyeti', text: 'Makinanın çalışacağı zeminin ve intikal yollarının tonaja uygun sağlamlıkta olması kiracı firma güvencesindedir.' }
                                    ].map((tpl, tIdx) => (
                                        <button
                                            key={tIdx}
                                            type="button"
                                            onClick={() => handleAddArticle(tpl.text)}
                                            className="badge"
                                            style={{
                                                cursor: 'pointer',
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-color)',
                                                color: 'var(--text-secondary)',
                                                fontSize: '10.5px',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                transition: 'all 0.15s ease'
                                            }}
                                            title="Bu maddeyi yeni madde olarak ekle"
                                        >
                                            {tpl.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Maddeler Listesi */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                    {contractArticles.map((art, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '6px',
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '8px',
                                                padding: '10px 12px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '50%',
                                                        background: 'var(--accent-subtle)',
                                                        color: 'var(--accent-primary)',
                                                        fontSize: '10.5px',
                                                        fontWeight: 800
                                                    }}>
                                                        {idx + 1}
                                                    </span>
                                                    Madde {idx + 1}
                                                </span>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        disabled={idx === 0}
                                                        onClick={() => handleMoveArticle(idx, -1)}
                                                        title="Yukarı Taşı"
                                                        style={{ padding: '2px 5px', opacity: idx === 0 ? 0.3 : 1 }}
                                                    >
                                                        <ChevronUp size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        disabled={idx === contractArticles.length - 1}
                                                        onClick={() => handleMoveArticle(idx, 1)}
                                                        title="Aşağı Taşı"
                                                        style={{ padding: '2px 5px', opacity: idx === contractArticles.length - 1 ? 0.3 : 1 }}
                                                    >
                                                        <ChevronDown size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm text-danger"
                                                        onClick={() => handleRemoveArticle(idx)}
                                                        title="Bu Maddeyi Sil"
                                                        style={{ padding: '2px 5px' }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>

                                            <textarea
                                                className="form-textarea"
                                                value={art.text}
                                                onChange={(e) => handleUpdateArticle(idx, e.target.value)}
                                                rows={2}
                                                placeholder={`Madde ${idx + 1} metnini yazın...`}
                                                style={{ fontSize: '11.5px', lineHeight: 1.5, background: 'var(--bg-secondary)' }}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4px' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleAddArticle('')}
                                        style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 14px' }}
                                    >
                                        <Plus size={13} />
                                        + Yeni Madde Ekle
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Standart Belge Şablonları (Cari Mutabakat, Teslim Tutanağı, Serbest Yazı) */
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

                                {/* Şirket Kaşe & İmzası Onayı */}
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
                                        {selectedTemplate.id === 'customer_reconciliation' ? 'Mutabakat Metni' : 
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

            {(step === 'preview' || step === 'stamp-preview') && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', width: '100%', overflow: 'hidden' }}>
                    <StampSignaturePreview
                        docData={{
                            templateId: selectedTemplate.id,
                            isContract,
                            title,
                            content: (isProposal || isContract) ? '' : content,
                            customerName: customer.name,
                            customerAddress: customer.address,
                            customerPhone: placeholders.customerPhone || customer.phone || '',
                            customerEmail: placeholders.customerEmail || customer.email || '',
                            customerTax: customer.tax_office ? `${customer.tax_office} / ${customer.tax_number || ''}` : customer.tax_number,
                            customerTaxOffice: customer.tax_office,
                            customerTaxNumber: customer.tax_number,
                            companyName: company.name || 'SAK PETROL OTOMOTİV TİCARET LİMİTED ŞİRKETİ',
                            companyAddress: company.address || 'Atatürk Bul. Şaban Oğlu Mah. No: 304 Tekkeköy/Samsun',
                            companyPhone: placeholders.companyPhone || company.phone || '0 (532) 766 75 85',
                            companyEmail: placeholders.companyEmail || 'hasan@sakvinc.com.tr',
                            companySgk: company.sgk_no,
                            companyTax: company.tax_office ? `${company.tax_office} / ${company.tax_number || ''}` : (company.tax_number || '739 005 9946'),
                            companyTaxOffice: company.tax_office || '19 Mayıs',
                            companyTaxNumber: company.tax_number || '739 005 9946',
                            includeStamp,
                            showSignatures: includeStamp,
                            companySignaturePath: includeStamp ? company.signature_path : null,
                            companyStampPath: includeStamp ? company.stamp_path : null,
                            placeholders,
                            stampSettings,
                            priceColumns: isProposal ? priceColumns : undefined,
                            showConditionColumn: isProposal ? showConditionColumn : undefined,
                            items: isProposal ? proposalItems : undefined,
                            terms: isProposal ? proposalTerms : undefined,
                            includeContractAnnex: isContract ? includeContractAnnex : undefined,
                            contractAnnexItems: isContract ? contractAnnexItems : undefined,
                            contractNotice: isContract ? contractNotice : undefined,
                            contractArticles: isContract ? contractArticles : undefined,
                        }}
                        company={company}
                        settings={stampSettings}
                        onChange={setStampSettings}
                        previewOnly={step === 'preview'}
                    />
                </div>
            )}
        </Modal>
    )
}
