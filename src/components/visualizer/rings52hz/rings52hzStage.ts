import * as PIXI from 'pixi.js';
import type { Line, Rings52hzTuning, Theme } from '../../../types';
import { resolveThemeFontStack, resolveThemeFontWeight } from '../../../utils/fontStacks';
import { layoutLine, buildLineField, type Rings52hzLayout } from './rings52hzLineLayout';
import { buildPithField } from './rings52hzPith';
import { createLyricText, type Rings52hzLyricText } from './rings52hzLyricText';
import { hashString } from './rings52hzRandom';
import { createBeatDetector, type Rings52hzAudioFeed, type Rings52hzBeatDetector } from './rings52hzBeats';
import {
    SLOT_COUNT,
    HISTORY_SIZE,
    HISTORY_RATE,
    FAR_FROM_BEAT,
    createFieldSource,
    createHistorySource,
    createRippleFilter,
    type Rings52hzRipple,
} from './rings52hzRipple';

// src/components/visualizer/rings52hz/rings52hzStage.ts
// (Ported from mods/visualizer52hz/stage.mjs.)
// The 52Hz stage: the current lyric line appears in the middle and lights up
// character by character, and a ring leaves its glyph outlines on every beat,
// spreading outward like a tree ring that records how loud that beat was.
// A song without lyrics grows its rings from random piths instead.
//
// Everything is keyed to the song clock, not the wall clock: pausing freezes
// the rings, seeking back clears the record.

const TARGET_GRID = 480;          // field cells across the longer side
const OPEN_WINDOW_END = 1e9;
const UNUSED_WINDOW: [number, number] = [1, 0];
// The song clock moving this much (s) more or less than the wall clock between two
// frames is a seek, not playback: the ring record restarts.
const SEEK_JUMP_SEC = 0.5;
const ENERGY_FLOOR = 0.06;        // silence still leaves faint growth lines
const PITH_PERIOD_SEC = 11;       // an instrumental grows from a new pith this often
// How far back a beat marks the samples before it (their distance to the coming ring).
const BEAT_LOOKBACK_SAMPLES = Math.round(0.5 * HISTORY_RATE);
const STATIC_BEAT_SEC = 0.72;    // ring cadence of a static preview

export interface Rings52hzSource {
    key: string;
    kind: 'line' | 'pith';
    lineIndex?: number;
    seed?: number;
}

export interface Rings52hzFrameState {
    time: number;
    lineIndex: number;
    lines: Line[];
    songTitle?: string | null;
    songArtist?: string | null;
    isDaylight: boolean;
    theme: Theme;
    tuning: Rings52hzTuning;
    lyricsFontScale: number;
    staticMode: boolean;
    audio: Rings52hzAudioFeed | null;
}

const colorProbe = document.createElement('canvas').getContext('2d')!;
/** Any CSS color -> [r, g, b] in 0..1. */
const toRgb = (color: string | undefined, fallback: string): [number, number, number] => {
    colorProbe.fillStyle = fallback;
    colorProbe.fillStyle = color || fallback;
    const value = colorProbe.fillStyle;
    if (value.startsWith('#')) {
        return [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255) as [number, number, number];
    }
    const parts = value.match(/[\d.]+/g) ?? ['255', '255', '255'];
    return parts.slice(0, 3).map((part) => Number(part) / 255) as [number, number, number];
};

/*
 * Audio -> a 0..1 "growth" value per frame. Loudness is divided by a slowly
 * decaying peak so quiet and loud masters both use the full range, then an
 * envelope with a fast attack and slow release gives beats a clear ring.
 */
const createEnergyFollower = () => {
    let peak = 0.2;
    let envelope = 0;
    return {
        reset() {
            envelope = 0;
        },
        step(audio: Rings52hzAudioFeed | null, sensitivity: number, dt: number): number {
            if (!audio) return ENERGY_FLOOR;
            const bands = audio.getBands();
            const raw = 0.6 * audio.getPower() + 0.4 * bands.bass;
            peak = Math.max(raw, peak * Math.exp(-dt / 8), 0.08);
            const target = Math.min(1, (raw / peak) * sensitivity);
            const rate = target > envelope ? 1 - Math.exp(-dt / 0.03) : 1 - Math.exp(-dt / 0.35);
            envelope += (target - envelope) * rate;
            return ENERGY_FLOOR + (1 - ENERGY_FLOOR) * envelope;
        },
    };
};

