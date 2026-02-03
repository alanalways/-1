/**
 * 自選清單頁面
 * 管理使用者的自選股票
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useWatchlist } from '@/hooks/useWatchlist';
import type { WatchlistItem } from '@/services/supabase';

// 模擬股票價格資料
function getMockPrice() {
    return {
        price: (100 + Math.random() * 400).toFixed(2),
        change: ((Math.random() - 0.5) * 10).toFixed(2),
        changePercent: ((Math.random() - 0.5) * 5).toFixed(2),
    };
}

export default function WatchlistPage() {
    const { showToast } = useToast();
    const { user, isEnabled: isAuthEnabled } = useAuth();
    const { items: watchlist, loading, addItem, removeItem, updateNotes } = useWatchlist();

    const [showAddModal, setShowAddModal] = useState(false);
    const [newStockCode, setNewStockCode] = useState('');
    const [newStockNotes, setNewStockNotes] = useState('');
    const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);

    const handleSearch = (query: string) => {
        if (!query.trim()) return;
        // 快速新增到自選
        handleAddStock(query.toUpperCase());
    };

    const handleAddStock = async (code?: string) => {
        const stockCode = code || newStockCode.trim().toUpperCase();
        if (!stockCode) {
            showToast('請輸入股票代碼', 'warning');
            return;
        }

        // 檢查是否已存在
        if (watchlist.some(item => item.stock_code === stockCode)) {
            showToast(`${stockCode} 已在自選清單中`, 'info');
            setShowAddModal(false);
            setNewStockCode('');
            return;
        }

        try {
            await addItem(stockCode, newStockNotes || undefined);
            showToast(`已新增 ${stockCode} 到自選清單`, 'success');
            setShowAddModal(false);
            setNewStockCode('');
            setNewStockNotes('');
        } catch (error) {
            showToast('新增失敗，請稍後重試', 'error');
        }
    };

    const handleRemoveStock = async (stockCode: string) => {
        try {
            await removeItem(stockCode);
            showToast(`已從自選清單移除 ${stockCode}`, 'success');
        } catch (error) {
            showToast('移除失敗，請稍後重試', 'error');
        }
    };

    const handleUpdateNotes = async () => {
        if (!editingItem) return;

        try {
            await updateNotes(editingItem.stock_code, editingItem.notes || '');
            showToast('備註已更新', 'success');
            setEditingItem(null);
        } catch (error) {
            showToast('更新失敗，請稍後重試', 'error');
        }
    };

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <Header title="自選清單" onSearch={handleSearch} />

                {/* 標題區域 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--spacing-lg)',
                    }}
                >
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '4px' }}>
                            ⭐ 自選清單
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            共 {watchlist.length} 檔股票 {!user && '(本地儲存)'}
                        </p>
                    </div>

                    <motion.button
                        onClick={() => setShowAddModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 20px',
                            background: 'var(--primary)',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: 500,
                        }}
                        whileHover={{ scale: 1.02, boxShadow: 'var(--shadow-glow)' }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <span>＋</span>
                        <span>新增股票</span>
                    </motion.button>
                </motion.div>

                {/* 同步狀態提示 */}
                {!user && isAuthEnabled && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                            padding: 'var(--spacing-md)',
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--spacing-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-md)',
                        }}
                    >
                        <span style={{ fontSize: '1.5rem' }}>☁️</span>
                        <div>
                            <div style={{ fontWeight: 500 }}>登入以同步自選清單</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                登入後可跨裝置同步您的自選清單
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* 股票列表 */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                        <p style={{ color: 'var(--text-muted)' }}>載入中...</p>
                    </div>
                ) : watchlist.length === 0 ? (
                    <motion.div
                        className="glass-card"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ textAlign: 'center', padding: 'var(--spacing-xl) * 2' }}
                    >
                        <span style={{ fontSize: '4rem' }}>📭</span>
                        <h3 style={{ marginTop: 'var(--spacing-md)', fontWeight: 600 }}>尚無自選股票</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                            點擊上方「新增股票」按鈕，或在搜尋框輸入股票代碼
                        </p>
                    </motion.div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 'var(--spacing-md)',
                    }}>
                        <AnimatePresence>
                            {watchlist.map((item, index) => {
                                const priceData = getMockPrice();
                                const isUp = parseFloat(priceData.change) >= 0;

                                return (
                                    <motion.div
                                        key={item.id || item.stock_code}
                                        className="glass-card"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ delay: index * 0.03 }}
                                        style={{ position: 'relative' }}
                                        whileHover={{ borderColor: 'var(--primary)' }}
                                    >
                                        {/* 移除按鈕 */}
                                        <motion.button
                                            onClick={() => handleRemoveStock(item.stock_code)}
                                            style={{
                                                position: 'absolute',
                                                top: '12px',
                                                right: '12px',
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                background: 'var(--bg-input)',
                                                color: 'var(--text-muted)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1rem',
                                            }}
                                            whileHover={{ background: 'var(--error)', color: 'white' }}
                                        >
                                            ✕
                                        </motion.button>

                                        {/* 股票資訊 */}
                                        <a
                                            href={`/analysis?symbol=${item.stock_code}`}
                                            style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                                        >
                                            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                                                <div style={{ fontWeight: 600, fontSize: '1.25rem' }}>
                                                    {item.stock_code}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {new Date(item.added_at).toLocaleDateString('zh-TW')} 加入
                                                </div>
                                            </div>

                                            {/* 價格 */}
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: 'var(--spacing-sm)' }}>
                                                <span style={{
                                                    fontFamily: 'var(--font-mono)',
                                                    fontSize: '1.5rem',
                                                    fontWeight: 600,
                                                }}>
                                                    {priceData.price}
                                                </span>
                                                <span style={{
                                                    color: isUp ? 'var(--stock-up)' : 'var(--stock-down)',
                                                    fontWeight: 500,
                                                }}>
                                                    {isUp ? '+' : ''}{priceData.change} ({isUp ? '+' : ''}{priceData.changePercent}%)
                                                </span>
                                            </div>
                                        </a>

                                        {/* 備註 */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingItem(item);
                                            }}
                                            style={{
                                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                background: 'var(--bg-input)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.875rem',
                                                color: item.notes ? 'var(--text-secondary)' : 'var(--text-muted)',
                                                cursor: 'pointer',
                                                minHeight: '28px',
                                            }}
                                        >
                                            {item.notes || '點擊新增備註...'}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}

                {/* 新增股票 Modal */}
                <Modal
                    isOpen={showAddModal}
                    onClose={() => {
                        setShowAddModal(false);
                        setNewStockCode('');
                        setNewStockNotes('');
                    }}
                    title="新增股票到自選"
                    size="sm"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                                股票代碼
                            </label>
                            <input
                                type="text"
                                value={newStockCode}
                                onChange={(e) => setNewStockCode(e.target.value.toUpperCase())}
                                placeholder="例如: 2330、AAPL"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddStock()}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                                備註（選填）
                            </label>
                            <textarea
                                value={newStockNotes}
                                onChange={(e) => setNewStockNotes(e.target.value)}
                                placeholder="加入你的投資筆記..."
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                    resize: 'none',
                                }}
                            />
                        </div>

                        <motion.button
                            onClick={() => handleAddStock()}
                            style={{
                                padding: '12px',
                                background: 'var(--primary)',
                                color: 'white',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: 500,
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            新增到自選清單
                        </motion.button>
                    </div>
                </Modal>

                {/* 編輯備註 Modal */}
                <Modal
                    isOpen={!!editingItem}
                    onClose={() => setEditingItem(null)}
                    title={`編輯 ${editingItem?.stock_code} 備註`}
                    size="sm"
                >
                    {editingItem && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <textarea
                                value={editingItem.notes || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                                placeholder="加入你的投資筆記..."
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                    resize: 'none',
                                }}
                            />

                            <motion.button
                                onClick={handleUpdateNotes}
                                style={{
                                    padding: '12px',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    borderRadius: 'var(--radius-md)',
                                    fontWeight: 500,
                                }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                儲存備註
                            </motion.button>
                        </div>
                    )}
                </Modal>
            </main>
        </div>
    );
}
