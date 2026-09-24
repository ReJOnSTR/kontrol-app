import { useState, useEffect } from 'react'
import Modal from './Modal'
import CustomInput from './CustomInput'
import StampSignaturePreview, { STAMP_DEFAULTS } from './StampSignaturePreview'
import { FileText, Download, Check, ArrowLeft, Stamp, Users, FolderDown, Archive, Loader2 } from 'lucide-react'
import { documentTemplates } from '../utils/documentTemplates'
import { formatDate, formatDateForInput, generateUniqueFileName } from '../utils/helpers'

export default function BulkDocumentGeneratorModal({ isOpen, onClose, selectedEmployees = [], company, onSuccess }) {
    const [selectedTemplate, setSelectedTemplate] = useState(documentTemplates[0])
    const [placeholders, setPlaceholders] = useState({})
    const [content, setContent] = useState('')
    const [title, setTitle] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [progress, setProgress] = useState({ current: 0, total: 0 })
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
    const [outputMode, setOutputMode] = useState('combined') // 'combined' | 'folder' | 'archive'

    useEffect(() => {
        localStorage.setItem('lastStampSettings', JSON.stringify(stampSettings))
    }, [stampSettings])

    useEffect(() => {
        if (selectedTemplate && company) {
            const initialPlaceholders = {}
            selectedTemplate.placeholders.forEach(p => {
                if (p.source !== 'employee' && p.source !== 'company') {
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
            setPlaceholders(initialPlaceholders)
            setTitle(selectedTemplate.title)
        }
    }, [selectedTemplate, company])

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

    useEffect(() => {
        if (!isOpen) {
            setStep('edit')
            setIsGenerating(false)
            setProgress({ current: 0, total: 0 })
        }
    }, [isOpen])

    const generateSingleEmployeeContent = (emp) => {
        let empContent = content || selectedTemplate?.content || ''
        selectedTemplate.placeholders.forEach(p => {
            let val = ''
            if (p.source === 'employee') {
                if (p.key === 'fullName') val = `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
                else val = emp[p.keyInEmp || p.key] || ''
            } else if (p.source === 'company') {
                val = company[p.keyInComp || p.key] || ''
            } else {
                val = placeholders[p.key] || ''
            }
            const displayValue = p.key.toLowerCase().includes('date') && val ? formatDate(val) : val
            empContent = empContent.replace(new RegExp(`{{${p.key}}}`, 'g'), displayValue || `[${p.key}]`)
        })
        return empContent
    }

    const handleGenerateBulk = async () => {
        if (!selectedEmployees || selectedEmployees.length === 0) return
        setIsGenerating(true)
        setProgress({ current: 0, total: selectedEmployees.length })

        const sanitizeFileName = (str) => (str || '').replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
        const dateStr = new Date().toISOString().split('T')[0];
        const docTitleStr = title ? sanitizeFileName(title) : (selectedTemplate?.name ? sanitizeFileName(selectedTemplate.name) : 'Toplu_Belge');

        try {
            if (outputMode === 'combined') {
                // 1. COMBINED MULTI-PAGE PDF
                const multiDocs = selectedEmployees.map(emp => ({
                    templateId: selectedTemplate.id,
                    title,
                    content: generateSingleEmployeeContent(emp),
                    employeeName: `${emp.first_name} ${emp.last_name}`,
                    companyName: company.name,
                    companyAddress: company.address,
                    companySgk: company.sgk_no,
                    companyTax: company.tax_office ? `${company.tax_office} / ${company.tax_number || ''}` : company.tax_number,
                    companySignaturePath: company.signature_path,
                    companyStampPath: company.stamp_path,
                    employeeSignaturePath: emp.signature_path || emp.signaturePath || null,
                    tcNo: emp.tc_no,
                    placeholders,
                    stampSettings,
                }))

                localStorage.setItem('printDocData', JSON.stringify({ isBulk: true, documents: multiDocs }))

                const defaultFileName = generateUniqueFileName('Toplu_Belge', [docTitleStr, `${selectedEmployees.length}_Personel`], 'pdf')
                const result = await window.electronAPI.saveReportPdf('/print-document', { silent: false, defaultPath: defaultFileName })
                
                if (result && result.success) {
                    if (window.showToast) window.showToast(`${selectedEmployees.length} personelin toplu belgesi başarıyla oluşturuldu.`, 'success')
                    if (onSuccess) onSuccess()
                    onClose()
                }
            } else if (outputMode === 'folder' || outputMode === 'archive') {
                // 2. INDIVIDUAL PDF PER EMPLOYEE (Saved to folder or archived to employee profile)
                let targetFolder = null
                if (outputMode === 'folder') {
                    const selectFolderRes = await window.electronAPI.selectFolder()
                    const folderPath = selectFolderRes?.filePath || (selectFolderRes?.filePaths && selectFolderRes.filePaths[0])
                    if (!selectFolderRes || !folderPath) {
                        setIsGenerating(false)
                        return
                    }
                    targetFolder = folderPath
                }

                let successCount = 0
                for (let i = 0; i < selectedEmployees.length; i++) {
                    const emp = selectedEmployees[i]
                    setProgress({ current: i + 1, total: selectedEmployees.length })

                    const empStr = `${emp.first_name}_${emp.last_name}`
                    const fileName = generateUniqueFileName('Belge', [empStr, docTitleStr], 'pdf')
                    
                    const printData = {
                        templateId: selectedTemplate.id,
                        title,
                        content: generateSingleEmployeeContent(emp),
                        employeeName: `${emp.first_name} ${emp.last_name}`,
                        companyName: company.name,
                        companyAddress: company.address,
                        companySgk: company.sgk_no,
                        companyTax: company.tax_office ? `${company.tax_office} / ${company.tax_number || ''}` : company.tax_number,
                        companySignaturePath: company.signature_path,
                        companyStampPath: company.stamp_path,
                        employeeSignaturePath: emp.signature_path || emp.signaturePath || null,
                        tcNo: emp.tc_no,
                        placeholders,
                        stampSettings,
                    }

                    localStorage.setItem('printDocData', JSON.stringify(printData))

                    const savePath = targetFolder ? (targetFolder.endsWith('/') || targetFolder.endsWith('\\') ? `${targetFolder}${fileName}` : `${targetFolder}/${fileName}`) : null
                    const res = await window.electronAPI.saveReportPdf('/print-document', {
                        silent: true,
                        targetFilePath: savePath,
                        defaultPath: fileName
                    })

                    if (res && res.success && res.filePath) {
                        successCount++
                        if (outputMode === 'archive') {
                            await window.electronAPI.createEmployeeDocument({
                                employeeId: emp.id,
                                fileName: fileName,
                                filePath: res.filePath,
                                fileType: 'pdf',
                                category: selectedTemplate.name || 'Toplu Belge',
                                issueDate: dateStr,
                                startDate: dateStr
                            })
                        }
                    }
                }

                if (window.showToast) {
                    window.showToast(`${successCount} / ${selectedEmployees.length} personel belgesi başarıyla oluşturuldu.`, 'success')
                }

                if (targetFolder && window.electronAPI?.openFolder) {
                    window.electronAPI.openFolder(targetFolder)
                }

                if (onSuccess) onSuccess()
                onClose()
            }
        } catch (err) {
            console.error('Bulk generate failed:', err)
            alert('Toplu belge oluşturulurken bir hata oluştu: ' + err.message)
        }
        setIsGenerating(false)
    }

    const templateOptions = documentTemplates.map(t => ({ value: t.id, label: t.name }))

    const modalFooter = step === 'edit' ? (
        <>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isGenerating}>İptal</button>
            <button
                type="button"
                onClick={() => setStep('stamp-preview')}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                disabled={isGenerating}
            >
                <Stamp size={16} />
                Kaşe &amp; İmza Ayarla
            </button>
            <button
                type="button"
                onClick={handleGenerateBulk}
                disabled={isGenerating}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                {isGenerating ? (
                    <>
                        <Loader2 size={16} className="spin" />
                        {progress.total > 0 ? `${progress.current} / ${progress.total} Belge Oluşturuluyor...` : 'Hazırlanıyor...'}
                    </>
                ) : (
                    <>
                        <Download size={16} />
                        {outputMode === 'combined' ? 'Toplu PDF İndir' : (outputMode === 'folder' ? 'Klasöre Kaydet' : 'Personellere Arşivle')}
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
                disabled={isGenerating}
            >
                <ArrowLeft size={16} />
                Geri Dön
            </button>
            <button
                type="button"
                onClick={handleGenerateBulk}
                disabled={isGenerating}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                {isGenerating ? (
                    <>
                        <Loader2 size={16} className="spin" />
                        {progress.total > 0 ? `${progress.current} / ${progress.total} Belge Oluşturuluyor...` : 'Hazırlanıyor...'}
                    </>
                ) : (
                    <>
                        <Download size={16} />
                        {outputMode === 'combined' ? 'Toplu PDF İndir' : (outputMode === 'folder' ? 'Klasöre Kaydet' : 'Personellere Arşivle')}
                    </>
                )}
            </button>
        </>
    )

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Toplu Belge Oluştur (${selectedEmployees.length} Personel Seçili)`}
            size={step === 'stamp-preview' ? 'fullscreen' : 'xl'}
            bodyStyle={step === 'stamp-preview' ? { display: 'flex', flexDirection: 'column', height: '100%', padding: 0, overflow: 'hidden' } : undefined}
            footer={modalFooter}
        >
            {step === 'edit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Seçilen Personeller Özeti */}
                    <div style={{
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            <Users size={15} style={{ color: 'var(--accent-primary)' }} />
                            <span>Seçilen Personeller ({selectedEmployees.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '70px', overflowY: 'auto' }}>
                            {selectedEmployees.map(emp => (
                                <span key={emp.id} style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {emp.first_name} {emp.last_name}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Çıktı Modu Seçimi */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label className="form-label" style={{ fontWeight: 600, fontSize: '13px' }}>
                            Toplu Belge Oluşturma Seçeneği
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setOutputMode('combined')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: `2px solid ${outputMode === 'combined' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    backgroundColor: outputMode === 'combined' ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                                    color: outputMode === 'combined' ? 'var(--accent-primary)' : 'var(--text-primary)',
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <span style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <FileText size={15} /> Tek Birleşik PDF
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    Tüm personeller için tek bir PDF dosyası üretilir (Yazdırmak için).
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setOutputMode('folder')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: `2px solid ${outputMode === 'folder' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    backgroundColor: outputMode === 'folder' ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                                    color: outputMode === 'folder' ? 'var(--accent-primary)' : 'var(--text-primary)',
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <span style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <FolderDown size={15} /> Klasöre Ayrı PDF'ler
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    Her personel için ayrı isimli PDF olarak bilgisayar klasörüne kaydeder.
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setOutputMode('archive')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: `2px solid ${outputMode === 'archive' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    backgroundColor: outputMode === 'archive' ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                                    color: outputMode === 'archive' ? 'var(--accent-primary)' : 'var(--text-primary)',
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <span style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Archive size={15} /> Personel Dosyalarına Arşivle
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    Her personelin sistemdeki "Belgeler" sekmesine otomatik kaydeder.
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Şablon Seçimi & Değişkenler */}
                    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px' }}>Şablon Seçin</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {documentTemplates.map(t => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setSelectedTemplate(t)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border-color)',
                                                background: selectedTemplate.id === t.id ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                                                color: selectedTemplate.id === t.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                                                fontWeight: selectedTemplate.id === t.id ? 700 : 500,
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <FileText size={16} />
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Değişkenler */}
                            {selectedTemplate.placeholders.filter(p => p.source !== 'employee' && p.source !== 'company').length > 0 && (
                                <div style={{
                                    padding: '14px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Ortak Belge Değişkenleri
                                    </div>
                                    {selectedTemplate.placeholders.filter(p => p.source !== 'employee' && p.source !== 'company').map(p => (
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
                            )}
                        </div>

                        {/* Düzenlenebilir Belge Metni */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                Belge Metni Şablonu (Yazı ve Değişkenleri Düzenleyebilirsiniz)
                            </div>
                            <div style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                padding: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                            }}>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Belge Başlığı"
                                    maxLength={120}
                                    style={{
                                        width: '100%',
                                        textAlign: 'center',
                                        fontSize: '16px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        border: 'none',
                                        borderBottom: '1px dashed var(--border-color)',
                                        background: 'transparent',
                                        color: 'var(--text-primary)',
                                        paddingBottom: '8px',
                                        outline: 'none'
                                    }}
                                />
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Belge içeriğini buraya yazabilir ve düzenleyebilirsiniz..."
                                    maxLength={10000}
                                    style={{
                                        width: '100%',
                                        minHeight: '260px',
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        fontSize: '13px',
                                        lineHeight: '1.6',
                                        color: 'var(--text-primary)',
                                        resize: 'vertical',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {step === 'stamp-preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', width: '100%', overflow: 'hidden' }}>
                    <StampSignaturePreview
                        docData={{
                            templateId: selectedTemplate.id,
                            title,
                            content: generateSingleEmployeeContent(selectedEmployees[0] || {}),
                            employeeName: `${selectedEmployees[0]?.first_name || ''} ${selectedEmployees[0]?.last_name || ''}`,
                            companyName: company.name,
                            companyAddress: company.address,
                            companySgk: company.sgk_no,
                            companyTax: company.tax_office ? `${company.tax_office} / ${company.tax_number || ''}` : company.tax_number,
                            employeeSignaturePath: selectedEmployees[0]?.signature_path || selectedEmployees[0]?.signaturePath || null,
                            tcNo: selectedEmployees[0]?.tc_no,
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
