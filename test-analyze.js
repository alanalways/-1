
import analyzer from './scripts/analyze.js';

console.log('Analyzer loaded.');
const mockStock = {
    code: '2330', openPrice: '100', closePrice: '105', highPrice: '108', lowPrice: '98',
    volumeRatio: 2.5, changePercent: 5, sector: 'Test'
};
const score = analyzer.calculateStockScore(mockStock);
console.log('Score:', score);
