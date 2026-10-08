import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';

// test/unit/electron/modelStore.test.ts
// The two ways weights reach a listener - downloaded, or found on their own disk - and the one rule
// both obey: nothing lands under the real filename until its sha256 matches. A truncated or
// substituted ONNX does not fail loudly; it loads and answers confidently and wrongly, which for a
// beat grid means every transition is off the beat with nothing in the log to say why.
//
// Run against a real local HTTP server rather than a mocked fetch, because everything worth testing
// here is something a mock would have to be TOLD to do: 404, serve the wrong bytes, work. A mock
// that returns what I told it to return proves only that I can write a mock.

const require = createRequire(import.meta.url);
const { createModelStore } = require('../../../electron/analysis/modelStore.cjs');
const manifest = require('../../../shared/modelManifest.json');

const sha256 = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

// Stand-in weights. Small on purpose - the real 83MB would make this suite slow to prove nothing
// extra, since every rule under test is about bytes matching a hash, not about how many there are.
const goodBytes = Buffer.alloc(4096, 7);
const wrongBytes = Buffer.alloc(4096, 9);

/**
 * The runtime's stand-in: a real zip, because unpacking it is the behaviour under test.
 *
 * Two files and a nested one, which is the shape that matters - the interpreter lives at a path
 * the extractor has to create directories for, and getting that wrong yields a runtime folder with
 * no interpreter in it, which is precisely the state resolveRuntimeDir exists to refuse.
 */
const RUNTIME_EXE = require('../../../electron/analysis/modelPaths.cjs').RUNTIME_BIN.join('/');
const archiveBytes = Buffer.from(zipSync({
    [RUNTIME_EXE]: new Uint8Array([1, 2, 3]),
    'lib/thing.py': new Uint8Array([4, 5]),
}));

const model = manifest.models[0];
/** Downloaded and verified exactly like a model, then unpacked instead of renamed into place. */
const runtime = {
    name: 'runtime',
    file: 'runtime.zip',
    unpack: 'runtime',
    enables: 'stems',
    license: 'test',
    bytes: archiveBytes.length,
    sha256: sha256(archiveBytes),
};

/**
 * The ort-node stand-in: a real zip shaped like the pack, with its own mirrors. The mirrors
 * override is the behaviour under test as much as the unpack: the pack does not live on the
 * weights mirrors, so routing it through them would 404 on every one before failing.
 */
const ORT_PROBE = ['node_modules', 'onnxruntime-node', 'dist', 'index.js'].join('/');
const ortArchiveBytes = Buffer.from(zipSync({
    [ORT_PROBE]: new Uint8Array([7, 7, 7]),
}));
const ort = {
    name: 'ort-node',
    file: 'ort.zip',
    unpack: 'ort-node',
    enables: 'beatGrid',
    license: 'test',
    bytes: ortArchiveBytes.length,
    sha256: sha256(ortArchiveBytes),
    mirrors: [] as string[],
};

let root: string;
let downloadDir: string;
let elsewhere: string;
let server: Server;
/** What each mirror path should do on the next request, so one server covers every behaviour. */
let serve: Record<string, 'good' | 'wrong' | 'missing'>;

const makeStore = (overrides: Record<string, unknown> = {}) => createModelStore({
    getModelsDirs: () => [downloadDir],
    getDownloadDir: () => downloadDir,
    ...overrides,
});

beforeAll(async () => {
    // The manifest describes the real weights; this rewrites the loaded copy to describe the
    // stand-ins, so the store is tested against a manifest of exactly the shape it reads in
    // production - one whose hash and size are simply the ones the server will really send.
    manifest.models.length = 1;
    model.bytes = goodBytes.length;
    model.sha256 = sha256(goodBytes);
    manifest.models.push(runtime);
    manifest.models.push(ort);

    server = createServer((request, response) => {
        const mode = serve[request.url?.split('/')[1] ?? ''] ?? 'missing';
        if (mode === 'missing') { response.writeHead(404); response.end(); return; }
        const wanted = request.url?.split('/').pop();
        const body = mode !== 'good'
            ? wrongBytes
            : (wanted === runtime.file ? archiveBytes : wanted === ort.file ? ortArchiveBytes : goodBytes);
        response.writeHead(200, { 'content-length': String(body.length) });
        response.end(body);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    manifest.mirrors = [
        `http://127.0.0.1:${port}/down/{file}`,
        `http://127.0.0.1:${port}/up/{file}`,
    ];
    ort.mirrors = [
        `http://127.0.0.1:${port}/up/{file}`,
    ];
});

afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'bigorange-store-'));
    downloadDir = path.join(root, 'models');
    elsewhere = path.join(root, 'Downloads');
    mkdirSync(downloadDir);
    mkdirSync(elsewhere);
    serve = { down: 'missing', up: 'missing' };
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const installed = () => path.join(downloadDir, model.file);

