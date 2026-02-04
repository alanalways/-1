/**
 * 錯誤狀態元件
 * 統一的錯誤顯示與重試介面
 */

'use client';

import { motion } from 'framer-motion';

interface ErrorStateProps {
    title?: string;
    message: string;
    onRetry?: () => void;
    retryText?: string;
    icon?: string;
}

export function ErrorState({
    title = '無法載入資料',
    message,
    onRetry,
    retryText = '重試',
    icon = '⚠️',
}: ErrorStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                textAlign: 'center',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '16px',
                margin: '16px 0',
            }}
        >
            <span style={{ fontSize: '3rem', marginBottom: '16px' }}>{icon}</span>
            <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#fca5a5',
                marginBottom: '8px',
            }}>
                {title}
            </h3>
            <p style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.6)',
                maxWidth: '400px',
                lineHeight: 1.6,
                marginBottom: onRetry ? '24px' : 0,
            }}>
                {message}
            </p>
            {onRetry && (
                <motion.button
                    onClick={onRetry}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                        border: 'none',
                        borderRadius: '10px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <span>🔄</span>
                    {retryText}
                </motion.button>
            )}
        </motion.div>
    );
}

/**
 * 載入中狀態元件
 */
export function LoadingState({
    message = '載入中...',
}: {
    message?: string;
}) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
        }}>
            <div style={{
                width: 48,
                height: 48,
                border: '3px solid rgba(99, 102, 241, 0.2)',
                borderTopColor: '#6366f1',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
            <p style={{
                marginTop: '16px',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.875rem',
            }}>
                {message}
            </p>
            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

/**
 * 空資料狀態元件
 */
export function EmptyState({
    title = '沒有資料',
    message = '目前沒有可顯示的資料',
    icon = '📭',
}: {
    title?: string;
    message?: string;
    icon?: string;
}) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
        }}>
            <span style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.6 }}>{icon}</span>
            <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '8px',
            }}>
                {title}
            </h3>
            <p style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.5)',
            }}>
                {message}
            </p>
        </div>
    );
}

/**
 * 非交易時間提示
 */
export function MarketClosedState({
    nextTradingDay,
}: {
    nextTradingDay?: string;
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '10px',
            marginBottom: '16px',
        }}>
            <span style={{ fontSize: '1.25rem' }}>🌙</span>
            <div>
                <p style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#fcd34d',
                    marginBottom: '2px',
                }}>
                    目前為非交易時間
                </p>
                <p style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                }}>
                    {nextTradingDay
                        ? `下次開盤：${nextTradingDay} 09:00`
                        : '交易時間：週一至週五 09:00 - 13:30'}
                </p>
            </div>
        </div>
    );
}
