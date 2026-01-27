/**
 * Discover Latest - Complete Taiwan Stock Market Fetcher
 * 使用 FinMind API 取得全台股清單，Yahoo Finance 取得即時報價
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// HTTP client with timeout
const http = axios.create({
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

// ========================================
// FinMind API - 取得全台股清單
// ========================================

/**
 * 從 FinMind 取得台灣全部上市櫃股票清單
 * API: https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo
 */
export async function fetchAllTaiwanStocks() {
    console.log('📡 正在從 FinMind 取得全台股清單...');

    try {
        const response = await http.get('https://api.finmindtrade.com/api/v4/data', {
            params: {
                dataset: 'TaiwanStockInfo'
            }
        });

        if (response.data && response.data.data) {
            const stocks = response.data.data;

            // 過濾只保留一般股票 (排除 ETF、權證等)
            const filteredStocks = stocks.filter(s => {
                const code = s.stock_id;
                // 一般股票通常是 4 位數字
                return /^\d{4}$/.test(code);
            });

            console.log(`✅ FinMind 回傳 ${stocks.length} 個證券，過濾後 ${filteredStocks.length} 檔股票`);

            return filteredStocks.map(s => ({
                code: s.stock_id,
                name: s.stock_name,
                industry: s.industry_category || '其他',
                type: s.type || 'stock',
                listed_date: s.date
            }));
        }
    } catch (error) {
        console.error('FinMind API 失敗:', error.message);
    }

    return [];
}

/**
 * 從 FinMind 取得每日股價資料
 */
export async function fetchDailyPrices(date) {
    const formattedDate = date || new Date().toISOString().split('T')[0];
    console.log(`📡 正在從 FinMind 取得 ${formattedDate} 股價資料...`);

    try {
        const response = await http.get('https://api.finmindtrade.com/api/v4/data', {
            params: {
                dataset: 'TaiwanStockPrice',
                start_date: formattedDate,
                end_date: formattedDate
            }
        });

        if (response.data && response.data.data) {
            const prices = response.data.data;
            console.log(`✅ FinMind 回傳 ${prices.length} 筆股價資料`);

            // 轉換成 Map 方便查詢
            const priceMap = new Map();
            prices.forEach(p => {
                priceMap.set(p.stock_id, {
                    openPrice: p.open,
                    highPrice: p.max,
                    lowPrice: p.min,
                    closePrice: p.close,
                    volume: p.Trading_Volume,
                    change: p.spread
                });
            });

            return priceMap;
        }
    } catch (error) {
        console.error('FinMind 股價 API 失敗:', error.message);
    }

    return new Map();
}

// ========================================
// Yahoo Finance - 批次取得報價
// ========================================

/**
 * 使用 Yahoo Finance 批次取得多檔股票報價
 * @param {string[]} symbols - 股票代碼陣列 (例如: ['2330.TW', '2317.TW'])
 */
export async function fetchYahooQuotes(symbols) {
    if (!symbols || symbols.length === 0) return new Map();

    // Yahoo Finance 限制每次最多 100 個 symbol
    const batchSize = 100;
    const results = new Map();

    for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const symbolsStr = batch.join(',');

        try {
            const response = await http.get('https://query1.finance.yahoo.com/v7/finance/quote', {
                params: {
                    symbols: symbolsStr,
                    fields: 'symbol,shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,trailingPE,dividendYield'
                }
            });

            if (response.data?.quoteResponse?.result) {
                response.data.quoteResponse.result.forEach(q => {
                    results.set(q.symbol, {
                        name: q.shortName || q.symbol,
                        closePrice: q.regularMarketPrice,
                        openPrice: q.regularMarketOpen,
                        highPrice: q.regularMarketDayHigh,
                        lowPrice: q.regularMarketDayLow,
                        volume: q.regularMarketVolume,
                        change: q.regularMarketChange,
                        changePercent: q.regularMarketChangePercent,
                        peRatio: q.trailingPE,
                        dividendYield: q.dividendYield
                    });
                });
            }
        } catch (error) {
            console.error(`Yahoo Finance 批次 ${i}-${i + batchSize} 失敗:`, error.message);
        }

        // 避免請求過快被封鎖
        if (i + batchSize < symbols.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log(`✅ Yahoo Finance 回傳 ${results.size} 檔股票報價`);
    return results;
}

// ========================================
// TWSE API - 備用資料來源
// ========================================

/**
 * 從證交所取得當日所有上市股票交易資料
 */
export async function fetchTWSEAllStocks() {
    console.log('📡 正在從 TWSE 取得當日交易資料...');

    try {
        const response = await http.get('https://www.twse.com.tw/exchangeReport/MI_INDEX', {
            params: {
                response: 'json',
                type: 'ALLBUT0999'
            }
        });

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
                change: row[10]
            }));

            console.log(`✅ TWSE 回傳 ${stocks.length} 檔上市股票`);
            return stocks;
        }
    } catch (error) {
        console.error('TWSE API 失敗:', error.message);
    }

    return [];
}

