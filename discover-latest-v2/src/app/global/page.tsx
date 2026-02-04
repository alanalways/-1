/**
 * 國際市場頁面
 * 使用 Yahoo Finance API 顯示國際市場資訊
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { getAllIndices, getHistoricalData, groupByRegion, formatIndexPrice, MarketIndex, HistoricalData } from '@/services/yahoo';
import { MiniCandlestickChart } from '@/components/charts/MiniAreaChart';

export default function GlobalMarketPage() {
    const [indices, setIndices] = useState<MarketIndex[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState('');
    const [selectedIndex, setSelectedIndex] = useState<MarketIndex | null>(null);
    const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
    const [showChart, setShowChart] = useState(false);
    const [chartRange, setChartRange] = useState<'1mo' | '3mo' | '6mo' | '1y'>('1mo');

    // 取得所有指數
    const fetchIndices = useCallback(async () => {
        try {
            const data = await getAllIndices();
            if (data.length > 0) {
                setIndices(data);
                setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
            }
        } catch (error) {
            console.error('取得國際指數失敗:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // 初始載入
    useEffect(() => {
        fetchIndices();

        // 每分鐘更新一次
        const interval = setInterval(fetchIndices, 60000);
        return () => clearInterval(interval);
    }, [fetchIndices]);

    // 點擊查看詳情
    const handleIndexClick = async (index: MarketIndex) => {
        setSelectedIndex(index);
        setShowChart(true);

        // 取得歷史資料
        const data = await getHistoricalData(index.symbol, chartRange);
        setHistoricalData(data);
    };

    // 切換圖表時間範圍
    const handleRangeChange = async (range: '1mo' | '3mo' | '6mo' | '1y') => {
        setChartRange(range);
        if (selectedIndex) {
            const data = await getHistoricalData(selectedIndex.symbol, range);
            setHistoricalData(data);
        }
    };

    // 按區域分組
    const groupedIndices = groupByRegion(indices);

    if (loading) {
        return (
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    <Header title="國際市場" />
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
                                美股、歐股、亞股即時行情・點擊查看詳細圖表
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>最後更新</span>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{lastUpdated}</div>
                        </div>
                    </div>
                </motion.div>

                {/* 各區域市場 */}
                {Object.entries(groupedIndices).map(([region, regionIndices], regionIndex) => (
                    <motion.div
                        key={region}
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
                            {region}
                        </h3>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: 'var(--spacing-md)',
                        }}>
                            {regionIndices.map((market, index) => (
                                <motion.div
                                    key={market.symbol}
                                    className="glass-card"
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => handleIndexClick(market)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.5rem' }}>{market.emoji}</span>
                                                <div style={{ fontWeight: 600 }}>{market.name}</div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                {market.symbol}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{
                                                fontSize: '1.25rem',
                                                fontWeight: 700,
                                                fontFamily: 'var(--font-mono)',
                                            }}>
                                                {formatIndexPrice(market.price)}
                                            </div>
                                            <div style={{
                                                fontSize: '0.875rem',
                                                fontFamily: 'var(--font-mono)',
                                                color: market.changePercent >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                                            }}>
                                                {market.changePercent >= 0 ? '+' : ''}{market.change.toFixed(2)}
                                                ({market.changePercent >= 0 ? '+' : ''}{market.changePercent.toFixed(2)}%)
                                            </div>
                                        </div>
                                    </div>

                                    {/* 簡易迷你圖 */}
                                    <div style={{
                                        marginTop: 'var(--spacing-md)',
                                        height: '40px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        alignItems: 'flex-end',
                                    }}>
                                        {Array.from({ length: 20 }).map((_, i) => {
                                            const height = 10 + Math.random() * 25;
                                            return (
                                                <div
                                                    key={i}
                                                    style={{
                                                        flex: 1,
                                                        height: `${height}px`,
                                                        background: market.changePercent >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                                                        opacity: 0.3 + (i / 20) * 0.7,
                                                    }}
                                                />
                                            );
                                        })}
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
                    💡 提示：點擊任一指數卡片可查看歷史走勢圖表
                </div>

                {/* 詳情 Modal */}
                {showChart && selectedIndex && (
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
                                    {selectedIndex.emoji} {selectedIndex.name}
                                </h3>
                                <button className="modal-close" onClick={() => setShowChart(false)}>✕</button>
                            </div>
                            <div className="modal-body">
                                {/* 指數資訊 */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>目前價格</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                            {formatIndexPrice(selectedIndex.price)}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>漲跌</div>
                                        <div style={{
                                            fontSize: '1.25rem',
                                            fontWeight: 600,
                                            fontFamily: 'var(--font-mono)',
                                            color: selectedIndex.changePercent >= 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                                        }}>
                                            {selectedIndex.changePercent >= 0 ? '+' : ''}{selectedIndex.changePercent.toFixed(2)}%
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>今日最高</div>
                                        <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', color: 'var(--stock-up)' }}>
                                            {formatIndexPrice(selectedIndex.dayHigh)}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>今日最低</div>
                                        <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', color: 'var(--stock-down)' }}>
                                            {formatIndexPrice(selectedIndex.dayLow)}
                                        </div>
                                    </div>
                                </div>

                                {/* 時間範圍選擇 */}
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                    {(['1mo', '3mo', '6mo', '1y'] as const).map(range => (
                                        <button
                                            key={range}
                                            onClick={() => handleRangeChange(range)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: 'var(--radius-sm)',
                                                background: chartRange === range ? 'var(--primary)' : 'var(--bg-tertiary)',
                                                color: chartRange === range ? 'white' : 'var(--text-secondary)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {range === '1mo' ? '1個月' : range === '3mo' ? '3個月' : range === '6mo' ? '6個月' : '1年'}
                                        </button>
                                    ))}
                                </div>

                                {/* 價格走勢圖 - 使用 Lightweight Charts */}
                                {historicalData.length > 0 && (
                                    <div>
                                        <h4 style={{ marginBottom: '1rem' }}>📈 價格走勢</h4>
                                        <MiniCandlestickChart
                                            data={historicalData.map(d => ({
                                                time: d.date.toISOString().split('T')[0],  // YYYY-MM-DD
                                                open: d.open,
                                                high: d.high,
                                                low: d.low,
                                                close: d.close,
                                            }))}
                                            height={250}
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
