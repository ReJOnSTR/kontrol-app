import { useEffect, useState } from 'react'
import ReportRenderer from '../components/ReportRenderer'
import EmployeeReportRenderer from '../components/EmployeeReportRenderer'
import WorkPdfReport from './WorkPdfReport'
import { formatCurrency } from '../utils/helpers'
import html2pdf from 'html2pdf.js'

export default function PrintPage() {
    const [data, setData] = useState(null)

    useEffect(() => {
        const load = () => {
            const storedData = localStorage.getItem('printData')
            if (storedData) {
                try {
                    let parsed = JSON.parse(storedData)
                    if (typeof parsed === 'string') {
                        try {
                            parsed = JSON.parse(parsed)
                        } catch (e) {}
                    }
                    setData(prev => {
                        if (prev && JSON.stringify(prev) === JSON.stringify(parsed)) {
                            return prev;
                        }
                        return parsed;
                    });
                    document.title = parsed.isEmployeeReport ? 'Personel Raporları' : (parsed.isWorkReport ? 'Puantaj Raporu' : 'Araç Raporları')
                } catch (e) {
                    console.error('Failed to parse print data', e)
                }
            }
        }

        load()
        
        // Listen for storage changes (even from same window if we dispatch it)
        window.addEventListener('storage', load)
        
        // Also a small interval for 5 seconds to ensure we catch it in hidden windows
        const interval = setInterval(() => {
            setData(prev => {
                if (prev) {
                    clearInterval(interval)
                    return prev
                }
                const storedData = localStorage.getItem('printData')
                if (storedData) {
                    try {
                        let parsed = JSON.parse(storedData)
                        if (typeof parsed === 'string') {
                            try {
                                parsed = JSON.parse(parsed)
                            } catch (e) {}
                        }
                        document.title = parsed.isEmployeeReport ? 'Personel Raporları' : (parsed.isWorkReport ? 'Puantaj Raporu' : 'Araç Raporları')
                        return parsed
                    } catch (e) {
                        return prev
                    }
                }
                return prev
            })
        }, 300)

        // Custom global function that Electron main.js can call
        window.refreshPrintData = load

        return () => {
            window.removeEventListener('storage', load)
            clearInterval(interval)
        }
    }, [])

    const downloadPdfDirectly = () => {
        const el = document.querySelector('.print-body') || document.body;
        const isLandscape = data?.orientation === 'landscape';
        const docTitle = document.title || 'Rapor';
        const filename = `${docTitle.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_\-\s]/g, '').trim().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

        const opt = {
            margin: isLandscape ? [5, 5, 5, 5] : [8, 8, 8, 8],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: isLandscape ? 'landscape' : 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        html2pdf().set(opt).from(el).save();
    };

    if (!data) return <div style={{ padding: '20px' }}>Yükleniyor veya veri bulunamadı...</div>

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
    )

    if (data.isWorkReport) {
        const isLandscape = data.orientation === 'landscape';
        return (
            <div className="print-body" style={{ background: 'white', minHeight: '100vh', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {renderToolbar()}
                <style type="text/css" media="print">
                    {`
                    @page {
                        size: A4 ${isLandscape ? 'landscape' : 'portrait'};
                        margin: 0mm;
                    }
                    .web-print-toolbar {
                        display: none !important;
                    }
                    :root, html, body {
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        color-scheme: light !important;
                        margin: 0px !important;
                        padding: 0px !important;
                        width: 100% !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    `}
                </style>
                <WorkPdfReport 
                    propWork={data.work} 
                    noHeader={true} 
                    isPreview={false} 
                    showPricesProp={data.showPrices} 
                    showGrandTotalProp={data.showGrandTotal !== undefined ? data.showGrandTotal : true}
                    showKdvProp={data.showKdv} 
                    kdvRateProp={data.kdvRate} 
                    pazarMultiplierProp={data.pazarMultiplier}
                    mesaiMultiplierProp={data.mesaiMultiplier}
                    pageBreakModeProp={data.pageBreakMode}
                    rowsPerPageProp={data.rowsPerPage}
                    manualBreakIdsProp={data.manualBreakIds}
                    customScaleProp={data.customScale}
                    orientationProp={data.orientation}
                    tableDensityProp={data.tableDensity}
                    showWorkTitleProp={data.showWorkTitle !== undefined ? data.showWorkTitle : true}
                />
            </div>
        )
    }

    if (data.isCustomerLedgerReport) {
        const { customer, ledgerData, previousBalance, config, companyName } = data;
        const totalDebit = ledgerData.reduce((sum, r) => sum + r.debit, 0) + (previousBalance > 0 ? previousBalance : 0);
        const totalCredit = ledgerData.reduce((sum, r) => sum + r.credit, 0) + (previousBalance < 0 ? -previousBalance : 0);
        const finalBalance = totalDebit - totalCredit;

        return (
            <div className="print-body" style={{ background: 'white', minHeight: '100vh', padding: '20px' }}>
                {renderToolbar()}
                <style type="text/css" media="print">
                    {`
                    @page {
                        size: A4;
                        margin: 15mm 10mm 15mm 10mm;
                    }
                    .web-print-toolbar {
                        display: none !important;
                    }
                    body, html {
                        margin: 0px !important;
                        padding: 0px !important;
                        background: white !important;
                        color: #1e293b !important;
                        font-family: system-ui, -apple-system, sans-serif !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    `}
                </style>
                <div style={{ maxWidth: '800px', margin: '0 auto', padding: '10px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '15px', marginBottom: '20px' }}>
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 5px 0' }}>{companyName}</h2>
                            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Cari Hesap Ekstre Raporu</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: '0 0 5px 0' }}>{config.title || 'CARİ HESAP EKSTRESİ'}</h1>
                            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '12px 15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', fontSize: '12px' }}>
                        <div>
                            <div style={{ fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Müşteri (Cari) Bilgileri</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>{customer.name}</div>
                            {customer.phone && <div style={{ color: '#475569', marginBottom: '2px' }}><b>Tel:</b> {customer.phone}</div>}
                            {customer.email && <div style={{ color: '#475569', marginBottom: '2px' }}><b>E-posta:</b> {customer.email}</div>}
                            {customer.address && <div style={{ color: '#475569', lineHeight: '1.4' }}><b>Adres:</b> {customer.address}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                            <div style={{ fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Kurumsal Detaylar</div>
                            {customer.tax_office && <div style={{ color: '#475569', marginBottom: '2px' }}><b>Vergi Dairesi:</b> {customer.tax_office}</div>}
                            {customer.tax_number && <div style={{ color: '#475569', marginBottom: '2px' }}><b>Vergi No / TC:</b> {customer.tax_number}</div>}
                            <div style={{ color: '#475569', marginBottom: '2px' }}><b>Rapor Dönemi:</b> {config.startDate ? `${new Date(config.startDate).toLocaleDateString('tr-TR')} - ` : ''}{config.endDate ? `${new Date(config.endDate).toLocaleDateString('tr-TR')}` : 'Tüm Dönemler'}</div>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '25px' }}>
                        <div style={{ padding: '12px 15px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Toplam Borç</div>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>{formatCurrency(totalDebit)}</div>
                        </div>
                        <div style={{ padding: '12px 15px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Toplam Tahsilat</div>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>{formatCurrency(totalCredit)}</div>
                        </div>
                        <div style={{ padding: '12px 15px', background: finalBalance > 0 ? '#fef2f2' : '#f0fdf4', border: finalBalance > 0 ? '1px solid #fca5a5' : '1px solid #86efac', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '9px', fontWeight: '700', color: finalBalance > 0 ? '#b91c1c' : '#15803d', textTransform: 'uppercase', marginBottom: '4px' }}>Bakiye</div>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: finalBalance > 0 ? '#b91c1c' : '#15803d' }}>{formatCurrency(finalBalance)}</div>
                        </div>
                    </div>

                    {/* Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '30px' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569', width: '80px' }}>Tarih</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569', width: '80px' }}>Belge No</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Açıklama</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#475569', width: '100px' }}>Borç (Deb.)</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#475569', width: '100px' }}>Alacak (Cred.)</th>
                                {config.showBalance && <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#475569', width: '110px' }}>Bakiye</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {previousBalance !== 0 && (
                                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#faf5ff' }}>
                                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{config.startDate ? new Date(config.startDate).toLocaleDateString('tr-TR') : '-'}</td>
                                    <td style={{ padding: '8px 10px', fontWeight: '600', color: '#7c3aed' }}>DEVİR</td>
                                    <td style={{ padding: '8px 10px', color: '#64748b', fontStyle: 'italic' }}>Önceki Dönemden Devreden Bakiye</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{previousBalance > 0 ? formatCurrency(previousBalance) : '-'}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{previousBalance < 0 ? formatCurrency(-previousBalance) : '-'}</td>
                                    {config.showBalance && <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(previousBalance)}</td>}
                                </tr>
                            )}
                            {ledgerData.map((row, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '8px 10px', color: '#334155' }}>{new Date(row.date).toLocaleDateString('tr-TR')}</td>
                                    <td style={{ padding: '8px 10px', color: '#475569', fontWeight: '500' }}>{row.ref}</td>
                                    <td style={{ padding: '8px 10px', color: '#334155' }}>{row.description}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#334155' }}>{row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#10b981' }}>{row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
                                    {config.showBalance && (
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', color: (row.balance + previousBalance) > 0 ? '#ef4444' : '#10b981' }}>
                                            {formatCurrency(row.balance + previousBalance)}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Signature block */}
                    {config.showSignature && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px', marginTop: '50px', fontSize: '12px' }}>
                            <div style={{ textAlign: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '10px' }}>
                                <p style={{ fontWeight: '700', color: '#334155', margin: '0 0 5px 0' }}>TESLİM EDEN</p>
                                <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>{companyName}</p>
                                <div style={{ height: '50px' }}></div>
                                <p style={{ color: '#94a3b8', margin: 0 }}>(İmza / Kaşe)</p>
                            </div>
                            <div style={{ textAlign: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '10px' }}>
                                <p style={{ fontWeight: '700', color: '#334155', margin: '0 0 5px 0' }}>TESLİM ALAN</p>
                                <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>{customer.name}</p>
                                <div style={{ height: '50px' }}></div>
                                <p style={{ color: '#94a3b8', margin: 0 }}>(İmza / Kaşe)</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const { reports, config, listConfig, dateRange, companyName, reportType } = data

    return (
        <div className="print-body" style={{ background: 'white', minHeight: '100vh' }}>
            {renderToolbar()}
            <style type="text/css" media="print">
                {`
                @page {
                    size: A4;
                    margin: 0mm;
                }
                .web-print-toolbar {
                    display: none !important;
                }
                body, html {
                    margin: 0px !important;
                    padding: 0px !important;
                    background: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .report-print-container {
                    width: 210mm !important;
                    min-height: 297mm !important;
                    margin: 0 auto !important;
                    padding: 10mm !important;
                    box-shadow: none !important;
                    border: none !important;
                    background: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    zoom: 0.88 !important;
                    page-break-after: always !important;
                    box-sizing: border-box !important;
                }
                .report-print-container table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                }
                .report-print-container th {
                    background-color: #eee !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .report-print-container tr {
                    page-break-inside: avoid !important;
                }
                `}
            </style>

            {data.isEmployeeReport ? (
                <EmployeeReportRenderer
                    reports={reports}
                    config={config}
                    listConfig={listConfig}
                    dateRange={dateRange}
                    companyName={companyName}
                    reportType={reportType}
                    isPreview={false}
                />
            ) : (
                <ReportRenderer
                    reports={reports}
                    config={config}
                    listConfig={listConfig}
                    dateRange={dateRange}
                    companyName={companyName}
                    reportType={reportType}
                    isPreview={false}
                />
            )}
        </div>
    )
}
