/**
 * 回測模擬器頁面
 * 支援長期持有、定期定額、投資組合回測
 */

'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { useToast } from '@/components/common/Toast';
import { BacktestEngine, goldenCrossStrategy, rsiStrategy, buyAndHoldStrategy } from '@/services/backtest';
import type { CandlestickData } from '@/types/stock';
import type { BacktestResult, BacktestTrade } from '@/types/backtest';

// 回測模式
type BacktestMode = 'single' | 'dca' | 'portfolio';

// 可用策略
const STRATEGIES = [
    { id: 'buy_hold', name: '長期持有', description: '第一天買入，持有到期末' },
    { id: 'dca', name: '定期定額', description: '每月固定日期投入固定金額' },
    { id: 'golden_cross', name: '黃金交叉', description: 'EMA10 上穿 EMA30 買入' },
    { id: 'rsi', name: 'RSI 超買超賣', description: 'RSI<30 買入，RSI>70 賣出' },
];

// 定期定額設定介面
interface DCASettings {
    startDate: string;          // 開始日期
    monthlyDay: number;         // 每月幾號
    monthlyAmount: number;      // 每月投入金額
    investmentType: 'dca' | 'lumpsum';  // 定期定額 or 一次買入
}

// 投資組合設定介面
interface PortfolioItem {
    stockCode: string;
    weight: number;  // 權重百分比
}

