/**
 * 會員方案頁面
 * 展示訂閱方案和升級選項
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { useAuth } from '@/hooks/useAuth';
import { getUserSubscription, SubscriptionTier, TIER_LIMITS, TIER_NAMES } from '@/services/subscription';

interface PlanFeature {
    name: string;
    free: boolean | string;
    pro: boolean | string;
    premium: boolean | string;
}

const features: PlanFeature[] = [
    { name: '即時台股行情', free: true, pro: true, premium: true },
    { name: '自選清單', free: '10 檔', pro: '50 檔', premium: '無限制' },
    { name: '每日 AI 深度分析', free: '2 次', pro: '20 次', premium: '無限制' },
    { name: '國際市場資料', free: true, pro: true, premium: true },
    { name: '加密貨幣即時價格', free: true, pro: true, premium: true },
    { name: '回測模擬器', free: '基本', pro: '進階', premium: '完整' },
    { name: '投資組合回測', free: false, pro: true, premium: true },
    { name: '定期定額模擬', free: false, pro: true, premium: true },
    { name: '歷史分析報告', free: false, pro: '30 天', premium: '永久' },
    { name: 'API 匯出功能', free: false, pro: false, premium: true },
    { name: '優先技術支援', free: false, pro: false, premium: true },
];

export default function PricingPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [loading, setLoading] = useState(true);

    // 載入使用者訂閱狀態
    useEffect(() => {
        const loadSubscription = async () => {
            if (user) {
                const sub = await getUserSubscription(user.id);
                if (sub) {
                    setCurrentTier(sub.tier);
                }
            }
            setLoading(false);
        };
        loadSubscription();
    }, [user]);

    // 未登入則導向登入頁
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    const prices = {
        monthly: { pro: 99, premium: 299 },
        yearly: { pro: 990, premium: 2990 }, // 約 17% 折扣
    };

    const handleUpgrade = (tier: SubscriptionTier) => {
        // TODO: 整合付款系統
        alert(`升級至 ${TIER_NAMES[tier]} 功能即將推出！`);
    };

    if (authLoading || loading) {
        return (
            <div className="app-layout">
                <Sidebar />
                <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="loading-spinner" style={{
                            width: 50, height: 50,
                            border: '3px solid rgba(99, 102, 241, 0.2)',
                            borderTopColor: '#6366f1',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto'
                        }} />
                        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>載入中...</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <Header title="會員方案" />

                {/* 頁面標題 */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}
                >
                    <h1 style={{
                        fontSize: '2.25rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '0.5rem'
                    }}>
                        選擇適合您的方案
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem' }}>
                        升級獲得更多 AI 分析次數和進階功能
                    </p>

                    {/* 計費週期切換 */}
                    <div style={{
                        display: 'inline-flex',
                        gap: 8,
                        marginTop: 24,
                        padding: 4,
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                    }}>
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            style={{
                                padding: '8px 20px',
                                borderRadius: 'var(--radius-sm)',
                                background: billingCycle === 'monthly' ? 'var(--primary)' : 'transparent',
                                color: billingCycle === 'monthly' ? 'white' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                            }}
                        >
                            月付
                        </button>
                        <button
                            onClick={() => setBillingCycle('yearly')}
                            style={{
                                padding: '8px 20px',
                                borderRadius: 'var(--radius-sm)',
                                background: billingCycle === 'yearly' ? 'var(--primary)' : 'transparent',
                                color: billingCycle === 'yearly' ? 'white' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                            }}
                        >
                            年付 <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>省 17%</span>
                        </button>
                    </div>
                </motion.section>

                {/* 方案卡片 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 'var(--spacing-lg)',
                    marginBottom: 'var(--spacing-xl)',
                }}>
                    {/* Free 方案 */}
                    <motion.div
                        className="glass-card"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        style={{
                            padding: 'var(--spacing-xl)',
                            border: currentTier === 'free' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            position: 'relative',
                        }}
                    >
                        {currentTier === 'free' && (
                            <div style={{
                                position: 'absolute',
                                top: -12,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'var(--primary)',
                                color: 'white',
                                padding: '4px 12px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                            }}>
                                目前方案
                            </div>
                        )}
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <span style={{
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: '#9ca3af',
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                            }}>Free</span>
                            <div style={{ fontSize: '3rem', fontWeight: 700, marginTop: 8 }}>
                                NT$0
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                永久免費
                            </div>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                <span>✓</span> 每日 2 次 AI 分析
                            </li>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                <span>✓</span> 即時台股行情
                            </li>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                <span>✓</span> 基本回測功能
                            </li>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-muted)' }}>
                                <span style={{ opacity: 0.3 }}>✗</span> 進階回測模式
                            </li>
                        </ul>
                        <button
                            disabled={currentTier === 'free'}
                            style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)',
                                fontWeight: 600,
                                cursor: currentTier === 'free' ? 'default' : 'pointer',
                            }}
                        >
                            {currentTier === 'free' ? '目前使用中' : '降級至免費版'}
                        </button>
                    </motion.div>

                    {/* Pro 方案 */}
                    <motion.div
                        className="glass-card"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        style={{
                            padding: 'var(--spacing-xl)',
                            border: currentTier === 'pro' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                            position: 'relative',
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%)',
                        }}
                    >
                        {currentTier === 'pro' && (
                            <div style={{
                                position: 'absolute',
                                top: -12,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: '#3b82f6',
                                color: 'white',
                                padding: '4px 12px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                            }}>
                                目前方案
                            </div>
                        )}
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <span style={{
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: '#3b82f6',
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                            }}>Pro</span>
                            <div style={{ fontSize: '3rem', fontWeight: 700, marginTop: 8, color: '#60a5fa' }}>
                                NT${billingCycle === 'monthly' ? prices.monthly.pro : Math.round(prices.yearly.pro / 12)}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                {billingCycle === 'monthly' ? '/月' : '/月（年付）'}
                            </div>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                <span style={{ color: '#3b82f6' }}>✓</span> 每日 20 次 AI 分析
                            </li>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                <span style={{ color: '#3b82f6' }}>✓</span> 完整回測模擬器
                            </li>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                <span style={{ color: '#3b82f6' }}>✓</span> 投資組合分析
                            </li>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                <span style={{ color: '#3b82f6' }}>✓</span> 30 天歷史報告
                            </li>
                        </ul>
                        <motion.button
                            onClick={() => handleUpgrade('pro')}
                            disabled={currentTier === 'pro' || currentTier === 'premium'}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: 'var(--radius-md)',
                                background: currentTier === 'pro' ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                                color: 'white',
                                fontWeight: 600,
                                cursor: currentTier === 'pro' ? 'default' : 'pointer',
                            }}
                        >
                            {currentTier === 'pro' ? '目前使用中' : currentTier === 'premium' ? '已是更高方案' : '升級至 Pro'}
                        </motion.button>
                    </motion.div>

                    {/* Premium 方案 */}
                    <motion.div
                        className="glass-card"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        style={{
                            padding: 'var(--spacing-xl)',
                            border: currentTier === 'premium' ? '2px solid #f59e0b' : '2px solid rgba(245, 158, 11, 0.3)',
                            position: 'relative',
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.03) 100%)',
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: -12,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                            color: '#1a1a1a',
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                        }}>
                            {currentTier === 'premium' ? '目前方案' : '推薦'}
                        </div>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <span style={{
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #f59e0b, #fcd34d)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                            }}>Premium</span>
                            <div style={{
                                fontSize: '3rem',
                                fontWeight: 700,
                                marginTop: 8,
                                background: 'linear-gradient(135deg, #f59e0b, #fcd34d)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>
                                NT${billingCycle === 'monthly' ? prices.monthly.premium : Math.round(prices.yearly.premium / 12)}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                {billingCycle === 'monthly' ? '/月' : '/月（年付）'}
                            </div>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                <span style={{ color: '#fcd34d' }}>✓</span> <strong>無限制</strong> AI 分析
                            </li>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                <span style={{ color: '#fcd34d' }}>✓</span> 所有進階功能
                            </li>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                <span style={{ color: '#fcd34d' }}>✓</span> API 匯出功能
                            </li>
                            <li style={{ display: 'flex', gap: 8, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                <span style={{ color: '#fcd34d' }}>✓</span> 優先技術支援
                            </li>
                        </ul>
                        <motion.button
                            onClick={() => handleUpgrade('premium')}
                            disabled={currentTier === 'premium'}
                            whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(245, 158, 11, 0.3)' }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: 'var(--radius-md)',
                                background: currentTier === 'premium' ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                                color: currentTier === 'premium' ? 'var(--text-secondary)' : '#1a1a1a',
                                fontWeight: 600,
                                cursor: currentTier === 'premium' ? 'default' : 'pointer',
                            }}
                        >
                            {currentTier === 'premium' ? '目前使用中' : '升級至 Premium'}
                        </motion.button>
                    </motion.div>
                </div>

                {/* 功能比較表 */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-card"
                    style={{ padding: 'var(--spacing-xl)', overflow: 'auto' }}
                >
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>
                        功能比較
                    </h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>功能</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#9ca3af' }}>Free</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#60a5fa' }}>Pro</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#fcd34d' }}>Premium</th>
                            </tr>
                        </thead>
                        <tbody>
                            {features.map((feature, index) => (
                                <tr key={feature.name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{feature.name}</td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                        {renderFeatureValue(feature.free)}
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                        {renderFeatureValue(feature.pro)}
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                        {renderFeatureValue(feature.premium)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </motion.section>

                {/* FAQ */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    style={{ marginTop: 'var(--spacing-xl)', textAlign: 'center' }}
                >
                    <p style={{ color: 'var(--text-muted)' }}>
                        有任何問題？<a href="#" style={{ color: 'var(--primary-light)' }}>聯絡我們</a>
                    </p>
                </motion.section>
            </main>

            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

function renderFeatureValue(value: boolean | string) {
    if (value === true) {
        return <span style={{ color: '#22c55e' }}>✓</span>;
    }
    if (value === false) {
        return <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>;
    }
    return <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{value}</span>;
}
