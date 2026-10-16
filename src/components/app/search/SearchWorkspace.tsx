import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Loader2, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Theme, UnifiedSong } from '../../../types';
import type { MediaId, OmniCollection, OmniUser } from '../../../types/onlineMusic';
import {
    type SearchKind,
    type SearchSource,
    useSearchNavigationStore,
} from '../../../stores/useSearchNavigationStore';
import SearchResultsList from './SearchResultsList';
import SearchUserResultsList from './SearchUserResultsList';
import UserPublicPlaylists from './UserPublicPlaylists';
import { useCollectionNavigationStore } from '../../../stores/useCollectionNavigationStore';
import { useOnlineProviderAccountStore } from '../../../stores/useOnlineProviderAccountStore';
import { omni } from '../../../services/onlineMusic/omni';

// src/components/app/search/SearchWorkspace.tsx

type SearchWorkspaceProps = {
    theme: Theme;
    isDaylight: boolean;
    onClose: () => void;
    onSubmitSearch: (source?: SearchSource) => void;
    onLoadMore: () => void;
    onPlayTrack: (track: UnifiedSong) => void;
    onAddTrackToQueue: (track: UnifiedSong) => void;
    onOpenArtist: (track: UnifiedSong, artistName: string, artistId?: MediaId, entityId?: string) => void;
    onOpenAlbum: (track: UnifiedSong, albumName: string, albumId?: MediaId, entityId?: string) => void;
    onOpenPlaylist: (collection: OmniCollection) => void;
    /**
     * 渲染前把结果重新套上当前的展示数据（本地曲目的歌手 / 专辑实体）。store 里的结果是提交那一刻的快照，
     * 本地曲库的实体目录在导入后要晚一拍才加载完，那之前搜到的行没有专辑、歌手链接是灰的；
     * 不在这里按当前目录重算，它们会一直停在那个状态，直到重新搜索。
     */
    resolveTrackDisplay?: (track: UnifiedSong) => UnifiedSong;
};

