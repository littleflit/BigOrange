import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useReducedMotionFor } from '../../../../hooks/useReducedMotionFor';
import { useThemeSettingsStore } from '../../../../stores/useThemeSettingsStore';
import { liquidGlassCard, liquidGlassPill, liquidGlassTile } from '../../../shared/liquidGlass';
import type { SettingsAnchorId } from './settingsAnchorModel';
import type { SettingsNavGroup, SettingsNavItem, SettingsSectionId } from './settingsNavModel';
import { searchSettingsNav } from './settingsNavSearch';

// src/components/modal/settings/navigation/SettingsRadialHome.tsx
// Radial settings landing: the 11 sections sit on a ring for one-tap access, with the
// settings search at the center. Typing dims the ring down to the matches and lists
// section/anchor hits below the search box; Enter takes the first hit.

type SettingsRadialHomeProps = {
    items: SettingsNavItem[];
    groups: SettingsNavGroup[];
    locale: string;
    isDaylight: boolean;
    title: string;
    description: string;
    searchPlaceholder: string;
    onSelectSection: (sectionId: SettingsSectionId) => void;
    onNavigate: (sectionId: SettingsSectionId, anchorId: SettingsAnchorId | null) => void;
};

type RadialHit = {
    key: string;
    sectionId: SettingsSectionId;
    anchorId: SettingsAnchorId | null;
    icon: SettingsNavItem['icon'];
    label: string;
    sublabel: string | null;
};

/**
 * Ring-icon refraction. One static filter shared by all 11 tiles: blur the backdrop,
 * bend it with low-frequency noise, then over-saturate. Static feTurbulence costs
 * nothing while idle (verified full-FPS in dev/probes/liquidGlassRefraction); only
 * repaints re-run it, which is why this stays on hero tiles and never on full panels.
 */
const RING_REFRACT_FILTER_ID = 'bigorange-lg-ring-refract';

/**
 * Ring slot as percentages of the square container. Index 0 starts at the top
 * and advances clockwise, so the order matches the sidebar from top to bottom.
 */
export const radialSlot = (index: number, total: number): { x: number; y: number } => {
    if (total <= 0) {
        return { x: 50, y: 50 };
    }
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    const radius = 40;
    return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
};

/**
 * macOS-dock-style proximity scale: 1 beyond `range`, rising quadratically to
 * 1 + `magnitude` at the cursor. The container is square so percentage units
 * measure the same distance on both axes.
 */
export const dockScale = (distance: number, range = 20, magnitude = 0.6): number => {
    if (distance >= range) {
        return 1;
    }
    const falloff = 1 - distance / range;
    return 1 + magnitude * falloff * falloff;
};

