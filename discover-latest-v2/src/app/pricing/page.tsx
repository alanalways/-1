/**
 * 會員方案頁面
 * 顯示訂閱等級和價格
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { useAuth } from '@/hooks/useAuth';
import {
    TIER_LIMITS,
    TIER_NAMES,
    TIER_COLORS,
    getUserSubscription,
    upgradeTier,
    SubscriptionTier,
    UserSubscription,
} from '@/services/subscription';

// 價格方案
const PLANS = [
    {
        tier: 'free' as SubscriptionTier,
        price: 0,
        priceLabel: '免費',
        features: [
            '每日 2 次 AI 深度分析',
            '台股上市上櫃即時行情',
            '基本市場數據',
            '基本圖表功能',
        ],
        notIncluded: [
            '進階 K 線分析',
            '回測模擬器',
            '優先支援',
        ],
    },
    {
        tier: 'pro' as SubscriptionTier,
        price: 79,
        priceLabel: 'NT$ 79/月',
        features: [
            '每日 20 次 AI 深度分析',
            '台股上市上櫃即時行情',
            '完整市場數據',
            '進階 K 線圖表',
            'EMA 指標分析',
            '回測模擬器',
            '電子郵件支援',
        ],
        notIncluded: [
            '無限 AI 分析',
            'VIP 專屬群組',
        ],
        popular: true,
    },
    {
        tier: 'premium' as SubscriptionTier,
        price: 299,
        priceLabel: 'NT$ 299/月',
        features: [
            '無限次 AI 深度分析',
            '台股上市上櫃即時行情',
            '完整市場數據',
            '進階 K 線圖表',
            'EMA + SMC 策略分析',
            '完整回測模擬器',
            '24/7 優先支援',
            'VIP 專屬群組',
            '每月投資報告',
        ],
        notIncluded: [],
    },
];


export default function PricingPage() {
    const { user, loading: authLoading } = useAuth();
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState<SubscriptionTier | null>(null);

    // 取得使用者訂閱資訊
    useEffect(() => {
        async function fetchSubscription() {
            if (user?.id) {
                const sub = await getUserSubscription(user.id);
                setSubscription(sub);
            }
            setLoading(false);
        }

        if (!authLoading) {
            fetchSubscription();
        }
    }, [user, authLoading]);

    // 處理升級
    const handleUpgrade = async (tier: SubscriptionTier) => {
        if (!user?.id) {
            alert('請先登入');
            return;
        }

        setUpgrading(tier);

        try {
            // 目前是模擬升級，實際應該導向付款頁面
            const success = await upgradeTier(user.id, tier);
            if (success) {
                setSubscription(await getUserSubscription(user.id));
                alert(`已成功升級至 ${TIER_NAMES[tier]}！`);
            }
        } catch (error) {
            console.error('升級失敗:', error);
            alert('升級失敗，請稍後再試');
        } finally {
            setUpgrading(null);
        }
    };

    const currentTier = subscription?.tier || 'free';

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <Header title="會員方案" />

                {/* 頁面標題 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}
                >
                    <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        💎 選擇適合你的方案
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                        升級會員，解鎖更多 AI 分析功能
                    </p>
                </motion.div>

                {/* 目前方案 */}
                {subscription && (
                    <motion.div
                        className="glass-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ marginBottom: 'var(--spacing-lg)' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>目前方案</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <span
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: 'var(--radius-full)',
                                            background: `${TIER_COLORS[currentTier]}20`,
                                            color: TIER_COLORS[currentTier],
                                            fontWeight: 600,
                                            fontSize: '0.875rem',
                                        }}
                                    >
                                        {TIER_NAMES[currentTier]}
                                    </span>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>今日使用量</span>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 600 }}>
                                    {subscription.usedToday} / {subscription.dailyLimit === -1 ? '∞' : subscription.dailyLimit}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* 方案卡片 */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 'var(--spacing-lg)',
                        marginBottom: 'var(--spacing-xl)',
                    }}
                >
                    {PLANS.map((plan, index) => {
                        const isCurrentPlan = currentTier === plan.tier;
                        const isUpgrade = ['free', 'pro', 'premium'].indexOf(plan.tier) > ['free', 'pro', 'premium'].indexOf(currentTier);

                        return (
                            <motion.div
                                key={plan.tier}
                                className="glass-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                style={{
                                    position: 'relative',
                                    border: plan.popular
                                        ? `2px solid ${TIER_COLORS.pro}`
                                        : isCurrentPlan
                                            ? `2px solid ${TIER_COLORS[plan.tier]}`
                                            : '1px solid var(--border-color)',
                                }}
                            >
                                {/* Popular 標籤 */}
                                {plan.popular && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '-12px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            padding: '4px 16px',
                                            background: TIER_COLORS.pro,
                                            color: 'white',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            borderRadius: 'var(--radius-full)',
                                        }}
                                    >
                                        🔥 最受歡迎
                                    </div>
                                )}

                                {/* 方案名稱 */}
                                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-md)' }}>
                                    <h3
                                        style={{
                                            fontSize: '1.5rem',
                                            fontWeight: 700,
                                            color: TIER_COLORS[plan.tier],
                                            marginBottom: '8px',
                                        }}
                                    >
                                        {TIER_NAMES[plan.tier]}
                                    </h3>
                                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                                        {plan.priceLabel}
                                    </div>
                                    {plan.price > 0 && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            年繳優惠 {Math.round(plan.price * 10)} 元/年
                                        </div>
                                    )}
                                </div>

                                {/* 功能列表 */}
                                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    {plan.features.map((feature, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '8px 0',
                                                fontSize: '0.875rem',
                                                borderBottom: '1px solid var(--border-color)',
                                            }}
                                        >
                                            <span style={{ color: 'var(--stock-up)' }}>✓</span>
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                    {plan.notIncluded.map((feature, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '8px 0',
                                                fontSize: '0.875rem',
                                                color: 'var(--text-muted)',
                                                borderBottom: '1px solid var(--border-color)',
                                            }}
                                        >
                                            <span>✕</span>
                                            <span style={{ textDecoration: 'line-through' }}>{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* 按鈕 */}
                                <motion.button
                                    whileHover={{ scale: isCurrentPlan ? 1 : 1.02 }}
                                    whileTap={{ scale: isCurrentPlan ? 1 : 0.98 }}
                                    onClick={() => !isCurrentPlan && isUpgrade && handleUpgrade(plan.tier)}
                                    disabled={isCurrentPlan || !isUpgrade || upgrading !== null}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: 'var(--radius-md)',
                                        background: isCurrentPlan
                                            ? 'var(--bg-tertiary)'
                                            : isUpgrade
                                                ? TIER_COLORS[plan.tier]
                                                : 'var(--bg-tertiary)',
                                        color: isCurrentPlan
                                            ? 'var(--text-muted)'
                                            : isUpgrade
                                                ? 'white'
                                                : 'var(--text-muted)',
                                        border: 'none',
                                        cursor: isCurrentPlan || !isUpgrade ? 'default' : 'pointer',
                                        fontWeight: 600,
                                        fontSize: '1rem',
                                    }}
                                >
                                    {upgrading === plan.tier
                                        ? '處理中...'
                                        : isCurrentPlan
                                            ? '目前方案'
                                            : isUpgrade
                                                ? `升級至 ${TIER_NAMES[plan.tier]}`
                                                : '已超過此方案'}
                                </motion.button>
                            </motion.div>
                        );
                    })}
                </div>

                {/* 常見問題 */}
                <motion.div
                    className="glass-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                        ❓ 常見問題
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>什麼是 AI 深度分析？</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                AI 深度分析使用 Gemini 模型，針對個股提供技術面、基本面和市場情緒的綜合分析報告。
                            </div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>升級後可以立即使用嗎？</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                是的！升級完成後，新的額度會立即生效。
                            </div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>可以隨時取消嗎？</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                當然可以。你可以隨時取消訂閱，會員權益會持續到結算日為止。
                            </div>
                        </div>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