export class Rings52hzStage {
    private app: PIXI.Application | null = null;
    private host: HTMLDivElement;
    private readState: () => Rings52hzFrameState;
    private disposed = false;
    private frame = 0;
    private cleanup: () => void = () => {};
    private lookRefresh: (() => void) | null = null;

    /** Rebuilds glyphs if font/theme changed, re-applies look uniforms. */
    refreshLook(): void {
        this.lookRefresh?.();
    }

    constructor(container: HTMLElement, readState: () => Rings52hzFrameState) {
        this.host = document.createElement('div');
        this.host.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
        container.appendChild(this.host);
        this.readState = readState;
        void this.start().catch((error) => {
            console.error('[Rings52hz] failed to start', error);
        });
    }

    destroy(): void {
        this.disposed = true;
        this.cleanup();
        this.host.remove();
    }

    private async start(): Promise<void> {
        // Same reasoning as the host's loadPixi: mediump is real fp16 on some drivers,
        // and song-time math in the shader needs fp32.
        PIXI.GlProgram.defaultOptions.preferredFragmentPrecision = 'highp';

        const app = new PIXI.Application();
        await app.init({
            width: Math.max(1, this.host.clientWidth),
            height: Math.max(1, this.host.clientHeight),
            backgroundAlpha: 0,
            antialias: false,
            preference: 'webgl',
            resolution: Math.min(window.devicePixelRatio || 1, 2),
            autoDensity: true,
            autoStart: false,
            sharedTicker: false,
        });
        if (this.disposed) {
            app.destroy(true, { children: true, texture: true });
            return;
        }
        this.app = app;
        app.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
        this.host.appendChild(app.canvas);

        // ---- stage geometry and GPU resources (rebuilt on resize) ----
        let width = 1;
        let height = 1;
        let cell = 4;
        let gridWidth = 1;
        let gridHeight = 1;
        let fieldSources: PIXI.BufferImageSource[] = [];
        // Two strips over song time: growth energy, and seconds to the nearest beat (ring birth).
        const historySource = createHistorySource();
        const historyData = historySource.resource as Float32Array;
        const beatSource = createHistorySource();
        const beatData = beatSource.resource as Float32Array;
        beatData.fill(FAR_FROM_BEAT);
        const cellOf = (index: number): number => ((index % HISTORY_SIZE) + HISTORY_SIZE) % HISTORY_SIZE;

        const ringSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        const textLayer = new PIXI.Container();
        app.stage.addChild(ringSprite, textLayer);
        const text: Rings52hzLyricText = createLyricText(textLayer);

        let ring: Rings52hzRipple | null = null;

        /*
         * Ring sources. A source is what rings grow from: a lyric line
         * `{ key, kind: 'line', lineIndex }` or a pith `{ key, kind: 'pith', seed }`.
         * Each slot holds one source's field and the song-time window it emitted in.
         */
        const slots: Array<{ source: Rings52hzSource | null; start: number; end: number }> =
            Array.from({ length: SLOT_COUNT }, () => ({ source: null, start: 1, end: 0 }));
        let openSlot = -1;
        let shownKey: string | null = null;

        // ---- ring record ----
        const follower = createEnergyFollower();
        const beats: Rings52hzBeatDetector = createBeatDetector();
        let lastBeatTime = -Infinity;
        let historyStart = 0;
        let lastSampleIndex: number | null = null;
        let lastTime: number | null = null;
        let lastWall: number | null = null;

        const snapshot = (): Rings52hzFrameState => this.readState();
        const fontScaleOf = (state: Rings52hzFrameState): number => (
            Number(state.tuning.fontScale ?? 1) * state.lyricsFontScale
        );
        const lyricFontOf = (state: Rings52hzFrameState): { family: string; weight: number | string } => ({
            family: resolveThemeFontStack(state.theme),
            weight: resolveThemeFontWeight(state.theme, 500),
        });
        const hasLyricsOf = (state: Rings52hzFrameState): boolean => (
            state.lines.some((line) => line.fullText.trim())
        );
        const songSeedOf = (state: Rings52hzFrameState): number => (
            hashString(`${state.songTitle ?? ''}|${state.songArtist ?? ''}`)
        );

        const layoutFor = (state: Rings52hzFrameState, lineIndex: number): Rings52hzLayout | null => {
            const line = state.lines[lineIndex];
            if (!line || !line.fullText.trim()) return null;
            return layoutLine(line.fullText, lyricFontOf(state), width, height, fontScaleOf(state));
        };

        const sourceAt = (state: Rings52hzFrameState, time: number): Rings52hzSource | null => {
            if (!hasLyricsOf(state)) {
                const period = Math.floor(time / PITH_PERIOD_SEC);
                return { key: `pith:${period}`, kind: 'pith', seed: (songSeedOf(state) ^ Math.imul(period + 1, 0x9e3779b1)) >>> 0 };
            }
            let lineIndex = state.lineIndex;
            if (state.staticMode && !state.lines[lineIndex]?.fullText.trim()) {
                lineIndex = state.lines.findIndex((line) => line.fullText.trim());
            }
            if (!state.lines[lineIndex]?.fullText.trim()) return null;
            return { key: `line:${lineIndex}`, kind: 'line', lineIndex };
        };

        const buildField = (state: Rings52hzFrameState, source: Rings52hzSource | null): Float32Array | null => {
            if (source?.kind === 'line' && source.lineIndex !== undefined) {
                const layout = layoutFor(state, source.lineIndex);
                return layout ? buildLineField(layout, cell, gridWidth, gridHeight) : null;
            }
            if (source?.kind === 'pith' && source.seed !== undefined) {
                return buildPithField(source.seed, width, height, cell, gridWidth, gridHeight);
            }
            return null;
        };

        const fillSlotField = (state: Rings52hzFrameState, slotIndex: number): void => {
            const target = fieldSources[slotIndex];
            const field = buildField(state, slots[slotIndex].source);
            if (field) target.resource = field;
            else (target.resource as Float32Array).fill(1e6);
            target.update();
        };

        const applyWindows = (): void => {
            if (!ring) return;
            slots.forEach((slot, index) => {
                const range = ring!.uniforms[`uWindow${index}` as 'uWindow0'] as Float32Array;
                const used = slot.source !== null && slot.end >= slot.start;
                range[0] = used ? slot.start : UNUSED_WINDOW[0];
                range[1] = used ? slot.end : UNUSED_WINDOW[1];
            });
        };

        const showLineText = (state: Rings52hzFrameState, lineIndex: number, time: number): void => {
            const layout = layoutFor(state, lineIndex);
            if (layout) {
                text.show(state.lines[lineIndex], lineIndex, layout, state.theme, app.renderer.resolution, time);
            }
        };

        // Starts emitting rings from `source` (or stops, for null) at song time `time`.
        const switchSource = (state: Rings52hzFrameState, source: Rings52hzSource | null, time: number): void => {
            shownKey = source?.key ?? null;
            if (openSlot >= 0) {
                slots[openSlot].end = time;
                openSlot = -1;
            }
            text.hide(time);
            if (!source) return;

            // Reuse a free slot, else the one that stopped emitting longest ago.
            let target = slots.findIndex((slot) => slot.source === null);
            if (target < 0) {
                target = slots.reduce((oldest, slot, index) => (slot.end < slots[oldest].end ? index : oldest), 0);
            }
            slots[target].source = source;
            // A static preview has no playback: its one source has always been emitting.
            slots[target].start = state.staticMode ? -1e9 : time;
            slots[target].end = OPEN_WINDOW_END;
            openSlot = target;
            fillSlotField(state, target);
            if (source.kind === 'line' && source.lineIndex !== undefined) showLineText(state, source.lineIndex, time);
        };

        // After a seek the old record no longer describes the past: start over at `time`, keeping
        // only the source on screen (re-emitting from now) and fading its text in again.
        const resetRecord = (time: number): void => {
            historyData.fill(0);
            historySource.update();
            beatData.fill(FAR_FROM_BEAT);
            beatSource.update();
            historyStart = time;
            lastSampleIndex = Math.floor(time * HISTORY_RATE);
            follower.reset();
            beats.reset();
            lastBeatTime = -Infinity;
            slots.forEach((slot, index) => {
                if (index === openSlot) {
                    slot.start = time;
                } else {
                    slot.source = null;
                    slot.start = UNUSED_WINDOW[0];
                    slot.end = UNUSED_WINDOW[1];
                }
            });
            text.restart(time);
            applyWindows();
            dirty = true;
        };

        // A static preview has no playback to record; give it a plausible past.
        const seedStaticRecord = (): void => {
            for (let i = 0; i < HISTORY_SIZE; i += 1) {
                historyData[i] = 0.2 + 0.45 * (0.5 + 0.5 * Math.sin(i * 0.13)) * (0.5 + 0.5 * Math.sin(i * 0.031));
                const beatPhase = i / HISTORY_RATE / STATIC_BEAT_SEC;
                beatData[i] = Math.abs(beatPhase - Math.round(beatPhase)) * STATIC_BEAT_SEC;
            }
            historySource.update();
            beatSource.update();
            historyStart = -1e9;
        };

        const rebuildGeometry = (state: Rings52hzFrameState): void => {
            width = Math.max(1, this.host.clientWidth);
            height = Math.max(1, this.host.clientHeight);
            app.renderer.resize(width, height);
            cell = Math.max(2, Math.max(width, height) / TARGET_GRID);
            gridWidth = Math.ceil(width / cell);
            gridHeight = Math.ceil(height / cell);

            const previousFilter = ring?.filter;
            fieldSources.forEach((source) => source.destroy());
            fieldSources = Array.from({ length: SLOT_COUNT }, () => createFieldSource(gridWidth, gridHeight));
            ring = createRippleFilter({ fieldSources, historySource, beatSource });
            ringSprite.filters = [ring.filter];
            previousFilter?.destroy();
            ringSprite.width = width;
            ringSprite.height = height;
            ring.uniforms.uScreen[0] = width;
            ring.uniforms.uScreen[1] = height;
            ring.uniforms.uCell = cell;

            slots.forEach((_, index) => fillSlotField(state, index));
            applyWindows();

            const lineIndex = text.lineIndex;
            const layout = lineIndex >= 0 ? layoutFor(state, lineIndex) : null;
            if (layout) text.rebuild(state.lines[lineIndex], layout, state.theme, app.renderer.resolution);
            dirty = true;
        };

        const applyLook = (state: Rings52hzFrameState): void => {
            if (!ring) return;
            const theme = state.theme;
            const values = state.tuning;
            const halfDiagonal = Math.hypot(width, height) / 2;
            // At speed 1 a ring takes ~10 s to reach the screen edge, where it has faded out.
            ring.uniforms.uSpeed = (halfDiagonal / 10) * Number(values.reach ?? 1);
            ring.uniforms.uFadeDistance = halfDiagonal;
            ring.uniforms.uOpacity = Number(values.opacity ?? 0.8);
            ring.uniforms.uColorNear.set(toRgb(theme.accentColor, state.isDaylight ? '#000' : '#fff'));
            ring.uniforms.uColorFar.set(toRgb(theme.primaryColor, state.isDaylight ? '#000' : '#fff'));
        };

        /*
         * Writes every history cell the clock moved past: the growth value, and how
         * long after the last beat it is. A beat then marks itself (0) and tells the
         * cells just before it how far ahead it came, so each ring has both edges.
         */
        const recordAudio = (state: Rings52hzFrameState, time: number, wall: number): void => {
            const dt = lastTime === null ? 0 : time - lastTime;
            const wallDt = lastWall === null ? 0 : (wall - lastWall) / 1000;
            const jumped = lastTime === null || dt < -1e-3 || Math.abs(dt - wallDt) > SEEK_JUMP_SEC;
            if (jumped) {
                resetRecord(time);
                return;
            }
            const sampleIndex = Math.floor(time * HISTORY_RATE);
            if (sampleIndex === lastSampleIndex) return;
            const values = state.tuning;
            const value = follower.step(state.audio, Number(values.sensitivity ?? 1), dt);
            // A long stall (or a long pause of rendering) fills at most one full record.
            const first = Math.max((lastSampleIndex ?? sampleIndex - 1) + 1, sampleIndex - HISTORY_SIZE + 1);
            for (let index = first; index <= sampleIndex; index += 1) {
                historyData[cellOf(index)] = value;
                beatData[cellOf(index)] = Math.min(FAR_FROM_BEAT, index / HISTORY_RATE - lastBeatTime);
            }
            if (beats.step(state.audio, time, dt, Number(values.beatSensitivity ?? 1))) {
                lastBeatTime = sampleIndex / HISTORY_RATE;
                const oldest = Math.max(sampleIndex - BEAT_LOOKBACK_SAMPLES, Math.ceil(historyStart * HISTORY_RATE));
                for (let index = sampleIndex; index >= oldest; index -= 1) {
                    const cellIndex = cellOf(index);
                    beatData[cellIndex] = Math.min(beatData[cellIndex], (sampleIndex - index) / HISTORY_RATE);
                }
            }
            lastSampleIndex = sampleIndex;
            historySource.update();
            beatSource.update();
        };

        let dirty = true;
        let renderedTime: number | null = null;

        const tick = (): void => {
            this.frame = requestAnimationFrame(tick);
            const state = snapshot();
            const time = state.time;
            if (!state.staticMode) {
                const wall = performance.now();
                recordAudio(state, time, wall);
                lastTime = time;
                lastWall = wall;
            }
            const source = sourceAt(state, time);
            if ((source?.key ?? null) !== shownKey) {
                switchSource(state, source, time);
                applyWindows();
                dirty = true;
            }
            // Paused: the clock stands still and nothing needs repainting.
            if (!dirty && time === renderedTime) return;
            const fading = text.update(time, state.staticMode);
            if (ring) {
                ring.uniforms.uTime = time;
                ring.uniforms.uHistoryStart = historyStart;
            }
            app.render();
            renderedTime = time;
            dirty = fading;
        };

        rebuildGeometry(snapshot());
        applyLook(snapshot());
        if (snapshot().staticMode) seedStaticRecord();

        // Font, glyph colors or font scale need the glyphs redrawn; the rest is uniforms.
        const glyphKey = (state: Rings52hzFrameState): string => {
            const font = { family: resolveThemeFontStack(state.theme), weight: resolveThemeFontWeight(state.theme, 500) };
            return `${font.family}|${font.weight}|${state.theme.primaryColor}|${state.theme.accentColor}|${fontScaleOf(state)}`;
        };
        let lastGlyphKey = glyphKey(snapshot());
        const refreshLook = (): void => {
            const state = snapshot();
            const key = glyphKey(state);
            if (key !== lastGlyphKey) {
                lastGlyphKey = key;
                rebuildGeometry(state);
            }
            applyLook(state);
            dirty = true;
        };
        this.lookRefresh = refreshLook;
        const resizeObserver = new ResizeObserver(() => {
            if (this.host.clientWidth !== width || this.host.clientHeight !== height) {
                rebuildGeometry(snapshot());
                applyLook(snapshot());
            }
        });
        resizeObserver.observe(this.host);
        this.frame = requestAnimationFrame(tick);

        this.cleanup = () => {
            this.lookRefresh = null;
            cancelAnimationFrame(this.frame);
            resizeObserver.disconnect();
            text.destroy();
            fieldSources.forEach((source) => source.destroy());
            historySource.destroy();
            beatSource.destroy();
            app.destroy(true, { children: true, texture: true });
        };
    }
}
