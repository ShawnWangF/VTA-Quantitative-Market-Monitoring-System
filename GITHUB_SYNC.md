# GitHub 同步说明

当前项目已连接到 GitHub 仓库 `ShawnWangF/VTA-Quantitative-Market-Monitoring-System`，但由于该仓库的 `main` 分支已有独立历史，与当前项目的本地历史并不兼容，因此**不会直接覆盖 `main`**。

## 当前同步落点

系统已将当前实现安全推送到以下分支：

| 项目 | 值 |
| --- | --- |
| GitHub 仓库 | `ShawnWangF/VTA-Quantitative-Market-Monitoring-System` |
| 安全同步分支 | `manus/futu-signal-watch-sync` |
| Pull Request 链接 | `https://github.com/ShawnWangF/VTA-Quantitative-Market-Monitoring-System/pull/new/manus/futu-signal-watch-sync` |

这意味着当前代码已经进入你的 GitHub 仓库，但以**独立同步分支**的方式存在，便于你先审阅，再决定是否合并到 `main`。

## 自动同步策略

当前已启动一个周期性同步任务。该任务会定期检查 `/home/ubuntu/futu-signal-watch-web` 的 Git 工作区，并按以下顺序执行：

| 步骤 | 行为 |
| --- | --- |
| 1 | 检查是否存在新的已跟踪改动 |
| 2 | 若有改动，先运行 `pnpm test` |
| 3 | 仅在测试通过后提交改动 |
| 4 | 将最新代码推送到 `manus/futu-signal-watch-sync` 分支 |

## 能力边界

该同步机制是**安全分支持续同步**，而不是直接改写 `main`。因此需要明确以下边界：

| 场景 | 当前处理方式 |
| --- | --- |
| 远端 `main` 有独立历史 | 不覆盖，改为推送到安全分支 |
| 测试失败 | 不提交、不推送 |
| 远端冲突 | 不强推，保留给人工处理 |
| 合并到 `main` | 需要你在 GitHub 上发起或确认 Pull Request 合并 |

## 推荐操作

如果你希望把这套实现正式并入仓库主线，推荐直接打开上面的 Pull Request 链接，检查差异后再决定是否合并到 `main`。
