/**
 * 回測模擬器引擎
 * 提供歷史資料回測功能，計算績效指標
 */

import type { CandlestickData } from '@/types/stock';
import type {
    BacktestParams,
    BacktestResult,
    BacktestTrade,
    BacktestSummary,
    DrawdownAnalysis,
} from '@/types/backtest';

// ==================== 核心回測引擎 ====================

interface BacktestEngineOptions {
    // 初始資金
    initialCapital: number;
    // 手續費率（百分比）
    commissionRate: number;
    // 滑價（固定金額）
    slippage: number;
    // 是否允許放空
    allowShort: boolean;
    // 最大持倉比例
    maxPositionSize: number;
}

const DEFAULT_OPTIONS: BacktestEngineOptions = {
    initialCapital: 1000000,
    commissionRate: 0.001425, // 台股標準手續費 0.1425%
    slippage: 0.1,
    allowShort: false,
    maxPositionSize: 1.0,
};

/**
 * 回測引擎類別
 */
export class BacktestEngine {
    private options: BacktestEngineOptions;
    private trades: BacktestTrade[] = [];
    private equityCurve: { time: string; equity: number }[] = [];
    private currentCapital: number;
    private position: number = 0; // 正數為多，負數為空
    private avgEntryPrice: number = 0;

    constructor(options: Partial<BacktestEngineOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.currentCapital = this.options.initialCapital;
    }

    /**
     * 執行回測
     */
    run(
        data: CandlestickData[],
        signalFn: (index: number, data: CandlestickData[]) => 'buy' | 'sell' | 'hold'
    ): BacktestResult {
        if (data.length < 2) {
            throw new Error('資料不足，無法執行回測');
        }

        this.reset();

        // 遍歷每根 K 線
        for (let i = 1; i < data.length; i++) {
            const signal = signalFn(i, data);
            const bar = data[i];
            const price = bar.close;

            // 記錄權益曲線
            const unrealizedPnL = this.position * (price - this.avgEntryPrice);
            this.equityCurve.push({
                time: bar.time,
                equity: this.currentCapital + unrealizedPnL,
            });

            // 執行交易信號
            if (signal === 'buy' && this.position <= 0) {
                this.executeOrder('buy', price, bar.time);
            } else if (signal === 'sell' && this.position >= 0) {
                this.executeOrder('sell', price, bar.time);
            }
        }

        // 強制平倉（如果還有持倉）
        if (this.position !== 0) {
            const lastBar = data[data.length - 1];
            this.closePosition(lastBar.close, lastBar.time);
        }

        return this.generateResult(data);
    }

    /**
     * 重置引擎狀態
     */
    private reset(): void {
        this.trades = [];
        this.equityCurve = [];
        this.currentCapital = this.options.initialCapital;
        this.position = 0;
        this.avgEntryPrice = 0;
    }

    /**
     * 執行訂單
     */
    private executeOrder(side: 'buy' | 'sell', price: number, time: string): void {
        const { commissionRate, slippage, initialCapital, maxPositionSize } = this.options;

        // 計算可用資金和交易數量
        const maxCapital = initialCapital * maxPositionSize;
        const execPrice = side === 'buy' ? price + slippage : price - slippage;

        // 計算可交易股數（以整數計）
        const shares = Math.floor(maxCapital / execPrice);
        if (shares <= 0) return;

        const tradeValue = shares * execPrice;
        const commission = tradeValue * commissionRate;

        if (side === 'buy') {
            // 買入
            if (this.position < 0) {
                // 先平空單
                this.closePosition(execPrice, time);
            }
            this.position = shares;
            this.avgEntryPrice = execPrice;
            this.currentCapital -= (tradeValue + commission);

            this.trades.push({
                type: 'buy',
                entryTime: time,
                entryPrice: execPrice,
                shares,
                commission,
                exitTime: '',
                exitPrice: 0,
                pnl: 0,
                pnlPercent: 0,
                holdingDays: 0,
            });
        } else {
            // 賣出
            if (this.position > 0) {
                this.closePosition(execPrice, time);
            }
            // 放空（如果允許）
            if (this.options.allowShort) {
                this.position = -shares;
                this.avgEntryPrice = execPrice;
                this.currentCapital += (tradeValue - commission);

                this.trades.push({
                    type: 'sell',
                    entryTime: time,
                    entryPrice: execPrice,
                    shares,
                    commission,
                    exitTime: '',
                    exitPrice: 0,
                    pnl: 0,
                    pnlPercent: 0,
                    holdingDays: 0,
                });
            }
        }
    }

