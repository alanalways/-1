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
import { getStocks, getMarketSummary } from './lib/supabase.js';

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
// Gemini AI 分析端點
// ========================================
// ========================================
// Gemini AI 分析端點 (Multi-Key Rotation)
// ========================================
const GEMINI_API_KEYS = [
    'AIzaSyBYeW6P87Hc5GiKy56ESI-2gotdfiNYWug',
    'AIzaSyB2HQuUFBAkTD01HPQBlOuymIKKtfruHKs',
    'AIzaSyBegBOQKsZ8VIQNxWxAFjIGFnR-N9HqD-A',
    'AIzaSyBH4DospzODeYRHZ-KbnHgdfhkXjN28Yq4',
    // 'AIzaSyBegBOQKsZ8VIQNxWxAFjIGFnR-N9HqD-A' // Duplicate removed
];

const GEMINI_MODELS = [
    'gemini-3-flash-preview',           // Tier 1: 優先 (Better quality)
    'gemini-2.5-flash-preview-09-2025'  // Tier 2: 備用 (Fallback)
];

// Key 狀態管理 (各 Key 獨立 Rate Limit)
const keyStates = GEMINI_API_KEYS.map(key => ({
    key,
    lastused: 0,
    disabledUntil: 0 // 若遇到非相關錯誤可暫時停用
}));

function getNextAvailableKey() {
    const now = Date.now();
    // 簡單輪詢: 找一個最近最少使用且未被停用的 Key
    // 這裡為了均勻分佈，可以排序 lastused
    const availableKeys = keyStates
        .filter(k => now > k.disabledUntil)
        .sort((a, b) => a.lastused - b.lastused);

    if (availableKeys.length === 0) {
        // 若全部都在冷卻，選最早的一個 (強制等待)
        return keyStates.sort((a, b) => a.disabledUntil - b.disabledUntil)[0];
    }
    return availableKeys[0];
}

const MIN_REQUEST_INTERVAL = 2000; // 每個 Key 至少間隔 2 秒 (分散負載)

async function callGeminiAPI(prompt) {
    // 雙層迴圈: Model -> Keys
    for (const model of GEMINI_MODELS) {
        // 嘗試所有可用的 Keys (最多嘗試次數 = Keys 數量)
        // 為了避免單次請求過久，這裡限制每種模型最多試 3 次不同的 Key
        let attempts = 0;
        const maxAttempts = GEMINI_API_KEYS.length;

        while (attempts < maxAttempts) {
            attempts++;
            const keyState = getNextAvailableKey();
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1024,
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

    // Simple rate limiting
    const now = Date.now();
    if (now - lastGeminiRequest < MIN_REQUEST_INTERVAL) {
        return res.status(429).json({
            error: '請求過快，請稍後再試',
            retryAfter: Math.ceil((MIN_REQUEST_INTERVAL - (now - lastGeminiRequest)) / 1000)
        });
    }
    lastGeminiRequest = now;

    const prompt = `你是一位專業的台灣股市分析師，請用繁體中文提供以下股票的簡報分析：

股票資訊：
- 代碼：${code}
- 名稱：${name || '未知'}
- 收盤價：${price || '未知'} 元
- 產業：${sector || '未知'}
- 今日漲跌：${changePercent || 0}%
- SMC 評分：${score || 50}/100
- 訊號：${signal || 'NEUTRAL'}

請提供：
1. 📊 公司簡介（2-3 句）
2. 💡 投資亮點（3 個重點）
3. ⚠️ 風險提示（2-3 個注意事項）
4. 🎯 操作建議（進場/觀望/迴避）

注意：回覆需簡潔專業，總長度控制在 300 字內。不要使用 Markdown 格式，使用純文字和 Emoji。`;

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



// === API Proxy 端點 ===
// [新增] 內部數據 API (讓前端讀取 Supabase)
app.get('/api/data/stocks', async (req, res) => {
    try {
        const stocks = await getStocks();
        if (!stocks || stocks.length === 0) {
            return res.status(404).json({ error: '目前沒有資料' });
        }
        res.json(stocks);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: '伺服器讀取錯誤' });
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
async function checkAndInitializeData() {
    console.log('🔍 Checking database status...');
    try {
        const summary = await getMarketSummary();
        const now = new Date();
        const oneDayCheck = 24 * 60 * 60 * 1000; // 24 hours

        // 條件：(1) 完全沒資料 或 (2) 資料過期超過 24 小時
        const needsUpdate = !summary || !summary.updated_at || (now - new Date(summary.updated_at) > oneDayCheck);

        if (needsUpdate) {
            console.warn('⚠️ Database empty or stale. Triggering immediate update...');
            console.log('🚀 Running Cold Start Update...');

            // 動態載入並執行更新
            const { runDailyUpdate } = await import('./scripts/daily-update.js');
            await runDailyUpdate();
            console.log('✅ Cold Start Update Completed!');
        } else {
            console.log('✅ Database is up to date. Last updated:', summary.updated_at);
        }
    } catch (error) {
        console.error('❌ Database Initialization Check Failed:', error);
        console.warn('⚠️ HINT: Did you create the tables in Supabase? Check Supabase SQL Editor.');
    }
}

// === 啟動伺服器 ===
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 Discover Latest Server Started!
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    🌐 URL: http://localhost:${PORT}
    📊 API Proxy: /api/twse, /api/tpex, /api/yahoo
    ⏰ Cron: 每個交易日 14:00 更新
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    // 啟動後立即檢查資料狀態 (Cold Start Fix)
    checkAndInitializeData();
});
