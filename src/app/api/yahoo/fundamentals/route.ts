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
        // modules: 
        // - summaryDetail: PE, PB, dividendYield
        // - defaultKeyStatistics: ROE, bookValue, enterpriseValue
        // - financialData: freeCashflow, currentPrice, targetMeanPrice
        const modules = 'summaryDetail,defaultKeyStatistics,financialData';
        const yahooUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;

        const response = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            next: { revalidate: 3600 }, // 基本面資料較不頻繁變動，快取 1 小時
        });

        if (!response.ok) {
            return NextResponse.json({
                success: false,
                error: `Yahoo API 回應錯誤: ${response.status}`,
            }, { status: 502 });
        }

        const data = await response.json();
        const result = data.quoteSummary?.result?.[0];

        if (!result) {
            return NextResponse.json({
                success: false,
                error: '無法解析 Yahoo API 回應',
            }, { status: 502 });
        }

        const summaryDetail = result.summaryDetail || {};
        const keyStats = result.defaultKeyStatistics || {};
        const financialData = result.financialData || {};

        // 提取有用數據
        const fundamentals = {
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

        return NextResponse.json({
            success: true,
            symbol,
            fundamentals,
        });

    } catch (error) {
        console.error('[Yahoo Fundamentals API] 錯誤:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '取得基本面資料失敗',
        }, { status: 500 });
    }
}
