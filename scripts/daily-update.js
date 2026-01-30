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

        // [新增] 強制保留重要股票 (確保 2330、ETF 等一定在名單中)
        const mustHaveCodes = ['2330', '2317', '2454', '3034', '2881', '2882', '2884', '2886', '2891', '2892'];
        const mustHaveStocks = allStocks.filter(s =>
            // 保留指定的權值股
            mustHaveCodes.includes(s.code) ||
            // 保留所有 ETF (代碼 00 開頭)
            s.code.startsWith('00')
        );

        // 把「推薦股」和「強制保留股」合併，並去除重複
        const finalStockMap = new Map();
        analyzedStocks.forEach(s => finalStockMap.set(s.code, s));

        mustHaveStocks.forEach(mustHave => {
            if (!finalStockMap.has(mustHave.code)) {
                // 如果原本名單沒有，補進去並給予預設評分
                const scored = analyzer.selectRecommendations([mustHave], 1)[0] || {
                    ...mustHave,
                    score: mustHave.score || 50,
                    signal: mustHave.signal || 'NEUTRAL',
                    analysis: `⚖️ **${mustHave.name}** [${mustHave.sector || '其他'}] ➤ 盤整觀望。`
                };
                finalStockMap.set(mustHave.code, scored);
            }
        });

        const finalStockList = Array.from(finalStockMap.values());
        console.log(`📊 合併後共 ${finalStockList.length} 檔 (原 ${analyzedStocks.length} + 強制保留 ${finalStockList.length - analyzedStocks.length})`);

        // === 3. 儲存到 Supabase ===
        if (supabaseClient.isSupabaseEnabled()) {
            console.log('\n💾 儲存到 Supabase...');

            // 儲存股票數據
            await supabaseClient.saveStocks(finalStockList);

            // [新增] 生成 Market Intelligence (與 generate-report.js 保持一致)
            let totalChange = 0;
            const sectorStats = {};
            finalStockList.forEach(s => {
                const change = parseFloat(s.changePercent || 0);
                totalChange += change;
                const sector = s.sector || '其他';
                if (!sectorStats[sector]) sectorStats[sector] = { sum: 0, count: 0 };
                sectorStats[sector].sum += change;
                sectorStats[sector].count++;
            });

            const avgChange = finalStockList.length > 0 ? (totalChange / finalStockList.length).toFixed(2) : '0.00';
            let hotSector = { name: '分析中', avgChange: 0 };
            let maxChange = -Infinity;

            for (const [name, stats] of Object.entries(sectorStats)) {
                const avg = stats.sum / stats.count;
                if (avg > maxChange) {
                    maxChange = avg;
                    hotSector = { name, avgChange: avg };
                }
            }

            const dji = usIndices.find(i => i.symbol === 'DJI') || { changePercent: '0.00' };
            const ndx = usIndices.find(i => i.symbol === 'NASDAQ') || { changePercent: '0.00' };

            const marketIntelligence = [
                {
                    icon: '📊',
                    category: '全市場掃描',
                    title: `共掃描 ${finalStockList.length} 檔`,
                    content: `看多 ${finalStockList.filter(s => s.signal === 'BULLISH').length} 檔 • 看空 ${finalStockList.filter(s => s.signal === 'BEARISH').length} 檔\n平均漲跌 ${avgChange}%`
                },
                {
                    icon: '🔥',
                    category: '熱門產業',
                    title: `${hotSector.name} 最強`,
                    content: `${hotSector.name} 平均漲幅 ${hotSector.avgChange.toFixed(2)}%`
                },
                {
                    icon: '🌍',
                    category: '國際市場',
                    title: '美股連動',
                    content: `道瓊 ${dji.changePercent}% | 那斯達克 ${ndx.changePercent}%`
                },
                {
                    icon: '🤖',
                    category: 'SMC 訊號',
                    title: (() => {
                        // [修正] 計算實際 SMC 訊號數量
                        const obCount = finalStockList.filter(s => s.patterns?.ob).length;
                        const fvgCount = finalStockList.filter(s => s.patterns?.fvg).length;
                        const sweepCount = finalStockList.filter(s => s.patterns?.sweep).length;
                        const total = obCount + fvgCount + sweepCount;
                        return `${total} 檔觸發`;
                    })(),
                    content: (() => {
                        const obCount = finalStockList.filter(s => s.patterns?.ob).length;
                        const fvgCount = finalStockList.filter(s => s.patterns?.fvg).length;
                        const sweepCount = finalStockList.filter(s => s.patterns?.sweep).length;
                        return `OB: ${obCount} 檔 | FVG: ${fvgCount} 檔 | Sweep: ${sweepCount} 檔`;
                    })()
                }
            ];

            // 儲存市場摘要
            const marketSummary = {
                taiex: twIndex,
                usIndices,
                commodities,
                totalStocks: finalStockList.length,
                bullishCount: finalStockList.filter(s => s.signal === 'BULLISH').length,
                bearishCount: finalStockList.filter(s => s.signal === 'BEARISH').length,
                marketIntelligence // [新增] 寫入此欄位
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
            stocks: finalStockList
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
        console.log(`   📊 股票數量: ${finalStockList.length}`);
        console.log(`   📈 看多: ${finalStockList.filter(s => s.signal === 'BULLISH').length}`);
        console.log(`   📉 看空: ${finalStockList.filter(s => s.signal === 'BEARISH').length}`);

        return { success: true, stockCount: finalStockList.length };

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