const SearchWorkspace: React.FC<SearchWorkspaceProps> = ({
    theme,
    isDaylight,
    onClose,
    onSubmitSearch,
    onLoadMore,
    onPlayTrack,
    onAddTrackToQueue,
    onOpenArtist,
    onOpenAlbum,
    onOpenPlaylist,
    resolveTrackDisplay,
}) => {
    const { t } = useTranslation();
    const {
        searchQuery,
        searchSourceTab,
        searchKind,
        searchResults,
        userSearchResults,
        isSearchOpen,
        isSearching,
        isLoadingMore,
        searchError,
        hasMore,
        userHasMore,
        scrollTop,
        setSearchQuery,
        setSearchKind,
        setSearchScrollTop,
        submitUserSearch,
        loadMoreUserSearchResults,
    } = useSearchNavigationStore(useShallow(state => ({
        searchQuery: state.searchQuery,
        searchSourceTab: state.searchSourceTab,
        searchKind: state.searchKind,
        searchResults: state.searchResults,
        userSearchResults: state.userSearchResults,
        isSearchOpen: state.isSearchOpen,
        isSearching: state.isSearching,
        isLoadingMore: state.isLoadingMore,
        searchError: state.searchError,
        hasMore: state.hasMore,
        userHasMore: state.userHasMore,
        scrollTop: state.scrollTop,
        setSearchQuery: state.setSearchQuery,
        setSearchKind: state.setSearchKind,
        setSearchScrollTop: state.setSearchScrollTop,
        submitUserSearch: state.submitUserSearch,
        loadMoreUserSearchResults: state.loadMoreUserSearchResults,
    })));
    const [selectedUser, setSelectedUser] = useState<OmniUser | null>(null);
    // 换关键词 / 换源 / 换种类时回到用户列表，避免旧用户的歌单残留。
    useEffect(() => {
        setSelectedUser(null);
    }, [searchQuery, searchSourceTab, searchKind]);
    const results = useMemo(() => {
        const raw = searchResults || [];
        return resolveTrackDisplay ? raw.map(resolveTrackDisplay) : raw;
    }, [resolveTrackDisplay, searchResults]);
    const userResults = useMemo(() => userSearchResults || [], [userSearchResults]);
    const activeOnlineProviderId = useOnlineProviderAccountStore(state => state.activeProviderId);
    const sources = useMemo<SearchSource[]>(() => [activeOnlineProviderId, 'local', 'navidrome'], [activeOnlineProviderId]);
    const hasCollection = useCollectionNavigationStore(state => Boolean(state.snapshot?.stack.length));
    const isOnlineSource = searchSourceTab !== 'local' && searchSourceTab !== 'navidrome';
    const getSourceLabel = (source: SearchSource) => {
        if (source === 'local') return t('search.sourceLocal');
        if (source === 'navidrome') return t('search.sourceNavidrome');
        return omni.getProviderLabel(source);
    };
    const handleFormSubmit = () => {
        if (searchKind === 'users' && isOnlineSource) {
            void submitUserSearch({ sourceTab: searchSourceTab });
            return;
        }
        onSubmitSearch();
    };
    const handleSourceSwitch = (source: SearchSource) => {
        if (source === searchSourceTab) return;
        if (searchKind === 'users') {
            void submitUserSearch({ sourceTab: source });
            return;
        }
        onSubmitSearch(source);
    };
    const handleKindSwitch = (kind: SearchKind) => {
        if (kind === searchKind) return;
        setSearchKind(kind);
        if (!searchQuery.trim()) return;
        if (kind === 'users') {
            if (isOnlineSource) void submitUserSearch({ sourceTab: searchSourceTab });
            return;
        }
        onSubmitSearch();
    };

    useEffect(() => {
        if (!isSearchOpen || hasCollection) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hasCollection, isSearchOpen, onClose]);

    return (
        <AnimatePresence>
            {isSearchOpen && (
                <motion.section
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 28 }}
                    className={`fixed inset-0 flex flex-col overflow-hidden px-3 py-4 sm:px-6 sm:py-6 ${
                        hasCollection ? 'z-[5]' : 'z-50'
                    }`}
                    style={{
                        color: theme.primaryColor,
                        backgroundColor: isDaylight ? 'rgba(250,250,250,0.96)' : 'rgba(8,8,10,0.94)',
                        backdropFilter: 'blur(24px)',
                    }}
                >
                    <header className="mx-auto flex w-full max-w-5xl shrink-0 flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <form
                                className={`relative flex-1 rounded-2xl border ${
                                    isDaylight ? 'border-black/10 bg-black/[0.04]' : 'border-white/10 bg-white/[0.05]'
                                }`}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    handleFormSubmit();
                                }}
                            >
                                {isSearching ? (
                                    <Loader2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin opacity-50" />
                                ) : (
                                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-45" />
                                )}
                                <input
                                    value={searchQuery}
                                    onChange={event => setSearchQuery(event.target.value)}
                                    placeholder={searchKind === 'users' ? t('search.userPlaceholder') : t('search.placeholder')}
                                    className="w-full bg-transparent py-3.5 pl-11 pr-4 text-sm outline-none"
                                    autoFocus
                                />
                            </form>
                            <button
                                type="button"
                                onClick={onClose}
                                className={`rounded-full p-3 ${
                                    isDaylight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/10 hover:bg-white/15'
                                }`}
                                aria-label={t('ui.backToHome')}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <nav className="flex gap-2 overflow-x-auto pb-1">
                            {sources.map(source => (
                                <button
                                    type="button"
                                    key={source}
                                    onClick={() => handleSourceSwitch(source)}
                                    className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                                        source === searchSourceTab
                                            ? 'shadow-sm'
                                            : isDaylight
                                                ? 'bg-black/5 text-black/60 hover:bg-black/10'
                                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                    }`}
                                    style={source === searchSourceTab ? {
                                        backgroundColor: theme.accentColor,
                                        color: theme.backgroundColor,
                                    } : undefined}
                                >
                                    {getSourceLabel(source)}
                                </button>
                            ))}
                        </nav>
                        {isOnlineSource && (
                            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={t('search.kindLabel')}>
                                {(['songs', 'users'] as SearchKind[]).map(kind => (
                                    <button
                                        type="button"
                                        key={kind}
                                        onClick={() => handleKindSwitch(kind)}
                                        className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                                            kind === searchKind
                                                ? 'shadow-sm'
                                                : isDaylight
                                                    ? 'bg-black/5 text-black/60 hover:bg-black/10'
                                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                        style={kind === searchKind ? {
                                            backgroundColor: theme.accentColor,
                                            color: theme.backgroundColor,
                                        } : undefined}
                                    >
                                        {kind === 'songs' ? t('search.kindSongs') : t('search.kindUsers')}
                                    </button>
                                ))}
                            </nav>
                        )}
                    </header>

                    <div className="mx-auto mt-3 min-h-0 w-full max-w-5xl flex-1">
                        {searchKind === 'users' && isOnlineSource ? (
                            selectedUser ? (
                                <div className="flex h-full flex-col">
                                    <div className="flex shrink-0 items-center gap-2 pb-3">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedUser(null)}
                                            className={`rounded-full p-2 ${
                                                isDaylight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/10 hover:bg-white/15'
                                            }`}
                                            aria-label={t('ui.backToHome')}
                                        >
                                            <ArrowLeft size={16} />
                                        </button>
                                        <span className="truncate text-sm font-medium">
                                            {selectedUser.nickname} · {t('search.userPlaylistsTitle')}
                                        </span>
                                    </div>
                                    <div className="min-h-0 flex-1">
                                        <UserPublicPlaylists
                                            providerId={searchSourceTab}
                                            user={selectedUser}
                                            isDaylight={isDaylight}
                                            onOpenPlaylist={onOpenPlaylist}
                                        />
                                    </div>
                                </div>
                            ) : isSearching ? (
                                <div className="flex h-full items-center justify-center">
                                    <Loader2 className="h-9 w-9 animate-spin opacity-45" />
                                </div>
                            ) : searchError && userResults.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center gap-3 text-center opacity-65">
                                    <AlertCircle size={32} />
                                    <p>{t('search.error')}</p>
                                    <button
                                        type="button"
                                        onClick={handleFormSubmit}
                                        className="rounded-full border border-current/15 px-4 py-2 text-sm"
                                    >
                                        {t('search.retry')}
                                    </button>
                                </div>
                            ) : userResults.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm opacity-50">
                                    <p>{t('home.noResults')}</p>
                                    {!isSearching && <p className="text-xs">{t('search.userUnsupportedHint')}</p>}
                                </div>
                            ) : (
                                <div className="flex h-full flex-col">
                                    <div className="min-h-0 flex-1">
                                        <SearchUserResultsList
                                            users={userResults}
                                            isDaylight={isDaylight}
                                            selectedUserId={null}
                                            onSelectUser={setSelectedUser}
                                        />
                                    </div>
                                    {userHasMore && (
                                        <div className="flex shrink-0 justify-center py-3">
                                            <button
                                                type="button"
                                                disabled={isLoadingMore}
                                                onClick={() => { void loadMoreUserSearchResults(); }}
                                                className={`rounded-full border px-5 py-2 text-sm disabled:opacity-50 ${
                                                    isDaylight
                                                        ? 'border-black/10 bg-black/5 hover:bg-black/10'
                                                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                                                }`}
                                            >
                                                {isLoadingMore ? t('localMusic.searching') : t('home.loadMore')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : isSearching ? (
                            <div className="flex h-full items-center justify-center">
                                <Loader2 className="h-9 w-9 animate-spin opacity-45" />
                            </div>
                        ) : searchError && results.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-3 text-center opacity-65">
                                <AlertCircle size={32} />
                                <p>{t('search.error')}</p>
                                <button
                                    type="button"
                                    onClick={() => onSubmitSearch()}
                                    className="rounded-full border border-current/15 px-4 py-2 text-sm"
                                >
                                    {t('search.retry')}
                                </button>
                            </div>
                        ) : results.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-sm opacity-50">
                                {t('home.noResults')}
                            </div>
                        ) : (
                            <div className="flex h-full flex-col">
                                <div className="min-h-0 flex-1">
                                    <SearchResultsList
                                        tracks={results}
                                        scrollTop={scrollTop}
                                        isDaylight={isDaylight}
                                        onScrollTopChange={setSearchScrollTop}
                                        onPlayTrack={onPlayTrack}
                                        onAddTrackToQueue={onAddTrackToQueue}
                                        onOpenArtist={onOpenArtist}
                                        onOpenAlbum={onOpenAlbum}
                                    />
                                </div>
                                {searchError ? (
                                    <div className="flex shrink-0 items-center justify-center gap-3 py-3 text-sm">
                                        <span className="opacity-60">{t('search.error')}</span>
                                        <button
                                            type="button"
                                            disabled={isLoadingMore}
                                            onClick={onLoadMore}
                                            className="rounded-full border border-current/15 px-4 py-2 disabled:opacity-50"
                                        >
                                            {t('search.retry')}
                                        </button>
                                    </div>
                                ) : hasMore && (
                                    <div className="flex shrink-0 justify-center py-3">
                                        <button
                                            type="button"
                                            disabled={isLoadingMore}
                                            onClick={onLoadMore}
                                            className={`rounded-full border px-5 py-2 text-sm disabled:opacity-50 ${
                                                isDaylight
                                                    ? 'border-black/10 bg-black/5 hover:bg-black/10'
                                                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            {isLoadingMore ? t('localMusic.searching') : t('home.loadMore')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.section>
            )}
        </AnimatePresence>
    );
};

export default SearchWorkspace;
