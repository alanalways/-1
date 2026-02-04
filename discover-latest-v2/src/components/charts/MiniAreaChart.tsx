/**
 * 迷你面積圖元件
 * 使用 Lightweight Charts v5 繪製互動式折線/面積圖
 * 適用於國際市場和加密貨幣的歷史價格走勢
 */

'use client';

import { useEffect, useRef, useState } from 'react';

// Lightweight Charts 型別（動態載入）
type LightweightCharts = typeof import('lightweight-charts');
type IChartApi = import('lightweight-charts').IChartApi;

// 資料點介面
export interface AreaChartDataPoint {
    time: string | number;  // YYYY-MM-DD 或 Unix timestamp
    value: number;
}

interface MiniAreaChartProps {
    data: AreaChartDataPoint[];
    height?: number;
    isPositive?: boolean;  // 控制顏色（上漲/下跌）
    showTooltip?: boolean;
    autoFit?: boolean;
}

export function MiniAreaChart({
    data = [],
    height = 200,
    isPositive = true,
    showTooltip = true,
    autoFit = true,
}: MiniAreaChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [LCModule, setLCModule] = useState<LightweightCharts | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 動態載入 Lightweight Charts
    useEffect(() => {
        import('lightweight-charts').then((module) => {
            setLCModule(module);
            setIsLoading(false);
        });
    }, []);

    // 初始化圖表
    useEffect(() => {
        if (!containerRef.current || !LCModule || data.length === 0) return;

        // 清除舊圖表
        if (chartRef.current) {
            chartRef.current.remove();
        }

        // 決定顏色
        const lineColor = isPositive ? '#22c55e' : '#ef4444';
        const areaTopColor = isPositive ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        const areaBottomColor = isPositive ? 'rgba(34, 197, 94, 0)' : 'rgba(239, 68, 68, 0)';

        // 建立圖表
        const chart = LCModule.createChart(containerRef.current, {
            layout: {
                background: { type: LCModule.ColorType.Solid, color: 'transparent' },
                textColor: '#94a3b8',
                fontSize: 10,
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: false },
            },
            crosshair: {
                mode: showTooltip ? LCModule.CrosshairMode.Normal : LCModule.CrosshairMode.Hidden,
                vertLine: {
                    color: 'rgba(99, 102, 241, 0.3)',
                    labelBackgroundColor: '#6366f1',
                    width: 1,
                    style: LCModule.LineStyle.Dashed,
                },
                horzLine: {
                    color: 'rgba(99, 102, 241, 0.3)',
                    labelBackgroundColor: '#6366f1',
                    width: 1,
                    style: LCModule.LineStyle.Dashed,
                },
            },
            rightPriceScale: {
                visible: false,
            },
            leftPriceScale: {
                visible: false,
            },
            timeScale: {
                visible: false,
                borderVisible: false,
            },
            handleScroll: false,
            handleScale: false,
            width: containerRef.current.clientWidth,
            height: height,
        });

        // 面積圖序列
        const areaSeries = chart.addSeries(LCModule.AreaSeries, {
            lineColor: lineColor,
            topColor: areaTopColor,
            bottomColor: areaBottomColor,
            lineWidth: 2,
            lineStyle: LCModule.LineStyle.Solid,
            crosshairMarkerVisible: showTooltip,
            crosshairMarkerRadius: 4,
            crosshairMarkerBackgroundColor: lineColor,
            crosshairMarkerBorderColor: '#fff',
            crosshairMarkerBorderWidth: 1,
        });

        // 轉換並設定資料
        const chartData = data.map((d) => ({
            time: d.time as any,
            value: d.value,
        }));

        areaSeries.setData(chartData);

        // 自動縮放
        if (autoFit) {
            chart.timeScale().fitContent();
        }

        chartRef.current = chart;

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
    }, [LCModule, data, height, isPositive, showTooltip, autoFit]);

    if (isLoading || data.length === 0) {
        return (
            <div
                style={{
                    width: '100%',
                    height: height,
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {isLoading ? (
                    <div
                        style={{
                            width: 24,
                            height: 24,
                            border: '2px solid var(--border-color)',
                            borderTopColor: 'var(--primary)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        暫無資料
                    </span>
                )}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: height,
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
            }}
        />
    );
}

/**
 * K 線圖迷你版
 * 用於在 Modal 中顯示 K 線走勢
 */
interface MiniCandlestickChartProps {
    data: Array<{
        time: string | number;
        open: number;
        high: number;
        low: number;
        close: number;
    }>;
    height?: number;
}

export function MiniCandlestickChart({
    data = [],
    height = 200,
}: MiniCandlestickChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [LCModule, setLCModule] = useState<LightweightCharts | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 動態載入 Lightweight Charts
    useEffect(() => {
        import('lightweight-charts').then((module) => {
            setLCModule(module);
            setIsLoading(false);
        });
    }, []);

    // 初始化圖表
    useEffect(() => {
        if (!containerRef.current || !LCModule || data.length === 0) return;

        // 清除舊圖表
        if (chartRef.current) {
            chartRef.current.remove();
        }

        // 建立圖表
        const chart = LCModule.createChart(containerRef.current, {
            layout: {
                background: { type: LCModule.ColorType.Solid, color: 'transparent' },
                textColor: '#94a3b8',
                fontSize: 10,
            },
            grid: {
                vertLines: { color: 'rgba(99, 102, 241, 0.05)' },
                horzLines: { color: 'rgba(99, 102, 241, 0.05)' },
            },
            crosshair: {
                mode: LCModule.CrosshairMode.Normal,
                vertLine: {
                    color: 'rgba(99, 102, 241, 0.3)',
                    labelBackgroundColor: '#6366f1',
                    width: 1,
                    style: LCModule.LineStyle.Dashed,
                },
                horzLine: {
                    color: 'rgba(99, 102, 241, 0.3)',
                    labelBackgroundColor: '#6366f1',
                    width: 1,
                    style: LCModule.LineStyle.Dashed,
                },
            },
            rightPriceScale: {
                borderColor: 'rgba(99, 102, 241, 0.1)',
            },
            timeScale: {
                borderColor: 'rgba(99, 102, 241, 0.1)',
                timeVisible: true,
            },
            width: containerRef.current.clientWidth,
            height: height,
        });

        // K 線序列（台股慣例：紅漲綠跌）
        const candlestickSeries = chart.addSeries(LCModule.CandlestickSeries, {
            upColor: '#ef4444',      // 紅漲
            downColor: '#22c55e',    // 綠跌
            borderUpColor: '#ef4444',
            borderDownColor: '#22c55e',
            wickUpColor: '#ef4444',
            wickDownColor: '#22c55e',
        });

        // 轉換並設定資料
        const chartData = data.map((d) => ({
            time: d.time as any,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }));

        candlestickSeries.setData(chartData);

        // 自動縮放
        chart.timeScale().fitContent();

        chartRef.current = chart;

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
    }, [LCModule, data, height]);

    if (isLoading || data.length === 0) {
        return (
            <div
                style={{
                    width: '100%',
                    height: height,
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {isLoading ? (
                    <div
                        style={{
                            width: 24,
                            height: 24,
                            border: '2px solid var(--border-color)',
                            borderTopColor: 'var(--primary)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        暫無資料
                    </span>
                )}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: height,
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
            }}
        />
    );
}
