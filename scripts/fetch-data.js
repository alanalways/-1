/**
 * 台股每日市場分析報告 - 資料抓取腳本
 * 從各大財經網站抓取最新市場資訊
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// === 設定 ===
const CONFIG = {
    timeout: 10000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

// === HTTP 客戶端 ===
const http = axios.create({
    timeout: CONFIG.timeout,
    headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'application/json, text/html',
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
 * 取得美股三大指數
 * 資料來源：Yahoo Finance
 */
export async function fetchUSStockIndices() {
    const indices = {
        '^DJI': { name: '道瓊工業指數', symbol: 'DJI' },
        '^IXIC': { name: '那斯達克指數', symbol: 'NASDAQ' },
        '^GSPC': { name: 'S&P 500', symbol: 'SPX' }
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
 * 取得台股熱門股票清單
 * 資料來源：TWSE 成交量排行
 */
export async function fetchTopStocks() {
    try {
        const response = await http.get('https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=ALLBUT0999');

        if (response.data?.data9) {
            const stocks = response.data.data9.slice(0, 50).map(row => ({
                code: row[0],
                name: row[1],
                volume: row[2],
                transactions: row[3],
                openPrice: row[5],
                highPrice: row[6],
                lowPrice: row[7],
                closePrice: row[8],
                change: row[10],
                lastBestBid: row[11],
                lastBestAsk: row[12]
            }));
            return stocks;
        }
    } catch (error) {
        console.error('抓取台股熱門股票失敗:', error.message);
    }
    return [];
}

/**
 * 取得外資期貨留倉資訊
 */
/**
 * 取得外資期貨留倉資訊 (精確版)
 */
export async function fetchFuturesData() {
    try {
        const response = await http.get('https://www.taifex.com.tw/cht/3/futContractsDate');
        const $ = cheerio.load(response.data);

        // 嘗試抓取「外資」的列
        let foreignData = { identity: '外資', netOI: '0' };

        // 搜尋含有 "外資" 或 "Foreign Investors" 的儲存格
        $('td').each((i, el) => {
            const text = $(el).text().trim();
            if (text === '外資及陸資' || text === 'Foreign Investors') {
                // 通常後面的欄位包含多空數據，這裡嘗試抓取同一列的後續數據
                // 注意：期交所網頁結構可能會變，這裡做一個簡單的相對位置抓取
                // 假設結構是 Table Row，找到該 td 的 parent tr
                const row = $(el).parent('tr');
                const cells = row.find('td');

                // 根據期交所通常格式：身分(0), 多方口數, 多方金額, 空方口數, 空方金額, 淨口數(最後或倒數)
                // 這裡嘗試抓取最後幾個欄位作為淨口數
                const netOI = decodeURIComponent($(cells[cells.length - 2]).text().trim()); // 倒數第二欄通常是淨口數
                if (netOI && netOI.match(/[-0-9,]+/)) {
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
            // 資料格式: [證券代號, 證券名稱, 殖利率(%), 股利年度, 本益比, 股價淨值比, 財報年/季]
            // 轉換為 Map 以便快速查詢: code -> { peRatio, pbRatio, dividendYield }
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
 * 取得台股產業分類對照表 (靜態映射)
 */
export function getSectorMap() {
    return {
        // 半導體
        '2330': '半導體', '2303': '半導體', '2454': '半導體', '3711': '半導體', '3034': '半導體',
        '2379': '半導體', '3443': '半導體', '3661': '半導體', '2344': '半導體', '2408': '半導體',
        // AI / 電腦週邊
        '2317': '電子代工', '2382': 'AI/雲端', '3231': 'AI/雲端', '6669': 'AI/雲端', '2356': '電子代工',
        '2357': '電腦週邊', '2376': '電腦週邊', '2301': '電腦週邊', '3017': '電腦週邊',
        // 光電
        '3008': '光電', '3406': '光電', '2409': '光電', '3481': '光電',
        // 通訊
        '2345': '網通', '2412': '電信', '3045': '電信', '4904': '電信', '5388': '網通',
        // 電子零組件
        '2308': '電子零組件', '2327': '被動元件', '3037': 'PCB', '2313': '電子零組件',
        // 金融
        '2881': '金融', '2882': '金融', '2891': '金融', '2886': '金融', '2884': '金融',
        '2885': '金融', '2892': '金融', '2880': '金融', '2883': '金融', '2890': '金融',
        // 航運 / 傳產
        '2603': '航運', '2609': '航運', '2615': '航運', '2002': '鋼鐵', '1101': '水泥',
        '1301': '塑膠', '1303': '塑膠', '1605': '電器電纜', '2207': '汽車'
    };
}

export async function fetchFinanceNews() {
    const news = [];

    try {
        // 嘗試從鉅亨網取得新聞
        const response = await http.get('https://www.cnyes.com/');
        const $ = cheerio.load(response.data);

        // 解析新聞標題
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
    fetchTopStocks,
    fetchFuturesData,
    fetchStockFundamentals,
    getSectorMap,
    fetchFinanceNews
};
