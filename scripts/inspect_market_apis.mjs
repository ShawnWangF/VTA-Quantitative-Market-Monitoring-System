import { callDataApi } from "../server/_core/dataApi.ts";

async function main() {
  const targets = [
    {
      apiId: "YahooFinance/get_stock_chart",
      options: { query: { symbol: "03690.HK", interval: "5m", range: "1d" } },
    },
    {
      apiId: "YahooFinance/get_stock_insights",
      options: { query: { symbol: "03690.HK" } },
    },
    {
      apiId: "YahooFinance/get_stock_chart",
      options: { query: { symbol: "^HSI", interval: "5m", range: "1d" } },
    },
    {
      apiId: "YahooFinance/get_stock_chart",
      options: { query: { symbol: "^HSTECH", interval: "5m", range: "1d" } },
    },
  ];

  for (const target of targets) {
    try {
      const result = await callDataApi(target.apiId, target.options);
      console.log(`\n=== ${target.apiId} ${JSON.stringify(target.options.query)} ===`);
      console.log(JSON.stringify(result, null, 2).slice(0, 4000));
    } catch (error) {
      console.log(`\n=== ${target.apiId} ${JSON.stringify(target.options.query)} ERROR ===`);
      console.log(error instanceof Error ? error.message : String(error));
    }
  }
}

main();
