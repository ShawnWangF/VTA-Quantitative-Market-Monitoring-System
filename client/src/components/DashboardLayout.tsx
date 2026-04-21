import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Bell,
  CandlestickChart,
  LayoutDashboard,
  LineChart,
  LogOut,
  PanelLeft,
  Radar,
  Settings2,
  Target,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "仪表板主页", path: "/" },
  { icon: Radar, label: "观察名單", path: "/watchlist" },
  { icon: CandlestickChart, label: "实时信号", path: "/signals" },
  { icon: Bell, label: "告警历史", path: "/alerts" },
  { icon: LineChart, label: "盘前扫描", path: "/scans" },
  { icon: Target, label: "盘后复盘", path: "/review" },
  { icon: Settings2, label: "系统设置", path: "/settings" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 268;
const MIN_WIDTH = 208;
const MAX_WIDTH = 360;
const AUTO_COLLAPSE_BREAKPOINT = 1480;
const AUTO_EXPAND_BREAKPOINT = 1760;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.24),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.18),transparent_28%),linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:auto,auto,28px_28px,28px_28px]">
        <div className="container flex min-h-screen items-center justify-center py-12">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/90 p-10 shadow-[0_30px_80px_-48px_rgba(14,116,144,0.6)] backdrop-blur-sm">
            <div className="space-y-5 text-center">
              <div className="mx-auto inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.28em] text-cyan-800">
                Shawn Wang 量化盯盘系统
              </div>
              <h1 className="text-4xl font-black tracking-[-0.05em] text-slate-950">登录后进入智能交易信号工作台</h1>
              <p className="mx-auto max-w-lg text-sm leading-7 text-slate-600">
                该系统会集中展示美股与港股的观察名單、实时信号、结构化交易建议、盘前扫描与盘后复盘，并在高评分机会出现时自动尝试发送通知。
              </p>
            </div>
            <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="mt-8 h-12 w-full rounded-xl text-base">
              登录并进入系统
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location) ?? menuItems[0];
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (isMobile) return;

    const syncSidebarByViewport = () => {
      const width = window.innerWidth;
      if (width <= AUTO_COLLAPSE_BREAKPOINT) {
        setOpen(false);
        return;
      }
      if (width >= AUTO_EXPAND_BREAKPOINT) {
        setOpen(true);
      }
    };

    syncSidebarByViewport();
    window.addEventListener("resize", syncSidebarByViewport);
    return () => window.removeEventListener("resize", syncSidebarByViewport);
  }, [isMobile, setOpen]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = event.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0 bg-transparent" disableTransition={isResizing}>
          <SidebarHeader className="border-b border-sidebar-border/70 px-2.5 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSidebar}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sidebar-border/70 bg-white/85 text-slate-600 transition-colors hover:bg-white"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed ? (
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-700">Signal Blueprint</div>
                  <div className="truncate text-base font-black tracking-[-0.04em] text-slate-950">Shawn Wang 量化盯盘系统</div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="bg-transparent px-2 py-3">
            <div className="mb-3 px-2 font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500 group-data-[collapsible=icon]:hidden">
              Workspace
            </div>
            <SidebarMenu className="gap-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-11 rounded-xl font-medium"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-cyan-700" : "text-slate-500"}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/70 p-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-2xl border border-sidebar-border/70 bg-white/80 px-2 py-2 text-left transition-colors hover:bg-white group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-10 w-10 shrink-0 border border-cyan-200">
                    <AvatarFallback className="bg-cyan-50 text-sm font-semibold text-cyan-900">
                      {user?.name?.charAt(0).toUpperCase() || "S"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-semibold text-slate-900">{user?.name || "Shawn Wang"}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{user?.email || "Owner Session"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-cyan-300/60 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-transparent">
        {isMobile ? (
          <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/70 bg-white/85 px-3 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-10 w-10 rounded-xl border border-border/70 bg-white/90" />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-700">Signal Blueprint</div>
                <div className="text-sm font-semibold text-slate-900">{activeMenuItem.label}</div>
              </div>
            </div>
          </div>
        ) : null}
        <main className="min-h-screen flex-1 overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.12),transparent_24%),linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:auto,auto,28px_28px,28px_28px] p-3 md:p-4 xl:p-5 2xl:p-6">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
