/**
 * AI 分析 API 路由
 * 安全地在服務端執行 Gemini 分析，API Key 不會暴露給客戶端
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeStock, initGemini, AnalysisResult } from '@/services/gemini';
import { getApiKeys } from '@/services/apiKeys';

// 初始化標記
let isInitialized = false;

/**
 * 確保 Gemini 服務已初始化
 */
async function ensureGeminiReady(): Promise<boolean> {
    if (isInitialized) return true;

    try {
        // 優先從環境變數讀取
        const envKey = process.env.GEMINI_API_KEY;
        if (envKey) {
            initGemini(envKey.split(',').map(k => k.trim()));
            isInitialized = true;
            console.log('[AI API] 從環境變數初始化 Gemini 成功');
            return true;
        }

        // 從 Supabase 讀取
        const keys = await getApiKeys('gemini');
        if (keys.length > 0) {
            initGemini(keys);
            isInitialized = true;
            console.log(`[AI API] 從 Supabase 初始化 Gemini 成功 (${keys.length} 組金鑰)`);
            return true;
        }

        console.error('[AI API] 無法取得任何 Gemini API Key');
        return false;
    } catch (error) {
        console.error('[AI API] 初始化失敗:', error);
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { code, name, price, changePercent, technical, fundamental } = body;

        if (!code || !price) {
            return NextResponse.json({
                success: false,
                error: '缺少必要參數 (code, price)',
            }, { status: 400 });
        }

        // 確保 Gemini 已初始化
        const ready = await ensureGeminiReady();
        if (!ready) {
            return NextResponse.json({
                success: false,
                error: '服務暫時無法使用，請稍後再試',
            }, { status: 503 });
        }

        // 執行 AI 分析
        const result = await analyzeStock({
            code,
            name: name || code,
            price,
            changePercent,
            technical,
            fundamental,
        });

        if (!result) {
            return NextResponse.json({
                success: false,
                error: 'AI 分析失敗，請稍後再試',
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            result,
        });

    } catch (error) {
        console.error('[AI API] 錯誤:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '發生未知錯誤',
        }, { status: 500 });
    }
}
