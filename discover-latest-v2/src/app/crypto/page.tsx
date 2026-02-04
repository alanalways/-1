/**
 * 加密貨幣頁面
 * 使用幣安 API 顯示即時加密貨幣行情
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { getAllCryptoPrices, getKlines, formatPrice, formatVolume, CryptoPrice, CryptoKline } from '@/services/binance';
import { MiniCandlestickChart } from '@/components/charts/MiniAreaChart';

export default function CryptoPage() {
    const [cryptos, setCryptos] = useState<CryptoPrice[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState('');
    const [selectedCrypto, setSelectedCrypto] = useState<CryptoPrice | null>(null);
    const [klines, setKlines] = useState<CryptoKline[]>([]);
    const [showChart, setShowChart] = useState(false);

    // 取得所有加密貨幣價格
    const fetchPrices = useCallback(async () => {
        try {
            const data = await getAllCryptoPrices();
            if (data.length > 0) {
                setCryptos(data);
                setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
            }
        } catch (error) {
            console.error('取得加密貨幣價格失敗:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // 初始載入和定時更新
    useEffect(() => {
        fetchPrices();

        // 每 10 秒更新一次
        const interval = setInterval(fetchPrices, 10000);
        return () => clearInterval(interval);
    }, [fetchPrices]);

    // 點擊查看詳情
    const handleCryptoClick = async (crypto: CryptoPrice) => {
        setSelectedCrypto(crypto);
        setShowChart(true);

        // 取得 K 線資料
        const data = await getKlines(crypto.symbol, '1d', 30);
        setKlines(data);
    };

    // 計算總市值（使用成交額估算）
    const totalQuoteVolume = cryptos.reduce((sum, c) => sum + c.quoteVolume24h, 0);

    if (loading) {
        return (
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    <Header title="加密貨幣" />
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                        <div className="loading-spinner" style={{ width: 48, height: 48, animation: 'spin 1s linear infinite' }} />
                    </div>
                </main>
            </div>
        );
    }

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
                                資料來源：幣安（Binance）即時 API
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '2rem' }}>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>24h 總成交額</span>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', fontWeight: 600 }}>
                                    ${formatVolume(totalQuoteVolume)}
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
                    {cryptos.map((crypto, index) => (
                        <motion.div
                            key={crypto.symbol}
                            className="glass-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            whileHover={{ scale: 1.02 }}
                            onClick={() => handleCryptoClick(crypto)}
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
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{crypto.displaySymbol}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        fontSize: '1.25rem',
                                        fontWeight: 700,
                                        fontFamily: 'var(--font-mono)',
                                    }}>
                                        ${formatPrice(crypto.price)}
                                    </div>
                                    <div style={{
                                        fontSize: '0.875rem',
                                        fontFamily: 'var(--font-mono)',
                                        color: crypto.priceChangePercent >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                                    }}>
                                        {crypto.priceChangePercent >= 0 ? '+' : ''}{crypto.priceChangePercent.toFixed(2)}%
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                marginTop: 'var(--spacing-md)',
                                paddingTop: 'var(--spacing-md)',
                                borderTop: '1px solid var(--border-color)',
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 'var(--spacing-sm)',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                            }}>
                                <div>
                                    <span>24h 最高: </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--stock-up)' }}>
                                        ${formatPrice(crypto.high24h)}
                                    </span>
                                </div>
                                <div>
                                    <span>24h 最低: </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--stock-down)' }}>
                                        ${formatPrice(crypto.low24h)}
                                    </span>
                                </div>
                                <div>
                                    <span>成交量: </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                        {formatVolume(crypto.volume24h)} {crypto.displaySymbol}
                                    </span>
                                </div>
                                <div>
                                    <span>成交額: </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                        ${formatVolume(crypto.quoteVolume24h)}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* 資料說明 */}
                <div style={{
                    padding: 'var(--spacing-md)',
                    background: 'rgba(34, 197, 94, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                }}>
                    ✅ 即時資料來自幣安公開 API・每 10 秒自動更新・點擊卡片查看詳情
                </div>

                {/* 詳情 Modal */}
                {showChart && selectedCrypto && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => setShowChart(false)}
                    >
                        <motion.div
                            className="modal modal-lg"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h3 className="modal-title">
                                    {selectedCrypto.icon} {selectedCrypto.name} ({selectedCrypto.displaySymbol})
                                </h3>
                                <button className="modal-close" onClick={() => setShowChart(false)}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>目前價格</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                            ${formatPrice(selectedCrypto.price)}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>24h 漲跌</div>
                                        <div style={{
                                            fontSize: '1.25rem',
                                            fontWeight: 600,
                                            fontFamily: 'var(--font-mono)',
                                            color: selectedCrypto.priceChangePercent >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                                        }}>
                                            {selectedCrypto.priceChangePercent >= 0 ? '+' : ''}{selectedCrypto.priceChangePercent.toFixed(2)}%
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>24h 最高</div>
                                        <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', color: 'var(--stock-up)' }}>
                                            ${formatPrice(selectedCrypto.high24h)}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>24h 最低</div>
                                        <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', color: 'var(--stock-down)' }}>
                                            ${formatPrice(selectedCrypto.low24h)}
                                        </div>
                                    </div>
                                </div>

                                {/* K 線走勢 - 使用 Lightweight Charts */}
                                {klines.length > 0 && (
                                    <div>
                                        <h4 style={{ marginBottom: '1rem' }}>📈 近 30 日價格走勢</h4>
                                        <MiniCandlestickChart
                                            data={klines.map(k => ({
                                                time: Math.floor(k.openTime / 1000),  // Unix timestamp in seconds
                                                open: k.open,
                                                high: k.high,
                                                low: k.low,
                                                close: k.close,
                                            }))}
                                            height={200}
                                        />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
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
