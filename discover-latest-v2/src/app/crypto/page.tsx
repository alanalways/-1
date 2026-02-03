/**
 * 加密貨幣頁面
 * 顯示主流加密貨幣行情
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';

// 模擬加密貨幣資料
const MOCK_CRYPTOS = [
    {
        name: 'Bitcoin',
        symbol: 'BTC',
        icon: '₿',
        price: 102450.82,
        change24h: 2.35,
        marketCap: 2015000000000,
        volume24h: 38500000000,
    },
    {
        name: 'Ethereum',
        symbol: 'ETH',
        icon: 'Ξ',
        price: 3285.45,
        change24h: 1.82,
        marketCap: 395000000000,
        volume24h: 18200000000,
    },
    {
        name: 'BNB',
        symbol: 'BNB',
        icon: '◆',
        price: 685.20,
        change24h: -0.45,
        marketCap: 99000000000,
        volume24h: 1850000000,
    },
    {
        name: 'Solana',
        symbol: 'SOL',
        icon: '◎',
        price: 215.80,
        change24h: 5.12,
        marketCap: 102000000000,
        volume24h: 4200000000,
    },
    {
        name: 'XRP',
        symbol: 'XRP',
        icon: '✕',
        price: 2.85,
        change24h: -1.23,
        marketCap: 162000000000,
        volume24h: 8500000000,
    },
    {
        name: 'Cardano',
        symbol: 'ADA',
        icon: '₳',
        price: 1.05,
        change24h: 3.45,
        marketCap: 37000000000,
        volume24h: 1200000000,
    },
];

function formatNumber(num: number): string {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
}

export default function CryptoPage() {
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
                    <Header title="加密貨幣" />
                    <div className="loading-container">
                        <div className="spinner" />
                    </div>
                </main>
            </div>
        );
    }

    // 計算總市值
    const totalMarketCap = MOCK_CRYPTOS.reduce((sum, c) => sum + c.marketCap, 0);

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <Header title="加密貨幣" />

                {/* 市場概覽 */}
                <motion.div
                    className="glass-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: 'var(--spacing-lg)' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>🪙 加密貨幣市場</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
                                追蹤主流加密貨幣即時行情
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '2rem' }}>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>總市值</span>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', fontWeight: 600 }}>
                                    ${formatNumber(totalMarketCap)}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>最後更新</span>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{lastUpdated}</div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* 加密貨幣列表 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: 'var(--spacing-md)',
                    marginBottom: 'var(--spacing-lg)',
                }}>
                    {MOCK_CRYPTOS.map((crypto, index) => (
                        <motion.div
                            key={crypto.symbol}
                            className="glass-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            whileHover={{ scale: 1.02 }}
                            style={{ cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}>
                                        {crypto.icon}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{crypto.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{crypto.symbol}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        fontSize: '1.25rem',
                                        fontWeight: 700,
                                        fontFamily: 'var(--font-mono)',
                                    }}>
                                        ${crypto.price.toLocaleString()}
                                    </div>
                                    <div style={{
                                        fontSize: '0.875rem',
                                        fontFamily: 'var(--font-mono)',
                                        color: crypto.change24h >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                                    }}>
                                        {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(2)}%
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                marginTop: 'var(--spacing-md)',
                                paddingTop: 'var(--spacing-md)',
                                borderTop: '1px solid var(--border-color)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                            }}>
                                <div>
                                    <span>市值: </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                        ${formatNumber(crypto.marketCap)}
                                    </span>
                                </div>
                                <div>
                                    <span>24h 成交量: </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                        ${formatNumber(crypto.volume24h)}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* 提示 */}
                <div style={{
                    padding: 'var(--spacing-md)',
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                }}>
                    💡 提示：加密貨幣資料目前為模擬資料，後續將整合 CoinGecko API
                </div>
            </main>
        </div>
    );
}
