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

            // 過濾保留一般股票和 ETF (4-6 位數字)
            const filteredStocks = stocks.filter(s => {
                const code = s.stock_id;
                // 允許 4-6 位數股票（包含 ETF 如 0050, 00940）
                return /^\d{4,6}$/.test(code);
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
 * 使用 STOCK_DAY_ALL API (股價) + BWIBBU_d API (基本面)
 */
export async function fetchTWSEAllStocks() {
    console.log('📡 正在從 TWSE 取得全部上市股票資料...');

    try {
        // 1. 先抓股價資料 (STOCK_DAY_ALL)
        const priceResponse = await http.get('https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL', {
            params: { response: 'open_data' },
            timeout: 60000
        });

        // 2. 再抓基本面資料 (OpenAPI - 本益比、殖利率)
        const fundResponse = await http.get('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d', {
            timeout: 30000
        });

        // 解析股價資料
        const priceMap = new Map();
        if (priceResponse.data) {
            const lines = priceResponse.data.split('\n');
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
                const code = cols[1];
                if (!/^\d{4,6}$/.test(code)) continue;

                const parseNum = (str) => {
                    if (!str || str === '--' || str === '') return 0;
                    return parseFloat(str.replace(/,/g, '')) || 0;
                };

                priceMap.set(code, {
                    date: cols[0],
                    volume: parseNum(cols[3]),
                    tradeValue: parseNum(cols[4]),
                    openPrice: parseNum(cols[5]),
                    highPrice: parseNum(cols[6]),
                    lowPrice: parseNum(cols[7]),
                    closePrice: parseNum(cols[8]),
                    change: parseNum(cols[9]),
                    transactions: parseNum(cols[10])
                });
            }
        }
        console.log(`   📈 股價資料: ${priceMap.size} 檔`);

        // 解析基本面資料並合併
        const stocks = [];
        if (fundResponse.data && Array.isArray(fundResponse.data)) {
            for (const item of fundResponse.data) {
                const code = item.Code;
                if (!/^\d{4,6}$/.test(code)) continue;

                const priceData = priceMap.get(code) || {};

                stocks.push({
                    code: code,
                    name: item.Name,
                    closePrice: priceData.closePrice || 0,
                    openPrice: priceData.openPrice || 0,
                    highPrice: priceData.highPrice || 0,
                    lowPrice: priceData.lowPrice || 0,
                    volume: priceData.volume || 0,
                    tradeValue: priceData.tradeValue || 0,
                    change: priceData.change || 0,
                    transactions: priceData.transactions || 0,
                    peRatio: parseFloat(item.PEratio) || null,
                    pbRatio: parseFloat(item.PBratio) || null,
                    dividendYield: parseFloat(item.DividendYield) || null
                });
            }
        }

        console.log(`✅ TWSE 合併後共 ${stocks.length} 檔上市股票`);

        // 驗證 2330 台積電
        const tsmc = stocks.find(s => s.code === '2330');
        if (tsmc) {
            console.log(`   📊 驗證: 2330 台積電 收盤價 = ${tsmc.closePrice} 元, PE = ${tsmc.peRatio}`);
        }

        return stocks;
    } catch (error) {
        console.error('TWSE API 失敗:', error.message);
    }

    return [];
}

/**
 * 從櫃買中心取得當日所有上櫃股票交易資料
 * 使用 TPEx OpenAPI
 */
export async function fetchTPExAllStocks() {
    console.log('📡 正在從 TPEx 取得全部上櫃股票資料...');

    try {
        // 使用用戶提供的 OpenAPI 端點
        const response = await http.get('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis', {
            timeout: 30000
        });

        if (response.data && Array.isArray(response.data)) {
            const stocks = response.data
                .filter(item => /^\d{4,6}$/.test(item.SecuritiesCompanyCode))
                .map(item => ({
                    code: item.SecuritiesCompanyCode,
                    name: item.CompanyName,
                    closePrice: parseFloat(item.ClosingPrice) || 0,
                    peRatio: parseFloat(item.PriceEarningRatio) || null,
                    pbRatio: parseFloat(item.PriceBookRatio) || null,
                    dividendYield: parseFloat(item.YieldRatio) || null,
                    openPrice: 0,
                    highPrice: 0,
                    lowPrice: 0,
                    volume: 0,
                    change: 0
                }));

            console.log(`✅ TPEx OpenAPI 回傳 ${stocks.length} 檔上櫃股票`);
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
        // 1. 獲取指數資料
        const response = await http.get('https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=IND');

        // 2. 獲取成交金額 (使用 FMTQIK API)
        let amount = 'N/A';
        try {
            const volumeResponse = await http.get('https://www.twse.com.tw/exchangeReport/FMTQIK?response=json');
            if (volumeResponse.data && volumeResponse.data.data && volumeResponse.data.data.length > 0) {
                // FMTQIK 回傳今日成交資訊，格式: [日期, 成交股數, 成交金額, 成交筆數, ...]
                const todayData = volumeResponse.data.data[volumeResponse.data.data.length - 1];
                if (todayData && todayData[2]) {
                    amount = todayData[2]; // 成交金額
                    console.log(`   💰 成交金額: ${amount}`);
                }
            }
        } catch (volError) {
            console.warn('FMTQIK API 失敗，嘗試備用來源:', volError.message);
        }

        let indexData = null;

        // Case 1: New API format (tables)
        if (response.data && response.data.tables) {
            for (const table of response.data.tables) {
                if (table.data) {
                    const row = table.data.find(r => r[0] && r[0].includes('發行量加權股價指數'));
                    if (row) {
                        indexData = row;
                        break;
                    }
                }
            }
        }
        // Case 2: Old API format (data1)
        else if (response.data && response.data.data1) {
            indexData = response.data.data1.find(row => row[0] === '發行量加權股價指數');
            // 舊格式可能在 data5 有成交金額
            if (amount === 'N/A' && response.data.data5?.[0]?.[2]) {
                amount = response.data.data5[0][2];
            }
        }

        if (indexData) {
            const indexValue = indexData[1];

            // 解析漲跌
            let sign = '';
            let changeVal = '';
            const col2 = indexData[2] || '';
            const col3 = indexData[3] || '';

            if (col2.includes('-') || col2.includes('green')) {
                sign = '-';
            }

            if (isNaN(parseFloat(col2.replace(/,/g, ''))) || col2.includes('<')) {
                changeVal = col3;
            } else {
                changeVal = col2;
            }

            let finalChange = sign + changeVal;
            if (!changeVal) finalChange = '0';

            console.log(`   📊 加權指數: ${indexValue}, 漲跌: ${finalChange}`);

            return {
                name: '加權指數',
                index: indexValue,
                change: finalChange,
                amount: amount
            };
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
        { symbol: '^DJI', name: '道瓊工業指數', displaySymbol: 'DJI' },
        { symbol: '^IXIC', name: 'NASDAQ', displaySymbol: 'NASDAQ' },
        { symbol: '^GSPC', name: 'S&P 500', displaySymbol: 'SPX' },
        { symbol: '^SOX', name: '費城半導體', displaySymbol: 'SOX' },
        { symbol: '^VIX', name: 'VIX 恐慌指數', displaySymbol: 'VIX' },
        { symbol: 'DX-Y.NYB', name: 'DXY 美元指數', displaySymbol: 'DXY' }
    ];

    const results = [];

    // 使用 v8 API (不需要授權)
    for (const index of indices) {
        try {
            const response = await http.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(index.symbol)}`, {
                timeout: 10000
            });

            if (response.data?.chart?.result?.[0]) {
                const meta = response.data.chart.result[0].meta;
                const price = meta.regularMarketPrice;
                const prevClose = meta.previousClose || meta.chartPreviousClose;
                const change = price - prevClose;
                const changePercent = (change / prevClose) * 100;

                results.push({
                    symbol: index.displaySymbol,
                    name: index.name,
                    price: price?.toFixed(2) || 'N/A',
                    change: change?.toFixed(2) || '0',
                    changePercent: changePercent?.toFixed(2) || '0'
                });
            }
        } catch (error) {
            console.error(`取得 ${index.name} 失敗:`, error.message);
        }

        // 避免請求過快
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`✅ Yahoo Finance 取得 ${results.length} 個國際指數`);
    return results;
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

    const results = [];

    // 使用 v8 API (不需要授權)
    for (const commodity of commodities) {
        try {
            const response = await http.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(commodity.symbol)}`, {
                timeout: 10000
            });

            if (response.data?.chart?.result?.[0]) {
                const meta = response.data.chart.result[0].meta;
                const price = meta.regularMarketPrice;
                const prevClose = meta.previousClose || meta.chartPreviousClose;
                const change = price - prevClose;
                const changePercent = prevClose ? (change / prevClose) * 100 : 0;

                results.push({
                    symbol: commodity.symbol,
                    name: commodity.name,
                    icon: commodity.icon,
                    price: price?.toFixed(2) || 'N/A',
                    change: change?.toFixed(2) || '0',
                    changePercent: changePercent?.toFixed(2) || '0'
                });
            }
        } catch (error) {
            console.error(`取得 ${commodity.name} 失敗:`, error.message);
        }

        // 避免請求過快
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`✅ Yahoo Finance 取得 ${results.length} 個商品報價`);
    return results;
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
    // 優先使用 TWSE + TPEx API (證交所官方資料)
    console.log('📡 優先使用證交所 (TWSE) 與櫃買中心 (TPEx) API...');
    let twseStocks = await fetchTWSEAllStocks();
    let tpexStocks = await fetchTPExAllStocks();

    // 合併上市 + 上櫃
    let allStocks = [
        ...twseStocks.map(s => ({ ...s, market: '上市' })),
        ...tpexStocks.map(s => ({ ...s, market: '上櫃' }))
    ];

    console.log(`📊 證交所合併後共 ${allStocks.length} 檔股票 (上市 ${twseStocks.length} + 上櫃 ${tpexStocks.length})`);

    // 如果證交所無資料（非交易時間），使用 Yahoo Finance 備用
    if (allStocks.length === 0) {
        console.log('⚠️ 證交所無即時資料（可能為非交易時間），嘗試使用 Yahoo Finance 備用...');

        // 從基本面資料取得股票清單
        const fundamentals = await fetchStockFundamentals();
        if (fundamentals && fundamentals.size > 0) {
            const symbols = Array.from(fundamentals.keys()).map(code =>
                code.includes('.') ? code : `${code}.TW`
            );

            // 批次取得 Yahoo Finance 報價
            const yahooQuotes = await fetchYahooQuotes(symbols);

            allStocks = Array.from(yahooQuotes.entries()).map(([symbol, data]) => ({
                code: symbol.replace('.TW', '').replace('.TWO', ''),
                name: data.name,
                openPrice: data.openPrice,
                highPrice: data.highPrice,
                lowPrice: data.lowPrice,
                closePrice: data.closePrice,
                volume: data.volume,
                change: data.change,
                changePercent: data.changePercent,
                peRatio: data.peRatio,
                dividendYield: data.dividendYield,
                market: symbol.includes('.TWO') ? '上櫃' : '上市'
            }));

            console.log(`✅ Yahoo Finance 備用取得 ${allStocks.length} 檔股票報價`);
        }
    }

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
