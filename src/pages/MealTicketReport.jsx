import { useState, useEffect, useCallback } from 'react'
import { useCompany } from '../context/CompanyContext'
import TopProgressBar from '../components/TopProgressBar'
import { FileText, Users, TrendingUp, ChevronLeft, ChevronRight, Printer, UtensilsCrossed } from 'lucide-react'
import DataTable from '../components/DataTable'

export default function MealTicketReport() {
    const { currentCompany } = useCompany()
    const [report, setReport] = useState(null)
    const [loading, setLoading] = useState(true)

    const now = new Date()
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
    const [selectedYear, setSelectedYear] = useState(now.getFullYear())

    const loadReport = useCallback(async () => {
        if (!currentCompany) return
        setLoading(true)
        try {
            const result = await window.electronAPI.getMealTicketReport({
                companyId: currentCompany.id,
                month: selectedMonth,
                year: selectedYear
            })
            if (result.success) setReport(result.data)
        } catch (err) {
            console.error('Failed to load report:', err)
        }
        setLoading(false)
    }, [currentCompany, selectedMonth, selectedYear])

    useEffect(() => {
        if (currentCompany) loadReport()
    }, [currentCompany, loadReport])

    useEffect(() => {
        const unsub = window.electronAPI.onDbUpdate((change) => {
            if (change?.table === 'meal_tickets' || change?.table === 'meal_settings') loadReport()
        })
        return () => { if (unsub) unsub() }
    }, [loadReport])

    const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(val || 0)

    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        const d = new Date(dateStr)
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

    const goPrevMonth = () => {
        if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1) }
        else setSelectedMonth(m => m - 1)
    }

    const goNextMonth = () => {
        if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1) }
        else setSelectedMonth(m => m + 1)
    }

    const handlePrintPDF = () => {
        if (!report || !currentCompany) return

        const monthLabel = `${monthNames[selectedMonth]} ${selectedYear}`
        const today = new Date().toLocaleDateString('tr-TR')

        const prices = report.tickets.map(t => t.price_per_person || report.pricePerPerson || 0)
        const allSamePrice = prices.every(p => p === prices[0])
        const priceLabel = allSamePrice && prices.length > 0 ? formatCurrency(prices[0]) : 'Çeşitli'
        const subLabel = allSamePrice && prices.length > 0 ? `${report.totalPersons} × ${formatCurrency(prices[0])}` : 'Birim fiyatlar değişkenlik gösterebilir'

        const rowsHtml = report.tickets.map((ticket, idx) => `
            <tr class="${idx % 2 === 1 ? 'alt' : ''}">
                <td class="cell c-center c-muted">${idx + 1}</td>
                <td class="cell">${formatDate(ticket.date)}</td>
                <td class="cell c-center c-bold">${ticket.person_count}</td>
                <td class="cell c-right c-bold">${formatCurrency(ticket.person_count * (ticket.price_per_person || report.pricePerPerson || 0))}</td>
                <td class="cell c-muted">${ticket.notes || '—'}</td>
            </tr>
        `).join('')

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${currentCompany.name} - Yemek Raporu - ${monthLabel}</title>
    <style>
        @page { size: A4; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .page { width: 210mm; min-height: 297mm; padding: 20mm; margin: 0 auto; position: relative; }

        /* ─── Header ─── */
        .doc-header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; border-bottom: 2px solid #111827; margin-bottom: 22px; }
        .doc-header .left h1 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; margin-bottom: 3px; }
        .doc-header .left .company-name { font-size: 20px; font-weight: 700; color: #111827; }
        .doc-header .right { text-align: right; }
        .doc-header .right .period { font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 2px; }
        .doc-header .right .meta { font-size: 10px; color: #9ca3af; }

        /* ─── Summary ─── */
        .summary { display: flex; gap: 0; margin-bottom: 24px; border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden; }
        .summary-item { flex: 1; padding: 14px 16px; border-right: 1px solid #d1d5db; }
        .summary-item:last-child { border-right: none; }
        .summary-item .s-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; margin-bottom: 5px; }
        .summary-item .s-value { font-size: 18px; font-weight: 700; color: #111827; }
        .summary-item .s-sub { font-size: 9px; color: #9ca3af; margin-top: 2px; }

        /* ─── Table ─── */
        table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
        thead th { padding: 9px 12px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: #6b7280; background: #f9fafb; border-top: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; text-align: left; }
        .cell { padding: 8px 12px; font-size: 11px; border-bottom: 1px solid #e5e7eb; }
        tr.alt .cell { background: #fafafa; }
        .c-center { text-align: center; }
        .c-right { text-align: right; }
        .c-bold { font-weight: 600; }
        .c-muted { color: #6b7280; }

        /* ─── Footer Row ─── */
        .total-row .cell { background: #f3f4f6; font-weight: 700; font-size: 12px; border-top: 2px solid #374151; border-bottom: 1px solid #d1d5db; color: #111827; }

        /* ─── Document Footer ─── */
        .doc-footer { position: absolute; bottom: 15mm; left: 20mm; right: 20mm; display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8px; color: #9ca3af; }
        .doc-footer .page-num { font-weight: 600; }
    </style>
</head>
<body>
    <div class="page">
        <div class="doc-header">
            <div class="left">
                <h1>Yemek Fişi Raporu</h1>
                <div class="company-name">${currentCompany.name}</div>
            </div>
            <div class="right">
                <div class="period">${monthLabel}</div>
                <div class="meta">Düzenlenme: ${today}</div>
            </div>
        </div>

        <div class="summary">
            <div class="summary-item">
                <div class="s-label">Fiş Adedi</div>
                <div class="s-value">${report.ticketCount}</div>
                <div class="s-sub">adet kayıt</div>
            </div>
            <div class="summary-item">
                <div class="s-label">Toplam Kişi</div>
                <div class="s-value">${report.totalPersons}</div>
                <div class="s-sub">kişi</div>
            </div>
            <div class="summary-item">
                <div class="s-label">Birim Fiyat</div>
                <div class="s-value">${priceLabel}</div>
                <div class="s-sub">kişi başı</div>
            </div>
            <div class="summary-item">
                <div class="s-label">Toplam Tutar</div>
                <div class="s-value">${formatCurrency(report.totalCost)}</div>
                <div class="s-sub">${subLabel}</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:36px;text-align:center">#</th>
                    <th>Tarih</th>
                    <th style="text-align:center">Kişi</th>
                    <th style="text-align:right">Tutar</th>
                    <th>Açıklama</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml || '<tr><td colspan="5" class="cell" style="text-align:center;padding:28px;color:#9ca3af;">Bu dönem için kayıt bulunmuyor.</td></tr>'}
                ${report.tickets.length > 0 ? `
                <tr class="total-row">
                    <td class="cell" colspan="2">TOPLAM</td>
                    <td class="cell c-center">${report.totalPersons}</td>
                    <td class="cell c-right">${formatCurrency(report.totalCost)}</td>
                    <td class="cell"></td>
                </tr>` : ''}
            </tbody>
        </table>

        <div class="doc-footer">
            <span>${currentCompany.name}</span>
            <span>${monthLabel} Yemek Fişi Raporu</span>
            <span class="page-num">Sayfa 1/1</span>
        </div>
    </div>
</body>
</html>`

        // Open a new window and print
        const printWindow = window.open('', '_blank', 'width=800,height=1000')
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print()
            }, 300)
        }
    }

    return (
        <div className="page-container fade-in">
            <TopProgressBar loading={loading} />

            <div className="page-header">
                <div>
                    <h1 className="page-title">Yemek Fişi Raporu</h1>
                    <p className="page-subtitle">Aylık yemek katılım ve maliyet raporu</p>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-primary"
                        onClick={handlePrintPDF}
                        disabled={loading || !report}
                    >
                        <Printer size={16} />
                        PDF Olarak Yazdır
                    </button>
                </div>
            </div>

            {/* Month Selector */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '20px', marginBottom: '28px', padding: '12px 0'
            }}>
                <button className="btn btn-secondary" onClick={goPrevMonth} style={{ padding: '6px 12px' }}>
                    <ChevronLeft size={18} />
                </button>
                <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', minWidth: '180px', textAlign: 'center' }}>
                    {monthNames[selectedMonth]} {selectedYear}
                </div>
                <button className="btn btn-secondary" onClick={goNextMonth} style={{ padding: '6px 12px' }}>
                    <ChevronRight size={18} />
                </button>
            </div>

            {report && (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
                        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <div className="stat-label">FİŞ SAYISI</div>
                                <div className="stat-icon primary" style={{ width: '32px', height: '32px' }}><FileText size={16} /></div>
                            </div>
                            <div className="stat-value">{report.ticketCount} <span style={{ fontSize: '14px', fontWeight: '400' }}>fiş</span></div>
                        </div>

                        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <div className="stat-label">TOPLAM KİŞİ</div>
                                <div className="stat-icon success" style={{ width: '32px', height: '32px' }}><Users size={16} /></div>
                            </div>
                            <div className="stat-value">{report.totalPersons} <span style={{ fontSize: '14px', fontWeight: '400' }}>kişi</span></div>
                        </div>

                        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <div className="stat-label">KİŞİ BAŞI ÜCRET</div>
                                <div className="stat-icon warning" style={{ width: '32px', height: '32px' }}><UtensilsCrossed size={16} /></div>
                            </div>
                            <div className="stat-value" style={{ fontSize: '20px' }}>
                                {report.tickets.length > 0 && report.tickets.every(t => t.price_per_person === report.tickets[0].price_per_person)
                                    ? formatCurrency(report.tickets[0].price_per_person)
                                    : 'Çeşitli'}
                            </div>
                        </div>

                        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <div className="stat-label">TOPLAM MALİYET</div>
                                <div className="stat-icon danger" style={{ width: '32px', height: '32px' }}><TrendingUp size={16} /></div>
                            </div>
                            <div className="stat-value" style={{ fontSize: '20px', color: 'var(--danger)' }}>{formatCurrency(report.totalCost)}</div>
                        </div>
                    </div>

                    {/* Report Table */}
                    {(() => {
                        const columns = [
                            { 
                                key: 'date', 
                                label: 'Tarih', 
                                render: (val) => formatDate(val), 
                                sortable: true 
                            },
                            { 
                                key: 'person_count', 
                                label: 'Kişi Sayısı', 
                                render: (val, row) => (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Users size={13} style={{ color: 'var(--primary)' }} />
                                            <span style={{ fontWeight: '600' }}>{val}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>kişi</span>
                                        </div>
                                        {row.price_per_person > 0 && (
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '19px' }}>
                                                Birim: {formatCurrency(row.price_per_person)}
                                            </div>
                                        )}
                                    </div>
                                ),
                                sortable: true 
                            },
                            { 
                                key: 'total_amount', 
                                label: 'Tutar', 
                                align: 'right',
                                render: (_, row) => (
                                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>
                                        {formatCurrency(row.person_count * (row.price_per_person || report.pricePerPerson || 0))}
                                    </span>
                                ),
                                sortable: true 
                            },
                            { 
                                key: 'notes', 
                                label: 'Not', 
                                render: (val) => val || '-' 
                            }
                        ]

                        return (
                            <DataTable
                                persistenceKey="MealTicketReport_table"
                                columns={columns}
                                data={report.tickets || []}
                                showRowNumbers={true}
                                showSearch={true}
                                showCheckboxes={false}
                                emptyMessage="Bu ay için kayıt bulunmuyor."
                                searchPlaceholder="Tarih veya not ara..."
                                searchKeys={['notes']}
                            />
                        )
                    })()}
                </>
            )}
        </div>
    )
}
