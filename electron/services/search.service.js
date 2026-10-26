const { getPrismaClient } = require('../prismaClient');

/**
 * Normalizes text for Turkish case-insensitive and space-insensitive matching
 */
function normalizeText(str) {
    if (!str || typeof str !== 'string') return '';
    return str.toLocaleLowerCase('tr-TR').trim();
}

function cleanAlphanumeric(str) {
    if (!str || typeof str !== 'string') return '';
    return str.toLocaleLowerCase('tr-TR').replace(/[\s\-_.\/]/g, '');
}

/**
 * Global search across Vehicles, Employees, and Customers
 * @param {number|string} companyId - Active tenant company ID
 * @param {string} query - Search term
 */
async function searchGlobal(companyId, query) {
    if (!query || typeof query !== 'string' || query.trim().length < 1) {
        return { success: true, data: [] };
    }

    try {
        const prisma = getPrismaClient();
        const cid = parseInt(companyId, 10);
        const hasValidCompany = !isNaN(cid) && cid > 0;
        const companyWhere = hasValidCompany ? { company_id: cid } : {};

        const qRaw = query.trim();
        const qLower = normalizeText(qRaw);
        const qAlpha = cleanAlphanumeric(qRaw);

        // Fetch candidates concurrently with targeted lightweight selects
        const [vehicles, employees, customers] = await Promise.all([
            prisma.vehicles.findMany({
                where: {
                    ...companyWhere,
                    OR: [{ is_archived: 0 }, { is_archived: null }]
                },
                select: {
                    id: true,
                    plate: true,
                    brand: true,
                    model: true,
                    type: true,
                    color: true,
                    notes: true,
                    status: true
                },
                take: 150
            }).catch(err => {
                console.error('[SearchService] Vehicle query error:', err?.message || err);
                return [];
            }),

            prisma.employees.findMany({
                where: {
                    ...companyWhere,
                    status: 'active'
                },
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    position: true,
                    department: true,
                    phone: true,
                    tc_no: true
                },
                take: 150
            }).catch(err => {
                console.error('[SearchService] Employee query error:', err?.message || err);
                return [];
            }),

            prisma.customers.findMany({
                where: {
                    ...companyWhere,
                    OR: [{ is_archived: 0 }, { is_archived: null }]
                },
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    tax_office: true,
                    tax_no: true,
                    authorized_person: true
                },
                take: 150
            }).catch(err => {
                console.error('[SearchService] Customer query error:', err?.message || err);
                return [];
            })
        ]);

        const scoredResults = [];

        // 1. Process Vehicles
        if (Array.isArray(vehicles)) {
            for (const v of vehicles) {
                if (!v) continue;
                const plateRaw = v.plate || '';
                const plateLower = normalizeText(plateRaw);
                const plateAlpha = cleanAlphanumeric(plateRaw);

                const brandLower = normalizeText(v.brand || '');
                const modelLower = normalizeText(v.model || '');
                const fullBrandModel = normalizeText(`${v.brand || ''} ${v.model || ''}`);
                const fullBrandModelAlpha = cleanAlphanumeric(fullBrandModel);
                const typeLower = normalizeText(v.type || '');
                const colorLower = normalizeText(v.color || '');
                const notesLower = normalizeText(v.notes || '');

                let score = 0;

                // Exact plate match (highest relevance)
                if (plateAlpha === qAlpha) {
                    score = 120;
                } else if (plateAlpha.startsWith(qAlpha)) {
                    score = 100;
                } else if (plateAlpha.includes(qAlpha)) {
                    score = 80;
                } else if (fullBrandModelAlpha.includes(qAlpha)) {
                    score = 70;
                } else if (brandLower.includes(qLower) || modelLower.includes(qLower)) {
                    score = 60;
                } else if (typeLower.includes(qLower) || colorLower.includes(qLower)) {
                    score = 50;
                } else if (notesLower.includes(qLower)) {
                    score = 30;
                }

                if (score > 0) {
                    const subtitleParts = [];
                    if (v.brand || v.model) subtitleParts.push(`${v.brand || ''} ${v.model || ''}`.trim());
                    if (v.type) subtitleParts.push(v.type);
                    if (v.color) subtitleParts.push(v.color);

                    scoredResults.push({
                        id: v.id,
                        type: 'vehicle',
                        title: v.plate || 'Plakasız Araç',
                        subtitle: subtitleParts.join(' • ') || 'Araç',
                        icon: 'Car',
                        score
                    });
                }
            }
        }

        // 2. Process Employees
        if (Array.isArray(employees)) {
            for (const e of employees) {
                if (!e) continue;
                const firstName = e.first_name || '';
                const lastName = e.last_name || '';
                const fullName = `${firstName} ${lastName}`.trim();
                const fullNameLower = normalizeText(fullName);
                const fullNameAlpha = cleanAlphanumeric(fullName);

                const phoneAlpha = cleanAlphanumeric(e.phone || '');
                const tcNoAlpha = cleanAlphanumeric(e.tc_no || '');
                const positionLower = normalizeText(e.position || '');
                const departmentLower = normalizeText(e.department || '');

                let score = 0;

                if (fullNameAlpha.startsWith(qAlpha)) {
                    score = 95;
                } else if (fullNameAlpha.includes(qAlpha)) {
                    score = 75;
                } else if (tcNoAlpha.includes(qAlpha) && qAlpha.length >= 3) {
                    score = 90;
                } else if (phoneAlpha.includes(qAlpha) && qAlpha.length >= 3) {
                    score = 85;
                } else if (positionLower.includes(qLower) || departmentLower.includes(qLower)) {
                    score = 55;
                }

                if (score > 0) {
                    const subtitleParts = [];
                    if (e.position) subtitleParts.push(e.position);
                    if (e.department) subtitleParts.push(e.department);
                    if (e.phone) subtitleParts.push(e.phone);

                    scoredResults.push({
                        id: e.id,
                        type: 'employee',
                        title: fullName || 'İsimsiz Personel',
                        subtitle: subtitleParts.join(' • ') || 'Personel',
                        icon: 'User',
                        score
                    });
                }
            }
        }

        // 3. Process Customers
        if (Array.isArray(customers)) {
            for (const c of customers) {
                if (!c) continue;
                const name = c.name || '';
                const nameLower = normalizeText(name);
                const nameAlpha = cleanAlphanumeric(name);

                const phoneAlpha = cleanAlphanumeric(c.phone || '');
                const authPersonLower = normalizeText(c.authorized_person || '');
                const taxOfficeLower = normalizeText(c.tax_office || '');
                const taxNoAlpha = cleanAlphanumeric(c.tax_no || '');

                let score = 0;

                if (nameAlpha.startsWith(qAlpha)) {
                    score = 90;
                } else if (nameAlpha.includes(qAlpha)) {
                    score = 70;
                } else if (taxNoAlpha.includes(qAlpha) && qAlpha.length >= 3) {
                    score = 80;
                } else if (phoneAlpha.includes(qAlpha) && qAlpha.length >= 3) {
                    score = 75;
                } else if (authPersonLower.includes(qLower) || taxOfficeLower.includes(qLower)) {
                    score = 50;
                }

                if (score > 0) {
                    const subtitleParts = [];
                    if (c.phone) subtitleParts.push(c.phone);
                    if (c.authorized_person) subtitleParts.push(c.authorized_person);
                    if (c.tax_office) subtitleParts.push(c.tax_office);

                    scoredResults.push({
                        id: c.id,
                        type: 'customer',
                        title: name || 'İsimsiz Müşteri',
                        subtitle: subtitleParts.join(' • ') || 'Müşteri',
                        icon: 'Building2',
                        score
                    });
                }
            }
        }

        // Sort by score descending, then by title ascending
        scoredResults.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.title.localeCompare(b.title, 'tr');
        });

        return {
            success: true,
            data: scoredResults.slice(0, 30)
        };
    } catch (err) {
        console.error('[SearchService] Global search error:', err);
        return { success: false, error: err.message, data: [] };
    }
}

module.exports = {
    searchGlobal
};
