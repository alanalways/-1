/**
 * 回測模擬器頁面
 * 提供歷史回測功能
 */

'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { useToast } from '@/components/common/Toast';
import { BacktestEngine, goldenCrossStrategy, rsiStrategy } from '@/services/backtest';
import type { CandlestickData } from '@/types/stock';
import type { BacktestResult, BacktestTrade } from '@/types/backtest';

// 可用策略
const STRATEGIES = [
    { id: 'golden_cross', name: '黃金交叉', description: 'EMA10 上穿 EMA30 買入，下穿賣出' },
    { id: 'rsi', name: 'RSI 超買超賣', description: 'RSI<30 買入，RSI>70 賣出' },
    { id: 'custom', name: '自訂策略', description: '（開發中）' },
];

// 模擬歷史資料生成
function generateMockHistoricalData(days: number = 252): CandlestickData[] {
    const data: CandlestickData[] = [];
    let price = 500;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        const change = (Math.random() - 0.48) * 10;
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * 3;
        const low = Math.min(open, close) - Math.random() * 3;

        data.push({
            time: date.toISOString().split('T')[0],
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            volume: Math.floor(Math.random() * 10000000 + 1000000),
        });

        price = close;
    }

    return data;
}

export default function BacktestPage() {
    const { showToast } = useToast();

    // 狀態
    const [stockCode, setStockCode] = useState('2330');
    const [selectedStrategy, setSelectedStrategy] = useState('golden_cross');
    const [initialCapital, setInitialCapital] = useState(1000000);
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<BacktestResult | null>(null);

    // 執行回測
    const runBacktest = useCallback(async () => {
        if (!stockCode.trim()) {
            showToast('請輸入股票代碼', 'warning');
            return;
        }

        setIsRunning(true);
        showToast('開始執行回測...', 'info');

        try {
            // 模擬載入延遲
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 生成模擬資料（實際應從 API 取得）
            const data = generateMockHistoricalData(252);

            // 建立回測引擎
            const engine = new BacktestEngine({
                initialCapital,
                commissionRate: 0.001425,
                slippage: 0.1,
                allowShort: false,
            });

            // 選擇策略
            let strategyFn;
            switch (selectedStrategy) {
                case 'golden_cross':
                    strategyFn = goldenCrossStrategy(10, 30);
                    break;
                case 'rsi':
                    strategyFn = rsiStrategy(14, 30, 70);
                    break;
                default:
                    strategyFn = goldenCrossStrategy(10, 30);
            }

            // 執行回測
            const backtestResult = engine.run(data, strategyFn);
            setResult(backtestResult);

            showToast('回測完成！', 'success');
        } catch (error) {
            console.error('回測失敗:', error);
            showToast('回測執行失敗', 'error');
        } finally {
            setIsRunning(false);
        }
    }, [stockCode, selectedStrategy, initialCapital, showToast]);

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <Header title="回測模擬器" />

                {/* 參數設定區 */}
                <motion.div
                    className="glass-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: 'var(--spacing-lg)' }}
                >
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                        🎯 回測參數
                    </h2>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 'var(--spacing-md)',
                    }}>
                        {/* 股票代碼 */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                股票代碼
                            </label>
                            <input
                                type="text"
                                value={stockCode}
                                onChange={(e) => setStockCode(e.target.value.toUpperCase())}
                                placeholder="例如: 2330"
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>

                        {/* 初始資金 */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                初始資金 (NTD)
                            </label>
                            <input
                                type="number"
                                value={initialCapital}
                                onChange={(e) => setInitialCapital(parseInt(e.target.value) || 0)}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>

                        {/* 策略選擇 */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                交易策略
                            </label>
                            <select
                                value={selectedStrategy}
                                onChange={(e) => setSelectedStrategy(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                }}
                            >
                                {STRATEGIES.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 策略說明 */}
                    <div style={{
                        marginTop: 'var(--spacing-md)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: 'rgba(99, 102, 241, 0.1)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                    }}>
                        💡 {STRATEGIES.find(s => s.id === selectedStrategy)?.description}
                    </div>

                    {/* 執行按鈕 */}
                    <motion.button
                        onClick={runBacktest}
                        disabled={isRunning}
                        style={{
                            marginTop: 'var(--spacing-lg)',
                            width: '100%',
                            padding: '14px',
                            background: isRunning ? 'var(--bg-tertiary)' : 'var(--primary)',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: 600,
                            fontSize: '1rem',
                            cursor: isRunning ? 'not-allowed' : 'pointer',
                        }}
                        whileHover={!isRunning ? { scale: 1.01 } : {}}
                        whileTap={!isRunning ? { scale: 0.99 } : {}}
                    >
                        {isRunning ? '⏳ 執行中...' : '🚀 開始回測'}
                    </motion.button>
                </motion.div>

                {/* 結果區域 */}
                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* 績效摘要 */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: 'var(--spacing-md)',
                                marginBottom: 'var(--spacing-lg)',
                            }}>
                                <StatCard
                                    label="總報酬率"
                                    value={`${result.summary.totalReturn?.toFixed(2)}%`}
                                    isPositive={result.summary.totalReturn! > 0}
                                />
                                <StatCard
                                    label="年化報酬"
                                    value={`${result.summary.annualizedReturn?.toFixed(2)}%`}
                                    isPositive={result.summary.annualizedReturn! > 0}
                                />
                                <StatCard
                                    label="最大回撤"
                                    value={`-${result.drawdown.maxDrawdown.toFixed(2)}%`}
                                    isPositive={false}
                                />
                                <StatCard
                                    label="勝率"
                                    value={`${result.summary.winRate?.toFixed(1)}%`}
                                    isPositive={result.summary.winRate! > 50}
                                />
                                <StatCard
                                    label="夏普比率"
                                    value={result.summary.sharpeRatio?.toFixed(2) || '0'}
                                    isPositive={result.summary.sharpeRatio! > 1}
                                />
                                <StatCard
                                    label="基準報酬"
                                    value={`${result.benchmarkReturn.toFixed(2)}%`}
                                    isPositive={result.benchmarkReturn > 0}
                                    subtitle="買入持有"
                                />
                            </div>

                            {/* 交易記錄 */}
                            <motion.div
                                className="glass-card"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                                    📋 交易記錄 ({result.trades.length} 筆)
                                </h3>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontSize: '0.875rem',
                                    }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)' }}>類型</th>
                                                <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)' }}>進場日期</th>
                                                <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>進場價</th>
                                                <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)' }}>出場日期</th>
                                                <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>出場價</th>
                                                <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>損益</th>
                                                <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>報酬率</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.trades.slice(0, 10).map((trade, i) => (
                                                <TradeRow key={i} trade={trade} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {result.trades.length > 10 && (
                                    <p style={{ marginTop: 'var(--spacing-sm)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        ... 還有 {result.trades.length - 10} 筆交易
                                    </p>
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

// 統計卡片元件
function StatCard({
    label,
    value,
    isPositive,
    subtitle
}: {
    label: string;
    value: string;
    isPositive: boolean;
    subtitle?: string;
}) {
    return (
        <motion.div
            className="glass-card"
            style={{ textAlign: 'center' }}
            whileHover={{ scale: 1.02 }}
        >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {label}
            </div>
            <div style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: isPositive ? 'var(--stock-up)' : 'var(--stock-down)',
            }}>
                {value}
            </div>
            {subtitle && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {subtitle}
                </div>
            )}
        </motion.div>
    );
}

// 交易列元件
function TradeRow({ trade }: { trade: BacktestTrade }) {
    const isProfit = trade.pnl > 0;

    return (
        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            <td style={{ padding: '10px' }}>
                <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: trade.type === 'buy' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                    color: trade.type === 'buy' ? '#ef4444' : '#22c55e',
                    fontSize: '0.75rem',
                }}>
                    {trade.type === 'buy' ? '買入' : '賣出'}
                </span>
            </td>
            <td style={{ padding: '10px' }}>{trade.entryTime}</td>
            <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {trade.entryPrice.toFixed(2)}
            </td>
            <td style={{ padding: '10px' }}>{trade.exitTime || '-'}</td>
            <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {trade.exitPrice ? trade.exitPrice.toFixed(2) : '-'}
            </td>
            <td style={{
                padding: '10px',
                textAlign: 'right',
                fontFamily: 'var(--font-mono)',
                color: isProfit ? 'var(--stock-up)' : 'var(--stock-down)',
            }}>
                {isProfit ? '+' : ''}{trade.pnl.toFixed(0)}
            </td>
            <td style={{
                padding: '10px',
                textAlign: 'right',
                fontFamily: 'var(--font-mono)',
                color: isProfit ? 'var(--stock-up)' : 'var(--stock-down)',
            }}>
                {isProfit ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
            </td>
        </tr>
    );
}
