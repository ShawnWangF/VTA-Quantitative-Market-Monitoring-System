import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { callDataApi } from "./_core/dataApi";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addWatchlistItem,
  buildSimulatedTrades,
  createStructuredSuggestion,
  describeSignal,
  getLatestReview,
  getSettings,
  getSignalStrategyFrame,
  listAlerts,
  listScanResults,
  listScopedSignals,
  listSignals,
  listWatchlist,
  markAlertNotificationTriggered,
  removeWatchlistItem,
  reprioritizeWatchlistItem,
  saveSettings,
  summarizeDashboard,
  updateSignalForecastInsight,
  updateSignalInterpretation,
} from "./db";

const marketSchema = z.enum(["US", "HK"]);
const signalTypeSchema = z.enum(["突破啟動", "回踩續強", "盤口失衡", "冲高衰竭"]);
const alertLevelSchema = z.enum(["INFO", "WARNING", "CRITICAL"]);
const sensitivitySchema = z.enum(["保守", "标准", "激进"]);

async function ensureHighScoreNotifications(userId: number) {
  const settings = getSettings(userId);
  const alerts = listAlerts(userId);
  const pending = alerts.filter(alert => alert.notifyTriggered === 0 && alert.level === "CRITICAL");

  for (const alert of pending) {
    const signal = listSignals(userId).find(item => item.id === alert.signalId);
    if (!signal || signal.score < settings.highScoreNotifyThreshold) continue;

    const sent = await notifyOwner({
      title: `Shawn Wang 量化盯盘系统｜${signal.symbol} ${signal.signalType}`,
      content: [
        `市场：${signal.market}`,
        `评分：${signal.score}`,
        `方向：${signal.direction}`,
        `触发动作：${signal.triggerAction}`,
        `触发价位：${signal.triggerPrice}`,
        `止损价位：${signal.stopLossPrice ?? signal.stopLoss}`,
        `失效条件：${signal.invalidationCondition}`,
        `理由说明：${signal.rationale}`,
        `行情快照：价格 ${signal.quotePrice} / 涨跌幅 ${signal.quoteChangePct}% / 成交量 ${signal.quoteVolume}`,
      ].join("\n"),
    });

    if (sent) {
      markAlertNotificationTriggered(userId, alert.id);
    }
  }
}

function fallbackInterpretation(signal: ReturnType<typeof listSignals>[number]) {
  return [
    `该信号属于“${signal.signalType}”，当前评分为 ${signal.score} 分，方向倾向为 ${signal.direction}。`,
    `从结构上看，触发原因主要是：${signal.triggerReason}`,
    `实时行情快照显示价格 ${signal.quotePrice}、涨跌幅 ${signal.quoteChangePct}% 、成交量 ${signal.quoteVolume}。`,
    `交易计划上可优先关注 ${signal.triggerAction} 价位 ${signal.triggerPrice}，并以 ${signal.stopLossPrice ?? signal.stopLoss} 作为风险参考。`,
    `需要特别注意的风险包括：${signal.riskTags.join("、") || "暂无"}。`,
  ].join("");
}

function fallbackForecastInsight(signal: ReturnType<typeof listSignals>[number]) {
  const bias = signal.direction === "做空" ? "偏空" : signal.direction === "做多" ? "偏多" : "震荡";
  return {
    interpretation: fallbackInterpretation(signal),
    forecastSummary: `${signal.symbol} 当前更接近${bias}节奏，执行上应优先等待 ${signal.triggerAction} 触发并严格遵守失效条件。`,
    forecastBias: bias,
    forecastSlope: signal.direction === "做空" ? -0.28 : signal.direction === "做多" ? 0.28 : 0,
    forecastConfidence: Math.max(55, Math.min(96, signal.score)),
  };
}

type MacroContextSnapshot = {
  marketRegime: string;
  indexSummary: string;
  newsSummary: string;
  sentimentScore: number;
  sourceMode: "external" | "fallback";
};

const macroContextCache = new Map<string, { expiresAt: number; value: MacroContextSnapshot }>();

