export type Market = "US" | "HK";
import { DEFAULT_TRACKED_SYMBOLS } from "../shared/trackedSecurities";

export type SignalType = "突破啟動" | "回踩續強" | "盤口失衡" | "冲高衰竭";
export type AlertLevel = "INFO" | "WARNING" | "CRITICAL";
export type Direction = "做多" | "做空" | "观察";
export type SignalSensitivity = "保守" | "标准" | "激进";
export type BridgeConnectionStatus = "未连接" | "已连接" | "陈旧" | "异常";
export type QuoteSourceMode = "pending" | "live";
export type TriggerAction = "买入提醒" | "卖出提醒" | "观察提醒";
export type StrategyOutcomeStatus = "待验证" | "已验证有效" | "已验证失效";

export type PriceHistoryPoint = {
  timestampMs: number;
  label: string;
  price: number;
  forecastPrice: number;
  volume: number;
  changePct: number;
};

export type WatchlistRecord = {
  id: number;
  userId: number;
  market: Market;
  symbol: string;
  name: string;
  priority: number;
  lastPrice: number;
  changePct: number;
  volume: number;
  turnover: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  prevClosePrice: number;
  sourceMode: QuoteSourceMode;
  isActive: number;
  createdAt: number;
  updatedAt: number;
};

export type SignalRecord = {
  id: number;
  userId: number;
  market: Market;
  symbol: string;
  signalType: SignalType;
  score: number;
  triggerReason: string;
  riskTags: string[];
  riskLevel: "低" | "中" | "高";
  executionPrerequisite: string;
  direction: Direction;
  triggerAction: TriggerAction;
  triggerPrice: number;
  stopLossPrice: number | null;
  invalidationCondition: string;
  entryRange: string;
  stopLoss: string;
  rationale: string;
  llmInterpretation: string | null;
  llmForecastSummary: string | null;
  llmForecastBias: string | null;
  llmForecastSlope: number | null;
  llmForecastConfidence: number | null;
  llmForecastGeneratedAtMs: number | null;
  sourceMode: QuoteSourceMode;
  quotePrice: number;
  quoteChangePct: number;
  quoteVolume: number;
  learningStatus: StrategyOutcomeStatus;
  realizedReturnPct: number | null;
  adverseMovePct: number | null;
  failureReason: string | null;
  reviewedAtMs: number | null;
  strategyWeight: number;
  createdAtMs: number;
};

export type AlertRecord = {
  id: number;
  userId: number;
  signalId: number | null;
  market: Market;
  symbol: string;
  signalType: SignalType;
  level: AlertLevel;
  title: string;
  message: string;
  notifyTriggered: number;
  sourceMode: QuoteSourceMode;
  triggerAction?: TriggerAction;
  triggerPrice?: number;
  createdAtMs: number;
};

export type ScanRecord = {
  id: number;
  userId: number;
  market: Market;
  symbol: string;
  name: string;
  volumeRatio: number;
  turnover: number;
  premarketChangePct: number;
  rankScore: number;
  notes: string;
  scanDate: string;
};

export type ReviewRecord = {
  id: number;
  userId: number;
  reviewDate: string;
  hitRate: number;
  falsePositiveAnalysis: string;
  bestSignal: string;
  worstSignal: string;
  meta: {
    accuracyBySignal: Array<{ signalType: SignalType; hitRate: number; occurrences: number }>;
    commentary: string;
  };
};

export type LiveBridgeSettings = {
  provider: "FUTU_LOCAL_OPEND";
  opendHost: string;
  opendPort: number;
  trackedSymbols: string[];
  bridgeToken: string;
  publishIntervalSeconds: number;
  useLiveQuotes: boolean;
  connectionStatus: BridgeConnectionStatus;
  lastBridgeHeartbeatAt: number | null;
  lastQuoteAt: number | null;
  lastError: string | null;
};

export type SettingsRecord = {
  id: number;
  userId: number;
  scanThresholds: {
    minVolumeRatio: number;
    minTurnover: number;
    minPremarketChangePct: number;
  };
  signalSensitivity: SignalSensitivity;
  alertLevelPreference: AlertLevel;
  watchlistLimit: number;
  highScoreNotifyThreshold: number;
  liveBridge: LiveBridgeSettings;
  updatedAt: number;
};

export type TradingWorkspace = {
  watchlistItems: WatchlistRecord[];
  signals: SignalRecord[];
  alerts: AlertRecord[];
  scanResults: ScanRecord[];
  reviewReport: ReviewRecord;
  settings: SettingsRecord;
  priceHistory: Record<string, PriceHistoryPoint[]>;
  nextIds: {
    watchlist: number;
    signal: number;
    alert: number;
    scan: number;
    review: number;
    settings: number;
  };
};

