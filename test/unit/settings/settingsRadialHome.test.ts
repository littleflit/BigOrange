import { describe, expect, it } from 'vitest';
import { dockScale, radialSlot } from '../../../src/components/modal/settings/navigation/SettingsRadialHome';

// test/unit/settings/settingsRadialHome.test.ts
// The ring geometry is the one thing about the radial landing that can drift silently:
// slots must stay inside the square, spread around the full circle, and keep sidebar order
// clockwise from the top.

describe('dockScale', () => {
    it('stays at 1 outside the range', () => {
        expect(dockScale(20)).toBe(1);
        expect(dockScale(50)).toBe(1);
    });

    it('peaks at the cursor and falls off smoothly', () => {
        expect(dockScale(0)).toBeCloseTo(1.6, 5);
        const near = dockScale(5);
        const far = dockScale(15);
        expect(near).toBeGreaterThan(far);
        expect(far).toBeGreaterThan(1);
    });
});
describe('radialSlot', () => {
    it('returns the center for an empty ring', () => {
        expect(radialSlot(0, 0)).toEqual({ x: 50, y: 50 });
    });

    it('starts at the top and advances clockwise through all 11 sections', () => {
        const total = 11;
        const first = radialSlot(0, total);
        expect(first.x).toBeCloseTo(50, 5);
        expect(first.y).toBeLessThan(50);

        const slots = Array.from({ length: total }, (_, index) => radialSlot(index, total));
        for (const slot of slots) {
            expect(slot.x).toBeGreaterThanOrEqual(0);
            expect(slot.x).toBeLessThanOrEqual(100);
            expect(slot.y).toBeGreaterThanOrEqual(0);
            expect(slot.y).toBeLessThanOrEqual(100);
        }
        // Even angular spacing: every neighbor pair is one eleventh of a full turn.
        const angles = slots.map(slot => Math.atan2(slot.y - 50, slot.x - 50));
        const steps = angles.map((angle, index) => {
            const next = angles[(index + 1) % angles.length]!;
            const delta = next - angle;
            return delta < 0 ? delta + Math.PI * 2 : delta;
        });
        for (const step of steps) {
            expect(step).toBeCloseTo((Math.PI * 2) / total, 5);
        }
    });
});
