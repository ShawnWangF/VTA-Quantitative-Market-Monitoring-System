import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, Bot, CandlestickChart, Database, LayoutDashboard, Radar, Search, Settings2, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Market = "US" | "HK";
type SignalType = "突破啟動" | "回踩續強" | "盤口失衡" | "冲高衰竭";
type AlertLevel = "INFO" | "WARNING" | "CRITICAL";
type SignalSensitivity = "保守" | "标准" | "激进";

function useTradingWorkspaceData() {
  const overview = trpc.dashboard.overview.useQuery();
  const watchlist = trpc.watchlist.list.useQuery();
  const signals = trpc.signals.list.useQuery();
  const scans = trpc.scans.list.useQuery();
  const review = trpc.review.latest.useQuery();
  const settings = trpc.settings.get.useQuery();
  return { overview, watchlist, signals, scans, review, settings };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-Hans", { maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

function formatSigned(value: number, digits = 2) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

function BlueprintPageShell({ title, description, eyebrow, children }: { title: string; description: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-[0_24px_90px_-48px_rgba(14,116,144,0.55)] backdrop-blur-sm md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.2),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.18),transparent_28%),linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:auto,auto,28px_28px,28px_28px]" />
      <div className="pointer-events-none absolute right-6 top-6 hidden rounded-2xl border border-cyan-200/70 bg-white/70 px-4 py-3 font-mono text-[11px] leading-6 text-slate-400 lg:block">
        <div>f(x) = &Sigma;(wᵢ · xᵢ) + &epsilon;</div>
        <div>R = &int; P(t) dV / &sigma;</div>
        <div>&Delta;t · momentum &gt; threshold</div>
      </div>
      <div className="pointer-events-none absolute bottom-6 left-6 hidden rounded-full border border-pink-200/80 bg-white/70 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-pink-500 md:block">
        Demo Feed · Mock Workspace
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
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Demo Data / Signal Research Workspace</div>
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
    return <BlueprintPageShell eyebrow="Dashboard" title="仪表板主页" description="正在汇总市场状态、观察名單与最新信号摘要。"><EmptyState title="加载中" description="系统正在构建今日的观察环境。" /></BlueprintPageShell>;
  }

  const data = overview.data;
  if (!data) {
    return <BlueprintPageShell eyebrow="Dashboard" title="仪表板主页" description="暂无可用数据。"><EmptyState title="暂无数据" description="请稍后刷新，或先在观察名單中添加标的。" /></BlueprintPageShell>;
  }

  return (
    <BlueprintPageShell
      eyebrow="Dashboard"
      title="仪表板主页"
      description="这里汇总当日观察名單、市场开盘状态、最新信号摘要与告警统计，帮助你在一个视图内完成市场扫描与执行优先级判断。"
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="当前观察名單" value={String(data.watchlist.length)} detail="实时监控池" accent="border-cyan-200 bg-cyan-50 text-cyan-800" />
        <MetricCard label="高评分机会" value={String(data.highScoreCount)} detail="达到通知阈值" accent="border-pink-200 bg-pink-50 text-pink-800" />
        <MetricCard label="告警总量" value={String(data.alertStats.total)} detail={`${data.alertStats.critical} 条 CRITICAL`} accent="border-slate-200 bg-slate-50 text-slate-700" />
        <MetricCard label="当日命中率" value={`${data.hitRate}%`} detail="盘后复盘统计" accent="border-cyan-200 bg-cyan-50 text-cyan-800" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><LayoutDashboard className="h-5 w-5 text-cyan-700" />市场状态</CardTitle>
            <CardDescription>美股与港股交易时段状态，以及系统当前的监控节奏。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <MarketPill market="US" status={data.marketStatus.US} />
              <MarketPill market="HK" status={data.marketStatus.HK} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                <div className="font-mono text-xs uppercase tracking-[0.26em] text-cyan-700">Signal Flux</div>
                <div className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-900">{data.latestSignals.length}</div>
                <p className="mt-2 text-sm text-slate-600">系统已在当前会话中抓取最新可执行信号摘要，适合快速判断注意力分配。</p>
              </div>
              <div className="rounded-2xl border border-pink-200 bg-pink-50/80 p-4">
                <div className="font-mono text-xs uppercase tracking-[0.26em] text-pink-700">Alert Geometry</div>
                <div className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-900">{data.alertStats.warning + data.alertStats.critical}</div>
                <p className="mt-2 text-sm text-slate-600">高优先级告警会同时在系统内突出展示，并对超过阈值的关键信号发送通知。</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Bell className="h-5 w-5 text-pink-700" />告警统计</CardTitle>
            <CardDescription>按照告警等级拆分当前会话内的事件强度。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["CRITICAL", data.alertStats.critical],
              ["WARNING", data.alertStats.warning],
              ["INFO", data.alertStats.info],
            ].map(([level, count]) => (
              <div key={level} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.24em] text-slate-500">{level}</span>
                  <span className="text-2xl font-black tracking-[-0.04em]">{count}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white">
                  <div className={`h-2 rounded-full ${level === "CRITICAL" ? "bg-pink-400" : level === "WARNING" ? "bg-cyan-400" : "bg-slate-300"}`} style={{ width: `${Math.min(100, Number(count) * 25)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Radar className="h-5 w-5 text-cyan-700" />当前观察名單</CardTitle>
            <CardDescription>优先展示高优先级与当前仍活跃的重点标的。</CardDescription>
          </CardHeader>
          <CardContent>
            <SmallTable
              headers={["市场", "标的", "优先级", "最新价", "涨跌幅", "成交量"]}
              rows={data.watchlist.slice(0, 6).map(item => [
                <Badge key={`${item.symbol}-market`} variant="outline" className="font-mono text-[11px]">{item.market}</Badge>,
                <div key={item.symbol}><div className="font-semibold text-slate-900">{item.symbol}</div><div className="text-xs text-slate-500">{item.name}</div></div>,
                <div key={`${item.symbol}-priority`} className="font-mono text-sm">P{item.priority}</div>,
                <div key={`${item.symbol}-price`} className="font-semibold">{formatNumber(item.lastPrice)}</div>,
                <div key={`${item.symbol}-change`} className={item.changePct >= 0 ? "text-cyan-700" : "text-pink-700"}>{formatSigned(item.changePct)}</div>,
                <div key={`${item.symbol}-volume`} className="font-mono text-xs text-slate-600">{formatNumber(item.volume)}</div>,
              ])}
            />
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><CandlestickChart className="h-5 w-5 text-pink-700" />最新信号摘要</CardTitle>
            <CardDescription>围绕最需要关注的信号给出紧凑摘要。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.latestSignals.map(signal => (
              <div key={signal.id} className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{signal.symbol} · {signal.signalType}</div>
                    <div className="mt-1 text-xs text-slate-500">{signal.market} 市场</div>
                  </div>
                  <Badge variant="outline" className="border-cyan-200 bg-cyan-50 font-mono text-cyan-800">{signal.score} 分</Badge>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{signal.triggerReason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </BlueprintPageShell>
  );
}

export function WatchlistPage() {
  const utils = trpc.useUtils();
  const { watchlist } = useTradingWorkspaceData();
  const [form, setForm] = useState({ market: "US" as Market, symbol: "", name: "", priority: "3" });
  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: async () => {
      toast.success("观察名單已更新");
      setForm({ market: "US", symbol: "", name: "", priority: "3" });
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

  return (
    <BlueprintPageShell eyebrow="Watchlist" title="观察名單管理" description="支持新增、删除美股与港股标的，设置优先级，并在同一页面查看即时报价、涨跌幅与成交量。">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.3fr]">
        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Search className="h-5 w-5 text-cyan-700" />新增监控标的</CardTitle>
            <CardDescription>你可以随时把新的美股或港股标的加入 Shawn Wang 量化盯盘系统。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">市场</label>
                <Select value={form.market} onValueChange={value => setForm(prev => ({ ...prev, market: value as Market }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">US</SelectItem>
                    <SelectItem value="HK">HK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">标的代码</label>
                <Input value={form.symbol} onChange={event => setForm(prev => ({ ...prev, symbol: event.target.value.toUpperCase() }))} placeholder="例如 NVDA 或 00700" />
              </div>
              <div className="grid gap-2">
                <label className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">标的名称</label>
                <Input value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} placeholder="例如 NVIDIA / 腾讯控股" />
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
            <p className="text-xs leading-6 text-muted-foreground">系统设置中的“观察名單上限”会影响可加入的最大标的数量，优先级更高的标的会在仪表板中获得更显著的位置。</p>
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
                headers={["市场", "标的", "优先级", "最新价", "涨跌幅", "成交量", "操作"]}
                rows={items.map(item => [
                  <Badge key={`${item.id}-market`} variant="outline" className="font-mono text-[11px]">{item.market}</Badge>,
                  <div key={`${item.id}-symbol`}><div className="font-semibold text-slate-900">{item.symbol}</div><div className="text-xs text-slate-500">{item.name}</div></div>,
                  <Select key={`${item.id}-priority`} value={String(item.priority)} onValueChange={value => reprioritizeMutation.mutate({ id: item.id, priority: Number(value) })}>
                    <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>{["1","2","3","4","5"].map(v => <SelectItem key={v} value={v}>P{v}</SelectItem>)}</SelectContent>
                  </Select>,
                  <span key={`${item.id}-price`} className="font-semibold">{formatNumber(item.lastPrice)}</span>,
                  <span key={`${item.id}-change`} className={item.changePct >= 0 ? "text-cyan-700" : "text-pink-700"}>{formatSigned(item.changePct)}</span>,
                  <span key={`${item.id}-volume`} className="font-mono text-xs text-slate-600">{formatNumber(item.volume)}</span>,
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
  const { signals } = useTradingWorkspaceData();
  const [autoRequestedIds, setAutoRequestedIds] = useState<number[]>([]);
  const interpretMutation = trpc.signals.interpretWithLlm.useMutation({
    onSuccess: async () => {
      toast.success("已生成自然语言解读");
      await utils.signals.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const signalItems = signals.data ?? [];

  useEffect(() => {
    const candidate = signalItems.find(
      signal => signal.score >= 80 && !signal.llmInterpretation && !autoRequestedIds.includes(signal.id)
    );
    if (!candidate) return;
    setAutoRequestedIds(previous => [...previous, candidate.id]);
    interpretMutation.mutate({ signalId: candidate.id });
  }, [autoRequestedIds, interpretMutation, signalItems]);

  return (
    <BlueprintPageShell eyebrow="Live Signals" title="实时信号面板" description="严格围绕“突破啟動、回踩續強、盤口失衡、冲高衰竭”四类信号进行实时展示，并为每条信号附加结构化交易建议与风险标签。">
      <div className="grid gap-4 md:grid-cols-2">
        {signalItems.map(signal => (
          <Card key={signal.id} className="border-white/80 bg-white/92 shadow-[0_16px_60px_-36px_rgba(14,116,144,0.5)]">
            <CardHeader className="space-y-4 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[11px]">{signal.market}</Badge>
                    <Badge variant="outline" className="border-cyan-200 bg-cyan-50 font-mono text-cyan-800">{signal.signalType}</Badge>
                  </div>
                  <CardTitle className="mt-3 text-2xl font-black tracking-[-0.03em]">{signal.symbol}</CardTitle>
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
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white bg-white p-3">
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">方向</div>
                    <div className="mt-2 text-lg font-bold">{signal.suggestion.方向}</div>
                  </div>
                  <div className="rounded-xl border border-white bg-white p-3">
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">参考入场区间</div>
                    <div className="mt-2 text-lg font-bold">{signal.suggestion.参考入场区间}</div>
                  </div>
                  <div className="rounded-xl border border-white bg-white p-3">
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">止损参考</div>
                    <div className="mt-2 text-lg font-bold">{signal.suggestion.止损参考}</div>
                  </div>
                  <div className="rounded-xl border border-white bg-white p-3">
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
                  {signal.llmInterpretation ?? "系统将在需要时对评分、盘口、逐笔与结构信息进行自然语言解读，以补充入场逻辑、风险提示与执行注意事项。"}
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

  const alertFilters = useMemo(() => ({
    market: market === "all" ? undefined : market,
    signalType: signalType === "all" ? undefined : signalType,
    date: date || undefined,
    query: query || undefined,
  }), [market, signalType, date, query]);

  const alerts = trpc.alerts.list.useQuery(alertFilters);
  const items = alerts.data ?? [];

  return (
    <BlueprintPageShell eyebrow="Alert Archive" title="信号告警历史" description="记录所有历史告警，并支持按日期、市场、信号类型和关键词进行组合筛选与搜索。">
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
              headers={["时间", "市场", "标的", "信号", "等级", "标题", "通知"]}
              rows={items.map(alert => [
                <span key={`${alert.id}-time`} className="font-mono text-xs">{new Date(alert.createdAtMs).toLocaleString()}</span>,
                <Badge key={`${alert.id}-market`} variant="outline" className="font-mono text-[11px]">{alert.market}</Badge>,
                <span key={`${alert.id}-symbol`} className="font-semibold">{alert.symbol}</span>,
                <span key={`${alert.id}-type`} className="text-slate-700">{alert.signalType}</span>,
                <AlertLevelBadge key={`${alert.id}-level`} level={alert.level} />, 
                <div key={`${alert.id}-title`}><div className="font-semibold text-slate-900">{alert.title}</div><div className="text-xs text-slate-500">{alert.message}</div></div>,
                <span key={`${alert.id}-notify`} className="font-mono text-xs text-slate-600">{alert.notifyTriggered ? "已通知" : "未通知"}</span>,
              ])}
            />
          )}
        </CardContent>
      </Card>
    </BlueprintPageShell>
  );
}

export function PreMarketScanPage() {
  const { scans } = useTradingWorkspaceData();
  const items = scans.data ?? [];
  return (
    <BlueprintPageShell eyebrow="Pre-Market Scan" title="盘前扫描结果页" description="展示基于量比、成交额、盘前涨幅等条件筛选出的候选标的列表，帮助你在盘前迅速构建当日的重点观察池。">
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
              rows={items.map(item => [
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
  const { review } = useTradingWorkspaceData();
  const data = review.data;
  return (
    <BlueprintPageShell eyebrow="Post-Market Review" title="盘后复盘报告" description="围绕命中率、误报分析、最佳信号与最差信号进行结构化复盘，帮助你迭代规则与注意力分配方式。">
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
    },
    onError: error => toast.error(error.message),
  });

  const [form, setForm] = useState({
    minVolumeRatio: "2.2",
    minTurnover: "120000000",
    minPremarketChangePct: "2.8",
    signalSensitivity: "标准" as SignalSensitivity,
    alertLevelPreference: "WARNING" as AlertLevel,
    watchlistLimit: "30",
    highScoreNotifyThreshold: "88",
  });

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
    });
  }, [settings.data]);

  return (
    <BlueprintPageShell eyebrow="System Settings" title="系统设置页" description="配置扫描阈值、信号灵敏度、告警等级偏好、观察名單上限，以及高评分自动通知阈值。">
      <div className="grid gap-4 xl:grid-cols-[1fr_0.86fr]">
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
            <div className="md:col-span-2">
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
                })}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "保存中..." : "保存设置"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.03em]"><Bot className="h-5 w-5 text-pink-700" />策略解释</CardTitle>
            <CardDescription>这些设置如何影响 Shawn Wang 量化盯盘系统的行为。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-slate-700">
            <p>扫描阈值越高，盘前候选池会越集中，适合想要减少噪声的场景；信号灵敏度越激进，系统越容易更早提示机会，但也会增加误报概率。</p>
            <p>告警等级偏好会影响中高分信号的展示强度，观察名單上限用于限制监控池规模，而高评分通知阈值则决定何时向系统拥有者推送提醒，确保不遗漏关键机会。</p>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
              <div className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-700">Current Emphasis</div>
              <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-900">{form.signalSensitivity}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">当前系统会以 {form.signalSensitivity} 模式评估“突破啟動、回踩續強、盤口失衡、冲高衰竭”四类信号，并在达到 {form.highScoreNotifyThreshold} 分时尝试触发自动通知。</p>
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
