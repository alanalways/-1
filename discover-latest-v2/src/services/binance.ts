/**
 * 幣安 API 服務
 * 使用幣安公開 API 取得加密貨幣即時資料
 */

// 幣安 API 基礎 URL
const BINANCE_API = 'https://api.binance.com/api/v3';

// 支援的交易對
export const SUPPORTED_SYMBOLS = [
    { symbol: 'BTCUSDT', name: 'Bitcoin', displaySymbol: 'BTC', icon: '₿' },
    { symbol: 'ETHUSDT', name: 'Ethereum', displaySymbol: 'ETH', icon: 'Ξ' },
    { symbol: 'BNBUSDT', name: 'BNB', displaySymbol: 'BNB', icon: '◆' },
    { symbol: 'SOLUSDT', name: 'Solana', displaySymbol: 'SOL', icon: '◎' },
    { symbol: 'XRPUSDT', name: 'XRP', displaySymbol: 'XRP', icon: '✕' },
    { symbol: 'ADAUSDT', name: 'Cardano', displaySymbol: 'ADA', icon: '₳' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin', displaySymbol: 'DOGE', icon: '🐕' },
    { symbol: 'AVAXUSDT', name: 'Avalanche', displaySymbol: 'AVAX', icon: '🔺' },
];

export interface CryptoPrice {
    symbol: string;
    name: string;
    displaySymbol: string;
    icon: string;
    price: number;
    priceChange: number;
    priceChangePercent: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    quoteVolume24h: number;  // USDT 成交額
}

export interface CryptoKline {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
}

/**
 * 取得單一交易對的 24 小時價格變化
 */
export async function get24hrTicker(symbol: string): Promise<any> {
    try {
        const response = await fetch(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`);
        if (!response.ok) throw new Error('Failed to fetch ticker');
        return await response.json();
    } catch (error) {
        console.error(`[Binance] 取得 ${symbol} 失敗:`, error);
        return null;
    }
}

/**
 * 取得所有支援的加密貨幣價格
 */
export async function getAllCryptoPrices(): Promise<CryptoPrice[]> {
    try {
        const symbols = SUPPORTED_SYMBOLS.map(s => s.symbol);
        const symbolsParam = JSON.stringify(symbols);

        const response = await fetch(
            `${BINANCE_API}/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`
        );

        if (!response.ok) throw new Error('Failed to fetch tickers');

        const data = await response.json();

        return data.map((ticker: any) => {
            const symbolInfo = SUPPORTED_SYMBOLS.find(s => s.symbol === ticker.symbol);
            return {
                symbol: ticker.symbol,
                name: symbolInfo?.name || ticker.symbol,
                displaySymbol: symbolInfo?.displaySymbol || ticker.symbol.replace('USDT', ''),
                icon: symbolInfo?.icon || '🪙',
                price: parseFloat(ticker.lastPrice),
                priceChange: parseFloat(ticker.priceChange),
                priceChangePercent: parseFloat(ticker.priceChangePercent),
                high24h: parseFloat(ticker.highPrice),
                low24h: parseFloat(ticker.lowPrice),
                volume24h: parseFloat(ticker.volume),
                quoteVolume24h: parseFloat(ticker.quoteVolume),
            };
        });
    } catch (error) {
        console.error('[Binance] 取得所有價格失敗:', error);
        return [];
    }
}

/**
 * 取得 K 線資料
 * @param symbol 交易對（如 BTCUSDT）
 * @param interval 時間間隔（1m, 5m, 15m, 1h, 4h, 1d, 1w）
 * @param limit 資料筆數（最多 1000）
 */
export async function getKlines(
    symbol: string,
    interval: string = '1d',
    limit: number = 100
): Promise<CryptoKline[]> {
    try {
        const response = await fetch(
            `${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
        );

        if (!response.ok) throw new Error('Failed to fetch klines');

        const data = await response.json();

        return data.map((kline: any[]) => ({
            openTime: kline[0],
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
            volume: parseFloat(kline[5]),
            closeTime: kline[6],
        }));
    } catch (error) {
        console.error(`[Binance] 取得 ${symbol} K 線失敗:`, error);
        return [];
    }
}

/**
 * 取得最新成交價格（輕量級）
 */
export async function getLatestPrice(symbol: string): Promise<number | null> {
    try {
        const response = await fetch(`${BINANCE_API}/ticker/price?symbol=${symbol}`);
        if (!response.ok) throw new Error('Failed to fetch price');
        const data = await response.json();
        return parseFloat(data.price);
    } catch (error) {
        console.error(`[Binance] 取得 ${symbol} 價格失敗:`, error);
        return null;
    }
}

/**
 * 格式化成交量
 */
export function formatVolume(volume: number): string {
    if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
    if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
    if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
    return volume.toFixed(2);
}

/**
 * 格式化價格
 */
export function formatPrice(price: number): string {
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
}
