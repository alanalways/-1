/**
 * Header 元件
 * 頁面標題、搜尋框、使用者選單、主題切換
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
    title: string;
    onSearch?: (query: string) => void;
}

export function Header({ title, onSearch }: HeaderProps) {
    const { user, signIn, signOut } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);

    // 初始化主題
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            setIsDarkMode(false);
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }, []);

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

    return (
        <header className="header">
            <div className="header-left">
                <h2 className="page-title">{title}</h2>
            </div>

            <div className="header-right">
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
