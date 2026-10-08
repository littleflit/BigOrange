# 工作规范

## 本地与 GitHub 时刻同步

- 本地 `BigOrange` 与 `origin`（littleflit/BigOrange）保持一致，不长期滞后或超前。
- 动工前先同步：`git fetch + git status`，有更新先 `pull --rebase`。
- 完工即提交推送：一个完整改动对应一次 `commit + push`，不在本地堆积未推送提交。
- 推送前检查 `git status` 干净，确认改的是预期文件。
- `upstream` 只用于同步上游，不直接推送。
- 提交信息用前缀：`fix` 修 bug、`feat` 新功能、`chore` 版本杂务、`docs` 文档、`merge` 合并上游。

## 合并上游

- 先 `git fetch upstream`，用 `git merge upstream/main --no-commit` 试合，看清全部冲突再动手。
- 上游新架构优先取：登录重构这类成套改动整体收下，不在中间劈开。
- BigOrange 删掉的东西保持删除：QQ 音源及后端、印尼语、已删文档，冲突时选删除 side；上游新增但依赖已删模块的文件（如 `qqBackend.cjs`）一并摘掉。
- 旧 API 的测试跟随删除：上游重构删掉的函数，对应旧断言一起删，不保留失效测试。
- 文档按合并后代码重写：locale、README、设计文档里的行为描述以合完的代码为准，Folia 改名，上游专属功能描述去掉。
- 合并后必跑 `npm run typecheck`；动了主进程、登录、播放核心时必跑全量单测（`npm run test:unit`），全绿才提交。

## GitHub Actions 保持关闭

- 为节省额度，`littleflit/BigOrange` 的 Actions 默认关闭，不随意开启。
- 需要验证改动时在本地跑（`npm run typecheck` / 单测），不靠云端 workflow。

## Releases 只保留最新三个

- 发新版本后删除多余的旧 Release 和对应的 Tag，始终只留三个。
- 本地 `release/` 下的旧 AppImage 同步删除，只留三个，省磁盘。
- 用 `gh release list` 确认，用 `gh release delete <tag> --yes` 删除。
- Release 内容只写软件运行方法，不写更新日志。
- 版本号在上游版本后加 `-bigorange.N` 后缀，不直接递增数字，避免与上游未来版本撞号。

## 版本更新弹窗只写当前大版本

- `newFeaturesRelease.ts` 的卡片只放当前大版本的变化，旧版卡片下掉，文案保留在 locale 里。
- 发新大版本时换 `i18nKey`、换卡片、重写文案，不堆积历史。
- 上游合并带来的卡片文案要改成 BigOrange 口径：Folia 改名，去掉已移除功能（如 QQ）的描述。

## 提交邮箱用 noreply

- 本地 `user.email` 用 `littleflit@users.noreply.github.com`，账号开了阻止暴露邮箱的推送后真实邮箱推不上去。
