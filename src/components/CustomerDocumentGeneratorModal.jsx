import React, { useState, useEffect } from 'react'
import Modal from './Modal'
import CustomInput from './CustomInput'
import StampSignaturePreview, { STAMP_DEFAULTS } from './StampSignaturePreview'
import { FileText, Download, Check, ArrowLeft, Stamp, Plus, Trash2, FileCheck, Layers, Calendar, DollarSign, Building2 } from 'lucide-react'
import { customerDocumentTemplates } from '../utils/customerDocumentTemplates'
import { formatDate, formatDateForInput, generateUniqueFileName } from '../utils/helpers'

export default function CustomerDocumentGeneratorModal({ isOpen, onClose, customer, company, folders = [], onSuccess }) {
    const [selectedTemplate, setSelectedTemplate] = useState(customerDocumentTemplates[0])
    const [placeholders, setPlaceholders] = useState({})
    const [content, setContent] = useState('')
    const [title, setTitle] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatingMode, setGeneratingMode] = useState(null) // 'silent' | 'download' | null
    const [selectedFolder, setSelectedFolder] = useState('')
    const [step, setStep] = useState('edit') // 'edit' | 'stamp-preview'

    // Proposal specific state
    const [proposalItems, setProposalItems] = useState([])
    const [vatRate, setVatRate] = useState(20)
    const [termsText, setTermsText] = useState('')

    // Contract specific state
    const [renderedArticles, setRenderedArticles] = useState([])

    // Stamp & Signature state
    const [stampSettings, setStampSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('lastStampSettings')
            return saved ? { ...STAMP_DEFAULTS, ...JSON.parse(saved) } : STAMP_DEFAULTS
        } catch (e) {
            return STAMP_DEFAULTS
        }
    })

    useEffect(() => {
        localStorage.setItem('lastStampSettings', JSON.stringify(stampSettings))
    }, [stampSettings])

    // Reset step & initialize template when modal opens or template changes
    useEffect(() => {
        if (!isOpen) {
            setStep('edit')
            return
        }

        if (selectedTemplate && customer && company) {
            const initialPlaceholders = {}
            
            // Common customer & company placeholders
            initialPlaceholders.customerName = customer.name || ''
            initialPlaceholders.customerAddress = customer.address || ''
            initialPlaceholders.customerTax = customer.tax_number ? `${customer.tax_office ? customer.tax_office + ' / ' : ''}${customer.tax_number}` : ''
            initialPlaceholders.customerPhone = customer.phone || ''
            initialPlaceholders.customerEmail = customer.email || ''

            initialPlaceholders.companyName = company.name || ''
            initialPlaceholders.companyAddress = company.address || ''
            initialPlaceholders.companyTax = company.tax_office ? `${company.tax_office} / ${company.tax_number || ''}` : (company.tax_number || '')
            initialPlaceholders.companyPhone = company.phone || ''
            initialPlaceholders.companyEmail = company.email || ''

            // Template-specific defaults
            selectedTemplate.placeholders?.forEach(p => {
                if (typeof p.default === 'function') {
                    initialPlaceholders[p.key] = p.default()
                } else if (p.default === 'today') {
                    initialPlaceholders[p.key] = new Date().toISOString().split('T')[0]
                } else if (p.default === 'today+3m') {
                    const d = new Date()
                    d.setMonth(d.getMonth() + 3)
                    initialPlaceholders[p.key] = d.toISOString().split('T')[0]
                } else {
                    initialPlaceholders[p.key] = p.default || ''
                }
            })

            // Customer details autofill
            if (customer.contact_person) {
                initialPlaceholders.attentionPerson = customer.contact_person
            }
            if (customer.balance !== undefined) {
                const bal = Number(customer.balance) || 0
                initialPlaceholders.balanceAmount = Math.abs(bal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })
                initialPlaceholders.balanceType = bal > 0 ? 'BORÇ (Alacağımız)' : (bal < 0 ? 'ALACAK (Borcumuz)' : 'SIFIR (0,00 ₺)')
            }

            setPlaceholders(initialPlaceholders)
            setTitle(selectedTemplate.title)

            // Setup proposal items
            if (selectedTemplate.type === 'proposal') {
                setProposalItems(selectedTemplate.defaultItems ? JSON.parse(JSON.stringify(selectedTemplate.defaultItems)) : [])
                setVatRate(selectedTemplate.vatRate ?? 20)
                setTermsText(selectedTemplate.terms || '')
            }

            // Setup contract articles
            if (selectedTemplate.type === 'contract' && selectedTemplate.articles) {
                setRenderedArticles(JSON.parse(JSON.stringify(selectedTemplate.articles)))
            }
        }
    }, [isOpen, selectedTemplate, customer, company])

    // Update contract articles content dynamically when placeholders change
    useEffect(() => {
        if (selectedTemplate.type === 'contract' && selectedTemplate.articles) {
            const updated = selectedTemplate.articles.map(art => {
                let artContent = art.content
                Object.entries(placeholders).forEach(([k, v]) => {
                    const displayVal = k.toLowerCase().includes('date') && v ? formatDate(v) : v
                    artContent = artContent.replace(new RegExp(`{{${k}}}`, 'g'), displayVal || `[${k}]`)
                })
                return { ...art, renderedContent: artContent }
            })
            setRenderedArticles(updated)
        }
    }, [placeholders, selectedTemplate])

    // Update general content for plain/reconciliation/custom templates
    useEffect(() => {
        if (selectedTemplate.content) {
            let newContent = selectedTemplate.content
            Object.entries(placeholders).forEach(([k, v]) => {
                const displayVal = k.toLowerCase().includes('date') && v ? formatDate(v) : v
                newContent = newContent.replace(new RegExp(`{{${k}}}`, 'g'), displayVal || `[${k}]`)
            })
            setContent(newContent)
        }
    }, [placeholders, selectedTemplate])

    // Proposal item handlers
    const handleAddItem = () => {
        setProposalItems(prev => [
            ...prev,
            { description: '', quantity: 1, unit: 'Adet', unitPrice: 0, total: 0 }
        ])
    }

    const handleUpdateItem = (index, field, value) => {
        setProposalItems(prev => {
            const updated = [...prev]
            const current = { ...updated[index], [field]: value }
            if (field === 'quantity' || field === 'unitPrice') {
                const qty = Number(field === 'quantity' ? value : current.quantity) || 0
                const price = Number(field === 'unitPrice' ? value : current.unitPrice) || 0
                current.total = qty * price
            }
            updated[index] = current
            return updated
        })
    }

    const handleRemoveItem = (index) => {
        setProposalItems(prev => prev.filter((_, i) => i !== index))
    }

    // Calculations for proposal
    const subtotal = proposalItems.reduce((acc, it) => acc + (Number(it.total) || ((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0))), 0)
    const vatAmount = subtotal * (Number(vatRate) / 100)
    const grandTotal = subtotal + vatAmount

    // Placeholder change handler
    const handlePlaceholderChange = (key, value) => {
        setPlaceholders(prev => ({ ...prev, [key]: value }))
    }

    // Build print data object
    const buildPrintData = () => {
        return {
            docCategory: 'customer',
            templateId: selectedTemplate.id,
            title,
            content,
            customerName: customer.name,
            customerAddress: customer.address,
            customerTax: customer.tax_number ? `${customer.tax_office ? customer.tax_office + ' / ' : ''}${customer.tax_number}` : '',
            customerPhone: customer.phone,
            customerEmail: customer.email,
            companyName: company.name,
            companyAddress: company.address,
            companySgk: company.sgk_no,
            companyTax: company.tax_office ? `${company.tax_office} / ${company.tax_number || ''}` : company.tax_number,
            companySignaturePath: company.signature_path,
            companyStampPath: company.stamp_path,
            placeholders,
            stampSettings,
            // Proposal specifics
            items: proposalItems,
            vatRate,
            subtotal,
            vatAmount,
            grandTotal,
            terms: termsText,
            // Contract specifics
            articles: renderedArticles
        }
    }

    // Generator handler
    const handleGenerate = async (isSilent = false) => {
        setGeneratingMode(isSilent ? 'silent' : 'download')
        setIsGenerating(true)
        try {
            const printData = buildPrintData()
            localStorage.setItem('printDocData', JSON.stringify(printData))

            const custStr = customer?.name?.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/g, '_') || 'Musteri'
            const docTitleStr = selectedTemplate?.name?.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/g, '_') || 'Belge'
            const defaultFileName = generateUniqueFileName(custStr, [docTitleStr], 'pdf')

            const result = await window.electronAPI.saveReportPdf('/print-document', { silent: isSilent, defaultPath: defaultFileName })
            
            if (result && result.success && result.filePath) {
                if (isSilent) {
                    const ext = 'pdf'
                    const baseName = result.filePath.split('/').pop().split('\\').pop()
                    const docName = baseName || `${docTitleStr}.pdf`

                    try {
                        const createResult = await window.electronAPI.addDocument({
                            relatedType: 'customer',
                            relatedId: customer.id,
                            companyId: company.id,
                            fileName: docName,
                            filePath: result.filePath,
                            fileType: ext,
                            category: selectedTemplate.category || 'Sözleşme & Teklif',
                            docType: selectedTemplate.name,
                            folder: selectedFolder || null,
                            startDate: placeholders.startDate || placeholders.proposalDate || placeholders.reconciliationDate || new Date().toISOString().split('T')[0],
                            endDate: placeholders.endDate || null
                        })

                        if (createResult.success) {
                            if (onSuccess) onSuccess()
                            onClose()
                        } else {
                            alert('Belge oluşturuldu ancak veritabanına eklenemedi: ' + createResult.error)
                        }
                    } catch (err) {
                        console.error('Failed to save customer document record:', err)
                        alert('Belge oluşturuldu ancak kayıt listesine eklenirken hata oluştu.')
                    }
                } else {
                    alert('PDF belgesi başarıyla bilgisayarınıza kaydedildi.')
                }
            } else if (result && !result.success && !result.canceled) {
                alert('Belge oluşturulurken hata meydana geldi: ' + result.error)
            }
        } catch (error) {
            console.error('Failed to generate document:', error)
            alert('Belge oluşturma hatası: ' + error.message)
        } finally {
            setIsGenerating(false)
            setGeneratingMode(null)
        }
    }

    if (!isOpen) return null

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, var(--accent-primary) 0%, #4f46e5 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                    }}>
                        <FileText size={18} />
                    </div>
                    <div>
                        <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Müşteri Belgesi Oluştur (Sözleşme / Teklif)
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {customer?.name} &bull; {company?.name}
                        </div>
                    </div>
                </div>
            }
            size="xl"
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                        {step === 'stamp-preview' && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setStep('edit')}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <ArrowLeft size={16} /> Bilgileri Düzenle
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isGenerating}>
                            İptal
                        </button>
                        
                        {step === 'edit' ? (
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setStep('stamp-preview')}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Stamp size={16} /> Kaşe / İmza Ayarları & Önizle
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => handleGenerate(false)}
                                    disabled={isGenerating}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Download size={16} />
                                    {generatingMode === 'download' ? 'PDF İndiriliyor...' : 'PDF Olarak İndir'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleGenerate(true)}
                                    disabled={isGenerating}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Check size={16} />
                                    {generatingMode === 'silent' ? 'Kaydediliyor...' : 'Müşteri Belgelerine Kaydet'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            }
        >
            {step === 'stamp-preview' ? (
                <div>
                    <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'var(--accent-subtle)', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Stamp size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                            Firma kaşesi ve imzanızı sağ alt onay kutucuğunda veya serbest modda konumlandırabilirsiniz. Belge kaydedildiğinde doğrudan bu pozisyonda render edilecektir.
                        </span>
                    </div>
                    <StampSignaturePreview
                        settings={stampSettings}
                        onChange={setStampSettings}
                        company={company}
                        docItem={buildPrintData()}
                    />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Şablon Seçici Kartlar */}
                    <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                            Belge Şablonu Seçin:
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            {customerDocumentTemplates.map(tmpl => {
                                const isSel = selectedTemplate.id === tmpl.id
                                return (
                                    <div
                                        key={tmpl.id}
                                        onClick={() => setSelectedTemplate(tmpl)}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: '10px',
                                            border: isSel ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                            background: isSel ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: isSel ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                                {tmpl.name}
                                            </span>
                                            <span className="badge" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                                {tmpl.category}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                                            {tmpl.description}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Belge Başlığı & Hedef Klasör */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                                Belge Başlığı
                            </label>
                            <CustomInput
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Örn: FİYAT TEKLİFİ, HİZMET SÖZLEŞMESİ"
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                                Kaydedilecek Klasör
                            </label>
                            <select
                                className="custom-input"
                                value={selectedFolder}
                                onChange={e => setSelectedFolder(e.target.value)}
                                style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                            >
                                <option value="">Klasörsüz (Kök Dizin)</option>
                                {folders.map(f => (
                                    <option key={f.id || f.value} value={f.value}>
                                        {f.label || f.value}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Şablon Özel Alanları */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Layers size={16} /> {selectedTemplate.name} Parametreleri
                        </div>

                        {/* FİYAT TEKLİFİ DİNAMİK ALANLARI */}
                        {selectedTemplate.type === 'proposal' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Teklif No</label>
                                        <CustomInput value={placeholders.proposalNo || ''} onChange={e => handlePlaceholderChange('proposalNo', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Teklif Tarihi</label>
                                        <CustomInput type="date" value={placeholders.proposalDate || ''} onChange={e => handlePlaceholderChange('proposalDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Geçerlilik Süresi</label>
                                        <CustomInput value={placeholders.validityDays || ''} onChange={e => handlePlaceholderChange('validityDays', e.target.value)} placeholder="15 Gün" />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Müşteri İlgilisi</label>
                                        <CustomInput value={placeholders.attentionPerson || ''} onChange={e => handlePlaceholderChange('attentionPerson', e.target.value)} placeholder="Ahmet Yılmaz" />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Hazırlayan Yetkili</label>
                                        <CustomInput value={placeholders.preparedBy || ''} onChange={e => handlePlaceholderChange('preparedBy', e.target.value)} placeholder={company?.name} />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Proje / İş Konusu</label>
                                        <CustomInput value={placeholders.projectSubject || ''} onChange={e => handlePlaceholderChange('projectSubject', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Hizmet Yeri / Saha</label>
                                        <CustomInput value={placeholders.workLocation || ''} onChange={e => handlePlaceholderChange('workLocation', e.target.value)} placeholder="Şantiye adresi" />
                                    </div>
                                </div>

                                {/* Kalemler Tablosu Düzenleyici */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            Teklif Kalemleri (Hizmet & Malzeme)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleAddItem}
                                            className="btn btn-secondary btn-sm"
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Plus size={14} /> Yeni Kalem Ekle
                                        </button>
                                    </div>

                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                                <th style={{ padding: '8px' }}>Açıklama</th>
                                                <th style={{ padding: '8px', width: '80px' }}>Miktar</th>
                                                <th style={{ padding: '8px', width: '90px' }}>Birim</th>
                                                <th style={{ padding: '8px', width: '120px' }}>Birim Fiyat (₺)</th>
                                                <th style={{ padding: '8px', width: '110px', textAlign: 'right' }}>Toplam (₺)</th>
                                                <th style={{ padding: '8px', width: '40px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {proposalItems.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '6px' }}>
                                                        <CustomInput
                                                            value={item.description}
                                                            onChange={e => handleUpdateItem(idx, 'description', e.target.value)}
                                                            placeholder="Hizmet / ürün tanımı"
                                                        />
                                                    </td>
                                                    <td style={{ padding: '6px' }}>
                                                        <CustomInput
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={e => handleUpdateItem(idx, 'quantity', e.target.value)}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '6px' }}>
                                                        <select
                                                            className="custom-input"
                                                            value={item.unit}
                                                            onChange={e => handleUpdateItem(idx, 'unit', e.target.value)}
                                                            style={{ width: '100%', height: '36px' }}
                                                        >
                                                            <option value="Gün">Gün</option>
                                                            <option value="Saat">Saat</option>
                                                            <option value="Sefer">Sefer</option>
                                                            <option value="Ay">Ay</option>
                                                            <option value="Adet">Adet</option>
                                                            <option value="Ton">Ton</option>
                                                            <option value="Metre">Metre</option>
                                                        </select>
                                                    </td>
                                                    <td style={{ padding: '6px' }}>
                                                        <CustomInput
                                                            type="number"
                                                            value={item.unitPrice}
                                                            onChange={e => handleUpdateItem(idx, 'unitPrice', e.target.value)}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>
                                                        {((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                                    </td>
                                                    <td style={{ padding: '6px', textAlign: 'center' }}>
                                                        <button
                                                            type="button"
                                                            className="icon-btn danger"
                                                            onClick={() => handleRemoveItem(idx)}
                                                            title="Kalemi Sil"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Toplam Özeti */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                                        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Ara Toplam:</span>
                                                <strong>{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>KDV:</span>
                                                    <select
                                                        value={vatRate}
                                                        onChange={e => setVatRate(Number(e.target.value))}
                                                        style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
                                                    >
                                                        <option value={20}>%20</option>
                                                        <option value={10}>%10</option>
                                                        <option value={1}>%1</option>
                                                        <option value={0}>%0</option>
                                                    </select>
                                                </div>
                                                <strong>{vatAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-color)', paddingTop: '6px', fontSize: '14px', color: 'var(--accent-primary)' }}>
                                                <span>GENEL TOPLAM:</span>
                                                <strong>{grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Teklif Koşulları */}
                                <div>
                                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                        Teklif Şartları ve Koşullar (Düzenlenebilir)
                                    </label>
                                    <textarea
                                        className="custom-input"
                                        rows={4}
                                        value={termsText}
                                        onChange={e => setTermsText(e.target.value)}
                                        style={{ width: '100%', resize: 'vertical', lineHeight: 1.5, fontSize: '12px' }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* HİZMET & KİRALAMA SÖZLEŞMESİ ALANLARI */}
                        {selectedTemplate.type === 'contract' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Sözleşme No</label>
                                        <CustomInput value={placeholders.contractNo || ''} onChange={e => handlePlaceholderChange('contractNo', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Başlangıç Tarihi</label>
                                        <CustomInput type="date" value={placeholders.startDate || ''} onChange={e => handlePlaceholderChange('startDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bitiş Tarihi</label>
                                        <CustomInput type="date" value={placeholders.endDate || ''} onChange={e => handlePlaceholderChange('endDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Sözleşme Bedeli (₺)</label>
                                        <CustomInput type="number" value={placeholders.contractAmount || ''} onChange={e => handlePlaceholderChange('contractAmount', e.target.value)} />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Hizmetin / Kiralamanın Konusu</label>
                                        <CustomInput value={placeholders.serviceSubject || ''} onChange={e => handlePlaceholderChange('serviceSubject', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>İş / Şantiye Yeri Adresi</label>
                                        <CustomInput value={placeholders.workLocation || ''} onChange={e => handlePlaceholderChange('workLocation', e.target.value)} />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Ödeme Koşulları</label>
                                        <CustomInput value={placeholders.paymentTerms || ''} onChange={e => handlePlaceholderChange('paymentTerms', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Yetkili Mahkeme / İl</label>
                                        <CustomInput value={placeholders.legalCourts || ''} onChange={e => handlePlaceholderChange('legalCourts', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CARİ MUTABAKAT ALANLARI */}
                        {selectedTemplate.type === 'reconciliation' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mutabakat Tarihi</label>
                                        <CustomInput type="date" value={placeholders.reconciliationDate || ''} onChange={e => handlePlaceholderChange('reconciliationDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bakiye Tutarı (₺)</label>
                                        <CustomInput value={placeholders.balanceAmount || ''} onChange={e => handlePlaceholderChange('balanceAmount', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bakiye Durumu</label>
                                        <select
                                            className="custom-input"
                                            value={placeholders.balanceType || 'BORÇ (Alacağımız)'}
                                            onChange={e => handlePlaceholderChange('balanceType', e.target.value)}
                                            style={{ width: '100%', height: '38px' }}
                                        >
                                            <option value="BORÇ (Alacağımız)">BORÇ (Alacağımız)</option>
                                            <option value="ALACAK (Borcumuz)">ALACAK (Borcumuz)</option>
                                            <option value="SIFIR (0,00 ₺)">SIFIR (0,00 ₺ - Bakiye Yok)</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                        Mektup Metni (Önizleme / Düzenleme)
                                    </label>
                                    <textarea
                                        className="custom-input"
                                        rows={5}
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                        style={{ width: '100%', resize: 'vertical', lineHeight: 1.5, fontSize: '12px' }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* TESLİM - TESELLÜM TUTANAĞI ALANLARI */}
                        {selectedTemplate.type === 'delivery' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Teslim Tarihi</label>
                                        <CustomInput type="date" value={placeholders.deliveryDate || ''} onChange={e => handlePlaceholderChange('deliveryDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Teslim Saati</label>
                                        <CustomInput value={placeholders.deliveryTime || ''} onChange={e => handlePlaceholderChange('deliveryTime', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Teslim Edilen Ekipman</label>
                                        <CustomInput value={placeholders.equipmentInfo || ''} onChange={e => handlePlaceholderChange('equipmentInfo', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Plaka / Seri No</label>
                                        <CustomInput value={placeholders.serialPlateNo || ''} onChange={e => handlePlaceholderChange('serialPlateNo', e.target.value)} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Çalışma Saati / KM</label>
                                        <CustomInput value={placeholders.workingHoursKm || ''} onChange={e => handlePlaceholderChange('workingHoursKm', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Teslim Yeri / Şantiye</label>
                                        <CustomInput value={placeholders.deliveryLocation || ''} onChange={e => handlePlaceholderChange('deliveryLocation', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Teslim Eden Yetkili</label>
                                        <CustomInput value={placeholders.deliveredByName || ''} onChange={e => handlePlaceholderChange('deliveredByName', e.target.value)} placeholder={company?.name} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Özel Notlar & Durum</label>
                                    <CustomInput value={placeholders.notes || ''} onChange={e => handlePlaceholderChange('notes', e.target.value)} />
                                </div>
                            </div>
                        )}

                        {/* SERBEST YAZI ALANLARI */}
                        {selectedTemplate.type === 'custom' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Yazı Tarihi</label>
                                        <CustomInput type="date" value={placeholders.letterDate || ''} onChange={e => handlePlaceholderChange('letterDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Konu</label>
                                        <CustomInput value={placeholders.letterSubject || ''} onChange={e => handlePlaceholderChange('letterSubject', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Metin İçeriği</label>
                                    <textarea
                                        className="custom-input"
                                        rows={6}
                                        value={placeholders.customBody || ''}
                                        onChange={e => handlePlaceholderChange('customBody', e.target.value)}
                                        style={{ width: '100%', resize: 'vertical', lineHeight: 1.5, fontSize: '12px' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Modal>
    )
}
