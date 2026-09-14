import { useState, useEffect } from 'react'
import { X, Upload, FileText, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Plus, Check, Trash2, Copy, Layers } from 'lucide-react'
import CustomInput from '../CustomInput'
import CustomSelect from '../CustomSelect'
import { useCompany } from '../../context/CompanyContext'
import { formatDateForInput } from '../../utils/helpers'

export default function DocumentForm({ onSubmit, onCancel, loading, initialType = 'other', options, targetType = 'employee' }) {
    const { currentCompany } = useCompany()
    const [queue, setQueue] = useState([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isSelectionPhase, setIsSelectionPhase] = useState(true)
    const [documentTypes, setDocumentTypes] = useState(options || [])
    const [documentFolders, setDocumentFolders] = useState([])
    const [isDragging, setIsDragging] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [showBulkAppliedNotice, setShowBulkAppliedNotice] = useState(false)

    useEffect(() => {
        if (options && options.length > 0) {
            setDocumentTypes(options)
        } else if (currentCompany) {
            loadCategories()
        }
    }, [options, currentCompany, targetType])

    useEffect(() => {
        if (currentCompany) {
            loadFolders()
        }
    }, [currentCompany, targetType])

    const loadCategories = async () => {
        try {
            const res = await window.electronAPI.getDocumentCategories(currentCompany.id, targetType)
            if (res.success) {
                setDocumentTypes(res.data.filter(t => t.status !== 'passive').map(t => ({ value: t.name, label: t.name })))
            }
        } catch (error) {
            console.error('Failed to load document categories:', error)
        }
    }

    const loadFolders = async () => {
        try {
            const res = await window.electronAPI.getDocumentFolders(currentCompany.id, targetType)
            if (res.success) {
                setDocumentFolders(res.data.map(t => ({ value: t.name, label: t.name })))
            }
        } catch (error) {
            console.error('Failed to load document folders:', error)
        }
    }

    const resolveDefaultCategory = () => {
        if (initialType && initialType !== 'other') return initialType
        if (documentTypes && documentTypes.length > 0) {
            const dierOpt = documentTypes.find(t => t.value === 'Diğer' || t.label === 'Diğer')
            if (dierOpt) return dierOpt.value
            return documentTypes[0].value
        }
        return 'Diğer'
    }

    const getFilePath = (file) => {
        try {
            if (window.electronAPI?.getPathForFile) {
                const path = window.electronAPI.getPathForFile(file)
                if (path) return path
            }
        } catch (e) {
            console.warn('getPathForFile call failed:', e)
        }
        return file.path || null
    }

    const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })

    const handleSelectFiles = async () => {
        setErrorMessage('')
        try {
            const result = await window.electronAPI.selectFile({ multiple: true })
            if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) return

            const today = new Date()
            const nextYear = new Date()
            nextYear.setFullYear(today.getFullYear() + 1)
            
            const startDateStr = formatDateForInput(today)
            const endDateStr = formatDateForInput(nextYear)
            const defaultCat = resolveDefaultCategory()

            const newItems = result.filePaths.map(filePath => {
                const fileName = filePath.split(/[\\/]/).pop()
                const nameWithoutExt = fileName.split('.').slice(0, -1).join('.') || fileName
                return {
                    id: Math.random().toString(36).substr(2, 9),
                    path: filePath,
                    originalName: fileName,
                    displayName: nameWithoutExt,
                    docType: defaultCat,
                    folder: '',
                    startDate: startDateStr,
                    endDate: endDateStr,
                    isSaved: false
                }
            })

            const isFirstSelection = queue.length === 0
            setQueue(prev => [...prev, ...newItems])
            setIsSelectionPhase(false)
            if (isFirstSelection) setCurrentIndex(0)
        } catch (error) {
            console.error('File selection error:', error)
            setErrorMessage('Dosya seçimi sırasında hata oluştu.')
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        setErrorMessage('')

        const files = Array.from(e.dataTransfer.files || [])
        if (files.length === 0) return

        const today = new Date()
        const nextYear = new Date()
        nextYear.setFullYear(today.getFullYear() + 1)
        const startDateStr = formatDateForInput(today)
        const endDateStr = formatDateForInput(nextYear)
        const defaultCat = resolveDefaultCategory()

        const newItems = []
        for (const file of files) {
            let filePath = getFilePath(file)

            // Web fallback: upload file to /api/upload if no native path
            if (!filePath && typeof window !== 'undefined' && !window.electronAPI?.openFolder) {
                try {
                    const base64 = await readFileAsBase64(file)
                    const token = localStorage.getItem('token') || localStorage.getItem('aractakip_token') || sessionStorage.getItem('token')
                    const uploadRes = await fetch('/api/upload', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify({
                            fileName: file.name,
                            fileData: base64,
                            mimeType: file.type,
                            companyId: currentCompany?.id || null,
                            category: defaultCat
                        })
                    })
                    const data = await uploadRes.json()
                    if (data?.success && data?.fileName) {
                        filePath = data.fileName
                    }
                } catch (err) {
                    console.error('Web drop upload error:', err)
                }
            }

            if (!filePath) {
                filePath = file.path || file.name
            }

            const fileName = file.name
            const nameWithoutExt = fileName.split('.').slice(0, -1).join('.') || fileName
            newItems.push({
                id: Math.random().toString(36).substr(2, 9),
                path: filePath,
                originalName: fileName,
                displayName: nameWithoutExt,
                docType: defaultCat,
                folder: '',
                startDate: startDateStr,
                endDate: endDateStr,
                isSaved: false
            })
        }

        if (newItems.length > 0) {
            const isFirstSelection = queue.length === 0
            setQueue(prev => [...prev, ...newItems])
            setIsSelectionPhase(false)
            if (isFirstSelection) setCurrentIndex(0)
        }
    }

    const updateCurrentItem = (field, value) => {
        if (queue[currentIndex]?.isSaved) return
        setQueue(prev => prev.map((item, idx) => {
            if (idx === currentIndex) {
                const updated = { ...item, [field]: value }
                if (field === 'startDate' && value && value.length === 10) {
                    const parts = value.split('-')
                    if (parts.length === 3) {
                        const year = parseInt(parts[0], 10)
                        const month = parts[1]
                        const day = parts[2]
                        if (!isNaN(year) && month.length === 2 && day.length === 2) {
                            updated.endDate = `${year + 1}-${month}-${day}`
                        }
                    }
                }
                return updated
            }
            return item
        }))
    }

    const applyCurrentToAllUnsaved = () => {
        const current = queue[currentIndex]
        if (!current) return
        setQueue(prev => prev.map(item => {
            if (item.isSaved) return item
            return {
                ...item,
                docType: current.docType,
                folder: current.folder,
                startDate: current.startDate,
                endDate: current.endDate
            }
        }))
        setShowBulkAppliedNotice(true)
        setTimeout(() => setShowBulkAppliedNotice(false), 2500)
    }

    const handleConfirmCurrent = async () => {
        const currentItem = queue[currentIndex]
        if (!currentItem || currentItem.isSaved || isSubmitting) return

        setIsSubmitting(true)
        setErrorMessage('')
        try {
            await onSubmit([currentItem])
            setQueue(prev => prev.map((item, idx) => 
                idx === currentIndex ? { ...item, isSaved: true } : item
            ))

            const nextUnsavedIndex = queue.findIndex((item, idx) => idx > currentIndex && !item.isSaved)
            if (nextUnsavedIndex !== -1) {
                setCurrentIndex(nextUnsavedIndex)
            } else {
                const anyUnsavedIndex = queue.findIndex(item => !item.isSaved)
                if (anyUnsavedIndex !== -1) {
                    setCurrentIndex(anyUnsavedIndex)
                }
            }
        } catch (err) {
            console.error('Save current document error:', err)
            setErrorMessage(err.message || 'Belge kaydedilirken bir hata oluştu.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleConfirmAll = async () => {
        const unsavedItems = queue.filter(item => !item.isSaved)
        if (unsavedItems.length === 0 || isSubmitting) return

        setIsSubmitting(true)
        setErrorMessage('')
        try {
            await onSubmit(unsavedItems)
            setQueue(prev => prev.map(item => ({ ...item, isSaved: true })))
        } catch (err) {
            console.error('Save all documents error:', err)
            setErrorMessage(err.message || 'Belgeler kaydedilirken bir hata oluştu.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const removeItem = (e, index) => {
        e.stopPropagation()
        const newQueue = queue.filter((_, idx) => idx !== index)
        setQueue(newQueue)
        if (newQueue.length === 0) {
            setIsSelectionPhase(true)
        } else {
            setCurrentIndex(Math.min(currentIndex, newQueue.length - 1))
        }
    }

    if (isSelectionPhase) {
        return (
            <div
                onClick={handleSelectFiles}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    border: isDragging ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '60px 24px',
                    textAlign: 'center',
                    backgroundColor: isDragging ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                    transition: 'var(--transition-normal)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px'
                }}
                onMouseEnter={e => {
                    if (!isDragging) e.currentTarget.style.borderColor = 'var(--accent-primary)'
                }}
                onMouseLeave={e => {
                    if (!isDragging) e.currentTarget.style.borderColor = 'var(--border-color)'
                }}
            >
                <div style={{ color: 'var(--accent-primary)', opacity: 0.9 }}>
                    <Upload size={52} />
                </div>
                <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '18px' }}>
                        {isDragging ? 'Belgeleri Buraya Bırakın' : 'Yüklenecek Belgeleri Seçin veya Sürükleyin'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        Tekli veya birden fazla dosya (PDF, Görsel, Word, Excel) seçebilirsiniz.
                    </div>
                </div>
                <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: '8px', pointerEvents: 'none' }}
                >
                    <Plus size={16} /> Dosya Seç
                </button>
            </div>
        )
    }

    const currentItem = queue[currentIndex]
    const allSaved = queue.length > 0 && queue.every(item => item.isSaved)
    const unsavedCount = queue.filter(item => !item.isSaved).length
    const savedCount = queue.filter(item => item.isSaved).length
    const progress = (savedCount / queue.length) * 100
    const busy = loading || isSubmitting

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Header & Progress */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                            background: 'var(--accent-subtle, rgba(59, 130, 246, 0.1))', 
                            color: 'var(--accent-primary)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontWeight: 700
                        }}>
                            {currentIndex + 1} / {queue.length}
                        </span>
                        <span>{currentItem?.isSaved ? 'Belge Kaydedildi' : 'Belge Bilgileri'}</span>
                        {savedCount > 0 && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>
                                ({savedCount} / {queue.length} yüklendi)
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                            type="button"
                            onClick={handleSelectFiles}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px', height: '30px' }}
                            disabled={busy}
                        >
                            <Plus size={14} /> Daha Fazla Ekle
                        </button>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                                type="button"
                                className="btn btn-secondary"
                                disabled={currentIndex === 0 || busy} 
                                onClick={() => setCurrentIndex(prev => prev - 1)}
                                style={{ width: '30px', height: '30px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button 
                                type="button"
                                className="btn btn-secondary"
                                disabled={currentIndex === queue.length - 1 || busy} 
                                onClick={() => setCurrentIndex(prev => prev + 1)}
                                style={{ width: '30px', height: '30px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ 
                        height: '100%', 
                        background: allSaved ? 'var(--success, #10b981)' : 'var(--accent-primary)', 
                        width: `${progress}%`, 
                        transition: 'width 0.3s ease, background-color 0.3s ease' 
                    }} />
                </div>
            </div>

            {/* Queue Files Horizontal Navigation Pills */}
            {queue.length > 1 && (
                <div style={{ 
                    display: 'flex', 
                    gap: '6px', 
                    overflowX: 'auto', 
                    padding: '6px 2px',
                    scrollbarWidth: 'thin'
                }}>
                    {queue.map((item, idx) => {
                        const isActive = idx === currentIndex
                        return (
                            <button
                                key={item.id || idx}
                                type="button"
                                onClick={() => setCurrentIndex(idx)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: isActive ? 600 : 400,
                                    border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                    background: isActive 
                                        ? 'var(--accent-subtle, rgba(59, 130, 246, 0.12))' 
                                        : 'var(--bg-secondary)',
                                    color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {item.isSaved ? (
                                    <CheckCircle2 size={13} style={{ color: 'var(--success, #10b981)' }} />
                                ) : (
                                    <FileText size={13} style={{ opacity: 0.7 }} />
                                )}
                                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.displayName || item.originalName}
                                </span>
                                {!item.isSaved && queue.length > 1 && (
                                    <span
                                        onClick={(e) => removeItem(e, idx)}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            marginLeft: '2px', 
                                            opacity: 0.6,
                                            padding: '2px'
                                        }}
                                        title="Kuyruktan Çıkar"
                                    >
                                        <X size={12} />
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Error Message */}
            {errorMessage && (
                <div style={{ 
                    padding: '10px 14px', 
                    backgroundColor: 'var(--error-bg, rgba(239, 68, 68, 0.1))', 
                    color: 'var(--error, #ef4444)', 
                    borderRadius: '8px', 
                    fontSize: '13px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    border: '1px solid var(--error, #ef4444)'
                }}>
                    <AlertCircle size={16} />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* All Saved State */}
            {allSaved ? (
                <div style={{
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <div style={{ color: 'var(--success, #10b981)' }}>
                        <CheckCircle2 size={48} />
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {queue.length === 1 ? 'Belge Başarıyla Yüklendi!' : `Tüm Belgeler (${queue.length}) Başarıyla Yüklendi!`}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Yüklenen belgeler listeye eklendi.
                    </div>
                </div>
            ) : (
                /* Edit Item Card */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ 
                        padding: '12px 16px', 
                        borderRadius: 'var(--radius-md)', 
                        background: 'var(--bg-tertiary)', 
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{ color: currentItem?.isSaved ? 'var(--success, #10b981)' : 'var(--accent-primary)' }}>
                                {currentItem?.isSaved ? <CheckCircle2 size={20} /> : <FileText size={20} />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {currentItem?.originalName}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {currentItem?.isSaved ? 'Kaydedildi' : 'Düzenleniyor'}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {/* Bulk Apply Button */}
                            {queue.length > 1 && !currentItem?.isSaved && (
                                <button 
                                    type="button"
                                    onClick={applyCurrentToAllUnsaved}
                                    className="btn btn-secondary"
                                    style={{ 
                                        padding: '4px 8px', 
                                        fontSize: '11px', 
                                        height: '28px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                    title="Bu belgedeki kategori, klasör ve tarih bilgilerini kuyruktaki diğer tüm belgelere uygular"
                                >
                                    <Copy size={13} />
                                    <span>Tümüne Uygula</span>
                                </button>
                            )}

                            {!currentItem?.isSaved && (
                                <button 
                                    type="button"
                                    onClick={(e) => removeItem(e, currentIndex)}
                                    className="btn btn-secondary danger"
                                    style={{ padding: '6px', border: 'none', background: 'transparent' }}
                                    title="Bu belgeyi kaldır"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {showBulkAppliedNotice && (
                        <div style={{ 
                            padding: '8px 12px', 
                            background: 'var(--success-bg, rgba(16, 185, 129, 0.1))', 
                            color: 'var(--success, #10b981)', 
                            borderRadius: '6px', 
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}>
                            <Check size={14} />
                            <span>Kategori, klasör ve tarihler kuyruktaki kaydedilmemiş tüm belgelere uygulandı.</span>
                        </div>
                    )}

                    <div style={{ 
                        display: 'flex', flexDirection: 'column', gap: '14px',
                        opacity: currentItem?.isSaved ? 0.6 : 1,
                        pointerEvents: currentItem?.isSaved ? 'none' : 'auto'
                    }}>
                        <CustomInput
                            label="Dosya Adı"
                            value={currentItem?.displayName}
                            onChange={(val) => updateCurrentItem('displayName', val)}
                            required
                            maxLength={120}
                            placeholder="Belge adı girin..."
                        />
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <CustomSelect
                                label="Kategori"
                                value={currentItem?.docType}
                                onChange={(val) => updateCurrentItem('docType', val)}
                                options={documentTypes}
                            />

                            <CustomSelect
                                label="Klasör"
                                value={currentItem?.folder}
                                onChange={(val) => updateCurrentItem('folder', val)}
                                options={documentFolders}
                                placeholder="Klasör seçin (İsteğe Bağlı)..."
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <CustomInput
                                label="Başlangıç Tarihi"
                                type="date"
                                value={currentItem?.startDate}
                                onChange={(val) => updateCurrentItem('startDate', val)}
                            />
                            <CustomInput
                                label="Bitiş Tarihi"
                                type="date"
                                value={currentItem?.endDate}
                                onChange={(val) => updateCurrentItem('endDate', val)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Footer Actions */}
            <div style={{ 
                marginTop: '6px', 
                paddingTop: '16px', 
                borderTop: '1px solid var(--border-color)', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
            }}>
                <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
                    {allSaved ? 'Kapat' : 'İptal'}
                </button>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {allSaved ? (
                        <button type="button" className="btn btn-primary" onClick={onCancel}>
                            <Check size={16} /> Tamamla
                        </button>
                    ) : (
                        <>
                            {/* If multiple files, allow saving single or all */}
                            {queue.length > 1 && !currentItem?.isSaved && (
                                <button 
                                    type="button"
                                    className="btn btn-secondary" 
                                    onClick={handleConfirmCurrent}
                                    disabled={busy || !currentItem?.displayName}
                                >
                                    {busy ? 'Kaydediliyor...' : 'Bu Belgeyi Kaydet'}
                                </button>
                            )}

                            {/* Batch upload all unsaved files */}
                            {queue.length > 1 && unsavedCount > 0 && (
                                <button 
                                    type="button"
                                    className="btn btn-primary" 
                                    onClick={handleConfirmAll}
                                    disabled={busy || queue.some(i => !i.isSaved && !i.displayName)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <Layers size={16} />
                                    {busy ? 'Yükleniyor...' : `Tümünü Kaydet (${unsavedCount} Belge)`}
                                </button>
                            )}

                            {/* Single file upload button */}
                            {queue.length === 1 && !currentItem?.isSaved && (
                                <button 
                                    type="button"
                                    className="btn btn-primary" 
                                    onClick={handleConfirmCurrent}
                                    disabled={busy || !currentItem?.displayName}
                                >
                                    {busy ? 'Yükleniyor...' : 'Onayla ve Kaydet'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
