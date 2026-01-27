/**
 * 台股每日市場分析報告 - 股票分析模組
 * 根據技術面、基本面、消息面進行股票篩選與評分
 */

/**
 * 計算股票評分
 * @param {Object} stock - 股票資料
 * @returns {Object} 評分結果
 */
export function calculateStockScore(stock) {
    let score = 50; // 基礎分數
    const reasons = [];

    // === 技術面分析 ===

    // 1. 價格變動
    const changePercent = parseFloat(stock.changePercent || 0);
    if (changePercent > 3) {
        score += 15;
        reasons.push('📈 強勢上漲');
    } else if (changePercent > 1) {
        score += 8;
        reasons.push('📈 溫和上漲');
    } else if (changePercent < -3) {
        score -= 15;
        reasons.push('📉 大幅下跌');
    } else if (changePercent < -1) {
        score -= 8;
        reasons.push('📉 溫和下跌');
    }

    // 2. 成交量分析
    const volumeRatio = parseFloat(stock.volumeRatio || 1);
    if (volumeRatio > 2) {
        score += 12;
        reasons.push('🔥 成交量爆增');
    } else if (volumeRatio > 1.5) {
        score += 8;
        reasons.push('📊 成交量放大');
    } else if (volumeRatio < 0.5) {
        score -= 5;
        reasons.push('📉 成交量萎縮');
    }

    // 3. 價格位置（相對於當日高低）
    if (stock.highPrice && stock.lowPrice && stock.closePrice) {
        const high = parseFloat(stock.highPrice);
        const low = parseFloat(stock.lowPrice);
        const close = parseFloat(stock.closePrice);
        const range = high - low;

        if (range > 0) {
            const position = (close - low) / range;
            if (position > 0.8) {
                score += 8;
                reasons.push('💪 收盤價接近當日高點');
            } else if (position < 0.2) {
                score -= 8;
                reasons.push('⚠️ 收盤價接近當日低點');
            }
        }
    }

    // === 產業趨勢 ===
    const hotSectors = ['半導體', 'AI', '電動車', '5G', '雲端', '資安'];
    if (stock.sector && hotSectors.some(s => stock.sector.includes(s))) {
        score += 10;
        reasons.push(`🚀 ${stock.sector}產業熱門`);
    }

    // === 決定信號 ===
    let signal = 'NEUTRAL';
    if (score >= 70) {
        signal = 'BULLISH';
    } else if (score <= 35) {
        signal = 'BEARISH';
    }

    return {
        score: Math.min(100, Math.max(0, score)),
        signal,
        reasons
    };
}

/**
 * 產生股票分析文字
 * @param {Object} stock - 股票資料  
 * @param {Object} scoreResult - 評分結果
 * @returns {string} 分析文字
 */
export function generateAnalysisText(stock, scoreResult) {
    const { score, signal, reasons } = scoreResult;

    let analysis = '';

    // 開頭根據信號
    if (signal === 'BULLISH') {
        analysis += '🔥 ';
    } else if (signal === 'BEARISH') {
        analysis += '⚠️ ';
    } else {
        analysis += '📊 ';
    }

    // 加入股票名稱和基本描述
    analysis += `${stock.name}（${stock.code}）`;

    // 加入分析原因
    if (reasons.length > 0) {
        analysis += '：' + reasons.slice(0, 3).join('，');
    }

    // 加入建議
    if (signal === 'BULLISH') {
        analysis += '。短線建議偏多操作，可關注突破機會。';
    } else if (signal === 'BEARISH') {
        analysis += '。短線宜謹慎，建議觀望或減碼。';
    } else {
        analysis += '。建議觀察後續走勢再做決定。';
    }

    return analysis;
}

/**
 * 產生股票標籤
 * @param {Object} stock - 股票資料
 * @param {Object} scoreResult - 評分結果
 * @returns {Array} 標籤陣列
 */
export function generateTags(stock, scoreResult) {
    const tags = [];

    // 產業標籤
    if (stock.sector) {
        tags.push({ label: stock.sector, type: 'neutral' });
    }

    // 信號標籤
    if (scoreResult.signal === 'BULLISH') {
        tags.push({ label: '看多', type: 'bullish' });
    } else if (scoreResult.signal === 'BEARISH') {
        tags.push({ label: '看空', type: 'bearish' });
    }

    // 成交量標籤
    const volumeRatio = parseFloat(stock.volumeRatio || 1);
    if (volumeRatio > 1.5) {
        tags.push({ label: '量增', type: 'bullish' });
    }

    // 價格變動標籤
    const changePercent = parseFloat(stock.changePercent || 0);
    if (changePercent > 2) {
        tags.push({ label: '強勢', type: 'bullish' });
    } else if (changePercent < -2) {
        tags.push({ label: '弱勢', type: 'bearish' });
    }

    return tags.slice(0, 4); // 最多 4 個標籤
}

/**
 * 篩選並排序推薦股票
 * @param {Array} stocks - 股票清單
 * @param {number} limit - 推薦數量
 * @returns {Array} 推薦股票
 */
export function selectRecommendations(stocks, limit = 20) {
    // 計算每支股票的分數
    const scoredStocks = stocks.map(stock => {
        const scoreResult = calculateStockScore(stock);
        return {
            ...stock,
            ...scoreResult,
            analysis: generateAnalysisText(stock, scoreResult),
            tags: generateTags(stock, scoreResult)
        };
    });

    // 依分數排序
    scoredStocks.sort((a, b) => b.score - a.score);

    // 取前 N 檔
    return scoredStocks.slice(0, limit);
}

export default {
    calculateStockScore,
    generateAnalysisText,
    generateTags,
    selectRecommendations
};
