import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autoMatchBestLyric } from '@/utils/lyrics/autoMatchBestLyric';
import { neteaseApi } from '@/services/netease';
import { processNeteaseLyrics } from '@/utils/lyrics/neteaseProcessing';
import { fetchAmllDbLyrics } from '@/utils/lyrics/providers/amllDbProvider';
import { getOnlineMusicProvider } from '@/services/onlineMusic/providerRegistry';

// test/unit/lyrics/autoMatchBestLyric.test.ts
// Unit tests for the best lyric auto-matcher.

vi.mock('@/services/netease', () => ({
    neteaseApi: {
        cloudSearch: vi.fn(),
        getLyric: vi.fn(),
        getSongDetail: vi.fn(),
        getChorus: vi.fn(),
    }
}));

vi.mock('@/utils/lyrics/neteaseProcessing', () => ({
    parseNeteaseChorusRanges: vi.fn(() => []),
    processNeteaseLyrics: vi.fn()
}));

vi.mock('@/utils/lyrics/providers/amllDbProvider', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/utils/lyrics/providers/amllDbProvider')>(),
    fetchAmllDbLyrics: vi.fn()
}));

const createLyrics = (isWordByWord: boolean) => ({
    lines: [{
        fullText: 'Test lyric',
        startTime: 0,
        endTime: 1,
        words: [],
    }],
    isWordByWord,
});