function fallbackMacroContext(signal: ReturnType<typeof listSignals>[number], frame: ReturnType<typeof getSignalStrategyFrame>): MacroContextSnapshot {
  const proxyScore = Math.round((signal.quoteChangePct ?? 0) * 6 + (frame?.eventScore ?? 0));
  const marketRegime = proxyScore >= 6 ? "港股风险偏好多头代理" : proxyScore <= -6 ? "港股风险偏好偏空代理" : "港股风险偏好中性代理";
  return {
    marketRegime,
    indexSummary: "HSI / HSTECH 外部快照暂不可用，当前回退为基于两支观察标的和分时结构的港股风险偏好代理。",
    newsSummary: "暂无稳定的外部新闻摘要输入，当前先使用价格结构、成交变化与历史反馈作为语境层。",
    sentimentScore: Math.max(-99, Math.min(99, proxyScore)),
    sourceMode: "fallback",
  };
}

function extractCloseSeries(payload: unknown): number[] {
  const closes = (payload as {
    chart?: {
      result?: Array<{
        indicators?: {
          quote?: Array<{
            close?: Array<number | null>;
          }>;
        };
      }>;
    };
  })?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
  return Array.isArray(closes)
    ? closes.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    : [];
}

function buildIndexTrendSummary(label: string, payload: unknown) {
  const closes = extractCloseSeries(payload);
  if (closes.length < 2) return null;
  const first = closes[0];
  const last = closes[closes.length - 1];
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const tone = changePct >= 0.4 ? "偏多" : changePct <= -0.4 ? "偏空" : "震荡";
  return `${label} ${tone} ${changePct.toFixed(2)}%`;
}

function buildNewsSummary(payload: unknown) {
  const sigDevs = (payload as { finance?: { result?: { sigDevs?: Array<{ headline?: string; story?: string }> } } })?.finance?.result?.sigDevs ?? [];
  if (!Array.isArray(sigDevs) || sigDevs.length === 0) return null;
  return sigDevs.slice(0, 2).map(item => item.headline ?? item.story ?? "外部事件信号").join("；");
}

async function loadMacroContext(signal: ReturnType<typeof listSignals>[number], frame: ReturnType<typeof getSignalStrategyFrame>): Promise<MacroContextSnapshot> {
  const cached = macroContextCache.get(signal.symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const fallback = fallbackMacroContext(signal, frame);
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    macroContextCache.set(signal.symbol, { expiresAt: Date.now() + 10 * 60 * 1000, value: fallback });
    return fallback;
  }

  try {
    const [insightsResult, hsiResult, hstechResult] = await Promise.allSettled([
      callDataApi("YahooFinance/get_stock_insights", { query: { symbol: `${signal.symbol}.HK` } }),
      callDataApi("YahooFinance/get_stock_chart", { query: { symbol: "^HSI", interval: "5m", range: "1d" } }),
      callDataApi("YahooFinance/get_stock_chart", { query: { symbol: "^HSTECH", interval: "5m", range: "1d" } }),
    ]);

    const indexSummaryParts = [
      hsiResult.status === "fulfilled" ? buildIndexTrendSummary("HSI", hsiResult.value) : null,
      hstechResult.status === "fulfilled" ? buildIndexTrendSummary("HSTECH", hstechResult.value) : null,
    ].filter(Boolean) as string[];
    const newsSummary = insightsResult.status === "fulfilled" ? buildNewsSummary(insightsResult.value) : null;
    const indexToneAdjustment = indexSummaryParts.join(" ").includes("偏多")
      ? 4
      : indexSummaryParts.join(" ").includes("偏空")
        ? -4
        : 0;
    const sentimentScore = Math.max(
      -99,
      Math.min(
        99,
        Math.round((frame?.eventScore ?? 0) + signal.quoteChangePct * 5 + indexToneAdjustment),
      ),
    );
    const value: MacroContextSnapshot = {
      marketRegime: sentimentScore >= 6 ? "宏观风险偏好多头" : sentimentScore <= -6 ? "宏观风险偏好偏空" : "宏观风险偏好中性",
      indexSummary: indexSummaryParts.length > 0 ? indexSummaryParts.join("；") : fallback.indexSummary,
      newsSummary: newsSummary ?? fallback.newsSummary,
      sentimentScore,
      sourceMode: indexSummaryParts.length > 0 || !!newsSummary ? "external" : "fallback",
    };
    macroContextCache.set(signal.symbol, { expiresAt: Date.now() + 10 * 60 * 1000, value });
    return value;
  } catch {
    macroContextCache.set(signal.symbol, { expiresAt: Date.now() + 10 * 60 * 1000, value: fallback });
    return fallback;
  }
}

