const { getPrismaClient } = require('../prismaClient')
const { calculateWorkStats, calculateAutoHours } = require('../utils/workCalculations')

async function getWorks(companyId, isArchived = 0) {
    try {
        const prisma = getPrismaClient()
        const archiveVal = (isArchived === 1 || isArchived === true || isArchived === '1') ? 1 : 0
        const works = await prisma.works.findMany({
            where: { 
                company_id: parseInt(companyId), 
                ...(archiveVal === 1 
                    ? { is_archived: 1 } 
                    : { OR: [{ is_archived: 0 }, { is_archived: null }] }
                )
            },
            include: {
                work_items: true,
                customers: true
            },
            orderBy: { created_at: 'desc' }
        })

        // Format to include item_count and totals
        const formatted = works.map(w => {
            const itemDates = w.work_items.filter(i => i.date).map(i => new Date(i.date).getTime());
            let dynamicStart = w.start_date;
            let dynamicEnd = w.end_date;

            if (itemDates.length > 0) {
                dynamicStart = new Date(Math.min(...itemDates));
                dynamicEnd = new Date(Math.max(...itemDates));
            }

            const uniqueDays = new Set(w.work_items.filter(i => i.date).map(i => {
                const d = new Date(i.date)
                return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
            })).size;

            // Use shared calculation (same as PDF report)
            const stats = calculateWorkStats(w.work_items, w.pazar_multiplier ?? 1.5, w.mesai_multiplier ?? 1.5);

            const isHourly = w.work_items.some(i => (i.description || '').toUpperCase().includes('[SAATLİK]'));

            return {
                ...w,
                customer_name: w.customers?.name || w.customer,
                start_date: dynamicStart,
                end_date: dynamicEnd,
                total_days: stats.totalHours > 0 ? stats.totalHours : (uniqueDays > 0 ? uniqueDays : 0),
                item_count: w.work_items.length,
                total_hours: stats.totalHours,
                total_gun_count: stats.totalGunCount,
                total_saat_count: stats.totalSaatCount,
                duration_text: stats.durationText,
                is_hourly: isHourly,
                total_price: stats.grandTotal
            };
        })

        return { success: true, data: formatted }
    } catch (error) {
        console.error('Error fetching works:', error)
        return { success: false, error: error.message }
    }
}

async function getWorkDetails(id) {
    try {
        const prisma = getPrismaClient()
        const work = await prisma.works.findUnique({
            where: { id: parseInt(id) },
            include: {
                customers: true,
                work_items: {
                    include: {
                        vehicles: true,
                        employees: true
                    },
                    orderBy: [{ date: 'asc' }, { id: 'asc' }]
                }
            }
        })

        if (!work) return { success: false, error: 'İş bulunamadı' }

        // Flatten related data
        const formatted = {
            ...work,
            customer_name: work.customers?.name || work.customer,
            items: work.work_items.map(item => ({
                ...item,
                plate: item.vehicles?.plate || item.custom_vehicle || '',
                brand: item.vehicles?.brand || '',
                model: item.vehicles?.model || '',
                employee_name: item.employees ? item.employees.first_name : (item.custom_employee || ''),
                employee_surname: item.employees ? item.employees.last_name : ''
            }))
        }

        return { success: true, data: formatted }
    } catch (error) {
        console.error('Error fetching work details:', error)
        return { success: false, error: error.message }
    }
}

