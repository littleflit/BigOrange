# BigOrange 工作规范

协作者与 AI agent 的行为准则。`CLAUDE.md` 只负责把读者引导到这里，规则不重复维护。
BigOrange 是 `chthollyphile/folia-major` 的 fork，有自己的删改口径，凡与上游冲突以本文件为准。

## 动工前

- 本地与 `origin`（littleflit/BigOrange）保持一致，不长期滞后或超前。
- 先 `git fetch origin && git status`，有更新先 `git pull --rebase`。
- `upstream`（chthollyphile/folia-major）只用于同步上游，**不直接推送**。
- Node 版本按 `.nvmrc`，先切好再动手。

## 动手时

### 提交

- 一个完整改动对应一次 `commit + push`，不在本地堆积未推送提交。
- 推送前 `git status` 干净，确认改的是预期文件。
- 信息前缀：`fix` 修 bug、`feat` 新功能、`chore` 版本杂务、`docs` 文档、`refactor` 重构、`hotfix` 线上修复、`merge` 合并上游。
- 提交邮箱固定 `littleflit@users.noreply.github.com`——账号开了阻止暴露邮箱，真实邮箱推不上去。

### 验证

- 改完一律 `npm run typecheck`（`tsc --noEmit`，全库唯一类型检查入口）。
- 动了主进程（`electron/`）、登录、播放核心时，加跑全量单测 `npm run test:unit`（vitest），全绿才提交。
- 仓库没有 lint script，不要自行引入额外检查步骤。

### 代码约定

- 分层：Electron 主进程 `electron/*.cjs`，前端 `src/`（Vite + React + Tailwind），前后端共享逻辑 `shared/`，构建打包脚本 `packaging/` 与 `build/`。
- 状态管理 zustand，国际化 i18next，**文案一律进 locale，不写死中文**。
- AppImage 体积是硬约束，新增依赖前先确认必要性。

## 合并上游

- 先 `git fetch upstream`，用 `git merge upstream/main --no-commit` 试合，看清全部冲突再动手。
- 上游新架构优先取：登录重构这类成套改动整体收下，不在中间劈开。
- BigOrange 删掉的东西保持删除：QQ 音源及后端、印尼语、已删文档，冲突时选删除 side；上游新增但依赖已删模块的文件（如 `qqBackend.cjs`）一并摘掉。
- 旧 API 的测试跟随删除：上游重构删掉的函数，对应旧断言一起删，不保留失效测试。
- 文档按合并后代码重写：locale、README、设计文档里的行为描述以合完的代码为准，Folia 改名，上游专属功能描述去掉。
- 合并后必跑 `npm run typecheck`；动了主进程、登录、播放核心时必跑 `npm run test:unit`，全绿才提交。

## GitHub Actions 保持关闭

- 为节省额度，`littleflit/BigOrange` 的 Actions 默认关闭，不随意开启。
- 验证改动一律在本地跑，不靠云端 workflow。
- 开启前想清楚后果：`realeco-release` 是发版 workflow 的路径触发条件，开启期间每次改动它都会触发一次构建。

## 发版

### 版本号的两个真源

`realeco-release` 与 `package.json` 的 version，二者必须始终一致。

- **发版提交**：两个文件都写成纯 `A.B.C`，提交标题精确为 `release: vA.B.C`。
  `shared/realecoReleaseMetadata.cjs` 会强校验「提交标题 / realeco-release / package.json」三者一致，任一不符直接让 workflow 失败。
- **发版后的日常迭代**：用 `chore: 版本 A.B.C-bigorange.N` 把两个文件改成带后缀形式，供本地构建区分，N 递增不跳号。
- release tag 固定为 `vA.B.C`，跟随上游版本号、**不加后缀**，这样才好和上游的版本号对齐比较。
- 版本号在上游版本后加 `-bigorange.N` 后缀，不直接递增上游位，避免与上游未来版本撞号。

### 构建产物

- 本地打包只出 Linux AppImage：`npm run build:electron`。
- Win / Mac / AUR 打包已移除，不要再加回来。
- 产物落在 `release/`，该目录已被 `.gitignore` 忽略，不入库。

### 版本更新弹窗只写当前大版本

- `src/components/modal/newFeaturesRelease.ts` 的卡片只放当前大版本的变化，旧版卡片下掉，文案保留在 locale 里。
- 发新大版本时换 `i18nKey`、换卡片、重写文案，不堆积历史。
- 上游合并带来的卡片文案要改成 BigOrange 口径：Folia 改名，去掉已移除功能（如 QQ）的描述。

### Release 清理（发版后立即做）

- 只保留**最新 3 个正式版**，即 `vX.Y.Z` 形式的 release。
- `limo`（Limo Nightly）与 `cielo`（Cielo Canary）是滚动频道，tag 固定、每次覆盖重建，不占「3 个」名额。
- 其余 canary / nightly / rc 预发布一律删掉，不保留历史。
- 本地 `release/` 下的旧 AppImage 同步删到只剩最新 3 个，省磁盘。

清理命令。注意必须做语义化排序，不能按字符串排——`v0.7.10` 会被排到 `v0.7.9` 前面：

```bash
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

- 历史教训：曾经只删了 tag 没删 release，一路堆到 154 个。删 release 一定要带 `--cleanup-tag`，两步一起清。
- 验收标准：`gh release list` 里 `vX.Y.Z` 形式的 ≤ 3 个。
