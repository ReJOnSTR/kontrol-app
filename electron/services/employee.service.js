const { getPrismaClient } = require('../prismaClient');
const { logAudit } = require('./audit.service');
const { checkQuota } = require('./quota.service');
const prisma = getPrismaClient();

async function getEmployees(companyId, isArchived = 0) {
    try {
        const whereClause = { company_id: parseInt(companyId) };
        if (isArchived === 1) {
            whereClause.status = { not: 'active' };
        } else {
            whereClause.status = 'active';
        }

        const data = await prisma.employees.findMany({
            where: whereClause,
            select: {
                id: true,
                company_id: true,
                first_name: true,
                last_name: true,
                tc_no: true,
                phone: true,
                email: true,
                position: true,
                department: true,
                start_date: true,
                end_date: true,
                salary: true,
                status: true,
                notes: true,
                image: true,
                signature_path: true,
                is_archived: true,
                created_at: true,
                past_used_leaves: true,
                birth_date: true,
                iban: true,
                off_days: true,
                salaries: { where: { status: 'pending' } },
                leaves: { where: { status: 'pending' } },
                employee_salary_history: { orderBy: { start_date: 'asc' } }
            }
        });

        const collator = new Intl.Collator('tr');
        const sortedData = data.sort((a, b) => collator.compare(a.first_name, b.first_name));

        // Append summary fields
        const mapped = sortedData.map(emp => ({
            ...emp,
            pending_salaries: emp.salaries.length,
            pending_leaves: emp.leaves.length
        }));

        return { success: true, data: mapped };
    } catch (error) { return { success: false, error: error.message }; }
}

async function getEmployeeById(id) {
    try {
        const empId = parseInt(id, 10);
        let data;
        try {
            data = await prisma.employees.findUnique({
                where: { id: empId },
                include: { 
                    employee_salary_history: { orderBy: { start_date: 'asc' } },
                    user: {
                        select: { 
                            id: true, 
                            username: true, 
                            email: true, 
                            role: true, 
                            role_id: true, 
                            permissions: true,
                            custom_role: { select: { id: true, name: true } }, 
                            is_active: true, 
                            created_at: true 
                        }
                    }
                }
            });
        } catch (innerErr) {
            console.warn('getEmployeeById include warning, attempting fallback:', innerErr.message);
            data = await prisma.employees.findUnique({
                where: { id: empId },
                include: { 
                    employee_salary_history: { orderBy: { start_date: 'asc' } }
                }
            });
            if (data) {
                try {
                    const u = await prisma.users.findFirst({
                        where: { employee_id: empId }
                    });
                    if (u) {
                        data.user = {
                            id: u.id,
                            username: u.username,
                            email: u.email,
                            role: u.role,
                            role_id: u.role_id,
                            permissions: u.permissions,
                            is_active: u.is_active,
                            created_at: u.created_at
                        };
                    }
                } catch (uErr) {
                    console.warn('Fallback user query notice:', uErr.message);
                }
            }
        }
        return { success: true, data };
    } catch (error) { return { success: false, error: error.message }; }
}

async function addEmployee(data) {
    try {
        let compId = data.companyId || data.company_id;
        if (!compId) {
            const firstComp = await prisma.companies.findFirst();
            compId = firstComp?.id || 1;
        }

        await checkQuota(compId, 'employees');

        const parseDate = (val) => {
            if (!val) return null;
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        };

        const salaryNum = data.salary ? parseFloat(data.salary) : 0;
        const startDateObj = parseDate(data.startDate);
        const effectiveDateObj = parseDate(data.effectiveDate) || startDateObj || new Date();

        const emp = await prisma.employees.create({
            data: {
                company_id: parseInt(compId),
                first_name: data.firstName || data.first_name || '',
                last_name: data.lastName || data.last_name || '',
                tc_no: data.tcNo || data.tc_no || null,
                phone: data.phone || null,
                email: data.email || null,
                position: data.position || null,
                department: data.department || null,
                start_date: startDateObj,
                end_date: parseDate(data.endDate),
                salary: salaryNum,
                status: data.status || 'active',
                notes: data.notes || null,
                image: data.image || null,
                signature_path: data.signaturePath || data.signature_path || null,
                past_used_leaves: data.pastUsedLeaves ? parseInt(data.pastUsedLeaves) : 0,
                birth_date: parseDate(data.birthDate),
                iban: data.iban || null,
                off_days: data.offDays || '0',
                employee_salary_history: {
                    create: {
                        amount: salaryNum,
                        start_date: effectiveDateObj,
                        type: 'initial'
                    }
                }
            }
        });

        logAudit({
            companyId: emp.company_id,
            action: 'CREATE',
            entityType: 'employee',
            entityId: String(emp.id),
            entityName: `${emp.first_name} ${emp.last_name}${emp.position ? ` (${emp.position})` : ''}`,
            description: `"${emp.first_name} ${emp.last_name}" adlı personel kaydı oluşturuldu`,
            details: { position: emp.position, department: emp.department, salary: emp.salary },
            severity: 'info'
        });

        return { success: true, data: emp };
    } catch (error) { 
        console.error('addEmployee error:', error);
        return { success: false, error: error.message }; 
    }
}

