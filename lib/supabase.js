/**
 * Supabase Client
 * 資料庫連接與操作 helper
 */

import { createClient } from '@supabase/supabase-js';

// 從環境變數讀取 Supabase 設定
const supabaseUrl = process.env.SUPABASE_URL;
// 優先使用 Service Role Key (Admin 權限，可繞過 RLS 進行寫入)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// 檢查環境變數
if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase 環境變數未設定 (需要 URL 和 KEY)，將無法存取資料庫');
} else if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ 注意：未偵測到 SUPABASE_SERVICE_ROLE_KEY，僅使用 Anon Key，寫入操作將會被 RLS 阻擋！');
}

// 建立 Supabase 客戶端（如果有設定的話）
const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

/**
 * 檢查 Supabase 是否可用
 */
export function isSupabaseEnabled() {
    return supabase !== null;
}

/**
 * 儲存股票數據到 Supabase
 * @param {Array} stocks - 股票陣列
 */
export async function saveStocks(stocks) {
    if (!supabase) {
        console.log('📁 Supabase 未啟用，跳過資料庫儲存');
        return false;
    }

    try {
        // 使用 upsert 更新或插入
        const { error } = await supabase
            .from('stocks')
            .upsert(
                stocks.map(s => ({
                    code: s.code,
                    name: s.name,
                    close_price: parseFloat(s.closePrice) || 0,
                    open_price: parseFloat(s.openPrice) || 0,
                    high_price: parseFloat(s.highPrice) || 0,
                    low_price: parseFloat(s.lowPrice) || 0,
                    volume: parseInt(s.volume) || 0,
                    change_percent: parseFloat(s.changePercent) || 0,
                    signal: s.signal || 'NEUTRAL',
                    score: s.score || 0,
                    market: s.market || '上市',
                    sector: s.sector || '其他',
                    pe_ratio: s.peRatio || null,
                    analysis: s.analysis || null,
                    tags: s.tags || [], // [新增] 儲存 SMC 標籤
                    patterns: s.patterns || {}, // [新增] 儲存形態數據
                    updated_at: new Date().toISOString()
                })),
                { onConflict: 'code' }
            );

        if (error) throw error;
        console.log(`✅ 已儲存 ${stocks.length} 檔股票到 Supabase`);
        return true;
    } catch (error) {
        console.error('❌ Supabase 儲存失敗:', error.message);
        return false;
    }
}

/**
 * 儲存市場摘要到 Supabase
 * @param {Object} summary - 市場摘要資料
 */
export async function saveMarketSummary(summary) {
    if (!supabase) return false;

    try {
        const today = new Date().toISOString().split('T')[0];

        const { error } = await supabase
            .from('market_summary')
            .upsert({
                date: today,
                taiex_close: summary.taiex?.close || 0,
                taiex_change: summary.taiex?.change || 0,
                taiex_change_percent: summary.taiex?.changePercent || 0,
                total_volume: summary.totalVolume || 0,
                data_json: summary,
                updated_at: new Date().toISOString()
            }, { onConflict: 'date' });

        if (error) throw error;
        console.log(`✅ 已儲存市場摘要到 Supabase (${today})`);
        return true;
    } catch (error) {
        console.error('❌ 市場摘要儲存失敗:', error.message);
        return false;
    }
}

/**
 * 從 Supabase 讀取股票數據
 * @param {Object} options - 查詢選項
 */
export async function getStocks(options = {}) {
    if (!supabase) return null;

    try {
        let allData = [];
        let from = 0;
        const PAGE_SIZE = 1000; // Supabase API 上限通常是 1000
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from('stocks')
                .select('*', { count: 'exact' })
                .order('score', { ascending: false })
                .range(from, from + PAGE_SIZE - 1);

            if (options.signal) {
                query = query.eq('signal', options.signal);
            }

            const { data, error, count } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                allData = allData.concat(data);
                from += PAGE_SIZE;

                // 如果指定了 limit 且已達標，則停止
                if (options.limit && allData.length >= options.limit) {
                    allData = allData.slice(0, options.limit);
                    hasMore = false;
                }
                // 如果回傳資料少於 PAGE_SIZE，表示沒資料了
                if (data.length < PAGE_SIZE) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        console.log(`📦 成功從 Supabase 分頁讀取 ${allData.length} 檔股票`);
        return allData;

    } catch (error) {
        console.error('❌ Supabase 讀取失敗:', error.message);
        return null;
    }
}

/**
 * 從 Supabase 讀取市場摘要
 */
export async function getMarketSummary() {
    if (!supabase) return null;

    try {
        const { data, error } = await supabase
            .from('market_summary')
            .select('*')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle(); // 使用 maybeSingle 避免空資料表報錯

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ 市場摘要讀取失敗:', error.message);
        return null;
    }
}

export default {
    isSupabaseEnabled,
    saveStocks,
    saveMarketSummary,
    getStocks,
    getMarketSummary,
    client: supabase
};
