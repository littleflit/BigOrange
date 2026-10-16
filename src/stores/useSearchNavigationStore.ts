import { create } from 'zustand';
import { getNavidromeConfig, navidromeApi } from '../services/navidromeService';
import type { HomeViewTab, LocalSong, SongResult, UnifiedSong } from '../types';
import type { OnlineProviderId, OmniUser } from '../types/onlineMusic';
import {
    applyLocalLibraryEntityDisplay,
    buildUnifiedLocalSong,
    type LocalLibraryDisplayCatalog,
} from '../services/playbackAdapters';
import { omni } from '../services/onlineMusic/omni';
import { isLocalPlaybackSong, isNavidromePlaybackSong } from '../utils/appPlaybackGuards';

const LAST_HOME_VIEW_TAB_KEY = 'last_home_view_tab';
const DEFAULT_SEARCH_LIMIT = 30;
export type SearchSource = OnlineProviderId | 'local' | 'navidrome';
export type SearchReturnView = 'home' | 'player';
/** 搜索面板的内容种类：歌曲沿用旧链路，用户走 Omni 用户搜索（网易云先实现）。 */
export type SearchKind = 'songs' | 'users';

type SearchExecutorDeps = {
    localSongs: LocalSong[];
    localLibraryCatalog?: LocalLibraryDisplayCatalog;
    t: (key: string, fallback?: string) => string;
};

type SearchExecutionResult = {
    results: UnifiedSong[];
    hasMore: boolean;
    nextOffset: number;
};

type SearchCacheEntry = {
    results: UnifiedSong[];
    offset: number;
    hasMore: boolean;
    scrollTop: number;
};

type SearchUserCacheEntry = {
    results: OmniUser[];
    offset: number;
    hasMore: boolean;
};

interface SearchNavigationState {
    homeViewTab: HomeViewTab;
    searchQuery: string;
    searchSourceTab: SearchSource;
    searchKind: SearchKind;
    searchResults: UnifiedSong[] | null;
    userSearchResults: OmniUser[] | null;
    searchReturnView: SearchReturnView;
    isSearchOpen: boolean;
    isSearching: boolean;
    isLoadingMore: boolean;
    searchError: string | null;
    requestId: number;
    offset: number;
    limit: number;
    hasMore: boolean;
    userOffset: number;
    userHasMore: boolean;
    scrollTop: number;
    searchCache: Record<string, SearchCacheEntry>;
    userSearchCache: Record<string, SearchUserCacheEntry>;
    setHomeViewTab: (tab: HomeViewTab) => void;
    setSearchQuery: (query: string) => void;
    setSearchKind: (kind: SearchKind) => void;
    setSearchScrollTop: (scrollTop: number) => void;
    restoreSearch: (payload: { query: string; sourceTab: SearchSource; returnView?: SearchReturnView; }) => void;
    hideSearchOverlay: () => void;
    resetRuntime: (onlineProviderId?: OnlineProviderId) => void;
    followOnlineProvider: (providerId: OnlineProviderId) => void;
    submitSearch: (payload: { query?: string; sourceTab: SearchSource; deps: SearchExecutorDeps; returnView?: SearchReturnView; }) => Promise<boolean>;
    loadMoreSearchResults: (payload: { deps: SearchExecutorDeps; }) => Promise<void>;
    submitUserSearch: (payload: { query?: string; sourceTab: SearchSource; }) => Promise<boolean>;
    loadMoreUserSearchResults: () => Promise<void>;
}

const getSearchCacheKey = (query: string, sourceTab: SearchSource) => (
    `${sourceTab}:${query.trim().toLowerCase()}`
);

export const resolveSearchSource = (tab: HomeViewTab | SearchSource): SearchSource => {
    if (tab === 'local' || tab === 'navidrome') {
        return tab;
    }
    if (tab !== 'playlist' && tab !== 'albums' && tab !== 'radio') return tab as OnlineProviderId;
    return 'netease';
};

export const resolveCommandPaletteSearchSource = (
    currentSong: SongResult | null,
    searchSourceTab: SearchSource,
    activeOnlineProviderId: OnlineProviderId,
): SearchSource => {
    if (currentSong && isLocalPlaybackSong(currentSong)) return 'local';
    if (currentSong && isNavidromePlaybackSong(currentSong)) return 'navidrome';
    if (currentSong || searchSourceTab === 'netease') return activeOnlineProviderId;
    return searchSourceTab;
};

