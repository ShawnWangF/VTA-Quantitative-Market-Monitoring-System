import { describe, expect, it, beforeEach, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { createAlertFromSignal, getSettings, ingestLiveQuotes, listAlerts, listScopedSignals, listSignals, listWatchlist, summarizeDashboard } from "./db";
import { resetWorkspace } from "./mockData";

const notifyOwnerMock = vi.fn(async () => true);
const invokeLLMMock = vi.fn(async () => ({
  id: "mock-response",
  created: Date.now(),
  model: "mock-model",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "这是一条由 LLM 生成的交易建议说明，包含入场逻辑、风险提示与注意事项。",
      },
      finish_reason: "stop",
    },
  ],
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: notifyOwnerMock,
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: invokeLLMMock,
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "shawn-owner",
    email: "shawn@example.com",
    name: "Shawn Wang",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
}

function liveBridgeInput(overrides?: Partial<{
  opendHost: string;
  opendPort: number;
  trackedSymbols: string[];
  bridgeToken: string;
  publishIntervalSeconds: number;
  useLiveQuotes: boolean;
}>) {
  return {
    opendHost: "127.0.0.1",
    opendPort: 11111,
    trackedSymbols: ["03690", "09992"],
    bridgeToken: "bridge-token-2026",
    publishIntervalSeconds: 3,
    useLiveQuotes: true,
    ...overrides,
  };
}

