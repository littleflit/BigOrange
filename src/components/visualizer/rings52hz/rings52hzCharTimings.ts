import type { Line } from '../../../types';

// src/components/visualizer/rings52hz/rings52hzCharTimings.ts
// When each character of a line lights up. Returns one entry per character of
// Array.from(line.fullText): `{ start, end }` in song seconds, or null for spaces.
// Word timings are used when the lyric has them, matched to the line's
// non-space characters in order; otherwise the line's time is spread evenly.

export interface Rings52hzCharTiming {
    start: number;
    end: number;
}

const isSpace = (char: string): boolean => /\s/u.test(char);

export const buildCharTimings = (line: Line): Array<Rings52hzCharTiming | null> => {
    const chars = Array.from(line.fullText);
    const visible = chars.filter((char) => !isSpace(char)).length;

    const fromWords: Rings52hzCharTiming[] = [];
    line.words.forEach((word) => {
        const wordChars = Array.from(word.text).filter((char) => !isSpace(char));
        const duration = Math.max(0.001, word.endTime - word.startTime);
        wordChars.forEach((_, index) => {
            fromWords.push({
                start: word.startTime + (duration * index) / wordChars.length,
                end: word.startTime + (duration * (index + 1)) / wordChars.length,
            });
        });
    });

    // Word text that does not match the line (count differs) is not trusted.
    const useWords = fromWords.length === visible && visible > 0;
    const span = Math.max(0.2, (line.endTime - line.startTime) * 0.85);
    let cursor = 0;
    return chars.map((char) => {
        if (isSpace(char)) return null;
        const index = cursor;
        cursor += 1;
        if (useWords) return fromWords[index];
        return {
            start: line.startTime + (span * index) / visible,
            end: line.startTime + (span * (index + 1)) / visible,
        };
    });
};
