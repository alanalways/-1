/**
 * 台股每日市場分析報告 - Advanced SMC Analysis Module
 * 核心框架：SMC (Smart Money Concepts) / ICT / Wyckoff / Order Flow
 */

/**
 * 偵測 Order Block (訂單塊)
 * 定義：價格劇烈移動前的最後一根反向 K 線
 * @returns {string|null} 'bullish-ob' | 'bearish-ob' | null
 */
function detectOrderBlock(stock) {
    // 由於我們只有當日數據 (OHLC)，無法精確回溯多日 K 線找到 OB。
    // 這裡我們使用一種 "即時訂單流" 近似判斷：
    // 如果今日長紅吞噬且量增，視為潛在 Bullish OB 的形成日

    const open = parseFloat(stock.openPrice);
    const close = parseFloat(stock.closePrice);
    const low = parseFloat(stock.lowPrice);
    const high = parseFloat(stock.highPrice);
    const volumeRatio = parseFloat(stock.volumeRatio || 1);

    const bodySize = Math.abs(close - open);
    const totalRange = high - low;

    // 避免 totalRange 為 0 的錯誤
    if (totalRange === 0) return null;

    const lowerWick = Math.min(open, close) - low;
    const upperWick = high - Math.max(open, close);

    // Bullish OB Formation (強勢多方表態)
    // 條件：實體大，收盤近高點，量增 > 1.5，且漲幅 > 2%
    if (stock.changePercent > 2 && volumeRatio > 1.5) {
        if (bodySize > totalRange * 0.6 && upperWick < bodySize * 0.2) {
            return 'bullish-ob'; // 視為潛在多方訂單塊起點
        }
    }

    // Bearish OB Formation (弱勢空方表態)
    if (stock.changePercent < -2 && volumeRatio > 1.5) {
        if (bodySize > totalRange * 0.6 && lowerWick < bodySize * 0.2) {
            return 'bearish-ob';
        }
    }

    return null;
}

/**
 * 偵測 FVG (Fair Value Gap)
 * 定義：強烈趨勢造成的價格缺口，暗示市場不平衡
 * @returns {string|null}
 */
function detectFVG(stock) {
    // 簡化判斷：跳空缺口
    // 今日最低價 > 昨日收盤價 (未回補缺口) => Bullish Gap
    // 這裡需要昨日收盤價，我們可以用 openPrice 近似判斷開盤跳空

    const close = parseFloat(stock.closePrice);
    const change = parseFloat(stock.changeVal || (close * stock.changePercent / 100));
    const prevClose = close - change;
    const low = parseFloat(stock.lowPrice);
    const high = parseFloat(stock.highPrice);

    // Bullish Gap: 今日最低 > 昨日收盤 (跳空缺口)
    if (low > prevClose * 1.01 && stock.changePercent > 1) {
        return 'bullish-fvg';
    }

    // Bearish Gap: 今日最高 < 昨日收盤
    if (high < prevClose * 0.99 && stock.changePercent < -1) {
        return 'bearish-fvg';
    }

    return null;
}

/**
 * 偵測 Liquidity Sweep (流動性獵取 / Turtle Soup)
 * 定義：破底翻或假突破
 * @returns {string|null}
 */
function detectLiquiditySweep(stock) {
    const open = parseFloat(stock.openPrice);
    const close = parseFloat(stock.closePrice);
    const low = parseFloat(stock.lowPrice);
    const high = parseFloat(stock.highPrice);
    const totalRange = high - low;

    if (totalRange === 0) return null;

    const bodySize = Math.abs(close - open);

    // Bullish Sweep (破底翻): 下影線長，收盤收回開盤附近或以上
    const lowerWick = Math.min(open, close) - low;

    if (lowerWick > bodySize * 2 && lowerWick > totalRange * 0.4) {
        return 'liquidity-sweep-bull';
    }

    // Bearish Sweep (假突破): 上影線長
    const upperWick = high - Math.max(open, close);
    if (upperWick > bodySize * 2 && upperWick > totalRange * 0.4) {
        return 'liquidity-sweep-bear';
    }

    return null;
}

/**
 * 計算股票評分 (SMC/ICT Enhanced)
 */
