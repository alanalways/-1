/**
 * Yahoo Finance API 服務
 * 用於取得國際市場資料
 */

// 主要國際指數
export const GLOBAL_INDICES = [
    // 美國
    { symbol: '^GSPC', name: 'S&P 500', region: '美國', emoji: '🇺🇸' },
    { symbol: '^DJI', name: 'Dow Jones', region: '美國', emoji: '🇺🇸' },
    { symbol: '^IXIC', name: 'Nasdaq', region: '美國', emoji: '🇺🇸' },
    // 歐洲
    { symbol: '^GDAXI', name: 'DAX', region: '歐洲', emoji: '🇩🇪' },
    { symbol: '^FTSE', name: 'FTSE 100', region: '歐洲', emoji: '🇬🇧' },
    { symbol: '^FCHI', name: 'CAC 40', region: '歐洲', emoji: '🇫🇷' },
    // 亞洲
    { symbol: '^N225', name: '日經 225', region: '亞洲', emoji: '🇯🇵' },
    { symbol: '^HSI', name: '恒生指數', region: '亞洲', emoji: '🇭🇰' },
    { symbol: '000001.SS', name: '上證指數', region: '亞洲', emoji: '🇨🇳' },
    { symbol: '^TWII', name: '台灣加權', region: '亞洲', emoji: '🇹🇼' },
];

export interface MarketIndex {
    symbol: string;
    name: string;
    region: string;
    emoji: string;
    price: number;
    change: number;
    changePercent: number;
    previousClose: number;
    open: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    marketState: 'REGULAR' | 'PRE' | 'POST' | 'CLOSED';
}

export interface HistoricalData {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * 取得所有國際指數報價
 */
export async function getAllIndices(): Promise<MarketIndex[]> {
    try {
        // 透過後端 API 代理取得資料
        const response = await fetch('/api/yahoo/quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: GLOBAL_INDICES.map(i => i.symbol) }),
        });

        if (!response.ok) {
            throw new Error(`Yahoo API 回應錯誤: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Yahoo API 回傳失敗');
        }

        return data.quotes || [];
    } catch (error) {
        console.error('[Yahoo] 取得指數失敗:', error);
        throw error;
    }
}

/**
 * 取得單一指數的歷史資料
 */
export async function getHistoricalData(
    symbol: string,
    range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y' = '1mo'
): Promise<HistoricalData[]> {
    try {
        const response = await fetch(`/api/yahoo/history?symbol=${encodeURIComponent(symbol)}&range=${range}`);

        if (!response.ok) {
            throw new Error(`Yahoo 歷史資料 API 回應錯誤: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Yahoo 歷史資料 API 回傳失敗');
        }

        return data.history || [];
    } catch (error) {
        console.error('[Yahoo] 取得歷史資料失敗:', error);
        throw error;
    }
}

/**
 * 取得股票的基本面資料 (PE, PB, ROE 等)
 */
export async function getFundamentals(symbol: string): Promise<any> {
    try {
        const response = await fetch(`/api/yahoo/fundamentals?symbol=${encodeURIComponent(symbol)}`);

        if (!response.ok) {
            throw new Error(`Yahoo 基本面 API 回應錯誤: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Yahoo 基本面 API 回傳失敗');
        }

        return data.fundamentals;
    } catch (error) {
        console.error('[Yahoo] 取得基本面資料失敗:', error);
        throw error;
    }
}

/**
 * 格式化指數價格
 */
export function formatIndexPrice(price: number): string {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * 按區域分組
 */
export function groupByRegion(indices: MarketIndex[]): Record<string, MarketIndex[]> {
    return indices.reduce((acc, index) => {
        if (!acc[index.region]) acc[index.region] = [];
        acc[index.region].push(index);
        return acc;
    }, {} as Record<string, MarketIndex[]>);
}
