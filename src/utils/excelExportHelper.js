import ExcelJS from 'exceljs'

/**
 * Safely generates and triggers browser download of an .xlsx workbook using ExcelJS.
 * @param {Array<{ name: string, headers: string[], rows: Array<Array<any>> }>} sheets
 * @param {string} fileName
 */
export async function downloadWorkbookAsXlsx(sheets, fileName) {
    const wb = new ExcelJS.Workbook()

    for (const sheet of sheets) {
        const rows = sheet?.rows || []
        const headers = sheet?.headers || []
        if (!headers.length && !rows.length) continue

        // Excel sheet names have a 31-char limit and cannot contain : \ / ? * [ ]
        const safeName = String(sheet.name || 'Liste')
            .replace(/[:\\/?*[\]]/g, '_')
            .slice(0, 31) || 'Liste'

        const ws = wb.addWorksheet(safeName)
        if (headers.length > 0) {
            const headerRow = ws.addRow(headers)
            headerRow.font = { bold: true }
        }
        for (const row of rows) {
            ws.addRow(row)
        }
    }

    if (wb.worksheets.length === 0) {
        wb.addWorksheet('Liste')
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = String(fileName || 'export.xlsx').endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

