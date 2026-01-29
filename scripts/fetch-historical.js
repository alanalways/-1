
import fs from 'fs';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

const BASE_DIR = path.join(process.cwd(), 'data');
const HISTORY_DIR = path.join(BASE_DIR, 'history');
const STOCKS_FILE = path.join(BASE_DIR, 'stocks-lite.json'); // Or stocks.json if available

// Ensure history directory exists
if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

// Helper: Sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load target stocks
function loadStocks() {
    // Try to load full list first, fallback to lite
    const fullPath = path.join(BASE_DIR, 'stocks.json');
    if (fs.existsSync(fullPath)) {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        return Array.isArray(data) ? data : (data.stocks || []);
    }
    if (fs.existsSync(STOCKS_FILE)) {
        const data = JSON.parse(fs.readFileSync(STOCKS_FILE, 'utf8'));
        return Array.isArray(data) ? data : (data.stocks || []);
    }
    return [];
}

async function fetchWithSuffix(symbol, suffix) {
    const ySymbol = `${symbol}${suffix}`;
    try {
        console.log(`📡 Fetching ${ySymbol}...`);
        const daily = await yahooFinance.historical(ySymbol, { period1: '2023-01-01', interval: '1d' });
        const weekly = await yahooFinance.historical(ySymbol, { period1: '2022-01-01', interval: '1wk' });

        if (daily && daily.length > 0) return { daily, weekly, symbol: ySymbol };
    } catch (e) {
        // console.error(e.message); // Too verbose
        return null;
    }
    return null;
}

async function fetchStockHistory(symbol) {
    // Try .TW then .TWO
    let result = await fetchWithSuffix(symbol, '.TW');
    if (!result) {
        console.log(`⚠️ .TW failed for ${symbol}, trying .TWO...`);
        result = await fetchWithSuffix(symbol, '.TWO');
    }

    if (!result) {
        console.error(`❌ Failed to fetch ${symbol} (tried .TW and .TWO)`);
        return false;
    }

    const { daily, weekly, symbol: foundSymbol } = result;

    try {
        // Save file
        const data = {
            symbol: foundSymbol,
            lastUpdate: new Date().toISOString(),
            daily: daily.map(q => ({
                date: q.date.toISOString().split('T')[0],
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.volume
            })),
            weekly: weekly ? weekly.map(q => ({
                date: q.date.toISOString().split('T')[0],
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.volume
            })) : []
        };

        const filePath = path.join(HISTORY_DIR, `${symbol}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        return true;

    } catch (error) {
        console.error(`❌ Error saving ${symbol}:`, error.message);
        return false;
    }
}

async function main() {
    const stocks = loadStocks();

    // In CI environment, limit to 100 stocks to avoid timeout and rate limiting
    const isCI = process.env.CI || process.env.GITHUB_ACTIONS;
    const maxStocks = isCI ? 100 : stocks.length;
    const targetStocks = stocks.slice(0, maxStocks);

    if (isCI) {
        console.log(`⚙️ Running in CI mode - limiting to ${maxStocks} stocks`);
    }

    // Process all stocks (no debug limit)
    console.log(`🎯 Target: ${targetStocks.length} stocks`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < targetStocks.length; i++) {
        const stock = targetStocks[i];
        const code = stock.code || stock.symbol;
        if (!code) continue;

        const cleanCode = code.replace('.TW', '').replace('.TWO', '');
        console.log(`[${i + 1}/${stocks.length}] 🚀 Processing ${cleanCode}...`);

        const result = await fetchStockHistory(cleanCode);
        if (result) {
            success++;
            console.log(`✅ ${cleanCode} saved successfully`);
        } else {
            failed++;
        }

        // Rate limiting - 800ms between requests
        await sleep(800);
    }

    console.log(`\n📊 Summary: ${success} success, ${failed} failed out of ${targetStocks.length} total`);
    console.log('✅ Historical data update complete.');
}


main();