/**
 * 從櫃買中心取得當日所有上櫃股票交易資料
 */
export async function fetchTPExAllStocks() {
    console.log('📡 正在從 TPEx 取得當日上櫃交易資料...');

    const today = new Date();
    const formattedDate = `${today.getFullYear() - 1911}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

    try {
        const response = await http.get('https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php', {
            params: {
                l: 'zh-tw',
                d: formattedDate,
                se: 'EW'
            }
        });

        if (response.data && response.data.aaData) {
            const stocks = response.data.aaData.map(row => ({
                code: row[0],
                name: row[1],
                closePrice: row[2],
                change: row[3],
                openPrice: row[4],
                highPrice: row[5],
                lowPrice: row[6],
                volume: row[7]
            }));

            console.log(`✅ TPEx 回傳 ${stocks.length} 檔上櫃股票`);
            return stocks;
        }
    } catch (error) {
        console.error('TPEx API 失敗:', error.message);
    }

    return [];
}

// ========================================
// 台股大盤指數
// ========================================

export async function fetchTaiwanStockIndex() {
    try {
        const response = await http.get('https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=IND');

        if (response.data && response.data.data1) {
            const indexData = response.data.data1.find(row => row[0] === '發行量加權股價指數');
            if (indexData) {
                return {
                    name: '加權指數',
                    index: indexData[1],
                    change: indexData[2],
                    amount: response.data.data5?.[0]?.[2] || 'N/A'
                };
            }
        }
    } catch (error) {
        console.error('取得台股指數失敗:', error.message);
    }
    return null;
}

// ========================================
// 美股與國際市場 (Yahoo Finance)
// ========================================

export async function fetchUSStockIndices() {
    const indices = [
        { symbol: '^DJI', name: '道瓊工業指數' },
        { symbol: '^IXIC', name: 'NASDAQ' },
        { symbol: '^GSPC', name: 'S&P 500' },
        { symbol: '^SOX', name: '費城半導體' },
        { symbol: '^VIX', name: 'VIX 恐慌指數' },
        { symbol: 'DX-Y.NYB', name: 'DXY 美元指數' }
    ];

    const symbols = indices.map(i => i.symbol).join(',');

    try {
        const response = await http.get('https://query1.finance.yahoo.com/v7/finance/quote', {
            params: { symbols }
        });

        if (response.data?.quoteResponse?.result) {
            return response.data.quoteResponse.result.map(q => {
                const indexInfo = indices.find(i => i.symbol === q.symbol);
                return {
                    symbol: q.symbol.replace('^', ''),
                    name: indexInfo?.name || q.shortName,
                    price: q.regularMarketPrice?.toFixed(2) || 'N/A',
                    changePercent: q.regularMarketChangePercent?.toFixed(2) || '0'
                };
            });
        }
    } catch (error) {
        console.error('取得美股指數失敗:', error.message);
    }
    return [];
}

export async function fetchCommodities() {
    const commodities = [
        { symbol: 'GC=F', name: '黃金', icon: '🥇' },
        { symbol: 'SI=F', name: '白銀', icon: '🥈' },
        { symbol: 'CL=F', name: '原油', icon: '🛢️' },
        { symbol: 'NG=F', name: '天然氣', icon: '🔥' },
        { symbol: 'BTC-USD', name: 'Bitcoin', icon: '₿' },
        { symbol: 'ETH-USD', name: 'Ethereum', icon: 'Ξ' }
    ];

    const symbols = commodities.map(c => c.symbol).join(',');

    try {
        const response = await http.get('https://query1.finance.yahoo.com/v7/finance/quote', {
            params: { symbols }
        });

        if (response.data?.quoteResponse?.result) {
            return response.data.quoteResponse.result.map(q => {
                const info = commodities.find(c => c.symbol === q.symbol);
                return {
                    symbol: q.symbol,
                    name: info?.name || q.shortName,
                    icon: info?.icon || '💰',
                    price: q.regularMarketPrice?.toFixed(2) || 'N/A',
                    changePercent: q.regularMarketChangePercent?.toFixed(2) || '0'
                };
            });
        }
    } catch (error) {
        console.error('取得商品報價失敗:', error.message);
    }
    return [];
}

// ========================================
// 股票基本面資料
// ========================================

export async function fetchStockFundamentals() {
    const fundamentals = new Map();

    try {
        const response = await http.get('https://www.twse.com.tw/exchangeReport/BWIBBU_d?response=json&selectType=ALL');

        if (response.data && response.data.data) {
            response.data.data.forEach(row => {
                fundamentals.set(row[0], {
                    peRatio: parseFloat(row[4]) || null,
                    pbRatio: parseFloat(row[5]) || null,
                    dividendYield: parseFloat(row[2]) || null
                });
            });
            console.log(`✅ 取得 ${fundamentals.size} 檔股票基本面資料`);
        }
    } catch (error) {
        console.error('取得基本面資料失敗:', error.message);
    }

    return fundamentals;
}

// ========================================
// 外資期貨籌碼
// ========================================

export async function fetchFuturesData() {
    try {
        const response = await http.get('https://www.taifex.com.tw/cht/3/futContractsDate');
        const $ = cheerio.load(response.data);

        const result = [];
        $('table.table_f tbody tr').each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 11) {
                const identity = $(cells[0]).text().trim();
                if (identity.includes('外資')) {
                    result.push({
                        identity: '外資',
                        longOI: $(cells[9]).text().trim(),
                        shortOI: $(cells[10]).text().trim(),
                        netOI: $(cells[11]).text().trim()
                    });
                }
            }
        });

        return result;
    } catch (error) {
        console.error('取得期貨籌碼失敗:', error.message);
    }
    return [];
}

// ========================================
// 財經新聞
// ========================================

export async function fetchFinanceNews() {
    try {
        const response = await http.get('https://www.cnyes.com/twstock/news/headline');
        const $ = cheerio.load(response.data);

        const news = [];
        $('a[href*="/news/id/"]').each((i, elem) => {
            if (news.length >= 10) return false;

            const title = $(elem).text().trim();
            const href = $(elem).attr('href');

            if (title && href) {
                news.push({
                    title: title,
                    url: href.startsWith('http') ? href : `https://www.cnyes.com${href}`
                });
            }
        });

        return news;
    } catch (error) {
        console.error('取得新聞失敗:', error.message);
    }
    return [];
}

