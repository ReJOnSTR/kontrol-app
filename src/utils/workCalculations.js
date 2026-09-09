/**
 * Shared work price calculation logic.
 * This is the SINGLE SOURCE OF TRUTH for total price calculations.
 * Used by: WorkDetails.jsx (cards), work.service.js (list), WorkPdfReport.jsx (PDF)
 *
 * IMPORTANT: Must match WorkPdfReport.jsx logic EXACTLY.
 *
 * @param {Array} items - work_items array
 * @returns {Object} calculated stats
 */
export function calculateAutoHours(startTime, endTime, pricingType, workStartStr = '08:00', workEndStr = '17:00', disableOvertime = false) {
    if (!startTime || !endTime) return { hours: 1, overtimeHours: 0 };

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    let diffHours = endH - startH + (endM - startM) / 60;
    if (diffHours < 0) diffHours += 24;

    let calculatedHours = 1;
    let calculatedOvertime = 0;

    if (pricingType === 'hourly') {
        calculatedHours = parseFloat(diffHours.toFixed(2));
        calculatedOvertime = 0;
    } else if (disableOvertime) {
        calculatedHours = 1;
        calculatedOvertime = 0;
    } else {
        const [wSH, wSM] = (workStartStr || '08:00').split(':').map(Number);
        const [wEH, wEM] = (workEndStr || '17:00').split(':').map(Number);

        const workStart = wSH + (wSM / 60);
        const workEnd = wEH + (wEM / 60);

        const currentStart = startH + (startM / 60);
        const currentEnd = endH + (endM / 60);

        let standardOverlap = 0;
        if (currentEnd >= currentStart) {
            standardOverlap = Math.max(0, Math.min(currentEnd, workEnd) - Math.max(currentStart, workStart));
        } else {
            const day1Overlap = Math.max(0, Math.min(24, workEnd) - Math.max(currentStart, workStart));
            const day2Overlap = Math.max(0, Math.min(currentEnd, workEnd) - Math.max(0, workStart));
            standardOverlap = day1Overlap + day2Overlap;
        }

        const overtimeHours = Math.max(0, diffHours - standardOverlap);
        calculatedHours = 1;
        calculatedOvertime = parseFloat(Math.min(diffHours, overtimeHours).toFixed(2));
    }

    return { hours: calculatedHours, overtimeHours: calculatedOvertime };
}

