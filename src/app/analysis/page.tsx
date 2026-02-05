/**
 * 深度分析頁面
 * 整合 Lightweight Charts K 線圖 + AI 分析
 * 使用真實 Yahoo Finance API 資料
 */

'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { LightweightChart } from '@/components/charts';
import { useToast } from '@/components/common/Toast';
import { ErrorState, LoadingState } from '@/components/common/ErrorState';
import { getHistoricalData, getFundamentals } from '@/services/yahoo';
import { AnalysisResult } from '@/services/gemini';
import { calculateTechnicalFeatures, PriceData, TechnicalFeatures } from '@/services/technicalAnalysis';
import type { CandlestickData } from '@/types/stock';

// Range 對應到 Yahoo API 的 range 參數
const RANGE_MAP: Record<'1M' | '3M' | '6M' | '1Y', '1mo' | '3mo' | '6mo' | '1y'> = {
    '1M': '1mo',
    '3M': '3mo',
    '6M': '6mo',
    '1Y': '1y',
};

// 包裝元件用於處理 Suspense
function AnalysisPageContent() {
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const [symbol, setSymbol] = useState<string>('');
    const [stockName, setStockName] = useState<string>('');
    const [chartData, setChartData] = useState<CandlestickData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentRange, setCurrentRange] = useState<'1M' | '3M' | '6M' | '1Y'>('1M');
    const [autoAnalyzeTriggered, setAutoAnalyzeTriggered] = useState(false);

    // AI 分析結果
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // 新增：特徵數據狀態
    const [technicalFeatures, setTechnicalFeatures] = useState<TechnicalFeatures | null>(null);
    const [fundamentalData, setFundamentalData] = useState<any>(null);

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
            const isTwStock = /^\d{4,6}$/.test(symbol);
            const yahooSymbol = isTwStock ? `${symbol}.TW` : symbol;

            // 1. 取得基本面數據
            let fundamentalData = null;
            try {
                fundamentalData = await getFundamentals(yahooSymbol);
            } catch (fErr) {
                console.warn('[AI Analysis] 無法取得基本面數據:', fErr);
            }

            // 2. 計算技術面特徵
            const priceData: PriceData[] = chartData.map(d => ({
                date: d.time as string,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.volume || 0,
            }));

            const technicalFeatures = calculateTechnicalFeatures(priceData);
            setTechnicalFeatures(technicalFeatures);
            setFundamentalData(fundamentalData);

            // 3. 透過安全的 API 路由執行 AI 分析（API Key 不會暴露）
            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: symbol,
                    name: stockName || symbol,
                    price: technicalFeatures.current_price,
                    changePercent: ((technicalFeatures.current_price - (priceData[priceData.length - 2]?.close || technicalFeatures.current_price)) / (priceData[priceData.length - 2]?.close || technicalFeatures.current_price)) * 100,
                    technical: {
                        trend_pattern: technicalFeatures.trend_pattern,
                        rsi_level: technicalFeatures.rsi_level,
                        rsi: technicalFeatures.rsi,
                        macd_signal: technicalFeatures.macd_cross,
                        macd: technicalFeatures.macd,
                        price_vs_sr: technicalFeatures.price_vs_sr,
                        ma5: technicalFeatures.ma5,
                        ma20: technicalFeatures.ma20,
                        ma60: technicalFeatures.ma60,
                        support: technicalFeatures.support,
                        resistance: technicalFeatures.resistance,
                    },
                    fundamental: fundamentalData ? {
                        pe: fundamentalData.pe,
                        pb: fundamentalData.pb,
                        eps_growth: fundamentalData.epsGrowth,
                        roe: fundamentalData.roe,
                        fcf_yield: fundamentalData.freeCashFlow ? (fundamentalData.freeCashFlow / (fundamentalData.marketCap || 1)) * 100 : null,
                    } : undefined,
                }),
            });

            const data = await response.json();

            if (data.success && data.result) {
                setAnalysisResult(data.result);
                showToast('AI 分析完成', 'success');
            } else {
                throw new Error(data.error || 'AI 分析失敗');
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

    // 🔥 從 URL 參數自動載入股票資料
    useEffect(() => {
        const code = searchParams.get('code');
        if (code && !symbol) {
            const upperCode = code.toUpperCase();
            setSymbol(upperCode);
            loadStockData(upperCode, currentRange);
        }
    }, [searchParams, symbol, loadStockData, currentRange]);

    // 🔥 載入完成後自動執行 AI 分析（只觸發一次）
    useEffect(() => {
        const code = searchParams.get('code');
        if (code && chartData.length > 0 && !autoAnalyzeTriggered && !isAnalyzing && !analysisResult) {
            setAutoAnalyzeTriggered(true);
            runAIAnalysis();
        }
    }, [searchParams, chartData, autoAnalyzeTriggered, isAnalyzing, analysisResult, runAIAnalysis]);

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

                    {/* 趨勢分析與詳細指標 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
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

                                    {/* AI 理由與風險 (進階) */}
                                    {analysisResult.advanced && (
                                        <div style={{ marginTop: 'var(--spacing-md)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                            <div style={{ padding: 'var(--spacing-sm)', background: 'rgba(34, 197, 94, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                                                <h4 style={{ color: 'var(--stock-up)', fontSize: '0.875rem', marginBottom: '8px' }}>✅ 多方理由</h4>
                                                <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                                                    {analysisResult.advanced.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                                </ul>
                                            </div>
                                            <div style={{ padding: 'var(--spacing-sm)', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                                <h4 style={{ color: 'var(--stock-down)', fontSize: '0.875rem', marginBottom: '8px' }}>⚠️ 風險提示</h4>
                                                <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                                                    {analysisResult.advanced.risks.map((r, i) => <li key={i}>{r}</li>)}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {analysisResult.risk_warning && !analysisResult.advanced && (
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

                        {/* 技術指標數據 */}
                        {technicalFeatures && (
                            <motion.section
                                className="glass-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 }}
                            >
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                                    📈 技術面指標
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.75rem' }}>
                                    <div className="metric-item">
                                        <span style={{ color: 'var(--text-muted)' }}>趨勢型態</span>
                                        <span style={{ fontWeight: 600, color: technicalFeatures.trend_pattern === '多頭排列' ? 'var(--stock-up)' : 'var(--stock-down)' }}>{technicalFeatures.trend_pattern}</span>
                                    </div>
                                    <div className="metric-item">
                                        <span style={{ color: 'var(--text-muted)' }}>RSI (14)</span>
                                        <span style={{ fontWeight: 600 }}>{technicalFeatures.rsi} ({technicalFeatures.rsi_level})</span>
                                    </div>
                                    <div className="metric-item">
                                        <span style={{ color: 'var(--text-muted)' }}>MACD 狀態</span>
                                        <span style={{ fontWeight: 600 }}>{technicalFeatures.macd_cross} ({technicalFeatures.macd})</span>
                                    </div>
                                    <div className="metric-item">
                                        <span style={{ color: 'var(--text-muted)' }}>支撐/壓力</span>
                                        <span style={{ fontWeight: 600 }}>{technicalFeatures.support} / {technicalFeatures.resistance}</span>
                                    </div>
                                </div>
                            </motion.section>
                        )}

                        {/* 基本面數據 */}
                        {fundamentalData && (
                            <motion.section
                                className="glass-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.28 }}
                            >
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                                    🏛️ 基本面指標
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.75rem' }}>
                                    <div className="metric-item">
                                        <span style={{ color: 'var(--text-muted)' }}>本益比 (PE)</span>
                                        <span style={{ fontWeight: 600 }}>{fundamentalData.pe ? fundamentalData.pe.toFixed(2) : '-'}</span>
                                    </div>
                                    <div className="metric-item">
                                        <span style={{ color: 'var(--text-muted)' }}>股價淨值比 (PB)</span>
                                        <span style={{ fontWeight: 600 }}>{fundamentalData.pb ? fundamentalData.pb.toFixed(2) : '-'}</span>
                                    </div>
                                    <div className="metric-item">
                                        <span style={{ color: 'var(--text-muted)' }}>ROE</span>
                                        <span style={{ fontWeight: 600 }}>{fundamentalData.roe ? (fundamentalData.roe * 100).toFixed(2) + '%' : '-'}</span>
                                    </div>
                                    <div className="metric-item">
                                        <span style={{ color: 'var(--text-muted)' }}>預估成長</span>
                                        <span style={{ fontWeight: 600 }}>{fundamentalData.epsGrowth ? (fundamentalData.epsGrowth * 100).toFixed(2) + '%' : '-'}</span>
                                    </div>
                                </div>
                            </motion.section>
                        )}
                    </div>

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

// 🔥 導出包裝元件（處理 Suspense）
export default function AnalysisPage() {
    return (
        <Suspense fallback={
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: 'var(--bg-primary)',
            }}>
                <div className="loading-spinner" style={{ width: 50, height: 50 }} />
            </div>
        }>
            <AnalysisPageContent />
        </Suspense>
    );
}
