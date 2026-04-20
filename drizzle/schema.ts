import {
  bigint,
  double,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const watchlistItems = mysqlTable("watchlistItems", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  market: mysqlEnum("market", ["US", "HK"]).notNull(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  priority: int("priority").notNull().default(3),
  lastPrice: double("lastPrice").notNull().default(0),
  changePct: double("changePct").notNull().default(0),
  volume: bigint("volume", { mode: "number" }).notNull().default(0),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const signals = mysqlTable("signals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  market: mysqlEnum("market", ["US", "HK"]).notNull(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  signalType: mysqlEnum("signalType", ["突破啟動", "回踩續強", "盤口失衡", "冲高衰竭"]).notNull(),
  score: double("score").notNull(),
  triggerReason: text("triggerReason").notNull(),
  riskTags: json("riskTags").$type<string[]>().notNull(),
  direction: mysqlEnum("direction", ["做多", "做空", "观察"]).notNull(),
  entryRange: varchar("entryRange", { length: 128 }).notNull(),
  stopLoss: varchar("stopLoss", { length: 128 }).notNull(),
  rationale: text("rationale").notNull(),
  llmInterpretation: longtext("llmInterpretation"),
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
});

export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  signalId: int("signalId"),
  market: mysqlEnum("market", ["US", "HK"]).notNull(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  signalType: mysqlEnum("signalType", ["突破啟動", "回踩續強", "盤口失衡", "冲高衰竭"]).notNull(),
  level: mysqlEnum("level", ["INFO", "WARNING", "CRITICAL"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  notifyTriggered: int("notifyTriggered").notNull().default(0),
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
});

export const scanResults = mysqlTable("scanResults", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  market: mysqlEnum("market", ["US", "HK"]).notNull(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  volumeRatio: double("volumeRatio").notNull(),
  turnover: double("turnover").notNull(),
  premarketChangePct: double("premarketChangePct").notNull(),
  rankScore: double("rankScore").notNull(),
  notes: text("notes").notNull(),
  scanDate: varchar("scanDate", { length: 32 }).notNull(),
});

export const reviewReports = mysqlTable("reviewReports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  reviewDate: varchar("reviewDate", { length: 32 }).notNull(),
  hitRate: double("hitRate").notNull(),
  falsePositiveAnalysis: text("falsePositiveAnalysis").notNull(),
  bestSignal: text("bestSignal").notNull(),
  worstSignal: text("worstSignal").notNull(),
  meta: json("meta").$type<Record<string, unknown>>().notNull(),
});

export const systemSettings = mysqlTable("systemSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  scanThresholds: json("scanThresholds").$type<{
    minVolumeRatio: number;
    minTurnover: number;
    minPremarketChangePct: number;
  }>().notNull(),
  signalSensitivity: mysqlEnum("signalSensitivity", ["保守", "标准", "激进"]).notNull().default("标准"),
  alertLevelPreference: mysqlEnum("alertLevelPreference", ["INFO", "WARNING", "CRITICAL"]).notNull().default("WARNING"),
  watchlistLimit: int("watchlistLimit").notNull().default(30),
  highScoreNotifyThreshold: double("highScoreNotifyThreshold").notNull().default(85),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type InsertWatchlistItem = typeof watchlistItems.$inferInsert;
export type Signal = typeof signals.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type ScanResult = typeof scanResults.$inferSelect;
export type ReviewReport = typeof reviewReports.$inferSelect;
export type SystemSettings = typeof systemSettings.$inferSelect;
