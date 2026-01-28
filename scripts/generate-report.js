/**
 * Discover Latest - Complete Market Report Generator
 * 生成全台股市場分析報告 (無數量限制)
 */

import fs from 'fs';
import path from 'path';
import fetcher from './fetch-data.js';
import analyzer from './analyze.js';

// === Cache Configuration ===
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const STOCK_CACHE_FILE = path.join(CACHE_DIR, 'stocks-cache.json');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// === Cache Functions ===
function saveStockCache(stocks) {
    try {
        const cacheData = {
            date: new Date().toISOString().split('T')[0],
            timestamp: Date.now(),
            stockCount: stocks.length,
            stocks: stocks
        };
        fs.writeFileSync(STOCK_CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8');
        console.log(`💾 已快取 ${stocks.length} 檔股票資料`);
    } catch (error) {
        console.error('快取寫入失敗:', error.message);
    }
}

function loadStockCache() {
    try {
        if (fs.existsSync(STOCK_CACHE_FILE)) {
            const cacheData = JSON.parse(fs.readFileSync(STOCK_CACHE_FILE, 'utf-8'));
            console.log(`📂 載入快取資料 (日期: ${cacheData.date}, 共 ${cacheData.stockCount || cacheData.stocks?.length} 檔)`);
            return cacheData;
        }
    } catch (error) {
        console.error('快取讀取失敗:', error.message);
    }
    return null;
}

// === AI Insights ===
function generateAIInsight(allStocks, usIndices) {
    const bullishCount = allStocks.filter(s => s.signal === 'BULLISH').length;
    const bearishCount = allStocks.filter(s => s.signal === 'BEARISH').length;
    const smcCount = allStocks.filter(s => s.patterns?.ob || s.patterns?.fvg || s.patterns?.sweep).length;

    let marketMood = '中性震盪';
    if (bullishCount > allStocks.length * 0.4) marketMood = '多頭強勢 🔥';
    else if (bearishCount > allStocks.length * 0.4) marketMood = '空方主導 🐻';

    const djiChange = parseFloat(usIndices.find(i => i.symbol === 'DJI')?.changePercent || 0);
    const nasdaqChange = parseFloat(usIndices.find(i => i.symbol === 'NASDAQ')?.changePercent || 0);

    return `市場情緒：${marketMood} | SMC 訊號：${smcCount} 檔 | 美股連動：${(djiChange + nasdaqChange) > 1 ? '正向助攻' : '有待觀察'}`;
}

function generateAIAdvice(allStocks) {
    const smcStocks = allStocks.filter(s => s.patterns?.ob || s.patterns?.fvg);
    const topReasons = smcStocks
        .slice(0, 10)
        .flatMap(s => s.reasons || [])
        .filter(Boolean);

    const uniqueReasons = [...new Set(topReasons)].slice(0, 3);
    return `今日 SMC 策略掃描全市場，發現 ${smcStocks.length} 檔具備機構訊號。資金集中於「${uniqueReasons.join('、') || '特定型態'}」之個股。`;
}

// === Main Report Generation ===
async function generateReport() {
    console.log('🚀 開始執行 Discover Latest (Alan) 全市場掃描...\n');
    console.log('='.repeat(50));

    // === 1. Fetch Market Data ===
    console.log('\n📊 抓取台股大盤資訊...');
    const twIndex = await fetcher.fetchTaiwanStockIndex();

    console.log('🌍 抓取美股與國際指標...');
    const usIndices = await fetcher.fetchUSStockIndices();

    console.log('💰 抓取商品期貨與加密貨幣...');
    const commodities = await fetcher.fetchCommodities();

    console.log('\n📈 全力掃描台股市場 (上市 + 上櫃)...');
    let allStocks = await fetcher.fetchAllStocks();

    console.log('📘 抓取個股基本面...');
    const fundamentals = await fetcher.fetchStockFundamentals();

    console.log('🏭 載入產業對照表...');
    const sectorMap = fetcher.getSectorMap();

    console.log('🧙‍♂️ 分析外資期貨籌碼...');
    const futuresData = await fetcher.fetchFuturesData();

    console.log('📰 抓取最新財經新聞...');
    const news = await fetcher.fetchFinanceNews();

    // === 2. Cache Handling ===
    const cache = loadStockCache();

    // If API returned data (any stocks), save to cache
    if (allStocks.length > 0) {
        saveStockCache(allStocks);
    }
    // If API failed, use cache
    else if (cache && cache.stocks && cache.stocks.length > 0) {
        console.log(`⚠️ API 無資料，使用快取 (${cache.stocks.length} 檔)...`);
        allStocks = cache.stocks;
    }

    // === 3. Process ALL Stocks (無限制) ===
    console.log(`\n🔍 處理 ${allStocks.length} 檔股票資料 (全市場，無限制)...`);

    // Build yesterday's data map for volume ratio
    const yesterdayMap = new Map();
    if (cache && cache.stocks) {
        cache.stocks.forEach(s => {
            const vol = parseFloat(String(s.volume || '0').replace(/,/g, ''));
            if (vol > 0) {
                yesterdayMap.set(s.code, vol);
            }
        });
    }

    let enrichedStocks = [];

    for (const stock of allStocks) {
        const code = stock.code;

        // Parse prices
        const close = parseFloat(String(stock.closePrice || '0').replace(/,/g, ''));
        const open = parseFloat(String(stock.openPrice || '0').replace(/,/g, ''));
        const high = parseFloat(String(stock.highPrice || '0').replace(/,/g, ''));
        const low = parseFloat(String(stock.lowPrice || '0').replace(/,/g, ''));
        const volume = parseFloat(String(stock.volume || '0').replace(/,/g, ''));

        // Skip invalid data
        if (open === 0 || close === 0) continue;

        // Calculate change percent
        const changePercent = ((close - open) / open * 100);

        // Calculate volume ratio
        const yesterdayVol = yesterdayMap.get(code) || volume;
        const volumeRatio = yesterdayVol > 0 ? (volume / yesterdayVol) : 1.0;

        // Get fundamentals
        const fund = fundamentals.get(code) || {};
        const sector = sectorMap[code] || stock.industry || '其他';

        enrichedStocks.push({
            code: code.includes('.') ? code : `${code}.TW`,
            name: stock.name,
            market: stock.market || '上市',
            openPrice: open.toString(),
            highPrice: high.toString(),
            lowPrice: low.toString(),
            closePrice: close.toString(),
            volume: volume.toString(),
            changePercent: parseFloat(changePercent.toFixed(2)),
            changeVal: stock.change,
            volumeRatio: parseFloat(volumeRatio.toFixed(2)),
            sector: sector,
            peRatio: stock.peRatio || fund.peRatio,
            pbRatio: fund.pbRatio,
            dividendYield: fund.dividendYield
        });
    }

    console.log(`✅ 成功處理 ${enrichedStocks.length} 檔股票`);

    // === 4. SMC Analysis (ALL Stocks - 無限制) ===
    console.log('\n🧠 執行 SMC/ICT 分析 (全市場)...');
    console.time('SMC_Analysis');

    // Analyze ALL stocks - 無數量限制
    const allAnalyzedStocks = analyzer.selectRecommendations(enrichedStocks, enrichedStocks.length);

    console.timeEnd('SMC_Analysis');
    console.log(`✅ 全市場分析完成：${allAnalyzedStocks.length} 檔`);

    // Statistics
    const bullishCount = allAnalyzedStocks.filter(s => s.signal === 'BULLISH').length;
    const bearishCount = allAnalyzedStocks.filter(s => s.signal === 'BEARISH').length;
    const smcCount = allAnalyzedStocks.filter(s => s.patterns?.ob || s.patterns?.fvg || s.patterns?.sweep).length;

    console.log(`   📈 看多：${bullishCount} 檔`);
    console.log(`   📉 看空：${bearishCount} 檔`);
    console.log(`   🧱 SMC 訊號：${smcCount} 檔`);

    // === 5. Build Market Intelligence ===
    const foreignFutures = futuresData.find(f => f.identity === '外資') || {};
    const foreignNetOI = foreignFutures.netOI || 'N/A';

    const marketIntelligence = [
        {
            icon: '📈',
            category: '盤後總結',
            title: twIndex ? `加權指數 ${twIndex.index}` : '市場數據載入中',
            content: twIndex
                ? `漲跌 ${twIndex.change} • 成交 ${Math.round(parseInt(String(twIndex.amount || '0').replace(/,/g, '')) / 100000000)}億\n${String(twIndex.change || '').startsWith('-') ? '空方管控' : '多方控盤'}`
                : '暫無資料',
            stats: twIndex ? [
                { label: '指數', value: twIndex.index, change: parseFloat(twIndex.change || 0) }
            ] : []
        },
        {
            icon: '📊',
            category: '全市場掃描',
            title: `共掃描 ${allAnalyzedStocks.length} 檔股票`,
            content: `看多 ${bullishCount} 檔 • 看空 ${bearishCount} 檔 • SMC 訊號 ${smcCount} 檔`,
            stats: [
                { label: '總數', value: allAnalyzedStocks.length.toString() },
                { label: 'SMC', value: smcCount.toString() }
            ]
        },
        {
            icon: '⚡',
            category: 'SMC 籌碼',
            title: `外資由 ${String(foreignNetOI || '').includes('-') ? '空' : '多'} 方主導`,
            content: `外資台指期淨部位：${foreignNetOI} 口。\n留意機構訂單塊 (OB) 位置。`,
            stats: [
                { label: '淨口數', value: foreignNetOI, change: parseInt(String(foreignNetOI || '0').replace(/,/g, '')) || 0 }
            ]
        },
        {
            icon: '🌍',
            category: '宏觀經濟',
            title: '美股 & 國際指標',
            content: usIndices.length > 0
                ? `DJI ${usIndices.find(i => i.symbol === 'DJI')?.changePercent}% | NDX ${usIndices.find(i => i.symbol === 'NASDAQ')?.changePercent}% | VIX ${usIndices.find(i => i.symbol === 'VIX')?.changePercent}%`
                : '數據載入中...',
            stats: usIndices.slice(0, 3).map(i => ({
                label: i.symbol,
                value: i.changePercent + '%',
                change: parseFloat(i.changePercent)
            }))
        },
        {
            icon: '🤖',
            category: 'SMC 策略觀點',
            title: generateAIInsight(allAnalyzedStocks, usIndices),
            content: generateAIAdvice(allAnalyzedStocks)
        }
    ];

    // === 6. Output Report (ALL STOCKS) ===
    const reportData = {
        lastUpdated: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
        totalStocksAnalyzed: allAnalyzedStocks.length,
        statistics: {
            bullish: bullishCount,
            bearish: bearishCount,
            neutral: allAnalyzedStocks.length - bullishCount - bearishCount,
            smcSignals: smcCount
        },
        marketIntelligence,
        allStocks: allAnalyzedStocks,  // 全部股票 - 無限制
        // 國際市場資料 (使用 Yahoo Finance)
        internationalMarkets: {
            usIndices: usIndices,
            commodities: commodities,
            twIndex: twIndex
        },
        raw: {
            twIndex,
            usIndices,
            commodities,
            news: news.slice(0, 10)
        }
    };

    const outputPath = path.join(process.cwd(), 'data', 'market-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2), 'utf-8');

    console.log('\n' + '='.repeat(50));
    console.log('🎉 報告生成完成！');
    console.log(`   📊 全市場股票：${allAnalyzedStocks.length} 檔 (無限制)`);
    console.log(`   📈 看多：${bullishCount} 檔`);
    console.log(`   📉 看空：${bearishCount} 檔`);
    console.log(`   🧱 SMC 訊號：${smcCount} 檔`);
    console.log(`   💾 已儲存至：${outputPath}`);
}

// Execute
generateReport().catch(console.error);