// ========================================
// 產業對照表
// ========================================

export function getSectorMap() {
    return {
        '2330': '半導體', '2454': '半導體', '3034': '半導體', '2303': '半導體',
        '3711': '半導體', '2379': '半導體', '3443': '半導體', '3661': '半導體',
        '2344': '半導體', '2408': '半導體', '2327': '半導體', '3037': '半導體',
        '2317': '電子組裝', '2382': 'AI/雲端', '6669': 'AI/雲端', '2345': '網通',
        '2308': '電子零組件', '2357': '電腦週邊', '2356': '電腦週邊',
        '2301': '電子零組件', '2376': '電腦週邊', '3017': '散熱',
        '2881': '金融', '2882': '金融', '2884': '金融', '2885': '金融',
        '2886': '金融', '2890': '金融', '2891': '金融', '2892': '金融',
        '2880': '金融', '2883': '金融',
        '2603': '航運', '2609': '航運', '2615': '航運',
        '1101': '水泥', '1301': '塑膠', '1303': '塑膠',
        '2002': '鋼鐵', '1605': '電線電纜',
        '2412': '電信', '3045': '電信', '4904': '電信',
        '2207': '汽車', '3008': '光學', '3406': '光學',
        '2409': '面板', '3481': '面板'
    };
}

// ========================================
// 主要匯出 (兼容舊版)
// ========================================

export async function fetchAllStocks() {
    // 優先使用 TWSE + TPEx API
    const twseStocks = await fetchTWSEAllStocks();
    const tpexStocks = await fetchTPExAllStocks();

    // 合併上市 + 上櫃
    const allStocks = [
        ...twseStocks.map(s => ({ ...s, market: '上市' })),
        ...tpexStocks.map(s => ({ ...s, market: '上櫃' }))
    ];

    console.log(`📊 合併後共 ${allStocks.length} 檔股票 (上市 ${twseStocks.length} + 上櫃 ${tpexStocks.length})`);

    return allStocks;
}

export default {
    fetchAllTaiwanStocks,
    fetchDailyPrices,
    fetchYahooQuotes,
    fetchTWSEAllStocks,
    fetchTPExAllStocks,
    fetchAllStocks,
    fetchTaiwanStockIndex,
    fetchUSStockIndices,
    fetchCommodities,
    fetchStockFundamentals,
    fetchFuturesData,
    fetchFinanceNews,
    getSectorMap
};
