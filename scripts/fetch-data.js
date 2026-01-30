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
// TWSE 產業分類 API
// ========================================

// TWSE 產業代碼對照表 (官方分類)
const INDUSTRY_CODE_MAP = {
    '01': '水泥工業', '02': '食品工業', '03': '塑膠工業', '04': '紡織纖維',
    '05': '電機機械', '06': '電器電纜', '08': '玻璃陶瓷', '09': '造紙工業',
    '10': '鋼鐵工業', '11': '橡膠工業', '12': '汽車工業', '14': '建材營造',
    '15': '航運業', '16': '觀光事業', '17': '金融保險', '18': '貿易百貨',
    '20': '其他', '21': '化學工業', '22': '生技醫療', '23': '油電燃氣',
    '24': '半導體業', '25': '電腦及週邊設備業', '26': '光電業', '27': '通信網路業',
    '28': '電子零組件業', '29': '電子通路業', '30': '資訊服務業', '31': '其他電子業',
    '35': 'ETF', '36': 'REITs', '37': '認購權證', '38': '特別股',
    '91': '存託憑證'
};

/**
 * 從 TWSE 取得上市公司產業分類對照表
 * API: https://openapi.twse.com.tw/v1/opendata/t187ap03_L
 * @returns {Map<string, string>} 股票代碼 -> 產業類別
 */
export async function fetchTWSESectorList() {
    console.log('📡 正在從 TWSE 取得產業分類對照表...');
    try {
        const response = await http.get('https://openapi.twse.com.tw/v1/opendata/t187ap03_L', {
            timeout: 30000
        });

        const sectorMap = new Map();
        if (response.data && Array.isArray(response.data)) {
            response.data.forEach(item => {
                const code = (item['公司代號'] || item.code || '').trim();
                const industryCode = item['產業別'] || '';
                // [修正] 這裡需要引入 INDUSTRY_CODE_MAP (請確認檔案上方有定義)
                let sector = INDUSTRY_CODE_MAP[industryCode] || '其他';

                // 排除權證 (通常 03-08 開頭且長度為 6)
                if (code.length === 6 &&
                    (code.startsWith('03') || code.startsWith('04') ||
                        code.startsWith('05') || code.startsWith('06') ||
                        code.startsWith('07') || code.startsWith('08'))) {
                    return; // Skip warrants
                }

                if (code.startsWith('00')) {
                    sector = 'ETF';
                }

                if (code) sectorMap.set(code, sector);
            });
        } console.log(`✅ TWSE 產業分類對照表: ${sectorMap.size} 檔`);
        // 驗證幾檔主要股票
        console.log(`   📊 驗證: 2330=${sectorMap.get('2330')}, 2317=${sectorMap.get('2317')}, 2881=${sectorMap.get('2881')}`);
        return sectorMap;
    } catch (error) {
        console.error('TWSE 產業分類 API 失敗:', error.message);
        return new Map();
    }
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
 * 使用 STOCK_DAY_ALL API (股價) 為主，BWIBBU_d API (基本面) 為輔
 * 這樣可以包含 ETF (如 0050) 等沒有本益比的商品
 */
export async function fetchTWSEAllStocks() {
    console.log('📡 正在從 TWSE 取得全部上市股票資料...');

    try {
        // 1. 主要資料來源：STOCK_DAY_ALL (所有上市股票含 ETF)
        const priceResponse = await http.get('https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL', {
            params: { response: 'open_data' },
            timeout: 60000
        });

        // 解析股價資料（作為主要列表）
        const stocks = [];
        const parseNum = (str) => {
            if (!str || str === '--' || str === '') return 0;
            return parseFloat(str.replace(/,/g, '')) || 0;
        };

        if (priceResponse.data) {
            const lines = priceResponse.data.split('\n');
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
                const code = cols[1];
                const name = cols[2];

                // 過濾 4-6 位數純數字代碼（包含 5 位數 ETF 如 00878, 00930, 00940 等）
                if (!/^\d{4,6}$/.test(code)) continue;

                const closePrice = parseNum(cols[8]);
                const change = parseNum(cols[9]);
                // [Fix] Calculate changePercent = (change / prevClose) * 100
                // prevClose = closePrice - change
                const prevClose = closePrice - change;
                const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

                stocks.push({
                    code: code,
                    name: name || '',
                    openPrice: parseNum(cols[5]),
                    highPrice: parseNum(cols[6]),
                    lowPrice: parseNum(cols[7]),
                    closePrice: closePrice,
                    volume: parseNum(cols[3]),
                    tradeValue: parseNum(cols[4]),
                    change: change,
                    changePercent: parseFloat(changePercent.toFixed(2)),
                    transactions: parseNum(cols[10]),
                    peRatio: null,
                    pbRatio: null,
                    dividendYield: null
                });
            }
        }
        console.log(`   📈 STOCK_DAY_ALL 股價資料: ${stocks.length} 檔`);

        // 2. 補充基本面資料 (BWIBBU_d - 只有普通股票有本益比，ETF 沒有)
        try {
            const fundResponse = await http.get('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d', {
                timeout: 30000
            });

            if (fundResponse.data && Array.isArray(fundResponse.data)) {
                const fundMap = new Map();
                for (const item of fundResponse.data) {
                    fundMap.set(item.Code, {
                        peRatio: parseFloat(item.PEratio) || null,
                        pbRatio: parseFloat(item.PBratio) || null,
                        dividendYield: parseFloat(item.DividendYield) || null
                    });
                }

                // 補充基本面到已有股票
                for (const stock of stocks) {
                    const fund = fundMap.get(stock.code);
                    if (fund) {
                        stock.peRatio = fund.peRatio;
                        stock.pbRatio = fund.pbRatio;
                        stock.dividendYield = fund.dividendYield;
                    }
                }
                console.log(`   💹 補充基本面資料: ${fundMap.size} 檔`);
            }
        } catch (fundError) {
            console.warn('基本面資料獲取失敗（不影響主要數據）:', fundError.message);
        }

        console.log(`✅ TWSE 共 ${stocks.length} 檔上市股票 (含 ETF)`);

        // 3. [修正 Point 1 & 3] 產業分類與 ETF 強制歸類
        try {
            const sectorMap = await fetchTWSESectorList();

            for (const stock of stocks) {
                // 優先使用官方產業分類
                const sector = sectorMap.get(stock.code);

                if (stock.code.startsWith('00')) {
                    // [強制] 只要是 00 開頭，強制歸類為 ETF，覆蓋任何其他分類
                    stock.sector = 'ETF';
                } else if (sector && sector !== '其他') {
                    stock.sector = sector;
                } else {
                    stock.sector = '其他';
                }
            }
        } catch (sectorError) {
            console.warn('產業分類資料獲取失敗，使用基本判斷:', sectorError.message);
            // Fallback
            stocks.forEach(s => {
                if (s.code.startsWith('00')) s.sector = 'ETF';
                else s.sector = s.sector || '其他';
            });
        }

        // 驗證 0050 和 2330
        const etf0050 = stocks.find(s => s.code === '0050');
        const tsmc = stocks.find(s => s.code === '2330');
        if (etf0050) console.log(`   📊 驗證 ETF: 0050 元大台灣50 收盤價 = ${etf0050.closePrice}, 產業 = ${etf0050.sector}`);
        if (tsmc) console.log(`   📊 驗證: 2330 台積電 收盤價 = ${tsmc.closePrice}, PE = ${tsmc.peRatio}, 產業 = ${tsmc.sector}`);

        return stocks;
    } catch (error) {
        console.error('TWSE API 失敗:', error.message);
    }

    return [];
}

