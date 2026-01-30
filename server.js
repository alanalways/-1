/**
 * Discover Latest - Backend Server
 * 用於 Hugging Face Spaces 部署
 * 
 * 功能：
 * 1. 靜態網頁伺服器
 * 2. 排程任務（每日更新股票數據）
 * 3. API Proxy（解決 CORS 問題）
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { getStocks, getMarketSummary, getGeminiApiKeys } from './lib/supabase.js';

// ES Module 路徑處理
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7860;

// === Middleware ===
app.use(cors());
app.use(express.json());

// === 靜態檔案服務 ===
app.use(express.static(__dirname));

// === API Proxy 端點 ===
// 解決前端 CORS 問題，所有 API 請求都透過後端代發

// TWSE Proxy
app.use('/api/twse', async (req, res) => {
    try {
        const targetPath = req.path; // 例如: /quote/stock.json
        const queryString = new URLSearchParams(req.query).toString();
        // 注意：req.path 包含開頭斜線，所以直接接在網域後即可
        const url = `https://www.twse.com.tw${targetPath}${queryString ? '?' + queryString : ''}`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            method: req.method // 轉發對應的 HTTP method
        });
        const data = await response.text();

        res.set('Content-Type', response.headers.get('content-type') || 'application/json');
        res.send(data);
    } catch (error) {
        console.error('TWSE Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// TPEx Proxy
app.use('/api/tpex', async (req, res) => {
    try {
        const targetPath = req.path;
        const queryString = new URLSearchParams(req.query).toString();
        const url = `https://www.tpex.org.tw${targetPath}${queryString ? '?' + queryString : ''}`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            method: req.method
        });
        const data = await response.text();

        res.set('Content-Type', response.headers.get('content-type') || 'application/json');
        res.send(data);
    } catch (error) {
        console.error('TPEx Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Yahoo Finance Proxy
app.use('/api/yahoo', async (req, res) => {
    try {
        const targetPath = req.path;
        const queryString = new URLSearchParams(req.query).toString();
        const url = `https://query1.finance.yahoo.com${targetPath}${queryString ? '?' + queryString : ''}`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            method: req.method
        });
        const data = await response.text();

        res.set('Content-Type', response.headers.get('content-type') || 'application/json');
        res.send(data);
    } catch (error) {
        console.error('Yahoo Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});


// ========================================
// Gemini AI 分析端點 (Dynamic Keys from Supabase)
// ========================================
const GEMINI_MODELS = [
    'gemini-3-flash-preview',           // Tier 1: 優先 (~5-15 RPM, ~20-100 RPD)
    'gemini-2.5-flash-preview-09-2025'  // Tier 2: 備用 (15 RPM, 1500 RPD)
];

// 動態 API Keys 管理 (從 Supabase 讀取)
let geminiApiKeys = [];
let keyStates = [];
let keysLoaded = false;

async function loadGeminiKeys() {
    try {
        geminiApiKeys = await getGeminiApiKeys();
        if (geminiApiKeys.length > 0) {
            keyStates = geminiApiKeys.map(key => ({
                key,
                lastused: 0,
                disabledUntil: 0
            }));
            keysLoaded = true;
            console.log(`✅ 已載入 ${geminiApiKeys.length} 組 Gemini API Keys`);
        } else {
            console.warn('⚠️ 未找到 Gemini API Keys，AI 功能將無法使用');
        }
    } catch (error) {
        console.error('❌ 載入 Gemini API Keys 失敗:', error.message);
    }
}

function getNextAvailableKey() {
    if (keyStates.length === 0) return null;

    const now = Date.now();
    const availableKeys = keyStates
        .filter(k => now > k.disabledUntil)
        .sort((a, b) => a.lastused - b.lastused);

    if (availableKeys.length === 0) {
        return keyStates.sort((a, b) => a.disabledUntil - b.disabledUntil)[0];
    }
    return availableKeys[0];
}

const MIN_REQUEST_INTERVAL = 2000;

async function callGeminiAPI(prompt) {
    // 確保 API Keys 已載入
    if (!keysLoaded || geminiApiKeys.length === 0) {
        await loadGeminiKeys();
    }

    if (geminiApiKeys.length === 0) {
        return { success: false, error: '未設定 Gemini API Keys，請在 Supabase config 表中新增 gemini_api_keys' };
    }

    // 雙層迴圈: Model -> Keys
    for (const model of GEMINI_MODELS) {
        let attempts = 0;
        const maxAttempts = geminiApiKeys.length;

        while (attempts < maxAttempts) {
            attempts++;
            const keyState = getNextAvailableKey();
            if (!keyState) break;
            const now = Date.now();

            // 檢查是否需要等待 (Rate Limit)
            const waitTime = Math.max(0, MIN_REQUEST_INTERVAL - (now - keyState.lastused));
            if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));

            keyState.lastused = Date.now();

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyState.key}`;

            try {
                console.log(`🤖 Gemini Attempt: ${model} with Key ending ...${keyState.key.slice(-4)}`);
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': keyState.key
                    },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 4096,
                            topP: 0.9
                        }
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();

                    // 429 Rate Limit -> 標記該 Key 暫時停用，換下一個 Key
                    if (response.status === 429) {
                        console.warn(`⚠️ Key ...${keyState.key.slice(-4)} hit Rate Limit on ${model}`);
                        keyState.disabledUntil = Date.now() + 60000; // 停用 1 分鐘
                        continue; // Try next key
                    }

                    // 503 Service Unavailable -> 也換 Key 試試
                    if (response.status === 503) {
                        continue;
                    }

                    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
                }

                const data = await response.json();
                return {
                    success: true,
                    model, // 回傳成功使用的模型
                    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '分析生成失敗'
                };

            } catch (error) {
                console.error(`❌ Error (${model}):`, error.message);
                // 若是網路或嚴重錯誤，可能不是 Key 的問題，但換個 Key 試試也無妨
                // 繼續迴圈嘗試下一個 Key
            }
        }
        console.warn(`⚠️ All keys failed for model ${model}, switching to next model...`);
    }

    return { success: false, error: '所有 Gemini Keys 與模型皆無法使用，請稍後再試。' };
}

app.get('/api/ai-analysis', async (req, res) => {
    const { code, name, price, sector, changePercent, score, signal } = req.query;

    if (!code) {
        return res.status(400).json({ error: '缺少股票代碼' });
    }

    // Rate Limit 由 callGeminiAPI 內部每組 Key 獨立控制

    // [新增] 強制人設指令
    const identityInstruction = `
        重要角色設定：
        1. 你的名字是 "Discover AI"，是一個專業、客觀的金融分析助手。
        2. 請"絕對不要"在回答中提及你是 Gemini、Google AI 或任何具體的語言模型名稱。
        3. 如果需要自我介紹，請只說 "我是 Discover AI"。
        4. 請直接針對股票進行分析，不要有開場白 (如：好的，這就為您分析...)。
    `;

    const prompt = `
            ${identityInstruction}

            你現在是【Discover Latest】網站的專屬 AI 財經小助手，你的名字是 "Discover AI"。
你的任務是代表本網站協助用戶解讀台股數據，並結合 Smart Money Concepts (SMC) 機構訂單原理，提供一份專業、客觀且親切的分析報告。

請根據以下即時數據進行分析：

【📈 標的資訊】
- 股票代號：${code}
- 股票名稱：${name || '未知'}
- 目前股價：${price || '未知'} 元
- 產業類別：${sector || '未知'}
- 今日漲跌：${changePercent || 0}%
- Discover Latest 綜合評分：${score || 50}/100
- 系統訊號方向：${signal || 'NEUTRAL'}

【📝 你的任務】
請用繁體中文（台灣用語）撰寫一份約 300-500 字的分析報告。語氣請保持專業但親切（像是一位有見地的理財顧問），並在文中適當展現 Discover Latest 的數據洞察力。

請依照以下結構輸出：

1. **👦 小助手市場觀點 (公司與產業概況)**：
   - 以「嗨！我是 Discover AI」親切開場。
   - 簡述這間公司的核心競爭力與護城河。
   - 分析該產業目前的市場熱度或趨勢。

2. **🔍 Discover Latest 訊號解讀 (技術面與 SMC 分析)**：
   - **K 線型態**：判斷目前是處於吸籌、拉升、派發還是回調階段。
   - **SMC 策略視視角**：
     - 若評分較高：指出可能的「機構訂單塊 (Order Block)」或「流動性缺口 (FVG)」支撐位置。
     - 若評分較低：分析上方的流動性掠奪風險或壓力區。
   - 結合成交量變化，解讀主力是否有進出貨跡象。

3. **🔮 AI 趨勢推演 (價格預測)**：
   - **短期關注 (1-2週)**：預測關鍵的支撐位與壓力位數字。
   - **中長期展望 (1-3月)**：基於基本面與技術面，給出趨勢方向（看多 / 觀望 / 看空）。
   - *（請標註免責聲明：此為 AI 模擬推演，非投資建議）*

4. **💡 操作策略建議**：
   - **進場規劃**：建議觀察的價格區間。
   - **風控設定**：明確建議止損點 (SL) 與停利點 (TP)。
   - 最後給予一句溫馨的投資提醒或鼓勵。

請保持排版整潔，善用 Emoji (📊, 🎯, 💡, ⚠️) 讓報告更易於閱讀。`;

    const result = await callGeminiAPI(prompt);

    if (result.success) {
        res.json({
            success: true,
            model: result.model,
            analysis: result.content,
            stockCode: code
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error || 'AI 分析失敗',
            stockCode: code
        });
    }
});

// ========================================
// AI 產業關聯股分析端點
// ========================================
app.get('/api/ai-related-stocks', async (req, res) => {
    const { code, name, sector, price, changePercent } = req.query;

    if (!code) {
        return res.status(400).json({ error: '缺少股票代碼' });
    }

    const prompt = `你是台灣股市專家 Discover AI。請分析【${code} ${name || ''}】的產業關聯股票。

【目標股票資訊】
- 股票代號：${code}
- 股票名稱：${name || '未知'}
- 產業類別：${sector || '未知'}
- 目前股價：${price || '未知'} 元
- 今日漲跌：${changePercent || 0}%

【任務】
請根據台股市場實際情況，列出 5-6 檔與此股票最相關的台灣上市櫃股票。

分析關聯性時請考慮：
1. **供應鏈關係**：上游供應商、下游客戶
2. **競爭關係**：同產業直接競爭對手
3. **集團關係**：同一集團或控股公司
4. **產業連動**：同細分產業會一起漲跌的股票
5. **業務互補**：業務有互補或合作關係

【回傳格式】
請嚴格按照以下 JSON 格式回傳（不要加任何其他文字）：

{
  "centerStock": "${code}",
  "relatedStocks": [
    {
      "code": "股票代碼",
      "name": "股票名稱",
      "relationship": "關係描述（如：供應商、競爭對手、同集團、產業連動）",
      "beta": 0.85,
      "reason": "一句話說明為何相關"
    }
  ]
}

【Beta 相關性說明】
- beta 範圍：-1.0 到 +1.0
- +0.8 ~ +1.0：高度正相關（同漲同跌）
- +0.5 ~ +0.8：中度正相關
- +0.2 ~ +0.5：弱正相關
- -0.2 ~ +0.2：幾乎無相關
- -0.5 ~ -0.2：弱負相關
- -1.0 ~ -0.5：負相關（反向連動）

請只回傳 JSON，不要有任何額外說明文字。`;

    const result = await callGeminiAPI(prompt);

    if (result.success) {
        try {
            // 解析 AI 回傳的 JSON
            let content = result.content.trim();
            // 移除可能的 markdown code block
            if (content.startsWith('```json')) {
                content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (content.startsWith('```')) {
                content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            const parsed = JSON.parse(content);

            res.json({
                success: true,
                model: result.model,
                data: parsed
            });
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError.message);
            console.error('Raw Content:', result.content);
            res.status(500).json({
                success: false,
                error: 'AI 回傳格式解析失敗',
                rawContent: result.content
            });
        }
    } else {
        res.status(500).json({
            success: false,
            error: result.error || 'AI 分析失敗'
        });
    }
});// === API Proxy 端點 ===

// === [修改] 完全即時架構：直接從 TWSE/TPEx 抓取 ===
// 每天只寫入 Supabase 一次

// 追蹤今日是否已同步到 Supabase
const syncState = {
    lastSyncDate: null,  // 上次同步的日期 (YYYY-MM-DD)
    isSyncing: false     // 是否正在同步中
};

import { saveStocks, isSupabaseEnabled } from './lib/supabase.js';

app.get('/api/data/stocks', async (req, res) => {
    console.log('📡 [即時模式] 從 TWSE/TPEx 抓取股票資料...');
    const startTime = Date.now();

    try {
        // 動態載入模組
        const fetcher = await import('./scripts/fetch-data.js');
        const analyzer = await import('./scripts/analyze.js');

        // 1. 即時抓取股票資料
        const allStocks = await fetcher.default.fetchAllStocks();

        if (!allStocks || allStocks.length === 0) {
            console.warn('⚠️ 無法從 TWSE 取得資料，嘗試從 Supabase 讀取快取...');
            // Fallback: 如果 TWSE 失敗，嘗試從 Supabase 讀取
            const cachedStocks = await getStocks();
            if (cachedStocks && cachedStocks.length > 0) {
                return res.json(cachedStocks);
            }
            return res.status(503).json({ error: '無法取得股票資料 (TWSE API 可能維護中)' });
        }

        // 2. 即時分析所有股票
        console.log(`🧠 分析 ${allStocks.length} 檔股票...`);
        const analyzedStocks = analyzer.default.analyzeAllStocks(allStocks);

        // 3. 每天只寫入 Supabase 一次
        const today = new Date().toISOString().split('T')[0];
        if (isSupabaseEnabled() && syncState.lastSyncDate !== today && !syncState.isSyncing) {
            syncState.isSyncing = true;
            console.log('💾 今日首次請求，同步到 Supabase...');

            try {
                await saveStocks(analyzedStocks);
                syncState.lastSyncDate = today;
                console.log(`✅ 已同步 ${analyzedStocks.length} 檔股票到 Supabase (今日只執行一次)`);
            } catch (dbError) {
                console.error('⚠️ Supabase 同步失敗:', dbError.message);
            } finally {
                syncState.isSyncing = false;
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ 即時抓取完成！${analyzedStocks.length} 檔股票，耗時 ${elapsed}s`);

        // 4. 轉換格式並回傳 (符合前端期望的格式)
        const result = analyzedStocks.map(s => ({
            code: s.code,
            name: s.name,
            close_price: s.closePrice,
            open_price: s.openPrice,
            high_price: s.highPrice,
            low_price: s.lowPrice,
            volume: s.volume,
            change_percent: s.changePercent,
            signal: s.signal,
            score: s.score,
            market: s.market,
            sector: s.sector,
            pe_ratio: s.peRatio,
            analysis: s.analysis,
            patterns: s.patterns
        }));

        res.json(result);

    } catch (error) {
        console.error('❌ 即時抓取失敗:', error);

        // Fallback: 嘗試從 Supabase 讀取快取
        try {
            const cachedStocks = await getStocks();
            if (cachedStocks && cachedStocks.length > 0) {
                console.log('📦 使用 Supabase 快取資料');
                return res.json(cachedStocks);
            }
        } catch (e) { }

        res.status(500).json({ error: '伺服器讀取錯誤: ' + error.message });
    }
});

app.get('/api/data/market', async (req, res) => {
    try {
        const summary = await getMarketSummary();
        res.json(summary || {});
    } catch (error) {
        console.error('Market API Error:', error);
        res.status(500).json({ error: '市場摘要讀取錯誤' });
    }
});

// === 健康檢查端點 ===
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

// === 手動觸發更新端點 ===
app.post('/api/trigger-update', async (req, res) => {
    console.log('📡 Manual update triggered...');
    try {
        // 動態載入更新模組
        const { runDailyUpdate } = await import('./scripts/daily-update.js');
        await runDailyUpdate();
        res.json({ success: true, message: 'Update completed' });
    } catch (error) {
        console.error('Update failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// === [新增] 即時刷新端點 (混合架構核心) ===
// 直接從 TWSE/TPEx 抓取最新資料並即時運算
// 保護機制：30 秒冷卻、每日最多 10 次、成功後寫入 Supabase

// 刷新狀態追蹤
const refreshState = {
    lastRefreshTime: 0,      // 上次刷新的時間戳
    dailyCount: 0,           // 今日刷新次數
    dailyCountDate: null,    // 計數器的日期
    COOLDOWN_MS: 30000,      // 30 秒冷卻
    DAILY_LIMIT: 10          // 每日最多 10 次
};

// 重置每日計數器 (跨日重置)
function resetDailyCounterIfNeeded() {
    const today = new Date().toISOString().split('T')[0];
    if (refreshState.dailyCountDate !== today) {
        refreshState.dailyCount = 0;
        refreshState.dailyCountDate = today;
        console.log('📅 每日刷新計數器已重置');
    }
}

// 查詢刷新狀態 API
app.get('/api/refresh/status', (req, res) => {
    resetDailyCounterIfNeeded();

    const now = Date.now();
    const cooldownRemaining = Math.max(0, refreshState.COOLDOWN_MS - (now - refreshState.lastRefreshTime));

    res.json({
        canRefresh: cooldownRemaining === 0 && refreshState.dailyCount < refreshState.DAILY_LIMIT,
        cooldownRemaining: Math.ceil(cooldownRemaining / 1000),
        dailyCount: refreshState.dailyCount,
        dailyLimit: refreshState.DAILY_LIMIT,
        lastRefreshTime: refreshState.lastRefreshTime ? new Date(refreshState.lastRefreshTime).toISOString() : null
    });
});

app.get('/api/refresh', async (req, res) => {
    console.log('🔄 即時刷新請求...');
    const startTime = Date.now();

    // === 保護機制檢查 ===
    resetDailyCounterIfNeeded();

    // 1. 冷卻時間檢查
    const timeSinceLastRefresh = startTime - refreshState.lastRefreshTime;
    if (timeSinceLastRefresh < refreshState.COOLDOWN_MS) {
        const remaining = Math.ceil((refreshState.COOLDOWN_MS - timeSinceLastRefresh) / 1000);
        console.log(`⏳ 冷卻中，還需等待 ${remaining} 秒`);
        return res.status(429).json({
            success: false,
            error: `請稍候 ${remaining} 秒後再試`,
            cooldownRemaining: remaining,
            dailyCount: refreshState.dailyCount,
            dailyLimit: refreshState.DAILY_LIMIT
        });
    }

    // 2. 每日次數檢查
    if (refreshState.dailyCount >= refreshState.DAILY_LIMIT) {
        console.log(`🚫 今日刷新次數已達上限 (${refreshState.DAILY_LIMIT} 次)`);
        return res.status(429).json({
            success: false,
            error: `今日刷新次數已達上限 (${refreshState.DAILY_LIMIT} 次)，請明日再試`,
            dailyCount: refreshState.dailyCount,
            dailyLimit: refreshState.DAILY_LIMIT
        });
    }

    try {
        // 動態載入模組
        const fetcher = await import('./scripts/fetch-data.js');
        const analyzer = await import('./scripts/analyze.js');

        // 1. 即時抓取股票資料
        console.log('📡 從 TWSE/TPEx 即時抓取資料...');
        const allStocks = await fetcher.default.fetchAllStocks();

        if (allStocks.length === 0) {
            return res.status(503).json({
                success: false,
                error: '無法取得即時資料 (可能為非交易時間或 API 維護中)'
            });
        }

        // 2. 即時分析所有股票
        console.log(`🧠 即時分析 ${allStocks.length} 檔股票...`);
        const analyzedStocks = analyzer.default.analyzeAllStocks(allStocks);

        // 3. 寫入 Supabase (讓下一個使用者看到最新資料)
        if (isSupabaseEnabled()) {
            console.log('💾 同步寫入 Supabase...');
            try {
                await saveStocks(analyzedStocks);
                console.log(`✅ 已同步 ${analyzedStocks.length} 檔股票到 Supabase`);
            } catch (dbError) {
                console.error('⚠️ Supabase 寫入失敗 (不影響回傳):', dbError.message);
            }
        }

        // 4. 更新刷新狀態
        refreshState.lastRefreshTime = Date.now();
        refreshState.dailyCount++;

        // 5. 計算統計資料
        const bullishCount = analyzedStocks.filter(s => s.signal === 'BULLISH').length;
        const bearishCount = analyzedStocks.filter(s => s.signal === 'BEARISH').length;
        const smcCount = analyzedStocks.filter(s => s.patterns?.ob || s.patterns?.fvg || s.patterns?.sweep).length;

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ 即時刷新完成！耗時 ${elapsed} 秒，共 ${analyzedStocks.length} 檔股票 (今日第 ${refreshState.dailyCount}/${refreshState.DAILY_LIMIT} 次)`);

        // 6. 回傳資料
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            elapsed: `${elapsed}s`,
            totalStocks: analyzedStocks.length,
            statistics: {
                bullish: bullishCount,
                bearish: bearishCount,
                neutral: analyzedStocks.length - bullishCount - bearishCount,
                smcSignals: smcCount
            },
            rateLimit: {
                dailyCount: refreshState.dailyCount,
                dailyLimit: refreshState.DAILY_LIMIT,
                nextRefreshAvailable: new Date(Date.now() + refreshState.COOLDOWN_MS).toISOString()
            },
            stocks: analyzedStocks
        });

    } catch (error) {
        console.error('❌ 即時刷新失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// === 排程任務 ===
// 台股收盤後更新：每個交易日下午 14:00 (台北時間)
// Cron 格式：分 時 日 月 週 (週一到週五)
cron.schedule('0 14 * * 1-5', async () => {
    console.log('⏰ Scheduled update starting...');
    try {
        const { runDailyUpdate } = await import('./scripts/daily-update.js');
        await runDailyUpdate();
        console.log('✅ Scheduled update completed!');
    } catch (error) {
        console.error('❌ Scheduled update failed:', error);
    }
}, {
    timezone: 'Asia/Taipei'
});
// === 初始化檢查機制 ===
// [修改] 每次部署時強制更新 Supabase，確保程式碼與資料同步
async function checkAndInitializeData() {
    console.log('🔍 Checking database status...');
    try {
        const summary = await getMarketSummary();
        const stocks = await getStocks();
        const now = new Date();
        const taipeiHour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hour12: false });
        const currentHour = parseInt(taipeiHour);

        // [新增] 強制更新標記：每次部署都觸發更新
        // 這確保 GitHub 上的程式碼修改會立即反映到 Supabase 資料
        const FORCE_UPDATE_ON_DEPLOY = true;

        let needsUpdate = FORCE_UPDATE_ON_DEPLOY;
        let updateReason = 'Deployment detected (force sync)';

        // 額外條件檢查（即使強制更新關閉，這些條件也會觸發）
        if (!FORCE_UPDATE_ON_DEPLOY) {
            const oneDayCheck = 24 * 60 * 60 * 1000;

            // 條件 1: 完全沒資料
            if (!summary || !summary.updated_at) {
                needsUpdate = true;
                updateReason = 'No data in database';
            }
            // 條件 2: 資料過期超過 24 小時
            else if ((now - new Date(summary.updated_at)) > oneDayCheck) {
                needsUpdate = true;
                updateReason = 'Data older than 24 hours';
            }
        }

        // 條件 3: 產業分類資料不正確 (大部分都是 '其他')
        if (!needsUpdate && stocks && stocks.length > 0) {
            const otherSectorCount = stocks.filter(s => s.sector === '其他' || !s.sector).length;
            const otherRatio = otherSectorCount / stocks.length;
            if (otherRatio > 0.8) {
                console.warn(`⚠️ Sector data looks incorrect (${(otherRatio * 100).toFixed(1)}% = '其他'). Forcing update...`);
                needsUpdate = true;
                updateReason = 'Sector data needs refresh';
            }

            // 條件 4: 驗證重要股票是否存在 (如 2330, 00930)
            const hasTSMC = stocks.some(s => s.code === '2330');
            const hasETF930 = stocks.some(s => s.code === '00930');
            if (!hasTSMC) {
                console.warn(`⚠️ Missing TSMC (2330). Forcing update...`);
                needsUpdate = true;
                updateReason = 'Missing critical stock 2330';
            }
            if (!hasETF930) {
                console.warn(`⚠️ Missing ETF 00930. Forcing update...`);
                needsUpdate = true;
                updateReason = 'Missing ETF 00930';
            }
        }

        // 交易時間檢查 (台北時間 9:00-14:30 為交易時段)
        const isMarketHours = currentHour >= 9 && currentHour <= 14;

        if (needsUpdate) {
            console.warn(`⚠️ Update needed: ${updateReason}`);
            console.log('🚀 Running Cold Start Update...');

            // 動態載入並執行更新
            const { runDailyUpdate } = await import('./scripts/daily-update.js');
            await runDailyUpdate();
            console.log('✅ Cold Start Update Completed!');
        } else {
            console.log('✅ Database is up to date. Last updated:', summary?.updated_at);
            if (!isMarketHours) {
                console.log('ℹ️ Note: Outside market hours (09:00-14:30 TPE)');
            }
        }
    } catch (error) {
        console.error('❌ Database Initialization Check Failed:', error);
        console.warn('⚠️ HINT: Did you create the tables in Supabase? Check Supabase SQL Editor.');
    }
}

// === 啟動伺服器 ===
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`
    🚀 Discover Latest Server Started!
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    🌐 URL: http://localhost:${PORT}
    📊 API Proxy: /api/twse, /api/tpex, /api/yahoo
    ⏰ Cron: 每個交易日 14:00 更新
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    // 啟動時載入 Gemini API Keys
    await loadGeminiKeys();

    // 啟動後立即檢查資料狀態 (Cold Start Fix)
    checkAndInitializeData();
});
