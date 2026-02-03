/**
 * Loading 元件
 * 骨架屏、Spinner、進度條
 */

'use client';

import { motion } from 'framer-motion';

// 骨架屏
export function Skeleton({
    width = '100%',
    height = '16px',
    className = ''
}: {
    width?: string | number;
    height?: string | number;
    className?: string;
}) {
    return (
        <div
            className={`skeleton ${className}`}
            style={{ width, height }}
        />
    );
}

// 載入 Spinner
export function Spinner({ size = 40 }: { size?: number }) {
    return (
        <motion.div
            className="loading-spinner"
            style={{ width: size, height: size }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
    );
}

// 全頁載入覆蓋層
export function LoadingOverlay({
    message = '載入中...'
}: {
    message?: string
}) {
    return (
        <motion.div
            className="loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="loading-content">
                <motion.div
                    className="loading-logo"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    🚀
                </motion.div>
                <h2 className="loading-title">Discover Latest</h2>
                <Spinner />
                <p className="loading-text">{message}</p>
            </div>
        </motion.div>
    );
}

// 進度條
export function ProgressBar({
    percent,
    label
}: {
    percent: number;
    label?: string;
}) {
    return (
        <div className="progress-container">
            <div className="progress-bar">
                <motion.div
                    className="progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>
            {label && (
                <div className="progress-info">
                    <span className="progress-percent">{percent}%</span>
                    <span className="progress-label">{label}</span>
                </div>
            )}
        </div>
    );
}

// 股票卡片骨架屏
export function StockCardSkeleton() {
    return (
        <div className="stock-card skeleton-card">
            <div className="stock-card-header">
                <div className="stock-card-info">
                    <Skeleton width={80} height={24} />
                    <Skeleton width={60} height={18} />
                </div>
                <div className="stock-card-actions">
                    <Skeleton width={36} height={36} className="rounded" />
                    <Skeleton width={36} height={36} className="rounded" />
                </div>
            </div>
            <div className="stock-card-stats">
                <Skeleton width={100} height={32} />
                <Skeleton width={80} height={24} />
            </div>
            <Skeleton width="100%" height={60} />
        </div>
    );
}
