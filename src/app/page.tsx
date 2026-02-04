/**
 * 儀表板頁面
 * 顯示台股即時行情、市場概覽
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { useAuth } from '@/hooks/useAuth';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { getAllStocks, getTopGainers, getTopLosers, TwseStock, formatStockVolume } from '@/services/twse';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { items: watchlist, loading: watchlistLoading } = useWatchlist();
  const [lastUpdated, setLastUpdated] = useState<string>('--');
  const [isClient, setIsClient] = useState(false);

  // 台股資料
  const [stocks, setStocks] = useState<TwseStock[]>([]);
  const [topGainers, setTopGainers] = useState<TwseStock[]>([]);
  const [topLosers, setTopLosers] = useState<TwseStock[]>([]);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'gainers' | 'losers'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 載入台股資料
  const loadStocks = useCallback(async () => {
    setStocksLoading(true);
    try {
      const allStocks = await getAllStocks();
      const gainers = await getTopGainers(10);
      const losers = await getTopLosers(10);

      setStocks(allStocks);
      setTopGainers(gainers);
      setTopLosers(losers);
      setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
    } catch (error) {
      console.error('載入台股資料失敗:', error);
    } finally {
      setStocksLoading(false);
    }
  }, []);

  // 客戶端初始化
  useEffect(() => {
    setIsClient(true);
    loadStocks();
  }, [loadStocks]);

  // 5 分鐘自動更新
  useAutoRefresh(loadStocks, isClient ? 5 * 60 * 1000 : 0, isClient);

  // 搜尋處理
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query) {
      setActiveTab('all');
    }
  };

  // 篩選股票
  const filteredStocks = searchQuery
    ? stocks.filter(s =>
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : activeTab === 'gainers' ? topGainers
      : activeTab === 'losers' ? topLosers
        : stocks;

  // 顯示的股票列表
  const displayStocks = filteredStocks.slice(0, 20);

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

        {/* 市場概覽卡片 */}
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--spacing-md)',
          }}>
            {[
              { name: '加權指數', code: '^TWII', price: 22856.78, change: 1.23, icon: '🇹🇼' },
              { name: '櫃買指數', code: '^TWOII', price: 256.34, change: -0.45, icon: '📈' },
              { name: 'S&P 500', code: '^GSPC', price: 6015.28, change: 0.87, icon: '🇺🇸' },
              { name: 'Bitcoin', code: 'BTC', price: 97890.45, change: 2.34, icon: '🪙' },
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

        {/* 台股列表 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              🇹🇼 台股行情
            </h2>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
              {[
                { id: 'all', name: '熱門', icon: '🔥' },
                { id: 'gainers', name: '漲幅榜', icon: '📈' },
                { id: 'losers', name: '跌幅榜', icon: '📉' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setSearchQuery(''); }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: activeTab === tab.id ? 'var(--primary)' : 'var(--bg-tertiary)',
                    color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                  }}
                >
                  {tab.icon} {tab.name}
                </button>
              ))}
            </div>
          </div>

          {/* 搜尋結果提示 */}
          {searchQuery && (
            <div style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'rgba(99, 102, 241, 0.1)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--spacing-md)',
              fontSize: '0.875rem',
            }}>
              🔍 搜尋「{searchQuery}」找到 {filteredStocks.length} 筆結果
              <button
                onClick={() => setSearchQuery('')}
                style={{ marginLeft: '12px', color: 'var(--primary-light)' }}
              >
                清除
              </button>
            </div>
          )}

          {stocksLoading ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <div className="loading-spinner" style={{ width: 40, height: 40, margin: '0 auto', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--text-muted)', marginTop: 'var(--spacing-md)' }}>載入台股資料中...</p>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)' }}>股票</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>股價</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>漲跌</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>漲跌幅</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>成交量</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {displayStocks.map((stock, index) => (
                    <motion.tr
                      key={stock.code}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                      }}
                      whileHover={{ background: 'rgba(99, 102, 241, 0.05)' }}
                      onClick={() => window.location.href = `/analysis?code=${stock.code}`}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{stock.code}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stock.name}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {stock.closingPrice.toFixed(2)}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        color: stock.change >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                      }}>
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: stock.changePercent >= 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: stock.changePercent >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                          fontSize: '0.875rem',
                        }}>
                          {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {formatStockVolume(stock.tradeVolume)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/analysis?code=${stock.code}`;
                          }}
                          style={{
                            padding: '4px 12px',
                            background: 'var(--primary)',
                            color: 'white',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                          }}
                        >
                          分析
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>

              {displayStocks.length === 0 && (
                <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
                  找不到符合條件的股票
                </div>
              )}
            </div>
          )}

          {/* 資料說明 */}
          <div style={{
            marginTop: 'var(--spacing-md)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}>
            ⚠️ 資料來源：TWSE 開放資料（模擬資料）・資料約延遲 20 分鐘・僅供參考
          </div>
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

      <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
    </div>
  );
}