describe("trading signal monitoring system", () => {
  beforeEach(() => {
    resetWorkspace(1);
    notifyOwnerMock.mockClear();
    invokeLLMMock.mockClear();
  });

  it("starts from an empty real-data workspace instead of seeded demo symbols", () => {
    const overview = summarizeDashboard(1);
    const settings = getSettings(1);

    expect(listWatchlist(1)).toHaveLength(0);
    expect(listSignals(1)).toHaveLength(0);
    expect(listAlerts(1)).toHaveLength(0);
    expect(overview.liveBoard).toEqual([]);
    expect(overview.latestSignals).toEqual([]);
    expect(settings.liveBridge.trackedSymbols).toEqual(["03690", "09992"]);
    expect(settings.liveBridge.useLiveQuotes).toBe(true);
  });

  it("keeps dashboard and related pages in real-data empty state before bridge quotes arrive", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const [overview, signals, alerts, scans, review, settings] = await Promise.all([
      caller.dashboard.overview(),
      caller.signals.list(),
      caller.alerts.list(),
      caller.scans.list(),
      caller.review.latest(),
      caller.settings.get(),
    ]);

    expect(overview.liveBridge.connectionStatus).toBe("未连接");
    expect(overview.liveBridge.sourceState).toBe("awaiting_bridge");
    expect(overview.liveBridge.sourceLabel).toBe("Real Data Required · Awaiting Bridge");
    expect(overview.liveBridge.sourceDetail).toContain("不会回退到示例数据");
    expect(overview.liveBoard).toEqual([]);
    expect(overview.latestSignals).toEqual([]);
    expect(signals).toEqual([]);
    expect(alerts).toEqual([]);
    expect(scans).toEqual([]);
    expect(review).toMatchObject({
      hitRate: 0,
      bestSignal: "暂无真实样本",
      worstSignal: "暂无真实样本",
    });
    expect(review?.falsePositiveAnalysis).toContain("尚未接入真实桥接行情");
    expect(settings.liveBridge.trackedSymbols).toEqual(["03690", "09992"]);
    expect(settings.liveBridge.useLiveQuotes).toBe(true);
  });

  it("only notifies the owner when price precisely hits the trigger price and avoids repeated sends while staying on the same point", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["03690", "09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 37.12,
          volume: 12880000,
          turnover: 428000000,
          openPrice: 35.98,
          highPrice: 37.2,
          lowPrice: 35.9,
          prevClosePrice: 35.8,
        },
      ],
    });

    const firstOverview = await caller.dashboard.overview();
    expect(firstOverview.productName).toBe("Shawn Wang 量化盯盘系统");
    expect(firstOverview.highScoreCount).toBeGreaterThan(0);
    expect(notifyOwnerMock).not.toHaveBeenCalled();

    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["03690", "09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 37.2,
          volume: 13020000,
          turnover: 431000000,
          openPrice: 35.98,
          highPrice: 37.2,
          lowPrice: 35.9,
          prevClosePrice: 35.8,
        },
      ],
    });

    const secondOverview = await caller.dashboard.overview();
    const exactHitAlert = listAlerts(1).find(alert => alert.symbol === "09992" && alert.triggerPrice === 37.2);
    expect(secondOverview.highScoreCount).toBeGreaterThan(0);
    expect(exactHitAlert).toMatchObject({
      triggerAction: "买入提醒",
      triggerPrice: 37.2,
    });
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);

    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["03690", "09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 37.2,
          volume: 13110000,
          turnover: 432000000,
          openPrice: 35.98,
          highPrice: 37.2,
          lowPrice: 35.9,
          prevClosePrice: 35.8,
        },
      ],
    });

    await caller.dashboard.overview();
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);

    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["03690", "09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 37.35,
          volume: 13360000,
          turnover: 438000000,
          openPrice: 35.98,
          highPrice: 37.35,
          lowPrice: 36.1,
          prevClosePrice: 35.8,
        },
      ],
    });

    await caller.dashboard.overview();
    expect(listAlerts(1).find(alert => alert.symbol === "09992" && alert.triggerPrice === 37.35)).toMatchObject({
      triggerAction: "买入提醒",
      triggerPrice: 37.35,
    });
    expect(notifyOwnerMock).toHaveBeenCalledTimes(2);
  });

  it("returns structured trading suggestions with required field names", async () => {
    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["03690", "09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "03690",
          name: "美团-W",
          lastPrice: 121.2,
          volume: 19800000,
          turnover: 2520000000,
          openPrice: 118.8,
          highPrice: 121.5,
          lowPrice: 118.1,
          prevClosePrice: 117.1,
        },
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 37.12,
          volume: 12880000,
          turnover: 428000000,
          openPrice: 35.98,
          highPrice: 37.2,
          lowPrice: 35.9,
          prevClosePrice: 35.8,
        },
      ],
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const signals = await caller.signals.list();
    const first = signals[0];

    expect(first?.suggestion).toMatchObject({
      方向: expect.any(String),
      触发动作: expect.any(String),
      触发价位: expect.any(Number),
      止损价位: expect.any(Number),
      失效条件: expect.any(String),
      理由说明: expect.any(String),
    });
    expect(signals.find(signal => signal.symbol === "03690")).toMatchObject({
      name: "美团-W",
      securityLabel: "03690 · 美团-W",
      identityKey: "HK:03690",
    });
    expect(signals.find(signal => signal.symbol === "09992")).toMatchObject({
      name: "泡泡马特",
      securityLabel: "09992 · 泡泡马特",
      identityKey: "HK:09992",
    });
  });

  it("stores llm interpretation back to the signal after interpretation is requested", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 38.5,
          volume: 13200000,
          turnover: 488000000,
          openPrice: 36.7,
          highPrice: 38.7,
          lowPrice: 36.5,
          prevClosePrice: 36.1,
        },
      ],
    });
    const targetSignal = listSignals(1)[0];
    expect(targetSignal).toBeDefined();

    const result = await caller.signals.interpretWithLlm({ signalId: targetSignal!.id });

    expect(invokeLLMMock).toHaveBeenCalledTimes(1);
    expect(result.interpretation).toContain("LLM");
    expect(listSignals(1).find(signal => signal.id === targetSignal!.id)?.llmInterpretation).toContain("LLM");
  });

  it("filters alert history by market, signal type, date, and search query", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 37.12,
          volume: 12880000,
          turnover: 428000000,
          openPrice: 35.98,
          highPrice: 37.2,
          lowPrice: 35.9,
          prevClosePrice: 35.8,
        },
      ],
    });
    await caller.dashboard.overview();
    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 37.2,
          volume: 12880000,
          turnover: 428000000,
          openPrice: 35.98,
          highPrice: 37.25,
          lowPrice: 35.9,
          prevClosePrice: 35.8,
        },
      ],
    });
    await caller.dashboard.overview();

    const sourceSignal = listSignals(1)[0];
    expect(sourceSignal).toBeDefined();
    const generatedAlert = createAlertFromSignal(1, sourceSignal!, "CRITICAL", "测试告警", "用于验证筛选逻辑的真实告警样本");

    const filtered = await caller.alerts.list({
      market: generatedAlert.market,
      signalType: generatedAlert.signalType,
      date: new Date(generatedAlert.createdAtMs).toISOString().slice(0, 10),
      query: generatedAlert.symbol,
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      market: generatedAlert.market,
      signalType: generatedAlert.signalType,
      symbol: generatedAlert.symbol,
      title: "测试告警",
    });
  });

  it("enforces watchlist limit from settings and allows adding after increasing the limit", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    await caller.settings.save({
      scanThresholds: {
        minVolumeRatio: 2.2,
        minTurnover: 120000000,
        minPremarketChangePct: 2.8,
      },
      signalSensitivity: "标准",
      alertLevelPreference: "WARNING",
      watchlistLimit: 2,
      highScoreNotifyThreshold: 88,
      liveBridge: liveBridgeInput(),
    });

    await caller.watchlist.add({
      market: "HK",
      symbol: "00700",
      name: "腾讯控股",
      priority: 5,
    });
    await caller.watchlist.add({
      market: "US",
      symbol: "AAPL",
      name: "Apple Inc.",
      priority: 4,
    });

    await expect(
      caller.watchlist.add({
        market: "US",
        symbol: "META",
        name: "Meta Platforms",
        priority: 4,
      })
    ).rejects.toThrow("已达到观察名单上限");

    await caller.settings.save({
      scanThresholds: {
        minVolumeRatio: 2.8,
        minTurnover: 150000000,
        minPremarketChangePct: 3.1,
      },
      signalSensitivity: "激进",
      alertLevelPreference: "CRITICAL",
      watchlistLimit: 6,
      highScoreNotifyThreshold: 90,
      liveBridge: liveBridgeInput({ trackedSymbols: ["03690", "09992", "00700"] }),
    });

    const created = await caller.watchlist.add({
      market: "US",
      symbol: "META",
      name: "Meta Platforms",
      priority: 4,
    });

    expect(created.symbol).toBe("META");
    expect(created.priority).toBe(4);
  });

  it("saves local futu bridge settings for hong kong realtime monitoring", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const updated = await caller.settings.save({
      scanThresholds: {
        minVolumeRatio: 2.4,
        minTurnover: 98000000,
        minPremarketChangePct: 1.8,
      },
      signalSensitivity: "标准",
      alertLevelPreference: "WARNING",
      watchlistLimit: 30,
      highScoreNotifyThreshold: 86,
      liveBridge: liveBridgeInput({
        opendHost: "127.0.0.1",
        opendPort: 11111,
        trackedSymbols: ["03690", "09992"],
        bridgeToken: "hongkong-live-bridge-token",
        publishIntervalSeconds: 5,
        useLiveQuotes: true,
      }),
    });

    expect(updated.liveBridge.opendHost).toBe("127.0.0.1");
    expect(updated.liveBridge.opendPort).toBe(11111);
    expect(updated.liveBridge.trackedSymbols).toEqual(["03690", "09992"]);
    expect(updated.liveBridge.bridgeToken).toBe("hongkong-live-bridge-token");
    expect(updated.liveBridge.publishIntervalSeconds).toBe(5);
    expect(updated.liveBridge.useLiveQuotes).toBe(true);
  });

  it("ingests live hk quotes from local bridge and updates watchlist plus signals", async () => {
    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["03690", "09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "03690",
          name: "美团-W",
          lastPrice: 120.6,
          volume: 22100000,
          turnover: 2650000000,
          openPrice: 118.3,
          highPrice: 120.9,
          lowPrice: 117.9,
          prevClosePrice: 117.1,
        },
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 38.5,
          volume: 13200000,
          turnover: 488000000,
          openPrice: 36.7,
          highPrice: 38.7,
          lowPrice: 36.5,
          prevClosePrice: 36.1,
        },
      ],
    });

    const settings = getSettings(1);
    const watchlist = listWatchlist(1);
    const signals = listSignals(1);

    expect(settings.liveBridge.connectionStatus).toBe("已连接");
    expect(settings.liveBridge.lastQuoteAt).not.toBeNull();
    expect(watchlist.find(item => item.symbol === "03690")?.sourceMode).toBe("live");
    expect(watchlist.find(item => item.symbol === "09992")?.sourceMode).toBe("live");
    expect(signals.some(signal => signal.sourceMode === "live" && signal.market === "HK")).toBe(true);
  });

  it("returns scoped display signals for tracked symbols and prefers live signals over demo duplicates", async () => {
    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["03690", "09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 38.8,
          volume: 13800000,
          turnover: 512000000,
          openPrice: 36.9,
          highPrice: 39.0,
          lowPrice: 36.8,
          prevClosePrice: 36.1,
        },
      ],
    });

    const displaySignals = listScopedSignals(1);
    const symbolList = displaySignals.map(signal => signal.symbol);

    expect(new Set(symbolList).size).toBe(displaySignals.length);
    expect(symbolList.every(symbol => ["03690", "09992"].includes(symbol))).toBe(true);
    expect(displaySignals.find(signal => signal.symbol === "09992")?.sourceMode).toBe("live");
  });

  it("builds dashboard forecast panels with chart data and strategy learning summaries", () => {
    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["03690", "09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "03690",
          name: "美团-W",
          lastPrice: 121.2,
          volume: 19800000,
          turnover: 2520000000,
          openPrice: 118.8,
          highPrice: 121.5,
          lowPrice: 118.1,
          prevClosePrice: 117.1,
        },
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 38.9,
          volume: 14600000,
          turnover: 538000000,
          openPrice: 36.9,
          highPrice: 39.1,
          lowPrice: 36.8,
          prevClosePrice: 36.1,
        },
      ],
    });

    const overview = summarizeDashboard(1);
    expect(overview.liveBoard.length).toBeGreaterThan(0);
    expect(overview.latestSignals[0]).toMatchObject({
      symbol: expect.any(String),
      name: expect.any(String),
      securityLabel: expect.stringMatching(/^[0-9A-Z.\-]+\s·\s.+$/),
      identityKey: expect.stringMatching(/^(HK|US):/),
    });
    expect(overview.liveBoard[0]?.chart.length).toBeGreaterThanOrEqual(7);
    expect(overview.liveBoard[0]?.forecastSummary).toMatchObject({
      trendBias: expect.any(String),
      predictedPrice: expect.any(Number),
      confidence: expect.any(Number),
    });
    expect(overview.liveBoard[0]).toMatchObject({
      symbol: expect.any(String),
      name: expect.any(String),
      securityLabel: expect.stringMatching(/^[0-9A-Z.\-]+\s·\s.+$/),
      identityKey: expect.stringMatching(/^(HK|US):/),
      executionPrerequisite: expect.any(String),
      riskLevel: expect.any(String),
      llmForecastSummary: expect.any(String),
      latestMarker: {
        label: expect.any(String),
        price: expect.any(Number),
      },
    });
    expect(overview.latestSignals.find(signal => signal.symbol === "03690")).toMatchObject({
      name: "美团-W",
      securityLabel: "03690 · 美团-W",
      identityKey: "HK:03690",
    });
    expect(overview.liveBridge.sourceState).toBe("live_bridge");
    expect(overview.liveBridge.sourceLabel).toBe("Live Futu Feed · Local OpenD Bridge");
    expect(overview.liveBridge.sourceDetail).toContain("实时行情");
    expect(overview.liveBoard.find(item => item.symbol === "09992")).toMatchObject({
      name: "泡泡马特",
      securityLabel: "09992 · 泡泡马特",
      identityKey: "HK:09992",
    });
    expect(overview.liveBoard.find(item => item.symbol === "03690")).toMatchObject({
      name: "美团-W",
      securityLabel: "03690 · 美团-W",
      identityKey: "HK:03690",
    });
    expect(overview.strategyLearning).toMatchObject({
      successRate: expect.any(Number),
      rewardScore: expect.any(Number),
      sharpeLikeScore: expect.any(Number),
      adaptiveWeight: expect.any(Number),
    });
    expect(overview.liveBoard[0]?.strategyLearning).toMatchObject({
      rewardScore: expect.any(Number),
      sharpeLikeScore: expect.any(Number),
    });
    expect(overview.liveBoard[0]?.simulationSummary).toMatchObject({
      averageRewardScore: expect.any(Number),
    });
  });

  it("returns strategy simulated trades with pnl, drawdown, holding time, and explanation fields", async () => {
    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["03690", "09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "09992",
          name: "泡泡马特",
          lastPrice: 38.9,
          volume: 14600000,
          turnover: 538000000,
          openPrice: 36.9,
          highPrice: 39.1,
          lowPrice: 36.8,
          prevClosePrice: 36.1,
        },
      ],
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());
    const trades = await caller.strategy.simulatedTrades({ market: "HK", symbol: "09992" });

    expect(trades.length).toBeGreaterThan(0);
    expect(trades[0]).toMatchObject({
      symbol: "09992",
      securityLabel: "09992 · 泡泡马特",
      action: expect.stringMatching(/BUY|SELL/),
      entryPrice: expect.any(Number),
      simulatedExitPrice: expect.any(Number),
      realizedPnlPct: expect.any(Number),
      maxDrawdownPct: expect.any(Number),
      holdingMinutes: expect.any(Number),
      rewardScore: expect.any(Number),
      explanation: expect.any(String),
    });
  });

  it("suppresses stale trigger levels when latest price has moved far away from old buy signals", () => {
    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["03690", "09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "03690",
          name: "美团-W",
          lastPrice: 85.2,
          volume: 26400000,
          turnover: 2210000000,
          openPrice: 86.4,
          highPrice: 86.8,
          lowPrice: 84.9,
          prevClosePrice: 87.3,
        },
      ],
    });

    const overview = summarizeDashboard(1);
    const meituanBoard = overview.liveBoard.find(item => item.symbol === "03690");
    const meituanSignal = overview.latestSignals.find(signal => signal.symbol === "03690");
    expect(meituanBoard?.lastPrice).toBe(85.2);
    expect(meituanBoard?.suggestionTriggerPrice).toBeNull();
    expect(meituanSignal).toBeUndefined();
    expect(meituanBoard?.executionPrerequisite).toBeTruthy();
    expect(meituanBoard?.securityLabel).toBe("03690 · 美团-W");
  });

  it("tests bridge connectivity using recent heartbeat and quote status", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const beforeIngest = await caller.settings.testBridgeConnection();
    expect(beforeIngest.reachable).toBe(false);
    expect(beforeIngest.details.recentHeartbeat).toBe(false);

    ingestLiveQuotes(1, {
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: ["03690", "09992"],
      publishIntervalSeconds: 3,
      quotes: [
        {
          market: "HK",
          symbol: "03690",
          name: "美团-W",
          lastPrice: 121.2,
          volume: 19800000,
          turnover: 2520000000,
          openPrice: 118.8,
          highPrice: 121.5,
          lowPrice: 118.1,
          prevClosePrice: 117.1,
        },
      ],
    });

    const afterIngest = await caller.settings.testBridgeConnection();
    expect(afterIngest.reachable).toBe(true);
    expect(afterIngest.connectionStatus).toBe("已连接");
    expect(afterIngest.details.recentHeartbeat).toBe(true);
    expect(afterIngest.details.recentQuote).toBe(true);
    expect(afterIngest.summary).toContain("桥接已联通");
  });
});
