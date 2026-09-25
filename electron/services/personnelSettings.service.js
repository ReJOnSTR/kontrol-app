const { getPrismaClient } = require('../prismaClient');
const prisma = getPrismaClient();

// Departments
async function getDepartments(companyId) {
    try {
        const data = await prisma.departments.findMany({
            where: { company_id: parseInt(companyId) },
            orderBy: { name: 'asc' }
        });
        return { success: true, data };
    } catch (error) { return { success: false, error: error.message }; }
}

async function createDepartment(data) {
    try {
        const result = await prisma.departments.create({
            data: {
                company_id: parseInt(data.companyId),
                name: data.name
            }
        });
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateDepartment(data) {
    try {
        const result = await prisma.departments.update({
            where: { id: parseInt(data.id) },
            data: {
                name: data.name,
                status: data.status !== undefined ? data.status : undefined
            }
        });
        return { success: true, data: result };
    } catch (error) { 
        require('electron-log').error('updateDepartment error:', error);
        return { success: false, error: error.message }; 
    }
}

async function deleteDepartment(id) {
    try {
        await prisma.departments.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

// Leave Types
async function getLeaveTypes(companyId) {
    try {
        const data = await prisma.leave_types.findMany({
            where: { company_id: parseInt(companyId) },
            orderBy: { name: 'asc' }
        });
        return { success: true, data };
    } catch (error) { return { success: false, error: error.message }; }
}

async function createLeaveType(data) {
    try {
        const result = await prisma.leave_types.create({
            data: {
                company_id: parseInt(data.companyId),
                name: data.name
            }
        });
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateLeaveType(data) {
    try {
        const result = await prisma.leave_types.update({
            where: { id: parseInt(data.id) },
            data: {
                name: data.name,
                status: data.status !== undefined ? data.status : undefined
            }
        });
        return { success: true, data: result };
    } catch (error) { 
        require('electron-log').error('updateLeaveType error:', error);
        return { success: false, error: error.message }; 
    }
}

async function deleteLeaveType(id) {
    try {
        await prisma.leave_types.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

// Document Categories
async function getDocumentCategories(companyId, targetType = 'employee') {
    try {
        const data = await prisma.document_categories.findMany({
            where: { 
                company_id: parseInt(companyId),
                target_type: targetType
            },
            orderBy: { name: 'asc' }
        });
        return { success: true, data };
    } catch (error) { return { success: false, error: error.message }; }
}

async function createDocumentCategory(data) {
    try {
        const result = await prisma.document_categories.create({
            data: {
                company_id: parseInt(data.companyId),
                name: data.name,
                target_type: data.targetType || 'employee'
            }
        });
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateDocumentCategory(data) {
    try {
        const oldCat = await prisma.document_categories.findUnique({
            where: { id: parseInt(data.id) }
        });
        const result = await prisma.document_categories.update({
            where: { id: parseInt(data.id) },
            data: {
                name: data.name,
                status: data.status !== undefined ? data.status : undefined
            }
        });
        if (oldCat && data.name && oldCat.name !== data.name) {
            await prisma.documents.updateMany({
                where: { category: oldCat.name },
                data: { category: data.name, doc_type: data.name }
            }).catch(() => {});
        }
        return { success: true, data: result };
    } catch (error) { 
        require('electron-log').error('updateDocumentCategory error:', error);
        return { success: false, error: error.message }; 
    }
}

async function deleteDocumentCategory(id) {
    try {
        await prisma.document_categories.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

// Document Folders
async function getDocumentFolders(companyId, relatedType = null, relatedId = null) {
    try {
        const where = { company_id: parseInt(companyId) };
        if (relatedType && relatedId) {
            where.OR = [
                { related_type: relatedType, related_id: parseInt(relatedId) },
                { related_type: null, related_id: null }
            ];
        }
        const data = await prisma.document_folders.findMany({
            where,
            orderBy: { name: 'asc' }
        });
        return { success: true, data };
    } catch (error) { return { success: false, error: error.message }; }
}

async function createDocumentFolder(data) {
    try {
        const result = await prisma.document_folders.create({
            data: {
                company_id: parseInt(data.companyId),
                name: data.name,
                related_type: data.relatedType || null,
                related_id: data.relatedId ? parseInt(data.relatedId) : null
            }
        });
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateDocumentFolder(data) {
    try {
        const oldFolder = await prisma.document_folders.findUnique({
            where: { id: parseInt(data.id) }
        });
        const result = await prisma.document_folders.update({
            where: { id: parseInt(data.id) },
            data: { name: data.name }
        });
        if (oldFolder && data.name && oldFolder.name !== data.name) {
            await prisma.documents.updateMany({
                where: { folder: oldFolder.name },
                data: { folder: data.name }
            }).catch(() => {});
        }
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function deleteDocumentFolder(id) {
    try {
        await prisma.document_folders.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

// Vehicle Types
async function getVehicleTypes(companyId) {
    try {
        const data = await prisma.vehicle_types.findMany({
            where: { company_id: parseInt(companyId) },
            orderBy: { name: 'asc' }
        });
        return { success: true, data };
    } catch (error) { return { success: false, error: error.message }; }
}

async function createVehicleType(data) {
    try {
        const result = await prisma.vehicle_types.create({
            data: {
                company_id: parseInt(data.companyId),
                name: data.name
            }
        });
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateVehicleType(data) {
    try {
        const result = await prisma.vehicle_types.update({
            where: { id: parseInt(data.id) },
            data: { name: data.name }
        });
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function deleteVehicleType(id) {
    try {
        await prisma.vehicle_types.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

// Public Holidays
async function getPublicHolidays(companyId) {
    try {
        const data = await prisma.public_holidays.findMany({
            where: { company_id: parseInt(companyId) },
            orderBy: { date: 'asc' }
        });
        return { success: true, data };
    } catch (error) { return { success: false, error: error.message }; }
}

async function createPublicHoliday(data) {
    try {
        const result = await prisma.public_holidays.create({
            data: {
                company_id: parseInt(data.companyId),
                date: new Date(data.date),
                description: data.description || null
            }
        });
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updatePublicHoliday(data) {
    try {
        const result = await prisma.public_holidays.update({
            where: { id: parseInt(data.id) },
            data: {
                date: data.date ? new Date(data.date) : undefined,
                description: data.description || null,
                status: data.status !== undefined ? data.status : undefined
            }
        });
        return { success: true, data: result };
    } catch (error) { 
        require('electron-log').error('updatePublicHoliday error:', error);
        return { success: false, error: error.message }; 
    }
}

async function deletePublicHoliday(id) {
    try {
        await prisma.public_holidays.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

module.exports = {
    getDepartments, createDepartment, updateDepartment, deleteDepartment,
    getLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType,
    getDocumentCategories, createDocumentCategory, updateDocumentCategory, deleteDocumentCategory,
    getDocumentFolders, createDocumentFolder, updateDocumentFolder, deleteDocumentFolder,
    getVehicleTypes, createVehicleType, updateVehicleType, deleteVehicleType,
    getPublicHolidays, createPublicHoliday, updatePublicHoliday, deletePublicHoliday
};