async function updateEmployee(data) {
    try {
        const empId = parseInt(data.id);
        const currentEmp = await prisma.employees.findUnique({
            where: { id: empId },
            include: { employee_salary_history: { orderBy: { start_date: 'desc' }, take: 1 } }
        });

        const parseDate = (val) => {
            if (!val) return null;
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        };

        const newSalary = data.salary !== undefined ? parseFloat(data.salary) : (currentEmp?.salary || 0);
        const oldSalary = currentEmp?.salary || 0;
        const effectiveDate = parseDate(data.effectiveDate) || new Date();

        let salaryHistoryOp = undefined;
        if (newSalary !== oldSalary) {
            // End the existing latest history
            if (currentEmp?.employee_salary_history && currentEmp.employee_salary_history.length > 0) {
                const latestHistory = currentEmp.employee_salary_history[0];
                await prisma.employee_salary_history.update({
                    where: { id: latestHistory.id },
                    data: { end_date: effectiveDate }
                }).catch(() => {});
            }

            // Create new period
            salaryHistoryOp = {
                create: {
                    amount: newSalary,
                    start_date: effectiveDate,
                    type: 'raise'
                }
            };
        }

        const updateData = {
            salary: newSalary,
            status: data.status || 'active',
            notes: data.notes !== undefined ? data.notes : undefined,
            first_name: data.firstName || data.first_name || undefined,
            last_name: data.lastName || data.last_name || undefined,
            tc_no: data.tcNo || data.tc_no !== undefined ? (data.tcNo || data.tc_no || null) : undefined,
            phone: data.phone !== undefined ? data.phone : undefined,
            email: data.email !== undefined ? data.email : undefined,
            position: data.position !== undefined ? data.position : undefined,
            department: data.department !== undefined ? data.department : undefined,
            start_date: data.startDate ? parseDate(data.startDate) : undefined,
            end_date: data.endDate !== undefined ? parseDate(data.endDate) : undefined,
            image: data.image !== undefined ? data.image : undefined,
            signature_path: data.signaturePath !== undefined ? data.signaturePath : (data.signature_path !== undefined ? data.signature_path : undefined),
            past_used_leaves: data.pastUsedLeaves !== undefined ? parseInt(data.pastUsedLeaves) : undefined,
            birth_date: data.birthDate ? parseDate(data.birthDate) : undefined,
            iban: data.iban !== undefined ? data.iban : undefined,
            off_days: data.offDays !== undefined ? data.offDays : undefined,
            is_archived: data.isArchived !== undefined ? (data.isArchived ? 1 : 0) : undefined,
        };

        if (salaryHistoryOp) {
            updateData.employee_salary_history = salaryHistoryOp;
        }

        const updated = await prisma.employees.update({
            where: { id: empId },
            data: updateData
        });

        logAudit({
            companyId: updated.company_id,
            action: 'UPDATE',
            entityType: 'employee',
            entityId: String(updated.id),
            entityName: `${updated.first_name} ${updated.last_name}${updated.position ? ` (${updated.position})` : ''}`,
            description: `"${updated.first_name} ${updated.last_name}" personel bilgileri güncellendi`,
            severity: 'info'
        });

        return { success: true, data: updated };
    } catch (error) { 
        console.error('updateEmployee error:', error);
        return { success: false, error: error.message }; 
    }
}