    /**
     * 平倉
     */
    private closePosition(price: number, time: string): void {
        if (this.position === 0) return;

        const { commissionRate, slippage } = this.options;
        const execPrice = this.position > 0 ? price - slippage : price + slippage;
        const shares = Math.abs(this.position);
        const tradeValue = shares * execPrice;
        const commission = tradeValue * commissionRate;

        // 計算損益
        const pnl = this.position > 0
            ? (execPrice - this.avgEntryPrice) * shares - commission
            : (this.avgEntryPrice - execPrice) * shares - commission;

        const pnlPercent = (pnl / (shares * this.avgEntryPrice)) * 100;

        // 更新資金
        this.currentCapital += this.position > 0
            ? tradeValue - commission
            : -tradeValue - commission;

        // 更新最後一筆交易
        const lastTrade = this.trades[this.trades.length - 1];
        if (lastTrade && !lastTrade.exitTime) {
            lastTrade.exitTime = time;
            lastTrade.exitPrice = execPrice;
            lastTrade.pnl = pnl;
            lastTrade.pnlPercent = pnlPercent;
            // 計算持有天數（簡化：假設每天一根 K 線）
            lastTrade.holdingDays = this.equityCurve.length;
        }

        this.position = 0;
        this.avgEntryPrice = 0;
    }

    /**
     * 生成回測結果
     */
    private generateResult(data: CandlestickData[]): BacktestResult {
        const summary = this.calculateSummary();
        const drawdown = this.calculateDrawdown();

        return {
            trades: this.trades,
            equityCurve: this.equityCurve,
            summary,
            drawdown,
            benchmarkReturn: this.calculateBenchmarkReturn(data),
        };
    }

    /**
     * 計算績效統計
     */
    private calculateSummary(): BacktestSummary {
        const { initialCapital } = this.options;
        const winTrades = this.trades.filter(t => t.pnl > 0);
        const loseTrades = this.trades.filter(t => t.pnl < 0);

        const totalPnL = this.trades.reduce((sum, t) => sum + t.pnl, 0);
        const totalReturn = (totalPnL / initialCapital) * 100;

        const avgWin = winTrades.length > 0
            ? winTrades.reduce((sum, t) => sum + t.pnl, 0) / winTrades.length
            : 0;
        const avgLoss = loseTrades.length > 0
            ? Math.abs(loseTrades.reduce((sum, t) => sum + t.pnl, 0) / loseTrades.length)
            : 0;

        const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

        // 計算年化報酬（假設 252 個交易日）
        const tradingDays = this.equityCurve.length;
        const annualizedReturn = tradingDays > 0
            ? ((1 + totalReturn / 100) ** (252 / tradingDays) - 1) * 100
            : 0;

        // 計算夏普比率（假設無風險利率 2%）
        const riskFreeRate = 0.02;
        const returns = this.calculateDailyReturns();
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const stdDev = this.calculateStdDev(returns);
        const sharpeRatio = stdDev > 0
            ? ((avgReturn * 252) - riskFreeRate) / (stdDev * Math.sqrt(252))
            : 0;

        return {
            totalTrades: this.trades.length,
            winTrades: winTrades.length,
            loseTrades: loseTrades.length,
            winRate: this.trades.length > 0 ? (winTrades.length / this.trades.length) * 100 : 0,
            totalPnL,
            totalReturn,
            annualizedReturn,
            maxDrawdown: this.calculateDrawdown().maxDrawdown,
            sharpeRatio,
            profitFactor,
            avgHoldingDays: this.trades.length > 0
                ? this.trades.reduce((sum, t) => sum + t.holdingDays, 0) / this.trades.length
                : 0,
        };
    }

