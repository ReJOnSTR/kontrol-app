const { getPrismaClient } = require('../prismaClient');
const { logAudit } = require('./audit.service');
const { checkQuota } = require('./quota.service');
const prisma = getPrismaClient();

// ========== VEHICLES ==========

async function getVehicles(companyId, isArchived = 0) {
    try {
        const prisma = getPrismaClient();
        const archiveVal = (isArchived === 1 || isArchived === true || isArchived === '1') ? 1 : 0;
        const vehicles = await prisma.vehicles.findMany({
            where: {
                company_id: parseInt(companyId),
                ...(archiveVal === 1 ? { is_archived: 1 } : { OR: [{ is_archived: 0 }, { is_archived: null }] })
            },
            select: {
                id: true,
                company_id: true,
                type: true,
                plate: true,
                brand: true,
                model: true,
                year: true,
                color: true,
                status: true,
                km: true,
                notes: true,
                is_archived: true,
                created_at: true,
                maintenances: true,
                inspections: true,
                insurances: true,
                services: true
            },
            orderBy: { created_at: 'desc' }
        });

        const formatted = vehicles.map(v => ({
            ...v,
            maintenances_count: v.maintenances.length,
            inspections_count: v.inspections.length,
            services_count: v.services.length
        }));

        return { success: true, data: formatted };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getVehicleById(vehicleId) {
    try {
        const vehicle = await prisma.vehicles.findUnique({
            where: { id: parseInt(vehicleId) }
        });
        return { success: true, data: vehicle };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function createVehicle(data) {
    try {
        const { companyId, type, plate, ...rest } = data;
        await checkQuota(companyId, 'vehicles');

        const existingVehicle = await prisma.vehicles.findFirst({
            where: { company_id: parseInt(companyId), plate: plate, is_archived: 0 }
        });

        if (existingVehicle) {
            await prisma.vehicles.update({
                where: { id: existingVehicle.id },
                data: { is_archived: 1 }
            });
        }

        const vehicle = await prisma.vehicles.create({
            data: {
                company_id: parseInt(companyId),
                type,
                plate,
                brand: rest.brand || null,
                model: rest.model || null,
                year: rest.year ? parseInt(rest.year) : null,
                color: rest.color || null,
                status: rest.status || 'active',
                km: rest.km ? parseInt(rest.km) : 0,
                image: rest.image || null,
                notes: rest.notes || null
            }
        });

        logAudit({
            companyId: vehicle.company_id,
            action: 'CREATE',
            entityType: 'vehicle',
            entityId: String(vehicle.id),
            entityName: `${vehicle.plate}${vehicle.brand ? ` (${vehicle.brand} ${vehicle.model || ''})` : ''}`,
            description: `"${vehicle.plate}" plakalı araç sisteme eklendi`,
            details: { plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model, year: vehicle.year, type: vehicle.type },
            severity: 'info'
        });

        return { success: true, data: vehicle };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateVehicle(data) {
    try {
        const { id, type, plate, ...rest } = data;
        const vehicle = await prisma.vehicles.update({
            where: { id: parseInt(id) },
            data: {
                type,
                plate,
                brand: rest.brand || null,
                model: rest.model || null,
                year: rest.year ? parseInt(rest.year) : null,
                color: rest.color || null,
                status: rest.status || 'active',
                km: rest.km ? parseInt(rest.km) : 0,
                image: rest.image || null,
                notes: rest.notes || null
            }
        });

        logAudit({
            companyId: vehicle.company_id,
            action: 'UPDATE',
            entityType: 'vehicle',
            entityId: String(vehicle.id),
            entityName: `${vehicle.plate}${vehicle.brand ? ` (${vehicle.brand} ${vehicle.model || ''})` : ''}`,
            description: `"${vehicle.plate}" plakalı araç bilgileri güncellendi`,
            severity: 'info'
        });

        return { success: true, data: vehicle };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteVehicle(id) {
    try {
        const vId = parseInt(id);
        const existing = await prisma.vehicles.findUnique({ where: { id: vId } });

        await prisma.$transaction(async (tx) => {
            await tx.maintenances.deleteMany({ where: { vehicle_id: vId } }).catch(() => {});
            await tx.inspections.deleteMany({ where: { vehicle_id: vId } }).catch(() => {});
            await tx.insurances.deleteMany({ where: { vehicle_id: vId } }).catch(() => {});
            await tx.assignments.deleteMany({ where: { vehicle_id: vId } }).catch(() => {});
            await tx.services.deleteMany({ where: { vehicle_id: vId } }).catch(() => {});
            await tx.documents.deleteMany({ where: { vehicle_id: vId } }).catch(() => {});
            await tx.works.deleteMany({ where: { vehicle_id: vId } }).catch(() => {});
            await tx.vehicles.delete({ where: { id: vId } });
        });

        if (existing) {
            logAudit({
                companyId: existing.company_id,
                action: 'DELETE',
                entityType: 'vehicle',
                entityId: String(existing.id),
                entityName: `${existing.plate}${existing.brand ? ` (${existing.brand} ${existing.model || ''})` : ''}`,
                description: `"${existing.plate}" plakalı araç ve tüm bağlı kayıtları (muayene, sigorta, bakım) silindi`,
                severity: 'critical'
            });
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ========== MAINTENANCE ==========

async function getMaintenances(vehicleId) {
    try {
        const data = await prisma.maintenances.findMany({
            where: { vehicle_id: vehicleId },
            orderBy: [{ date: 'desc' }, { id: 'desc' }],
            include: { vehicles: true }
        });
        const mapped = data.map(d => ({ ...d, plate: d.vehicles?.plate, vehicle_plate: d.vehicles?.plate, model: d.vehicles?.model, brand: d.vehicles?.brand }));
        return { success: true, data: mapped };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getAllMaintenances(companyId, isArchived) {
    try {
        const data = await prisma.maintenances.findMany({
            where: { is_archived: isArchived ? 1 : 0, vehicles: { company_id: parseInt(companyId) } },
            include: { vehicles: true },
            orderBy: [{ date: 'desc' }, { id: 'desc' }]
        });
        const mapped = data.map(d => ({ ...d, plate: d.vehicles?.plate, vehicle_plate: d.vehicles?.plate, model: d.vehicles?.model, brand: d.vehicles?.brand }));
        return { success: true, data: mapped };
    } catch (error) { return { success: false, error: error.message }; }
}

const getFilePathString = (filePath) => {
    if (!filePath) return null;
    if (typeof filePath === 'string') return filePath;
    if (typeof filePath === 'object' && filePath.path) return String(filePath.path);
    return null;
};

async function createMaintenance(data) {
    try {
        const { filePath, fileData, fileName, ...rest } = data;
        const result = await prisma.maintenances.create({
            data: {
                vehicle_id: parseInt(rest.vehicleId),
                type: rest.type,
                description: rest.description || null,
                date: new Date(rest.date),
                cost: rest.cost ? parseFloat(rest.cost) : 0,
                next_km: rest.nextKm ? parseInt(rest.nextKm) : null,
                next_date: rest.nextDate ? new Date(rest.nextDate) : null,
                notes: rest.notes || null,
                file_path: getFilePathString(filePath)
            }
        });

        if (filePath || fileData) {
            const { syncOperationDocument } = require('./operationSync.helper');
            await syncOperationDocument('maintenance', result.id, {
                vehicleId: rest.vehicleId,
                filePath,
                fileData,
                fileName,
                date: rest.date,
                nextDate: rest.nextDate
            });
        }

        const fresh = await prisma.maintenances.findUnique({ where: { id: result.id } });
        return { success: true, data: fresh };
    } catch (error) { return { success: false, error: error.message }; }
}

async function updateMaintenance(data) {
    try {
        const { id, filePath, fileData, fileName, ...rest } = data;
        const result = await prisma.maintenances.update({
            where: { id: parseInt(id) },
            data: {
                type: rest.type,
                description: rest.description || null,
                date: new Date(rest.date),
                cost: rest.cost ? parseFloat(rest.cost) : 0,
                next_km: rest.nextKm ? parseInt(rest.nextKm) : null,
                next_date: rest.nextDate ? new Date(rest.nextDate) : null,
                notes: rest.notes || null
            }
        });

        if (filePath !== undefined || fileData !== undefined) {
            const { syncOperationDocument } = require('./operationSync.helper');
            await syncOperationDocument('maintenance', result.id, {
                vehicleId: rest.vehicleId || result.vehicle_id,
                filePath,
                fileData,
                fileName,
                date: rest.date,
                nextDate: rest.nextDate
            });
        }

        const fresh = await prisma.maintenances.findUnique({ where: { id: result.id } });
        return { success: true, data: fresh };
    } catch (error) { return { success: false, error: error.message }; }
}

async function deleteMaintenance(id) {
    try {
        const { deleteOperationDocument } = require('./operationSync.helper');
        await deleteOperationDocument('maintenance', id);
        await prisma.maintenances.delete({ where: { id: parseInt(id) } });
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

module.exports = {
    getVehicles, getVehicleById, createVehicle, updateVehicle, deleteVehicle,
    getMaintenances, getAllMaintenances, createMaintenance, updateMaintenance, deleteMaintenance
};
