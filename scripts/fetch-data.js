/**
 * Discover Latest - Professional Financial Platform
 * Extended Data Fetching Module
 * Supports: Taiwan Stocks, US Stocks, Indices, Commodities, Crypto, Forex
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// === Configuration ===
const CONFIG = {
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

const http = axios.create({
    timeout: CONFIG.timeout,
    headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
    }
});

// === Taiwan Stock Index ===
export async function fetchTaiwanStockIndex() {
    try {
        const today = new Date();
        const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

        const response = await http.get(`https://www.twse.com.tw/exchangeReport/FMTQIK?response=json&date=${dateStr}`);

        if (response.data && response.data.data) {
            const latestData = response.data.data[response.data.data.length - 1];
            return {
                date: latestData[0],
                volume: latestData[1],
                amount: latestData[2],
                transactions: latestData[3],
                index: latestData[4],
                change: latestData[5]
            };
        }
    } catch (error) {
        console.error('抓取台股大盤資訊失敗:', error.message);
    }
    return null;
}

// === All Taiwan Stocks (Listed) ===
export async function fetchAllStocks() {
    try {
        console.log('📡 正在請求 TWSE 所有上市股票資料...');
        const response = await http.get('https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=ALLBUT0999');

        if (response.data && response.data.data9) {
            const stocks = response.data.data9.map(row => ({
                code: row[0],
                name: row[1],
                volume: row[2],
                transactions: row[3],
                amount: row[4],
                openPrice: row[5],
                highPrice: row[6],
                lowPrice: row[7],
                closePrice: row[8],
                change: row[10],
                changeVal: row[11],
                lastBestBid: row[11],
                lastBestAsk: row[12],
                peRatio: row[15]
            }));

            console.log(`✅ 成功抓取 ${stocks.length} 檔上市股票`);
            return stocks;
        }
    } catch (error) {
        console.error('抓取台股股票失敗:', error.message);
    }
    return [];
}

// Alias for compatibility
export async function fetchTopStocks() {
    return fetchAllStocks();
}

// === US Stock Indices + VIX + DXY + SOX ===
export async function fetchUSStockIndices() {
    const indices = {
        '^DJI': { name: '道瓊工業', symbol: 'DJI', icon: '📊' },
        '^IXIC': { name: '那斯達克', symbol: 'NASDAQ', icon: '💻' },
        '^GSPC': { name: 'S&P 500', symbol: 'SPX', icon: '📈' },
        '^SOX': { name: '費城半導體', symbol: 'SOX', icon: '🔌' },
        'DX=F': { name: '美元指數', symbol: 'DXY', icon: '💵' },
        '^VIX': { name: '恐慌指數', symbol: 'VIX', icon: '😱' }
    };

    const results = [];

    for (const [symbol, info] of Object.entries(indices)) {
        try {
            const data = await fetchYahooQuote(symbol);
            if (data) {
                results.push({
                    ...info,
                    price: data.price,
                    change: data.change,
                    changePercent: data.changePercent
                });
            }
        } catch (error) {
            console.error(`抓取 ${info.name} 失敗:`, error.message);
        }
    }

    return results;
}

// === Commodities: Gold, Silver, Oil, BTC, ETH ===
export async function fetchCommodities() {
    const commodities = [
        { symbol: 'GC=F', name: '黃金', icon: '🥇' },
        { symbol: 'SI=F', name: '白銀', icon: '🥈' },
        { symbol: 'CL=F', name: '原油 WTI', icon: '🛢️' },
        { symbol: 'BZ=F', name: '布蘭特原油', icon: '🛢️' },
        { symbol: 'NG=F', name: '天然氣', icon: '🔥' },
        { symbol: 'BTC-USD', name: '比特幣', icon: '₿' },
        { symbol: 'ETH-USD', name: '以太幣', icon: 'Ξ' }
    ];

    const results = [];

    for (const commodity of commodities) {
        try {
            const data = await fetchYahooQuote(commodity.symbol);
            if (data) {
                results.push({
                    ...commodity,
                    price: data.price,
                    change: data.change,
                    changePercent: data.changePercent
                });
            }
        } catch (error) {
            console.error(`抓取 ${commodity.name} 失敗:`, error.message);
        }
    }

    return results;
}

// === US Stocks (Popular) ===
export async function fetchUSStocks() {
    const usStocks = [
        { symbol: 'AAPL', name: 'Apple', sector: '科技' },
        { symbol: 'MSFT', name: 'Microsoft', sector: '科技' },
        { symbol: 'NVDA', name: 'NVIDIA', sector: 'AI/半導體' },
        { symbol: 'GOOGL', name: 'Google', sector: '科技' },
        { symbol: 'AMZN', name: 'Amazon', sector: '電商' },
        { symbol: 'META', name: 'Meta', sector: '社群' },
        { symbol: 'TSLA', name: 'Tesla', sector: '電動車' },
        { symbol: 'TSM', name: '台積電 ADR', sector: '半導體' },
        { symbol: 'AMD', name: 'AMD', sector: '半導體' },
        { symbol: 'INTC', name: 'Intel', sector: '半導體' }
    ];

    const results = [];

    for (const stock of usStocks) {
        try {
            const data = await fetchYahooQuote(stock.symbol);
            if (data) {
                results.push({
                    code: stock.symbol,
                    name: stock.name,
                    sector: stock.sector,
                    market: 'US',
                    closePrice: data.price,
                    changePercent: parseFloat(data.changePercent),
                    openPrice: data.price, // Simplified
                    highPrice: data.price,
                    lowPrice: data.price,
                    volumeRatio: 1.0
                });
            }
        } catch (error) {
            console.error(`抓取 ${stock.name} 失敗:`, error.message);
        }
    }

    return results;
}

// === Forex (Major Pairs) ===
export async function fetchForex() {
    const pairs = [
        { symbol: 'EURUSD=X', name: 'EUR/USD', icon: '🇪🇺' },
        { symbol: 'USDJPY=X', name: 'USD/JPY', icon: '🇯🇵' },
        { symbol: 'GBPUSD=X', name: 'GBP/USD', icon: '🇬🇧' },
        { symbol: 'USDCNY=X', name: 'USD/CNY', icon: '🇨🇳' },
        { symbol: 'USDTWD=X', name: 'USD/TWD', icon: '🇹🇼' }
    ];

    const results = [];

    for (const pair of pairs) {
        try {
            const data = await fetchYahooQuote(pair.symbol);
            if (data) {
                results.push({
                    ...pair,
                    price: data.price,
                    change: data.change,
                    changePercent: data.changePercent
                });
            }
        } catch (error) {
            console.error(`抓取 ${pair.name} 失敗:`, error.message);
        }
    }

    return results;
}

// === Yahoo Finance Quote Helper ===
async function fetchYahooQuote(symbol) {
    try {
        const response = await http.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`);

        if (response.data?.chart?.result?.[0]) {
            const result = response.data.chart.result[0];
            const meta = result.meta;

            if (meta) {
                const previousClose = meta.previousClose || meta.chartPreviousClose;
                const currentPrice = meta.regularMarketPrice;
                const change = currentPrice - previousClose;
                const changePercent = (change / previousClose) * 100;

                return {
                    price: currentPrice.toFixed(2),
                    change: change.toFixed(2),
                    changePercent: changePercent.toFixed(2)
                };
            }
        }
    } catch (error) {
        // Silently fail for individual quotes
    }
    return null;
}

// === Futures Data (TAIFEX) ===
export async function fetchFuturesData() {
    try {
        const response = await http.get('https://www.taifex.com.tw/cht/3/futContractsDate');
        const $ = cheerio.load(response.data);

        let foreignData = { identity: '外資', netOI: '0' };

        $('td').each((i, el) => {
            const text = $(el).text().trim();
            if (text === '外資及陸資' || text === 'Foreign Investors') {
                const row = $(el).parent('tr');
                const cells = row.find('td');
                const netOI = $(cells[cells.length - 2]).text().trim();

                if (netOI.match(/[-0-9,]+/)) {
                    foreignData.netOI = netOI;
                }
            }
        });

        return [foreignData];
    } catch (error) {
        console.error('抓取期貨資料失敗:', error.message);
    }
    return [{ identity: '外資', netOI: 'N/A' }];
}

// === Stock Fundamentals (P/E, P/B, Yield) ===
export async function fetchStockFundamentals() {
    try {
        const response = await http.get('https://www.twse.com.tw/exchangeReport/BWIBBU_d?response=json&selectType=ALL');

        if (response.data && response.data.data) {
            const fundamentals = new Map();

            response.data.data.forEach(row => {
                const code = row[0];
                const dividendYield = parseFloat(row[2]) || 0;
                const peRatio = parseFloat(row[4].replace(/,/g, '')) || 0;
                const pbRatio = parseFloat(row[5].replace(/,/g, '')) || 0;

                fundamentals.set(code, {
                    dividendYield,
                    peRatio,
                    pbRatio
                });
            });

            return fundamentals;
        }
    } catch (error) {
        console.error('抓取個股基本面失敗:', error.message);
    }
    return new Map();
}

// === Sector Mapping ===
export function getSectorMap() {
    return {
        '2330': '半導體', '2303': '半導體', '2454': '半導體', '3711': '半導體', '3034': '半導體',
        '2379': '半導體', '3443': '半導體', '3661': '半導體', '2344': '半導體', '2408': '半導體',
        '2317': '電子代工', '2382': 'AI/雲端', '3231': 'AI/雲端', '6669': 'AI/雲端', '2356': '電子代工',
        '2357': '電腦週邊', '2376': '電腦週邊', '2301': '電腦週邊', '3017': '電腦週邊',
        '3008': '光電', '3406': '光電', '2409': '光電', '3481': '光電',
        '2345': '網通', '2412': '電信', '3045': '電信', '4904': '電信', '5388': '網通',
        '2308': '電子零組件', '2327': '被動元件', '3037': 'PCB', '2313': '電子零組件',
        '2881': '金融', '2882': '金融', '2891': '金融', '2886': '金融', '2884': '金融',
        '2885': '金融', '2892': '金融', '2880': '金融', '2883': '金融', '2890': '金融',
        '2603': '航運', '2609': '航運', '2615': '航運', '2002': '鋼鐵', '1101': '水泥',
        '1301': '塑膠', '1303': '塑膠', '1605': '電器電纜', '2207': '汽車'
    };
}

// === Finance News ===
export async function fetchFinanceNews() {
    const news = [];
    try {
        const response = await http.get('https://www.cnyes.com/');
        const $ = cheerio.load(response.data);
        $('a[href*="/news/"]').slice(0, 10).each((i, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr('href');
            if (title && title.length > 5) {
                news.push({
                    title,
                    link: link?.startsWith('http') ? link : `https://www.cnyes.com${link}`,
                    source: '鉅亨網'
                });
            }
        });
    } catch (error) {
        console.error('抓取財經新聞失敗:', error.message);
    }
    return news;
}

// === Export All ===
export default {
    fetchTaiwanStockIndex,
    fetchUSStockIndices,
    fetchCommodities,
    fetchAllStocks,
    fetchTopStocks,
    fetchUSStocks,
    fetchForex,
    fetchFuturesData,
    fetchStockFundamentals,
    getSectorMap,
    fetchFinanceNews
};
