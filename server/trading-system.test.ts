import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { listSignals } from "./db";
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
      参考入场区间: expect.any(String),
      止损参考: expect.any(String),
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

    const filtered = await caller.alerts.list({
      market: "US",
      signalType: "突破啟動",
      date: "2026-04-20",
      query: "NVDA",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      market: "US",
      signalType: "突破啟動",
      symbol: "NVDA",
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
      watchlistLimit: 4,
      highScoreNotifyThreshold: 88,
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
});
