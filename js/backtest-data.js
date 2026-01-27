/**
 * Compound Snowball Simulator - Historical Data Fetcher
 * 複利雪球模擬器 - 歷史資料抓取模組
 * 
 * 資料來源：
 * - Yahoo Finance (主要): 支援 20 年歷史、台股/美股/ETF/加密貨幣
 * - FinMind (備用): 台股補充資料 (注意 300次/小時限制)
 */

// 使用瀏覽器端 fetch API
const YAHOO_CHART_API = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_SEARCH_API = 'https://query1.finance.yahoo.com/v1/finance/search';

// CORS 代理 (用於本地開發)
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
];

let currentProxyIndex = 0;

async function fetchWithCORS(url) {
    // 先嘗試直接請求
    try {
        const response = await fetch(url);
        if (response.ok) return response;
    } catch (e) {
        console.log('直接請求失敗，嘗試 CORS 代理...');
    }

    // 使用 CORS 代理
    for (let i = 0; i < CORS_PROXIES.length; i++) {
        try {
            const proxyUrl = CORS_PROXIES[(currentProxyIndex + i) % CORS_PROXIES.length] + encodeURIComponent(url);
            const response = await fetch(proxyUrl);
            if (response.ok) {
                currentProxyIndex = (currentProxyIndex + i) % CORS_PROXIES.length;
                return response;
            }
        } catch (e) {
            console.log(`代理 ${i + 1} 失敗:`, e.message);
        }
    }

    throw new Error('所有請求方式都失敗了');
}

/**
 * 股票搜尋 - 支援中文名稱
 * @param {string} query - 搜尋關鍵字 (股票代碼或名稱)
 * @returns {Promise<Array>} - 搜尋結果
 */
