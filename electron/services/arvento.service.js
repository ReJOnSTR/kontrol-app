const path = require('path')
const fs = require('fs')
let app = null;
try {
    const electron = require('electron');
    if (electron && electron.app) app = electron.app;
} catch(e) {}

const { getPrismaClient } = require('../prismaClient')
const log = require('../logger')

const settingsPath = (app && typeof app.getPath === 'function')
    ? path.join(app.getPath('userData'), 'settings.json')
    : path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'settings.json')

async function getArventoCredentials(companyId = null) {
    // 1. Check company_settings from PostgreSQL / DB first
    try {
        const prisma = getPrismaClient()
        if (prisma && prisma.company_settings) {
            let row = null
            if (companyId) {
                row = await prisma.company_settings.findUnique({
                    where: { company_id: parseInt(companyId, 10) }
                })
            } else {
                row = await prisma.company_settings.findFirst()
            }
            if (row && row.settings_json) {
                const parsed = typeof row.settings_json === 'string' ? JSON.parse(row.settings_json) : row.settings_json
                const arvento = parsed?.integrations?.arvento
                if (arvento && (arvento.username || arvento.pin1)) {
                    return {
                        username: arvento.username || '',
                        pin1: arvento.pin1 || '',
                        pin2: arvento.pin2 || '',
                        language: arvento.language || 'tr',
                        enabled: !!arvento.enabled
                    }
                }
            }
        }
    } catch (dbErr) {
        // Fallback to disk file if DB fails
    }

    // 2. Fallback to settings.json on disk
    try {
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
            if (settings && settings.arvento) {
                return {
                    username: settings.arvento.username || '',
                    pin1: settings.arvento.pin1 || '',
                    pin2: settings.arvento.pin2 || '',
                    language: settings.arvento.language || 'tr',
                    enabled: !!settings.arvento.enabled
                }
            }
        }
    } catch (error) {
        console.error('Error loading Arvento credentials from file:', error)
    }
    return { username: '', pin1: '', pin2: '', language: 'tr', enabled: false }
}

function escapeXml(unsafe) {
    if (unsafe === undefined || unsafe === null) return ''
    return String(unsafe).replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;'
            case '>': return '&gt;'
            case '&': return '&amp;'
            case '\'': return '&apos;'
            case '"': return '&quot;'
            default: return c
        }
    })
}

function decodeXml(str) {
    if (!str) return ''
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
}

