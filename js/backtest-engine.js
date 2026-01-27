/**
 * Compound Snowball Simulator - Backtest Engine
 * 複利雪球模擬器 - 核心計算引擎
 * 
 * 功能：
 * - 歷史回測 (Backtest)
 * - 未來預測 (Forecast) - 馬可夫狀態轉換 + Monte Carlo
 * - 固定模擬 (Simulation)
 */

class BacktestEngine {
    constructor() {
        this.defaultParams = {
            initialCapital: 100000,      // 初始本金
            monthlyInvestment: 10000,    // 每月定期定額
            years: 10,                   // 投資年限
            annualReturn: 0.07,          // 預設年化報酬 (固定模擬)
            commissionRate: 0.001425,    // 手續費率 0.1425%
            taxRate: 0.003,              // 交易稅 0.3%
            reinvestDividends: true,     // 股息再投入
            dipBuyStrategy: 'none',      // 逢低加碼策略: none, signal, rsi
            dipBuyMultiplier: 2,         // 加碼倍數
            rsiThreshold: 30,            // RSI 閾值
            monteCarloRuns: 1000         // Monte Carlo 模擬次數
        };
    }

    /**
     * 歷史回測
     * @param {Object} historicalData - 歷史資料 (from backtest-data.js)
     * @param {Object} params - 參數設定
     * @returns {Object} - 回測結果
     */
    runBacktest(historicalData, params = {}) {
        const config = { ...this.defaultParams, ...params };
        const history = historicalData.history || [];
        const dividends = historicalData.dividends || [];

        if (history.length < 2) {
            throw new Error('歷史資料不足');
        }

        // 根據日期範圍過濾資料
        let backtestHistory = history;
        let monthsToBacktest;

        if (config.startDate || config.endDate) {
            backtestHistory = history.filter(h => {
                const date = h.date;
                if (config.startDate && date < config.startDate) return false;
                if (config.endDate && date > config.endDate) return false;
                return true;
            });
            monthsToBacktest = backtestHistory.length - 1;
        } else {
            // 使用年限計算
            monthsToBacktest = Math.min(config.years * 12, history.length - 1);
            const startIndex = history.length - 1 - monthsToBacktest;
            backtestHistory = history.slice(startIndex);
        }

        if (backtestHistory.length < 2) {
            throw new Error('選定時間範圍內資料不足');
        }

        // 建立分時段投資金額表
        const investmentSchedule = this.buildInvestmentSchedule(config);

        // 初始化
        let totalShares = 0;
        let totalCost = 0;
        let totalDividends = 0;
        let peakValue = 0;
        let maxDrawdown = 0;

        const timeline = [];
        const monthlyReturns = [];

        // 建立股息對照表
        const dividendMap = new Map();
        dividends.forEach(d => {
            const month = d.date.slice(0, 7);
            dividendMap.set(month, (dividendMap.get(month) || 0) + d.amount);
        });

        // 計算 RSI (如需要)
        const prices = backtestHistory.map(h => h.adjClose || h.close);
        const rsiValues = this.calculateRSI(prices, 14);

        // 模擬每月投資
        for (let i = 0; i < backtestHistory.length; i++) {
            const data = backtestHistory[i];
            const price = data.adjClose || data.close;
            const month = data.date.slice(0, 7);
            const rsi = rsiValues[i] || 50;

            // 計算本月投資金額 (支援分時段投資)
            let investment;
            if (i === 0) {
                investment = config.initialCapital;
            } else {
                // 使用分時段投資金額表
                investment = investmentSchedule[Math.min(i - 1, investmentSchedule.length - 1)];
            }

            // 逢低加碼策略
            if (config.dipBuyStrategy === 'rsi' && rsi < config.rsiThreshold) {
                investment *= config.dipBuyMultiplier;
            }

            // 扣除手續費
            const commission = investment * config.commissionRate;
            const netInvestment = investment - commission;

            // 買入股數
            const sharesBought = netInvestment / price;
            totalShares += sharesBought;
            totalCost += investment;

            // 股息再投入
            const dividend = dividendMap.get(month) || 0;
            if (dividend > 0 && config.reinvestDividends) {
                const dividendAmount = dividend * totalShares;
                const reinvestShares = dividendAmount / price;
                totalShares += reinvestShares;
                totalDividends += dividendAmount;
            }

            // 計算當前市值
            const marketValue = totalShares * price;

            // 計算最大回撤
            if (marketValue > peakValue) {
                peakValue = marketValue;
            }
            const drawdown = (peakValue - marketValue) / peakValue;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }

            // 計算淨值 (扣除賣出成本)
            const sellCost = marketValue * (config.commissionRate + config.taxRate);
            const netValue = marketValue - sellCost;

            // 記錄
            timeline.push({
                date: data.date,
                price: price,
                shares: totalShares,
                cost: totalCost,
                marketValue: marketValue,
                netValue: netValue,
                unrealizedGain: marketValue - totalCost,
                unrealizedGainPercent: (marketValue - totalCost) / totalCost,
                drawdown: drawdown,
                rsi: rsi
            });

            // 月報酬
            if (i > 0) {
                const prevValue = timeline[i - 1].marketValue;
                const monthlyReturn = (marketValue - prevValue - config.monthlyInvestment) / prevValue;
                monthlyReturns.push(monthlyReturn);
            }
        }

