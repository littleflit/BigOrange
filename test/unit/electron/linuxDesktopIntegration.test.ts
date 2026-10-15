import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// test/unit/electron/linuxDesktopIntegration.test.ts
// Tests Linux desktop entry metadata, WM_CLASS / app_id alignment, and packaging configuration.
// BigOrange 打包 AppImage 与 Windows（NSIS）：不再覆盖 deb/rpm/tar.gz、macOS 与 AUR。

describe('linuxDesktopIntegration', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const mainCjsPath = path.join(rootDir, 'electron/main.cjs');
  const linuxDesktopTemplatePath = path.join(rootDir, 'packaging/linux/folia-major.desktop');

  it('declares desktopName and syncDesktopName in package.json matching executableName', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    expect(pkg.desktopName).toBe('folia-major.desktop');
    expect(pkg.build?.linux?.executableName).toBe('folia-major');
    expect(pkg.build?.linux?.syncDesktopName).toBe(true);
    expect(pkg.build?.linux?.desktop?.entry?.StartupWMClass).toBe('folia-major');
  });

  it('builds AppImage and Windows NSIS only', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    expect(pkg.build?.linux?.target).toEqual(['AppImage']);
    expect(pkg.build?.win?.target).toEqual(['nsis']);
    expect(pkg.build?.mac).toBeUndefined();
  });

  it('leaves Linux desktop identity to package.json desktopName instead of electron/main.cjs', () => {
    // Electron applies package.json desktopName at startup; a second setDesktopName call would drift from it.
    const mainContent = fs.readFileSync(mainCjsPath, 'utf8');

    expect(mainContent).not.toContain('app.setDesktopName(');
  });

  it('aligns StartupWMClass to folia-major in portable linux desktop entry', () => {
    const content = fs.readFileSync(linuxDesktopTemplatePath, 'utf8');

    expect(content).toMatch(/^StartupWMClass=folia-major$/m);
  });
});
