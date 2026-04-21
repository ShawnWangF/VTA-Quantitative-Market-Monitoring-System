import { describe, expect, it } from "vitest";
import { buildRuntimeSummaryEntries, getEmptyRealtimeStateCopy } from "./tradingRuntimeSummary";

describe("trading runtime summary helpers", () => {
  it("builds runtime summary entries from live prediction data", () => {
    const entries = buildRuntimeSummaryEntries(
      {
        llmForecastBias: "偏多",
        llmForecastSummary: "量价共振上行，等待买入触发。",
        suggestionAction: "买入提醒",
        executionPrerequisite: "站上触发位并保持成交量放大。",
        forecastSummary: {
          trendBias: "偏多",
          predictedPrice: 128.66,
          predictedChangePct: 1.82,
        },
        strategyLearning: {
          adaptiveWeight: 0.94,
          rewardScore: 3.2,
        },
      },
      {
        connectionStatus: "已连接",
        lastQuoteAt: 1710000000000,
      },
      value => value.toFixed(2),
      value => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`,
      value => (typeof value === "number" ? `T${value}` : "--")
    );

    expect(entries).toEqual([
      "LLM 偏多 · 量价共振上行，等待买入触发。",
      "执行 买入提醒 · 站上触发位并保持成交量放大。",
      "预测 128.66 · +1.82%",
      "强化反馈 0.94x · 奖励 3.2",
      "桥接 已连接 · 最近更新 T1710000000000",
    ]);
  });

  it("returns waiting-state copy when realtime bridge has not provided quotes yet", () => {
    const emptyState = getEmptyRealtimeStateCopy();

    expect(emptyState.title).toBe("暂无真实数据");
    expect(emptyState.description).toContain("不会回退显示演示股票或演示价格");
    expect(emptyState.runtimeSummary).toEqual([
      "LLM 等待新的有效预测",
      "执行 等待桥接与新信号",
      "预测 --",
      "强化反馈 等待实时回测",
      "桥接 未连接",
    ]);
  });
});