        // 計算統計
        const finalValue = timeline[timeline.length - 1];
        const years = (monthsToBacktest || backtestHistory.length - 1) / 12 || 1;
        const cagr = Math.pow(finalValue.marketValue / totalCost, 1 / years) - 1;

        // 夏普比率 (假設無風險利率 2%)
        const riskFreeRate = 0.02 / 12;
        const avgMonthlyReturn = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
        const stdDev = Math.sqrt(
            monthlyReturns.reduce((sum, r) => sum + Math.pow(r - avgMonthlyReturn, 2), 0) / monthlyReturns.length
        );
        const sharpeRatio = stdDev > 0 ? (avgMonthlyReturn - riskFreeRate) / stdDev * Math.sqrt(12) : 0;

        return {
            timeline: timeline,
            summary: {
                startDate: backtestHistory[0].date,
                endDate: backtestHistory[backtestHistory.length - 1].date,
                months: monthsToBacktest,
                totalCost: totalCost,
                finalMarketValue: finalValue.marketValue,
                finalNetValue: finalValue.netValue,
                totalReturn: finalValue.unrealizedGainPercent,
                cagr: cagr,
                maxDrawdown: maxDrawdown,
                sharpeRatio: sharpeRatio,
                totalDividends: totalDividends,
                totalShares: totalShares
            }
        };
    }

    /**
     * 未來預測 - 馬可夫狀態轉換模型 + Monte Carlo
     * @param {Object} historicalData - 歷史資料
     * @param {Object} params - 參數設定
     * @returns {Object} - 預測結果
     */
    runForecast(historicalData, params = {}) {
        const config = { ...this.defaultParams, ...params };
        const history = historicalData.history || [];
        const stats = historicalData.stats || {};

        // 從歷史資料估計參數
        const monthlyReturn = stats.monthlyReturn || 0.008;
        const monthlyStdDev = stats.monthlyStdDev || 0.05;

        // 馬可夫狀態參數 (牛市/熊市)
        const states = {
            bull: {
                return: monthlyReturn * 1.5,
                stdDev: monthlyStdDev * 0.8,
                stayProb: 0.95  // 留在牛市機率
            },
            bear: {
                return: monthlyReturn * -0.5,
                stdDev: monthlyStdDev * 1.5,
                stayProb: 0.90  // 留在熊市機率
            }
        };

        const months = config.years * 12;
        const simulations = [];

        // Monte Carlo 模擬
        for (let sim = 0; sim < config.monteCarloRuns; sim++) {
            let portfolio = config.initialCapital;
            let state = Math.random() > 0.5 ? 'bull' : 'bear';
            const path = [{ month: 0, value: portfolio, capital: config.initialCapital }];
            let totalCapital = config.initialCapital;

            for (let m = 1; m <= months; m++) {
                // 狀態轉換
                const stateParams = states[state];
                const stayProb = stateParams.stayProb;
                if (Math.random() > stayProb) {
                    state = state === 'bull' ? 'bear' : 'bull';
                }

                // 生成月報酬 (常態分佈)
                const currentState = states[state];
                const monthlyRet = this.normalRandom(currentState.return, currentState.stdDev);

                // 更新投資組合
                portfolio = portfolio * (1 + monthlyRet) + config.monthlyInvestment;
                totalCapital += config.monthlyInvestment;

                path.push({
                    month: m,
                    value: portfolio,
                    capital: totalCapital,
                    state: state
                });
            }

            simulations.push(path);
        }

        // 計算百分位數
        const finalValues = simulations.map(s => s[s.length - 1].value);
        finalValues.sort((a, b) => a - b);

        const percentile = (arr, p) => {
            const index = Math.floor(arr.length * p);
            return arr[index];
        };

        // 建立時間軸 (中位數 + 信賴區間)
        const timeline = [];
        for (let m = 0; m <= months; m++) {
            const values = simulations.map(s => s[m].value).sort((a, b) => a - b);
            const capitals = simulations.map(s => s[m].capital);

            timeline.push({
                month: m,
                date: this.addMonths(new Date(), m).toISOString().split('T')[0],
                capital: capitals[0],
                p10: percentile(values, 0.10),  // 保守
                p25: percentile(values, 0.25),
                p50: percentile(values, 0.50),  // 中位數
                p75: percentile(values, 0.75),
                p90: percentile(values, 0.90)   // 樂觀
            });
        }

        const totalCapital = config.initialCapital + config.monthlyInvestment * months;

        return {
            timeline: timeline,
            summary: {
                years: config.years,
                totalCapital: totalCapital,
                conservative: percentile(finalValues, 0.10),
                median: percentile(finalValues, 0.50),
                optimistic: percentile(finalValues, 0.90),
                conservativeReturn: (percentile(finalValues, 0.10) - totalCapital) / totalCapital,
                medianReturn: (percentile(finalValues, 0.50) - totalCapital) / totalCapital,
                optimisticReturn: (percentile(finalValues, 0.90) - totalCapital) / totalCapital,
                simulations: config.monteCarloRuns
            }
        };
    }

    /**
     * 固定報酬模擬
     * @param {Object} params - 參數設定
     * @returns {Object} - 模擬結果
     */
    runSimulation(params = {}) {
        const config = { ...this.defaultParams, ...params };
        const months = config.years * 12;
        const monthlyRate = Math.pow(1 + config.annualReturn, 1 / 12) - 1;

        const timeline = [];
        let portfolio = config.initialCapital;
        let totalCapital = config.initialCapital;

        timeline.push({
            month: 0,
            date: new Date().toISOString().split('T')[0],
            value: portfolio,
            capital: totalCapital,
            gain: 0,
            gainPercent: 0
        });

        for (let m = 1; m <= months; m++) {
            // 複利增長
            portfolio = portfolio * (1 + monthlyRate) + config.monthlyInvestment;
            totalCapital += config.monthlyInvestment;

            timeline.push({
                month: m,
                date: this.addMonths(new Date(), m).toISOString().split('T')[0],
                value: portfolio,
                capital: totalCapital,
                gain: portfolio - totalCapital,
                gainPercent: (portfolio - totalCapital) / totalCapital
            });
        }

        const finalValue = timeline[timeline.length - 1];

        return {
            timeline: timeline,
            summary: {
                years: config.years,
                annualReturn: config.annualReturn,
                totalCapital: totalCapital,
                finalValue: finalValue.value,
                totalGain: finalValue.gain,
                totalGainPercent: finalValue.gainPercent,
                // 72 法則
                doubleYears: 72 / (config.annualReturn * 100)
            }
        };
    }

    // === 工具函數 ===

    /**
     * 建立投資金額時間表 (支援分時段投資)
     * @param {Object} config - 配置參數
     * @returns {Array} - 每月投資金額陣列
     */
    buildInvestmentSchedule(config) {
        const schedule = [];

        if (config.usePhases && config.investmentPhases && config.investmentPhases.length > 0) {
            // 分時段投資
            for (const phase of config.investmentPhases) {
                for (let m = 0; m < phase.months; m++) {
                    schedule.push(phase.amount);
                }
            }
        } else {
            // 固定月投資 (預設 30 年 = 360 個月)
            const maxMonths = 360;
            for (let m = 0; m < maxMonths; m++) {
                schedule.push(config.monthlyInvestment || 10000);
            }
        }

        return schedule;
    }

    /**
     * 常態分佈隨機數 (Box-Muller)
     */
    normalRandom(mean = 0, stdDev = 1) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + stdDev * z;
    }

    /**
     * 計算 RSI
     */
    calculateRSI(prices, period = 14) {
        const rsi = [];

        for (let i = 0; i < prices.length; i++) {
            if (i < period) {
                rsi.push(null);
                continue;
            }

            let gains = 0, losses = 0;
            for (let j = i - period + 1; j <= i; j++) {
                const change = prices[j] - prices[j - 1];
                if (change > 0) gains += change;
                else losses -= change;
            }

            const avgGain = gains / period;
            const avgLoss = losses / period;

            if (avgLoss === 0) {
                rsi.push(100);
            } else {
                const rs = avgGain / avgLoss;
                rsi.push(100 - (100 / (1 + rs)));
            }
        }

        return rsi;
    }

    /**
     * 增加月份
     */
    addMonths(date, months) {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return result;
    }

    /**
     * 格式化金額
     */
    formatCurrency(value, currency = 'TWD') {
        return new Intl.NumberFormat('zh-TW', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }

    /**
     * 格式化百分比
     */
    formatPercent(value) {
        return (value * 100).toFixed(2) + '%';
    }
}

// 匯出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BacktestEngine;
}

if (typeof window !== 'undefined') {
    window.BacktestEngine = BacktestEngine;
}
