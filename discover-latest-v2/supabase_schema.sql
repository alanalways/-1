-- Supabase 資料表建立腳本
-- 請在 Supabase Dashboard > SQL Editor 執行此腳本

-- =============================================
-- 1. user_watchlist - 使用者自選清單
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_watchlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_code VARCHAR(10) NOT NULL,
    stock_name VARCHAR(100),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    UNIQUE(user_id, stock_code)
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_id ON public.user_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_stock_code ON public.user_watchlist(stock_code);

-- 啟用 Row Level Security (RLS)
ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;

-- RLS 政策：使用者只能存取自己的資料
CREATE POLICY "Users can view own watchlist" ON public.user_watchlist
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist" ON public.user_watchlist
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist" ON public.user_watchlist
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist" ON public.user_watchlist
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 2. user_subscriptions - 使用者訂閱資訊
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'premium')),
    used_today INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);

-- 啟用 RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS 政策
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription" ON public.user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- 3. user_settings - 使用者設定
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    theme VARCHAR(20) DEFAULT 'dark',
    language VARCHAR(10) DEFAULT 'zh-TW',
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- 啟用 RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS 政策
CREATE POLICY "Users can view own settings" ON public.user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON public.user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.user_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- 完成訊息
-- =============================================
-- 執行完成後，請確認以下資料表已建立：
-- 1. public.user_watchlist
-- 2. public.user_subscriptions  
-- 3. public.user_settings
