// src/components/visualizer/rings52hz/rings52hzRandom.ts
// Seeded randomness, so a line's scatter and a pith's shape come out the same
// every time they are drawn (resize, theme change, seeking back).

/** 32-bit FNV-1a hash of a string. */
export const hashString = (text: string): number => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

/** mulberry32: returns a function yielding floats in [0, 1). */
export const createRandom = (seed: number): (() => number) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export const between = (random: () => number, min: number, max: number): number => (
    min + (max - min) * random()
);
