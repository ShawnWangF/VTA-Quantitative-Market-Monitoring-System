#!/usr/bin/env python3
"""Windows local bridge for Futu OpenD -> Shawn Wang 量化盯盘系统.

Usage:
  python windows_futu_bridge.py --config bridge_config.json

Requirements:
  pip install futu-api requests
"""

from __future__ import annotations

import argparse
import json
import logging
import signal
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from futu import OpenQuoteContext, RET_OK, SubType


@dataclass
class BridgeConfig:
    ingest_url: str
    bridge_token: str
    opend_host: str
    opend_port: int
    tracked_symbols: list[str]
    publish_interval_seconds: int = 3
    request_timeout_seconds: int = 10

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BridgeConfig":
        tracked_symbols = [str(item).strip() for item in data.get("tracked_symbols", []) if str(item).strip()]
        if not tracked_symbols:
            raise ValueError("tracked_symbols 不能为空")
        bridge_token = str(data.get("bridge_token", "")).strip()
        if len(bridge_token) < 8:
            raise ValueError("bridge_token 长度至少为 8")
        ingest_url = str(data.get("ingest_url", "")).strip()
        if not ingest_url.startswith("http"):
            raise ValueError("ingest_url 必须是有效的 http/https 地址")
        return cls(
            ingest_url=ingest_url,
            bridge_token=bridge_token,
            opend_host=str(data.get("opend_host", "127.0.0.1")).strip(),
            opend_port=int(data.get("opend_port", 11111)),
            tracked_symbols=tracked_symbols,
            publish_interval_seconds=max(1, int(data.get("publish_interval_seconds", 3))),
            request_timeout_seconds=max(3, int(data.get("request_timeout_seconds", 10))),
        )


def normalize_code(symbol: str) -> str:
    symbol = symbol.strip().upper()
    if symbol.startswith("HK."):
        return symbol
    digits = "".join(ch for ch in symbol if ch.isdigit())
    if digits:
        return f"HK.{digits.zfill(5)}"
    return symbol


def load_config(path: Path) -> BridgeConfig:
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    return BridgeConfig.from_dict(data)


def to_quotes_payload(dataframe) -> list[dict[str, Any]]:
    quotes: list[dict[str, Any]] = []
    for _, row in dataframe.iterrows():
        code = str(row.get("code", ""))
        market = "HK" if code.startswith("HK.") else "US"
        symbol = code.split(".", 1)[1] if "." in code else code
        quotes.append(
            {
                "market": market,
                "symbol": symbol,
                "name": str(row.get("name", symbol)),
                "lastPrice": float(row.get("last_price", 0) or 0),
                "volume": float(row.get("volume", 0) or 0),
                "turnover": float(row.get("turnover", 0) or 0),
                "openPrice": float(row.get("open_price", 0) or 0),
                "highPrice": float(row.get("high_price", 0) or 0),
                "lowPrice": float(row.get("low_price", 0) or 0),
                "prevClosePrice": float(row.get("prev_close_price", 0) or 0),
            }
        )
    return quotes


def post_payload(config: BridgeConfig, quotes: list[dict[str, Any]], error: str | None = None) -> None:
    payload = {
        "bridgeToken": config.bridge_token,
        "opendHost": config.opend_host,
        "opendPort": config.opend_port,
        "trackedSymbols": [symbol.replace("HK.", "") for symbol in config.tracked_symbols],
        "publishIntervalSeconds": config.publish_interval_seconds,
        "bridgeTimestampMs": int(time.time() * 1000),
        "error": error,
        "quotes": quotes,
    }
    response = requests.post(config.ingest_url, json=payload, timeout=config.request_timeout_seconds)
    response.raise_for_status()
    result = response.json()
    if not result.get("ok"):
        raise RuntimeError(f"云端接收失败: {result}")
    logging.info("Bridge push success: updated=%s signals=%s", result.get("updatedSymbols"), result.get("generatedSignals"))


class BridgeRuntime:
    def __init__(self, config: BridgeConfig) -> None:
        self.config = config
        self.running = True
        self.quote_ctx: OpenQuoteContext | None = None

    def shutdown(self, *_args) -> None:
        logging.info("收到停止信号，正在关闭桥接程序...")
        self.running = False
        if self.quote_ctx is not None:
            self.quote_ctx.close()
            self.quote_ctx = None

    def run(self) -> None:
        tracked = [normalize_code(symbol) for symbol in self.config.tracked_symbols]
        logging.info("Connecting OpenD %s:%s", self.config.opend_host, self.config.opend_port)
        self.quote_ctx = OpenQuoteContext(host=self.config.opend_host, port=self.config.opend_port)
        ret, err = self.quote_ctx.subscribe(tracked, [SubType.QUOTE], subscribe_push=False)
        if ret != RET_OK:
            raise RuntimeError(f"订阅实时行情失败: {err}")
        logging.info("Subscribed symbols: %s", tracked)

        while self.running:
            try:
                ret, data = self.quote_ctx.get_stock_quote(tracked)
                if ret != RET_OK:
                    raise RuntimeError(str(data))
                quotes = to_quotes_payload(data)
                post_payload(self.config, quotes)
            except Exception as error:  # noqa: BLE001
                logging.exception("Bridge loop failed")
                try:
                    post_payload(self.config, [], error=str(error))
                except Exception:  # noqa: BLE001
                    logging.exception("Failed to report bridge error to cloud")
            time.sleep(self.config.publish_interval_seconds)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Futu OpenD realtime bridge for Shawn Wang 量化盯盘系统")
    parser.add_argument("--config", required=True, help="Path to bridge_config.json")
    return parser.parse_args()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(message)s")
    args = parse_args()
    config = load_config(Path(args.config))
    runtime = BridgeRuntime(config)
    signal.signal(signal.SIGINT, runtime.shutdown)
    signal.signal(signal.SIGTERM, runtime.shutdown)
    runtime.run()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(0)
    except Exception as error:  # noqa: BLE001
        logging.exception("Bridge startup failed")
        sys.exit(1)
