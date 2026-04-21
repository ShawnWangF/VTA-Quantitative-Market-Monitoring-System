export type CanonicalTrackedSecurity = {
  market: "HK" | "US";
  symbol: string;
  name: string;
};

export const CANONICAL_TRACKED_SECURITIES: CanonicalTrackedSecurity[] = [
  { market: "HK", symbol: "03690", name: "美团-W" },
  { market: "HK", symbol: "09992", name: "泡泡马特" },
];

export const DEFAULT_TRACKED_SYMBOLS = CANONICAL_TRACKED_SECURITIES.map(item => item.symbol);

export function getCanonicalTrackedSecurity(market: string, symbol: string): CanonicalTrackedSecurity | null {
  return CANONICAL_TRACKED_SECURITIES.find(item => item.market === market && item.symbol === symbol) ?? null;
}

export function getCanonicalTrackedName(market: string, symbol: string): string | null {
  return getCanonicalTrackedSecurity(market, symbol)?.name ?? null;
}

export function formatSecurityLabel(market: string, symbol: string, name?: string | null): string {
  const canonicalName = getCanonicalTrackedName(market, symbol);
  const finalName = name?.trim() || canonicalName || symbol;
  return `${symbol} · ${finalName}`;
}
