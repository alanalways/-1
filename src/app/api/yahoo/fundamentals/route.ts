/**
 * Yahoo Finance 基本面資料 API
 * 取得股票的 PE, PB, ROE, EPS 成長等數據
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol');

        if (!symbol) {
            return NextResponse.json({
                success: false,
                error: '請提供 symbol 參數',
            }, { status: 400 });
        }

        // Yahoo Finance v10 quoteSummary API
        const modules = 'summaryDetail,defaultKeyStatistics,financialData';

        // 多個備用端點（有些可能被特定 IP 封鎖）
        const endpoints = [
            `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`,
            `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`,
        ];

        let lastError = null;
        for (const yahooUrl of endpoints) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 秒逾時

                const response = await fetch(yahooUrl, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept': 'application/json,text/html,application/xhtml+xml',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Cache-Control': 'no-cache',
                    },
                    cache: 'no-store',
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    const result = data.quoteSummary?.result?.[0];
                    if (result) {
                        return NextResponse.json({
                            success: true,
                            symbol,
                            fundamentals: parseFundamentals(symbol, result),
                        });
                    }
                }
                lastError = `Yahoo API 回應錯誤: ${response.status}`;
            } catch (e: any) {
                lastError = e.name === 'AbortError' ? '請求逾時' : e.message;
            }
        }

        // 如果所有端點都失敗，返回基本資料（允許 AI 僅基於技術面分析）
        return NextResponse.json({
            success: false,
            error: lastError || '無法從 Yahoo 取得基本面資料，將僅使用技術面分析',
        }, { status: 502 });

    } catch (error) {
        console.error('[Yahoo Fundamentals API] 錯誤:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '取得基本面資料失敗',
        }, { status: 500 });
    }
}

/**
 * 解析 Yahoo API 回傳的數據
 */
function parseFundamentals(symbol: string, result: any) {
    const summaryDetail = result.summaryDetail || {};
    const keyStats = result.defaultKeyStatistics || {};
    const financialData = result.financialData || {};

    return {
        symbol,
        price: financialData.currentPrice?.raw || summaryDetail.previousClose?.raw || 0,
        pe: summaryDetail.forwardPE?.raw || summaryDetail.trailingPE?.raw || null,
        pb: summaryDetail.priceToBook?.raw || null,
        marketCap: summaryDetail.marketCap?.raw || null,
        dividendYield: summaryDetail.dividendYield?.raw || null,
        roe: financialData.returnOnEquity?.raw || keyStats.returnOnEquity?.raw || null,
        eps: keyStats.trailingEps?.raw || null,
        epsGrowth: keyStats.earningsGrowth?.raw || null,
        revenueGrowth: financialData.revenueGrowth?.raw || null,
        freeCashFlow: financialData.freeCashflow?.raw || null,
        totalCash: financialData.totalCash?.raw || null,
        totalDebt: financialData.totalDebt?.raw || null,
        targetPrice: financialData.targetMeanPrice?.raw || null,
        recommendation: financialData.recommendationKey || null,
    };
}
