import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  AlertLevel,
  Direction,
  getWorkspace,
  Market,
  type AlertRecord,
  type ScanRecord,
  type SettingsRecord,
  type SignalRecord,
  type SignalSensitivity,
  type SignalType,
  type TradingWorkspace,
  type WatchlistRecord,
} from "./mockData";

let _db: ReturnType<typeof drizzle> | null = null;

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

export function getTradingWorkspace(userId: number): TradingWorkspace {
  return getWorkspace(userId);
}

export function listWatchlist(userId: number): WatchlistRecord[] {
  return [...getWorkspace(userId).watchlistItems].sort((a, b) => b.priority - a.priority || a.symbol.localeCompare(b.symbol));
}

export function addWatchlistItem(
  userId: number,
  input: { market: Market; symbol: string; name: string; priority: number }
): WatchlistRecord {
  const workspace = getWorkspace(userId);
  const existing = workspace.watchlistItems.find(
    item => item.market === input.market && item.symbol.toUpperCase() === input.symbol.toUpperCase()
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
    symbol: input.symbol.toUpperCase(),
    name: input.name,
    priority: input.priority,
    lastPrice: 0,
    changePct: 0,
    volume: 0,
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

export function updateSignalInterpretation(userId: number, signalId: number, interpretation: string): SignalRecord | null {
  const signal = getWorkspace(userId).signals.find(item => item.id === signalId);
  if (!signal) return null;
  signal.llmInterpretation = interpretation;
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
    createdAtMs: Date.now(),
  };
  workspace.alerts.unshift(alert);
  return alert;
}

export function listScanResults(userId: number): ScanRecord[] {
  return [...getWorkspace(userId).scanResults].sort((a, b) => b.rankScore - a.rankScore);
}

export function getLatestReview(userId: number) {
  return getWorkspace(userId).reviewReport;
}

export function getSettings(userId: number): SettingsRecord {
  return getWorkspace(userId).settings;
}

export function saveSettings(
  userId: number,
  input: {
    scanThresholds: SettingsRecord["scanThresholds"];
    signalSensitivity: SignalSensitivity;
    alertLevelPreference: AlertLevel;
    watchlistLimit: number;
    highScoreNotifyThreshold: number;
  }
): SettingsRecord {
  const workspace = getWorkspace(userId);
  workspace.settings = {
    ...workspace.settings,
    ...input,
    updatedAt: Date.now(),
  };
  return workspace.settings;
}

export function getMarketStatus() {
  const nowDate = new Date();
  const utcHour = nowDate.getUTCHours();
  const utcMinute = nowDate.getUTCMinutes();
  const usMinutes = (utcHour - 4 + 24) % 24 * 60 + utcMinute;
  const hkMinutes = (utcHour + 8) % 24 * 60 + utcMinute;

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
  const watchlist = listWatchlist(userId);
  const signals = listSignals(userId);
  const alerts = listAlerts(userId);
  const review = getLatestReview(userId);
  const settings = getSettings(userId);

  const criticalSignals = signals.filter(signal => signal.score >= settings.highScoreNotifyThreshold);
  const latestSignals = signals.slice(0, 4);
  const alertStats = {
    total: alerts.length,
    critical: alerts.filter(alert => alert.level === "CRITICAL").length,
    warning: alerts.filter(alert => alert.level === "WARNING").length,
    info: alerts.filter(alert => alert.level === "INFO").length,
  };

  return {
    productName: "Shawn Wang 量化盯盘系统",
    marketStatus: getMarketStatus(),
    watchlist,
    latestSignals,
    alertStats,
    hitRate: review.hitRate,
    highScoreCount: criticalSignals.length,
  };
}

export function deriveSignalAlertLevel(score: number, preferred: AlertLevel): AlertLevel {
  if (score >= 88) return "CRITICAL";
  if (score >= 75) return preferred === "INFO" ? "WARNING" : preferred;
  return preferred;
}

export function createStructuredSuggestion(input: {
  signalType: SignalType;
  direction: Direction;
  entryRange: string;
  stopLoss: string;
  rationale: string;
}) {
  return {
    方向: input.direction,
    参考入场区间: input.entryRange,
    止损参考: input.stopLoss,
    理由说明: input.rationale,
    signalType: input.signalType,
  };
}
