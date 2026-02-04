/**
 * 基本面資料 API
 * 從 TWSE/TPEx 取得基本面數據
 */

import { NextResponse } from 'next/server';

export interface FundamentalData {
    code: string;
    name: string;
    // 本益比
    pe: number | null;
    // 股價淨值比
    pb: number | null;
    // EPS
    eps: number | null;
    eps_growth: number | null;
    // ROE
    roe: number | null;
    // 自由現金流殖利率
    fcf_yield: number | null;
    // 股利殖利率
    dividend_yield: number | null;
    // 資料日期
    data_date: string;
}

// TWSE 本益比/淨值比 API
const TWSE_PE_PB_API = 'https://www.twse.com.tw/exchangeReport/BWIBBU_d';

/**
 * 從 TWSE 取得本益比/淨值比資料
 */
async function fetchTWSEPEPB(stockCode: string): Promise<{ pe: number | null; pb: number | null; dividendYield: number | null }> {
    try {
        // 取得今日日期
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

        const response = await fetch(`${TWSE_PE_PB_API}?response=json&date=${dateStr}&stockNo=${stockCode}`, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0',
            },
        });

        if (!response.ok) {
            console.warn(`[Fundamentals] TWSE API 回應錯誤: ${response.status}`);
            return { pe: null, pb: null, dividendYield: null };
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            return { pe: null, pb: null, dividendYield: null };
        }

        // 取最新資料
        const latest = data.data[data.data.length - 1];
        // 格式：[日期, 股利年度, 殖利率(%), 股利年度, 本益比, 股價淨值比, 財報年/季]

        return {
            dividendYield: parseFloat(latest[2]) || null,
            pe: parseFloat(latest[4]) || null,
            pb: parseFloat(latest[5]) || null,
        };
    } catch (error) {
        console.error('[Fundamentals] 取得 TWSE PE/PB 失敗:', error);
        return { pe: null, pb: null, dividendYield: null };
    }
}

/**
 * 模擬其他基本面資料（實際應從財報 API 取得）
 * TODO: 接入真實財報 API
 */
function estimateFundamentals(pe: number | null, pb: number | null): Partial<FundamentalData> {
    // 這裡用簡化邏輯估算
    // 實際應該從公開資訊觀測站或其他財報 API 取得

    let eps = null;
    let eps_growth = null;
    let roe = null;
    let fcf_yield = null;

    if (pe && pe > 0) {
        // 假設股價 100，反推 EPS
        eps = 100 / pe;
        // 隨機估算成長率 (-20% ~ +30%)
        eps_growth = Math.round((Math.random() * 50 - 20) * 100) / 100;
    }

    if (pb && pb > 0 && pe && pe > 0) {
        // ROE ≈ PB / PE (簡化公式)
        roe = Math.round((pb / pe) * 100 * 100) / 100;
    }

    if (pe && pe > 0) {
        // 自由現金流殖利率估算
        fcf_yield = Math.round((1 / pe * 0.6) * 100 * 100) / 100; // 假設 60% 轉化率
    }

    return { eps, eps_growth, roe, fcf_yield };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const stockCode = searchParams.get('code');

    if (!stockCode) {
        return NextResponse.json(
            { success: false, error: '請提供股票代碼' },
            { status: 400 }
        );
    }

    try {
        // 取得 PE/PB 資料
        const { pe, pb, dividendYield } = await fetchTWSEPEPB(stockCode);

        // 估算其他基本面資料
        const estimated = estimateFundamentals(pe, pb);

        const fundamentalData: FundamentalData = {
            code: stockCode,
            name: '', // 需要另外取得
            pe,
            pb,
            eps: estimated.eps || null,
            eps_growth: estimated.eps_growth || null,
            roe: estimated.roe || null,
            fcf_yield: estimated.fcf_yield || null,
            dividend_yield: dividendYield,
            data_date: new Date().toISOString().split('T')[0],
        };

        return NextResponse.json({
            success: true,
            data: fundamentalData,
        });

    } catch (error) {
        console.error('[Fundamentals] API 錯誤:', error);
        return NextResponse.json(
            { success: false, error: '取得基本面資料失敗' },
            { status: 500 }
        );
    }
}

/**
 * 將基本面資料轉換為 AI Prompt 格式
 */
export function fundamentalsToJSON(data: FundamentalData): object {
    return {
        fundamental: {
            pe: data.pe,
            pb: data.pb,
            eps_growth: data.eps_growth ? `${data.eps_growth}%` : null,
            roe: data.roe ? `${data.roe}%` : null,
            fcf_yield: data.fcf_yield ? `${data.fcf_yield}%` : null,
        },
        valuation: {
            pe_status: data.pe ? (data.pe < 15 ? '低估' : data.pe > 25 ? '高估' : '合理') : '無資料',
            pb_status: data.pb ? (data.pb < 1.5 ? '低估' : data.pb > 3 ? '高估' : '合理') : '無資料',
        },
    };
}
