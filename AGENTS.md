# BigOrange 工作规范

人类协作者与 AI agent 的共同行为准则。`CLAUDE.md` 只做入口跳转，规则以本文件为准。
BigOrange 是独立仓库，早期从 `chthollyphile/folia-major` 分叉出来，仍从它同步上游改进。凡与上游惯例冲突，以本文件为准。

## 0. 快速上手

首次进仓先跑通这组命令（Node 版本见 `.nvmrc`，当前要求 24）：

```bash
git fetch origin && git status
node -v            # 期望 v24.x
npm run typecheck  # tsc --noEmit，全库唯一类型检查入口
```

关键文件索引：分层与改动归属见 `src/README.md`；发版校验逻辑见
`shared/realecoReleaseMetadata.cjs`；发版触发条件见
`.github/workflows/electron-release.yml`（`push` 到 `main` 且改动 `realeco-release`）。

## 1. 日常工作流

### 1.1 动工前

- `git fetch origin && git status`；本地 `main` 与 `origin/main`（`littleflit/BigOrange`）保持一致，不长期滞后或超前，有更新先 `git pull --rebase`。
- `upstream`（`chthollyphile/folia-major`）只用于同步上游，**永不直接推送**。未配置时按需 `git remote add upstream https://github.com/chthollyphile/folia-major.git`。
- Node 按 `.nvmrc` 切好再动手（`engines` 要求 `>=24.0.0`，实际以 `.nvmrc` 为准）。

### 1.2 动手中

- 一次完整改动对应一次 `commit + push`，不在本地堆积未推送提交。
- 推送前 `git status` 干净，只包含预期文件；顺手 `git log --oneline -3` 确认没有误带别人的提交。
- 提交邮箱固定 `littleflit@users.noreply.github.com`（账号开启了阻止暴露邮箱，真实邮箱推送会被拒绝）。只改本仓库 local 配置，不要动 global：
  `git config user.email "littleflit@users.noreply.github.com"`。

### 1.3 收尾（Definition of Done）

- `npm run typecheck` 通过。任何改动（**含纯文档改动**）都跑，因为这是全库唯一类型入口且成本低。
- 触及 `electron/`、登录、播放核心时，加跑 `npm run test:unit`（vitest，`test/unit/**/*.test.ts`），全绿才提交。
- 仓库没有 lint script，**不要自行引入** lint / format / 其他检查步骤。
- 发版相关改动额外满足 §4 的验收标准；合并上游额外满足 §3 的验收标准。

## 2. 命令与代码约定

### 2.1 命令表（唯一入口，不自创等价命令）

| 目的 | 命令 |
| --- | --- |
| 类型检查 | `npm run typecheck` |
| 全量单测 | `npm run test:unit` |
| 本地打包（只出 Linux AppImage） | `npm run build:electron` |
| Web 构建 | `npm run build` |

### 2.2 分层

- Electron 主进程 `electron/*.cjs`；前端 `src/`（Vite + React + Tailwind）；前后端共享逻辑 `shared/`；构建打包 `packaging/` 与 `build/`。
- 具体“改动归属”以 `src/README.md` 的「Where changes usually belong」为准，本文件不重复。
- 状态管理用 zustand，国际化用 i18next。跨文件找实现时先 `git ls-files` 验证路径，再 `rg -n` 搜确切 symbol，不要全文阅读大编排文件（如 `src/App.tsx`）。

### 2.3 文案与 locale（硬规则）

- 用户可见文案**一律进 locale，不写死中文**（注释、log、诊断报告内的数据字段名除外）。
- 双文件同步改：`src/i18n/locales/en.ts` 与 `src/i18n/locales/zh-CN.ts`，配置在 `src/i18n/config.ts`。只改一个文件视为未完成。
- 新增 key 沿用相邻模块的命名分区；删除功能时对应 key 一起删，不留死 key。

### 2.4 体积约束

- AppImage 体积是硬约束。新增依赖前先确认必要性：优先复用 `package.json` 已有包，检查是否有同功能包可用。
- 打包后看一眼产物：`ls -lh release/*.AppImage`。只出 Linux AppImage，Win / Mac / AUR 打包已移除，**不要加回来**。产物目录 `release/` 已被 `.gitignore` 忽略，不入库。

## 3. 合并上游

目标：吃进上游新架构，同时守住 BigOrange 的删除口径。

```bash
git fetch upstream
git merge upstream/main --no-commit
```

`--no-commit` 状态下先看清**全部**冲突再动手，不要边合边提交。

取舍三原则：

1. **成套收下**：登录重构这类新架构整体收下，不在中间劈开、不 cherry-pick 一半。
2. **删除保持**：BigOrange 已删的东西保持删除。已知清单：QQ 音源及后端、印尼语、已删文档。冲突时选删除 side；上游新增但依赖已删模块的文件（如 `qqBackend.cjs` 这类）一并摘掉，不要让它重新上线。
3. **测试跟删、文档重写**：上游重构删掉的函数，对应旧断言一起删，不保留失效测试；`locale`、`README`、设计文档里的行为描述按**合并后代码**重写——Folia 改名为 BigOrange 口径，去掉已移除功能（如 QQ）的描述。

合后自查（防止删除口径回潮）：

```bash
rg -n -i "qqBackend|qqmusic" --glob '!package-lock.json' electron/ src/ shared/ | head -20
rg -n "indones" src/i18n/ shared/ electron/ | head
```

验收：`npm run typecheck` 必跑；动了主进程、登录、播放核心时必跑 `npm run test:unit`，全绿才提交。提交前缀用 `merge`。

## 4. 发版

### 4.1 版本模型（两个真源 + 一个 tag）

