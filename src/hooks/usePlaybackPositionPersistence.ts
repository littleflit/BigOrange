import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { saveToCache } from '../services/db';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { getPlaybackSongKey } from '../utils/appPlaybackGuards';
import { RESUME_POSITION_FLOOR_SEC, type SavedPlaybackPosition } from '../utils/playbackResume';

// src/hooks/usePlaybackPositionPersistence.ts
// Remembers where the current track is, so a relaunch can pick up mid-song.
// Writes at most every 10s while actually playing, plus once on unload; the key
// check on the restore side makes a stale entry (track switched since) harmless.

const SAVE_INTERVAL_MS = 10_000;

export function usePlaybackPositionPersistence(audioRef: RefObject<HTMLAudioElement | null>) {
    const currentSong = usePlaybackStore(state => state.currentSong);
    const songKeyRef = useRef<string | null>(null);
    songKeyRef.current = currentSong ? getPlaybackSongKey(currentSong) : null;

    useEffect(() => {
        const save = () => {
            const element = audioRef.current;
            const key = songKeyRef.current;
            if (!element || element.paused || !key) {
                return;
            }
            const time = element.currentTime;
            if (!Number.isFinite(time) || time < RESUME_POSITION_FLOOR_SEC) {
                return;
            }
            const snapshot: SavedPlaybackPosition = { key, time };
            void saveToCache('last_position', snapshot);
        };
        const timer = window.setInterval(save, SAVE_INTERVAL_MS);
        window.addEventListener('beforeunload', save);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('beforeunload', save);
        };
    }, [audioRef]);
}
