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

// 新版 AI 分析結果結構
export interface AdvancedAnalysisResult {
    recommendation: 'buy' | 'sell' | 'hold';
    time_horizon: 'short' | 'medium' | 'long';
    target_price: number;
    stop_loss: number;
    confidence: 'low' | 'medium' | 'high';
    reasons: string[];
    risks: string[];
    // 額外分析
    analysis_summary: string;
    bullish_points: string[];
    bearish_points: string[];
}

// 向下相容舊版結構
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
    // 新增：進階分析
    advanced?: AdvancedAnalysisResult;
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
    'gemini-3.0-flash',
    'gemini-2.5-flash',
];

// 專業股票分析師 System Prompt（整合技術面/基本面/情緒面）
const SYSTEM_PROMPT = `你是一個專業的股票投資分析師，專門分析台股與美股。你的任務是：

1. 根據我提供的「結構化特徵」與「當日證交所／行情資料」，判讀該標的目前的投資狀態。
2. 用「多空理由＋風險提示」的方式給出建議，不要用「一定漲／一定跌」這種確定性語氣。
3. 回答請用「繁體中文」，結構清楚，最後用 JSON 格式輸出一個簡明的建議摘要。

---

### 輸入資料結構

你會收到一個 JSON 物件，包含以下層面的特徵：

1. **技術面（Technical）**
   - trend_pattern：多頭排列 / 空頭排列 / 盤整
   - rsi_level：超買 / 超賣 / 中性
   - macd_signal：金叉 / 死叉 / 震盪
   - price_vs_support_resistance：突破關鍵壓力 / 突破關鍵支撐 / 在壓力與支撐之間

2. **基本面（Fundamental）**
   - pe：本益比
   - pb：股價淨值比
   - eps_growth：EPS 成長率（%）
   - roe：ROE（%）
   - fcf_yield：自由現金流殖利率（%）

3. **行情資料**
   - 股票代碼、名稱、市場（台股／美股）
   - 當日開盤價、最高價、最低價、收盤價、成交量
   - 均線（MA5, MA20, MA60）、RSI、MACD 數值

---

### 分析步驟

1. 先看「結構化特徵」，判斷目前是偏多、偏空，還是觀望
2. 再看「行情資料」，確認是否有明顯的價格突破、成交量放大等訊號
3. 綜合技術面、基本面，給出：
   - 多空理由（2～3 點）
   - 風險提示（2～3 點）
   - 建議操作（買／賣／觀望），並說明理由

---

### 輸出格式（純 JSON，不要包含任何 markdown 標記或額外文字）

{
  "score": <0-100 整數，代表綜合技術面強度>,
  "recommendation": "buy / sell / hold",
  "time_horizon": "short / medium / long",
  "target_price": <目標價>,
  "stop_loss": <停損價>,
  "confidence": "low / medium / high",
  "reasons": [
    "多空理由 1",
    "多空理由 2",
    "多空理由 3"
  ],
  "risks": [
    "風險 1",
    "風險 2",
    "風險 3"
  ],
  "analysis_summary": "<100-200字的完整分析摘要>",
  "strategy": {
    "short_term": { "bias": "多/空/觀望", "entry": <進場價>, "tp": <止盈價>, "sl": <止損價>, "rationale": "<理由>" },
    "mid_term": { "bias": "多/空/觀望", "entry": <進場價>, "tp": <止盈價>, "sl": <止損價>, "rationale": "<理由>" },
    "long_term": { "bias": "多/空/觀望", "entry": <進場價>, "tp": <止盈價>, "sl": <止損價>, "rationale": "<理由>" }
  }
}

---

### 評分標準
- 80-100：強勢多頭，技術面極佳，基本面支撐
- 60-79：偏多格局，可考慮做多
- 40-59：震盪整理，觀望為主
- 20-39：偏空格局，謹慎操作
- 0-19：強勢空頭，建議避開`;

let keyManager: GeminiKeyManager | null = null;
let currentModelIndex = 0;
let isInitializing = false;

