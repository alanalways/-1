/**
 * Lightweight Charts K 線圖元件
 * 使用 Lightweight Charts v5 繪製互動式 K 線圖
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { CandlestickData } from '@/types/stock';

// Lightweight Charts 型別（動態載入）
type LightweightCharts = typeof import('lightweight-charts');
type IChartApi = import('lightweight-charts').IChartApi;
type ISeriesApi = import('lightweight-charts').ISeriesApi<'Candlestick'>;

interface LightweightChartProps {
    symbol?: string;
    data?: CandlestickData[];
    showEMA?: boolean;
    showSMC?: boolean;
    height?: number;
    onRangeChange?: (range: '1M' | '3M' | '6M' | '1Y') => void;
}

// 計算 EMA
function calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema: number[] = [prices[0]];

    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }

    return ema;
}

export function LightweightChart({
    symbol,
    data = [],
    showEMA = true,
    showSMC = false,
    height = 400,
    onRangeChange,
}: LightweightChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi | null>(null);
    const emaSeriesRef = useRef<any>(null);

    const [activeRange, setActiveRange] = useState<'1M' | '3M' | '6M' | '1Y'>('1M');
    const [isEMAVisible, setIsEMAVisible] = useState(showEMA);
    const [isSMCVisible, setIsSMCVisible] = useState(showSMC);
    const [LCModule, setLCModule] = useState<LightweightCharts | null>(null);

    // 動態載入 Lightweight Charts
    useEffect(() => {
        import('lightweight-charts').then((module) => {
            setLCModule(module);
        });
    }, []);

    // 初始化圖表
    useEffect(() => {
        if (!containerRef.current || !LCModule) return;

        // 清除舊圖表
        if (chartRef.current) {
            chartRef.current.remove();
        }

        // 建立圖表
        const chart = LCModule.createChart(containerRef.current, {
            layout: {
                background: { type: LCModule.ColorType.Solid, color: 'transparent' },
                textColor: '#94a3b8',
            },
            grid: {
                vertLines: { color: 'rgba(99, 102, 241, 0.1)' },
                horzLines: { color: 'rgba(99, 102, 241, 0.1)' },
            },
            crosshair: {
                mode: LCModule.CrosshairMode.Normal,
                vertLine: {
                    color: 'rgba(99, 102, 241, 0.5)',
                    labelBackgroundColor: '#6366f1',
                },
                horzLine: {
                    color: 'rgba(99, 102, 241, 0.5)',
                    labelBackgroundColor: '#6366f1',
                },
            },
            rightPriceScale: {
                borderColor: 'rgba(99, 102, 241, 0.2)',
            },
            timeScale: {
                borderColor: 'rgba(99, 102, 241, 0.2)',
                timeVisible: true,
            },
            width: containerRef.current.clientWidth,
            height: height,
        });

        // K 線序列（Lightweight Charts v5 API）
        const candlestickSeries = chart.addSeries(LCModule.CandlestickSeries, {
            upColor: '#ef4444',      // 台股慣例：紅漲
            downColor: '#22c55e',    // 綠跌
            borderUpColor: '#ef4444',
            borderDownColor: '#22c55e',
            wickUpColor: '#ef4444',
            wickDownColor: '#22c55e',
        });

        // EMA50 線（Lightweight Charts v5 API）
        const emaSeries = chart.addSeries(LCModule.LineSeries, {
            color: '#f59e0b',
            lineWidth: 2,
            lineStyle: LCModule.LineStyle.Solid,
        });

        chartRef.current = chart;
        candlestickSeriesRef.current = candlestickSeries as any;
        emaSeriesRef.current = emaSeries;

        // 響應式調整
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                chart.applyOptions({
                    width: entry.contentRect.width,
                });
            }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, [LCModule, height]);

    // 更新資料
    useEffect(() => {
        if (!candlestickSeriesRef.current || !emaSeriesRef.current || data.length === 0) return;

        // 轉換 K 線資料
        const candleData = data.map((d) => ({
            time: d.time as any,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }));

        candlestickSeriesRef.current.setData(candleData);

        // 計算並設定 EMA50
        if (data.length >= 50) {
            const closes = data.map((d) => d.close);
            const ema50 = calculateEMA(closes, 50);

            const emaData = data.slice(49).map((d, i) => ({
                time: d.time as any,
                value: ema50[i + 49],
            }));

            emaSeriesRef.current.setData(emaData);
        }

        // 自動縮放
        chartRef.current?.timeScale().fitContent();
    }, [data]);

    // 切換 EMA 顯示
    useEffect(() => {
        if (emaSeriesRef.current) {
            emaSeriesRef.current.applyOptions({ visible: isEMAVisible });
        }
    }, [isEMAVisible]);

    const handleRangeClick = (range: '1M' | '3M' | '6M' | '1Y') => {
        setActiveRange(range);
        onRangeChange?.(range);
    };

    return (
        <div className="chart-wrapper">
            {/* 圖表控制列 */}
            <div className="chart-controls" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-md)',
                padding: '0 var(--spacing-sm)',
            }}>
                {/* 時間範圍按鈕 */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    {(['1M', '3M', '6M', '1Y'] as const).map((range) => (
                        <motion.button
                            key={range}
                            onClick={() => handleRangeClick(range)}
                            style={{
                                padding: '4px 12px',
                                borderRadius: 'var(--radius-sm)',
                                background: activeRange === range ? 'var(--primary)' : 'var(--bg-input)',
                                color: activeRange === range ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.875rem',
                                border: '1px solid var(--border-color)',
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {range === '1M' ? '1月' : range === '3M' ? '3月' : range === '6M' ? '6月' : '1年'}
                        </motion.button>
                    ))}
                </div>

                {/* 指標切換 */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <motion.button
                        onClick={() => setIsEMAVisible(!isEMAVisible)}
                        style={{
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: isEMAVisible ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-input)',
                            color: isEMAVisible ? '#f59e0b' : 'var(--text-muted)',
                            fontSize: '0.875rem',
                            border: `1px solid ${isEMAVisible ? '#f59e0b' : 'var(--border-color)'}`,
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        EMA50
                    </motion.button>
                    <motion.button
                        onClick={() => setIsSMCVisible(!isSMCVisible)}
                        style={{
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: isSMCVisible ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-input)',
                            color: isSMCVisible ? 'var(--primary)' : 'var(--text-muted)',
                            fontSize: '0.875rem',
                            border: `1px solid ${isSMCVisible ? 'var(--primary)' : 'var(--border-color)'}`,
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        SMC
                    </motion.button>
                </div>
            </div>

            {/* 圖表容器 */}
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: height,
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                }}
            >
                {/* 無資料時的佔位 */}
                {data.length === 0 && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'var(--text-muted)',
                    }}>
                        <span style={{ fontSize: '3rem', marginBottom: '8px' }}>📈</span>
                        <p>輸入股票代碼開始分析</p>
                    </div>
                )}
            </div>

            {/* 股票資訊（如有） */}
            {symbol && data.length > 0 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 'var(--spacing-md)',
                    padding: '0 var(--spacing-sm)',
                }}>
                    <div>
                        <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>{symbol}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {data[data.length - 1]?.close.toFixed(2)}
                        </span>
                        {data.length >= 2 && (
                            <span style={{
                                marginLeft: '8px',
                                color: data[data.length - 1].close >= data[data.length - 2].close
                                    ? 'var(--stock-up)'
                                    : 'var(--stock-down)',
                            }}>
                                {((data[data.length - 1].close - data[data.length - 2].close) / data[data.length - 2].close * 100).toFixed(2)}%
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
