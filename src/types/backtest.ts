/**
 * 回測相關型別定義
 */

// 回測參數
export interface BacktestParams {
    initialCapital: number;         // 初始本金
    monthlyInvestment: number;      // 每月定期定額
    years: number;                  // 投資年限
    startDate?: string;             // 開始日期
    endDate?: string;               // 結束日期
    commissionRate?: number;        // 手續費率
    taxRate?: number;               // 交易稅率
    slippageRate?: number;          // 滑價率
    reinvestDividends?: boolean;    // 股息再投入
    dipBuyStrategy?: 'none' | 'rsi' | 'signal';  // 逢低加碼策略
    rsiThreshold?: number;          // RSI 閾值
}

// 投資組合回測參數
export interface PortfolioBacktestParams extends BacktestParams {
    assets: {
        symbol: string;
        weight: number;  // 0-1
    }[];
    rebalancePeriod: 'monthly' | 'quarterly' | 'yearly' | 'none';
}

// 回測時間軸資料點
export interface BacktestTimelinePoint {
    date: string;
    price?: number;
    shares?: number;
    cost: number;
    marketValue: number;
    netValue?: number;
    unrealizedGain: number;
    unrealizedGainPercent: number;
    drawdown: number;
    rsi?: number;
}

// 回測交易記錄
export interface BacktestTrade {
    type: 'buy' | 'sell';
    entryTime: string;
    entryPrice: number;
    shares?: number;            // 可選：股數
    commission?: number;        // 可選：手續費
    exitTime?: string;          // 可選：出場時間
    exitPrice?: number;         // 可選：出場價格
    pnl: number;
    pnlPercent: number;
    holdingDays?: number;       // 可選：持有天數
}

// 回測結果（引擎版本）
export interface BacktestResult {
    startDate?: string;          // 回測開始日期
    endDate?: string;            // 回測結束日期
    initialCapital: number;      // 初始資金
    finalCapital: number;        // 最終資金
    trades: BacktestTrade[];
    equityCurve: { time?: string; date?: string; equity?: number; value?: number }[];
    summary: BacktestSummary;
    drawdown: DrawdownAnalysis;
    benchmarkReturn: number;
}

// 回測結果（定期定額版本）
export interface DCABacktestResult {
    timeline: BacktestTimelinePoint[];
    summary: BacktestSummary;
}

export interface BacktestSummary {
    // 共用欄位
    totalReturn?: number;
    maxDrawdown?: number;
    sharpeRatio?: number;
    // 引擎版本欄位
    totalTrades?: number;
    winTrades?: number;
    loseTrades?: number;
    winningTrades?: number;      // 新增：獲利交易次數
    losingTrades?: number;       // 新增：虧損交易次數
    winRate?: number;
    totalPnL?: number;
    annualizedReturn?: number;
    profitFactor?: number;
    avgHoldingDays?: number;
    averageWin?: number;         // 新增：平均獲利
    averageLoss?: number;        // 新增：平均虧損
    // DCA 版本欄位
    startDate?: string;
    endDate?: string;
    months?: number;
    totalCost?: number;
    finalMarketValue?: number;
    finalNetValue?: number;
    cagr?: number;
    totalDividends?: number;
    totalShares?: number;
}

// 最大回撤分析
export interface DrawdownAnalysis {
    maxDrawdown: number;
    maxDrawdownDuration?: number;
    maxDrawdownDate?: string;           // 新增：最大回撤日期
    recoveryDate?: string | null;       // 新增：恢復日期
    maxDrawdownStart?: string;
    maxDrawdownEnd?: string;
    drawdownPeriods?: {
        start: string;
        end: string;
        drawdown: number;
    }[];
    // DCA 版本欄位
    maxDrawdownPeriod?: {
        start: string;
        end: string;
        duration: number;
    };
    recoveryTime?: number;
    underwaterPeriods?: {
        start: string;
        end: string;
        depth: number;
        duration: number;
    }[];
}


// 預測結果
export interface ForecastResult {
    timeline: ForecastTimelinePoint[];
    summary: ForecastSummary;
}

export interface ForecastTimelinePoint {
    month: number;
    date: string;
    capital: number;
    p10: number;  // 保守
    p25: number;
    p50: number;  // 中位數
    p75: number;
    p90: number;  // 樂觀
}

export interface ForecastSummary {
    years: number;
    totalCapital: number;
    conservative: number;        // P10
    median: number;              // P50
    optimistic: number;          // P90
    conservativeReturn: number;
    medianReturn: number;
    optimisticReturn: number;
    simulations: number;
}

// 理財規劃分析
export interface FinancialPlanParams {
    monthlyInvestment: number;   // 定期定額金額
    targetAsset: number;         // 目標資產
    investmentYears: number;     // 投資年限
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    selectedAssets?: string[];   // 選擇的標的
}

export interface FinancialPlanResult {
    expectedValue: {
        conservative: number;
        median: number;
        optimistic: number;
    };
    goalProbability: number;     // 達成目標機率
    suggestedAllocation: {
        symbol: string;
        name: string;
        weight: number;
        reason: string;
    }[];
    riskMetrics: {
        maxDrawdown: number;
        volatility: number;
        sharpeRatio: number;
    };
    recommendation: string;      // AI 建議
}