async function createWork(data) {
    try {
        const prisma = getPrismaClient()
        const newWork = await prisma.works.create({
            data: {
                company_id: parseInt(data.companyId),
                title: data.title,
                customer_id: data.customerId ? parseInt(data.customerId) : null,
                customer: data.customer, // keep fallback logic for now if any
                description: data.description,
                status: data.status || 'pending',
                location: data.location,
                work_start_time: data.work_start_time || '08:00',
                work_end_time: data.work_end_time || '17:00',
                disable_overtime: data.disable_overtime ? 1 : 0,
                start_date: data.startDate ? new Date(data.startDate) : null,
                end_date: data.endDate ? new Date(data.endDate) : null,
                pazar_multiplier: data.pazar_multiplier !== undefined ? parseFloat(data.pazar_multiplier) : 1.5,
                mesai_multiplier: data.mesai_multiplier !== undefined ? parseFloat(data.mesai_multiplier) : 1.5
            }
        })
        return { success: true, data: newWork }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

async function updateWork(data) {
    try {
        const prisma = getPrismaClient()
        const workId = parseInt(data.id);

        const currentWork = await prisma.works.findUnique({
            where: { id: workId },
            include: { work_items: true }
        });

        const newStartTime = data.work_start_time !== undefined ? data.work_start_time : currentWork?.work_start_time;
        const newEndTime = data.work_end_time !== undefined ? data.work_end_time : currentWork?.work_end_time;
        const isDisableOvertime = data.disable_overtime !== undefined ? (data.disable_overtime ? 1 : 0) : (currentWork?.disable_overtime ? 1 : 0);
        const disableOvertimeChanged = data.disable_overtime !== undefined && (data.disable_overtime ? 1 : 0) !== (currentWork?.disable_overtime ? 1 : 0);

        const updated = await prisma.works.update({
            where: { id: workId },
            data: {
                title: data.title !== undefined ? data.title : undefined,
                customer_id: data.customerId !== undefined ? (data.customerId ? parseInt(data.customerId) : null) : undefined,
                customer: data.customer !== undefined ? data.customer : undefined,
                description: data.description !== undefined ? data.description : undefined,
                status: data.status !== undefined ? data.status : undefined,
                location: data.location !== undefined ? data.location : undefined,
                work_start_time: data.work_start_time !== undefined ? data.work_start_time : undefined,
                work_end_time: data.work_end_time !== undefined ? data.work_end_time : undefined,
                disable_overtime: data.disable_overtime !== undefined ? (data.disable_overtime ? 1 : 0) : undefined,
                start_date: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
                end_date: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
                pazar_multiplier: data.pazar_multiplier !== undefined ? parseFloat(data.pazar_multiplier) : undefined,
                mesai_multiplier: data.mesai_multiplier !== undefined ? parseFloat(data.mesai_multiplier) : undefined
            }
        });

        if (currentWork && currentWork.work_items && currentWork.work_items.length > 0 &&
            ((data.work_start_time !== undefined && data.work_start_time !== currentWork.work_start_time) ||
             (data.work_end_time !== undefined && data.work_end_time !== currentWork.work_end_time) ||
             disableOvertimeChanged)) {
            
            for (const item of currentWork.work_items) {
                if (item.start_time && item.end_time) {
                    const descUpper = (item.description || '').toUpperCase();
                    const isHourly = descUpper.includes('[SAATLİK]') || item.pricingType === 'hourly';
                    const { overtimeHours } = calculateAutoHours(
                        item.start_time,
                        item.end_time,
                        isHourly ? 'hourly' : 'daily',
                        newStartTime || '08:00',
                        newEndTime || '17:00',
                        !!isDisableOvertime
                    );

                    await prisma.work_items.update({
                        where: { id: item.id },
                        data: { overtime_hours: overtimeHours }
                    });
                }
            }
        }

        return { success: true, data: updated }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

async function deleteWork(id) {
    try {
        const wId = parseInt(id)
        const prisma = getPrismaClient()
        await prisma.$transaction(async (tx) => {
            await tx.work_items.deleteMany({ where: { work_id: wId } })
            await tx.works.delete({ where: { id: wId } })
        })
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

async function deleteWorks(ids) {
    try {
        if (!ids || !Array.isArray(ids) || ids.length === 0) return { success: true }
        const intIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id))
        if (intIds.length === 0) return { success: true }
        const prisma = getPrismaClient()
        await prisma.$transaction(async (tx) => {
            await tx.work_items.deleteMany({ where: { work_id: { in: intIds } } })
            await tx.works.deleteMany({ where: { id: { in: intIds } } })
        })
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

async function archiveWorks(ids, isArchived = 1) {
    try {
        if (!ids || !Array.isArray(ids) || ids.length === 0) return { success: true }
        const intIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id))
        if (intIds.length === 0) return { success: true }
        const archiveVal = (isArchived === 1 || isArchived === true || isArchived === '1') ? 1 : 0
        const prisma = getPrismaClient()
        await prisma.$transaction(async (tx) => {
            await tx.works.updateMany({
                where: { id: { in: intIds } },
                data: { is_archived: archiveVal }
            })
            await tx.work_items.updateMany({
                where: { work_id: { in: intIds } },
                data: { is_archived: archiveVal }
            })
        })
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

// ====== WORK ITEMS ======

function calculateItemTotalPrice(data, pazarMultiplier = 1.5, mesaiMultiplier = 1.5) {
    const descUpper = (data.description || '').toUpperCase();
    const isSaatlik = descUpper.includes('[SAATLİK]');

    let isPazar = descUpper.includes('PAZAR');
    if (data.date) {
        const d = new Date(data.date);
        if (d.getDay() === 0) isPazar = true;
    }

    const hours = parseFloat(data.hours || 0);
    const overtimeHours = parseFloat(data.overtimeHours || 0);
    const unitPrice = parseFloat(data.unitPrice || 0);
    const travelPrice = parseFloat(data.travelPrice || 0);

    const isAylik = descUpper.includes('[AYLIK]');

    let baseTotal = 0;
    if (isSaatlik) {
        baseTotal = unitPrice * hours;
    } else {
        let gunRate = unitPrice;

        if (isAylik) {
            if (isPazar) {
                gunRate = unitPrice + (unitPrice * pazarMultiplier);
            }
        } else {
            if (isPazar) {
                gunRate = unitPrice * pazarMultiplier;
            }
        }

        const mesaiRate = (unitPrice / 8) * mesaiMultiplier;
        baseTotal = (hours * gunRate) + (overtimeHours * mesaiRate);
    }

    // Add travel price (flat per entry)
    return baseTotal + travelPrice;
}

async function addWorkItem(data) {
    try {
        const prisma = getPrismaClient()

        const work = await prisma.works.findUnique({
            where: { id: parseInt(data.workId) },
            select: { pazar_multiplier: true, mesai_multiplier: true }
        });
        const pazarMult = work?.pazar_multiplier ?? 1.5;
        const mesaiMult = work?.mesai_multiplier ?? 1.5;

        let totalPrice = calculateItemTotalPrice(data, pazarMult, mesaiMult);

        const newItem = await prisma.work_items.create({
            data: {
                work_id: parseInt(data.workId),
                date: new Date(data.date),
                receipt_no: data.receiptNo || null,
                vehicle_id: (data.vehicleId && !isNaN(Number(data.vehicleId))) ? parseInt(data.vehicleId) : null,
                employee_id: (data.employeeId && !isNaN(Number(data.employeeId))) ? parseInt(data.employeeId) : null,
                custom_vehicle: (data.vehicleId && isNaN(Number(data.vehicleId))) ? String(data.vehicleId) : null,
                custom_employee: (data.employeeId && isNaN(Number(data.employeeId))) ? String(data.employeeId) : null,
                start_time: data.startTime || null,
                end_time: data.endTime || null,
                hours: parseFloat(data.hours || 0),
                overtime_hours: parseFloat(data.overtimeHours || 0),
                unit_price: parseFloat(data.unitPrice || 0),
                travel_price: parseFloat(data.travelPrice || 0),
                total_price: totalPrice,
                description: data.description || null
            }
        })
        return { success: true, data: newItem }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

async function addBulkWorkItems(itemsData) {
    try {
        const prisma = getPrismaClient()

        const firstWorkId = itemsData[0]?.workId;
        const work = firstWorkId ? await prisma.works.findUnique({
            where: { id: parseInt(firstWorkId) },
            select: { pazar_multiplier: true, mesai_multiplier: true }
        }) : null;
        
        const pazarMult = work?.pazar_multiplier ?? 1.5;
        const mesaiMult = work?.mesai_multiplier ?? 1.5;

        // Prepare array for createMany
        const formattedItems = itemsData.map(data => {
            let totalPrice = calculateItemTotalPrice(data, pazarMult, mesaiMult);
            return {
                work_id: parseInt(data.workId),
                date: new Date(data.date),
                receipt_no: data.receiptNo || null,
                vehicle_id: (data.vehicleId && !isNaN(Number(data.vehicleId))) ? parseInt(data.vehicleId) : null,
                employee_id: (data.employeeId && !isNaN(Number(data.employeeId))) ? parseInt(data.employeeId) : null,
                custom_vehicle: (data.vehicleId && isNaN(Number(data.vehicleId))) ? String(data.vehicleId) : null,
                custom_employee: (data.employeeId && isNaN(Number(data.employeeId))) ? String(data.employeeId) : null,
                start_time: data.startTime || null,
                end_time: data.endTime || null,
                hours: parseFloat(data.hours || 0),
                overtime_hours: parseFloat(data.overtimeHours || 0),
                unit_price: parseFloat(data.unitPrice || 0),
                travel_price: parseFloat(data.travelPrice || 0),
                total_price: totalPrice,
                description: data.description || null
            }
        });

        const result = await prisma.work_items.createMany({
            data: formattedItems
        });

        return { success: true, count: result.count }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

async function updateWorkItem(data) {
    try {
        const prisma = getPrismaClient()

        let workId = data.workId;
        if (!workId) {
            const existing = await prisma.work_items.findUnique({
                where: { id: parseInt(data.id) },
                select: { work_id: true }
            });
            workId = existing?.work_id;
        }

        const work = workId ? await prisma.works.findUnique({
            where: { id: parseInt(workId) },
            select: { pazar_multiplier: true, mesai_multiplier: true }
        }) : null;
        
        const pazarMult = work?.pazar_multiplier ?? 1.5;
        const mesaiMult = work?.mesai_multiplier ?? 1.5;

        let totalPrice = calculateItemTotalPrice(data, pazarMult, mesaiMult);

        const updateData = {
            date: new Date(data.date),
            receipt_no: data.receiptNo !== undefined ? (data.receiptNo || null) : undefined,
            start_time: data.startTime !== undefined ? (data.startTime || null) : undefined,
            end_time: data.endTime !== undefined ? (data.endTime || null) : undefined,
            hours: data.hours !== undefined ? parseFloat(data.hours || 0) : undefined,
            overtime_hours: data.overtimeHours !== undefined ? parseFloat(data.overtimeHours || 0) : undefined,
            unit_price: data.unitPrice !== undefined ? parseFloat(data.unitPrice || 0) : undefined,
            travel_price: data.travelPrice !== undefined ? parseFloat(data.travelPrice || 0) : undefined,
            total_price: totalPrice,
            description: data.description !== undefined ? (data.description || null) : undefined
        };

        if (data.vehicleId !== undefined) {
            if (!data.vehicleId) {
                updateData.vehicle_id = null;
                updateData.custom_vehicle = null;
            } else if (!isNaN(Number(data.vehicleId))) {
                updateData.vehicle_id = parseInt(data.vehicleId);
                updateData.custom_vehicle = null;
            } else {
                updateData.vehicle_id = null;
                updateData.custom_vehicle = String(data.vehicleId);
            }
        }

        if (data.employeeId !== undefined) {
            if (!data.employeeId) {
                updateData.employee_id = null;
                updateData.custom_employee = null;
            } else if (!isNaN(Number(data.employeeId))) {
                updateData.employee_id = parseInt(data.employeeId);
                updateData.custom_employee = null;
            } else {
                updateData.employee_id = null;
                updateData.custom_employee = String(data.employeeId);
            }
        }

        const updated = await prisma.work_items.update({
            where: { id: parseInt(data.id) },
            data: updateData
        })
        return { success: true, data: updated }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

async function deleteWorkItem(id) {
    try {
        const prisma = getPrismaClient()
        await prisma.work_items.delete({
            where: { id: parseInt(id) }
        })
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

async function deleteBulkWorkItems(ids) {
    try {
        const prisma = getPrismaClient()
        await prisma.work_items.deleteMany({
            where: {
                id: { in: ids.map(id => parseInt(id)) }
            }
        })
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

module.exports = {
    getWorks,
    getWorkDetails,
    createWork,
    updateWork,
    deleteWork,
    deleteWorks,
    archiveWorks,
    addWorkItem,
    addBulkWorkItems,
    updateWorkItem,
    deleteWorkItem,
    deleteBulkWorkItems
}
