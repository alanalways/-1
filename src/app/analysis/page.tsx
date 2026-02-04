/**
 * 深度分析頁面
 * 整合 Lightweight Charts K 線圖 + AI 分析
 * 使用真實 Yahoo Finance API 資料
 */

'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { LightweightChart } from '@/components/charts';
import { useToast } from '@/components/common/Toast';
import { ErrorState, LoadingState } from '@/components/common/ErrorState';
import { getHistoricalData } from '@/services/yahoo';
import { analyzeStock, initGemini, AnalysisResult } from '@/services/gemini';
import type { CandlestickData } from '@/types/stock';

// Range 對應到 Yahoo API 的 range 參數
const RANGE_MAP: Record<'1M' | '3M' | '6M' | '1Y', '1mo' | '3mo' | '6mo' | '1y'> = {
    '1M': '1mo',
    '3M': '3mo',
    '6M': '6mo',
    '1Y': '1y',
};

export default function AnalysisPage() {
    const { showToast } = useToast();
    const [symbol, setSymbol] = useState<string>('');
    const [stockName, setStockName] = useState<string>('');
    const [chartData, setChartData] = useState<CandlestickData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentRange, setCurrentRange] = useState<'1M' | '3M' | '6M' | '1Y'>('1M');

    // AI 分析結果
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // 載入股票資料
    const loadStockData = useCallback(async (stockSymbol: string, range: '1M' | '3M' | '6M' | '1Y') => {
        setIsLoading(true);
        setError(null);

        try {
            // 判斷是否為台股代碼（純數字）或國際股票
            const isTwStock = /^\d{4,6}$/.test(stockSymbol);
            const yahooSymbol = isTwStock ? `${stockSymbol}.TW` : stockSymbol;

            const history = await getHistoricalData(yahooSymbol, RANGE_MAP[range]);

            if (!history || history.length === 0) {
                throw new Error('無法取得歷史資料');
            }

            // 轉換為 CandlestickData 格式
            const data: CandlestickData[] = history
                .map((d) => {
                    // d.date 是 Date 物件
                    const dateObj = new Date(d.date);
                    const timeStr = !isNaN(dateObj.getTime())
                        ? dateObj.toISOString().split('T')[0]
                        : '';
                    return {
                        time: timeStr,
                        open: d.open,
                        high: d.high,
                        low: d.low,
                        close: d.close,
                        volume: d.volume || 0,
                    };
                })
                .filter(item => item.time !== '');

            setChartData(data);
            setStockName(isTwStock ? stockSymbol : yahooSymbol);
            showToast(`已載入 ${stockSymbol.toUpperCase()} 資料`, 'success');

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : '載入資料失敗';
            setError(errorMsg);
            setChartData([]);
            showToast(errorMsg, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    // AI 分析
    const runAIAnalysis = useCallback(async () => {
        if (!symbol || chartData.length === 0) {
            showToast('請先載入股票資料', 'warning');
            return;
        }

        setIsAnalyzing(true);

        try {
            // 取得最新價格
            const latestData = chartData[chartData.length - 1];
            const previousData = chartData[chartData.length - 2];
            const changePercent = previousData
                ? ((latestData.close - previousData.close) / previousData.close) * 100
                : 0;

            const result = await analyzeStock({
                code: symbol,
                name: stockName || symbol,
                price: latestData.close,
                changePercent,
            });

            if (result) {
                setAnalysisResult(result);
                showToast('AI 分析完成', 'success');
            } else {
                throw new Error('AI 分析失敗');
            }

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'AI 分析失敗';
            showToast(errorMsg, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    }, [symbol, stockName, chartData, showToast]);

    const handleSearch = async (query: string) => {
        if (!query.trim()) {
            showToast('請輸入股票代碼', 'warning');
            return;
        }

        setSymbol(query.toUpperCase());
        setAnalysisResult(null);
        await loadStockData(query.toUpperCase(), currentRange);
    };

    const handleRangeChange = async (range: '1M' | '3M' | '6M' | '1Y') => {
        setCurrentRange(range);
        if (symbol) {
            await loadStockData(symbol, range);
        }
    };

    const handleRetry = () => {
        if (symbol) {
            loadStockData(symbol, currentRange);
        }
    };

    // 取得評分顏色
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'var(--success)';
        if (score >= 60) return 'var(--stock-up)';
        if (score >= 40) return 'var(--warning)';
        return 'var(--error)';
    };

    // 取得評分描述
    const getScoreDescription = (score: number) => {
        if (score >= 80) return '強勢多頭，技術面極佳';
        if (score >= 60) return '偏多格局，可考慮做多';
        if (score >= 40) return '震盪整理，觀望為主';
        if (score >= 20) return '偏空格局，謹慎操作';
        return '強勢空頭，建議避開';
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

                    {error ? (
                        <ErrorState
                            message={error}
                            onRetry={handleRetry}
                        />
                    ) : (
                        <LightweightChart
                            symbol={symbol}
                            data={chartData}
                            showEMA={true}
                            height={450}
                            onRangeChange={handleRangeChange}
                        />
                    )}
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
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--spacing-md)',
                        }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                                🎯 AI 綜合評分
                            </h3>
                            {symbol && chartData.length > 0 && (
                                <motion.button
                                    onClick={runAIAnalysis}
                                    disabled={isAnalyzing}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    style={{
                                        padding: '8px 16px',
                                        background: isAnalyzing ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {isAnalyzing ? '分析中...' : '執行 AI 分析'}
                                </motion.button>
                            )}
                        </div>

                        {isAnalyzing ? (
                            <LoadingState message="AI 正在分析中..." />
                        ) : analysisResult ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
                                <div style={{
                                    width: 120,
                                    height: 120,
                                    margin: '0 auto',
                                    borderRadius: '50%',
                                    background: `conic-gradient(${getScoreColor(analysisResult.score)} 0% ${analysisResult.score}%, var(--bg-tertiary) ${analysisResult.score}% 100%)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
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
                                        <span style={{ fontSize: '2rem', fontWeight: 700 }}>{analysisResult.score}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>分</span>
                                    </div>
                                </div>
                                <p style={{ marginTop: 'var(--spacing-md)', color: getScoreColor(analysisResult.score) }}>
                                    {getScoreDescription(analysisResult.score)}
                                </p>
                                <p style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    信心度: {Math.round(analysisResult.confidence * 100)}%
                                </p>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                                <p>{symbol ? '點擊「執行 AI 分析」開始分析' : '輸入股票代碼以獲取 AI 評分'}</p>
                            </div>
                        )}
                    </motion.section>

                    {/* 趨勢分析 */}
                    <motion.section
                        className="glass-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                            📊 趨勢分析
                        </h3>

                        {analysisResult?.trend_analysis ? (
                            <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                                <p>{analysisResult.trend_analysis}</p>
                                {analysisResult.risk_warning && (
                                    <div style={{
                                        marginTop: 'var(--spacing-md)',
                                        padding: 'var(--spacing-sm)',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        borderRadius: 'var(--radius-sm)',
                                    }}>
                                        <span style={{ color: '#fca5a5' }}>⚠️ 風險提醒：</span>
                                        <span style={{ color: 'var(--text-muted)' }}> {analysisResult.risk_warning}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                                <p>執行 AI 分析後顯示趨勢分析</p>
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

                        {analysisResult?.strategy ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
                                {[
                                    { term: '短線', data: analysisResult.strategy.short_term },
                                    { term: '中線', data: analysisResult.strategy.mid_term },
                                    { term: '長線', data: analysisResult.strategy.long_term },
                                ].map((strategy) => (
                                    <div key={strategy.term} style={{
                                        padding: 'var(--spacing-md)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        borderLeft: `3px solid ${strategy.data?.bias === '多' ? 'var(--stock-up)' : strategy.data?.bias === '空' ? 'var(--stock-down)' : 'var(--warning)'}`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 600 }}>{strategy.term}策略</span>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                background: strategy.data?.bias === '多' ? 'rgba(239, 68, 68, 0.2)' : strategy.data?.bias === '空' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                color: strategy.data?.bias === '多' ? '#ef4444' : strategy.data?.bias === '空' ? '#22c55e' : '#f59e0b',
                                            }}>
                                                {strategy.data?.bias || '觀望'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            <div>進場：{strategy.data?.entry?.toFixed(2) || '-'}</div>
                                            <div style={{ color: 'var(--success)' }}>止盈：{strategy.data?.tp?.toFixed(2) || '-'}</div>
                                            <div style={{ color: 'var(--error)' }}>止損：{strategy.data?.sl?.toFixed(2) || '-'}</div>
                                        </div>
                                        <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {strategy.data?.rationale || '-'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                                <p>執行 AI 分析後顯示投資策略建議</p>
                            </div>
                        )}
                    </motion.section>
                </div>
            </main>
        </div>
    );
}
