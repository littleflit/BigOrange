import { describe, expect, it } from 'vitest';
import { RESUME_POSITION_FLOOR_SEC, resolveResumeTime } from '../../../src/utils/playbackResume';

// test/unit/playback/playbackResume.test.ts
// Relaunch resume rules: only position mode, only the same song, never near-zero.

describe('resolveResumeTime', () => {
    it('returns null in track mode even with a saved position', () => {
        expect(resolveResumeTime({
            mode: 'track',
            saved: { key: 'a', time: 120 },
            songKey: 'a',
        })).toBeNull();
    });

    it('returns null without a saved position or a song key', () => {
        expect(resolveResumeTime({ mode: 'position', saved: null, songKey: 'a' })).toBeNull();
        expect(resolveResumeTime({ mode: 'position', saved: { key: 'a', time: 120 }, songKey: null })).toBeNull();
        expect(resolveResumeTime({ mode: 'position', saved: undefined, songKey: 'a' })).toBeNull();
    });

    it('returns null when the saved position belongs to another song', () => {
        expect(resolveResumeTime({
            mode: 'position',
            saved: { key: 'b', time: 120 },
            songKey: 'a',
        })).toBeNull();
    });

    it('returns null for near-zero or non-finite times', () => {
        expect(resolveResumeTime({
            mode: 'position',
            saved: { key: 'a', time: RESUME_POSITION_FLOOR_SEC - 0.5 },
            songKey: 'a',
        })).toBeNull();
        expect(resolveResumeTime({
            mode: 'position',
            saved: { key: 'a', time: Number.NaN },
            songKey: 'a',
        })).toBeNull();
    });

    it('returns the saved time for the same song past the floor', () => {
        expect(resolveResumeTime({
            mode: 'position',
            saved: { key: 'a', time: 123.5 },
            songKey: 'a',
        })).toBe(123.5);
    });
});
