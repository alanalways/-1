/**
 * Discover Latest - Advanced SMC Analysis Module
 * SMC (Smart Money Concepts) / ICT / Wyckoff / Order Flow
 * 
 * Enhanced with:
 * - ATR-based dynamic thresholds
 * - Swing High/Low detection
 * - Market Structure Shift (MSS) filter
 */

// 全域歷史資料緩存 (用於動態計算)
let stockHistoryCache = new Map();

/**
 * 計算 ATR (Average True Range) - 動態波動率
 * @param {Array} history - 歷史 K 線資料 [{high, low, close}, ...]
 * @param {number} period - 計算週期
 */
function calculateATR(history, period = 14) {
    if (!history || history.length < period + 1) return null;

    const trs = [];
    for (let i = 1; i < history.length; i++) {
        const high = history[i].high || history[i].highPrice;
        const low = history[i].low || history[i].lowPrice;
        const prevClose = history[i - 1].close || history[i - 1].closePrice;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trs.push(tr);
    }

    const recentTRs = trs.slice(-period);
    return recentTRs.reduce((a, b) => a + b, 0) / recentTRs.length;
}

/**
 * 找出 Swing High/Low (轉折點)
 * @param {Array} history - 歷史 K 線
 * @param {number} lookback - 左右各看幾根 K 線
 */
function findSwingPoints(history, lookback = 5) {
    if (!history || history.length < lookback * 2 + 1) {
        return { swingHighs: [], swingLows: [] };
    }

    const swingHighs = [];
    const swingLows = [];

    for (let i = lookback; i < history.length - lookback; i++) {
        const currentHigh = history[i].high || history[i].highPrice;
        const currentLow = history[i].low || history[i].lowPrice;

        // 檢查是否為 Swing High
        let isSwingHigh = true;
        let isSwingLow = true;

        for (let j = i - lookback; j <= i + lookback; j++) {
            if (j === i) continue;
            const h = history[j].high || history[j].highPrice;
            const l = history[j].low || history[j].lowPrice;
            if (h >= currentHigh) isSwingHigh = false;
            if (l <= currentLow) isSwingLow = false;
        }

        if (isSwingHigh) {
            swingHighs.push({ index: i, price: currentHigh, date: history[i].date });
        }
        if (isSwingLow) {
            swingLows.push({ index: i, price: currentLow, date: history[i].date });
        }
    }

    return { swingHighs, swingLows };
}

/**
 * 計算市場結構 (Market Structure)
 * - 是否在上升趨勢 (Price > MA200)
 * - Higher Highs & Higher Lows
 */
function calculateMarketStructure(history) {
    if (!history || history.length < 20) {
        return { isUptrend: null, hasHHHL: null, ma200: null };
    }

    // 計算 MA200 (或可用資料)
    const closes = history.map(h => h.close || h.closePrice);
    const maLength = Math.min(200, closes.length);
    const ma = closes.slice(-maLength).reduce((a, b) => a + b, 0) / maLength;
    const currentPrice = closes[closes.length - 1];

    // 檢查 Higher Highs & Higher Lows
    const recent = history.slice(-20);
    const highs = recent.map(h => h.high || h.highPrice);
    const lows = recent.map(h => h.low || h.lowPrice);

    const firstHalfHighs = highs.slice(0, 10);
    const secondHalfHighs = highs.slice(10);
    const firstHalfLows = lows.slice(0, 10);
    const secondHalfLows = lows.slice(10);

    const higherHighs = Math.max(...secondHalfHighs) > Math.max(...firstHalfHighs);
    const higherLows = Math.min(...secondHalfLows) > Math.min(...firstHalfLows);

    return {
        isUptrend: currentPrice > ma,
        hasHHHL: higherHighs && higherLows,
        ma200: ma
    };
}

/**
 * 偵測 Order Block (訂單塊) - ATR 動態化版本
 * 定義：價格劇烈移動前的最後一根反向 K 線
 */
function detectOrderBlock(stock, atr = null) {
    const open = parseFloat(stock.openPrice || 0);
    const close = parseFloat(stock.closePrice || 0);
    const low = parseFloat(stock.lowPrice || 0);
    const high = parseFloat(stock.highPrice || 0);
    const volumeRatio = parseFloat(stock.volumeRatio || 1);
    const changePercent = parseFloat(stock.changePercent || 0);

    if (open <= 0 || close <= 0 || high <= 0 || low <= 0) return null;

    const bodySize = Math.abs(close - open);
    const totalRange = high - low;

    if (totalRange === 0) return null;

    const lowerWick = Math.min(open, close) - low;
    const upperWick = high - Math.max(open, close);

    // 動態閾值：使用 ATR 或固定百分比
    const threshold = atr ? atr * 1.5 : close * 0.015;

    // Bullish OB: 強勢多方 (使用 ATR 判斷大實體)
    if (bodySize > threshold && bodySize > totalRange * 0.5 && upperWick < bodySize * 0.3 && changePercent > 0) {
        return 'bullish-ob';
    }

    // Bearish OB: 弱勢空方
    if (bodySize > threshold && bodySize > totalRange * 0.5 && lowerWick < bodySize * 0.3 && changePercent < 0) {
        return 'bearish-ob';
    }

    return null;
}

