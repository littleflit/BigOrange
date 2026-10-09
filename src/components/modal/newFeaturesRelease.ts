import { AudioWaveform, Keyboard, Link, MousePointerClick, Music2, Search, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// src/components/modal/newFeaturesRelease.ts

type NewFeatureCard = {
    id: string;
    icon: LucideIcon;
    daylightIconClassName: string;
    darkIconClassName: string;
};

type NewFeaturesReleaseSection = {
    id: string;
    titleKey: string;
    features: NewFeatureCard[];
};

type NewFeaturesRelease = {
    i18nKey: string;
    sections: NewFeaturesReleaseSection[];
};

// Defines the current release's cards in two rows: our own changes first,
// upstream's underneath. Their localized text lives under i18nKey in every locale.
export const NEW_FEATURES_RELEASE: NewFeaturesRelease = {
    i18nKey: 'releaseNotes.v0_7_16',
    sections: [
        {
            id: 'bigorange',
            titleKey: 'releaseNotes.v0_7_16.bigorange.title',
            features: [
                { id: 'liquidGlass', icon: Sparkles, daylightIconClassName: 'text-cyan-600', darkIconClassName: 'text-cyan-400' },
                { id: 'spectrumRemoved', icon: AudioWaveform, daylightIconClassName: 'text-sky-600', darkIconClassName: 'text-sky-400' },
                { id: 'lyricSelection', icon: MousePointerClick, daylightIconClassName: 'text-emerald-600', darkIconClassName: 'text-emerald-400' },
            ],
        },
        {
            id: 'upstream',
            titleKey: 'releaseNotes.v0_7_16.upstream.title',
            features: [
                { id: 'amllSource', icon: Music2, daylightIconClassName: 'text-violet-600', darkIconClassName: 'text-violet-400' },
                { id: 'amllSearch', icon: Search, daylightIconClassName: 'text-amber-600', darkIconClassName: 'text-amber-400' },
                { id: 'gridTabKeys', icon: Keyboard, daylightIconClassName: 'text-cyan-600', darkIconClassName: 'text-cyan-400' },
                { id: 'searchLinks', icon: Link, daylightIconClassName: 'text-emerald-600', darkIconClassName: 'text-emerald-400' },
            ],
        },
    ],
};
