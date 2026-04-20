# Futu Signal Watch Architecture

**Shawn Wang 量化盯盘系统** 将采用 **DashboardLayout** 作为整体框架，构建一套面向美股与港股短线交易者的多页面仪表板系统。整体结构分为 **总览、观察名單、实时信号、告警历史、盘前扫描、盘后复盘、系统设置** 七个核心页面，并通过统一的 tRPC 数据层提供页面数据、筛选条件、设置保存、LLM 解读与通知触发能力。

## 产品信息架构

| 页面 | 核心内容 | 关键交互 |
| --- | --- | --- |
| 仪表板主页 | 观察名單摘要、市场状态、最新信号摘要、告警统计 | 查看重点标的与高评分机会 |
| 观察名單 | 标的增删、优先级、报价与成交概览 | 管理监控池 |
| 实时信号 | 四类信号流、评分、原因、风险标签、交易建议卡 | 发现当下机会 |
| 告警历史 | 历史告警列表、搜索、筛选 | 查询过去触发记录 |
| 盘前扫描 | 候选标的与筛选条件结果 | 挑选今日重点观察对象 |
| 盘后复盘 | 命中率、误报分析、最佳/最差信号 | 复盘信号质量 |
| 系统设置 | 阈值、灵敏度、告警偏好、通知阈值 | 控制策略行为 |

## 数据模型概览

| 实体 | 主要字段 |
| --- | --- |
| watchlist_items | market, symbol, name, priority, lastPrice, changePct, volume, active |
| signals | symbol, market, signalType, score, triggerReason, riskTags, direction, entryRange, stopLoss, rationale |
| alerts | signalId, market, signalType, level, notifyTriggered, createdAt |
| scans | market, symbol, volumeRatio, turnover, premarketChangePct, rankScore, scanDate |
| reviews | reviewDate, hitRate, falsePositiveAnalysis, bestSignal, worstSignal |
| settings | scanThresholds, sensitivity, alertPreference, watchlistLimit, highScoreNotifyThreshold |

## 交互与算法体验设计

首页与各子页面将统一采用“数学蓝图美学”，通过白色网格背景、淡青与柔粉线框几何元素、粗重黑色标题和等宽标签营造高精度研究环境。主要信息组件将采用卡片式布局，并在关键信号与建议卡中加强层级对比，使用户可以在极短时间内完成从 **发现信号 → 理解信号 → 查看建议 → 回查历史** 的完整决策链路。

## 后端能力设计

后端将通过 tRPC 提供以下能力：

| 能力 | 说明 |
| --- | --- |
| dashboard.getOverview | 返回首页汇总数据 |
| watchlist.list / add / remove / reprioritize | 维护观察名單 |
| signals.list | 返回实时信号与结构化建议 |
| alerts.list | 返回告警历史与筛选结果 |
| scans.list | 返回盘前扫描候选 |
| reviews.getLatest | 返回盘后复盘报告 |
| settings.get / save | 读取与保存系统设置 |
| signals.interpretWithLlm | 对高价值信号生成自然语言解读 |
| system.notifyOwner | 对达到阈值的高评分信号发送拥有者通知 |

## 实现策略

第一版将内置一组高质量模拟数据与规则函数，优先保证页面体验、数据链路、设置控制、LLM 解读与拥有者通知逻辑全部打通。因此当前版本中的观察名单报价、信号流、盘前扫描与复盘内容均属于 **Demo Data / Signal Research Workspace** 范围，用于验证交互与决策流程，而非直接连接真实富途行情。真实行情接入可以在后续版本通过外部数据源或富途数据桥接服务接入，而不影响当前网页产品架构。
