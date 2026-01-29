/**
 * Daily Update Script
 * 每日自動更新股票數據
 * 由 server.js 的排程任務或手動觸發執行
 */

import fetcher from './fetch-data.js';
import analyzer from './analyze.js';
import supabaseClient from '../lib/supabase.js';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * 執行每日更新
 */
export async function runDailyUpdate() {
    console.log('🚀 開始每日更新...');
    console.log('='.repeat(50));

    try {
        // === 1. 抓取市場數據 ===
        console.log('\n📊 抓取台股大盤資訊...');
        const twIndex = await fetcher.fetchTaiwanStockIndex();

        console.log('🌍 抓取美股與國際指標...');
        const usIndices = await fetcher.fetchUSStockIndices();

        console.log('💰 抓取商品期貨...');
        const commodities = await fetcher.fetchCommodities();

        console.log('\n📈 掃描全台股市場...');
        let allStocks = await fetcher.fetchAllStocks();

        if (allStocks.length === 0) {
            console.log('⚠️ 無法取得股票資料，可能為非交易時間');
            return { success: false, reason: 'No data available' };
        }

        console.log(`✅ 取得 ${allStocks.length} 檔股票`);

        // === 2. 分析 SMC 訊號 ===
        console.log('\n🧠 執行 SMC/ICT 分析...');
        const analyzedStocks = analyzer.selectRecommendations(allStocks, allStocks.length);
        console.log(`✅ 分析完成：${analyzedStocks.length} 檔`);

        // === 3. 儲存到 Supabase ===
        if (supabaseClient.isSupabaseEnabled()) {
            console.log('\n💾 儲存到 Supabase...');

            // 儲存股票數據
            await supabaseClient.saveStocks(analyzedStocks);

            // 儲存市場摘要
            const marketSummary = {
                taiex: twIndex,
                usIndices,
                commodities,
                totalStocks: analyzedStocks.length,
                bullishCount: analyzedStocks.filter(s => s.signal === 'BULLISH').length,
                bearishCount: analyzedStocks.filter(s => s.signal === 'BEARISH').length
            };
            await supabaseClient.saveMarketSummary(marketSummary);
        }

        // === 4. 同時儲存本地 JSON（備份） ===
        console.log('\n📁 儲存本地 JSON 備份...');

        const liteData = {
            lastUpdated: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            analysisDate: new Date().toISOString().split('T')[0],
            marketIntelligence: {
                taiex: twIndex,
                usIndices,
                commodities
            },
            stocks: analyzedStocks
        };

        // 確保目錄存在
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        fs.writeFileSync(
            path.join(DATA_DIR, 'stocks-lite.json'),
            JSON.stringify(liteData, null, 2)
        );

        console.log('\n' + '='.repeat(50));
        console.log('✅ 每日更新完成！');
        console.log(`   📊 股票數量: ${analyzedStocks.length}`);
        console.log(`   📈 看多: ${analyzedStocks.filter(s => s.signal === 'BULLISH').length}`);
        console.log(`   📉 看空: ${analyzedStocks.filter(s => s.signal === 'BEARISH').length}`);

        return { success: true, stockCount: analyzedStocks.length };

    } catch (error) {
        console.error('❌ 每日更新失敗:', error);
        return { success: false, error: error.message };
    }
}

// 如果直接執行此腳本
if (process.argv[1]?.includes('daily-update')) {
    runDailyUpdate()
        .then(result => {
            console.log('\n結果:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
