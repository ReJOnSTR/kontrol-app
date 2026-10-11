import { describe, it, expect, beforeEach } from 'vitest'
import { dataCache } from '../src/utils/dataCache'

describe('DataCache SWR In-Memory Store', () => {
    beforeEach(() => {
        dataCache.clear()
    })

    it('should store and retrieve data correctly', () => {
        dataCache.set('vehicles_1', [{ id: 10, plate: '34ABC01' }])
        const data = dataCache.get('vehicles_1')
        expect(data).toEqual([{ id: 10, plate: '34ABC01' }])
        expect(dataCache.has('vehicles_1')).toBe(true)
    })

    it('should return null for expired entries', () => {
        dataCache.set('temp_key', 'some_data', -100) // already expired
        expect(dataCache.get('temp_key')).toBeNull()
        expect(dataCache.has('temp_key')).toBe(false)
    })

    it('should invalidate matching keys by pattern', () => {
        dataCache.set('vehicles_comp_1', ['car1'])
        dataCache.set('vehicles_comp_2', ['car2'])
        dataCache.set('employees_comp_1', ['emp1'])

        dataCache.invalidate('vehicles')

        expect(dataCache.get('vehicles_comp_1')).toBeNull()
        expect(dataCache.get('vehicles_comp_2')).toBeNull()
        expect(dataCache.get('employees_comp_1')).toEqual(['emp1'])
    })

    it('should clear all entries when pattern is omitted', () => {
        dataCache.set('key1', 'val1')
        dataCache.set('key2', 'val2')
        dataCache.invalidate()
        expect(dataCache.get('key1')).toBeNull()
        expect(dataCache.get('key2')).toBeNull()
    })
})