function extractResult(xml, methodName) {
    const tagName = `${methodName}Result`
    const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`)
    const match = xml.match(regex)
    if (!match) {
        // Fallback search with ignoring namespace prefix if any (e.g. <a:GetVehicleStatusJSONResult>)
        const namespaceRegex = new RegExp(`<[a-zA-Z0-9:]*${methodName}Result>([\\s\\S]*?)<\\/[a-zA-Z0-9:]*${methodName}Result>`)
        const namespaceMatch = xml.match(namespaceRegex)
        if (!namespaceMatch) {
            throw new Error(`XML element ${tagName} not found in response`)
        }
        return decodeXml(namespaceMatch[1])
    }
    return decodeXml(match[1])
}

function parseXmlTable(xml) {
    // Matches <Table> ... </Table> or similar rows
    const tableRegex = /<(Table|TableRow|Vehicle|Record|Mapping|tblPlaka|General_x0020_Report)[\s>][\s\S]*?<\/\1>/g
    const matches = xml.match(tableRegex)
    if (!matches) {
        // Try finding direct children inside a list tag
        const listMatch = xml.match(/<[^>]+List>([\s\S]*?)<\/[^>]+List>/)
        if (listMatch) {
            const childRegex = /<([^>]+)>([\s\S]*?)<\/\1>/g
            const listItems = []
            let m
            while ((m = childRegex.exec(listMatch[1])) !== null) {
                listItems.push(m[2])
            }
            if (listItems.length > 0) {
                return listItems.map(itemXml => {
                    const fields = {}
                    const fieldRegex = /<([a-zA-Z0-9_:-]+)>([\s\S]*?)<\/\1>/g
                    let fm
                    while ((fm = fieldRegex.exec(itemXml)) !== null) {
                        const key = fm[1]
                            .replace(/_x0020_/g, ' ')
                            .replace(/_x0028_/g, '(')
                            .replace(/_x0029_/g, ')')
                            .replace(/_x002F_/g, '/')
                        fields[key] = decodeXml(fm[2])
                    }
                    return fields
                })
            }
        }
        return []
    }

    return matches.map(rowXml => {
        const fields = {}
        const fieldRegex = /<([a-zA-Z0-9_:-]+)>([\s\S]*?)<\/\1>/g
        let match
        while ((match = fieldRegex.exec(rowXml)) !== null) {
            const key = match[1]
                .replace(/_x0020_/g, ' ')
                .replace(/_x0028_/g, '(')
                .replace(/_x0029_/g, ')')
                .replace(/_x002F_/g, '/')
            const val = decodeXml(match[2])
            fields[key] = val
        }
        return fields
    })
}

async function makeArventoRequest(methodName, params = {}, credentialsOverride = null) {
    const creds = credentialsOverride || await getArventoCredentials()
    const username = creds.username
    const pin1 = creds.pin1
    const pin2 = creds.pin2
    const rawLanguage = creds.language || 'tr'
    // Convert 'tr' to 86, else default to 0 for English, as ASMX reports require integer Language parameter
    const language = (rawLanguage === 'tr' || rawLanguage === 'TR') ? 86 : 0

    let methodParamsXml = `
      <Username>${escapeXml(username)}</Username>
      <PIN1>${escapeXml(pin1)}</PIN1>
      <PIN2>${escapeXml(pin2)}</PIN2>
      <Language>${language}</Language>
    `

    for (const [key, value] of Object.entries(params)) {
        if (key !== 'Username' && key !== 'PIN1' && key !== 'PIN2' && key !== 'Language') {
            methodParamsXml += `<${key}>${escapeXml(value)}</${key}>\n`
        }
    }

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${methodName} xmlns="http://www.arvento.com/">
      ${methodParamsXml}
    </${methodName}>
  </soap:Body>
</soap:Envelope>`

    const url = 'https://ws.arvento.com/v1/report.asmx'
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': `http://www.arvento.com/${methodName}`
        },
        body: soapEnvelope
    })

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }

    const xmlText = await response.text()
    return xmlText
}

async function getArventoData(methodName, params = {}, isJsonExplicit = null, credentialsOverride = null) {
    try {
        const xml = await makeArventoRequest(methodName, params, credentialsOverride)
        
        // Robust check for JSON inside the raw response (even if wrapped or prepended like Arvento does)
        let parsedJson = null
        const firstBracket = xml.indexOf('[')
        const lastBracket = xml.lastIndexOf(']')
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
            const potentialJson = xml.substring(firstBracket, lastBracket + 1)
            try {
                parsedJson = JSON.parse(potentialJson)
            } catch (e) {}
        }
        
        if (!parsedJson) {
            const firstBrace = xml.indexOf('{')
            const lastBrace = xml.lastIndexOf('}')
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const potentialJson = xml.substring(firstBrace, lastBrace + 1)
                try {
                    parsedJson = JSON.parse(potentialJson)
                } catch (e) {}
            }
        }
        
        if (parsedJson) {
            return { success: true, data: parsedJson }
        }

        // Check for specific error tag in XML or standard SOAP faults
        const errorMatch = xml.match(/<Error[^>]*>([^<]+)<\/Error>/) || xml.match(/<faultstring>([^<]+)<\/faultstring>/)
        if (errorMatch) {
            return { success: false, error: errorMatch[1] }
        }

        // If JSON was expected but not found/parsed
        if (isJsonExplicit) {
            return { success: false, error: 'Geçersiz kimlik bilgileri veya sunucu hatası (Boş yanıt)' }
        }

        // Fallback to XML table parsing
        let resultText
        try {
            resultText = extractResult(xml, methodName)
        } catch (e) {
            const data = parseXmlTable(xml)
            return { success: true, data }
        }

        const data = parseXmlTable(resultText)
        if (data.length === 0) {
            if (resultText && (resultText.includes('<xs:schema') || resultText.includes('<diffgr:diffgram'))) {
                return { success: true, data: [] }
            }
            return { success: true, data: resultText.trim() }
        }
        return { success: true, data }
    } catch (error) {
        console.error(`Arvento error in ${methodName}:`, error)
        return { success: false, error: error ? (error.message || String(error)) : 'Unknown error' }
    }
}

