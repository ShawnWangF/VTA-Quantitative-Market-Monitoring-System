import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { getSettings, getUserByOpenId, ingestLiveQuotes } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

type BridgeQuotePayload = {
  market: "US" | "HK";
  symbol: string;
  name?: string;
  lastPrice: number;
  volume: number;
  turnover: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  prevClosePrice: number;
};

async function resolveOwnerUserId() {
  const owner = await getUserByOpenId(ENV.ownerOpenId);
  return owner?.id ?? 1;
}

function registerFutuBridgeIngest(app: express.Express) {
  app.post("/api/futu-bridge/ingest", async (req, res) => {
    try {
      const userId = await resolveOwnerUserId();
      const settings = getSettings(userId);
      const body = req.body as {
        bridgeToken?: string;
        opendHost?: string;
        opendPort?: number;
        trackedSymbols?: string[];
        publishIntervalSeconds?: number;
        bridgeTimestampMs?: number;
        error?: string | null;
        quotes?: BridgeQuotePayload[];
      };

      if (!body?.bridgeToken) {
        return res.status(400).json({ ok: false, error: "缺少 bridgeToken" });
      }

      if (body.bridgeToken !== settings.liveBridge.bridgeToken) {
        return res.status(403).json({ ok: false, error: "bridgeToken 无效" });
      }

      if (!Array.isArray(body.quotes)) {
        return res.status(400).json({ ok: false, error: "quotes 必须为数组" });
      }

      const quotes = body.quotes
        .filter(quote => quote && quote.symbol && quote.market)
        .map(quote => ({
          market: quote.market,
          symbol: quote.symbol,
          name: quote.name,
          lastPrice: Number(quote.lastPrice ?? 0),
          volume: Number(quote.volume ?? 0),
          turnover: Number(quote.turnover ?? 0),
          openPrice: Number(quote.openPrice ?? 0),
          highPrice: Number(quote.highPrice ?? 0),
          lowPrice: Number(quote.lowPrice ?? 0),
          prevClosePrice: Number(quote.prevClosePrice ?? 0),
        }));

      const result = ingestLiveQuotes(userId, {
        opendHost: body.opendHost || settings.liveBridge.opendHost,
        opendPort: Number(body.opendPort || settings.liveBridge.opendPort),
        trackedSymbols: body.trackedSymbols || settings.liveBridge.trackedSymbols,
        publishIntervalSeconds: Number(body.publishIntervalSeconds || settings.liveBridge.publishIntervalSeconds),
        bridgeTimestampMs: body.bridgeTimestampMs,
        error: body.error ?? null,
        quotes,
      });

      return res.json(result);
    } catch (error) {
      console.error("[FutuBridge] ingest failed:", error);
      return res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "实时行情桥接写入失败",
      });
    }
  });
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerFutuBridgeIngest(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
