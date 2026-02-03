/**
 * 儀表板頁面
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { useAuth } from '@/hooks/useAuth';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { items: watchlist, loading: watchlistLoading } = useWatchlist();
  const [lastUpdated, setLastUpdated] = useState<string>('--');
  const [isClient, setIsClient] = useState(false);

  // 客戶端初始化
  useEffect(() => {
    setIsClient(true);
    setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
  }, []);

  // 5 分鐘自動更新
  useAutoRefresh({
    enabled: isClient,
    interval: 5 * 60 * 1000,
    onRefresh: () => {
      setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
      // TODO: 刷新股票資料
      console.log('🔄 自動更新資料...');
    },
  });

  const handleSearch = (query: string) => {
    console.log('搜尋:', query);
    // TODO: 實作搜尋功能
  };

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Header title="儀表板" onSearch={handleSearch} />

        {/* 歡迎區塊 */}
        <motion.section
          className="welcome-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-xl)',
            marginBottom: 'var(--spacing-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '8px' }}>
            {user ? `👋 歡迎回來，${user.user_metadata?.full_name || '投資者'}！` : '👋 歡迎使用 Discover Latest'}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {user
              ? `您的自選清單中有 ${watchlist.length} 檔股票`
              : '登入以解鎖自選清單同步、歷史分析紀錄等功能'
            }
          </p>
        </motion.section>

        {/* 市場概覽 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ marginBottom: 'var(--spacing-lg)' }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
            📊 市場概覽
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-md)',
          }}>
            {/* 市場卡片（暫用靜態資料） */}
            {[
              { name: '加權指數', code: '^TWII', price: 22856.78, change: 1.23, icon: '🇹🇼' },
              { name: '櫃買指數', code: '^TWOII', price: 256.34, change: -0.45, icon: '📈' },
              { name: 'S&P 500', code: '^GSPC', price: 5234.12, change: 0.67, icon: '🇺🇸' },
              { name: 'Bitcoin', code: 'BTC', price: 67890.45, change: 2.34, icon: '🪙' },
            ].map((market, index) => (
              <motion.div
                key={market.code}
                className="glass-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                style={{ cursor: 'pointer' }}
                whileHover={{ scale: 1.02 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '1.5rem' }}>{market.icon}</span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{market.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{market.code}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {market.price.toLocaleString()}
                  </span>
                  <span style={{
                    color: market.change >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                    fontWeight: 500,
                  }}>
                    {market.change >= 0 ? '+' : ''}{market.change}%
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* 自選清單快捷區 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              ⭐ 自選清單
            </h2>
            <a href="/watchlist" style={{ color: 'var(--primary-light)', fontSize: '0.875rem' }}>
              查看全部 →
            </a>
          </div>

          {watchlistLoading ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <p style={{ color: 'var(--text-muted)' }}>載入中...</p>
            </div>
          ) : watchlist.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <p style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</p>
              <p style={{ color: 'var(--text-muted)' }}>尚未新增自選股票</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                使用搜尋框找到想追蹤的股票，點擊 ⭐ 加入自選清單
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--spacing-md)',
            }}>
              {watchlist.slice(0, 4).map((item, index) => (
                <motion.div
                  key={item.id}
                  className="glass-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.05 }}
                  style={{ cursor: 'pointer' }}
                  whileHover={{ borderColor: 'var(--primary)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.stock_code}</div>
                      {item.notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.notes}</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>--</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>--</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* 最後更新時間 */}
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--spacing-xl)',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
        }}>
          最後更新：{lastUpdated} | 🔄 每 5 分鐘自動更新
        </div>
      </main>
    </div>
  );
}
