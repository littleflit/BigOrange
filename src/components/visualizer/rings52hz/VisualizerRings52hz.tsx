import React, { useEffect, useRef } from 'react';
import { DEFAULT_RINGS52HZ_TUNING, type Rings52hzTuning } from '../../../types';
import type { VisualizerSharedProps } from '../definition';
import { Rings52hzStage, type Rings52hzFrameState } from './rings52hzStage';

// src/components/visualizer/rings52hz/VisualizerRings52hz.tsx
// 52Hz: the current line appears whole and lights up character by character,
// rings spread outward along the outline of its glyphs on every beat.

interface VisualizerRings52hzProps extends VisualizerSharedProps {
    rings52hzTuning?: Rings52hzTuning;
}

const VisualizerRings52hz: React.FC<VisualizerRings52hzProps> = (props) => {
    const {
        currentTime,
        currentLineIndex,
        lines,
        theme,
        audioPower,
        audioBands,
        songTitle,
        songArtist,
        seed,
        staticMode = false,
        lyricsFontScale = 1,
        rings52hzTuning,
        isDaylight,
    } = props;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const stageRef = useRef<Rings52hzStage | null>(null);
    const propsRef = useRef(props);
    propsRef.current = props;
    void isDaylight;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const stage = new Rings52hzStage(container, (): Rings52hzFrameState => {
            const current = propsRef.current;
            const tuning = current.rings52hzTuning ?? DEFAULT_RINGS52HZ_TUNING;
            const spectrum = current.audioBands.spectrum?.get() ?? null;
            return {
                time: current.currentTime.get(),
                lineIndex: current.currentLineIndex,
                lines: current.lines,
                songTitle: current.songTitle,
                songArtist: current.songArtist,
                theme: current.theme,
                isDaylight: current.isDaylight ?? false,
                tuning,
                lyricsFontScale: current.lyricsFontScale ?? 1,
                staticMode: current.staticMode ?? false,
                audio: {
                    getSpectrum: () => spectrum,
                    getBands: () => ({
                        bass: current.audioBands.bass.get(),
                        lowMid: current.audioBands.lowMid.get(),
                    }),
                    getPower: () => current.audioPower.get(),
                },
            };
        });
        stageRef.current = stage;
        return () => {
            stage.destroy();
            stageRef.current = null;
        };
    }, [seed]);

    const tuning = rings52hzTuning ?? DEFAULT_RINGS52HZ_TUNING;
    useEffect(() => {
        stageRef.current?.refreshLook();
    }, [theme, tuning.fontScale, lyricsFontScale, lines, currentLineIndex, songTitle, songArtist]);

    return <div ref={containerRef} className="absolute inset-0 overflow-hidden" />;
};

export default VisualizerRings52hz;