describe('autoMatchBestLyric', () => {
    const cloudSearchMock = vi.mocked(neteaseApi.cloudSearch);
    const getLyricMock = vi.mocked(neteaseApi.getLyric);
    const processNeteaseLyricsMock = vi.mocked(processNeteaseLyrics);
    const fetchAmllDbLyricsMock = vi.mocked(fetchAmllDbLyrics);

    beforeEach(() => {
        vi.resetAllMocks();
        fetchAmllDbLyricsMock.mockResolvedValue(null);
    });

    it('prioritizes NetEase when perfect word-by-word match exists', async () => {
        cloudSearchMock.mockResolvedValue({
            result: {
                songs: [
                    { id: 101, name: 'Song Title', dt: 200000, ar: [{ name: 'Artist Name' }] }
                ]
            }
        });
        getLyricMock.mockResolvedValue({ lyric: '[00:00.00]test' });
        processNeteaseLyricsMock.mockResolvedValue({
            lyrics: createLyrics(true),
            mainLrc: 'test',
            yrcLrc: 'test',
            transLrc: '',
            isPureMusic: false
        });

        const result = await autoMatchBestLyric('Song Title', 'Artist Name', 200000, { preferredSource: 'netease' }) as any;
        expect(result).not.toBeNull();
        expect(result.source).toBe('netease');
        expect(result.id).toBe(101);
        expect(cloudSearchMock).toHaveBeenCalled();
    });

    it('accepts the selected NetEase lyric directly when best-lyric selection is disabled', async () => {
        getLyricMock.mockResolvedValue({ lyric: '[00:00.00]selected' });
        processNeteaseLyricsMock.mockResolvedValue({
            lyrics: createLyrics(false),
            mainLrc: 'selected',
            yrcLrc: null,
            transLrc: '',
            isPureMusic: false,
            chorusRanges: [],
        });

        const result = await autoMatchBestLyric('Correct title', 'Correct artist', 200000, {
            album: 'Correct album',
            metadataCandidate: { source: 'netease', songId: 987 },
            exactMatchOnly: true,
        }) as any;

        expect(result).toMatchObject({ source: 'netease', id: 987 });
        expect(getLyricMock).toHaveBeenCalledTimes(1);
        expect(getLyricMock).toHaveBeenCalledWith(987);
        expect(cloudSearchMock).not.toHaveBeenCalled();
    });

    it('uses a selected NetEase id to probe preferred AMLLDB before fetching NetEase lyrics', async () => {
        fetchAmllDbLyricsMock.mockResolvedValue(createLyrics(true));

        const result = await autoMatchBestLyric('Correct title', 'Correct artist', 200000, {
            album: 'Correct album',
            preferredSource: 'amll',
            metadataCandidate: { source: 'netease', songId: 987 },
        }) as any;

        expect(result).toMatchObject({ source: 'amll', id: 987, matchedLyricsProviderPlatform: 'ncm' });
        expect(fetchAmllDbLyricsMock).toHaveBeenCalledWith('ncm', ['987']);
        expect(getLyricMock).not.toHaveBeenCalled();
        expect(cloudSearchMock).not.toHaveBeenCalled();
    });

    it('returns a high-confidence line-by-line fallback when no source has word-by-word lyrics', async () => {
        cloudSearchMock.mockResolvedValue({
            result: {
                songs: [
                    { id: 101, name: 'Song Title', dt: 200000, ar: [{ name: 'Artist Name' }] }
                ]
            }
        });
        getLyricMock.mockResolvedValue({ lyric: '[00:00.00]line lyric' });
        const lineByLineLyrics = createLyrics(false);
        processNeteaseLyricsMock.mockResolvedValue({
            lyrics: lineByLineLyrics,
            mainLrc: 'line lyric',
            yrcLrc: null,
            transLrc: '',
            isPureMusic: false,
            chorusRanges: [],
        });

        const result = await autoMatchBestLyric('Song Title', 'Artist Name', 200000, {
            preferredSource: 'netease',
        }) as any;

        expect(result).toMatchObject({
            source: 'netease',
            id: 101,
            lyrics: lineByLineLyrics,
        });
        expect(fetchAmllDbLyricsMock).toHaveBeenCalledWith('ncm', ['101']);
    });

    it('stops matching when the NetEase candidate is pure music', async () => {
        cloudSearchMock.mockResolvedValue({
            result: {
                songs: [
                    { id: 101, name: 'Song Title', dt: 200000, ar: [{ name: 'Artist Name' }] }
                ]
            }
        });
        getLyricMock.mockResolvedValue({ lrc: { lyric: '[00:00.00]纯音乐，请欣赏' } });
        processNeteaseLyricsMock.mockResolvedValue({
            lyrics: null,
            mainLrc: '[00:00.00]纯音乐，请欣赏',
            yrcLrc: null,
            transLrc: '',
            isPureMusic: true,
            chorusRanges: []
        });

        const result = await autoMatchBestLyric('Song Title', 'Artist Name', 200000, { preferredSource: 'netease' });

        expect(result).toEqual({ isPureMusic: true, source: 'netease', id: 101 });
    });

    it('stops matching when the preprocessed NetEase candidate is pure music', async () => {
        const result = await autoMatchBestLyric('Song Title', 'Artist Name', 200000, {
            preferredSource: 'netease',
            neteaseCandidate: {
                id: 101,
                lyrics: null,
                isPureMusic: true,
                chorusRanges: []
            }
        });

        expect(result).toEqual({ isPureMusic: true, source: 'netease', id: 101 });
        expect(cloudSearchMock).not.toHaveBeenCalled();
        expect(getLyricMock).not.toHaveBeenCalled();
    });

    it('returns the preprocessed NetEase candidate directly when it is word-by-word', async () => {
        const result = await autoMatchBestLyric('Song Title', 'Artist Name', 200000, {
            preferredSource: 'netease',
            neteaseCandidate: {
                id: 101,
                lyrics: createLyrics(true),
                chorusRanges: [{ startTime: 10, endTime: 30 }]
            }
        }) as any;

        expect(result.source).toBe('netease');
        expect(result.id).toBe(101);
        expect(cloudSearchMock).not.toHaveBeenCalled();
        expect(getLyricMock).not.toHaveBeenCalled();
    });

    it('prioritizes AMLLDB when preferred and a NetEase candidate id has TTML', async () => {
        fetchAmllDbLyricsMock.mockResolvedValue(createLyrics(true));

        const result = await autoMatchBestLyric('Song Title', 'Artist Name', 200000, {
            preferredSource: 'amll',
            neteaseCandidate: {
                id: 101,
                lyrics: createLyrics(false),
                chorusRanges: []
            }
        }) as any;

        expect(result.source).toBe('amll');
        expect(result.id).toBe(101);
        expect(result.matchedLyricsProviderPlatform).toBe('ncm');
        expect(fetchAmllDbLyricsMock).toHaveBeenCalledWith('ncm', ['101']);
        expect(cloudSearchMock).not.toHaveBeenCalled();
    });

    it('preserves AMLLDB TTML chorus markers instead of fetching NetEase chorus ranges', async () => {
        cloudSearchMock.mockResolvedValue({
            result: {
                songs: [
                    { id: 101, name: 'Song Title', dt: 200000, ar: [{ name: 'Artist Name' }] }
                ]
            }
        });
        getLyricMock.mockResolvedValue({ lyric: '[00:00.00]test' });
        processNeteaseLyricsMock.mockResolvedValue({
            lyrics: createLyrics(false),
            mainLrc: 'test',
            yrcLrc: null,
            transLrc: '',
            isPureMusic: false
        });
        fetchAmllDbLyricsMock.mockResolvedValue({
            lines: [
                { fullText: 'Chorus', startTime: 10, endTime: 20, words: [], isChorus: true, chorusEffect: 'bars' }
            ],
            isWordByWord: true
        });

        const result = await autoMatchBestLyric('Song Title', 'Artist Name', 200000) as any;

        expect(result.source).toBe('amll');
        expect(result.lyrics.lines[0].isChorus).toBe(true);
    });

    it('returns null if no sources match the duration filter', async () => {
        cloudSearchMock.mockResolvedValue({
            result: {
                songs: [
                    { id: 101, name: 'Song Title', dt: 205000, ar: [{ name: 'Artist Name' }] }
                ]
            }
        });
        const result = await autoMatchBestLyric('Song Title', 'Artist Name', 200000);
        expect(result).toBeNull();
    });
});
