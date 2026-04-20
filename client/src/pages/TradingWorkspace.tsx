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
import { Area, AreaChart, CartesianGrid, Line, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts";

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

function BlueprintPageShell({
  title,
  description,
  eyebrow,
  children,
  workspaceLabel = "Demo Feed · Mock Workspace",
}: {
  title: string;
  description: string;
  eyebrow: string;
  children: React.ReactNode;
  workspaceLabel?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/88 p-6 shadow-[0_24px_90px_-48px_rgba(14,116,144,0.55)] backdrop-blur-sm md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.18),transparent_28%),linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] [background-size:auto,auto,28px_28px,28px_28px]" />
      <div className="pointer-events-none absolute right-6 top-6 hidden rounded-2xl border border-cyan-200/70 bg-white/70 px-4 py-3 font-mono text-[11px] leading-6 text-slate-400 lg:block">
        <div>f(x) = Σ(wᵢ · xᵢ) + ε</div>
        <div>R = ∫ P(t) dV / σ</div>
        <div>Δt · momentum &gt; threshold</div>
      </div>
      <div className="pointer-events-none absolute bottom-6 left-6 hidden rounded-full border border-pink-200/80 bg-white/70 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-pink-500 md:block">
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

  if (overview.isLoading) {
    return <BlueprintPageShell eyebrow="Dashboard" title="仪表板主页" description="正在汇总实时行情、市场状态与信号摘要。"><EmptyState title="加载中" description="系统正在建立实时观察环境。" /></BlueprintPageShell>;
  }

  const data = overview.data;
  if (!data) {
    return <BlueprintPageShell eyebrow="Dashboard" title="仪表板主页" description="暂无可用数据。"><EmptyState title="暂无数据" description="请稍后刷新，或先在观察名單中添加标的。" /></BlueprintPageShell>;
  }

  const liveAlerts = (data.latestSignals ?? []).filter((signal: any) => signal.triggerAction === "买入提醒" || signal.triggerAction === "卖出提醒");

  return (
    <BlueprintPageShell
      eyebrow="Dashboard"
      title="预测与指令仪表板"
      description="主面板现在围绕已选观察标的集中显示预测走势线、策略学习反馈、明确买卖点、止损位、失效条件与实时提醒，让你在同一个界面完成看盘、判断与执行准备。"
      workspaceLabel={data.liveBridge.sourceLabel}
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="当前观察名單" value={String(data.watchlist.length)} detail="仅展示已选跟踪标的" accent="border-cyan-200 bg-cyan-50 text-cyan-800" />
        <MetricCard label="高评分机会" value={String(data.highScoreCount)} detail={`达到 ${data.liveBridge.useLiveQuotes ? "实时" : "演示"} 通知阈值`} accent="border-pink-200 bg-pink-50 text-pink-800" />
        <MetricCard label="策略学习命中率" value={`${data.strategyLearning.successRate}%`} detail={`${data.strategyLearning.evaluatedCount} 条已评估建议`} accent="border-slate-200 bg-slate-50 text-slate-700" />
        <MetricCard label="当日命中率" value={`${data.hitRate}%`} detail="盘后复盘统计" accent="border-cyan-200 bg-cyan-50 text-cyan-800" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <Card className="border-white/80 bg-white/90 shadow-[0_22px_80px_-40px_rgba(14,116,144,0.5)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Bell className="h-5 w-5 text-pink-700" />即时动作指令</CardTitle>
            <CardDescription>把最需要立即关注的买入 / 卖出提醒提升到首页最高视觉优先级。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveAlerts.length > 0 ? liveAlerts.map((signal: any) => (
              <div key={signal.id} className={`rounded-[1.6rem] border px-5 py-4 ${signal.triggerAction === "买入提醒" ? "border-cyan-200 bg-cyan-50/80" : "border-pink-200 bg-pink-50/80"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[11px]">{signal.market}</Badge>
                      <Badge variant="outline" className={signal.triggerAction === "买入提醒" ? "border-cyan-200 bg-white font-mono text-cyan-800" : "border-pink-200 bg-white font-mono text-pink-700"}>{signal.triggerAction}</Badge>
                      <Badge variant="outline" className="border-slate-200 bg-white font-mono text-slate-600">{signal.signalType}</Badge>
                    </div>
                    <div>
                      <div className="text-2xl font-black tracking-[-0.04em] text-slate-900">{signal.symbol}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{signal.llmForecastSummary ?? signal.triggerReason}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-right shadow-sm">
                    <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">Score</div>
                    <div className="text-3xl font-black tracking-[-0.04em] text-slate-900">{signal.score}</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-white/80 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">执行动作</div>
                    <div className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-900">{signal.triggerAction}</div>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">触发价位</div>
                    <div className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-900">{signal.triggerPrice}</div>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">止损价位</div>
                    <div className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-900">{signal.stopLossPrice ?? "--"}</div>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">学习状态</div>
                    <div className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-900">{signal.learningStatus}</div>
                  </div>
                </div>
              </div>
            )) : (
              <EmptyState title="暂无即时动作提醒" description="当前观察标的尚未触发明确买卖点，系统仍会持续刷新预测走势与策略建议。" />
            )}
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Bot className="h-5 w-5 text-cyan-700" />策略自优化引擎</CardTitle>
            <CardDescription>系统会根据历史买卖建议表现，持续调整信号权重与提醒强度。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-700">Adaptive Weight</div>
                <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{data.strategyLearning.adaptiveWeight}x</div>
                <p className="mt-2 text-sm text-slate-600">系统已根据历史建议表现，对未来评分与预测线斜率做动态校正。</p>
              </div>
              <div className="rounded-2xl border border-pink-200 bg-pink-50/70 p-4">
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-pink-700">近期偏差</div>
                <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{data.strategyLearning.averageAdversePct}%</div>
                <p className="mt-2 text-sm text-slate-600">平均不利波动越低，后续相同类型信号会得到更高策略权重。</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm leading-7 text-slate-600">
              当前最强策略类型为 <span className="font-semibold text-slate-900">{data.strategyLearning.strongestSignalType}</span>，
              当前最需要谨慎修正的类型为 <span className="font-semibold text-slate-900">{data.strategyLearning.weakestSignalType}</span>。
              系统会把历史建议的命中、失效与回撤结果纳入后续预测走势线和实时评分中。
            </div>
            <div className="flex flex-wrap gap-3">
              <MarketPill market="US" status={data.marketStatus.US} />
              <MarketPill market="HK" status={data.marketStatus.HK} />
              <div className={`rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] ${bridgeStatusTone(data.liveBridge.connectionStatus)}`}>
                桥接状态 · {data.liveBridge.connectionStatus}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600">
              <div>桥接地址：{data.liveBridge.opendHost}:{data.liveBridge.opendPort}</div>
              <div className="mt-2">已选跟踪：{data.liveBridge.trackedSymbols.join(" · ")}</div>
              <div className="mt-2">最近行情更新：{formatDateTime(data.liveBridge.lastQuoteAt)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {data.liveBoard.map((item: any) => (
          <Card key={`${item.market}-${item.symbol}`} className="border-white/80 bg-white/92 shadow-[0_24px_90px_-48px_rgba(15,23,42,0.32)]">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[11px]">{item.market}</Badge>
                    <Badge variant="outline" className={item.sourceMode === "live" ? "border-cyan-200 bg-cyan-50 font-mono text-cyan-800" : "font-mono"}>{item.sourceMode === "live" ? "LIVE" : "DEMO"}</Badge>
                    <Badge variant="outline" className={item.forecastSummary.trendBias === "偏多" ? "border-cyan-200 bg-cyan-50 font-mono text-cyan-800" : "border-pink-200 bg-pink-50 font-mono text-pink-700"}>{item.forecastSummary.trendBias}</Badge>
                    {item.activeSignalType ? <Badge variant="outline" className="border-slate-200 bg-white font-mono text-slate-700">{item.activeSignalType}</Badge> : null}
                  </div>
                  <div>
                    <CardTitle className="text-3xl font-black tracking-[-0.04em] text-slate-900">{item.symbol} · {item.name}</CardTitle>
                    <CardDescription className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{item.llmStrategyNote}</CardDescription>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[24rem]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">最新价</div>
                    <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{formatNumber(item.lastPrice)}</div>
                    <div className={`mt-2 text-sm ${item.changePct >= 0 ? "text-cyan-700" : "text-pink-700"}`}>{formatSigned(item.changePct)}</div>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-700">预测终点</div>
                    <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{item.forecastSummary.predictedPrice}</div>
                    <div className={`mt-2 text-sm ${item.forecastSummary.predictedChangePct >= 0 ? "text-cyan-700" : "text-pink-700"}`}>{formatSigned(item.forecastSummary.predictedChangePct)}</div>
                  </div>
                  <div className="rounded-2xl border border-pink-200 bg-pink-50/80 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-pink-700">预测置信度</div>
                    <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{item.forecastSummary.confidence}</div>
                    <div className="mt-2 text-sm text-slate-600">{item.llmForecastBias} · 历史建议自适应修正后</div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.9))] p-4">
                <ChartContainer
                  className="h-[320px] w-full"
                  config={{
                    price: { label: "实时价格", color: "#06b6d4" },
                    forecastPrice: { label: "预测走势线", color: "#ec4899" },
                  }}
                >
                  <AreaChart data={item.chart} margin={{ left: 12, right: 12, top: 16, bottom: 4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    {item.suggestionTriggerPrice ? <ReferenceLine y={item.suggestionTriggerPrice} stroke="#06b6d4" strokeDasharray="6 6" label={{ value: `触发 ${item.suggestionTriggerPrice}`, position: "insideTopRight", fill: "#0891b2", fontSize: 11 }} /> : null}
                    {item.suggestionStopLossPrice ? <ReferenceLine y={item.suggestionStopLossPrice} stroke="#ec4899" strokeDasharray="4 4" label={{ value: `止损 ${item.suggestionStopLossPrice}`, position: "insideBottomRight", fill: "#be185d", fontSize: 11 }} /> : null}
                    {item.latestMarker?.label ? <ReferenceDot x={item.latestMarker.label} y={item.latestMarker.price} r={5} fill="#0f172a" stroke="#ffffff" strokeWidth={2} /> : null}
                    {item.triggerMarker?.label ? <ReferenceDot x={item.triggerMarker.label} y={item.triggerMarker.price} r={6} fill="#06b6d4" stroke="#ffffff" strokeWidth={2} /> : null}
                    <Area type="monotone" dataKey="price" stroke="#06b6d4" fill="#67e8f9" fillOpacity={0.16} strokeWidth={3} connectNulls />
                    <Line type="monotone" dataKey="forecastPrice" stroke="#ec4899" strokeWidth={3} dot={false} strokeDasharray="7 5" connectNulls />
                  </AreaChart>
                </ChartContainer>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">黑点：最新价 marker</span>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-800">青点：触发点 marker</span>
                <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-pink-700">粉虚线：止损位</span>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">当前策略</div>
                    <div className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-900">{item.activeSignalType ?? "趋势跟踪"}</div>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-700">执行动作</div>
                    <div className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-900">{item.suggestionAction ?? "观察中"}</div>
                  </div>
                  <div className="rounded-2xl border border-pink-200 bg-pink-50/80 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-pink-700">触发价位</div>
                    <div className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-900">{item.suggestionTriggerPrice ?? "--"}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">失效 / 止损</div>
                    <div className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-900">{item.suggestionStopLossPrice ?? "--"}</div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">执行前提</div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">{item.executionPrerequisite}</div>
                  </div>
                  <div className="rounded-2xl border border-pink-200 bg-pink-50/70 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-pink-700">风险等级</div>
                    <div className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">{item.riskLevel}</div>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-700">LLM 预测摘要</div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">{item.llmForecastSummary}</div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 font-semibold text-slate-900"><TrendingUp className="h-4 w-4 text-cyan-700" />策略学习反馈</div>
                  {item.failureReason ? <div className="mt-3 rounded-2xl border border-pink-200 bg-pink-50/70 px-4 py-3 text-sm text-pink-900">最近失效原因：{item.failureReason}</div> : null}
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/90 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">命中率</div>
                      <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-900">{item.strategyLearning.successRate}%</div>
                    </div>
                    <div className="rounded-2xl bg-white/90 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">当前权重</div>
                      <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-900">{item.strategyLearning.adaptiveWeight}x</div>
                    </div>
                    <div className="rounded-2xl bg-white/90 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">平均收益</div>
                      <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-900">{item.strategyLearning.averageReturnPct}%</div>
                    </div>
                    <div className="rounded-2xl bg-white/90 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">平均不利波动</div>
                      <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-900">{item.strategyLearning.averageAdversePct}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
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
    <BlueprintPageShell eyebrow="Watchlist" title="观察名單管理" description="支持新增、删除港股与美股标的，设置优先级，并在同一页面持续查看实时价格、涨跌幅、成交量与数据来源。" workspaceLabel={bridge?.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Demo Feed · Mock Workspace"}>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.3fr]">
        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Search className="h-5 w-5 text-cyan-700" />新增监控标的</CardTitle>
            <CardDescription>首批建议先围绕美团与泡泡玛特构建港股实时监控池。</CardDescription>
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
                <Input value={form.symbol} onChange={event => setForm(prev => ({ ...prev, symbol: event.target.value.toUpperCase() }))} placeholder="例如 03690 或 NVDA" />
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">标的名称</label>
                <Input value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} placeholder="例如 美团-W / 泡泡玛特" />
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
                  <Badge key={`${item.id}-source`} variant="outline" className={item.sourceMode === "live" ? "border-cyan-200 bg-cyan-50 font-mono text-cyan-800" : "font-mono"}>{item.sourceMode === "live" ? "LIVE" : "DEMO"}</Badge>,
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
      <BlueprintPageShell eyebrow="Live Signals" title="实时信号面板" description="围绕“突破啟動、回踩續強、盤口失衡、冲高衰竭”四类信号实时展示价格、评分、理由，以及盘中明确买入或卖出触发点。" workspaceLabel={bridge?.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Demo Feed · Mock Workspace"}>

      <div className="grid gap-4 md:grid-cols-2">
        {signalItems.map((signal: any) => (
          <Card key={signal.id} className="border-white/80 bg-white/92 shadow-[0_16px_60px_-36px_rgba(14,116,144,0.5)]">
            <CardHeader className="space-y-4 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[11px]">{signal.market}</Badge>
                    <Badge variant="outline" className="border-cyan-200 bg-cyan-50 font-mono text-cyan-800">{signal.signalType}</Badge>
                    <Badge variant="outline" className={signal.sourceMode === "live" ? "border-pink-200 bg-pink-50 font-mono text-pink-700" : "font-mono"}>{signal.sourceMode === "live" ? "LIVE" : "DEMO"}</Badge>
                  </div>
                  <CardTitle className="mt-3 text-2xl font-black tracking-[-0.03em]">{signal.symbol}</CardTitle>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>价格 {signal.quotePrice}</span>
                    <span>·</span>
                    <span className={signal.quoteChangePct >= 0 ? "text-cyan-700" : "text-pink-700"}>{formatSigned(signal.quoteChangePct)}</span>
                    <span>·</span>
                    <span>成交量 {formatNumber(signal.quoteVolume)}</span>
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
    <BlueprintPageShell eyebrow="Alert Archive" title="信号告警历史" description="记录所有历史告警，并支持按日期、市场、信号类型和关键词进行组合筛选与搜索。" workspaceLabel={settings.data?.liveBridge.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Demo Feed · Mock Workspace"}>
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
                <Badge key={`${alert.id}-source`} variant="outline" className={alert.sourceMode === "live" ? "border-cyan-200 bg-cyan-50 font-mono text-cyan-800" : "font-mono"}>{alert.sourceMode === "live" ? "LIVE" : "DEMO"}</Badge>,
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
    <BlueprintPageShell eyebrow="Pre-Market Scan" title="盘前扫描结果页" description="展示基于量比、成交额、盘前涨幅等条件筛选出的候选标的列表，帮助你在盘前迅速构建重点观察池。" workspaceLabel={settings.data?.liveBridge.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Demo Feed · Mock Workspace"}>
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
    <BlueprintPageShell eyebrow="Post-Market Review" title="盘后复盘报告" description="围绕命中率、误报分析、最佳信号与最差信号进行结构化复盘，帮助你迭代规则与注意力分配方式。" workspaceLabel={settings.data?.liveBridge.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Demo Feed · Mock Workspace"}>
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
    trackedSymbols: "03690,09992",
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
    <BlueprintPageShell eyebrow="System Settings" title="系统设置页" description="配置扫描阈值、信号灵敏度、告警等级偏好、观察名單上限、高评分自动通知阈值，以及 Windows 本地 OpenD 桥接参数。" workspaceLabel={settings.data?.liveBridge.useLiveQuotes ? "Live Futu Feed · Local OpenD Bridge" : "Demo Feed · Mock Workspace"}>
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
                <Input value={form.trackedSymbols} onChange={event => setForm(prev => ({ ...prev, trackedSymbols: event.target.value }))} placeholder="03690,09992" />
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
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">实时模式</label>
                <Select value={form.useLiveQuotes ? "live" : "demo"} onValueChange={value => setForm(prev => ({ ...prev, useLiveQuotes: value === "live" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">启用实时行情</SelectItem>
                    <SelectItem value="demo">仅使用演示数据</SelectItem>
                  </SelectContent>
                </Select>
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
                    <p className="mt-2 text-sm leading-6 text-slate-600">先安装 `pip install futu-api requests`，再运行 `python .\\windows_futu_bridge.py --config .\\bridge_config.json`。</p>
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
                <li>在本地桥接程序配置中填入当前页面展示的云端接收地址和桥接令牌。</li>
                <li>追踪标的默认填入 {trackedSymbolList.join("、")}，桥接程序会周期性拉取报价并回推到本系统。</li>
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
