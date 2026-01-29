/**
 * 設定檔
 * 自動產生的 Supabase 設定
 */
const CONFIG = {
    SUPABASE_URL: "https://dbxwxdbjsnkiqvtsxlfq.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRieHd4ZGJqc25raXF2dHN4bGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2Nzk1NzcsImV4cCI6MjA4NTI1NTU3N30.fC-37FFUZJtnDt7eESqiPh8qm5avGZHhBdvxHgcvdTU"
};

// 讓其他模組也可以使用 (如果支援 ES Modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
