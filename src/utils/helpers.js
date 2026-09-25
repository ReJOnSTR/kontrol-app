// Date formatting helpers
export function formatDate(dateString) {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    })
}

export function formatShortDate(dateString) {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    })
}

export function formatDateTime(dateString) {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })
}

export function today() {
    return new Date().toISOString().split('T')[0]
}

export function safeSetLocalStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn(`[localStorage] setItem('${key}') failed, clearing print caches...`, e);
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('print') || k.startsWith('workPdf') || k.includes('_cols') || k.includes('_sort') || k.includes('_filters'))) {
                    localStorage.removeItem(k);
                }
            }
            localStorage.setItem(key, value);
        } catch (retryErr) {
            console.error(`[localStorage] Retry failed for ${key}`, retryErr);
        }
    }
}

export function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY'
    }).format(amount)
}

export function getDaysUntil(dateString) {
    if (!dateString) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(dateString)
    targetDate.setHours(0, 0, 0, 0)
    const diffTime = targetDate - today
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function getDaysUntilText(dateString) {
    const days = getDaysUntil(dateString)
    if (days === null) return '-'
    if (days < 0) return `${Math.abs(days)} gün geçti`
    if (days === 0) return 'Bugün'
    if (days === 1) return 'Yarın'
    return `${days} gün kaldı`
}

export function getStatusColor(daysOrDate) {
    if (daysOrDate === null || daysOrDate === undefined) return 'neutral'
    const days = typeof daysOrDate === 'number' ? Math.ceil(daysOrDate) : getDaysUntil(daysOrDate)
    if (days === null) return 'neutral'
    if (days < 0) return 'danger'           // Gecikmiş (< 0) - Kırmızı
    if (days === 0) return 'today'          // Bugün (= 0) - Turuncu
    if (days <= 3) return 'danger-light'    // Acil (1-3 gün) - Açık Kırmızı / Sarı
    if (days <= 30) return 'upcoming'       // Yaklaşan (4-30 gün) - Teal / Turkuaz
    return 'success'                        // Güncel (> 30 gün) - Yeşil
}

export function getNotificationBadgeProps(daysOrDate) {
    if (daysOrDate === null || daysOrDate === undefined) {
        return { text: '-', label: '-', color: 'var(--text-muted)', bg: 'var(--bg-tertiary)', border: 'var(--border-color)', badgeClass: 'badge-neutral' }
    }
    const days = typeof daysOrDate === 'number' ? Math.ceil(daysOrDate) : getDaysUntil(daysOrDate)
    if (days === null) {
        return { text: '-', label: '-', color: 'var(--text-muted)', bg: 'var(--bg-tertiary)', border: 'var(--border-color)', badgeClass: 'badge-neutral' }
    }
    if (days < 0) {
        return {
            days,
            text: `${Math.abs(days)} gün geçti`,
            label: 'GECİKTİ',
            color: '#f87171',
            bg: 'rgba(239, 68, 68, 0.15)',
            border: 'rgba(239, 68, 68, 0.3)',
            badgeClass: 'badge-danger'
        }
    }
    if (days === 0) {
        return {
            days,
            text: 'Bugün',
            label: 'BUGÜN',
            color: '#fb923c',
            bg: 'rgba(249, 115, 22, 0.15)',
            border: 'rgba(249, 115, 22, 0.3)',
            badgeClass: 'badge-today'
        }
    }
    if (days <= 3) {
        return {
            days,
            text: `${days} gün kaldı`,
            label: `${days} Gün Kaldı (Acil)`,
            color: '#facc15',
            bg: 'rgba(234, 179, 8, 0.15)',
            border: 'rgba(234, 179, 8, 0.3)',
            badgeClass: 'badge-danger-light'
        }
    }
    if (days <= 30) {
        return {
            days,
            text: `${days} gün kaldı`,
            label: `${days} Gün Kaldı`,
            color: '#14b8a6',
            bg: 'rgba(20, 184, 166, 0.15)',
            border: 'rgba(20, 184, 166, 0.3)',
            badgeClass: 'badge-upcoming'
        }
    }
    return {
        days,
        text: `${days} gün kaldı`,
        label: 'Güncel',
        color: '#34d399',
        bg: 'rgba(16, 185, 129, 0.08)',
        border: 'rgba(16, 185, 129, 0.2)',
        badgeClass: 'badge-success'
    }
}

export const vehicleTypes = [
    { value: 'automobile', label: 'Otomobil' },
    { value: 'crane', label: 'Vinç' },
    { value: 'truck', label: 'Kamyon' },
    { value: 'van', label: 'Minibüs' },
    { value: 'pickup', label: 'Pikap' },
    { value: 'forklift', label: 'Forklift' },
    { value: 'excavator', label: 'Ekskavatör' },
    { value: 'other', label: 'Diğer' }
]

export const vehicleStatuses = [
    { value: 'active', label: 'Aktif', color: 'success' },
    { value: 'maintenance', label: 'Bakımda', color: 'warning' },
    { value: 'inactive', label: 'Pasif', color: 'neutral' },
    { value: 'sold', label: 'Satıldı', color: 'danger' }
]

export const maintenanceTypes = [
    { value: 'oil', label: 'Yağ Değişimi' },
    { value: 'filter', label: 'Filtre Değişimi' },
    { value: 'brake', label: 'Fren Bakımı' },
    { value: 'tire', label: 'Lastik Değişimi' },
    { value: 'battery', label: 'Akü Değişimi' },
    { value: 'general', label: 'Genel Bakım' },
    { value: 'repair', label: 'Onarım' },
    { value: 'other', label: 'Diğer' }
]

export const insuranceTypes = [
    { value: 'kasko', label: 'Kasko' },
    { value: 'traffic', label: 'Trafik Sigortası' },
    { value: 'full', label: 'Tam Paket' },
    { value: 'other', label: 'Diğer' }
]

export const serviceTypes = [
    { value: 'maintenance', label: 'Periyodik Bakım' },
    { value: 'repair', label: 'Mekanik Tamir' },
    { value: 'tire', label: 'Lastik İşlemleri' },
    { value: 'body', label: 'Kaporta/Boya' },
    { value: 'electrical', label: 'Elektrik/Elektronik' },
    { value: 'glass', label: 'Cam Değişimi' },
    { value: 'ac', label: 'Klima Bakımı' },
    { value: 'other', label: 'Diğer' }
]

export function getVehicleTypeLabel(type) {
    return vehicleTypes.find(t => t.value === type)?.label || type
}

export function getVehicleStatusInfo(status) {
    return vehicleStatuses.find(s => s.value === status) || { label: status, color: 'neutral' }
}

export function getMaintenanceTypeLabel(type) {
    return maintenanceTypes.find(t => t.value === type)?.label || type
}

export function getInsuranceTypeLabel(type) {
    return insuranceTypes.find(t => t.value === type)?.label || type
}

export const workStatuses = [
    { value: 'pending', label: 'Bekliyor', color: 'neutral' },
    { value: 'in_progress', label: 'Devam Ediyor', color: 'warning' },
    { value: 'completed', label: 'Tamamlandı', color: 'info' },
    { value: 'paid', label: 'Ödendi / Tahsil Edildi', color: 'success' },
    { value: 'cancelled', label: 'İptal Edildi', color: 'danger' }
]

export function getWorkStatusLabel(status) {
    return workStatuses.find(s => s.value === status)?.label || status
}

export function getWorkStatusColor(status) {
    return workStatuses.find(s => s.value === status)?.color || 'neutral'
}

export const employeeStatuses = [
    { value: 'active', label: 'Aktif', color: 'success' },
    { value: 'inactive', label: 'Pasif', color: 'neutral' },
    { value: 'on_leave', label: 'İzinde', color: 'warning' },
    { value: 'dismissed', label: 'İşten Ayrıldı', color: 'danger' }
]

export function getEmployeeStatusInfo(status) {
    return employeeStatuses.find(s => s.value === status) || { label: status, color: 'neutral' }
}

export const leaveStatuses = [
    { value: 'pending', label: 'Bekliyor', color: 'warning' },
    { value: 'approved', label: 'Onaylandı', color: 'success' },
    { value: 'rejected', label: 'Reddedildi', color: 'danger' },
    { value: 'cancelled', label: 'İptal Edildi', color: 'neutral' }
]

export function getLeaveStatusInfo(status) {
    return leaveStatuses.find(s => s.value === status) || { label: status, color: 'neutral' }
}

/**
 * Calculates the active base salary for a given month by evaluating the employee_salary_history timeline.
 * @param {Object} employee - Employee object containing `salary` and `employee_salary_history`
 * @param {String} targetMonth - The target month string (e.g. "2026-04" or "2026-04-15")
 * @returns {Number} Active base salary
 */
export function getHistoricalBaseSalary(employee, targetMonth) {
    if (!employee) return 0
    
    let baseSalary = 0
    // If no history exists, fallback to standard salary field
    if (!employee.employee_salary_history || employee.employee_salary_history.length === 0) {
        baseSalary = employee.salary || 0
    } else {
        const targetStr = typeof targetMonth === 'string' ? targetMonth.slice(0, 7) : new Date(targetMonth).toISOString().slice(0, 7)
        const parts = targetStr.split('-')
        const tYear = parseInt(parts[0], 10)
        const tMonth = parseInt(parts[1], 10)
        
        const startOfMonth = new Date(tYear, tMonth - 1, 1, 0, 0, 0)
        const endOfMonth = new Date(tYear, tMonth, 0, 23, 59, 59)

        // Sort history by start date descending to find the closest match going backwards
        const sortedHistory = [...employee.employee_salary_history].sort((a, b) => new Date(b.start_date) - new Date(a.start_date))

        let found = false
        for (const record of sortedHistory) {
            const start = new Date(record.start_date)
            const end = record.end_date ? new Date(record.end_date) : null

            if (start <= endOfMonth && (!end || end >= startOfMonth)) {
                baseSalary = record.amount || 0
                found = true
                break
            }
        }

        if (!found) {
            const earliestRecord = [...employee.employee_salary_history].sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0]
            baseSalary = earliestRecord?.amount || employee.salary || 0
        }
    }

    if (!baseSalary) return 0

    // Target Year and Month
    const targetStr = typeof targetMonth === 'string' ? targetMonth.slice(0, 7) : new Date(targetMonth).toISOString().slice(0, 7)
    const parts = targetStr.split('-')
    const tYear = parseInt(parts[0], 10)
    const tMonth = parseInt(parts[1], 10) // 1 to 12

    const parseDateComponents = (val) => {
        if (!val) return null
        const s = typeof val === 'string' ? val.split('T')[0] : new Date(val).toISOString().split('T')[0]
        const p = s.split('-')
        if (p.length !== 3) return null
        return { year: parseInt(p[0], 10), month: parseInt(p[1], 10), day: parseInt(p[2], 10) }
    }

    const startObj = parseDateComponents(employee.start_date)
    const endObj = parseDateComponents(employee.end_date)

    // Check if employee started after this target month
    if (startObj) {
        if (startObj.year > tYear || (startObj.year === tYear && startObj.month > tMonth)) {
            return 0 // Has not started yet in this month
        }
    }

    // Check if employee left before this target month
    if (endObj) {
        if (endObj.year < tYear || (endObj.year === tYear && endObj.month < tMonth)) {
            return 0 // Already left before this month
        }
    }

    // Determine start day in this month (1-based day)
    let startDay = 1
    if (startObj && startObj.year === tYear && startObj.month === tMonth) {
        startDay = startObj.day
    }

    // Determine end day in this month (30-day standard)
    let endDay = 30
    if (endObj && endObj.year === tYear && endObj.month === tMonth) {
        endDay = Math.min(endObj.day, 30)
    }

    // Full month worked under 30-day standard
    if (startDay === 1 && endDay >= 30) {
        return baseSalary
    }

    const activeDays = Math.max(0, endDay - startDay + 1)
    if (activeDays <= 0) return 0
    if (activeDays >= 30) return baseSalary

    // 30-day Turkish Labor Law standard: dailyRate = baseSalary / 30
    const dailyRate = baseSalary / 30
    return Math.round(dailyRate * activeDays * 100) / 100
}

