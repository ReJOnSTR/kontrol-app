import {
    formatDate,
    formatCurrency,
    getVehicleTypeLabel,
    getMaintenanceTypeLabel,
    getInsuranceTypeLabel,
    generateReportNo
} from '../utils/helpers'
import '../pages/WorkPdfReport.css'

const headerStyle = {
    borderBottom: '1.5px solid #cbd5e1',
    paddingBottom: '16px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
}

const sectionTitleStyle = {
    fontSize: '13px',
    fontWeight: 'bold',
    borderBottom: '1px solid #cbd5e1',
    paddingBottom: '4px',
    marginBottom: '8px',
    marginTop: 0,
    color: '#0f172a'
}

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '11px' }
const thStyle = { padding: '6px 8px', border: '1px solid #cbd5e1' }
const tdStyle = { padding: '5px 7px', border: '1px solid #cbd5e1' }
const thRowStyle = { background: '#f1f5f9', color: '#1e293b', textAlign: 'left', fontWeight: '700' }
const totalRowStyle = { background: '#f8fafc', fontWeight: 'bold' }
const emptyStyle = { fontSize: '11px', fontStyle: 'italic', color: '#64748b', padding: '6px 0' }

const footerStyle = {
    position: 'absolute',
    bottom: '7mm',
    left: '12mm',
    right: '12mm',
    borderTop: '1px solid #cbd5e1',
    paddingTop: '6px',
    fontSize: '9.5px',
    color: '#64748b'
}

function paginateItems(items, firstPageLimit, otherPagesLimit) {
    if (!items || items.length === 0) return [{ items: [], startIndex: 0, isFirst: true, isLast: true }];
    if (items.length <= firstPageLimit) {
        return [{ items, startIndex: 0, isFirst: true, isLast: true }];
    }
    const pages = [];
    pages.push({
        items: items.slice(0, firstPageLimit),
        startIndex: 0,
        isFirst: true,
        isLast: false
    });
    let offset = firstPageLimit;
    while (offset < items.length) {
        const nextLimit = otherPagesLimit;
        const chunk = items.slice(offset, offset + nextLimit);
        const isLast = (offset + nextLimit) >= items.length;
        pages.push({
            items: chunk,
            startIndex: offset,
            isFirst: false,
            isLast
        });
        offset += nextLimit;
    }
    return pages;
}

