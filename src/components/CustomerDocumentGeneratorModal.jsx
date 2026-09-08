import { useState, useEffect } from 'react'
import Modal from './Modal'
import CustomInput from './CustomInput'
import StampSignaturePreview, { STAMP_DEFAULTS } from './StampSignaturePreview'
import { FileText, Download, Check, ArrowLeft, Stamp } from 'lucide-react'
import { customerDocumentTemplates } from '../utils/customerDocumentTemplates'
import { formatDate, formatDateForInput, generateUniqueFileName } from '../utils/helpers'

export default function CustomerDocumentGeneratorModal({ isOpen, onClose, customer, company, onSuccess }) {
    const [selectedTemplate, setSelectedTemplate] = useState(customerDocumentTemplates[0])
    const [placeholders, setPlaceholders] = useState({})
    const [content, setContent] = useState('')
    const [title, setTitle] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    // 'edit' | 'stamp-preview'
    const [step, setStep] = useState('edit')
    const [stampSettings, setStampSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('lastStampSettings')
            return saved ? { ...STAMP_DEFAULTS, ...JSON.parse(saved) } : STAMP_DEFAULTS
        } catch (e) {
            return STAMP_DEFAULTS
        }
    })
    const [generatingMode, setGeneratingMode] = useState(null) // 'silent' | 'download' | null

    useEffect(() => {
        localStorage.setItem('lastStampSettings', JSON.stringify(stampSettings))
    }, [stampSettings])

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
        if (selectedTemplate) {
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
        if (!isOpen) setStep('edit')
    }, [isOpen])

    const handleGenerate = async (isSilent = false) => {
        setGeneratingMode(isSilent ? 'silent' : 'download')
        setIsGenerating(true)
        try {
            const printData = {
                templateId: selectedTemplate.id,
                title,
                content,
                customerName: customer.name,
                companyName: company.name,
                companyAddress: company.address,
                companySgk: company.sgk_no,
                companyTax: company.tax_office ? `${company.tax_office} / ${company.tax_number || ''}` : company.tax_number,
                companySignaturePath: company.signature_path,
                companyStampPath: company.stamp_path,
                placeholders,
                stampSettings,
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
            {hasStampOrSig && (
                <button
                    type="button"
                    onClick={() => setStep('stamp-preview')}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Stamp size={16} />
                    Kaşe &amp; İmza Ayarla
                </button>
            )}
            <button 
                type="button"
                onClick={() => handleGenerate(true)} 
                disabled={isGenerating} 
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
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
                <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px' }}>
                    {/* Sol Panel: Şablon Seçimi */}
                    <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                            Şablon Seçin
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {customerDocumentTemplates.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedTemplate(t)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        textAlign: 'left',
                                        border: '1px solid transparent',
                                        transition: 'all 0.2s',
                                        background: selectedTemplate.id === t.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                        color: selectedTemplate.id === t.id ? '#fff' : 'var(--text-primary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <FileText size={16} />
                                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{t.name}</span>
                                    {selectedTemplate.id === t.id && <Check size={14} style={{ marginLeft: 'auto' }} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sağ Panel: Düzenleme */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Değişken Girişleri */}
                        <div style={{ 
                            background: 'var(--bg-tertiary)', 
                            padding: '16px', 
                            borderRadius: '12px', 
                            border: '1px solid var(--border-color)',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '12px 16px'
                        }}>
                            <div style={{ gridColumn: '1 / -1', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>
                                Belge Değişkenleri
                            </div>
                            {selectedTemplate.placeholders.map(p => (
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

                        {/* Metin Önizleme */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Belge İçeriği
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--accent-primary)', background: 'var(--accent-subtle)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                    Düzenlenebilir Alan
                                </div>
                            </div>
                            
                            <div style={{ 
                                background: 'var(--bg-secondary)', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '12px', 
                                padding: '24px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <input 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    maxLength={120}
                                    style={{
                                        width: '100%',
                                        textAlign: 'center',
                                        fontSize: '18px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        border: 'none',
                                        borderBottom: '1px dashed var(--border-color)',
                                        background: 'transparent',
                                        color: 'var(--text-primary)',
                                        paddingBottom: '10px',
                                        outline: 'none'
                                    }}
                                />
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    maxLength={10000}
                                    style={{
                                        width: '100%',
                                        minHeight: '280px',
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        fontSize: '14px',
                                        lineHeight: '1.6',
                                        color: 'var(--text-primary)',
                                        resize: 'none',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {step === 'stamp-preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <StampSignaturePreview
                        docData={{
                            templateId: selectedTemplate.id,
                            title,
                            content,
                            customerName: customer.name,
                            companyName: company.name,
                            companyAddress: company.address,
                            companySgk: company.sgk_no,
                            companyTax: company.tax_office ? `${company.tax_office} / ${company.tax_number || ''}` : company.tax_number,
                            placeholders,
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
