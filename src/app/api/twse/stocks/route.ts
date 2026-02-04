/**
 * TWSE 股票資料 API
 * 透過後端代理取得 TWSE 資料以避免 CORS 問題
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');

        // 格式化日期（TWSE 格式：YYYYMMDD）
        const today = new Date();
        const dateStr = dateParam || `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

        // 嘗試從 TWSE 取得資料
        // 注意：TWSE API 可能有請求頻率限制
        const twseUrl = `https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${dateStr}&type=ALLBUT0999`;

        const response = await fetch(twseUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
            next: { revalidate: 300 }, // 快取 5 分鐘
        });

        if (!response.ok) {
            // 如果 TWSE API 失敗，返回模擬資料
            return NextResponse.json({
                success: true,
                source: 'mock',
                stocks: getMockStocks(),
            });
        }

        const data = await response.json();

        // 解析 TWSE 回傳格式
        if (data.stat === 'OK' && data.data9) {
            const stocks = data.data9.map((row: string[]) => ({
                code: row[0],           // 證券代號
                name: row[1],           // 證券名稱
                tradeVolume: parseInt(row[2].replace(/,/g, ''), 10) || 0,    // 成交股數
                transaction: parseInt(row[3].replace(/,/g, ''), 10) || 0,     // 成交筆數
                tradeValue: parseInt(row[4].replace(/,/g, ''), 10) || 0,      // 成交金額
                openingPrice: parseFloat(row[5].replace(/,/g, '')) || 0,      // 開盤價
                highestPrice: parseFloat(row[6].replace(/,/g, '')) || 0,      // 最高價
                lowestPrice: parseFloat(row[7].replace(/,/g, '')) || 0,       // 最低價
                closingPrice: parseFloat(row[8].replace(/,/g, '')) || 0,      // 收盤價
                change: parseChange(row[9], row[10]),                          // 漲跌
                changePercent: calculateChangePercent(parseFloat(row[8].replace(/,/g, '')) || 0, parseChange(row[9], row[10])),
            })).filter((s: { closingPrice: number }) => s.closingPrice > 0);

            return NextResponse.json({
                success: true,
                source: 'twse',
                date: dateStr,
                stocks,
            });
        }

        // 如果資料格式不符，返回模擬資料
        return NextResponse.json({
            success: true,
            source: 'mock',
            message: 'TWSE 資料格式不符或無資料',
            stocks: getMockStocks(),
        });

    } catch (error) {
        console.error('[TWSE API] 錯誤:', error);
        return NextResponse.json({
            success: true,
            source: 'mock',
            error: '取得 TWSE 資料失敗',
            stocks: getMockStocks(),
        });
    }
}

/**
 * 解析漲跌值
 */
function parseChange(direction: string, value: string): number {
    const numValue = parseFloat(value.replace(/,/g, '')) || 0;
    if (direction === '-' || direction.includes('green')) {
        return -numValue;
    }
    return numValue;
}

/**
 * 計算漲跌幅
 */
function calculateChangePercent(closingPrice: number, change: number): number {
    if (closingPrice === 0 || closingPrice === change) return 0;
    const previousPrice = closingPrice - change;
    if (previousPrice === 0) return 0;
    return (change / previousPrice) * 100;
}

/**
 * 模擬台股資料
 */
function getMockStocks() {
    const baseData = [
        { code: '2330', name: '台積電', basePrice: 1120, volume: 25000000 },
        { code: '2317', name: '鴻海', basePrice: 200, volume: 35000000 },
        { code: '2454', name: '聯發科', basePrice: 1395, volume: 8500000 },
        { code: '2412', name: '中華電', basePrice: 120, volume: 5400000 },
        { code: '2881', name: '富邦金', basePrice: 90, volume: 18500000 },
        { code: '2882', name: '國泰金', basePrice: 60, volume: 15400000 },
        { code: '2303', name: '聯電', basePrice: 55, volume: 42000000 },
        { code: '3711', name: '日月光投控', basePrice: 170, volume: 12500000 },
        { code: '2308', name: '台達電', basePrice: 420, volume: 6500000 },
        { code: '1301', name: '台塑', basePrice: 58, volume: 8500000 },
        { code: '1303', name: '南亞', basePrice: 58, volume: 7500000 },
        { code: '2886', name: '兆豐金', basePrice: 44, volume: 14500000 },
        { code: '2891', name: '中信金', basePrice: 33, volume: 22500000 },
        { code: '2892', name: '第一金', basePrice: 29, volume: 18500000 },
        { code: '3008', name: '大立光', basePrice: 2350, volume: 1250000 },
        { code: '2002', name: '中鋼', basePrice: 23, volume: 35400000 },
        { code: '1216', name: '統一', basePrice: 70, volume: 8500000 },
        { code: '2912', name: '統一超', basePrice: 288, volume: 3250000 },
        { code: '2357', name: '華碩', basePrice: 560, volume: 4500000 },
        { code: '2382', name: '廣達', basePrice: 330, volume: 12500000 },
        { code: '2884', name: '玉山金', basePrice: 28.5, volume: 25000000 },
        { code: '2890', name: '永豐金', basePrice: 22, volume: 18000000 },
        { code: '2883', name: '開發金', basePrice: 17.5, volume: 28000000 },
        { code: '3045', name: '台灣大', basePrice: 108, volume: 4500000 },
        { code: '4904', name: '遠傳', basePrice: 85, volume: 3800000 },
    ];

    return baseData.map(stock => {
        const changePercent = (Math.random() - 0.5) * 6; // -3% ~ +3%
        const change = stock.basePrice * (changePercent / 100);
        const closingPrice = stock.basePrice + change;
        const volumeVariance = 0.8 + Math.random() * 0.4;

        return {
            code: stock.code,
            name: stock.name,
            tradeVolume: Math.floor(stock.volume * volumeVariance),
            tradeValue: Math.floor(closingPrice * stock.volume * volumeVariance),
            openingPrice: parseFloat((stock.basePrice * (0.99 + Math.random() * 0.02)).toFixed(2)),
            highestPrice: parseFloat((closingPrice * (1 + Math.random() * 0.02)).toFixed(2)),
            lowestPrice: parseFloat((closingPrice * (1 - Math.random() * 0.02)).toFixed(2)),
            closingPrice: parseFloat(closingPrice.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            transaction: Math.floor(stock.volume / 1000 * (0.8 + Math.random() * 0.4)),
        };
    });
}
