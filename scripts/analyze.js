/**
 * Discover Latest - Advanced SMC Analysis Module
 * SMC (Smart Money Concepts) / ICT / Wyckoff / Order Flow
 */

/**
 * 偵測 Order Block (訂單塊)
 * 定義：價格劇烈移動前的最後一根反向 K 線
 */
function detectOrderBlock(stock) {
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

    // Bullish OB: 強勢多方 (放寬條件：漲幅 > 1.5% 且實體大)
    if (changePercent > 1.5 && bodySize > totalRange * 0.5 && upperWick < bodySize * 0.3) {
        return 'bullish-ob';
    }

    // Bearish OB: 弱勢空方
    if (changePercent < -1.5 && bodySize > totalRange * 0.5 && lowerWick < bodySize * 0.3) {
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
 */
function detectLiquiditySweep(stock) {
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

export default {
    calculateStockScore,
    generateAnalysisText,
    generateTags,
    selectRecommendations
};
