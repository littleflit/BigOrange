import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStoredSettingsHomeMode } from '../../../src/stores/useSettingsModalStore';

// test/unit/stores/settingsHomeMode.test.ts
// The options-tab layout switch persists a two-value mode; a foreign value
// (or a blocked storage) must fall back to the ring, never throw.

const stubStorage = (getItem: (key: string) => string | null) => {
    vi.stubGlobal('window', { localStorage: { getItem, setItem: () => {} } });
};

describe('settingsHomeMode storage', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    it('defaults to the ring without a window', () => {
        expect(readStoredSettingsHomeMode()).toBe('ring');
    });

    it('reads back a stored mode and rejects foreign values', () => {
        stubStorage(() => 'navbar');
        expect(readStoredSettingsHomeMode()).toBe('navbar');
        stubStorage(() => 'grid');
        expect(readStoredSettingsHomeMode()).toBe('ring');
        stubStorage(() => null);
        expect(readStoredSettingsHomeMode()).toBe('ring');
    });

    it('falls back to the ring when storage throws', () => {
        stubStorage(() => {
            throw new Error('blocked');
        });
        expect(readStoredSettingsHomeMode()).toBe('ring');
    });
});