export function calculateStockScore(stock) {
    let score = 50;
    const reasons = [];
    let signalType = 'NEUTRAL'; // 用來記錄主要的 SMC 信號

    // 1. SMC 核心結構 (Order Flow)
    const obSignal = detectOrderBlock(stock);
    const fvgSignal = detectFVG(stock);
    const sweepSignal = detectLiquiditySweep(stock);

    if (obSignal === 'bullish-ob') {
        score += 20;
        reasons.push('🧱 Bullish OB (機構買單)');
        signalType = 'SMC_BUY';
    } else if (obSignal === 'bearish-ob') {
        score -= 20;
        reasons.push('🧱 Bearish OB (機構倒貨)');
    }

    if (fvgSignal === 'bullish-fvg') {
        score += 15;
        reasons.push('🕳️ Bullish FVG (價值缺口)');
    } else if (fvgSignal === 'bearish-fvg') {
        score -= 15;
        reasons.push('🕳️ Bearish FVG (下跌缺口)');
    }

    if (sweepSignal === 'liquidity-sweep-bull') {
        score += 25; // 獵取流動性通常是強烈反轉訊號
        reasons.push('🐢 Liquidity Sweep (破底翻)');
        signalType = 'SMC_BUY';
    } else if (sweepSignal === 'liquidity-sweep-bear') {
        score -= 25;
        reasons.push('🐢 Liquidity Sweep (假突破)');
    }

    // 2. 基本面濾網 (Fundamental Filter)
    const pe = parseFloat(stock.peRatio || 0);
    const yieldRate = parseFloat(stock.dividendYield || 0);

    if (pe > 0 && pe < 15) score += 5; // 價值保護
    if (yieldRate > 4) score += 5; // 股息保護

    // 3. 動能與趨勢
    const volumeRatio = parseFloat(stock.volumeRatio || 1);
    const changePercent = parseFloat(stock.changePercent || 0);

    if (volumeRatio > 2) {
        score += 10;
        reasons.push('🌊 High Volume (大戶進場)');
    }

    if (changePercent > 3) {
        score += 10;
        reasons.push('🚀 Momentum Up');
    } else if (changePercent < -3) {
        score -= 10;
        reasons.push('📉 Momentum Down');
    }

    // 4. SNR (關鍵整數位支撐)
    const close = parseFloat(stock.closePrice);
    if (close % 10 === 0 || close % 50 === 0 || close % 100 === 0) {
        // 接近整數關卡且紅K，視為突破或支撐確認
        if (stock.changePercent > 0) score += 5;
    }

    // 決定最終信號
    let finalSignal = 'NEUTRAL';
    if (score >= 80) finalSignal = 'BULLISH'; // 提高標準以過濾雜訊
    else if (score <= 30) finalSignal = 'BEARISH';

    return {
        score: Math.min(100, Math.max(0, score)),
        signal: finalSignal,
        signalType, // 用於標籤
        reasons,
        patterns: { ob: obSignal, fvg: fvgSignal, sweep: sweepSignal }
    };
}

export function generateAnalysisText(stock, scoreResult) {
    const { signal, reasons } = scoreResult;
    let icon = signal === 'BULLISH' ? '🚀' : (signal === 'BEARISH' ? '🐻' : '⚖️');

    return `${icon} **${stock.name}** [${stock.sector || '一般'}] ➤ ${reasons.join(' + ')}。${stock.peRatio ? `(P/E: ${stock.peRatio})` : ''}`;
}

export function generateTags(stock, scoreResult) {
    const tags = [];
    const { patterns } = scoreResult;

    // SMC Tags (Priority)
    if (patterns.ob === 'bullish-ob') tags.push({ label: 'Bullish OB', type: 'smc-ob' });
    if (patterns.fvg === 'bullish-fvg') tags.push({ label: 'Bullish FVG', type: 'smc-fvg' });
    if (patterns.sweep === 'liquidity-sweep-bull') tags.push({ label: 'Liq Sweep', type: 'smc-liq' });

    if (patterns.ob === 'bearish-ob') tags.push({ label: 'Bearish OB', type: 'bearish' });
    if (patterns.fvg === 'bearish-fvg') tags.push({ label: 'Bearish FVG', type: 'bearish' });

    // Sector
    if (stock.sector) tags.push({ label: stock.sector, type: 'neutral' });

    // Fundamentals
    if (stock.dividendYield > 5) tags.push({ label: `Yield ${stock.dividendYield}%`, type: 'bullish' });
    if (stock.peRatio > 0 && stock.peRatio < 12) tags.push({ label: `PE ${stock.peRatio}`, type: 'bullish' });

    return tags.slice(0, 4);
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

    // 優先排序：分數高 > 成交量大 (確保流動性)
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
