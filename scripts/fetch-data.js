/**
 * 台股每日市場分析報告 - 資料抓取腳本
 * 從各大財經網站抓取最新市場資訊
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// === 設定 ===
const CONFIG = {
    timeout: 30000, // 增加 timeout 開啟全市場掃描
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// === HTTP 客戶端 ===
const http = axios.create({
    timeout: CONFIG.timeout,
    headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
    }
});

/**
 * 取得台股大盤資訊
 * 資料來源：TWSE API
 */
export async function fetchTaiwanStockIndex() {
    try {
        // TWSE 每日成交資訊
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

/**
 * 取得全台股市場股票清單 (上市)
 * 資料來源：TWSE MI_INDEX
 * 備註：這個 API 會回傳所有上市股票
 */
export async function fetchAllStocks() {
    try {
        console.log('📡 正在請求 TWSE 所有上市股票資料...');
        const response = await http.get('https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=ALLBUT0999');

        if (response.data && response.data.data9) {
            // data9 包含所有個股收盤資訊
            const stocks = response.data.data9.map(row => ({
                code: row[0],
                name: row[1],
                volume: row[2], // 成交股數
                transactions: row[3], // 成交筆數
                amount: row[4], // 成交金額
                openPrice: row[5],
                highPrice: row[6],
                lowPrice: row[7],
                closePrice: row[8],
                change: row[10], // 漲跌(+/-)
                changeVal: row[11], // 漲跌價差
                lastBestBid: row[11],
                lastBestAsk: row[12],
                peRatio: row[15] // 本益比 (部分回應會有，若沒有則依賴 BWIBBU)
            }));

            console.log(`✅ 成功抓取 ${stocks.length} 檔上市股票`);
            return stocks;
        }
    } catch (error) {
        console.error('抓取台股股票失敗:', error.message);
    }
    return [];
}

/**
 * 取得台股熱門股票清單 (兼容舊版函數)
 */
export async function fetchTopStocks() {
    return fetchAllStocks(); // 直接轉送
}

/**
 * 取得美股三大指數 + 關鍵指標 (DXY, VIX)
 * 資料來源：Yahoo Finance
 */
export async function fetchUSStockIndices() {
    const indices = {
        '^DJI': { name: '道瓊工業', symbol: 'DJI' },
        '^IXIC': { name: '那斯達克', symbol: 'NASDAQ' },
        '^GSPC': { name: 'S&P 500', symbol: 'SPX' },
        '^SOX': { name: '費城半導體', symbol: 'SOX' },
        'DX=F': { name: '美元指數', symbol: 'DXY' },
        '^VIX': { name: '恐慌指數', symbol: 'VIX' }
    };

    const results = [];

    for (const [symbol, info] of Object.entries(indices)) {
        try {
            const response = await http.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`);

            if (response.data?.chart?.result?.[0]) {
                const result = response.data.chart.result[0];
                const meta = result.meta;
                const quote = result.indicators?.quote?.[0];

                if (meta && quote) {
                    const previousClose = meta.previousClose || meta.chartPreviousClose;
                    const currentPrice = meta.regularMarketPrice;
                    const change = currentPrice - previousClose;
                    const changePercent = (change / previousClose) * 100;

                    results.push({
                        name: info.name,
                        symbol: info.symbol,
                        price: currentPrice.toFixed(2),
                        change: change.toFixed(2),
                        changePercent: changePercent.toFixed(2)
                    });
                }
            }
        } catch (error) {
            console.error(`抓取 ${info.name} 失敗:`, error.message);
        }
    }

    return results;
}

/**
 * 取得重金屬與期貨價格
 */
export async function fetchCommodities() {
    const commodities = [
        { symbol: 'GC=F', name: '黃金', icon: '🥇' },
        { symbol: 'SI=F', name: '白銀', icon: '🥈' },
        { symbol: 'CL=F', name: '原油', icon: '🛢️' },
        { symbol: 'BTC-USD', name: '比特幣', icon: '₿' }
    ];

    const results = [];

    for (const commodity of commodities) {
        try {
            const response = await http.get(`https://query1.finance.yahoo.com/v8/finance/chart/${commodity.symbol}?interval=1d`);

            if (response.data?.chart?.result?.[0]) {
                const meta = response.data.chart.result[0].meta;
                const previousClose = meta.previousClose || meta.chartPreviousClose;
                const currentPrice = meta.regularMarketPrice;
                const change = currentPrice - previousClose;
                const changePercent = (change / previousClose) * 100;

                results.push({
                    ...commodity,
                    price: currentPrice.toFixed(2),
                    change: change.toFixed(2),
                    changePercent: changePercent.toFixed(2)
                });
            }
        } catch (error) {
            console.error(`抓取 ${commodity.name} 失敗:`, error.message);
        }
    }

    return results;
}

/**
 * 取得外資期貨留倉資訊 (精確版)
 */
export async function fetchFuturesData() {
    try {
        const response = await http.get('https://www.taifex.com.tw/cht/3/futContractsDate');
        const $ = cheerio.load(response.data);

        let foreignData = { identity: '外資', netOI: '0' };

        // 搜尋含有 "外資" 或 "Foreign Investors" 的儲存格
        $('td').each((i, el) => {
            const text = $(el).text().trim();
            if (text === '外資及陸資' || text === 'Foreign Investors') {
                const row = $(el).parent('tr');
                const cells = row.find('td');
                // 淨口數通常在倒數第3個或第2個，嘗試抓取含數字和逗號的那個
                // 這裡簡化抓取倒數第二個
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

/**
 * 取得個股基本面資料 (本益比、殖利率、股價淨值比)
 * 資料來源：TWSE BWIBBU
 */
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

/**
 * 取得台股產業分類對照表
 */
export function getSectorMap() {
    return {
        '2330': '半導體', '2303': '半導體', '2454': '半導體', '3711': '半導體', '3034': '半導體',
        '2317': '電子代工', '2382': 'AI/雲端', '3231': 'AI/雲端', '6669': 'AI/雲端', '2356': '電子代工',
        '3008': '光電', '3406': '光電', '2409': '光電', '3481': '光電',
        '2345': '網通', '2412': '電信', '3045': '電信', '4904': '電信',
        '2881': '金融', '2882': '金融', '2891': '金融', '2886': '金融', '2603': '航運'
    };
}

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

// === 匯出所有函數 ===
export default {
    fetchTaiwanStockIndex,
    fetchUSStockIndices,
    fetchCommodities,
    fetchAllStocks,
    fetchTopStocks,
    fetchFuturesData,
    fetchStockFundamentals,
    getSectorMap,
    fetchFinanceNews
};
