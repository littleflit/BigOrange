import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { zipSync } from 'fflate';

// build/buildOrtPack.mjs
// Stages the onnxruntime-node beat_this runs in as one .zip per platform.
//
// It is NOT bundled: 45MB of native library for a feature most listeners never turn on. The
// pack lands on the ort-node-v1 data release, the manifest points at it, and the app downloads
// it the same way it downloads the weights - see electron/analysis/modelStore.cjs.
//
// Layout inside the zip (no top directory - unpack() extracts straight into <models>/ort-node/):
//   node_modules/onnxruntime-node/{package.json,dist/*.js,bin/napi-v6/<platform>/<arch>/*}
//   node_modules/onnxruntime-common/{package.json,dist/**/*.js}
// onnxruntime-common rides along because the pack is required from outside the install, where
// the app's own node_modules is not on the lookup path. dist is the whole runtime: lib/ is
// TypeScript sources, script/ is the postinstall downloader, neither is ever required.
//
// Hermetic on purpose: the tarballs come from the npm registry, not from a local install, so a
// fresh clone (which no longer has the dependency at all) builds the same bytes. Versions are
// pinned below - the N-API binding is ABI-stable, but a new major may still move files around,
// and a silent layout change is exactly what the probe in modelPaths.cjs would then refuse.

const ORT_NODE_VERSION = '1.30.0';
const ORT_COMMON_VERSION = '1.30.0';

const PACKS = {
    'linux-x64': { platform: 'linux', arch: 'x64' },
    'win32-x64': { platform: 'win32', arch: 'x64' },
    'darwin-arm64': { platform: 'darwin', arch: 'arm64' },
    // No darwin-x64: onnxruntime-node ships no Intel Mac binary, so that platform reports the
    // pack (and with it beat_this) unsupported rather than offering a download that can never run.
    // The set matches the Python runtime's: only platforms the app actually ships for.
};

// Fixed so a rebuild of the same versions is the same bytes - the manifest pins bytes+sha256,
// and a drifting archive would fail its own check. Same convention as buildPythonRuntime.mjs.
const MTIME = Date.UTC(2020, 0, 1);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.resolve(HERE, '..', 'dist-ort');

const download = async (url, destination) => {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Unable to download ${url}: HTTP ${response.status}`);
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
};

const collect = (dir, prefix, out) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collect(full, `${prefix}${entry.name}/`, out);
        else if (entry.isFile()) out[`${prefix}${entry.name}`] = readFileSync(full);
    }
};

const collectJs = (dir, prefix, out) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        // .js plus any nested package.json: dist/cjs carries {"type":"commonjs"} to flip the
        // parent package's "type":"module", and without it every require in there misfires.
        // The .d.ts/.map/esm twins are never required at runtime.
        if (entry.isDirectory()) collectJs(full, `${prefix}${entry.name}/`, out);
        else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name === 'package.json')) {
            out[`${prefix}${entry.name}`] = readFileSync(full);
        }
    }
};

const buildOne = async (key, { platform, arch }, sources) => {
    const files = {};
    const nodePkg = path.join(sources, 'onnxruntime-node', 'package');
    const commonPkg = path.join(sources, 'onnxruntime-common', 'package');

    files['node_modules/onnxruntime-node/package.json'] = readFileSync(path.join(nodePkg, 'package.json'));
    collectJs(path.join(nodePkg, 'dist'), 'node_modules/onnxruntime-node/dist/', files);
    const binDir = path.join(nodePkg, 'bin', 'napi-v6', platform, arch);
    if (!statSync(binDir, { throwIfNoEntry: false })?.isDirectory()) {
        throw new Error(`onnxruntime-node ${ORT_NODE_VERSION} ships no binary for ${platform}/${arch}`);
    }
    collect(binDir, `node_modules/onnxruntime-node/bin/napi-v6/${platform}/${arch}/`, files);

    files['node_modules/onnxruntime-common/package.json'] = readFileSync(path.join(commonPkg, 'package.json'));
    collectJs(path.join(commonPkg, 'dist', 'cjs'), 'node_modules/onnxruntime-common/dist/cjs/', files);

    const zipped = zipSync(files, { mtime: MTIME });
    const file = `bigorange-ort-node-${key}.zip`;
    await writeFile(path.join(OUT_ROOT, file), zipped);
    const sha256 = createHash('sha256').update(zipped).digest('hex');
    return { key, file, bytes: zipped.length, sha256 };
};

const main = async () => {
    await mkdir(OUT_ROOT, { recursive: true });
    const work = await mkdtemp(path.join(os.tmpdir(), 'bigorange-ort-'));
    try {
        for (const [pkg, version] of [['onnxruntime-node', ORT_NODE_VERSION], ['onnxruntime-common', ORT_COMMON_VERSION]]) {
            const tgz = path.join(work, `${pkg}.tgz`);
            await download(`https://registry.npmjs.org/${pkg}/-/${pkg}-${version}.tgz`, tgz);
            const dest = path.join(work, pkg);
            await mkdir(dest, { recursive: true });
            const result = spawnSync('tar', ['-xzf', tgz, '-C', dest], { stdio: 'inherit' });
            if (result.error) throw result.error;
            if (result.status !== 0) throw new Error(`tar failed with exit code ${result.status}`);
        }
        const results = [];
        for (const [key, target] of Object.entries(PACKS)) {
            results.push(await buildOne(key, target, work));
        }
        console.log(JSON.stringify(
            Object.fromEntries(results.map(({ key, file, bytes, sha256 }) => [key, { file, bytes, sha256 }])),
            null, 2,
        ));
    } finally {
        await rm(work, { recursive: true, force: true });
    }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    main().then(() => { }, (error) => { console.error(error); process.exitCode = 1; });
}
