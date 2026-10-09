import React from 'react';
import { Blend, Image, Layers, LayoutGrid, ScrollText, Settings2, Zap, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SettingsRow, { SettingsToggle } from './SettingsRow';
import type { Theme } from '../../../types';
import {
    MOTION_SURFACE_IDS,
    useMotionSettingsStore,
    type MotionSurfaceId,
} from '../../../stores/useMotionSettingsStore';

// src/components/modal/settings/MotionReductionSettingsSection.tsx
// 「降低动态效果」的控制面：一个跟随系统的总开关，加每个受影响界面各自的降级开关。
//
// 读 store 而不是接一串 props，和 LatticeSettingsSection / GridViewSettingsSection 同一个路子，
// 这样命令面板的 surface 能直接复用这一个组件，不必再维护一份会漂移的 UI 副本。

type MotionReductionSettingsSectionProps = {
    settingsCardClass: string;
    settingsDividerClass: string;
    toggleOffBackgroundClass: string;
    theme?: Theme;
};

/** 每个面对应的文案 key，顺序即面板里的展示顺序。 */
const SURFACE_LABEL_KEYS: Record<MotionSurfaceId, { label: string; desc: string }> = {    lattice: { label: 'options.reduceMotionLattice', desc: 'options.reduceMotionLatticeDesc' },
    transitionOverlay: { label: 'options.reduceMotionTransitionOverlay', desc: 'options.reduceMotionTransitionOverlayDesc' },
    collectionMorph: { label: 'options.reduceMotionCollectionMorph', desc: 'options.reduceMotionCollectionMorphDesc' },
    monetBackground: { label: 'options.reduceMotionMonetBackground', desc: 'options.reduceMotionMonetBackgroundDesc' },
    uiMicroMotion: { label: 'options.reduceMotionUiMicroMotion', desc: 'options.reduceMotionUiMicroMotionDesc' },
    settingsScroll: { label: 'options.reduceMotionSettingsScroll', desc: 'options.reduceMotionSettingsScrollDesc' },
};

/** 每个面的行图标，与上面同序。 */
const SURFACE_ICONS: Record<MotionSurfaceId, LucideIcon> = {
    lattice: LayoutGrid,
    transitionOverlay: Blend,
    collectionMorph: Layers,
    monetBackground: Image,
    uiMicroMotion: Zap,
    settingsScroll: ScrollText,
};

const MotionReductionSettingsSection: React.FC<MotionReductionSettingsSectionProps> = ({
    settingsCardClass,
    settingsDividerClass,
    toggleOffBackgroundClass,
    theme,
}) => {
    const { t } = useTranslation();
    const surfaces = useMotionSettingsStore(state => state.reducedMotionSurfaces);
    const followSystem = useMotionSettingsStore(state => state.followSystemReducedMotion);
    const systemPrefers = useMotionSettingsStore(state => state.systemPrefersReducedMotion);
    const toggleSurface = useMotionSettingsStore(state => state.handleToggleReducedMotionSurface);
    const toggleFollowSystem = useMotionSettingsStore(state => state.handleToggleFollowSystemReducedMotion);

    const renderToggleRow = (
        icon: LucideIcon,
        label: string,
        description: string,
        active: boolean,
        onChange: (next: boolean) => void,
        forcedBySystem = false,
    ) => (
        <SettingsRow
            title={label}
            description={description}
            note={forcedBySystem ? t('options.reduceMotionForcedBySystem') : undefined}
            icon={icon}
            control={(
                <SettingsToggle
                    checked={active}
                    onChange={() => onChange(!active)}
                    offClass={toggleOffBackgroundClass}
                    onColor={theme?.secondaryColor}
                    ariaLabel={label}
                />
            )}
            dividerClass={settingsDividerClass}
            isLast
        />
    );

    // 跟随系统打开且系统确实要求降级时，每一面都已经被压住了，此时再显示自己的开关为「关」
    // 会让人以为动效还在。所以那种情况下逐项开关照常可点，但补一行说明是谁在压它。
    const forcedBySystem = followSystem && systemPrefers;

    return (
        <div className={`p-4 rounded-xl border space-y-4 ${settingsCardClass}`}>
            {/* 标题交给外面：实验室面板有自己的分区标题，命令面板的输入行会显示命令名。
                这里只留那句解释，因为「默认不再跟随系统」这件事必须说一次。 */}
            <div className="text-xs opacity-50 max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
                {t('options.reduceMotionSectionDesc')}
            </div>

            <div className={`border-t pt-4 ${settingsDividerClass}`}>
                {renderToggleRow(
                    Settings2,
                    t('options.reduceMotionFollowSystem'),
                    t('options.reduceMotionFollowSystemDesc'),
                    followSystem,
                    toggleFollowSystem,
                )}
            </div>

            <div className={`border-t pt-4 space-y-4 ${settingsDividerClass}`}>
                {MOTION_SURFACE_IDS.map(surface => (
                    <React.Fragment key={surface}>
                        {renderToggleRow(
                            SURFACE_ICONS[surface],
                            t(SURFACE_LABEL_KEYS[surface].label),
                            t(SURFACE_LABEL_KEYS[surface].desc),
                            surfaces[surface],
                            next => toggleSurface(surface, next),
                            forcedBySystem && !surfaces[surface],
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default MotionReductionSettingsSection;
