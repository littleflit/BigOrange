import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAmllDbLyrics } from '@/utils/lyrics/providers/amllDbProvider';
import { searchAmllDbLyricCandidates } from '@/utils/lyrics/lyricMatchSources';
import { getOnlineMusicProvider } from '@/services/onlineMusic/providerRegistry';

// test/unit/lyrics/lyricMatchSources.test.ts
// Covers source-specific lyric matching orchestration (NetEase + AMLLDB only).

vi.mock('@/services/onlineMusic/providerRegistry', () => ({
    getOnlineMusicProvider: vi.fn(),
}));

vi.mock('@/utils/lyrics/providers/amllDbProvider', () => ({
    fetchAmllDbLyrics: vi.fn(),
}));

vi.mock('@/utils/lyrics/chorusEffects', () => ({
    applyNeteaseChorusByTime: vi.fn((lyrics) => lyrics),
}));

const createWordByWordLyrics = () => ({
    lines: [{
        fullText: 'Test lyric',
        startTime: 0,
        endTime: 1,
        words: [],
    }],
    isWordByWord: true as const,
});

describe('lyricMatchSources', () => {
    const getProviderMock = vi.mocked(getOnlineMusicProvider);
    const fetchAmllDbLyricsMock = vi.mocked(fetchAmllDbLyrics);

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('probes AMLLDB candidates concurrently', async () => {
        const deferred: Array<{
            resolve: (value: ReturnType<typeof createWordByWordLyrics> | null) => void;
        }> = [];

        getProviderMock.mockReturnValue({
            search: {
                searchSongs: vi.fn().mockResolvedValue({
                    items: [
                        { id: 101, name: 'Song Title', durationMs: 200000, artists: [{ name: 'Artist Name' }] },
                        { id: 102, name: 'Song Title', durationMs: 200000, artists: [{ name: 'Artist Name' }] },
                    ],
                    hasMore: false,
                    nextOffset: 0,
                }),
            },
        } as any);
        fetchAmllDbLyricsMock.mockImplementation(() => {
            let resolve!: (value: ReturnType<typeof createWordByWordLyrics> | null) => void;
            const promise = new Promise<ReturnType<typeof createWordByWordLyrics> | null>((res) => {
                resolve = res;
            });
            deferred.push({ resolve });
            return promise;
        });

        const searchPromise = searchAmllDbLyricCandidates('Song Title - Artist Name', {
            title: 'Song Title',
            artist: 'Artist Name',
            durationMs: 200000,
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(fetchAmllDbLyricsMock).toHaveBeenCalledTimes(2);

        deferred[0].resolve(null);
        deferred[1].resolve(createWordByWordLyrics());
        const results = await searchPromise;

        expect(results.map(result => result.id)).toEqual([102]);
    });
});
