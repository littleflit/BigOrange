import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SongResult } from '../../types';
import type { ProviderSongComment } from '../../types/onlineMusic';
import { omni } from '../../services/onlineMusic/omni';

// src/components/panelTab/SongCommentsTab.tsx
// 当前在线歌曲的网易云评论：热门置顶 + 最新分页加载。

interface SongCommentsTabProps {
    song: SongResult;
    isDaylight: boolean;
}

const PAGE_LIMIT = 20;

const formatCommentTime = (timeMs: number, t: (key: string) => string): string => {
    if (!timeMs) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));
    if (diffSec < 60) return t('comments.justNow');
    if (diffSec < 3600) return t('comments.minutesAgo').replace('{{count}}', String(Math.floor(diffSec / 60)));
    if (diffSec < 86400) return t('comments.hoursAgo').replace('{{count}}', String(Math.floor(diffSec / 3600)));
    if (diffSec < 86400 * 30) return t('comments.daysAgo').replace('{{count}}', String(Math.floor(diffSec / 86400)));
    return new Date(timeMs).toLocaleDateString();
};

const SongCommentsTab: React.FC<SongCommentsTabProps> = ({ song, isDaylight }) => {
    const { t } = useTranslation();
    const [items, setItems] = useState<ProviderSongComment[]>([]);
    const [total, setTotal] = useState(0);
    const [latestLoaded, setLatestLoaded] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);

    const loadPage = useCallback(async (offset: number, append: boolean) => {
        const current = requestId.current + 1;
        requestId.current = current;
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
            setError(null);
        }
        try {
            const page = await omni.getSongComments(song, PAGE_LIMIT, offset);
            if (requestId.current !== current) return;
            setItems(previous => (append ? [...previous, ...page.items] : page.items));
            setTotal(page.total);
            setHasMore(page.hasMore);
            setLatestLoaded(previous => (append ? previous + page.latestCount : page.latestCount));
        } catch (requestError) {
            if (requestId.current !== current) return;
            if (!append) {
                setError(requestError instanceof Error ? requestError.message : String(requestError));
            }
        } finally {
            if (requestId.current === current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [song]);

    useEffect(() => {
        setItems([]);
        setTotal(0);
        setLatestLoaded(0);
        setHasMore(false);
        void loadPage(0, false);
    }, [song.id, loadPage]);

    const handleLoadMore = () => {
        if (loadingMore || !hasMore) return;
        void loadPage(latestLoaded, true);
    };

    const handleRetry = () => {
        void loadPage(0, false);
    };

    const secondaryText = isDaylight ? 'text-zinc-500' : 'text-zinc-400';

    if (loading) {
        return <div className={`p-6 text-center text-sm ${secondaryText}`}>{t('comments.loading')}</div>;
    }

    if (error) {
        return (
            <div className="p-6 text-center">
                <div className={`text-sm ${secondaryText}`}>{t('comments.failed')}</div>
                <button
                    type="button"
                    onClick={handleRetry}
                    className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-1.5 text-xs hover:bg-white/20"
                >
                    <RotateCcw size={13} />
                    {t('comments.retry')}
                </button>
            </div>
        );
    }

    if (items.length === 0) {
        return <div className={`p-6 text-center text-sm ${secondaryText}`}>{t('comments.empty')}</div>;
    }

    return (
        <div className="flex h-full flex-col">
            <div className={`flex items-center gap-1.5 px-4 py-2 text-xs ${secondaryText}`}>
                <MessageCircle size={13} />
                {t('comments.total').replace('{{count}}', String(total))}
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
                {items.map(item => (
                    <div key={`${item.id}`} className="flex gap-3 rounded-xl p-2">
                        {item.user.avatarUrl
                            ? <img src={item.user.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" loading="lazy" />
                            : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs">?</div>}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                                <span className="truncate text-xs font-semibold">{item.user.nickname}</span>
                                <span className={`shrink-0 text-[10px] ${secondaryText}`}>{formatCommentTime(item.timeMs, t)}</span>
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-5">{item.content}</p>
                            {item.likedCount > 0 && (
                                <div className={`mt-1 text-[11px] ${secondaryText}`}>
                                    {t('comments.likes').replace('{{count}}', String(item.likedCount))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {hasMore && (
                    <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="mt-2 w-full rounded-full bg-white/10 py-2 text-xs hover:bg-white/20 disabled:opacity-40"
                    >
                        {loadingMore ? t('comments.loading') : t('comments.loadMore')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default SongCommentsTab;
