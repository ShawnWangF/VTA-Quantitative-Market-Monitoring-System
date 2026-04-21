import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  type AlertLevel,
  type AlertRecord,
  type Direction,
  getWorkspace,
  type Market,
  type QuoteSourceMode,
  type ReviewRecord,
  type ScanRecord,
  type SettingsRecord,
  type PriceHistoryPoint,
  type SignalRecord,
  type SignalSensitivity,
  type SignalType,
  type TradingWorkspace,
  type TriggerAction,
  type WatchlistRecord,
} from "./mockData";

let _db: ReturnType<typeof drizzle> | null = null;

const PRODUCT_NAME = "Shawn Wang 量化盯盘系统";
const LIVE_STALE_MS = 20_000;
const SIGNAL_COOLDOWN_MS = 15 * 60 * 1000;
const PRICE_HISTORY_LIMIT = 90;
const FORECAST_POINT_COUNT = 6;
const MAX_ACTIONABLE_DEVIATION_PCT = 6;
const TRIGGER_HIT_TOLERANCE_BY_MARKET: Record<Market, number> = {
  HK: 0.02,
  US: 0.01,
};

type LiveQuoteInput = {
  market: Market;
  symbol: string;
  name?: string;
  lastPrice: number;
  volume: number;
  turnover: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  prevClosePrice: number;
};

type SignalBlueprint = {
  signalType: SignalType;
  score: number;
  direction: Direction;
  triggerAction: TriggerAction;
  triggerPrice: number;
  stopLossPrice: number | null;
  invalidationCondition: string;
  triggerReason: string;
  riskTags: string[];
  riskLevel: "低" | "中" | "高";
  executionPrerequisite: string;
  entryRange: string;
  stopLoss: string;
  rationale: string;
};

type SimulatedTradeRecord = {
  signalId: number;
  market: Market;
  symbol: string;
  name: string;
  securityLabel: string;
  identityKey: string;
  signalType: SignalType;
  action: "BUY" | "SELL";
  direction: Direction;
  entryTimeLabel: string;
  entryTimestampMs: number;
  exitTimeLabel: string;
  exitTimestampMs: number;
  holdingMinutes: number;
  entryPrice: number;
  currentPrice: number;
  simulatedExitPrice: number;
  realizedPnlPct: number;
  unrealizedPnlPct: number;
  maxDrawdownPct: number;
  statusLabel: "持仓中" | "已兑现" | "已失效";
  riskLevel: "低" | "中" | "高";
  failureReason: string | null;
  invalidationReason: string | null;
  rationale: string;
  reviewedAtMs: number | null;
  markerLabel: string;
  markerPrice: number;
  markerTone: "buy" | "sell";
  rewardScore: number;
  explanation: string;
  reasoning: SignalReasoningBreakdown;
  parameterFeedback: AdaptiveParameterFeedback;
};

type SignalStrategyFrame = {
  market: Market;
  symbol: string;
  name: string;
  vtaAnnotations: string[];
  structureSummary: string;
  eventContextSummary: string;
  reinforcementSummary: string;
  eventScore: number;
  sharpeLikeScore: number;
  rewardScore: number;
  adaptiveWeight: number;
};

type SignalReasoningBreakdown = {
  macroFactor: string;
  eventFactor: string;
  priceActionFactor: string;
  reinforcementFactor: string;
  weightContribution: {
    macro: number;
    event: number;
    priceAction: number;
    reinforcement: number;
  };
};

type AdaptiveParameterFeedback = {
  llmBiasShift: number;
  eventWeight: number;
  triggerThresholdShiftPct: number;
  stopLossBufferPct: number;
};

type LiveBridgeIngestInput = {
  bridgeToken?: string;
  opendHost: string;
  opendPort: number;
  trackedSymbols?: string[];
  publishIntervalSeconds?: number;
  bridgeTimestampMs?: number;
  error?: string | null;
  quotes: LiveQuoteInput[];
};

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSymbol(market: Market, raw: string) {
  if (market === "HK") {
    const cleaned = raw.replace(/^HK\./i, "").replace(/[^0-9]/g, "");
    return cleaned.padStart(5, "0");
  }
  return raw.replace(/^US\./i, "").trim().toUpperCase();
}

function normalizeTrackedSymbols(market: Market, rawSymbols: string[]) {
  return Array.from(new Set(rawSymbols.map(symbol => normalizeSymbol(market, symbol)).filter(Boolean)));
}

function resolveBridgeStatus(settings: SettingsRecord["liveBridge"]) {
  if (settings.lastError) return "异常" as const;
  if (!settings.useLiveQuotes || !settings.lastBridgeHeartbeatAt) return "未连接" as const;
  if (Date.now() - settings.lastBridgeHeartbeatAt > LIVE_STALE_MS) return "陈旧" as const;
  return "已连接" as const;
}

function directionForSignalType(signalType: SignalType): Direction {
  return signalType === "冲高衰竭" ? "做空" : "做多";
}

function deriveSignalAlertLevel(score: number, preferred: AlertLevel): AlertLevel {
  if (score >= 88) return "CRITICAL";
  if (score >= 75) return preferred === "INFO" ? "WARNING" : preferred;
  return preferred;
}
export function createStructuredSuggestion(input: {
  signalType: SignalType;
  direction: Direction;
  triggerAction: "买入提醒" | "卖出提醒" | "观察提醒";
  triggerPrice: number;
  stopLossPrice: number | null;
  invalidationCondition: string;
  rationale: string;
}) {
  const stopLossDisplay = input.stopLossPrice ?? "未设置";
  return {
    方向: input.direction,
    参考入场区间: `${input.triggerAction} @ ${input.triggerPrice}`,
    止损参考: typeof stopLossDisplay === "number" ? `止损价 ${stopLossDisplay}` : stopLossDisplay,
    理由说明: input.rationale,
    触发动作: input.triggerAction,
    触发价位: input.triggerPrice,
    止损价位: input.stopLossPrice,
    失效条件: input.invalidationCondition,
  };
}

function sensitivityAdjustment(sensitivity: SignalSensitivity) {
  if (sensitivity === "激进") return 6;
  if (sensitivity === "保守") return -6;
  return 0;
}

function symbolKey(market: Market, symbol: string) {
  return `${market}:${normalizeSymbol(market, symbol)}`;
}

function getTriggerHitTolerance(market: Market, triggerPrice: number) {
  return Math.max(TRIGGER_HIT_TOLERANCE_BY_MARKET[market], round(triggerPrice * 0.0001, 4));
}

function isInsidePrecisionTriggerZone(price: number | null | undefined, market: Market, triggerPrice: number) {
  if (typeof price !== "number" || !Number.isFinite(price)) return false;
  return Math.abs(price - triggerPrice) <= getTriggerHitTolerance(market, triggerPrice);
}

function justEnteredPrecisionTriggerZone(signal: SignalRecord, history: PriceHistoryPoint[]) {
  if (signal.triggerAction === "观察提醒") return false;
  if (!(signal.triggerPrice > 0)) return false;
  const previousPrice = history.at(-2)?.price;
  const currentPrice = history.at(-1)?.price ?? signal.quotePrice;
  const currentInside = isInsidePrecisionTriggerZone(currentPrice, signal.market, signal.triggerPrice);
  const previousInside = isInsidePrecisionTriggerZone(previousPrice, signal.market, signal.triggerPrice);
  return currentInside && !previousInside;
}

function timeLabel(timestampMs: number) {
  return new Date(timestampMs).toLocaleTimeString("zh-Hans", { hour: "2-digit", minute: "2-digit" });
}

function scopedWatchlist(userId: number): WatchlistRecord[] {
  const workspace = getWorkspace(userId);
  const sorted = [...workspace.watchlistItems].sort((a, b) => b.priority - a.priority || b.updatedAt - a.updatedAt || a.symbol.localeCompare(b.symbol));
  const tracked = workspace.settings.liveBridge.trackedSymbols;
  if (workspace.settings.liveBridge.useLiveQuotes && tracked.length > 0) {
    const trackedKeys = new Set(tracked.map(symbol => symbolKey("HK", symbol)));
    const filtered = sorted.filter(item => trackedKeys.has(symbolKey(item.market, item.symbol)));
    if (filtered.length > 0) return filtered;
  }
  return sorted.filter(item => item.isActive === 1);
}

function scopedSignalFilter(userId: number, signals: SignalRecord[]) {
  const scopedKeys = new Set(scopedWatchlist(userId).map(item => symbolKey(item.market, item.symbol)));
  return signals.filter(signal => scopedKeys.has(symbolKey(signal.market, signal.symbol)));
}

function hasFreshLiveQuote(settings: SettingsRecord) {
  return !!settings.liveBridge.useLiveQuotes
    && !!settings.liveBridge.lastQuoteAt
    && Date.now() - settings.liveBridge.lastQuoteAt <= LIVE_STALE_MS;
}

