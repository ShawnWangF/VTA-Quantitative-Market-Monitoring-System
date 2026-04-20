export type Market = "US" | "HK";
export type SignalType = "突破啟動" | "回踩續強" | "盤口失衡" | "冲高衰竭";
export type AlertLevel = "INFO" | "WARNING" | "CRITICAL";
export type Direction = "做多" | "做空" | "观察";
export type SignalSensitivity = "保守" | "标准" | "激进";

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
  entryRange: string;
  stopLoss: string;
  rationale: string;
  llmInterpretation: string | null;
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

function seededWatchlist(userId: number): WatchlistRecord[] {
  return [
    {
      id: 1,
      userId,
      market: "US",
      symbol: "NVDA",
      name: "NVIDIA",
      priority: 5,
      lastPrice: 961.24,
      changePct: 3.48,
      volume: 38420000,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      userId,
      market: "US",
      symbol: "TSLA",
      name: "Tesla",
      priority: 4,
      lastPrice: 212.84,
      changePct: 2.11,
      volume: 55120000,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      userId,
      market: "HK",
      symbol: "00700",
      name: "腾讯控股",
      priority: 5,
      lastPrice: 326.4,
      changePct: 1.62,
      volume: 16230000,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 4,
      userId,
      market: "HK",
      symbol: "09988",
      name: "阿里巴巴-SW",
      priority: 3,
      lastPrice: 78.1,
      changePct: -0.62,
      volume: 28420000,
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
      market: "US",
      symbol: "NVDA",
      signalType: "突破啟動",
      score: 91,
      triggerReason: "盘前强势高开后，1 分钟结构突破前高，量比与主动买盘同步抬升。",
      riskTags: ["追高波动", "开盘滑点"],
      direction: "做多",
      entryRange: "958.0 - 964.5",
      stopLoss: "跌破 951.0 关注撤退",
      rationale: "价格强势突破关键阻力，同时量能与盘口承接共振，属于高质量趋势启动结构。",
      llmInterpretation: null,
      createdAtMs: now - 3 * 60 * 1000,
    },
    {
      id: 2,
      userId,
      market: "HK",
      symbol: "00700",
      signalType: "回踩續強",
      score: 84,
      triggerReason: "早盘突破后回踩 VWAP 获得承接，再次放量站回前高。",
      riskTags: ["假突破回落"],
      direction: "做多",
      entryRange: "324.8 - 327.0",
      stopLoss: "失守 322.6 关注风险",
      rationale: "回踩不破关键均价区，说明资金承接仍在，二次上攻具有延续概率。",
      llmInterpretation: null,
      createdAtMs: now - 12 * 60 * 1000,
    },
    {
      id: 3,
      userId,
      market: "US",
      symbol: "TSLA",
      signalType: "盤口失衡",
      score: 78,
      triggerReason: "买盘挂单密度显著高于卖盘，盘口连续两轮出现承接强化。",
      riskTags: ["盘口诱导"],
      direction: "观察",
      entryRange: "211.5 - 213.0",
      stopLoss: "跌破 209.8 需谨慎",
      rationale: "盘口优势明确，但仍需观察逐笔成交是否继续确认。",
      llmInterpretation: null,
      createdAtMs: now - 18 * 60 * 1000,
    },
    {
      id: 4,
      userId,
      market: "HK",
      symbol: "09988",
      signalType: "冲高衰竭",
      score: 73,
      triggerReason: "冲高新高后主动买盘减弱，上影线拉长，盘口回补速度加快。",
      riskTags: ["趋势反抽", "午后回落"],
      direction: "做空",
      entryRange: "77.8 - 78.4",
      stopLoss: "重新站上 79.2 应停止逆势观察",
      rationale: "冲高后的动能衰退较为明显，若未能快速修复，短线易进入回落结构。",
      llmInterpretation: null,
      createdAtMs: now - 27 * 60 * 1000,
    },
  ];
}

function seededAlerts(userId: number): AlertRecord[] {
  return [
    {
      id: 1,
      userId,
      signalId: 1,
      market: "US",
      symbol: "NVDA",
      signalType: "突破啟動",
      level: "CRITICAL",
      title: "高评分突破啟動",
      message: "NVDA 出现高评分突破啟動，符合趋势型抢先观察条件。",
      notifyTriggered: 0,
      createdAtMs: now - 3 * 60 * 1000,
    },
    {
      id: 2,
      userId,
      signalId: 2,
      market: "HK",
      symbol: "00700",
      signalType: "回踩續強",
      level: "WARNING",
      title: "回踩續強确认",
      message: "00700 在关键均价区获得承接，回踩续强结构成立。",
      notifyTriggered: 0,
      createdAtMs: now - 12 * 60 * 1000,
    },
    {
      id: 3,
      userId,
      signalId: 3,
      market: "US",
      symbol: "TSLA",
      signalType: "盤口失衡",
      level: "INFO",
      title: "盘口失衡观察",
      message: "TSLA 盘口买卖差扩大，但尚需成交确认。",
      notifyTriggered: 0,
      createdAtMs: now - 18 * 60 * 1000,
    },
  ];
}

function seededScans(userId: number): ScanRecord[] {
  return [
    {
      id: 1,
      userId,
      market: "US",
      symbol: "SMCI",
      name: "Super Micro Computer",
      volumeRatio: 3.8,
      turnover: 462000000,
      premarketChangePct: 6.7,
      rankScore: 93,
      notes: "盘前活跃度与成交额均位于样本前列，适合作为高优先级候选。",
      scanDate: today,
    },
    {
      id: 2,
      userId,
      market: "US",
      symbol: "AMD",
      name: "AMD",
      volumeRatio: 2.9,
      turnover: 287000000,
      premarketChangePct: 4.2,
      rankScore: 85,
      notes: "量比与跳空幅度较好，但仍需确认开盘承接强度。",
      scanDate: today,
    },
    {
      id: 3,
      userId,
      market: "HK",
      symbol: "01810",
      name: "小米集团-W",
      volumeRatio: 2.5,
      turnover: 194000000,
      premarketChangePct: 3.1,
      rankScore: 79,
      notes: "港股盘前热度明显提升，适合作为次级观察对象。",
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
    falsePositiveAnalysis: "误报主要集中在午后流动性下降阶段，部分盘口失衡信号缺少逐笔成交确认，导致延续性不足。",
    bestSignal: "突破啟動：高分样本在量比和盘口承接同步增强时表现最佳。",
    worstSignal: "盤口失衡：若没有后续主动买盘配合，单独观察盘口容易出现诱导。",
    meta: {
      accuracyBySignal: [
        { signalType: "突破啟動", hitRate: 79, occurrences: 14 },
        { signalType: "回踩續強", hitRate: 72, occurrences: 11 },
        { signalType: "盤口失衡", hitRate: 54, occurrences: 17 },
        { signalType: "冲高衰竭", hitRate: 66, occurrences: 9 },
      ],
      commentary: "高质量趋势信号优于单纯盘口结构信号，后续可加强逐笔确认与时段过滤。",
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
      minPremarketChangePct: 2.8,
    },
    signalSensitivity: "标准",
    alertLevelPreference: "WARNING",
    watchlistLimit: 30,
    highScoreNotifyThreshold: 88,
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
      watchlist: 5,
      signal: 5,
      alert: 4,
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
