import React, { useState, useEffect, useRef } from 'react'
import { 
    ExternalLink, Trash2, ChevronLeft, ChevronRight, Loader2, 
    RotateCw, FileText, Download, File, Maximize2, Printer 
} from 'lucide-react'
import Modal from './Modal'
import { Document, Page, pdfjs } from 'react-pdf'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure worker locally with fallback CDN (jsdelivr is much faster and more reliable than unpkg)
try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
    ).toString()
} catch (e) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

export default function DocumentPreviewModal({ doc, onClose, onDelete }) {
    const [numPages, setNumPages] = useState(null)
    const [pageNumber, setPageNumber] = useState(1)
    const [pdfLoading, setPdfLoading] = useState(true)
    const [pdfError, setPdfError] = useState(false)
    
    // Zoom, Pan & Rotation states
    const [zoomLevel, setZoomLevel] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [textContent, setTextContent] = useState(null)

    const containerRef = useRef(null)

    // Reset state when doc changes
    useEffect(() => {
        if (doc) {
            setPageNumber(1)
            setPdfLoading(true)
            setPdfError(false)
            setZoomLevel(1)
            setRotation(0)
            setPosition({ x: 0, y: 0 })
        }
    }, [doc])

    const fileName = doc?.name || doc?.file_name || doc?.fileName || 'Belge'
    const ext = (fileName.substring(fileName.lastIndexOf('.')).toLowerCase()) || doc?.ext || ''
    const cleanFileName = String(doc?.path || doc?.file_path || doc?.name || doc?.fileName || doc?.file_name || '').split(/[\\/]/).pop()
    const pdfUrl = cleanFileName ? `/uploads/${encodeURIComponent(cleanFileName)}` : null

    const formattedPdfSource = React.useMemo(() => {
        if (!doc) return null
        if (doc.data) {
            if (typeof doc.data === 'string') {
                if (doc.data.startsWith('data:application/pdf')) return doc.data
                if (doc.data.startsWith('http://') || doc.data.startsWith('https://') || doc.data.startsWith('blob:')) return doc.data
                if (doc.data.startsWith('data:')) {
                    return doc.data.replace(/^data:[^;]+;base64,/, 'data:application/pdf;base64,')
                }
                return `data:application/pdf;base64,${doc.data.trim()}`
            }
        }
        if (doc.url) return doc.url
        if (pdfUrl) return pdfUrl
        return null
    }, [doc, pdfUrl])

    const formattedImageSource = React.useMemo(() => {
        if (!doc) return null
        if (doc.data) {
            if (typeof doc.data === 'string') {
                if (doc.data.startsWith('data:image/') || doc.data.startsWith('http://') || doc.data.startsWith('https://') || doc.data.startsWith('blob:')) return doc.data
                const cleanExt = (ext.replace('.', '') || 'png').toLowerCase()
                const mimeExt = cleanExt === 'jpg' ? 'jpeg' : cleanExt
                return `data:image/${mimeExt};base64,${doc.data.trim()}`
            }
        }
        if (doc.url) return doc.url
        if (pdfUrl) return pdfUrl
        return null
    }, [doc, ext, pdfUrl])

    const isPdf = ext === '.pdf' || doc?.data?.startsWith('data:application/pdf') || doc?.file_type?.toLowerCase() === '.pdf' || (cleanFileName && cleanFileName.toLowerCase().endsWith('.pdf'))
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif'].includes(ext) || doc?.data?.startsWith('data:image/')
    const isText = ['.txt', '.log', '.csv', '.json', '.xml', '.html', '.md'].includes(ext)
    const isUnsupported = !isPdf && !isImage && !isText

    // Text decoding
    useEffect(() => {
        if (doc?.data && isText) {
            try {
                const base64Str = doc.data.includes(',') ? doc.data.split(',')[1] : doc.data
                const decoded = atob(base64Str)
                const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0))
                const text = new TextDecoder('utf-8').decode(bytes)
                setTextContent(text)
            } catch (e) {
                setTextContent('Metin içeriği çözümlenemedi.')
            }
        } else {
            setTextContent(null)
        }
    }, [doc, isText])

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!doc) return
            if (e.key === 'Escape') {
                onClose()
            } else if (e.key === '+' || e.key === '=') {
                handleZoomIn()
            } else if (e.key === '-' || e.key === '_') {
                handleZoomOut()
            } else if (e.key === '0') {
                handleResetZoom()
            } else if (isPdf && e.key === 'ArrowLeft') {
                previousPage()
            } else if (isPdf && e.key === 'ArrowRight') {
                nextPage()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [doc, isPdf, numPages, pageNumber])

    if (!doc) return null

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages)
        setPdfLoading(false)
        setPdfError(false)
    }

    const changePage = (offset) => {
        setPageNumber(prev => Math.min(Math.max(1, prev + offset), numPages || 1))
    }

    const previousPage = () => changePage(-1)
    const nextPage = () => changePage(1)

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 4))
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.4))
    const handleResetZoom = () => {
        setZoomLevel(1)
        setPosition({ x: 0, y: 0 })
        setRotation(0)
    }
    const handleRotate = () => setRotation(prev => (prev + 90) % 360)

    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            const delta = e.deltaY < 0 ? 0.15 : -0.15
            setZoomLevel(prev => Math.min(Math.max(0.4, prev + delta), 4))
        } else if (isImage && zoomLevel > 1) {
            setPosition(prev => ({
                ...prev,
                y: prev.y - e.deltaY
            }))
        }
    }

    // Drag / Pan Handlers for Zoomed Content
    const handleMouseDown = (e) => {
        if (zoomLevel > 1 || isImage) {
            setIsDragging(true)
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
        }
    }

    const handleMouseMove = (e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            })
        }
    }

    const handleMouseUp = () => setIsDragging(false)

    // Open externally handler
    const handleExternalOpen = async () => {
        const src = formattedPdfSource || formattedImageSource || pdfUrl
        if (src) {
            if (src.startsWith('http') || src.startsWith('/uploads') || src.startsWith('blob:')) {
                window.open(src, '_blank', 'noopener,noreferrer')
                return
            }
            const w = window.open('')
            if (w) {
                w.document.write(`<iframe src="${src}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`)
                return
            }
        }
        alert('Dosya yolu veya içeriği bulunamadı.')
    }

    // Download file handler
    const handleDownload = async () => {
        const src = formattedPdfSource || formattedImageSource || pdfUrl
        if (src) {
            const a = document.createElement('a')
            a.href = src
            a.download = fileName
            a.target = '_blank'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
        } else {
            alert('İndirilecek dosya verisi bulunamadı.')
        }
    }

    // Print file handler
    const handlePrint = () => {
        const src = formattedPdfSource || formattedImageSource || pdfUrl
        if (src && (src.startsWith('http') || src.startsWith('blob:') || src.startsWith('/uploads'))) {
            const printWin = window.open(src, '_blank')
            if (printWin) printWin.focus()
        } else {
            window.print()
        }
    }

    const headerContent = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <span style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 9px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                letterSpacing: '0.5px'
            }}>
                {ext.replace('.', '') || 'DOSYA'}
            </span>
            <span style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '550px'
            }}>
                {fileName}
            </span>
        </div>
    )

    const footer = (
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button className="btn btn-secondary" onClick={onClose}>
                    Kapat
                </button>
                <button className="btn btn-secondary" onClick={handleDownload} style={{ gap: '6px' }}>
                    <Download size={16} /> İndir
                </button>
                <button className="btn btn-secondary" onClick={handlePrint} style={{ gap: '6px' }}>
                    <Printer size={16} /> Yazdır
                </button>
                <button className="btn btn-primary" onClick={handleExternalOpen} style={{ gap: '6px' }}>
                    <ExternalLink size={16} /> Yeni Sekmede Aç
                </button>
            </div>
        </div>
    )

    return (
        <Modal
            isOpen={!!doc}
            onClose={onClose}
            title={headerContent}
            size="xl"
            footer={footer}
            bodyStyle={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '75vh', overflow: 'hidden' }}>
                {/* Sleek Toolbar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    gap: '12px',
                    userSelect: 'none',
                    zIndex: 2
                }}>
                    {/* - Zoom Out */}
                    <button
                        onClick={handleZoomOut}
                        title="Uzaklaştır (-)"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            fontWeight: 500,
                            lineHeight: 1,
                            transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        −
                    </button>

                    {/* + Zoom In */}
                    <button
                        onClick={handleZoomIn}
                        title="Yakınlaştır (+)"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            fontWeight: 500,
                            lineHeight: 1,
                            transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        +
                    </button>

                    {/* Fit to View Button */}
                    <button
                        onClick={handleResetZoom}
                        title="Genişliğe Sığdır (%100)"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <Maximize2 size={15} />
                    </button>

                    {/* Page Counter Box / Percentage */}
                    {isPdf ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                                disabled={pageNumber <= 1}
                                onClick={previousPage}
                                title="Önceki Sayfa"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: pageNumber <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                                    cursor: pageNumber <= 1 ? 'default' : 'pointer',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <ChevronLeft size={16} />
                            </button>

                            <input
                                type="number"
                                min={1}
                                max={numPages || 1}
                                value={pageNumber}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value)
                                    if (!isNaN(val)) {
                                        setPageNumber(Math.min(Math.max(1, val), numPages || 1))
                                    }
                                }}
                                style={{
                                    width: '42px',
                                    height: '28px',
                                    textAlign: 'center',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    outline: 'none'
                                }}
                            />

                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                / {numPages || 1}
                            </span>

                            <button
                                disabled={pageNumber >= (numPages || 1)}
                                onClick={nextPage}
                                title="Sonraki Sayfa"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: pageNumber >= (numPages || 1) ? 'var(--text-muted)' : 'var(--text-primary)',
                                    cursor: pageNumber >= (numPages || 1) ? 'default' : 'pointer',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    ) : (
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-tertiary)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)'
                        }}>
                            {Math.round(zoomLevel * 100)}%
                        </div>
                    )}

                    {/* Divider */}
                    <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

                    {/* Rotate Button */}
                    <button
                        onClick={handleRotate}
                        title="90° Döndür"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <RotateCw size={15} />
                    </button>
                </div>

                {/* Reader Canvas */}
                <div
                    ref={containerRef}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{
                        flex: 1,
                        backgroundColor: '#0c0d12',
                        overflow: 'auto',
                        position: 'relative',
                        display: 'flex',
                        alignItems: zoomLevel > 1.1 ? 'flex-start' : 'center',
                        justifyContent: zoomLevel > 1.1 ? 'flex-start' : 'center',
                        cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                        userSelect: 'none'
                    }}
                >
                    {isPdf ? (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '100%',
                            height: '100%',
                            minHeight: '65vh'
                        }}>
                            {!pdfError ? (
                                <Document
                                    file={formattedPdfSource}
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    onLoadError={(err) => {
                                        console.warn('React-PDF load error, attempting iframe fallback:', err)
                                        setPdfError(true)
                                        setPdfLoading(false)
                                    }}
                                    loading={
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#8892b0', gap: '12px' }}>
                                            <Loader2 className="spin" size={36} style={{ color: 'var(--accent-primary)' }} />
                                            <span style={{ fontSize: '13px', fontWeight: 500 }}>PDF Yükleniyor...</span>
                                        </div>
                                    }
                                >
                                    <Page
                                        pageNumber={pageNumber}
                                        scale={zoomLevel}
                                        rotate={rotation}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                    />
                                </Document>
                            ) : (
                                <iframe
                                    src={pdfUrl || formattedPdfSource}
                                    title={fileName}
                                    style={{
                                        width: '100%',
                                        height: '70vh',
                                        border: 'none',
                                        borderRadius: '8px',
                                        backgroundColor: '#fff'
                                    }}
                                />
                            )}
                        </div>
                    ) : isImage ? (
                        <div style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
                            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '24px',
                            minWidth: '100%',
                            minHeight: '100%',
                            margin: 'auto'
                        }}>
                            <img
                                src={formattedImageSource}
                                alt={fileName}
                                draggable={false}
                                style={{
                                    maxWidth: '85vw',
                                    maxHeight: '68vh',
                                    objectFit: 'contain',
                                    borderRadius: '8px',
                                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)'
                                }}
                            />
                        </div>
                    ) : isText ? (
                        <div style={{
                            width: '100%',
                            height: '100%',
                            padding: '24px',
                            boxSizing: 'border-box',
                            overflow: 'auto'
                        }}>
                            <pre style={{
                                fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
                                fontSize: `${13 * zoomLevel}px`,
                                color: '#e6edf3',
                                backgroundColor: '#161b22',
                                padding: '20px',
                                borderRadius: '8px',
                                border: '1px solid #30363d',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                margin: 0,
                                lineHeight: 1.5
                            }}>
                                {textContent || 'Yükleniyor...'}
                            </pre>
                        </div>
                    ) : (
                        /* Unsupported File Card */
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '40px',
                            backgroundColor: '#161b22',
                            borderRadius: '16px',
                            border: '1px solid #30363d',
                            textAlign: 'center',
                            maxWidth: '420px',
                            margin: 'auto',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                        }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '16px',
                                backgroundColor: 'var(--accent-subtle)',
                                color: 'var(--accent-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '16px'
                            }}>
                                <File size={32} />
                            </div>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f0f6fc', margin: '0 0 8px 0' }}>
                                {fileName}
                            </h3>
                            <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                                Bu dosya türü (`{ext}`) doğrudan içi önizlenemez. Dosyayı indirebilir veya yeni sekmede açabilirsiniz.
                            </p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn btn-secondary" onClick={handleDownload} style={{ gap: '8px' }}>
                                    <Download size={16} /> İndir
                                </button>
                                <button className="btn btn-primary" onClick={handleExternalOpen} style={{ gap: '8px' }}>
                                    <ExternalLink size={16} /> Dışarıda Aç
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}
