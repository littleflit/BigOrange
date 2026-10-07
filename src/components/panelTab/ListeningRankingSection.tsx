import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Loader2, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UnifiedSong } from '../../types';
import type { ProviderRecordEntry } from '../../types/onlineMusic';
import { omni } from '../../services/onlineMusic/omni';

// src/components/panelTab/ListeningRankingSection.tsx
// 网易云听歌排行：全部和最近一周切换，点歌曲播放。

interface ListeningRankingSectionProps {
    userId: number | string;
    isDaylight: boolean;
    onPlaySong: (song: UnifiedSong) => void;
}

type RankingRange = 'all' | 'week';

const ListeningRankingSection: React.FC<ListeningRankingSectionProps> = ({ userId, isDaylight, onPlaySong }) => {
    const { t } = useTranslation();
    const [range, setRange] = useState<RankingRange>('week');
    const [entries, setEntries] = useState<ProviderRecordEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (nextRange: RankingRange) => {
        setLoading(true);
        setError(null);
        try {
            const result = await omni.getListeningRanking('netease', userId, nextRange);
            setEntries(result);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : String(requestError));
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void load(range);
    }, [userId, range, load]);

    const secondaryText = isDaylight ? 'text-zinc-500' : 'text-zinc-400';
    const tabContainerBg = isDaylight ? 'bg-black/5' : 'bg-white/5';
    const activePillBg = isDaylight ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'bg-zinc-800/80 shadow-[0_2px_8px_rgba(0,0,0,0.2)]';
    const activeTextColor = isDaylight ? 'text-zinc-900 font-semibold' : 'text-white font-semibold';
    const inactiveTextColor = isDaylight ? 'text-zinc-500 hover:text-zinc-800' : 'text-zinc-400 hover:text-zinc-200';

    return (
        <div className="bg-white/5 p-3 rounded-xl">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 opacity-60">
                    <BarChart3 size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wide">
                        {t('account.listeningRanking')}
                    </span>
                </div>
                <div className={`flex rounded-full p-0.5 text-[10px] ${tabContainerBg}`}>
                    {(['week', 'all'] as const).map(item => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => setRange(item)}
                            className={`rounded-full px-2.5 py-0.5 ${range === item ? `${activePillBg} ${activeTextColor}` : inactiveTextColor}`}
                        >
                            {item === 'week' ? t('account.rankingWeek') : t('account.rankingAll')}
                        </button>
                    ))}
                </div>
            </div>
            {loading ? (
                <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin opacity-45" /></div>
            ) : error ? (
                <div className="py-2 text-center">
                    <div className={`text-xs ${secondaryText}`}>{t('account.rankingFailed')}</div>
                    <button
                        type="button"
                        onClick={() => void load(range)}
                        className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[10px] hover:bg-white/20"
                    >
                        <RotateCcw size={11} />
                        {t('comments.retry')}
                    </button>
                </div>
            ) : entries.length === 0 ? (
                <div className={`py-2 text-center text-xs ${secondaryText}`}>{t('account.rankingEmpty')}</div>
            ) : (
                <ol className="max-h-64 space-y-0.5 overflow-y-auto custom-scrollbar">
                    {entries.slice(0, 20).map((entry, index) => (
                        <li key={String(entry.song.id)}>
                            <button
                                type="button"
                                onClick={() => onPlaySong(entry.song)}
                                className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/5"
                            >
                                <span className={`w-5 shrink-0 text-center text-xs font-bold tabular-nums ${index < 3 ? 'text-amber-400' : 'opacity-40'}`}>
                                    {index + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium">{entry.song.name}</span>
                                    <span className={`block truncate text-[10px] ${secondaryText}`}>
                                        {entry.song.artists.map(artist => artist.name).join(', ')}
                                    </span>
                                </span>
                                <span className={`shrink-0 text-[10px] tabular-nums ${secondaryText}`}>
                                    {t('account.rankingPlays').replace('{{count}}', String(entry.playCount))}
                                </span>
                            </button>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};

export default ListeningRankingSection;
