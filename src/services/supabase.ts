import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 建立 Supabase 客戶端（支援無配置的降級模式）
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            // 自動刷新 token
            autoRefreshToken: true,
            // 持久化 session 到 localStorage
            persistSession: true,
            // 自動偵測 URL 中的 session（OAuth callback 用）
            detectSessionInUrl: true,
            // 使用瀏覽器 localStorage
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
            // Flow type: PKCE（更安全）
            flowType: 'pkce',
        },
    });
    console.log('[Supabase] 客戶端已建立，URL:', supabaseUrl.substring(0, 30) + '...');
} else {
    console.warn('[Supabase] 未設定環境變數，部分功能將無法使用');
}

// 匯出 supabase 客戶端（可能為 null）
export { supabase };

// ============ 型別定義 ============

export interface User {
    id: string;
    google_id?: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
    membership_type: 'free' | 'premium';
    created_at: string;
    last_login_at?: string;
}

export interface UserSettings {
    user_id: string;
    theme: 'dark' | 'light';
    default_currency: 'TWD' | 'USD';
    risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
}

export interface WatchlistItem {
    id: string;
    user_id: string;
    stock_code: string;
    added_at: string;
    notes?: string;
}

// ============ 認證函式 ============

/**
 * 使用 Google 登入
 */
export async function signInWithGoogle() {
    if (!supabase) {
        console.warn('[Supabase] 未設定，無法使用 Google 登入');
        return null;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
        },
    });

    if (error) throw error;
    return data;
}

/**
 * 登出
 */
export async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

/**
 * 取得目前使用者
 */
export async function getCurrentUser() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * 監聽認證狀態變化
 */
export function onAuthStateChange(callback: (user: any) => void) {
    if (!supabase) {
        // 返回一個空的取消訂閱函式
        return { data: { subscription: { unsubscribe: () => { } } } };
    }

    return supabase.auth.onAuthStateChange((event, session) => {
        callback(session?.user || null);
    });
}

// ============ 自選清單 ============

/**
 * 取得使用者的自選清單
 */
export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('user_watchlist')
        .select('*')
        .eq('user_id', userId)
        .order('added_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * 新增到自選清單
 */
export async function addToWatchlist(userId: string, stockCode: string, notes?: string) {
    if (!supabase) {
        console.warn('[Supabase] 未設定，無法新增到自選清單');
        return null;
    }

    const { data, error } = await supabase
        .from('user_watchlist')
        .upsert({
            user_id: userId,
            stock_code: stockCode,
            notes,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 從自選清單移除
 */
export async function removeFromWatchlist(userId: string, stockCode: string) {
    if (!supabase) return;

    const { error } = await supabase
        .from('user_watchlist')
        .delete()
        .eq('user_id', userId)
        .eq('stock_code', stockCode);

    if (error) throw error;
}

/**
 * 更新自選清單備註
 */
export async function updateWatchlistNotes(userId: string, stockCode: string, notes: string) {
    if (!supabase) return;

    const { error } = await supabase
        .from('user_watchlist')
        .update({ notes })
        .eq('user_id', userId)
        .eq('stock_code', stockCode);

    if (error) throw error;
}

// ============ 使用者設定 ============

/**
 * 取得使用者設定
 */
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

/**
 * 更新使用者設定
 */
export async function updateUserSettings(userId: string, settings: Partial<UserSettings>) {
    if (!supabase) return;

    const { error } = await supabase
        .from('user_settings')
        .upsert({
            user_id: userId,
            ...settings,
        });

    if (error) throw error;
}

// ============ API Keys 管理 ============

/**
 * 從 Supabase 取得 Gemini API Keys
 */
export async function getGeminiApiKeys(): Promise<string[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('api_keys')
        .select('key')
        .eq('service', 'gemini')
        .eq('is_active', true);

    if (error) throw error;
    return data?.map(row => row.key) || [];
}

// ============ 股票資料快取 ============

/**
 * 儲存股票資料到 Supabase
 */
export async function saveStocks(stocks: any[]) {
    if (!supabase) return;

    const { error } = await supabase
        .from('daily_stocks')
        .upsert(
            stocks.map(s => ({
                code: s.code,
                name: s.name,
                price: s.price,
                change_percent: s.changePercent,
                volume: s.volume,
                score: s.score,
                market: s.market,
                sector: s.sector,
                updated_at: new Date().toISOString(),
            })),
            { onConflict: 'code' }
        );

    if (error) throw error;
}

/**
 * 檢查 Supabase 是否已設定
 */
export function isSupabaseEnabled(): boolean {
    return supabase !== null;
}
