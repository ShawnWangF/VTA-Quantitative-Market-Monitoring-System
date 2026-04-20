import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import NotFound from "./pages/NotFound";
import {
  AlertHistoryPage,
  DashboardPage,
  PreMarketScanPage,
  ReviewPage,
  SettingsPage,
  SignalsPage,
  WatchlistPage,
} from "./pages/TradingWorkspace";
import { Route, Switch } from "wouter";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/watchlist" component={WatchlistPage} />
        <Route path="/signals" component={SignalsPage} />
        <Route path="/alerts" component={AlertHistoryPage} />
        <Route path="/scans" component={PreMarketScanPage} />
        <Route path="/review" component={ReviewPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
