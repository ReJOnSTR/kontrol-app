import {
    formatDate,
    formatCurrency,
    getVehicleTypeLabel,
    getMaintenanceTypeLabel,
    getInsuranceTypeLabel,
    generateReportNo
} from '../utils/helpers'

// Shared A4 page styles
const pageStyle = {
    width: '210mm',
    minHeight: '297mm',
    padding: '20mm',
    margin: '0 auto',
    background: 'white',
    position: 'relative',
    boxSizing: 'border-box',
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: 'black'
}

const headerStyle = {
    borderBottom: '1.5px solid #cbd5e1',
    paddingBottom: '20px',
    marginBottom: '30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
}

const sectionTitleStyle = {
    fontSize: '14px',
    fontWeight: 'bold',
    borderBottom: '1px solid #ccc',
    paddingBottom: '5px',
    marginBottom: '10px',
    marginTop: 0
}

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '11px' }
const thStyle = { padding: '7px 8px', border: '1px solid #cbd5e1' }
const tdStyle = { padding: '6px', border: '1px solid #cbd5e1' }
const thRowStyle = { background: '#f1f5f9', color: '#1e293b', textAlign: 'left', fontWeight: '700' }
const totalRowStyle = { background: '#f5f5f5', fontWeight: 'bold' }
const emptyStyle = { fontSize: '12px', fontStyle: 'italic', color: '#666' }
const footerStyle = {
    position: 'absolute',
    bottom: '15mm',
    left: '20mm',
    right: '20mm',
    borderTop: '1px solid #cbd5e1',
    paddingTop: '8px',
    fontSize: '9.5px',
    color: '#64748b',
    textAlign: 'right'
}

/**
 * Renders report pages - used by both modal preview and PrintPage
 * @param {Object} props
 * @param {Array} props.reports - Array of report objects
 * @param {Object} props.config - Detail report config { inventory, maintenance, services, insurance, inspection, periodicInspection }
 * @param {Object} props.listConfig - List report config { plate, type, brand, model, year, km, status }
 * @param {Object} props.dateRange - { start, end }
 * @param {string} props.companyName - Company name
 * @param {string} props.reportType - 'list' or 'detail'
 * @param {boolean} props.isPreview - If true, adds shadow/border for preview display
 */
