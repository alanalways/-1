/**
 * TWSE/TPEX 台灣股票服務
 * 透過後端 API 取得真實資料（使用官方 OpenAPI）
 */

export interface TwseStock {
    code: string;
    name: string;
    tradeVolume: number;
    tradeValue: number;
    openingPrice: number;
    highestPrice: number;
    lowestPrice: number;
    closingPrice: number;
    change: number;
    changePercent: number;
    transaction: number;
    market?: 'twse' | 'tpex';
}

/**
 * 取得所有上市上櫃股票行情
 */
export async function getAllStocks(): Promise<TwseStock[]> {
    try {
        const response = await fetch('/api/twse/stocks', {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`API 回應錯誤: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '無法取得資料');
        }

        console.log(`[TWSE Service] 取得 ${data.stocks?.length || 0} 筆資料 (來源: ${data.source})`);
        return data.stocks || [];
    } catch (error) {
        console.error('[TWSE Service] 取得股票資料失敗:', error);
        throw error;
    }
}

/**
 * 取得熱門股票（成交量前 N）
 */
export async function getTopVolume(limit: number = 20): Promise<TwseStock[]> {
    const stocks = await getAllStocks();
    return stocks
        .sort((a, b) => b.tradeVolume - a.tradeVolume)
        .slice(0, limit);
}

/**
 * 取得漲幅排行
 */
export async function getTopGainers(limit: number = 10): Promise<TwseStock[]> {
    const stocks = await getAllStocks();
    return stocks
        .filter(s => s.changePercent > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, limit);
}

/**
 * 取得跌幅排行
 */
export async function getTopLosers(limit: number = 10): Promise<TwseStock[]> {
    const stocks = await getAllStocks();
    return stocks
        .filter(s => s.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, limit);
}

/**
 * 搜尋股票
 */
export async function searchStocks(query: string): Promise<TwseStock[]> {
    const stocks = await getAllStocks();
    const q = query.toLowerCase();
    return stocks.filter(s =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
    );
}

/**
 * 格式化股票價格
 */
export function formatStockPrice(price: number): string {
    return price.toFixed(2);
}

/**
 * 格式化成交量
 */
export function formatStockVolume(volume: number): string {
    if (volume >= 1e8) return (volume / 1e8).toFixed(2) + '億';
    if (volume >= 1e4) return (volume / 1e4).toFixed(0) + '萬';
    return volume.toLocaleString();
}

/**
 * 判斷漲跌顏色
 */
export function getChangeColor(change: number): string {
    if (change > 0) return 'var(--stock-up)';
    if (change < 0) return 'var(--stock-down)';
    return 'var(--stock-neutral)';
}
