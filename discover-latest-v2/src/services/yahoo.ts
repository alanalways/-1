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
 * 注意：Yahoo Finance 有使用限制，建議做快取
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
            console.warn('[Yahoo] API 失敗，使用模擬資料');
            return getMockIndices();
        }

        const data = await response.json();
        return data.quotes || getMockIndices();
    } catch (error) {
        console.error('[Yahoo] 取得指數失敗:', error);
        return getMockIndices();
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
        const response = await fetch(`/api/yahoo/history?symbol=${symbol}&range=${range}`);

        if (!response.ok) {
            console.warn('[Yahoo] 取得歷史資料失敗，使用模擬資料');
            return getMockHistoricalData(range);
        }

        return await response.json();
    } catch (error) {
        console.error('[Yahoo] 取得歷史資料失敗:', error);
        return getMockHistoricalData(range);
    }
}

/**
 * 模擬國際指數資料
 */
function getMockIndices(): MarketIndex[] {
    const baseData = [
        { ...GLOBAL_INDICES[0], price: 6015.28, change: 52.15, changePercent: 0.87 },
        { ...GLOBAL_INDICES[1], price: 44815.20, change: -95.80, changePercent: -0.21 },
        { ...GLOBAL_INDICES[2], price: 19853.67, change: 158.32, changePercent: 0.80 },
        { ...GLOBAL_INDICES[3], price: 21451.25, change: 125.40, changePercent: 0.59 },
        { ...GLOBAL_INDICES[4], price: 8612.81, change: -28.50, changePercent: -0.33 },
        { ...GLOBAL_INDICES[5], price: 7935.78, change: 48.20, changePercent: 0.61 },
        { ...GLOBAL_INDICES[6], price: 39480.50, change: 285.60, changePercent: 0.73 },
        { ...GLOBAL_INDICES[7], price: 20285.30, change: -158.90, changePercent: -0.78 },
        { ...GLOBAL_INDICES[8], price: 3250.12, change: 25.80, changePercent: 0.80 },
        { ...GLOBAL_INDICES[9], price: 22850.35, change: 125.40, changePercent: 0.55 },
    ];

    return baseData.map((d, i) => ({
        ...d,
        previousClose: d.price - d.change,
        open: d.price - d.change * (0.5 + Math.random() * 0.5),
        dayHigh: d.price * (1 + Math.random() * 0.01),
        dayLow: d.price * (1 - Math.random() * 0.01),
        volume: Math.floor(Math.random() * 1e9 + 1e8),
        marketState: 'CLOSED' as const,
    }));
}

/**
 * 模擬歷史資料
 */
function getMockHistoricalData(range: string): HistoricalData[] {
    const days = range === '1d' ? 1 : range === '5d' ? 5 : range === '1mo' ? 30 : range === '3mo' ? 90 : range === '6mo' ? 180 : range === '1y' ? 365 : 1825;
    const data: HistoricalData[] = [];
    let price = 100 + Math.random() * 50;

    for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        const change = (Math.random() - 0.48) * 3;
        price = Math.max(50, price * (1 + change / 100));

        const high = price * (1 + Math.random() * 0.02);
        const low = price * (1 - Math.random() * 0.02);
        const open = low + Math.random() * (high - low);

        data.push({
            date,
            open,
            high,
            low,
            close: price,
            volume: Math.floor(Math.random() * 1e7 + 1e6),
        });
    }

    return data;
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
