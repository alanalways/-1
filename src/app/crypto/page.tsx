/**
 * Crypto Page - Binance API
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { getAllCryptoPrices, getKlines, formatPrice, formatVolume, CryptoPrice, CryptoKline } from '@/services/binance';
import { ErrorState, LoadingState } from '@/components/common/ErrorState';

export default function CryptoPage() {
    const [cryptos, setCryptos] = useState<CryptoPrice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState('');
    const [selectedCrypto, setSelectedCrypto] = useState<CryptoPrice | null>(null);
    const [klines, setKlines] = useState<CryptoKline[]>([]);
    const [showChart, setShowChart] = useState(false);

    const fetchPrices = useCallback(async () => {
        try {
            const data = await getAllCryptoPrices();
            if (data.length > 0) {
                setCryptos(data);
                setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
                setError(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPrices();
        const interval = setInterval(fetchPrices, 10000);
        return () => clearInterval(interval);
    }, [fetchPrices]);

    const handleCryptoClick = async (crypto: CryptoPrice) => {
        setSelectedCrypto(crypto);
        setShowChart(true);
        try {
            const data = await getKlines(crypto.symbol, '1d', 30);
            setKlines(data);
        } catch { setKlines([]); }
    };

    const totalQuoteVolume = cryptos.reduce((sum, c) => sum + c.quoteVolume24h, 0);

    if (loading) {
        return (
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    <Header title="Crypto" />
                    <LoadingState message="Loading..." />
                </main>
            </div>
        );
    }

    if (error && cryptos.length === 0) {
        return (
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    <Header title="Crypto" />
                    <ErrorState message={error} onRetry={fetchPrices} />
                </main>
            </div>
        );
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <Header title="Crypto" />
                <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Crypto Market</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Binance API</p>
                        </div>
                        <div style={{ display: 'flex', gap: '2rem' }}>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>24h Volume</span>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', fontWeight: 600 }}>${formatVolume(totalQuoteVolume)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Updated</span>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{lastUpdated}</div>
                            </div>
                        </div>
                    </div>
                </motion.div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                    {cryptos.map((crypto, index) => (
                        <motion.div key={crypto.symbol} className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ scale: 1.02 }} onClick={() => handleCryptoClick(crypto)} style={{ cursor: 'pointer' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>{crypto.icon}</div>
                                    <div><div style={{ fontWeight: 600 }}>{crypto.name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{crypto.displaySymbol}</div></div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatPrice(crypto.price)}</div>
                                    <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: crypto.priceChangePercent >= 0 ? 'var(--stock-up)' : 'var(--stock-down)' }}>{crypto.priceChangePercent >= 0 ? '+' : ''}{crypto.priceChangePercent.toFixed(2)}%</div>
                                </div>
                            </div>
                            <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <div><span>24h High: </span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--stock-up)' }}>{formatPrice(crypto.high24h)}</span></div>
                                <div><span>24h Low: </span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--stock-down)' }}>{formatPrice(crypto.low24h)}</span></div>
                                <div><span>Volume: </span><span style={{ fontFamily: 'var(--font-mono)' }}>{formatVolume(crypto.volume24h)}</span></div>
                                <div><span>Quote: </span><span style={{ fontFamily: 'var(--font-mono)' }}>${formatVolume(crypto.quoteVolume24h)}</span></div>
                            </div>
                        </motion.div>
                    ))}
                </div>
                <div style={{ padding: 'var(--spacing-md)', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Real-time - Auto-refresh 10s</div>
                {showChart && selectedCrypto && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setShowChart(false)}>
                        <motion.div className="modal modal-lg" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header"><h3 className="modal-title">{selectedCrypto.icon} {selectedCrypto.name}</h3><button className="modal-close" onClick={() => setShowChart(false)}>X</button></div>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Price</div><div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatPrice(selectedCrypto.price)}</div></div>
                                    <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>24h Change</div><div style={{ fontSize: '1.25rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: selectedCrypto.priceChangePercent >= 0 ? 'var(--stock-up)' : 'var(--stock-down)' }}>{selectedCrypto.priceChangePercent >= 0 ? '+' : ''}{selectedCrypto.priceChangePercent.toFixed(2)}%</div></div>
                                    <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>24h High</div><div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', color: 'var(--stock-up)' }}>{formatPrice(selectedCrypto.high24h)}</div></div>
                                    <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>24h Low</div><div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', color: 'var(--stock-down)' }}>{formatPrice(selectedCrypto.low24h)}</div></div>
                                </div>
                                {klines.length > 0 && (
                                    <div><h4 style={{ marginBottom: '1rem' }}>30 Day Chart</h4><div style={{ height: '200px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-end', padding: '1rem', gap: '2px' }}>
                                        {klines.map((k, i) => { const min = Math.min(...klines.map(x => x.low)); const max = Math.max(...klines.map(x => x.high)); const h = ((k.close - min) / (max - min)) * 150 + 10; return (<div key={i} style={{ flex: 1, height: h + 'px', background: k.close >= k.open ? 'var(--stock-up)' : 'var(--stock-down)', borderRadius: '2px', opacity: 0.8 }} />); })}
                                    </div></div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </main>
        </div>
    );
}
