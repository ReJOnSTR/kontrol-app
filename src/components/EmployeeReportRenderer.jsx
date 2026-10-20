import {
    formatDate,
    formatCurrency,
    calculateRemainingLeaves,
    formatDayBalance,
    generateReportNo,
    formatWorkingDuration,
    formatMonthName
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

export default function EmployeeReportRenderer({
    reports = [],
    config,
    listConfig,
    dateRange,
    companyName,
    reportType,
    selectedPayrollMonth,
    pageBreakMode = 'auto',
    isPreview = false
}) {
    // -------------------------------------------------------------
    // 1. AYILIK MAAŞ TABLOSU RAPORU
    // -------------------------------------------------------------
    if (reportType === 'payroll') {
        const totals = reports.reduce((acc, r) => {
            const p = r.payroll || {};
            return {
                baseSalary: acc.baseSalary + (p.baseSalaryTarget || 0),
                overtimes: acc.overtimes + (p.totalOtTarget || 0),
                extra: acc.extra + (p.extraEarningsTarget || 0),
                incomingCarryover: acc.incomingCarryover + (p.incomingCarryover || 0),
                netTarget: acc.netTarget + (p.netTarget || 0),
                totalPaid: acc.totalPaid + (p.totalPaid || 0),
                outboundCarryover: acc.outboundCarryover + (p.outboundCarryover || 0),
                netRemaining: acc.netRemaining + (p.netRemaining || 0)
            };
        }, {
            baseSalary: 0,
            overtimes: 0,
            extra: 0,
            incomingCarryover: 0,
            netTarget: 0,
            totalPaid: 0,
            outboundCarryover: 0,
            netRemaining: 0
        });

        const monthTitle = formatMonthName(selectedPayrollMonth || new Date().toISOString().slice(0, 7));

        // Pagination calculation
        let pages = [];
        let effectiveScale = 1.0;

        if (pageBreakMode === 'fit_page' && reports.length <= 26) {
            effectiveScale = reports.length <= 13 ? 1.0 : Math.max(0.60, Math.min(0.98, 13 / reports.length + 0.12));
            pages = [{ items: reports, startIndex: 0, isFirst: true, isLast: true }];
        } else {
            // Auto pagination: Page 1 fits 13 rows with big header & KPI cards; Page 2+ fits 19 rows
            pages = paginateItems(reports, 13, 19);
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
                                    <span>({page.items.length} Personel)</span>
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
                            {/* Page 1 Header & KPI */}
                            {page.isFirst ? (
                                <>
                                    <div style={headerStyle}>
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                {companyName || 'FİLO YÖNETİM SİSTEMİ'}
                                            </div>
                                            <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '4px 0 0', color: '#0f172a' }}>
                                                AYLIK MAAŞ VE HAKEDİŞ TABLOSU
                                            </h1>
                                            <div style={{ fontSize: '13px', color: '#2563eb', fontWeight: '700', marginTop: '4px' }}>
                                                Dönem: {monthTitle}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>Rapor Tarihi</div>
                                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{new Date().toLocaleDateString('tr-TR')}</div>
                                            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                                                {generateReportNo('PAY')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* KPI Summary Cards */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                        <div style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                            <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Personel Sayısı</div>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginTop: '2px' }}>{reports.length} Kişi</div>
                                        </div>
                                        <div style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                            <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Toplam Hak Ediş</div>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0284c7', marginTop: '2px' }}>{formatCurrency(totals.netTarget)}</div>
                                        </div>
                                        <div style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                            <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Toplam Ödenen</div>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#16a34a', marginTop: '2px' }}>{formatCurrency(totals.totalPaid)}</div>
                                        </div>
                                        <div style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                            <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Kalan Bakiye</div>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: totals.netRemaining > 0 ? '#ea580c' : '#16a34a', marginTop: '2px' }}>{formatCurrency(totals.netRemaining)}</div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div style={{ ...headerStyle, paddingBottom: '10px', marginBottom: '14px' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                                            {companyName || 'FİLO YÖNETİM SİSTEMİ'}
                                        </div>
                                        <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '2px 0 0', color: '#0f172a' }}>
                                            AYLIK MAAŞ VE HAKEDİŞ TABLOSU (DEVAM)
                                        </h2>
                                        <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '600', marginTop: '2px' }}>
                                            Dönem: {monthTitle}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>Rapor Tarihi</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{new Date().toLocaleDateString('tr-TR')}</div>
                                    </div>
                                </div>
                            )}

                            {/* Table */}
                            <table style={{ ...tableStyle, fontSize: '9.5px' }}>
                                <thead>
                                    <tr style={thRowStyle}>
                                        <th style={{ ...thStyle, width: '22px', textAlign: 'center' }}>#</th>
                                        <th style={thStyle}>PERSONEL</th>
                                        <th style={thStyle}>GÖREV / DEPARTMAN</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>AYLIK MAAŞ</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>MESAİ</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>EK KAZANÇ</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>GELEN DEVİR</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>HAK EDİŞ</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>ÖDENEN</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>GİDEN DEVİR</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>KALAN BAKİYE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {page.items.map((report, i) => {
                                        const p = report.payroll || {};
                                        const hasOutbound = (p.outboundCarryover || 0) > 0 && Math.abs(p.netRemaining || 0) < 0.1;
                                        const rowNum = page.startIndex + i + 1;
                                        return (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                                                <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>{rowNum}</td>
                                                <td style={{ ...tdStyle, fontWeight: 'bold' }}>
                                                    {report.employee.first_name} {report.employee.last_name}
                                                </td>
                                                <td style={tdStyle}>
                                                    {report.employee.position || report.employee.department || '-'}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                    {formatCurrency(p.baseSalaryTarget || 0)}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', color: p.totalOtTarget > 0 ? '#4f46e5' : '#64748b' }}>
                                                    {p.totalOtTarget > 0 ? formatCurrency(p.totalOtTarget) : '-'}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', color: p.extraEarningsTarget > 0 ? '#0284c7' : '#64748b' }}>
                                                    {p.extraEarningsTarget > 0 ? formatCurrency(p.extraEarningsTarget) : '-'}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', color: p.incomingCarryover > 0 ? '#0369a1' : '#64748b' }}>
                                                    {p.incomingCarryover > 0 ? formatCurrency(p.incomingCarryover) : '-'}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>
                                                    {formatCurrency(p.netTarget || 0)}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: '#16a34a' }}>
                                                    {formatCurrency(p.totalPaid || 0)}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', color: p.outboundCarryover > 0 ? '#d97706' : '#64748b' }}>
                                                    {p.outboundCarryover > 0 ? formatCurrency(p.outboundCarryover) : '-'}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: hasOutbound ? '#64748b' : (p.netRemaining > 0 ? '#dc2626' : '#16a34a') }}>
                                                    {hasOutbound ? 'Devredildi' : formatCurrency(p.netRemaining || 0)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {page.isLast && (
                                    <tfoot>
                                        <tr style={{ ...totalRowStyle, borderTop: '2px solid #0f172a' }}>
                                            <td colSpan={3} style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'right', background: '#f1f5f9' }}>
                                                GENEL TOPLAM:
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', background: '#f1f5f9' }}>
                                                {formatCurrency(totals.baseSalary)}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', background: '#f1f5f9' }}>
                                                {totals.overtimes > 0 ? formatCurrency(totals.overtimes) : '-'}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', background: '#f1f5f9' }}>
                                                {totals.extra > 0 ? formatCurrency(totals.extra) : '-'}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', background: '#f1f5f9' }}>
                                                {totals.incomingCarryover > 0 ? formatCurrency(totals.incomingCarryover) : '-'}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#0284c7', background: '#f1f5f9' }}>
                                                {formatCurrency(totals.netTarget)}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#16a34a', background: '#f1f5f9' }}>
                                                {formatCurrency(totals.totalPaid)}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#d97706', background: '#f1f5f9' }}>
                                                {totals.outboundCarryover > 0 ? formatCurrency(totals.outboundCarryover) : '-'}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: totals.netRemaining > 0 ? '#dc2626' : '#16a34a', background: '#f1f5f9' }}>
                                                {formatCurrency(totals.netRemaining)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>

                            {page.isLast && (
                                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748b' }}>
                                    <div>Toplam {reports.length} personel listelendi.</div>
                                    <div>{monthTitle} Maaş & Hakediş Dökümü</div>
                                </div>
                            )}
                        </div>

                        {/* Pinned Page Footer */}
                        <div style={footerStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span>{companyName || 'FİLO YÖNETİM SİSTEMİ'} • {monthTitle}</span>
                                <span>Sayfa {pIdx + 1} / {totalPages}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // -------------------------------------------------------------
    // 2. PERSONEL LİSTESİ (ÖZET) RAPORU
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
                                    <span>({page.items.length} Personel)</span>
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
                                            PERSONEL LİSTESİ RAPORU
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
                                            PERSONEL LİSTESİ (DEVAM)
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
                                        {listConfig?.name && <th style={thStyle}>AD SOYAD</th>}
                                        {listConfig?.role && <th style={thStyle}>GÖREV / ÜNVAN</th>}
                                        {listConfig?.phone && <th style={thStyle}>TELEFON</th>}
                                        {listConfig?.startDate && <th style={thStyle}>BAŞLANGIÇ T.</th>}
                                        {listConfig?.workingDuration && <th style={thStyle}>ÇALIŞMA SÜRESİ</th>}
                                        {listConfig?.status && <th style={thStyle}>DURUM</th>}
                                        {listConfig?.salary && <th style={thStyle}>MAAŞ</th>}
                                        {listConfig?.remainingLeaves && <th style={thStyle}>KALAN İZİN</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {page.items.map((report, i) => {
                                        const rowNum = page.startIndex + i + 1;
                                        return (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                                                <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>{rowNum}</td>
                                                {listConfig?.name && <td style={{ ...tdStyle, fontWeight: 'bold' }}>{report.employee.first_name} {report.employee.last_name}</td>}
                                                {listConfig?.role && <td style={tdStyle}>{report.employee.position || report.employee.role || '-'}</td>}
                                                {listConfig?.phone && <td style={tdStyle}>{report.employee.phone || '-'}</td>}
                                                {listConfig?.startDate && <td style={tdStyle}>{formatDate(report.employee.start_date)}</td>}
                                                {listConfig?.workingDuration && <td style={tdStyle}>{formatWorkingDuration(report.employee.start_date, report.employee.end_date, report.employee.status)}</td>}
                                                {listConfig?.status && <td style={tdStyle}>{report.employee.status === 'active' ? 'Aktif' : 'Pasif'}</td>}
                                                {listConfig?.salary && <td style={tdStyle}>{report.employee.salary ? formatCurrency(report.employee.salary) : '-'}</td>}
                                                {listConfig?.remainingLeaves && <td style={tdStyle}>{formatDayBalance(calculateRemainingLeaves(report.employee, report.leaves))}</td>}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {page.isLast && (
                                <div style={{ marginTop: '16px', fontSize: '11px', color: '#64748b', textAlign: 'right' }}>
                                    Toplam Personel Sayısı: <strong>{reports.length}</strong>
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
    // 3. DETAYLI PERSONEL RAPORU (PERSONEL BAŞINA SAYFA)
    // -------------------------------------------------------------
    // Build page chunks for each employee so that overflowing sections break into page 2
    const detailPages = [];

    reports.forEach((report, empIdx) => {
        const leavesCount = config?.leaves ? (report.leaves?.length || 0) : 0;
        const salariesCount = config?.salaries ? (report.salaries?.length || 0) : 0;
        const assignmentsCount = config?.assignments ? (report.assignments?.length || 0) : 0;
        const documentsCount = config?.documents ? (report.documents?.length || 0) : 0;
        const totalItems = leavesCount + salariesCount + assignmentsCount + documentsCount;

        if (pageBreakMode === 'fit_page' || totalItems <= 12) {
            const scale = totalItems <= 12 ? 1.0 : Math.max(0.65, Math.min(0.98, 12 / totalItems + 0.15));
            detailPages.push({
                report,
                employeeIndex: empIdx,
                isFirstPart: true,
                isSecondPart: false,
                scale,
                showProfile: true,
                showLeaves: true,
                showSalaries: true,
                showAssignments: true,
                showDocuments: true
            });
        } else {
            // Split employee into 2 pages: Page 1 = Profile + Leaves; Page 2 = Salaries + Assignments + Documents
            detailPages.push({
                report,
                employeeIndex: empIdx,
                isFirstPart: true,
                isSecondPart: false,
                scale: 1.0,
                showProfile: true,
                showLeaves: true,
                showSalaries: false,
                showAssignments: false,
                showDocuments: false
            });
            detailPages.push({
                report,
                employeeIndex: empIdx,
                isFirstPart: false,
                isSecondPart: true,
                scale: 1.0,
                showProfile: false,
                showLeaves: false,
                showSalaries: true,
                showAssignments: true,
                showDocuments: true
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
                                    <span>Personel Detay</span>
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
                                        PERSONEL DETAY RAPORU {page.isSecondPart ? '(DEVAM)' : ''}
                                    </h1>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>Rapor Tarihi</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{new Date().toLocaleDateString('tr-TR')}</div>
                                </div>
                            </div>

                            {/* Employee Info Grid (First page of employee) */}
                            {page.showProfile && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>AD SOYAD</div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{report.employee.first_name} {report.employee.last_name}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>GÖREV / ÜNVAN</div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{report.employee.position || report.employee.role || '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>DEPARTMAN</div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{report.employee.department || '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>İŞE GİRİŞ / SÜRE</div>
                                        <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                            {formatDate(report.employee.start_date)}
                                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>
                                                {formatWorkingDuration(report.employee.start_date, report.employee.end_date, report.employee.status)}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>KALAN İZİN</div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2563eb' }}>
                                            {formatDayBalance(calculateRemainingLeaves(report.employee, report.leaves))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Leaves */}
                            {page.showLeaves && config?.leaves && (
                                <div style={{ marginBottom: '18px' }}>
                                    <h3 style={sectionTitleStyle}>İZİN GEÇMİŞİ</h3>
                                    <div>
                                        {report.leaves && report.leaves.length > 0 ? (
                                            <table style={tableStyle}>
                                                <thead>
                                                    <tr style={thRowStyle}>
                                                        <th style={thStyle}>TÜR</th>
                                                        <th style={thStyle}>BAŞLANGIÇ</th>
                                                        <th style={thStyle}>BİTİŞ</th>
                                                        <th style={thStyle}>SÜRE</th>
                                                        <th style={thStyle}>AÇIKLAMA</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {report.leaves.map((item, i) => (
                                                        <tr key={i}>
                                                            <td style={tdStyle}>{item.type}</td>
                                                            <td style={tdStyle}>{formatDate(item.start_date)}</td>
                                                            <td style={tdStyle}>{formatDate(item.end_date)}</td>
                                                            <td style={tdStyle}>
                                                                {item.hours ? `${item.hours} Saat` : (item.days && item.days % 1 !== 0 ? `${Math.round(item.days * 8 * 100) / 100} Saat` : `${item.days} Gün`)}
                                                            </td>
                                                            <td style={tdStyle}>{item.description || item.notes || '-'}</td>
                                                        </tr>
                                                    ))}
                                                    <tr style={totalRowStyle}>
                                                        <td colSpan={3} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                                        <td colSpan={2} style={tdStyle}>
                                                            {(() => {
                                                                const totalDays = report.leaves.reduce((sum, item) => sum + (item.days || 0), 0);
                                                                const whpl = 8;
                                                                const totalHours = Math.round(totalDays * whpl * 100) / 100;
                                                                if (totalHours % whpl === 0) {
                                                                    return `${Math.round(totalDays * 100) / 100} Gün`;
                                                                }
                                                                return `${totalHours} Saat`;
                                                            })()}
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

                            {/* Salary / Earnings */}
                            {page.showSalaries && config?.salaries && (
                                <div style={{ marginBottom: '18px' }}>
                                    <h3 style={sectionTitleStyle}>MAAŞ / HAKEDİŞ GEÇMİŞİ</h3>
                                    <div>
                                        {report.salaries && report.salaries.length > 0 ? (
                                            <table style={tableStyle}>
                                                <thead>
                                                    <tr style={thRowStyle}>
                                                        <th style={thStyle}>TARİH</th>
                                                        <th style={thStyle}>AÇIKLAMA</th>
                                                        <th style={{ ...thStyle, textAlign: 'right' }}>TUTAR</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {report.salaries.map((item, i) => (
                                                        <tr key={i}>
                                                            <td style={tdStyle}>{formatDate(item.payment_date || item.date)}</td>
                                                            <td style={tdStyle}>{item.period === 'salary' ? 'Maaş' : item.period === 'bonus' ? 'Prim' : item.period === 'advance' ? 'Avans' : item.period === 'loan' ? 'Borç' : item.period === 'loan_payment' ? 'Borç Ödeme' : item.period === 'expense' ? 'Harcırah' : item.period === 'other' ? 'Diğer' : item.period || '-'} {item.notes ? `(${item.notes})` : ''}</td>
                                                            <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(item.net_salary || item.amount)}</td>
                                                        </tr>
                                                    ))}
                                                    <tr style={totalRowStyle}>
                                                        <td colSpan={2} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                            {formatCurrency(report.salaries.reduce((sum, item) => sum + (item.net_salary || item.amount || 0), 0))}
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

                            {/* Assignments */}
                            {page.showAssignments && config?.assignments && (
                                <div style={{ marginBottom: '18px' }}>
                                    <h3 style={sectionTitleStyle}>ZİMMETLİ EKİPMANLAR</h3>
                                    <div>
                                        {report.assignments && report.assignments.length > 0 ? (
                                            <table style={tableStyle}>
                                                <thead>
                                                    <tr style={thRowStyle}>
                                                        <th style={thStyle}>EKİPMAN</th>
                                                        <th style={thStyle}>TARİH</th>
                                                        <th style={thStyle}>DURUM</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {report.assignments.map((item, i) => (
                                                        <tr key={i}>
                                                            <td style={tdStyle}>{item.item_name}</td>
                                                            <td style={tdStyle}>{formatDate(item.assign_date)}</td>
                                                            <td style={tdStyle}>{item.return_date ? 'İade Edildi' : 'Zimmetli'}</td>
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

                            {/* Documents */}
                            {page.showDocuments && config?.documents && (
                                <div style={{ marginBottom: '18px' }}>
                                    <h3 style={sectionTitleStyle}>BELGELER VE GEÇERLİLİK</h3>
                                    <div>
                                        {report.documents && report.documents.length > 0 ? (
                                            <table style={tableStyle}>
                                                <thead>
                                                    <tr style={thRowStyle}>
                                                        <th style={thStyle}>BELGE ADI</th>
                                                        <th style={thStyle}>BELGE NO</th>
                                                        <th style={thStyle}>GEÇERLİLİK TARİHİ</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {report.documents.map((item, i) => (
                                                        <tr key={i}>
                                                            <td style={tdStyle}>{item.category || item.name}</td>
                                                            <td style={tdStyle}>{item.document_no || '-'}</td>
                                                            <td style={tdStyle}>{item.expiry_date ? formatDate(item.expiry_date) : 'Süresiz'}</td>
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
                        </div>

                        {/* Pinned Page Footer */}
                        <div style={footerStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span>{report.employee.first_name} {report.employee.last_name} • {companyName || 'FİLO YÖNETİM SİSTEMİ'}</span>
                                <span>Sayfa {pIdx + 1} / {totalDetailPages}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
