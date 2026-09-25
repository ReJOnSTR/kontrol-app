const { getPrismaClient } = require('../prismaClient');
const prisma = getPrismaClient();

/**
 * Check if a company has exceeded its quota or has an inactive subscription
 * @param {number|string} companyId 
 * @param {'vehicles'|'employees'|'users'} resourceType 
 */
async function checkQuota(companyId, resourceType) {
    if (!companyId) return;
    const compId = parseInt(companyId, 10);
    if (!compId) return;

    const company = await prisma.companies.findUnique({
        where: { id: compId },
        select: {
            id: true,
            name: true,
            plan: true,
            status: true,
            expires_at: true,
            max_vehicles: true,
            max_employees: true,
            max_users: true
        }
    });

    if (!company) return;

    // 1. Check Company Status
    if (company.status === 'suspended') {
        throw new Error(`"${company.name}" şirket hesabı askıya alınmıştır. İşlem gerçekleştiremezsiniz.`);
    }

    // 2. Check Expiry
    if (company.expires_at && new Date(company.expires_at) < new Date()) {
        throw new Error(`"${company.name}" şirketinin lisans süresi dolmuştur (${new Date(company.expires_at).toLocaleDateString('tr-TR')}). Lütfen paketinizi yenileyin.`);
    }

    // 3. Check Specific Resource Quota
    if (resourceType === 'vehicles') {
        const limit = company.max_vehicles || 50;
        const currentCount = await prisma.vehicles.count({
            where: { company_id: compId, is_archived: 0 }
        });
        if (currentCount >= limit) {
            throw new Error(`Araç kotanız dolmuştur (Maksimum: ${limit} araç, Mevcut: ${currentCount}). Yeni araç eklemek için lütfen paketinizi yükseltin.`);
        }
    } else if (resourceType === 'employees') {
        const limit = company.max_employees || 50;
        const currentCount = await prisma.employees.count({
            where: { company_id: compId, is_archived: 0 }
        });
        if (currentCount >= limit) {
            throw new Error(`Personel kotanız dolmuştur (Maksimum: ${limit} personel, Mevcut: ${currentCount}). Yeni personel eklemek için lütfen paketinizi yükseltin.`);
        }
    } else if (resourceType === 'users') {
        const limit = company.max_users || 10;
        // Count users assigned to this company (either direct company owner or employee user)
        const currentCount = await prisma.users.count({
            where: {
                OR: [
                    { employee: { company_id: compId } },
                    { companies: { some: { id: compId } } }
                ],
                is_active: 1
            }
        });
        if (currentCount >= limit) {
            throw new Error(`Kullanıcı kotanız dolmuştur (Maksimum: ${limit} kullanıcı, Mevcut: ${currentCount}). Yeni kullanıcı eklemek için lütfen paketinizi yükseltin.`);
        }
    }
}

/**
 * Get quota and usage overview for a company
 * @param {number|string} companyId 
 */
async function getCompanyQuotas(companyId) {
    const compId = parseInt(companyId, 10);
    if (!compId) return null;

    const company = await prisma.companies.findUnique({
        where: { id: compId },
        select: {
            id: true,
            name: true,
            plan: true,
            status: true,
            expires_at: true,
            max_vehicles: true,
            max_employees: true,
            max_users: true,
            storage_limit_mb: true
        }
    });

    if (!company) return null;

    const [vehicleCount, employeeCount, userCount] = await Promise.all([
        prisma.vehicles.count({ where: { company_id: compId, is_archived: 0 } }),
        prisma.employees.count({ where: { company_id: compId, is_archived: 0 } }),
        prisma.users.count({
            where: {
                OR: [
                    { employee: { company_id: compId } },
                    { companies: { some: { id: compId } } }
                ],
                is_active: 1
            }
        })
    ]);

    const maxVehicles = company.max_vehicles || 50;
    const maxEmployees = company.max_employees || 50;
    const maxUsers = company.max_users || 10;
    const storageLimitMb = company.storage_limit_mb || 1024;

    return {
        companyId: company.id,
        companyName: company.name,
        plan: company.plan || 'PRO',
        status: company.status || 'active',
        expiresAt: company.expires_at,
        isExpired: company.expires_at ? new Date(company.expires_at) < new Date() : false,
        isSuspended: company.status === 'suspended',
        quotas: {
            vehicles: {
                current: vehicleCount,
                max: maxVehicles,
                percent: Math.min(100, Math.round((vehicleCount / maxVehicles) * 100))
            },
            employees: {
                current: employeeCount,
                max: maxEmployees,
                percent: Math.min(100, Math.round((employeeCount / maxEmployees) * 100))
            },
            users: {
                current: userCount,
                max: maxUsers,
                percent: Math.min(100, Math.round((userCount / maxUsers) * 100))
            },
            storage: {
                currentMb: 0,
                maxMb: storageLimitMb,
                percent: 0
            }
        }
    };
}

module.exports = {
    checkQuota,
    getCompanyQuotas
};
