/**
 * 股票相關型別定義
 */

// 股票基本資料
export interface Stock {
    code: string;
    name: string;
    price: number;
    previousClose?: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
    changePercent: number;
    change: number;
    market: 'TWSE' | 'TPEx';
    sector?: string;
    score?: number;
    signal?: 'BUY' | 'SELL' | 'NEUTRAL';
    patterns?: string[];
}

// K 線資料
export interface CandlestickData {
    time: string;  // YYYY-MM-DD
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

// 技術指標
export interface TechnicalIndicators {
    ma5?: number;
    ma20?: number;
    ma60?: number;
    ema12?: number;
    ema26?: number;
    ema50?: number;
    rsi?: number;
    macd?: {
        macd: number;
        signal: number;
        histogram: number;
    };
}

// SMC 智慧資金分析
export interface SMCAnalysis {
    trend: 'bullish' | 'bearish' | 'ranging';
    order_blocks?: OrderBlock[];
    fvg?: FVG[];
    bos?: BOS;
    liquidity_zones?: LiquidityZone[];
}

export interface OrderBlock {
    type: 'bullish' | 'bearish';
    high: number;
    low: number;
    date: string;
}

export interface FVG {
    type: 'bullish' | 'bearish';
    top: number;
    bottom: number;
    date: string;
}

export interface BOS {
    type: 'bullish_bos' | 'bearish_bos' | 'bullish_choch' | 'bearish_choch';
    level: number;
    date: string;
    description: string;
}

export interface LiquidityZone {
    type: 'support' | 'resistance';
    level: number;
    tests: number;
}

// 市場概覽
export interface MarketOverview {
    name: string;
    code: string;
    price: number;
    change: number;
    changePercent: number;
    icon: string;
}
