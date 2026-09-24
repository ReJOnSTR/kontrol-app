import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';
import { formatDate, formatCurrency, generateReportNo, generateUniqueFileName } from '../utils/helpers';
import { calculateWorkStats } from '../utils/workCalculations';
import './WorkPdfReport.css';

export default function WorkPdfReport({ 
    propId, 
    propWork, 
    noHeader = false, 
    isPreview = false, 
    showPricesProp = true, 
    showGrandTotalProp = true,
    showKdvProp = false, 
    kdvRateProp = 20, 
    pazarMultiplierProp = null, 
    mesaiMultiplierProp = null,
    pageBreakModeProp = null,
    rowsPerPageProp = null,
    manualBreakIdsProp = null,
    onToggleManualBreakProp = null,
    showBreakToolsProp = false,
    customScaleProp = null,
    orientationProp = 'portrait',
    tableDensityProp = 'normal',
    showWorkTitleProp = true
}) {
    const params = useParams();
    const id = propId || params.id;
    const [work, setWork] = useState(propWork || null);
    const [loading, setLoading] = useState(!propWork);
    const [error, setError] = useState(null);
    const [savingPdf, setSavingPdf] = useState(false);
    const showPrices = showPricesProp;
    const contentRef = useRef(null);

    // Load break settings from localStorage fallback
    const savedBreakSettings = (() => {
        try {
            const s = localStorage.getItem(`pdfPageBreakSettings_${id}`);
            return s ? JSON.parse(s) : {};
        } catch (e) {
            return {};
        }
    })();

    const pageBreakMode = pageBreakModeProp || savedBreakSettings.pageBreakMode || 'fit_page';
    const rowsPerPage = rowsPerPageProp || savedBreakSettings.rowsPerPage || 20;
    const tableDensity = tableDensityProp || savedBreakSettings.tableDensity || 'normal';
    const [manualBreakIds, setManualBreakIds] = useState(manualBreakIdsProp || savedBreakSettings.manualBreakIds || []);
    const [autoScale, setAutoScale] = useState(1);

    useLayoutEffect(() => {
        if (pageBreakMode === 'fit_page' && contentRef.current) {
            const wrapper = contentRef.current;

            // Measure the exact unscaled bottom position of the last element (immune to CSS scale transforms)
            const grandTotalEl = wrapper.querySelector('.pdf-grand-total');
            const summaryEls = wrapper.querySelectorAll('.pdf-summary-block');
            const lastSummaryEl = summaryEls.length > 0 ? summaryEls[summaryEls.length - 1] : null;
            const tableEls = wrapper.querySelectorAll('.pdf-table');
            const lastTableEl = tableEls.length > 0 ? tableEls[tableEls.length - 1] : null;

            const targetChild = grandTotalEl || lastSummaryEl || lastTableEl || wrapper.lastElementChild;

            if (targetChild) {
                // offsetTop + offsetHeight gives exact unscaled layout position
                const naturalPx = targetChild.offsetTop + targetChild.offsetHeight;

                const isLandscapeMode = orientationProp === 'landscape';
                const targetH = isLandscapeMode ? 625 : 830; // Printable inner height limit right above pinned footer in px

                if (naturalPx > targetH) {
                    const exactScaleNeeded = targetH / naturalPx;
                    // Apply exact scale so last element aligns safely above page bottom line
                    setAutoScale(parseFloat(Math.max(0.60, Math.min(0.99, exactScaleNeeded)).toFixed(2)));
                } else {
                    setAutoScale(1.0);
                }
            } else {
                setAutoScale(1.0);
            }
        } else {
            setAutoScale(1.0);
        }
    }, [pageBreakMode, work, showPricesProp, showKdvProp, kdvRateProp, pazarMultiplierProp, mesaiMultiplierProp, customScaleProp, orientationProp, tableDensity, showWorkTitleProp]);

    const effectiveScale = customScaleProp ? Number(customScaleProp) : (pageBreakMode === 'fit_page' ? autoScale : 1.0);

    useEffect(() => {
        if (manualBreakIdsProp) {
            setManualBreakIds(manualBreakIdsProp);
        }
    }, [manualBreakIdsProp]);

    const handleToggleBreak = (itemId) => {
        let next;
        if (manualBreakIds.includes(itemId)) {
            next = manualBreakIds.filter(i => i !== itemId);
        } else {
            next = [...manualBreakIds, itemId];
        }
        setManualBreakIds(next);
        if (onToggleManualBreakProp) {
            onToggleManualBreakProp(itemId);
        }
        try {
            const cur = savedBreakSettings;
            localStorage.setItem(`pdfPageBreakSettings_${id}`, JSON.stringify({ ...cur, manualBreakIds: next }));
        } catch (e) {}
    };

    useEffect(() => {
        if (propWork) {
            setWork(propWork);
            setLoading(false);
            return;
        }

        const stored = localStorage.getItem('workPdfData');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setWork(parsed);
                setLoading(false);
                return;
            } catch (e) {
                console.error("PDF data parse error", e);
            }
        }

        if (id) {
            setLoading(true);
            window.electronAPI.getWorkDetails(id)
                .then(res => {
                    if (res && res.success) {
                        setWork(res.data);
                    } else {
                        setError('İş detayı yüklenemedi');
                    }
                })
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
        }
    }, [id, propWork]);

    if (loading) return <div className="pdf-loading">Rapor yükleniyor...</div>;
    if (error) return <div className="pdf-error">{error}</div>;
    if (!work) return <div className="pdf-error">İş bulunamadı</div>;

    const pazarMultiplier = pazarMultiplierProp ? parseFloat(pazarMultiplierProp) : (work.pazar_multiplier || 1.5);
    const mesaiMultiplier = mesaiMultiplierProp ? parseFloat(mesaiMultiplierProp) : (work.mesai_multiplier || 1.5);

    const calcResult = calculateWorkStats(work.items || [], pazarMultiplier, mesaiMultiplier);
    const groups = calcResult.groups || [];
    const grandTotalPrice = calcResult.grandTotal || 0;

    // Exact Physical Pixel Height A4 Page Splitting Engine
    const pages = (() => {
        if (!groups || groups.length === 0) return [];

        // 1. If fit_page mode is selected, enforce single page presentation with auto-scaling
        if (pageBreakMode === 'fit_page') {
            return [{
                groups: groups.map(g => ({ ...g, isContinuation: false, isLastChunk: true })),
                isFirst: true,
                isLast: true,
                pageIndex: 0
            }];
        }

        const isCompact = tableDensity === 'compact';
        const scaleVal = effectiveScale > 0 ? effectiveScale : 1.0;
        const isLandscapeMode = orientationProp === 'landscape';
        const BASE_TARGET_H = isLandscapeMode ? 625 : 830;
        const TARGET_A4_HEIGHT = Math.floor(BASE_TARGET_H / scaleVal); // Printable height limit inside A4 page in px

        // Exact physical heights of components:
        const HEADER_H = isCompact ? 85 : 100;
        const FOOTER_H = 28;
        const GRAND_TOTAL_H = showGrandTotalProp ? (showKdvProp ? (isCompact ? 95 : 120) : (isCompact ? 55 : 70)) : 0;
        const DESC_H = (work?.description && work.description.trim() !== '') ? 35 : 0;
        const ROW_H = isCompact ? 20.5 : 27.0; // Safe physical rendered height of each table row with margins and scaling clearance
        const SUMMARY_H = isCompact ? 72 : 90; // Rendered height of Machine Summary Table

        // Split rows and blocks across pages based on exact height capacity:
        const pageList = [];
        let currentGroups = [];
        let currentHeight = 0;

        groups.forEach((g, gIdx) => {
            const items = g.items || [];
            let itemIdx = 0;
            let needSummary = true;
            const isLastGroup = gIdx === groups.length - 1;

            // In vehicle mode, force each vehicle onto a new page if current page already has content
            if (pageBreakMode === 'vehicle' && currentGroups.length > 0) {
                pageList.push({
                    groups: currentGroups,
                    isFirst: pageList.length === 0,
                    isLast: false,
                    pageIndex: pageList.length
                });
                currentGroups = [];
                currentHeight = 0;
            }

            while (itemIdx < items.length || needSummary) {
                const isP1 = pageList.length === 0 && currentGroups.length === 0;
                const maxPageH = TARGET_A4_HEIGHT;
                
                let baseOverhead = FOOTER_H;
                if (isP1) baseOverhead += HEADER_H;

                const currentUsedH = (currentHeight === 0 ? baseOverhead : currentHeight);
                const availableH = maxPageH - currentUsedH;
                const vehicleHeaderOverhead = (itemIdx === 0 ? 30 + 25 : 25);
                const rowH = ROW_H;

                // Orphan Row Guard: when starting a new vehicle table, require room for at least 3 rows (3 * rowH)
                const minRowsRequired = itemIdx === 0 ? 3 : 1;
                let spaceForRows = availableH - vehicleHeaderOverhead;
                if (spaceForRows < (minRowsRequired * rowH) && currentGroups.length > 0) {
                    pageList.push({
                        groups: currentGroups,
                        isFirst: pageList.length === 0,
                        isLast: false,
                        pageIndex: pageList.length
                    });
                    currentGroups = [];
                    currentHeight = 0;
                    continue;
                }

                // Greedily take every single row that can physically fit
                const maxRowsCanFit = Math.max(0, Math.floor(Math.max(0, spaceForRows) / rowH));

                if (maxRowsCanFit === 0 && currentGroups.length > 0) {
                    pageList.push({
                        groups: currentGroups,
                        isFirst: pageList.length === 0,
                        isLast: false,
                        pageIndex: pageList.length
                    });
                    currentGroups = [];
                    currentHeight = 0;
                    continue;
                }

                const countToTake = Math.max(1, maxRowsCanFit);
                let chunkEnd = Math.min(items.length, itemIdx + countToTake);
                let candidateChunk = items.slice(itemIdx, chunkEnd);

                // Manual Page Break Check: If any item in candidateChunk has manualBreak, slice right after it
                let manualBreakTriggered = false;
                const manualBreakIdxInChunk = candidateChunk.findIndex(it => manualBreakIds.includes(it.id));
                if (manualBreakIdxInChunk !== -1) {
                    chunkEnd = itemIdx + manualBreakIdxInChunk + 1;
                    candidateChunk = items.slice(itemIdx, chunkEnd);
                    manualBreakTriggered = true;
                }

                const chunk = candidateChunk;
                const isLastChunk = chunkEnd >= items.length;

                // Check if summary table AND Grand Total Box fit in remaining space after rows without cutoff
                const remainingSpaceAfterChunk = spaceForRows - (chunk.length * rowH);
                const requiredEndSpace = SUMMARY_H + (isLastChunk && isLastGroup && showGrandTotalProp ? GRAND_TOTAL_H : 0);
                const summaryFitsOnThisPage = isLastChunk && needSummary && (remainingSpaceAfterChunk >= requiredEndSpace) && !manualBreakTriggered;

                if (chunk.length > 0 || summaryFitsOnThisPage) {
                    currentGroups.push({
                        ...g,
                        items: chunk,
                        isContinuation: itemIdx > 0 || (chunk.length === 0),
                        isLastChunk: summaryFitsOnThisPage
                    });

                    if (summaryFitsOnThisPage) {
                        needSummary = false;
                    }

                    const chunkH = (chunk.length > 0 ? vehicleHeaderOverhead : 0) + (chunk.length * rowH) + (summaryFitsOnThisPage ? SUMMARY_H : 0);
                    currentHeight = currentUsedH + chunkH;
                }

                itemIdx = chunkEnd;

                if (itemIdx >= items.length && !needSummary) {
                    if (manualBreakTriggered && currentGroups.length > 0) {
                        pageList.push({
                            groups: currentGroups,
                            isFirst: pageList.length === 0,
                            isLast: false,
                            pageIndex: pageList.length
                        });
                        currentGroups = [];
                        currentHeight = 0;
                    }
                    break;
                }

                // If manual break or current page is full or summary table overflows to next page, flush current page
                if (manualBreakTriggered || currentHeight >= maxPageH - 20 || !summaryFitsOnThisPage) {
                    pageList.push({
                        groups: currentGroups,
                        isFirst: pageList.length === 0,
                        isLast: false,
                        pageIndex: pageList.length
                    });
                    currentGroups = [];
                    currentHeight = 0;
                }
            }
        });

        if (currentGroups.length > 0) {
            pageList.push({
                groups: currentGroups,
                isFirst: pageList.length === 0,
                isLast: false,
                pageIndex: pageList.length
            });
        }

        if (pageList.length > 0) {
            pageList[pageList.length - 1].isLast = true;
        }

        return pageList.length > 0 ? pageList : [{ groups: groups, isFirst: true, isLast: true, pageIndex: 0 }];
    })();

    const handleSavePdf = () => {
        if (savingPdf) return;
        setSavingPdf(true);

        const companyStr = work.customer_name || (typeof work.customer === 'object' ? work.customer?.name : work.customer) || work.customers?.name || work.company_name || work.company?.name || '';
        const titleStr = work.title || work.work_no || 'Is_Raporu';
        const defaultFileName = generateUniqueFileName('Puantaj', [companyStr, titleStr], 'pdf');

        setTimeout(async () => {
            const res = await window.electronAPI.saveReportPdf('/print', { 
                defaultPath: defaultFileName, 
                landscape: orientationProp === 'landscape' 
            });
            setSavingPdf(false);
            if (res && res.success) {
                // PDF successfully saved
            } else if (res && !res.canceled) {
                alert('PDF Kaydedilirken Hata: ' + res.error);
            }
        }, 100);
    };

    const reportNumber = generateReportNo('PUAN', work.work_no || work.id);

    return (
        <div className={`pdf-viewer-layout ${savingPdf ? 'is-generating-pdf' : ''}`}>
            {/* Viewer Action Bar */}
            {!noHeader && (
                <div className="pdf-actions-bar">
                    <button className="pdf-btn close" onClick={() => window.close()} disabled={savingPdf}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        Pencereyi Kapat
                    </button>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="pdf-btn print" onClick={() => window.print()} disabled={savingPdf}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
                            Yazıcıdan Çıktı Al
                        </button>
                        <button className="pdf-btn save" onClick={handleSavePdf} disabled={savingPdf}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10.4 12.6a2 2 0 1 1 3 3L8 21l-4 1 1-4Z"/><path d="M18 21v-8a2 2 0 0 0-2-2h-1.5"/></svg>
                            Bilgisayara PDF Kaydet
                        </button>
                    </div>
                </div>
            )}

            <div className="pdf-pages-container">
                {pages.map((page, pIdx) => {
                    const pageRowCount = page.groups.reduce((acc, g) => acc + (g.items?.length || 0), 0);
                    const isOverflowRisk = pages.length > 1 && pIdx === pages.length - 1 && pageRowCount <= 3 && pageBreakMode !== 'fit_page';

                    return (
                        <div 
                            key={pIdx} 
                            className={`pdf-report-container ${isPreview ? 'is-preview' : ''} ${showKdvProp ? 'with-kdv' : ''} ${pageBreakMode === 'fit_page' ? 'pdf-fit-page' : ''} ${tableDensity === 'compact' ? 'is-compact' : ''} ${orientationProp === 'landscape' ? 'is-landscape' : ''}`}
                        >
                            {isPreview && (
                                <div className="pdf-page-header-badge">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>{orientationProp === 'landscape' ? 'Yatay A4' : 'Dikey A4'}</span>
                                        <span>•</span>
                                        <span>Ölçek: %{Math.round(effectiveScale * 100)}</span>
                                        <span>•</span>
                                        <span style={{ color: tableDensity === 'compact' ? '#2563eb' : '#64748b' }}>
                                            {tableDensity === 'compact' ? 'Kompakt Düzen' : 'Standart Düzen'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontWeight: 700, color: pages.length === 1 ? '#16a34a' : '#2563eb' }}>
                                            Sayfa {pIdx + 1} / {pages.length}
                                        </span>
                                        <span>({pageRowCount} Satır)</span>
                                        {pages.length === 1 && <span style={{ color: '#16a34a', fontWeight: 600 }}>• Tam Sığıyor</span>}
                                    </div>
                                </div>
                            )}

                            <div 
                                ref={pIdx === 0 ? contentRef : null}
                                className="pdf-content-wrapper"
                                style={{
                                    transform: `scale(${effectiveScale})`,
                                    transformOrigin: 'top left',
                                    width: `calc(100% / ${effectiveScale})`,
                                    minWidth: `calc(100% / ${effectiveScale})`,
                                    maxWidth: 'none',
                                    height: `calc(100% / ${effectiveScale})`,
                                    minHeight: `calc(100% / ${effectiveScale})`,
                                    maxHeight: 'none',
                                    boxSizing: 'border-box'
                                }}
                            >
                                {/* Header on First Page */}
                                {page.isFirst && (
                                    <div className="pdf-header-standard">
                                        <div>
                                            <h1 className="pdf-title-standard">
                                                {work.work_no ? `İŞ RAPORU - ${work.work_no}` : 'İŞ RAPORU / PUANTAJ CETVELİ'}
                                            </h1>
                                            <div className="pdf-company-standard">
                                                <strong>Firma / Müşteri:</strong> {work.customer_name || (typeof work.customer === 'object' ? work.customer?.name : work.customer) || work.customers?.name || work.company_name || work.company?.name || '-'}
                                                {showWorkTitleProp && work.title && <span> &nbsp;|&nbsp; <strong>İş Tanımı:</strong> {work.title}</span>}
                                            </div>
                                        </div>
                                        <div className="pdf-date-standard">
                                            <div className="pdf-date-label">Rapor Tarihi</div>
                                            <div className="pdf-date-value">{new Date().toLocaleDateString('tr-TR')}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Machine Groups */}
                                {page.groups.map((group, idx) => (
                                    <div key={idx} className="pdf-machine-group">
                                        <h3 
                                            className="pdf-machine-title"
                                            style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between',
                                                alignItems: 'center', 
                                                gap: '8px',
                                                pageBreakAfter: 'avoid',
                                                breakAfter: 'avoid'
                                            }}
                                        >
                                            <span>{(group.rawMachineName || group.machineName).toUpperCase()}{group.isContinuation ? ' (DEVAMI)' : ' DETAYLARI'}</span>
                                        </h3>
                                        <div>
                                            <table className="pdf-table" style={{ tableLayout: 'fixed' }}>
                                                <thead>
                                                    <tr>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '9%' : '11%' }}>TARİH</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '8%' : '11%' }}>FİŞ NO</th>
                                                        <th colSpan="2" style={{ width: orientationProp === 'landscape' ? '16%' : '22%' }}>Çalışma Süresi</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '8%' : '11%' }}>Süre/Adet</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '8%' : '11%' }}>Fazla Mesai</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '14%' : '11%' }}>MAKİNA</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '27%' : '12%' }}>AÇIKLAMA</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '10%' : '11%' }}>FİYAT</th>
                                                    </tr>
                                                    <tr>
                                                        <th style={{ width: orientationProp === 'landscape' ? '8%' : '11%' }}>Başlama</th>
                                                        <th style={{ width: orientationProp === 'landscape' ? '8%' : '11%' }}>Bitiş</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(group.items || []).map((item, itemIdx) => {
                                                        const desc = item.description || '';
                                                        let pdfRowClass = '';
                                                        if (desc.includes('[RENK:red]') || item.isPazar) pdfRowClass = 'pdf-row-red';
                                                        else if (desc.includes('[RENK:orange]')) pdfRowClass = 'pdf-row-orange';
                                                        else if (desc.includes('[RENK:blue]')) pdfRowClass = 'pdf-row-blue';
                                                        else if (desc.includes('[RENK:green]')) pdfRowClass = 'pdf-row-green';
                                                        else if (desc.includes('[RENK:purple]')) pdfRowClass = 'pdf-row-purple';

                                                        const cleanDesc = desc.replace(/\[[^\]]*\]\s*/g, '').trim();

                                                        return (
                                                            <tr key={item.id || itemIdx} className={pdfRowClass}>
                                                                <td className="center">{formatDate(item.date)}</td>
                                                                <td className="center">{item.receipt_no || '-'}</td>
                                                                <td className="center">{item.start_time || '-'}</td>
                                                                <td className="center">{item.end_time || '-'}</td>
                                                                <td className="center">
                                                                    {item.hours || 0} {(desc.toUpperCase().includes('[SAATLİK]') ? 'Saat' : 'Gün')}
                                                                </td>
                                                                <td className="center">{item.overtime_hours > 0 ? `${item.overtime_hours} Saat` : ''}</td>
                                                                <td className="center">{group.rawMachineName || group.machineName}</td>
                                                                <td>{cleanDesc}</td>
                                                                <td className="right">
                                                                    {showPrices ? (() => {
                                                                        const kMatch = (desc || '').match(/\[KATSAYI:([^\]]+)\]/);
                                                                        const baseP = item.unit_price || item.unitPriceVal || 0;
                                                                        const dailyP = (baseP > 10000 && item.isAylik) ? baseP / 26 : baseP;
                                                                        
                                                                        let finalPrice = dailyP;
                                                                        if (kMatch) {
                                                                            const multVal = parseFloat(kMatch[1]) || 1;
                                                                            finalPrice = dailyP * multVal;
                                                                        } else if (item.isPazar) {
                                                                            finalPrice = dailyP * pazarMultiplier;
                                                                        }

                                                                        return finalPrice > 0 ? formatCurrency(finalPrice) : '';
                                                                    })() : ''}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>

                                        {/* Vehicle Summary Block on Last Chunk of Group */}
                                        {(group.isLastChunk !== false) && (
                                            <div className="pdf-summary-block">
                                                <table className="pdf-summary-table">
                                                    <colgroup>
                                                        <col style={{ width: '24%' }} />
                                                        <col style={{ width: '22%' }} />
                                                        <col style={{ width: '27%' }} />
                                                        <col style={{ width: '27%' }} />
                                                    </colgroup>
                                                    <tbody>
                                                        <tr className="bg-light-gray">
                                                            <td colSpan="4" className="bold center" style={{ padding: '3px 6px', fontSize: '9.5px', borderBottom: '1px solid #cbd5e1' }}>
                                                                {(group.rawMachineName || group.machineName).toUpperCase()}
                                                            </td>
                                                        </tr>
                                                        {group.summaryLines && group.summaryLines.map((line, lIdx) => (
                                                            <tr key={lIdx} className="bg-light-gray">
                                                                <td className="bold center">{line.typeLabel}</td>
                                                                <td className="center">{line.countText || `${line.count} ${line.unit}`}</td>
                                                                <td className="right">{line.unitPrice ? formatCurrency(line.unitPrice) : '-'}</td>
                                                                <td className="right bold total-text">{formatCurrency(line.totalPrice)}</td>
                                                            </tr>
                                                        ))}
                                                        <tr style={{ borderTop: '1px solid #cbd5e1' }}>
                                                            <td colSpan="3" className="bold right" style={{ padding: '4px 8px', fontSize: '9px', backgroundColor: '#f8fafc', color: '#333' }}>TOPLAM</td>
                                                            <td className="right bold total-text" style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: '#f1f5f9', color: '#000' }}>{formatCurrency(group.calculatedGrandTotal)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Grand Total on Last Page */}
                            {page.isLast && showGrandTotalProp && (
                                <div className="pdf-grand-total">
                                    <table className="pdf-summary-table">
                                        <colgroup>
                                            <col style={{ width: '73%' }} />
                                            <col style={{ width: '27%' }} />
                                        </colgroup>
                                        <tbody>
                                            <tr style={{ borderTop: '1px solid #cbd5e1' }}>
                                                <td className="bold right" style={{ padding: '4px 8px', fontSize: '9px', backgroundColor: '#f8fafc', color: '#333' }}>GENEL TOPLAM</td>
                                                <td className="right bold total-text" style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: '#f1f5f9', color: '#000' }}>{formatCurrency(grandTotalPrice)}{showKdvProp ? '' : ' + KDV'}</td>
                                            </tr>
                                            {showKdvProp && (
                                                <>
                                                    <tr>
                                                        <td className="bold right" style={{ padding: '4px 8px', fontSize: '9px', backgroundColor: '#f8fafc', color: '#333' }}>KDV (%{kdvRateProp})</td>
                                                        <td className="right bold total-text" style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: '#f1f5f9', color: '#000' }}>{formatCurrency(grandTotalPrice * (kdvRateProp / 100))}</td>
                                                    </tr>
                                                    <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                                                        <td className="bold right" style={{ padding: '4px 8px', fontSize: '9.5px', backgroundColor: '#e2e8f0', color: '#000' }}>TOPLAM (KDV DAHİL)</td>
                                                        <td className="right bold total-text" style={{ padding: '4px 8px', fontSize: '10.5px', backgroundColor: '#cbd5e1', color: '#000' }}>{formatCurrency(grandTotalPrice * (1 + kdvRateProp / 100))}</td>
                                                    </tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {page.isLast && work?.description && work.description.trim() !== '' && (
                                <div className="pdf-footer-note" style={{ marginTop: '10px' }}>
                                    <span className="bold" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>NOT:</span>
                                    <div style={{ marginLeft: '10px', display: 'inline-block', whiteSpace: 'pre-wrap' }}>{work.description.trim()}</div>
                                </div>
                            )}

                        </div>

                        {/* Pinned Page Footer - OUTSIDE SCALED WRAPPER (ALWAYS UNTOUCHED AT ABSOLUTE BOTTOM) */}
                        <div className="pdf-footer-pinned" style={{ justifyContent: 'flex-end' }}>
                            <span style={{ fontWeight: 600, color: '#475569', fontSize: '9px' }}>Sayfa {pIdx + 1} / {pages.length}</span>
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
    );
}