function resolveSignalSuppressionReason(signal: SignalRecord, latestPrice: number | null, settings: SettingsRecord) {
  if (signal.sourceMode === "live" && !hasFreshLiveQuote(settings)) {
    return "实时行情已陈旧，旧信号已自动降级为仅供复盘参考。";
  }
  if (signal.sourceMode === "live" && Date.now() - signal.createdAtMs > LIVE_STALE_MS * 2) {
    return "信号生成时间过旧，已失去实时执行价值。";
  }
  if (latestPrice && signal.triggerPrice) {
    const deviationPct = Math.abs(latestPrice - signal.triggerPrice) / Math.max(signal.triggerPrice, 0.0001) * 100;
    if (deviationPct >= MAX_ACTIONABLE_DEVIATION_PCT) {
      return `当前价格 ${round(latestPrice)} 已偏离原触发价 ${round(signal.triggerPrice)} 超过 ${MAX_ACTIONABLE_DEVIATION_PCT}% ，旧建议自动失效。`;
    }

    if (signal.stopLossPrice !== null) {
      if (signal.direction === "做多" && latestPrice <= signal.stopLossPrice) {
        return `当前价格 ${round(latestPrice)} 已跌破止损价 ${round(signal.stopLossPrice)}，做多建议自动失效。`;
      }
      if (signal.direction === "做空" && latestPrice >= signal.stopLossPrice) {
        return `当前价格 ${round(latestPrice)} 已重新站上止损价 ${round(signal.stopLossPrice)}，做空建议自动失效。`;
      }
    }
  }

  if (signal.sourceMode === "pending") {
    return "当前标的尚未收到真实桥接行情，系统不会生成可执行交易指令。";
  }

  return null;
}

function invalidateSignal(signal: SignalRecord, reason: string) {
  signal.learningStatus = "已验证失效";
  signal.failureReason = reason;
  signal.reviewedAtMs = Date.now();
  signal.direction = "观察";
  signal.triggerAction = "观察提醒";
}

function signalPriorityValue(signal: SignalRecord) {
  return (signal.sourceMode === "live" ? 10_000_000 : 0) + signal.createdAtMs + signal.score * 10;
}

function listDisplaySignals(userId: number): SignalRecord[] {
  const settings = getSettings(userId);
  const watchlistMap = new Map(scopedWatchlist(userId).map(item => [symbolKey(item.market, item.symbol), item]));
  const unique = new Map<string, SignalRecord>();
  for (const signal of scopedSignalFilter(userId, listSignals(userId))) {
    const key = symbolKey(signal.market, signal.symbol);
    const latestPrice = watchlistMap.get(key)?.lastPrice ?? signal.quotePrice ?? null;
    const suppressionReason = resolveSignalSuppressionReason(signal, latestPrice, settings);
    if (suppressionReason) {
      invalidateSignal(signal, suppressionReason);
      continue;
    }
    const current = unique.get(key);
    if (!current || signalPriorityValue(signal) > signalPriorityValue(current)) {
      unique.set(key, signal);
    }
  }
  return Array.from(unique.values()).sort((a, b) => signalPriorityValue(b) - signalPriorityValue(a));
}

function evaluateSignalOutcome(signal: SignalRecord, currentPrice: number) {
  const stopLoss = signal.stopLossPrice ?? signal.triggerPrice;
  if (signal.triggerAction === "买入提醒") {
    const realizedReturnPct = round(((currentPrice - signal.triggerPrice) / Math.max(signal.triggerPrice, 0.0001)) * 100, 2);
    const adverseMovePct = round(((Math.min(currentPrice, stopLoss) - signal.triggerPrice) / Math.max(signal.triggerPrice, 0.0001)) * 100, 2);
    if (currentPrice >= signal.triggerPrice * 1.01) {
      return { learningStatus: "已验证有效" as const, realizedReturnPct, adverseMovePct, failureReason: null, reviewedAtMs: Date.now() };
    }
    if (currentPrice <= stopLoss) {
      return { learningStatus: "已验证失效" as const, realizedReturnPct, adverseMovePct, failureReason: `买入提醒触发后价格跌破止损位 ${stopLoss}。`, reviewedAtMs: Date.now() };
    }
    return { learningStatus: "待验证" as const, realizedReturnPct, adverseMovePct, failureReason: null, reviewedAtMs: null };
  }

  if (signal.triggerAction === "卖出提醒") {
    const realizedReturnPct = round(((signal.triggerPrice - currentPrice) / Math.max(signal.triggerPrice, 0.0001)) * 100, 2);
    const adverseMovePct = round(((signal.triggerPrice - Math.max(currentPrice, stopLoss)) / Math.max(signal.triggerPrice, 0.0001)) * 100, 2);
    if (currentPrice <= signal.triggerPrice * 0.99) {
      return { learningStatus: "已验证有效" as const, realizedReturnPct, adverseMovePct, failureReason: null, reviewedAtMs: Date.now() };
    }
    if (currentPrice >= stopLoss) {
      return { learningStatus: "已验证失效" as const, realizedReturnPct, adverseMovePct, failureReason: `卖出提醒触发后价格重新站回止损位 ${stopLoss} 上方。`, reviewedAtMs: Date.now() };
    }
    return { learningStatus: "待验证" as const, realizedReturnPct, adverseMovePct, failureReason: null, reviewedAtMs: null };
  }

  return {
    learningStatus: signal.learningStatus,
    realizedReturnPct: signal.realizedReturnPct,
    adverseMovePct: signal.adverseMovePct,
    failureReason: signal.failureReason,
    reviewedAtMs: signal.reviewedAtMs,
  };
}

