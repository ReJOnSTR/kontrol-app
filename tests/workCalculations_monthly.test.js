import { describe, it, expect } from 'vitest';
import { calculateWorkStats } from '../src/utils/workCalculations';
import backendWorkCalc from '../electron/utils/workCalculations';

describe('calculateWorkStats - Monthly (Aylık) calculations', () => {
    it('calculates single monthly item with fixed monthly agreement (26 Gün)', () => {
        const items = [
            {
                id: 1,
                date: '2026-10-01',
                vehicle_id: 10,
                plate: '34 ABC 123',
                hours: 1,
                unit_price: 250000,
                pricingType: 'monthly',
                description: '[AYLIK:250000] Vinç Aylık Kiralama'
            }
        ];

        const stats = calculateWorkStats(items);
        expect(stats.grandTotal).toBe(250000);
        expect(stats.groups).toHaveLength(1);

        const group = stats.groups[0];
        expect(group.summaryLines).toHaveLength(1);
        expect(group.summaryLines[0].typeLabel).toBe('AYLIK');
        expect(group.summaryLines[0].countText).toBe('1 AY (26 Gün)');
        expect(group.summaryLines[0].unitPrice).toBe(250000);
        expect(group.summaryLines[0].totalPrice).toBe(250000);
        expect(stats.durationText).toBe('1 Ay (26 Gün)');
    });

    it('calculates 30-day month bulk records based on standard 26 days agreement', () => {
        const monthlyTutar = 260000;
        const dailyRate = monthlyTutar / 26;

        const items = [];
        for (let day = 1; day <= 30; day++) {
            const dateStr = `2026-11-${String(day).padStart(2, '0')}`;
            const isSunday = (day === 1 || day === 8 || day === 15 || day === 22 || day === 29);
            items.push({
                id: day,
                date: dateStr,
                vehicle_id: 20,
                plate: '55 XYZ 789',
                hours: isSunday ? 0 : 1,
                unit_price: isSunday ? 0 : dailyRate,
                pricingType: 'monthly',
                description: isSunday ? '[PAZAR TATİLİ]' : `[AYLIK:${monthlyTutar}] Kasım ayı puantajı`
            });
        }

        const stats = calculateWorkStats(items);
        expect(stats.grandTotal).toBe(260000);

        const group = stats.groups[0];
        const aylikLine = group.summaryLines.find(l => l.typeLabel === 'AYLIK');
        expect(aylikLine).toBeDefined();
        expect(aylikLine.unitPrice).toBe(10000);
        expect(aylikLine.totalPrice).toBe(260000);
        expect(aylikLine.countText).toBe('26 GÜN');
        expect(stats.durationText).toBe('1 Ay (26 Gün)');
    });

    it('does not write 27 days or drop price when month has 27 working days and 1 holiday', () => {
        // 31 days month with 27 non-Sunday days, 1 holiday day
        const monthlyTutar = 320000;
        const dailyRate = monthlyTutar / 26;

        const items = [];
        for (let day = 1; day <= 31; day++) {
            const dateStr = `2026-10-${String(day).padStart(2, '0')}`;
            const isSunday = (day === 4 || day === 11 || day === 18 || day === 25);
            const isHoliday = (day === 29); // 29 Ekim tatil
            items.push({
                id: day,
                date: dateStr,
                vehicle_id: 30,
                plate: '06 ANK 456',
                hours: (isSunday || isHoliday) ? 0 : 1,
                unit_price: (isSunday || isHoliday) ? 0 : dailyRate,
                pricingType: 'monthly',
                description: isSunday ? '[PAZAR TATİLİ]' : (isHoliday ? '[TATİL] Cumhuriyet Bayramı' : `[AYLIK:${monthlyTutar}] Ekim ayı puantajı`)
            });
        }

        const stats = calculateWorkStats(items);
        // Price should NOT drop: fixed 320.000 TL
        expect(stats.grandTotal).toBe(320000);

        const group = stats.groups[0];
        const aylikLine = group.summaryLines.find(l => l.typeLabel === 'AYLIK');
        expect(aylikLine).toBeDefined();
        expect(aylikLine.unitPrice).toBe(12307.69);
        expect(aylikLine.totalPrice).toBe(320000);
        // Summary should write standard 26 GÜN, NOT 27 Gün
        expect(aylikLine.countText).toBe('26 GÜN');
        expect(stats.durationText).toBe('1 Ay (26 Gün)');
    });

    it('calculates existing records where description is [AYLIK] and daily rate is monthly/26', () => {
        // Daily rate = 240000 / 26, Sundays are holidays
        const dailyRate = 240000 / 26;
        const items = [];
        for (let day = 1; day <= 31; day++) {
            const isSunday = (day === 5 || day === 12 || day === 19 || day === 26);
            items.push({
                id: 700 + day,
                date: `2026-07-${String(day).padStart(2, '0')}`,
                vehicle_id: 10,
                plate: '55 VINC 01',
                hours: isSunday ? 0 : 1,
                unit_price: isSunday ? 0 : dailyRate,
                description: isSunday ? '[PAZAR TATİLİ]' : '[AYLIK]'
            });
        }

        const stats = calculateWorkStats(items);
        expect(stats.grandTotal).toBe(240000);

        const group = stats.groups[0];
        const aylikLine = group.summaryLines.find(l => l.typeLabel === 'AYLIK');
        expect(aylikLine).toBeDefined();
        expect(aylikLine.unitPrice).toBe(9230.77);
        expect(aylikLine.totalPrice).toBe(240000);
        expect(aylikLine.countText).toBe('26 GÜN');
    });

    it('keeps daily jobs with high integer prices (e.g. 60.000 TL crane rental) strictly as GÜN and does NOT convert to AYLIK', () => {
        const items = [
            {
                id: 4554,
                date: '2026-10-22',
                vehicle_id: 201,
                plate: '55 SA 100',
                hours: 1,
                overtime_hours: 3,
                unit_price: 60000,
                total_price: 93750,
                description: null
            },
            {
                id: 4555,
                date: '2026-10-26',
                vehicle_id: 202,
                plate: '55 SA 200',
                hours: 1,
                overtime_hours: 0,
                unit_price: 50000,
                total_price: 50000,
                description: null
            }
        ];

        const stats = calculateWorkStats(items);
        expect(stats.grandTotal).toBe(143750); // 60000 (1 Gün) + 33750 (3 saat mesai) + 50000 (1 Gün)

        // Ensure NO group has typeLabel 'AYLIK'
        stats.groups.forEach(g => {
            const aylikLine = g.summaryLines.find(l => l.typeLabel === 'AYLIK');
            expect(aylikLine).toBeUndefined();
            const gunLine = g.summaryLines.find(l => l.typeLabel === 'GÜN');
            expect(gunLine).toBeDefined();
        });
    });

    it('calculates full-month Menlift pattern (Work 190) accurately to 14.000 TL', () => {
        const items = [];
        const dailyRate = 466.666666666667;
        for (let day = 1; day <= 31; day++) {
            const isSunday = (day === 4 || day === 11 || day === 18 || day === 25);
            items.push({
                id: 5000 + day,
                date: `2026-10-${String(day).padStart(2, '0')}`,
                custom_vehicle: 'MENLİFT',
                hours: 1,
                overtime_hours: 0,
                unit_price: dailyRate,
                total_price: dailyRate,
                description: null
            });
        }

        const stats = calculateWorkStats(items, 1, 1);
        expect(stats.grandTotal).toBe(14000);

        const group = stats.groups[0];
        const aylikLine = group.summaryLines.find(l => l.typeLabel === 'AYLIK');
        expect(aylikLine).toBeDefined();
        expect(aylikLine.countText).toBe('26 GÜN');
        expect(aylikLine.totalPrice).toBe(12133);

        const pazarLine = group.summaryLines.find(l => l.typeLabel === 'PAZAR');
        expect(pazarLine).toBeDefined();
        expect(pazarLine.countText).toBe('4 GÜN');
        expect(pazarLine.totalPrice).toBe(1867);
    });

    it('produces identical grandTotal between frontend and backend regardless of item order and custom Sunday price', () => {
        const itemsAsc = [
            { id: 1, date: '2026-11-01', vehicle_id: 1, hours: 1, overtime_hours: 0, unit_price: 8000, description: '[PAZAR_FIYAT:8000]' }, // Sunday
            { id: 2, date: '2026-11-02', vehicle_id: 1, hours: 1, overtime_hours: 2, unit_price: 5000, description: null },
            { id: 3, date: '2026-11-03', vehicle_id: 1, hours: 1, overtime_hours: 0, unit_price: 0, description: null },
            { id: 4, date: '2026-11-08', vehicle_id: 1, hours: 1, overtime_hours: 0, unit_price: 5000, description: '[KATSAYI:1]' } // Sunday 1x
        ];
        const itemsDesc = [...itemsAsc].reverse();

        const frontAsc = calculateWorkStats(itemsAsc, 1.5, 1.5);
        const frontDesc = calculateWorkStats(itemsDesc, 1.5, 1.5);
        const backAsc = backendWorkCalc.calculateWorkStats(itemsAsc, 1.5, 1.5);
        const backDesc = backendWorkCalc.calculateWorkStats(itemsDesc, 1.5, 1.5);

        expect(frontAsc.grandTotal).toBe(frontDesc.grandTotal);
        expect(backAsc.grandTotal).toBe(frontAsc.grandTotal);
        expect(backDesc.grandTotal).toBe(frontDesc.grandTotal);
    });
});
