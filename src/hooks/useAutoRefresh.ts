/**
 * 智慧自動更新 Hook
 * 在交易時間自動每 20 分鐘更新資料
 * 非交易時間則降低更新頻率或停止更新
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// 台灣證交所交易時間設定
const TRADING_HOURS = {
    start: 9,    // 09:00 開盤
    end: 13.5,   // 13:30 收盤
};

// 更新間隔設定（毫秒）
const UPDATE_INTERVALS = {
    trading: 20 * 60 * 1000,     // 交易時間：20 分鐘
    preMarket: 5 * 60 * 1000,    // 盤前（08:30-09:00）：5 分鐘
    afterHours: 60 * 60 * 1000,  // 盤後：1 小時
    closed: 0,                   // 休市：不自動更新
};

// 台灣公休日（2025 年）
const HOLIDAYS_2025 = [
    '2025-01-01',
    '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
    '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',
    '2025-02-28',
    '2025-04-04', '2025-04-05',
    '2025-05-01',
    '2025-05-31', '2025-06-01', '2025-06-02',
    '2025-10-06', '2025-10-07', '2025-10-08',
    '2025-10-10',
];

export interface TradingStatus {
    isTradingDay: boolean;
    isTradingHours: boolean;
    isPreMarket: boolean;
    nextUpdateIn: number | null;  // 距離下次更新的毫秒數
    marketState: 'trading' | 'pre-market' | 'after-hours' | 'closed';
}

/**
 * 判斷是否為交易日
 */
function isTradingDay(date: Date): boolean {
    const day = date.getDay();
    if (day === 0 || day === 6) return false;

    const dateStr = date.toISOString().split('T')[0];
    return !HOLIDAYS_2025.includes(dateStr);
}

/**
 * 取得當前台灣時間
 */
function getTaiwanTime(): Date {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
}

/**
 * 取得市場狀態
 */
function getMarketState(date: Date): TradingStatus['marketState'] {
    if (!isTradingDay(date)) return 'closed';

    const hours = date.getHours() + date.getMinutes() / 60;

    if (hours >= 8.5 && hours < TRADING_HOURS.start) return 'pre-market';
    if (hours >= TRADING_HOURS.start && hours <= TRADING_HOURS.end) return 'trading';
    if (hours > TRADING_HOURS.end && hours < 18) return 'after-hours';

    return 'closed';
}

/**
 * 取得更新間隔
 */
function getUpdateInterval(state: TradingStatus['marketState']): number {
    switch (state) {
        case 'trading': return UPDATE_INTERVALS.trading;
        case 'pre-market': return UPDATE_INTERVALS.preMarket;
        case 'after-hours': return UPDATE_INTERVALS.afterHours;
        default: return UPDATE_INTERVALS.closed;
    }
}

/**
 * 智慧自動更新 Hook
 */
export function useSmartAutoRefresh(
    callback: () => void | Promise<void>,
    options?: {
        enabled?: boolean;
        immediate?: boolean;  // 是否立即執行一次
    }
) {
    const { enabled = true, immediate = true } = options || {};
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const callbackRef = useRef(callback);
    const [status, setStatus] = useState<TradingStatus>(() => {
        const now = getTaiwanTime();
        const state = getMarketState(now);
        return {
            isTradingDay: isTradingDay(now),
            isTradingHours: state === 'trading',
            isPreMarket: state === 'pre-market',
            nextUpdateIn: getUpdateInterval(state),
            marketState: state,
        };
    });

    // 更新 callback ref
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // 執行更新
    const executeUpdate = useCallback(async () => {
        try {
            await callbackRef.current();
        } catch (error) {
            console.error('[SmartAutoRefresh] 更新失敗:', error);
        }
    }, []);

    // 排程下次更新
    const scheduleNextUpdate = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        const now = getTaiwanTime();
        const state = getMarketState(now);
        const interval = getUpdateInterval(state);

        // 更新狀態
        setStatus({
            isTradingDay: isTradingDay(now),
            isTradingHours: state === 'trading',
            isPreMarket: state === 'pre-market',
            nextUpdateIn: interval,
            marketState: state,
        });

        // 如果有更新間隔，排程下次更新
        if (interval > 0 && enabled) {
            console.log(`[SmartAutoRefresh] 下次更新: ${Math.round(interval / 1000 / 60)} 分鐘後 (${state})`);
            timerRef.current = setTimeout(async () => {
                await executeUpdate();
                scheduleNextUpdate();
            }, interval);
        } else {
            console.log(`[SmartAutoRefresh] 市場休市，暫停自動更新`);
        }
    }, [enabled, executeUpdate]);

    // 初始化與清理
    useEffect(() => {
        if (!enabled) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            return;
        }

        // 立即執行一次
        if (immediate) {
            executeUpdate();
        }

        // 排程自動更新
        scheduleNextUpdate();

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [enabled, immediate, executeUpdate, scheduleNextUpdate]);

    // 手動觸發更新
    const refresh = useCallback(async () => {
        await executeUpdate();
        scheduleNextUpdate();
    }, [executeUpdate, scheduleNextUpdate]);

    return {
        status,
        refresh,
        isAutoRefreshEnabled: enabled && status.nextUpdateIn !== null && status.nextUpdateIn > 0,
    };
}

/**
 * 簡單的自動更新 Hook（固定間隔）
 * 保留原有功能，供向後相容
 */
export function useAutoRefresh(
    callback: () => void,
    intervalMs: number = 60000,
    enabled: boolean = true
) {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled || intervalMs <= 0) {
            return;
        }

        // 立即執行一次
        callbackRef.current();

        // 設定定時器
        timerRef.current = setInterval(() => {
            callbackRef.current();
        }, intervalMs);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [enabled, intervalMs]);

    const refresh = useCallback(() => {
        callbackRef.current();
    }, []);

    return { refresh };
}
