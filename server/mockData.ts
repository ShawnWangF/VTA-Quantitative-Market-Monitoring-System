export type Market = "US" | "HK";
export type SignalType = "突破啟動" | "回踩續強" | "盤口失衡" | "冲高衰竭";
export type AlertLevel = "INFO" | "WARNING" | "CRITICAL";
export type Direction = "做多" | "做空" | "观察";
export type SignalSensitivity = "保守" | "标准" | "激进";
export type BridgeConnectionStatus = "未连接" | "已连接" | "陈旧" | "异常";
export type QuoteSourceMode = "demo" | "live";
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
  return `sw-bridge-${userId}-3690-9992-live`;
}

function seededWatchlist(userId: number): WatchlistRecord[] {
  return [
    {
      id: 1,
      userId,
      market: "HK",
      symbol: "03690",
      name: "美团-W",
      priority: 5,
      lastPrice: 117.8,
      changePct: 1.46,
      volume: 18243000,
      turnover: 2130000000,
      openPrice: 116.2,
      highPrice: 118.4,
      lowPrice: 115.9,
      prevClosePrice: 116.1,
      sourceMode: "demo",
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      userId,
      market: "HK",
      symbol: "09992",
      name: "泡泡玛特",
      priority: 5,
      lastPrice: 36.92,
      changePct: 3.12,
      volume: 10682000,
      turnover: 392000000,
      openPrice: 35.68,
      highPrice: 37.18,
      lowPrice: 35.54,
      prevClosePrice: 35.8,
      sourceMode: "demo",
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];
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

function seededSignals(userId: number): SignalRecord[] {
  return [
    {
      id: 1,
      userId,
      market: "HK",
      symbol: "09992",
      signalType: "突破啟動",
      score: 90,
      triggerReason: "泡泡玛特早盘跳空后持续放量，价格贴近当日高点，趋势启动结构清晰。",
      riskTags: ["高位波动", "追价滑点"],
      riskLevel: "高",
      executionPrerequisite: "价格放量站上触发位后，至少一个刷新周期不跌回触发位下方。",
      direction: "做多",
      triggerAction: "买入提醒",
      triggerPrice: 37.05,
      stopLossPrice: 35.95,
      invalidationCondition: "若回落并跌破 35.95，则本次突破跟进逻辑失效。",
      entryRange: "买入触发价 37.05",
      stopLoss: "跌破 35.95 需降低仓位",
      rationale: "价格与成交额同步提升，属于高景气题材下的动量延续结构。",
      llmInterpretation: null,
      llmForecastSummary: "大模型判断该标的仍处于偏多延续结构，但需要防止高位放量后的冲高回落。",
      llmForecastBias: "偏多延续",
      llmForecastSlope: 0.38,
      llmForecastConfidence: 88,
      llmForecastGeneratedAtMs: now - 3 * 60 * 1000,
      sourceMode: "demo",
      quotePrice: 36.92,
      quoteChangePct: 3.12,
      quoteVolume: 10682000,
      learningStatus: "已验证有效",
      realizedReturnPct: 4.6,
      adverseMovePct: -0.9,
      failureReason: null,
      reviewedAtMs: now - 2 * 60 * 1000,
      strategyWeight: 1.08,
      createdAtMs: now - 4 * 60 * 1000,
    },
    {
      id: 2,
      userId,
      market: "HK",
      symbol: "03690",
      signalType: "回踩續強",
      score: 82,
      triggerReason: "美团早盘上冲后回踩开盘中轴企稳，重新站回短线强势区。",
      riskTags: ["午后回落", "二次确认失败"],
      riskLevel: "中",
      executionPrerequisite: "回踩后不跌破关键承接位，并重新站回触发价。",
      direction: "做多",
      triggerAction: "买入提醒",
      triggerPrice: 117.85,
      stopLossPrice: 116.35,
      invalidationCondition: "若跌回 116.35 下方，说明回踩承接失败，本次买入提醒失效。",
      entryRange: "买入触发价 117.85",
      stopLoss: "失守 116.35 需谨慎",
      rationale: "回踩后的承接仍在，若再度放量，具备继续向上试高的条件。",
      llmInterpretation: null,
      llmForecastSummary: "大模型判断回踩结构尚未破坏，若承接维持，后续仍有再次上探的概率。",
      llmForecastBias: "回踩偏多",
      llmForecastSlope: 0.21,
      llmForecastConfidence: 81,
      llmForecastGeneratedAtMs: now - 8 * 60 * 1000,
      sourceMode: "demo",
      quotePrice: 117.8,
      quoteChangePct: 1.46,
      quoteVolume: 18243000,
      learningStatus: "待验证",
      realizedReturnPct: null,
      adverseMovePct: null,
      failureReason: null,
      reviewedAtMs: null,
      strategyWeight: 1.02,
      createdAtMs: now - 11 * 60 * 1000,
    },
  ];
}

function seededAlerts(userId: number): AlertRecord[] {
  return [
    {
      id: 1,
      userId,
      signalId: 1,
      market: "HK",
      symbol: "09992",
      signalType: "突破啟動",
      level: "CRITICAL",
      title: "泡泡玛特高评分突破啟動",
      message: "09992 量价同步增强，已经进入高优先级观察区。",
      notifyTriggered: 0,
      sourceMode: "demo",
      createdAtMs: now - 4 * 60 * 1000,
    },
    {
      id: 2,
      userId,
      signalId: 2,
      market: "HK",
      symbol: "03690",
      signalType: "回踩續強",
      level: "WARNING",
      title: "美团回踩續強确认",
      message: "03690 在关键回踩位出现承接，属于可继续跟踪的延续结构。",
      notifyTriggered: 0,
      sourceMode: "demo",
      createdAtMs: now - 11 * 60 * 1000,
    },
  ];
}

function seededScans(userId: number): ScanRecord[] {
  return [
    {
      id: 1,
      userId,
      market: "HK",
      symbol: "09992",
      name: "泡泡玛特",
      volumeRatio: 2.9,
      turnover: 392000000,
      premarketChangePct: 3.1,
      rankScore: 92,
      notes: "高弹性消费股中最具趋势延续性的样本，适合列入一级观察池。",
      scanDate: today,
    },
    {
      id: 2,
      userId,
      market: "HK",
      symbol: "03690",
      name: "美团-W",
      volumeRatio: 2.4,
      turnover: 2130000000,
      premarketChangePct: 1.4,
      rankScore: 85,
      notes: "成交额优势显著，适合作为港股大盘风格的核心锚点标的。",
      scanDate: today,
    },
    {
      id: 3,
      userId,
      market: "HK",
      symbol: "01810",
      name: "小米集团-W",
      volumeRatio: 2.1,
      turnover: 586000000,
      premarketChangePct: 2.2,
      rankScore: 78,
      notes: "具备跟随补涨潜力，但当前优先级低于美团与泡泡玛特。",
      scanDate: today,
    },
  ];
}

function seededReview(userId: number): ReviewRecord {
  return {
    id: 1,
    userId,
    reviewDate: today,
    hitRate: 68,
    falsePositiveAnalysis: "误报主要集中在午后流动性回落阶段，部分结构虽然价格维持强势，但成交额没有继续扩张，导致延续性不足。",
    bestSignal: "突破啟動：在港股高热度主题里，量价共振最强的样本表现最佳。",
    worstSignal: "盤口失衡：若只有报价变化而缺乏更深盘口确认，可靠性会明显下降。",
    meta: {
      accuracyBySignal: [
        { signalType: "突破啟動", hitRate: 78, occurrences: 13 },
        { signalType: "回踩續強", hitRate: 71, occurrences: 12 },
        { signalType: "盤口失衡", hitRate: 55, occurrences: 16 },
        { signalType: "冲高衰竭", hitRate: 63, occurrences: 10 },
      ],
      commentary: "港股短线环境中，量价同步强于单纯报价异动；后续若叠加逐笔与盘口数据，盘口失衡信号的可靠性还可以继续提升。",
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
      trackedSymbols: ["03690", "09992"],
      bridgeToken: defaultBridgeToken(userId),
      publishIntervalSeconds: 3,
      useLiveQuotes: false,
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
      watchlist: 3,
      signal: 3,
      alert: 3,
      scan: 4,
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
