/**
 * Yahoo Finance 歷史資料 API
 * 取得股票/指數的歷史 K 線資料
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol');
        const range = searchParams.get('range') || '1mo';

        if (!symbol) {
            return NextResponse.json({
                success: false,
                error: '請提供 symbol 參數',
            }, { status: 400 });
        }

        // 驗證 range 參數
        const validRanges = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y'];
        if (!validRanges.includes(range)) {
            return NextResponse.json({
                success: false,
                error: `無效的 range 參數，有效值: ${validRanges.join(', ')}`,
            }, { status: 400 });
        }

        // 根據 range 決定 interval
        const intervalMap: Record<string, string> = {
            '1d': '5m',
            '5d': '15m',
            '1mo': '1d',
            '3mo': '1d',
            '6mo': '1d',
            '1y': '1wk',
            '5y': '1mo',
        };
        const interval = intervalMap[range] || '1d';

        // 呼叫 Yahoo Finance API
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;

        const response = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            next: { revalidate: range === '1d' ? 60 : 300 }, // 日內資料 1 分鐘快取，其他 5 分鐘
        });

        if (!response.ok) {
            return NextResponse.json({
                success: false,
                error: `Yahoo API 回應錯誤: ${response.status}`,
            }, { status: 502 });
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            return NextResponse.json({
                success: false,
                error: '無法解析 Yahoo API 回應',
            }, { status: 502 });
        }

        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};

        if (timestamps.length === 0) {
            return NextResponse.json({
                success: false,
                error: '無歷史資料',
            }, { status: 404 });
        }

        // 轉換為標準格式
        const history = timestamps.map((ts: number, i: number) => ({
            time: ts, // Unix timestamp
            date: new Date(ts * 1000).toISOString(),
            open: quote.open?.[i] || 0,
            high: quote.high?.[i] || 0,
            low: quote.low?.[i] || 0,
            close: quote.close?.[i] || 0,
            volume: quote.volume?.[i] || 0,
        })).filter((d: { close: number }) => d.close > 0); // 過濾無效資料

        return NextResponse.json({
            success: true,
            symbol,
            range,
            interval,
            dataCount: history.length,
            history,
            meta: {
                currency: result.meta?.currency,
                exchangeName: result.meta?.exchangeName,
                instrumentType: result.meta?.instrumentType,
            },
        });

    } catch (error) {
        console.error('[Yahoo History API] 錯誤:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '取得歷史資料失敗',
        }, { status: 500 });
    }
}
