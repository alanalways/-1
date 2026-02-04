/**
 * Sidebar 元件
 * 導覽列，支援動畫，包含會員狀態卡片
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
    getUserSubscription,
    TIER_NAMES,
    TIER_COLORS,
    TIER_LIMITS,
    SubscriptionTier,
    UserSubscription,
} from '@/services/subscription';

interface NavItem {
    href: string;
    icon: string;
    label: string;
}

const navItems: NavItem[] = [
    { href: '/', icon: '📊', label: '儀表板' },
    { href: '/watchlist', icon: '⭐', label: '自選清單' },
    { href: '/analysis', icon: '🧠', label: '深度分析' },
    { href: '/backtest', icon: '🎯', label: '回測模擬器' },
    { href: '/global', icon: '🌍', label: '國際市場' },
    { href: '/crypto', icon: '🪙', label: '加密貨幣' },
    { href: '/pricing', icon: '💎', label: '會員方案' },
];

export function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);

    // 取得使用者訂閱資訊
    useEffect(() => {
        async function fetchSubscription() {
            if (user?.id) {
                const sub = await getUserSubscription(user.id);
                setSubscription(sub);
            } else {
                // 未登入使用者預設為免費版
                setSubscription({
                    tier: 'free',
                    dailyLimit: TIER_LIMITS.free,
                    usedToday: 0,
                    lastResetDate: new Date().toISOString().split('T')[0],
                });
            }
        }

        fetchSubscription();
    }, [user]);

    const tier = subscription?.tier || 'free';
    const remaining = subscription
        ? subscription.dailyLimit === -1
            ? -1
            : subscription.dailyLimit - subscription.usedToday
        : TIER_LIMITS.free;

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="brand">
                <motion.div
                    className="logo-icon"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    🚀
                </motion.div>
                <div className="logo-text">
                    <h1>Discover Latest</h1>
                    <span className="subtitle">By Alan</span>
                </div>
            </div>

            {/* 會員狀態卡片 */}
            {subscription && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        margin: '0 16px 16px',
                        padding: '12px 16px',
                        background: `linear-gradient(135deg, ${TIER_COLORS[tier]}15 0%, ${TIER_COLORS[tier]}05 100%)`,
                        border: `1px solid ${TIER_COLORS[tier]}30`,
                        borderRadius: '12px',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            color: TIER_COLORS[tier],
                        }}>
                            {TIER_NAMES[tier]}
                        </span>
                        <Link href="/pricing" style={{
                            fontSize: '0.7rem',
                            color: 'var(--primary-light)',
                            textDecoration: 'none',
                        }}>
                            {tier === 'free' ? '升級 →' : '管理'}
                        </Link>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI 分析</span>
                        <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: remaining <= 0 && remaining !== -1 ? 'var(--stock-down)' : 'var(--text-primary)',
                        }}>
                            {remaining === -1 ? '∞' : remaining} 次
                        </span>
                    </div>
                    {/* 使用量進度條 */}
                    {subscription.dailyLimit !== -1 && (
                        <div style={{
                            marginTop: 8,
                            height: 4,
                            background: 'var(--bg-tertiary)',
                            borderRadius: 2,
                            overflow: 'hidden',
                        }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min((subscription.usedToday / subscription.dailyLimit) * 100, 100)}%` }}
                                style={{
                                    height: '100%',
                                    background: remaining <= 0 ? 'var(--stock-down)' : TIER_COLORS[tier],
                                    borderRadius: 2,
                                }}
                            />
                        </div>
                    )}
                </motion.div>
            )}

            {/* Navigation */}
            <nav className="sidebar-nav">
                {navItems.map((item, index) => {
                    const isActive = pathname === item.href;

                    return (
                        <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Link
                                href={item.href}
                                className={`nav-item ${isActive ? 'active' : ''}`}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                <span className="nav-label">{item.label}</span>
                            </Link>
                        </motion.div>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="sidebar-footer">
                <div className="update-info">
                    <span className="update-label">最後更新</span>
                    <span className="update-time" id="lastUpdated">--</span>
                </div>
                <p className="text-muted text-xs">🔄 資料每 5 分鐘自動更新</p>
            </div>
        </aside>
    );
}
