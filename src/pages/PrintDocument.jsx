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

function InfoTable({ title, rows, style }) {
    const thStyle = {
        background: '#0f172a',
        color: '#ffffff',
        fontSize: '10.5px',
        fontWeight: 800,
        textAlign: 'left',
        padding: '6px 10px',
        border: 'none',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
    };
    const tdLabel = {
        width: '130px',
        fontSize: '10px',
        fontWeight: 700,
        color: '#475569',
        padding: '6px 10px',
        borderBottom: '1px solid #e2e8f0',
        borderRight: '1px solid #e2e8f0',
        background: '#f8fafc',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
    };
    const tdVal = {
        fontSize: '11px',
        fontWeight: 600,
        color: '#0f172a',
        padding: '6px 10px',
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
    };
    return (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', marginBottom: '15px', tableLayout: 'fixed', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', ...(style || {}) }}>
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
    );
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
            {/* Header (Tüm belgeler için standart) */}
            <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', color: '#000', margin: 0, letterSpacing: '-0.2px' }}>
                    {docItem.companyName}
                </h2>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#475569', margin: 0 }}>
                        Tarih: {formatDate(docItem.placeholders?.proposalDate || docItem.placeholders?.startDate || docItem.placeholders?.issueDate || new Date())}
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
            <div className="doc-body" style={{ flexGrow: 1 }}>
                {docItem.templateId === 'assignment' ? (
                    <div className="assignment-tables">
                        <InfoTable title="İŞVEREN BİLGİLERİ" rows={[
                            ['ADI-SOYADI / ÜNVANI', docItem.companyName],
                            ['İŞYERİ ADRESİ', docItem.companyAddress],
                            ['İŞYERİ SGK NO', docItem.companySgk],
                            ['VERGİ DAİRESİ / NO', docItem.companyTax],
                        ]} />
                        <InfoTable title="PERSONEL BİLGİLERİ" rows={[
                            ['ADI - SOYADI', docItem.employeeName],
                            ['T.C. KİMLİK NO', docItem.tcNo || '-'],
                        ]} />
                        <InfoTable title="GÖREVLENDİRME DETAYLARI" rows={[
                            ['GİDİLECEK İŞYERİ', docItem.placeholders?.workplaceName],
                            ['İŞYERİ ADRESİ', docItem.placeholders?.workplaceAddress],
                            ['YAPILACAK İŞ', docItem.placeholders?.workType],
                            ['GİDİŞ TARİHİ', docItem.placeholders?.startDate ? formatDate(docItem.placeholders.startDate) : null],
                            ['DÖNÜŞ TARİHİ', docItem.placeholders?.endDate ? formatDate(docItem.placeholders.endDate) : null],
                        ]} />

                        <div className="assignment-text" style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '12px', fontSize: '12px', fontStyle: 'italic' }}>
                            {docItem.content}
                        </div>
                    </div>
                ) : docItem.templateId === 'customer_proposal' ? (
                    <div className="customer-proposal-doc" style={{ fontSize: '11px', lineHeight: 1.5 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                            <InfoTable title="MÜŞTERİ BİLGİLERİ" rows={[
                                ['MÜŞTERİ ÜNVANI', docItem.customerName],
                                ['İLGİLİ KİŞİ', docItem.placeholders?.attentionPerson],
                                ['HİZMET YERİ / SAHA', docItem.placeholders?.workLocation],
                                ['VERGİ DAİRESİ / NO', docItem.customerTax],
                            ]} style={{ margin: 0 }} />
                            <InfoTable title="TEKLİF DETAYLARI" rows={[
                                ['TEKLİF NO', docItem.placeholders?.proposalNo],
                                ['TEKLİF TARİHİ', formatDate(docItem.placeholders?.proposalDate || new Date())],
                                ['GEÇERLİLİK SÜRESİ', docItem.placeholders?.validityDays || '15 Gün'],
                                ['HAZIRLAYAN YETKİLİ', docItem.placeholders?.preparedBy || docItem.companyName],
                            ]} style={{ margin: 0 }} />
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', margin: '12px 0', fontSize: '11px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                            <thead>
                                <tr style={{ background: '#0f172a', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                    <th style={{ width: '30px', textAlign: 'center', padding: '7px 6px', borderRight: '1px solid rgba(255,255,255,0.15)', fontSize: '10px', background: '#0f172a', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>#</th>
                                    <th style={{ textAlign: 'left', padding: '7px 10px', borderRight: '1px solid rgba(255,255,255,0.15)', fontSize: '10px', textTransform: 'uppercase', background: '#0f172a', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Hizmet / Makine / İş Kalemi</th>
                                    {docItem.priceColumns && docItem.priceColumns.length > 0 ? (
                                        <>
                                            {docItem.priceColumns.map((col, cIdx) => (
                                                <th key={col.id} style={{ textAlign: 'center', padding: '7px 8px', borderRight: cIdx === docItem.priceColumns.length - 1 && !docItem?.showConditionColumn ? 'none' : '1px solid rgba(255,255,255,0.15)', fontSize: '10px', whiteSpace: 'nowrap', textTransform: 'uppercase', background: '#0f172a', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                    {col.label}
                                                </th>
                                            ))}
                                            {docItem.showConditionColumn && (
                                                <th style={{ minWidth: '150px', padding: '7px 10px', fontSize: '10px', textTransform: 'uppercase', background: '#0f172a', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Çalışma Koşulu / Not</th>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <th style={{ width: '60px', textAlign: 'center', padding: '7px 6px', borderRight: '1px solid rgba(255,255,255,0.15)', fontSize: '10px', background: '#0f172a', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Miktar</th>
                                            <th style={{ width: '60px', textAlign: 'center', padding: '7px 6px', borderRight: '1px solid rgba(255,255,255,0.15)', fontSize: '10px', background: '#0f172a', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Birim</th>
                                            <th style={{ width: '100px', textAlign: 'right', padding: '7px 10px', fontSize: '10px', background: '#0f172a', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Birim Fiyat</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {(docItem.items || []).map((item, idx) => (
                                    <tr key={idx} style={{ background: idx % 2 === 1 ? '#f8fafc' : '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                        <td style={{ textAlign: 'center', fontWeight: 600, padding: '6px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', color: '#64748b' }}>{idx + 1}</td>
                                        <td style={{ fontWeight: 600, padding: '6px 10px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', color: '#0f172a' }}>{item.description || item.name}</td>
                                        {docItem.priceColumns && docItem.priceColumns.length > 0 ? (
                                            <>
                                                {docItem.priceColumns.map((col, cIdx) => (
                                                    <td key={col.id} style={{ textAlign: 'center', fontWeight: 700, color: '#0f172a', padding: '6px 8px', borderBottom: '1px solid #e2e8f0', borderRight: cIdx === docItem.priceColumns.length - 1 && !docItem?.showConditionColumn ? 'none' : '1px solid #e2e8f0', background: 'rgba(241, 245, 249, 0.4)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                        {item.prices?.[col.id] || '-'}
                                                    </td>
                                                ))}
                                                {docItem.showConditionColumn && (
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

                        {docItem.terms && (
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', marginTop: '14px', marginBottom: 0, fontSize: '11px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                <thead>
                                    <tr>
                                        <th style={{ background: '#0f172a', color: '#ffffff', fontSize: '10.5px', fontWeight: 800, textAlign: 'left', padding: '6px 10px', textTransform: 'uppercase', letterSpacing: '0.05em', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                            TEKLİF ŞARTLARI VE GENEL HÜKÜMLER
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style={{ padding: '8px 12px', fontSize: '11px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                                            {docItem.terms}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                ) : docItem.templateId === 'customer_contract' ? (
                    <div className="customer-contract-doc">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                            <InfoTable title="HİZMET VEREN (YÜKLENİCİ)" rows={[
                                ['ÜNVANI', docItem.companyName],
                                ['ADRESİ', docItem.companyAddress || '-'],
                                ['VERGİ DAİRESİ / NO', docItem.companyTax || '-'],
                            ]} style={{ margin: 0 }} />
                            <InfoTable title="HİZMET ALAN (MÜŞTERİ)" rows={[
                                ['ÜNVANI', docItem.customerName],
                                ['ADRESİ', docItem.customerAddress || docItem.placeholders?.workLocation || '-'],
                                ['VERGİ DAİRESİ / NO', docItem.customerTax || '-'],
                            ]} style={{ margin: 0 }} />
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
                        <InfoTable title="TESLİM EDİLEN EKİPMAN VE HİZMET BİLGİLERİ" rows={[
                            ['MÜŞTERİ / PROJE', docItem.customerName],
                            ['TESLİM EDİLEN EKİPMAN', docItem.placeholders?.equipmentInfo || '-'],
                            ['PLAKA / SERİ NO', docItem.placeholders?.serialPlateNo || '-'],
                            ['ÇALIŞMA SAATİ / KM', docItem.placeholders?.workingHoursKm || '-'],
                            ['TESLİM TARİHİ & SAATİ', `${formatDate(docItem.placeholders?.deliveryDate)} - ${docItem.placeholders?.deliveryTime || ''}`],
                            ['TESLİM YERİ / ŞANTİYE', docItem.placeholders?.deliveryLocation || '-'],
                            ['DURUM & ÖZEL NOTLAR', docItem.placeholders?.notes || '-'],
                        ]} style={{ marginBottom: '14px' }} />
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
                const showSignatures = docItem.showSignatures !== false && docItem.includeStamp !== false && docItem.stampSettings?.includeStamp !== false && docItem.stampSettings?.showSignatures !== false;
                if (!showSignatures) return null;

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
            {(docItem.showSignatures !== false && docItem.includeStamp !== false && docItem.stampSettings?.includeStamp !== false && docItem.stampSettings?.showSignatures !== false) && ss.placementMode === 'free' && stampSrc && (ss.showStamp ?? true) && (
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
            {(docItem.showSignatures !== false && docItem.includeStamp !== false && docItem.stampSettings?.includeStamp !== false && docItem.stampSettings?.showSignatures !== false) && ss.placementMode === 'free' && signatureSrc && (ss.showSignature ?? true) && (
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
            {(docItem.showSignatures !== false && docItem.includeStamp !== false && docItem.stampSettings?.includeStamp !== false && docItem.stampSettings?.showSignatures !== false) && ss.placementMode === 'free' && empSignatureSrc && (ss.showEmpSignature ?? true) && (
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
