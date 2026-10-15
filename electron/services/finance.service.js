const { getPrismaClient } = require('../prismaClient');
const prisma = getPrismaClient();

function getMealPriceAtDate(dateStr, history, activePrice) {
    if (!history || history.length === 0) {
        return activePrice;
    }
    const targetDate = new Date(dateStr);
    for (const log of history) {
        const changeDate = new Date(log.change_date);
        if (changeDate > targetDate) {
            return log.old_price;
        }
    }
    return activePrice;
}

async function getTransactions(companyId, isArchived = 0) {
    try {
        let data = await prisma.transactions.findMany({
            where: { company_id: parseInt(companyId), is_archived: isArchived },
            orderBy: [{ date: 'desc' }, { id: 'desc' }]
        });
        
        // Filter out personnel payments that are not CASH
        data = data.filter(tx => {
            const isPersonnel = tx.category && tx.category.startsWith('SALARY_PAYMENT_');
            if (isPersonnel && tx.method !== 'CASH') {
                return false;
            }
            return true;
        });

        return { success: true, data: JSON.parse(JSON.stringify(data)) };
    } catch (error) { return { success: false, error: error.message }; }
}

async function createTransaction(data) {
    try {
        const result = await prisma.transactions.create({
            data: {
                company_id: parseInt(data.companyId),
                type: data.type,
                method: data.method || 'CASH',
                amount: parseFloat(data.amount),
                currency: data.currency || 'TRY',
                date: new Date(data.date),
                category: data.category || null,
                description: data.description || null,
                check_number: data.checkNumber || null,
                check_due_date: data.checkDueDate ? new Date(data.checkDueDate) : null,
                status: data.status || 'COMPLETED'
            }
        });
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateTransaction(data) {
    try {
        const result = await prisma.transactions.update({
            where: { id: parseInt(data.id) },
            data: {
                type: data.type,
                method: data.method,
                amount: parseFloat(data.amount),
                currency: data.currency,
                date: new Date(data.date),
                category: data.category || null,
                description: data.description || null,
                check_number: data.checkNumber || null,
                check_due_date: data.checkDueDate ? new Date(data.checkDueDate) : null,
                status: data.status
            }
        });
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function deleteTransaction(id) {
    try {
        const tx = await prisma.transactions.findUnique({ where: { id: parseInt(id) } });
        
        await prisma.transactions.delete({ where: { id: parseInt(id) } });
        
        // If this was a tahsilat payment linked to a work, revert the work status
        if (tx && tx.category && tx.category.startsWith('WORK_PAYMENT_')) {
            const workId = parseInt(tx.category.replace('WORK_PAYMENT_', ''));
            if (!isNaN(workId)) {
                await prisma.works.update({ where: { id: workId }, data: { status: 'completed' } });
            }
        }

        // If this was a salary payment, delete it from salaries to keep them synced
        if (tx && tx.category && tx.category.startsWith('SALARY_PAYMENT_')) {
            const salaryId = parseInt(tx.category.replace('SALARY_PAYMENT_', ''));
            if (!isNaN(salaryId)) {
                await prisma.salaries.delete({ where: { id: salaryId } }).catch(e => console.log('Salary might already be deleted'));
            }
        }

        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

// ========== MEAL TICKETS ==========
async function getMealTickets(companyId, isArchived = 0) {
    try {
        const tickets = await prisma.meal_tickets.findMany({
            where: { company_id: parseInt(companyId), is_archived: isArchived },
            orderBy: [{ date: 'desc' }, { id: 'desc' }]
        });
        const settings = await prisma.meal_settings.findUnique({
            where: { company_id: parseInt(companyId) }
        });
        const pricePerPerson = settings ? settings.price_per_person : 0;

        const history = await prisma.meal_price_history.findMany({
            where: { company_id: parseInt(companyId) },
            orderBy: { change_date: 'asc' }
        });

        const mapped = tickets.map(ticket => {
            const histPrice = getMealPriceAtDate(ticket.date, history, pricePerPerson);
            return {
                ...ticket,
                price_per_person: ticket.price_per_person !== null && ticket.price_per_person !== undefined && ticket.price_per_person !== 0
                    ? ticket.price_per_person
                    : histPrice
            };
        });

        return { success: true, data: JSON.parse(JSON.stringify(mapped)) };
    } catch (error) { return { success: false, error: error.message }; }
}

async function addMealTicket(data) {
    try {
        const history = await prisma.meal_price_history.findMany({
            where: { company_id: parseInt(data.companyId) },
            orderBy: { change_date: 'asc' }
        });
        const settings = await prisma.meal_settings.findUnique({
            where: { company_id: parseInt(data.companyId) }
        });
        const activePrice = settings ? settings.price_per_person : 0;
        const histPrice = getMealPriceAtDate(data.date, history, activePrice);

        const price = data.pricePerPerson !== undefined && data.pricePerPerson !== null && parseFloat(data.pricePerPerson) !== 0
            ? parseFloat(data.pricePerPerson)
            : histPrice;

        const result = await prisma.meal_tickets.create({
            data: {
                company_id: parseInt(data.companyId),
                date: new Date(data.date),
                person_count: parseInt(data.personCount),
                price_per_person: price,
                notes: data.notes || null,
                created_at: new Date()
            }
        });
        return { success: true, id: result.id };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateMealTicket(data) {
    try {
        const existing = await prisma.meal_tickets.findUnique({
            where: { id: parseInt(data.id) }
        });
        if (!existing) {
            return { success: false, error: 'Kayıt bulunamadı' };
        }

        const date = new Date(data.date);
        const history = await prisma.meal_price_history.findMany({
            where: { company_id: existing.company_id },
            orderBy: { change_date: 'asc' }
        });
        const settings = await prisma.meal_settings.findUnique({
            where: { company_id: existing.company_id }
        });
        const activePrice = settings ? settings.price_per_person : 0;
        const histPrice = getMealPriceAtDate(date, history, activePrice);

        const updateData = {
            date: date,
            person_count: parseInt(data.personCount),
            notes: data.notes || null
        };

        if (existing.price_per_person === 0 || existing.price_per_person === null || existing.date.getTime() !== date.getTime()) {
            updateData.price_per_person = histPrice;
        }

        if (data.pricePerPerson !== undefined && data.pricePerPerson !== null) {
            updateData.price_per_person = parseFloat(data.pricePerPerson);
        }

        await prisma.meal_tickets.update({
            where: { id: parseInt(data.id) },
            data: updateData
        });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

async function deleteMealTicket(id) {
    try {
        await prisma.meal_tickets.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getMealPrice(companyId) {
    try {
        const row = await prisma.meal_settings.findUnique({
            where: { company_id: parseInt(companyId) }
        });
        return { success: true, data: row || { price_per_person: 0 } };
    } catch (error) { return { success: false, error: error.message }; }
}

async function setMealPrice(data) {
    try {
        const cid = parseInt(data.companyId);
        const price = parseFloat(data.pricePerPerson);
        const changeDate = data.changeDate ? new Date(data.changeDate) : new Date();
        
        // Find existing price to record history
        const existing = await prisma.meal_settings.findUnique({
            where: { company_id: cid }
        });
        const oldPrice = existing ? existing.price_per_person : 0;
        
        // Update price
        await prisma.meal_settings.upsert({
            where: { company_id: cid },
            create: { company_id: cid, price_per_person: price, created_at: changeDate },
            update: { price_per_person: price, created_at: changeDate }
        });
        
        // Record price history if price changed
        if (oldPrice !== price) {
            await prisma.meal_price_history.create({
                data: {
                    company_id: cid,
                    old_price: oldPrice,
                    new_price: price,
                    change_date: changeDate
                }
            });
        }
        
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateMealPriceHistory(data) {
    try {
        await prisma.meal_price_history.update({
            where: { id: parseInt(data.id) },
            data: {
                old_price: parseFloat(data.price),
                change_date: new Date(data.date)
            }
        });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getMealPriceHistory(companyId) {
    try {
        const history = await prisma.meal_price_history.findMany({
            where: { company_id: parseInt(companyId) },
            orderBy: { change_date: 'desc' }
        });
        return { success: true, data: JSON.parse(JSON.stringify(history)) };
    } catch (error) { return { success: false, error: error.message }; }
}

async function deleteMealPriceHistory(id) {
    try {
        await prisma.meal_price_history.delete({
            where: { id: parseInt(id) }
        });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getMealTicketStats(companyId) {
    try {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const todayStr = now.toISOString().split('T')[0];

        const allTickets = await prisma.meal_tickets.findMany({
            where: { company_id: parseInt(companyId) }
        });
        const settings = await prisma.meal_settings.findUnique({
            where: { company_id: parseInt(companyId) }
        });
        const pricePerPerson = settings ? settings.price_per_person : 0;

        const history = await prisma.meal_price_history.findMany({
            where: { company_id: parseInt(companyId) },
            orderBy: { change_date: 'asc' }
        });

        let totalThisMonth = 0;
        let todayCount = 0;
        let ticketCountThisMonth = 0;
        let totalCostThisMonth = 0;

        allTickets.forEach(ticket => {
            const tDate = new Date(ticket.date);
            const histPrice = getMealPriceAtDate(ticket.date, history, pricePerPerson);
            const ticketPrice = ticket.price_per_person !== null && ticket.price_per_person !== undefined && ticket.price_per_person !== 0
                ? ticket.price_per_person
                : histPrice;

            if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
                totalThisMonth += ticket.person_count;
                ticketCountThisMonth++;
                totalCostThisMonth += ticket.person_count * ticketPrice;
            }
            const dateStr = tDate.toISOString().split('T')[0];
            if (dateStr === todayStr) {
                todayCount += ticket.person_count;
            }
        });

        return {
            success: true,
            data: {
                totalThisMonth,
                todayCount,
                ticketCountThisMonth,
                pricePerPerson,
                totalCostThisMonth
            }
        };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getMealTicketReport(companyId, month, year) {
    try {
        const allTickets = await prisma.meal_tickets.findMany({
            where: { company_id: parseInt(companyId), is_archived: 0 },
            orderBy: [{ date: 'asc' }, { id: 'asc' }]
        });
        const settings = await prisma.meal_settings.findUnique({
            where: { company_id: parseInt(companyId) }
        });
        const pricePerPerson = settings ? settings.price_per_person : 0;

        const history = await prisma.meal_price_history.findMany({
            where: { company_id: parseInt(companyId) },
            orderBy: { change_date: 'asc' }
        });

        const filtered = allTickets.filter(ticket => {
            const d = new Date(ticket.date);
            return d.getMonth() === parseInt(month) && d.getFullYear() === parseInt(year);
        });

        let totalPersons = 0;
        let totalCost = 0;

        const mappedFiltered = filtered.map(ticket => {
            const histPrice = getMealPriceAtDate(ticket.date, history, pricePerPerson);
            const ticketPrice = ticket.price_per_person !== null && ticket.price_per_person !== undefined && ticket.price_per_person !== 0
                ? ticket.price_per_person
                : histPrice;

            totalPersons += ticket.person_count;
            totalCost += ticket.person_count * ticketPrice;

            return {
                ...ticket,
                price_per_person: ticketPrice
            };
        });

        return {
            success: true,
            data: {
                tickets: mappedFiltered,
                totalPersons,
                pricePerPerson,
                totalCost,
                ticketCount: filtered.length,
                month,
                year
            }
        };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getFinanceStats(companyId) {
    try {
        const allTxs = await prisma.transactions.findMany({
            where: { company_id: parseInt(companyId), is_archived: 0 }
        });

        let totalBalance = 0;
        let cashBalance = 0;
        let pendingChecks = 0;
        let currentMonthOut = 0;
        let currentMonthIn = 0;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        allTxs.forEach(tx => {
            const isPersonnel = tx.category && tx.category.startsWith('SALARY_PAYMENT_');
            if (isPersonnel && tx.method !== 'CASH') return;

            const isIncome = tx.type === 'IN';
            const val = isIncome ? Number(tx.amount) : -Number(tx.amount);

            if (tx.status === 'COMPLETED') {
                totalBalance += val;
                if (tx.method === 'CASH') {
                    cashBalance += val;
                }
            }

            if (tx.method === 'CHECK' && tx.status === 'PENDING' && isIncome) {
                pendingChecks += Number(tx.amount);
            }

            const txDate = new Date(tx.date);
            if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
                if (isIncome) {
                    currentMonthIn += Number(tx.amount);
                } else {
                    currentMonthOut += Number(tx.amount);
                }
            }
        });

        return {
            success: true,
            data: { totalBalance, cashBalance, pendingChecks, currentMonthIn, currentMonthOut }
        };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getChecksAndNotes(companyId, isArchived = 0) {
    try {
        const checks = await prisma.transactions.findMany({
            where: { company_id: parseInt(companyId), method: 'CHECK', is_archived: isArchived },
            orderBy: [{ check_due_date: 'asc' }, { id: 'asc' }]
        });
        return { success: true, data: JSON.parse(JSON.stringify(checks)) };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateCheckStatus(id, newStatus) {
    try {
        await prisma.transactions.updateMany({
            where: { id: parseInt(id), method: 'CHECK' },
            data: { status: newStatus }
        });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getTransactionById(id) {
    try {
        const tx = await prisma.transactions.findUnique({
            where: { id: parseInt(id) }
        });
        return { success: true, data: tx };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    getTransactions, getTransactionById, createTransaction, updateTransaction, deleteTransaction,
    getMealTickets, addMealTicket, updateMealTicket, deleteMealTicket,
    getMealPrice, setMealPrice, getMealPriceHistory, deleteMealPriceHistory, updateMealPriceHistory, getMealTicketStats, getMealTicketReport,
    getFinanceStats, getChecksAndNotes, updateCheckStatus
};
