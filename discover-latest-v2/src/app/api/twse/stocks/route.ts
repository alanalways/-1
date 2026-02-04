/**
 * TWSE + TPEX 台股 API 代理
 * 使用官方 Open API 取得真實資料
 * 
 * TWSE: https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL
 * TPEX: https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes
 */

import { NextRequest, NextResponse } from 'next/server';

interface StockData {
    code: string;
    name: string;
    tradeVolume: number;
    tradeValue: number;
    openingPrice: number;
    highestPrice: number;
    lowestPrice: number;
    closingPrice: number;
    change: number;
    changePercent: number;
    transaction: number;
    market: 'twse' | 'tpex';
}

/**
 * 從 TWSE Open API 取得上市股票資料
 * URL: https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL
 */
async function fetchTWSE(): Promise<StockData[]> {
    const url = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';

    console.log('[TWSE] 使用 Open API 取得資料...');

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`TWSE API 回應錯誤: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('TWSE 回傳資料為空');
    }

    console.log(`[TWSE] 成功取得 ${data.length} 筆資料`);

    // Open API 回傳格式：
    // Code, Name, TradeVolume, TradeValue, OpeningPrice, HighestPrice, LowestPrice, ClosingPrice, Change, Transaction
    return data.map((item: any) => {
        const closingPrice = parseFloat(item.ClosingPrice) || 0;
        const change = parseFloat(item.Change) || 0;
        const prevClose = closingPrice - change;
        const changePercent = prevClose > 0 ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;

        return {
            code: item.Code?.trim() || '',
            name: item.Name?.trim() || '',
            tradeVolume: parseInt(item.TradeVolume) || 0,
            tradeValue: parseInt(item.TradeValue) || 0,
            openingPrice: parseFloat(item.OpeningPrice) || 0,
            highestPrice: parseFloat(item.HighestPrice) || 0,
            lowestPrice: parseFloat(item.LowestPrice) || 0,
            closingPrice,
            change,
            changePercent,
            transaction: parseInt(item.Transaction) || 0,
            market: 'twse' as const,
        };
    }).filter((s: StockData) => s.code && s.closingPrice > 0);
}

/**
 * 從 TPEX Open API 取得上櫃股票資料
 * URL: https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes
 */
async function fetchTPEX(): Promise<StockData[]> {
    const url = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';

    console.log('[TPEX] 使用 Open API 取得資料...');

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`TPEX API 回應錯誤: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('TPEX 回傳資料為空');
    }

    console.log(`[TPEX] 成功取得 ${data.length} 筆資料`);

    // Open API 回傳格式：
    // SecuritiesCompanyCode, CompanyName, Close, Change, Open, High, Low, TradingVolume, TransactionAmount
    return data.map((item: any) => {
        const closingPrice = parseFloat(item.Close) || 0;
        const change = parseFloat(item.Change) || 0;
        const prevClose = closingPrice - change;
        const changePercent = prevClose > 0 ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;

        return {
            code: item.SecuritiesCompanyCode?.trim() || '',
            name: item.CompanyName?.trim() || '',
            closingPrice,
            change,
            changePercent,
            tradeVolume: parseInt(item.TradingVolume) || 0,
            tradeValue: parseInt(item.TransactionAmount) || 0,
            openingPrice: parseFloat(item.Open) || 0,
            highestPrice: parseFloat(item.High) || 0,
            lowestPrice: parseFloat(item.Low) || 0,
            transaction: 0, // TPEX API 不提供此欄位
            market: 'tpex' as const,
        };
    }).filter((s: StockData) => s.code && s.closingPrice > 0);
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const marketParam = searchParams.get('market') || 'all';

    let stocks: StockData[] = [];
    const errors: string[] = [];
    let twseCount = 0;
    let tpexCount = 0;

    // 取得 TWSE 資料
    if (marketParam === 'all' || marketParam === 'twse') {
        try {
            const twseStocks = await fetchTWSE();
            if (twseStocks.length > 0) {
                stocks.push(...twseStocks);
                twseCount = twseStocks.length;
            }
        } catch (twseError: any) {
            errors.push(`TWSE: ${twseError.message}`);
            console.error('[TWSE] 錯誤:', twseError.message);
        }
    }

    // 取得 TPEX 資料
    if (marketParam === 'all' || marketParam === 'tpex') {
        try {
            const tpexStocks = await fetchTPEX();
            if (tpexStocks.length > 0) {
                stocks.push(...tpexStocks);
                tpexCount = tpexStocks.length;
            }
        } catch (tpexError: any) {
            errors.push(`TPEX: ${tpexError.message}`);
            console.error('[TPEX] 錯誤:', tpexError.message);
        }
    }

    if (stocks.length === 0) {
        return NextResponse.json({
            success: false,
            error: '無法取得台股資料',
            details: errors,
            stocks: [],
        }, { status: 503 });
    }

    return NextResponse.json({
        success: true,
        stocks: stocks.slice(0, 300),
        total: stocks.length,
        source: 'openapi',
        markets: { twse: twseCount, tpex: tpexCount },
    });
}