const workspaceStore = new Map<number, TradingWorkspace>();

const now = Date.now();
const today = new Date(now).toISOString().slice(0, 10);

function defaultBridgeToken(userId: number) {
  return `sw-bridge-${userId}-realtime`;
}

function seededWatchlist(_userId: number): WatchlistRecord[] {
  return [];
}

function createSeedHistory(lastPrice: number, prevClosePrice: number, volume: number): PriceHistoryPoint[] {
  const points = 24;
  return Array.from({ length: points }, (_, index) => {
    const progress = index / (points - 1);
    const wave = Math.sin(index / 3) * lastPrice * 0.0035;
    const drift = (lastPrice - prevClosePrice) * progress;
    const price = Number((prevClosePrice + drift + wave).toFixed(2));
    const changePct = prevClosePrice > 0 ? Number((((price - prevClosePrice) / prevClosePrice) * 100).toFixed(2)) : 0;
    const forecastDelta = Math.cos(index / 4) * lastPrice * 0.002 + (lastPrice - price) * 0.18;
    return {
      timestampMs: now - (points - index) * 4 * 60 * 1000,
      label: new Date(now - (points - index) * 4 * 60 * 1000).toLocaleTimeString("zh-Hans", { hour: "2-digit", minute: "2-digit" }),
      price,
      forecastPrice: Number((price + forecastDelta).toFixed(2)),
      volume: Math.round(volume * (0.55 + progress * 0.45)),
      changePct,
    };
  });
}

function seededSignals(_userId: number): SignalRecord[] {
  return [];
}

function seededAlerts(_userId: number): AlertRecord[] {
  return [];
}

function seededScans(_userId: number): ScanRecord[] {
  return [];
}

function seededReview(userId: number): ReviewRecord {
  return {
    id: 1,
    userId,
    reviewDate: today,
    hitRate: 0,
    falsePositiveAnalysis: "尚未接入真实桥接行情，暂无可复盘的误报分析。",
    bestSignal: "暂无真实样本",
    worstSignal: "暂无真实样本",
    meta: {
      accuracyBySignal: [
        { signalType: "突破啟動", hitRate: 0, occurrences: 0 },
        { signalType: "回踩續強", hitRate: 0, occurrences: 0 },
        { signalType: "盤口失衡", hitRate: 0, occurrences: 0 },
        { signalType: "冲高衰竭", hitRate: 0, occurrences: 0 },
      ],
      commentary: "请先连接真实行情桥接并积累真实信号样本，系统才会生成有效的命中率与策略复盘。",
    },
  };
}

function seededSettings(userId: number): SettingsRecord {
  return {
    id: 1,
    userId,
    scanThresholds: {
      minVolumeRatio: 2.2,
      minTurnover: 120000000,
      minPremarketChangePct: 2.0,
    },
    signalSensitivity: "标准",
    alertLevelPreference: "WARNING",
    watchlistLimit: 30,
    highScoreNotifyThreshold: 88,
    liveBridge: {
      provider: "FUTU_LOCAL_OPEND",
      opendHost: "127.0.0.1",
      opendPort: 11111,
      trackedSymbols: [...DEFAULT_TRACKED_SYMBOLS],
      bridgeToken: defaultBridgeToken(userId),
      publishIntervalSeconds: 3,
      useLiveQuotes: true,
      connectionStatus: "未连接",
      lastBridgeHeartbeatAt: null,
      lastQuoteAt: null,
      lastError: null,
    },
    updatedAt: now,
  };
}

function createSeedWorkspace(userId: number): TradingWorkspace {
  const watchlistItems = seededWatchlist(userId);
  return {
    watchlistItems,
    signals: seededSignals(userId),
    alerts: seededAlerts(userId),
    scanResults: seededScans(userId),
    reviewReport: seededReview(userId),
    settings: seededSettings(userId),
    priceHistory: Object.fromEntries(
      watchlistItems.map(item => [
        `${item.market}:${item.symbol}`,
        createSeedHistory(item.lastPrice, item.prevClosePrice, item.volume),
      ])
    ),
    nextIds: {
      watchlist: 1,
      signal: 1,
      alert: 1,
      scan: 1,
      review: 2,
      settings: 2,
    },
  };
}

export function getWorkspace(userId: number): TradingWorkspace {
  const existing = workspaceStore.get(userId);
  if (existing) return existing;
  const seeded = createSeedWorkspace(userId);
  workspaceStore.set(userId, seeded);
  return seeded;
}

export function resetWorkspace(userId: number): TradingWorkspace {
  const seeded = createSeedWorkspace(userId);
  workspaceStore.set(userId, seeded);
  return seeded;
}
