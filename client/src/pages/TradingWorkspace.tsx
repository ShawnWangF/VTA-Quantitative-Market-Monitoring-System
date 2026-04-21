import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Bot,
  CandlestickChart,
  Clock3,
  Copy,
  Database,
  LayoutDashboard,
  Radar,
  RefreshCcw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts";

type Market = "US" | "HK";
type SignalType = "突破啟動" | "回踩續強" | "盤口失衡" | "冲高衰竭";
type AlertLevel = "INFO" | "WARNING" | "CRITICAL";
type SignalSensitivity = "保守" | "标准" | "激进";
type BridgeConnectionStatus = "未连接" | "已连接" | "陈旧" | "异常";

const realtimeQueryOptions = {
  refetchInterval: 4000,
  refetchOnWindowFocus: true,
} as const;

function useTradingWorkspaceData() {
  const overview = trpc.dashboard.overview.useQuery(undefined, realtimeQueryOptions);
  const watchlist = trpc.watchlist.list.useQuery(undefined, realtimeQueryOptions);
  const signals = trpc.signals.list.useQuery(undefined, realtimeQueryOptions);
  const scans = trpc.scans.list.useQuery(undefined, { refetchInterval: 12_000, refetchOnWindowFocus: true });
  const review = trpc.review.latest.useQuery(undefined, { refetchInterval: 20_000, refetchOnWindowFocus: true });
  const settings = trpc.settings.get.useQuery(undefined, realtimeQueryOptions);
  return { overview, watchlist, signals, scans, review, settings };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-Hans", { maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

function formatSigned(value: number, digits = 2) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

function formatDateTime(value: number | null | undefined) {
  if (!value) return "尚未收到";
  return new Date(value).toLocaleString();
}

function bridgeStatusTone(status: BridgeConnectionStatus) {
  if (status === "已连接") return "border-cyan-300 bg-cyan-100 text-cyan-950";
  if (status === "陈旧") return "border-amber-300 bg-amber-100 text-amber-900";
  if (status === "异常") return "border-pink-300 bg-pink-100 text-pink-950";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function sourceModeLabel(mode: "live" | "pending") {
  return mode === "live" ? "LIVE" : "WAIT";
}

function sourceModeTone(mode: "live" | "pending") {
  return mode === "live"
    ? "border-cyan-200 bg-cyan-50 font-mono text-cyan-800"
    : "border-amber-200 bg-amber-50 font-mono text-amber-800";
}

function BlueprintPageShell({
  title,
  description,
  eyebrow,
  children,
  workspaceLabel = "Real Data Required · Awaiting Bridge",
}: {
  title: string;
  description: string;
  eyebrow: string;
  children: React.ReactNode;
  workspaceLabel?: string;
}) {
  return (
    <div className="relative w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/88 p-4 shadow-[0_24px_90px_-48px_rgba(14,116,144,0.55)] backdrop-blur-sm md:p-5 2xl:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.18),transparent_28%),linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] [background-size:auto,auto,28px_28px,28px_28px]" />
      <div className="pointer-events-none absolute right-5 top-5 hidden rounded-2xl border border-cyan-200/70 bg-white/70 px-4 py-3 font-mono text-[11px] leading-6 text-slate-400 xl:block">
        <div>f(x) = Σ(wᵢ · xᵢ) + ε</div>
        <div>R = ∫ P(t) dV / σ</div>
        <div>Δt · momentum &gt; threshold</div>
      </div>
      <div className="pointer-events-none absolute bottom-5 left-5 hidden rounded-full border border-pink-200/80 bg-white/70 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-pink-500 lg:block">
        {workspaceLabel}
      </div>
      <div className="relative space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="border-cyan-300/70 bg-cyan-100/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-900">
              {eyebrow}
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-[-0.04em] text-foreground md:text-5xl">{title}</h1>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-pink-200/80 bg-white/85 px-4 py-3 shadow-sm">
            <div className="h-3 w-3 rounded-full border border-cyan-400 bg-cyan-200" />
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.26em] text-slate-500">Shawn Wang 量化盯盘系统</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Real-Time Signal Research Workspace</div>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) {
  return (
    <Card className="border-white/80 bg-white/90 shadow-[0_18px_60px_-35px_rgba(15,23,42,0.35)]">
      <CardHeader className="pb-3">
        <CardDescription className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">{label}</CardDescription>
        <CardTitle className="text-3xl font-black tracking-[-0.04em]">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`inline-flex rounded-full border px-3 py-1 font-mono text-xs ${accent}`}>{detail}</div>
      </CardContent>
    </Card>
  );
}

function MarketPill({ market, status }: { market: string; status: string }) {
  const classes = status.includes("开盘")
    ? "border-cyan-300 bg-cyan-100 text-cyan-950"
    : status.includes("盘前") || status.includes("盘后")
      ? "border-pink-300 bg-pink-100 text-pink-950"
      : "border-slate-300 bg-slate-100 text-slate-700";

  return (
    <div className={`rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] ${classes}`}>
      {market} · {status}
    </div>
  );
}

function SmallTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/90">
            <tr>
              {headers.map(header => (
                <th key={header} className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-slate-100">
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiskBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className="border-pink-200 bg-pink-50 font-mono text-[11px] text-pink-700">
      {value}
    </Badge>
  );
}

function AlertLevelBadge({ level }: { level: AlertLevel }) {
  const styles: Record<AlertLevel, string> = {
    INFO: "border-slate-200 bg-slate-100 text-slate-700",
    WARNING: "border-cyan-200 bg-cyan-100 text-cyan-900",
    CRITICAL: "border-pink-200 bg-pink-100 text-pink-900",
  };
  return <Badge variant="outline" className={`font-mono text-[11px] ${styles[level]}`}>{level}</Badge>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed border-slate-300 bg-white/70">
      <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
        <div className="rounded-full border border-cyan-200 bg-cyan-50 p-3 text-cyan-700">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { overview } = useTradingWorkspaceData();
  const [activeSymbol, setActiveSymbol] = useState("");

  const liveBoard = overview.data?.liveBoard ?? [];
  const activeBoard = useMemo(() => {
    return liveBoard.find((item: any) => item.symbol === activeSymbol) ?? liveBoard[0] ?? null;
  }, [activeSymbol, liveBoard]);

  useEffect(() => {
    if (!activeBoard && liveBoard[0]?.symbol) {
      setActiveSymbol(liveBoard[0].symbol);
      return;
    }
    if (activeBoard && activeSymbol !== activeBoard.symbol) {
      setActiveSymbol(activeBoard.symbol);
    }
  }, [activeBoard, activeSymbol, liveBoard]);

  const tradeFilter = useMemo(() => {
    if (!activeBoard) return undefined;
    return {
      market: activeBoard.market as Market,
      symbol: activeBoard.symbol as string,
    };
  }, [activeBoard]);

  const simulatedTrades = trpc.strategy.simulatedTrades.useQuery(tradeFilter, {
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
    enabled: !!tradeFilter,
  });

  if (overview.isLoading) {
    return <BlueprintPageShell eyebrow="Dashboard" title="仪表板主页" description="正在汇总实时行情、市场状态与信号摘要。"><EmptyState title="加载中" description="系统正在建立实时观察环境。" /></BlueprintPageShell>;
  }

  const data = overview.data;
  if (!data || !activeBoard) {
    return <BlueprintPageShell eyebrow="Dashboard" title="仪表板主页" description="当前仅展示真实行情驱动数据。"><EmptyState title="暂无真实数据" description="请先在设置页连接桥接并添加真实标的；未收到实时行情前，页面不会回退显示演示股票或演示价格。" /></BlueprintPageShell>;
  }

  const trades = simulatedTrades.data ?? [];
  const markerInsights = [...(activeBoard.simulationMarkers ?? [])].slice(-4).reverse();
  const reasoningEntries = activeBoard.signalReasoning ? [
    { label: "宏观因子", value: activeBoard.signalReasoning.macroFactor },
    { label: "事件因子", value: activeBoard.signalReasoning.eventFactor },
    { label: "量价因子", value: activeBoard.signalReasoning.priceActionFactor },
    { label: "强化反馈", value: activeBoard.signalReasoning.reinforcementFactor },
  ] : [];
  const eventInputEntries = Object.entries(activeBoard.eventInputs ?? {});
  const parameterEntries = activeBoard.parameterFeedback ? [
    { label: "LLM 偏向", value: activeBoard.parameterFeedback.llmBiasShift },
    { label: "事件权重", value: activeBoard.parameterFeedback.eventWeight },
    { label: "阈值偏移%", value: activeBoard.parameterFeedback.triggerThresholdShiftPct },
    { label: "止损缓冲%", value: activeBoard.parameterFeedback.stopLossBufferPct },
  ] : [];
  const summaryEntries = [
    `LLM ${activeBoard.llmForecastBias ?? activeBoard.forecastSummary.trendBias} · ${activeBoard.llmForecastSummary}`,
    `执行 ${activeBoard.suggestionAction ?? "等待触发"} · ${activeBoard.executionPrerequisite}`,
    `预测 ${formatNumber(activeBoard.forecastSummary.predictedPrice)} · ${formatSigned(activeBoard.forecastSummary.predictedChangePct)}`,
    `强化反馈 ${activeBoard.strategyLearning.adaptiveWeight}x · 奖励 ${activeBoard.strategyLearning.rewardScore}`,
    `桥接 ${data.liveBridge.connectionStatus} · 最近更新 ${formatDateTime(data.liveBridge.lastQuoteAt)}`,
  ];

  return (
    <BlueprintPageShell
      eyebrow="Dashboard"
      title="双标实时终端"
      description="横向全屏呈现主图、指令、结构化解释与模拟验证结果。页面会随窗口宽度自适应重排，并在空间不足时自动收缩左侧导航。"
      workspaceLabel={data.liveBridge.sourceLabel}
    >
      <style>{`@keyframes terminalTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
      <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white/82 px-4 py-3 text-sm text-slate-600 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.25)]">
        <MarketPill market="HK" status={data.marketStatus.HK} />
        <div className={`rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] ${bridgeStatusTone(data.liveBridge.connectionStatus)}`}>
          桥接状态 · {data.liveBridge.connectionStatus}
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] text-slate-600">
          已选 · {data.liveBridge.trackedSymbols.join(" · ")}
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] text-slate-600">
          最近更新 · {formatDateTime(data.liveBridge.lastQuoteAt)}
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(22rem,0.9fr)]">
        <Card className="overflow-hidden border-slate-800/90 bg-[#07111f] text-slate-100 shadow-[0_30px_120px_-42px_rgba(2,6,23,0.9)]">
          <CardHeader className="space-y-4 border-b border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,17,31,0.99))] px-4 py-4 xl:px-5">
            <div className="flex flex-wrap items-center gap-3">
              {liveBoard.map((item: any) => (
                <button
                  key={item.identityKey}
                  type="button"
                  onClick={() => setActiveSymbol(item.symbol)}
                  className={`min-w-[9rem] rounded-2xl border px-4 py-3 text-left transition ${activeBoard.symbol === item.symbol ? "border-cyan-400/50 bg-cyan-400/10 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.15)]" : "border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-600 hover:text-white"}`}
                >
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em]">
                    <span>{item.symbol}</span>
                    <span className={item.sourceMode === "live" ? "text-emerald-300" : "text-amber-300"}>{sourceModeLabel(item.sourceMode)}</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold">{item.name}</div>
                  <div className={`mt-1 text-xs ${item.changePct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSigned(item.changePct)}</div>
                </button>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(26rem,0.95fr)] xl:items-end">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-slate-700 bg-slate-900/60 font-mono text-[11px] text-slate-200">{activeBoard.market}</Badge>
                  <Badge variant="outline" className={activeBoard.forecastSummary.trendBias === "偏多" ? "border-cyan-500/40 bg-cyan-500/10 font-mono text-cyan-300" : "border-pink-500/40 bg-pink-500/10 font-mono text-pink-300"}>{activeBoard.forecastSummary.trendBias}</Badge>
                  {activeBoard.activeSignalType ? <Badge variant="outline" className="border-slate-700 bg-slate-900/50 font-mono text-slate-300">{activeBoard.activeSignalType}</Badge> : null}
                </div>
                <div>
                  <CardTitle className="text-4xl font-black tracking-[-0.05em] text-white 2xl:text-5xl">{activeBoard.securityLabel}</CardTitle>
                  <CardDescription className="mt-2 max-w-4xl text-sm leading-7 text-slate-300">{activeBoard.llmForecastSummary}</CardDescription>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-400">最新价</div>
                  <div className="mt-2 text-4xl font-black tracking-[-0.05em] text-white">{formatNumber(activeBoard.lastPrice)}</div>
                  <div className={`mt-2 text-sm ${activeBoard.changePct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSigned(activeBoard.changePct)}</div>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-400">BUY</div>
                  <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-emerald-300">{activeBoard.suggestionAction === "买入提醒" && activeBoard.suggestionTriggerPrice !== null ? formatNumber(activeBoard.suggestionTriggerPrice) : "--"}</div>
                  <div className="mt-2 text-sm text-slate-400">失效 {activeBoard.suggestionAction === "买入提醒" && activeBoard.suggestionStopLossPrice !== null ? formatNumber(activeBoard.suggestionStopLossPrice) : "--"}</div>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-400">SELL</div>
                  <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-rose-300">{activeBoard.suggestionAction === "卖出提醒" && activeBoard.suggestionTriggerPrice !== null ? formatNumber(activeBoard.suggestionTriggerPrice) : "--"}</div>
                  <div className="mt-2 text-sm text-slate-400">失效 {activeBoard.suggestionAction === "卖出提醒" && activeBoard.suggestionStopLossPrice !== null ? formatNumber(activeBoard.suggestionStopLossPrice) : "--"}</div>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-400">RL 权重</div>
                  <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-cyan-300">{activeBoard.strategyLearning.adaptiveWeight}x</div>
                  <div className="mt-2 text-sm text-slate-400">奖励 {activeBoard.strategyLearning.rewardScore}</div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-4 xl:p-5">
            <div className="rounded-[1.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-4 xl:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">开 {formatNumber(activeBoard.openPrice)}</span>
                  <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">高 {formatNumber(activeBoard.highPrice)}</span>
                  <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">低 {formatNumber(activeBoard.lowPrice)}</span>
                  <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">量 {formatNumber(activeBoard.volume)}</span>
                </div>
                <div className="font-mono tracking-[0.3em] text-slate-500">REALTIME TRADING TERMINAL</div>
              </div>

              <ChartContainer
                className="h-[54vh] min-h-[420px] max-h-[640px] w-full"
                config={{
                  price: { label: "实时价格", color: "#38bdf8" },
                  forecastPrice: { label: "预测走势线", color: "#f97316" },
                }}
              >
                <ComposedChart data={activeBoard.chart} margin={{ left: 8, right: 18, top: 12, bottom: 8 }}>
                  <CartesianGrid vertical stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis orientation="right" tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <ReferenceLine y={activeBoard.lastPrice} stroke="rgba(226,232,240,0.35)" strokeDasharray="5 5" />
                  {activeBoard.suggestionTriggerPrice ? (
                    <ReferenceLine
                      y={activeBoard.suggestionTriggerPrice}
                      stroke={activeBoard.suggestionAction === "卖出提醒" ? "#fb7185" : "#4ade80"}
                      strokeDasharray="6 6"
                      label={{ value: `${activeBoard.suggestionAction === "卖出提醒" ? "SELL" : "BUY"} ${activeBoard.suggestionTriggerPrice}`, position: "insideTopRight", fill: activeBoard.suggestionAction === "卖出提醒" ? "#fb7185" : "#4ade80", fontSize: 11 }}
                    />
                  ) : null}
                  {activeBoard.suggestionStopLossPrice ? (
                    <ReferenceLine
                      y={activeBoard.suggestionStopLossPrice}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{ value: `INVALID ${activeBoard.suggestionStopLossPrice}`, position: "insideBottomRight", fill: "#fbbf24", fontSize: 11 }}
                    />
                  ) : null}
                  {activeBoard.latestMarker?.label ? (
                    <ReferenceDot
                      x={activeBoard.latestMarker.label}
                      y={activeBoard.latestMarker.price}
                      r={5}
                      fill="#e2e8f0"
                      stroke="#020617"
                      strokeWidth={2}
                      label={{ value: `NOW ${formatNumber(activeBoard.latestMarker.price)}`, position: "right", fill: "#e2e8f0", fontSize: 11 }}
                    />
                  ) : null}
                  {markerInsights.map((marker: any, markerIndex: number) => (
                    <ReferenceDot
                      key={`${activeBoard.identityKey}-simulation-${markerIndex}`}
                      x={marker.label}
                      y={marker.price}
                      r={6}
                      fill={marker.tone === "buy" ? "#4ade80" : "#fb7185"}
                      stroke="#020617"
                      strokeWidth={1.5}
                      label={{ value: `${marker.action} ${formatNumber(marker.price)}`, position: marker.tone === "buy" ? "bottom" : "top", fill: marker.tone === "buy" ? "#86efac" : "#fda4af", fontSize: 11 }}
                    />
                  ))}
                  <Area type="monotone" dataKey="price" stroke="#38bdf8" fill="#0ea5e9" fillOpacity={0.12} strokeWidth={2.5} connectNulls />
                  <Line type="monotone" dataKey="forecastPrice" stroke="#f97316" strokeWidth={2.5} dot={false} strokeDasharray="7 5" connectNulls />
                </ComposedChart>
              </ChartContainer>

              <div className="mt-4 grid gap-3 xl:grid-cols-4">
                {markerInsights.length > 0 ? markerInsights.map((marker: any, index: number) => (
                  <div key={`${marker.signalId ?? marker.label}-${index}`} className="rounded-2xl border border-slate-800 bg-[#08101d] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${marker.tone === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{marker.action}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">{marker.label}</span>
                    </div>
                    <div className="mt-2 text-lg font-black text-white">{formatNumber(marker.price)}</div>
                    <div className="mt-2 text-xs leading-6 text-slate-400">{marker.explanation ?? "该点位由结构、事件与强化反馈共同触发。"}</div>
                  </div>
                )) : (
                  <div className="xl:col-span-4 rounded-2xl border border-dashed border-slate-700 bg-[#08101d] px-4 py-5 text-sm text-slate-400">当前暂无足够的回放 marker。后续模拟交易生成后，这里会展示图上触发点与解释摘要。</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card className="border-slate-800 bg-[#07111f] text-slate-100 shadow-[0_30px_120px_-42px_rgba(2,6,23,0.9)]">
            <CardContent className="space-y-4 p-4">
              <div className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                <div className="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.24em] text-cyan-200/80">
                  <span>LLM Runtime Summary</span>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 font-mono">RUNNING</span>
                </div>
                <div className="overflow-hidden whitespace-nowrap">
                  <div className="flex min-w-max gap-4 pr-4 text-xs text-cyan-100/85" style={{ animation: "terminalTicker 28s linear infinite" }}>
                    {[...summaryEntries, ...summaryEntries].map((entry, index) => (
                      <span key={`${entry}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono">
                        {entry}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-400">执行与解释</div>
                <div className={`mt-3 text-3xl font-black tracking-[-0.04em] ${activeBoard.suggestionAction === "卖出提醒" ? "text-rose-300" : activeBoard.suggestionAction === "买入提醒" ? "text-emerald-300" : "text-slate-200"}`}>{activeBoard.suggestionAction ?? "观察中"}</div>
                <div className="mt-3 text-sm leading-6 text-slate-300">{activeBoard.executionPrerequisite}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#08101d] px-4 py-3 text-sm leading-6 text-slate-400">{activeBoard.llmStrategyNote}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-[#08101d] p-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">策略与风险</div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3"><span>策略</span><span className="font-semibold text-white">{activeBoard.activeSignalType ?? "趋势跟踪"}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>风险等级</span><span className="font-semibold text-white">{activeBoard.riskLevel}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>预测终点</span><span className="font-semibold text-white">{formatNumber(activeBoard.forecastSummary.predictedPrice)}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>预测变化</span><span className={activeBoard.forecastSummary.predictedChangePct >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>{formatSigned(activeBoard.forecastSummary.predictedChangePct)}</span></div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-[#08101d] p-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">强化反馈</div>
                  {activeBoard.failureReason ? <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">最近失效：{activeBoard.failureReason}</div> : null}
                  <div className="mt-3 grid gap-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3"><span>平均收益</span><span className="font-semibold text-white">{activeBoard.strategyLearning.averageReturnPct}%</span></div>
                    <div className="flex items-center justify-between gap-3"><span>平均回撤</span><span className="font-semibold text-white">{activeBoard.strategyLearning.averageAdversePct}%</span></div>
                    <div className="flex items-center justify-between gap-3"><span>奖励分</span><span className="font-semibold text-cyan-300">{activeBoard.strategyLearning.rewardScore}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>Sharpe 风格</span><span className="font-semibold text-white">{activeBoard.strategyLearning.sharpeLikeScore}</span></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#07111f] text-slate-100 shadow-[0_30px_120px_-42px_rgba(2,6,23,0.9)]">
            <CardContent className="space-y-4 p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-400">结构化 reasoning</div>
              {reasoningEntries.length > 0 ? reasoningEntries.map(entry => (
                <div key={entry.label} className="rounded-2xl border border-slate-800 bg-[#08101d] px-4 py-3">
                  <div className="text-sm font-semibold text-white">{entry.label}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">{entry.value}</div>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-slate-700 bg-[#08101d] px-4 py-5 text-sm text-slate-400">当前尚未生成结构化 reasoning，等待新的有效信号。</div>}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#07111f] text-slate-100 shadow-[0_30px_120px_-42px_rgba(2,6,23,0.9)]">
            <CardContent className="space-y-4 p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-400">事件输入与参数反馈</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {eventInputEntries.length > 0 ? eventInputEntries.map(([key, value]: any) => (
                  <div key={key} className="rounded-2xl border border-slate-800 bg-[#08101d] p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">{key}</div>
                    <div className="mt-2 text-lg font-black text-white">{value.score}</div>
                    <div className="mt-2 text-xs leading-6 text-slate-400">来源：{value.source}</div>
                  </div>
                )) : <div className="sm:col-span-2 rounded-2xl border border-dashed border-slate-700 bg-[#08101d] px-4 py-5 text-sm text-slate-400">当前事件输入仍以代理因子为主。后续接入更稳定多源事件后，这里会展示更完整的语境分层。</div>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {parameterEntries.map(item => (
                  <div key={item.label} className="rounded-2xl border border-slate-800 bg-[#08101d] p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">{item.label}</div>
                    <div className="mt-2 text-lg font-black text-cyan-300">{item.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-slate-800 bg-[#07111f] text-slate-100 shadow-[0_30px_120px_-42px_rgba(2,6,23,0.9)]">
        <CardContent className="space-y-4 p-4 xl:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 font-semibold text-white"><TrendingUp className="h-4 w-4 text-cyan-300" />模拟 P&L 验证面板</div>
              <div className="mt-1 text-sm text-slate-400">逐笔回放 {activeBoard.securityLabel} 的 BUY / SELL 触发，验证入场、出场、回撤、奖励分、结构化解释与失效原因。</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-5">
              <div className="rounded-2xl border border-slate-800 bg-[#08101d] px-4 py-3 text-sm text-slate-300"><span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">交易笔数</span><span className="mt-2 block text-xl font-black text-white">{activeBoard.simulationSummary.tradeCount}</span></div>
              <div className="rounded-2xl border border-slate-800 bg-[#08101d] px-4 py-3 text-sm text-slate-300"><span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">持仓中</span><span className="mt-2 block text-xl font-black text-white">{activeBoard.simulationSummary.openCount}</span></div>
              <div className="rounded-2xl border border-slate-800 bg-[#08101d] px-4 py-3 text-sm text-slate-300"><span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">浮动收益</span><span className={`mt-2 block text-xl font-black ${activeBoard.simulationSummary.floatingPnlPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSigned(activeBoard.simulationSummary.floatingPnlPct)}</span></div>
              <div className="rounded-2xl border border-slate-800 bg-[#08101d] px-4 py-3 text-sm text-slate-300"><span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">已实现收益</span><span className={`mt-2 block text-xl font-black ${activeBoard.simulationSummary.realizedPnlPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSigned(activeBoard.simulationSummary.realizedPnlPct)}</span></div>
              <div className="rounded-2xl border border-slate-800 bg-[#08101d] px-4 py-3 text-sm text-slate-300"><span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">最大回撤</span><span className="mt-2 block text-xl font-black text-white">{formatNumber(activeBoard.simulationSummary.maxDrawdownPct)}%</span></div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.25rem] border border-slate-800 bg-[#08101d]">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-slate-950/70">
                  <tr>
                    {[
                      "时间",
                      "触发",
                      "入场",
                      "出场",
                      "P&L",
                      "回撤",
                      "持有",
                      "奖励",
                      "reasoning / 状态",
                    ].map(header => (
                      <th key={header} className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.length > 0 ? trades.slice(0, 10).map((trade: any) => (
                    <tr key={`${trade.identityKey}-${trade.signalId}`} className="border-t border-slate-800 text-slate-300">
                      <td className="px-4 py-3 whitespace-nowrap">{trade.entryTimeLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 font-mono text-xs ${trade.action === "BUY" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{trade.action}</span>
                          <span className="text-xs text-slate-400">{trade.signalType}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{formatNumber(trade.entryPrice)}</td>
                      <td className="px-4 py-3 font-semibold text-white">{formatNumber(trade.simulatedExitPrice)}</td>
                      <td className={`px-4 py-3 font-semibold ${trade.realizedPnlPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSigned(trade.realizedPnlPct)}</td>
                      <td className="px-4 py-3">{formatNumber(trade.maxDrawdownPct)}%</td>
                      <td className="px-4 py-3">{trade.holdingMinutes}m</td>
                      <td className={`px-4 py-3 font-semibold ${trade.rewardScore >= 0 ? "text-cyan-300" : "text-amber-300"}`}>{trade.rewardScore}</td>
                      <td className="px-4 py-3 text-xs leading-6 text-slate-400">
                        <div>{trade.invalidationReason ?? trade.failureReason ?? trade.explanation}</div>
                        {trade.reasoning?.weightContribution ? <div className="mt-2 text-[11px] text-slate-500">权重贡献：M {trade.reasoning.weightContribution.macro} / E {trade.reasoning.weightContribution.event} / P {trade.reasoning.weightContribution.priceAction} / R {trade.reasoning.weightContribution.reinforcement}</div> : null}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">当前尚未形成可回放的模拟交易记录。实时桥接继续推送后，这里会展示入场、出场、P&L、回撤、结构化解释与失效原因。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </BlueprintPageShell>
  );
}


export function WatchlistPage() {
  const utils = trpc.useUtils();
  const { watchlist, settings } = useTradingWorkspaceData();
  const [form, setForm] = useState({ market: "HK" as Market, symbol: "", name: "", priority: "3" });
  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: async () => {
      toast.success("观察名單已更新");
      setForm({ market: "HK", symbol: "", name: "", priority: "3" });
      await utils.watchlist.list.invalidate();
      await utils.dashboard.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: async () => {
      toast.success("已移除标的");
      await utils.watchlist.list.invalidate();
      await utils.dashboard.overview.invalidate();
    },
  });
  const reprioritizeMutation = trpc.watchlist.reprioritize.useMutation({
    onSuccess: async () => {
      toast.success("优先级已更新");
      await utils.watchlist.list.invalidate();
      await utils.dashboard.overview.invalidate();
    },
  });

  const items = watchlist.data?.items ?? [];
  const bridge = settings.data?.liveBridge;

  return (
    <BlueprintPageShell eyebrow="Watchlist" title="观察名單管理" description="支持新增、删除港股与美股标的，设置优先级，并在同一页面持续查看真实价格、涨跌幅、成交量与数据状态。" workspaceLabel={bridge?.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Real Data Required · Awaiting Bridge"}>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.3fr]">
        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Search className="h-5 w-5 text-cyan-700" />新增监控标的</CardTitle>
            <CardDescription>请只添加你当前实际盯盘的真实股票，系统不会再自动填充示例标的。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 text-sm leading-7 text-slate-700">
              当前桥接状态：<span className="font-semibold text-slate-900">{bridge?.connectionStatus ?? "未连接"}</span>。当本地 OpenD 桥接开始推送实时行情后，这里的标的会自动切换为实时数据源。
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">市场</label>
                <Select value={form.market} onValueChange={value => setForm(prev => ({ ...prev, market: value as Market }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HK">HK</SelectItem>
                    <SelectItem value="US">US</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">标的代码</label>
                <Input value={form.symbol} onChange={event => setForm(prev => ({ ...prev, symbol: event.target.value.toUpperCase() }))} placeholder="输入真实股票代码，例如 03690 或 09992" />
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">标的名称</label>
                <Input value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} placeholder="输入真实股票名称，例如 Apple Inc. 或 腾讯控股" />
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">优先级</label>
                <Select value={form.priority} onValueChange={value => setForm(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["1", "2", "3", "4", "5"].map(value => <SelectItem key={value} value={value}>P{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => addMutation.mutate({ market: form.market, symbol: form.symbol, name: form.name, priority: Number(form.priority) })}
              disabled={!form.symbol || !form.name || addMutation.isPending}
            >
              {addMutation.isPending ? "写入中..." : "加入观察名單"}
            </Button>
            <p className="text-xs leading-6 text-muted-foreground">系统设置中的“观察名單上限”会影响可加入的最大标的数量。若桥接已启用，列表会优先显示由富途实时数据回写的价格与成交量。</p>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Database className="h-5 w-5 text-pink-700" />当前监控池</CardTitle>
            <CardDescription>按照优先级排序的监控标的列表。</CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <EmptyState title="观察名單为空" description="先在左侧添加至少一个标的，系统才能为你构建监控池。" />
            ) : (
              <SmallTable
                headers={["市场", "标的", "优先级", "最新价", "涨跌幅", "成交量", "数据源", "操作"]}
                rows={items.map((item: any) => [
                  <Badge key={`${item.id}-market`} variant="outline" className="font-mono text-[11px]">{item.market}</Badge>,
                  <div key={`${item.id}-symbol`}><div className="font-semibold text-slate-900">{item.symbol}</div><div className="text-xs text-slate-500">{item.name}</div></div>,
                  <Select key={`${item.id}-priority`} value={String(item.priority)} onValueChange={value => reprioritizeMutation.mutate({ id: item.id, priority: Number(value) })}>
                    <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>{["1", "2", "3", "4", "5"].map(v => <SelectItem key={v} value={v}>P{v}</SelectItem>)}</SelectContent>
                  </Select>,
                  <span key={`${item.id}-price`} className="font-semibold">{formatNumber(item.lastPrice)}</span>,
                  <span key={`${item.id}-change`} className={item.changePct >= 0 ? "text-cyan-700" : "text-pink-700"}>{formatSigned(item.changePct)}</span>,
                  <span key={`${item.id}-volume`} className="font-mono text-xs text-slate-600">{formatNumber(item.volume)}</span>,
                    <Badge key={`${item.id}-source`} variant="outline" className={sourceModeTone(item.sourceMode)}>{sourceModeLabel(item.sourceMode)}</Badge>,

                  <Button key={`${item.id}-remove`} variant="outline" size="sm" onClick={() => removeMutation.mutate({ id: item.id })}>删除</Button>,
                ])}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </BlueprintPageShell>
  );
}

export function SignalsPage() {
  const utils = trpc.useUtils();
  const { signals, settings } = useTradingWorkspaceData();
  const [autoRequestedIds, setAutoRequestedIds] = useState<number[]>([]);
  const interpretMutation = trpc.signals.interpretWithLlm.useMutation({
    onSuccess: async () => {
      toast.success("已生成自然语言解读");
      await utils.signals.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const signalItems = signals.data ?? [];
  const bridge = settings.data?.liveBridge;

  useEffect(() => {
    const candidate = signalItems.find(
      signal => signal.score >= 80 && !signal.llmInterpretation && !autoRequestedIds.includes(signal.id)
    );
    if (!candidate) return;
    setAutoRequestedIds(previous => [...previous, candidate.id]);
    interpretMutation.mutate({ signalId: candidate.id });
  }, [autoRequestedIds, interpretMutation, signalItems]);

  return (
      <BlueprintPageShell eyebrow="Live Signals" title="实时信号面板" description="实时信号页也统一采用代码 + 名称 + 行情快照的展示方式，确保提醒对象与实际标的严格一致，只在行情之上叠加必要指令。" workspaceLabel={bridge?.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Real Data Required · Awaiting Bridge"}>

      <div className="grid gap-4 md:grid-cols-2">
        {signalItems.map((signal: any) => (
          <Card key={signal.id} className="border-white/80 bg-white/92 shadow-[0_16px_60px_-36px_rgba(14,116,144,0.5)]">
            <CardHeader className="space-y-4 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[11px]">{signal.market}</Badge>
                    <Badge variant="outline" className="border-cyan-200 bg-cyan-50 font-mono text-cyan-800">{signal.signalType}</Badge>
                    <Badge variant="outline" className={sourceModeTone(signal.sourceMode)}>{sourceModeLabel(signal.sourceMode)}</Badge>
                  </div>
                  <CardTitle className="mt-3 text-2xl font-black tracking-[-0.03em]">{signal.securityLabel ?? `${signal.symbol} · ${signal.name ?? signal.symbol}`}</CardTitle>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 xl:grid-cols-4">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">现价 {signal.quotePrice}</span>
                    <span className={`rounded-full border px-3 py-1 ${signal.quoteChangePct >= 0 ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-pink-200 bg-pink-50 text-pink-700"}`}>{formatSigned(signal.quoteChangePct)}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">成交量 {formatNumber(signal.quoteVolume)}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">标识 {signal.identityKey ?? `${signal.market}:${signal.symbol}`}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 text-right">
                  <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-pink-700">Score</div>
                  <div className="text-3xl font-black tracking-[-0.04em] text-slate-900">{signal.score}</div>
                </div>
              </div>
              <p className="text-sm leading-7 text-slate-600">{signal.triggerReason}</p>
              <div className="flex flex-wrap gap-2">
                {signal.riskTags.map((tag: string) => <RiskBadge key={tag} value={tag} />)}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <div className="flex items-center gap-2 text-base font-semibold text-slate-900"><TrendingUp className="h-4 w-4 text-cyan-700" />交易建议卡片</div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-white bg-white p-3">
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">代码</div>
                    <div className="mt-2 text-lg font-bold">{signal.symbol}</div>
                  </div>
                  <div className="rounded-xl border border-white bg-white p-3">
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">名称</div>
                    <div className="mt-2 text-lg font-bold">{signal.name ?? signal.symbol}</div>
                  </div>
                  <div className="rounded-xl border border-white bg-white p-3">
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">行情对象</div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">{signal.securityLabel ?? `${signal.symbol} · ${signal.name ?? signal.symbol}`}</div>
                  </div>
                  <div className="rounded-xl border border-white bg-white p-3">
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">绑定键</div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">{signal.identityKey ?? `${signal.market}:${signal.symbol}`}</div>
                  </div>
                </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-white bg-white p-3">
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">方向</div>
                      <div className="mt-2 text-lg font-bold">{signal.suggestion.方向}</div>
                    </div>
                    <div className="rounded-xl border border-cyan-100 bg-cyan-50/80 p-3">
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-700">触发动作</div>
                      <div className="mt-2 text-lg font-bold text-cyan-950">{signal.suggestion.触发动作}</div>
                    </div>
                    <div className="rounded-xl border border-pink-100 bg-pink-50/80 p-3">
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-pink-700">触发价位</div>
                      <div className="mt-2 text-lg font-bold text-pink-950">{signal.suggestion.触发价位}</div>
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3">
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">止损价位</div>
                      <div className="mt-2 text-lg font-bold">{signal.suggestion.止损价位}</div>
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3">
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">失效条件</div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">{signal.suggestion.失效条件}</div>
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3 md:col-span-2 xl:col-span-1">
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">理由说明</div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">{signal.suggestion.理由说明}</div>
                    </div>
                  </div>

              </div>

              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold text-cyan-950"><Bot className="h-4 w-4" />LLM 自然语言解读</div>
                  <Button size="sm" variant="outline" onClick={() => interpretMutation.mutate({ signalId: signal.id })} disabled={interpretMutation.isPending}>
                    {signal.llmInterpretation ? "刷新解读" : "生成解读"}
                  </Button>
                </div>
                <Separator className="my-3 bg-cyan-200/70" />
                <p className="text-sm leading-7 text-slate-700">
                  {signal.llmInterpretation ?? "系统将在高价值实时信号出现时自动生成自然语言解读，用于补充入场逻辑、风险提示与执行注意事项。"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </BlueprintPageShell>
  );
}

export function AlertHistoryPage() {
  const [market, setMarket] = useState<Market | "all">("all");
  const [signalType, setSignalType] = useState<SignalType | "all">("all");
  const [date, setDate] = useState("");
  const [query, setQuery] = useState("");
  const { settings } = useTradingWorkspaceData();

  const alertFilters = useMemo(() => ({
    market: market === "all" ? undefined : market,
    signalType: signalType === "all" ? undefined : signalType,
    date: date || undefined,
    query: query || undefined,
  }), [market, signalType, date, query]);

  const alerts = trpc.alerts.list.useQuery(alertFilters, realtimeQueryOptions);
  const items = alerts.data ?? [];

  return (
    <BlueprintPageShell eyebrow="Alert Archive" title="信号告警历史" description="记录所有历史告警，并支持按日期、市场、信号类型和关键词进行组合筛选与搜索。" workspaceLabel={settings.data?.liveBridge.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Real Data Required · Awaiting Bridge"}>
      <Card className="border-white/80 bg-white/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><ShieldAlert className="h-5 w-5 text-pink-700" />筛选与检索</CardTitle>
          <CardDescription>从历史记录中快速定位你关心的信号模式。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <Select value={market} onValueChange={value => setMarket(value as Market | "all")}> 
              <SelectTrigger><SelectValue placeholder="选择市场" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部市场</SelectItem>
                <SelectItem value="US">US</SelectItem>
                <SelectItem value="HK">HK</SelectItem>
              </SelectContent>
            </Select>
            <Select value={signalType} onValueChange={value => setSignalType(value as SignalType | "all")}> 
              <SelectTrigger><SelectValue placeholder="选择信号类型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部信号</SelectItem>
                {(["突破啟動", "回踩續強", "盤口失衡", "冲高衰竭"] as SignalType[]).map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={date} onChange={event => setDate(event.target.value)} />
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题、标的或告警说明" />
          </div>
          {items.length === 0 ? (
            <EmptyState title="未找到匹配结果" description="尝试放宽筛选条件，或切换到其他市场与时间范围。" />
          ) : (
            <SmallTable
              headers={["时间", "市场", "标的", "信号", "等级", "标题", "通知", "来源"]}
              rows={items.map((alert: any) => [
                <span key={`${alert.id}-time`} className="font-mono text-xs">{new Date(alert.createdAtMs).toLocaleString()}</span>,
                <Badge key={`${alert.id}-market`} variant="outline" className="font-mono text-[11px]">{alert.market}</Badge>,
                <span key={`${alert.id}-symbol`} className="font-semibold">{alert.symbol}</span>,
                <span key={`${alert.id}-type`} className="text-slate-700">{alert.signalType}</span>,
                <AlertLevelBadge key={`${alert.id}-level`} level={alert.level} />, 
                <div key={`${alert.id}-title`}><div className="font-semibold text-slate-900">{alert.title}</div><div className="text-xs text-slate-500">{alert.message}</div></div>,
                <span key={`${alert.id}-notify`} className="font-mono text-xs text-slate-600">{alert.notifyTriggered ? "已通知" : "未通知"}</span>,
                <Badge key={`${alert.id}-source`} variant="outline" className={sourceModeTone(alert.sourceMode)}>{sourceModeLabel(alert.sourceMode)}</Badge>,
              ])}
            />
          )}
        </CardContent>
      </Card>
    </BlueprintPageShell>
  );
}

export function PreMarketScanPage() {
  const { scans, settings } = useTradingWorkspaceData();
  const items = scans.data ?? [];
  return (
    <BlueprintPageShell eyebrow="Pre-Market Scan" title="盘前扫描结果页" description="展示基于量比、成交额、盘前涨幅等条件筛选出的候选标的列表，帮助你在盘前迅速构建重点观察池。" workspaceLabel={settings.data?.liveBridge.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Real Data Required · Awaiting Bridge"}>
      <Card className="border-white/80 bg-white/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Radar className="h-5 w-5 text-cyan-700" />候选标的列表</CardTitle>
          <CardDescription>依据系统设置中的扫描阈值进行排序和展示。</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="暂无候选标的" description="请调整扫描阈值或等待下一次扫描执行。" />
          ) : (
            <SmallTable
              headers={["市场", "标的", "量比", "成交额", "盘前涨幅", "综合评分", "说明"]}
              rows={items.map((item: any) => [
                <Badge key={`${item.id}-market`} variant="outline" className="font-mono text-[11px]">{item.market}</Badge>,
                <div key={`${item.id}-symbol`}><div className="font-semibold text-slate-900">{item.symbol}</div><div className="text-xs text-slate-500">{item.name}</div></div>,
                <span key={`${item.id}-ratio`} className="font-semibold text-cyan-700">{item.volumeRatio.toFixed(1)}x</span>,
                <span key={`${item.id}-turnover`} className="font-mono text-xs">{formatNumber(item.turnover)}</span>,
                <span key={`${item.id}-premarket`} className="text-cyan-700">{formatSigned(item.premarketChangePct)}</span>,
                <Badge key={`${item.id}-score`} variant="outline" className="border-pink-200 bg-pink-50 font-mono text-pink-700">{item.rankScore}</Badge>,
                <p key={`${item.id}-notes`} className="max-w-sm text-sm leading-6 text-slate-600">{item.notes}</p>,
              ])}
            />
          )}
        </CardContent>
      </Card>
    </BlueprintPageShell>
  );
}

export function ReviewPage() {
  const { review, settings } = useTradingWorkspaceData();
  const data = review.data;
  return (
    <BlueprintPageShell eyebrow="Post-Market Review" title="盘后复盘报告" description="围绕命中率、误报分析、最佳信号与最差信号进行结构化复盘，帮助你迭代规则与注意力分配方式。" workspaceLabel={settings.data?.liveBridge.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Real Data Required · Awaiting Bridge"}>
      {!data ? (
        <EmptyState title="暂无复盘数据" description="收盘后系统会自动生成复盘摘要。" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard label="命中率" value={`${data.hitRate}%`} detail="当日统计" accent="border-cyan-200 bg-cyan-50 text-cyan-800" />
              <MetricCard label="分析日期" value={data.reviewDate} detail="Review Session" accent="border-pink-200 bg-pink-50 text-pink-800" />
            </div>
            <Card className="border-white/80 bg-white/90">
              <CardHeader>
                <CardTitle className="text-xl font-black tracking-[-0.03em]">误报分析</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-slate-700">{data.falsePositiveAnalysis}</p>
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-white/80 bg-white/90">
                <CardHeader>
                  <CardTitle className="text-lg font-black tracking-[-0.03em]">最佳信号</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-slate-700">{data.bestSignal}</p>
                </CardContent>
              </Card>
              <Card className="border-white/80 bg-white/90">
                <CardHeader>
                  <CardTitle className="text-lg font-black tracking-[-0.03em]">最差信号</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-slate-700">{data.worstSignal}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-white/80 bg-white/90">
            <CardHeader>
              <CardTitle className="text-xl font-black tracking-[-0.03em]">各信号命中率矩阵</CardTitle>
              <CardDescription>对四类信号进行横向对比，找出更值得信赖的模式。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.meta.accuracyBySignal.map((row: { signalType: SignalType; hitRate: number; occurrences: number }) => (
                <div key={row.signalType} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{row.signalType}</div>
                      <div className="font-mono text-xs text-slate-500">出现次数 {row.occurrences}</div>
                    </div>
                    <div className="text-2xl font-black tracking-[-0.04em]">{row.hitRate}%</div>
                  </div>
                  <div className="h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-[linear-gradient(90deg,#7dd3fc,#f9a8d4)]" style={{ width: `${row.hitRate}%` }} />
                  </div>
                </div>
              ))}
              <Separator />
              <p className="text-sm leading-7 text-slate-700">{data.meta.commentary}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </BlueprintPageShell>
  );
}

export function SettingsPage() {
  const utils = trpc.useUtils();
  const { settings } = useTradingWorkspaceData();
  const saveMutation = trpc.settings.save.useMutation({
    onSuccess: async () => {
      toast.success("系统设置已保存");
      await utils.settings.get.invalidate();
      await utils.dashboard.overview.invalidate();
      await utils.watchlist.list.invalidate();
      await utils.signals.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const bridgeTestMutation = trpc.settings.testBridgeConnection.useMutation({
    onSuccess: async result => {
      await utils.settings.get.invalidate();
      toast[result.reachable ? "success" : "warning"](result.summary);
    },
    onError: error => toast.error(error.message),
  });

  const [origin, setOrigin] = useState("");
  const [form, setForm] = useState({
    minVolumeRatio: "2.2",
    minTurnover: "120000000",
    minPremarketChangePct: "2.0",
    signalSensitivity: "标准" as SignalSensitivity,
    alertLevelPreference: "WARNING" as AlertLevel,
    watchlistLimit: "30",
    highScoreNotifyThreshold: "88",
    opendHost: "127.0.0.1",
    opendPort: "11111",
    trackedSymbols: "",
    bridgeToken: "",
    publishIntervalSeconds: "3",
    useLiveQuotes: true,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!settings.data) return;
    setForm({
      minVolumeRatio: String(settings.data.scanThresholds.minVolumeRatio),
      minTurnover: String(settings.data.scanThresholds.minTurnover),
      minPremarketChangePct: String(settings.data.scanThresholds.minPremarketChangePct),
      signalSensitivity: settings.data.signalSensitivity,
      alertLevelPreference: settings.data.alertLevelPreference,
      watchlistLimit: String(settings.data.watchlistLimit),
      highScoreNotifyThreshold: String(settings.data.highScoreNotifyThreshold),
      opendHost: settings.data.liveBridge.opendHost,
      opendPort: String(settings.data.liveBridge.opendPort),
      trackedSymbols: settings.data.liveBridge.trackedSymbols.join(","),
      bridgeToken: settings.data.liveBridge.bridgeToken,
      publishIntervalSeconds: String(settings.data.liveBridge.publishIntervalSeconds),
      useLiveQuotes: settings.data.liveBridge.useLiveQuotes,
    });
  }, [settings.data]);

  const ingestUrl = origin ? `${origin}/api/futu-bridge/ingest` : "/api/futu-bridge/ingest";
  const trackedSymbolList = form.trackedSymbols.split(",").map(item => item.trim()).filter(Boolean);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} 已复制`);
    } catch {
      toast.error(`复制 ${label} 失败，请手动复制`);
    }
  };

  return (
    <BlueprintPageShell eyebrow="System Settings" title="系统设置页" description="配置扫描阈值、信号灵敏度、告警等级偏好、观察名單上限、高评分自动通知阈值，以及 Windows 本地 OpenD 桥接参数。" workspaceLabel={settings.data?.liveBridge.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Real Data Required · Awaiting Bridge"}>
      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-4">
          <Card className="border-white/80 bg-white/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Settings2 className="h-5 w-5 text-cyan-700" />参数控制面板</CardTitle>
              <CardDescription>所有项目都会影响扫描、信号与通知节奏。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">扫描阈值 · 最低量比</label>
                <Input value={form.minVolumeRatio} onChange={event => setForm(prev => ({ ...prev, minVolumeRatio: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">扫描阈值 · 最低成交额</label>
                <Input value={form.minTurnover} onChange={event => setForm(prev => ({ ...prev, minTurnover: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">扫描阈值 · 最低盘前涨幅</label>
                <Input value={form.minPremarketChangePct} onChange={event => setForm(prev => ({ ...prev, minPremarketChangePct: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">信号灵敏度</label>
                <Select value={form.signalSensitivity} onValueChange={value => setForm(prev => ({ ...prev, signalSensitivity: value as SignalSensitivity }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="保守">保守</SelectItem>
                    <SelectItem value="标准">标准</SelectItem>
                    <SelectItem value="激进">激进</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">告警等级偏好</label>
                <Select value={form.alertLevelPreference} onValueChange={value => setForm(prev => ({ ...prev, alertLevelPreference: value as AlertLevel }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFO">INFO</SelectItem>
                    <SelectItem value="WARNING">WARNING</SelectItem>
                    <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">观察名單上限</label>
                <Input value={form.watchlistLimit} onChange={event => setForm(prev => ({ ...prev, watchlistLimit: event.target.value }))} />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">高评分通知阈值</label>
                <Input value={form.highScoreNotifyThreshold} onChange={event => setForm(prev => ({ ...prev, highScoreNotifyThreshold: event.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/80 bg-white/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]">{settings.data?.liveBridge.connectionStatus === "已连接" ? <Wifi className="h-5 w-5 text-cyan-700" /> : <WifiOff className="h-5 w-5 text-pink-700" />}富途本地桥接配置</CardTitle>
              <CardDescription>用于把 Windows 本机 OpenD 的实时港股行情推送到云端仪表盘。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">OpenD 地址</label>
                <Input value={form.opendHost} onChange={event => setForm(prev => ({ ...prev, opendHost: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">OpenD 端口</label>
                <Input value={form.opendPort} onChange={event => setForm(prev => ({ ...prev, opendPort: event.target.value }))} />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">追踪标的</label>
                <Input value={form.trackedSymbols} onChange={event => setForm(prev => ({ ...prev, trackedSymbols: event.target.value }))} placeholder="输入真实追踪代码，逗号分隔，例如 03690,09992" />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">桥接令牌</label>
                <div className="flex gap-2">
                  <Input value={form.bridgeToken} onChange={event => setForm(prev => ({ ...prev, bridgeToken: event.target.value }))} />
                  <Button type="button" variant="outline" onClick={() => copyText(form.bridgeToken, "桥接令牌")}><Copy className="mr-2 h-4 w-4" />复制</Button>
                </div>
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">推送间隔（秒）</label>
                <Input value={form.publishIntervalSeconds} onChange={event => setForm(prev => ({ ...prev, publishIntervalSeconds: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">数据模式</label>
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-950">系统已锁定为仅展示真实数据；桥接未连接时会显示空状态，而不会回退演示行情。</div>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">云端接收地址</label>
                <div className="flex gap-2">
                  <Input value={ingestUrl} readOnly />
                  <Button type="button" variant="outline" onClick={() => copyText(ingestUrl, "接收地址")}><Copy className="mr-2 h-4 w-4" />复制</Button>
                </div>
              </div>
              <div className="md:col-span-2 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={bridgeStatusTone(settings.data?.liveBridge.connectionStatus ?? "未连接")}>{settings.data?.liveBridge.connectionStatus ?? "未连接"}</Badge>
                  <span>最近心跳：{formatDateTime(settings.data?.liveBridge.lastBridgeHeartbeatAt)}</span>
                </div>
                <div>最近行情更新时间：{formatDateTime(settings.data?.liveBridge.lastQuoteAt)}</div>
                {settings.data?.liveBridge.lastError ? <div className="text-pink-700">最近错误：{settings.data.liveBridge.lastError}</div> : <div className="text-slate-500">如果一直显示“未连接”，通常说明 Windows 侧桥接程序还没有真正启动，或桥接令牌 / 云端接收地址没有填写正确。</div>}
              </div>
              <div className="md:col-span-2 rounded-3xl border border-cyan-200 bg-cyan-50/70 p-5">
                <div className="flex items-center gap-2 text-base font-semibold text-cyan-950"><Clock3 className="h-4 w-4" />我该怎么连接</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/90 bg-white/90 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">Step 1</div>
                    <div className="mt-2 font-semibold text-slate-900">在你的 Windows 电脑保持 Futu OpenD 已登录</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">确认 OpenD 监听地址为 {form.opendHost}，端口为 {form.opendPort}，并保持富途窗口不要退出。</p>
                  </div>
                  <div className="rounded-2xl border border-white/90 bg-white/90 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">Step 2</div>
                    <div className="mt-2 font-semibold text-slate-900">在本页复制“云端接收地址”和“桥接令牌”</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">这两个值要填写到 Windows 桥接脚本配置里，少一个都无法回传行情。</p>
                  </div>
                  <div className="rounded-2xl border border-white/90 bg-white/90 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">Step 3</div>
                    <div className="mt-2 font-semibold text-slate-900">在 Windows 里运行桥接脚本</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">先安装 `pip install futu-api requests`，再运行 `python .\\windows_futu_bridge.py --config .\\bridge_config.json`。必须显式带上 `--config`，否则脚本不会读取配置文件。</p>
                  </div>
                  <div className="rounded-2xl border border-white/90 bg-white/90 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">Step 4</div>
                    <div className="mt-2 font-semibold text-slate-900">回到本页点击“测试桥接联通”</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">如果最近心跳和最近行情都刷新，就代表本地 OpenD 已经真正桥连成功。</p>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 space-y-3">
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => saveMutation.mutate({
                      scanThresholds: {
                        minVolumeRatio: Number(form.minVolumeRatio),
                        minTurnover: Number(form.minTurnover),
                        minPremarketChangePct: Number(form.minPremarketChangePct),
                      },
                      signalSensitivity: form.signalSensitivity,
                      alertLevelPreference: form.alertLevelPreference,
                      watchlistLimit: Number(form.watchlistLimit),
                      highScoreNotifyThreshold: Number(form.highScoreNotifyThreshold),
                      liveBridge: {
                        opendHost: form.opendHost,
                        opendPort: Number(form.opendPort),
                        trackedSymbols: trackedSymbolList,
                        bridgeToken: form.bridgeToken,
                        publishIntervalSeconds: Number(form.publishIntervalSeconds),
                        useLiveQuotes: form.useLiveQuotes,
                      },
                    })}
                    disabled={saveMutation.isPending || trackedSymbolList.length === 0 || form.bridgeToken.trim().length < 8}
                  >
                    {saveMutation.isPending ? "保存中..." : "保存设置与桥接配置"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => bridgeTestMutation.mutate()}
                    disabled={bridgeTestMutation.isPending}
                  >
                    <RefreshCcw className={`mr-2 h-4 w-4 ${bridgeTestMutation.isPending ? "animate-spin" : ""}`} />
                    {bridgeTestMutation.isPending ? "测试中..." : "测试桥接联通"}
                  </Button>
                </div>
                {bridgeTestMutation.data ? (
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm leading-7 text-slate-700">
                    <div className="font-semibold text-slate-900">联通测试结果</div>
                    <div className="mt-2">{bridgeTestMutation.data.summary}</div>
                    <div className="mt-2 font-mono text-xs text-slate-500">
                      Host {bridgeTestMutation.data.details.opendHost}:{bridgeTestMutation.data.details.opendPort} · Symbols {bridgeTestMutation.data.details.trackedSymbols.join(", ")} · Recent Heartbeat {bridgeTestMutation.data.details.recentHeartbeat ? "YES" : "NO"} · Recent Quote {bridgeTestMutation.data.details.recentQuote ? "YES" : "NO"}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Bot className="h-5 w-5 text-pink-700" />桥接与策略说明</CardTitle>
            <CardDescription>这些设置如何影响 Shawn Wang 量化盯盘系统当前的实时工作方式。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-slate-700">
            <p>扫描阈值越高，盘前候选池越集中；信号灵敏度越激进，系统越可能更早提示机会，但误报概率也会上升。</p>
            <p>高评分通知阈值决定何时向系统拥有者发送提醒；桥接令牌和云端接收地址则决定你的 Windows 本地桥接程序能否把 OpenD 实时行情安全推送进网页系统。</p>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
              <div className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-700">Current Emphasis</div>
              <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-900">{form.signalSensitivity}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">当前系统会以 {form.signalSensitivity} 模式评估四类信号，并在达到 {form.highScoreNotifyThreshold} 分时尝试触发自动通知。</p>
            </div>
              <div className="rounded-2xl border border-pink-200 bg-pink-50/80 p-4">
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-pink-700">Windows 本地桥接步骤</div>
                <ol className="mt-3 space-y-2 pl-5 list-decimal">
                  <li>保持 Futu OpenD 已登录，地址为 {form.opendHost}，端口为 {form.opendPort}。</li>
                  <li>在本地桥接程序配置中填入当前页面展示的云端接收地址和桥接令牌，配置键名需使用 `cloud_ingest_url`、`bridge_token`、`opend_host`、`opend_port`、`tracked_symbols`、`publish_interval_seconds`。</li>
                  <li>`tracked_symbols` 必须填写为你的真实追踪代码数组；你当前可直接使用 `["03690","09992"]`，分别对应 HK 03690 美团-W 与 HK 09992 泡泡马特。留空会报 `tracked_symbols 不能为空`。</li>
                  <li>启动时必须使用 `python .\\windows_futu_bridge.py --config .\\bridge_config.json`；在 PowerShell 中也必须保留 `--config` 与配置文件路径的显式写法。</li>
                  <li>当桥接状态变为“已连接”时，仪表板、观察名單和实时信号页会自动刷新为实时行情驱动。</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-900"><Clock3 className="h-4 w-4" />当前桥接摘要</div>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div>接收地址：{ingestUrl}</div>
                  <div>桥接间隔：{form.publishIntervalSeconds} 秒</div>
                  <div>追踪标的：{trackedSymbolList.join("、")}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-700">可直接复制的 PowerShell 启动命令</div>
                <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950/95 p-4 font-mono text-xs leading-6 text-cyan-100">python .\\windows_futu_bridge.py --config .\\bridge_config.json</pre>
                <p className="mt-3 text-sm leading-6 text-slate-700">如果配置文件不在当前目录，请写完整路径，例如：`python .\\windows_futu_bridge.py --config C:\\futu\\bridge_config.json`。PowerShell 下不要省略 `--config`，也不要把 JSON 路径写成位置参数。</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-slate-500">bridge_config.json 键名示例</div>
                <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950/95 p-4 font-mono text-xs leading-6 text-cyan-100">{`{
  "cloud_ingest_url": "${ingestUrl}",
  "bridge_token": "${form.bridgeToken}",
  "opend_host": "${form.opendHost}",
  "opend_port": ${form.opendPort},
  "tracked_symbols": [${trackedSymbolList.map(symbol => `"${symbol}"`).join(", ")}],
  "publish_interval_seconds": ${form.publishIntervalSeconds}
}`}</pre>
              </div>
              <div className="rounded-2xl border border-pink-200 bg-pink-50/80 p-4 text-sm leading-7 text-pink-900">
                <div className="font-semibold">首轮启动后如何验证与排错</div>
                <div className="mt-3 space-y-2">
                  <p>如果提示“参数缺失”，通常表示命令里漏掉了 `--config` 或配置文件路径。</p>
                  <p>如果提示“配置文件不存在”，请确认 `bridge_config.json` 的真实路径与 PowerShell 当前目录一致，必要时改用绝对路径。</p>
                  <p>如果日志提示“云端地址未填写”，请检查 `cloud_ingest_url` 是否完整复制自当前页面的接收地址。</p>
                  <p>如果显示“OpenD 未连接”，说明 Windows 本机的 Futu OpenD 尚未登录或地址 / 端口与这里填写的不一致。</p>
                  <p>如果出现 `tracked_symbols 不能为空`，请把 `tracked_symbols` 写成至少包含一个真实股票代码的数组，并与本页“追踪标的”保持一致。</p>
                </div>
              </div>

          </CardContent>
        </Card>
      </div>
    </BlueprintPageShell>
  );
}

export function WorkspaceLandingPage() {
  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList className="grid h-auto w-full grid-cols-2 bg-white/70 p-1 md:grid-cols-4 xl:grid-cols-7">
        <TabsTrigger value="dashboard">仪表板</TabsTrigger>
        <TabsTrigger value="watchlist">观察名單</TabsTrigger>
        <TabsTrigger value="signals">实时信号</TabsTrigger>
        <TabsTrigger value="alerts">告警历史</TabsTrigger>
        <TabsTrigger value="scans">盘前扫描</TabsTrigger>
        <TabsTrigger value="review">盘后复盘</TabsTrigger>
        <TabsTrigger value="settings">系统设置</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard"><DashboardPage /></TabsContent>
      <TabsContent value="watchlist"><WatchlistPage /></TabsContent>
      <TabsContent value="signals"><SignalsPage /></TabsContent>
      <TabsContent value="alerts"><AlertHistoryPage /></TabsContent>
      <TabsContent value="scans"><PreMarketScanPage /></TabsContent>
      <TabsContent value="review"><ReviewPage /></TabsContent>
      <TabsContent value="settings"><SettingsPage /></TabsContent>
    </Tabs>
  );
}
