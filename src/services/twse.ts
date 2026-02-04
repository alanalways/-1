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
        // 使用 CORS proxy 或後端 API
        const today = new Date();
        const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

        // 直接使用 TWSE API（可能需要後端代理）
        const response = await fetch(`/api/twse/stocks?date=${dateStr}`);

        if (!response.ok) {
            // 如果 API 失敗，返回模擬資料
            console.warn('[TWSE] API 失敗，使用模擬資料');
            return getMockStocks();
        }

        const data = await response.json();
        return data.stocks || [];
    } catch (error) {
        console.error('[TWSE] 取得股票資料失敗:', error);
        return getMockStocks();
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
 * 模擬台股資料（當 API 無法使用時）
 */
function getMockStocks(): TwseStock[] {
    const mockData: TwseStock[] = [
        { code: '2330', name: '台積電', tradeVolume: 25483210, tradeValue: 28531247000, openingPrice: 1115, highestPrice: 1125, lowestPrice: 1110, closingPrice: 1120, change: 10, changePercent: 0.90, transaction: 45231 },
        { code: '2317', name: '鴻海', tradeVolume: 35421870, tradeValue: 7084374000, openingPrice: 198, highestPrice: 201, lowestPrice: 197, closingPrice: 200, change: 3, changePercent: 1.52, transaction: 28156 },
        { code: '2454', name: '聯發科', tradeVolume: 8541230, tradeValue: 11903514900, openingPrice: 1385, highestPrice: 1400, lowestPrice: 1380, closingPrice: 1395, change: 15, changePercent: 1.09, transaction: 18542 },
        { code: '2412', name: '中華電', tradeVolume: 5412360, tradeValue: 648883200, openingPrice: 119, highestPrice: 120, lowestPrice: 118, closingPrice: 120, change: 1, changePercent: 0.84, transaction: 8541 },
        { code: '2881', name: '富邦金', tradeVolume: 18542360, tradeValue: 1668812400, openingPrice: 89, highestPrice: 90.5, lowestPrice: 88.5, closingPrice: 90, change: 1.5, changePercent: 1.69, transaction: 15423 },
        { code: '2882', name: '國泰金', tradeVolume: 15423650, tradeValue: 925419000, openingPrice: 59.5, highestPrice: 60.5, lowestPrice: 59, closingPrice: 60, change: 0.8, changePercent: 1.35, transaction: 12365 },
        { code: '2303', name: '聯電', tradeVolume: 42365120, tradeValue: 2330081600, openingPrice: 54.5, highestPrice: 55.5, lowestPrice: 54, closingPrice: 55, change: 0.8, changePercent: 1.48, transaction: 25412 },
        { code: '3711', name: '日月光投控', tradeVolume: 12541230, tradeValue: 2132809100, openingPrice: 168, highestPrice: 171, lowestPrice: 167, closingPrice: 170, change: 3, changePercent: 1.80, transaction: 14523 },
        { code: '2308', name: '台達電', tradeVolume: 6541250, tradeValue: 2747325000, openingPrice: 418, highestPrice: 422, lowestPrice: 416, closingPrice: 420, change: 5, changePercent: 1.20, transaction: 9852 },
        { code: '1301', name: '台塑', tradeVolume: 8541236, tradeValue: 495392888, openingPrice: 57.5, highestPrice: 58.5, lowestPrice: 57, closingPrice: 58, change: 0.8, changePercent: 1.40, transaction: 7541 },
        { code: '1303', name: '南亞', tradeVolume: 7541236, tradeValue: 437392692, openingPrice: 57.5, highestPrice: 58.5, lowestPrice: 57, closingPrice: 58, change: -0.5, changePercent: -0.85, transaction: 6541 },
        { code: '2886', name: '兆豐金', tradeVolume: 14523650, tradeValue: 639040600, openingPrice: 43.5, highestPrice: 44.5, lowestPrice: 43, closingPrice: 44, change: 0.5, changePercent: 1.15, transaction: 11254 },
        { code: '2891', name: '中信金', tradeVolume: 22541360, tradeValue: 744864880, openingPrice: 32.8, highestPrice: 33.5, lowestPrice: 32.5, closingPrice: 33, change: 0.3, changePercent: 0.92, transaction: 16542 },
        { code: '2892', name: '第一金', tradeVolume: 18542360, tradeValue: 537728440, openingPrice: 28.8, highestPrice: 29.2, lowestPrice: 28.5, closingPrice: 29, change: 0.3, changePercent: 1.05, transaction: 13254 },
        { code: '3008', name: '大立光', tradeVolume: 1254123, tradeValue: 2947186305, openingPrice: 2340, highestPrice: 2360, lowestPrice: 2330, closingPrice: 2350, change: 20, changePercent: 0.86, transaction: 5412 },
        { code: '2002', name: '中鋼', tradeVolume: 35412360, tradeValue: 813484280, openingPrice: 22.8, highestPrice: 23.2, lowestPrice: 22.5, closingPrice: 23, change: 0.3, changePercent: 1.32, transaction: 18542 },
        { code: '1216', name: '統一', tradeVolume: 8541236, tradeValue: 597686520, openingPrice: 69.5, highestPrice: 70.5, lowestPrice: 69, closingPrice: 70, change: 0.8, changePercent: 1.16, transaction: 7854 },
        { code: '2912', name: '統一超', tradeVolume: 3254123, tradeValue: 936436236, openingPrice: 286, highestPrice: 290, lowestPrice: 285, closingPrice: 288, change: 4, changePercent: 1.41, transaction: 4521 },
        { code: '2357', name: '華碩', tradeVolume: 4521360, tradeValue: 2531161600, openingPrice: 558, highestPrice: 565, lowestPrice: 555, closingPrice: 560, change: 8, changePercent: 1.45, transaction: 6254 },
        { code: '2382', name: '廣達', tradeVolume: 12541230, tradeValue: 4140614490, openingPrice: 328, highestPrice: 333, lowestPrice: 326, closingPrice: 330, change: 5, changePercent: 1.54, transaction: 14523 },
    ];

    // 隨機調整價格模擬即時變化
    return mockData.map(stock => ({
        ...stock,
        closingPrice: stock.closingPrice * (0.98 + Math.random() * 0.04),
        change: stock.change * (0.5 + Math.random()),
        changePercent: stock.changePercent * (0.5 + Math.random()),
        tradeVolume: Math.floor(stock.tradeVolume * (0.8 + Math.random() * 0.4)),
    }));
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
