import { summarizeDashboard, listScopedSignals } from './server/db.ts';

const overview = summarizeDashboard(1);
const signals = listScopedSignals(1);

console.log('LATEST_SIGNALS');
for (const signal of overview.latestSignals ?? []) {
  console.log(JSON.stringify({
    id: signal.id,
    market: signal.market,
    symbol: signal.symbol,
    triggerReason: signal.triggerReason,
    triggerAction: signal.triggerAction,
    quotePrice: signal.quotePrice,
    sourceMode: signal.sourceMode,
  }));
}

console.log('LIVE_BOARD');
for (const item of overview.liveBoard ?? []) {
  console.log(JSON.stringify({
    market: item.market,
    symbol: item.symbol,
    name: item.name,
    activeSignalType: item.activeSignalType,
    suggestionAction: item.suggestionAction,
    suggestionTriggerPrice: item.suggestionTriggerPrice,
    lastPrice: item.lastPrice,
    sourceMode: item.sourceMode,
  }));
}

console.log('SCOPED_SIGNALS');
for (const signal of signals) {
  console.log(JSON.stringify({
    id: signal.id,
    market: signal.market,
    symbol: signal.symbol,
    signalType: signal.signalType,
    triggerAction: signal.triggerAction,
    quotePrice: signal.quotePrice,
    sourceMode: signal.sourceMode,
  }));
}