function averageOf(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) return 0;
  const mean = averageOf(values);
  const variance = averageOf(values.map(value => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function buildVtaAnnotationsFromHistory(item: WatchlistRecord, history: PriceHistoryPoint[], signals: SignalRecord[]) {
  const recent = history.slice(-12);
  if (recent.length <= 1) {
    return [
      `${item.symbol} 当前最新价 ${round(item.lastPrice)}，分时样本不足，暂以实时价与触发结构作为主要判断依据。`,
      `最新涨跌幅 ${round(item.changePct)}%，系统将继续等待更多盘口轨迹补全 VTA 注释。`,
    ];
  }

  const first = recent[0];
  const last = recent[recent.length - 1];
  const priceDeltaPct = first.price > 0 ? round(((last.price - first.price) / first.price) * 100, 2) : 0;
  const volatilityPct = round(
    recent.slice(1).reduce((sum, point, index) => sum + Math.abs(point.price - recent[index].price), 0)
      / Math.max(recent.length - 1, 1)
      / Math.max(last.price, 0.0001)
      * 100,
    2,
  );
  const high = Math.max(...recent.map(point => point.price));
  const low = Math.min(...recent.map(point => point.price));
  const lastSignal = [...signals].sort((a, b) => b.createdAtMs - a.createdAtMs)[0] ?? null;

  return [
    `${item.symbol} 最近 ${recent.length} 个采样点价格区间 ${round(low)} - ${round(high)}，净变化 ${priceDeltaPct}% 。`,
    `${item.symbol} 分时波动强度约 ${volatilityPct}% ，当前价格位于最近区间${last.price >= (high + low) / 2 ? "上半区" : "下半区"}。`,
    lastSignal
      ? `最近一次有效结构来自“${lastSignal.signalType}”，触发价 ${round(lastSignal.triggerPrice)}，当前执行方向为 ${lastSignal.direction}。`
      : `${item.symbol} 当前尚无可复用的最近信号结构，系统会优先依赖价量节奏判断。`,
  ];
}

function deriveAdaptiveParameterFeedback(
  workspace: TradingWorkspace,
  market: Market,
  symbol: string,
  signalType: SignalType,
): AdaptiveParameterFeedback {
  const signalFamily = workspace.signals.filter(signal => signal.market === market && signal.symbol === symbol);
  const typeSignals = signalFamily.filter(signal => signal.signalType === signalType);
  const familyLearning = summarizeSignalLearning(signalFamily);
  const typeLearning = summarizeSignalLearning(typeSignals);

  return {
    llmBiasShift: round(clamp(familyLearning.rewardScore / 10 + familyLearning.sharpeLikeScore / 5, -2.5, 2.5), 2),
    eventWeight: clamp(round(0.96 + familyLearning.rewardScore / 40 + typeLearning.successRate / 420, 2), 0.74, 1.32),
    triggerThresholdShiftPct: round(clamp(-(typeLearning.rewardScore / 6) - (typeLearning.successRate - 50) / 80, -1.8, 1.8), 2),
    stopLossBufferPct: round(clamp(0.85 + familyLearning.averageAdversePct / 3.8 - familyLearning.rewardScore / 10, 0.55, 2.45), 2),
  };
}

function deriveSignalReasoning(
  workspace: TradingWorkspace,
  item: WatchlistRecord,
  signal: SignalRecord,
  history: PriceHistoryPoint[],
): SignalReasoningBreakdown {
  const signalFamily = workspace.signals.filter(entry => entry.market === signal.market && entry.symbol === signal.symbol);
  const feedback = deriveAdaptiveParameterFeedback(workspace, signal.market, signal.symbol, signal.signalType);
  const learning = summarizeSignalLearning(signalFamily);
  const recent = history.slice(-12);
  const startPrice = recent[0]?.price ?? item.openPrice;
  const endPrice = recent[recent.length - 1]?.price ?? item.lastPrice;
  const intradayTrendPct = startPrice > 0 ? round(((endPrice - startPrice) / startPrice) * 100, 2) : signal.quoteChangePct;
  const macroContribution = round(clamp(signal.quoteChangePct * 0.45 + feedback.eventWeight - 1, -4, 4), 2);
  const eventContribution = round(clamp((signal.score - 70) / 10 + feedback.llmBiasShift, -4, 4), 2);
  const priceContribution = round(clamp(intradayTrendPct * 0.9 + (signal.direction === "做空" ? -1.2 : 1.2), -4, 4), 2);
  const reinforcementContribution = round(clamp(learning.rewardScore * 0.6 + learning.sharpeLikeScore * 0.8, -4, 4), 2);

  return {
    macroFactor: `${signal.market} ${signal.symbol} 当前采用宏观代理语境，最新涨跌幅 ${round(signal.quoteChangePct)}%，事件权重 ${feedback.eventWeight}，用于近似 HSI/HSTECH 与行业风险偏好。`,
    eventFactor: `事件层当前以外部摘要可得性 + 价格/成交代理构成，LLM 偏向修正 ${feedback.llmBiasShift}，执行上偏向 ${signal.direction}。`,
    priceActionFactor: `${signal.signalType} 对应的量价条件为触发价 ${round(signal.triggerPrice)}、失效条件 ${signal.invalidationCondition}，最近分时趋势 ${intradayTrendPct}% 。`,
    reinforcementFactor: `近 ${learning.evaluatedCount} 笔验证样本的平均奖励 ${learning.rewardScore}、Sharpe 风格分数 ${learning.sharpeLikeScore}，共同推导触发阈值偏移 ${feedback.triggerThresholdShiftPct}% 与止损缓冲 ${feedback.stopLossBufferPct}%。`,
    weightContribution: {
      macro: macroContribution,
      event: eventContribution,
      priceAction: priceContribution,
      reinforcement: reinforcementContribution,
    },
  };
}

function summarizeSignalLearning(signals: SignalRecord[]) {
  const evaluated = signals.filter(signal => signal.learningStatus !== "待验证" && signal.realizedReturnPct !== null);
  const successful = evaluated.filter(signal => signal.learningStatus === "已验证有效");
  const successRate = evaluated.length > 0 ? round((successful.length / evaluated.length) * 100, 1) : 0;
  const averageReturnPct = evaluated.length > 0
    ? round(averageOf(evaluated.map(signal => signal.realizedReturnPct ?? 0)), 2)
    : 0;
  const averageAdversePct = evaluated.length > 0
    ? round(averageOf(evaluated.map(signal => Math.abs(signal.adverseMovePct ?? 0))), 2)
    : 0;
  const rewardSeries = evaluated.map(signal => {
    const realized = signal.realizedReturnPct ?? 0;
    const adverse = Math.abs(signal.adverseMovePct ?? 0);
    const statusPenalty = signal.learningStatus === "已验证失效" ? 1.15 : 0;
    return round(realized - adverse * 0.65 - statusPenalty, 2);
  });
  const rewardScore = rewardSeries.length > 0 ? round(averageOf(rewardSeries), 2) : 0;
  const rewardVolatility = rewardSeries.length > 1 ? round(standardDeviation(rewardSeries), 2) : 0;
  const sharpeLikeScore = rewardSeries.length > 0
    ? round(averageOf(rewardSeries) / Math.max(standardDeviation(rewardSeries), 0.75), 2)
    : 0;
  const adaptiveWeight = clamp(
    round(0.94 + successRate / 420 + rewardScore / 42 + sharpeLikeScore / 18 - averageAdversePct / 120, 2),
    0.78,
    1.24,
  );
  return {
    evaluatedCount: evaluated.length,
    successRate,
    averageReturnPct,
    averageAdversePct,
    rewardScore,
    rewardVolatility,
    sharpeLikeScore,
    adaptiveWeight,
  };
}

function buildSimulatedTradesForSymbol(item: WatchlistRecord, history: PriceHistoryPoint[], signals: SignalRecord[]): SimulatedTradeRecord[] {
  const actionableSignals = signals
    .filter(signal => signal.triggerAction === "买入提醒" || signal.triggerAction === "卖出提醒")
    .sort((a, b) => a.createdAtMs - b.createdAtMs)
    .slice(-10);

  const fallbackPoint: PriceHistoryPoint = {
    timestampMs: Date.now(),
    label: timeLabel(Date.now()),
    price: item.lastPrice,
    forecastPrice: item.lastPrice,
    volume: item.volume,
    changePct: item.changePct,
  };

  const timeline = (history.length > 0 ? history : [fallbackPoint]).slice().sort((a, b) => a.timestampMs - b.timestampMs);
  const vtaAnnotations = buildVtaAnnotationsFromHistory(item, history, signals);

  return actionableSignals.map((signal, index) => {
    const reasoning = deriveSignalReasoning(getWorkspace(item.userId), item, signal, history);
    const parameterFeedback = deriveAdaptiveParameterFeedback(getWorkspace(item.userId), signal.market, signal.symbol, signal.signalType);
    const entryPoint = timeline.find(point => point.timestampMs >= signal.createdAtMs)
      ?? timeline[Math.min(index, timeline.length - 1)]
      ?? timeline[timeline.length - 1]
      ?? fallbackPoint;
    const nextOpposite = actionableSignals.slice(index + 1).find(candidate => candidate.triggerAction !== signal.triggerAction) ?? null;
    const exitTimestampMs = nextOpposite?.createdAtMs ?? signal.reviewedAtMs ?? timeline[timeline.length - 1]?.timestampMs ?? Date.now();
    const exitPoint = timeline.find(point => point.timestampMs >= exitTimestampMs)
      ?? timeline[timeline.length - 1]
      ?? fallbackPoint;
    const path = timeline.filter(point => point.timestampMs >= entryPoint.timestampMs && point.timestampMs <= exitPoint.timestampMs);
    const pathPrices = path.length > 0 ? path.map(point => point.price) : [entryPoint.price, exitPoint.price];
    const currentPrice = item.lastPrice;
    const simulatedExitPrice = nextOpposite?.triggerPrice
      ?? (signal.learningStatus === "待验证" ? currentPrice : round(exitPoint.price, 2));
    const realizedPnlPct = round(
      signal.triggerAction === "买入提醒"
        ? ((simulatedExitPrice - signal.triggerPrice) / Math.max(signal.triggerPrice, 0.0001)) * 100
        : ((signal.triggerPrice - simulatedExitPrice) / Math.max(signal.triggerPrice, 0.0001)) * 100,
      2,
    );
    const unrealizedPnlPct = round(
      signal.triggerAction === "买入提醒"
        ? ((currentPrice - signal.triggerPrice) / Math.max(signal.triggerPrice, 0.0001)) * 100
        : ((signal.triggerPrice - currentPrice) / Math.max(signal.triggerPrice, 0.0001)) * 100,
      2,
    );
    const adverseExtreme = signal.triggerAction === "买入提醒"
      ? Math.min(...pathPrices)
      : Math.max(...pathPrices);
    const maxDrawdownPct = round(
      signal.triggerAction === "买入提醒"
        ? Math.max(0, ((signal.triggerPrice - adverseExtreme) / Math.max(signal.triggerPrice, 0.0001)) * 100)
        : Math.max(0, ((adverseExtreme - signal.triggerPrice) / Math.max(signal.triggerPrice, 0.0001)) * 100),
      2,
    );
    const statusLabel: SimulatedTradeRecord["statusLabel"] = signal.learningStatus === "待验证" && !nextOpposite
      ? "持仓中"
      : signal.learningStatus === "已验证失效"
        ? "已失效"
        : "已兑现";
    const rewardScore = round(
      realizedPnlPct - maxDrawdownPct * 0.65 + (statusLabel === "已兑现" ? 0.6 : statusLabel === "已失效" ? -0.8 : 0) + (signal.score - 75) / 20,
      2,
    );
    const invalidationReason = signal.failureReason
      ?? (nextOpposite ? `后续反向 ${nextOpposite.triggerAction === "买入提醒" ? "BUY" : "SELL"} 信号出现，模拟仓位按新方向平仓。` : null);

    return {
      signalId: signal.id,
      market: item.market,
      symbol: item.symbol,
      name: item.name,
      securityLabel: `${item.symbol} · ${item.name}`,
      identityKey: symbolKey(item.market, item.symbol),
      signalType: signal.signalType,
      action: signal.triggerAction === "买入提醒" ? "BUY" : "SELL",
      direction: signal.direction,
      entryTimeLabel: entryPoint.label,
      entryTimestampMs: entryPoint.timestampMs,
      exitTimeLabel: exitPoint.label,
      exitTimestampMs,
      holdingMinutes: Math.max(0, Math.round((exitTimestampMs - entryPoint.timestampMs) / 60_000)),
      entryPrice: signal.triggerPrice,
      currentPrice,
      simulatedExitPrice,
      realizedPnlPct,
      unrealizedPnlPct,
      maxDrawdownPct,
      statusLabel,
      riskLevel: signal.riskLevel,
      failureReason: signal.failureReason,
      invalidationReason,
      rationale: signal.triggerReason,
      reviewedAtMs: signal.reviewedAtMs,
      markerLabel: entryPoint.label,
      markerPrice: signal.triggerPrice,
      markerTone: signal.triggerAction === "买入提醒" ? "buy" : "sell",
      rewardScore,
      explanation: `VTA：${vtaAnnotations.slice(0, 2).join("；")} F-LOAM 执行位：触发 ${round(signal.triggerPrice)} / 止损 ${signal.stopLossPrice ?? "未设"}。强化反馈奖励 ${rewardScore}。`,
      reasoning,
      parameterFeedback,
    };
  });
}

function buildSimulationTape(item: WatchlistRecord, history: PriceHistoryPoint[], signals: SignalRecord[]) {
  const trades = buildSimulatedTradesForSymbol(item, history, signals);
  const openTrades = trades.filter(trade => trade.statusLabel === "持仓中");
  const closedTrades = trades.filter(trade => trade.statusLabel !== "持仓中");
  const floatingPnlPct = openTrades.length > 0
    ? round(averageOf(openTrades.map(trade => trade.unrealizedPnlPct)), 2)
    : 0;
  const realizedPnlPct = closedTrades.length > 0
    ? round(averageOf(closedTrades.map(trade => trade.realizedPnlPct)), 2)
    : 0;
  const maxDrawdownPct = trades.length > 0
    ? round(Math.max(...trades.map(trade => trade.maxDrawdownPct)), 2)
    : 0;

  return {
    trades,
    summary: {
      tradeCount: trades.length,
      openCount: openTrades.length,
      floatingPnlPct,
      realizedPnlPct,
      maxDrawdownPct,
      averageRewardScore: trades.length > 0 ? round(averageOf(trades.map(trade => trade.rewardScore)), 2) : 0,
    },
  };
}

export function buildSimulatedTrades(userId: number, input?: { market?: Market; symbol?: string }) {
  const workspace = getWorkspace(userId);
  const candidates = scopedWatchlist(userId).filter(item => {
    const matchesMarket = !input?.market || item.market === input.market;
    const matchesSymbol = !input?.symbol || item.symbol === normalizeSymbol(item.market, input.symbol);
    return matchesMarket && matchesSymbol;
  });

  return candidates.flatMap(item => {
    const history = workspace.priceHistory[symbolKey(item.market, item.symbol)] ?? [];
    const signalFamily = workspace.signals.filter(signal => signal.symbol === item.symbol && signal.market === item.market);
    return buildSimulatedTradesForSymbol(item, history, signalFamily);
  }).sort((a, b) => b.entryTimestampMs - a.entryTimestampMs);
}

export function describeSignal(userId: number, signalId: number) {
  const workspace = getWorkspace(userId);
  const signal = workspace.signals.find(item => item.id === signalId);
  if (!signal) return null;
  const item = workspace.watchlistItems.find(entry => entry.market === signal.market && entry.symbol === signal.symbol);
  if (!item) return null;
  const history = workspace.priceHistory[symbolKey(item.market, item.symbol)] ?? [];
  return {
    reasoning: deriveSignalReasoning(workspace, item, signal, history),
    parameterFeedback: deriveAdaptiveParameterFeedback(workspace, signal.market, signal.symbol, signal.signalType),
  };
}

export function getSignalStrategyFrame(userId: number, signalId: number): SignalStrategyFrame | null {
  const workspace = getWorkspace(userId);
  const signal = workspace.signals.find(item => item.id === signalId);
  if (!signal) return null;
  const item = workspace.watchlistItems.find(entry => entry.market === signal.market && entry.symbol === signal.symbol);
  if (!item) return null;
  const history = workspace.priceHistory[symbolKey(item.market, item.symbol)] ?? [];
  const signalFamily = workspace.signals.filter(entry => entry.market === signal.market && entry.symbol === signal.symbol);
  const learning = summarizeSignalLearning(signalFamily);
  const vtaAnnotations = buildVtaAnnotationsFromHistory(item, history, signalFamily);
  const eventScore = clamp(round(signal.quoteChangePct * 3.4 + (signal.direction === "做空" ? -2 : signal.direction === "做多" ? 2 : 0) + learning.rewardScore, 2), -20, 20);
  const structureSummary = `${item.name} 当前实时价 ${round(item.lastPrice)}，触发结构为 ${signal.signalType}，执行位 ${round(signal.triggerPrice)}，止损参考 ${signal.stopLossPrice ?? "未设"}。`;
  const eventContextSummary = `${item.name} 当前事件代理分 ${eventScore}，风险标签为 ${signal.riskTags.join("、") || "无"}，量价状态显示 ${signal.triggerAction} 更接近当前执行方向。`;
  const reinforcementSummary = `近 ${learning.evaluatedCount} 笔已验证样本成功率 ${learning.successRate}% ，平均奖励 ${learning.rewardScore} ，Sharpe 风格分数 ${learning.sharpeLikeScore} ，当前自适应权重 ${learning.adaptiveWeight}。`;

  return {
    market: signal.market,
    symbol: signal.symbol,
    name: item.name,
    vtaAnnotations,
    structureSummary,
    eventContextSummary,
    reinforcementSummary,
    eventScore,
    sharpeLikeScore: learning.sharpeLikeScore,
    rewardScore: learning.rewardScore,
    adaptiveWeight: learning.adaptiveWeight,
  };
}

function strategyWeightForSignalType(workspace: TradingWorkspace, signalType: SignalType) {
  const summary = summarizeSignalLearning(workspace.signals.filter(signal => signal.signalType === signalType));
  return summary.adaptiveWeight;
}

function updateSignalLearningFromQuote(userId: number, quote: LiveQuoteInput) {
  const workspace = getWorkspace(userId);
  const normalizedSymbol = normalizeSymbol(quote.market, quote.symbol);
  for (const signal of workspace.signals) {
    if (signal.market !== quote.market || signal.symbol !== normalizedSymbol) continue;
    const learning = evaluateSignalOutcome(signal, quote.lastPrice);
    signal.learningStatus = learning.learningStatus;
    signal.realizedReturnPct = learning.realizedReturnPct;
    signal.adverseMovePct = learning.adverseMovePct;
    signal.failureReason = learning.failureReason;
    signal.reviewedAtMs = learning.reviewedAtMs;
  }
}

function buildForecastCurve(item: WatchlistRecord, history: PriceHistoryPoint[], signal: SignalRecord | null) {
  const recent = history.slice(-12);
  const latest = recent[recent.length - 1];
  const basePrice = latest?.price ?? item.lastPrice;
  const historicalSlope = recent.length > 1 ? (recent[recent.length - 1].price - recent[0].price) / Math.max(recent.length - 1, 1) : 0;
  const slope = signal?.llmForecastSlope ?? historicalSlope;
  const volatility = recent.length > 1
    ? recent.slice(1).reduce((sum, point, index) => sum + Math.abs(point.price - recent[index].price), 0) / Math.max(recent.length - 1, 1)
    : Math.max(item.lastPrice * 0.002, 0.01);
  const directionalBias = signal?.triggerAction === "卖出提醒" ? -1 : signal?.triggerAction === "买入提醒" ? 1 : Math.sign(item.changePct || slope || 0.01);
  const strategyWeight = signal?.strategyWeight ?? 1;
  const llmConfidenceFactor = (signal?.llmForecastConfidence ?? 75) / 100;
  const future = Array.from({ length: FORECAST_POINT_COUNT }, (_, index) => {
    const step = index + 1;
    const timestampMs = (latest?.timestampMs ?? Date.now()) + step * 4 * 60 * 1000;
    const forecastPrice = round(basePrice + slope * step + directionalBias * volatility * strategyWeight * llmConfidenceFactor * step, 2);
    return {
      timestampMs,
      label: timeLabel(timestampMs),
      price: null,
      forecastPrice,
      volume: 0,
      changePct: item.prevClosePrice > 0 ? round(((forecastPrice - item.prevClosePrice) / item.prevClosePrice) * 100, 2) : 0,
    };
  });

  return [
    ...history.map(point => ({ ...point, price: point.price, forecastPrice: point.forecastPrice })),
    ...future,
  ];
}

function upsertPriceHistory(userId: number, quote: LiveQuoteInput) {
  const workspace = getWorkspace(userId);
  const key = symbolKey(quote.market, quote.symbol);
  const timestampMs = Date.now();
  const previousHistory = workspace.priceHistory[key] ?? [];
  const prevClose = Math.max(quote.prevClosePrice, 0.0001);
  const nextPoint: PriceHistoryPoint = {
    timestampMs,
    label: timeLabel(timestampMs),
    price: round(quote.lastPrice),
    forecastPrice: round(quote.lastPrice),
    volume: Math.round(quote.volume),
    changePct: round(((quote.lastPrice - prevClose) / prevClose) * 100, 2),
  };
  workspace.priceHistory[key] = [...previousHistory, nextPoint].slice(-PRICE_HISTORY_LIMIT);
}

function buildSignalBlueprint(userId: number, quote: LiveQuoteInput, settings: SettingsRecord): SignalBlueprint | null {
  const workspace = getWorkspace(userId);
  const normalizedSymbol = normalizeSymbol(quote.market, quote.symbol);
  const history = workspace.priceHistory[symbolKey(quote.market, normalizedSymbol)] ?? [];
  const signalFamily = workspace.signals.filter(signal => signal.market === quote.market && signal.symbol === normalizedSymbol);
  const learning = summarizeSignalLearning(signalFamily);
  const changePct = quote.prevClosePrice > 0 ? ((quote.lastPrice - quote.prevClosePrice) / quote.prevClosePrice) * 100 : 0;
  const pullbackFromHighPct = quote.highPrice > 0 ? ((quote.highPrice - quote.lastPrice) / quote.highPrice) * 100 : 0;
  const fromOpenPct = quote.openPrice > 0 ? ((quote.lastPrice - quote.openPrice) / quote.openPrice) * 100 : 0;
  const sensitivityScore = sensitivityAdjustment(settings.signalSensitivity);
  const turnoverFactor = quote.turnover / Math.max(settings.scanThresholds.minTurnover, 1);
  const volumeScore = clamp(turnoverFactor * 10, 0, 12);
  const recent = history.slice(-12);
  const recentStart = recent[0]?.price ?? quote.openPrice;
  const recentEnd = recent[recent.length - 1]?.price ?? quote.lastPrice;
  const intradayTrendPct = recentStart > 0 ? ((recentEnd - recentStart) / recentStart) * 100 : changePct;
  const volatilityPct = recent.length > 1
    ? recent.slice(1).reduce((sum, point, index) => sum + Math.abs(point.price - recent[index].price), 0)
      / Math.max(recent.length - 1, 1)
      / Math.max(recentEnd, 0.0001)
      * 100
    : Math.abs(changePct - fromOpenPct);
  const eventScore = clamp(
    round(changePct * 3.2 + intradayTrendPct * 2.8 + turnoverFactor * 6 - pullbackFromHighPct * 1.5 + learning.rewardScore, 2),
    -16,
    18,
  );
  const contextTail = `VTA 注释显示分时趋势 ${round(intradayTrendPct)}%，波动强度 ${round(volatilityPct)}%，事件代理分 ${eventScore}，强化权重 ${learning.adaptiveWeight}。`;
  const baseReason = `${normalizedSymbol} 最新价 ${round(quote.lastPrice)}，涨跌幅 ${round(changePct)}%，成交额 ${Math.round(quote.turnover).toLocaleString()}。${contextTail}`;

  if (changePct >= 2.2 && fromOpenPct >= 1.2 && pullbackFromHighPct <= 0.6) {
    const score = clamp(Math.round(78 + changePct * 3 + volumeScore + sensitivityScore + eventScore * 0.55 + (learning.adaptiveWeight - 1) * 12), 65, 98);
    return {
      signalType: "突破啟動" as const,
      score,
      direction: "做多" as const,
      triggerAction: "买入提醒" as const,
      triggerPrice: round(quote.highPrice),
      stopLossPrice: round(Math.max(quote.openPrice, quote.lastPrice * 0.985)),
      invalidationCondition: `若回落并跌破 ${round(Math.max(quote.openPrice, quote.lastPrice * 0.985))}，则本次突破买入逻辑失效；事件代理分若转负也需同步撤销。`,
      triggerReason: `${baseReason}价格贴近当日高点且量价共振，符合突破啟動结构。`,
      riskTags: ["追价滑点", "高位波动", eventScore < 0 ? "事件反转风险" : "趋势拥挤"],
      riskLevel: eventScore >= 6 ? "中" : "高",
      executionPrerequisite: "价格放量站上当日高点后，至少一个刷新周期不跌回触发位下方，并保持事件代理分不转负。",
      entryRange: `买入触发价 ${round(quote.highPrice)}`,
      stopLoss: `跌破 ${round(Math.max(quote.openPrice, quote.lastPrice * 0.985))} 需降低仓位`,
      rationale: `当前属于顺势启动型结构，更适合等待明确突破点触发后的跟进，而不是无保护追高。强化反馈权重 ${learning.adaptiveWeight} 已纳入执行评分。`,
    };
  }

  if (changePct >= 0.8 && fromOpenPct > 0 && pullbackFromHighPct > 0.6 && pullbackFromHighPct <= 1.8) {
    const score = clamp(Math.round(72 + changePct * 2.6 + volumeScore + sensitivityScore + eventScore * 0.45 + (learning.adaptiveWeight - 1) * 12), 60, 95);
    return {
      signalType: "回踩續強" as const,
      score,
      direction: "做多" as const,
      triggerAction: "买入提醒" as const,
      triggerPrice: round(quote.lastPrice),
      stopLossPrice: round(quote.openPrice * 0.995),
      invalidationCondition: `若失守 ${round(quote.openPrice * 0.995)}，说明回踩承接失败，本次买入提醒失效；若事件代理分大幅走弱也应暂停执行。`,
      triggerReason: `${baseReason}冲高后并未深度破坏结构，回踩仍保持在强势区，符合回踩續強特征。`,
      riskTags: ["二次确认失败", "午后回落", volatilityPct > 1 ? "波动放大" : "承接减弱"],
      riskLevel: eventScore >= 3 ? "中" : "高",
      executionPrerequisite: "回踩后仍守住关键承接位，并重新站回触发价，同时强化反馈权重维持在 0.9 以上。",
      entryRange: `买入触发价 ${round(quote.lastPrice)}`,
      stopLoss: `失守 ${round(quote.openPrice * 0.995)} 需谨慎`,
      rationale: `适合把回踩后的承接强度作为入场依据，一旦价格重新站稳当前触发点，可视作跟进信号。当前奖励分 ${learning.rewardScore} 已用于微调强度。`,
    };
  }

  if (Math.abs(changePct) <= 1.2 && turnoverFactor >= 1.15 && quote.volume >= 1_500_000) {
    const score = clamp(Math.round(68 + volumeScore + sensitivityScore + eventScore * 0.35 + (learning.adaptiveWeight - 1) * 10), 58, 90);
    return {
      signalType: "盤口失衡" as const,
      score,
      direction: changePct >= 0 ? "做多" as const : "做空" as const,
      triggerAction: changePct >= 0 ? "买入提醒" as const : "卖出提醒" as const,
      triggerPrice: round(quote.lastPrice),
      stopLossPrice: changePct >= 0 ? round(quote.lowPrice) : round(quote.highPrice),
      invalidationCondition: changePct >= 0
        ? `若跌回 ${round(quote.lowPrice)} 下方，则买方失衡信号失效。`
        : `若重新站上 ${round(quote.highPrice)}，则卖方失衡信号失效。`,
      triggerReason: `${baseReason}价格波动有限但成交明显抬升，说明短线买卖力量正在重新分配。`,
      riskTags: ["需要盘口确认", "假突破风险", learning.sharpeLikeScore < 0 ? "历史反馈偏弱" : "等待进一步确认"],
      riskLevel: "中",
      executionPrerequisite: changePct >= 0 ? "量能抬升且价格继续稳在触发价上方。" : "卖压持续增强且价格无法重新站回触发价。",
      entryRange: `${changePct >= 0 ? "买入" : "卖出"}触发价 ${round(quote.lastPrice)}`,
      stopLoss: changePct >= 0 ? `若跌回 ${round(quote.lowPrice)} 下方则取消观察` : `若重新站上 ${round(quote.highPrice)} 上方则取消观察`,
      rationale: `该信号强调力量失衡形成的实时节点，适合作为盘中买卖提醒，而不是宽泛区间预测。当前 Sharpe 风格分数 ${learning.sharpeLikeScore}。`,
    };
  }

  if (changePct >= 1.6 && pullbackFromHighPct >= 1.1 && quote.lastPrice < quote.highPrice * 0.989) {
    const score = clamp(Math.round(70 + changePct * 2.3 + sensitivityScore - eventScore * 0.2 + (learning.adaptiveWeight - 1) * 8), 60, 92);
    return {
      signalType: "冲高衰竭" as const,
      score,
      direction: "做空" as const,
      triggerAction: "卖出提醒" as const,
      triggerPrice: round(quote.lastPrice),
      stopLossPrice: round(quote.highPrice * 0.997),
      invalidationCondition: `若重新站回 ${round(quote.highPrice * 0.997)} 上方，则本次卖出提醒失效；若事件代理分明显转正也需撤销。`,
      triggerReason: `${baseReason}价格从高位回落幅度扩大，冲高后的跟随资金不足，出现冲高衰竭迹象。`,
      riskTags: ["高位回落", "承接减弱", eventScore > 0 ? "反抽风险" : "抛压扩散"],
      riskLevel: "中",
      executionPrerequisite: "冲高后承接持续减弱，且价格无法重新站回高位压力区，同时事件代理分不重新转正。",
      entryRange: `卖出触发价 ${round(quote.lastPrice)}`,
      stopLoss: `重新站回 ${round(quote.highPrice * 0.997)} 上方则撤销衰竭判断`,
      rationale: `这类结构更适合作为卖出或减仓提醒，应优先管理已有盈利与高位回撤风险。强化反馈会在连续失效时自动降低该模式权重。`,
    };
  }

  return null;
}

function buildSignalRecord(userId: number, quote: LiveQuoteInput, settings: SettingsRecord): SignalRecord | null {
  const blueprint = buildSignalBlueprint(userId, quote, settings);
  if (!blueprint) return null;
  const workspace = getWorkspace(userId);
  const changePct = quote.prevClosePrice > 0 ? ((quote.lastPrice - quote.prevClosePrice) / quote.prevClosePrice) * 100 : 0;
  const strategyWeight = strategyWeightForSignalType(workspace, blueprint.signalType);
  return {
    id: 0,
    userId,
    market: quote.market,
    symbol: normalizeSymbol(quote.market, quote.symbol),
    signalType: blueprint.signalType,
    score: clamp(Math.round(blueprint.score * strategyWeight), 58, 99),
    triggerReason: blueprint.triggerReason,
    riskTags: blueprint.riskTags,
    riskLevel: blueprint.riskLevel,
    executionPrerequisite: blueprint.executionPrerequisite,
    direction: blueprint.direction ?? directionForSignalType(blueprint.signalType),
    triggerAction: blueprint.triggerAction,
    triggerPrice: blueprint.triggerPrice,
    stopLossPrice: blueprint.stopLossPrice,
    invalidationCondition: blueprint.invalidationCondition,
    entryRange: blueprint.entryRange,
    stopLoss: blueprint.stopLoss,
    rationale: blueprint.rationale,
    llmInterpretation: null,
    llmForecastSummary: null,
    llmForecastBias: null,
    llmForecastSlope: null,
    llmForecastConfidence: null,
    llmForecastGeneratedAtMs: null,
    sourceMode: "live",
    quotePrice: round(quote.lastPrice),
    quoteChangePct: round(changePct),
    quoteVolume: Math.round(quote.volume),
    learningStatus: "待验证",
    realizedReturnPct: null,
    adverseMovePct: null,
    failureReason: null,
    reviewedAtMs: null,
    strategyWeight,
    createdAtMs: Date.now(),
  };
}

function upsertSignalFromQuote(userId: number, quote: LiveQuoteInput, settings: SettingsRecord) {
  const workspace = getWorkspace(userId);
  const candidate = buildSignalRecord(userId, quote, settings);
  if (!candidate) return null;

  const recent = workspace.signals.find(
    signal =>
      signal.market === candidate.market &&
      signal.symbol === candidate.symbol &&
      signal.signalType === candidate.signalType &&
      Date.now() - signal.createdAtMs <= SIGNAL_COOLDOWN_MS
  );

  if (recent) {
    recent.score = candidate.score;
    recent.triggerReason = candidate.triggerReason;
    recent.riskTags = candidate.riskTags;
    recent.riskLevel = candidate.riskLevel;
    recent.executionPrerequisite = candidate.executionPrerequisite;
    recent.direction = candidate.direction;
    recent.triggerAction = candidate.triggerAction;
    recent.triggerPrice = candidate.triggerPrice;
    recent.stopLossPrice = candidate.stopLossPrice;
    recent.invalidationCondition = candidate.invalidationCondition;
    recent.entryRange = candidate.entryRange;
    recent.stopLoss = candidate.stopLoss;
    recent.rationale = candidate.rationale;
    recent.llmForecastSummary = candidate.llmForecastSummary;
    recent.llmForecastBias = candidate.llmForecastBias;
    recent.llmForecastSlope = candidate.llmForecastSlope;
    recent.llmForecastConfidence = candidate.llmForecastConfidence;
    recent.llmForecastGeneratedAtMs = candidate.llmForecastGeneratedAtMs;
    recent.sourceMode = "live";
    recent.quotePrice = candidate.quotePrice;
    recent.quoteChangePct = candidate.quoteChangePct;
    recent.quoteVolume = candidate.quoteVolume;
    recent.strategyWeight = candidate.strategyWeight;
    recent.createdAtMs = Date.now();
    return recent;
  }

  candidate.id = workspace.nextIds.signal++;
  workspace.signals.unshift(candidate);
  workspace.signals = workspace.signals.slice(0, 60);
  return candidate;
}

function ensureAlertForSignal(userId: number, signal: SignalRecord, settings: SettingsRecord) {
  const workspace = getWorkspace(userId);
  const history = workspace.priceHistory[symbolKey(signal.market, signal.symbol)] ?? [];
  if (!justEnteredPrecisionTriggerZone(signal, history)) {
    return null;
  }

  const level = deriveSignalAlertLevel(signal.score, settings.alertLevelPreference);
  const hitTolerance = getTriggerHitTolerance(signal.market, signal.triggerPrice);
  const title = `${signal.symbol} ${signal.triggerAction === "买入提醒" ? "BUY" : "SELL"} 精确命中 · ${signal.score} 分`;
  const message = `${signal.triggerReason} 当前价格 ${signal.quotePrice} 已命中 ${signal.triggerAction} 价位 ${signal.triggerPrice}（容差 ±${hitTolerance}），止损参考：${signal.stopLossPrice ?? signal.stopLoss}。`;

  const duplicate = workspace.alerts.find(
    alert =>
      alert.symbol === signal.symbol &&
      alert.signalType === signal.signalType &&
      alert.triggerAction === signal.triggerAction &&
      alert.triggerPrice === signal.triggerPrice &&
      Date.now() - alert.createdAtMs <= SIGNAL_COOLDOWN_MS
  );

  if (duplicate) {
    return duplicate;
  }

  const alert: AlertRecord = {
    id: workspace.nextIds.alert++,
    userId,
    signalId: signal.id,
    market: signal.market,
    symbol: signal.symbol,
    signalType: signal.signalType,
    level,
    title,
    message,
    notifyTriggered: 0,
    sourceMode: signal.sourceMode,
    triggerAction: signal.triggerAction,
    triggerPrice: signal.triggerPrice,
    createdAtMs: Date.now(),
  };

  workspace.alerts.unshift(alert);
  workspace.alerts = workspace.alerts.slice(0, 120);
  return alert;
}

function upsertWatchlistQuote(userId: number, quote: LiveQuoteInput) {
  const workspace = getWorkspace(userId);
  const normalizedSymbol = normalizeSymbol(quote.market, quote.symbol);
  const nowTs = Date.now();
  const changePct = quote.prevClosePrice > 0 ? ((quote.lastPrice - quote.prevClosePrice) / quote.prevClosePrice) * 100 : 0;

  const existing = workspace.watchlistItems.find(item => item.market === quote.market && item.symbol === normalizedSymbol);
  if (existing) {
    existing.name = quote.name ?? existing.name;
    existing.lastPrice = round(quote.lastPrice);
    existing.changePct = round(changePct);
    existing.volume = Math.round(quote.volume);
    existing.turnover = Math.round(quote.turnover);
    existing.openPrice = round(quote.openPrice);
    existing.highPrice = round(quote.highPrice);
    existing.lowPrice = round(quote.lowPrice);
    existing.prevClosePrice = round(quote.prevClosePrice);
    existing.sourceMode = "live";
    existing.updatedAt = nowTs;
    return existing;
  }

  const record: WatchlistRecord = {
    id: workspace.nextIds.watchlist++,
    userId,
    market: quote.market,
    symbol: normalizedSymbol,
    name: quote.name ?? normalizedSymbol,
    priority: 3,
    lastPrice: round(quote.lastPrice),
    changePct: round(changePct),
    volume: Math.round(quote.volume),
    turnover: Math.round(quote.turnover),
    openPrice: round(quote.openPrice),
    highPrice: round(quote.highPrice),
    lowPrice: round(quote.lowPrice),
    prevClosePrice: round(quote.prevClosePrice),
    sourceMode: "live",
    isActive: 1,
    createdAt: nowTs,
    updatedAt: nowTs,
  };

  workspace.watchlistItems.push(record);
  return record;
}

export function getTradingWorkspace(userId: number): TradingWorkspace {
  return getWorkspace(userId);
}

export function listWatchlist(userId: number): WatchlistRecord[] {
  return [...getWorkspace(userId).watchlistItems].sort((a, b) => b.priority - a.priority || b.updatedAt - a.updatedAt || a.symbol.localeCompare(b.symbol));
}

export function addWatchlistItem(
  userId: number,
  input: { market: Market; symbol: string; name: string; priority: number }
): WatchlistRecord {
  const workspace = getWorkspace(userId);
  const normalizedSymbol = normalizeSymbol(input.market, input.symbol);
  const existing = workspace.watchlistItems.find(
    item => item.market === input.market && item.symbol === normalizedSymbol
  );

  if (existing) {
    existing.priority = input.priority;
    existing.name = input.name;
    existing.updatedAt = Date.now();
    return existing;
  }

  const record: WatchlistRecord = {
    id: workspace.nextIds.watchlist++,
    userId,
    market: input.market,
    symbol: normalizedSymbol,
    name: input.name,
    priority: input.priority,
    lastPrice: 0,
    changePct: 0,
    volume: 0,
    turnover: 0,
    openPrice: 0,
    highPrice: 0,
    lowPrice: 0,
    prevClosePrice: 0,
    sourceMode: "pending",
    isActive: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  workspace.watchlistItems.push(record);
  return record;
}

export function removeWatchlistItem(userId: number, id: number): boolean {
  const workspace = getWorkspace(userId);
  const before = workspace.watchlistItems.length;
  workspace.watchlistItems = workspace.watchlistItems.filter(item => item.id !== id);
  return workspace.watchlistItems.length < before;
}

export function reprioritizeWatchlistItem(userId: number, id: number, priority: number): WatchlistRecord | null {
  const workspace = getWorkspace(userId);
  const item = workspace.watchlistItems.find(entry => entry.id === id);
  if (!item) return null;
  item.priority = priority;
  item.updatedAt = Date.now();
  return item;
}

export function listSignals(userId: number): SignalRecord[] {
  return [...getWorkspace(userId).signals].sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export function listScopedSignals(userId: number): SignalRecord[] {
  return listDisplaySignals(userId);
}

export function updateSignalInterpretation(userId: number, signalId: number, interpretation: string): SignalRecord | null {
  const signal = getWorkspace(userId).signals.find(item => item.id === signalId);
  if (!signal) return null;
  signal.llmInterpretation = interpretation;
  return signal;
}

export function updateSignalForecastInsight(
  userId: number,
  signalId: number,
  input: {
    interpretation?: string | null;
    forecastSummary?: string | null;
    forecastBias?: string | null;
    forecastSlope?: number | null;
    forecastConfidence?: number | null;
  }
): SignalRecord | null {
  const signal = getWorkspace(userId).signals.find(item => item.id === signalId);
  if (!signal) return null;
  if (input.interpretation !== undefined) signal.llmInterpretation = input.interpretation;
  if (input.forecastSummary !== undefined) signal.llmForecastSummary = input.forecastSummary;
  if (input.forecastBias !== undefined) signal.llmForecastBias = input.forecastBias;
  if (input.forecastSlope !== undefined) signal.llmForecastSlope = input.forecastSlope;
  if (input.forecastConfidence !== undefined) signal.llmForecastConfidence = input.forecastConfidence;
  signal.llmForecastGeneratedAtMs = Date.now();
  return signal;
}

export function listAlerts(userId: number): AlertRecord[] {
  return [...getWorkspace(userId).alerts].sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export function markAlertNotificationTriggered(userId: number, alertId: number): AlertRecord | null {
  const alert = getWorkspace(userId).alerts.find(item => item.id === alertId);
  if (!alert) return null;
  alert.notifyTriggered = 1;
  return alert;
}

export function createAlertFromSignal(
  userId: number,
  signal: SignalRecord,
  level: AlertLevel,
  title: string,
  message: string
): AlertRecord {
  const workspace = getWorkspace(userId);
  const alert: AlertRecord = {
    id: workspace.nextIds.alert++,
    userId,
    signalId: signal.id,
    market: signal.market,
    symbol: signal.symbol,
    signalType: signal.signalType,
    level,
    title,
    message,
    notifyTriggered: 0,
    sourceMode: signal.sourceMode,
    triggerAction: signal.triggerAction,
    triggerPrice: signal.triggerPrice,
    createdAtMs: Date.now(),
  };
  workspace.alerts.unshift(alert);
  return alert;
}

export function listScanResults(userId: number): ScanRecord[] {
  return [...getWorkspace(userId).scanResults].sort((a, b) => b.rankScore - a.rankScore);
}

export function getLatestReview(userId: number): ReviewRecord {
  return getWorkspace(userId).reviewReport;
}

export function getSettings(userId: number): SettingsRecord {
  const settings = getWorkspace(userId).settings;
  return {
    ...settings,
    liveBridge: {
      ...settings.liveBridge,
      connectionStatus: resolveBridgeStatus(settings.liveBridge),
    },
  };
}

export function saveSettings(
  userId: number,
  input: {
    scanThresholds: SettingsRecord["scanThresholds"];
    signalSensitivity: SignalSensitivity;
    alertLevelPreference: AlertLevel;
    watchlistLimit: number;
    highScoreNotifyThreshold: number;
    liveBridge: Pick<SettingsRecord["liveBridge"], "opendHost" | "opendPort" | "trackedSymbols" | "bridgeToken" | "publishIntervalSeconds" | "useLiveQuotes">;
  }
): SettingsRecord {
  const workspace = getWorkspace(userId);
  workspace.settings = {
    ...workspace.settings,
    scanThresholds: input.scanThresholds,
    signalSensitivity: input.signalSensitivity,
    alertLevelPreference: input.alertLevelPreference,
    watchlistLimit: input.watchlistLimit,
    highScoreNotifyThreshold: input.highScoreNotifyThreshold,
    liveBridge: {
      ...workspace.settings.liveBridge,
      opendHost: input.liveBridge.opendHost,
      opendPort: input.liveBridge.opendPort,
      trackedSymbols: normalizeTrackedSymbols("HK", input.liveBridge.trackedSymbols),
      bridgeToken: input.liveBridge.bridgeToken,
      publishIntervalSeconds: input.liveBridge.publishIntervalSeconds,
      useLiveQuotes: input.liveBridge.useLiveQuotes,
      connectionStatus: resolveBridgeStatus(workspace.settings.liveBridge),
    },
    updatedAt: Date.now(),
  };
  return getSettings(userId);
}

export function ingestLiveQuotes(userId: number, input: LiveBridgeIngestInput) {
  const workspace = getWorkspace(userId);
  const bridgeTimestamp = input.bridgeTimestampMs ?? Date.now();
  const trackedSymbols = normalizeTrackedSymbols("HK", input.trackedSymbols ?? input.quotes.map(quote => quote.symbol));

  workspace.settings.liveBridge = {
    ...workspace.settings.liveBridge,
    opendHost: input.opendHost,
    opendPort: input.opendPort,
    trackedSymbols,
    publishIntervalSeconds: input.publishIntervalSeconds ?? workspace.settings.liveBridge.publishIntervalSeconds,
    useLiveQuotes: true,
    lastBridgeHeartbeatAt: bridgeTimestamp,
    lastQuoteAt: input.quotes.length > 0 ? bridgeTimestamp : workspace.settings.liveBridge.lastQuoteAt,
    lastError: input.error ?? null,
    connectionStatus: input.error ? "异常" : "已连接",
  };

  const updatedSymbols: string[] = [];
  const generatedSignals: SignalRecord[] = [];

  for (const quote of input.quotes) {
    const normalizedQuote: LiveQuoteInput = {
      ...quote,
      market: quote.market,
      symbol: normalizeSymbol(quote.market, quote.symbol),
      name: quote.name,
      lastPrice: Number(quote.lastPrice),
      volume: Number(quote.volume),
      turnover: Number(quote.turnover),
      openPrice: Number(quote.openPrice),
      highPrice: Number(quote.highPrice),
      lowPrice: Number(quote.lowPrice),
      prevClosePrice: Number(quote.prevClosePrice),
    };

    upsertWatchlistQuote(userId, normalizedQuote);
    upsertPriceHistory(userId, normalizedQuote);
    updateSignalLearningFromQuote(userId, normalizedQuote);
    updatedSymbols.push(normalizedQuote.symbol);
    const signal = upsertSignalFromQuote(userId, normalizedQuote, workspace.settings);
    if (signal) {
      generatedSignals.push(signal);
      ensureAlertForSignal(userId, signal, workspace.settings);
    }
  }

  return {
    ok: true,
    productName: PRODUCT_NAME,
    updatedSymbols: Array.from(new Set(updatedSymbols)),
    generatedSignals: generatedSignals.map(signal => ({
      symbol: signal.symbol,
      signalType: signal.signalType,
      score: signal.score,
    })),
    liveBridge: getSettings(userId).liveBridge,
  };
}

export function getMarketStatus() {
  const nowDate = new Date();
  const utcHour = nowDate.getUTCHours();
  const utcMinute = nowDate.getUTCMinutes();
  const usMinutes = ((utcHour - 4 + 24) % 24) * 60 + utcMinute;
  const hkMinutes = ((utcHour + 8) % 24) * 60 + utcMinute;

  const isUsRegular = usMinutes >= 9 * 60 + 30 && usMinutes <= 16 * 60;
  const isUsPre = usMinutes >= 4 * 60 && usMinutes < 9 * 60 + 30;
  const isUsAfter = usMinutes > 16 * 60 && usMinutes <= 20 * 60;
  const isHkMorning = hkMinutes >= 9 * 60 + 30 && hkMinutes < 12 * 60;
  const isHkAfternoon = hkMinutes >= 13 * 60 && hkMinutes <= 16 * 60;

  return {
    US: isUsRegular ? "常规开盘" : isUsPre ? "盘前" : isUsAfter ? "盘后" : "休市",
    HK: isHkMorning || isHkAfternoon ? "开盘中" : "休市",
  } as const;
}

export function summarizeDashboard(userId: number) {
  const workspace = getWorkspace(userId);
  const watchlist = scopedWatchlist(userId);
  const signals = listSignals(userId);
  const displaySignals = listDisplaySignals(userId);
  const watchlistKeySet = new Set(watchlist.map(item => symbolKey(item.market, item.symbol)));
  const watchlistMap = new Map(watchlist.map(item => [symbolKey(item.market, item.symbol), item]));
  const alerts = listAlerts(userId).filter(alert => watchlistKeySet.has(symbolKey(alert.market, alert.symbol)));
  const review = getLatestReview(userId);
  const settings = getSettings(userId);
  const latestSignals = displaySignals.slice(0, 4).map(signal => {
    const matchedSecurity = watchlistMap.get(symbolKey(signal.market, signal.symbol))
      ?? workspace.watchlistItems.find(item => symbolKey(item.market, item.symbol) === symbolKey(signal.market, signal.symbol))
      ?? null;
    const matchedName = matchedSecurity?.name ?? signal.symbol;
    return {
      ...signal,
      name: matchedName,
      securityLabel: `${signal.symbol} · ${matchedName}`,
      identityKey: symbolKey(signal.market, signal.symbol),
    };
  });
  const alertStats = {
    total: alerts.length,
    critical: alerts.filter(alert => alert.level === "CRITICAL").length,
    warning: alerts.filter(alert => alert.level === "WARNING").length,
    info: alerts.filter(alert => alert.level === "INFO").length,
  };

  const liveBoard = watchlist.slice(0, 8).map(item => {
    const activeSignal = displaySignals.find(signal => signal.symbol === item.symbol && signal.market === item.market) ?? null;
    const signalFamily = signals.filter(signal => signal.symbol === item.symbol && signal.market === item.market);
    const latestInvalidatedSignal = signalFamily.find(signal => signal.learningStatus === "已验证失效") ?? null;
    const learning = summarizeSignalLearning(signalFamily);
    const history = workspace.priceHistory[symbolKey(item.market, item.symbol)] ?? [];
    const chart = buildForecastCurve(item, history, activeSignal);
    const simulation = buildSimulationTape(item, history, signalFamily);
    const forecastEnd = chart[chart.length - 1]?.forecastPrice ?? item.lastPrice;
    const trendBias = forecastEnd >= item.lastPrice ? "偏多" : "偏空";
    const activeReasoning = activeSignal ? deriveSignalReasoning(workspace, item, activeSignal, history) : null;
    const activeParameterFeedback = activeSignal ? deriveAdaptiveParameterFeedback(workspace, item.market, item.symbol, activeSignal.signalType) : null;
    const eventInputs = activeSignal ? {
      macro: { source: settings.liveBridge.useLiveQuotes ? "live_quote_proxy" : "awaiting_bridge_proxy", score: round(activeSignal.quoteChangePct * 0.45, 2) },
      news: { source: activeSignal.llmForecastGeneratedAtMs ? "llm_summary_proxy" : "price_action_proxy", score: round((activeSignal.score - 70) / 10, 2) },
      companyEvent: { source: activeSignal.signalType === "突破啟動" ? "breakout_structure_proxy" : "signal_structure_proxy", score: round((activeSignal.direction === "做空" ? -1 : 1) * 1.2, 2) },
      sentiment: { source: activeSignal.llmForecastBias ? "llm_bias_proxy" : "volume_proxy", score: round(activeSignal.direction === "做空" ? -0.8 : 0.8, 2) },
    } : null;
    return {
      ...item,
      securityLabel: `${item.symbol} · ${item.name}`,
      identityKey: symbolKey(item.market, item.symbol),
      activeSignalType: activeSignal?.signalType ?? null,
      activeSignalScore: activeSignal?.score ?? null,
      suggestionDirection: activeSignal?.direction ?? null,
      suggestionAction: activeSignal?.triggerAction ?? null,
      suggestionTriggerPrice: activeSignal?.triggerPrice ?? null,
      suggestionStopLossPrice: activeSignal?.stopLossPrice ?? null,
      suggestionEntryRange: activeSignal?.entryRange ?? null,
      sourceMode: item.sourceMode,
      chart,
      simulationTape: simulation.trades,
      simulationSummary: simulation.summary,
      signalReasoning: activeReasoning,
      parameterFeedback: activeParameterFeedback,
      eventInputs,
      forecastSummary: {
        trendBias,
        predictedPrice: forecastEnd,
        predictedChangePct: item.lastPrice > 0 ? round(((forecastEnd - item.lastPrice) / item.lastPrice) * 100, 2) : 0,
        confidence: Math.round(clamp((activeSignal?.score ?? 72) * (learning.adaptiveWeight ?? 1), 55, 99)),
      },
      strategyLearning: {
        successRate: learning.successRate,
        evaluatedCount: learning.evaluatedCount,
        averageReturnPct: learning.averageReturnPct,
        averageAdversePct: learning.averageAdversePct,
        rewardScore: learning.rewardScore,
        sharpeLikeScore: learning.sharpeLikeScore,
        adaptiveWeight: learning.adaptiveWeight,
      },
      executionPrerequisite: activeSignal?.executionPrerequisite ?? (latestInvalidatedSignal ? "旧建议已失效，等待新的价格结构与量能确认后再生成实时指令。" : "等待价格与成交量同时确认。"),
      riskLevel: activeSignal?.riskLevel ?? (latestInvalidatedSignal ? "高" : "中"),
      failureReason: activeSignal?.failureReason ?? latestInvalidatedSignal?.failureReason ?? null,
      llmStrategyNote: activeSignal?.llmInterpretation ?? `${item.symbol} 正在等待更多真实行情样本，系统将在桥接持续推送后滚动更新执行摘要与策略偏向。`,
      llmForecastSummary: activeSignal?.llmForecastSummary ?? `${item.symbol} 当前仅保留真实行情驱动模式；若尚未收到实时行情，预测栏会显示等待桥接中的运行状态。`,
      llmForecastBias: activeSignal?.llmForecastBias ?? trendBias,
      llmForecastGeneratedAtMs: activeSignal?.llmForecastGeneratedAtMs ?? null,
      latestMarker: {
        label: history[history.length - 1]?.label ?? null,
        price: item.lastPrice,
      },
      triggerMarker: activeSignal?.triggerPrice ? {
        label: history[history.length - 1]?.label ?? null,
        price: activeSignal.triggerPrice,
        action: activeSignal.triggerAction,
      } : null,
      simulationMarkers: simulation.trades.map(trade => ({
        signalId: trade.signalId,
        label: trade.markerLabel,
        price: trade.markerPrice,
        action: trade.action,
        tone: trade.markerTone,
        pnlPct: trade.statusLabel === "持仓中" ? trade.unrealizedPnlPct : trade.realizedPnlPct,
        explanation: trade.explanation,
        reasoning: trade.reasoning,
        parameterFeedback: trade.parameterFeedback,
      })),
    };
  });

  const strategyLearning = summarizeSignalLearning(signals);

  return {
    productName: PRODUCT_NAME,
    marketStatus: getMarketStatus(),
    watchlist,
    latestSignals,
    alertStats,
    hitRate: review.hitRate,
    highScoreCount: displaySignals.filter(signal => signal.score >= settings.highScoreNotifyThreshold).length,
    liveBridge: {
      ...settings.liveBridge,
        sourceLabel: settings.liveBridge.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Real Data Required · Awaiting Bridge",

    },
    liveBoard,
    strategyLearning: {
      successRate: strategyLearning.successRate,
      evaluatedCount: strategyLearning.evaluatedCount,
      averageReturnPct: strategyLearning.averageReturnPct,
      averageAdversePct: strategyLearning.averageAdversePct,
      rewardScore: strategyLearning.rewardScore,
      sharpeLikeScore: strategyLearning.sharpeLikeScore,
      adaptiveWeight: strategyLearning.adaptiveWeight,
      strongestSignalType: review.meta.accuracyBySignal.sort((a, b) => b.hitRate - a.hitRate)[0]?.signalType ?? "突破啟動",
      weakestSignalType: review.meta.accuracyBySignal.sort((a, b) => a.hitRate - b.hitRate)[0]?.signalType ?? "盤口失衡",
    },
  };
}
