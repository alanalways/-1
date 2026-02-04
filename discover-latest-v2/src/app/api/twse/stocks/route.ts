/**
 * TWSE + TPEX 台股 API
 * 使用官方 OpenAPI 取得即時股票資料
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
 * 從 TWSE OpenAPI 取得上市股票資料
 */
async function fetchTWSE(): Promise<StockData[]> {
    const url = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';

    console.log('[TWSE OpenAPI] 取得上市股票資料...');

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`TWSE OpenAPI 錯誤: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('TWSE OpenAPI 無資料');
    }

    console.log(`[TWSE OpenAPI] 成功取得 ${data.length} 筆上市股票`);

    return data.map((item: any) => {
        const closingPrice = parseFloat(item.ClosingPrice) || 0;
        const change = parseFloat(item.Change) || 0;
        const prevClose = closingPrice - change;
        const changePercent = prevClose > 0
            ? parseFloat(((change / prevClose) * 100).toFixed(2))
            : 0;

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
 * 從 TPEX OpenAPI 取得上櫃股票資料
 */
async function fetchTPEX(): Promise<StockData[]> {
    const url = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';

    console.log('[TPEX OpenAPI] 取得上櫃股票資料...');

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`TPEX OpenAPI 錯誤: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('TPEX OpenAPI 無資料');
    }

    console.log(`[TPEX OpenAPI] 成功取得 ${data.length} 筆上櫃股票`);

    return data.map((item: any) => {
        const closingPrice = parseFloat(item.Close) || 0;
        const change = parseFloat(item.Change) || 0;
        const prevClose = closingPrice - change;
        const changePercent = prevClose > 0
            ? parseFloat(((change / prevClose) * 100).toFixed(2))
            : 0;

        return {
            code: item.SecuritiesCompanyCode?.trim() || '',
            name: item.CompanyName?.trim() || '',
            closingPrice,
            change,
            changePercent,
            tradeVolume: parseInt(item.TradingShares) || 0,
            tradeValue: parseInt(item.TransactionAmount) || 0,
            openingPrice: parseFloat(item.Open) || 0,
            highestPrice: parseFloat(item.High) || 0,
            lowestPrice: parseFloat(item.Low) || 0,
            transaction: parseInt(item.TransactionNumber) || 0,
            market: 'tpex' as const,
        };
    }).filter((s: StockData) => s.code && s.closingPrice > 0);
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const marketParam = searchParams.get('market') || 'all';

    const stocks: StockData[] = [];
    const errors: string[] = [];
    let twseCount = 0;
    let tpexCount = 0;

    // 取得 TWSE 資料
    if (marketParam === 'all' || marketParam === 'twse') {
        try {
            const twseStocks = await fetchTWSE();
            stocks.push(...twseStocks);
            twseCount = twseStocks.length;
        } catch (error: any) {
            console.error('[TWSE]', error.message);
            errors.push(`TWSE: ${error.message}`);
        }
    }

    // 取得 TPEX 資料
    if (marketParam === 'all' || marketParam === 'tpex') {
        try {
            const tpexStocks = await fetchTPEX();
            stocks.push(...tpexStocks);
            tpexCount = tpexStocks.length;
        } catch (error: any) {
            console.error('[TPEX]', error.message);
            errors.push(`TPEX: ${error.message}`);
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
        markets: {
            twse: twseCount,
            tpex: tpexCount
        },
    });
}
