import React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';

// src/components/modal/settings/SettingsRow.tsx
// One row inside a grouped settings card: icon tile, title and description on the left,
// an optional current-value preview plus the control on the right, a hairline under
// every row but the card's last. The rows share a card so a section reads
// as one block instead of a stack of separate boxes.

type SettingsRowProps = {
    title: React.ReactNode;
    description?: React.ReactNode;
    /** A second, quieter line for caveats that should not compete with the description. */
    note?: React.ReactNode;
    /** Leading 36px icon tile. Rows without one keep the old flush-left layout. */
    icon?: LucideIcon;
    /** Current value preview (e.g. the resolved language), right-aligned in secondary color. */
    value?: React.ReactNode;
    /** › indicator for rows that navigate or expand. Decorative unless onClick is set. */
    chevron?: boolean;
    /** Makes the whole row a press target (pointer cursor). */
    onClick?: () => void;
    /** Usually a toggle; anything that sits at the row's right edge. */
    control?: React.ReactNode;
    /** Content under the title block that spans the row's full width, e.g. a slider. */
    children?: React.ReactNode;
    dividerClass: string;
    isLast?: boolean;
};

const SettingsRow: React.FC<SettingsRowProps> = ({
    title,
    description,
    note,
    icon: Icon,
    value,
    chevron,
    onClick,
    control,
    children,
    dividerClass,
    isLast = false,
}) => (
    <div
        className={`px-4 py-3.5 space-y-3${isLast ? '' : ` border-b ${dividerClass}`}${onClick ? ' cursor-pointer' : ''}`}
        onClick={onClick}
    >
        <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                {Icon && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07]">
                        <Icon size={17} />
                    </div>
                )}
                <div className="space-y-1 text-left min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        {title}
                    </div>
                    {description && (
                        <div className="text-xs opacity-50 max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
                            {description}
                        </div>
                    )}
                    {note && (
                        <div className="text-[11px] opacity-40 max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
                            {note}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                {value !== undefined && (
                    <span className="max-w-[160px] truncate text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {value}
                    </span>
                )}
                {chevron && (
                    <ChevronRight size={15} className="opacity-40" style={{ color: 'var(--text-secondary)' }} />
                )}
                {control}
            </div>
        </div>
        {children}
    </div>
);

type SettingsToggleProps = {
    checked: boolean;
    onChange: () => void;
    offClass: string;
    /** Track color when on; the theme's secondary color in every settings page. */
    onColor?: string;
    disabled?: boolean;
    ariaLabel?: string;
};

export const SettingsToggle: React.FC<SettingsToggleProps> = ({ checked, onChange, offClass, onColor, disabled, ariaLabel }) => (
    <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        aria-pressed={checked}
        aria-label={ariaLabel}
        className={`shrink-0 w-12 h-6 rounded-full p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${checked ? '' : offClass}`}
        style={{ backgroundColor: checked ? onColor || 'rgba(114, 119, 134, 1)' : undefined }}
    >
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
);

export default SettingsRow;