describe('downloading a model', () => {
    it('writes it once the hash matches, and reports finishing', async () => {
        serve = { down: 'good', up: 'good' };
        const progress: Array<Record<string, unknown>> = [];
        const store = makeStore({ onProgress: (event: Record<string, unknown>) => progress.push(event) });

        const result = await store.download(model.name);

        expect(result.ok).toBe(true);
        expect(sha256(readFileSync(installed()))).toBe(model.sha256);
        expect(progress.at(-1)).toMatchObject({ name: model.name, status: 'ready' });
    });

    // The whole reason there is a list of mirrors rather than a URL.
    it('falls through to the next mirror when the first is down', async () => {
        serve = { down: 'missing', up: 'good' };

        const result = await makeStore().download(model.name);

        expect(result.ok).toBe(true);
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0]).toContain('404');
    });

    // A mirror is a host we do not control, which is the entire reason the hash exists. Serving the
    // wrong bytes must be treated exactly like being down: move on, and leave nothing behind.
    it('rejects a mirror that serves the wrong bytes and keeps looking', async () => {
        serve = { down: 'wrong', up: 'good' };

        const result = await makeStore().download(model.name);

        expect(result.ok).toBe(true);
        expect(result.skipped[0]).toContain('sha256');
        expect(sha256(readFileSync(installed()))).toBe(model.sha256);
    });

    it('leaves nothing behind when every mirror fails, not even a partial file', async () => {
        serve = { down: 'wrong', up: 'wrong' };

        const result = await makeStore().download(model.name);

        expect(result.ok).toBe(false);
        expect(result.skipped).toHaveLength(2);
        // Not under the real name, and not as a .part either: resolveModelFile would find the
        // first and report the model installed, handing onnxruntime a truncated graph.
        expect(readdirSync(downloadDir)).toEqual([]);
    });

    /**
     * The runtime is not a file - it is 1400 of them, and what counts as installed is one
     * interpreter deep inside the result. Everything up to the hash is shared with the models;
     * only the last step differs, so this checks the last step.
     */
    it('unpacks an archive into a directory and throws the archive away', async () => {
        serve = { down: 'good', up: 'good' };

        const result = await makeStore().download('runtime');

        expect(result.ok).toBe(true);
        expect(result.path).toBe(path.join(downloadDir, 'runtime'));
        expect(readFileSync(path.join(downloadDir, 'runtime', ...RUNTIME_EXE.split('/'))))
            .toEqual(Buffer.from([1, 2, 3]));
        expect(readFileSync(path.join(downloadDir, 'runtime', 'lib', 'thing.py')))
            .toEqual(Buffer.from([4, 5]));
        // The zip has done its job, and it is a third the size of what came out of it.
        expect(readdirSync(downloadDir)).toEqual(['runtime']);
    });

    // Same rule the models get, and it matters more here: a half-extracted directory has an
    // interpreter in it some of the time, so "the folder is there" would report installed on a
    // download that never finished. The staging name is what keeps that from being reachable.
    it('leaves no runtime directory behind when the archive does not verify', async () => {
        serve = { down: 'wrong', up: 'wrong' };

        const result = await makeStore().download('runtime');

        expect(result.ok).toBe(false);
        expect(readdirSync(downloadDir)).toEqual([]);
    });

    // The listener's own copy off a netdisk. Unpacked where it lies, and NOT consumed: the file is
    // theirs, they may want it for another machine, and installing must not take it away.
    it('installs an archive the listener already has without eating it', async () => {
        const carried = path.join(elsewhere, 'runtime (1).zip');
        writeFileSync(carried, archiveBytes);

        const found = await makeStore().scan([elsewhere]);
        expect(found.found.map((hit: { name: string }) => hit.name)).toContain('runtime');

        const result = await makeStore().installLocal('runtime', carried);

        expect(result.ok).toBe(true);
        expect(existsSync(path.join(downloadDir, 'runtime', ...RUNTIME_EXE.split('/')))).toBe(true);
        expect(existsSync(carried)).toBe(true);
    });

    /**
     * The ort pack is a second unpack entry, and it exercises the two ways it differs from the
     * runtime: its own mirrors (the weights mirrors would 404 it), and no interpreter to chmod
     * (a chmod of a file that was never supposed to exist used to fail the install).
     */
    it('downloads the ort pack through its own mirrors and resolves it as installed', async () => {
        serve = { down: 'good', up: 'good' };

        const result = await makeStore().download('ort-node');

        expect(result.ok).toBe(true);
        expect(result.path).toBe(path.join(downloadDir, 'ort-node'));
        expect(readFileSync(path.join(downloadDir, 'ort-node', ...ORT_PROBE.split('/'))))
            .toEqual(Buffer.from([7, 7, 7]));
        // The zip has done its job. What counts as installed is the entry inside the directory.
        expect(readdirSync(downloadDir)).toEqual(['ort-node']);
        const status = await makeStore().status();
        expect(status.models.find((m: { name: string }) => m.name === 'ort-node')?.path)
            .toBe(path.join(downloadDir, 'ort-node'));
    });

    // The override, not the fallback order: with every manifest mirror dead, the entry's own
    // mirrors are still tried, and the download still lands.
    it('prefers an entry mirrors over dead manifest mirrors', async () => {
        serve = { down: 'missing', up: 'good' };
        const saved = manifest.mirrors;
        manifest.mirrors = ['http://127.0.0.1:1/down/{file}'];
        try {
            const result = await makeStore().download('ort-node');
            expect(result.ok).toBe(true);
        } finally {
            manifest.mirrors = saved;
        }
    });
});

