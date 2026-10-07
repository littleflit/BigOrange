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

## README 随项目自动同步

- 功能增删、改名、目录或流程变化后，顺手把 `README.md` 改到与现状一致。
- 不说废话，只写纯文字：直接陈述事实，不加表情、客套话和多余排版。

## Releases 只保留最新三个

- 发新版本后删除多余的旧 Release 和对应的 Tag，始终只留三个。
- 用 `gh release list` 确认，用 `gh release delete <tag> --yes` 删除。
- Release 内容只写软件运行方法，不写更新日志。
- 版本号在上游版本后加 `-bigorange.N` 后缀，不直接递增数字，避免与上游未来版本撞号。
