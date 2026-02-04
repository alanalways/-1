/**
 * 深度分析頁面
 * 整合 Lightweight Charts K 線圖 + AI 分析
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { LightweightChart } from '@/components/charts';
import { useToast } from '@/components/common/Toast';
import type { CandlestickData } from '@/types/stock';

// 模擬 K 線資料
function generateMockData(days: number): CandlestickData[] {
    const data: CandlestickData[] = [];
    let basePrice = 150 + Math.random() * 50;
    const today = new Date();

    for (let i = days; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        const volatility = 0.02;
        const change = (Math.random() - 0.5) * 2 * volatility;
        const open = basePrice;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);

        data.push({
            time: date.toISOString().split('T')[0],
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            volume: Math.floor(Math.random() * 10000000) + 1000000,
        });

        basePrice = close;
    }

    return data;
}

export default function AnalysisPage() {
    const { showToast } = useToast();
    const [symbol, setSymbol] = useState<string>('');
    const [chartData, setChartData] = useState<CandlestickData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentRange, setCurrentRange] = useState<'1M' | '3M' | '6M' | '1Y'>('1M');

    const handleSearch = (query: string) => {
        if (!query.trim()) {
            showToast('請輸入股票代碼', 'warning');
            return;
        }

        setIsLoading(true);
        setSymbol(query.toUpperCase());

        // 模擬 API 載入延遲
        setTimeout(() => {
            const days = currentRange === '1M' ? 30 : currentRange === '3M' ? 90 : currentRange === '6M' ? 180 : 365;
            setChartData(generateMockData(days));
            setIsLoading(false);
            showToast(`已載入 ${query.toUpperCase()} 資料`, 'success');
        }, 800);
    };

    const handleRangeChange = (range: '1M' | '3M' | '6M' | '1Y') => {
        setCurrentRange(range);
        if (symbol) {
            setIsLoading(true);
            setTimeout(() => {
                const days = range === '1M' ? 30 : range === '3M' ? 90 : range === '6M' ? 180 : 365;
                setChartData(generateMockData(days));
                setIsLoading(false);
            }, 500);
        }
    };

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <Header title="深度分析" onSearch={handleSearch} />

                {/* K 線圖區塊 */}
                <motion.section
                    className="glass-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: 'var(--spacing-lg)' }}
                >
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--spacing-md)',
                    }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                            📈 K 線圖 {symbol && `- ${symbol}`}
                        </h2>
                        {isLoading && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                載入中...
                            </span>
                        )}
                    </div>

                    <LightweightChart
                        symbol={symbol}
                        data={chartData}
                        showEMA={true}
                        height={450}
                        onRangeChange={handleRangeChange}
                    />
                </motion.section>

                {/* AI 分析區塊 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 'var(--spacing-lg)',
                }}>
                    {/* AI 評分 */}
                    <motion.section
                        className="glass-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                            🎯 AI 綜合評分
                        </h3>

                        {symbol ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
                                <div style={{
                                    width: 120,
                                    height: 120,
                                    margin: '0 auto',
                                    borderRadius: '50%',
                                    background: 'conic-gradient(var(--success) 0% 65%, var(--bg-tertiary) 65% 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                }}>
                                    <div style={{
                                        width: 100,
                                        height: 100,
                                        borderRadius: '50%',
                                        background: 'var(--bg-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'column',
                                    }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 700 }}>65</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>分</span>
                                    </div>
                                </div>
                                <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--success)' }}>
                                    偏多格局，可考慮做多
                                </p>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                                <p>輸入股票代碼以獲取 AI 評分</p>
                            </div>
                        )}
                    </motion.section>

                    {/* 技術指標 */}
                    <motion.section
                        className="glass-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                            📊 技術指標
                        </h3>

                        {symbol && chartData.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                {[
                                    { label: 'MA20', value: chartData[chartData.length - 1]?.close.toFixed(2) },
                                    { label: 'EMA50', value: (chartData[chartData.length - 1]?.close * 0.98).toFixed(2) },
                                    { label: 'RSI', value: '58.2' },
                                    { label: '趨勢', value: '📈 多頭' },
                                ].map((indicator) => (
                                    <div key={indicator.label} style={{
                                        padding: 'var(--spacing-sm)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                    }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{indicator.label}</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{indicator.value}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                                <p>輸入股票代碼以查看技術指標</p>
                            </div>
                        )}
                    </motion.section>

                    {/* 投資策略建議 */}
                    <motion.section
                        className="glass-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        style={{ gridColumn: 'span 2' }}
                    >
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                            💡 投資策略建議
                        </h3>

                        {symbol ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
                                {[
                                    { term: '短線', bias: '多', entry: '152.00', tp: '160.00', sl: '148.00', reason: '突破整理區間' },
                                    { term: '中線', bias: '觀望', entry: '145.00', tp: '165.00', sl: '140.00', reason: '等待回踩確認' },
                                    { term: '長線', bias: '多', entry: '140.00', tp: '180.00', sl: '130.00', reason: '長期趨勢向上' },
                                ].map((strategy) => (
                                    <div key={strategy.term} style={{
                                        padding: 'var(--spacing-md)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        borderLeft: `3px solid ${strategy.bias === '多' ? 'var(--stock-up)' : strategy.bias === '空' ? 'var(--stock-down)' : 'var(--warning)'}`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 600 }}>{strategy.term}策略</span>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                background: strategy.bias === '多' ? 'rgba(239, 68, 68, 0.2)' : strategy.bias === '空' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                color: strategy.bias === '多' ? '#ef4444' : strategy.bias === '空' ? '#22c55e' : '#f59e0b',
                                            }}>
                                                {strategy.bias}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            <div>進場：{strategy.entry}</div>
                                            <div style={{ color: 'var(--success)' }}>止盈：{strategy.tp}</div>
                                            <div style={{ color: 'var(--error)' }}>止損：{strategy.sl}</div>
                                        </div>
                                        <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {strategy.reason}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                                <p>輸入股票代碼以獲取投資策略建議</p>
                            </div>
                        )}
                    </motion.section>
                </div>
            </main>
        </div>
    );
}
