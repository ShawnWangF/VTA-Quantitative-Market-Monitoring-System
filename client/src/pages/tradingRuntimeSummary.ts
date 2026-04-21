export type RuntimeSummaryBoard = {
  llmForecastBias?: string | null;
  llmForecastSummary?: string | null;
  suggestionAction?: string | null;
  executionPrerequisite?: string | null;
  forecastSummary: {
    trendBias: string;
    predictedPrice: number;
    predictedChangePct: number;
  };
  strategyLearning: {
    adaptiveWeight: number | string;
    rewardScore: number | string;
  };
};

export type RuntimeSummaryBridge = {
  connectionStatus: string;
  lastQuoteAt?: number | null;
};

export function buildRuntimeSummaryEntries(
  board: RuntimeSummaryBoard,
  bridge: RuntimeSummaryBridge,
  formatNumber: (value: number) => string,
  formatSigned: (value: number) => string,
  formatDateTime: (value?: number | null) => string
) {
  return [
    `LLM ${board.llmForecastBias ?? board.forecastSummary.trendBias} · ${board.llmForecastSummary ?? "等待新的有效预测"}`,
    `执行 ${board.suggestionAction ?? "等待触发"} · ${board.executionPrerequisite ?? "等待桥接与新信号"}`,
    `预测 ${formatNumber(board.forecastSummary.predictedPrice)} · ${formatSigned(board.forecastSummary.predictedChangePct)}`,
    `强化反馈 ${board.strategyLearning.adaptiveWeight}x · 奖励 ${board.strategyLearning.rewardScore}`,
    `桥接 ${bridge.connectionStatus} · 最近更新 ${formatDateTime(bridge.lastQuoteAt)}`,
  ];
}

export function getEmptyRealtimeStateCopy() {
  return {
    title: "暂无真实数据",
    description: "请先在设置页连接桥接并添加真实标的；未收到实时行情前，页面不会回退显示演示股票或演示价格。",
    runtimeSummary: [
      "LLM 等待新的有效预测",
      "执行 等待桥接与新信号",
      "预测 --",
      "强化反馈 等待实时回测",
      "桥接 未连接",
    ],
  };
}