export default function ReportRenderer({
    reports = [],
    config,
    listConfig,
    dateRange,
    companyName,
    reportType,
    pageBreakMode = 'auto',
    isPreview = false
}) {
    // -------------------------------------------------------------
    // 1. ARAÇ LİSTESİ (ÖZET) RAPORU
    // -------------------------------------------------------------
    if (reportType === 'list') {
        let pages = [];
        let effectiveScale = 1.0;

        if (pageBreakMode === 'fit_page' && reports.length <= 32) {
            effectiveScale = reports.length <= 20 ? 1.0 : Math.max(0.60, Math.min(0.98, 20 / reports.length + 0.14));
            pages = [{ items: reports, startIndex: 0, isFirst: true, isLast: true }];
        } else {
            // Auto pagination: Page 1 fits 18 rows; Page 2+ fits 24 rows
            pages = paginateItems(reports, 18, 24);
            effectiveScale = 1.0;
        }

        const totalPages = pages.length;

        return (
            <div className="pdf-pages-container">
                {pages.map((page, pIdx) => (
                    <div
                        key={pIdx}
                        className={`pdf-report-container ${isPreview ? 'is-preview' : ''} ${pageBreakMode === 'fit_page' ? 'pdf-fit-page' : ''}`}
                    >
                        {isPreview && (
                            <div className="pdf-page-header-badge">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>Dikey A4</span>
                                    <span>•</span>
                                    <span>Ölçek: %{Math.round(effectiveScale * 100)}</span>
                                    <span>•</span>
                                    <span>{pageBreakMode === 'fit_page' ? '1 Sayfaya Sığdırıldı' : 'Çoklu Sayfa'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 700, color: totalPages === 1 ? '#16a34a' : '#2563eb' }}>
                                        Sayfa {pIdx + 1} / {totalPages}
                                    </span>
                                    <span>({page.items.length} Araç)</span>
                                </div>
                            </div>
                        )}

                        <div
                            className="pdf-content-wrapper"
                            style={{
                                transform: effectiveScale !== 1 ? `scale(${effectiveScale})` : undefined,
                                transformOrigin: 'top left',
                                width: effectiveScale !== 1 ? `calc(100% / ${effectiveScale})` : '100%',
                                height: effectiveScale !== 1 ? `calc(100% / ${effectiveScale})` : 'calc(100% - 15mm)',
                                padding: '10mm 12mm 4mm 12mm'
                            }}
                        >
                            {page.isFirst ? (
                                <div style={headerStyle}>
                                    <div>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {companyName || 'FİLO YÖNETİM SİSTEMİ'}
                                        </div>
                                        <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: '4px 0 0', color: '#0f172a' }}>
                                            ARAÇ İŞ & OPERASYON RAPORU
                                        </h1>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>Rapor Tarihi</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{new Date().toLocaleDateString('tr-TR')}</div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ ...headerStyle, paddingBottom: '10px', marginBottom: '14px' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                                            {companyName || 'FİLO YÖNETİM SİSTEMİ'}
                                        </div>
                                        <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '2px 0 0', color: '#0f172a' }}>
                                            ARAÇ İŞ & OPERASYON RAPORU (DEVAM)
                                        </h2>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>Rapor Tarihi</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{new Date().toLocaleDateString('tr-TR')}</div>
                                    </div>
                                </div>
                            )}

                            <table style={tableStyle}>
                                <thead>
                                    <tr style={thRowStyle}>
                                        <th style={{ ...thStyle, width: '24px', textAlign: 'center' }}>#</th>
                                        {listConfig?.plate && <th style={thStyle}>PLAKA</th>}
                                        {listConfig?.type && <th style={thStyle}>TÜR</th>}
                                        {listConfig?.brand && <th style={thStyle}>MARKA</th>}
                                        {listConfig?.model && <th style={thStyle}>MODEL</th>}
                                        {listConfig?.year && <th style={thStyle}>YIL</th>}
                                        {listConfig?.km && <th style={thStyle}>KM</th>}
                                        {listConfig?.status && <th style={thStyle}>DURUM</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {page.items.map((report, i) => {
                                        const rowNum = page.startIndex + i + 1;
                                        return (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                                                <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>{rowNum}</td>
                                                {listConfig?.plate && <td style={{ ...tdStyle, fontWeight: 'bold' }}>{report.vehicle.plate}</td>}
                                                {listConfig?.type && <td style={tdStyle}>{getVehicleTypeLabel(report.vehicle.type)}</td>}
                                                {listConfig?.brand && <td style={tdStyle}>{report.vehicle.brand}</td>}
                                                {listConfig?.model && <td style={tdStyle}>{report.vehicle.model}</td>}
                                                {listConfig?.year && <td style={tdStyle}>{report.vehicle.year}</td>}
                                                {listConfig?.km && <td style={tdStyle}>{report.vehicle.kilometers ? `${report.vehicle.kilometers} km` : '-'}</td>}
                                                {listConfig?.status && <td style={tdStyle}>{report.vehicle.status === 'active' ? 'Aktif' : report.vehicle.status === 'maintenance' ? 'Bakımda' : 'Pasif'}</td>}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {page.isLast && (
                                <div style={{ marginTop: '16px', fontSize: '11px', color: '#64748b', textAlign: 'right' }}>
                                    Toplam Araç Sayısı: <strong>{reports.length}</strong>
                                </div>
                            )}
                        </div>

                        {/* Pinned Page Footer */}
                        <div style={footerStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span>{companyName || 'FİLO YÖNETİM SİSTEMİ'}</span>
                                <span>Sayfa {pIdx + 1} / {totalPages}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // -------------------------------------------------------------
    // 2. DETAYLI ARAÇ RAPORU (ARAÇ BAŞINA SAYFA)
    // -------------------------------------------------------------
    const detailPages = [];

    reports.forEach((report, vehIdx) => {
        const invCount = config?.inventory ? (report.assignments?.length || 0) : 0;
        const mainCount = config?.maintenance ? (report.maintenances?.length || 0) : 0;
        const servCount = config?.services ? (report.services?.length || 0) : 0;
        const insCount = config?.insurance ? (report.insurances?.length || 0) : 0;
        const inspCount = config?.inspection ? (report.inspections?.length || 0) : 0;
        const perCount = config?.periodicInspection ? (report.periodicInspections?.length || 0) : 0;
        const totalItems = invCount + mainCount + servCount + insCount + inspCount + perCount;

        if (pageBreakMode === 'fit_page' || totalItems <= 12) {
            const scale = totalItems <= 12 ? 1.0 : Math.max(0.65, Math.min(0.98, 12 / totalItems + 0.15));
            detailPages.push({
                report,
                vehicleIndex: vehIdx,
                isSecondPart: false,
                scale,
                showGrid: true,
                showInventory: true,
                showMaintenance: true,
                showServices: true,
                showInsurance: true,
                showInspection: true,
                showPeriodic: true
            });
        } else {
            // Split vehicle into 2 pages: Page 1 = Info Grid + Inventory + Maintenance; Page 2 = Services + Insurance + Inspections
            detailPages.push({
                report,
                vehicleIndex: vehIdx,
                isSecondPart: false,
                scale: 1.0,
                showGrid: true,
                showInventory: true,
                showMaintenance: true,
                showServices: false,
                showInsurance: false,
                showInspection: false,
                showPeriodic: false
            });
            detailPages.push({
                report,
                vehicleIndex: vehIdx,
                isSecondPart: true,
                scale: 1.0,
                showGrid: false,
                showInventory: false,
                showMaintenance: false,
                showServices: true,
                showInsurance: true,
                showInspection: true,
                showPeriodic: true
            });
        }
    });

    const totalDetailPages = detailPages.length;

    return (
        <div className="pdf-pages-container">
            {detailPages.map((page, pIdx) => {
                const report = page.report;
                const scale = page.scale || 1.0;

                return (
                    <div
                        key={pIdx}
                        className={`pdf-report-container ${isPreview ? 'is-preview' : ''} ${pageBreakMode === 'fit_page' ? 'pdf-fit-page' : ''}`}
                    >
                        {isPreview && (
                            <div className="pdf-page-header-badge">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>Dikey A4</span>
                                    <span>•</span>
                                    <span>Ölçek: %{Math.round(scale * 100)}</span>
                                    <span>•</span>
                                    <span>Araç Detay ({report.vehicle.plate})</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 700, color: totalDetailPages === 1 ? '#16a34a' : '#2563eb' }}>
                                        Sayfa {pIdx + 1} / {totalDetailPages}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div
                            className="pdf-content-wrapper"
                            style={{
                                transform: scale !== 1 ? `scale(${scale})` : undefined,
                                transformOrigin: 'top left',
                                width: scale !== 1 ? `calc(100% / ${scale})` : '100%',
                                height: scale !== 1 ? `calc(100% / ${scale})` : 'calc(100% - 15mm)',
                                padding: '10mm 12mm 4mm 12mm'
                            }}
                        >
                            {/* Header */}
                            <div style={headerStyle}>
                                <div>
                                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                                        {companyName || 'FİLO YÖNETİM SİSTEMİ'}
                                    </div>
                                    <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '4px 0 0', color: '#0f172a' }}>
                                        ARAÇ DETAY RAPORU {page.isSecondPart ? '(DEVAM)' : ''}
                                    </h1>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>Rapor Tarihi</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{new Date().toLocaleDateString('tr-TR')}</div>
                                </div>
                            </div>

                            {/* Vehicle Info Grid */}
                            {page.showGrid && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>PLAKA</div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{report.vehicle.plate}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>MARKA</div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{report.vehicle.brand}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>MODEL</div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{report.vehicle.model}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>MODEL YILI</div>
                                        <div style={{ fontSize: '13px' }}>{report.vehicle.year}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>KM</div>
                                        <div style={{ fontSize: '13px' }}>{report.vehicle.kilometers ? `${report.vehicle.kilometers} km` : '-'}</div>
                                    </div>
                                </div>
                            )}

                            {/* Inventory */}
                            {page.showInventory && config?.inventory && (
                                <div style={{ marginBottom: '18px' }}>
                                    <h3 style={sectionTitleStyle}>DEMİRBAŞ / ENVANTER</h3>
                                    <div>
                                        {report.assignments && report.assignments.length > 0 ? (
                                            <table style={tableStyle}>
                                                <thead>
                                                    <tr style={thRowStyle}>
                                                        <th style={thStyle}>MALZEME</th>
                                                        <th style={thStyle}>ADET</th>
                                                        <th style={thStyle}>SORUMLU</th>
                                                        <th style={thStyle}>VERİLİŞ T.</th>
                                                        <th style={thStyle}>BİTİŞ T.</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {report.assignments.map((item, i) => (
                                                        <tr key={i}>
                                                            <td style={tdStyle}>{item.item_name}</td>
                                                            <td style={tdStyle}>{item.quantity}</td>
                                                            <td style={tdStyle}>{item.assigned_to || '-'}</td>
                                                            <td style={tdStyle}>{formatDate(item.start_date)}</td>
                                                            <td style={tdStyle}>{item.end_date ? formatDate(item.end_date) : 'Aktif'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div style={emptyStyle}>Kayıt bulunamadı.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Maintenance */}
                            {page.showMaintenance && config?.maintenance && (
                                <div style={{ marginBottom: '18px' }}>
                                    <h3 style={sectionTitleStyle}>BAKIM GEÇMİŞİ</h3>
                                    <div>
                                        {report.maintenances && report.maintenances.length > 0 ? (
                                            <table style={tableStyle}>
                                                <thead>
                                                    <tr style={thRowStyle}>
                                                        <th style={thStyle}>TARİH</th>
                                                        <th style={thStyle}>TÜR</th>
                                                        <th style={thStyle}>AÇIKLAMA</th>
                                                        <th style={thStyle}>KM</th>
                                                        <th style={{ ...thStyle, textAlign: 'right' }}>TUTAR</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {report.maintenances.map((item, i) => (
                                                        <tr key={i}>
                                                            <td style={tdStyle}>{formatDate(item.maintenance_date)}</td>
                                                            <td style={tdStyle}>{getMaintenanceTypeLabel(item.maintenance_type)}</td>
                                                            <td style={tdStyle}>{item.description || '-'}</td>
                                                            <td style={tdStyle}>{item.kilometers ? `${item.kilometers} km` : '-'}</td>
                                                            <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(item.cost)}</td>
                                                        </tr>
                                                    ))}
                                                    <tr style={totalRowStyle}>
                                                        <td colSpan={4} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                            {formatCurrency(report.maintenances.reduce((sum, item) => sum + (item.cost || 0), 0))}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div style={emptyStyle}>Kayıt bulunamadı.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Services */}
                            {page.showServices && config?.services && (
                                <div style={{ marginBottom: '18px' }}>
                                    <h3 style={sectionTitleStyle}>SERVİS / TAMİR</h3>
                                    <div>
                                        {report.services && report.services.length > 0 ? (
                                            <table style={tableStyle}>
                                                <thead>
                                                    <tr style={thRowStyle}>
                                                        <th style={thStyle}>TARİH</th>
                                                        <th style={thStyle}>SERVİS</th>
                                                        <th style={thStyle}>İŞLEM</th>
                                                        <th style={{ ...thStyle, textAlign: 'right' }}>TUTAR</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {report.services.map((item, i) => (
                                                        <tr key={i}>
                                                            <td style={tdStyle}>{formatDate(item.service_date)}</td>
                                                            <td style={tdStyle}>{item.service_name || '-'}</td>
                                                            <td style={tdStyle}>{item.description || '-'}</td>
                                                            <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(item.cost)}</td>
                                                        </tr>
                                                    ))}
                                                    <tr style={totalRowStyle}>
                                                        <td colSpan={3} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                            {formatCurrency(report.services.reduce((sum, item) => sum + (item.cost || 0), 0))}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div style={emptyStyle}>Kayıt bulunamadı.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Insurance */}
                            {page.showInsurance && config?.insurance && (
                                <div style={{ marginBottom: '18px' }}>
                                    <h3 style={sectionTitleStyle}>SİGORTA BİLGİLERİ</h3>
                                    <div>
                                        {report.insurances && report.insurances.length > 0 ? (
                                            <table style={tableStyle}>
                                                <thead>
                                                    <tr style={thRowStyle}>
                                                        <th style={thStyle}>TÜR</th>
                                                        <th style={thStyle}>ŞİRKET</th>
                                                        <th style={thStyle}>POLİÇE NO</th>
                                                        <th style={thStyle}>BİTİŞ</th>
                                                        <th style={{ ...thStyle, textAlign: 'right' }}>TUTAR</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {report.insurances.map((item, i) => (
                                                        <tr key={i}>
                                                            <td style={tdStyle}>{getInsuranceTypeLabel(item.insurance_type)}</td>
                                                            <td style={tdStyle}>{item.company_name || '-'}</td>
                                                            <td style={tdStyle}>{item.policy_no || '-'}</td>
                                                            <td style={tdStyle}>{formatDate(item.end_date)}</td>
                                                            <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(item.cost)}</td>
                                                        </tr>
                                                    ))}
                                                    <tr style={totalRowStyle}>
                                                        <td colSpan={4} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                            {formatCurrency(report.insurances.reduce((sum, item) => sum + (item.cost || 0), 0))}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div style={emptyStyle}>Kayıt bulunamadı.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Inspection */}
                            {page.showInspection && config?.inspection && (
                                <div style={{ marginBottom: '18px' }}>
                                    <h3 style={sectionTitleStyle}>MUAYENE BİLGİLERİ</h3>
                                    <div>
                                        {report.inspections && report.inspections.length > 0 ? (
                                            <table style={tableStyle}>
                                                <thead>
                                                    <tr style={thRowStyle}>
                                                        <th style={thStyle}>TARİH</th>
                                                        <th style={thStyle}>SONUÇ</th>
                                                        <th style={thStyle}>SONRAKİ MUAYENE</th>
                                                        <th style={{ ...thStyle, textAlign: 'right' }}>TUTAR</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {report.inspections.map((item, i) => {
                                                        const resultDisplay = item.result === 'passed' ? 'Geçti' :
                                                            item.result === 'failed' ? 'Kaldı' :
                                                                item.result === 'conditional' ? 'Şartlı Geçti' : item.result;
                                                        return (
                                                            <tr key={i}>
                                                                <td style={tdStyle}>{formatDate(item.inspection_date)}</td>
                                                                <td style={tdStyle}>{resultDisplay}</td>
                                                                <td style={tdStyle}>{item.next_inspection ? formatDate(item.next_inspection) : '-'}</td>
                                                                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(item.cost)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr style={totalRowStyle}>
                                                        <td colSpan={3} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                            {formatCurrency(report.inspections.reduce((sum, item) => sum + (item.cost || 0), 0))}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div style={emptyStyle}>Kayıt bulunamadı.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Periodic Inspection */}
                            {page.showPeriodic && config?.periodicInspection && (
                                <div style={{ marginBottom: '18px' }}>
                                    <h3 style={sectionTitleStyle}>PERİYODİK KONTROL BİLGİLERİ</h3>
                                    <div>
                                        {report.periodicInspections && report.periodicInspections.length > 0 ? (
                                            <table style={tableStyle}>
                                                <thead>
                                                    <tr style={thRowStyle}>
                                                        <th style={thStyle}>TARİH</th>
                                                        <th style={thStyle}>SONUÇ</th>
                                                        <th style={thStyle}>SONRAKİ KONTROL</th>
                                                        <th style={{ ...thStyle, textAlign: 'right' }}>TUTAR</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {report.periodicInspections.map((item, i) => {
                                                        const resultDisplay = item.result === 'passed' ? 'Uygundur' :
                                                            item.result === 'failed' ? 'Uygun Değildir' :
                                                                item.result === 'conditional' ? 'Eksikler Var' : item.result;
                                                        return (
                                                            <tr key={i}>
                                                                <td style={tdStyle}>{formatDate(item.inspection_date)}</td>
                                                                <td style={tdStyle}>{resultDisplay}</td>
                                                                <td style={tdStyle}>{item.next_inspection ? formatDate(item.next_inspection) : '-'}</td>
                                                                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(item.cost)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr style={totalRowStyle}>
                                                        <td colSpan={3} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                            {formatCurrency(report.periodicInspections.reduce((sum, item) => sum + (item.cost || 0), 0))}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div style={emptyStyle}>Kayıt bulunamadı.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pinned Page Footer */}
                        <div style={footerStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span>{report.vehicle.plate} • {companyName || 'FİLO YÖNETİM SİSTEMİ'}</span>
                                <span>Sayfa {pIdx + 1} / {totalDetailPages}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
