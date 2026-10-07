import React from 'react';
import { DEFAULT_RINGS52HZ_TUNING, type Rings52hzTuning } from '../../../types';
import { type VisualizerSettingsPanelProps } from '../definition';

// src/components/visualizer/rings52hz/Rings52hzSettingsPanel.tsx
// Owns 52Hz-specific tuning controls: five number sliders.

const SLIDERS: Array<{
    key: keyof Rings52hzTuning;
    labelKey: string;
    min: number;
    max: number;
    step: number;
    format: (value: number) => string;
}> = [
    { key: 'reach', labelKey: 'options.rings52hzReach', min: 0.4, max: 2, step: 0.05, format: (value) => `${Math.round(value * 100)}%` },
    { key: 'beatSensitivity', labelKey: 'options.rings52hzBeatSensitivity', min: 0.4, max: 2.5, step: 0.05, format: (value) => `${Math.round(value * 100)}%` },
    { key: 'sensitivity', labelKey: 'options.rings52hzSensitivity', min: 0.2, max: 3, step: 0.05, format: (value) => `${Math.round(value * 100)}%` },
    { key: 'opacity', labelKey: 'options.rings52hzOpacity', min: 0.1, max: 1, step: 0.05, format: (value) => `${Math.round(value * 100)}%` },
    { key: 'fontScale', labelKey: 'options.rings52hzFontScale', min: 0.6, max: 1.6, step: 0.05, format: (value) => `${Math.round(value * 100)}%` },
];

const Rings52hzSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
    t,
    rangeInputClass,
    rings52hzTuning,
    onRings52hzTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const resolvedTuning: Rings52hzTuning = { ...DEFAULT_RINGS52HZ_TUNING, ...rings52hzTuning };

    return (
        <div className="space-y-4">
            {SLIDERS.map((slider) => (
                <div key={slider.key} className="space-y-2">
                    <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-primary)' }}>
                        <span>{t(slider.labelKey)}</span>
                        <span className="font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
                            {slider.format(resolvedTuning[slider.key])}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        step={slider.step}
                        value={resolvedTuning[slider.key]}
                        onChange={(event) => onRings52hzTuningChange?.({ [slider.key]: parseFloat(event.target.value) })}
                        onPointerDown={onSliderPointerDown}
                        onPointerUp={onSliderCommit}
                        className={rangeInputClass}
                    />
                </div>
            ))}
        </div>
    );
};

export default Rings52hzSettingsPanel;
