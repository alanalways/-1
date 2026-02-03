/**
 * 認證狀態 Hook
 * 支援無 Supabase 配置的降級模式
 */

'use client';

import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, onAuthStateChange, signInWithGoogle, signOut, isSupabaseEnabled } from '@/services/supabase';

interface AuthState {
    user: User | null;
    loading: boolean;
    isEnabled: boolean;  // Supabase 是否已設定
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const enabled = isSupabaseEnabled();

    useEffect(() => {
        // 如果 Supabase 未設定，直接結束載入狀態
        if (!supabase || !enabled) {
            setLoading(false);
            return;
        }

        // 取得初始認證狀態
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            setLoading(false);
        }).catch(() => {
            setLoading(false);
        });

        // 監聽認證狀態變化
        const { data: { subscription } } = onAuthStateChange((user) => {
            setUser(user);
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [enabled]);

    const handleSignIn = async () => {
        if (!enabled) {
            console.warn('[Auth] Supabase 未設定，無法登入');
            return;
        }
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error('登入失敗:', error);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            setUser(null);
        } catch (error) {
            console.error('登出失敗:', error);
        }
    };

    return {
        user,
        loading,
        isEnabled: enabled,
        signIn: handleSignIn,
        signOut: handleSignOut,
    };
}