/**
 * Calculates the UNPRORATED full monthly base salary for a given month by evaluating the employee_salary_history timeline.
 * Used for overtime rate calculations so unit rates are based on the full monthly salary, not partial month amounts.
 * @param {Object} employee - Employee object
 * @param {String} targetMonth - The target month string (e.g. "2026-04")
 * @returns {Number} Full unprorated monthly base salary
 */
export function getHistoricalFullSalary(employee, targetMonth) {
    if (!employee) return 0
    if (typeof employee === 'number') return employee
    
    let baseSalary = 0
    if (!employee.employee_salary_history || employee.employee_salary_history.length === 0) {
        baseSalary = employee.salary || 0
    } else {
        const targetStr = typeof targetMonth === 'string' ? targetMonth.slice(0, 7) : new Date(targetMonth).toISOString().slice(0, 7)
        const parts = targetStr.split('-')
        const tYear = parseInt(parts[0], 10)
        const tMonth = parseInt(parts[1], 10)
        
        const startOfMonth = new Date(tYear, tMonth - 1, 1, 0, 0, 0)
        const endOfMonth = new Date(tYear, tMonth, 0, 23, 59, 59)

        const sortedHistory = [...employee.employee_salary_history].sort((a, b) => new Date(b.start_date) - new Date(a.start_date))

        let found = false
        for (const record of sortedHistory) {
            const start = new Date(record.start_date)
            const end = record.end_date ? new Date(record.end_date) : null

            if (start <= endOfMonth && (!end || end >= startOfMonth)) {
                baseSalary = record.amount || 0
                found = true
                break
            }
        }

        if (!found) {
            const earliestRecord = [...employee.employee_salary_history].sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0]
            baseSalary = earliestRecord?.amount || employee.salary || 0
        }
    }

    return baseSalary || 0
}

