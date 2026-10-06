#!/usr/bin/env node
// Build the Windows wallpaper helper (Windows desktop wallpaper mode.
//
// Builds the Rust crate in packaging/windows/wallpaper-helper/ with `cargo build --release` and
// copies bigorange-wallpaper-helper.exe into build/ so electron-builder's win extraResources packages
// it as resources/bigorange-wallpaper-helper.exe. Mirrors packaging/linux/build-windowtolayer.mjs:
// shared by local `npm run build:electron*` and the CI release workflow, and its output doubles
// as the dev-path override for BIGORANGE_WALLPAPER_HELPER_PATH (see resolveWallpaperHelperPath in
// electron/main.cjs). No-op on non-Windows hosts (the Linux/macOS build must not depend on a
// Rust Windows toolchain).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_DIR = path.join(ROOT, 'packaging', 'windows', 'wallpaper-helper');
const OUT_DIR = path.join(ROOT, 'build');
const OUT_BIN = path.join(OUT_DIR, 'bigorange-wallpaper-helper.exe');

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit', cwd: SRC_DIR });
}

if (process.platform !== 'win32') {
  console.log('[wallpaper-helper] non-Windows host, skipping build');
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
run('cargo', ['build', '--release']);
copyFileSync(path.join(SRC_DIR, 'target', 'release', 'bigorange-wallpaper-helper.exe'), OUT_BIN);
console.log(`[wallpaper-helper] built ${OUT_BIN}`);
