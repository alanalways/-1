
import fetcher from './scripts/fetch-data.js';
import analyzer from './scripts/analyze.js';

async function test() {
    console.log('Testing fetcher...');
    try {
        console.log('Fetching indexes...');
        const indices = await fetcher.fetchUSStockIndices();
        console.log('Indices:', indices);

        console.log('Fetching all stocks...');
        const stocks = await fetcher.fetchAllStocks();
        console.log(`Stocks count: ${stocks.length}`);

        if (stocks.length > 0) {
            console.log('Testing analyzer...');
            const stock = stocks[0];
            // Mock data for analysis
            const mockStock = {
                ...stock,
                openPrice: '100', closePrice: '105', highPrice: '108', lowPrice: '98',
                volumeRatio: 2.5, changePercent: 5,
                sector: 'TestSector'
            };
            const score = analyzer.calculateStockScore(mockStock);
            console.log('Score:', score);

            const tags = analyzer.generateTags(mockStock, score);
            console.log('Tags:', tags);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

test();
