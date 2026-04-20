import { describe, expect, it, beforeEach, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { getSettings, ingestLiveQuotes, listSignals, listWatchlist } from "./db";
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

  it("returns dashboard overview and triggers owner notification for high-score signals", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const overview = await caller.dashboard.overview();

    expect(overview.productName).toBe("Shawn Wang 量化盯盘系统");
    expect(overview.highScoreCount).toBeGreaterThan(0);
    expect(notifyOwnerMock).toHaveBeenCalled();
  });

  it("returns structured trading suggestions with required field names", async () => {
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
  });

  it("stores llm interpretation back to the signal after interpretation is requested", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.signals.interpretWithLlm({ signalId: 1 });

    expect(invokeLLMMock).toHaveBeenCalledTimes(1);
    expect(result.interpretation).toContain("LLM");
    expect(listSignals(1).find(signal => signal.id === 1)?.llmInterpretation).toContain("LLM");
  });

  it("filters alert history by market, signal type, date, and search query", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const today = new Date().toISOString().slice(0, 10);
    const filtered = await caller.alerts.list({
      market: "HK",
      signalType: "突破啟動",
      date: today,
      query: "09992",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      market: "HK",
      signalType: "突破啟動",
      symbol: "09992",
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
          name: "泡泡玛特",
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
