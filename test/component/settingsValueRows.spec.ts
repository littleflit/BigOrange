import { expect, test } from './fixtures';

// test/component/settingsValueRows.spec.ts
// iOS 式设置行原型：值预览 + 箭头 + 开关。探针见 dev/probes/settingsValueRows.probe.tsx。

test.describe('settings value rows', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('renders titles with value previews and chevrons', async ({ mount, page }) => {
        await mount('settingsValueRows');

        await expect(page.getByText('Language', { exact: true })).toBeVisible();
        await expect(page.getByText('中文', { exact: true })).toBeVisible();
        await expect(page.getByText('Monet', { exact: true })).toBeVisible();
    });

    test('takes a snapshot of the rows', async ({ mount, page }) => {
        await mount('settingsValueRows');

        await expect(page.locator('[data-probe-content]')).toHaveScreenshot('settings-value-rows.png');
    });
});
