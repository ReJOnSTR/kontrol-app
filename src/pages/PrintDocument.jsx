import React, { useState, useEffect } from 'react';
import { formatDate } from '../utils/helpers';
import './PrintDocument.css';
import html2pdf from 'html2pdf.js';

const DEFAULT_STAMP_SETTINGS = {
    placementMode: 'footer',
    stampSize: 110,
    stampOffsetX: 0,
    stampOffsetY: 0,
    stampOpacity: 0.85,
    signatureSize: 80,
    signatureOffsetX: 0,
    signatureOffsetY: 0,
    signatureOpacity: 0.9,
    empSignatureSize: 80,
    empSignatureOffsetX: 0,
    empSignatureOffsetY: 0,
    empSignatureOpacity: 0.9,
}

function SingleDoc({ docItem }) {
    const [signatureSrc, setSignatureSrc] = useState(null);
    const [stampSrc, setStampSrc] = useState(null);
    const [empSignatureSrc, setEmpSignatureSrc] = useState(null);

    useEffect(() => {
        if (docItem?.companySignaturePath) {
            window.electronAPI.readDocumentData(docItem.companySignaturePath).then(res => {
                if (res.success) setSignatureSrc(res.data);
            });
        } else setSignatureSrc(null);

        if (docItem?.companyStampPath) {
            window.electronAPI.readDocumentData(docItem.companyStampPath).then(res => {
                if (res.success) setStampSrc(res.data);
            });
        } else setStampSrc(null);

        if (docItem?.employeeSignaturePath) {
            if (docItem.employeeSignaturePath.startsWith('data:image/') || docItem.employeeSignaturePath.startsWith('http')) {
                setEmpSignatureSrc(docItem.employeeSignaturePath);
            } else if (window.electronAPI?.readDocumentData) {
                window.electronAPI.readDocumentData(docItem.employeeSignaturePath).then(res => {
                    if (res?.success) setEmpSignatureSrc(res.data);
                    else setEmpSignatureSrc(null);
                });
            } else setEmpSignatureSrc(null);
        } else setEmpSignatureSrc(null);
    }, [docItem]);

    const ss = { ...DEFAULT_STAMP_SETTINGS, ...(docItem.stampSettings || {}) };
    const containerH = ss.placementMode === 'free' ? 40 : 80;

    return (
        <div className="a4-page" style={{ position: 'relative', pageBreakAfter: 'always', breakAfter: 'page' }}>
            {/* Header */}
            <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', color: '#000', margin: 0, letterSpacing: '-0.2px' }}>
                    {docItem.companyName}
                </h2>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#475569', margin: 0 }}>
                        Tarih: {formatDate(docItem.placeholders?.startDate || docItem.placeholders?.issueDate || new Date())}
                    </p>
                </div>
            </div>

            {/* Document Title (Centered) */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: '#111', letterSpacing: '0.5px', margin: 0 }}>
                    {docItem.title}
                </h1>
            </div>

            {/* Body Content */}
            <div className="doc-body">
                {docItem.templateId === 'assignment' ? (
                    <div className="assignment-tables">
                        <table className="info-table">
                            <thead>
                                <tr><th colSpan="2" className="section-title">İŞVEREN BİLGİLERİ</th></tr>
                            </thead>
                            <tbody>
                                <tr><td className="label-cell">ADI-SOYADI / ÜNVANI</td><td className="value-cell">{docItem.companyName || '-'}</td></tr>
                                <tr><td className="label-cell">İŞYERİ ADRESİ</td><td className="value-cell">{docItem.companyAddress || '-'}</td></tr>
                                <tr><td className="label-cell">İŞYERİ SGK NO</td><td className="value-cell">{docItem.companySgk || '-'}</td></tr>
                                <tr><td className="label-cell">VERGİ DAİRESİ / NO</td><td className="value-cell">{docItem.companyTax || '-'}</td></tr>
                            </tbody>
                        </table>

                        <table className="info-table">
                            <thead>
                                <tr><th colSpan="2" className="section-title">PERSONEL BİLGİLERİ</th></tr>
                            </thead>
                            <tbody>
                                <tr><td className="label-cell">ADI - SOYADI</td><td className="value-cell">{docItem.employeeName || '-'}</td></tr>
                                <tr><td className="label-cell">T.C. KİMLİK NO</td><td className="value-cell">{docItem.tcNo || '-'}</td></tr>
                            </tbody>
                        </table>

                        <table className="info-table">
                            <thead>
                                <tr><th colSpan="2" className="section-title">GÖREVLENDİRME DETAYLARI</th></tr>
                            </thead>
                            <tbody>
                                <tr><td className="label-cell">GİDİLECEK İŞYERİ</td><td className="value-cell">{docItem.placeholders?.workplaceName || '-'}</td></tr>
                                <tr><td className="label-cell">İŞYERİ ADRESİ</td><td className="value-cell">{docItem.placeholders?.workplaceAddress || '-'}</td></tr>
                                <tr><td className="label-cell">YAPILACAK İŞ</td><td className="value-cell">{docItem.placeholders?.workType || '-'}</td></tr>
                                <tr><td className="label-cell">GİDİŞ TARİHİ</td><td className="value-cell">{docItem.placeholders?.startDate ? formatDate(docItem.placeholders.startDate) : '-'}</td></tr>
                                <tr><td className="label-cell">DÖNÜŞ TARİHİ</td><td className="value-cell">{docItem.placeholders?.endDate ? formatDate(docItem.placeholders.endDate) : '-'}</td></tr>
                            </tbody>
                        </table>

                        <div className="assignment-text" style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '12px', fontSize: '12px', fontStyle: 'italic' }}>
                            {docItem.content}
                        </div>
                    </div>
                ) : docItem.templateId === 'customer_proposal' ? (
                    <div className="customer-proposal-doc">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                            <table className="info-table" style={{ margin: 0 }}>
                                <thead><tr><th colSpan="2" className="section-title">MÜŞTERİ BİLGİLERİ</th></tr></thead>
                                <tbody>
                                    <tr><td className="label-cell">MÜŞTERİ ÜNVANI</td><td className="value-cell" style={{ fontWeight: 700 }}>{docItem.customerName || '-'}</td></tr>
                                    <tr><td className="label-cell">İLGİLİ KİŞİ</td><td className="value-cell">{docItem.placeholders?.attentionPerson || '-'}</td></tr>
                                    <tr><td className="label-cell">HİZMET YERİ / SAHA</td><td className="value-cell">{docItem.placeholders?.workLocation || '-'}</td></tr>
                                    <tr><td className="label-cell">VERGİ DAİRESİ / NO</td><td className="value-cell">{docItem.customerTax || '-'}</td></tr>
                                </tbody>
                            </table>
                            <table className="info-table" style={{ margin: 0 }}>
                                <thead><tr><th colSpan="2" className="section-title">TEKLİF DETAYLARI</th></tr></thead>
                                <tbody>
                                    <tr><td className="label-cell">TEKLİF NO</td><td className="value-cell" style={{ fontWeight: 700 }}>{docItem.placeholders?.proposalNo || '-'}</td></tr>
                                    <tr><td className="label-cell">TEKLİF TARİHİ</td><td className="value-cell">{formatDate(docItem.placeholders?.proposalDate || new Date())}</td></tr>
                                    <tr><td className="label-cell">GEÇERLİLİK SÜRESİ</td><td className="value-cell">{docItem.placeholders?.validityDays || '15 Gün'}</td></tr>
                                    <tr><td className="label-cell">HAZIRLAYAN YETKİLİ</td><td className="value-cell">{docItem.placeholders?.preparedBy || docItem.companyName}</td></tr>
                                </tbody>
                            </table>
                        </div>

                        {docItem.placeholders?.projectSubject && (
                            <div style={{ padding: '6px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', marginBottom: '12px', fontSize: '11.5px' }}>
                                <strong style={{ color: '#0f172a' }}>KONU:</strong> {docItem.placeholders.projectSubject}
                            </div>
                        )}

                        <table className="proposal-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '30px', textAlign: 'center' }}>#</th>
                                    <th>Hizmet / Kalem Açıklaması</th>
                                    <th style={{ width: '60px', textAlign: 'center' }}>Miktar</th>
                                    <th style={{ width: '60px', textAlign: 'center' }}>Birim</th>
                                    <th style={{ width: '100px', textAlign: 'right' }}>Birim Fiyat</th>
                                    <th style={{ width: '110px', textAlign: 'right' }}>Toplam (₺)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(docItem.items || []).map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                        <td style={{ fontWeight: 600 }}>{item.description || item.name}</td>
                                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                        <td style={{ textAlign: 'center' }}>{item.unit || 'Adet'}</td>
                                        <td style={{ textAlign: 'right' }}>{typeof item.unitPrice === 'number' ? item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : item.unitPrice} ₺</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="proposal-summary-wrap">
                            <table className="proposal-summary-table">
                                <tbody>
                                    <tr>
                                        <td className="sum-label">ARA TOPLAM</td>
                                        <td className="sum-val">{Number(docItem.subtotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                                    </tr>
                                    <tr>
                                        <td className="sum-label">KDV (%{docItem.vatRate ?? 20})</td>
                                        <td className="sum-val">{Number(docItem.vatAmount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                                    </tr>
                                    <tr className="grand-total">
                                        <td className="sum-label">GENEL TOPLAM</td>
                                        <td className="sum-val">{Number(docItem.grandTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {docItem.terms && (
                            <div style={{ marginTop: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', padding: '10px 12px', borderRadius: '4px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.04em' }}>TEKLİF ŞARTLARI VE NOTLAR</div>
                                <div style={{ fontSize: '10.5px', color: '#475569', lineHeight: 1.55, whiteSpace: 'pre-line' }}>{docItem.terms}</div>
                            </div>
                        )}
                    </div>
                ) : docItem.templateId === 'customer_contract' ? (
                    <div className="customer-contract-doc">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                            <table className="info-table" style={{ margin: 0 }}>
                                <thead><tr><th colSpan="2" className="section-title">HİZMET VEREN (YÜKLENİCİ)</th></tr></thead>
                                <tbody>
                                    <tr><td className="label-cell">ÜNVANI</td><td className="value-cell" style={{ fontWeight: 700 }}>{docItem.companyName}</td></tr>
                                    <tr><td className="label-cell">ADRESİ</td><td className="value-cell">{docItem.companyAddress || '-'}</td></tr>
                                    <tr><td className="label-cell">VERGİ DAİRESİ / NO</td><td className="value-cell">{docItem.companyTax || '-'}</td></tr>
                                </tbody>
                            </table>
                            <table className="info-table" style={{ margin: 0 }}>
                                <thead><tr><th colSpan="2" className="section-title">HİZMET ALAN (MÜŞTERİ)</th></tr></thead>
                                <tbody>
                                    <tr><td className="label-cell">ÜNVANI</td><td className="value-cell" style={{ fontWeight: 700 }}>{docItem.customerName}</td></tr>
                                    <tr><td className="label-cell">ADRESİ</td><td className="value-cell">{docItem.customerAddress || docItem.placeholders?.workLocation || '-'}</td></tr>
                                    <tr><td className="label-cell">VERGİ DAİRESİ / NO</td><td className="value-cell">{docItem.customerTax || '-'}</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="contract-articles" style={{ marginTop: '12px' }}>
                            {(docItem.articles || []).map((art, idx) => (
                                <div key={idx} className="contract-article">
                                    <div className="contract-article-title">{art.title}</div>
                                    <div className="contract-article-content">{art.renderedContent || art.content}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : docItem.templateId === 'customer_reconciliation' ? (
                    <div className="customer-reconciliation-doc">
                        <div style={{ fontSize: '12.5px', lineHeight: 1.7, color: '#1e293b', whiteSpace: 'pre-line', marginBottom: '16px' }}>
                            {docItem.content}
                        </div>
                        <div className="reconciliation-choice-box">
                            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                MUTABAKAT BEYANI (MÜŞTERİ TARAFINDAN ONAYLANACAKTIR):
                            </div>
                            <div className="reconciliation-choice">
                                <span className="reconciliation-checkbox"></span>
                                <span>Yukarıda belirtilen bakiye şirketimiz kayıtlarıyla <strong>MUTABIKTIR</strong>.</span>
                            </div>
                            <div className="reconciliation-choice">
                                <span className="reconciliation-checkbox"></span>
                                <span>Kayıtlarımızla <strong>MUTABIK DEĞİLDİR</strong>. (Şirketimiz kayıtlarına göre bakiye: ________________ ₺)</span>
                            </div>
                        </div>
                    </div>
                ) : docItem.templateId === 'customer_delivery' ? (
                    <div className="customer-delivery-doc">
                        <table className="info-table" style={{ marginBottom: '14px' }}>
                            <thead><tr><th colSpan="2" className="section-title">TESLİM EDİLEN EKİPMAN VE HİZMET BİLGİLERİ</th></tr></thead>
                            <tbody>
                                <tr><td className="label-cell">MÜŞTERİ / PROJE</td><td className="value-cell" style={{ fontWeight: 700 }}>{docItem.customerName}</td></tr>
                                <tr><td className="label-cell">TESLİM EDİLEN EKİPMAN</td><td className="value-cell">{docItem.placeholders?.equipmentInfo || '-'}</td></tr>
                                <tr><td className="label-cell">PLAKA / SERİ NO</td><td className="value-cell">{docItem.placeholders?.serialPlateNo || '-'}</td></tr>
                                <tr><td className="label-cell">ÇALIŞMA SAATİ / KM</td><td className="value-cell">{docItem.placeholders?.workingHoursKm || '-'}</td></tr>
                                <tr><td className="label-cell">TESLİM TARİHİ & SAATİ</td><td className="value-cell">{formatDate(docItem.placeholders?.deliveryDate)} - {docItem.placeholders?.deliveryTime || ''}</td></tr>
                                <tr><td className="label-cell">TESLİM YERİ / ŞANTİYE</td><td className="value-cell">{docItem.placeholders?.deliveryLocation || '-'}</td></tr>
                                <tr><td className="label-cell">DURUM & ÖZEL NOTLAR</td><td className="value-cell">{docItem.placeholders?.notes || '-'}</td></tr>
                            </tbody>
                        </table>
                        <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#475569', marginBottom: '16px', lineHeight: 1.6 }}>
                            {docItem.content}
                        </div>
                    </div>
                ) : (
                    <div className="plain-content" style={{ fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                        {docItem.content}
                    </div>
                )}
            </div>

            {/* Footer / Signatures */}
            {(() => {
                const isCustomerDoc = docItem.docCategory === 'customer' || !!docItem.customerName || String(docItem.templateId || '').startsWith('customer_');
                return (
                    <div className="doc-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', marginTop: 'auto', paddingTop: '16px' }}>
                        <div className="signature-box" style={{ textAlign: 'center', position: 'relative' }}>
                            <p style={{ fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #ddd', paddingBottom: '6px', marginBottom: '10px', textTransform: 'uppercase' }}>
                                {isCustomerDoc ? 'MÜŞTERİ / HİZMET ALAN' : 'PERSONEL İMZASI'}
                            </p>
                            <div style={{
                                height: `${containerH}px`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                marginBottom: '10px'
                            }}>
                                {ss.placementMode !== 'free' && empSignatureSrc && (ss.showEmpSignature ?? true) && (
                                    <img
                                        src={empSignatureSrc}
                                        alt="İmza"
                                        style={{
                                            width: `${ss.empSignatureSize ?? 80}px`,
                                            height: `${ss.empSignatureSize ?? 80}px`,
                                            objectFit: 'contain',
                                            opacity: ss.empSignatureOpacity ?? 0.9,
                                            position: 'absolute',
                                            top: `calc(50% + ${ss.empSignatureOffsetY ?? 0}px)`,
                                            left: `calc(50% + ${ss.empSignatureOffsetX ?? 0}px)`,
                                            transform: 'translate(-50%, -50%)',
                                            zIndex: 3,
                                        }}
                                    />
                                )}
                                {ss.placementMode !== 'free' && (!empSignatureSrc || !(ss.showEmpSignature ?? true)) && <div style={{ height: `${containerH}px` }}></div>}
                            </div>
                            <p style={{ fontSize: '12px', fontWeight: '600' }}>
                                {isCustomerDoc ? (docItem.customerName || docItem.placeholders?.attentionPerson || 'Müşteri Yetkilisi') : docItem.employeeName}
                            </p>
                            {isCustomerDoc && <span style={{ fontSize: '10.5px', color: '#64748b' }}>Yetkili Kaşe & İmza</span>}
                        </div>
                        <div className="signature-box" style={{ textAlign: 'center', position: 'relative' }}>
                            <p style={{ fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #ddd', paddingBottom: '6px', marginBottom: '10px', textTransform: 'uppercase' }}>
                                {isCustomerDoc ? 'HİZMET VEREN (YÜKLENİCİ)' : 'YETKİLİ ONAYI'}
                            </p>
                            <div style={{
                                height: `${containerH}px`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                marginBottom: '10px'
                            }}>
                                {ss.placementMode !== 'free' && stampSrc && (ss.showStamp ?? true) && (
                                    <img
                                        src={stampSrc}
                                        alt="Kaşe"
                                        style={{
                                            width: `${ss.stampSize}px`,
                                            height: `${ss.stampSize}px`,
                                            objectFit: 'contain',
                                            opacity: ss.stampOpacity,
                                            position: 'absolute',
                                            top: `calc(50% + ${ss.stampOffsetY ?? 0}px)`,
                                            left: `calc(50% + ${ss.stampOffsetX ?? 0}px)`,
                                            transform: 'translate(-50%, -50%)',
                                            zIndex: 1,
                                        }}
                                    />
                                )}
                                {ss.placementMode !== 'free' && signatureSrc && (ss.showSignature ?? true) && (
                                    <img
                                        src={signatureSrc}
                                        alt="İmza"
                                        style={{
                                            width: `${ss.signatureSize}px`,
                                            height: `${ss.signatureSize}px`,
                                            objectFit: 'contain',
                                            opacity: ss.signatureOpacity,
                                            position: 'absolute',
                                            top: `calc(50% + ${ss.signatureOffsetY}px)`,
                                            left: `calc(50% + ${ss.signatureOffsetX}px)`,
                                            transform: 'translate(-50%, -50%)',
                                            zIndex: 2,
                                        }}
                                    />
                                )}
                                {ss.placementMode !== 'free' && (!stampSrc || !(ss.showStamp ?? true)) && (!signatureSrc || !(ss.showSignature ?? true)) && <div style={{ height: `${containerH}px` }}></div>}
                            </div>
                            <p style={{ fontSize: '12px', fontWeight: 600 }}>{docItem.companyName}</p>
                            {isCustomerDoc && <span style={{ fontSize: '10.5px', color: '#64748b' }}>Firma Kaşe & İmza</span>}
                        </div>
                    </div>
                );
            })()}

            {/* Free Placement Mode */}
            {ss.placementMode === 'free' && stampSrc && (ss.showStamp ?? true) && (
                <img
                    src={stampSrc}
                    alt="Kaşe"
                    style={{
                        width: `${ss.stampSize}px`,
                        height: `${ss.stampSize}px`,
                        objectFit: 'contain',
                        opacity: ss.stampOpacity,
                        position: 'absolute',
                        top: `${ss.stampOffsetY ?? 0}px`,
                        left: `${ss.stampOffsetX ?? 0}px`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10,
                    }}
                />
            )}
            {ss.placementMode === 'free' && signatureSrc && (ss.showSignature ?? true) && (
                <img
                    src={signatureSrc}
                    alt="İmza"
                    style={{
                        width: `${ss.signatureSize}px`,
                        height: `${ss.signatureSize}px`,
                        objectFit: 'contain',
                        opacity: ss.signatureOpacity,
                        position: 'absolute',
                        top: `${ss.signatureOffsetY ?? 0}px`,
                        left: `${ss.signatureOffsetX ?? 0}px`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 11,
                    }}
                />
            )}
            {ss.placementMode === 'free' && empSignatureSrc && (ss.showEmpSignature ?? true) && (
                <img
                    src={empSignatureSrc}
                    alt="Personel İmzası"
                    style={{
                        width: `${ss.empSignatureSize ?? 80}px`,
                        height: `${ss.empSignatureSize ?? 80}px`,
                        objectFit: 'contain',
                        opacity: ss.empSignatureOpacity ?? 0.9,
                        position: 'absolute',
                        top: `${ss.empSignatureOffsetY ?? 940}px`,
                        left: `${ss.empSignatureOffsetX ?? 150}px`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 12,
                    }}
                />
            )}
        </div>
    );
}

export default function PrintDocument() {
    const [data, setData] = useState(null);

    useEffect(() => {
        const load = () => {
            const stored = localStorage.getItem('printDocData');
            if (stored) {
                try {
                    let parsed = JSON.parse(stored);
                    if (typeof parsed === 'string') {
                        try { parsed = JSON.parse(parsed); } catch (e) {}
                    }
                    setData(prev => {
                        if (prev && JSON.stringify(prev) === JSON.stringify(parsed)) {
                            return prev;
                        }
                        return parsed;
                    });
                } catch (err) {
                    console.error("Print doc data parse error", err);
                }
            }
        };

        load();
        window.addEventListener('storage', load);

        const interval = setInterval(() => {
            setData(prev => {
                if (prev) {
                    clearInterval(interval);
                    return prev;
                }
                const stored = localStorage.getItem('printDocData');
                if (stored) {
                    try {
                        let parsed = JSON.parse(stored);
                        if (typeof parsed === 'string') {
                            try { parsed = JSON.parse(parsed); } catch (e) {}
                        }
                        return parsed;
                    } catch (err) {
                        return prev;
                    }
                }
                return prev;
            });
        }, 300);

        window.refreshPrintData = load;

        return () => {
            window.removeEventListener('storage', load);
            clearInterval(interval);
        };
    }, []);

    const downloadPdfDirectly = () => {
        const el = document.querySelector('.a4-page') || document.body;
        const filename = `Belge_${new Date().toISOString().split('T')[0]}.pdf`;

        const opt = {
            margin: [0, 0, 0, 0],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        html2pdf().set(opt).from(el).save();
    };

    if (!data) return <div className="print-loading">Veriler yükleniyor...</div>;

    const renderToolbar = () => (
        <div className="web-print-toolbar" style={{
            position: 'fixed',
            top: 12,
            right: 16,
            zIndex: 999999,
            display: 'flex',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.92)',
            padding: '8px 14px',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)'
        }}>
            <button onClick={downloadPdfDirectly} style={{
                background: '#10b981',
                color: '#fff',
                border: 'none',
                padding: '7px 16px',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                PDF Olarak İndir (.pdf)
            </button>
            <button onClick={() => window.print()} style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '7px 16px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                Yazdır
            </button>
            <button onClick={() => window.close()} style={{
                background: '#475569',
                color: '#fff',
                border: 'none',
                padding: '7px 12px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px'
            }}>
                ✕ Kapat
            </button>
        </div>
    );

    return (
        <div>
            {renderToolbar()}
            {data.isBulk && Array.isArray(data.documents) ? (
                data.documents.map((docItem, index) => (
                    <SingleDoc key={index} docItem={docItem} />
                ))
            ) : (
                <SingleDoc docItem={data} />
            )}
        </div>
    );
}
