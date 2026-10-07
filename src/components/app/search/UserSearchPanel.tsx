import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, User as UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OmniCollection, ProviderSearchUser } from '../../../types/onlineMusic';
import type { GridViewCollectionDescriptor } from '../../../library/core/contracts/collection';
import { omni } from '../../../services/onlineMusic/omni';

// src/components/app/search/UserSearchPanel.tsx
// 网易云用户搜索：搜用户，进用户看其公开歌单，点歌单跳集合页。

interface UserSearchPanelProps {
    query: string;
    searchNonce: number;
    isDaylight: boolean;
    onOpenCollection: (collection: GridViewCollectionDescriptor) => void;
}

const USER_PAGE_LIMIT = 20;

const toCollectionDescriptor = (collection: OmniCollection): GridViewCollectionDescriptor => ({
    source: 'online',
    providerId: collection.providerId,
    id: collection.id,
    type: collection.type,
    name: collection.name,
    coverUrl: collection.coverUrl,
    trackCount: collection.trackCount,
    creator: collection.creator ?? undefined,
});

const UserSearchPanel: React.FC<UserSearchPanelProps> = ({ query, searchNonce, isDaylight, onOpenCollection }) => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<ProviderSearchUser[]>([]);
    const [userHasMore, setUserHasMore] = useState(false);
    const [userOffset, setUserOffset] = useState(0);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
    const [userError, setUserError] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<ProviderSearchUser | null>(null);
    const [playlists, setPlaylists] = useState<OmniCollection[]>([]);
    const [loadingPlaylists, setLoadingPlaylists] = useState(false);
    const [playlistError, setPlaylistError] = useState<string | null>(null);

    useEffect(() => {
        if (searchNonce === 0) return;
        let cancelled = false;
        setLoadingUsers(true);
        setUserError(null);
        setSelectedUser(null);
        omni.searchUsers(query, { limit: USER_PAGE_LIMIT, offset: 0 }).then(
            page => {
                if (cancelled) return;
                setUsers(page.items);
                setUserHasMore(page.hasMore);
                setUserOffset(page.nextOffset);
                setLoadingUsers(false);
            },
            error => {
                if (cancelled) return;
                setUserError(error instanceof Error ? error.message : 'search_failed');
                setLoadingUsers(false);
            },
        );
        return () => {
            cancelled = true;
        };
    }, [query, searchNonce]);

    const handleLoadMoreUsers = useCallback(() => {
        if (loadingMoreUsers || !userHasMore) return;
        setLoadingMoreUsers(true);
        omni.searchUsers(query, { limit: USER_PAGE_LIMIT, offset: userOffset }).then(
            page => {
                setUsers(previous => [...previous, ...page.items]);
                setUserHasMore(page.hasMore);
                setUserOffset(page.nextOffset);
                setLoadingMoreUsers(false);
            },
            () => setLoadingMoreUsers(false),
        );
    }, [loadingMoreUsers, userHasMore, query, userOffset]);

    const handleSelectUser = useCallback((user: ProviderSearchUser) => {
        setSelectedUser(user);
        setPlaylists([]);
        setPlaylistError(null);
        setLoadingPlaylists(true);
        omni.getProviderUserPlaylists('netease', user.id, { limit: 50, offset: 0 }).then(
            page => {
                setPlaylists(page.items);
                setLoadingPlaylists(false);
            },
            error => {
                setPlaylistError(error instanceof Error ? error.message : 'search_failed');
                setLoadingPlaylists(false);
            },
        );
    }, []);

    const secondaryText = isDaylight ? 'text-zinc-500' : 'text-zinc-400';
    const cardBg = isDaylight ? 'bg-black/[0.04] hover:bg-black/[0.08]' : 'bg-white/[0.05] hover:bg-white/[0.09]';

    if (loadingUsers) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-9 w-9 animate-spin opacity-45" />
            </div>
        );
    }

    if (userError) {
        return (
            <div className="flex h-full items-center justify-center text-sm opacity-60">
                {t('search.error')}
            </div>
        );
    }

    if (selectedUser) {
        return (
            <div className="flex h-full flex-col">
                <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className={`flex shrink-0 items-center gap-2 py-2 text-xs ${secondaryText} hover:opacity-80`}
                >
                    <ArrowLeft size={14} />
                    {t('search.backToUsers')}
                </button>
                <div className="flex shrink-0 items-center gap-3 pb-3">
                    {selectedUser.avatarUrl
                        ? <img src={selectedUser.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                        : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><UserIcon size={18} /></div>}
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{selectedUser.nickname}</div>
                        {selectedUser.signature && <div className={`truncate text-xs ${secondaryText}`}>{selectedUser.signature}</div>}
                    </div>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4 custom-scrollbar">
                    {loadingPlaylists
                        ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin opacity-45" /></div>
                        : playlistError
                            ? <div className={`py-8 text-center text-sm ${secondaryText}`}>{t('search.error')}</div>
                            : playlists.length === 0
                                ? <div className={`py-8 text-center text-sm ${secondaryText}`}>{t('home.noResults')}</div>
                                : playlists.map(collection => (
                                    <button
                                        key={`${collection.providerId}:${collection.id}`}
                                        type="button"
                                        onClick={() => onOpenCollection(toCollectionDescriptor(collection))}
                                        className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors ${cardBg}`}
                                    >
                                        {collection.coverUrl
                                            ? <img src={collection.coverUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl" loading="lazy" />
                                            : <div className="h-11 w-11 shrink-0 rounded-xl bg-white/10" />}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{collection.name}</span>
                                            {typeof collection.trackCount === 'number' && (
                                                <span className={`block text-xs ${secondaryText}`}>
                                                    {t('search.playlistTrackCount').replace('{{count}}', String(collection.trackCount))}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                ))}
                </div>
            </div>
        );
    }

    if (users.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-sm opacity-50">
                {t('home.noResults')}
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4 custom-scrollbar">
                {users.map(user => (
                    <button
                        key={String(user.id)}
                        type="button"
                        onClick={() => handleSelectUser(user)}
                        className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors ${cardBg}`}
                    >
                        {user.avatarUrl
                            ? <img src={user.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full" loading="lazy" />
                            : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10"><UserIcon size={20} /></div>}
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{user.nickname}</span>
                            {user.signature && <span className={`block truncate text-xs ${secondaryText}`}>{user.signature}</span>}
                        </span>
                    </button>
                ))}
            </div>
            {userHasMore && (
                <div className="flex shrink-0 justify-center py-3">
                    <button
                        type="button"
                        disabled={loadingMoreUsers}
                        onClick={handleLoadMoreUsers}
                        className={`rounded-full border px-5 py-2 text-sm disabled:opacity-50 ${
                            isDaylight
                                ? 'border-black/10 bg-black/5 hover:bg-black/10'
                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                    >
                        {loadingMoreUsers ? t('localMusic.searching') : t('home.loadMore')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserSearchPanel;
