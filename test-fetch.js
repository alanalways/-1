
import fetcher from './scripts/fetch-data.js';

async function test() {
    console.log('Fetcher loaded.');
    try {
        const stocks = await fetcher.fetchAllStocks();
        console.log(`Stocks fetched: ${stocks.length}`);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}
test();
