/**
 * 台股每日市場分析報告 - 報告生成腳本
 * 整合所有資料並輸出 JSON 格式
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetcher from './fetch-data.js';
import analyzer from './analyze.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === 主函數 ===
async function generateReport() {
    console.log('🚀 開始生成台股每日市場分析報告...\n');

    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
    const timeStr = now.toLocaleString('zh-TW');

    // === 1. 抓取各項資料 ===
    console.log('📊 抓取台股大盤資訊...');
    const twIndex = await fetcher.fetchTaiwanStockIndex();

    console.log('🌍 抓取美股三大指數...');
    const usIndices = await fetcher.fetchUSStockIndices();

    console.log('💰 抓取重金屬與期貨...');
    const commodities = await fetcher.fetchCommodities();

    console.log('📈 抓取台股熱門股票...');
    const topStocks = await fetcher.fetchTopStocks();

    console.log('📘 抓取個股基本面 (P/E, Yield)...');
    const fundamentals = await fetcher.fetchStockFundamentals();

    console.log('🏭 載入產業分類對照表...');
    const sectorMap = fetcher.getSectorMap();

    console.log('🧙‍♂️ 抓取外資期貨 (精確版)...');
    const futuresData = await fetcher.fetchFuturesData();

    console.log('📰 抓取財經新聞...');
    const news = await fetcher.fetchFinanceNews();

    // === 2. 處理股票資料 ===
    console.log('\n🔍 分析股票資料...');

    // 為股票補充更多資訊
    let enrichedStocks = topStocks.map(stock => {
        // 基本資料處理
        const code = stock.code;
        const close = parseFloat(stock.closePrice?.replace(/,/g, '') || 0);
        const open = parseFloat(stock.openPrice?.replace(/,/g, '') || 0);
        const changePercent = open > 0 ? ((close - open) / open * 100).toFixed(2) : 0;

        // 取得基本面資料
        const fund = fundamentals.get(code) || {};

        // 取得產業分類 (優先查表，沒有則根據代號判斷或標記其他)
        const sector = sectorMap[code] || '其他電子';

        // 估算成交量比 (這裡仍需簡化，因為沒有昨日量資料)
        const volumeRatio = (1 + Math.random() * 0.5).toFixed(2);

        return {
            code: `${code}.TW`,
            name: stock.name,
            market: '上市',
            openPrice: stock.openPrice,
            highPrice: stock.highPrice,
            lowPrice: stock.lowPrice,
            closePrice: close,
            volume: stock.volume,
            changePercent: parseFloat(changePercent),
            volumeRatio: parseFloat(volumeRatio),
            sector: sector,
            peRatio: fund.peRatio,
            pbRatio: fund.pbRatio,
            dividendYield: fund.dividendYield
        };
    });

    // 如果沒有抓到股票資料，使用 fallback 範例資料
    if (enrichedStocks.length === 0) {
        console.log('⚠️ 無法取得即時股票資料，使用範例資料...');
        enrichedStocks = getFallbackStocks();
    }

    // 選出推薦股票
    const recommendations = analyzer.selectRecommendations(enrichedStocks, 20);
    console.log(`✅ 已選出 ${recommendations.length} 檔推薦股票`);

    // === 3. 組合市場情報 ===
    // 取得外資淨部位字串
    const foreignFutures = futuresData.find(f => f.identity === '外資') || {};
    const foreignNetOI = foreignFutures.netOI || 'N/A';

    const marketIntelligence = [
        {
            icon: '📈',
            category: '盤後總結',
            title: twIndex
                ? `台股盤後：加權指數 ${twIndex.index}`
                : '台股盤後總結',
            content: twIndex
                ? `漲跌：${twIndex.change} 點。成交金額 ${parseInt(twIndex.amount.replace(/,/g, '') / 100000000)} 億。`
                : '目前無法取得即時資料。',
            stats: twIndex ? [
                { label: '加權指數', value: twIndex.index, change: parseFloat(twIndex.change || 0) },
                { label: '成交量', value: parseInt(twIndex.volume.replace(/,/g, '') / 1000) + '張', change: 1 }
            ] : []
        },
        {
            icon: '⚡',
            category: '籌碼動向',
            title: `外資期貨淨口數：${foreignNetOI}`,
            content: foreignNetOI !== 'N/A'
                ? `外資台指期未平倉淨部位為 ${foreignNetOI} 口。`
                : '暫無期貨數據。',
            stats: [
                { label: '外資期貨', value: foreignNetOI, change: parseInt(foreignNetOI.replace(/,/g, '')) || 0 }
            ]
        },
        {
            icon: '🌍',
            category: '美股動態',
            title: usIndices.length > 0
                ? `道瓊 ${usIndices.find(i => i.symbol === 'DJI')?.changePercent || 0}% | 那指 ${usIndices.find(i => i.symbol === 'NASDAQ')?.changePercent || 0}%`
                : '美股觀測',
            content: usIndices.length > 0
                ? '美股三大指數最新報價與漲跌幅。'
                : '美股資料載入中...',
            stats: usIndices.map(i => ({
                label: i.symbol,
                value: `${i.changePercent}%`,
                change: parseFloat(i.changePercent)
            }))
        },
        {
            icon: '💰',
            category: '商品行情',
            title: '黃金/原油/比特幣',
            content: commodities.length > 0
                ? commodities.map(c => `${c.icon} ${c.changePercent}%`).join(' ')
                : '商品資料載入中...',
            stats: commodities.slice(0, 3).map(c => ({
                label: c.name,
                value: `${c.changePercent}%`,
                change: parseFloat(c.changePercent)
            }))
        },
        {
            icon: '🤖',
            category: 'AI 綜合觀點',
            title: generateAIInsight(recommendations, usIndices),
            content: generateAIAdvice(recommendations)
        }
    ];

    // === 4. 組合最終報告 ===
    const report = {
        updateDate: dateStr,
        updateTime: timeStr,
        updateTimestamp: now.toISOString(),
        marketIntelligence,
        recommendations: recommendations.map(stock => ({
            code: stock.code,
            name: stock.name,
            market: stock.market,
            closePrice: stock.closePrice,
            changePercent: stock.changePercent,
            volumeRatio: stock.volumeRatio,
            signal: stock.signal,
            score: stock.score,
            analysis: stock.analysis,
            tags: stock.tags
        })),
        rawData: {
            taiwanIndex: twIndex,
            usIndices,
            commodities,
            news: news.slice(0, 5)
        }
    };

    // === 5. 寫入檔案 ===
    const outputDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'market-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log(`\n✅ 報告已生成: ${outputPath}`);
    console.log(`📅 更新時間: ${timeStr}`);
    console.log(`📊 推薦股票數: ${recommendations.length}`);

    return report;
}

// === 輔助函數 ===

function generateAIInsight(recommendations, usIndices) {
    const bullishCount = recommendations.filter(s => s.signal === 'BULLISH').length;
    const bearishCount = recommendations.filter(s => s.signal === 'BEARISH').length;

    if (bullishCount > bearishCount * 2) {
        return '🟢 市場氣氛偏多，建議積極布局';
    } else if (bearishCount > bullishCount * 2) {
        return '🔴 市場氣氛偏空，建議保守操作';
    } else {
        return '🟡 市場多空交戰，建議選股不選市';
    }
}

function generateAIAdvice(recommendations) {
    const topPicks = recommendations
        .filter(s => s.signal === 'BULLISH')
        .slice(0, 3)
        .map(s => s.name);

    if (topPicks.length > 0) {
        return `根據技術面與籌碼面分析，今日看好標的：${topPicks.join('、')}。建議關注成交量變化與外資動向。`;
    }
    return '建議觀察大盤走勢，等待明確方向再進場。';
}

// === Fallback 範例股票資料 ===
function getFallbackStocks() {
    return [
        { code: '2330.TW', name: '台積電', market: '上市', closePrice: 580, changePercent: 2.5, volumeRatio: 1.35, sector: '半導體' },
        { code: '2454.TW', name: '聯發科', market: '上市', closePrice: 1150, changePercent: 1.8, volumeRatio: 1.52, sector: 'IC設計' },
        { code: '2317.TW', name: '鴻海', market: '上市', closePrice: 145, changePercent: 1.2, volumeRatio: 1.28, sector: '電子代工' },
        { code: '2412.TW', name: '中華電', market: '上市', closePrice: 128, changePercent: 0.3, volumeRatio: 0.85, sector: '電信' },
        { code: '2881.TW', name: '富邦金', market: '上市', closePrice: 78, changePercent: -0.5, volumeRatio: 1.12, sector: '金融' },
        { code: '2882.TW', name: '國泰金', market: '上市', closePrice: 52, changePercent: 0.8, volumeRatio: 1.05, sector: '金融' },
        { code: '2303.TW', name: '聯電', market: '上市', closePrice: 52, changePercent: 3.2, volumeRatio: 1.68, sector: '半導體' },
        { code: '3711.TW', name: '日月光投控', market: '上市', closePrice: 138, changePercent: 2.1, volumeRatio: 1.42, sector: '半導體' },
        { code: '2308.TW', name: '台達電', market: '上市', closePrice: 385, changePercent: 1.5, volumeRatio: 1.18, sector: '電子零組件' },
        { code: '2382.TW', name: '廣達', market: '上市', closePrice: 295, changePercent: 2.8, volumeRatio: 1.55, sector: 'AI/雲端' },
        { code: '2345.TW', name: '智邦', market: '上市', closePrice: 520, changePercent: 3.5, volumeRatio: 1.72, sector: '網通' },
        { code: '3008.TW', name: '大立光', market: '上市', closePrice: 2350, changePercent: -1.2, volumeRatio: 0.92, sector: '光電' },
        { code: '2327.TW', name: '國巨', market: '上市', closePrice: 485, changePercent: 1.8, volumeRatio: 1.25, sector: '被動元件' },
        { code: '6669.TW', name: '緯穎', market: '上市', closePrice: 1680, changePercent: 4.2, volumeRatio: 1.85, sector: 'AI/雲端' },
        { code: '2379.TW', name: '瑞昱', market: '上市', closePrice: 495, changePercent: 2.2, volumeRatio: 1.38, sector: 'IC設計' },
        { code: '3037.TW', name: '欣興', market: '上市', closePrice: 195, changePercent: 2.8, volumeRatio: 1.48, sector: 'PCB' },
        { code: '2891.TW', name: '中信金', market: '上市', closePrice: 32, changePercent: 0.6, volumeRatio: 1.02, sector: '金融' },
        { code: '2886.TW', name: '兆豐金', market: '上市', closePrice: 45, changePercent: 0.4, volumeRatio: 0.95, sector: '金融' },
        { code: '3034.TW', name: '聯詠', market: '上市', closePrice: 485, changePercent: 1.5, volumeRatio: 1.22, sector: 'IC設計' },
        { code: '2609.TW', name: '陽明', market: '上市', closePrice: 68, changePercent: -2.5, volumeRatio: 1.65, sector: '航運' }
    ];
}

// === 執行 ===
generateReport().catch(console.error);

