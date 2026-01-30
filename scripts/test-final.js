import { fetchTWSEAllStocks } from './fetch-data.js';

async function test() {
    console.log('Testing fetchTWSEAllStocks for ETF Sectors...');
    const stocks = await fetchTWSEAllStocks();

    const checkStock = (code) => {
        const stock = stocks.find(s => s.code === code);
        if (stock) {
            console.log(`✅ ${code} ${stock.name}: Sector = [${stock.sector || 'N/A'}]`);
            if (stock.sector === 'ETF') console.log('   -> PASS');
            else console.error('   -> FAIL (Expected ETF)');
        } else {
            console.error(`❌ ${code} NOT FOUND`);
        }
    };

    checkStock('0050');
    checkStock('0056');
    checkStock('00878');
    checkStock('00930');
    // Also check a normal stock
    const tsm = stocks.find(s => s.code === '2330');
    if (tsm) console.log(`ℹ️ 2330 ${tsm.name}: Sector = [${tsm.sector}] (should be 半導體業)`);
}

test();
