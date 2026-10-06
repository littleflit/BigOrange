import { useEffect, useRef } from 'react';
import type { OnlineProviderId, ProviderAccountSummary } from '../types/onlineMusic';
import { useCollectionNavigationStore } from '../stores/useCollectionNavigationStore';
import { useAppViewStore } from '../stores/useAppViewStore';

// src/hooks/useHomeProviderRefresh.ts
//
// Refreshes the active online provider's playlists when the listener lands on the home surface.
//
// Not on an interval and not on mount: home is where those lists are read, so entering it is the
// moment they are worth fetching. The cooldown and the in-flight check keep bouncing between home
// and a collection from re-fetching each time.

/** Long enough that home ↔ player ↔ collection bouncing does not re-fetch, short enough to feel live. */
const HOME_PROVIDER_REFRESH_COOLDOWN_MS = 5_000;

type HomeProviderRefreshParams = {
    /** 当前在线平台（账户 controller 快照里已回落过的那个）。 */
    activeProviderId: OnlineProviderId;
    /** 当前平台账户摘要的新鲜度；正在刷新时不再叠一次。 */
    activeProviderFreshness: ProviderAccountSummary['freshness'] | undefined;
    refreshActiveProviderPlaylists: () => Promise<unknown>;
};

export const useHomeProviderRefresh = ({
    activeProviderId,
    activeProviderFreshness,
    refreshActiveProviderPlaylists,
}: HomeProviderRefreshParams) => {
    const lastHomeProviderRefreshRef = useRef<{ providerId: OnlineProviderId; at: number } | null>(null);
    const currentView = useAppViewStore(state => state.view);
    // A collection is open on top of home, so the lists behind it are not what is being looked at.
    const hasCollection = useCollectionNavigationStore(state => Boolean(state.snapshot?.stack.length));

    useEffect(() => {
        if (currentView !== 'home' || hasCollection) return;

        const providerId = activeProviderId;
        const startedAt = Date.now();
        const previous = lastHomeProviderRefreshRef.current;
        if (previous?.providerId === providerId && startedAt - previous.at <= HOME_PROVIDER_REFRESH_COOLDOWN_MS) return;
        if (activeProviderFreshness === 'refreshing') {
            lastHomeProviderRefreshRef.current = { providerId, at: startedAt };
            return;
        }

        lastHomeProviderRefreshRef.current = { providerId, at: startedAt };
        void refreshActiveProviderPlaylists().catch(error => {
            if (lastHomeProviderRefreshRef.current?.providerId === providerId
                && lastHomeProviderRefreshRef.current.at === startedAt) {
                lastHomeProviderRefreshRef.current = null;
            }
            console.warn('[Omni] Failed to refresh active provider playlists', {
                providerId,
                name: error instanceof Error ? error.name : 'Error',
            });
        });
    }, [
        activeProviderFreshness,
        activeProviderId,
        currentView,
        hasCollection,
        refreshActiveProviderPlaylists,
    ]);
};
