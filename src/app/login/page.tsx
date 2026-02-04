/**
 * 登入頁面
 * 專業質感的登入介面，支援 Google OAuth
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

// 主登入元件（需要 Suspense 因為使用 useSearchParams）
function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading, signIn, isEnabled } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isSigningIn, setIsSigningIn] = useState(false);

    // 檢查錯誤參數
    useEffect(() => {
        const errorParam = searchParams.get('error');
        if (errorParam) {
            switch (errorParam) {
                case 'supabase_not_configured':
                    setError('系統設定異常，請稍後再試');
                    break;
                case 'auth_failed':
                    setError('登入失敗，請重試');
                    break;
                case 'callback_failed':
                    setError('認證處理失敗，請重試');
                    break;
                default:
                    setError('發生錯誤，請重試');
            }
        }
    }, [searchParams]);

    // 已登入則重導向
    useEffect(() => {
        if (!loading && user) {
            router.push('/');
        }
    }, [user, loading, router]);

    const handleGoogleLogin = async () => {
        setIsSigningIn(true);
        setError(null);
        try {
            await signIn();
        } catch (err) {
            setError('登入失敗，請重試');
            setIsSigningIn(false);
        }
    };

    // 載入中
    if (loading) {
        return (
            <div className="login-page">
                <div className="loading-spinner" />
                <style jsx>{styles}</style>
            </div>
        );
    }

    return (
        <div className="login-page">
            {/* 背景動畫 */}
            <div className="bg-gradient" />
            <div className="bg-pattern" />

            {/* 左側品牌區 */}
            <motion.div
                className="brand-section"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
            >
                <div className="brand-content">
                    <motion.div
                        className="logo"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    >
                        📊
                    </motion.div>
                    <h1 className="brand-title">Discover Latest</h1>
                    <p className="brand-subtitle">AI 驅動金融分析平台</p>

                    <div className="features">
                        <motion.div
                            className="feature-item"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <span className="feature-icon">🎯</span>
                            <div>
                                <h3>即時行情</h3>
                                <p>台股、國際市場、加密貨幣一手掌握</p>
                            </div>
                        </motion.div>

                        <motion.div
                            className="feature-item"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <span className="feature-icon">🧠</span>
                            <div>
                                <h3>AI 深度分析</h3>
                                <p>Gemini AI 提供專業投資建議</p>
                            </div>
                        </motion.div>

                        <motion.div
                            className="feature-item"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <span className="feature-icon">📈</span>
                            <div>
                                <h3>回測模擬</h3>
                                <p>定期定額、投資組合策略驗證</p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            {/* 右側登入區 */}
            <motion.div
                className="login-section"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
            >
                <div className="login-card">
                    <h2>歡迎使用</h2>
                    <p className="login-desc">使用 Google 帳號登入，開始您的投資分析之旅</p>

                    {error && (
                        <motion.div
                            className="error-message"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            ⚠️ {error}
                        </motion.div>
                    )}

                    {!isEnabled && (
                        <motion.div
                            className="warning-message"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            ⚠️ 登入功能暫時無法使用
                            <br />
                            <small>請稍後再試或聯絡管理員</small>
                        </motion.div>
                    )}

                    <motion.button
                        className="google-login-btn"
                        onClick={handleGoogleLogin}
                        disabled={isSigningIn || !isEnabled}
                        whileHover={{ scale: 1.02, boxShadow: '0 8px 30px rgba(99, 102, 241, 0.3)' }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {isSigningIn ? (
                            <span className="btn-loading">登入中...</span>
                        ) : (
                            <>
                                <svg className="google-icon" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                <span>使用 Google 登入</span>
                            </>
                        )}
                    </motion.button>

                    <div className="divider">
                        <span>訂閱方案</span>
                    </div>

                    <div className="plans-preview">
                        <div className="plan-item">
                            <span className="plan-badge free">Free</span>
                            <span className="plan-limit">2 次/天 AI 分析</span>
                        </div>
                        <div className="plan-item">
                            <span className="plan-badge pro">Pro</span>
                            <span className="plan-limit">20 次/天 AI 分析</span>
                        </div>
                        <div className="plan-item highlight">
                            <span className="plan-badge premium">Premium</span>
                            <span className="plan-limit">無限制 AI 分析</span>
                        </div>
                    </div>

                    <p className="terms">
                        登入即表示您同意我們的
                        <a href="#"> 服務條款</a> 和
                        <a href="#"> 隱私政策</a>
                    </p>
                </div>
            </motion.div>

            <style jsx>{styles}</style>
        </div>
    );
}

