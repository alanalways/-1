/**
 * Sidebar 元件
 * 專業質感導覽列，包含會員狀態
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserSubscription, SubscriptionTier, TIER_NAMES, TIER_COLORS, TIER_LIMITS } from '@/services/subscription';

interface NavItem {
    href: string;
    icon: string;
    label: string;
    badge?: string;
}

const navItems: NavItem[] = [
    { href: '/', icon: '📊', label: '儀表板' },
    { href: '/watchlist', icon: '⭐', label: '自選清單' },
    { href: '/analysis', icon: '🧠', label: '深度分析' },
    { href: '/backtest', icon: '🎯', label: '回測模擬器' },
    { href: '/global', icon: '🌍', label: '國際市場' },
    { href: '/crypto', icon: '🪙', label: '加密貨幣' },
];

export function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const [tier, setTier] = useState<SubscriptionTier>('free');
    const [usedToday, setUsedToday] = useState(0);
    const [lastUpdated, setLastUpdated] = useState('--');

    // 載入訂閱狀態
    useEffect(() => {
        const loadSubscription = async () => {
            if (user) {
                const sub = await getUserSubscription(user.id);
                if (sub) {
                    setTier(sub.tier);
                    setUsedToday(sub.usedToday);
                }
            }
        };
        loadSubscription();

        // 更新時間
        setLastUpdated(new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }));
    }, [user]);

    const dailyLimit = TIER_LIMITS[tier];
    const remaining = dailyLimit === -1 ? '∞' : Math.max(0, dailyLimit - usedToday);

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="brand">
                <motion.div
                    className="logo-icon"
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    style={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        borderRadius: '12px',
                        padding: '10px',
                        fontSize: '1.5rem',
                    }}
                >
                    📊
                </motion.div>
                <div className="logo-text">
                    <h1 style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>Discover Latest</h1>
                    <span className="subtitle" style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        letterSpacing: '0.5px',
                    }}>AI 金融分析平台</span>
                </div>
            </div>

            {/* 會員狀態卡片 */}
            {user && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="subscription-card"
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
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: TIER_COLORS[tier] }}>
                            {remaining}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {dailyLimit === -1 ? '' : `/ ${dailyLimit}`} 次 AI 分析
                        </span>
                    </div>
                    {dailyLimit !== -1 && (
                        <div style={{
                            marginTop: 8,
                            height: 4,
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: 2,
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                width: `${Math.min(100, (usedToday / dailyLimit) * 100)}%`,
                                height: '100%',
                                background: TIER_COLORS[tier],
                                transition: 'width 0.3s ease',
                            }} />
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
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    margin: '4px 12px',
                                    borderRadius: '10px',
                                    color: isActive ? '#fff' : 'var(--text-secondary)',
                                    background: isActive ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)' : 'transparent',
                                    transition: 'all 0.2s ease',
                                    textDecoration: 'none',
                                }}
                            >
                                <span className="nav-icon" style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                                <span className="nav-label" style={{ fontSize: '0.9375rem', fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
                            </Link>
                        </motion.div>
                    );
                })}

                {/* 分隔線 */}
                <div style={{
                    margin: '16px 24px',
                    height: 1,
                    background: 'linear-gradient(90deg, transparent, var(--border-color), transparent)',
                }} />

                {/* 會員方案連結 */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 }}
                >
                    <Link
                        href="/pricing"
                        className={`nav-item ${pathname === '/pricing' ? 'active' : ''}`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            margin: '4px 12px',
                            borderRadius: '10px',
                            color: pathname === '/pricing' ? '#fff' : '#fcd34d',
                            background: pathname === '/pricing'
                                ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                                : 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            transition: 'all 0.2s ease',
                            textDecoration: 'none',
                        }}
                    >
                        <span style={{ fontSize: '1.25rem' }}>💎</span>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>會員方案</span>
                    </Link>
                </motion.div>
            </nav>

            {/* Footer */}
            <div className="sidebar-footer" style={{
                marginTop: 'auto',
                padding: '16px',
                borderTop: '1px solid var(--border-color)',
            }}>
                <div className="update-info" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                }}>
                    <span className="update-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>最後更新</span>
                    <span className="update-time" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{lastUpdated}</span>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    🔄 資料每 5 分鐘自動更新
                </p>
            </div>
        </aside>
    );
}