/**
 * Safely formats any date-like string or object into YYYY-MM-DD for HTML date inputs.
 * @param {any} dateValue - The date to format
 * @returns {string} - YYYY-MM-DD or empty string
 */
export function formatDateForInput(dateValue) {
    if (!dateValue) return ''
    try {
        const date = new Date(dateValue)
        if (isNaN(date.getTime())) return ''
        return date.toISOString().split('T')[0]
    } catch (e) {
        console.error('Error formatting date for input:', e)
        return ''
    }
}

/**
 * Calculates leave working days by excluding weekly off days and public holidays.
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {string} endDateStr - YYYY-MM-DD
 * @param {string} offDaysStr - Comma-separated weekly off day indices (0=Sunday, 6=Saturday)
 * @param {Array<string>} publicHolidayDates - List of holiday dates (YYYY-MM-DD)
 * @returns {number} - Number of working leave days
 */
const fixedHolidaysMD = [
    '01-01', // Yılbaşı
    '04-23', // Ulusal Egemenlik ve Çocuk Bayramı
    '05-01', // Emek ve Dayanışma Günü
    '05-19', // Atatürk'ü Anma, Gençlik ve Spor Bayramı
    '07-15', // Demokrasi ve Milli Birlik Günü
    '08-30', // Zafer Bayramı
    '10-28', // Cumhuriyet Bayramı Arifesi (Yarım Gün)
    '10-29'  // Cumhuriyet Bayramı
];

