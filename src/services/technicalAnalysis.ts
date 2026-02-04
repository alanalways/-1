/**
 * 技術面分析服務
 * 計算 MA, RSI, MACD, 支撐/壓力等技術指標
 */

export interface TechnicalFeatures {
    // 趨勢判斷
    trend_pattern: '多頭排列' | '空頭排列' | '盤整';

    // RSI
    rsi: number;
    rsi_level: '超買' | '超賣' | '中性';

    // MACD
    macd: number;
    macd_signal: number;
    macd_histogram: number;
    macd_cross: '金叉' | '死叉' | '震盪';

    // 均線
    ma5: number;
    ma20: number;
    ma60: number;

    // 支撐/壓力
    support: number;
    resistance: number;
    price_vs_sr: '突破關鍵壓力' | '突破關鍵支撐' | '在壓力與支撐之間';

    // 當前價格
    current_price: number;
}

export interface PriceData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * 計算簡單移動平均線 (SMA)
 */
function calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((sum, p) => sum + p, 0) / period;
}

/**
 * 計算指數移動平均線 (EMA)
 */
function calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;

    const multiplier = 2 / (period + 1);
    let ema = calculateSMA(prices.slice(0, period), period);

    for (let i = period; i < prices.length; i++) {
        ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
}

/**
 * 計算 RSI (Relative Strength Index)
 */
function calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    // 計算初始平均漲跌
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // 平滑計算後續值
    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) - change) / period;
        }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

/**
 * 計算 MACD
 */
function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    // 計算 Signal (MACD 的 9 日 EMA)
    // 簡化版本：使用當前 MACD 值
    const signal = macd * 0.9; // 簡化
    const histogram = macd - signal;

    return { macd, signal, histogram };
}

/**
 * 計算支撐與壓力位
 */
function calculateSupportResistance(data: PriceData[]): { support: number; resistance: number } {
    if (data.length < 20) {
        const prices = data.map(d => d.close);
        return {
            support: Math.min(...prices),
            resistance: Math.max(...prices)
        };
    }

    // 取近 20 日的高低點
    const recent = data.slice(-20);
    const lows = recent.map(d => d.low);
    const highs = recent.map(d => d.high);

    // 找出近期低點作為支撐
    const support = Math.min(...lows);
    // 找出近期高點作為壓力
    const resistance = Math.max(...highs);

    return { support, resistance };
}

/**
 * 判斷趨勢排列
 */
function determineTrendPattern(ma5: number, ma20: number, ma60: number): '多頭排列' | '空頭排列' | '盤整' {
    // 多頭排列：MA5 > MA20 > MA60
    if (ma5 > ma20 && ma20 > ma60) return '多頭排列';
    // 空頭排列：MA5 < MA20 < MA60
    if (ma5 < ma20 && ma20 < ma60) return '空頭排列';
    // 其他情況為盤整
    return '盤整';
}

/**
 * 判斷 RSI 水平
 */
function determineRSILevel(rsi: number): '超買' | '超賣' | '中性' {
    if (rsi >= 70) return '超買';
    if (rsi <= 30) return '超賣';
    return '中性';
}

/**
 * 判斷 MACD 交叉狀態
 */
function determineMACDCross(macd: number, signal: number, histogram: number): '金叉' | '死叉' | '震盪' {
    // 金叉：MACD 從下往上穿越 Signal
    if (macd > signal && histogram > 0) return '金叉';
    // 死叉：MACD 從上往下穿越 Signal
    if (macd < signal && histogram < 0) return '死叉';
    return '震盪';
}

/**
 * 判斷價格與支撐/壓力的關係
 */
function determinePriceVsSR(
    price: number,
    support: number,
    resistance: number,
    previousClose: number
): '突破關鍵壓力' | '突破關鍵支撐' | '在壓力與支撐之間' {
    const breakoutThreshold = 0.02; // 2% 突破門檻

    // 突破壓力
    if (price > resistance * (1 + breakoutThreshold) && previousClose < resistance) {
        return '突破關鍵壓力';
    }
    // 跌破支撐
    if (price < support * (1 - breakoutThreshold) && previousClose > support) {
        return '突破關鍵支撐';
    }
    return '在壓力與支撐之間';
}

/**
 * 計算完整技術面特徵
 */
export function calculateTechnicalFeatures(data: PriceData[]): TechnicalFeatures {
    if (data.length === 0) {
        throw new Error('無歷史資料可供分析');
    }

    const closePrices = data.map(d => d.close);
    const currentPrice = closePrices[closePrices.length - 1];
    const previousClose = closePrices.length > 1 ? closePrices[closePrices.length - 2] : currentPrice;

    // 計算均線
    const ma5 = calculateSMA(closePrices, 5);
    const ma20 = calculateSMA(closePrices, 20);
    const ma60 = calculateSMA(closePrices, 60);

    // 計算 RSI
    const rsi = calculateRSI(closePrices, 14);

    // 計算 MACD
    const { macd, signal, histogram } = calculateMACD(closePrices);

    // 計算支撐/壓力
    const { support, resistance } = calculateSupportResistance(data);

    return {
        current_price: currentPrice,

        // 趨勢
        trend_pattern: determineTrendPattern(ma5, ma20, ma60),

        // RSI
        rsi: Math.round(rsi * 100) / 100,
        rsi_level: determineRSILevel(rsi),

        // MACD
        macd: Math.round(macd * 100) / 100,
        macd_signal: Math.round(signal * 100) / 100,
        macd_histogram: Math.round(histogram * 100) / 100,
        macd_cross: determineMACDCross(macd, signal, histogram),

        // 均線
        ma5: Math.round(ma5 * 100) / 100,
        ma20: Math.round(ma20 * 100) / 100,
        ma60: Math.round(ma60 * 100) / 100,

        // 支撐/壓力
        support: Math.round(support * 100) / 100,
        resistance: Math.round(resistance * 100) / 100,
        price_vs_sr: determinePriceVsSR(currentPrice, support, resistance, previousClose),
    };
}

/**
 * 將技術面特徵轉換為 AI Prompt 格式
 */
export function technicalFeaturesToJSON(features: TechnicalFeatures): object {
    return {
        technical: {
            trend_pattern: features.trend_pattern,
            rsi_level: features.rsi_level,
            macd_signal: features.macd_cross,
            price_vs_support_resistance: features.price_vs_sr,
        },
        indicators: {
            ma5: features.ma5,
            ma20: features.ma20,
            ma60: features.ma60,
            rsi: features.rsi,
            macd: features.macd,
            macd_signal_line: features.macd_signal,
            macd_histogram: features.macd_histogram,
            support: features.support,
            resistance: features.resistance,
        },
        current_price: features.current_price,
    };
}