// 模擬歷史資料生成
function generateMockHistoricalData(days: number = 252, seed: number = 500): CandlestickData[] {
    const data: CandlestickData[] = [];
    let price = seed;
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

// 定期定額回測
function runDCABacktest(
    data: CandlestickData[],
    settings: DCASettings,
    initialCapital: number
): BacktestResult {
    const trades: BacktestTrade[] = [];
    let totalShares = 0;
    let totalInvested = 0;
    let cash = initialCapital;

    const startIdx = data.findIndex(d => d.time >= settings.startDate);
    if (startIdx === -1) {
        return createEmptyResult(initialCapital);
    }

    // 一次買入模式
    if (settings.investmentType === 'lumpsum') {
        const entryPrice = data[startIdx].close;
        const shares = Math.floor(initialCapital / entryPrice);
        const cost = shares * entryPrice;

        totalShares = shares;
        totalInvested = cost;
        cash = initialCapital - cost;

        trades.push({
            type: 'buy',
            entryTime: data[startIdx].time,
            entryPrice,
            shares,
            exitTime: data[data.length - 1].time,
            exitPrice: data[data.length - 1].close,
            pnl: shares * (data[data.length - 1].close - entryPrice),
            pnlPercent: ((data[data.length - 1].close - entryPrice) / entryPrice) * 100,
        });
    } else {
        // 定期定額模式
        for (let i = startIdx; i < data.length; i++) {
            const date = new Date(data[i].time);

            // 每月指定日期買入
            if (date.getDate() === settings.monthlyDay) {
                const price = data[i].close;
                const shares = Math.floor(settings.monthlyAmount / price);

                if (shares > 0 && cash >= shares * price) {
                    const cost = shares * price;
                    totalShares += shares;
                    totalInvested += cost;
                    cash -= cost;

                    trades.push({
                        type: 'buy',
                        entryTime: data[i].time,
                        entryPrice: price,
                        shares,
                        exitTime: undefined,
                        exitPrice: undefined,
                        pnl: 0,
                        pnlPercent: 0,
                    });
                }
            }
        }
    }

    // 計算最終結果
    const finalPrice = data[data.length - 1].close;
    const finalValue = totalShares * finalPrice + cash;
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;

    // 更新每筆交易的損益
    trades.forEach(trade => {
        if (trade.type === 'buy' && trade.shares) {
            trade.exitTime = data[data.length - 1].time;
            trade.exitPrice = finalPrice;
            trade.pnl = trade.shares * (finalPrice - trade.entryPrice);
            trade.pnlPercent = ((finalPrice - trade.entryPrice) / trade.entryPrice) * 100;
        }
    });

    // 計算回撤
    let maxValue = initialCapital;
    let maxDrawdown = 0;
    const equityCurve: { date: string; value: number }[] = [];

    for (let i = 0; i < data.length; i++) {
        const value = totalShares * data[i].close + (initialCapital - totalInvested);
        equityCurve.push({ date: data[i].time, value });

        if (value > maxValue) maxValue = value;
        const drawdown = ((maxValue - value) / maxValue) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    const days = data.length;
    const years = days / 252;
    const annualizedReturn = (Math.pow(finalValue / initialCapital, 1 / years) - 1) * 100;

    return {
        startDate: data[0].time,
        endDate: data[data.length - 1].time,
        initialCapital,
        finalCapital: finalValue,
        trades,
        equityCurve,
        summary: {
            totalReturn,
            annualizedReturn,
            totalTrades: trades.length,
            winningTrades: trades.filter(t => t.pnl > 0).length,
            losingTrades: trades.filter(t => t.pnl < 0).length,
            winRate: (trades.filter(t => t.pnl > 0).length / trades.length) * 100 || 0,
            averageWin: trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / trades.filter(t => t.pnl > 0).length || 0,
            averageLoss: trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / trades.filter(t => t.pnl < 0).length || 0,
            profitFactor: 0,
            sharpeRatio: 0,
        },
        drawdown: {
            maxDrawdown: Math.min(maxDrawdown, 100),
            maxDrawdownDate: '',
            recoveryDate: null,
        },
        benchmarkReturn: totalReturn,
    };
}

// 投資組合回測
function runPortfolioBacktest(
    portfolio: PortfolioItem[],
    initialCapital: number,
    days: number = 252
): BacktestResult {
    const results: { code: string; weight: number; return: number; finalValue: number }[] = [];
    let totalPortfolioValue = 0;

    // 對每個標的執行回測
    portfolio.forEach((item, idx) => {
        const capital = initialCapital * (item.weight / 100);
        const data = generateMockHistoricalData(days, 500 + idx * 100);

        const engine = new BacktestEngine({
            initialCapital: capital,
            commissionRate: 0.001425,
            slippage: 0.1,
            allowShort: false,
        });

        const result = engine.run(data, buyAndHoldStrategy());
        const returnRate = result.summary.totalReturn || 0;

        results.push({
            code: item.stockCode,
            weight: item.weight,
            return: returnRate,
            finalValue: result.finalCapital,
        });

        totalPortfolioValue += result.finalCapital;
    });

    const totalReturn = ((totalPortfolioValue - initialCapital) / initialCapital) * 100;
    const weightedReturn = results.reduce((sum, r) => sum + (r.return * r.weight / 100), 0);

    return {
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        initialCapital,
        finalCapital: totalPortfolioValue,
        trades: [],
        equityCurve: [],
        summary: {
            totalReturn,
            annualizedReturn: weightedReturn,
            totalTrades: portfolio.length,
            winningTrades: results.filter(r => r.return > 0).length,
            losingTrades: results.filter(r => r.return < 0).length,
            winRate: (results.filter(r => r.return > 0).length / portfolio.length) * 100,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 0,
            sharpeRatio: 0,
        },
        drawdown: {
            maxDrawdown: Math.abs(Math.min(...results.map(r => r.return), 0)),
            maxDrawdownDate: '',
            recoveryDate: null,
        },
        benchmarkReturn: totalReturn,
        portfolioDetails: results,
    } as BacktestResult & { portfolioDetails: typeof results };
}

// 空結果
function createEmptyResult(initialCapital: number): BacktestResult {
    return {
        startDate: '',
        endDate: '',
        initialCapital,
        finalCapital: initialCapital,
        trades: [],
        equityCurve: [],
        summary: {
            totalReturn: 0,
            annualizedReturn: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 0,
            sharpeRatio: 0,
        },
        drawdown: { maxDrawdown: 0, maxDrawdownDate: '', recoveryDate: null },
        benchmarkReturn: 0,
    };
}

export default function BacktestPage() {
    const { showToast } = useToast();

    // 基本狀態
    const [mode, setMode] = useState<BacktestMode>('single');
    const [stockCode, setStockCode] = useState('2330');
    const [selectedStrategy, setSelectedStrategy] = useState('buy_hold');
    const [initialCapital, setInitialCapital] = useState(1000000);
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<(BacktestResult & { portfolioDetails?: any[] }) | null>(null);

    // 定期定額設定
    const [dcaSettings, setDcaSettings] = useState<DCASettings>({
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        monthlyDay: 1,
        monthlyAmount: 10000,
        investmentType: 'dca',
    });

    // 投資組合設定
    const [portfolio, setPortfolio] = useState<PortfolioItem[]>([
        { stockCode: '2330', weight: 40 },
        { stockCode: '2317', weight: 30 },
        { stockCode: '2454', weight: 30 },
    ]);

    // 新增投資組合項目
    const addPortfolioItem = () => {
        if (portfolio.length < 10) {
            setPortfolio([...portfolio, { stockCode: '', weight: 0 }]);
        }
    };

    // 移除投資組合項目
    const removePortfolioItem = (index: number) => {
        if (portfolio.length > 1) {
            setPortfolio(portfolio.filter((_, i) => i !== index));
        }
    };

    // 更新投資組合項目
    const updatePortfolioItem = (index: number, field: keyof PortfolioItem, value: string | number) => {
        const updated = [...portfolio];
        updated[index] = { ...updated[index], [field]: value };
        setPortfolio(updated);
    };

    // 執行回測
    const runBacktest = useCallback(async () => {
        if (mode === 'single' && !stockCode.trim()) {
            showToast('請輸入股票代碼', 'warning');
            return;
        }

        if (mode === 'portfolio') {
            const totalWeight = portfolio.reduce((sum, p) => sum + p.weight, 0);
            if (Math.abs(totalWeight - 100) > 0.01) {
                showToast(`權重總和必須為 100%（目前 ${totalWeight}%）`, 'warning');
                return;
            }
        }

        setIsRunning(true);
        showToast('開始執行回測...', 'info');

        try {
            await new Promise(resolve => setTimeout(resolve, 800));

            let backtestResult: BacktestResult;

            if (mode === 'portfolio') {
                // 投資組合回測
                backtestResult = runPortfolioBacktest(portfolio, initialCapital);
            } else if (selectedStrategy === 'dca' || mode === 'dca') {
                // 定期定額回測
                const data = generateMockHistoricalData(365);
                backtestResult = runDCABacktest(data, dcaSettings, initialCapital);
            } else {
                // 單一股票策略回測
                const data = generateMockHistoricalData(252);
                const engine = new BacktestEngine({
                    initialCapital,
                    commissionRate: 0.001425,
                    slippage: 0.1,
                    allowShort: false,
                });

                let strategyFn;
                switch (selectedStrategy) {
                    case 'buy_hold':
                        strategyFn = buyAndHoldStrategy();
                        break;
                    case 'golden_cross':
                        strategyFn = goldenCrossStrategy(10, 30);
                        break;
                    case 'rsi':
                        strategyFn = rsiStrategy(14, 30, 70);
                        break;
                    default:
                        strategyFn = buyAndHoldStrategy();
                }

                backtestResult = engine.run(data, strategyFn);
            }

            setResult(backtestResult as any);
            showToast('回測完成！', 'success');
        } catch (error) {
            console.error('回測失敗:', error);
            showToast('回測執行失敗', 'error');
        } finally {
            setIsRunning(false);
        }
    }, [mode, stockCode, selectedStrategy, initialCapital, dcaSettings, portfolio, showToast]);

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <Header title="回測模擬器" />

                {/* 模式切換 */}
                <div style={{
                    display: 'flex',
                    gap: 'var(--spacing-sm)',
                    marginBottom: 'var(--spacing-lg)',
                }}>
                    {[
                        { id: 'single', name: '單一股票', icon: '📈' },
                        { id: 'dca', name: '定期定額', icon: '📅' },
                        { id: 'portfolio', name: '投資組合', icon: '📊' },
                    ].map(m => (
                        <motion.button
                            key={m.id}
                            onClick={() => setMode(m.id as BacktestMode)}
                            style={{
                                padding: '12px 24px',
                                borderRadius: 'var(--radius-md)',
                                background: mode === m.id ? 'var(--primary)' : 'var(--bg-tertiary)',
                                color: mode === m.id ? 'white' : 'var(--text-secondary)',
                                fontWeight: 500,
                                transition: 'all 0.2s',
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {m.icon} {m.name}
                        </motion.button>
                    ))}
                </div>

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

                    {/* 單一股票模式 */}
                    {mode === 'single' && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 'var(--spacing-md)',
                        }}>
                            <InputField label="股票代碼" value={stockCode} onChange={(v) => setStockCode(v.toUpperCase())} placeholder="例如: 2330" />
                            <InputField label="初始資金 (NTD)" value={initialCapital} onChange={(v) => setInitialCapital(parseInt(v) || 0)} type="number" />
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
                    )}

                    {/* 定期定額模式 */}
                    {mode === 'dca' && (
                        <div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: 'var(--spacing-md)',
                                marginBottom: 'var(--spacing-md)',
                            }}>
                                <InputField label="股票代碼" value={stockCode} onChange={(v) => setStockCode(v.toUpperCase())} placeholder="例如: 2330" />
                                <InputField label="總投入資金 (NTD)" value={initialCapital} onChange={(v) => setInitialCapital(parseInt(v) || 0)} type="number" />
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: 'var(--spacing-md)',
                            }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        投資方式
                                    </label>
                                    <select
                                        value={dcaSettings.investmentType}
                                        onChange={(e) => setDcaSettings({ ...dcaSettings, investmentType: e.target.value as 'dca' | 'lumpsum' })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            background: 'var(--bg-input)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        <option value="dca">定期定額</option>
                                        <option value="lumpsum">一次買入</option>
                                    </select>
                                </div>
                                <InputField
                                    label="開始日期"
                                    value={dcaSettings.startDate}
                                    onChange={(v) => setDcaSettings({ ...dcaSettings, startDate: v })}
                                    type="date"
                                />
                                {dcaSettings.investmentType === 'dca' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                每月投資日
                                            </label>
                                            <select
                                                value={dcaSettings.monthlyDay}
                                                onChange={(e) => setDcaSettings({ ...dcaSettings, monthlyDay: parseInt(e.target.value) })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px',
                                                    background: 'var(--bg-input)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--text-primary)',
                                                }}
                                            >
                                                {Array.from({ length: 28 }, (_, i) => (
                                                    <option key={i + 1} value={i + 1}>{i + 1} 日</option>
                                                ))}
                                            </select>
                                        </div>
                                        <InputField
                                            label="每月投入金額"
                                            value={dcaSettings.monthlyAmount}
                                            onChange={(v) => setDcaSettings({ ...dcaSettings, monthlyAmount: parseInt(v) || 0 })}
                                            type="number"
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 投資組合模式 */}
                    {mode === 'portfolio' && (
                        <div>
                            <InputField
                                label="總投入資金 (NTD)"
                                value={initialCapital}
                                onChange={(v) => setInitialCapital(parseInt(v) || 0)}
                                type="number"
                            />

                            <div style={{ marginTop: 'var(--spacing-md)' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    投資組合配置（權重總和需為 100%）
                                </label>

                                {portfolio.map((item, index) => (
                                    <div key={index} style={{
                                        display: 'flex',
                                        gap: 'var(--spacing-sm)',
                                        marginBottom: 'var(--spacing-sm)',
                                        alignItems: 'center',
                                    }}>
                                        <input
                                            type="text"
                                            value={item.stockCode}
                                            onChange={(e) => updatePortfolioItem(index, 'stockCode', e.target.value.toUpperCase())}
                                            placeholder="股票代碼"
                                            style={{
                                                flex: 1,
                                                padding: '10px 14px',
                                                background: 'var(--bg-input)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-primary)',
                                            }}
                                        />
                                        <input
                                            type="number"
                                            value={item.weight}
                                            onChange={(e) => updatePortfolioItem(index, 'weight', parseInt(e.target.value) || 0)}
                                            placeholder="權重 %"
                                            style={{
                                                width: '100px',
                                                padding: '10px 14px',
                                                background: 'var(--bg-input)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-primary)',
                                            }}
                                        />
                                        <span style={{ color: 'var(--text-muted)' }}>%</span>
                                        <button
                                            onClick={() => removePortfolioItem(index)}
                                            style={{
                                                padding: '8px 12px',
                                                background: 'rgba(239, 68, 68, 0.2)',
                                                color: '#ef4444',
                                                borderRadius: 'var(--radius-sm)',
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-sm)' }}>
                                    <button
                                        onClick={addPortfolioItem}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'var(--bg-tertiary)',
                                            color: 'var(--text-secondary)',
                                            borderRadius: 'var(--radius-sm)',
                                        }}
                                    >
                                        + 新增標的
                                    </button>
                                    <span style={{
                                        fontSize: '0.875rem',
                                        color: Math.abs(portfolio.reduce((s, p) => s + p.weight, 0) - 100) < 0.01 ? 'var(--success)' : 'var(--warning)',
                                    }}>
                                        權重合計: {portfolio.reduce((s, p) => s + p.weight, 0)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 策略說明 */}
                    {mode === 'single' && (
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
                    )}

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
                                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: 'var(--spacing-md)',
                                marginBottom: 'var(--spacing-lg)',
                            }}>
                                <StatCard label="總報酬率" value={`${result.summary.totalReturn?.toFixed(2)}%`} isPositive={result.summary.totalReturn! > 0} />
                                <StatCard label="年化報酬" value={`${result.summary.annualizedReturn?.toFixed(2)}%`} isPositive={result.summary.annualizedReturn! > 0} />
                                <StatCard label="最大回撤" value={`-${result.drawdown.maxDrawdown.toFixed(2)}%`} isPositive={false} />
                                <StatCard label="交易次數" value={String(result.trades.length || result.summary.totalTrades)} isPositive={true} />
                                <StatCard label="最終資產" value={`$${result.finalCapital.toLocaleString()}`} isPositive={result.finalCapital > result.initialCapital} />
                                <StatCard label="淨損益" value={`$${(result.finalCapital - result.initialCapital).toLocaleString()}`} isPositive={result.finalCapital > result.initialCapital} />
                            </div>

                            {/* 投資組合詳情 */}
                            {result.portfolioDetails && (
                                <motion.div className="glass-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                                        📊 投資組合績效明細
                                    </h3>
                                    <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
                                        {result.portfolioDetails.map((item: any, i: number) => (
                                            <div key={i} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-sm)',
                                            }}>
                                                <div>
                                                    <span style={{ fontWeight: 600 }}>{item.code}</span>
                                                    <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>({item.weight}%)</span>
                                                </div>
                                                <div style={{
                                                    fontFamily: 'var(--font-mono)',
                                                    color: item.return > 0 ? 'var(--stock-up)' : 'var(--stock-down)',
                                                }}>
                                                    {item.return > 0 ? '+' : ''}{item.return.toFixed(2)}%
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* 交易記錄（非投資組合模式） */}
                            {result.trades.length > 0 && (
                                <motion.div className="glass-card">
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                                        📋 交易記錄 ({result.trades.length} 筆)
                                    </h3>

                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)' }}>日期</th>
                                                    <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>買入價</th>
                                                    <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>股數</th>
                                                    <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>現價</th>
                                                    <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>損益</th>
                                                    <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>報酬率</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.trades.slice(0, 12).map((trade, i) => (
                                                    <TradeRow key={i} trade={trade} />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {result.trades.length > 12 && (
                                        <p style={{ marginTop: 'var(--spacing-sm)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                            ... 還有 {result.trades.length - 12} 筆交易
                                        </p>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

// 輸入欄位元件
function InputField({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
}: {
    label: string;
    value: string | number;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
}) {
    return (
        <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
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
    );
}

// 統計卡片元件
function StatCard({ label, value, isPositive, subtitle }: { label: string; value: string; isPositive: boolean; subtitle?: string }) {
    return (
        <motion.div className="glass-card" style={{ textAlign: 'center' }} whileHover={{ scale: 1.02 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
            <div style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: isPositive ? 'var(--stock-up)' : 'var(--stock-down)',
            }}>
                {value}
            </div>
            {subtitle && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>}
        </motion.div>
    );
}

// 交易列元件
function TradeRow({ trade }: { trade: BacktestTrade }) {
    const isProfit = trade.pnl > 0;
    return (
        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            <td style={{ padding: '10px' }}>{trade.entryTime}</td>
            <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{trade.entryPrice.toFixed(2)}</td>
            <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{trade.shares || '-'}</td>
            <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{trade.exitPrice?.toFixed(2) || '-'}</td>
            <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: isProfit ? 'var(--stock-up)' : 'var(--stock-down)' }}>
                {isProfit ? '+' : ''}{trade.pnl.toFixed(0)}
            </td>
            <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: isProfit ? 'var(--stock-up)' : 'var(--stock-down)' }}>
                {isProfit ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
            </td>
        </tr>
    );
}