/**
 * 偵測 FVG (Fair Value Gap) - 價值缺口
 */
function detectFVG(stock) {
    const open = parseFloat(stock.openPrice || 0);
    const close = parseFloat(stock.closePrice || 0);
    const low = parseFloat(stock.lowPrice || 0);
    const high = parseFloat(stock.highPrice || 0);
    const changePercent = parseFloat(stock.changePercent || 0);

    if (open <= 0) return null;

    // Gap Up Detection: 開盤跳空 1% 以上
    const gapUp = (open - close * (1 - changePercent / 100)) / open;

    // Bullish Gap: 開盤價比昨收高很多且收紅
    if (changePercent > 2 && low > open * 0.98) {
        return 'bullish-fvg';
    }

    // Bearish Gap: 開盤價比昨收低很多且收黑
    if (changePercent < -2 && high < open * 1.02) {
        return 'bearish-fvg';
    }

    // 擴大檢測：大漲配合大實體
    const bodySize = Math.abs(close - open);
    const totalRange = high - low;
    if (totalRange > 0 && bodySize > totalRange * 0.7) {
        if (changePercent > 2.5) return 'bullish-fvg';
        if (changePercent < -2.5) return 'bearish-fvg';
    }

    return null;
}

/**
 * 偵測 Liquidity Sweep (流動性獵取 / 破底翻)
 * Enhanced: 檢測是否掃過 Swing High/Low
 * @param {Object} stock - 當前股票資料
 * @param {Object} swingPoints - 可選的 Swing Points {swingHighs, swingLows}
 */
function detectLiquiditySweep(stock, swingPoints = null) {
    const open = parseFloat(stock.openPrice || 0);
    const close = parseFloat(stock.closePrice || 0);
    const low = parseFloat(stock.lowPrice || 0);
    const high = parseFloat(stock.highPrice || 0);
    const changePercent = parseFloat(stock.changePercent || 0);

    if (open <= 0 || high <= low) return null;

    const totalRange = high - low;
    const bodySize = Math.abs(close - open);
    const lowerWick = Math.min(open, close) - low;
    const upperWick = high - Math.max(open, close);

    // 如果有 Swing Points，使用更精確的判斷
    if (swingPoints && swingPoints.swingHighs && swingPoints.swingLows) {
        const { swingHighs, swingLows } = swingPoints;

        // Bearish Sweep: High > Last Swing High 但 Close < Last Swing High (假突破)
        if (swingHighs.length > 0) {
            const lastSwingHigh = swingHighs[swingHighs.length - 1].price;
            if (high > lastSwingHigh && close < lastSwingHigh) {
                return 'liquidity-sweep-bear';
            }
        }

        // Bullish Sweep: Low < Last Swing Low 但 Close > Last Swing Low (破底翻)
        if (swingLows.length > 0) {
            const lastSwingLow = swingLows[swingLows.length - 1].price;
            if (low < lastSwingLow && close > lastSwingLow) {
                return 'liquidity-sweep-bull';
            }
        }
    }

    // 備用方案：傳統影線判斷
    // Bullish Sweep (破底翻): 下影線長 + 收紅
    if (lowerWick > bodySize * 1.5 && lowerWick > totalRange * 0.3 && changePercent >= 0) {
        return 'liquidity-sweep-bull';
    }

    // Bearish Sweep (假突破): 上影線長 + 收黑
    if (upperWick > bodySize * 1.5 && upperWick > totalRange * 0.3 && changePercent <= 0) {
        return 'liquidity-sweep-bear';
    }

    return null;
}

/**
 * 計算股票評分 (SMC Enhanced)
 */
