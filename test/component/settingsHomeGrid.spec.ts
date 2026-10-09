import { expect, test } from './fixtures';

// test/component/settingsHomeGrid.spec.ts
// 设置主页宫格只在真实浏览器里成立：卡片网格断行、两行摘要截断、点击回调。
// 探针见 dev/probes/settingsHomeGrid.probe.tsx。

test.describe('settings home grid', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('renders every section as a card under its group', async ({ mount, page }) => {
        await mount('settingsHomeGrid');

        for (const heading of ['Appearance', 'Controls', 'Connections & Data', 'System']) {
            await expect(page.getByText(heading, { exact: true })).toBeVisible();
        }
        for (const card of ['General settings', 'Playback settings', 'Interaction']) {
            await expect(page.getByRole('button', { name: new RegExp(card) })).toBeVisible();
        }
    });

    test('clicking a card reports its section id', async ({ mount, page }) => {
        await mount('settingsHomeGrid');

        await page.getByRole('button', { name: /Playback settings/ }).click();
        await expect(page.locator('[data-selected-section]')).toHaveText('playback');
    });

    test('takes a snapshot of the grid', async ({ mount, page }) => {
        await mount('settingsHomeGrid');

        await expect(page.locator('[data-probe-content]')).toHaveScreenshot('settings-home-grid.png');
    });
});
