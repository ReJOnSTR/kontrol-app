import React, { useState, useEffect, useRef, useMemo } from 'react'
import { 
    ExternalLink, Trash2, Loader2, 
    RotateCw, FileText, Download, File, Maximize2, Printer 
} from 'lucide-react'
import Modal from './Modal'

export default function DocumentPreviewModal({ doc, onClose, onDelete }) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    
    // Zoom, Pan & Rotation states (specifically for Images and text)
    const [zoomLevel, setZoomLevel] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [textContent, setTextContent] = useState(null)

    const containerRef = useRef(null)

    const fileName = doc?.name || doc?.file_name || doc?.fileName || 'Belge'
    const ext = (fileName.substring(fileName.lastIndexOf('.')).toLowerCase()) || doc?.ext || ''
    const cleanFileName = String(doc?.path || doc?.file_path || doc?.name || doc?.fileName || doc?.file_name || '').split(/[\\/]/).pop()
    const rawPdfUrl = cleanFileName ? `/uploads/${encodeURIComponent(cleanFileName)}` : null

    const isPdf = ext === '.pdf' || doc?.data?.startsWith('data:application/pdf') || doc?.file_type?.toLowerCase() === '.pdf' || (cleanFileName && cleanFileName.toLowerCase().endsWith('.pdf'))
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif'].includes(ext) || doc?.data?.startsWith('data:image/')
    const isText = ['.txt', '.log', '.csv', '.json', '.xml', '.html', '.md'].includes(ext)
    const isUnsupported = !isPdf && !isImage && !isText

    // Reset state when doc changes
    useEffect(() => {
        if (doc) {
            setLoading(true)
            setError(false)
            setZoomLevel(1)
            setRotation(0)
            setPosition({ x: 0, y: 0 })
        }
    }, [doc])

    // Convert Base64 data to high-speed Blob URL to avoid memory lockups
    const activeSource = useMemo(() => {
        if (!doc) return null

        // 1. Direct URL (Web Stream - Fastest)
        if (doc.url) return doc.url

        // 2. Base64 data conversion to Blob URL
        if (doc.data && typeof doc.data === 'string') {
            if (doc.data.startsWith('http://') || doc.data.startsWith('https://') || doc.data.startsWith('blob:') || doc.data.startsWith('/uploads/')) {
                return doc.data
            }
            try {
                const base64Clean = doc.data.includes(',') ? doc.data.split(',')[1] : doc.data
                const binary = atob(base64Clean)
                const len = binary.length
                const bytes = new Uint8Array(len)
                for (let i = 0; i < len; i++) {
                    bytes[i] = binary.charCodeAt(i)
                }

                let mime = 'application/octet-stream'
                if (isPdf) mime = 'application/pdf'
                else if (isImage) {
                    const cleanExt = (ext.replace('.', '') || 'png').toLowerCase()
                    mime = `image/${cleanExt === 'jpg' ? 'jpeg' : cleanExt}`
                } else if (isText) {
                    mime = 'text/plain;charset=utf-8'
                }

                const blob = new Blob([bytes], { type: mime })
                return URL.createObjectURL(blob)
            } catch (err) {
                console.warn('[Blob creation fallback]:', err)
                if (doc.data.startsWith('data:')) return doc.data
                return isPdf ? `data:application/pdf;base64,${doc.data}` : `data:image/png;base64,${doc.data}`
            }
        }

        // 3. Fallback to /uploads/ route
        if (rawPdfUrl) return rawPdfUrl
        return null
    }, [doc, isPdf, isImage, isText, ext, rawPdfUrl])

    // Cleanup Blob URLs on unmount/change
    useEffect(() => {
        return () => {
            if (activeSource && activeSource.startsWith('blob:')) {
                URL.revokeObjectURL(activeSource)
            }
        }
    }, [activeSource])

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
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [doc])

    if (!doc) return null

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

    // Drag / Pan Handlers for Zoomed Image
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
    const handleExternalOpen = () => {
        const src = activeSource || rawPdfUrl
        if (src) {
            window.open(src, '_blank', 'noopener,noreferrer')
            return
        }
        alert('Dosya yolu veya içeriği bulunamadı.')
    }

    // Download file handler
    const handleDownload = () => {
        const src = activeSource || rawPdfUrl
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

    // Print handler
    const handlePrint = () => {
        if (isPdf && activeSource) {
            const printWin = window.open(activeSource, '_blank')
            if (printWin) {
                printWin.focus()
            }
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
                {ext.replace('.', '') || 'BELGE'}
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
            <div style={{ display: 'flex', flexDirection: 'column', height: '80vh', overflow: 'hidden' }}>
                {/* Secondary Image Control Toolbar (only for Images) */}
                {isImage && (
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
                                fontSize: '18px',
                                fontWeight: 500,
                                lineHeight: 1
                            }}
                        >
                            −
                        </button>

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
                                fontSize: '18px',
                                fontWeight: 500,
                                lineHeight: 1
                            }}
                        >
                            +
                        </button>

                        <button
                            onClick={handleResetZoom}
                            title="Sığdır (%100)"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                padding: '6px 8px',
                                borderRadius: '6px'
                            }}
                        >
                            <Maximize2 size={15} />
                        </button>

                        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

                        <button
                            onClick={handleRotate}
                            title="90° Döndür"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                padding: '6px 8px',
                                borderRadius: '6px'
                            }}
                        >
                            <RotateCw size={15} />
                        </button>
                    </div>
                )}

                {/* Main Content Area */}
                <div
                    ref={containerRef}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{
                        flex: 1,
                        backgroundColor: '#18181b',
                        overflow: 'hidden',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {isPdf ? (
                        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {loading && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#8892b0',
                                    gap: '12px',
                                    backgroundColor: '#18181b',
                                    zIndex: 1
                                }}>
                                    <Loader2 className="spin" size={36} style={{ color: 'var(--accent-primary)' }} />
                                    <span style={{ fontSize: '13px', fontWeight: 500 }}>Belge hazırlanıyor...</span>
                                </div>
                            )}

                            {!error ? (
                                <iframe
                                    src={activeSource || rawPdfUrl}
                                    title={fileName}
                                    onLoad={() => setLoading(false)}
                                    onError={() => {
                                        setLoading(false)
                                        setError(true)
                                    }}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        backgroundColor: '#525659'
                                    }}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                                        PDF tarayıcı içinde görüntülenemedi.
                                    </p>
                                    <button className="btn btn-primary" onClick={handleExternalOpen}>
                                        <ExternalLink size={16} /> Yeni Sekmede Aç
                                    </button>
                                </div>
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
                            margin: 'auto',
                            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                        }}>
                            <img
                                src={activeSource || rawPdfUrl}
                                alt={fileName}
                                draggable={false}
                                onLoad={() => setLoading(false)}
                                style={{
                                    maxWidth: '85vw',
                                    maxHeight: '72vh',
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
                                Bu dosya türü (`{ext}`) tarayıcıda doğrudan içi önizlenemez. Dosyayı indirebilir veya yeni sekmede açabilirsiniz.
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
