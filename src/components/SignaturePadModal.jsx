import React, { useRef, useState, useEffect } from 'react';
import { Edit3, Upload, Trash2, Check, X, RotateCcw } from 'lucide-react';
import Modal from './Modal';

export default function SignaturePadModal({ isOpen, onClose, onSave, initialSignature = null, title = "Personel İmzası" }) {
    const [activeTab, setActiveTab] = useState('draw'); // 'draw' | 'upload'
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [uploadedImage, setUploadedImage] = useState(null);

    const canvasRef = useRef(null);
    const lastPosRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (isOpen) {
            setUploadedImage(null);
            setHasDrawn(false);
            if (activeTab === 'draw') {
                setTimeout(() => initCanvas(), 100);
            }
        }
    }, [isOpen, activeTab]);

    const initCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Clear canvas with transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a'; // Deep slate blue/black for signature

        // If initial signature exists and it's a data URL, draw it
        if (initialSignature && initialSignature.startsWith('data:image/')) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                setHasDrawn(true);
            };
            img.src = initialSignature;
        }
    };

    const getCanvasCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
        const scaleX = rect.width ? canvas.width / rect.width : 1;
        const scaleY = rect.height ? canvas.height / rect.height : 1;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        setIsDrawing(true);
        setHasDrawn(true);
        const pos = getCanvasCoordinates(e);
        lastPosRef.current = pos;
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const currentPos = getCanvasCoordinates(e);

        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.stroke();

        lastPosRef.current = currentPos;
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const handleClear = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const handleFileUpload = (e) => {
        e.stopPropagation();
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Lütfen geçerli bir resim dosyası seçin (PNG, JPG).');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                setUploadedImage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleConfirmSave = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (activeTab === 'upload' && uploadedImage) {
            onSave(uploadedImage);
            onClose();
        } else if (activeTab === 'draw') {
            const canvas = canvasRef.current;
            if (!canvas || !hasDrawn) {
                alert('Lütfen imza alanına çizim yapın veya geçerli bir görsel yükleyin.');
                return;
            }
            const dataUrl = canvas.toDataURL('image/png');
            onSave(dataUrl);
            onClose();
        }
    };

    const footer = (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}>
                İptal
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
                {activeTab === 'draw' && (
                    <button type="button" className="btn btn-secondary" onClick={handleClear} disabled={!hasDrawn}>
                        <RotateCcw size={16} /> Temizle
                    </button>
                )}
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmSave}
                    disabled={activeTab === 'upload' ? !uploadedImage : !hasDrawn}
                >
                    <Check size={16} /> İmza Kaydet
                </button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="md"
            footer={footer}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={(e) => e.stopPropagation()}>
                {/* Mode Selector Tabs */}
                <div style={{
                    display: 'flex',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '10px',
                    padding: '4px',
                    gap: '4px'
                }}>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTab('draw'); }}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'draw' ? 'var(--bg-primary)' : 'transparent',
                            color: activeTab === 'draw' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            boxShadow: activeTab === 'draw' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Edit3 size={15} /> Ekranda Çiz
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTab('upload'); }}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'upload' ? 'var(--bg-primary)' : 'transparent',
                            color: activeTab === 'upload' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            boxShadow: activeTab === 'upload' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Upload size={15} /> Görsel Yükle (PNG)
                    </button>
                </div>

                {/* Canvas Drawing Tab */}
                {activeTab === 'draw' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '100%',
                            height: '180px',
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            border: '2px dashed var(--border-color)',
                            position: 'relative',
                            overflow: 'hidden',
                            cursor: 'crosshair',
                            touchAction: 'none'
                        }}>
                            <canvas
                                ref={canvasRef}
                                width={500}
                                height={180}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                style={{ width: '100%', height: '100%', display: 'block' }}
                            />
                            {!hasDrawn && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none',
                                    color: '#94a3b8',
                                    fontSize: '13px',
                                    fontWeight: 500
                                }}>
                                    Buraya imzanızı çizin
                                </div>
                            )}
                            {/* Baseline guide */}
                            <div style={{
                                position: 'absolute',
                                bottom: '30px',
                                left: '10%',
                                right: '10%',
                                borderBottom: '1px dashed #cbd5e1',
                                pointerEvents: 'none'
                            }} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Şeffaf ve net görünüm için beyaz alan içinde imzanızı tamamlayın.
                        </span>
                    </div>
                )}

                {/* Image Upload Tab */}
                {activeTab === 'upload' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '24px',
                                borderRadius: '12px',
                                border: '2px dashed var(--border-color)',
                                backgroundColor: 'var(--bg-secondary)',
                                cursor: 'pointer',
                                gap: '10px'
                            }}
                        >
                            <Upload size={28} style={{ color: 'var(--accent-primary)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                İmza görseli seçmek için tıklayın
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                Önerilen: Şeffaf (Transparent) PNG formatı
                            </span>
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                            />
                        </label>

                        {uploadedImage && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '16px',
                                backgroundColor: '#ffffff',
                                borderRadius: '10px',
                                border: '1px solid var(--border-color)'
                            }}>
                                <img
                                    src={uploadedImage}
                                    alt="Yüklenen İmza"
                                    style={{ maxHeight: '100px', objectFit: 'contain' }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
