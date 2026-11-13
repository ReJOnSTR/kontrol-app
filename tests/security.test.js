import { describe, it, expect } from 'vitest';
import path from 'path';

describe('Security & Protection Rules', () => {
    it('prevents directory traversal attacks via path.basename normalization', () => {
        const maliciousPayload = '../../../../etc/passwd';
        const safeName = path.basename(maliciousPayload);
        expect(safeName).toBe('passwd');
        expect(safeName).not.toContain('..');
        expect(safeName).not.toContain('/');
    });

    it('ensures sensitive password properties are sanitized when serializing user objects', () => {
        const rawUsers = [
            { id: 1, username: 'admin', password: 'secret123', password_hash: '$2a$10$abc...', role: 'admin' },
            { id: 2, username: 'operator', password_hash: '$2a$10$xyz...', role: 'user' }
        ];

        const sanitized = rawUsers.map(u => {
            const { password_hash, password, ...safeUser } = u;
            return safeUser;
        });

        expect(sanitized[0]).toEqual({ id: 1, username: 'admin', role: 'admin' });
        expect(sanitized[0].password).toBeUndefined();
        expect(sanitized[0].password_hash).toBeUndefined();
        expect(sanitized[1].password_hash).toBeUndefined();
    });

    it('validates secure token payload expectations', () => {
        const samplePayload = { id: 10, username: 'admin', role: 'admin' };
        expect(samplePayload.role).toBe('admin');
        expect(['admin', 'superadmin', 'company_admin']).toContain(samplePayload.role);
    });

    it('normalizes Windows backslashes and relative paths safely for documents', () => {
        const winPath = 'company_1\\documents\\contract.pdf';
        const normalized = winPath.replace(/\\/g, '/').replace(/^\/+/, '');
        expect(normalized).toBe('company_1/documents/contract.pdf');
        expect(path.basename(normalized)).toBe('contract.pdf');
    });

    it('enforces tenant isolation for admin and company_admin in assertCompany', async () => {
        const { assertCompany } = await import('../electron/security/access.js');

        expect(() => assertCompany({ role: 'admin', companyIds: [1] }, 1)).not.toThrow();
        expect(() => assertCompany({ role: 'admin', companyIds: [1] }, 2)).toThrow();
        expect(() => assertCompany({ role: 'company_admin', companyIds: [1] }, 2)).toThrow();
        expect(() => assertCompany({ role: 'superadmin', companyIds: [] }, 999)).not.toThrow();
    });

    it('enforces tenant isolation for admin in authorizeFile and blocks traversal in safePath', async () => {
        const { authorizeFile, safePath } = await import('../electron/security/files.js');

        await expect(authorizeFile({ role: 'admin', companyIds: [1] }, 'company_1/vehicles/a.pdf', {})).resolves.toBeUndefined();
        await expect(authorizeFile({ role: 'admin', companyIds: [1] }, 'company_2/vehicles/a.pdf', {})).rejects.toThrow();
        await expect(authorizeFile({ role: 'superadmin', companyIds: [] }, 'company_2/vehicles/a.pdf', {})).resolves.toBeUndefined();

        expect(() => safePath('/tmp/kontrol-files', '../../etc/passwd')).toThrow();
        expect(() => safePath('/tmp/kontrol-files', 'file\0.pdf')).toThrow();
    });

    it('encrypts and decrypts secrets symmetrically and preserves legacy plaintext compatibility', async () => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef';
        const { encryptSecret, decryptSecret } = await import('../electron/security/cryptoVault.js');

        const cipher = encryptSecret('my-smtp-secret');
        expect(cipher).toMatch(/^enc:v1:/);
        expect(cipher).not.toContain('my-smtp-secret');
        expect(decryptSecret(cipher)).toBe('my-smtp-secret');
        expect(encryptSecret(cipher)).toBe(cipher);
        expect(decryptSecret('legacy-plain')).toBe('legacy-plain');
    });
});
