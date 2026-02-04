/**
 * OAuth 認證回調頁面
 * 處理 Google 登入後的重導向
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            if (!supabase) {
                console.error('Supabase 未設定');
                router.push('/login?error=supabase_not_configured');
                return;
            }

            try {
                // 取得 URL 中的認證資訊
                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('認證錯誤:', error);
                    router.push('/login?error=auth_failed');
                    return;
                }

                if (data.session) {
                    // 登入成功，重導向到首頁
                    router.push('/');
                } else {
                    // 沒有 session，重導向到登入頁面
                    router.push('/login');
                }
            } catch (err) {
                console.error('回調處理錯誤:', err);
                router.push('/login?error=callback_failed');
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a1a 100%)',
            color: 'white',
        }}>
            <div style={{
                width: 60,
                height: 60,
                border: '3px solid rgba(99, 102, 241, 0.3)',
                borderTopColor: '#6366f1',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
            <p style={{ marginTop: 24, fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)' }}>
                正在驗證登入...
            </p>
            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
