/**
 * 國際市場頁面
 * 顯示美股、歐股、亞股等國際市場資訊
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';

// 模擬國際市場資料
const MOCK_MARKETS = [
    {
        region: '美國',
        markets: [
            { name: 'S&P 500', code: 'SPX', price: 6015.28, change: 0.85, changePercent: 0.014 },
            { name: 'Nasdaq', code: 'NDX', price: 21853.67, change: 158.32, changePercent: 0.73 },
            { name: 'Dow Jones', code: 'DJI', price: 44815.20, change: -95.80, changePercent: -0.21 },
        ]
    },
    {
        region: '歐洲',
        markets: [
            { name: '德國 DAX', code: 'DAX', price: 21451.25, change: 125.40, changePercent: 0.59 },
            { name: '英國 FTSE', code: 'FTSE', price: 8612.81, change: -28.50, changePercent: -0.33 },
            { name: '法國 CAC', code: 'CAC', price: 7935.78, change: 48.20, changePercent: 0.61 },
        ]
    },
    {
        region: '亞洲',
        markets: [
            { name: '日經 225', code: 'N225', price: 39480.50, change: 285.60, changePercent: 0.73 },
            { name: '香港恒生', code: 'HSI', price: 20285.30, change: -158.90, changePercent: -0.78 },
            { name: '上證指數', code: 'SSEC', price: 3250.12, change: 25.80, changePercent: 0.80 },
        ]
    },
];

export default function GlobalMarketPage() {
    const [mounted, setMounted] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');

    useEffect(() => {
        setMounted(true);
        setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
    }, []);

    if (!mounted) {
        return (
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    <Header title="國際市場" />
                    <div className="loading-container">
                        <div className="spinner" />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <Header title="國際市場" />

                {/* 頁面說明 */}
                <motion.div
                    className="glass-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: 'var(--spacing-lg)' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>🌍 全球市場總覽</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
                                美股、歐股、亞股即時行情
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>最後更新</span>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{lastUpdated}</div>
                        </div>
                    </div>
                </motion.div>

                {/* 各區域市場 */}
                {MOCK_MARKETS.map((region, regionIndex) => (
                    <motion.div
                        key={region.region}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: regionIndex * 0.1 }}
                        style={{ marginBottom: 'var(--spacing-lg)' }}
                    >
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            marginBottom: 'var(--spacing-md)',
                            color: 'var(--text-secondary)'
                        }}>
                            {region.region}
                        </h3>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: 'var(--spacing-md)',
                        }}>
                            {region.markets.map((market, index) => (
                                <motion.div
                                    key={market.code}
                                    className="glass-card"
                                    whileHover={{ scale: 1.02 }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{market.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{market.code}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{
                                                fontSize: '1.25rem',
                                                fontWeight: 700,
                                                fontFamily: 'var(--font-mono)',
                                            }}>
                                                {market.price.toLocaleString()}
                                            </div>
                                            <div style={{
                                                fontSize: '0.875rem',
                                                fontFamily: 'var(--font-mono)',
                                                color: market.changePercent >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                                            }}>
                                                {market.changePercent >= 0 ? '+' : ''}{market.change.toFixed(2)}
                                                ({market.changePercent >= 0 ? '+' : ''}{(market.changePercent * 100).toFixed(2)}%)
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                ))}

                {/* 提示 */}
                <div style={{
                    padding: 'var(--spacing-md)',
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                }}>
                    💡 提示：國際市場資料目前為模擬資料，後續將整合即時 API
                </div>
            </main>
        </div>
    );
}
