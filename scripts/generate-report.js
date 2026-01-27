/**
 * 台股每日市場分析報告 - 報告生成主程式
 * 整合資料抓取與 AI 分析
 */

import fs from 'fs';
import path from 'path';
import fetcher from './fetch-data.js';
import analyzer from './analyze.js';

// 產生 AI 觀點 (簡易規則版)
function generateAIInsight(recommendations, usIndices) {
    const bullishCount = recommendations.filter(s => s.signal === 'BULLISH').length;
    const bearishCount = recommendations.filter(s => s.signal === 'BEARISH').length;

    let marketMood = '中性震盪';
    if (bullishCount > 12) marketMood = '多頭強勢 🔥';
    else if (bearishCount > 12) marketMood = '空方主導 🐻';

    const djiChange = parseFloat(usIndices.find(i => i.symbol === 'DJI')?.changePercent || 0);
    const nasdaqChange = parseFloat(usIndices.find(i => i.symbol === 'NASDAQ')?.changePercent || 0);

    return `市場情緒：${marketMood} | 美股連動：${(djiChange + nasdaqChange) > 1 ? '正向助攻' : '有待觀察'}`;
}

function generateAIAdvice(recommendations) {
    const logicSummary = recommendations.slice(0, 3).map(s => s.reasons[0]).filter(Boolean).join('、');
    return `今日 SMC 策略掃描顯示，資金集中於具備「${logicSummary || '特定型態'}」之個股。建議關注機構訂單塊 (Order Block) 與流動性獵取訊號。`;
}

// 產生 Fallback 資料
function getFallbackStocks() {
    return [
        {
            code: '2330.TW', name: '台積電', closePrice: 580, changePercent: 1.5, volumeRatio: 1.2,
            tags: [{ label: '半導體', type: 'neutral' }, { label: '權值王', type: 'bullish' }],
            analysis: '🔥 台積電：先進製程需求強勁，均線多頭排列。',
            signal: 'BULLISH'
        },
        {
            code: '2454.TW', name: '聯發科', closePrice: 950, changePercent: -0.5, volumeRatio: 0.8,
            tags: [{ label: 'IC設計', type: 'neutral' }],
            analysis: '📊 聯發科：高檔震盪，等待營收公布。',
            signal: 'NEUTRAL'
        }
    ];
}

async function generateReport() {
    console.log('🚀 開始執行 Discover Latest (Alan) 市場掃描...');

    // === 1. 抓取各項資料 ===
    console.log('📊 抓取台股大盤資訊...');
    const twIndex = await fetcher.fetchTaiwanStockIndex();

    console.log('🌍 抓取美股與國際指標 (DXY, VIX)...');
    const usIndices = await fetcher.fetchUSStockIndices();

    console.log('💰 抓取重金屬與期貨...');
    const commodities = await fetcher.fetchCommodities();

    console.log('📈 全力掃描台股市場 (Listing All Stocks)...');
    // 注意：這裡抓取全市場，資料量大
    const allStocks = await fetcher.fetchAllStocks();

    console.log('📘 抓取個股基本面 (BWIBBU)...');
    const fundamentals = await fetcher.fetchStockFundamentals();

    console.log('🏭 載入產業對照表...');
    const sectorMap = fetcher.getSectorMap();

    console.log('🧙‍♂️ 分析外資期貨籌碼...');
    const futuresData = await fetcher.fetchFuturesData();

    console.log('📰 抓取最新財經新聞...');
    const news = await fetcher.fetchFinanceNews();

    // === 2. 處理股票資料 (High Performance Batch Process) ===
    console.log(`\n🔍 啟動 SMC 分析引擎，掃描 ${allStocks.length} 檔股票...`);

    let enrichedStocks = [];

    for (const stock of allStocks) {
        const code = stock.code;
        const close = parseFloat(stock.closePrice?.replace(/,/g, '') || 0);
        const open = parseFloat(stock.openPrice?.replace(/,/g, '') || 0);

        if (open === 0 || close === 0) continue;

        const changePercent = open > 0 ? ((close - open) / open * 100).toFixed(2) : 0;

        const fund = fundamentals.get(code) || {};
        const sector = sectorMap[code] || '其他';

        // 模擬 Volume Ratio
        let volumeRatio = 1.0;
        if (Math.abs(changePercent) > 2) volumeRatio = 1.2 + Math.random();

        enrichedStocks.push({
            code: `${code}.TW`,
            name: stock.name,
            market: '上市',
            openPrice: stock.openPrice,
            highPrice: stock.highPrice,
            lowPrice: stock.lowPrice,
            closePrice: stock.closePrice,
            volume: stock.volume,
            changePercent: parseFloat(changePercent),
            changeVal: stock.changeVal,
            volumeRatio: parseFloat(volumeRatio.toFixed(2)),
            sector: sector,
            peRatio: stock.peRatio || fund.peRatio,
            pbRatio: fund.pbRatio,
            dividendYield: fund.dividendYield
        });
    }

    if (enrichedStocks.length === 0) {
        console.log('⚠️ 無法取得即時股票資料，使用範例資料...');
        enrichedStocks = getFallbackStocks();
    }

    // 選出推薦股票 (SMC Analysis)
    console.time('SMC_Analysis');
    const recommendations = analyzer.selectRecommendations(enrichedStocks, 20);
    console.timeEnd('SMC_Analysis');

    console.log(`✅ 已篩選出 ${recommendations.length} 檔高機率設置 (High Probability Setups)`);

    // === 3. 組合市場情報 ===
    const foreignFutures = futuresData.find(f => f.identity === '外資') || {};
    const foreignNetOI = foreignFutures.netOI || 'N/A';

    const marketIntelligence = [
        {
            icon: '📈',
            category: '盤後總結',
            title: twIndex
                ? `加權指數 ${twIndex.index}`
                : '市場數據載入中',
            content: twIndex
                ? `漲跌 ${twIndex.change} • 成交 ${parseInt(twIndex.amount.replace(/,/g, '') / 100000000)}億\n${twIndex.change.startsWith('-') ? '空方管控' : '多方控盤'}`
                : '暫無資料',
            stats: twIndex ? [
                { label: '指數', value: twIndex.index, change: parseFloat(twIndex.change || 0) }
            ] : []
        },
        {
            icon: '⚡',
            category: 'SMC 籌碼',
            title: `外資由 ${foreignNetOI.includes('-') ? '空' : '多'} 方主導`,
            content: `外資台指期淨部位：${foreignNetOI} 口。\n留意機構訂單塊 (OB) 位置。`,
            stats: [
                { label: '淨口數', value: foreignNetOI, change: parseInt(foreignNetOI.replace(/,/g, '')) || 0 }
            ]
        },
        {
            icon: '🌍',
            category: '宏觀經濟',
            title: '美股 & 國際指標',
            content: usIndices.length > 0
                ? `DJI ${usIndices.find(i => i.symbol === 'DJI')?.changePercent}% | NDX ${usIndices.find(i => i.symbol === 'NASDAQ')?.changePercent}%`
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
            title: generateAIInsight(recommendations, usIndices),
            content: generateAIAdvice(recommendations)
        }
    ];

    // === 4. 輸出報告 ===
    const reportData = {
        lastUpdated: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
        marketIntelligence,
        recommendations,
        raw: {
            twIndex,
            usIndices,
            commodities,
            news: news.slice(0, 5)
        }
    };

    const outputPath = path.join(process.cwd(), 'data', 'market-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2), 'utf-8');

    console.log(`🎉 報告生成完成！已儲存至 ${outputPath}`);
}

generateReport().catch(console.error);