export const SettingsRadialHome: React.FC<SettingsRadialHomeProps> = ({
    items,
    groups,
    locale,
    isDaylight,
    title,
    description,
    searchPlaceholder,
    onSelectSection,
    onNavigate,
}) => {
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
    const [focusIndex, setFocusIndex] = useState<number | null>(null);
    const reduceMotion = useReducedMotionFor('uiMicroMotion');
    const lgOpacity = useThemeSettingsStore(state => state.liquidGlassOpacity);
    // Refraction only reads the backdrop, so once the slider reaches opaque there is
    // nothing to bend: fall back to the plain CSS glass (which is opaque there too).
    const refractFilter = lgOpacity < 0.98 ? `url(#${RING_REFRACT_FILTER_ID})` : undefined;

    const search = useMemo(() => searchSettingsNav(groups, query, locale), [groups, query, locale]);
    const hasQuery = query.trim().length > 0;

    const matchedSectionIds = useMemo(() => {
        if (!hasQuery) {
            return null;
        }
        return new Set(search.groups.flatMap(group => group.items.map(item => item.id)));
    }, [hasQuery, search.groups]);

    const hits = useMemo<RadialHit[]>(() => {
        if (!hasQuery) {
            return [];
        }
        const rows: RadialHit[] = [];
        for (const group of search.groups) {
            for (const item of group.items) {
                rows.push({ key: `section:${item.id}`, sectionId: item.id, anchorId: null, icon: item.icon, label: item.label, sublabel: item.description });
                for (const anchor of item.anchors) {
                    rows.push({ key: `anchor:${anchor.id}`, sectionId: item.id, anchorId: anchor.id, icon: item.icon, label: anchor.label, sublabel: item.label });
                }
                if (rows.length >= 24) {
                    break;
                }
            }
            if (rows.length >= 24) {
                break;
            }
        }
        return rows.slice(0, 8);
    }, [hasQuery, search.groups]);

    const commitFirstHit = () => {
        if (search.firstHit) {
            onNavigate(search.firstHit.sectionId, search.firstHit.anchorId);
        }
    };

    return (
        <div className="flex min-h-full flex-col pb-4">
            <div className="my-auto">
            <div className="mb-2 border-b border-white/10 pb-3 md:pb-4">
                <h2 className="text-lg md:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {title}
                </h2>
                <p className="text-xs opacity-50 mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {description}
                </p>
            </div>
            <div
                className="relative mx-auto w-full max-w-[560px] aspect-square select-none"
                onMouseMove={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    if (rect.width <= 0) {
                        return;
                    }
                    setCursor({
                        x: ((event.clientX - rect.left) / rect.width) * 100,
                        y: ((event.clientY - rect.top) / rect.height) * 100,
                    });
                }}
                onMouseLeave={() => setCursor(null)}
            >
                {items.map((item, index) => {
                    const slot = radialSlot(index, items.length);
                    const dimmed = matchedSectionIds !== null && !matchedSectionIds.has(item.id);
                    const distance = cursor
                        ? Math.hypot(slot.x - cursor.x, slot.y - cursor.y)
                        : Number.POSITIVE_INFINITY;
                    const scale = reduceMotion
                        ? 1
                        : Math.max(dockScale(distance), focusIndex === index ? 1.6 : 1);
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelectSection(item.id)}
                            onFocus={() => setFocusIndex(index)}
                            onBlur={() => setFocusIndex((current) => (current === index ? null : current))}
                            title={item.description}
                            aria-label={item.label}
                            className="absolute flex w-16 flex-col items-center gap-1 transition-opacity"
                            style={{
                                left: `${slot.x}%`,
                                top: `${slot.y}%`,
                                transform: `translate(-50%, -50%) scale(${scale})`,
                                transition: reduceMotion ? undefined : 'transform 120ms ease-out, opacity 120ms ease-out',
                                opacity: dimmed ? 0.25 : 1,
                                zIndex: scale > 1 ? 10 : undefined,
                            }}
                        >
                            <span
                                className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${liquidGlassTile(isDaylight)}`}
                                style={{
                                    color: 'var(--text-primary)',
                                    backdropFilter: refractFilter,
                                    WebkitBackdropFilter: refractFilter,
                                }}
                            >
                                <Icon size={20} />
                            </span>
                            <span className="text-[11px] leading-tight text-center" style={{ color: 'var(--text-secondary)' }}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
                <div className="absolute flex flex-col items-center gap-2 px-6" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(72%, 300px)' }}>
                    <div
                        className={`flex w-full items-center gap-2 rounded-full px-3.5 py-2.5 ${liquidGlassPill(isDaylight)}`}
                        style={{ color: 'var(--text-primary)' }}
                    >
                        <Search size={15} className="shrink-0 opacity-50" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    commitFirstHit();
                                }
                            }}
                            placeholder={searchPlaceholder}
                            aria-label={searchPlaceholder}
                            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-50"
                        />
                    </div>
                    {hasQuery && (
                        <div
                            className={`w-full overflow-hidden rounded-xl ${liquidGlassCard(isDaylight)}`}
                            role="listbox"
                            aria-label={searchPlaceholder}
                        >
                            {hits.length === 0 ? (
                                <div className="px-3.5 py-2.5 text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                                    {searchPlaceholder}
                                </div>
                            ) : (
                                hits.map((hit) => {
                                    const HitIcon = hit.icon;
                                    return (
                                        <button
                                            key={hit.key}
                                            type="button"
                                            role="option"
                                            aria-selected="false"
                                            onClick={() => onNavigate(hit.sectionId, hit.anchorId)}
                                            className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors ${isDaylight ? 'hover:bg-black/[0.05]' : 'hover:bg-white/[0.07]'}`}
                                        >
                                            <HitIcon size={15} className="shrink-0 opacity-60" style={{ color: 'var(--text-primary)' }} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[13px]" style={{ color: 'var(--text-primary)' }}>
                                                    {hit.label}
                                                </span>
                                                {hit.sublabel && (
                                                    <span className="block truncate text-[11px] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                                                        {hit.sublabel}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
            <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true">
                <defs>
                    <filter id={RING_REFRACT_FILTER_ID} x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blurred" />
                        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves={2} seed={7} result="noise" />
                        <feDisplacementMap in="blurred" in2="noise" scale={30} xChannelSelector="R" yChannelSelector="G" result="bent" />
                        <feColorMatrix in="bent" type="saturate" values="1.5" />
                    </filter>
                </defs>
            </svg>
            </div>
        </div>
    );
};