// Service Methods
async function testArventoConnection(credentials) {
    // Attempting GetVehicleStatusJSON is the best way to verify connection and credentials
    return await getArventoData('GetVehicleStatusJSON', {}, true, credentials)
}

async function getArventoVehicleStatus(credentialsOverride = null) {
    const result = await getArventoData('GetVehicleStatusJSON', {}, true, credentialsOverride)
    return result
}

function parseLocalDateTime(dateStr) {
    if (!dateStr) return new Date()
    if (dateStr.includes('-') || dateStr.includes(':')) {
        return new Date(dateStr)
    }
    if (dateStr.length < 14) return new Date()
    const yyyy = parseInt(dateStr.substring(0, 4))
    const mm = parseInt(dateStr.substring(4, 6))
    const dd = parseInt(dateStr.substring(6, 8))
    const hh = parseInt(dateStr.substring(8, 10))
    const min = parseInt(dateStr.substring(10, 12))
    const ss = parseInt(dateStr.substring(12, 14))
    return new Date(yyyy, mm - 1, dd, hh, min, ss)
}

function formatDateForArvento(val) {
    if (!val) return ''
    
    // If it's already a Date object
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return ''
        const yyyy = val.getFullYear()
        const mm = String(val.getMonth() + 1).padStart(2, '0')
        const dd = String(val.getDate()).padStart(2, '0')
        const hh = String(val.getHours()).padStart(2, '0')
        const min = String(val.getMinutes()).padStart(2, '0')
        const ss = String(val.getSeconds()).padStart(2, '0')
        return `${yyyy}${mm}${dd}${hh}${min}${ss}`
    }
    
    const str = String(val).trim()
    
    // 1. If it's already 14 digits (YYYYMMDDHHmmss)
    if (/^\d{14}$/.test(str)) {
        return str
    }
    
    // 2. If it's 8 digits (YYYYMMDD), append 000000
    if (/^\d{8}$/.test(str)) {
        return str + '000000'
    }
    
    // 3. Simple date formats: YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (ymdMatch) {
        return `${ymdMatch[1]}${ymdMatch[2]}${ymdMatch[3]}000000`
    }
    
    // 4. Simple date formats: DD.MM.YYYY
    const dmyDotMatch = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (dmyDotMatch) {
        return `${dmyDotMatch[3]}${dmyDotMatch[2]}${dmyDotMatch[1]}000000`
    }
    
    // 5. Simple date formats: DD/MM/YYYY
    const dmySlashMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (dmySlashMatch) {
        return `${dmySlashMatch[3]}${dmySlashMatch[2]}${dmySlashMatch[1]}000000`
    }
    
    // Fallback: parse as date and format
    const d = new Date(str)
    if (isNaN(d.getTime())) {
        // If parsing failed, remove all non-digits and see if it's 14 digits
        const clean = str.replace(/\D/g, '')
        if (clean.length === 14) return clean
        if (clean.length === 8) return clean + '000000'
        return str // return original if we can't do anything
    }
    
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${yyyy}${mm}${dd}${hh}${min}${ss}`
}

async function getArventoHistory(filters) {
    try {
        const { plate, plates, startDate, endDate } = filters
        log.info('[getArventoHistory] Fetching directly from Arvento GeneralReport API with filters:', filters)

        // 1. Get plate mappings
        const mappingsRes = await getArventoLicensePlateNodeMappings()
        const mappings = mappingsRes.success && Array.isArray(mappingsRes.data) ? mappingsRes.data : []

        // 2. Normalize and resolve selected plates to Node IDs
        const targetPlates = (plates || (plate ? [plate] : [])).map(p => p.replace(/[\s-]+/g, '').toUpperCase())
        
        const resolvedVehicles = targetPlates.map(tp => {
            const mapping = mappings.find(m => {
                const normMappingPlate = m['License Plate'] ? m['License Plate'].split(/\s+-/)[0].replace(/[\s-]+/g, '').toUpperCase() : ''
                return normMappingPlate === tp
            })
            return {
                plateClean: tp,
                deviceNo: mapping ? mapping['Device No'] : null
            }
        }).filter(r => r.deviceNo !== null)

        if (resolvedVehicles.length === 0) {
            log.info('[getArventoHistory] No matching vehicles mapped to Arvento Device Nos.')
            return { success: true, data: [] }
        }

        // 3. Query GeneralReport for each resolved vehicle in parallel
        const promises = resolvedVehicles.map(async (veh) => {
            log.info(`[getArventoHistory] Requesting GeneralReport for plate ${veh.plateClean} (Device: ${veh.deviceNo})`)
            const params = {
                Node: veh.deviceNo,
                StartDate: formatDateForArvento(startDate),
                EndDate: formatDateForArvento(endDate),
                chkLocation: "1",
                chkSpeed: "1",
                chkPause: "1",
                chkMotion: "1",
                chkContactAlarm: "1"
            }

            const points = []
            try {
                const reportResult = await getArventoData('GeneralReport', params, false)
                if (reportResult.success && Array.isArray(reportResult.data)) {
                    log.info(`[getArventoHistory] Successfully fetched ${reportResult.data.length} records for ${veh.plateClean}`)
                    reportResult.data.forEach(item => {
                        const latStr = (item.Latitude || item.LatitudeY || item.lat || '0').replace(',', '.')
                        const lat = parseFloat(latStr)
                        
                        const lngStr = (item.Longitude || item.LongitudeX || item.lng || '0').replace(',', '.')
                        const lng = parseFloat(lngStr)
                        
                        const rawSpeed = item['Speed km/h'] || item.Speed || item.speed || 0
                        const speed = parseInt(rawSpeed)
                        
                        const heading = parseInt(item.Course || item.Heading || 0)
                        const ignition = (
                            item.Ignition === true || 
                            item.Ignition === '1' || 
                            item.Ignition === 1 || 
                            speed > 0 || 
                            item['Ignition On Duration'] !== undefined ||
                            item['Idling Duration'] !== undefined
                        ) ? 1 : 0
                        
                        const gpsDateStr = item['Date/Time'] || item.LocalDateTime || item.GPSDate || item.Date || item.DateTime
                        if (lat && lng && gpsDateStr) {
                            const parsedDate = parseLocalDateTime(gpsDateStr)
                            const gpsDateISO = isNaN(parsedDate.getTime()) ? gpsDateStr : parsedDate.toISOString()
                            
                            points.push({
                                plate: veh.plateClean,
                                lat,
                                lng,
                                speed,
                                ignition,
                                heading,
                                gps_date: gpsDateISO
                            })
                        }
                    })
                } else {
                    const errDetail = reportResult.success ? 'No records returned from API' : (reportResult.error || 'Unknown error')
                    log.error(`[getArventoHistory] GeneralReport request failed or empty for device ${veh.deviceNo}:`, errDetail)
                }
            } catch (err) {
                log.error(`[getArventoHistory] GeneralReport call crashed for device ${veh.deviceNo}:`, err)
            }
            return points
        })

        const results = await Promise.all(promises)
        const allPoints = results.flat()

        log.info(`[getArventoHistory] Total compiled historical points: ${allPoints.length}`)
        return { success: true, data: allPoints }
    } catch (error) {
        log.error('[getArventoHistory] Error fetching Arvento history:', error)
        return { success: false, error: error.message }
    }
}

async function getArventoLicensePlateNodeMappings(credentialsOverride = null) {
    return await getArventoData('GetLicensePlateNodeMappings', {}, false, credentialsOverride)
}

async function getArventoVehicleInfo(credentialsOverride = null) {
    return await getArventoData('GetVehicleInfo', {}, false, credentialsOverride)
}

function getTurkeyTodayString() {
    const utcDate = new Date()
    const tzOffset = 3 * 60 // Turkey is GMT+3
    const turkeyDate = new Date(utcDate.getTime() + tzOffset * 60 * 1000)
    return turkeyDate.toISOString().split('T')[0]
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371 // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

async function getArventoVehicleDailyStatus(date, credentialsOverride = null) {
    let dateStr = date
    if (!dateStr) {
        dateStr = getTurkeyTodayString()
    } else if (dateStr instanceof Date) {
        dateStr = dateStr.toISOString().split('T')[0]
    }
    
    try {
        const mappingsRes = await getArventoLicensePlateNodeMappings(credentialsOverride)
        if (!mappingsRes.success || !Array.isArray(mappingsRes.data)) {
            return { success: false, error: 'Araç eşleştirmeleri alınamadı.' }
        }
        
        const mappings = mappingsRes.data
        const cleanDateStr = dateStr.replace(/[^0-9]/g, '')
        const startDate = cleanDateStr + '000000'
        const endDate = cleanDateStr + '235959'
        
        const promises = mappings.map(async (mapping) => {
            const deviceNo = mapping['Device No']
            const plateFull = mapping['License Plate']
            if (!deviceNo) return null
            
            try {
                const params = {
                    Node: deviceNo,
                    StartDate: startDate,
                    EndDate: endDate,
                    chkLocation: "1",
                    chkSpeed: "1",
                    chkPause: "1",
                    chkMotion: "1",
                    chkContactAlarm: "1"
                }
                const reportResult = await getArventoData('GeneralReport', params, false, credentialsOverride)
                if (reportResult.success && Array.isArray(reportResult.data) && reportResult.data.length > 0) {
                    const sortedRecords = reportResult.data
                        .map(item => {
                            const latStr = (item.Latitude || item.LatitudeY || '0').replace(',', '.')
                            const lat = parseFloat(latStr)
                            const lngStr = (item.Longitude || item.LongitudeX || '0').replace(',', '.')
                            const lng = parseFloat(lngStr)
                            const speed = parseInt(item['Speed km/h'] || item.Speed || 0)
                            const recordNo = parseInt(item['Record No'] || 0)
                            const timeStr = item['Date/Time'] || ''
                            const segmentDistanceStr = (item.Distance || item['Distance km'] || '0').replace(',', '.')
                            const segmentDistance = parseFloat(segmentDistanceStr)
                            return { lat, lng, speed, recordNo, timeStr, segmentDistance }
                        })
                        .filter(item => item.lat && item.lng)
                        .sort((a, b) => a.recordNo - b.recordNo || new Date(a.timeStr) - new Date(b.timeStr))
                    
                    let dailyTrip = 0
                    const hasDirectDistance = reportResult.data.some(item => item.Distance !== undefined)
                    
                    if (hasDirectDistance) {
                        sortedRecords.forEach(r => {
                            dailyTrip += r.segmentDistance
                        })
                    } else {
                        for (let i = 1; i < sortedRecords.length; i++) {
                            const p1 = sortedRecords[i - 1]
                            const p2 = sortedRecords[i]
                            const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng)
                            if (dist < 2.0) { // filter out GPS jumps
                                if (dist > 0.02 || p2.speed > 0 || p1.speed > 0) {
                                    dailyTrip += dist
                                }
                            }
                        }
                    }
                    
                    let maxSpeed = 0
                    sortedRecords.forEach(r => {
                        if (r.speed > maxSpeed) maxSpeed = r.speed
                    })
                    
                    const lastRecord = sortedRecords[sortedRecords.length - 1]
                    
                    return {
                        licensePlate: plateFull,
                        DailyTrip: dailyTrip,
                        Speed: maxSpeed,
                        LatitudeY: lastRecord ? lastRecord.lat : 0,
                        LongitudeX: lastRecord ? lastRecord.lng : 0
                    }
                }
            } catch (err) {
                log.error(`[getArventoVehicleDailyStatus] Error calculating daily status for device ${deviceNo}:`, err)
            }
            
            return {
                licensePlate: plateFull,
                DailyTrip: 0,
                Speed: 0,
                LatitudeY: 0,
                LongitudeX: 0
            }
        })
        
        const results = await Promise.all(promises)
        const filteredResults = results.filter(r => r !== null)
        
        return { success: true, data: filteredResults }
    } catch (error) {
        log.error('[getArventoVehicleDailyStatus] Error in daily status:', error)
        return { success: false, error: error.message }
    }
}

async function getArventoAlarms(credentialsOverride = null) {
    return await getArventoData('GetVehicleAlarmStatusJson', {}, true, credentialsOverride)
}

module.exports = {
    testArventoConnection,
    getArventoVehicleStatus,
    getArventoLicensePlateNodeMappings,
    getArventoVehicleInfo,
    getArventoVehicleDailyStatus,
    getArventoAlarms,
    getArventoHistory
}
