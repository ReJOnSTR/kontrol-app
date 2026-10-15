const { getPrismaClient } = require('../prismaClient');
const prisma = getPrismaClient();

const getFilePathString = (filePath) => {
    if (!filePath) return null;
    if (typeof filePath === 'string') return filePath;
    if (typeof filePath === 'object' && filePath.path) return String(filePath.path);
    return null;
};

// ========== INSPECTIONS ==========
async function getInspections(vehicleId) {
    try {
        const data = await prisma.inspections.findMany({
            where: { vehicle_id: vehicleId },
            orderBy: [{ inspection_date: 'desc' }, { id: 'desc' }],
            include: { vehicles: true }
        });
        const mapped = data.map(d => ({ ...d, plate: d.vehicles?.plate, vehicle_plate: d.vehicles?.plate, model: d.vehicles?.model, brand: d.vehicles?.brand }));
        return { success: true, data: mapped };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getAllInspections(companyId, type, isArchived) {
    try {
        const where = { vehicles: { company_id: parseInt(companyId) }, is_archived: isArchived ? 1 : 0 };
        if (type !== 'all') where.type = type;
        const data = await prisma.inspections.findMany({
            where,
            include: { vehicles: true },
            orderBy: [{ inspection_date: 'desc' }, { id: 'desc' }]
        });
        const mapped = data.map(d => ({ ...d, plate: d.vehicles?.plate, vehicle_plate: d.vehicles?.plate, model: d.vehicles?.model, brand: d.vehicles?.brand }));
        return { success: true, data: mapped };
    } catch (error) { return { success: false, error: error.message }; }
}

async function createInspection(data) {
    try {
        const { filePath, fileData, fileName, ...rest } = data;
        // Archive any existing active inspection of the same type for this vehicle
        const existingRecord = await prisma.inspections.findFirst({
            where: {
                vehicle_id: parseInt(rest.vehicleId),
                type: rest.type,
                is_archived: 0
            }
        });

        if (existingRecord) {
            await prisma.inspections.update({
                where: { id: existingRecord.id },
                data: { is_archived: 1 }
            });
        }

        const result = await prisma.inspections.create({
            data: {
                vehicle_id: parseInt(rest.vehicleId),
                type: rest.type,
                inspection_date: new Date(rest.date || rest.inspectionDate),
                next_inspection: rest.validUntil || rest.nextInspection ? new Date(rest.validUntil || rest.nextInspection) : null,
                result: rest.result || null,
                cost: rest.cost ? parseFloat(rest.cost) : 0,
                notes: rest.notes || null,
                file_path: getFilePathString(filePath)
            }
        });

        if (filePath || fileData) {
            const { syncOperationDocument } = require('./operationSync.helper');
            await syncOperationDocument('inspection', result.id, {
                vehicleId: rest.vehicleId,
                filePath,
                fileData,
                fileName,
                type: rest.type,
                date: rest.date || rest.inspectionDate,
                validUntil: rest.validUntil || rest.nextInspection
            });
        }

        const fresh = await prisma.inspections.findUnique({ where: { id: result.id } });
        return { success: true, data: fresh };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateInspection(data) {
    try {
        const { id, vehicleId, filePath, fileData, fileName, ...rest } = data;
        const result = await prisma.inspections.update({
            where: { id: parseInt(id) },
            data: {
                type: rest.type,
                inspection_date: new Date(rest.date || rest.inspectionDate),
                next_inspection: rest.validUntil || rest.nextInspection ? new Date(rest.validUntil || rest.nextInspection) : null,
                result: rest.result || null,
                cost: rest.cost ? parseFloat(rest.cost) : 0,
                notes: rest.notes || null
            }
        });

        if (filePath !== undefined || fileData !== undefined) {
            const { syncOperationDocument } = require('./operationSync.helper');
            await syncOperationDocument('inspection', result.id, {
                vehicleId: vehicleId || result.vehicle_id,
                filePath,
                fileData,
                fileName,
                type: rest.type || result.type,
                date: rest.date || rest.inspectionDate,
                validUntil: rest.validUntil || rest.nextInspection
            });
        }

        const fresh = await prisma.inspections.findUnique({ where: { id: result.id } });
        return { success: true, data: fresh };
    } catch (error) { return { success: false, error: error.message }; }
}

async function deleteInspection(id, companyId = null) {
    try {
        const item = await prisma.inspections.findUnique({
            where: { id: parseInt(id) },
            include: { vehicles: { select: { company_id: true } } }
        });
        if (!item) return { success: false, error: 'Kayıt bulunamadı' };
        if (companyId && item.vehicles?.company_id !== parseInt(companyId)) {
            return { success: false, error: 'Bu kaydı silme yetkiniz yok.' };
        }
        const { deleteOperationDocument } = require('./operationSync.helper');
        await deleteOperationDocument('inspection', id);
        await prisma.inspections.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

// ========== INSURANCES ==========
async function getInsurances(vehicleId) {
    try {
        const data = await prisma.insurances.findMany({
            where: { vehicle_id: vehicleId },
            orderBy: [{ start_date: 'desc' }, { id: 'desc' }],
            include: { vehicles: true }
        });
        const mapped = data.map(d => ({ ...d, plate: d.vehicles?.plate, vehicle_plate: d.vehicles?.plate, model: d.vehicles?.model, brand: d.vehicles?.brand }));
        return { success: true, data: mapped };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getAllInsurances(companyId, isArchived) {
    try {
        const data = await prisma.insurances.findMany({
            where: { vehicles: { company_id: parseInt(companyId) }, is_archived: isArchived ? 1 : 0 },
            include: { vehicles: true },
            orderBy: [{ start_date: 'desc' }, { id: 'desc' }]
        });
        const mapped = data.map(d => ({ ...d, plate: d.vehicles?.plate, vehicle_plate: d.vehicles?.plate, model: d.vehicles?.model, brand: d.vehicles?.brand }));
        return { success: true, data: mapped };
    } catch (error) { return { success: false, error: error.message }; }
}

async function createInsurance(data) {
    try {
        const { filePath, fileData, fileName, ...rest } = data;
        // Archive any existing active insurance of the same type for this vehicle
        const existingRecord = await prisma.insurances.findFirst({
            where: {
                vehicle_id: parseInt(rest.vehicleId),
                type: rest.type,
                is_archived: 0
            }
        });

        if (existingRecord) {
            await prisma.insurances.update({
                where: { id: existingRecord.id },
                data: { is_archived: 1 }
            });
        }

        const result = await prisma.insurances.create({
            data: {
                vehicle_id: parseInt(rest.vehicleId),
                type: rest.type,
                policy_no: rest.policyNo || null,
                company: rest.company || null,
                start_date: new Date(rest.startDate),
                end_date: rest.endDate ? new Date(rest.endDate) : new Date(rest.startDate),
                premium: rest.premium ? parseFloat(rest.premium) : 0,
                notes: rest.notes || null,
                file_path: getFilePathString(filePath)
            }
        });

        if (filePath || fileData) {
            const { syncOperationDocument } = require('./operationSync.helper');
            await syncOperationDocument('insurance', result.id, {
                vehicleId: rest.vehicleId,
                filePath,
                fileData,
                fileName,
                type: rest.type,
                startDate: rest.startDate,
                endDate: rest.endDate
            });
        }

        const fresh = await prisma.insurances.findUnique({ where: { id: result.id } });
        return { success: true, data: fresh };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateInsurance(data) {
    try {
        const { id, vehicleId, filePath, fileData, fileName, ...rest } = data;
        const result = await prisma.insurances.update({
            where: { id: parseInt(id) },
            data: {
                type: rest.type,
                policy_no: rest.policyNo || null,
                company: rest.company || null,
                start_date: new Date(rest.startDate),
                end_date: rest.endDate ? new Date(rest.endDate) : new Date(rest.startDate),
                premium: rest.premium ? parseFloat(rest.premium) : 0,
                notes: rest.notes || null
            }
        });

        if (filePath !== undefined || fileData !== undefined) {
            const { syncOperationDocument } = require('./operationSync.helper');
            await syncOperationDocument('insurance', result.id, {
                vehicleId: vehicleId || result.vehicle_id,
                filePath,
                fileData,
                fileName,
                type: rest.type || result.type,
                startDate: rest.startDate,
                endDate: rest.endDate
            });
        }

        const fresh = await prisma.insurances.findUnique({ where: { id: result.id } });
        return { success: true, data: fresh };
    } catch (error) { return { success: false, error: error.message }; }
}

async function deleteInsurance(id, companyId = null) {
    try {
        const item = await prisma.insurances.findUnique({
            where: { id: parseInt(id) },
            include: { vehicles: { select: { company_id: true } } }
        });
        if (!item) return { success: false, error: 'Kayıt bulunamadı' };
        if (companyId && item.vehicles?.company_id !== parseInt(companyId)) {
            return { success: false, error: 'Bu kaydı silme yetkiniz yok.' };
        }
        const { deleteOperationDocument } = require('./operationSync.helper');
        await deleteOperationDocument('insurance', id);
        await prisma.insurances.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

// ========== ASSIGNMENTS ==========
async function getAssignments(vehicleId) {
    try {
        const data = await prisma.assignments.findMany({
            where: { vehicle_id: vehicleId },
            orderBy: [{ start_date: 'desc' }, { id: 'desc' }],
            include: { vehicles: true }
        });
        const mapped = data.map(d => ({
            ...d,
            plate: d.vehicles?.plate,
            employee_name: d.assigned_to || null
        }));
        return { success: true, data: mapped };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getAllAssignments(companyId, isArchived) {
    try {
        const data = await prisma.assignments.findMany({
            where: { vehicles: { company_id: parseInt(companyId) }, is_archived: isArchived ? 1 : 0 },
            include: { vehicles: true },
            orderBy: [{ start_date: 'desc' }, { id: 'desc' }]
        });
        const mapped = data.map(d => ({
            ...d,
            plate: d.vehicles?.plate,
            vehicle_plate: d.vehicles?.plate,
            brand: d.vehicles?.brand,
            model: d.vehicles?.model,
            employee_name: d.assigned_to || null
        }));
        return { success: true, data: mapped };
    } catch (error) { return { success: false, error: error.message }; }
}

async function createAssignment(data) {
    try {
        const result = await prisma.assignments.create({
            data: {
                vehicle_id: data.vehicleId,
                item_name: data.itemName || 'Araç Zimmeti',
                quantity: data.quantity ? parseInt(data.quantity) : 1,
                assigned_to: data.assignedTo || data.employeeName || null,
                department: data.department || null,
                start_date: new Date(data.startDate),
                end_date: data.endDate ? new Date(data.endDate) : null,
                notes: data.notes || null
            }
        });
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateAssignment(data) {
    try {
        const { id, vehicleId, ...rest } = data;
        const result = await prisma.assignments.update({
            where: { id: parseInt(id) },
            data: {
                item_name: rest.itemName || 'Araç Zimmeti',
                quantity: rest.quantity ? parseInt(rest.quantity) : 1,
                assigned_to: rest.assignedTo || rest.employeeName || null,
                department: rest.department || null,
                start_date: new Date(rest.startDate),
                end_date: rest.endDate ? new Date(rest.endDate) : null,
                notes: rest.notes || null
            }
        });
        return { success: true, data: result };
    } catch (error) { return { success: false, error: error.message }; }
}

async function deleteAssignment(id, companyId = null) {
    try {
        const item = await prisma.assignments.findUnique({
            where: { id: parseInt(id) },
            include: { vehicles: { select: { company_id: true } } }
        });
        if (!item) return { success: false, error: 'Kayıt bulunamadı' };
        if (companyId && item.vehicles?.company_id !== parseInt(companyId)) {
            return { success: false, error: 'Bu kaydı silme yetkiniz yok.' };
        }
        await prisma.assignments.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

// ========== SERVICES ==========
async function getServices(vehicleId) {
    try {
        const data = await prisma.services.findMany({
            where: { vehicle_id: vehicleId },
            orderBy: [{ date: 'desc' }, { id: 'desc' }],
            include: { vehicles: true }
        });
        const mapped = data.map(d => ({ ...d, plate: d.vehicles?.plate }));
        return { success: true, data: mapped };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getAllServices(companyId, isArchived) {
    try {
        const data = await prisma.services.findMany({
            where: { vehicles: { company_id: parseInt(companyId) }, is_archived: isArchived ? 1 : 0 },
            include: { vehicles: true },
            orderBy: [{ date: 'desc' }, { id: 'desc' }]
        });
        const mapped = data.map(d => ({
            ...d,
            plate: d.vehicles?.plate,
            vehicle_plate: d.vehicles?.plate,
            brand: d.vehicles?.brand,
            model: d.vehicles?.model
        }));
        return { success: true, data: mapped };
    } catch (error) { return { success: false, error: error.message }; }
}

async function createService(data) {
    try {
        const { filePath, fileData, fileName, ...rest } = data;
        const result = await prisma.services.create({
            data: {
                vehicle_id: parseInt(rest.vehicleId),
                type: rest.type,
                description: rest.description || null,
                date: new Date(rest.date),
                cost: rest.cost ? parseFloat(rest.cost) : 0,
                km: rest.km ? parseInt(rest.km) : null,
                notes: rest.notes || null,
                file_path: getFilePathString(filePath)
            }
        });

        if (filePath || fileData) {
            const { syncOperationDocument } = require('./operationSync.helper');
            await syncOperationDocument('service', result.id, {
                vehicleId: rest.vehicleId,
                filePath,
                fileData,
                fileName,
                date: rest.date
            });
        }

        const fresh = await prisma.services.findUnique({ where: { id: result.id } });
        return { success: true, data: fresh };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateService(data) {
    try {
        const { id, vehicleId, filePath, fileData, fileName, ...rest } = data;
        const result = await prisma.services.update({
            where: { id: parseInt(id) },
            data: {
                type: rest.type,
                description: rest.description || null,
                date: new Date(rest.date),
                cost: rest.cost ? parseFloat(rest.cost) : 0,
                km: rest.km ? parseInt(rest.km) : null,
                notes: rest.notes || null
            }
        });

        if (filePath !== undefined || fileData !== undefined) {
            const { syncOperationDocument } = require('./operationSync.helper');
            await syncOperationDocument('service', result.id, {
                vehicleId: vehicleId || result.vehicle_id,
                filePath,
                fileData,
                fileName,
                date: rest.date
            });
        }

        const fresh = await prisma.services.findUnique({ where: { id: result.id } });
        return { success: true, data: fresh };
    } catch (error) { return { success: false, error: error.message }; }
}

async function deleteService(id, companyId = null) {
    try {
        const item = await prisma.services.findUnique({
            where: { id: parseInt(id) },
            include: { vehicles: { select: { company_id: true } } }
        });
        if (!item) return { success: false, error: 'Kayıt bulunamadı' };
        if (companyId && item.vehicles?.company_id !== parseInt(companyId)) {
            return { success: false, error: 'Bu kaydı silme yetkiniz yok.' };
        }
        const { deleteOperationDocument } = require('./operationSync.helper');
        await deleteOperationDocument('service', id);
        await prisma.services.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

module.exports = {
    getInspections, getAllInspections, createInspection, updateInspection, deleteInspection,
    getInsurances, getAllInsurances, createInsurance, updateInsurance, deleteInsurance,
    getAssignments, getAllAssignments, createAssignment, updateAssignment, deleteAssignment,
    getServices, getAllServices, createService, updateService, deleteService
};