// 頁面匯出（包裹 Suspense）
export default function LoginPage() {
    return (
        <Suspense fallback={
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a1a 100%)',
            }}>
                <div style={{
                    width: 50,
                    height: 50,
                    border: '3px solid rgba(99, 102, 241, 0.2)',
                    borderTopColor: '#6366f1',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }} />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}

const styles = `
    .login-page {
        display: flex;
        min-height: 100vh;
        background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a1a 100%);
        position: relative;
        overflow: hidden;
    }

    .bg-gradient {
        position: absolute;
        inset: 0;
        background: 
            radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%);
        pointer-events: none;
    }

    .bg-pattern {
        position: absolute;
        inset: 0;
        background-image: 
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
        background-size: 50px 50px;
        pointer-events: none;
    }

    .loading-spinner {
        width: 50px;
        height: 50px;
        border: 3px solid rgba(99, 102, 241, 0.2);
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    @keyframes spin {
        to { transform: translate(-50%, -50%) rotate(360deg); }
    }

    /* 品牌區 */
    .brand-section {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 60px;
        position: relative;
        z-index: 1;
    }

    .brand-content {
        max-width: 500px;
    }

    .logo {
        font-size: 4rem;
        margin-bottom: 1rem;
    }

    .brand-title {
        font-size: 2.5rem;
        font-weight: 700;
        background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.5rem;
    }

    .brand-subtitle {
        font-size: 1.25rem;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 3rem;
    }

    .features {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .feature-item {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        backdrop-filter: blur(10px);
    }

    .feature-icon {
        font-size: 1.5rem;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(99, 102, 241, 0.1);
        border-radius: 10px;
    }

    .feature-item h3 {
        font-size: 1rem;
        font-weight: 600;
        color: #fff;
        margin-bottom: 4px;
    }

    .feature-item p {
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.5);
    }

    /* 登入區 */
    .login-section {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 60px;
        position: relative;
        z-index: 1;
    }

    .login-card {
        width: 100%;
        max-width: 420px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        padding: 48px;
        backdrop-filter: blur(20px);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    .login-card h2 {
        font-size: 1.75rem;
        font-weight: 700;
        color: #fff;
        margin-bottom: 0.5rem;
        text-align: center;
    }

    .login-desc {
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 2rem;
        font-size: 0.9375rem;
    }

    .error-message, .warning-message {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        padding: 12px 16px;
        border-radius: 10px;
        margin-bottom: 1.5rem;
        text-align: center;
        font-size: 0.875rem;
    }

    .warning-message {
        background: rgba(245, 158, 11, 0.1);
        border-color: rgba(245, 158, 11, 0.3);
        color: #fcd34d;
    }

    .google-login-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 16px 24px;
        background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%);
        border: none;
        border-radius: 12px;
        color: white;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .google-login-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .google-icon {
        width: 20px;
        height: 20px;
    }

    .btn-loading {
        animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    .divider {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin: 2rem 0;
    }

    .divider::before, .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
    }

    .divider span {
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .plans-preview {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .plan-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 10px;
    }

    .plan-item.highlight {
        background: rgba(99, 102, 241, 0.08);
        border-color: rgba(99, 102, 241, 0.2);
    }

    .plan-badge {
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }

    .plan-badge.free {
        background: rgba(107, 114, 128, 0.2);
        color: #9ca3af;
    }

    .plan-badge.pro {
        background: rgba(59, 130, 246, 0.2);
        color: #60a5fa;
    }

    .plan-badge.premium {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(251, 191, 36, 0.2));
        color: #fcd34d;
    }

    .plan-limit {
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.875rem;
    }

    .terms {
        margin-top: 2rem;
        text-align: center;
        color: rgba(255, 255, 255, 0.3);
        font-size: 0.75rem;
    }

    .terms a {
        color: rgba(99, 102, 241, 0.8);
        text-decoration: none;
    }

    .terms a:hover {
        text-decoration: underline;
    }

    /* 響應式 */
    @media (max-width: 1024px) {
        .login-page {
            flex-direction: column;
        }

        .brand-section {
            padding: 40px 20px;
        }

        .login-section {
            padding: 20px;
        }

        .login-card {
            padding: 32px;
        }
    }

    @media (max-width: 640px) {
        .brand-title {
            font-size: 1.75rem;
        }

        .features {
            display: none;
        }
    }
`;
