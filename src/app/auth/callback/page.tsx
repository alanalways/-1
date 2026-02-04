/**
 * OAuth 認證回調頁面
 * 處理 Google 登入後的重導向
 * 
 * 重要：OAuth PKCE flow 會在 URL 中帶回 code 或 hash fragment
 * 需要讓 Supabase client 自動處理這些參數
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';

export default function AuthCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [message, setMessage] = useState('正在驗證登入...');

    useEffect(() => {
        const handleCallback = async () => {
            if (!supabase) {
                console.error('[Auth Callback] Supabase 未設定');
                setStatus('error');
                setMessage('系統設定異常');
                setTimeout(() => router.push('/login?error=supabase_not_configured'), 1500);
                return;
            }

            try {
                // Debug: 顯示完整 URL（開發時可移除）
                console.log('[Auth Callback] 完整 URL:', window.location.href);
                console.log('[Auth Callback] Hash:', window.location.hash);
                console.log('[Auth Callback] Search:', window.location.search);

                // 方法 1：檢查 URL 是否有 code 參數（PKCE flow）
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                const errorParam = urlParams.get('error');
                const errorDescription = urlParams.get('error_description');

                // 處理 OAuth 錯誤回傳
                if (errorParam) {
                    console.error('[Auth Callback] OAuth 錯誤:', errorParam, errorDescription);
                    setStatus('error');
                    setMessage(errorDescription || '登入被拒絕');
                    setTimeout(() => router.push('/login?error=auth_failed'), 1500);
                    return;
                }

                // 方法 2：如果有 code，使用 exchangeCodeForSession
                if (code) {
                    console.log('[Auth Callback] 發現 code，正在交換 session...');
                    setMessage('正在建立登入階段...');

                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

                    if (error) {
                        console.error('[Auth Callback] Code 交換失敗:', error);
                        setStatus('error');
                        setMessage('驗證失敗，請重試');
                        setTimeout(() => router.push('/login?error=auth_failed'), 1500);
                        return;
                    }

                    if (data.session) {
                        console.log('[Auth Callback] Session 建立成功！', data.session.user?.email);
                        setStatus('success');
                        setMessage('登入成功！正在跳轉...');
                        setTimeout(() => router.push('/'), 800);
                        return;
                    }
                }

                // 方法 3：檢查 URL hash（implicit flow，較少用）
                if (window.location.hash) {
                    console.log('[Auth Callback] 發現 hash fragment，等待 Supabase 自動處理...');
                    setMessage('正在處理認證資訊...');

                    // 等待 Supabase 自動從 hash 取得 session
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // 方法 4：直接檢查現有 session
                console.log('[Auth Callback] 檢查現有 session...');
                const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('[Auth Callback] getSession 錯誤:', sessionError);
                    setStatus('error');
                    setMessage('驗證失敗');
                    setTimeout(() => router.push('/login?error=auth_failed'), 1500);
                    return;
                }

                if (sessionData.session) {
                    console.log('[Auth Callback] 已有有效 session！', sessionData.session.user?.email);
                    setStatus('success');
                    setMessage('登入成功！正在跳轉...');
                    setTimeout(() => router.push('/'), 800);
                    return;
                }

                // 沒有任何有效 session
                console.warn('[Auth Callback] 無法取得 session，重導向到登入頁');
                setStatus('error');
                setMessage('登入階段已過期');
                setTimeout(() => router.push('/login'), 1500);

            } catch (err) {
                console.error('[Auth Callback] 處理錯誤:', err);
                setStatus('error');
                setMessage('處理過程發生錯誤');
                setTimeout(() => router.push('/login?error=callback_failed'), 1500);
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
            {/* 狀態圖示 */}
            <div style={{
                width: 70,
                height: 70,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
            }}>
                {status === 'processing' && (
                    <div style={{
                        width: 60,
                        height: 60,
                        border: '3px solid rgba(99, 102, 241, 0.3)',
                        borderTopColor: '#6366f1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                    }} />
                )}
                {status === 'success' && (
                    <div style={{ fontSize: '3rem' }}>✅</div>
                )}
                {status === 'error' && (
                    <div style={{ fontSize: '3rem' }}>❌</div>
                )}
            </div>

            {/* 狀態訊息 */}
            <p style={{
                fontSize: '1.125rem',
                color: status === 'error' ? '#fca5a5' : 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                maxWidth: 300,
            }}>
                {message}
            </p>

            {/* Debug 提示（開發用） */}
            {process.env.NODE_ENV === 'development' && (
                <p style={{
                    marginTop: 24,
                    fontSize: '0.75rem',
                    color: 'rgba(255,255,255,0.3)',
                }}>
                    💡 開啟 DevTools Console 查看 debug 訊息
                </p>
            )}

            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