async function deleteEmployee(id) {
    try {
        const empId = parseInt(id);
        const existing = await prisma.employees.findUnique({ where: { id: empId } });

        await prisma.$transaction(async (tx) => {
            // Disassociate or remove users linked to this employee
            await tx.users.updateMany({
                where: { employee_id: empId },
                data: { employee_id: null }
            }).catch(() => {});

            // Delete child relational data
            await tx.salaries.deleteMany({ where: { employee_id: empId } }).catch(() => {});
            await tx.leaves.deleteMany({ where: { employee_id: empId } }).catch(() => {});
            await tx.overtimes.deleteMany({ where: { employee_id: empId } }).catch(() => {});
            await tx.employee_assignments.deleteMany({ where: { employee_id: empId } }).catch(() => {});
            await tx.employee_documents.deleteMany({ where: { employee_id: empId } }).catch(() => {});
            await tx.employee_salary_history.deleteMany({ where: { employee_id: empId } }).catch(() => {});
            await tx.employee_movements.deleteMany({ where: { employee_id: empId } }).catch(() => {});
            await tx.employee_attendance.deleteMany({ where: { employee_id: empId } }).catch(() => {});
            await tx.assignments.deleteMany({ where: { employee_id: empId } }).catch(() => {});
            await tx.requests.deleteMany({ where: { employee_id: empId } }).catch(() => {});

            // Finally delete the employee
            await tx.employees.delete({ where: { id: empId } });
        });

        if (existing) {
            logAudit({
                companyId: existing.company_id,
                action: 'DELETE',
                entityType: 'employee',
                entityId: String(existing.id),
                entityName: `${existing.first_name} ${existing.last_name}${existing.position ? ` (${existing.position})` : ''}`,
                description: `"${existing.first_name} ${existing.last_name}" personeli ve tüm bordro/izin geçmişi silindi`,
                severity: 'critical'
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Delete employee error:', error);
        return { success: false, error: error.message };
    }
}

async function getPayrollSummary(companyId, month) {
    try {
        const targetMonth = month || new Date().toISOString().slice(0, 7);
        const [year, m] = targetMonth.split('-');
        const startDate = new Date(year, parseInt(m) - 1, 1);
        const endDate = new Date(year, parseInt(m), 0, 23, 59, 59);

        const employees = await prisma.employees.findMany({
            where: { 
                company_id: parseInt(companyId)
            },
            include: {
                salaries: true, // Fetch all salaries to filter by period in memory
                overtimes: { 
                    where: { 
                        date: { gte: startDate, lte: endDate },
                        is_archived: 0
                    } 
                },
                employee_salary_history: { orderBy: { start_date: 'asc' } }
            }
        });

        // Filter salaries in memory to match the exact same logic as PC
        const filteredEmployees = employees.map(emp => {
            const monthlySalaries = emp.salaries.filter(s => {
                if (s.salary_month) {
                    return s.salary_month === targetMonth;
                }
                if (!s.payment_date && !s.created_at) return false;
                try {
                    const d = s.payment_date || s.created_at;
                    const dStr = typeof d === 'string' ? d : d.toISOString();
                    return dStr.startsWith(targetMonth);
                } catch (e) {
                    return false;
                }
            });

            return {
                ...emp,
                salaries: monthlySalaries
            };
        });

        // Filter employees based on their start date and archived/end date for targetMonth
        const resultEmployees = filteredEmployees.filter(emp => {
            const startMonth = emp.start_date ? new Date(emp.start_date).toISOString().slice(0, 7) : null;
            const endMonth = emp.end_date ? new Date(emp.end_date).toISOString().slice(0, 7) : null;

            // 1. Skip if before start date
            if (startMonth && targetMonth < startMonth) {
                return false;
            }

            // 2. Skip if after end date
            if (endMonth && targetMonth > endMonth) {
                return false;
            }

            // 3. Skip if passive/archived and no end_date, unless they have records in this month
            if (emp.status !== 'active' && !emp.end_date) {
                const hasSalaries = emp.salaries && emp.salaries.length > 0;
                const hasOvertimes = emp.overtimes && emp.overtimes.length > 0;
                if (!hasSalaries && !hasOvertimes) {
                    return false;
                }
            }

            return true;
        });

        const collator = new Intl.Collator('tr');
        const sortedEmployees = resultEmployees.sort((a, b) => collator.compare(a.first_name, b.first_name));

        return { success: true, data: sortedEmployees };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


module.exports = {
    getEmployees, getEmployeeById, addEmployee, updateEmployee, deleteEmployee, getPayrollSummary
};