async function ensureInitialized(): Promise<boolean> {
    if (keyManager) return true;

    // 緊急備援：優先檢查客戶端環境變數 (繞過 Supabase RLS 延遲)
    const envKeys = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (envKeys) {
        console.log('[Gemini] 優先從環境變數初始化服務...');
        initGemini(envKeys.split(',').map(k => k.trim()));
        return true;
    }

    if (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return keyManager !== null;
    }

    isInitializing = true;
    try {
        const { getApiKeys } = await import('./apiKeys');
        const keys = await getApiKeys('gemini');

        if (keys.length > 0) {
            keyManager = new GeminiKeyManager(keys);
            console.log(`[Gemini] 自動初始化成功，載入 ${keys.length} 組 API Keys`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('[Gemini] 自動初始化失敗:', error);
        return false;
    } finally {
        isInitializing = false;
    }
}

/**
 * 手動初始化 Gemini 服務（向下相容）
 */
export function initGemini(apiKeys: string[]) {
    keyManager = new GeminiKeyManager(apiKeys);
    console.log(`[Gemini] 手動初始化成功，載入 ${apiKeys.length} 組 API Keys`);
}

/**
 * 執行 AI 分析
 */
// 技術面特徵輸入
export interface TechnicalInput {
    trend_pattern: string;
    rsi_level: string;
    rsi: number;
    macd_signal: string;
    macd: number;
    price_vs_sr: string;
    ma5: number;
    ma20: number;
    ma60: number;
    support: number;
    resistance: number;
}

// 基本面特徵輸入
export interface FundamentalInput {
    pe: number | null;
    pb: number | null;
    eps_growth: number | null;
    roe: number | null;
    fcf_yield: number | null;
}

export async function analyzeStock(params: {
    code: string;
    name: string;
    price: number;
    sector?: string;
    changePercent?: number;
    technicalData?: any;
    // 新增：結構化技術面/基本面資料
    technical?: TechnicalInput;
    fundamental?: FundamentalInput;
}): Promise<AnalysisResult | null> {
    // 自動初始化（如果尚未初始化）
    if (!keyManager) {
        const initialized = await ensureInitialized();
        if (!initialized) {
            console.error('[Gemini] 服務未初始化且自動初始化失敗。請檢查環境變數 GEMINI_API_KEY 或 Supabase api_keys 表權限。');
            // 嘗試最後一次直接從環境變數載入
            const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
            if (envKey) {
                console.log('[Gemini] 發現環境變數金鑰，執行緊急初始化...');
                initGemini([envKey]);
            } else {
                return getDefaultResult(params.price);
            }
        }
    }

    // 此時 keyManager 保證已初始化
    const manager = keyManager!;

    await manager.checkRateLimit();

    const prompt = buildPrompt(params);

    // 嘗試呼叫 API（含重試邏輯）
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const key = manager.getCurrentKey();
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

            manager.markSuccess(key);
            return parsed;

        } catch (error: any) {
            const errorMsg = error.message?.toLowerCase() || '';

            if (errorMsg.includes('quota') || errorMsg.includes('rate') || errorMsg.includes('limit')) {
                console.log('[Gemini] API 達到速率限制，切換 Key...');
                manager.markFailed(manager.getCurrentKey());
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
    technical?: TechnicalInput;
    fundamental?: FundamentalInput;
}): string {
    // 建構結構化特徵 JSON
    const features: any = {
        stock_info: {
            code: params.code,
            name: params.name || '未知',
            sector: params.sector || '未知',
            current_price: params.price,
            change_percent: params.changePercent || 0,
            market: params.code.match(/^[0-9]+$/) ? '台股' : '美股',
        }
    };

    // 技術面特徵
    if (params.technical) {
        features.technical = {
            trend_pattern: params.technical.trend_pattern,
            rsi_level: params.technical.rsi_level,
            macd_signal: params.technical.macd_signal,
            price_vs_support_resistance: params.technical.price_vs_sr,
        };
        features.indicators = {
            ma5: params.technical.ma5,
            ma20: params.technical.ma20,
            ma60: params.technical.ma60,
            rsi: params.technical.rsi,
            macd: params.technical.macd,
            support: params.technical.support,
            resistance: params.technical.resistance,
        };
    }

    // 基本面特徵
    if (params.fundamental) {
        features.fundamental = {
            pe: params.fundamental.pe,
            pb: params.fundamental.pb,
            eps_growth: params.fundamental.eps_growth ? `${params.fundamental.eps_growth}%` : null,
            roe: params.fundamental.roe ? `${params.fundamental.roe}%` : null,
            fcf_yield: params.fundamental.fcf_yield ? `${params.fundamental.fcf_yield}%` : null,
        };
    }

    return `請根據以下結構化資料進行股票投資分析：

${JSON.stringify(features, null, 2)}

請根據上述技術面與基本面數據，進行完整的多空分析，以純 JSON 格式回覆（不要加任何 markdown 標記或額外文字）。`;
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

        // 建立進階分析結果
        const advanced: AdvancedAnalysisResult = {
            recommendation: data.recommendation || 'hold',
            time_horizon: data.time_horizon || 'medium',
            target_price: data.target_price || 0,
            stop_loss: data.stop_loss || 0,
            confidence: data.confidence || 'medium',
            reasons: data.reasons || [],
            risks: data.risks || [],
            analysis_summary: data.analysis_summary || data.trend_analysis || '',
            bullish_points: data.bullish_points || [],
            bearish_points: data.bearish_points || [],
        };

        return {
            score: data.score ?? 50,
            strategy: data.strategy ?? {},
            trend_analysis: advanced.analysis_summary || '無法解析分析結果',
            correlation_insight: data.correlation_insight ?? '',
            risk_warning: advanced.risks.join('；') || data.risk_warning || '',
            confidence: typeof data.confidence === 'number' ? data.confidence : (data.confidence === 'high' ? 0.9 : data.confidence === 'medium' ? 0.6 : 0.3),
            advanced: advanced
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
