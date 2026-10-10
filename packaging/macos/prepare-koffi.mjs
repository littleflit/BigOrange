import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
// packaging/macos/prepare-koffi.mjs
// koffi's darwin prebuilds for one-off mac builds. The npm tree on a Linux dev machine only ever
// holds the linux prebuild, so a mac package must fetch its own .node before electron-builder runs:
// the asarUnpack glob in package.json (`node_modules/@koromix/koffi-*/**/*.node`) picks up whatever
// prebuild packages exist, and afterPack's remover stands down on darwin. Nothing here runs on the
// Linux path, so Linux packaging neither pays for nor depends on it.
//
// Fetched with curl + tar on purpose: this repo's npm setup forbids installing local tarballs
// (EALLOWREMOTE), so `npm pack` + `npm install <tgz>` is not an option here.

const PREBUILD_PACKAGE = (arch) => `@koromix/koffi-darwin-${arch}`;

const run = (bin, args, cwd) => new Promise((resolve, reject) => {
    execFile(bin, args, { cwd, timeout: 300000 }, (error, stdout, stderr) => {
        if (error) reject(new Error(`${bin} ${args.join(' ')} failed: ${stderr || error.message}`));
        else resolve(stdout);
    });
});

/** Fetch the darwin prebuild into node_modules so the packager includes it. Idempotent. */
export async function prepareBundledKoffi({ arch, projectRoot }) {
    if (arch !== 'arm64' && arch !== 'x64') {
        throw new Error(`[prepare-koffi] unsupported mac arch for koffi prebuild: ${arch}`);
    }
    const dest = path.join(projectRoot, 'node_modules', '@koromix', `koffi-darwin-${arch}`);
    const probe = path.join(dest, arch === 'arm64' ? 'darwin_arm64' : 'darwin_x64', 'koffi.node');
    try {
        await fs.access(probe);
        console.log(`[prepare-koffi] reusing ${PREBUILD_PACKAGE(arch)}`);
        return;
    } catch { /* fetch it below */ }
    console.log(`[prepare-koffi] fetching ${PREBUILD_PACKAGE(arch)}`);
    const metaResponse = await fetch(`https://registry.npmjs.org/${PREBUILD_PACKAGE(arch)}/latest`);
    if (!metaResponse.ok) throw new Error(`[prepare-koffi] registry lookup failed: HTTP ${metaResponse.status}`);
    const { version, dist } = await metaResponse.json();
    if (!dist?.tarball) throw new Error('[prepare-koffi] registry response has no tarball');
    const tmp = await fs.mkdtemp(path.join(projectRoot, 'node_modules', '.koffi-darwin-'));
    try {
        await run('curl', ['-fsSL', '-o', path.join(tmp, 'pkg.tgz'), dist.tarball], tmp);
        await fs.mkdir(dest, { recursive: true });
        // npm tarballs wrap everything in package/: strip it on extract.
        await run('tar', ['-xzf', path.join(tmp, 'pkg.tgz'), '--strip-components=1', '-C', dest], tmp);
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
    }
    await fs.access(probe);
    console.log(`[prepare-koffi] installed ${PREBUILD_PACKAGE(arch)}@${version}`);
}

/** Fail the build loudly when the mac package would ship without its koffi runtime. */
export async function verifyBundledKoffi({ resourcesDir, arch, version }) {
    const dirName = arch === 'arm64' ? 'darwin_arm64' : arch === 'x64' ? 'darwin_x64' : null;
    if (!dirName) throw new Error(`[prepare-koffi] unsupported mac arch for verify: ${arch}`);
    const nodeBinary = path.join(resourcesDir, 'app.asar.unpacked', 'node_modules', '@koromix', `koffi-darwin-${arch}`, dirName, 'koffi.node');
    try {
        await fs.access(nodeBinary);
    } catch {
        throw new Error(`[prepare-koffi] missing ${nodeBinary}: koffi ${version ?? ''} has no darwin ${arch} runtime in this package`);
    }
    console.log(`[prepare-koffi] verified ${nodeBinary}`);
}
