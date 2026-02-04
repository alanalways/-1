/**
 * TWSE 台股 API 代理
 * 因 CORS 限制，需透過後端代理取得 TWSE 資料
 */

import { NextRequest, NextResponse } from 'next/server';

// 模擬台股資料
const getMockStocks = () => {
    const mockData = [
        { code: '2330', name: '台積電', tradeVolume: 25483210, tradeValue: 28531247000, openingPrice: 1115, highestPrice: 1125, lowestPrice: 1110, closingPrice: 1120, change: 10, changePercent: 0.90, transaction: 45231 },
        { code: '2317', name: '鴻海', tradeVolume: 35421870, tradeValue: 7084374000, openingPrice: 198, highestPrice: 201, lowestPrice: 197, closingPrice: 200, change: 3, changePercent: 1.52, transaction: 28156 },
        { code: '2454', name: '聯發科', tradeVolume: 8541230, tradeValue: 11903514900, openingPrice: 1385, highestPrice: 1400, lowestPrice: 1380, closingPrice: 1395, change: 15, changePercent: 1.09, transaction: 18542 },
        { code: '2412', name: '中華電', tradeVolume: 5412360, tradeValue: 648883200, openingPrice: 119, highestPrice: 120, lowestPrice: 118, closingPrice: 120, change: 1, changePercent: 0.84, transaction: 8541 },
        { code: '2881', name: '富邦金', tradeVolume: 18542360, tradeValue: 1668812400, openingPrice: 89, highestPrice: 90.5, lowestPrice: 88.5, closingPrice: 90, change: 1.5, changePercent: 1.69, transaction: 15423 },
        { code: '2882', name: '國泰金', tradeVolume: 15423650, tradeValue: 925419000, openingPrice: 59.5, highestPrice: 60.5, lowestPrice: 59, closingPrice: 60, change: 0.8, changePercent: 1.35, transaction: 12365 },
        { code: '2303', name: '聯電', tradeVolume: 42365120, tradeValue: 2330081600, openingPrice: 54.5, highestPrice: 55.5, lowestPrice: 54, closingPrice: 55, change: 0.8, changePercent: 1.48, transaction: 25412 },
        { code: '3711', name: '日月光投控', tradeVolume: 12541230, tradeValue: 2132809100, openingPrice: 168, highestPrice: 171, lowestPrice: 167, closingPrice: 170, change: 3, changePercent: 1.80, transaction: 14523 },
        { code: '2308', name: '台達電', tradeVolume: 6541250, tradeValue: 2747325000, openingPrice: 418, highestPrice: 422, lowestPrice: 416, closingPrice: 420, change: 5, changePercent: 1.20, transaction: 9852 },
        { code: '1301', name: '台塑', tradeVolume: 8541236, tradeValue: 495392888, openingPrice: 57.5, highestPrice: 58.5, lowestPrice: 57, closingPrice: 58, change: 0.8, changePercent: 1.40, transaction: 7541 },
        { code: '1303', name: '南亞', tradeVolume: 7541236, tradeValue: 437392692, openingPrice: 57.5, highestPrice: 58.5, lowestPrice: 57, closingPrice: 58, change: -0.5, changePercent: -0.85, transaction: 6541 },
        { code: '2886', name: '兆豐金', tradeVolume: 14523650, tradeValue: 639040600, openingPrice: 43.5, highestPrice: 44.5, lowestPrice: 43, closingPrice: 44, change: 0.5, changePercent: 1.15, transaction: 11254 },
        { code: '2891', name: '中信金', tradeVolume: 22541360, tradeValue: 744864880, openingPrice: 32.8, highestPrice: 33.5, lowestPrice: 32.5, closingPrice: 33, change: 0.3, changePercent: 0.92, transaction: 16542 },
        { code: '2892', name: '第一金', tradeVolume: 18542360, tradeValue: 537728440, openingPrice: 28.8, highestPrice: 29.2, lowestPrice: 28.5, closingPrice: 29, change: 0.3, changePercent: 1.05, transaction: 13254 },
        { code: '3008', name: '大立光', tradeVolume: 1254123, tradeValue: 2947186305, openingPrice: 2340, highestPrice: 2360, lowestPrice: 2330, closingPrice: 2350, change: 20, changePercent: 0.86, transaction: 5412 },
        { code: '2002', name: '中鋼', tradeVolume: 35412360, tradeValue: 813484280, openingPrice: 22.8, highestPrice: 23.2, lowestPrice: 22.5, closingPrice: 23, change: 0.3, changePercent: 1.32, transaction: 18542 },
        { code: '1216', name: '統一', tradeVolume: 8541236, tradeValue: 597686520, openingPrice: 69.5, highestPrice: 70.5, lowestPrice: 69, closingPrice: 70, change: 0.8, changePercent: 1.16, transaction: 7854 },
        { code: '2912', name: '統一超', tradeVolume: 3254123, tradeValue: 936436236, openingPrice: 286, highestPrice: 290, lowestPrice: 285, closingPrice: 288, change: 4, changePercent: 1.41, transaction: 4521 },
        { code: '2357', name: '華碩', tradeVolume: 4521360, tradeValue: 2531161600, openingPrice: 558, highestPrice: 565, lowestPrice: 555, closingPrice: 560, change: 8, changePercent: 1.45, transaction: 6254 },
        { code: '2382', name: '廣達', tradeVolume: 12541230, tradeValue: 4140614490, openingPrice: 328, highestPrice: 333, lowestPrice: 326, closingPrice: 330, change: 5, changePercent: 1.54, transaction: 14523 },
    ];

    // 隨機調整價格模擬即時變化
    return mockData.map(stock => ({
        ...stock,
        closingPrice: parseFloat((stock.closingPrice * (0.98 + Math.random() * 0.04)).toFixed(2)),
        change: parseFloat((stock.change * (0.5 + Math.random())).toFixed(2)),
        changePercent: parseFloat((stock.changePercent * (0.5 + Math.random())).toFixed(2)),
        tradeVolume: Math.floor(stock.tradeVolume * (0.8 + Math.random() * 0.4)),
    }));
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');

        // 使用當前日期或參數日期
        // 注意：由於 TWSE API 只提供過去的資料，這裡直接返回模擬資料
        // 實際部署時可以透過 TWSE API 取得真實資料

        console.log(`[TWSE API] 請求日期: ${dateParam}`);

        // 嘗試從 TWSE 取得真實資料
        // 由於 CORS 限制和日期問題，這裡使用模擬資料作為備案
        try {
            // TWSE API 格式: https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=20241001&type=ALLBUT0999
            const twseUrl = `https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${dateParam}&type=ALLBUT0999`;

            const response = await fetch(twseUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://www.twse.com.tw/',
                },
                // 設定超時
                signal: AbortSignal.timeout(5000),
            });

            if (response.ok) {
                const data = await response.json();

                // TWSE 返回 stat 欄位表示狀態
                if (data.stat === 'OK' && data.data9) {
                    const stocks = data.data9.map((row: string[]) => ({
                        code: row[0],
                        name: row[1],
                        tradeVolume: parseInt(row[2]?.replace(/,/g, '') || '0', 10),
                        transaction: parseInt(row[3]?.replace(/,/g, '') || '0', 10),
                        tradeValue: parseInt(row[4]?.replace(/,/g, '') || '0', 10),
                        openingPrice: parseFloat(row[5]?.replace(/,/g, '') || '0'),
                        highestPrice: parseFloat(row[6]?.replace(/,/g, '') || '0'),
                        lowestPrice: parseFloat(row[7]?.replace(/,/g, '') || '0'),
                        closingPrice: parseFloat(row[8]?.replace(/,/g, '') || '0'),
                        change: parseFloat(row[10]?.replace(/,/g, '').replace('+', '') || '0'),
                        changePercent: 0, // TWSE 不直接提供漲跌幅，需計算
                    })).filter((s: any) => s.code && s.closingPrice > 0);

                    // 計算漲跌幅
                    stocks.forEach((s: any) => {
                        const prevClose = s.closingPrice - s.change;
                        if (prevClose > 0) {
                            s.changePercent = parseFloat(((s.change / prevClose) * 100).toFixed(2));
                        }
                    });

                    return NextResponse.json({
                        success: true,
                        date: dateParam,
                        stocks: stocks.slice(0, 100), // 限制回傳數量
                        source: 'twse',
                    });
                }
            }
        } catch (fetchError) {
            console.warn('[TWSE API] 無法取得即時資料，使用模擬資料:', fetchError);
        }

        // 返回模擬資料
        return NextResponse.json({
            success: true,
            date: dateParam,
            stocks: getMockStocks(),
            source: 'mock',
            message: '使用模擬資料（TWSE API 無法連線或日期無效）',
        });

    } catch (error) {
        console.error('[TWSE API] 錯誤:', error);
        return NextResponse.json({
            success: false,
            error: '取得台股資料失敗',
            stocks: getMockStocks(),
            source: 'mock',
        });
    }
}
