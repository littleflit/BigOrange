import React from 'react';
import { Frame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Theme } from '../../../types';
import SettingsRow, { SettingsToggle } from './SettingsRow';
import { useLatticeSettingsStore } from '../../../stores/useLatticeSettingsStore';
import LatticePosterTintControls from '../../shared/LatticePosterTintControls';
import { settingsDividerClassFor } from './settingsCardClasses';

// src/components/modal/settings/LatticeSettingsSection.tsx
// 队列拼贴（海报墙）的外观设置，挂在外观页里。读 store 而不是接一串 props：这一区只属于
// useLatticeSettingsStore，再往 AppearanceSettingsSubview 的 props 里塞成对的值和 setter，
// 只会把那个已经上千行的文件继续撑大。

type LatticeSettingsSectionProps = {
    settingsCardClass: string;
    toggleOffBackgroundClass: string;
    isDaylight: boolean;
    theme?: Theme;
};

const LatticeSettingsSection: React.FC<LatticeSettingsSectionProps> = ({
    settingsCardClass,
    toggleOffBackgroundClass,
    isDaylight,
    theme,
}) => {
    const { t } = useTranslation();
    const latticeVignette = useLatticeSettingsStore(state => state.latticeVignette);
    const handleToggleLatticeVignette = useLatticeSettingsStore(state => state.handleToggleLatticeVignette);
    const posterTint = useLatticeSettingsStore(useShallow(state => ({
        enabled: state.latticePosterTintEnabled,
        useCustomColor: state.latticePosterTintUseCustomColor,
        color: state.latticePosterTintColor,
        intensity: state.latticePosterTintIntensity,
        onEnabledChange: state.handleToggleLatticePosterTint,
        onUseCustomColorChange: state.handleToggleLatticePosterTintCustomColor,
        onColorChange: state.handleSetLatticePosterTintColor,
        onIntensityChange: state.handleSetLatticePosterTintIntensity,
    })));

    return (
        <div className={`rounded-2xl border ${settingsCardClass} overflow-hidden`}>
            <SettingsRow
                title={t('options.latticeVignette')}
                description={t('options.latticeVignetteDesc')}
                icon={Frame}
                control={(
                    <SettingsToggle
                        checked={latticeVignette}
                        onChange={() => handleToggleLatticeVignette(!latticeVignette)}
                        offClass={toggleOffBackgroundClass}
                        onColor={theme?.secondaryColor}
                        ariaLabel={t('options.latticeVignette')}
                    />
                )}
                dividerClass={settingsDividerClassFor(isDaylight)}
                isLast
            />
            <div className={`border-t pt-4 ${settingsDividerClassFor(isDaylight)}`}>
                <LatticePosterTintControls
                    {...posterTint}
                    isDaylight={isDaylight}
                    theme={theme}
                />
            </div>
        </div>
    );
};

export default LatticeSettingsSection;
