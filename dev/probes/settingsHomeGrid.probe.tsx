import React, { useMemo, useState } from 'react';
import SettingsHomeGrid from '../../src/components/modal/settings/navigation/SettingsHomeGrid';
import { buildSettingsNavGroups, type SettingsSectionId } from '../../src/components/modal/settings/navigation/settingsNavModel';
import en from '../../src/i18n/locales/en';
import type { ProbeDefinition } from './definition';
// dev/probes/settingsHomeGrid.probe.tsx

/**
 * 设置主页宫格：分组标题 + 图标卡片（图标/标题/两行摘要/右箭头）。
 *
 * 用真实英文案（直接读 locale 对象，不初始化 i18n），看到的就是 shipped 的文字。
 * 选中的分区 id 显示在底部，供 spec 断言点击导航。
 */

const lookup = (key: string): string => {
    const options = (en as Record<string, unknown>).options as Record<string, unknown>;
    const short = key.startsWith('options.') ? key.slice('options.'.length) : key;
    const value = options[short];
    return typeof value === 'string' ? value : short;
};

const ProbeBody: React.FC = () => {
    const [selected, setSelected] = useState<SettingsSectionId | null>(null);
    const groups = useMemo(
        () => buildSettingsNavGroups(lookup, { isElectron: true, hasLibrarySuiteChoice: true }),
        [],
    );
    return (
        <div className="min-h-screen bg-zinc-900 p-6" data-probe-content>
            <div className="mx-auto max-w-3xl">
                <SettingsHomeGrid
                    groups={groups}
                    onSelectSection={setSelected}
                    isDaylight={false}
                    title={lookup('options.settingsHomeTitle')}
                    description={lookup('options.settingsHomeDesc')}
                />
                <div className="mt-4 text-xs text-zinc-500" data-selected-section>
                    {selected ?? 'none'}
                </div>
            </div>
        </div>
    );
};

const probe: ProbeDefinition = {
    id: 'settingsHomeGrid',
    title: '设置主页·宫格导航',
    description: '分组标题、图标卡片两行摘要、点击回调分区 id',
    Component: ProbeBody,
};

export default probe;
