/**
 * 登入頁面
 */

'use client';

import { useState } from 'react';
import { signInWithGoogle } from '@/services/supabase';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);

        try {
            await signInWithGoogle();
        } catch (err: any) {
            console.error('[Login] Google 登入失敗:', err);
            setError(err.message || '登入失敗，請稍後再試');
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%)',
                padding: '24px',
            }}
        >
            <div
                style={{
                    maxWidth: '420px',
                    width: '100%',
                    padding: '32px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    textAlign: 'center',
                }}
            >
                {/* Logo */}
                <div style={{ marginBottom: '24px' }}>
                    <span style={{ fontSize: '3rem' }}>🚀</span>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '8px', color: 'white' }}>
                        Discover Latest
                    </h1>
                    <p style={{ color: '#a0a0a0', marginTop: '4px' }}>
                        AI 金融數據分析平台
                    </p>
                </div>

                {/* 說明 */}
                <div
                    style={{
                        marginBottom: '24px',
                        padding: '16px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '12px',
                    }}
                >
                    <p style={{ fontSize: '0.875rem', color: '#a0a0a0', marginBottom: '12px' }}>
                        請登入以使用完整功能
                    </p>
                    <div style={{ textAlign: 'left' }}>
                        <p style={{ fontSize: '0.8rem', color: '#a0a0a0', marginBottom: '6px' }}>✅ 台股即時行情（上市/上櫃）</p>
                        <p style={{ fontSize: '0.8rem', color: '#a0a0a0', marginBottom: '6px' }}>✅ AI 深度分析</p>
                        <p style={{ fontSize: '0.8rem', color: '#a0a0a0', marginBottom: '6px' }}>✅ 自選股追蹤</p>
                        <p style={{ fontSize: '0.8rem', color: '#a0a0a0' }}>✅ 回測模擬器</p>
                    </div>
                </div>

                {/* 錯誤訊息 */}
                {error && (
                    <div
                        style={{
                            marginBottom: '16px',
                            padding: '12px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px',
                            color: '#ef4444',
                            fontSize: '0.875rem',
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* Google 登入按鈕 */}
                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '14px 24px',
                        borderRadius: '12px',
                        background: '#ffffff',
                        color: '#333333',
                        border: 'none',
                        cursor: loading ? 'wait' : 'pointer',
                        fontWeight: 600,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        opacity: loading ? 0.7 : 1,
                    }}
                >
                    {loading ? (
                        '登入中...'
                    ) : (
                        <>
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            使用 Google 登入
                        </>
                    )}
                </button>

                {/* 底部說明 */}
                <p style={{ marginTop: '24px', fontSize: '0.75rem', color: '#6b6b6b' }}>
                    登入即表示您同意我們的服務條款和隱私政策
                </p>
            </div>
        </div>
    );
}
