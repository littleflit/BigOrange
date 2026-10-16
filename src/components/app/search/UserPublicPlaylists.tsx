// src/components/app/search/UserPublicPlaylists.tsx
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OmniCollection, OmniProviderId, OmniUser } from '../../../types/onlineMusic';
import type { MediaId } from '../../../types/onlineMusic';
import { omni } from '../../../services/onlineMusic/omni';

// 选中用户后的公开歌单：按 provider 路由读该用户的歌单，点击跳到集合页（调用方负责导航）。
type UserPublicPlaylistsProps = {
    providerId: OmniProviderId;
    user: OmniUser;
    isDaylight: boolean;
    onOpenPlaylist: (collection: OmniCollection) => void;
};

const PAGE_SIZE = 30;

const UserPublicPlaylists: React.FC<UserPublicPlaylistsProps> = ({
    providerId,
    user,
    isDaylight,
    onOpenPlaylist,
}) => {
    const { t } = useTranslation();
    const [playlists, setPlaylists] = useState<OmniCollection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const userId = user.id as MediaId;

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        setPlaylists([]);
        omni.getProviderUserPlaylists(providerId, userId, { limit: PAGE_SIZE, offset: 0 })
            .then(page => {
                if (cancelled) return;
                setPlaylists(page.items.filter(item => item.type === 'playlist'));
                setIsLoading(false);
            })
            .catch(err => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'load_failed');
                setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [providerId, userId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin opacity-45" />
            </div>
        );
    }

    if (error) {
        return <p className="py-10 text-center text-sm opacity-60">{t('search.userPlaylistsError')}</p>;
    }

    if (playlists.length === 0) {
        return <p className="py-10 text-center text-sm opacity-50">{t('search.userPlaylistsEmpty')}</p>;
    }

    return (
        <ul className="flex flex-col gap-2 overflow-y-auto pb-4">
            {playlists.map(item => (
                <li key={String(item.id)}>
                    <button
                        type="button"
                        onClick={() => onOpenPlaylist(item)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors ${
                            isDaylight
                                ? 'border-black/10 bg-black/[0.03] hover:bg-black/[0.06]'
                                : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                        }`}
                    >
                        {item.coverUrl ? (
                            <img
                                src={item.coverUrl}
                                alt={item.name}
                                className="h-12 w-12 shrink-0 rounded-xl object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <span
                                className={`h-12 w-12 shrink-0 rounded-xl ${isDaylight ? 'bg-black/10' : 'bg-white/10'}`}
                                aria-hidden
                            />
                        )}
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{item.name}</span>
                            <span className="block truncate text-xs opacity-55">
                                {typeof item.trackCount === 'number' ? t('search.playlistTrackCount', { count: item.trackCount }) : ''}
                                {typeof item.playCount === 'number' ? ` · ▶ ${item.playCount}` : ''}
                            </span>
                        </span>
                        <span className="shrink-0 text-xs opacity-60">›</span>
                    </button>
                </li>
            ))}
        </ul>
    );
};

export default UserPublicPlaylists;
