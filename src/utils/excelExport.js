import { calculateWorkStats } from './workCalculations'
import { formatDate, formatCurrency, generateReportNo, generateUniqueFileName } from './helpers'

/**
 * Export a Work Puantaj Report to an Excel file (.xls/.xlsx) that is
 * 100% TRULY IDENTICAL to the WorkPdfReport preview layout, including:
 * - Exact header title & border structure
 * - Vehicle section headers
 * - Column names and data formatting
 * - Right-aligned vehicle summary tables
 * - Right-aligned general grand total summary box
 * 
 * @param {Object} work - The work object
 * @param {Array} vehicles - Company vehicles array for vehicle name resolution
 * @param {Object} options - Export options (showPrices, showKdv, kdvRate, pazarMultiplier, mesaiMultiplier)
 */
export function exportWorkToExcel(work, vehicles = [], options = {}) {
    if (!work) return

    const {
        showPrices = true,
        showWorkTitle = true,
        showKdv = false,
        kdvRate = 20,
        pazarMultiplier = 1.5,
        mesaiMultiplier = 1.5
    } = options

    const calcResult = calculateWorkStats(work?.items || [], pazarMultiplier, mesaiMultiplier, vehicles)
    const groups = calcResult.groups || []
    const grandTotal = calcResult.grandTotal || 0

    const companyName = work.customer_name || (typeof work.customer === 'object' ? work.customer?.name : work.customer) || work.customers?.name || work.company_name || work.company?.name || '-'
    const workTitle = work.title || work.work_no || 'İş Raporu'
    const reportDate = new Date().toLocaleDateString('tr-TR')
    const reportNumber = generateReportNo('PUAN', work.work_no || work.id)
    const colSpanCount = showPrices ? 9 : 8

    let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>Puantaj Raporu</x:Name>
    <x:WorksheetOptions>
     <x:DisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000000; background: #ffffff; }
  table { border-collapse: collapse; width: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  th { border: 0.5pt solid #64748b; background-color: #f1f5f9; color: #000000; font-weight: bold; text-align: center; padding: 6px 8px; font-size: 10pt; }
  td { border: 0.5pt solid #cbd5e1; padding: 5px 8px; font-size: 10pt; vertical-align: middle; color: #000000; }
  .no-border { border: none !important; mso-border-alt: none !important; background: transparent !important; }
  .pdf-title-standard { font-size: 16pt; font-weight: bold; margin: 0; color: #000000; }
  .pdf-date-label { font-size: 9pt; color: #64748b; }
  .pdf-date-value { font-weight: bold; font-size: 11pt; color: #000000; }
  .row-red { background-color: #fff1f2 !important; color: #be123c !important; font-weight: bold; }
  .row-orange { background-color: #ffedd5 !important; color: #c2410c !important; }
  .row-blue { background-color: #dbeafe !important; color: #1d4ed8 !important; }
  .row-green { background-color: #dcfce7 !important; color: #15803d !important; }
  .row-purple { background-color: #f3e8ff !important; color: #6b21a8 !important; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-left { text-align: left; }
  .bold { font-weight: bold; }
  .total-text { font-weight: bold; color: #000000; }
  .bg-light-gray { background-color: #f8fafc; }
</style>
</head>
<body>

<!-- Header Block -->
<table style="border-collapse: collapse; width: 100%;">
  <tr>
    <td colspan="6" class="no-border" style="border-bottom: 2pt solid #000000 !important; padding-bottom: 8px;">
      <span class="pdf-title-standard">
        ${work.work_no ? `İŞ RAPORU - ${work.work_no}` : 'İŞ RAPORU / PUANTAJ CETVELİ'}
      </span>
    </td>
    <td colspan="${showPrices ? 3 : 2}" class="no-border text-right" style="border-bottom: 2pt solid #000000 !important; padding-bottom: 8px;">
      <div class="pdf-date-label">Rapor Tarihi</div>
      <div class="pdf-date-value">${reportDate}</div>
    </td>
  </tr>

  <!-- Spacer Row -->
  <tr style="height: 6px;"><td colspan="${colSpanCount}" class="no-border" style="height: 6px;">&nbsp;</td></tr>

  <!-- Sub-header Details -->
  <tr>
    <td colspan="${showWorkTitle && workTitle ? (showPrices ? 5 : 4) : colSpanCount}" class="no-border" style="font-size: 11pt; padding: 4px 0;"><b>Firma / Müşteri:</b> ${companyName}</td>
    ${showWorkTitle && workTitle ? `<td colspan="${showPrices ? 4 : 3}" class="no-border text-right" style="font-size: 11pt; padding: 4px 0;"><b>İş Tanımı:</b> ${workTitle}</td>` : ''}
  </tr>

  <!-- Spacer Row before vehicle tables -->
  <tr style="height: 12px;"><td colspan="${colSpanCount}" class="no-border" style="height: 12px;">&nbsp;</td></tr>
</table>
`

    groups.forEach((group, gIdx) => {
        const machineTitle = (group.rawMachineName || group.machineName || 'Belirtilmemiş').toUpperCase()

        html += `
<!-- Vehicle Table & Summary Block -->
<table style="border-collapse: collapse; width: 100%; margin-bottom: 10px;">
  <!-- Vehicle Header Title Row -->
  <tr>
    <td colspan="${colSpanCount}" class="no-border bold" style="border-bottom: 1.5pt solid #475569 !important; font-size: 12pt; padding: 8px 4px 6px 4px; color: #0f172a;">
      ${machineTitle} DETAYLARI
    </td>
  </tr>

  <!-- Table Column Headers -->
  <thead>
    <tr>
      <th style="width: 10%;">TARİH</th>
      <th style="width: 10%;">FİŞ NO</th>
      <th style="width: 10%;">BAŞLAMA</th>
      <th style="width: 10%;">BİTİŞ</th>
      <th style="width: 11%;">SÜRE / ADET</th>
      <th style="width: 11%;">FAZLA MESAİ</th>
      <th style="width: 13%;">MAKİNA</th>
      <th style="width: ${showPrices ? '15%' : '25%'};">AÇIKLAMA</th>
      ${showPrices ? '<th style="width: 10%;">FİYAT</th>' : ''}
    </tr>
  </thead>
  <tbody>
`

        const groupItems = group.items || []
        groupItems.forEach((item) => {
            const desc = item.description || ''
            const cleanDesc = desc.replace(/\[[^\]]*\]\s*/g, '').trim()
            const unitText = desc.toUpperCase().includes('[SAATLİK]') ? 'Saat' : 'Gün'

            let rowClass = ''
            if (desc.includes('[RENK:red]') || item.isPazar) rowClass = 'row-red'
            else if (desc.includes('[RENK:orange]')) rowClass = 'row-orange'
            else if (desc.includes('[RENK:blue]')) rowClass = 'row-blue'
            else if (desc.includes('[RENK:green]')) rowClass = 'row-green'
            else if (desc.includes('[RENK:purple]')) rowClass = 'row-purple'

            let priceText = ''
            if (showPrices) {
                if (item.isPazar && !desc.includes('[KATSAYI:')) {
                    const baseP = item.unit_price || item.unitPriceVal || 0
                    const dailyP = (baseP > 10000 && item.isAylik) ? baseP / 26 : baseP
                    priceText = dailyP > 0 ? formatCurrency(dailyP * pazarMultiplier) : '-'
                } else {
                    priceText = (item.unit_price || item.unitPriceVal) ? formatCurrency(item.unit_price || item.unitPriceVal) : '-'
                }
            }

            html += `
    <tr class="${rowClass}">
      <td class="text-center">${formatDate(item.date)}</td>
      <td class="text-center">${item.receipt_no || '-'}</td>
      <td class="text-center">${item.start_time || '-'}</td>
      <td class="text-center">${item.end_time || '-'}</td>
      <td class="text-center">${item.hours || 0} ${unitText}</td>
      <td class="text-center">${item.overtime_hours > 0 ? `${item.overtime_hours} Saat` : ''}</td>
      <td class="text-center">${group.rawMachineName || group.machineName}</td>
      <td class="text-left">${cleanDesc}</td>
      ${showPrices ? `<td class="text-right bold">${priceText}</td>` : ''}
    </tr>
`
        })

        html += `
  </tbody>

  <!-- 1. BLANK ROW SPACING BETWEEN DATA TABLE AND VEHICLE SUMMARY -->
  <tr style="height: 14px;">
    <td colspan="${colSpanCount}" class="no-border" style="height: 14px;">&nbsp;</td>
  </tr>

  <!-- 2. VEHICLE SUMMARY HEADER ROW (Clean right-aligned with sharp borders) -->
  <tr>
    <td colspan="${showPrices ? 5 : 4}" class="no-border">&nbsp;</td>
    <td colspan="4" class="bold text-center" style="border: 0.5pt solid #64748b; background-color: #f1f5f9; font-size: 10.5pt; padding: 5px; color: #000000;">
      ${machineTitle} ÖZETİ
    </td>
  </tr>
`

        const summaryLines = group.summaryLines || []
        summaryLines.forEach((line) => {
            html += `
  <tr>
    <td colspan="${showPrices ? 5 : 4}" class="no-border">&nbsp;</td>
    <td class="bold text-center" style="border: 0.5pt solid #cbd5e1; background-color: #f8fafc; font-size: 10pt;">${line.typeLabel}</td>
    <td class="text-center" style="border: 0.5pt solid #cbd5e1; font-size: 10pt;">${line.countText || `${line.count} ${line.unit}`}</td>
    <td class="text-right" style="border: 0.5pt solid #cbd5e1; font-size: 10pt;">${line.unitPrice ? formatCurrency(line.unitPrice) : '-'}</td>
    <td class="text-right bold total-text" style="border: 0.5pt solid #cbd5e1; font-size: 10pt;">${formatCurrency(line.totalPrice)}</td>
  </tr>
`
        })

        html += `
  <!-- VEHICLE SUMMARY TOTAL ROW -->
  <tr>
    <td colspan="${showPrices ? 5 : 4}" class="no-border">&nbsp;</td>
    <td colspan="3" class="bold text-right" style="border: 0.5pt solid #64748b; background-color: #f8fafc; color: #333333; font-size: 10pt; padding: 6px 12px;">ARAÇ TOPLAMI</td>
    <td class="text-right bold total-text" style="border: 0.5pt solid #64748b; background-color: #f1f5f9; color: #000000; font-size: 11pt; padding: 6px 12px;">${formatCurrency(group.calculatedGrandTotal)}</td>
  </tr>

  <!-- 3. BLANK ROW SPACING AFTER VEHICLE BLOCK -->
  <tr style="height: 18px;">
    <td colspan="${colSpanCount}" class="no-border" style="height: 18px;">&nbsp;</td>
  </tr>
</table>
`
    })

    if (showPrices) {
        let grandTotalWithKdv = grandTotal
        let kdvAmount = 0
        if (showKdv) {
            kdvAmount = (grandTotal * (Number(kdvRate) || 20)) / 100
            grandTotalWithKdv = grandTotal + kdvAmount
        }

        html += `
<!-- GENERAL GRAND TOTAL SUMMARY (RIGHT-ALIGNED WITH REAL BLANK SPACING) -->
<table style="border-collapse: collapse; width: 100%; margin-top: 10px;">
  <!-- Blank Row before Grand Total -->
  <tr style="height: 10px;">
    <td colspan="${colSpanCount}" class="no-border" style="height: 10px;">&nbsp;</td>
  </tr>

  <tr>
    <td colspan="${showPrices ? 5 : 4}" class="no-border">&nbsp;</td>
    <td colspan="3" class="bold text-right" style="border: 0.5pt solid #64748b; background-color: #f8fafc; font-size: 10.5pt; padding: 8px 12px;">GENEL TOPLAM</td>
    <td class="text-right bold total-text" style="border: 0.5pt solid #64748b; background-color: #f1f5f9; font-size: 11.5pt; padding: 8px 12px; color: #000000;">${formatCurrency(grandTotal)}${showKdv ? '' : ' + KDV'}</td>
  </tr>
  ${showKdv ? `
  <tr>
    <td colspan="${showPrices ? 5 : 4}" class="no-border">&nbsp;</td>
    <td colspan="3" class="bold text-right" style="border: 0.5pt solid #64748b; background-color: #f8fafc; font-size: 10pt; padding: 7px 12px;">KDV (%${kdvRate})</td>
    <td class="text-right bold total-text" style="border: 0.5pt solid #64748b; background-color: #f1f5f9; font-size: 11pt; padding: 7px 12px; color: #000000;">${formatCurrency(kdvAmount)}</td>
  </tr>
  <tr>
    <td colspan="${showPrices ? 5 : 4}" class="no-border">&nbsp;</td>
    <td colspan="3" class="bold text-right" style="border: 1pt solid #cbd5e1; background-color: #e2e8f0; font-size: 11pt; padding: 8px 12px;">TOPLAM (KDV DAHİL)</td>
    <td class="text-right bold total-text" style="border: 1pt solid #cbd5e1; background-color: #cbd5e1; font-size: 12pt; padding: 8px 12px; color: #000000;">${formatCurrency(grandTotalWithKdv)}</td>
  </tr>
  ` : ''}
</table>
`
    }

    if (work?.description && work.description.trim() !== '') {
        html += `
<!-- Notes Section -->
<table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
  <tr style="height: 10px;"><td colspan="${colSpanCount}" class="no-border" style="height: 10px;">&nbsp;</td></tr>
  <tr>
    <td colspan="${colSpanCount}" style="border: 0.5pt solid #cbd5e1; background-color: #f8fafc; font-size: 10pt; padding: 8px 12px; color: #334155;">
      <b>NOT:</b> ${work.description.trim()}
    </td>
  </tr>
</table>
`
    }

    html += `
</body>
</html>
`

    const fileName = generateUniqueFileName('Puantaj', [companyName, workTitle], 'xls')

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}
