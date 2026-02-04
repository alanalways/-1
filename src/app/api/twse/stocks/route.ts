/**
 * TWSE 股票資料 API
 * 透過後端代理取得 TWSE 資料以避免 CORS 問題
 */

import { NextResponse } from 'next/server';

// 台灣證交所交易時間設定
const TRADING_HOURS = {
    start: 9,   // 09:00
    end: 13.5,  // 13:30
};

// 台灣公休日（2024-2025）- 可以從外部 API 取得
const HOLIDAYS_2025 = [
    '2025-01-01', // 元旦
    '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', // 農曆春節
    '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',
    '2025-02-28', // 和平紀念日
    '2025-04-04', '2025-04-05', // 清明節
    '2025-05-01', // 勞動節
    '2025-05-31', '2025-06-01', '2025-06-02', // 端午節
    '2025-10-06', '2025-10-07', '2025-10-08', // 中秋節
    '2025-10-10', // 國慶日
];

/**
 * 判斷是否為交易日
 */
function isTradingDay(date: Date): boolean {
    const day = date.getDay();
    // 週六(6)、週日(0) 不開盤
    if (day === 0 || day === 6) {
        return false;
    }

    // 檢查是否為公休日
    const dateStr = date.toISOString().split('T')[0];
    if (HOLIDAYS_2025.includes(dateStr)) {
        return false;
    }

    return true;
}

/**
 * 判斷是否在交易時間內
 */
function isTradingHours(date: Date): boolean {
    if (!isTradingDay(date)) {
        return false;
    }

    const hours = date.getHours() + date.getMinutes() / 60;
    return hours >= TRADING_HOURS.start && hours <= TRADING_HOURS.end;
}

/**
 * 取得最近的交易日日期字串
 */
function getLatestTradingDate(): string {
    const now = new Date();
    // 調整為台灣時區
    const taiwanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));

    // 如果今天是交易日且已過開盤時間，使用今天
    if (isTradingDay(taiwanTime) && taiwanTime.getHours() >= TRADING_HOURS.start) {
        return formatDate(taiwanTime);
    }

    // 否則往前找最近的交易日
    const checkDate = new Date(taiwanTime);
    for (let i = 0; i < 10; i++) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (isTradingDay(checkDate)) {
            return formatDate(checkDate);
        }
    }

    // Fallback: 返回今天
    return formatDate(taiwanTime);
}

function formatDate(date: Date): string {
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        let dateParam = searchParams.get('date');

        // 如果沒有指定日期，使用最近的交易日
        const dateStr = dateParam || getLatestTradingDate();

        // 取得台灣時間
        const now = new Date();
        const taiwanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));

        // 檢查是否在交易時間
        const inTradingHours = isTradingHours(taiwanTime);

        // 嘗試從 TWSE 取得資料
        const twseUrl = `https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${dateStr}&type=ALLBUT0999`;

        const response = await fetch(twseUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
            next: { revalidate: inTradingHours ? 60 : 300 }, // 交易時間 1 分鐘快取，否則 5 分鐘
        });

        if (!response.ok) {
            return NextResponse.json({
                success: false,
                error: `TWSE API 回應錯誤: ${response.status}`,
                date: dateStr,
                isTradingDay: isTradingDay(taiwanTime),
                inTradingHours,
            }, { status: 502 });
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
                isTradingDay: isTradingDay(taiwanTime),
                inTradingHours,
                stockCount: stocks.length,
                stocks,
            });
        }

        // 如果 TWSE 回傳 stat 不是 OK（通常是非交易日）
        return NextResponse.json({
            success: false,
            error: data.stat === 'OK' ? '無股票資料' : `TWSE 回傳: ${data.stat || '無資料'}`,
            date: dateStr,
            isTradingDay: isTradingDay(taiwanTime),
            inTradingHours,
            twseMessage: data.stat,
        }, { status: 404 });

    } catch (error) {
        console.error('[TWSE API] 錯誤:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '取得 TWSE 資料失敗',
        }, { status: 500 });
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
