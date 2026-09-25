const { getPrismaClient } = require('../prismaClient');
const prisma = getPrismaClient();

/**
 * Şirketin Rollerini Listeleme
 */
async function getRoles(companyId) {
    try {
        if (!companyId) {
            return { success: false, error: 'Şirket ID zorunludur' };
        }

        const roles = await prisma.roles.findMany({
            where: { company_id: Number(companyId) },
            include: {
                permissions: true,
                _count: {
                    select: { users: true }
                }
            },
            orderBy: { created_at: 'asc' }
        });

        return { success: true, data: roles };
    } catch (error) {
        console.error('getRoles error:', error.message);
        return { success: true, data: [] };
    }
}

/**
 * Yeni Rol Oluşturma veya Güncelleme
 */
async function saveRole(data) {
    try {
        const { id, companyId, name, description, permissions } = data;

        if (!companyId || !name) {
            return { success: false, error: 'Şirket ve Rol adı zorunludur' };
        }

        let role;
        if (id) {
            // Güncelleme
            role = await prisma.roles.update({
                where: { id: Number(id) },
                data: {
                    name,
                    description: description || ''
                }
            });

            // İzinleri yenile
            if (Array.isArray(permissions)) {
                await prisma.permissions.deleteMany({ where: { role_id: role.id } });
                await prisma.permissions.createMany({
                    data: permissions.map(p => ({
                        role_id: role.id,
                        module: p.module,
                        can_read: !!p.can_read,
                        can_create: !!p.can_create,
                        can_update: !!p.can_update,
                        can_delete: !!p.can_delete,
                        can_approve: !!p.can_approve,
                        scope: p.scope || 'OWN'
                    }))
                });
            }
        } else {
            // Yeni oluşturma
            role = await prisma.roles.create({
                data: {
                    company_id: Number(companyId),
                    name,
                    description: description || '',
                    permissions: Array.isArray(permissions) ? {
                        create: permissions.map(p => ({
                            module: p.module,
                            can_read: !!p.can_read,
                            can_create: !!p.can_create,
                            can_update: !!p.can_update,
                            can_delete: !!p.can_delete,
                            can_approve: !!p.can_approve,
                            scope: p.scope || 'OWN'
                        }))
                    } : undefined
                }
            });
        }

        return { success: true, data: role };
    } catch (error) {
        console.error('saveRole error:', error);
        return { success: false, error: 'Rol kaydedilemedi: ' + error.message };
    }
}

/**
 * Rol Silme
 */
async function deleteRole(roleId) {
    try {
        if (!roleId) return { success: false, error: 'Rol ID zorunludur' };

        await prisma.roles.delete({
            where: { id: Number(roleId) }
        });

        return { success: true };
    } catch (error) {
        console.error('deleteRole error:', error);
        return { success: false, error: 'Rol silinemedi: ' + error.message };
    }
}

/**
 * Kullanıcıya Rol ve Personel Eşleme Atama
 */
async function assignUserRoleAndEmployee(data) {
    try {
        const { userId, role, roleId, employeeId, isActive } = data;

        if (!userId) return { success: false, error: 'Kullanıcı ID zorunludur' };

        const updateData = {};
        if (role !== undefined) updateData.role = role;
        if (roleId !== undefined) updateData.role_id = roleId ? Number(roleId) : null;
        if (employeeId !== undefined) updateData.employee_id = employeeId ? Number(employeeId) : null;
        if (isActive !== undefined) updateData.is_active = isActive ? 1 : 0;
        if (data.permissions !== undefined) {
            updateData.permissions = data.permissions ? (typeof data.permissions === 'string' ? data.permissions : JSON.stringify(data.permissions)) : null;
        }

        const updatedUser = await prisma.users.update({
            where: { id: Number(userId) },
            data: updateData
        });

        return { success: true, user: updatedUser };
    } catch (error) {
        console.error('assignUserRoleAndEmployee error:', error);
        return { success: false, error: 'Kullanıcı yetkileri güncellenemedi: ' + error.message };
    }
}

/**
 * Kullanıcı Hesabını Silme (Giriş Hesabını Kaldırma)
 */
async function deleteUserAccount(userId) {
    const { deletePlatformUser } = require('./platform.service');
    return await deletePlatformUser(userId);
}

module.exports = {
    getRoles,
    saveRole,
    deleteRole,
    assignUserRoleAndEmployee,
    deleteUserAccount
};
