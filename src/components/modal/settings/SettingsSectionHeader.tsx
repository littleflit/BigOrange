import React from 'react';
import { ChevronLeft, Moon, Sun } from 'lucide-react';
// src/components/modal/settings/SettingsSectionHeader.tsx
// Title block above the active settings section, plus the appearance-only daylight toggle.

type SettingsSectionHeaderProps = {
    title: string;
    description: string;
    /** Only the appearance section carries the daylight switch. */
    showDaylightToggle: boolean;
    isDaylight: boolean;
    onSetDaylightPreference: (enabled: boolean) => void;
    daylightLabel: string;
    utilityGhostButtonClass: string;
    /** Back to the radial home. Absent in navbar mode and on the home itself. */
    onBack?: () => void;
    backLabel?: string;
};

export const SettingsSectionHeader: React.FC<SettingsSectionHeaderProps> = ({
    title,
    description,
    showDaylightToggle,
    isDaylight,
    onSetDaylightPreference,
    daylightLabel,
    utilityGhostButtonClass,
    onBack,
    backLabel,
}) => (
    <div className="mb-4 md:mb-6 border-b border-white/10 pb-3 md:pb-4">
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label={backLabel}
                        className="mb-1.5 -ml-1 flex items-center gap-0.5 text-[11px] opacity-50 transition-opacity hover:opacity-100"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        <ChevronLeft size={13} />
                        {backLabel}
                    </button>
                )}
                <h2 className="text-lg md:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {title}
                </h2>
                <p className="text-xs opacity-50 mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {description}
                </p>
            </div>
            {showDaylightToggle && (
                <button
                    type="button"
                    onClick={() => onSetDaylightPreference(!isDaylight)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${utilityGhostButtonClass} ${isDaylight ? 'text-amber-500' : 'text-blue-300'}`}
                    title={daylightLabel}
                    aria-label={daylightLabel}
                    aria-pressed={isDaylight}
                >
                    {isDaylight ? <Sun size={17} /> : <Moon size={17} />}
                </button>
            )}
        </div>
    </div>
);

export default SettingsSectionHeader;
