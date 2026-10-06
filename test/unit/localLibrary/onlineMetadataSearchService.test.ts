import { beforeEach, describe, expect, it, vi } from 'vitest';
import { neteaseApi } from '@/services/netease';
import {
    findAutomaticOnlineMetadataCandidate,
    searchOnlineMetadata,
} from '@/services/onlineMetadataSearchService';

// test/unit/localLibrary/onlineMetadataSearchService.test.ts
// Verifies NetEase-only metadata selection and exact manual query forwarding.

vi.mock('@/services/netease', () => ({ neteaseApi: { cloudSearch: vi.fn() } }));

const song = {
    id: 'local-song',
    fileName: 'Target Song.flac',
    filePath: 'Library/Target Song.flac',
    title: 'Target Song',
    titleOrigin: 'import' as const,
    importedMetadata: { title: 'Target Song', titleSource: 'filename' as const, artistNames: ['Target Artist'], albumName: 'Target Album' },
    duration: 200000,
    fileSize: 1,
    mimeType: 'audio/flac',
    addedAt: 1,
};

describe('onlineMetadataSearchService', () => {
    beforeEach(() => vi.resetAllMocks());

    it('keeps a title-compatible NetEase candidate', async () => {
        vi.mocked(neteaseApi.cloudSearch).mockResolvedValue({ result: { songs: [
            { id: 1, name: 'Target Song', dt: 200000, ar: [{ id: 2, name: 'Target Artist' }], al: { id: 3, name: 'Target Album' } },
        ] } });
        const candidate = await findAutomaticOnlineMetadataCandidate(song);
        expect(candidate?.source).toBe('netease');
        expect(candidate?.durationMatched).toBe(true);
    });

    it('returns null when NetEase has no title-compatible candidate', async () => {
        vi.mocked(neteaseApi.cloudSearch).mockResolvedValue({ result: { songs: [
            { id: 1, name: 'Completely Unrelated Melody', dt: 200000, ar: [{ name: 'Someone Else' }] },
        ] } });
        const candidate = await findAutomaticOnlineMetadataCandidate(song);
        expect(candidate).toBeNull();
    });

    it('passes a manual query only to NetEase', async () => {
        vi.mocked(neteaseApi.cloudSearch).mockResolvedValue({ result: { songs: [] } });
        await searchOnlineMetadata('netease', 'custom user text', {
            title: 'Target Song', artist: '', durationMs: 0,
        });
        expect(neteaseApi.cloudSearch).toHaveBeenCalled();
    });

    it('stops waiting for a provider request when cancelled', async () => {
        let resolveRequest!: (value: { result: { songs: never[] } }) => void;
        vi.mocked(neteaseApi.cloudSearch).mockReturnValue(new Promise(resolve => {
            resolveRequest = resolve;
        }));
        const controller = new AbortController();
        const pending = searchOnlineMetadata('netease', 'Target Song', {
            title: 'Target Song', artist: '', durationMs: 0,
        }, { signal: controller.signal });
        controller.abort();
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        resolveRequest({ result: { songs: [] } });
    });
});
