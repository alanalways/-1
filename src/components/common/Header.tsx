/**
 * Header 元件
 * 頁面標題、搜尋框、使用者選單、主題切換
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { getUserSubscription, getGuestUsage, TIER_LIMITS, TIER_NAMES, TIER_COLORS, type UserSubscription } from '@/services/subscription';

interface HeaderProps {
    title: string;
    onSearch?: (query: string) => void;
}

export function Header({ title, onSearch }: HeaderProps) {
    const { user, signIn, signOut } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);

    // 初始化主題
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            setIsDarkMode(false);
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }, []);

    // 取得使用量
    useEffect(() => {
        const fetchUsage = async () => {
            if (user) {
                const sub = await getUserSubscription(user.id);
                setSubscription(sub);
            } else {
                const guestUsage = getGuestUsage();
                setSubscription(guestUsage);
            }
        };

        fetchUsage();

        // 監聽使用量更新事件
        const handleUsageUpdate = () => fetchUsage();
        window.addEventListener('ai-usage-updated', handleUsageUpdate);
        return () => window.removeEventListener('ai-usage-updated', handleUsageUpdate);
    }, [user]);

    // 切換主題
    const toggleTheme = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);

        if (newMode) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            onSearch?.(searchQuery.trim());
        }
    };

    const handleSearchClick = () => {
        if (searchQuery.trim()) {
            onSearch?.(searchQuery.trim());
        }
    };

    // 計算使用進度
    const getUsagePercent = () => {
        if (!subscription || subscription.dailyLimit === -1) return 0;
        return Math.min((subscription.usedToday / subscription.dailyLimit) * 100, 100);
    };

    const getRemainingText = () => {
        if (!subscription) return '';
        if (subscription.dailyLimit === -1) return '無限制';
        const remaining = Math.max(0, subscription.dailyLimit - subscription.usedToday);
        return `${remaining} / ${subscription.dailyLimit} 次`;
    };

    return (
        <header className="header">
            <div className="header-left">
                <h2 className="page-title">{title}</h2>
            </div>

            <div className="header-right">
                {/* AI 使用量顯示 */}
                {subscription && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.75rem',
                    }}>
                        <span style={{ color: TIER_COLORS[subscription.tier] }}>
                            {TIER_NAMES[subscription.tier]}
                        </span>
                        <div style={{
                            width: '60px',
                            height: '6px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${getUsagePercent()}%`,
                                background: getUsagePercent() >= 90
                                    ? 'var(--stock-down)'
                                    : getUsagePercent() >= 50
                                        ? 'var(--warning)'
                                        : 'var(--stock-up)',
                                transition: 'width 0.3s ease',
                            }} />
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {getRemainingText()}
                        </span>
                    </div>
                )}

                {/* 搜尋框 */}
                <form className="search-box" onSubmit={handleSearch}>
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="搜尋股票代號或名稱..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <motion.button
                        type="button"
                        className="search-btn"
                        onClick={handleSearchClick}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="搜尋"
                    >
                        搜尋
                    </motion.button>
                </form>

                {/* 使用者選單 */}
                <div className="user-menu-container">
                    {user ? (
                        <motion.button
                            className="user-avatar"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {user.user_metadata?.avatar_url ? (
                                <img
                                    src={user.user_metadata.avatar_url}
                                    alt="avatar"
                                    className="avatar-img"
                                />
                            ) : (
                                <span>👤</span>
                            )}
                        </motion.button>
                    ) : (
                        <motion.button
                            className="login-btn"
                            onClick={signIn}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <span>🔐</span>
                            <span>登入</span>
                        </motion.button>
                    )}

                    {/* 下拉選單 */}
                    {showUserMenu && user && (
                        <motion.div
                            className="user-dropdown"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="user-info">
                                <span className="user-name">{user.user_metadata?.full_name || user.email}</span>
                                <span className="user-email">{user.email}</span>
                            </div>

                            {/* 使用量詳情 */}
                            {subscription && (
                                <div style={{
                                    padding: '12px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-sm)',
                                    margin: '8px 0',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.75rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>今日 AI 分析</span>
                                        <span style={{ color: TIER_COLORS[subscription.tier], fontWeight: 600 }}>
                                            {TIER_NAMES[subscription.tier]}
                                        </span>
                                    </div>
                                    <div style={{
                                        width: '100%',
                                        height: '8px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '4px',
                                        overflow: 'hidden',
                                        marginBottom: '6px',
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${getUsagePercent()}%`,
                                            background: getUsagePercent() >= 90
                                                ? 'var(--stock-down)'
                                                : getUsagePercent() >= 50
                                                    ? 'var(--warning)'
                                                    : 'var(--stock-up)',
                                            transition: 'width 0.3s ease',
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {subscription.dailyLimit === -1
                                            ? '✨ 無限制使用'
                                            : `已使用 ${subscription.usedToday} / ${subscription.dailyLimit} 次`}
                                    </div>
                                </div>
                            )}

                            <hr />
                            <button className="dropdown-item" onClick={signOut}>
                                登出
                            </button>
                        </motion.div>
                    )}
                </div>

                {/* 主題切換 */}
                <motion.button
                    className="theme-toggle"
                    onClick={toggleTheme}
                    whileHover={{ scale: 1.1, rotate: 15 }}
                    whileTap={{ scale: 0.9 }}
                    title={isDarkMode ? '切換至亮色模式' : '切換至暗色模式'}
                >
                    {isDarkMode ? '🌙' : '☀️'}
                </motion.button>
            </div>
        </header>
    );
}
