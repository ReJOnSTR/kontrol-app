import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';
import { formatDate, formatCurrency, generateReportNo, generateUniqueFileName } from '../utils/helpers';
import { calculateWorkStats } from '../utils/workCalculations';
import { exportElementToCleanPdf } from '../utils/pdfCleanExport';
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
    targetPagesProp = null,
    rowsPerPageProp = null,
    manualBreakIdsProp = null,
    onToggleManualBreakProp = null,
    showBreakToolsProp = false,
    customScaleProp = null,
    orientationProp = 'portrait',
    tableDensityProp = 'compact',
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
    const pageRefs = useRef([]);

    // Load break settings from DB (work.pdf_settings / propWork.pdf_settings) or localStorage fallback
    const savedBreakSettings = (() => {
        try {
            const raw = work?.pdf_settings || propWork?.pdf_settings
            if (raw) {
                return typeof raw === 'string' ? JSON.parse(raw) : raw
            }
            const s = localStorage.getItem(`pdfPageBreakSettings_${id}`)
            return s ? JSON.parse(s) : {}
        } catch (e) {
            return {}
        }
    })()

    const pageBreakMode = pageBreakModeProp || savedBreakSettings.pageBreakMode || 'fit_page';
    const targetPages = Math.max(1, Number(targetPagesProp || savedBreakSettings.targetPages || 1));
    const rowsPerPage = rowsPerPageProp || savedBreakSettings.rowsPerPage || 20;
    const tableDensity = tableDensityProp || (savedBreakSettings.tableDensityExplicit ? savedBreakSettings.tableDensity : null) || 'compact';
    const [manualBreakIds, setManualBreakIds] = useState(manualBreakIdsProp || savedBreakSettings.manualBreakIds || []);
    const [autoScale, setAutoScale] = useState(1);

    useLayoutEffect(() => {
        if (pageBreakMode === 'fit_page') {
            const wrappers = (pageRefs.current || []).filter(Boolean);
            if (wrappers.length === 0 && contentRef.current) {
                wrappers.push(contentRef.current);
            }
            if (wrappers.length > 0) {
                const padTopMm = tableDensity === 'compact' ? 4 : 6;
                const padSideMm = tableDensity === 'compact' ? 6 : 8;
                const isLandscapeMode = orientationProp === 'landscape';
                const targetH = isLandscapeMode ? 730 : 1050; // Gerçek A4 (297mm = 1122.5px) footer üstü güvenli baskı yüksekliği

                let minRequiredScale = 1.0;

                wrappers.forEach(wrapper => {
                    const prevTransform = wrapper.style.transform;
                    const prevWidth = wrapper.style.width;
                    const prevMinWidth = wrapper.style.minWidth;
                    const prevHeight = wrapper.style.height;
                    const prevMaxHeight = wrapper.style.maxHeight;
                    const prevOverflow = wrapper.style.overflow;
                    const prevPadding = wrapper.style.padding;

                    wrapper.style.transform = 'none';
                    wrapper.style.width = '100%';
                    wrapper.style.minWidth = '100%';
                    wrapper.style.height = 'auto';
                    wrapper.style.maxHeight = 'none';
                    wrapper.style.overflow = 'visible';
                    wrapper.style.padding = `${padTopMm}mm ${padSideMm}mm 2mm ${padSideMm}mm`;

                    const naturalPx1 = wrapper.scrollHeight || wrapper.offsetHeight;

                    if (naturalPx1 > targetH) {
                        const s1 = Math.max(0.35, Math.min(0.99, targetH / naturalPx1));
                        wrapper.style.width = `${100 / s1}%`;
                        wrapper.style.minWidth = `${100 / s1}%`;
                        wrapper.style.padding = `${padTopMm / s1}mm ${padSideMm / s1}mm 2mm ${padSideMm / s1}mm`;

                        const naturalPx2 = wrapper.scrollHeight || wrapper.offsetHeight;
                        const exactScaleNeeded = targetH / Math.max(naturalPx2, 1);
                        const pageScale = Math.floor(Math.max(0.35, Math.min(0.99, exactScaleNeeded)) * 1000) / 1000;
                        if (pageScale < minRequiredScale) {
                            minRequiredScale = pageScale;
                        }
                    }

                    wrapper.style.transform = prevTransform;
                    wrapper.style.width = prevWidth;
                    wrapper.style.minWidth = prevMinWidth;
                    wrapper.style.height = prevHeight;
                    wrapper.style.maxHeight = prevMaxHeight;
                    wrapper.style.overflow = prevOverflow;
                    wrapper.style.padding = prevPadding;
                });

                setAutoScale(minRequiredScale);
            } else {
                setAutoScale(1.0);
            }
        } else {
            setAutoScale(1.0);
        }
    }, [pageBreakMode, targetPages, rowsPerPage, manualBreakIds, work, showPricesProp, showGrandTotalProp, showKdvProp, kdvRateProp, pazarMultiplierProp, mesaiMultiplierProp, customScaleProp, orientationProp, tableDensity, showWorkTitleProp]);

    const effectiveScale = customScaleProp ? Number(customScaleProp) : (pageBreakMode === 'fit_page' ? autoScale : 1.0);

    useEffect(() => {
        if (manualBreakIdsProp) {
            setManualBreakIds(manualBreakIdsProp);
        } else if (savedBreakSettings.manualBreakIds) {
            setManualBreakIds(savedBreakSettings.manualBreakIds);
        }
    }, [manualBreakIdsProp, work?.pdf_settings]);

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
            const updated = { ...cur, manualBreakIds: next };
            const jsonStr = JSON.stringify(updated);
            localStorage.setItem(`pdfPageBreakSettings_${id}`, jsonStr);

            // Persist to database
            const targetId = id || work?.id;
            const api = window.electronAPI || window.api;
            if (targetId && api && api.updateWork) {
                api.updateWork({ id: targetId, pdf_settings: jsonStr }).catch(() => {});
            }
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

    const calcResult = calculateWorkStats(work.items || [], pazarMultiplier, mesaiMultiplier, work.vehiclesList || work.vehicles || []);
    const groups = calcResult.groups || [];
    const grandTotalPrice = calcResult.grandTotal || 0;

    // Exact Physical Pixel Height A4 Page Splitting Engine
    const pages = (() => {
        if (!groups || groups.length === 0) return [];

        const isCompact = tableDensity === 'compact';
        const scaleVal = effectiveScale > 0 ? effectiveScale : 1.0;
        const isLandscapeMode = orientationProp === 'landscape';
        const BASE_TARGET_H = isLandscapeMode ? 625 : 830;
        const TARGET_A4_HEIGHT = Math.floor(BASE_TARGET_H / scaleVal); // Printable height limit inside A4 page in px

        // Exact physical heights of components:
        const HEADER_H = isCompact ? 85 : 100;
        const FOOTER_H = 28;
        const GRAND_TOTAL_H = showGrandTotalProp ? (showKdvProp ? (isCompact ? 95 : 120) : (isCompact ? 55 : 70)) : 0;
        const ROW_H = isCompact ? 20.5 : 27.0; // Safe physical rendered height of each table row with margins and scaling clearance
        const SUMMARY_H = isCompact ? 72 : 90; // Rendered height of Machine Summary Table

        // Helper: Split rows and blocks across pages based on given height capacity & constraints
        const splitGroupsIntoPages = ({ maxPageH, breakPerVehicle = false, maxRowsLimit = 0, disableOrphanGuard = false }) => {
            const pageList = [];
            let currentGroups = [];
            let currentHeight = 0;
            let currentPageRows = 0;

            const flushCurrentPage = () => {
                if (currentGroups.length > 0) {
                    pageList.push({
                        groups: currentGroups,
                        isFirst: pageList.length === 0,
                        isLast: false,
                        pageIndex: pageList.length
                    });
                    currentGroups = [];
                    currentHeight = 0;
                    currentPageRows = 0;
                }
            };

            groups.forEach((g, gIdx) => {
                const items = g.items || [];
                let itemIdx = 0;
                let needSummary = true;
                const isLastGroup = gIdx === groups.length - 1;

                if (breakPerVehicle && currentGroups.length > 0) {
                    flushCurrentPage();
                }

                while (itemIdx < items.length || needSummary) {
                    const isP1 = pageList.length === 0 && currentGroups.length === 0;
                    let baseOverhead = FOOTER_H;
                    if (isP1) baseOverhead += HEADER_H;

                    const currentUsedH = (currentHeight === 0 ? baseOverhead : currentHeight);
                    const availableH = maxPageH - currentUsedH;
                    const vehicleHeaderOverhead = (itemIdx === 0 ? 30 + 25 : 25);
                    const rowH = ROW_H;

                    if (maxRowsLimit > 0 && currentPageRows >= maxRowsLimit && currentGroups.length > 0 && itemIdx < items.length) {
                        flushCurrentPage();
                        continue;
                    }

                    const minRowsRequired = disableOrphanGuard ? 1 : (itemIdx === 0 ? Math.min(3, Math.max(1, items.length)) : 1);
                    let spaceForRows = availableH - vehicleHeaderOverhead;
                    if (spaceForRows < (minRowsRequired * rowH) && currentGroups.length > 0) {
                        flushCurrentPage();
                        continue;
                    }

                    let maxRowsCanFit = Math.max(0, Math.floor(Math.max(0, spaceForRows) / rowH));
                    if (maxRowsLimit > 0) {
                        const remRows = Math.max(0, maxRowsLimit - currentPageRows);
                        maxRowsCanFit = Math.min(maxRowsCanFit, remRows);
                    }

                    if (maxRowsCanFit === 0 && currentGroups.length > 0 && itemIdx < items.length) {
                        flushCurrentPage();
                        continue;
                    }

                    const countToTake = Math.max(1, maxRowsCanFit);
                    let chunkEnd = Math.min(items.length, itemIdx + countToTake);
                    let candidateChunk = items.slice(itemIdx, chunkEnd);

                    let manualBreakTriggered = false;
                    const manualBreakIdxInChunk = candidateChunk.findIndex(it => manualBreakIds.includes(it.id));
                    if (manualBreakIdxInChunk !== -1) {
                        chunkEnd = itemIdx + manualBreakIdxInChunk + 1;
                        candidateChunk = items.slice(itemIdx, chunkEnd);
                        manualBreakTriggered = true;
                    }

                    const chunk = candidateChunk;
                    const isLastChunk = chunkEnd >= items.length;

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
                        currentPageRows += chunk.length;
                    }

                    itemIdx = chunkEnd;

                    if (itemIdx >= items.length && !needSummary) {
                        if (manualBreakTriggered && currentGroups.length > 0) {
                            flushCurrentPage();
                        }
                        break;
                    }

                    if (manualBreakTriggered || (maxRowsLimit > 0 && currentPageRows >= maxRowsLimit) || currentHeight >= maxPageH - 20 || !summaryFitsOnThisPage) {
                        flushCurrentPage();
                    }
                }
            });

            flushCurrentPage();

            if (pageList.length > 0) {
                pageList.forEach((p, idx) => {
                    p.isFirst = idx === 0;
                    p.isLast = idx === pageList.length - 1;
                    p.pageIndex = idx;
                });
            }

            return pageList.length > 0 ? pageList : [{ groups: groups, isFirst: true, isLast: true, pageIndex: 0 }];
        };

        // 1. If fit_page mode is selected:
        if (pageBreakMode === 'fit_page') {
            if (targetPages <= 1 && (!manualBreakIds || manualBreakIds.length === 0)) {
                return [{
                    groups: groups.map(g => ({ ...g, isContinuation: false, isLastChunk: true })),
                    isFirst: true,
                    isLast: true,
                    pageIndex: 0
                }];
            }

            if (targetPages <= 1 && manualBreakIds && manualBreakIds.length > 0) {
                return splitGroupsIntoPages({ maxPageH: 100000, breakPerVehicle: false, maxRowsLimit: 0 });
            }

            // Multi-page target splitting (2, 3, 4... pages): balance content evenly across targetPages
            const totalRows = groups.reduce((acc, g) => acc + (g.items?.length || 0), 0);
            const balancedRowsPerPage = totalRows >= targetPages ? Math.ceil(totalRows / targetPages) : 0;

            let low = 160;
            let high = 60000;
            let bestPages = null;

            for (let iter = 0; iter < 22; iter++) {
                const mid = (low + high) / 2;
                const candidate = splitGroupsIntoPages({
                    maxPageH: mid,
                    breakPerVehicle: false,
                    maxRowsLimit: balancedRowsPerPage > 0 ? balancedRowsPerPage + 2 : 0,
                    disableOrphanGuard: true
                });
                if (candidate.length <= targetPages) {
                    bestPages = candidate;
                    high = mid;
                } else {
                    low = mid;
                }
            }

            let finalPages = bestPages || splitGroupsIntoPages({ maxPageH: 60000, breakPerVehicle: false, maxRowsLimit: balancedRowsPerPage });

            // If binary search produced fewer than targetPages and there are enough rows/groups to split further, split largest page chunks
            while (finalPages.length < targetPages) {
                let bestPageIdx = -1;
                let bestGroupIdx = -1;
                let maxItemsLen = 1;

                finalPages.forEach((p, pIdx) => {
                    p.groups.forEach((g, gIdx) => {
                        const len = (g.items || []).length;
                        if (len > maxItemsLen) {
                            maxItemsLen = len;
                            bestPageIdx = pIdx;
                            bestGroupIdx = gIdx;
                        }
                    });
                });

                if (bestPageIdx !== -1 && maxItemsLen >= 2) {
                    const targetPage = finalPages[bestPageIdx];
                    const targetGroup = targetPage.groups[bestGroupIdx];
                    const half = Math.ceil(targetGroup.items.length / 2);
                    const firstHalfItems = targetGroup.items.slice(0, half);
                    const secondHalfItems = targetGroup.items.slice(half);

                    const page1Groups = [
                        ...targetPage.groups.slice(0, bestGroupIdx),
                        {
                            ...targetGroup,
                            items: firstHalfItems,
                            isLastChunk: false
                        }
                    ];
                    const page2Groups = [
                        {
                            ...targetGroup,
                            items: secondHalfItems,
                            isContinuation: true,
                            isLastChunk: targetGroup.isLastChunk
                        },
                        ...targetPage.groups.slice(bestGroupIdx + 1)
                    ];

                    finalPages.splice(
                        bestPageIdx,
                        1,
                        { groups: page1Groups, isFirst: false, isLast: false, pageIndex: 0 },
                        { groups: page2Groups, isFirst: false, isLast: false, pageIndex: 0 }
                    );
                } else {
                    // Try splitting a page that has multiple groups
                    const multiGroupPageIdx = finalPages.findIndex(p => p.groups.length >= 2);
                    if (multiGroupPageIdx !== -1) {
                        const p = finalPages[multiGroupPageIdx];
                        const midG = Math.ceil(p.groups.length / 2);
                        finalPages.splice(
                            multiGroupPageIdx,
                            1,
                            { groups: p.groups.slice(0, midG), isFirst: false, isLast: false, pageIndex: 0 },
                            { groups: p.groups.slice(midG), isFirst: false, isLast: false, pageIndex: 0 }
                        );
                    } else {
                        break;
                    }
                }
            }

            finalPages.forEach((p, idx) => {
                p.isFirst = idx === 0;
                p.isLast = idx === finalPages.length - 1;
                p.pageIndex = idx;
            });

            return finalPages;
        }

        // 2. Rows per page mode ('rows')
        if (pageBreakMode === 'rows') {
            return splitGroupsIntoPages({
                maxPageH: TARGET_A4_HEIGHT,
                breakPerVehicle: false,
                maxRowsLimit: Math.max(1, Number(rowsPerPage) || 20)
            });
        }

        // 3. Auto ('auto') or Per-Vehicle ('vehicle') mode
        return splitGroupsIntoPages({
            maxPageH: TARGET_A4_HEIGHT,
            breakPerVehicle: pageBreakMode === 'vehicle',
            maxRowsLimit: 0
        });
    })();

    const handleSavePdf = async () => {
        if (savingPdf) return;
        setSavingPdf(true);

        const companyStr = work.customer_name || (typeof work.customer === 'object' ? work.customer?.name : work.customer) || work.customers?.name || work.company_name || work.company?.name || '';
        const titleStr = work.title || work.work_no || 'Is_Raporu';
        const defaultFileName = generateUniqueFileName('Puantaj', [companyStr, titleStr], 'pdf');

        const isElectronApp = typeof window !== 'undefined' && Boolean(
            window.process?.versions?.electron ||
            (navigator.userAgent && navigator.userAgent.toLowerCase().includes('electron'))
        );

        if (isElectronApp && window.electronAPI?.saveReportPdf) {
            // Electron Desktop: Sync data to localStorage and use native printToPDF
            try {
                localStorage.setItem('printData', JSON.stringify({
                    isWorkReport: true,
                    work: work,
                    showPrices: showPricesProp,
                    showGrandTotal: showGrandTotalProp,
                    showKdv: showKdvProp,
                    kdvRate: kdvRateProp,
                    pazarMultiplier: pazarMultiplierProp,
                    mesaiMultiplier: mesaiMultiplierProp,
                    pageBreakMode: pageBreakModeProp,
                    targetPages: targetPages,
                    rowsPerPage: rowsPerPageProp,
                    manualBreakIds: manualBreakIdsProp,
                    customScale: customScaleProp,
                    orientation: orientationProp,
                    tableDensity: tableDensityProp,
                    showWorkTitle: showWorkTitleProp
                }));
            } catch (e) {}

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
        } else {
            // Web Browser: Direct clean client-side PDF download without popups or distortion
            try {
                const el = document.querySelector('.pdf-pages-container') || document.querySelector('.pdf-viewer-layout');
                if (!el) throw new Error('Rapor içeriği bulunamadı');
                await exportElementToCleanPdf(el, defaultFileName, orientationProp === 'landscape');
            } catch (err) {
                console.error('Web PDF generation error:', err);
                window.print();
            } finally {
                setSavingPdf(false);
            }
        }
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
                                ref={el => {
                                    pageRefs.current[pIdx] = el;
                                    if (pIdx === 0) contentRef.current = el;
                                }}
                                className="pdf-content-wrapper"
                                style={effectiveScale !== 1.0 ? {
                                    transform: `scale(${effectiveScale})`,
                                    transformOrigin: 'top left',
                                    width: `${100 / effectiveScale}%`,
                                    minWidth: `${100 / effectiveScale}%`,
                                    maxWidth: 'none',
                                    height: 'auto',
                                    maxHeight: 'none',
                                    overflow: 'visible',
                                    padding: `${(tableDensity === 'compact' ? 4 : 6) / effectiveScale}mm ${(tableDensity === 'compact' ? 6 : 8) / effectiveScale}mm 2mm ${(tableDensity === 'compact' ? 6 : 8) / effectiveScale}mm`,
                                    boxSizing: 'border-box'
                                } : {
                                    width: '100%',
                                    minWidth: '100%',
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
                                            <table className="pdf-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                                                <colgroup>
                                                    <col style={{ width: orientationProp === 'landscape' ? '9%' : '9.5%' }} />
                                                    <col style={{ width: orientationProp === 'landscape' ? '8%' : '8%' }} />
                                                    <col style={{ width: orientationProp === 'landscape' ? '8%' : '7.5%' }} />
                                                    <col style={{ width: orientationProp === 'landscape' ? '8%' : '7.5%' }} />
                                                    <col style={{ width: orientationProp === 'landscape' ? '8%' : '8.5%' }} />
                                                    <col style={{ width: orientationProp === 'landscape' ? '8%' : '8.5%' }} />
                                                    <col style={{ width: orientationProp === 'landscape' ? '14%' : '17.5%' }} />
                                                    <col style={{ width: orientationProp === 'landscape' ? '27%' : '22%' }} />
                                                    <col style={{ width: orientationProp === 'landscape' ? '10%' : '11%' }} />
                                                </colgroup>
                                                <thead>
                                                    <tr>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '9%' : '9.5%' }}>TARİH</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '8%' : '8%' }}>FİŞ NO</th>
                                                        <th colSpan="2" style={{ width: orientationProp === 'landscape' ? '16%' : '15%' }}>Çalışma Süresi</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '8%' : '8.5%' }}>Süre/Adet</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '8%' : '8.5%' }}>Fazla Mesai</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '14%' : '17.5%' }}>MAKİNA</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '27%' : '22%' }}>AÇIKLAMA</th>
                                                        <th rowSpan="2" style={{ width: orientationProp === 'landscape' ? '10%' : '11%' }}>FİYAT</th>
                                                    </tr>
                                                    <tr>
                                                        <th style={{ width: orientationProp === 'landscape' ? '8%' : '7.5%' }}>Başlama</th>
                                                        <th style={{ width: orientationProp === 'landscape' ? '8%' : '7.5%' }}>Bitiş</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(group.items || []).map((item, itemIdx) => {
                                                        const desc = item.description || '';
                                                        const descUpper = desc.toUpperCase();
                                                        const isZeroHours = (Number(item.hours) === 0 && Number(item.overtime_hours) === 0);
                                                        const isHoliday = isZeroHours || descUpper.includes('[TATİL]') || descUpper.includes('[ÇALIŞILMADI]') || descUpper.includes('[PAZAR TATİLİ]');

                                                        let pdfRowClass = '';
                                                        if (isHoliday) {
                                                            pdfRowClass = 'pdf-row-holiday';
                                                        } else if (desc.includes('[RENK:red]') || item.isPazar) {
                                                            pdfRowClass = 'pdf-row-red';
                                                        } else if (desc.includes('[RENK:orange]')) {
                                                            pdfRowClass = 'pdf-row-orange';
                                                        } else if (desc.includes('[RENK:blue]')) {
                                                            pdfRowClass = 'pdf-row-blue';
                                                        } else if (desc.includes('[RENK:green]')) {
                                                            pdfRowClass = 'pdf-row-green';
                                                        } else if (desc.includes('[RENK:purple]')) {
                                                            pdfRowClass = 'pdf-row-purple';
                                                        }

                                                        const cleanDesc = desc.replace(/\[[^\]]*\]\s*/g, '').trim();
                                                        const hasManualBreak = Boolean(item.id && manualBreakIds.includes(item.id));
                                                        const canClickToBreak = Boolean(isPreview && item.id && showBreakToolsProp);

                                                        return (
                                                            <tr
                                                                key={item.id || itemIdx}
                                                                className={`${pdfRowClass} ${hasManualBreak ? 'pdf-has-manual-break' : ''} ${canClickToBreak ? 'pdf-row-breakable' : ''}`.trim()}
                                                                onClick={canClickToBreak ? () => handleToggleBreak(item.id) : undefined}
                                                                title={canClickToBreak ? (hasManualBreak ? 'Bu satırdaki sayfa bölmesini kaldırmak için tıklayın' : 'Bu satırdan sonra yeni sayfaya bölmek için tıklayın') : undefined}
                                                            >
                                                                <td className="center" style={{ position: 'relative' }}>
                                                                    {isPreview && item.id && (showBreakToolsProp || hasManualBreak) && (
                                                                        <button
                                                                            type="button"
                                                                            className={`pdf-manual-break-btn no-print ${hasManualBreak ? 'active' : ''}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleToggleBreak(item.id);
                                                                            }}
                                                                            title={hasManualBreak ? 'Sayfa bölmesini kaldır' : 'Bu satırdan sonra yeni sayfaya böl'}
                                                                        >
                                                                            ✂️
                                                                        </button>
                                                                    )}
                                                                    {formatDate(item.date)}
                                                                </td>
                                                                <td className="center">{item.receipt_no || '-'}</td>
                                                                <td className="center">{isHoliday ? '-' : (item.start_time || '-')}</td>
                                                                <td className="center">{isHoliday ? '-' : (item.end_time || '-')}</td>
                                                                <td className="center">
                                                                    {(() => {
                                                                        if (isHoliday) return '0 Gün';
                                                                        const isItemHourly = descUpper.includes('[SAATLİK]') || item.pricingType === 'hourly' || item.unit === 'saat';
                                                                        const isItemMonthly = item.isAylik || descUpper.includes('[AYLIK]') || item.pricingType === 'monthly' || item.unit === 'ay' || item.unit === 'aylık';
                                                                        if (isItemHourly) return `${item.hours || 0} Saat`;
                                                                        if (isItemMonthly) return `${item.hours || 1} Aylık`;
                                                                        return `${item.hours || 0} Gün`;
                                                                    })()}
                                                                </td>
                                                                <td className="center">{!isHoliday && item.overtime_hours > 0 ? `${item.overtime_hours} Saat` : '-'}</td>
                                                                <td className="center">{group.rawMachineName || group.machineName}</td>
                                                                <td>
                                                                    {cleanDesc ? cleanDesc : (isHoliday ? (item.isPazar ? 'Pazar Tatili' : 'Tatil / Çalışılmadı') : '')}
                                                                </td>
                                                                <td className="right">
                                                                    {showPrices ? (() => {
                                                                        if (isHoliday) {
                                                                            return '-';
                                                                        }
                                                                        const pMatch = (desc || '').match(/\[PAZAR_FIYAT:([^\]]+)\]/);
                                                                        const kMatch = (desc || '').match(/\[KATSAYI:([^\]]+)\]/);
                                                                        const baseP = item.unit_price || item.unitPriceVal || 0;
                                                                        const dailyP = baseP;
                                                                        
                                                                        let finalPrice = dailyP;
                                                                        if (pMatch && parseFloat(pMatch[1]) > 0) {
                                                                            finalPrice = parseFloat(pMatch[1]);
                                                                        } else if (kMatch) {
                                                                            const multVal = parseFloat(kMatch[1]) || 1;
                                                                            finalPrice = multVal === 1 ? dailyP : Number((dailyP * multVal).toFixed(6));
                                                                        } else if (item.isPazar) {
                                                                            finalPrice = pazarMultiplier === 1 ? dailyP : Number((dailyP * pazarMultiplier).toFixed(6));
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
                                                            <td colSpan="4" className="bold center pdf-summary-header-cell" style={{ borderBottom: '1px solid #cbd5e1' }}>
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
                                                            <td colSpan="3" className="bold right pdf-summary-total-label" style={{ backgroundColor: '#f8fafc', color: '#333' }}>TOPLAM</td>
                                                            <td className="right bold total-text pdf-summary-total-value" style={{ backgroundColor: '#f1f5f9', color: '#000' }}>{formatCurrency(group.calculatedGrandTotal)}</td>
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
                                                <td className="bold right pdf-summary-total-label" style={{ backgroundColor: '#f8fafc', color: '#333' }}>GENEL TOPLAM</td>
                                                <td className="right bold total-text pdf-summary-total-value" style={{ backgroundColor: '#f1f5f9', color: '#000' }}>{formatCurrency(grandTotalPrice)}{showKdvProp ? '' : ' + KDV'}</td>
                                            </tr>
                                            {showKdvProp && (
                                                <>
                                                    <tr>
                                                        <td className="bold right pdf-summary-total-label" style={{ backgroundColor: '#f8fafc', color: '#333' }}>KDV (%{kdvRateProp})</td>
                                                        <td className="right bold total-text pdf-summary-total-value" style={{ backgroundColor: '#f1f5f9', color: '#000' }}>{formatCurrency(Math.round(grandTotalPrice * (kdvRateProp / 100)))}</td>
                                                    </tr>
                                                    <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                                                        <td className="bold right pdf-summary-grand-label" style={{ backgroundColor: '#e2e8f0', color: '#000' }}>TOPLAM (KDV DAHİL)</td>
                                                        <td className="right bold total-text pdf-summary-grand-value" style={{ backgroundColor: '#cbd5e1', color: '#000' }}>{formatCurrency(Math.round(grandTotalPrice * (1 + kdvRateProp / 100)))}</td>
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