export function calculateWorkStats(items, pazarMultiplier = 1.5, mesaiMultiplier = 1.5, vehiclesList = []) {
    const pazarMultVal = parseFloat(pazarMultiplier)
    const parsedPazarMultiplier = (pazarMultiplier === "" || pazarMultiplier === null || pazarMultiplier === undefined || isNaN(pazarMultVal)) 
        ? 1.5 
        : pazarMultVal

    const mesaiMultVal = parseFloat(mesaiMultiplier)
    const parsedMesaiMultiplier = (mesaiMultiplier === "" || mesaiMultiplier === null || mesaiMultiplier === undefined || isNaN(mesaiMultVal)) 
        ? 1.5 
        : mesaiMultVal

    if (!items || items.length === 0) {
        return {
            groups: [],
            totalHours: 0,
            totalOvertime: 0,
            totalPazarDayCount: 0,
            totalEkOdemeler: 0,
            grandTotal: 0,
            totalMesaiPriceAmount: 0,
            totalPazarPriceAmount: 0,
            totalGunTutar: 0,
            totalSaatlikTutar: 0,
            durationText: '0 Gün',
            uniqueVehicles: new Set(),
            uniqueEmployees: new Set(),
            itemCount: 0
        }
    }

    const uniqueVehicles = new Set()
    const uniqueEmployees = new Set()

    const vehiclesMap = {};
    (vehiclesList || []).forEach(v => {
        if (v && v.id) vehiclesMap[String(v.id)] = v;
    });

    const getVehicleName = (i) => {
        if (i.plate) {
            return `${i.plate}${i.model ? ` - ${i.model}` : ''}`.trim();
        }
        const v = i.vehicle || i.vehicles || (i.vehicle_id ? vehiclesMap[String(i.vehicle_id)] : null);
        if (v) {
            const p = v.plate || v.name;
            const m = v.model || v.brand || '';
            if (p) return `${p}${m ? ` - ${m}` : ''}`.trim();
        }
        if (i.vehicle_name) return i.vehicle_name;
        if (i.custom_vehicle) return i.custom_vehicle;
        return 'Belirtilmemiş';
    };

    // 1. Process items: resolution & vehicle base key
    const vehicleRateInfo = {}
    items.forEach(item => {
        if (item.vehicle_id) {
            uniqueVehicles.add(String(item.vehicle_id))
        } else if (item.custom_vehicle) {
            uniqueVehicles.add(`custom_${item.custom_vehicle}`)
        }
        if (item.employee_id) uniqueEmployees.add(item.employee_id)

        const vehicleBaseKey = item.vehicle_id ? String(item.vehicle_id) : (item.custom_vehicle ? `custom_${item.custom_vehicle}` : 'diger')
        const unitPriceVal = Number(item.unit_price) || 0
        const cleanDesc = (item.description || '').replace(/\[[^\]]*\]\s*/g, '').trim()

        if (!vehicleRateInfo[vehicleBaseKey]) {
            vehicleRateInfo[vehicleBaseKey] = {
                firstPositivePrice: 0,
                descByPrice: {}
            }
        }

        if (unitPriceVal > 0) {
            if (!vehicleRateInfo[vehicleBaseKey].firstPositivePrice) {
                vehicleRateInfo[vehicleBaseKey].firstPositivePrice = unitPriceVal
            }
            if (cleanDesc && !vehicleRateInfo[vehicleBaseKey].descByPrice[unitPriceVal]) {
                vehicleRateInfo[vehicleBaseKey].descByPrice[unitPriceVal] = cleanDesc
            }
        }
    })

    const resolveItemEffectiveInfo = (item) => {
        const vehicleBaseKey = item.vehicle_id ? String(item.vehicle_id) : (item.custom_vehicle ? `custom_${item.custom_vehicle}` : 'diger')
        let unitPriceVal = Number(item.unit_price) || 0
        let cleanDesc = (item.description || '').replace(/\[[^\]]*\]\s*/g, '').trim()

        const info = vehicleRateInfo[vehicleBaseKey]
        if (info) {
            if (unitPriceVal === 0 && info.firstPositivePrice > 0) {
                unitPriceVal = info.firstPositivePrice
            }
            if (!cleanDesc && unitPriceVal > 0 && info.descByPrice[unitPriceVal]) {
                cleanDesc = info.descByPrice[unitPriceVal]
            }
        }
        return { unitPriceVal, cleanDesc }
    }

    // Group items by vehicleBaseKey ONLY (matches WorkPdfReport.jsx)
    const groupedByVehicle = {}
    let hasAylikWork = false

    items.forEach(item => {
        const vehicleBaseKey = item.vehicle_id ? String(item.vehicle_id) : (item.custom_vehicle ? `custom_${item.custom_vehicle}` : 'diger')
        const { unitPriceVal, cleanDesc } = resolveItemEffectiveInfo(item)

        const descUpper = (item.description || '').toUpperCase()
        const dateObj = new Date(item.date)
        const isSunday = !isNaN(dateObj.getTime()) && dateObj.getDay() === 0
        const isPazar = isSunday || descUpper.includes('PAZAR')
        const isSaatlik = descUpper.includes('[SAATLİK]') || item.pricingType === 'hourly'
        const isAylik = descUpper.includes('[AYLIK]') || item.pricingType === 'monthly'

        if (isAylik) hasAylikWork = true

        if (!groupedByVehicle[vehicleBaseKey]) {
            const rawMachineName = getVehicleName(item);
            groupedByVehicle[vehicleBaseKey] = {
                machineName: rawMachineName,
                rawMachineName: rawMachineName,
                items: []
            }
        } else if (groupedByVehicle[vehicleBaseKey].machineName === 'Belirtilmemiş') {
            const updatedName = getVehicleName(item);
            if (updatedName !== 'Belirtilmemiş') {
                groupedByVehicle[vehicleBaseKey].machineName = updatedName;
                groupedByVehicle[vehicleBaseKey].rawMachineName = updatedName;
            }
        }

        groupedByVehicle[vehicleBaseKey].items.push({
            ...item,
            unitPriceVal,
            cleanDesc,
            isPazar,
            isSaatlik,
            isAylik
        })
    })

    let grandTotal = 0
    let totalHours = 0
    let totalOvertime = 0
    let totalPazarDayCount = 0
    let totalGunCount = 0
    let totalSaatCount = 0

    let totalMesaiPriceAmount = 0
    let totalPazarPriceAmount = 0
    let totalGunTutar = 0
    let totalSaatlikTutar = 0
    let totalEkOdemeler = 0

    // Compute stats per vehicle group (exact same logic as WorkPdfReport.jsx)
    const calculatedGroups = Object.values(groupedByVehicle).map(group => {
        group.items.sort((a, b) => new Date(a.date) - new Date(b.date));

        const isAylikGroup = group.items.some(i => i.isAylik);
        const positivePriceItem = group.items.find(i => i.unitPriceVal > 0);
        const rawPrimaryPrice = positivePriceItem ? positivePriceItem.unitPriceVal : 0;

        let dailyRate = rawPrimaryPrice;
        let monthlyAmount = rawPrimaryPrice;

        if (isAylikGroup && rawPrimaryPrice > 0) {
            if (rawPrimaryPrice > 10000) {
                dailyRate = rawPrimaryPrice / 26;
                monthlyAmount = rawPrimaryPrice;
            } else {
                dailyRate = rawPrimaryPrice;
                monthlyAmount = rawPrimaryPrice * 26;
            }
        }

        let groupPazarCount = 0;
        let groupSaatlikCount = 0;
        let groupGunCount = 0;
        let groupMesaiCount = 0;
        const additionsMap = {};

        group.items.forEach(item => {
            const hrs = Number(item.hours) || 0;
            const mesaiHrs = Number(item.overtime_hours) || 0;
            const travelPrice = Number(item.travel_price) || 0;

            totalHours += hrs;
            totalOvertime += mesaiHrs;

            if (item.isPazar) {
                groupPazarCount += hrs;
                totalPazarDayCount += hrs;
                totalGunCount += hrs;
            } else if (item.isSaatlik) {
                groupSaatlikCount += hrs;
                totalSaatCount += hrs;
            } else {
                groupGunCount += hrs;
                totalGunCount += hrs;
            }

            if (mesaiHrs > 0) {
                groupMesaiCount += mesaiHrs;
            }

            // Custom additions
            const additionMatches = (item.description || '').matchAll(/\[EK:([^:]+):([^\]]+)\]/g);
            let hasAddition = false;
            for (const match of additionMatches) {
                hasAddition = true;
                const type = match[1];
                const price = parseFloat(match[2]) || 0;
                if (!additionsMap[type]) additionsMap[type] = { count: 0, price };
                additionsMap[type].count += 1;
            }
            if (!hasAddition && travelPrice > 0) {
                if (!additionsMap['Yol']) additionsMap['Yol'] = { count: 0, price: travelPrice };
                additionsMap['Yol'].count += 1;
            }
        });

        // Construct Summary Lines Array (EXACT SAME AS PDF REPORT)
        const summaryLines = [];

        const getItemEffectivePrice = (item, baseRate) => {
            const kMatch = (item.description || '').match(/\[KATSAYI:([^\]]+)\]/);
            if (kMatch) {
                const multVal = parseFloat(kMatch[1]) || 1;
                return (baseRate > 0 ? baseRate : (item.unitPriceVal || 0)) * multVal;
            }
            return item.unitPriceVal > 0 ? item.unitPriceVal : baseRate;
        };

        const customRateItems = group.items.filter(i => {
            if (i.isPazar || i.isSaatlik) return false;
            const kMatch = (i.description || '').match(/\[KATSAYI:([^\]]+)\]/);
            if (kMatch && parseFloat(kMatch[1]) !== 1) return true;
            return i.unitPriceVal > 0 && Math.abs(i.unitPriceVal - dailyRate) > 1;
        });
        const customRateDaysCount = customRateItems.reduce((s, i) => s + (Number(i.hours) || 0), 0);

        if (isAylikGroup) {
            const baseMonthlyDays = Math.max(0, 26 - customRateDaysCount);
            const baseMonthlyTotal = baseMonthlyDays * dailyRate;

            summaryLines.push({
                typeLabel: 'AYLIK',
                countText: customRateDaysCount > 0 ? `1 AY (${baseMonthlyDays} Gün)` : '1 AY (26 Gün)',
                unitPrice: dailyRate,
                totalPrice: baseMonthlyTotal
            });

            if (customRateDaysCount > 0) {
                const customMap = {};
                customRateItems.forEach(i => {
                    const price = getItemEffectivePrice(i, dailyRate);
                    const hrs = Number(i.hours) || 0;
                    const label = i.cleanDesc ? i.cleanDesc.toUpperCase() : `GÜN`;
                    const key = `${label}_${price}`;
                    if (!customMap[key]) {
                        customMap[key] = { label, price, count: 0, unit: i.isSaatlik ? 'SAAT' : 'GÜN' };
                    }
                    customMap[key].count += hrs;
                });

                Object.values(customMap).forEach(itemData => {
                    summaryLines.push({
                        typeLabel: itemData.label,
                        countText: `${itemData.count} ${itemData.unit}`,
                        unitPrice: itemData.price,
                        totalPrice: itemData.count * itemData.price
                    });
                });
            }
        } else {
            // Regular Daily Job
            const allDailyItems = group.items.filter(i => !i.isPazar && !i.isSaatlik);
            if (allDailyItems.length > 0) {
                const dailyPricesMap = {};
                allDailyItems.forEach(i => {
                    const price = getItemEffectivePrice(i, dailyRate);
                    const isCustom = Math.abs(price - dailyRate) > 1 || (i.description || '').includes('[KATSAYI:');
                    const label = (isCustom && i.cleanDesc) ? i.cleanDesc.toUpperCase() : 'GÜN';
                    const key = `${label}_${price}`;
                    const hrs = Number(i.hours) || 0;
                    if (!dailyPricesMap[key]) {
                        dailyPricesMap[key] = { label, price, count: 0 };
                    }
                    dailyPricesMap[key].count += hrs;
                });

                Object.values(dailyPricesMap).forEach(itemData => {
                    summaryLines.push({
                        typeLabel: itemData.label,
                        countText: `${itemData.count} GÜN`,
                        unitPrice: itemData.price,
                        totalPrice: itemData.count * itemData.price
                    });
                });
            }
        }

        // 2. PAZAR Line (calculated per-item rate)
        if (groupPazarCount > 0) {
            const pazarPricesMap = {};
            group.items.filter(i => i.isPazar).forEach(i => {
                const hrs = Number(i.hours) || 0;
                if (hrs > 0) {
                    const itemDailyPrice = getItemEffectivePrice(i, dailyRate);
                    const itemPazarPrice = itemDailyPrice > 0 ? itemDailyPrice * parsedPazarMultiplier : 0;
                    const key = `${itemPazarPrice}`;
                    if (!pazarPricesMap[key]) {
                        pazarPricesMap[key] = { price: itemPazarPrice, count: 0 };
                    }
                    pazarPricesMap[key].count += hrs;
                }
            });

            Object.values(pazarPricesMap).forEach(itemData => {
                const pazarTutar = itemData.count * itemData.price;
                summaryLines.push({
                    typeLabel: 'PAZAR',
                    countText: `${itemData.count} GÜN`,
                    unitPrice: itemData.price,
                    totalPrice: pazarTutar
                });
                totalPazarPriceAmount += pazarTutar;
            });
        }

        // 3. SAAT Line
        if (groupSaatlikCount > 0) {
            const saatlikPrice = group.items.find(i => i.isSaatlik && i.unitPriceVal > 0)?.unitPriceVal || 0;
            summaryLines.push({
                typeLabel: 'SAAT',
                countText: `${groupSaatlikCount} SAAT`,
                unitPrice: saatlikPrice,
                totalPrice: groupSaatlikCount * saatlikPrice
            });
            totalSaatlikTutar += groupSaatlikCount * saatlikPrice;
        }

        // 4. MESAİ Line (calculated per 8 net daily working hours)
        if (groupMesaiCount > 0) {
            const mesaiPricesMap = {};
            group.items.forEach(i => {
                const mesaiHrs = Number(i.overtime_hours) || 0;
                if (mesaiHrs > 0) {
                    const itemDailyPrice = getItemEffectivePrice(i, dailyRate);
                    const itemHourlyRate = itemDailyPrice > 0 ? itemDailyPrice / 8 : 0;
                    const itemMesaiPrice = parseFloat((itemHourlyRate * parsedMesaiMultiplier).toFixed(2));
                    const key = `${itemMesaiPrice}`;
                    if (!mesaiPricesMap[key]) {
                        mesaiPricesMap[key] = { price: itemMesaiPrice, count: 0 };
                    }
                    mesaiPricesMap[key].count += mesaiHrs;
                }
            });

            Object.values(mesaiPricesMap).forEach(itemData => {
                const mesaiTutar = itemData.count * itemData.price;
                summaryLines.push({
                    typeLabel: 'MESAİ',
                    countText: `${itemData.count} SAAT`,
                    unitPrice: itemData.price,
                    totalPrice: mesaiTutar
                });
                totalMesaiPriceAmount += mesaiTutar;
            });
        }

        // 5. EK ÖDEMELER Lines
        Object.entries(additionsMap).forEach(([type, data]) => {
            summaryLines.push({
                typeLabel: type.toUpperCase(),
                countText: `${data.count} ADET`,
                unitPrice: data.price,
                totalPrice: data.count * data.price
            });
            totalEkOdemeler += data.count * data.price;
        });

        const groupGrandTotal = summaryLines.reduce((sum, l) => sum + (l.totalPrice || 0), 0);
        grandTotal += groupGrandTotal;

        return {
            ...group,
            summaryLines,
            calculatedGrandTotal: groupGrandTotal
        };
    });

    let durationText = '0 Gün'
    if (hasAylikWork) {
        durationText = '1 Ay (26 Gün)'
    } else if (totalGunCount > 0 && totalSaatCount > 0) {
        durationText = `${totalGunCount} Gün + ${totalSaatCount} Saat`
    } else if (totalSaatCount > 0) {
        durationText = `${totalSaatCount} Saat`
    } else if (totalGunCount > 0) {
        durationText = `${totalGunCount} Gün`
    } else if (items.length > 0) {
        durationText = `${items.length} Gün`
    }

    return {
        groups: calculatedGroups,
        totalHours,
        totalGunCount,
        totalSaatCount,
        durationText,
        totalOvertime,
        totalPazarDayCount,
        totalEkOdemeler,
        grandTotal,
        totalMesaiPriceAmount,
        totalPazarPriceAmount,
        totalGunTutar,
        totalSaatlikTutar,
        uniqueVehicles,
        uniqueEmployees,
        itemCount: items.length
    }
}
