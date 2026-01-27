/**
 * Discover Latest - Complete Taiwan Stock Master List
 * 完整台股清單 (上市約 970 檔 + 上櫃約 800 檔 = 約 1770 檔)
 * 資料來源：TWSE 證交所、TPEx 櫃買中心
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

const http = axios.create({
    timeout: 60000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
});

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const MASTER_LIST = path.join(CACHE_DIR, 'master-stock-list.json');
const PRICE_CACHE = path.join(CACHE_DIR, 'stocks-cache.json');

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * 從 TWSE 取得上市股票清單
 */
async function fetchTWSEStockList() {
    console.log('📡 從 TWSE 取得上市股票清單...');

    try {
        // TWSE 股票本益比基本資料 API - 包含所有上市股票
        const response = await http.get('https://www.twse.com.tw/exchangeReport/BWIBBU_d', {
            params: { response: 'json', selectType: 'ALL' }
        });

        if (response.data && response.data.data) {
            const stocks = response.data.data.map(row => ({
                code: row[0],
                name: row[1],
                market: '上市',
                peRatio: parseFloat(row[4]) || null,
                dividendYield: parseFloat(row[2]) || null
            }));
            console.log(`✅ TWSE 上市：${stocks.length} 檔`);
            return stocks;
        }
    } catch (error) {
        console.error('TWSE 股票清單失敗:', error.message);
    }
    return [];
}

/**
 * 從 TPEx 取得上櫃股票清單
 */
async function fetchTPExStockList() {
    console.log('📡 從 TPEx 取得上櫃股票清單...');

    try {
        // TPEx 上櫃股票每日收盤行情
        const today = new Date();
        const rocDate = `${today.getFullYear() - 1911}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

        const response = await http.get('https://www.tpex.org.tw/web/stock/aftertrading/peratio_analysis/pera_result.php', {
            params: { l: 'zh-tw', d: rocDate }
        });

        if (response.data && response.data.aaData) {
            const stocks = response.data.aaData.map(row => ({
                code: row[0],
                name: row[1],
                market: '上櫃',
                peRatio: parseFloat(row[2]) || null,
                dividendYield: parseFloat(row[3]) || null
            }));
            console.log(`✅ TPEx 上櫃：${stocks.length} 檔`);
            return stocks;
        }
    } catch (error) {
        console.error('TPEx 股票清單失敗:', error.message);
    }
    return [];
}

/**
 * 產生模擬資料 (用於非交易時段展示)
 */
function generateSimulatedPrices(stocks) {
    console.log('🎲 為非交易時段生成模擬資料...');

    // 產業平均價格基準
    const sectorPrices = {
        '半導體': { base: 500, range: 2500 },
        '電子零組件': { base: 50, range: 300 },
        '金融保險': { base: 20, range: 80 },
        '航運業': { base: 50, range: 200 },
        '傳產': { base: 30, range: 100 },
        '其他': { base: 50, range: 200 }
    };

    return stocks.map((stock, index) => {
        const sector = sectorPrices[stock.industry] || sectorPrices['其他'];
        const basePrice = sector.base + Math.random() * sector.range;
        const volatility = 0.03; // 3% 波動

        const open = basePrice;
        const change = (Math.random() - 0.5) * 2 * volatility * basePrice;
        const close = open + change;
        const high = Math.max(open, close) * (1 + Math.random() * 0.02);
        const low = Math.min(open, close) * (1 - Math.random() * 0.02);
        const volume = Math.floor(1000000 + Math.random() * 50000000);

        return {
            code: stock.code,
            name: stock.name,
            market: stock.market,
            industry: stock.industry || '其他',
            openPrice: open.toFixed(2),
            highPrice: high.toFixed(2),
            lowPrice: low.toFixed(2),
            closePrice: close.toFixed(2),
            volume: volume.toString(),
            change: change.toFixed(2),
            peRatio: stock.peRatio,
            dividendYield: stock.dividendYield
        };
    });
}

/**
 * 主程式：建立完整股票資料庫
 */
async function buildMasterDatabase() {
    console.log('🚀 開始建立完整台股資料庫...\n');
    console.log('='.repeat(50));

    // 1. 取得股票清單
    const twseStocks = await fetchTWSEStockList();
    const tpexStocks = await fetchTPExStockList();

    // 合併清單
    const allStocks = [...twseStocks, ...tpexStocks];

    if (allStocks.length === 0) {
        console.log('⚠️ 無法從官方 API 取得資料，使用備用清單...');
        // 如果 API 全部失敗，使用備用清單
        const backupList = loadBackupMasterList();
        if (backupList.length > 0) {
            const stocks = generateSimulatedPrices(backupList);
            savePriceCache(stocks);
            return;
        }
        console.log('❌ 無法建立資料庫');
        return;
    }

    // 2. 儲存主清單
    fs.writeFileSync(MASTER_LIST, JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        totalCount: allStocks.length,
        twseCount: twseStocks.length,
        tpexCount: tpexStocks.length,
        stocks: allStocks
    }, null, 2));
    console.log(`💾 主清單已儲存：${allStocks.length} 檔`);

    // 3. 生成模擬價格資料
    const stocksWithPrices = generateSimulatedPrices(allStocks);
    savePriceCache(stocksWithPrices);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 資料庫建立完成！');
    console.log(`   📊 上市：${twseStocks.length} 檔`);
    console.log(`   📈 上櫃：${tpexStocks.length} 檔`);
    console.log(`   💰 總計：${allStocks.length} 檔`);
}

function savePriceCache(stocks) {
    const cacheData = {
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        stockCount: stocks.length,
        stocks: stocks
    };
    fs.writeFileSync(PRICE_CACHE, JSON.stringify(cacheData, null, 2));
    console.log(`💾 價格快取已儲存：${stocks.length} 檔`);
}

function loadBackupMasterList() {
    try {
        if (fs.existsSync(MASTER_LIST)) {
            const data = JSON.parse(fs.readFileSync(MASTER_LIST, 'utf-8'));
            return data.stocks || [];
        }
    } catch (e) {
        console.log('載入備用清單失敗:', e.message);
    }
    return [];
}

// Execute
buildMasterDatabase().catch(console.error);
