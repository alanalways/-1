/**
 * 自動更新 Hook
 * 每 5 分鐘自動刷新資料
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

interface AutoRefreshOptions {
    interval?: number;        // 更新間隔（毫秒），預設 5 分鐘
    enabled?: boolean;        // 是否啟用
    onRefresh: () => void;    // 更新回調
}

export function useAutoRefresh({
    interval = 5 * 60 * 1000,  // 5 分鐘
    enabled = true,
    onRefresh,
}: AutoRefreshOptions) {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const lastRefreshRef = useRef<number>(Date.now());

    const refresh = useCallback(() => {
        lastRefreshRef.current = Date.now();
        onRefresh();
    }, [onRefresh]);

    useEffect(() => {
        if (!enabled) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        // 設定定時器
        timerRef.current = setInterval(refresh, interval);

        // 可見性變化時處理
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // 如果距離上次更新超過間隔時間，立即更新
                const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
                if (timeSinceLastRefresh >= interval) {
                    refresh();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, interval, refresh]);

    return {
        refresh,
        lastRefresh: lastRefreshRef.current,
    };
}