const religiousHolidaysByYear = {
    2025: { ramadan: '2025-03-30', sacrifice: '2025-06-06' },
    2026: { ramadan: '2026-03-20', sacrifice: '2026-05-27' },
    2027: { ramadan: '2027-03-09', sacrifice: '2027-05-16' },
    2028: { ramadan: '2028-02-26', sacrifice: '2028-05-04' },
    2029: { ramadan: '2029-02-15', sacrifice: '2029-04-23' },
    2030: { ramadan: '2030-02-04', sacrifice: '2030-04-12' },
    2031: { ramadan: '2031-01-25', sacrifice: '2031-04-02' },
    2032: { ramadan: '2032-01-14', sacrifice: '2032-03-21' },
    2033: { ramadan: '2033-01-02', sacrifice: '2033-03-10' },
    2034: { ramadan: '2034-12-22', sacrifice: '2034-02-27' },
    2035: { ramadan: '2035-12-11', sacrifice: '2035-02-17' },
    2036: { ramadan: '2036-11-20', sacrifice: '2036-02-07' },
    2037: { ramadan: '2037-11-08', sacrifice: '2037-01-26' },
    2038: { ramadan: '2038-10-29', sacrifice: '2038-01-16' },
    2039: { ramadan: '2039-10-18', sacrifice: '2039-01-05' },
    2040: { ramadan: '2040-10-07', sacrifice: '2040-12-25' },
    2041: { ramadan: '2041-09-26', sacrifice: '2041-12-14' },
    2042: { ramadan: '2042-09-15', sacrifice: '2042-12-03' },
    2043: { ramadan: '2043-09-04', sacrifice: '2043-11-22' },
    2044: { ramadan: '2044-08-24', sacrifice: '2044-11-11' },
    2045: { ramadan: '2045-08-14', sacrifice: '2045-10-31' }
};

