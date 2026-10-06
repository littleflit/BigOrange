import { describe, expect, it } from 'vitest';
import {
    buildLyricSourceOrder,
    migratePreferredLyricSource,
} from '@/utils/lyrics/sourcePriority';

// test/unit/lyrics/sourcePriority.test.ts

describe('lyric source priority', () => {
    it('defaults to NetEase and retains every fallback exactly once', () => {
        expect(buildLyricSourceOrder()).toEqual(['netease', 'amll']);
        expect(buildLyricSourceOrder('netease')).toEqual(['netease', 'amll']);
        expect(buildLyricSourceOrder('amll')).toEqual(['amll', 'netease']);
    });

    it('migrates missing, invalid, and legacy preferences to NetEase', () => {
        expect(migratePreferredLyricSource(null, null)).toBe('netease');
        expect(migratePreferredLyricSource(null, 'invalid')).toBe('netease');
        expect(migratePreferredLyricSource(null, 'qq')).toBe('netease');
        expect(migratePreferredLyricSource(null, 'kugou')).toBe('netease');
        expect(migratePreferredLyricSource('invalid', 'kugou')).toBe('netease');
    });

    it('preserves amll legacy values and trusts the versioned preference thereafter', () => {
        expect(migratePreferredLyricSource(null, 'amll')).toBe('amll');
        expect(migratePreferredLyricSource('netease', 'qq')).toBe('netease');
        expect(migratePreferredLyricSource('amll', 'netease')).toBe('amll');
    });
});