export default function ReportRenderer({ reports, config, listConfig, dateRange, companyName, reportType, isPreview = false }) {
    const previewPageStyle = isPreview
        ? { ...pageStyle, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '1px solid #e0e0e0', pageBreakAfter: 'always' }
        : { ...pageStyle, pageBreakAfter: 'always' }

    const getReportPeriodText = (range) => {
        if (range?.start) {
            const d = new Date(range.start);
            if (!isNaN(d.getTime())) {
                const m = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
                return m.charAt(0).toUpperCase() + m.slice(1);
            }
        }
        const now = new Date();
        const m = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
        return m.charAt(0).toUpperCase() + m.slice(1);
    };

    if (reportType === 'list') {
        return (
            <div className="report-print-container" style={previewPageStyle}>
                {/* Header */}
                <div style={headerStyle}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>ARAÇ İŞ & OPERASYON RAPORU</h1>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Rapor Tarihi</div>
                        <div style={{ fontWeight: 'bold' }}>{new Date().toLocaleDateString('tr-TR')}</div>
                    </div>
                </div>

                <table style={tableStyle}>
                    <thead>
                        <tr style={thRowStyle}>
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
                        {reports.map((report, i) => (
                            <tr key={i}>
                                {listConfig?.plate && <td style={{ ...tdStyle, fontWeight: 'bold' }}>{report.vehicle.plate}</td>}
                                {listConfig?.type && <td style={tdStyle}>{getVehicleTypeLabel(report.vehicle.type)}</td>}
                                {listConfig?.brand && <td style={tdStyle}>{report.vehicle.brand}</td>}
                                {listConfig?.model && <td style={tdStyle}>{report.vehicle.model}</td>}
                                {listConfig?.year && <td style={tdStyle}>{report.vehicle.year}</td>}
                                {listConfig?.km && <td style={tdStyle}>{report.vehicle.kilometers ? `${report.vehicle.kilometers} km` : '-'}</td>}
                                {listConfig?.status && <td style={tdStyle}>{report.vehicle.status === 'active' ? 'Aktif' : report.vehicle.status === 'maintenance' ? 'Bakımda' : 'Pasif'}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ marginTop: '20px', fontSize: '12px', color: '#666', textAlign: 'right' }}>
                    Toplam Araç Sayısı: <strong>{reports.length}</strong>
                </div>

                <div style={footerStyle}>Sayfa 1 / 1</div>
            </div>
        )
    }

    // Detail report - one page per vehicle
    return reports.map((report, index) => (
        <div key={index} className="report-print-container" style={previewPageStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>ARAÇ DETAY RAPORU</h1>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Rapor Tarihi</div>
                    <div style={{ fontWeight: 'bold' }}>{new Date().toLocaleDateString('tr-TR')}</div>
                </div>
            </div>

            {/* Vehicle Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
                <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>PLAKA</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{report.vehicle.plate}</div>
                </div>
                <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>MARKA</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{report.vehicle.brand}</div>
                </div>
                <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>MODEL</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{report.vehicle.model}</div>
                </div>
                <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>MODEL YILI</div>
                    <div style={{ fontSize: '14px' }}>{report.vehicle.year}</div>
                </div>
                <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>KM</div>
                    <div style={{ fontSize: '14px' }}>{report.vehicle.kilometers ? `${report.vehicle.kilometers} km` : '-'}</div>
                </div>
            </div>

            {/* Inventory */}
            {config?.inventory && (
                <div style={{ marginBottom: '25px' }}>
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
                            <div style={emptyStyle}>Bu tarih aralığında kayıt bulunamadı.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Maintenance */}
            {config?.maintenance && (
                <div style={{ marginBottom: '25px' }}>
                    <h3 style={sectionTitleStyle}>BAKIM GEÇMİŞİ</h3>
                    <div>
                        {report.maintenances && report.maintenances.length > 0 ? (
                            <table style={tableStyle}>
                                <thead>
                                    <tr style={thRowStyle}>
                                        <th style={thStyle}>TARİH</th>
                                        <th style={thStyle}>TÜR</th>
                                        <th style={thStyle}>AÇIKLAMA</th>
                                        <th style={thStyle}>SONRAKİ BAKIM</th>
                                        <th style={thStyle}>MALİYET</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.maintenances.slice(0, 50).map((item, i) => (
                                        <tr key={i}>
                                            <td style={tdStyle}>{formatDate(item.date)}</td>
                                            <td style={tdStyle}>{getMaintenanceTypeLabel(item.type)}</td>
                                            <td style={tdStyle}>{item.description}</td>
                                            <td style={tdStyle}>{item.next_date ? formatDate(item.next_date) : '-'}</td>
                                            <td style={tdStyle}>{formatCurrency(item.cost)}</td>
                                        </tr>
                                    ))}
                                    <tr style={totalRowStyle}>
                                        <td colSpan={4} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                        <td style={tdStyle}>
                                            {formatCurrency(report.maintenances.reduce((sum, item) => sum + (item.cost || 0), 0))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        ) : (
                            <div style={emptyStyle}>Bu tarih aralığında kayıt bulunamadı.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Services */}
            {config?.services && (
                <div style={{ marginBottom: '25px' }}>
                    <h3 style={sectionTitleStyle}>SERVİS / TAMİR GEÇMİŞİ</h3>
                    <div>
                        {report.services && report.services.length > 0 ? (
                            <table style={tableStyle}>
                                <thead>
                                    <tr style={thRowStyle}>
                                        <th style={thStyle}>TARİH</th>
                                        <th style={thStyle}>FİRMA</th>
                                        <th style={thStyle}>TÜR</th>
                                        <th style={thStyle}>AÇIKLAMA</th>
                                        <th style={thStyle}>KM</th>
                                        <th style={thStyle}>MALİYET</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.services.map((item, i) => (
                                        <tr key={i}>
                                            <td style={tdStyle}>{formatDate(item.date)}</td>
                                            <td style={tdStyle}>{item.service_name}</td>
                                            <td style={tdStyle}>{item.type}</td>
                                            <td style={tdStyle}>{item.description}</td>
                                            <td style={tdStyle}>{item.km}</td>
                                            <td style={tdStyle}>{formatCurrency(item.cost)}</td>
                                        </tr>
                                    ))}
                                    <tr style={totalRowStyle}>
                                        <td colSpan={5} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                        <td style={tdStyle}>
                                            {formatCurrency(report.services.reduce((sum, item) => sum + (item.cost || 0), 0))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        ) : (
                            <div style={emptyStyle}>Bu tarih aralığında kayıt bulunamadı.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Insurance & Inspection & Periodic */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {config?.insurance && (
                    <div>
                        <h3 style={sectionTitleStyle}>SİGORTA BİLGİLERİ</h3>
                        <div>
                            {report.insurances && report.insurances.length > 0 ? (
                                <table style={tableStyle}>
                                    <thead>
                                        <tr style={thRowStyle}>
                                            <th style={thStyle}>ŞİRKET</th>
                                            <th style={thStyle}>TÜR</th>
                                            <th style={thStyle}>BAŞLANGIÇ</th>
                                            <th style={thStyle}>BİTİŞ</th>
                                            <th style={thStyle}>TUTAR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.insurances.slice(0, 10).map((item, i) => (
                                            <tr key={i}>
                                                <td style={tdStyle}>{item.company}</td>
                                                <td style={tdStyle}>{getInsuranceTypeLabel(item.type)}</td>
                                                <td style={tdStyle}>{formatDate(item.start_date)}</td>
                                                <td style={tdStyle}>{formatDate(item.end_date)}</td>
                                                <td style={tdStyle}>{formatCurrency(item.premium)}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ fontWeight: 'bold' }}>
                                            <td colSpan={4} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                            <td style={tdStyle}>
                                                {formatCurrency(report.insurances.reduce((sum, item) => sum + (item.premium || 0), 0))}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <div style={emptyStyle}>Kayıt yok.</div>
                            )}
                        </div>
                    </div>
                )}

                {config?.inspection && (
                    <div>
                        <h3 style={sectionTitleStyle}>MUAYENE BİLGİLERİ</h3>
                        <div>
                            {report.inspections && report.inspections.length > 0 ? (
                                <table style={tableStyle}>
                                    <thead>
                                        <tr style={thRowStyle}>
                                            <th style={thStyle}>TARİH</th>
                                            <th style={thStyle}>SONUÇ</th>
                                            <th style={thStyle}>SONRAKİ MUAYENE</th>
                                            <th style={thStyle}>TUTAR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.inspections.slice(0, 10).map((item, i) => {
                                            const resultDisplay = item.result === 'passed' ? 'Geçti' :
                                                item.result === 'failed' ? 'Kaldı' :
                                                    item.result === 'conditional' ? 'Şartlı Geçti' : item.result;
                                            return (
                                                <tr key={i}>
                                                    <td style={tdStyle}>{formatDate(item.inspection_date)}</td>
                                                    <td style={tdStyle}>{resultDisplay}</td>
                                                    <td style={tdStyle}>{item.next_inspection ? formatDate(item.next_inspection) : '-'}</td>
                                                    <td style={tdStyle}>{formatCurrency(item.cost)}</td>
                                                </tr>
                                            )
                                        })}
                                        <tr style={{ fontWeight: 'bold' }}>
                                            <td colSpan={3} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                            <td style={tdStyle}>
                                                {formatCurrency(report.inspections.reduce((sum, item) => sum + (item.cost || 0), 0))}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <div style={emptyStyle}>Kayıt yok.</div>
                            )}
                        </div>
                    </div>
                )}

                {config?.periodicInspection && (
                    <div>
                        <h3 style={sectionTitleStyle}>PERİYODİK KONTROL BİLGİLERİ</h3>
                        <div>
                            {report.periodicInspections && report.periodicInspections.length > 0 ? (
                                <table style={tableStyle}>
                                    <thead>
                                        <tr style={thRowStyle}>
                                            <th style={thStyle}>TARİH</th>
                                            <th style={thStyle}>SONUÇ</th>
                                            <th style={thStyle}>SONRAKİ KONTROL</th>
                                            <th style={thStyle}>TUTAR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.periodicInspections.slice(0, 10).map((item, i) => {
                                            const resultDisplay = item.result === 'passed' ? 'Uygundur' :
                                                item.result === 'failed' ? 'Uygun Değildir' :
                                                    item.result === 'conditional' ? 'Eksikler Var' : item.result;
                                            return (
                                                <tr key={i}>
                                                    <td style={tdStyle}>{formatDate(item.inspection_date)}</td>
                                                    <td style={tdStyle}>{resultDisplay}</td>
                                                    <td style={tdStyle}>{item.next_inspection ? formatDate(item.next_inspection) : '-'}</td>
                                                    <td style={tdStyle}>{formatCurrency(item.cost)}</td>
                                                </tr>
                                            )
                                        })}
                                        <tr style={{ fontWeight: 'bold' }}>
                                            <td colSpan={3} style={{ ...tdStyle, textAlign: 'right' }}>TOPLAM:</td>
                                            <td style={tdStyle}>
                                                {formatCurrency(report.periodicInspections.reduce((sum, item) => sum + (item.cost || 0), 0))}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <div style={emptyStyle}>Kayıt yok.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <div style={footerStyle}>Sayfa {index + 1} / {reports.length}</div>
        </div>
    ))
}
