const express = require('express');
const cors = require('cors');
const path = require('path');
const electron = require('electron');
const log = require('./logger'); // Use the app's existing logger
const jwt = require('jsonwebtoken');
const authService = require('./services/auth.service');
const db = require('./prismaService');
const { createRpcMap } = require('./rpcMap');

const SECRET_KEY = process.env.JWT_SECRET || 'dev-admin-secret-key-12345';

let serverInstance = null;

// Hardcoded tables based on prisma/schema.prisma
const TABLES = [
    'assignments', 'companies', 'customers', 'documents', 'employees', 'employee_documents',
    'employee_assignments', 'employee_attendance', 'employee_movements', 'employee_salary_history',
    'inspections', 'insurances', 'leaves', 'maintenances', 'meal_settings', 'meal_tickets', 'overtimes',
    'recurring_transactions', 'salaries', 'services', 'transactions', 'users', 'vehicles', 'works', 'work_items'
];

function startAdminServer(prisma, onDbUpdate) {
    if (serverInstance) return; // Prevent multiple instances

    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Helper to get allowed company IDs for a user
    async function getAllowedCompanyIds(userId) {
        const companies = await prisma.companies.findMany({
            where: { user_id: userId },
            select: { id: true }
        });
        return companies.map(c => c.id);
    }

    // Build isolation where clause
    async function buildIsolationWhere(table, userId, explicitCompanyId = null) {
        if (table === 'users') return { id: userId };
        if (table === 'companies') {
            return explicitCompanyId
                ? { id: parseInt(explicitCompanyId), user_id: userId }
                : { user_id: userId };
        }

        let companyIds = await getAllowedCompanyIds(userId);

        if (explicitCompanyId) {
            const reqId = parseInt(explicitCompanyId);
            if (!companyIds.includes(reqId)) {
                throw new Error('Erişim yetkiniz olmayan bir şirket seçtiniz.');
            }
            companyIds = [reqId]; // Filter strictly to this one company
        }

        const tablesWithCompanyId = ['customers', 'employees', 'meal_settings', 'meal_tickets', 'recurring_transactions', 'transactions', 'vehicles', 'works'];
        const tablesWithVehicleId = ['assignments', 'documents', 'inspections', 'insurances', 'maintenances', 'services'];
        const tablesWithEmployeeId = ['employee_documents', 'employee_assignments', 'leaves', 'overtimes', 'employee_attendance', 'employee_movements', 'employee_salary_history', 'salaries'];
        const tablesWithWorkId = ['work_items'];

        if (tablesWithCompanyId.includes(table)) {
            return { company_id: { in: companyIds } };
        } else if (tablesWithVehicleId.includes(table)) {
            const vehicles = await prisma.vehicles.findMany({ where: { company_id: { in: companyIds } }, select: { id: true } });
            return { vehicle_id: { in: vehicles.map(v => v.id) } };
        } else if (tablesWithEmployeeId.includes(table)) {
            const employees = await prisma.employees.findMany({ where: { company_id: { in: companyIds } }, select: { id: true } });
            return { employee_id: { in: employees.map(e => e.id) } };
        } else if (tablesWithWorkId.includes(table)) {
            const works = await prisma.works.findMany({ where: { company_id: { in: companyIds } }, select: { id: true } });
            return { work_id: { in: works.map(w => w.id) } };
        }

        return { id: -1 }; // Fallback to safe state (return nothing) if relation mapping is missed
    }

    // Serve the frontend HTML page
    const adminStaticFolder = path.join(__dirname, 'admin');
    app.use(express.static(adminStaticFolder));

    // Serve uploaded documents statically
    let filesDir;
    try {
        filesDir = path.join(electron.app.getPath('userData'), 'files');
    } catch (e) {
        filesDir = path.join(process.env.DATA_DIR || path.join(__dirname, '../data'), 'files');
    }
    app.use('/uploads', express.static(filesDir));

    // Initialize full RPC map for browser development mode
    let rpcMap;
    try {
        rpcMap = createRpcMap();
    } catch (e) {
        log.warn('Could not initialize full rpcMap for adminServer:', e.message);
    }

    // Generic RPC Router for Web mode (bridges window.electronAPI calls over HTTP)
    app.post('/api/rpc/:method', async (req, res) => {
        const { method } = req.params;
        const { args = [] } = req.body;

        const fn = (rpcMap && rpcMap[method]) || db[method] || authService[method];
        if (typeof fn !== 'function') {
            log.warn(`[RPC 404] Method "${method}" not found in adminServer`);
            return res.status(404).json({ success: false, error: `Method "${method}" not found` });
        }

        try {
            const result = await fn(...args);
            res.json(result !== undefined ? result : { success: true });
        } catch (err) {
            log.error(`RPC Error [${method}]:`, err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // API: Login
    app.post('/api/login', async (req, res) => {
        const { username, email, password } = req.body;
        const result = await authService.loginUser({ username, email, password });

        if (result.success) {
            const token = jwt.sign({ id: result.user.id, username: result.user.username }, SECRET_KEY, { expiresIn: '12h' });
            res.json({ success: true, token, user: result.user });
        } else {
            res.status(401).json({ success: false, error: result.error });
        }
    });

    // JWT Security Middleware for Admin Table Explorer
    app.use('/api', (req, res, next) => {
        if (req.path === '/login' || req.path.startsWith('/rpc/')) return next(); // Skip logic for login and RPC calls

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, SECRET_KEY);
            req.user = decoded; // { id, username, iat, exp }
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
    });

    // API: Get Tables
    app.get('/api/tables', (req, res) => {
        res.json({ success: true, tables: TABLES });
    });

    // API: Get User's Companies (Used for the Dropdown)
    app.get('/api/my-companies', async (req, res) => {
        try {
            let companies;
            const user = await prisma.users.findUnique({ where: { id: req.user.id } });
            if (user && (user.role === 'admin' || user.role === 'superadmin')) {
                companies = await prisma.companies.findMany({
                    orderBy: { name: 'asc' }
                });
            } else {
                companies = await prisma.companies.findMany({
                    where: { user_id: req.user.id },
                    orderBy: { name: 'asc' }
                });
                if (!companies || companies.length === 0) {
                    companies = await prisma.companies.findMany({
                        orderBy: { name: 'asc' }
                    });
                }
            }
            res.json({ success: true, data: companies });
        } catch (error) {
            log.error('Admin panel error fetching my-companies:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // API: Get Table Data
    app.get('/api/data/:table', async (req, res) => {
        const table = req.params.table;
        const companyId = req.query.companyId || null; // Capture the dropdown's selected value

        if (!TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });

        try {
            const isolateWhere = await buildIsolationWhere(table, req.user.id, companyId);
            const data = await prisma[table].findMany({
                take: 500,
                where: isolateWhere
            });
            res.json({ success: true, data });
        } catch (error) {
            log.error(`Admin panel error fetching ${table}:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    // API: Create Record
    app.post('/api/data/:table', async (req, res) => {
        const table = req.params.table;
        if (!TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });

        try {
            // Very rudimentary dynamic insertion logic for the developer panel.
            // CAUTION: It expects the frontend to provide valid relations except for user_id which we can inject.
            const payload = { ...req.body };

            if (table === 'companies') {
                payload.user_id = req.user.id;
            } else if (table === 'users') {
                // Not allowed to create arbitrary users via admin generic endpoint securely usually
                return res.status(403).json({ error: 'Kullanıcı ekleme işlemi buradan yapılamaz.' });
            }

            const record = await prisma[table].create({
                data: payload
            });
            if (typeof onDbUpdate === 'function') {
                onDbUpdate({ table, action: 'create' });
            }
            res.json({ success: true, data: record });
        } catch (error) {
            log.error(`Admin panel error creating ${table}:`, error);
            res.status(500).json({ error: 'Ekleme başarısız: ' + error.message });
        }
    });

    // API: Delete Record
    app.delete('/api/data/:table/:id', async (req, res) => {
        const table = req.params.table;
        const id = parseInt(req.params.id);
        const companyId = req.query.companyId || null; // Capture the dropdown's selected value

        if (!TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });

        try {
            // Check ownership before deleting
            const isolateWhere = await buildIsolationWhere(table, req.user.id, companyId);
            const record = await prisma[table].findFirst({
                where: { id: id, ...isolateWhere }
            });

            if (!record) {
                return res.status(403).json({ error: 'Forbidden: Record not found or you do not have permission to delete it.' });
            }

            await prisma[table].delete({
                where: { id }
            });
            if (typeof onDbUpdate === 'function') {
                onDbUpdate({ table, action: 'delete' });
            }
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Additional CRUD can be added here (Update, Create).
    // API: Update Record
    app.put('/api/data/:table/:id', async (req, res) => {
        const table = req.params.table;
        const id = parseInt(req.params.id);
        const companyId = req.query.companyId || null;

        if (!TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });

        try {
            // Check ownership
            const isolateWhere = await buildIsolationWhere(table, req.user.id, companyId);
            const record = await prisma[table].findFirst({
                where: { id: id, ...isolateWhere }
            });

            if (!record) {
                return res.status(403).json({ error: 'Forbidden: Record not found or you do not have permission to update it.' });
            }

            const payload = { ...req.body };
            delete payload.id; // never update ID
            
            // Remove foreign keys if empty string
            for (const key in payload) {
                if (payload[key] === '') payload[key] = null;
            }

            const updatedRecord = await prisma[table].update({
                where: { id },
                data: payload
            });
            if (typeof onDbUpdate === 'function') {
                onDbUpdate({ table, action: 'update' });
            }
            res.json({ success: true, data: updatedRecord });
        } catch (error) {
            log.error(`Admin panel error updating ${table}:`, error);
            res.status(500).json({ error: 'Güncelleme başarısız: ' + error.message });
        }
    });

    const PORT = 9999;
    serverInstance = app.listen(PORT, '0.0.0.0', () => {
        log.info(`API Server running on http://0.0.0.0:${PORT} (Admin)`);
    });
}

function stopAdminServer() {
    if (serverInstance) {
        serverInstance.close();
        serverInstance = null;
        log.info('Admin Server stopped.');
    }
}

module.exports = { startAdminServer, stopAdminServer };