    /**
     * 計算回撤分析
     */
    private calculateDrawdown(): DrawdownAnalysis {
        if (this.equityCurve.length === 0) {
            return {
                maxDrawdown: 0,
                maxDrawdownDuration: 0,
                drawdownPeriods: [],
            };
        }

        let peak = this.equityCurve[0].equity;
        let maxDrawdown = 0;
        let maxDrawdownStart = '';
        let maxDrawdownEnd = '';
        let currentDrawdownStart = '';
        const drawdownPeriods: { start: string; end: string; drawdown: number }[] = [];

        for (const point of this.equityCurve) {
            if (point.equity > peak) {
                if (currentDrawdownStart) {
                    // 回撤結束
                    drawdownPeriods.push({
                        start: currentDrawdownStart,
                        end: point.time,
                        drawdown: (peak - point.equity) / peak * 100,
                    });
                    currentDrawdownStart = '';
                }
                peak = point.equity;
            } else {
                const drawdown = (peak - point.equity) / peak * 100;
                if (!currentDrawdownStart) {
                    currentDrawdownStart = point.time;
                }
                if (drawdown > maxDrawdown) {
                    maxDrawdown = drawdown;
                    maxDrawdownStart = currentDrawdownStart;
                    maxDrawdownEnd = point.time;
                }
            }
        }

        return {
            maxDrawdown,
            maxDrawdownDuration: 0, // 簡化
            maxDrawdownStart,
            maxDrawdownEnd,
            drawdownPeriods,
        };
    }

    /**
     * 計算每日報酬率
     */
    private calculateDailyReturns(): number[] {
        const returns: number[] = [];
        for (let i = 1; i < this.equityCurve.length; i++) {
            const prev = this.equityCurve[i - 1].equity;
            const curr = this.equityCurve[i].equity;
            returns.push((curr - prev) / prev);
        }
        return returns;
    }

    /**
     * 計算標準差
     */
    private calculateStdDev(values: number[]): number {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const squaredDiffs = values.map(v => (v - mean) ** 2);
        return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
    }

    /**
     * 計算基準報酬（買入持有）
     */
    private calculateBenchmarkReturn(data: CandlestickData[]): number {
        if (data.length < 2) return 0;
        const startPrice = data[0].close;
        const endPrice = data[data.length - 1].close;
        return ((endPrice - startPrice) / startPrice) * 100;
    }
}

// ==================== 預設策略 ====================

/**
 * 黃金交叉策略：短期 EMA 上穿長期 EMA 買入，下穿賣出
 */
export function goldenCrossStrategy(
    shortPeriod: number = 10,
    longPeriod: number = 30
) {
    return (index: number, data: CandlestickData[]): 'buy' | 'sell' | 'hold' => {
        if (index < longPeriod) return 'hold';

        const shortEMA = calculateEMA(data.slice(0, index + 1).map(d => d.close), shortPeriod);
        const longEMA = calculateEMA(data.slice(0, index + 1).map(d => d.close), longPeriod);

        const currShort = shortEMA[shortEMA.length - 1];
        const currLong = longEMA[longEMA.length - 1];
        const prevShort = shortEMA[shortEMA.length - 2];
        const prevLong = longEMA[longEMA.length - 2];

        // 黃金交叉：短 EMA 上穿長 EMA
        if (prevShort <= prevLong && currShort > currLong) {
            return 'buy';
        }
        // 死亡交叉：短 EMA 下穿長 EMA
        if (prevShort >= prevLong && currShort < currLong) {
            return 'sell';
        }

        return 'hold';
    };
}

/**
 * RSI 策略：RSI 超賣買入，超買賣出
 */
export function rsiStrategy(
    period: number = 14,
    oversold: number = 30,
    overbought: number = 70
) {
    return (index: number, data: CandlestickData[]): 'buy' | 'sell' | 'hold' => {
        if (index < period) return 'hold';

        const rsi = calculateRSI(data.slice(0, index + 1).map(d => d.close), period);
        const currRSI = rsi[rsi.length - 1];

        if (currRSI <= oversold) return 'buy';
        if (currRSI >= overbought) return 'sell';
        return 'hold';
    };
}

// ==================== 技術指標計算 ====================

function calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema: number[] = [prices[0]];

    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }

    return ema;
}

function calculateRSI(prices: number[], period: number): number[] {
    const rsi: number[] = [];
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        if (i < period) {
            avgGain += gain;
            avgLoss += loss;
            rsi.push(50); // 預設值
        } else if (i === period) {
            avgGain = (avgGain + gain) / period;
            avgLoss = (avgLoss + loss) / period;
            rsi.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
        } else {
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
            rsi.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
        }
    }

    return rsi;
}

// ==================== 匯出 ====================

export type { BacktestEngineOptions };
