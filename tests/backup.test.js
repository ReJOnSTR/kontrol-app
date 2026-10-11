import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Archive & Backup Data Logic', () => {
    it('should normalize archive values safely', () => {
        const normalizeArchive = (val) => (val === 1 || val === true || val === '1') ? 1 : 0

        expect(normalizeArchive(1)).toBe(1)
        expect(normalizeArchive(true)).toBe(1)
        expect(normalizeArchive('1')).toBe(1)
        expect(normalizeArchive(0)).toBe(0)
        expect(normalizeArchive(false)).toBe(0)
        expect(normalizeArchive('0')).toBe(0)
        expect(normalizeArchive(undefined)).toBe(0)
    })

    it('should validate table name before archiving operations', () => {
        const validTables = ['vehicles', 'employees', 'works', 'maintenances', 'inspections']
        const isValidTable = (name) => validTables.includes(String(name).toLowerCase())

        expect(isValidTable('VEHICLES')).toBe(true)
        expect(isValidTable('employees')).toBe(true)
        expect(isValidTable('users_secret_passwords')).toBe(false)
        expect(isValidTable('')).toBe(false)
    })
})
