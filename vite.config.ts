import path from 'path';
import { fileURLToPath } from 'url';
import { type ConfigEnv, type UserConfig, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { commandPinyinPlugin } from './dev/pinyin/commandPinyinPlugin.mjs';
import { normalizeBuildCommit, resolveBuildRepo } from './dev/build/buildIdentity.mjs';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LYRIC_PROXY_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers': [
    'X-CSRF-Token',
    'X-Requested-With',
    'Accept',
    'Accept-Version',
    'Content-Length',
    'Content-MD5',
    'Content-Type',
    'Date',
    'X-Api-Version',
    'KG-Rec',
    'KG-RC',
    'KG-CLIENTTIMEMS',
    'mid',
    'x-router',
  ].join(', '),
};

const LYRIC_PROXY_IGNORED_FORWARD_HEADERS = ['host', 'connection', 'content-length', 'origin', 'referer'];

function isAllowedLyricProxyHost(hostname: string): boolean {
  return hostname === 'amll-ttml-db.stevexmh.net' ||
    hostname === 'api.amll.dev';
}

function setLyricProxyCorsHeaders(res: import('http').ServerResponse): void {
  Object.entries(LYRIC_PROXY_CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

function sendLyricProxyJson(res: import('http').ServerResponse, statusCode: number, body: unknown): void {
  setLyricProxyCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readDevRequestBody(req: import('http').IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}

function devLyricProxyPlugin() {
  return {
    name: 'bigorange-dev-lyric-proxy',
    apply: 'serve' as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url ?? '/', 'http://localhost');
        if (requestUrl.pathname !== '/api/lyric-proxy') {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          setLyricProxyCorsHeaders(res);
          res.statusCode = 200;
          res.end();
          return;
        }

        const targetUrlStr = requestUrl.searchParams.get('url');
        if (!targetUrlStr) {
          sendLyricProxyJson(res, 400, { error: 'Missing url parameter' });
          return;
        }

        try {
          const targetUrl = new URL(targetUrlStr);
          if (!isAllowedLyricProxyHost(targetUrl.hostname)) {
            sendLyricProxyJson(res, 403, { error: 'Forbidden: Domain not allowed' });
            return;
          }

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (!LYRIC_PROXY_IGNORED_FORWARD_HEADERS.includes(key.toLowerCase()) && value) {
              headers.set(key, Array.isArray(value) ? value.join(', ') : value);
            }
          }

          const hasBody = ['POST', 'PUT', 'PATCH'].includes(req.method ?? '');
          const response = await fetch(targetUrl.toString(), {
            method: req.method,
            headers,
            body: hasBody ? await readDevRequestBody(req) : undefined,
          });

          setLyricProxyCorsHeaders(res);

          res.statusCode = response.status;
          res.statusMessage = response.statusText;
          const contentType = response.headers.get('content-type');
          if (contentType) {
            res.setHeader('Content-Type', contentType);
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          res.end(buffer);
        } catch (error) {
          console.error('Vite lyric proxy request failed:', error);
          sendLyricProxyJson(res, 500, { error: 'Proxy request failed', details: String(error) });
        }
      });
    },
  };
}

