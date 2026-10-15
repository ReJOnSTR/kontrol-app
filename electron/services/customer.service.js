const { getPrismaClient } = require('../prismaClient')
const { calculateWorkStats } = require('../utils/workCalculations')

async function getCustomers(companyId, isArchived = 0) {
    try {
        const prisma = getPrismaClient()
        const archiveVal = (isArchived === 1 || isArchived === true || isArchived === '1') ? 1 : 0;
        const customersList = await prisma.customers.findMany({
            where: {
                company_id: parseInt(companyId),
                ...(archiveVal === 1 ? { is_archived: 1 } : { OR: [{ is_archived: 0 }, { is_archived: null }] })
            },
            include: {
                works: {
                    include: {
                        work_items: true
                    }
                }
            }
        })

        // Fetch all non-archived transactions for the company to calculate payments
        const allTransactions = await prisma.transactions.findMany({
            where: {
                company_id: parseInt(companyId),
                is_archived: 0
            }
        });

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const isCurrentMonth = (dateVal) => {
            if (!dateVal) return false;
            const d = new Date(dateVal);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        };

        const collator = new Intl.Collator('tr');
        customersList.sort((a, b) => collator.compare(a.name, b.name));

        const formatted = customersList.map(c => {
            const workIds = c.works.map(w => w.id);
            const workPaymentCategories = workIds.map(id => `WORK_PAYMENT_${id}`);
            const customerPaymentCategory = `CUSTOMER_PAYMENT_${c.id}`;

            // Find all payments belonging to this customer
            let totalPayments = 0;
            allTransactions.forEach(t => {
                if (t.category && (workPaymentCategories.includes(t.category) || t.category === customerPaymentCategory)) {
                    totalPayments += t.amount || 0;
                }
            });

            // Calculate total volume (cumulative and this month) from works (excluding cancelled)
            let cumulativeVolume = 0;
            let thisMonthVolume = 0;
            c.works.forEach(w => {
                if (w.status !== 'cancelled') {
                    const stats = calculateWorkStats(w.work_items, w.pazar_multiplier ?? 1.5, w.mesai_multiplier ?? 1.5);
                    cumulativeVolume += stats.grandTotal || 0;
                    
                    const workDate = w.start_date || w.created_at;
                    if (isCurrentMonth(workDate)) {
                        thisMonthVolume += stats.grandTotal || 0;
                    }
                }
            });

            // Net balance receivable (Cumulative Debit - Cumulative Credit)
            const totalWorkReceivable = cumulativeVolume - totalPayments;

            return {
                ...c,
                total_receivable: totalWorkReceivable,
                total_volume: thisMonthVolume,
                work_count: c.works.length
            }
        })

        return { success: true, data: formatted }
    } catch (error) {
        console.error('Error fetching customers:', error)
        return { success: false, error: error.message }
    }
}

async function getCustomerDetails(id, companyId = null) {
    try {
        const prisma = getPrismaClient()
        const cId = parseInt(id)
        const whereClause = { id: cId }
        if (companyId) {
            whereClause.company_id = parseInt(companyId)
        }
        const customer = await prisma.customers.findFirst({
            where: whereClause,
            include: {
                works: {
                    include: {
                        work_items: true,
                        vehicles: true,
                        employees: true
                    },
                    orderBy: { created_at: 'desc' }
                }
            }
        })

        if (!customer) return { success: false, error: 'Müşteri bulunamadı' }

        // Enhance work details for display
        const enhancedWorks = customer.works.map(w => {
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
            const workStats = calculateWorkStats(w.work_items, w.pazar_multiplier ?? 1.5, w.mesai_multiplier ?? 1.5);
            const isHourly = w.work_items.some(i => (i.description || '').toUpperCase().includes('[SAATLİK]'));

            return {
                ...w,
                start_date: dynamicStart,
                end_date: dynamicEnd,
                total_days: uniqueDays > 0 ? uniqueDays : 0,
                item_count: w.work_items.length,
                total_hours: workStats.totalHours,
                total_overtime: workStats.totalOvertime,
                is_hourly: isHourly,
                total_price: workStats.grandTotal
            }
        })

        // Fetch payments linked to this customer's works and general customer collections
        const workIds = customer.works.map(w => w.id);
        const payments = await prisma.transactions.findMany({
            where: {
                category: {
                    in: [
                        ...workIds.map(id => `WORK_PAYMENT_${id}`),
                        `CUSTOMER_PAYMENT_${customer.id}`
                    ]
                },
                is_archived: 0
            },
            orderBy: { date: 'desc' }
        });

        // Calculate total payments received (credit)
        let totalPayments = 0;
        payments.forEach(p => {
            totalPayments += p.amount || 0;
        });

        // Calculate total volume (debit) from enhanced works, excluding cancelled works
        let totalVolume = 0;
        enhancedWorks.forEach(w => {
            if (w.status !== 'cancelled') {
                totalVolume += w.total_price || 0;
            }
        });

        // Net balance receivable (Total Debit - Total Credit)
        let totalWorkReceivable = totalVolume - totalPayments;

        // Sort enhanced works by start_date descending
        enhancedWorks.sort((a, b) => {
            const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
            const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
            return dateB - dateA;
        });

        return {
            success: true,
            data: {
                ...customer,
                works: enhancedWorks,
                payments: payments,
                total_receivable: totalWorkReceivable,
                total_volume: totalVolume
            }
        }
    } catch (error) {
        console.error('Error fetching customer details:', error)
        return { success: false, error: error.message }
    }
}

async function createCustomer(data) {
    try {
        const prisma = getPrismaClient()
        const newCustomer = await prisma.customers.create({
            data: {
                company_id: parseInt(data.companyId),
                name: data.name,
                phone: data.phone,
                email: data.email,
                address: data.address,
                tax_number: data.tax_number,
                tax_office: data.tax_office,
                notes: data.notes
            }
        })
        return { success: true, data: newCustomer }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

async function updateCustomer(data) {
    try {
        const prisma = getPrismaClient()
        const updated = await prisma.customers.update({
            where: { id: parseInt(data.id) },
            data: {
                name: data.name,
                phone: data.phone,
                email: data.email,
                address: data.address,
                tax_number: data.tax_number,
                tax_office: data.tax_office,
                notes: data.notes
            }
        })
        return { success: true, data: updated }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

async function deleteCustomer(id, companyId = null) {
    try {
        const cId = parseInt(id)
        const prisma = getPrismaClient()
        const existing = await prisma.customers.findUnique({ where: { id: cId } })
        if (!existing) return { success: false, error: 'Müşteri bulunamadı' }
        if (companyId && existing.company_id !== parseInt(companyId)) {
            return { success: false, error: 'Bu müşteriyi silme yetkiniz yok.' }
        }

        await prisma.$transaction(async (tx) => {
            const customerWorks = await tx.works.findMany({ where: { customer_id: cId }, select: { id: true } })
            const workIds = customerWorks.map(w => w.id)
            if (workIds.length > 0) {
                await tx.work_items.deleteMany({ where: { work_id: { in: workIds } } })
                await tx.works.deleteMany({ where: { customer_id: cId } })
            }
            await tx.customers.delete({ where: { id: cId } })
        })
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

module.exports = {
    getCustomers,
    getCustomerDetails,
    createCustomer,
    updateCustomer,
    deleteCustomer
}
