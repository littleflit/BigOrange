import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { SettingsNavGroup, SettingsSectionId } from './settingsNavModel';

// src/components/modal/settings/navigation/SettingsHomeGrid.tsx
// The options-tab landing: every section as an icon card under its group heading, instead of
// opening on one section's wall of rows. The cards navigate - they carry no state - so this
// component stays a pure function of the same nav model the sidebars read.

type SettingsHomeGridProps = {
    groups: SettingsNavGroup[];
    onSelectSection: (sectionId: SettingsSectionId) => void;
    isDaylight: boolean;
    title: string;
    description: string;
};

export const SettingsHomeGrid: React.FC<SettingsHomeGridProps> = ({
    groups,
    onSelectSection,
    isDaylight,
    title,
    description,
}) => (
    <div className="pb-4">
        <div className="mb-4 md:mb-6 border-b border-white/10 pb-3 md:pb-4">
            <h2 className="text-lg md:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {title}
            </h2>
            <p className="text-xs opacity-50 mt-1" style={{ color: 'var(--text-secondary)' }}>
                {description}
            </p>
        </div>
        <div className="space-y-6">
            {groups.map((group) => (
                <section key={group.id} aria-label={group.label}>
                    <h3
                        className="px-1 pb-2 text-xs font-bold uppercase tracking-widest opacity-50"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {group.label}
                    </h3>
                    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
                        {group.items.map((section) => {
                            const Icon = section.icon;
                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => onSelectSection(section.id)}
                                    className={`group rounded-xl border p-3.5 text-left transition-colors flex flex-col gap-2.5 min-h-[118px] ${isDaylight ? 'border-black/10 bg-white/60 hover:bg-white/90 hover:border-black/20' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20'}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isDaylight ? 'bg-black/[0.05]' : 'bg-white/[0.07]'}`}
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            <Icon size={18} />
                                        </div>
                                        <ChevronRight
                                            size={15}
                                            className="shrink-0 opacity-30 transition-all group-hover:opacity-70 group-hover:translate-x-0.5"
                                            style={{ color: 'var(--text-secondary)' }}
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                            {section.label}
                                        </div>
                                        <div
                                            className="mt-0.5 text-[11px] leading-snug opacity-50 overflow-hidden"
                                            style={{
                                                color: 'var(--text-secondary)',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                            }}
                                        >
                                            {section.description}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    </div>
);

export default SettingsHomeGrid;
