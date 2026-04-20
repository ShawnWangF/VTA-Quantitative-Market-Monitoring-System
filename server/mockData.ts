export type Market = "US" | "HK";
export type SignalType = "突破啟動" | "回踩續強" | "盤口失衡" | "冲高衰竭";
export type AlertLevel = "INFO" | "WARNING" | "CRITICAL";
export type Direction = "做多" | "做空" | "观察";
export type SignalSensitivity = "保守" | "标准" | "激进";
export type BridgeConnectionStatus = "未连接" | "已连接" | "陈旧" | "异常";
export type QuoteSourceMode = "demo" | "live";
export type TriggerAction = "买入提醒" | "卖出提醒" | "观察提醒";

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
  direction: Direction;
  triggerAction: TriggerAction;
  triggerPrice: number;
  stopLossPrice: number | null;
  invalidationCondition: string;
  entryRange: string;
  stopLoss: string;
  rationale: string;
  llmInterpretation: string | null;
  sourceMode: QuoteSourceMode;
  quotePrice: number;
  quoteChangePct: number;
  quoteVolume: number;
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
      direction: "做多",
      triggerAction: "买入提醒",
      triggerPrice: 37.05,
      stopLossPrice: 35.95,
      invalidationCondition: "若回落并跌破 35.95，则本次突破跟进逻辑失效。",
      entryRange: "买入触发价 37.05",
      stopLoss: "跌破 35.95 需降低仓位",
      rationale: "价格与成交额同步提升，属于高景气题材下的动量延续结构。",
      llmInterpretation: null,
      sourceMode: "demo",
      quotePrice: 36.92,
      quoteChangePct: 3.12,
      quoteVolume: 10682000,
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
      direction: "做多",
      triggerAction: "买入提醒",
      triggerPrice: 117.85,
      stopLossPrice: 116.35,
      invalidationCondition: "若跌回 116.35 下方，说明回踩承接失败，本次买入提醒失效。",
      entryRange: "买入触发价 117.85",
      stopLoss: "失守 116.35 需谨慎",
      rationale: "回踩后的承接仍在，若再度放量，具备继续向上试高的条件。",
      llmInterpretation: null,
      sourceMode: "demo",
      quotePrice: 117.8,
      quoteChangePct: 1.46,
      quoteVolume: 18243000,
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
  return {
    watchlistItems: seededWatchlist(userId),
    signals: seededSignals(userId),
    alerts: seededAlerts(userId),
    scanResults: seededScans(userId),
    reviewReport: seededReview(userId),
    settings: seededSettings(userId),
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
