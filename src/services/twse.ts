/**
 * TWSE 台灣證券交易所 API 服務
 * 使用開放資料取得台股資訊（資料約延遲 20 分鐘）
 */

// TWSE 開放資料 API
const TWSE_API = 'https://www.twse.com.tw';

export interface TwseStock {
    code: string;           // 股票代號
    name: string;           // 股票名稱
    tradeVolume: number;    // 成交股數
    tradeValue: number;     // 成交金額
    openingPrice: number;   // 開盤價
    highestPrice: number;   // 最高價
    lowestPrice: number;    // 最低價
    closingPrice: number;   // 收盤價
    change: number;         // 漲跌
    changePercent: number;  // 漲跌幅 %
    transaction: number;    // 成交筆數
}

export interface TwseMarketInfo {
    date: string;
    totalVolume: number;
    totalValue: number;
    transaction: number;
    taiex: number;          // 加權指數
    taiexChange: number;    // 指數漲跌
}

/**
 * 取得當日所有上市股票行情
 * 注意：此 API 有 CORS 限制，需透過後端代理
 */
export async function getAllStocks(): Promise<TwseStock[]> {
    try {
        // 不傳入日期，讓 API 自動判斷最近的交易日
        // 這樣盤後/開盤前都能取得最新資料
        const response = await fetch('/api/twse/stocks');

        if (!response.ok) {
            throw new Error(`TWSE API 回應錯誤: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'TWSE API 回傳失敗');
        }

        if (!data.stocks || data.stocks.length === 0) {
            throw new Error('目前無股票資料，可能為非交易時間');
        }

        return data.stocks;
    } catch (error) {
        console.error('[TWSE] 取得股票資料失敗:', error);
        throw error;
    }
}

/**
 * 取得熱門股票（成交量前 20）
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
