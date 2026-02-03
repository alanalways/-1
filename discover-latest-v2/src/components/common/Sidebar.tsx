/**
 * Sidebar 元件
 * 導覽列，支援動畫
 */

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
];

export function Sidebar() {
    const pathname = usePathname();

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