describe('finding a model already on the machine', () => {
    // The netdisk route in one test. Browsers and netdisk clients rename downloads, so matching on
    // filename would miss the exact case this feature exists for.
    it('recognises the weights under a completely different name', async () => {
        writeFileSync(path.join(elsewhere, 'beat_this (1).onnx.download'), goodBytes);

        const { found } = await makeStore().scan([elsewhere]);

        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ name: model.name });
        expect(path.basename(found[0].path)).toBe('beat_this (1).onnx.download');
    });

    it('is not fooled by a wrong file wearing the right name', async () => {
        writeFileSync(path.join(elsewhere, model.file), wrongBytes);

        expect((await makeStore().scan([elsewhere])).found).toEqual([]);
    });

    it('looks one level down, which is where a netdisk client puts things', async () => {
        const nested = path.join(elsewhere, 'BaiduNetdiskDownload');
        mkdirSync(nested);
        writeFileSync(path.join(nested, 'anything.bin'), goodBytes);

        expect((await makeStore().scan([elsewhere])).found).toHaveLength(1);
    });

    it('installs by copying, so the listener keeps their own download', async () => {
        const source = path.join(elsewhere, 'downloaded.onnx');
        writeFileSync(source, goodBytes);

        const result = await makeStore().installLocal(model.name, source);

        expect(result.ok).toBe(true);
        expect(existsSync(source)).toBe(true);
        expect(sha256(readFileSync(installed()))).toBe(model.sha256);
    });

    it('refuses to install a file that is not this model', async () => {
        const source = path.join(elsewhere, 'wrong.onnx');
        writeFileSync(source, wrongBytes);

        const result = await makeStore().installLocal(model.name, source);

        expect(result.ok).toBe(false);
        expect(readdirSync(downloadDir)).toEqual([]);
    });

    // Nothing missing, so nothing is walked - not one stat. The runtime has to be installed too
    // for that to hold: the scan looks for whatever is absent, and it is absent one entry at a time.
    // Same for the ort pack since it arrived: three entries, three things to have.
    it('does not go looking once everything is already installed', async () => {
        writeFileSync(installed(), goodBytes);
        const exe = path.join(downloadDir, 'runtime', ...RUNTIME_EXE.split('/'));
        mkdirSync(path.dirname(exe), { recursive: true });
        writeFileSync(exe, 'not really python');
        const probe = path.join(downloadDir, 'ort-node', ...ORT_PROBE.split('/'));
        mkdirSync(path.dirname(probe), { recursive: true });
        writeFileSync(probe, 'not really onnxruntime');
        writeFileSync(path.join(elsewhere, 'spare.onnx'), goodBytes);

        expect(await makeStore().scan([elsewhere])).toEqual({ found: [], scanned: 0 });
    });

    // ...and it still walks when only one of the two is there, which is the ordinary state on a
    // machine part way through setting this up.
    it('still goes looking when the weights are in but the runtime is not', async () => {
        writeFileSync(installed(), goodBytes);
        writeFileSync(path.join(elsewhere, 'carried.zip'), archiveBytes);

        const { found } = await makeStore().scan([elsewhere]);

        expect(found.map((hit: { name: string }) => hit.name)).toEqual(['runtime']);
    });

    it('deletes the resolved copy wherever it is, not just the download directory', async () => {
        // The listener pointed the models directory somewhere, filled it, then pointed it back.
        // "Delete all" has to mean the copies the page is CURRENTLY reporting as installed.
        writeFileSync(path.join(elsewhere, model.file), goodBytes);
        const store = makeStore({ getModelsDirs: () => [downloadDir, elsewhere] });

        const result = await store.removeAll();

        expect(result.ok).toBe(true);
        expect(result.removed).toEqual([model.name]);
        expect(result.freed).toBe(goodBytes.length);
        expect(existsSync(path.join(elsewhere, model.file))).toBe(false);
    });

    it('sweeps up half-finished downloads, which nothing else ever would', async () => {
        writeFileSync(installed(), goodBytes);
        const part = `${installed()}.part`;
        writeFileSync(part, goodBytes.subarray(0, 100));

        await makeStore().removeAll();

        expect(existsSync(part)).toBe(false);
        expect(readdirSync(downloadDir)).toEqual([]);
    });

    it('is a no-op that still succeeds when nothing is installed', async () => {
        const result = await makeStore().removeAll();

        expect(result).toMatchObject({ ok: true, removed: [], freed: 0, failed: [] });
    });

    // NOT covered: the `failed` branch, where a copy cannot be deleted - in production that is a
    // weight inside the installer's own read-only directory. There is no way to provoke it here.
    // On this platform `fsp.rm` clears the read-only attribute itself and deletes through an open
    // handle, both verified, and a directory under the model's filename is never resolved as
    // installed in the first place (resolveModelFile uses isFile). Faking it would mean mocking
    // fs/promises out from under the thirteen tests above that depend on it being the real one.
});