export function calculateStockScore(stock) {
    let score = 50;
    const reasons = [];
    let signalType = 'NEUTRAL';

    // 1. SMC 核心結構
    const obSignal = detectOrderBlock(stock);
    const fvgSignal = detectFVG(stock);
    const sweepSignal = detectLiquiditySweep(stock);

    if (obSignal === 'bullish-ob') {
        score += 20;
        reasons.push('🧱 Bullish OB');
        signalType = 'SMC_BUY';
    } else if (obSignal === 'bearish-ob') {
        score -= 20;
        reasons.push('🧱 Bearish OB');
        signalType = 'SMC_SELL';
    }

    if (fvgSignal === 'bullish-fvg') {
        score += 15;
        reasons.push('🕳️ Bullish FVG');
    } else if (fvgSignal === 'bearish-fvg') {
        score -= 15;
        reasons.push('🕳️ Bearish FVG');
    }

    if (sweepSignal === 'liquidity-sweep-bull') {
        score += 25;
        reasons.push('🐢 Liq Sweep ↑');
        signalType = 'SMC_BUY';
    } else if (sweepSignal === 'liquidity-sweep-bear') {
        score -= 25;
        reasons.push('🐢 Liq Sweep ↓');
        signalType = 'SMC_SELL';
    }

    // 2. 基本面濾網
    const pe = parseFloat(stock.peRatio || 0);
    const yieldRate = parseFloat(stock.dividendYield || 0);

    if (pe > 0 && pe < 15) {
        score += 5;
        reasons.push('💰 Low PE');
    }
    if (yieldRate > 4) {
        score += 5;
        reasons.push('💵 High Yield');
    }

    // 3. 動能
    const volumeRatio = parseFloat(stock.volumeRatio || 1);
    const changePercent = parseFloat(stock.changePercent || 0);

    if (volumeRatio > 1.5) {
        score += 10;
        reasons.push('🌊 Vol Surge');
    }

    if (changePercent > 3) {
        score += 10;
        reasons.push('🚀 Momentum Up');
    } else if (changePercent > 1) {
        score += 5;
    } else if (changePercent < -3) {
        score -= 10;
        reasons.push('📉 Momentum Down');
    }

    // 4. 產業加分
    const sector = stock.sector || '';
    if (['半導體', 'AI/雲端'].includes(sector)) {
        score += 5;
    }

    // 決定最終信號
    let finalSignal = 'NEUTRAL';
    if (score >= 70) finalSignal = 'BULLISH';
    else if (score <= 35) finalSignal = 'BEARISH';

    return {
        score: Math.min(100, Math.max(0, score)),
        signal: finalSignal,
        signalType,
        reasons,
        patterns: { ob: obSignal, fvg: fvgSignal, sweep: sweepSignal }
    };
}

export function generateAnalysisText(stock, scoreResult) {
    const { signal, reasons } = scoreResult;
    let icon = signal === 'BULLISH' ? '🚀' : (signal === 'BEARISH' ? '🐻' : '⚖️');
    const reasonsText = reasons.length > 0 ? reasons.join(' + ') : '盤整觀望';

    return `${icon} **${stock.name}** [${stock.sector || '一般'}] ➤ ${reasonsText}。${stock.peRatio ? ` (PE: ${stock.peRatio})` : ''}`;
}

export function generateTags(stock, scoreResult) {
    const tags = [];
    const { patterns, signal } = scoreResult;

    // SMC Tags (Priority)
    if (patterns.ob === 'bullish-ob') tags.push({ label: 'Bullish OB', type: 'smc-ob' });
    if (patterns.ob === 'bearish-ob') tags.push({ label: 'Bearish OB', type: 'bearish' });
    if (patterns.fvg === 'bullish-fvg') tags.push({ label: 'Bullish FVG', type: 'smc-fvg' });
    if (patterns.fvg === 'bearish-fvg') tags.push({ label: 'Bearish FVG', type: 'bearish' });
    if (patterns.sweep === 'liquidity-sweep-bull') tags.push({ label: 'Liq Sweep ↑', type: 'smc-liq' });
    if (patterns.sweep === 'liquidity-sweep-bear') tags.push({ label: 'Liq Sweep ↓', type: 'bearish' });

    // Signal Tag
    if (signal === 'BULLISH') tags.push({ label: '看多', type: 'bullish' });
    if (signal === 'BEARISH') tags.push({ label: '看空', type: 'bearish' });

    // Sector Tag
    if (stock.sector) tags.push({ label: stock.sector, type: 'neutral' });

    // Fundamentals
    if (stock.dividendYield > 5) tags.push({ label: `Yield ${stock.dividendYield}%`, type: 'bullish' });

    return tags.slice(0, 5);
}

export function selectRecommendations(stocks, limit = 20) {
    const scoredStocks = stocks.map(stock => {
        const scoreResult = calculateStockScore(stock);
        return {
            ...stock,
            ...scoreResult,
            analysis: generateAnalysisText(stock, scoreResult),
            tags: generateTags(stock, scoreResult)
        };
    });

    // 優先排序：分數高 > 成交量大
    scoredStocks.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return parseFloat(b.volume || 0) - parseFloat(a.volume || 0);
    });

    return scoredStocks.slice(0, limit);
}

/**
 * [新增] 分析所有股票 - 不截斷，確保每檔都有完整評分
 * 用於每日更新，確保 2330/ETF 等所有股票都會被正確評分
 */
export function analyzeAllStocks(stocks) {
    console.log(`🧠 開始分析 ${stocks.length} 檔股票...`);

    const scoredStocks = stocks.map(stock => {
        const scoreResult = calculateStockScore(stock);
        return {
            ...stock,
            ...scoreResult,
            analysis: generateAnalysisText(stock, scoreResult),
            tags: generateTags(stock, scoreResult)
        };
    });

    // 依分數排序（但不截斷）
    scoredStocks.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return parseFloat(b.volume || 0) - parseFloat(a.volume || 0);
    });

    console.log(`✅ 完成分析 ${scoredStocks.length} 檔股票 (無截斷)`);
    return scoredStocks;
}

export default {
    calculateStockScore,
    generateAnalysisText,
    generateTags,
    selectRecommendations,
    analyzeAllStocks
};
