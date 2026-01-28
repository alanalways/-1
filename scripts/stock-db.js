/**
 * TWSE Stock Database Module
 * 使用 SQLite 儲存證交所股價資料 (保留近一年)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 資料庫路徑
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'stocks.db');

// 確保目錄存在
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// 建立資料庫連線
let db = null;

/**
 * 初始化資料庫
 */
export function initDatabase() {
    if (db) return db;

    db = new Database(DB_PATH);

    // 建立每日股價表
    db.exec(`
        CREATE TABLE IF NOT EXISTS daily_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            stock_code TEXT NOT NULL,
            stock_name TEXT,
            open_price REAL,
            high_price REAL,
            low_price REAL,
            close_price REAL,
            volume INTEGER,
            trade_value INTEGER,
            price_change REAL,
            transactions INTEGER,
            market TEXT DEFAULT '上市',
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(date, stock_code)
        );
        
        CREATE INDEX IF NOT EXISTS idx_stock_date ON daily_prices(stock_code, date);
        CREATE INDEX IF NOT EXISTS idx_date ON daily_prices(date);
    `);

    console.log('✅ SQLite 資料庫初始化完成:', DB_PATH);
    return db;
}

/**
 * 插入或更新每日股價
 */
export function upsertDailyPrice(data) {
    if (!db) initDatabase();

    const stmt = db.prepare(`
        INSERT INTO daily_prices (
            date, stock_code, stock_name, open_price, high_price, 
            low_price, close_price, volume, trade_value, price_change, 
            transactions, market, updated_at
        ) VALUES (
            @date, @stock_code, @stock_name, @open_price, @high_price,
            @low_price, @close_price, @volume, @trade_value, @price_change,
            @transactions, @market, datetime('now')
        )
        ON CONFLICT(date, stock_code) DO UPDATE SET
            stock_name = @stock_name,
            open_price = @open_price,
            high_price = @high_price,
            low_price = @low_price,
            close_price = @close_price,
            volume = @volume,
            trade_value = @trade_value,
            price_change = @price_change,
            transactions = @transactions,
            market = @market,
            updated_at = datetime('now')
    `);

    return stmt.run(data);
}

/**
 * 批次插入股價資料
 */
export function bulkInsertPrices(prices) {
    if (!db) initDatabase();

    const insertMany = db.transaction((items) => {
        for (const item of items) {
            upsertDailyPrice(item);
        }
    });

    insertMany(prices);
    console.log(`✅ 已寫入 ${prices.length} 筆股價資料到資料庫`);
}

/**
 * 取得指定日期的所有股價
 */
export function getPricesByDate(date) {
    if (!db) initDatabase();

    const stmt = db.prepare(`
        SELECT * FROM daily_prices 
        WHERE date = ?
        ORDER BY stock_code
    `);

    return stmt.all(date);
}

/**
 * 取得最新交易日的所有股價
 */
export function getLatestPrices() {
    if (!db) initDatabase();

    const stmt = db.prepare(`
        SELECT * FROM daily_prices 
        WHERE date = (SELECT MAX(date) FROM daily_prices)
        ORDER BY stock_code
    `);

    return stmt.all();
}

/**
 * 取得指定股票的歷史股價 (用於回測)
 */
export function getStockHistory(stockCode, days = 365) {
    if (!db) initDatabase();

    const stmt = db.prepare(`
        SELECT * FROM daily_prices 
        WHERE stock_code = ?
        ORDER BY date DESC
        LIMIT ?
    `);

    return stmt.all(stockCode, days);
}

/**
 * 刪除超過一年的舊資料
 */
export function cleanOldData() {
    if (!db) initDatabase();

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoffDate = oneYearAgo.toISOString().split('T')[0];

    const stmt = db.prepare(`
        DELETE FROM daily_prices 
        WHERE date < ?
    `);

    const result = stmt.run(cutoffDate);
    console.log(`🗑️ 已清除 ${result.changes} 筆超過一年的舊資料 (早於 ${cutoffDate})`);
    return result.changes;
}

/**
 * 取得資料庫統計資訊
 */
export function getStats() {
    if (!db) initDatabase();

    const totalRecords = db.prepare('SELECT COUNT(*) as count FROM daily_prices').get();
    const uniqueStocks = db.prepare('SELECT COUNT(DISTINCT stock_code) as count FROM daily_prices').get();
    const dateRange = db.prepare('SELECT MIN(date) as min_date, MAX(date) as max_date FROM daily_prices').get();

    return {
        totalRecords: totalRecords.count,
        uniqueStocks: uniqueStocks.count,
        minDate: dateRange.min_date,
        maxDate: dateRange.max_date
    };
}

/**
 * 關閉資料庫連線
 */
export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        console.log('📴 資料庫連線已關閉');
    }
}

export default {
    initDatabase,
    upsertDailyPrice,
    bulkInsertPrices,
    getPricesByDate,
    getLatestPrices,
    getStockHistory,
    cleanOldData,
    getStats,
    closeDatabase
};
