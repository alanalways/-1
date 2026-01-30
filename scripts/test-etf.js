import { fetchTWSEAllStocks } from './fetch-data.js';

async function test() {
    console.log('Testing fetchTWSEAllStocks...');
    const stocks = await fetchTWSEAllStocks();
    console.log(`Fetched ${stocks.length} stocks.`);

    const etf930 = stocks.find(s => s.code === '00930');
    const etf878 = stocks.find(s => s.code === '00878');

    if (etf930) console.log('✅ Found 00930:', etf930.name);
    else console.error('❌ 00930 NOT FOUND');

    if (etf878) console.log('✅ Found 00878:', etf878.name);
    else console.error('❌ 00878 NOT FOUND');
}

test();
