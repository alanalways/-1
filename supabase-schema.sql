-- Supabase 資料表建立腳本
-- 在 Supabase Dashboard -> SQL Editor 中執行

-- ==========================================
-- 1. 股票數據表
-- ==========================================
CREATE TABLE IF NOT EXISTS stocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    close_price NUMERIC DEFAULT 0,
    open_price NUMERIC DEFAULT 0,
    high_price NUMERIC DEFAULT 0,
    low_price NUMERIC DEFAULT 0,
    volume BIGINT DEFAULT 0,
    change_percent NUMERIC DEFAULT 0,
    signal TEXT DEFAULT 'NEUTRAL',
    score INTEGER DEFAULT 0,
    market TEXT DEFAULT '上市',
    sector TEXT DEFAULT '其他',
    pe_ratio NUMERIC,
    analysis TEXT,
    patterns JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_stocks_code ON stocks(code);
CREATE INDEX IF NOT EXISTS idx_stocks_signal ON stocks(signal);
CREATE INDEX IF NOT EXISTS idx_stocks_score ON stocks(score DESC);
CREATE INDEX IF NOT EXISTS idx_stocks_updated ON stocks(updated_at DESC);

-- ==========================================
-- 2. 市場摘要表
-- ==========================================
CREATE TABLE IF NOT EXISTS market_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    taiex_close NUMERIC DEFAULT 0,
    taiex_change NUMERIC DEFAULT 0,
    taiex_change_percent NUMERIC DEFAULT 0,
    total_volume NUMERIC DEFAULT 0,
    data_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_date ON market_summary(date DESC);

-- ==========================================
-- 3. 歷史價格表 (未來擴充用)
-- ==========================================
CREATE TABLE IF NOT EXISTS price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL,
    date DATE NOT NULL,
    open_price NUMERIC,
    high_price NUMERIC,
    low_price NUMERIC,
    close_price NUMERIC,
    volume BIGINT,
    UNIQUE(code, date)
);

CREATE INDEX IF NOT EXISTS idx_price_code_date ON price_history(code, date DESC);

-- ==========================================
-- 4. 會員表 (未來付費功能用)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    tier TEXT DEFAULT 'free', -- 'free', 'premium', 'vip'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. Row Level Security (RLS) 設定
-- ==========================================

-- 啟用 RLS
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_summary ENABLE ROW LEVEL SECURITY;

-- 公開讀取權限（匿名用戶可讀）
CREATE POLICY "Public read access for stocks" ON stocks
    FOR SELECT USING (true);

CREATE POLICY "Public read access for market_summary" ON market_summary
    FOR SELECT USING (true);

-- 服務端寫入權限（使用 service_role key）
CREATE POLICY "Service write access for stocks" ON stocks
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service write access for market_summary" ON market_summary
    FOR ALL USING (auth.role() = 'service_role');

-- ==========================================
-- 完成！
-- ==========================================
SELECT 'Supabase 資料表建立完成！' AS status;
