# VTA Quantitative Market Monitoring System
shawn wang 的量化盯盤系統的核心策略應基於「大模型理解宏觀語境與新聞事件」+「量化系統精準執行」+「可解釋的推理邏輯」。具體採用VTA (Visual-Temporal Alignment) 策略，以F-LOAM為代表的混合模型作為實戰主流。核心邏輯為：模型同時抓取新聞報導、社交媒體（如 X、Reddit）、財報原文以及宏觀經濟指標。LLM將這些非結構化文本轉化為「情感分數」或「事件影響力」，再輸入傳統量化模型（如 XGBoost 或 LSTM）進行股價修正。並在實時回測當中中不斷進行強化學習（Reinforcement Learning），自我演化交易邏輯。