`realeco-release`（单行 `A.B.C`）与 `package.json` 的 `version` 必须始终一致。
release tag 固定为 `vA.B.C`（跟随上游、**不加后缀**），便于和上游对齐比较。
日常版本号在上游版本后加 `-bigorange.N` 后缀，不直接递增上游位，避免与上游未来版本撞号。

| 状态 | `realeco-release` | `package.json version` | 提交标题 | tag |
| --- | --- | --- | --- | --- |
| 日常迭代 | `A.B.C-bigorange.N` | `A.B.C-bigorange.N` | `chore: 版本 A.B.C-bigorange.N`（N 递增不跳号） | 无 |
| 发版提交 | `A.B.C` | `A.B.C` | 精确 `release: vA.B.C` | `vA.B.C` |

强校验在 `shared/realecoReleaseMetadata.cjs:validateRealecoReleaseMetadata`：
提交标题 / `realeco-release` / `package.json` 三者必须一致，任一不符 workflow 直接失败。
注意 `realeco-release` 是单行版本、无多余空格；`chore: 版本 …` 的中文标题是本仓库特例，不要“纠正”成英文。

### 4.2 发版步骤

1. 两个文件写成纯 `A.B.C`，提交标题精确为 `release: vA.B.C`，push。
2. 发版 workflow 由 `realeco-release` 的路径变更触发（见 `electron-release.yml`），结果看云端；本地只负责 push 前跑通 §1.3。
3. 发版后**立即**用一次日常迭代提交把两个文件改回带后缀形式（`chore: 版本 A.B.C-bigorange.N`），供本地构建区分。
4. 发版后**立即**做 §5 的 Release 清理。

### 4.3 版本更新弹窗

`src/components/modal/newFeaturesRelease.ts` 的卡片只放**当前大版本**的变化：

- 发新大版本时换 `i18nKey`、换卡片、重写文案，不堆积历史旧卡片（旧文案保留在 locale 里即可）。
- 上游合并带来的卡片文案改成 BigOrange 口径：Folia 改名，去掉已移除功能（如 QQ）的描述。

### 4.4 GitHub Actions 保持关闭

- 为节省额度，`littleflit/BigOrange` 的 Actions 默认关闭，不随意开启；验证改动一律在本地跑（§1.3），不靠云端 workflow。
- 开启前必须知道：`realeco-release` 是发版 workflow 的路径触发条件，开启期间每次改动它都会触发一次构建。

## 5. Release 清理（发版后立即做）

保留策略：

- 只保留**最新 3 个正式版**（`vX.Y.Z` 形式）。
- `limo`（Limo Nightly）与 `cielo`（Cielo Canary）是滚动频道，tag 固定、每次覆盖重建，不占“3 个”名额。
- 其余 canary / nightly / rc 预发布一律删掉；本地 `release/` 下的旧 AppImage 同步删到只剩最新 3 个。

先 dry-run 预览，再删除。必须做**语义化排序**，不能按字符串排（否则 `v0.7.10` 会排到 `v0.7.9` 前面）：

```bash
# 0. 预览（不删除，只列出将要删除的）
gh release list --limit 500 --json tagName,isPrerelease

# 1. 删掉 3 个最新正式版之外的旧正式版
gh release list --limit 500 --json tagName,isPrerelease --jq '
  [.[] | select(.isPrerelease==false) | .tagName | select(test("^v[0-9]+\\.[0-9]+\\.[0-9]+$"))]
  | map(. as $t | ($t | sub("^v";"") | split(".") | map(tonumber)) as $v | {t: $t, v: $v})
  | sort_by(.v) | reverse | .[3:][] | .t' \
  | xargs -r -n1 gh release delete --yes --cleanup-tag

# 2. 删掉除 limo / cielo 之外的所有预发布
gh release list --limit 500 --json tagName,isPrerelease --jq '
  [.[] | select(.isPrerelease) | .tagName | select(. != "limo" and . != "cielo")][]' \
  | xargs -r -n1 gh release delete --yes --cleanup-tag
```

- 删 release 必须带 `--cleanup-tag`（历史教训：只删 tag 没删 release，曾堆到 154 个）。
- 验收：`gh release list` 里 `vX.Y.Z` 形式的 ≤ 3 个。

## 6. 提交信息

格式：`<prefix>[(scope)]: subject`，subject 中英文皆可，写清楚“做了什么”而不是“改了哪个文件”。

- 前缀：`fix` 修 bug、`feat` 新功能、`chore` 版本杂务、`docs` 文档、`refactor` 重构、`hotfix` 线上修复、`merge` 合并上游。发版专用 `release: vA.B.C`，日常版本专用 `chore: 版本 A.B.C-bigorange.N`。
- 好例子：`fix: 全应用默认关闭文本圈选`、`feat(library): TUI 接入变更动作`、`docs: 重写 AGENTS.md`、`merge: 合并上游 v0.7.16`。
- 坏例子：`update`、`fix bug`、空正文的大段粘贴、无前缀直接写句子。

## 7. 故障排查

| 现象 | 先查 |
| --- | --- |
| `typecheck` 失败 | 看首个报错文件，按 `tsc` 路径修，不要全库猜 |
| `test:unit` 挂 | 确认是否动了登录/播放/主进程的契约；上游重构后旧断言是否该跟删（§3 原则 3） |
| 发版 workflow 直接失败 | 三处版本是否一致（§4.1 表 + `realecoReleaseMetadata.cjs` 的正则）；提交标题是否精确 `release: vA.B.C`；`realeco-release` 是否单行无空格 |
| Release 越堆越多 | 是否漏了 `--cleanup-tag`；是否按语义化排序（§5） |
| push 被拒绝 | `git config user.email` 是否为 `littleflit@users.noreply.github.com` |
| AppImage 突然变大 | `package.json` 是否新增了重依赖；`electron-builder` 的 `files` 排除是否被改动 |