const mapLocalSongToUnifiedSong = (
    song: LocalSong,
    catalog?: LocalLibraryDisplayCatalog,
): UnifiedSong => applyLocalLibraryEntityDisplay(buildUnifiedLocalSong({
        localSong: song,
        matchedSong: null,
        coverUrl: song.useOnlineCover ? song.onlineMetadata?.coverUrl || null : null,
        preferOnlineMetadata: false,
    }), catalog);

const searchLocalSongs = (
    deps: SearchExecutorDeps,
    query: string,
): SearchExecutionResult => {
    const lowerQuery = query.toLowerCase();
    const results = deps.localSongs
        .filter(song => {
            const title = song.title.toLowerCase();
            const artist = [
                ...song.importedMetadata.artistNames,
                ...song.onlineMetadata?.artists.map(item => item.name) || [],
            ].join(' ').toLowerCase();
            const album = [song.importedMetadata.albumName, song.onlineMetadata?.album?.name]
                .filter(Boolean).join(' ').toLowerCase();
            return title.includes(lowerQuery) || artist.includes(lowerQuery) || album.includes(lowerQuery);
        })
        .map(song => mapLocalSongToUnifiedSong(song, deps.localLibraryCatalog));

    return {
        results,
        hasMore: false,
        nextOffset: results.length,
    };
};

const searchNavidromeSongs = async (query: string): Promise<SearchExecutionResult> => {
    const config = getNavidromeConfig();
    if (!config) {
        return { results: [], hasMore: false, nextOffset: 0 };
    }

    const response = await navidromeApi.search(config, query, 0, 0, DEFAULT_SEARCH_LIMIT);
    const results = (response.song || []).map(song => {
        const navidromeSong = navidromeApi.toNavidromeSong(config, song);
        return navidromeSong as UnifiedSong;
    });

    return {
        results,
        hasMore: false,
        nextOffset: results.length,
    };
};

const searchOnlineProviderSongs = async (
    providerId: OnlineProviderId,
    query: string,
    limit: number,
    offset: number,
): Promise<SearchExecutionResult> => {
    const page = await omni.searchProviderSongs(providerId, query, { limit, offset });
    return { results: page.items, hasMore: page.hasMore, nextOffset: page.nextOffset };
};

const executeSearch = async (
    query: string,
    sourceTab: SearchSource,
    offset: number,
    limit: number,
    deps: SearchExecutorDeps
): Promise<SearchExecutionResult> => {
    if (sourceTab === 'local') {
        return searchLocalSongs(deps, query);
    }

    if (sourceTab === 'navidrome') {
        return searchNavidromeSongs(query);
    }

    return searchOnlineProviderSongs(sourceTab, query, limit, offset);
};

const getInitialHomeViewTab = (): HomeViewTab => {
    if (typeof window === 'undefined') {
        return 'playlist';
    }
    const savedTab = localStorage.getItem(LAST_HOME_VIEW_TAB_KEY);
    return savedTab === 'playlist' || savedTab === 'local' || savedTab === 'albums' || savedTab === 'navidrome' || savedTab === 'radio'
        ? savedTab
        : 'playlist';
};