async function ensureDashboardForecastInsights(userId: number) {
  const scopedSignals = listScopedSignals(userId).slice(0, 4);

  for (const signal of scopedSignals) {
    const isFresh = signal.llmForecastGeneratedAtMs && Date.now() - signal.llmForecastGeneratedAtMs < 15 * 60 * 1000;
    if (signal.llmInterpretation && signal.llmForecastSummary && isFresh) continue;

    try {
      const strategyFrame = getSignalStrategyFrame(userId, signal.id);
      const macroContext = await loadMacroContext(signal, strategyFrame);
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "你是一名严谨的盘中交易策略助理，正在输出 VTA + 量化执行 + 强化反馈混合策略摘要。必须给出中文结构化结果，避免收益承诺。interpretation 必须清楚交代三层来源：VTA 时间序列注释、量化执行层、强化反馈层。forecast_slope 使用 -1 到 1 之间的小数，正数代表偏多上行，负数代表偏空下行。forecast_confidence 使用 55 到 98 的整数。",
          },
          {
            role: "user",
            content: `请为以下信号生成预测与策略摘要：\n市场：${signal.market}\n标的：${signal.symbol}\n信号：${signal.signalType}\n评分：${signal.score}\n触发原因：${signal.triggerReason}\n风险标签：${signal.riskTags.join("、")}\n风险等级：${signal.riskLevel}\n执行前提：${signal.executionPrerequisite}\n方向：${signal.direction}\n触发动作：${signal.triggerAction}\n触发价位：${signal.triggerPrice}\n止损价位：${signal.stopLossPrice ?? signal.stopLoss}\n失效条件：${signal.invalidationCondition}\n当前价格：${signal.quotePrice}\n涨跌幅：${signal.quoteChangePct}%\n成交量：${signal.quoteVolume}\n策略学习状态：${signal.learningStatus}\n历史收益：${signal.realizedReturnPct ?? "暂无"}%\n不利波动：${signal.adverseMovePct ?? "暂无"}%\n\nVTA 注释：\n${strategyFrame?.vtaAnnotations.map(item => `- ${item}`).join("\n") ?? "- 当前暂无足够分时样本，优先参考实时价与风险位。"}\n\n结构摘要：${strategyFrame?.structureSummary ?? "暂无结构摘要"}\n事件语境：${strategyFrame?.eventContextSummary ?? "暂无事件语境摘要"}\n强化反馈：${strategyFrame?.reinforcementSummary ?? "暂无强化反馈摘要"}\n宏观市场状态：${macroContext.marketRegime}\n指数语境：${macroContext.indexSummary}\n新闻/事件输入：${macroContext.newsSummary}\n语境情绪分：${macroContext.sentimentScore}\n语境来源：${macroContext.sourceMode}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "dashboard_signal_forecast",
            strict: true,
            schema: {
              type: "object",
              properties: {
                interpretation: { type: "string" },
                forecast_summary: { type: "string" },
                forecast_bias: { type: "string" },
                forecast_slope: { type: "number" },
                forecast_confidence: { type: "integer" },
              },
              required: ["interpretation", "forecast_summary", "forecast_bias", "forecast_slope", "forecast_confidence"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = typeof response.choices[0]?.message.content === "string"
        ? response.choices[0].message.content
        : JSON.stringify(fallbackForecastInsight(signal));
      const parsed = JSON.parse(content) as {
        interpretation: string;
        forecast_summary: string;
        forecast_bias: string;
        forecast_slope: number;
        forecast_confidence: number;
      };

      updateSignalForecastInsight(userId, signal.id, {
        interpretation: parsed.interpretation,
        forecastSummary: parsed.forecast_summary,
        forecastBias: parsed.forecast_bias,
        forecastSlope: parsed.forecast_slope,
        forecastConfidence: parsed.forecast_confidence,
      });
    } catch (error) {
      const fallback = fallbackForecastInsight(signal);
      updateSignalForecastInsight(userId, signal.id, fallback);
    }
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  dashboard: router({
    overview: protectedProcedure.query(async ({ ctx }) => {
      await ensureHighScoreNotifications(ctx.user.id);
      await ensureDashboardForecastInsights(ctx.user.id);
      return summarizeDashboard(ctx.user.id);
    }),
  }),
  watchlist: router({
    list: protectedProcedure.query(({ ctx }) => {
      const settings = getSettings(ctx.user.id);
      return {
        items: listWatchlist(ctx.user.id),
        limit: settings.watchlistLimit,
        liveBridge: settings.liveBridge,
      };
    }),
    add: protectedProcedure
      .input(
        z.object({
          market: marketSchema,
          symbol: z.string().min(1).max(32),
          name: z.string().min(1).max(128),
          priority: z.number().int().min(1).max(5),
        })
      )
      .mutation(({ ctx, input }) => {
        const settings = getSettings(ctx.user.id);
        const items = listWatchlist(ctx.user.id);
        if (items.length >= settings.watchlistLimit) {
          throw new Error("已达到观察名单上限，请先删除部分标的或提高上限设置。");
        }
        return addWatchlistItem(ctx.user.id, input);
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => ({ success: removeWatchlistItem(ctx.user.id, input.id) })),
    reprioritize: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), priority: z.number().int().min(1).max(5) }))
      .mutation(({ ctx, input }) => reprioritizeWatchlistItem(ctx.user.id, input.id, input.priority)),
  }),
  signals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await ensureHighScoreNotifications(ctx.user.id);
      const watchlistMap = new Map(
        listWatchlist(ctx.user.id).map(item => [`${item.market}:${item.symbol}`, item])
      );
      return listScopedSignals(ctx.user.id).map(signal => {
        const matchedSecurity = watchlistMap.get(`${signal.market}:${signal.symbol}`) ?? null;
        const matchedName = matchedSecurity?.name ?? signal.symbol;
        const signalDetails = describeSignal(ctx.user.id, signal.id);
        return {
          ...signal,
          name: matchedName,
          securityLabel: `${signal.symbol} · ${matchedName}`,
          identityKey: `${signal.market}:${signal.symbol}`,
          reasoning: signalDetails?.reasoning ?? null,
          parameterFeedback: signalDetails?.parameterFeedback ?? null,
          suggestion: createStructuredSuggestion({
            signalType: signal.signalType,
            direction: signal.direction,
            triggerAction: signal.triggerAction,
            triggerPrice: signal.triggerPrice,
            stopLossPrice: signal.stopLossPrice,
            invalidationCondition: signal.invalidationCondition,
            rationale: signal.rationale,
          }),
        };
      });
    }),
    interpretWithLlm: protectedProcedure
      .input(z.object({ signalId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const signal = listSignals(ctx.user.id).find(item => item.id === input.signalId);
        if (!signal) {
          throw new Error("未找到对应信号。");
        }

        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content:
                  "你是一名严谨的量化交易信号解读助手。请基于给定信号数据，生成简洁、专业、可执行的中文说明，必须覆盖入场逻辑、风险提示与注意事项。不要承诺收益，不要鼓励冲动交易。",
              },
              {
                role: "user",
                content: `请解读以下信号：\n市场：${signal.market}\n标的：${signal.symbol}\n信号：${signal.signalType}\n评分：${signal.score}\n触发原因：${signal.triggerReason}\n风险标签：${signal.riskTags.join("、")}\n方向：${signal.direction}\n触发动作：${signal.triggerAction}\n触发价位：${signal.triggerPrice}\n止损价位：${signal.stopLossPrice ?? signal.stopLoss}\n失效条件：${signal.invalidationCondition}\n理由说明：${signal.rationale}\n实时价格：${signal.quotePrice}\n涨跌幅：${signal.quoteChangePct}%\n成交量：${signal.quoteVolume}`,
              },
            ],
          });
          const interpretation = typeof response.choices[0]?.message.content === "string"
            ? response.choices[0].message.content
            : fallbackInterpretation(signal);
          updateSignalInterpretation(ctx.user.id, signal.id, interpretation);
          return { interpretation };
        } catch (error) {
          const interpretation = fallbackInterpretation(signal);
          updateSignalInterpretation(ctx.user.id, signal.id, interpretation);
          return { interpretation, fallback: true, error: error instanceof Error ? error.message : "LLM 解读失败" };
        }
      }),
  }),
  alerts: router({
    list: protectedProcedure
      .input(
        z
          .object({
            market: marketSchema.optional(),
            signalType: signalTypeSchema.optional(),
            date: z.string().optional(),
            query: z.string().optional(),
          })
          .optional()
      )
      .query(({ ctx, input }) => {
        const filters = input ?? {};
        return listAlerts(ctx.user.id).filter(alert => {
          const matchesMarket = !filters.market || alert.market === filters.market;
          const matchesType = !filters.signalType || alert.signalType === filters.signalType;
          const matchesDate = !filters.date || new Date(alert.createdAtMs).toISOString().slice(0, 10) === filters.date;
          const searchable = `${alert.symbol} ${alert.title} ${alert.message}`.toLowerCase();
          const matchesQuery = !filters.query || searchable.includes(filters.query.toLowerCase());
          return matchesMarket && matchesType && matchesDate && matchesQuery;
        });
      }),
  }),
  scans: router({
    list: protectedProcedure.query(({ ctx }) => listScanResults(ctx.user.id)),
  }),
  review: router({
    latest: protectedProcedure.query(({ ctx }) => getLatestReview(ctx.user.id)),
  }),
  strategy: router({
    simulatedTrades: protectedProcedure
      .input(
        z.object({
          market: marketSchema.optional(),
          symbol: z.string().min(1).max(32).optional(),
        }).optional()
      )
      .query(({ ctx, input }) => buildSimulatedTrades(ctx.user.id, input).map(trade => ({
        ...trade,
        signalDetails: describeSignal(ctx.user.id, trade.signalId),
      }))),
  }),
  settings: router({
    get: protectedProcedure.query(({ ctx }) => getSettings(ctx.user.id)),
    testBridgeConnection: protectedProcedure.mutation(({ ctx }) => {
      const settings = getSettings(ctx.user.id);
      const liveBridge = settings.liveBridge;
      const now = Date.now();
      const stalenessThresholdMs = liveBridge.publishIntervalSeconds * 4000;
      const recentHeartbeat = !!liveBridge.lastBridgeHeartbeatAt && now - liveBridge.lastBridgeHeartbeatAt <= stalenessThresholdMs;
      const recentQuote = !!liveBridge.lastQuoteAt && now - liveBridge.lastQuoteAt <= stalenessThresholdMs;
      const reachable = liveBridge.connectionStatus === "已连接" && recentHeartbeat;

      return {
        reachable,
        connectionStatus: liveBridge.connectionStatus,
        summary: reachable
          ? `桥接已联通，最近一次心跳时间为 ${new Date(liveBridge.lastBridgeHeartbeatAt!).toLocaleString()}。`
          : liveBridge.lastError
            ? `桥接最近返回异常：${liveBridge.lastError}`
            : "尚未收到本地桥接的最新心跳，请确认 Windows 侧桥接程序已经启动并成功推送。",
        details: {
          opendHost: liveBridge.opendHost,
          opendPort: liveBridge.opendPort,
          trackedSymbols: liveBridge.trackedSymbols,
          publishIntervalSeconds: liveBridge.publishIntervalSeconds,
          useLiveQuotes: liveBridge.useLiveQuotes,
          lastBridgeHeartbeatAt: liveBridge.lastBridgeHeartbeatAt,
          lastQuoteAt: liveBridge.lastQuoteAt,
          recentHeartbeat,
          recentQuote,
          lastError: liveBridge.lastError,
        },
      };
    }),
    save: protectedProcedure
      .input(
        z.object({
          scanThresholds: z.object({
            minVolumeRatio: z.number().min(0),
            minTurnover: z.number().min(0),
            minPremarketChangePct: z.number(),
          }),
          signalSensitivity: sensitivitySchema,
          alertLevelPreference: alertLevelSchema,
          watchlistLimit: z.number().int().min(1).max(500),
          highScoreNotifyThreshold: z.number().min(0).max(100),
          liveBridge: z.object({
            opendHost: z.string().min(1).max(128),
            opendPort: z.number().int().min(1).max(65535),
            trackedSymbols: z.array(z.string().min(1).max(32)).min(1),
            bridgeToken: z.string().min(8).max(128),
            publishIntervalSeconds: z.number().int().min(1).max(60),
            useLiveQuotes: z.boolean(),
          }),
        })
      )
      .mutation(({ ctx, input }) => saveSettings(ctx.user.id, input)),
  }),
});

export type AppRouter = typeof appRouter;