function getReligiousHolidays(year) {
    const dates = [];
    const config = religiousHolidaysByYear[year];
    if (!config) return dates;

    const addDays = (baseDateStr, days) => {
        const d = new Date(baseDateStr);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    if (config.ramadan) {
        dates.push(addDays(config.ramadan, -1)); // Arife
        dates.push(config.ramadan);              // 1. Gün
        dates.push(addDays(config.ramadan, 1));  // 2. Gün
        dates.push(addDays(config.ramadan, 2));  // 3. Gün
    }

    if (config.sacrifice) {
        dates.push(addDays(config.sacrifice, -1)); // Arife
        dates.push(config.sacrifice);              // 1. Gün
        dates.push(addDays(config.sacrifice, 1));  // 2. Gün
        dates.push(addDays(config.sacrifice, 2));  // 3. Gün
        dates.push(addDays(config.sacrifice, 3));  // 4. Gün
    }

    return dates;
}

function checkIsHoliday(dateStr, holidaySets) {
    const activeSet = holidaySets.activeSet || new Set();
    const passiveSet = holidaySets.passiveSet || new Set();

    if (activeSet.has(dateStr)) return true;
    if (passiveSet.has(dateStr)) return false;
    
    // Fixed national holidays
    const md = dateStr.substring(5); // "MM-DD"
    if (fixedHolidaysMD.includes(md)) return true;

    // Moving religious holidays
    const year = parseInt(dateStr.substring(0, 4));
    const religiousDates = getReligiousHolidays(year);
    if (religiousDates.includes(dateStr)) return true;

    return false;
}

function parseHolidayDates(publicHolidayDates) {
    const activeSet = new Set();
    const passiveSet = new Set();
    if (!Array.isArray(publicHolidayDates)) return { activeSet, passiveSet };

    publicHolidayDates.forEach(d => {
        if (!d) return;
        
        let dateStr = '';
        let status = 'active';

        if (typeof d === 'string') {
            dateStr = d.split('T')[0];
        } else if (d instanceof Date) {
            try {
                dateStr = d.toISOString().split('T')[0];
            } catch (e) {}
        } else if (typeof d === 'object') {
            status = d.status || 'active';
            const dateVal = d.date;
            if (typeof dateVal === 'string') {
                dateStr = dateVal.split('T')[0];
            } else if (dateVal instanceof Date) {
                try {
                    dateStr = dateVal.toISOString().split('T')[0];
                } catch (e) {}
            } else if (d.date) {
                dateStr = String(d.date).split('T')[0];
            }
        }

        if (dateStr) {
            if (status === 'passive') {
                passiveSet.add(dateStr);
            } else {
                activeSet.add(dateStr);
            }
        }
    });

    return { activeSet, passiveSet };
}


export function calculateLeaveDays(startDateStr, endDateStr, offDaysStr = "0", publicHolidayDates = []) {
    if (!startDateStr || !endDateStr) return 0;
    
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (end < start) return 0;
    
    const offDays = (offDaysStr || "0").split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    const holidaySet = parseHolidayDates(publicHolidayDates);
    
    let workingDaysCount = 0;
    const current = new Date(start);
    
    current.setHours(12, 0, 0, 0);
    end.setHours(12, 0, 0, 0);
    
    while (current <= end) {
        const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const dateStr = current.toISOString().split('T')[0];
        
        const isOffDay = offDays.includes(dayOfWeek);
        const isPublicHoliday = checkIsHoliday(dateStr, holidaySet);
        
        if (!isOffDay && !isPublicHoliday) {
            workingDaysCount++;
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    return workingDaysCount;
}

/**
 * Calculates the end date for a leave based on start date, working days count, weekly off days, and public holidays.
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {number} daysCount - Number of working leave days to give
 * @param {string} offDaysStr - Comma-separated weekly off day indices (0=Sunday, 6=Saturday)
 * @param {Array<string>} publicHolidayDates - List of holiday dates (YYYY-MM-DD)
 * @returns {string} - YYYY-MM-DD end date
 */
export function calculateLeaveEndDate(startDateStr, daysCount, offDaysStr = "0", publicHolidayDates = []) {
    if (!startDateStr || daysCount <= 0) return startDateStr || "";
    
    const offDays = (offDaysStr || "0").split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    const holidaySet = parseHolidayDates(publicHolidayDates);
    
    return calculateLeaveEndDateFixed(startDateStr, daysCount, offDays, holidaySet);
}

function calculateLeaveEndDateFixed(startDateStr, daysCount, offDays, holidaySet) {
    const start = new Date(startDateStr);
    let remainingDays = daysCount;
    const current = new Date(start);
    current.setHours(12, 0, 0, 0);
    
    let workingDaysFound = 0;
    
    while (workingDaysFound < remainingDays) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        
        const isOffDay = offDays.includes(dayOfWeek);
        const isPublicHoliday = checkIsHoliday(dateStr, holidaySet);
        
        if (!isOffDay && !isPublicHoliday) {
            workingDaysFound++;
        }
        
        if (workingDaysFound < remainingDays) {
            current.setDate(current.getDate() + 1);
        }
    }
    
    return current.toISOString().split('T')[0];
}

export function checkDateHolidayStatus(dateStr, offDaysStr = "0", publicHolidayDates = []) {
    if (!dateStr) return null;
    
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;

    const dayOfWeek = d.getDay();
    const dateOnly = d.toISOString().split('T')[0];
    
    const offDays = (offDaysStr || "0").split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    const holidaySet = parseHolidayDates(publicHolidayDates);

    // 1. Check if it is a weekly rest day
    if (offDays.includes(dayOfWeek)) {
        const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        return { type: 'off-day', label: `Haftalık İzin Günü (${dayNames[dayOfWeek]})` };
    }

    // 2. Check if it is a public holiday
    const isHoliday = checkIsHoliday(dateOnly, holidaySet);
    if (isHoliday) {
        // Check fixed holiday description
        const md = dateOnly.substring(5);
        const fixedDescriptions = {
            '01-01': 'Yılbaşı',
            '04-23': 'Ulusal Egemenlik ve Çocuk Bayramı',
            '05-01': 'Emek ve Dayanışma Günü',
            '05-19': 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı',
            '07-15': 'Demokrasi ve Milli Birlik Günü',
            '08-30': 'Zafer Bayramı',
            '10-28': 'Cumhuriyet Bayramı Arifesi (Yarım Gün)',
            '10-29': 'Cumhuriyet Bayramı'
        };
        if (fixedDescriptions[md]) return { type: 'holiday', label: `Resmi Tatil (${fixedDescriptions[md]})` };

        // Check moving religious holiday description
        const year = parseInt(dateOnly.substring(0, 4));
        const config = religiousHolidaysByYear[year];
        if (config) {
            const addDays = (baseDateStr, days) => {
                const dt = new Date(baseDateStr);
                dt.setDate(dt.getDate() + days);
                return dt.toISOString().split('T')[0];
            };
            if (dateOnly === addDays(config.ramadan, -1)) return { type: 'holiday', label: 'Ramazan Bayramı Arifesi (Yarım Gün)' };
            if (dateOnly === config.ramadan) return { type: 'holiday', label: 'Ramazan Bayramı 1. Gün' };
            if (dateOnly === addDays(config.ramadan, 1)) return { type: 'holiday', label: 'Ramazan Bayramı 2. Gün' };
            if (dateOnly === addDays(config.ramadan, 2)) return { type: 'holiday', label: 'Ramazan Bayramı 3. Gün' };
            if (dateOnly === addDays(config.sacrifice, -1)) return { type: 'holiday', label: 'Kurban Bayramı Arifesi (Yarım Gün)' };
            if (dateOnly === config.sacrifice) return { type: 'holiday', label: 'Kurban Bayramı 1. Gün' };
            if (dateOnly === addDays(config.sacrifice, 1)) return { type: 'holiday', label: 'Kurban Bayramı 2. Gün' };
            if (dateOnly === addDays(config.sacrifice, 2)) return { type: 'holiday', label: 'Kurban Bayramı 3. Gün' };
            if (dateOnly === addDays(config.sacrifice, 3)) return { type: 'holiday', label: 'Kurban Bayramı 4. Gün' };
        }
        
        return { type: 'holiday', label: 'Resmi/Özel Tatil' };
    }

    return null;
}

export function getLeaveBreakdown(startDateStr, endDateStr, offDaysStr = "0", publicHolidayDates = []) {
    if (!startDateStr || !endDateStr) return null;
    
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (end < start) return null;
    
    const offDays = (offDaysStr || "0").split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    const holidaySet = parseHolidayDates(publicHolidayDates);
    
    let workingDaysCount = 0;
    let offDaysCount = 0;
    let holidaysCount = 0;
    
    const current = new Date(start);
    current.setHours(12, 0, 0, 0);
    end.setHours(12, 0, 0, 0);
    
    while (current <= end) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        
        const isOffDay = offDays.includes(dayOfWeek);
        const isPublicHoliday = checkIsHoliday(dateStr, holidaySet);
        
        if (isOffDay) {
            offDaysCount++;
        } else if (isPublicHoliday) {
            holidaysCount++;
        } else {
            workingDaysCount++;
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    return {
        workingDays: workingDaysCount,
        offDays: offDaysCount,
        holidays: holidaysCount,
        totalDays: workingDaysCount + offDaysCount + holidaysCount
    };
}

export function formatDayBalance(days, customWhpl) {
    if (!days && days !== 0) return '-'
    const whpl = customWhpl || parseFloat(localStorage.getItem('hr_overtime_weekday_hours_per_leave')) || 8
    const absDays = Math.abs(days)
    const hours = Math.round(absDays * whpl * 100) / 100
    const sign = days < 0 ? '-' : ''
    if (hours % whpl === 0) {
        return `${sign}${absDays} gün`
    }
    return `${sign}${hours} saat`
}


/**
 * Determines if a leave record or type represents a credit/additive transaction
 * (e.g. Mahsup / Offset, İlave Yıllık İzin, Hak Ediş, Devir, vb.)
 * which increases or offsets rather than consuming regular leave entitlement.
 */
export const isCreditLeave = (leaveOrType) => {
    if (!leaveOrType) return false;
    const type = typeof leaveOrType === 'string' ? leaveOrType : (leaveOrType.type || '');
    const notes = typeof leaveOrType === 'object' ? (leaveOrType.notes || '') : '';

    if (type === 'offset' || type === 'Mahsup') return true;

    const normalized = type
        .replace(/İ/g, 'i')
        .replace(/I/g, 'ı')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/ç/g, 'c')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (normalized.includes('mahsup')) return true;

    const hasAdditiveKeyword = ['ekleme', 'ilave', 'arti', 'arttir', 'kazanilan', 'devir', 'telafi', 'denklestirme', 'hakedis', 'hak edis'].some(keyword => normalized.includes(keyword));
    if (hasAdditiveKeyword) return true;

    if (notes && (notes.includes('[MAHSUP]') || notes.includes('[İLAVE]') || notes.includes('[ILAVE]'))) {
        return true;
    }

    return false;
};

export const isAdditiveAnnual = isCreditLeave;

export function calculateRemainingLeaves(employee, leaves) {
    if (!employee || !employee.start_date) return 0
    const start = new Date(employee.start_date)
    const birth = employee.birth_date ? new Date(employee.birth_date) : null
    const now = new Date()

    const yearsMilli = now - start
    const years = Math.floor(yearsMilli / (1000 * 60 * 60 * 24 * 365.25))

    let totalAccrued = 0
    for (let i = 1; i <= years; i++) {
        let daysThisYear = 0
        if (i <= 5) daysThisYear = 14 // 1 to 5 years (inclusive 5th year)
        else if (i < 15) daysThisYear = 20 // 6 to 14 years
        else daysThisYear = 26 // 15+ years

        // 4857 rule on age limits:
        if (birth) {
            const ageAtThatYear = Math.floor((start.getTime() + (i * 365.25 * 24 * 60 * 60 * 1000) - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
            if (ageAtThatYear <= 18 || ageAtThatYear >= 50) {
                daysThisYear = Math.max(daysThisYear, 20)
            }
        }

        totalAccrued += daysThisYear
    }

    const pastUsed = employee.past_used_leaves || 0

    // Count both 'annual' and localized names like 'Yıllık Ücretli İzin' (excluding additive ones)
    const systemUsedAnnual = (leaves || []).filter(l => 
        l.status === 'approved' && 
        ((l.type === 'annual' || (l.type && l.type.toLowerCase().includes('yıllık'))) && !isCreditLeave(l))
    ).reduce((acc, l) => acc + (l.days || 0), 0)

    const whpl = parseFloat(localStorage.getItem('hr_overtime_weekday_hours_per_leave')) || 8
    const totalOffsets = (leaves || [])
        .filter(l => l.status === 'approved' && isCreditLeave(l))
        .reduce((acc, l) => acc + (l.hours ? l.hours / whpl : (l.days || 0)), 0)

    const balance = totalAccrued - pastUsed - systemUsedAnnual + totalOffsets
    return balance
}

/**
 * Generates a unique document / report serial number if not already present
 * Format: RPR-YYMMDD-HHMMSS (or existing code)
 * @param {string} prefix - e.g. 'RPR', 'PUAN', 'MFR'
 * @param {string} existingNo - Existing document/work number
 * @returns {string}
 */
export function generateReportNo(prefix = 'RPR', existingNo = null) {
    if (existingNo && String(existingNo).trim() !== '') {
        return String(existingNo).trim();
    }
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${prefix}-${yy}${mm}${dd}-${hh}${min}${ss}`;
}

/**
 * Generates a unique sanitized filename for PDF / Excel downloads
 * Appends a timestamp and unique suffix so every download has a distinct identifier
 * e.g. Puantaj_SamsunVinc_Temmuz2026_20260824_112543.pdf
 * @param {string} prefix - e.g. 'Puantaj', 'Is_Raporu', 'Musteri_Raporu'
 * @param {Array<string>} middleParts - e.g. [companyName, workTitle]
 * @param {string} ext - 'pdf' or 'xlsx' or 'xls'
 * @returns {string}
 */
export function generateUniqueFileName(prefix, middleParts = [], ext = 'pdf') {
    const sanitize = (str) => (str || '').replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_\-\s]/g, '').trim().replace(/\s+/g, '_');
    const parts = [sanitize(prefix), ...middleParts.map(sanitize)].filter(Boolean);
    
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timeStamp = `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
    
    return `${parts.join('_')}_${timeStamp}.${ext}`;
}
