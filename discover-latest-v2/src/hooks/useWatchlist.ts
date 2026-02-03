/**
 * 自選清單 Hook
 * 支援跨裝置同步
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
    getWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    WatchlistItem
} from '@/services/supabase';

interface WatchlistState {
    items: WatchlistItem[];
    loading: boolean;
    addItem: (stockCode: string, notes?: string) => Promise<void>;
    removeItem: (stockCode: string) => Promise<void>;
    updateNotes: (stockCode: string, notes: string) => Promise<void>;
    isInWatchlist: (stockCode: string) => boolean;
    refresh: () => Promise<void>;
}

// localStorage key for offline support
const LOCAL_STORAGE_KEY = 'discover-latest-watchlist';

export function useWatchlist(): WatchlistState {
    const { user } = useAuth();
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);

    // 從 Supabase 或 localStorage 載入自選清單
    const loadWatchlist = useCallback(async () => {
        setLoading(true);
        try {
            if (user) {
                // 登入狀態：從 Supabase 載入
                const data = await getWatchlist(user.id);
                setItems(data);
                // 同步到 localStorage 作為快取
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
            } else {
                // 未登入：從 localStorage 載入
                const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (cached) {
                    setItems(JSON.parse(cached));
                }
            }
        } catch (error) {
            console.error('載入自選清單失敗:', error);
            // 降級到 localStorage
            const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (cached) {
                setItems(JSON.parse(cached));
            }
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadWatchlist();
    }, [loadWatchlist]);

    // 新增到自選清單
    const add = useCallback(async (stockCode: string, notes?: string) => {
        try {
            if (user) {
                await addToWatchlist(user.id, stockCode, notes);
                await loadWatchlist();
            } else {
                // 未登入：存到 localStorage
                const newItem: WatchlistItem = {
                    id: crypto.randomUUID(),
                    user_id: 'local',
                    stock_code: stockCode,
                    added_at: new Date().toISOString(),
                    notes,
                };
                const newItems = [...items, newItem];
                setItems(newItems);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems));
            }
        } catch (error) {
            console.error('新增到自選清單失敗:', error);
            throw error;
        }
    }, [user, items, loadWatchlist]);

    // 從自選清單移除
    const remove = useCallback(async (stockCode: string) => {
        try {
            if (user) {
                await removeFromWatchlist(user.id, stockCode);
                await loadWatchlist();
            } else {
                // 未登入：從 localStorage 移除
                const newItems = items.filter(item => item.stock_code !== stockCode);
                setItems(newItems);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems));
            }
        } catch (error) {
            console.error('從自選清單移除失敗:', error);
            throw error;
        }
    }, [user, items, loadWatchlist]);

    // 檢查是否在自選清單中
    const isInWatchlist = useCallback((stockCode: string) => {
        return items.some(item => item.stock_code === stockCode);
    }, [items]);

    // 更新備註
    const updateNotes = useCallback(async (stockCode: string, notes: string) => {
        try {
            const newItems = items.map(item =>
                item.stock_code === stockCode ? { ...item, notes } : item
            );
            setItems(newItems);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems));
            // 如果登入，同步到 Supabase
            // TODO: 實作 Supabase updateWatchlistNotes
        } catch (error) {
            console.error('更新備註失敗:', error);
            throw error;
        }
    }, [items]);

    return {
        items,
        loading,
        addItem: add,
        removeItem: remove,
        updateNotes,
        isInWatchlist,
        refresh: loadWatchlist,
    };
}
