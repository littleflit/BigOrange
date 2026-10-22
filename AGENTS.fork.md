# fork 规则（优先于 AGENTS.md）

本仓库是 [chthollyphile/folia-major](https://github.com/chthollyphile/folia-major) 的 fork，本地目录名 `BigOrange`。

- `AGENTS.md` 来自上游，描述的是**上游代码库**的架构与规范，仍然有效。除非某条规则在 fork 后已经不成立，否则**不要改写它**——上游更新时保持 `git merge` 干净。
- 本文件只写「fork 独有的、上游没有的」内容。两者冲突时以本文件为准。
- 不要往仓库里放本机专属内容（绝对路径、代理、token、个人凭据）。

## 与上游的差异

- **AppImage 默认硬件渲染**：上游在检测到 `APPIMAGE`/`APPDIR` 时固定 `swiftshader`（`electron/main.cjs` 的 `linuxGraphicsMode`），fork 改成默认 `system`，软件渲染只在显式设置 `FOLIA_LINUX_GRAPHICS_MODE=swiftshader|software` 时启用。
- **用户数据目录**：启动时 `app.setPath('userData', ~/.config/BigOrange)`，与上游 `~/.config/Folia` 隔离（electron-store、session、日志、缓存都跟着走）。不做旧目录迁移。
- **图标**：`public/icon.svg` + `build/icon.png` 换成粉色底橙色小猫。
- **品牌名**：运行时和界面里能看到的 `Folia` 已改成 `BigOrange`（窗口标题、托盘、通知、崩溃标题、User-Agent、Discord 状态、i18n 文案、启动画面、`stage-client.html` 等）。包身份也改了：`name=bigorange`、`productName=BigOrange`、`appId=top.izuna.bigorange`、可执行文件与桌面项 `bigorange`、`StartupWMClass=bigorange`。
- **有意保留的 `folia`**：内部标识和已发布数据不改——协议 `folia-cover` / `folia-mod`、存储键、`folium` 模组 API、`mod.json` 的 `folia` 版本字段、`.fia` 格式、`FOLIA_LINUX_*` 环境变量、`icu-folia` 分词器。
- **仍指向上游的地址**：帮助页/问题反馈/更新源/AUR 包名仍指向 `chthollyphile/folia-major`（fork 没有自己的发布仓库）。因此「检查更新」会看到上游的 Folia 版本，不要用它覆盖 BigOrange。

## 本地开发

环境要求：Node `>= 24`（见 `package.json` 的 `engines` 与 `.nvmrc`），npm 随 Node 分发。

```bash
npm ci                    # 安装依赖
npm run dev               # Web 预览，Vite 监听 http://localhost:3000
npm run dev:electron      # Electron 桌面版（先起 Vite，再等 3000 端口）
```

只打算用 `skills/run-desktop/driver.mjs` 驱动桌面版时，可以用 `npm ci --ignore-scripts` 跳过
Electron 的 postinstall（第一次 `serve` 时才下载二进制）。

## 验证命令

提交前至少跑与改动相关的那几项：

```bash
npm run typecheck                     # tsc --noEmit
npm run test:unit                     # Vitest，test/unit/**
npm run test:component                # Playwright 组件测试
npm run test:ui                       # 组件 + 整页 UI 测试（比 test:component 慢）
npm run codemap:check                 # docs/CODEMAP.md 是否与源码一致（改结构后必须跑）
npm run folium:check                  # mods 类型/文档是否与源码一致
```

生成物不要手改：`docs/CODEMAP.md` 用 `npm run codemap`，`mods/folium.d.ts` 用 `npm run folium:types`，
`docs/folium/api.md` 用 `npm run folium:api`，`api/qq.js` 用 `npm run build:vercel-api`。

## 提交与上游同步

- `upstream` 指 `chthollyphile/folia-major`；同步用 `git fetch upstream && git merge upstream/main`，冲突优先落在本文件与 fork 专属目录里，别散进上游文件。
- 如果是准备回提给上游的改动：不要在这类提交里带 fork 专属内容（包括本文件、`opencode.json`），单独分支、单独 PR。
- 上游 `CONTRIBUTING.md` 对 PR 描述的要求（问题与原因、总体设计、验证结果、影响与限制）回提时照办。

## 排错记录

<!-- TODO: 踩过的坑写在这里，一条一行，带上现象和解决方式 -->