/**
 * 從櫃買中心取得當日所有上櫃股票交易資料
 * 使用 tpex_mainboard_quotes (收盤行情) 為主，peratio_analysis 為輔
 * 這樣可以包含所有上櫃股票
 */
export async function fetchTPExAllStocks() {
    console.log('📡 正在從 TPEx 取得全部上櫃股票資料...');

    try {
        // 1. 主要資料來源：收盤行情 (所有上櫃股票)
        const quotesResponse = await http.get('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes', {
            timeout: 30000
        });

        const stocks = [];
        const parseNum = (str) => {
            if (!str || str === '--' || str === '') return 0;
            return parseFloat(String(str).replace(/,/g, '')) || 0;
        };

        if (quotesResponse.data && Array.isArray(quotesResponse.data)) {
            for (const item of quotesResponse.data) {
                const code = item.SecuritiesCompanyCode;
                // 過濾 4-6 位數純數字代碼（包含 5 位數 ETF）
                if (!/^\d{4,6}$/.test(code)) continue;

                const closePrice = parseNum(item.Close);
                const change = parseNum(item.Change);
                // [Fix] Calculate changePercent = (change / prevClose) * 100
                const prevClose = closePrice - change;
                const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

                stocks.push({
                    code: code,
                    name: item.CompanyName || '',
                    closePrice: closePrice,
                    openPrice: parseNum(item.Open),
                    highPrice: parseNum(item.High),
                    lowPrice: parseNum(item.Low),
                    volume: parseNum(item.TradingShares),
                    tradeValue: parseNum(item.TransactionAmount),
                    change: change,
                    changePercent: parseFloat(changePercent.toFixed(2)),
                    transactions: parseNum(item.Transaction),
                    peRatio: null,
                    pbRatio: null,
                    dividendYield: null
                });
            }
        }
        console.log(`   📈 tpex_mainboard_quotes: ${stocks.length} 檔`);

        // 2. 補充基本面資料 (peratio_analysis)
        try {
            const peResponse = await http.get('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis', {
                timeout: 30000
            });

            if (peResponse.data && Array.isArray(peResponse.data)) {
                const peMap = new Map();
                for (const item of peResponse.data) {
                    peMap.set(item.SecuritiesCompanyCode, {
                        peRatio: parseFloat(item.PriceEarningRatio) || null,
                        pbRatio: parseFloat(item.PriceBookRatio) || null,
                        dividendYield: parseFloat(item.YieldRatio) || null
                    });
                }

                // 補充基本面到已有股票
                for (const stock of stocks) {
                    const pe = peMap.get(stock.code);
                    if (pe) {
                        stock.peRatio = pe.peRatio;
                        stock.pbRatio = pe.pbRatio;
                        stock.dividendYield = pe.dividendYield;
                    }
                }
                console.log(`   💹 補充本益比資料: ${peMap.size} 檔`);
            }
        } catch (peError) {
            console.warn('TPEx 本益比資料獲取失敗（不影響主要數據）:', peError.message);
        }

        console.log(`✅ TPEx 共 ${stocks.length} 檔上櫃股票`);

        // 驗證 8048
        const desheng = stocks.find(s => s.code === '8048');
        if (desheng) console.log(`   📊 驗證: 8048 德勝 收盤價 = ${desheng.closePrice}`);

        return stocks;
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

    // [嚴格模式] 若官方 API 無資料，直接回傳空陣列 (不使用 Yahoo 備用)
    if (allStocks.length === 0) {
        console.warn('⚠️ 警告：無法從證交所/櫃買中心取得資料 (可能為非交易時間或 API 維護中)');
        console.warn('🚫 嚴格模式：不使用 Yahoo Finance 作為備用來源，此次更新將中止。');
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
