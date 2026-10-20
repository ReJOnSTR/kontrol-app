import React, { useState } from 'react';
import { Upload, FileText, Trash2, Eye, Loader2 } from 'lucide-react';
import DocumentPreviewModal from './DocumentPreviewModal';
import { resolveDroppedFile } from '../utils/fileUploadHelper';

export default function FileAttachmentInput({ value, onChange, label = "Belge / Dosya" }) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);

    const handleSelectFile = async () => {
        try {
            const result = await window.electronAPI.selectFile();
            if (!result.canceled && result.filePaths.length > 0) {
                const path = result.filePaths[0];
                const name = path.split(/[\\/]/).pop();
                onChange({ path, name });
            }
        } catch (error) {
            console.error("Failed to select file:", error);
        }
    };

    const handleClearFile = (e) => {
        e.stopPropagation();
        onChange(null);
    };

    const handleOpenFile = async (e) => {
        e.stopPropagation();
        const fileName = getFileName();
        const filePath = typeof value === 'string' ? value : value?.path;

        if (filePath || fileName) {
            try {
                const res = await window.electronAPI.readDocumentData(filePath || fileName);
                if (res && res.success) {
                    setPreviewDoc({
                        data: res.data,
                        name: fileName || res.fileName,
                        path: res.path || filePath,
                        ext: res.ext
                    });
                    return;
                }
            } catch (err) {
                console.warn("Failed to read document preview:", err);
            }
            setPreviewDoc({
                name: fileName,
                path: filePath
            });
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) {
            const file = files[0];
            setIsUploading(true);
            try {
                const resolved = await resolveDroppedFile(file);
                if (resolved && resolved.path) {
                    onChange({ path: resolved.path, name: resolved.name });
                }
            } catch (err) {
                console.error("Failed to process dropped file:", err);
                alert("Dosya işlenirken bir hata oluştu: " + (err.message || 'Bilinmeyen hata'));
            } finally {
                setIsUploading(false);
            }
        }
    };

    const getFileName = () => {
        if (!value) return '';
        if (typeof value === 'string') {
            return value.split(/[\\/]/).pop();
        }
        return value.name || value.path.split(/[\\/]/).pop();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {label}
            </label>

            {value ? (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <FileText size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        <span style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {getFileName()}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={handleOpenFile}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                background: 'var(--accent-subtle)',
                                color: 'var(--accent-primary)',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'}
                            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                        >
                            <Eye size={14} />
                            <span>Gör</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleClearFile}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '6px',
                                borderRadius: '8px',
                                background: 'transparent',
                                color: 'var(--danger)',
                                border: '1px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
                            title="Dosyayı Kaldır"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onClick={isUploading ? undefined : handleSelectFile}
                    onDragOver={isUploading ? undefined : handleDragOver}
                    onDragLeave={isUploading ? undefined : handleDragLeave}
                    onDrop={isUploading ? undefined : handleDrop}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px 16px',
                        borderRadius: '12px',
                        border: isDragging ? '2px dashed var(--accent-primary)' : '1px dashed var(--border-color)',
                        background: isDragging ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                        cursor: isUploading ? 'wait' : 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center',
                        opacity: isUploading ? 0.7 : 1
                    }}
                    onMouseEnter={e => { if (!isDragging && !isUploading) e.currentTarget.style.borderColor = 'var(--accent-primary)' }}
                    onMouseLeave={e => { if (!isDragging && !isUploading) e.currentTarget.style.borderColor = 'var(--border-color)' }}
                >
                    {isUploading ? (
                        <>
                            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '8px' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                Dosya işleniyor ve yükleniyor...
                            </span>
                        </>
                    ) : (
                        <>
                            <Upload size={24} style={{ color: isDragging ? 'var(--accent-primary)' : 'var(--text-muted)', marginBottom: '8px' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                Dosya yüklemek için tıklayın veya sürükleyin
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                PDF, PNG, JPG, JPEG (Maks 15MB)
                            </span>
                        </>
                    )}
                </div>
            )}

            <DocumentPreviewModal
                doc={previewDoc}
                onClose={() => setPreviewDoc(null)}
            />
        </div>
    );
}
