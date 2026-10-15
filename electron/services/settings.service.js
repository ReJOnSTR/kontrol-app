const { getPrismaClient } = require('../prismaClient');
const prisma = getPrismaClient();

async function getDashboardStats(companyId) {
    try {
        const cid = parseInt(companyId);

        // Count queries
        const totalVehicles = await prisma.vehicles.count({ where: { company_id: cid, is_archived: 0 } });
        const activeVehicles = await prisma.vehicles.count({ where: { company_id: cid, status: 'active', is_archived: 0 } });
        const totalEmployees = await prisma.employees.count({ where: { company_id: cid, status: 'active' } });

        // Status breakdown
        const passiveVehicles = await prisma.vehicles.count({ where: { company_id: cid, status: { in: ['passive', 'sold'] }, is_archived: 0 } });
        const maintenanceVehicles = await prisma.vehicles.count({ where: { company_id: cid, status: 'maintenance', is_archived: 0 } });

        // Vehicle type breakdown
        const typeBreakdownRaw = await prisma.vehicles.groupBy({
            by: ['type'],
            where: { company_id: cid, is_archived: 0 },
            _count: { _all: true }
        });
        const typeBreakdown = typeBreakdownRaw.map(item => ({
            type: item.type || 'Belirtilmemiş',
            count: item._count._all
        })).sort((a, b) => b.count - a.count);

        // Current month bounds
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Maintenance cost this month
        let maintenanceCost = 0;
        try {
            const maints = await prisma.maintenances.aggregate({
                _sum: { cost: true },
                where: { vehicles: { company_id: cid }, date: { gte: startOfMonth }, is_archived: 0 }
            });
            maintenanceCost = maints._sum.cost || 0;
        } catch (e) { console.error('Dashboard maintenances aggregate error:', e.message); }

        // Service cost this month
        let serviceCost = 0;
        try {
            const servs = await prisma.services.aggregate({
                _sum: { cost: true },
                where: { vehicles: { company_id: cid }, date: { gte: startOfMonth }, is_archived: 0 }
            });
            serviceCost = servs._sum.cost || 0;
        } catch (e) { console.error('Dashboard services aggregate error:', e.message); }

        // Inspection cost this month (field is inspection_date, NOT date)
        let inspectionCost = 0;
        try {
            const insps = await prisma.inspections.aggregate({
                _sum: { cost: true },
                where: { vehicles: { company_id: cid }, inspection_date: { gte: startOfMonth }, is_archived: 0 }
            });
            inspectionCost = insps._sum.cost || 0;
        } catch (e) { console.error('Dashboard inspections aggregate error:', e.message); }

        // Insurance premium this month
        let insuranceCost = 0;
        try {
            const ins = await prisma.insurances.aggregate({
                _sum: { premium: true },
                where: { vehicles: { company_id: cid }, start_date: { gte: startOfMonth }, is_archived: 0 }
            });
            insuranceCost = ins._sum.premium || 0;
        } catch (e) { console.error('Dashboard insurances aggregate error:', e.message); }

        // Active assignments count
        let activeAssignments = 0;
        try {
            activeAssignments = await prisma.assignments.count({
                where: { vehicles: { company_id: cid, is_archived: 0 }, is_archived: 0 }
            });
        } catch (e) { console.error('Dashboard activeAssignments aggregate error:', e.message); }

        const currentMonthCost = maintenanceCost + serviceCost + inspectionCost + insuranceCost;

        return {
            success: true, data: {
                totalVehicles,
                activeVehicles,
                activeAssignments,
                totalEmployees,
                monthlyCost: currentMonthCost,
                statusBreakdown: {
                    active: activeVehicles,
                    passive: passiveVehicles,
                    maintenance: maintenanceVehicles
                },
                typeBreakdown,
                costDistribution: {
                    service: serviceCost,
                    maintenance: maintenanceCost,
                    inspection: inspectionCost,
                    insurance: insuranceCost
                }
            }
        };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getUpcomingEvents(companyId) {
    try {
        const cid = parseInt(companyId);
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 30); // Next 30 days

        const events = [];

        // 1. Get Inspections
        try {
            const inspections = await prisma.inspections.findMany({
                where: { vehicles: { company_id: cid, is_archived: 0 }, next_inspection: { lte: futureDate }, is_archived: 0 },
                include: { vehicles: true }
            });
            inspections.filter(i => i.vehicles && i.vehicles.is_archived !== 1).forEach(i => {
                if (i.next_inspection) {
                    events.push({
                        id: i.id,
                        eventType: 'inspection',
                        type: i.type === 'traffic' ? 'Tüvtürk Muayene' : 'Periyodik Kontrol',
                        date: i.next_inspection,
                        vehicleId: i.vehicle_id,
                        plate: i.vehicles?.plate,
                        brand: i.vehicles?.brand,
                        model: i.vehicles?.model
                    });
                }
            });
        } catch (e) { console.error('getUpcomingEvents inspections error:', e.message); }

        // 2. Get Insurances
        try {
            const insurances = await prisma.insurances.findMany({
                where: { vehicles: { company_id: cid, is_archived: 0 }, end_date: { lte: futureDate }, is_archived: 0 },
                include: { vehicles: true }
            });
            insurances.filter(i => i.vehicles && i.vehicles.is_archived !== 1).forEach(i => {
                if (i.end_date) {
                    events.push({
                        id: i.id,
                        eventType: 'insurance',
                        type: i.type === 'traffic' ? 'Trafik Sigortası' : 'Kasko',
                        date: i.end_date,
                        vehicleId: i.vehicle_id,
                        plate: i.vehicles?.plate,
                        brand: i.vehicles?.brand,
                        model: i.vehicles?.model
                    });
                }
            });
        } catch (e) { console.error('getUpcomingEvents insurances error:', e.message); }

        // 3. Get Maintenances
        try {
            const maintenances = await prisma.maintenances.findMany({
                where: { vehicles: { company_id: cid, is_archived: 0 }, next_date: { lte: futureDate }, is_archived: 0 },
                include: { vehicles: true }
            });
            maintenances.filter(m => m.vehicles && m.vehicles.is_archived !== 1).forEach(m => {
                if (m.next_date) {
                    events.push({
                        id: m.id,
                        eventType: 'maintenance',
                        type: 'Araç Bakımı',
                        date: m.next_date,
                        vehicleId: m.vehicle_id,
                        plate: m.vehicles?.plate,
                        brand: m.vehicles?.brand,
                        model: m.vehicles?.model
                    });
                }
            });
        } catch (e) { console.error('getUpcomingEvents maintenances error:', e.message); }
        
        // 4. Get Employee Documents Expiry
        try {
            const empDocs = await prisma.employee_documents.findMany({
                where: {
                    employees: { 
                        company_id: cid,
                        status: 'active',
                        is_archived: { not: 1 }
                    },
                    expiry_date: { lte: futureDate, not: null },
                    is_archived: 0
                },
                include: { employees: true }
            });
            empDocs
                .filter(d => d.employees && d.employees.status === 'active' && d.employees.is_archived !== 1)
                .forEach(d => {
                    events.push({
                        id: d.id,
                        eventType: 'employee_document',
                        type: `Belge Süresi: ${d.category || 'Döküman'}`,
                        date: d.expiry_date,
                        employeeId: d.employee_id,
                        employeeName: `${d.employees?.first_name} ${d.employees?.last_name}`
                    });
                });
        } catch (e) { console.error('getUpcomingEvents employee docs error:', e.message); }

        // 5. Get Upcoming Checks / Notes
        try {
            const checks = await prisma.transactions.findMany({
                where: {
                    company_id: cid,
                    method: 'CHECK',
                    status: 'PENDING',
                    check_due_date: { lte: futureDate, not: null },
                    is_archived: 0
                }
            });
            checks.forEach(c => {
                events.push({
                    id: c.id,
                    eventType: 'finance_check',
                    type: `Çek/Senet Vadesi: ${c.check_number || ''}`,
                    date: c.check_due_date,
                    amount: c.amount,
                    description: c.description
                });
            });
        } catch (e) { console.error('getUpcomingEvents checks error:', e.message); }

        // 6. Pending Approval Center Requests
        try {
            const pendingRequests = await prisma.requests.findMany({
                where: {
                    company_id: cid,
                    status: 'PENDING'
                },
                include: {
                    employee: { select: { first_name: true, last_name: true } }
                }
            });
            pendingRequests.forEach(r => {
                const empName = r.employee ? `${r.employee.first_name || ''} ${r.employee.last_name || ''}`.trim() : 'Personel';
                events.push({
                    id: r.id,
                    eventType: 'approval_center',
                    type: `Onay Bekliyor: ${r.type || 'Talep'}`,
                    date: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
                    employeeName: empName,
                    description: `${empName} - ${r.type || 'Talep'} onayınızı bekliyor.`
                });
            });
        } catch (e) { console.error('getUpcomingEvents approval requests error:', e.message); }

        // Sort by date ascending (closest first)
        events.sort((a, b) => new Date(a.date) - new Date(b.date));

        return { success: true, data: events };
    } catch (error) {
        console.error("Dashboard getUpcomingEvents error:", error);
        return { success: false, error: error.message };
    }
}

async function getRecentActivity(companyId) {
    try {
        const cid = parseInt(companyId);

        // 1. Try real audit logs first
        try {
            const logs = await prisma.audit_logs.findMany({
                where: { company_id: cid },
                orderBy: { created_at: 'desc' },
                take: 10
            });
            if (logs && logs.length > 0) {
                return {
                    success: true,
                    data: logs.map(l => ({
                        id: l.id,
                        description: l.description,
                        date: l.created_at,
                        type: l.action?.toLowerCase() || 'log',
                        entityType: l.entity_type,
                        entityName: l.entity_name,
                        username: l.username
                    }))
                };
            }
        } catch (auditErr) {
            console.error('getRecentActivity audit_logs query error:', auditErr.message);
        }

        // 2. Fallback to recent services if no audit logs exist yet
        const recentServices = await prisma.services.findMany({
            where: { vehicles: { company_id: cid } },
            include: { vehicles: true },
            orderBy: [{ date: 'desc' }, { id: 'desc' }],
            take: 10
        });

        const activities = recentServices.map(s => ({
            id: s.id,
            description: `${s.vehicles?.plate} için ${s.vendor || s.service_name || 'servis'} işlemi.`,
            date: s.date,
            type: 'service'
        }));

        return { success: true, data: activities };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    getDashboardStats, getUpcomingEvents, getRecentActivity
};
