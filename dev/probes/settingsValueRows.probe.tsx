import React from 'react';
import { Bell, ChevronRight, Globe, Moon, Palette, Type } from 'lucide-react';
import type { ProbeDefinition } from './definition';
// dev/probes/settingsValueRows.probe.tsx

/**
 * iOS 式设置行原型：左标题+描述，右当前值+箭头（可点行）或内联控件。
 *
 * 样式向播放器对齐：圆角卡片、半透明底、主题色数值、宽松行距——不再是后台管理风。
 * 文案写死英文，定稿后再接 i18n 与真实 store。
 */

type RowDef =
    | { kind: 'nav'; icon: typeof Globe; title: string; desc: string; value: string }
    | { kind: 'toggle'; icon: typeof Moon; title: string; desc: string; on: boolean };

const ROWS: RowDef[] = [
    { kind: 'nav', icon: Globe, title: 'Language', desc: 'Interface language and other app-wide preferences.', value: '中文' },
    { kind: 'nav', icon: Palette, title: 'Theme', desc: 'Lyric rendering, themes and background appearance.', value: 'Monet' },
    { kind: 'nav', icon: Type, title: 'Lyrics font', desc: 'Font stack, weight and fallback families.', value: 'Noto Serif' },
    { kind: 'toggle', icon: Moon, title: 'Daylight mode', desc: 'Light interface for bright rooms.', on: false },
    { kind: 'toggle', icon: Bell, title: 'Desktop notifications', desc: 'Now playing and lyric updates.', on: true },
];

const Row: React.FC<{ row: RowDef; last: boolean; isDaylight: boolean }> = ({ row, last, isDaylight }) => {
    const Icon = row.icon;
    return (
        <button
            type="button"
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isDaylight ? 'hover:bg-black/[0.03] active:bg-black/[0.05]' : 'hover:bg-white/[0.05] active:bg-white/[0.08]'}${last ? '' : isDaylight ? ' border-b border-black/[0.06]' : ' border-b border-white/[0.06]'}`}
        >
            <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isDaylight ? 'bg-black/[0.05]' : 'bg-white/[0.08]'}`}
                style={{ color: 'var(--text-primary)' }}
            >
                <Icon size={17} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>
                    {row.title}
                </div>
                <div className="mt-0.5 truncate text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                    {row.desc}
                </div>
            </div>
            {row.kind === 'nav' ? (
                <div className="flex shrink-0 items-center gap-1">
                    <span className="max-w-[140px] truncate text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {row.value}
                    </span>
                    <ChevronRight size={15} className="opacity-40" style={{ color: 'var(--text-secondary)' }} />
                </div>
            ) : (
                <div
                    className={`flex h-7 w-[52px] shrink-0 items-center rounded-full p-1 transition-colors ${row.on ? '' : isDaylight ? 'bg-black/15' : 'bg-white/15'}`}
                    style={row.on ? { backgroundColor: 'var(--accent-color, #7c8cf8)' } : undefined}
                    role="switch"
                    aria-checked={row.on}
                >
                    <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${row.on ? 'translate-x-[24px]' : ''}`} />
                </div>
            )}
        </button>
    );
};

const ProbeBody: React.FC = () => {
    const [daylight, setDaylight] = React.useState(false);
    return (
        <div
            className={`min-h-screen p-6 ${daylight ? 'bg-zinc-100' : 'bg-zinc-900'}`}
            data-probe-content
            style={daylight
                ? { '--text-primary': '#18181b', '--text-secondary': '#52525b' } as React.CSSProperties
                : { '--text-primary': '#f4f4f5', '--text-secondary': '#a1a1aa' } as React.CSSProperties}
        >
            <div className="mx-auto max-w-xl">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                            General
                        </h2>
                        <p className="mt-1 text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                            Interface language and other app-wide preferences.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setDaylight(current => !current)}
                        className="rounded-lg border px-2.5 py-1.5 text-[11px]"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {daylight ? 'dark' : 'light'}
                    </button>
                </div>
                <div
                    className={`overflow-hidden rounded-2xl border ${daylight ? 'border-black/10 bg-white/70' : 'border-white/10 bg-white/[0.04]'}`}
                >
                    {ROWS.map((row, index) => (
                        <Row key={row.title} row={row} last={index === ROWS.length - 1} isDaylight={daylight} />
                    ))}
                </div>
                <p className="mt-3 text-[11px] opacity-40" style={{ color: 'var(--text-secondary)' }}>
                    Prototype only: copy is hardcoded English, values are static. Light/dark toggle above previews both themes.
                </p>
            </div>
        </div>
    );
};

const probe: ProbeDefinition = {
    id: 'settingsValueRows',
    title: '设置行·iOS 值预览原型',
    description: '左图标标题描述，右当前值+箭头或开关；附明暗切换',
    Component: ProbeBody,
};

export default probe;
