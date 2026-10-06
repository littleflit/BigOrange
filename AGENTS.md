# 工作规范

## 本地与 GitHub 时刻同步

- 本地 `BigOrange` 与 `origin`（littleflit/BigOrange）保持一致，不长期滞后或超前。
- 动工前先同步：`git fetch + git status`，有更新先 `pull --rebase`。
- 完工即提交推送：一个完整改动对应一次 `commit + push`，不在本地堆积未推送提交。
- 推送前检查 `git status` 干净，确认改的是预期文件。
- `upstream` 只用于同步上游，不直接推送。

## GitHub Actions 保持关闭

- 为节省额度，`littleflit/BigOrange` 的 Actions 默认关闭，不随意开启。
- 需要验证改动时在本地跑（`npm run typecheck` / 单测），不靠云端 workflow。
