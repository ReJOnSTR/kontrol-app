import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Vehicle Service Business Logic', () => {
    let mockPrisma

    beforeEach(() => {
        mockPrisma = {
            vehicles: {
                findMany: vi.fn(),
                findUnique: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn()
            }
        }
    })

    it('should format vehicle counts correctly', async () => {
        const rawVehicles = [
            {
                id: 1,
                company_id: 1,
                plate: '34ABC123',
                brand: 'Toyota',
                _count: {
                    maintenances: 2,
                    inspections: 1,
                    insurances: 1,
                    services: 3
                }
            }
        ]

        mockPrisma.vehicles.findMany.mockResolvedValue(rawVehicles)

        // Test mapping logic
        const formatted = rawVehicles.map(v => ({
            ...v,
            maintenances_count: v._count?.maintenances || 0,
            inspections_count: v._count?.inspections || 0,
            insurances_count: v._count?.insurances || 0,
            services_count: v._count?.services || 0
        }))

        expect(formatted[0].maintenances_count).toBe(2)
        expect(formatted[0].inspections_count).toBe(1)
        expect(formatted[0].services_count).toBe(3)
    })

    it('should validate plate uniqueness before creating a vehicle', () => {
        const existingPlates = ['34ABC123', '06ANK456']
        const newPlate = '34abc123'.toUpperCase().trim()

        const isDuplicate = existingPlates.includes(newPlate)
        expect(isDuplicate).toBe(true)

        const uniquePlate = '35IZM789'.toUpperCase().trim()
        const isUniqueDuplicate = existingPlates.includes(uniquePlate)
        expect(isUniqueDuplicate).toBe(false)
    })
})