export const useSearchNavigationStore = create<SearchNavigationState>((set, get) => ({
    homeViewTab: getInitialHomeViewTab(),
    searchQuery: '',
    searchSourceTab: 'netease',
    searchKind: 'songs',
    searchResults: null,
    userSearchResults: null,
    searchReturnView: 'home',
    isSearchOpen: false,
    isSearching: false,
    isLoadingMore: false,
    searchError: null,
    requestId: 0,
    offset: 0,
    limit: DEFAULT_SEARCH_LIMIT,
    hasMore: false,
    userOffset: 0,
    userHasMore: false,
    scrollTop: 0,
    searchCache: {},
    userSearchCache: {},
    setHomeViewTab: (tab) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(LAST_HOME_VIEW_TAB_KEY, tab);
        }
        set({ homeViewTab: tab });
    },
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSearchKind: (kind) => set({ searchKind: kind }),
    setSearchScrollTop: (scrollTop) => set(state => {
        const cacheKey = getSearchCacheKey(state.searchQuery, state.searchSourceTab);
        const cached = state.searchCache[cacheKey];
        return {
            scrollTop,
            searchCache: cached
                ? {
                    ...state.searchCache,
                    [cacheKey]: { ...cached, scrollTop },
                }
                : state.searchCache,
        };
    }),
    restoreSearch: ({ query, sourceTab, returnView = 'home' }) => set(state => {
        const cached = state.searchCache[getSearchCacheKey(query, sourceTab)];
        return {
            searchQuery: query,
            searchSourceTab: sourceTab,
            searchReturnView: returnView,
            searchResults: cached?.results ?? null,
            offset: cached?.offset ?? 0,
            hasMore: cached?.hasMore ?? false,
            scrollTop: cached?.scrollTop ?? 0,
            searchError: null,
            isSearching: false,
            isLoadingMore: false,
            isSearchOpen: true,
        };
    }),
    hideSearchOverlay: () => set({ isSearchOpen: false, searchReturnView: 'home' }),
    resetRuntime: (onlineProviderId) => set(state => ({
        searchQuery: '',
        searchSourceTab: onlineProviderId ?? state.searchSourceTab,
        searchResults: null,
        userSearchResults: null,
        searchReturnView: 'home',
        isSearchOpen: false,
        isSearching: false,
        isLoadingMore: false,
        searchError: null,
        requestId: state.requestId + 1,
        offset: 0,
        hasMore: false,
        userOffset: 0,
        userHasMore: false,
        scrollTop: 0,
    })),
    // The overlay's online source is the active provider. A switch moves it through resetRuntime, but
    // the active provider also changes without one (startup, session restore, a Folium mod source going
    // away), so this keeps it in step. Local and Navidrome are left alone, and the results stay: clearing
    // them is the switch's job.
    followOnlineProvider: (providerId) => set(state => (
        state.searchSourceTab === 'local' || state.searchSourceTab === 'navidrome' || state.searchSourceTab === providerId
            ? state
            : { searchSourceTab: providerId }
    )),
    submitSearch: async ({ query, sourceTab, deps, returnView = 'home' }) => {
        const trimmedQuery = (query ?? get().searchQuery).trim();
        if (!trimmedQuery) {
            return false;
        }

        const requestId = get().requestId + 1;
        set({
            searchQuery: trimmedQuery,
            searchSourceTab: sourceTab,
            searchKind: 'songs',
            searchReturnView: returnView,
            isSearchOpen: true,
            isSearching: true,
            isLoadingMore: false,
            searchError: null,
            requestId,
            searchResults: null,
            offset: 0,
            hasMore: false,
            scrollTop: 0,
        });

        try {
            const result = await executeSearch(trimmedQuery, sourceTab, 0, get().limit, deps);
            if (get().requestId !== requestId) {
                return true;
            }
            set(state => ({
                searchResults: result.results,
                hasMore: result.hasMore,
                offset: result.nextOffset,
                isSearching: false,
                searchCache: {
                    ...state.searchCache,
                    [getSearchCacheKey(trimmedQuery, sourceTab)]: {
                        results: result.results,
                        hasMore: result.hasMore,
                        offset: result.nextOffset,
                        scrollTop: 0,
                    },
                },
            }));
            return true;
        } catch (error) {
            console.error('[SearchStore] submitSearch failed:', error);
            if (get().requestId !== requestId) {
                return true;
            }
            set({
                searchResults: [],
                hasMore: false,
                offset: 0,
                isSearching: false,
                searchError: error instanceof Error ? error.message : 'search_failed',
            });
            return true;
        }
    },
    loadMoreSearchResults: async ({ deps }) => {
        const {
            searchQuery,
            searchSourceTab,
            searchResults,
            hasMore,
            isSearching,
            isLoadingMore,
            offset,
            limit,
        } = get();

        if (
            searchSourceTab === 'local'
            || searchSourceTab === 'navidrome'
            || !hasMore
            || isSearching
            || isLoadingMore
            || !searchQuery.trim()
        ) {
            return;
        }

        const requestId = get().requestId;
        set({ isLoadingMore: true, searchError: null });

        try {
            const result = await executeSearch(searchQuery, searchSourceTab, offset, limit, deps);
            if (get().requestId !== requestId) {
                return;
            }
            set(state => {
                const results = [...(searchResults || []), ...result.results];
                return {
                    searchResults: results,
                    hasMore: result.hasMore,
                    offset: result.nextOffset,
                    isLoadingMore: false,
                    searchCache: {
                        ...state.searchCache,
                        [getSearchCacheKey(searchQuery, searchSourceTab)]: {
                            results,
                            hasMore: result.hasMore,
                            offset: result.nextOffset,
                            scrollTop: state.scrollTop,
                        },
                    },
                };
            });
        } catch (error) {
            console.error('[SearchStore] loadMoreSearchResults failed:', error);
            if (get().requestId === requestId) {
                set({
                    isLoadingMore: false,
                    searchError: error instanceof Error ? error.message : 'search_failed',
                });
            }
        }
    },
    // 用户搜索与歌曲搜索共用 query / source / 加载态，结果与分页独立。本地与 Navidrome 没有用户概念，直接回空。
    submitUserSearch: async ({ query, sourceTab }) => {
        const trimmedQuery = (query ?? get().searchQuery).trim();
        if (!trimmedQuery) return false;
        if (sourceTab === 'local' || sourceTab === 'navidrome') {
            set({
                searchQuery: trimmedQuery,
                searchSourceTab: sourceTab,
                searchKind: 'users',
                searchReturnView: get().searchReturnView,
                isSearchOpen: true,
                isSearching: false,
                userSearchResults: [],
                userOffset: 0,
                userHasMore: false,
                searchError: null,
            });
            return true;
        }

        const cached = get().userSearchCache[getSearchCacheKey(trimmedQuery, sourceTab)];
        const requestId = get().requestId + 1;
        set({
            searchQuery: trimmedQuery,
            searchSourceTab: sourceTab,
            searchKind: 'users',
            isSearchOpen: true,
            isSearching: true,
            isLoadingMore: false,
            searchError: null,
            requestId,
            userSearchResults: cached?.results ?? null,
            userOffset: cached?.offset ?? 0,
            userHasMore: cached?.hasMore ?? false,
        });
        if (cached) {
            set({ isSearching: false });
            return true;
        }

        try {
            const page = await omni.searchProviderUsers(sourceTab, trimmedQuery, { limit: get().limit, offset: 0 });
            if (get().requestId !== requestId) return true;
            set(state => ({
                userSearchResults: page.items,
                userOffset: page.nextOffset,
                userHasMore: page.hasMore,
                isSearching: false,
                userSearchCache: {
                    ...state.userSearchCache,
                    [getSearchCacheKey(trimmedQuery, sourceTab)]: {
                        results: page.items,
                        offset: page.nextOffset,
                        hasMore: page.hasMore,
                    },
                },
            }));
            return true;
        } catch (error) {
            console.error('[SearchStore] submitUserSearch failed:', error);
            if (get().requestId !== requestId) return true;
            set({
                userSearchResults: [],
                userOffset: 0,
                userHasMore: false,
                isSearching: false,
                searchError: error instanceof Error ? error.message : 'search_failed',
            });
            return true;
        }
    },
    loadMoreUserSearchResults: async () => {
        const { searchQuery, searchSourceTab, userSearchResults, userHasMore, isSearching, isLoadingMore, userOffset, limit } = get();
        if (searchSourceTab === 'local' || searchSourceTab === 'navidrome' || !userHasMore || isSearching || isLoadingMore || !searchQuery.trim()) {
            return;
        }
        const requestId = get().requestId;
        set({ isLoadingMore: true, searchError: null });
        try {
            const page = await omni.searchProviderUsers(searchSourceTab, searchQuery, { limit, offset: userOffset });
            if (get().requestId !== requestId) return;
            set(state => {
                const results = [...(userSearchResults || []), ...page.items];
                return {
                    userSearchResults: results,
                    userOffset: page.nextOffset,
                    userHasMore: page.hasMore,
                    isLoadingMore: false,
                    userSearchCache: {
                        ...state.userSearchCache,
                        [getSearchCacheKey(searchQuery, searchSourceTab)]: {
                            results,
                            offset: page.nextOffset,
                            hasMore: page.hasMore,
                        },
                    },
                };
            });
        } catch (error) {
            console.error('[SearchStore] loadMoreUserSearchResults failed:', error);
            if (get().requestId === requestId) {
                set({ isLoadingMore: false, searchError: error instanceof Error ? error.message : 'search_failed' });
            }
        }
    },
}));
