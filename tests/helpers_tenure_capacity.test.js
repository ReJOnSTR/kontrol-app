import { describe, it, expect } from 'vitest'
import {
    calculateWorkingDuration,
    formatWorkingDuration,
    compareEmployeeTenureDesc,
    parseVehicleCapacity,
    compareVehicleCapacityDesc
} from '../src/utils/helpers'

describe('Working Duration & Tenure Calculations', () => {
    it('returns "-" when startDate is empty or null', () => {
        expect(formatWorkingDuration(null)).toBe('-')
        expect(formatWorkingDuration('')).toBe('-')
        expect(formatWorkingDuration(undefined)).toBe('-')
    })

    it('calculates tenure properly for multi-year duration', () => {
        const start = '2020-01-01'
        const end = '2023-04-15'
        const dur = calculateWorkingDuration(start, end, 'inactive')
        expect(dur.years).toBe(3)
        expect(dur.months).toBe(3)
        expect(dur.days).toBe(14)
        expect(dur.totalDays).toBeGreaterThan(1190)

        const formatted = formatWorkingDuration(start, end, 'inactive')
        expect(formatted).toBe('3 Yıl 3 Ay')
    })

    it('formats duration with months and days when under 1 year', () => {
        const start = '2023-01-01'
        const end = '2023-06-15'
        const formatted = formatWorkingDuration(start, end, 'inactive')
        expect(formatted).toBe('5 Ay 14 Gün')
    })

    it('sorts employees by tenure descending (longest tenure first)', () => {
        const emp1 = { first_name: 'Ahmet', start_date: '2015-05-01', status: 'active' }
        const emp2 = { first_name: 'Mehmet', start_date: '2022-01-01', status: 'active' }
        const emp3 = { first_name: 'Ali', start_date: '2010-01-01', status: 'active' }
        const empNoDate = { first_name: 'Veli', start_date: null, status: 'active' }

        const list = [emp1, emp2, emp3, empNoDate]
        list.sort(compareEmployeeTenureDesc)

        // Ali (2010) > Ahmet (2015) > Mehmet (2022) > Veli (no date)
        expect(list[0].first_name).toBe('Ali')
        expect(list[1].first_name).toBe('Ahmet')
        expect(list[2].first_name).toBe('Mehmet')
        expect(list[3].first_name).toBe('Veli')
    })
})

describe('Vehicle Capacity Parsing & Sorting', () => {
    it('correctly parses tons and metres', () => {
        expect(parseVehicleCapacity('80 Ton Mobil')).toEqual({ type: 'ton', value: '80 Ton', num: 80 })
        expect(parseVehicleCapacity('35 Ton')).toEqual({ type: 'ton', value: '35 Ton', num: 35 })
        expect(parseVehicleCapacity('43 Metre Sepetli')).toEqual({ type: 'metre', value: '43 Metre', num: 43 })
        expect(parseVehicleCapacity('Corolla')).toEqual({ type: 'other', value: 'Corolla', num: null })
    })

    it('sorts high ton to low ton, then high metre to low metre, then others', () => {
        const v1 = { plate: '06 AAA 01', model: '35 Ton' }
        const v2 = { plate: '06 AAA 02', model: '100 Ton' }
        const v3 = { plate: '06 AAA 03', model: '47 Metre' }
        const v4 = { plate: '06 AAA 04', model: '26 Metre' }
        const v5 = { plate: '06 AAA 05', model: 'Binek Ford Focus' }

        const list = [v1, v5, v4, v2, v3]
        list.sort(compareVehicleCapacityDesc)

        expect(list.map(v => v.model)).toEqual([
            '100 Ton',
            '35 Ton',
            '47 Metre',
            '26 Metre',
            'Binek Ford Focus'
        ])
    })
})