async function searchSymbol(query) {
    // 台灣股票/ETF 代碼清單 (常用)
    const twStockList = {
        '0050': { name: '元大台灣50', type: 'ETF' },
        '0056': { name: '元大高股息', type: 'ETF' },
        '00830': { name: '國泰費城半導體', type: 'ETF' },
        '00878': { name: '國泰永續高股息', type: 'ETF' },
        '00881': { name: '國泰台灣5G+', type: 'ETF' },
        '00919': { name: '群益台灣精選高息', type: 'ETF' },
        '00929': { name: '復華台灣科技優息', type: 'ETF' },
        '00940': { name: '元大台灣價值高息', type: 'ETF' },
        '2330': { name: '台積電', type: 'EQUITY' },
        '2317': { name: '鴻海', type: 'EQUITY' },
        '2454': { name: '聯發科', type: 'EQUITY' },
        '2603': { name: '長榮', type: 'EQUITY' },
        '2882': { name: '國泰金', type: 'EQUITY' },
        '2881': { name: '富邦金', type: 'EQUITY' },
        '2412': { name: '中華電', type: 'EQUITY' }
    };

    const results = [];

    // 如果是純數字（台灣股票代碼），直接加入結果
    if (/^\d{4,5}$/.test(query)) {
        const twSymbol = query + '.TW';
        const stockInfo = twStockList[query];

        results.push({
            symbol: twSymbol,
            name: stockInfo?.name || `台股 ${query}`,
            type: stockInfo?.type || 'EQUITY',
            exchange: 'TAI'
        });

        // 也嘗試上櫃 .TWO
        results.push({
            symbol: query + '.TWO',
            name: stockInfo?.name || `上櫃 ${query}`,
            type: stockInfo?.type || 'EQUITY',
            exchange: 'TPE'
        });
    }

    // 嘗試 Yahoo Finance 搜尋 API
    try {
        const url = `${YAHOO_SEARCH_API}?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
        const response = await fetchWithCORS(url);
        const data = await response.json();

        if (data.quotes) {
            const yahooResults = data.quotes.map(q => ({
                symbol: q.symbol,
                name: q.shortname || q.longname || q.symbol,
                type: q.quoteType,
                exchange: q.exchange
            }));

            // 合併結果，優先顯示本地清單
            for (const r of yahooResults) {
                if (!results.find(x => x.symbol === r.symbol)) {
                    results.push(r);
                }
            }
        }
    } catch (error) {
        console.error('Yahoo 搜尋失敗, 使用本地結果:', error);
    }

    return results;
}

/**
 * 取得歷史股價資料 (最多 20 年)
 * @param {string} symbol - 股票代碼 (例: 2330.TW, AAPL, 0050.TW)
 * @param {number} years - 回測年數 (預設 20 年)
 * @returns {Promise<Object>} - 歷史資料
 */
async function fetchHistoricalData(symbol, years = 20) {
    try {
        // 計算時間範圍
        const now = Math.floor(Date.now() / 1000);
        const period1 = now - (years * 365.25 * 24 * 60 * 60);

        // 月線資料
        const url = `${YAHOO_CHART_API}/${symbol}?period1=${Math.floor(period1)}&period2=${now}&interval=1mo&events=div`;

        const response = await fetchWithCORS(url);
        const data = await response.json();

        if (data.chart?.result?.[0]) {
            const result = data.chart.result[0];
            const timestamps = result.timestamp || [];
            const quotes = result.indicators?.quote?.[0] || {};
            const adjClose = result.indicators?.adjclose?.[0]?.adjclose || quotes.close || [];
            const dividends = result.events?.dividends || {};

            // 組織資料
            const history = timestamps.map((ts, i) => ({
                date: new Date(ts * 1000).toISOString().split('T')[0],
                timestamp: ts,
                open: quotes.open?.[i] || null,
                high: quotes.high?.[i] || null,
                low: quotes.low?.[i] || null,
                close: quotes.close?.[i] || null,
                adjClose: adjClose[i] || quotes.close?.[i] || null,
                volume: quotes.volume?.[i] || 0
            })).filter(d => d.close !== null);

            // 處理股息資料
            const dividendList = Object.values(dividends).map(d => ({
                date: new Date(d.date * 1000).toISOString().split('T')[0],
                amount: d.amount
            }));

            // 計算統計數據
            const returns = [];
            for (let i = 1; i < history.length; i++) {
                const ret = (history[i].adjClose - history[i - 1].adjClose) / history[i - 1].adjClose;
                returns.push(ret);
            }

            const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
            const variance = returns.length > 0
                ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
                : 0;
            const monthlyStdDev = Math.sqrt(variance);

            // 年化
            const annualizedReturn = Math.pow(1 + avgReturn, 12) - 1;
            const annualizedStdDev = monthlyStdDev * Math.sqrt(12);

            return {
                symbol: symbol,
                name: result.meta?.shortName || result.meta?.symbol || symbol,
                currency: result.meta?.currency || 'TWD',
                history: history,
                dividends: dividendList,
                stats: {
                    dataPoints: history.length,
                    startDate: history[0]?.date,
                    endDate: history[history.length - 1]?.date,
                    annualizedReturn: annualizedReturn,
                    annualizedStdDev: annualizedStdDev,
                    monthlyReturn: avgReturn,
                    monthlyStdDev: monthlyStdDev,
                    totalDividends: dividendList.reduce((sum, d) => sum + d.amount, 0)
                }
            };
        }

        throw new Error('無法取得資料');
    } catch (error) {
        console.error(`取得 ${symbol} 歷史資料失敗:`, error);
        throw error;
    }
}

/**
 * 取得匯率
 * @returns {Promise<number>} - USD/TWD 匯率
 */
async function fetchExchangeRate() {
    try {
        const response = await fetchWithCORS(`${YAHOO_CHART_API}/USDTWD=X?interval=1d&range=1d`);
        const data = await response.json();

        if (data.chart?.result?.[0]?.meta?.regularMarketPrice) {
            return data.chart.result[0].meta.regularMarketPrice;
        }
    } catch (error) {
        console.error('取得匯率失敗:', error);
    }
    return 31.5; // 預設匯率
}

/**
 * 取得景氣燈號資料 (台灣)
 * @returns {Promise<Array>} - 景氣燈號歷史
 */
async function fetchBusinessIndicator() {
    // 這裡可以整合國發會景氣燈號 API
    // 目前回傳模擬資料作為示範
    const signals = ['blue', 'yellow-blue', 'green', 'yellow-red', 'red'];
    const history = [];

    const now = new Date();
    for (let i = 0; i < 120; i++) { // 10 年
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);

        // 模擬景氣循環
        const cycle = Math.sin(i / 24 * Math.PI * 2);
        let signalIndex = Math.floor((cycle + 1) / 2 * 4);
        signalIndex = Math.max(0, Math.min(4, signalIndex));

        history.unshift({
            date: date.toISOString().split('T')[0].slice(0, 7),
            signal: signals[signalIndex],
            score: Math.floor((signalIndex + 1) * 20)
        });
    }

    return history;
}

/**
 * 計算 RSI 指標
 * @param {Array} prices - 價格陣列
 * @param {number} period - RSI 週期 (預設 14)
 * @returns {Array} - RSI 值陣列
 */
function calculateRSI(prices, period = 14) {
    const rsi = [];
    const gains = [];
    const losses = [];

    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? -change : 0);

        if (i >= period) {
            const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
            const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;

            if (avgLoss === 0) {
                rsi.push(100);
            } else {
                const rs = avgGain / avgLoss;
                rsi.push(100 - (100 / (1 + rs)));
            }
        } else {
            rsi.push(null);
        }
    }

    return rsi;
}

// 匯出模組 (瀏覽器與 Node.js 兼容)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        searchSymbol,
        fetchHistoricalData,
        fetchExchangeRate,
        fetchBusinessIndicator,
        calculateRSI
    };
}

// 瀏覽器全域
if (typeof window !== 'undefined') {
    window.BacktestData = {
        searchSymbol,
        fetchHistoricalData,
        fetchExchangeRate,
        fetchBusinessIndicator,
        calculateRSI
    };
}
