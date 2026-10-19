const { getPrismaClient } = require('../prismaClient');

async function archiveItem(table, id, isArchived = 1) {
    try {
        const prisma = getPrismaClient();
        const mappedModel = table.toLowerCase();

        if (!prisma[mappedModel] || typeof prisma[mappedModel].update !== 'function') {
            return { success: false, error: 'Invalid table for archiving: ' + table };
        }

        const intId = parseInt(id);
        const archiveVal = (isArchived === 1 || isArchived === true || isArchived === '1') ? 1 : 0;

        if (mappedModel === 'employees') {
            await prisma.employees.update({
                where: { id: intId },
                data: { 
                    status: archiveVal ? 'passive' : 'active',
                    is_archived: archiveVal
                }
            });
            return { success: true };
        }

        if (mappedModel === 'works') {
            await prisma.$transaction(async (tx) => {
                await tx.works.update({
                    where: { id: intId },
                    data: { is_archived: archiveVal }
                });
                await tx.work_items.updateMany({
                    where: { work_id: intId },
                    data: { is_archived: archiveVal }
                });
            });
            return { success: true };
        }

        await prisma[mappedModel].update({
            where: { id: intId },
            data: { is_archived: archiveVal }
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function archiveItems(table, ids, isArchived = 1) {
    try {
        if (!ids || !Array.isArray(ids) || ids.length === 0) return { success: true };
        const prisma = getPrismaClient();
        const mappedModel = table.toLowerCase();

        if (!prisma[mappedModel] || typeof prisma[mappedModel].updateMany !== 'function') {
            return { success: false, error: 'Invalid table for bulk archiving: ' + table };
        }

        const intIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (intIds.length === 0) return { success: true };

        const archiveVal = (isArchived === 1 || isArchived === true || isArchived === '1') ? 1 : 0;

        if (mappedModel === 'employees') {
            await prisma.employees.updateMany({
                where: { id: { in: intIds } },
                data: { 
                    status: archiveVal ? 'passive' : 'active',
                    is_archived: archiveVal
                }
            });
            return { success: true };
        }

        if (mappedModel === 'works') {
            await prisma.$transaction(async (tx) => {
                await tx.works.updateMany({
                    where: { id: { in: intIds } },
                    data: { is_archived: archiveVal }
                });
                await tx.work_items.updateMany({
                    where: { work_id: { in: intIds } },
                    data: { is_archived: archiveVal }
                });
            });
            return { success: true };
        }

        await prisma[mappedModel].updateMany({
            where: { id: { in: intIds } },
            data: { is_archived: archiveVal }
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function filesRoot() {
    const path = require('path');
    try { const app = require('electron').app; if (app) return path.join(app.getPath('userData'), 'files'); } catch {}
    return path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'files');
}
async function getCompanyCompleteData(companyId) {
    try { return { success: true, data: await require('./companyBackup').exportSnapshot(getPrismaClient(), companyId, filesRoot()) }; }
    catch (error) { return { success: false, error: error.message }; }
}
async function importCompanyData(userId, backupData) {
    try { return await require('./companyBackup').importSnapshot(getPrismaClient(), userId, backupData, filesRoot()); }
    catch (error) { return { success: false, error: error.message }; }
}

module.exports = {
    archiveItem,
    archiveItems,
    getCompanyCompleteData,
    importCompanyData
};
