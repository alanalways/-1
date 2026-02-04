/**
 * Yahoo Finance 報價 API
 * 代理 Yahoo Finance API 取得國際指數報價
 */

import { NextResponse } from 'next/server';

// 國際指數資訊
const INDICES_INFO: Record<string, { name: string; region: string; emoji: string }> = {
    '^GSPC': { name: 'S&P 500', region: '美國', emoji: '🇺🇸' },
    '^DJI': { name: 'Dow Jones', region: '美國', emoji: '🇺🇸' },
    '^IXIC': { name: 'Nasdaq', region: '美國', emoji: '🇺🇸' },
    '^GDAXI': { name: 'DAX', region: '歐洲', emoji: '🇩🇪' },
    '^FTSE': { name: 'FTSE 100', region: '歐洲', emoji: '🇬🇧' },
    '^FCHI': { name: 'CAC 40', region: '歐洲', emoji: '🇫🇷' },
    '^N225': { name: '日經 225', region: '亞洲', emoji: '🇯🇵' },
    '^HSI': { name: '恒生指數', region: '亞洲', emoji: '🇭🇰' },
    '000001.SS': { name: '上證指數', region: '亞洲', emoji: '🇨🇳' },
    '^TWII': { name: '台灣加權', region: '亞洲', emoji: '🇹🇼' },
};

export async function POST(request: Request) {
    try {
        const { symbols } = await request.json();

        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return NextResponse.json({
                success: false,
                error: '請提供有效的 symbols 陣列',
            }, { status: 400 });
        }

        // 使用 Yahoo Finance v8 API
        const symbolsStr = symbols.join(',');
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbols[0])}?interval=1d&range=1d`;

        // 單獨取得每個指數的資料
        const quotes = await Promise.all(
            symbols.map(async (symbol: string) => {
                try {
                    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
                    const response = await fetch(yahooUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        },
                        next: { revalidate: 60 }, // 快取 1 分鐘
                    });

                    if (!response.ok) {
                        console.warn(`[Yahoo] ${symbol} API 錯誤: ${response.status}`);
                        return null;
                    }

                    const data = await response.json();
                    const result = data.chart?.result?.[0];

                    if (!result) {
                        return null;
                    }

                    const meta = result.meta;
                    const quote = result.indicators?.quote?.[0];
                    const timestamps = result.timestamp || [];

                    // 取得最新的價格
                    const lastIndex = timestamps.length - 1;
                    const close = quote?.close?.[lastIndex] || meta.regularMarketPrice || 0;
                    const previousClose = meta.previousClose || meta.chartPreviousClose || close;
                    const change = close - previousClose;
                    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

                    const info = INDICES_INFO[symbol] || { name: symbol, region: '其他', emoji: '📊' };

                    return {
                        symbol,
                        name: info.name,
                        region: info.region,
                        emoji: info.emoji,
                        price: close,
                        change,
                        changePercent,
                        previousClose,
                        open: quote?.open?.[lastIndex] || meta.regularMarketOpen || 0,
                        dayHigh: quote?.high?.[lastIndex] || meta.regularMarketDayHigh || 0,
                        dayLow: quote?.low?.[lastIndex] || meta.regularMarketDayLow || 0,
                        volume: quote?.volume?.[lastIndex] || meta.regularMarketVolume || 0,
                        marketState: meta.marketState || 'CLOSED',
                    };
                } catch (err) {
                    console.error(`[Yahoo] ${symbol} 取得失敗:`, err);
                    return null;
                }
            })
        );

        const validQuotes = quotes.filter(q => q !== null);

        if (validQuotes.length === 0) {
            return NextResponse.json({
                success: false,
                error: '無法取得任何指數資料',
            }, { status: 502 });
        }

        return NextResponse.json({
            success: true,
            quotes: validQuotes,
            fetchedCount: validQuotes.length,
            requestedCount: symbols.length,
        });

    } catch (error) {
        console.error('[Yahoo Quotes API] 錯誤:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '取得報價資料失敗',
        }, { status: 500 });
    }
}
