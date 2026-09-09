import { useState, useEffect, useRef } from 'react'
import { formatDate } from '../utils/helpers'
import { RotateCcw, Sliders, Move, Eye, HelpCircle, Check, Info } from 'lucide-react'

const SCALE = 0.7 // Perfect scale for side-by-side view
const A4W = 794   // 210mm @ 96dpi
const A4H = 1122  // 297mm @ 96dpi
const PAD = 68    // 18mm padding

export const STAMP_DEFAULTS = {
    placementMode: 'footer',
    stampSize: 110,
    stampOffsetX: 0,
    stampOffsetY: 0,
    stampOpacity: 0.85,
    showStamp: true,
    signatureSize: 80,
    signatureOffsetX: 0,
    signatureOffsetY: 0,
    signatureOpacity: 0.9,
    showSignature: true,
    empSignatureSize: 80,
    empSignatureOffsetX: 0,
    empSignatureOffsetY: 0,
    empSignatureOpacity: 0.9,
    showEmpSignature: true,
}

function InfoTable({ title, rows }) {
    const thStyle = {
        background: '#0f172a', color: '#ffffff', fontSize: '10.5px', fontWeight: 800,
        textAlign: 'left', padding: '6px 10px', border: 'none',
        textTransform: 'uppercase', letterSpacing: '0.05em',
    }
    const tdLabel = {
        width: '130px', fontSize: '10px', fontWeight: 700, color: '#475569',
        padding: '6px 10px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', background: '#f8fafc',
    }
    const tdVal = {
        fontSize: '11px', fontWeight: 600, color: '#0f172a',
        padding: '6px 10px', borderBottom: '1px solid #e2e8f0',
    }
    return (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', marginBottom: '15px', tableLayout: 'fixed' }}>
            <thead>
                <tr><th colSpan="2" style={thStyle}>{title}</th></tr>
            </thead>
            <tbody>
                {rows.map(([label, value], i) => (
                    <tr key={i}>
                        <td style={tdLabel}>{label}</td>
                        <td style={tdVal}>{value || '-'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

export default function StampSignaturePreview({ docData, company, settings, onChange }) {
    const [stampSrc, setStampSrc] = useState(null)
    const [signatureSrc, setSignatureSrc] = useState(null)
    const [empSignatureSrc, setEmpSignatureSrc] = useState(null)
    const scrollRef = useRef(null)

    const ss = { ...STAMP_DEFAULTS, ...settings }

    useEffect(() => {
        if (company?.stamp_path) {
            window.electronAPI.readDocumentData(company.stamp_path).then(r => {
                if (r.success) setStampSrc(r.data); else setStampSrc(null)
            })
        } else setStampSrc(null)

        if (company?.signature_path) {
            window.electronAPI.readDocumentData(company.signature_path).then(r => {
                if (r.success) setSignatureSrc(r.data); else setSignatureSrc(null)
            })
        } else setSignatureSrc(null)

        if (docData?.employeeSignaturePath) {
            if (docData.employeeSignaturePath.startsWith('data:image/') || docData.employeeSignaturePath.startsWith('http')) {
                setEmpSignatureSrc(docData.employeeSignaturePath)
            } else if (window.electronAPI?.readDocumentData) {
                window.electronAPI.readDocumentData(docData.employeeSignaturePath).then(r => {
                    if (r?.success) setEmpSignatureSrc(r.data); else setEmpSignatureSrc(null)
                })
            } else {
                setEmpSignatureSrc(null)
            }
        } else {
            setEmpSignatureSrc(null)
        }
    }, [company, docData])

    // Auto-scroll to footer when component mounts (in footer mode)
    useEffect(() => {
        if (scrollRef.current && ss.placementMode === 'footer') {
            setTimeout(() => {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }, 150)
        }
    }, [ss.placementMode])

    // --- Drag handler ---
    const startDrag = (e, which) => {
        e.preventDefault()
        e.stopPropagation()
        const sx = e.clientX, sy = e.clientY
        const ox = ss[which + 'OffsetX'] ?? 0, oy = ss[which + 'OffsetY'] ?? 0
        const onMove = (ev) => {
            const nextX = ox + (ev.clientX - sx) / SCALE
            const nextY = oy + (ev.clientY - sy) / SCALE
            
            if (ss.placementMode === 'free') {
                onChange({
                    ...settings,
                    [which + 'OffsetX']: Math.max(0, Math.min(A4W, Math.round(nextX))),
                    [which + 'OffsetY']: Math.max(0, Math.min(A4H, Math.round(nextY))),
                })
            } else {
                onChange({
                    ...settings,
                    [which + 'OffsetX']: nextX,
                    [which + 'OffsetY']: nextY,
                })
            }
        }
        const onUp = () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }

    // --- Resize handler ---
    const startResize = (e, which) => {
        e.preventDefault()
        e.stopPropagation()
        const sx = e.clientX, sy = e.clientY
        const startSize = ss[which + 'Size'] ?? 80
        const onMove = (ev) => {
            const delta = ((ev.clientX - sx) + (ev.clientY - sy)) / 2 / SCALE
            onChange({
                ...settings,
                [which + 'Size']: Math.max(20, Math.min(260, Math.round(startSize + delta))),
            })
        }
        const onUp = () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }

    // Use fixed container height so that dragging offsets does not push layout or cause 2-page overflow
    const containerH = ss.placementMode === 'free' ? 40 : 80

    const renderInteractive = (which, src, zIndex) => {
        const size    = Math.round(ss[which + 'Size'] ?? 80)
        const ox      = ss[which + 'OffsetX'] ?? 0
        const oy      = ss[which + 'OffsetY'] ?? 0
        const opacity = ss[which === 'stamp' ? 'stampOpacity' : (which === 'empSignature' ? 'empSignatureOpacity' : 'signatureOpacity')] ?? 0.9
        const color   = which === 'stamp' ? '#3b82f6' : (which === 'empSignature' ? '#f59e0b' : '#10b981')

        const centerStyle = {
            position: 'absolute',
            top:  ss.placementMode === 'free' ? `${oy}px` : `calc(50% + ${oy}px)`,
            left: ss.placementMode === 'free' ? `${ox}px` : `calc(50% + ${ox}px)`,
            transform: 'translate(-50%, -50%)',
        }

        return (
            <>
                {/* Image */}
                <img
                    key={which + '-img'}
                    src={src}
                    alt={which}
                    draggable={false}
                    onMouseDown={(e) => startDrag(e, which)}
                    style={{
                        ...centerStyle,
                        width: `${size}px`,
                        height: `${size}px`,
                        objectFit: 'contain',
                        opacity,
                        cursor: 'move',
                        zIndex,
                        userSelect: 'none',
                        pointerEvents: 'auto',
                    }}
                />
                {/* Selection border */}
                <div
                    key={which + '-border'}
                    style={{
                        ...centerStyle,
                        width:  `${size}px`,
                        height: `${size}px`,
                        border: `2px dashed ${color}`,
                        borderRadius: '4px',
                        boxSizing: 'border-box',
                        pointerEvents: 'none',
                        zIndex: zIndex + 2,
                    }}
                />
                {/* Resize handle at bottom-right corner */}
                <div
                    key={which + '-resize'}
                    onMouseDown={(e) => startResize(e, which)}
                    title="Boyutlandır"
                    style={{
                        position: 'absolute',
                        top:  ss.placementMode === 'free' ? `${Math.round(oy + size / 2)}px` : `calc(50% + ${oy}px + ${size / 2}px)`,
                        left: ss.placementMode === 'free' ? `${Math.round(ox + size / 2)}px` : `calc(50% + ${ox}px + ${size / 2}px)`,
                        transform: 'translate(-50%, -50%)',
                        width: '14px',
                        height: '14px',
                        background: color,
                        border: '2px solid white',
                        borderRadius: '3px',
                        cursor: 'nwse-resize',
                        zIndex: zIndex + 4,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }}
                />
            </>
        )
    }

    const scaledDocStyle = {
        width: `${A4W}px`,
        minHeight: `${A4H}px`,
        transform: `scale(${SCALE})`,
        transformOrigin: 'top center',
        background: 'white',
        padding: `${PAD}px`,
        boxSizing: 'border-box',
        boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
        fontFamily: "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
    }

    return (
        <div style={{ display: 'flex', gap: '24px', height: '68vh', minHeight: '520px' }}>
            
            {/* ── LEFT PANEL: CONFIGURATION ── */}
            <div style={{
                width: '330px',
                flexShrink: 0,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
                <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sliders size={18} className="text-primary" /> Yerleşim &amp; Boyut
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Belge kaşe/imza yerleşimini özelleştirin.</p>
                </div>

                {/* Mod Seçici */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Yerleşim Modu
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => {
                                onChange({
                                    ...settings,
                                    placementMode: 'footer',
                                    stampOffsetX: 0,
                                    stampOffsetY: 0,
                                    signatureOffsetX: 0,
                                    signatureOffsetY: 0,
                                    empSignatureOffsetX: 0,
                                    empSignatureOffsetY: 0
                                })
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                background: ss.placementMode === 'footer' ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                color: ss.placementMode === 'footer' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'left'
                            }}
                        >
                            <span style={{
                                width: '16px', height: '16px', borderRadius: '50%',
                                border: `2px solid ${ss.placementMode === 'footer' ? 'var(--accent-primary)' : '#888'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                {ss.placementMode === 'footer' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                            </span>
                            <div>
                                <div style={{ fontWeight: 700 }}>Alt Bölüm (Sabit)</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Klasik imza kutusuna sabitler.</div>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                onChange({
                                    ...settings,
                                    placementMode: 'free',
                                    stampOffsetX: 530,
                                    stampOffsetY: 900,
                                    signatureOffsetX: 640,
                                    signatureOffsetY: 940,
                                    empSignatureOffsetX: 150,
                                    empSignatureOffsetY: 940
                                })
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                background: ss.placementMode === 'free' ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                color: ss.placementMode === 'free' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'left'
                            }}
                        >
                            <span style={{
                                width: '16px', height: '16px', borderRadius: '50%',
                                border: `2px solid ${ss.placementMode === 'free' ? 'var(--accent-primary)' : '#888'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                {ss.placementMode === 'free' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                            </span>
                            <div>
                                <div style={{ fontWeight: 700 }}>Serbest Yerleşim (Metin Üzeri)</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>A4 boyutu uzamaz, her yere sürüklenebilir.</div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Personel İmzası Ayarları (Varsa) */}
                {empSignatureSrc && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Personel İmzası Ayarları
                            </label>
                        </div>

                        {/* Visibility Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <input
                                type="checkbox"
                                id="showEmpSignature"
                                checked={ss.showEmpSignature ?? true}
                                onChange={(e) => onChange({ ...settings, showEmpSignature: e.target.checked })}
                                style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#f59e0b' }}
                            />
                            <label htmlFor="showEmpSignature" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                                Belgede Göster
                            </label>
                        </div>

                        {/* Size */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: (ss.showEmpSignature ?? true) ? 1 : 0.4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span>Boyut</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ss.empSignatureSize}px</span>
                            </div>
                            <input
                                type="range"
                                min="30"
                                max="200"
                                value={ss.empSignatureSize}
                                disabled={!(ss.showEmpSignature ?? true)}
                                onChange={(e) => onChange({ ...settings, empSignatureSize: parseInt(e.target.value) })}
                                style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                            />
                        </div>

                        {/* Opacity */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: (ss.showEmpSignature ?? true) ? 1 : 0.4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span>Saydamlık</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>%{Math.round((ss.empSignatureOpacity ?? 0.9) * 100)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                value={ss.empSignatureOpacity ?? 0.9}
                                disabled={!(ss.showEmpSignature ?? true)}
                                onChange={(e) => onChange({ ...settings, empSignatureOpacity: parseFloat(e.target.value) })}
                                style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                            />
                        </div>
                    </div>
                )}

                {/* Kaşe Ayarları (Varsa) */}
                {stampSrc && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Kaşe Ayarları
                            </label>
                        </div>

                        {/* Visibility Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <input
                                type="checkbox"
                                id="showStamp"
                                checked={ss.showStamp ?? true}
                                onChange={(e) => onChange({ ...settings, showStamp: e.target.checked })}
                                style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#3b82f6' }}
                            />
                            <label htmlFor="showStamp" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                                Belgede Göster
                            </label>
                        </div>
                        
                        {/* Size */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: (ss.showStamp ?? true) ? 1 : 0.4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span>Boyut</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ss.stampSize}px</span>
                            </div>
                            <input
                                type="range"
                                min="40"
                                max="240"
                                value={ss.stampSize}
                                disabled={!(ss.showStamp ?? true)}
                                onChange={(e) => onChange({ ...settings, stampSize: parseInt(e.target.value) })}
                                style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                        </div>

                        {/* Opacity */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: (ss.showStamp ?? true) ? 1 : 0.4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span>Saydamlık</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>%{Math.round(ss.stampOpacity * 100)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                value={ss.stampOpacity}
                                disabled={!(ss.showStamp ?? true)}
                                onChange={(e) => onChange({ ...settings, stampOpacity: parseFloat(e.target.value) })}
                                style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                        </div>
                    </div>
                )}

                {/* Firma İmzası Ayarları (Varsa) */}
                {signatureSrc && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Firma İmzası Ayarları
                            </label>
                        </div>

                        {/* Visibility Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <input
                                type="checkbox"
                                id="showSignature"
                                checked={ss.showSignature ?? true}
                                onChange={(e) => onChange({ ...settings, showSignature: e.target.checked })}
                                style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#10b981' }}
                            />
                            <label htmlFor="showSignature" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                                Belgede Göster
                            </label>
                        </div>

                        {/* Size */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: (ss.showSignature ?? true) ? 1 : 0.4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span>Boyut</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ss.signatureSize}px</span>
                            </div>
                            <input
                                type="range"
                                min="30"
                                max="200"
                                value={ss.signatureSize}
                                disabled={!(ss.showSignature ?? true)}
                                onChange={(e) => onChange({ ...settings, signatureSize: parseInt(e.target.value) })}
                                style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                            />
                        </div>

                        {/* Opacity */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: (ss.showSignature ?? true) ? 1 : 0.4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span>Saydamlık</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>%{Math.round(ss.signatureOpacity * 100)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                value={ss.signatureOpacity}
                                disabled={!(ss.showSignature ?? true)}
                                onChange={(e) => onChange({ ...settings, signatureOpacity: parseFloat(e.target.value) })}
                                style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                            />
                        </div>
                    </div>
                )}

                {/* Bilgi Kutusu */}
                <div style={{
                    marginTop: 'auto',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    gap: '10px',
                }}>
                    <Info size={16} className="text-primary" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--text-muted)', margin: 0 }}>
                        Kaşe ve imzaları sağdaki önizleme belgesi üzerinde <strong>sürükleyip bırakarak</strong> yerleştirebilir, köşelerindeki tutamaçlardan <strong>boyutlandırabilirsiniz.</strong>
                    </p>
                </div>

                {/* Reset Butonu */}
                <button
                    type="button"
                    onClick={() => onChange({ ...STAMP_DEFAULTS })}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
                        background: 'none', border: '1px solid var(--border-color)',
                        borderRadius: '8px', padding: '8px 12px', cursor: 'pointer',
                        transition: 'all 0.2s', width: '100%'
                    }}
                >
                    <RotateCcw size={14} />
                    Varsayılana Sıfırla
                </button>
            </div>

            {/* ── RIGHT PANEL: INTERACTIVE A4 PREVIEW ── */}
            <div style={{
                flexGrow: 1,
                background: '#2d2d30', // Acrobat style dark layout background
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                overflow: 'auto',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '40px 20px',
                boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.3)'
            }} ref={scrollRef}>
                
                {/* Document wrapper that matches scaled A4 bounds */}
                <div style={{
                    width: `${A4W * SCALE}px`,
                    height: `${A4H * SCALE}px`,
                    position: 'relative',
                    flexShrink: 0
                }}>
                    <div style={scaledDocStyle}>

                        {/* ── HEADER ── */}
                        {/* ── HEADER (Tüm belgeler için standart) ── */}
                        <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', color: '#000', margin: 0, letterSpacing: '-0.2px' }}>
                                {docData?.companyName}
                            </h2>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#475569', margin: 0 }}>
                                    Tarih: {formatDate(docData?.placeholders?.proposalDate || docData?.placeholders?.startDate || docData?.placeholders?.issueDate || new Date())}
                                </p>
                            </div>
                        </div>

                        {/* ── CENTER TITLE ── */}
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <h1 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: '#111', letterSpacing: '0.5px', margin: 0 }}>
                                {docData?.title}
                            </h1>
                        </div>

                        {/* ── CONTENT ── */}
                        <div style={{ fontSize: '13.5px', lineHeight: 1.7, color: '#333', flexGrow: 1, marginBottom: '20px' }}>
                            {docData?.templateId === 'assignment' ? (
                                <div>
                                    <InfoTable title="İŞVEREN BİLGİLERİ" rows={[
                                        ['ADI-SOYADI / ÜNVANI', docData?.companyName],
                                        ['İŞYERİ ADRESİ', docData?.companyAddress],
                                        ['İŞYERİ SGK NO', docData?.companySgk],
                                        ['VERGİ DAİRESİ / NO', docData?.companyTax],
                                    ]} />
                                    <InfoTable title="PERSONEL BİLGİLERİ" rows={[
                                        ['ADI - SOYADI', docData?.employeeName],
                                        ['T.C. KİMLİK NO', docData?.tcNo || '-'],
                                    ]} />
                                    <InfoTable title="GÖREVLENDİRME DETAYLARI" rows={[
                                        ['GİDİLECEK İŞYERİ', docData?.placeholders?.workplaceName],
                                        ['İŞYERİ ADRESİ', docData?.placeholders?.workplaceAddress],
                                        ['YAPILACAK İŞ', docData?.placeholders?.workType],
                                        ['GİDİŞ TARİHİ', docData?.placeholders?.startDate ? formatDate(docData.placeholders.startDate) : null],
                                        ['DÖNÜŞ TARİHİ', docData?.placeholders?.endDate ? formatDate(docData.placeholders.endDate) : null],
                                    ]} />
                                    <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '12px', fontSize: '12px', fontStyle: 'italic', whiteSpace: 'pre-wrap', textAlign: 'justify' }}>
                                        {docData?.content}
                                    </div>
                                </div>
                            ) : docData?.templateId === 'customer_proposal' ? (
                                <div style={{ fontSize: '11px', lineHeight: 1.5 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                                        <InfoTable title="MÜŞTERİ BİLGİLERİ" rows={[
                                            ['MÜŞTERİ ÜNVANI', docData?.customerName],
                                            ['İLGİLİ KİŞİ', docData?.placeholders?.attentionPerson],
                                            ['HİZMET YERİ / SAHA', docData?.placeholders?.workLocation],
                                            ['VERGİ DAİRESİ / NO', docData?.customerTax],
                                        ]} />
                                        <InfoTable title="TEKLİF DETAYLARI" rows={[
                                            ['TEKLİF NO', docData?.placeholders?.proposalNo],
                                            ['TEKLİF TARİHİ', formatDate(docData?.placeholders?.proposalDate || new Date())],
                                            ['GEÇERLİLİK SÜRESİ', docData?.placeholders?.validityDays || '15 Gün'],
                                            ['HAZIRLAYAN YETKİLİ', docData?.placeholders?.preparedBy || docData?.companyName],
                                        ]} />
                                    </div>


                                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', margin: '12px 0', fontSize: '11px' }}>
                                        <thead>
                                            <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                                                <th style={{ width: '30px', textAlign: 'center', padding: '7px 6px', borderRight: '1px solid rgba(255,255,255,0.15)', fontSize: '10px' }}>#</th>
                                                <th style={{ textAlign: 'left', padding: '7px 10px', borderRight: '1px solid rgba(255,255,255,0.15)', fontSize: '10px', textTransform: 'uppercase' }}>Hizmet / Makine / İş Kalemi</th>
                                                {docData?.priceColumns && docData.priceColumns.length > 0 ? (
                                                    <>
                                                        {docData.priceColumns.map((col, cIdx) => (
                                                            <th key={col.id} style={{ textAlign: 'center', padding: '7px 8px', borderRight: cIdx === docData.priceColumns.length - 1 && !docData?.showConditionColumn ? 'none' : '1px solid rgba(255,255,255,0.15)', fontSize: '10px', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                                                                {col.label}
                                                            </th>
                                                        ))}
                                                        {docData?.showConditionColumn && (
                                                            <th style={{ minWidth: '130px', textAlign: 'left', padding: '7px 8px', fontSize: '10px', textTransform: 'uppercase' }}>Çalışma Koşulu / Not</th>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <th style={{ width: '55px', textAlign: 'center', padding: '7px 8px', borderRight: '1px solid rgba(255,255,255,0.15)', fontSize: '10px' }}>Miktar</th>
                                                        <th style={{ width: '55px', textAlign: 'center', padding: '7px 8px', borderRight: '1px solid rgba(255,255,255,0.15)', fontSize: '10px' }}>Birim</th>
                                                        <th style={{ width: '90px', textAlign: 'right', padding: '7px 8px', fontSize: '10px' }}>Birim Fiyat</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(docData?.items || []).map((item, idx) => (
                                                <tr key={idx} style={{ background: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                                                    <td style={{ textAlign: 'center', padding: '6px 6px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontWeight: 600, color: '#64748b' }}>{idx + 1}</td>
                                                    <td style={{ fontWeight: 600, padding: '6px 10px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', color: '#0f172a' }}>{item.description || item.name}</td>
                                                    {docData?.priceColumns && docData.priceColumns.length > 0 ? (
                                                        <>
                                                            {docData.priceColumns.map((col, cIdx) => (
                                                                <td key={col.id} style={{ textAlign: 'center', fontWeight: 700, color: '#0f172a', padding: '6px 8px', borderBottom: '1px solid #e2e8f0', borderRight: cIdx === docData.priceColumns.length - 1 && !docData?.showConditionColumn ? 'none' : '1px solid #e2e8f0', background: 'rgba(241, 245, 249, 0.4)' }}>
                                                                    {item.prices?.[col.id] || '-'}
                                                                </td>
                                                            ))}
                                                            {docData?.showConditionColumn && (
                                                                <td style={{ color: '#475569', fontSize: '10.5px', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>
                                                                    {item.condition || '-'}
                                                                </td>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{item.quantity}</td>
                                                            <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{item.unit || 'Adet'}</td>
                                                            <td style={{ textAlign: 'right', fontWeight: 600, padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>
                                                                {typeof item.unitPrice === 'number' ? item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : item.unitPrice} ₺
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {docData?.terms && (
                                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', marginTop: '14px', marginBottom: 0, fontSize: '11px' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ background: '#0f172a', color: '#ffffff', fontSize: '10.5px', fontWeight: 800, textAlign: 'left', padding: '6px 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        TEKLİF ŞARTLARI VE GENEL HÜKÜMLER
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td style={{ padding: '8px 12px', fontSize: '11px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                                                        {docData.terms}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            ) : docData?.templateId === 'customer_contract' ? (
                                <div className="customer-contract-doc">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                                        <InfoTable title="HİZMET VEREN (YÜKLENİCİ)" rows={[
                                            ['ÜNVANI', docData?.companyName],
                                            ['ADRESİ', docData?.companyAddress || '-'],
                                            ['VERGİ DAİRESİ / NO', docData?.companyTax || '-'],
                                        ]} />
                                        <InfoTable title="HİZMET ALAN (MÜŞTERİ)" rows={[
                                            ['ÜNVANI', docData?.customerName],
                                            ['ADRESİ', docData?.customerAddress || docData?.placeholders?.workLocation || '-'],
                                            ['VERGİ DAİRESİ / NO', docData?.customerTax || '-'],
                                        ]} />
                                    </div>

                                    <div className="contract-articles" style={{ marginTop: '12px' }}>
                                        {(docData?.articles || []).map((art, idx) => (
                                            <div key={idx} style={{ marginBottom: '14px' }}>
                                                <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.02em' }}>{art.title}</div>
                                                <div style={{ fontSize: '11.5px', lineHeight: 1.6, color: '#334155', textAlign: 'justify' }}>{art.renderedContent || art.content}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : docData?.templateId === 'customer_reconciliation' ? (
                                <div className="customer-reconciliation-doc">
                                    <div style={{ fontSize: '12.5px', lineHeight: 1.7, color: '#1e293b', whiteSpace: 'pre-line', marginBottom: '16px' }}>
                                        {docData?.content}
                                    </div>
                                    <div style={{ marginTop: '24px', borderTop: '1px dashed #94a3b8', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                                        <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            MUTABAKAT BEYANI (MÜŞTERİ TARAFINDAN ONAYLANACAKTIR):
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                                            <span style={{ width: '16px', height: '16px', border: '1.5px solid #475569', display: 'inline-block' }}></span>
                                            <span>Yukarıda belirtilen bakiye şirketimiz kayıtlarıyla <strong>MUTABIKTIR</strong>.</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                                            <span style={{ width: '16px', height: '16px', border: '1.5px solid #475569', display: 'inline-block' }}></span>
                                            <span>Kayıtlarımızla <strong>MUTABIK DEĞİLDİR</strong>. (Şirketimiz kayıtlarına göre bakiye: ________________ ₺)</span>
                                        </div>
                                    </div>
                                </div>
                            ) : docData?.templateId === 'customer_delivery' ? (
                                <div className="customer-delivery-doc">
                                    <InfoTable title="TESLİM EDİLEN EKİPMAN VE HİZMET BİLGİLERİ" rows={[
                                        ['MÜŞTERİ / PROJE', docData?.customerName],
                                        ['TESLİM EDİLEN EKİPMAN', docData?.placeholders?.equipmentInfo || '-'],
                                        ['PLAKA / SERİ NO', docData?.placeholders?.serialPlateNo || '-'],
                                        ['ÇALIŞMA SAATİ / KM', docData?.placeholders?.workingHoursKm || '-'],
                                        ['TESLİM TARİHİ & SAATİ', `${formatDate(docData?.placeholders?.deliveryDate)} - ${docData?.placeholders?.deliveryTime || ''}`],
                                        ['TESLİM YERİ / ŞANTİYE', docData?.placeholders?.deliveryLocation || '-'],
                                        ['DURUM & ÖZEL NOTLAR', docData?.placeholders?.notes || '-'],
                                    ]} />
                                    <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#475569', marginBottom: '16px', lineHeight: 1.6 }}>
                                        {docData?.content}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ whiteSpace: 'pre-wrap', textAlign: 'justify' }}>{docData?.content}</div>
                            )}
                        </div>

                        {/* ── FOOTER / SIGNATURES ── */}
                        {(docData?.showSignatures !== false && docData?.includeStamp !== false && settings?.showSignatures !== false && settings?.includeStamp !== false) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', marginTop: 'auto' }}>
                                {/* Personel / Müşteri İmzası — INTERACTIVE */}
                                <div style={{ textAlign: 'center', position: 'relative' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, borderBottom: '1px solid #ddd', paddingBottom: '6px', marginBottom: '10px', textTransform: 'uppercase' }}>
                                        {docData?.customerName ? 'MÜŞTERİ / HİZMET ALAN' : 'PERSONEL İMZASI'}
                                    </p>
                                    <div style={{ height: `${containerH}px`, position: 'relative', overflow: 'visible', marginBottom: '10px' }}>
                                        {ss.placementMode !== 'free' && empSignatureSrc && (ss.showEmpSignature ?? true) && renderInteractive('empSignature', empSignatureSrc, 3)}
                                        {ss.placementMode !== 'free' && !(empSignatureSrc && (ss.showEmpSignature ?? true)) && (
                                            ((ss.showEmpSignature ?? true) && !empSignatureSrc) ? (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '11px' }}>
                                                    {docData?.customerName ? 'Müşteri yetkilisi' : 'Personel imzası yok'}
                                                </div>
                                            ) : null
                                        )}
                                        {ss.placementMode === 'free' && (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '11px', fontStyle: 'italic' }}>
                                                (Serbest Yerleşim Aktif)
                                            </div>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>{docData?.customerName || docData?.employeeName}</p>
                                    {docData?.customerName && <span style={{ fontSize: '10.5px', color: '#64748b' }}>Yetkili Kaşe & İmza</span>}
                                </div>

                                {/* Yetkili Onayı / Hizmet Veren — INTERACTIVE */}
                                <div style={{ textAlign: 'center', position: 'relative' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, borderBottom: '1px solid #ddd', paddingBottom: '6px', marginBottom: '10px', textTransform: 'uppercase' }}>
                                        {docData?.customerName ? 'HİZMET VEREN (YÜKLENİCİ)' : 'YETKİLİ ONAYI'}
                                    </p>
                                    <div style={{ height: `${containerH}px`, position: 'relative', overflow: 'visible', marginBottom: '10px' }}>
                                        {ss.placementMode !== 'free' && stampSrc && (ss.showStamp ?? true) && renderInteractive('stamp',     stampSrc,     1)}
                                        {ss.placementMode !== 'free' && signatureSrc && (ss.showSignature ?? true) && renderInteractive('signature', signatureSrc, 2)}
                                        {ss.placementMode !== 'free' && !(stampSrc && (ss.showStamp ?? true)) && !(signatureSrc && (ss.showSignature ?? true)) && (
                                            (((ss.showStamp ?? true) && !stampSrc) || ((ss.showSignature ?? true) && !signatureSrc)) ? (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '11px' }}>
                                                    Kaşe / imza yüklenmemiş
                                                </div>
                                            ) : null
                                        )}
                                        {ss.placementMode === 'free' && (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '11px', fontStyle: 'italic' }}>
                                                (Serbest Yerleşim Aktif)
                                            </div>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>{docData?.companyName}</p>
                                    {docData?.customerName && <span style={{ fontSize: '10.5px', color: '#64748b' }}>Firma Kaşe & İmza</span>}
                                </div>
                            </div>
                        )}

                        {/* Eğer Serbest Yerleşim modu ise, kaşe ve imzaları A4 sayfasının relative scope'unda render et */}
                        {(docData?.showSignatures !== false && docData?.includeStamp !== false && settings?.showSignatures !== false && settings?.includeStamp !== false) && (
                            <>
                                {ss.placementMode === 'free' && stampSrc && (ss.showStamp ?? true) && renderInteractive('stamp', stampSrc, 10)}
                                {ss.placementMode === 'free' && signatureSrc && (ss.showSignature ?? true) && renderInteractive('signature', signatureSrc, 11)}
                                {ss.placementMode === 'free' && empSignatureSrc && (ss.showEmpSignature ?? true) && renderInteractive('empSignature', empSignatureSrc, 12)}
                            </>
                        )}

                    </div>
                </div>
            </div>

        </div>
    )
}
