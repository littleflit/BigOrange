import type { ResumeMode } from '../stores/useAudioSettingsStore';

// src/utils/playbackResume.ts
// Relaunch position resume: pure rules deciding whether a saved position applies.

export type SavedPlaybackPosition = {
    key: string;
    time: number;
};

/** Positions under this are "from the start" and resume as 0. */
export const RESUME_POSITION_FLOOR_SEC = 5;

export const resolveResumeTime = (options: {
    mode: ResumeMode;
    saved: SavedPlaybackPosition | null | undefined;
    songKey: string | null | undefined;
}): number | null => {
    const { mode, saved, songKey } = options;
    if (mode !== 'position') {
        return null;
    }
    if (!saved || !songKey || saved.key !== songKey) {
        return null;
    }
    if (!Number.isFinite(saved.time) || saved.time < RESUME_POSITION_FLOOR_SEC) {
        return null;
    }
    // The near-end guard lives in the loadedmetadata handler, which already clamps
    // to duration - 0.25 there: duration is unknowable until the source lands.
    return saved.time;
};
