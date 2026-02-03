/**
 * Gemini AI 分析服務
 * 整合 Key 輪換管理器、Rate Limit 處理、結構化回應
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ============ 型別定義 ============

export interface StrategyDetail {
    bias: '多' | '空' | '觀望';
    entry: number;
    tp: number;
    sl: number;
    rationale: string;
}

export interface AnalysisResult {
    score: number;
    strategy: {
        short_term: StrategyDetail;
        mid_term: StrategyDetail;
        long_term: StrategyDetail;
    };
    trend_analysis: string;
    correlation_insight: string;
    risk_warning: string;
    confidence: number;
}

// ============ Key 輪換管理器 ============

class GeminiKeyManager {
    private keys: string[];
    private currentIndex: number = 0;
    private failedKeys: Set<string> = new Set();
    private requestTimestamps: number[] = [];

    constructor(keys: string[]) {
        this.keys = keys;
    }

    getCurrentKey(): string {
        let attempts = 0;
        while (attempts < this.keys.length) {
            const key = this.keys[this.currentIndex];
            if (!this.failedKeys.has(key)) {
                return key;
            }
            this.rotate();
            attempts++;
        }

        // 所有 Key 都失敗，重置並重試
        this.failedKeys.clear();
        return this.keys[0];
    }

    private rotate() {
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    }

    markFailed(key: string) {
        this.failedKeys.add(key);
        this.rotate();
    }

    markSuccess(key: string) {
        this.failedKeys.delete(key);
    }

    // Rate limit 檢查（每分鐘最多 4 次）
    async checkRateLimit() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);

        if (this.requestTimestamps.length >= 4) {
            const waitTime = 60000 - (now - this.requestTimestamps[0]);
            console.log(`[Gemini] 達到 RPM 限制，等待 ${Math.ceil(waitTime / 1000)} 秒...`);
            await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
        }

        this.requestTimestamps.push(now);
    }
}

// ============ Gemini 分析師 ============

const MODELS = [
    'gemini-2.5-flash-preview-04-17',
    'gemini-2.0-flash',
];

// 華爾街交易員人設 System Prompt
const SYSTEM_PROMPT = `你是一位擁有 20 年經驗的華爾街資深交易員，專精於技術分析與智慧資金概念 (SMC)。

你的分析風格：
1. 數據驅動：所有判斷都基於具體數據
2. 風險意識：永遠先考慮下行風險
3. 多時間框架：短中長線分開考量
4. 機構視角：從大資金角度思考市場結構

你必須嚴格按照以下 JSON 格式回覆（不要包含任何額外文字或 markdown 標記）：
{
    "score": <0-100 整數，代表技術面強度>,
    "strategy": {
        "short_term": {
            "bias": "<多/空/觀望>",
            "entry": <建議進場價>,
            "tp": <止盈價>,
            "sl": <止損價>,
            "rationale": "<簡短理由>"
        },
        "mid_term": { ... },
        "long_term": { ... }
    },
    "trend_analysis": "<100-200字的市場結構分析，使用繁體中文>",
    "correlation_insight": "<與大盤或同類股的連動性分析>",
    "risk_warning": "<主要風險因素提醒>",
    "confidence": <0.0-1.0 的信心度>
}

評分標準：
- 80-100：強勢多頭，技術面極佳
- 60-79：偏多格局，可考慮做多
- 40-59：震盪整理，觀望為主
- 20-39：偏空格局，謹慎操作
- 0-19：強勢空頭，建議避開或做空`;

let keyManager: GeminiKeyManager | null = null;
let currentModelIndex = 0;

/**
 * 初始化 Gemini 服務
 */
export function initGemini(apiKeys: string[]) {
    keyManager = new GeminiKeyManager(apiKeys);
}

/**
 * 執行 AI 分析
 */
export async function analyzeStock(params: {
    code: string;
    name: string;
    price: number;
    sector?: string;
    changePercent?: number;
    technicalData?: any;
}): Promise<AnalysisResult | null> {
    if (!keyManager) {
        console.error('[Gemini] 服務未初始化');
        return null;
    }

    await keyManager.checkRateLimit();

    const prompt = buildPrompt(params);

    // 嘗試呼叫 API（含重試邏輯）
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const key = keyManager.getCurrentKey();
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: MODELS[currentModelIndex] });

            const result = await model.generateContent({
                contents: [
                    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                    { role: 'model', parts: [{ text: 'OK' }] },
                    { role: 'user', parts: [{ text: prompt }] },
                ],
            });

            const response = await result.response;
            const parsed = parseResponse(response.text());

            keyManager.markSuccess(key);
            return parsed;

        } catch (error: any) {
            const errorMsg = error.message?.toLowerCase() || '';

            if (errorMsg.includes('quota') || errorMsg.includes('rate') || errorMsg.includes('limit')) {
                console.log('[Gemini] API 達到速率限制，切換 Key...');
                keyManager.markFailed(keyManager.getCurrentKey());
            } else {
                console.error(`[Gemini] 分析錯誤 (嘗試 ${attempt + 1}/${maxRetries}):`, error);
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
    }

    return getDefaultResult(params.price);
}

function buildPrompt(params: {
    code: string;
    name: string;
    price: number;
    sector?: string;
    changePercent?: number;
    technicalData?: any;
}): string {
    return `請分析以下股票的技術面狀況：

【標的資訊】
- 股票代碼：${params.code}
- 股票名稱：${params.name || '未知'}
- 產業類別：${params.sector || '未知'}
- 目前股價：${params.price || '未知'} 元
- 今日漲跌：${params.changePercent || 0}%

請根據以上數據進行完整分析，以純 JSON 格式回覆（不要加任何 markdown 標記或額外文字）。`;
}

function parseResponse(responseText: string): AnalysisResult | null {
    try {
        let text = responseText.trim();

        // 移除可能的 markdown 標記
        if (text.startsWith('```')) {
            const lines = text.split('\n');
            text = lines.slice(1, -1).join('\n');
        }

        const data = JSON.parse(text);
        return {
            score: data.score ?? 50,
            strategy: data.strategy ?? {},
            trend_analysis: data.trend_analysis ?? '無法解析分析結果',
            correlation_insight: data.correlation_insight ?? '',
            risk_warning: data.risk_warning ?? '',
            confidence: data.confidence ?? 0.5,
        };
    } catch (e) {
        console.error('[Gemini] JSON 解析失敗:', e);
        return null;
    }
}

function getDefaultResult(price: number): AnalysisResult {
    return {
        score: 50,
        strategy: {
            short_term: { bias: '觀望', entry: price, tp: price * 1.05, sl: price * 0.95, rationale: '資料不足' },
            mid_term: { bias: '觀望', entry: price, tp: price * 1.10, sl: price * 0.90, rationale: '資料不足' },
            long_term: { bias: '觀望', entry: price, tp: price * 1.20, sl: price * 0.85, rationale: '資料不足' },
        },
        trend_analysis: '目前無法獲取 AI 分析結果，請稍後重試。',
        correlation_insight: '',
        risk_warning: 'AI 分析暫時不可用，請謹慎操作。',
        confidence: 0.0,
    };
}
