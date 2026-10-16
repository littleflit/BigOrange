import { afterEach, describe, expect, it, vi } from 'vitest';
import { neteaseApi } from '@/services/netease';
import { neteaseProvider } from '@/services/onlineMusic/neteaseProvider';
import { omni } from '@/services/onlineMusic/omni';
import { registerOnlineMusicProvider, unregisterOnlineMusicProvider } from '@/services/onlineMusic/providerRegistry';
import { useOnlineProviderAccountStore } from '@/stores/useOnlineProviderAccountStore';
import type { OnlineMusicProvider } from '@/types/onlineMusic';

// test/unit/onlineMusic/userSearch.test.ts
// 搜索用户走 Omni：网易云用 /cloudsearch?type=1002，没有该能力的 provider 回空页。

vi.mock('@/services/netease', () => ({
    neteaseApi: { cloudSearch: vi.fn() },
}));

const noUserSearchProvider: OnlineMusicProvider = {
    id: 'user-search-missing',
    displayName: 'NoUserSearch',
    capabilities: {
        search: true, playback: false, lyrics: false, auth: false, userLibrary: false,
        playlists: false, albums: false, artists: false, recommendations: false,
        mutations: false, wordByWordLyrics: false,
    },
    normalizeSong: raw => raw as never,
    search: {
        searchSongs: async () => ({ items: [], hasMore: false, nextOffset: 0 }),
    },
};

afterEach(() => {
    unregisterOnlineMusicProvider(noUserSearchProvider.id);
    useOnlineProviderAccountStore.getState().setActiveProviderId('netease');
    omni.invalidateActiveRequests();
    vi.clearAllMocks();
});

describe('user search', () => {
    it('netease searchUsers 用 type=1002 并归一化用户', async () => {
        vi.mocked(neteaseApi.cloudSearch).mockResolvedValue({
            result: {
                userprofiles: [
                    { userId: 123, nickname: '测试用户', avatarUrl: 'https://img/avatar.jpg' },
                    { nickname: '' },
                ],
                userprofileCount: 5,
            },
        } as never);

        const page = await neteaseProvider.search!.searchUsers!('测试', 20, 0);

        expect(neteaseApi.cloudSearch).toHaveBeenCalledWith('测试', 20, 0, 1002);
        expect(page.items).toEqual([{ id: 123, nickname: '测试用户', avatarUrl: 'https://img/avatar.jpg', backgroundUrl: undefined, vipType: undefined }]);
        expect(page.total).toBe(5);
        expect(page.hasMore).toBe(true);
        expect(page.nextOffset).toBe(1);
    });

    it('没有 searchUsers 的 provider 经 Omni 回空页', async () => {
        registerOnlineMusicProvider(noUserSearchProvider);
        const page = await omni.searchProviderUsers(noUserSearchProvider.id, '谁', { limit: 20, offset: 0 });
        expect(page).toEqual({ items: [], hasMore: false, nextOffset: 0 });
    });
});
