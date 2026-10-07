// src/components/visualizer/rings52hz/rings52hzBeats.ts
// Onset ("beat") detection on the low end, so rings are born on the rhythm.
// The onset signal is spectral flux: how much the low FFT bins rose since the
// previous reading (only rises count). A beat is a flux value clearly above its
// own recent level — an exponential mean and deviation over about a second —
// and at least MIN_GAP_SEC after the previous beat. Hosts without a spectrum
// fall back to the rise of the bass band. Long silences get a filler beat so
// quiet passages still leave faint rings instead of a gap.

export interface Rings52hzAudioFeed {
    getSpectrum(): Uint8Array | null;
    getBands(): { bass: number; lowMid: number };
    getPower(): number;
}

const LOW_BIN_START = 1;       // ~21 Hz per bin at the host's FFT size
const LOW_BIN_END = 12;        // up to ~260 Hz: kick and bass
const TRACK_SEC = 1.2;         // how fast the adaptive threshold follows the music
const MIN_GAP_SEC = 0.28;      // fastest ring cadence (~214 BPM)
const MAX_GAP_SEC = 2;         // longest stretch without a ring
const FLOOR = 0.012;           // flux below this is never a beat (noise, silence)

export interface Rings52hzBeatDetector {
    reset(): void;
    step(audio: Rings52hzAudioFeed | null, time: number, dt: number, sensitivity: number): boolean;
}

export const createBeatDetector = (): Rings52hzBeatDetector => {
    let previousBins: Float32Array | null = null;
    let previousLow = 0;
    let mean = 0;
    let variance = 0;
    let lastBeat = -Infinity;

    const lowFlux = (audio: Rings52hzAudioFeed): number => {
        const spectrum = audio.getSpectrum();
        if (spectrum && spectrum.length > LOW_BIN_END) {
            const count = LOW_BIN_END - LOW_BIN_START + 1;
            if (!previousBins) previousBins = new Float32Array(count);
            let flux = 0;
            for (let i = 0; i < count; i += 1) {
                const value = spectrum[LOW_BIN_START + i] / 255;
                flux += Math.max(0, value - previousBins[i]);
                previousBins[i] = value;
            }
            return flux / count;
        }
        const bands = audio.getBands();
        const low = 0.7 * bands.bass + 0.3 * bands.lowMid;
        const flux = Math.max(0, low - previousLow);
        previousLow = low;
        return flux;
    };

    return {
        reset() {
            previousBins = null;
            previousLow = 0;
            mean = 0;
            variance = 0;
            lastBeat = -Infinity;
        },

        /**
         * Feeds one reading at song time `time` (dt s after the previous one).
         * `sensitivity` > 1 lowers the threshold. Returns true on a beat.
         */
        step(audio, time, dt, sensitivity) {
            const flux = audio ? lowFlux(audio) : 0;
            const alpha = 1 - Math.exp(-Math.max(dt, 0) / TRACK_SEC);
            const deviation = Math.sqrt(Math.max(variance, 0));
            const threshold = Math.max(FLOOR, mean + (1.8 / Math.max(sensitivity, 0.1)) * deviation);
            const sinceLast = time - lastBeat;
            const onset = flux > threshold && sinceLast >= MIN_GAP_SEC;
            mean += alpha * (flux - mean);
            variance += alpha * ((flux - mean) ** 2 - variance);
            if (onset || sinceLast >= MAX_GAP_SEC) {
                lastBeat = time;
                return true;
            }
            return false;
        },
    };
};