export default async function viteConfig(_config: ConfigEnv): Promise<UserConfig> {
  let commitHash = '';
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    commitHash = process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7);
  } else {
    try {
      commitHash = execSync('git rev-parse --short HEAD').toString().trim();
    } catch (e) {
      console.warn('Could not get commit hash:', e);
      commitHash = 'unknown, probably dev version';
    }
  }

  let gitBranch = '';
  if (process.env.VERCEL_GIT_COMMIT_REF) {
    gitBranch = process.env.VERCEL_GIT_COMMIT_REF;
  } else {
    try {
      gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    } catch (e) {
      console.warn('Could not get git branch:', e);
      gitBranch = 'unknown';
    }
  }

  // 版本后缀挂一句随机古诗，不再调上游 namoe 服务。
  const POEM_LINES = [
    '床前明月光', '举头望明月', '低头思故乡',
    '白日依山尽', '黄河入海流', '欲穷千里目', '更上一层楼',
    '春眠不觉晓', '处处闻啼鸟', '夜来风雨声', '花落知多少',
    '空山新雨后', '天气晚来秋', '明月松间照', '清泉石上流',
    '大漠孤烟直', '长河落日圆',
    '海内存知己', '天涯若比邻',
    '会当凌绝顶', '一览众山小',
    '感时花溅泪', '恨别鸟惊心',
    '春风又绿江南岸', '明月何时照我还',
    '孤帆远影碧空尽', '唯见长江天际流',
    '两岸猿声啼不住', '轻舟已过万重山',
    '朝辞白帝彩云间', '千里江陵一日还',
    '举杯邀明月', '对影成三人',
    '人生得意须尽欢', '莫使金樽空对月',
    '天生我材必有用', '千金散尽还复来',
    '长风破浪会有时', '直挂云帆济沧海',
    '安能摧眉折腰事权贵', '使我不得开心颜',
    '明月出天山', '苍茫云海间',
    '小时不识月', '呼作白玉盘',
    '露从今夜白', '月是故乡明',
    '春种一粒粟', '秋收万颗子',
    '锄禾日当午', '汗滴禾下土',
    '独在异乡为异客', '每逢佳节倍思亲',
    '劝君更尽一杯酒', '西出阳关无故人',
    '桃花潭水深千尺', '不及汪伦送我情',
    '桃花一簇开无主', '可爱深红爱浅红',
    '好雨知时节', '当春乃发生',
    '随风潜入夜', '润物细无声',
    '国破山河在', '城春草木深',
    '烽火连三月', '家书抵万金',
    '两个黄鹂鸣翠柳', '一行白鹭上青天',
    '窗含西岭千秋雪', '门泊东吴万里船',
    '千山鸟飞绝', '万径人踪灭',
    '孤舟蓑笠翁', '独钓寒江雪',
    '松下问童子', '言师采药去',
    '只在此山中', '云深不知处',
    '红豆生南国', '春来发几枝',
    '愿君多采撷', '此物最相思',
    '海上生明月', '天涯共此时',
  ];
  let commitSuffix = '';
  const canResolveCommitName = /^[0-9a-f]{7,40}$/i.test(commitHash) && !/^0+$/.test(commitHash);
  if (canResolveCommitName) {
    commitSuffix = `/${POEM_LINES[Math.floor(Math.random() * POEM_LINES.length)]}`;
  }

  // 请求 AMLL 官方 API 时 UA 里的构建身份，见 dev/build/buildIdentity.mjs
  const buildRepo = resolveBuildRepo(process.env, () => execSync('git remote get-url origin', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  const buildCommit = normalizeBuildCommit(commitHash);

  const appVersionLabel = process.env.APP_VERSION_LABEL?.trim() || 'Realeco';
  const appReleaseChannel = process.env.APP_RELEASE_CHANNEL?.trim().toLowerCase() || 'realeco';
  const dockerStackVersion = process.env.DOCKER_STACK_VERSION?.trim() || '';

  return {
    base: process.env.ELECTRON === 'true' ? './' : '/',
    worker: {
      format: 'es'
    },
    optimizeDeps: {
      // Only metadataParser.worker.ts imports music-metadata, and the startup dep scan does not
      // follow worker entries. Left out, the first local import discovers it at runtime, Vite
      // re-optimizes, and every open page is force-reloaded ("optimized dependencies changed").
      include: ['music-metadata'],
    },
    build: {
      rollupOptions: {
        input: {
          main: 'index.html',
          stageClient: 'stage-client.html',
          modExport: 'mod-export.html',
        },
        output: {
          // three.js is a large dependency used only by the diorama 3D visualizer. Split it into its
          // own chunk so it doesn't bloat the main bundle past the PWA precache size limit (each file
          // must stay under workbox.maximumFileSizeToCacheInBytes to be cached for offline use).
          manualChunks(id) {
            return id.includes('/node_modules/three/') ? 'three' : undefined;
          },
          // folium.ui.icon loads each lucide icon as its own chunk (~2000 of them). They live in one
          // directory so the PWA precache can leave them out: only mods ask for them, and mods run in
          // the desktop app, which does not go through the service worker.
          chunkFileNames(chunk) {
            return chunk.moduleIds.some(id => id.includes('/node_modules/lucide-react/dist/esm/icons/'))
              && chunk.moduleIds.length === 1
              ? 'assets/folium-icons/[name]-[hash].js'
              : 'assets/[name]-[hash].js';
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      watch: {
        // Build output and model weights are not sources, and watching them breaks packaging: the
        // watcher opens a handle on every directory it finds, and electron-builder packages by
        // extracting Electron into release/win-unpacked.tmp and renaming it to release/win-unpacked.
        // On Windows that rename fails with EPERM while anything holds the directory - so a dev
        // server left running in another terminal kills every `npm run build:electron`.
        ignored: ['**/release/**', '**/models/**'],
      },
    },
    plugins: [
      devLyricProxyPlugin(),
      commandPinyinPlugin(),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        devOptions: {
          enabled: true
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000,
          // Docker serves this file dynamically; it must never be pinned in the PWA precache.
          globIgnores: ['**/runtime-config.js', '**/assets/folium-icons/**'],
          // API navigations must reach the deployment platform instead of the SPA shell.
          navigateFallbackDenylist: [/^\/api(?:\/|$)/]
        },
        manifest: {
          name: 'BigOrange Music',
          short_name: 'BigOrange',
          description: 'A beautiful AI-themed music player',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          icons: [
            {
              src: 'icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {
      '__COMMIT_HASH__': JSON.stringify(commitHash + commitSuffix),
      '__GIT_BRANCH__': JSON.stringify(gitBranch),
      '__BUILD_REPO__': JSON.stringify(buildRepo),
      '__BUILD_COMMIT__': JSON.stringify(buildCommit),
      '__APP_VERSION__': JSON.stringify(JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version),
      '__APP_VERSION_LABEL__': JSON.stringify(appVersionLabel),
      '__APP_RELEASE_CHANNEL__': JSON.stringify(appReleaseChannel),
      '__DOCKER_STACK_VERSION__': JSON.stringify(dockerStackVersion)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
}
