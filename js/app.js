/**
 * Discover Latest - Professional Financial Platform
 * Main Application JavaScript
 */

// === State Management ===
const state = {
    currentPage: 'dashboard',
    allStocks: [],
    filteredStocks: [],
    watchlist: JSON.parse(localStorage.getItem('watchlist') || '[]'),
    marketData: null,
    isLoading: true,
    currentFilter: 'all',
    currentSort: 'score',
    searchQuery: ''
};

// === DOM Elements ===
const elements = {
    loadingOverlay: document.getElementById('loadingOverlay'),
    marketCards: document.getElementById('marketCards'),
    stockCards: document.getElementById('stockCards'),
    watchlistCards: document.getElementById('watchlistCards'),
    watchlistEmpty: document.getElementById('watchlistEmpty'),
    globalMarketsGrid: document.getElementById('globalMarketsGrid'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    stockCount: document.getElementById('stockCount'),
    lastUpdated: document.getElementById('lastUpdated'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    pageTitle: document.getElementById('pageTitle')
};

// === Initialization ===
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Discover Latest initializing...');

    // Setup event listeners
    setupEventListeners();

    // Load data
    await loadMarketData();

    // Render UI
    renderDashboard();

    // Hide loading
    hideLoading();
});

// === Event Listeners Setup ===
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });

    // Search
    elements.searchInput?.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        applyFiltersAndSort();
    });

    // Sort
    elements.sortSelect?.addEventListener('change', (e) => {
        state.currentSort = e.target.value;
        applyFiltersAndSort();
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentFilter = btn.dataset.filter;
            applyFiltersAndSort();
        });
    });

    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
        showLoading();
        await loadMarketData();
        renderDashboard();
        hideLoading();
        showToast('數據已更新！');
    });

    // Modal close
    document.getElementById('modalClose')?.addEventListener('click', closeModal);
    elements.modalOverlay?.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) closeModal();
    });

    // Theme toggle
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        showToast('主題切換功能開發中...', 'info');
    });
}

// === Data Loading ===
async function loadMarketData() {
    try {
        const response = await fetch('data/market-data.json');
        if (!response.ok) throw new Error('Failed to load data');

        state.marketData = await response.json();

        // Load ALL stocks (全市場), not just recommendations
        state.allStocks = state.marketData.allStocks || state.marketData.recommendations || [];
        state.filteredStocks = [...state.allStocks];

        // Update last updated time
        if (elements.lastUpdated && state.marketData.lastUpdated) {
            elements.lastUpdated.textContent = state.marketData.lastUpdated;
        }

        console.log(`✅ Loaded ${state.allStocks.length} stocks (全市場)`);
    } catch (error) {
        console.error('Failed to load market data:', error);
        showToast('載入數據失敗，請稍後再試', 'error');
    }
}

// === Rendering Functions ===
function renderDashboard() {
    renderMarketOverview();
    applyFiltersAndSort();
    renderWatchlist();
    renderGlobalMarkets();
}

function renderMarketOverview() {
    const container = elements.marketCards;
    if (!container || !state.marketData?.marketIntelligence) return;

    container.innerHTML = state.marketData.marketIntelligence.map(item => `
        <div class="market-card">
            <div class="market-card-header">
                <div class="market-card-icon">${item.icon}</div>
                <span class="market-card-label">${item.category}</span>
            </div>
            <div class="market-card-title">${item.title}</div>
            <div class="market-card-content">${item.content?.replace(/\n/g, '<br>') || ''}</div>
        </div>
    `).join('');
}

function applyFiltersAndSort() {
    let stocks = [...state.allStocks];

    // Apply search filter
    if (state.searchQuery) {
        stocks = stocks.filter(s =>
            s.code?.toLowerCase().includes(state.searchQuery) ||
            s.name?.toLowerCase().includes(state.searchQuery)
        );
    }

    // Apply category filter
    if (state.currentFilter !== 'all') {
        switch (state.currentFilter) {
            case 'bullish':
                stocks = stocks.filter(s => s.signal === 'BULLISH');
                break;
            case 'bearish':
                stocks = stocks.filter(s => s.signal === 'BEARISH');
                break;
            case 'smc':
                stocks = stocks.filter(s =>
                    s.patterns?.ob || s.patterns?.fvg || s.patterns?.sweep
                );
                break;
        }
    }

    // Apply sort
    switch (state.currentSort) {
        case 'score':
            stocks.sort((a, b) => (b.score || 0) - (a.score || 0));
            break;
        case 'change':
            stocks.sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0));
            break;
        case 'volume':
            stocks.sort((a, b) => parseFloat(b.volume || 0) - parseFloat(a.volume || 0));
            break;
        case 'name':
            stocks.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
    }

    state.filteredStocks = stocks;
    renderStockCards();
}

function renderStockCards() {
    const container = elements.stockCards;
    if (!container) return;

    // Update count
    if (elements.stockCount) {
        elements.stockCount.textContent = `顯示 ${state.filteredStocks.length} 檔`;
    }

    if (state.filteredStocks.length === 0) {
        container.innerHTML = `
            <div class="watchlist-empty">
                <div class="empty-icon">🔍</div>
                <p>沒有符合條件的股票</p>
                <span>試試調整篩選條件</span>
            </div>
        `;
        return;
    }

    container.innerHTML = state.filteredStocks.map((stock, index) => createStockCard(stock, index)).join('');

    // Add event listeners to action buttons
    container.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const code = btn.dataset.code;

            switch (action) {
                case 'favorite':
                    toggleFavorite(code, btn);
                    break;
                case 'analyze':
                    showAnalysis(code);
                    break;
                case 'chart':
                    openChart(code);
                    break;
            }
        });
    });
}

function createStockCard(stock, index) {
    const isFavorited = state.watchlist.includes(stock.code);
    const changeClass = stock.changePercent > 0 ? 'positive' : (stock.changePercent < 0 ? 'negative' : '');

    // Generate tags HTML
    const tagsHtml = (stock.tags || []).map(tag => {
        let className = 'tag';
        if (tag.type === 'bullish') className += ' bullish';
        else if (tag.type === 'bearish') className += ' bearish';
        else if (tag.type === 'neutral') className += ' neutral';
        else if (tag.type === 'smc-ob') className += ' smc-ob';
        else if (tag.type === 'smc-fvg') className += ' smc-fvg';
        else if (tag.type === 'smc-liq') className += ' smc-liq';
        else if (tag.type === 'wyckoff') className += ' wyckoff';

        return `<span class="${className}">${tag.label}</span>`;
    }).join('');

    return `
        <div class="stock-card" style="animation-delay: ${index * 0.05}s">
            <div class="stock-card-header">
                <div class="stock-card-info">
                    <span class="stock-code">${stock.code || 'N/A'}</span>
                    <span class="stock-name">${stock.name || 'Unknown'}</span>
                </div>
                <div class="stock-card-actions">
                    <button class="action-btn ${isFavorited ? 'favorited' : ''}" data-action="favorite" data-code="${stock.code}" title="加入自選">
                        ${isFavorited ? '⭐' : '☆'}
                    </button>
                    <button class="action-btn" data-action="analyze" data-code="${stock.code}" title="深度分析">
                        📊
                    </button>
                    <button class="action-btn" data-action="chart" data-code="${stock.code}" title="開啟走勢圖">
                        📈
                    </button>
                </div>
            </div>
            <div class="stock-card-stats">
                <div class="stock-stat">
                    <span class="stock-stat-label">收盤價</span>
                    <span class="stock-stat-value">${stock.closePrice || 'N/A'}</span>
                </div>
                <div class="stock-stat">
                    <span class="stock-stat-label">漲跌幅</span>
                    <span class="stock-stat-value ${changeClass}">${stock.changePercent > 0 ? '+' : ''}${stock.changePercent?.toFixed(2) || 0}%</span>
                </div>
                <div class="stock-stat">
                    <span class="stock-stat-label">評分</span>
                    <span class="stock-stat-value">${stock.score || 'N/A'}</span>
                </div>
                ${stock.peRatio ? `
                <div class="stock-stat">
                    <span class="stock-stat-label">本益比</span>
                    <span class="stock-stat-value">${stock.peRatio}</span>
                </div>
                ` : ''}
            </div>
            <div class="stock-card-analysis">${stock.analysis || '分析資料載入中...'}</div>
            <div class="stock-card-tags">${tagsHtml}</div>
        </div>
    `;
}

function renderWatchlist() {
    const container = elements.watchlistCards;
    const emptyState = elements.watchlistEmpty;
    if (!container) return;

    const watchlistStocks = state.allStocks.filter(s => state.watchlist.includes(s.code));

    if (watchlistStocks.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.innerHTML = watchlistStocks.map((stock, index) => createStockCard(stock, index)).join('');
}

function renderGlobalMarkets() {
    const container = elements.globalMarketsGrid;
    if (!container || !state.marketData?.raw) return;

    const { usIndices, commodities } = state.marketData.raw;

    let html = '';

    // US Indices
    if (usIndices?.length) {
        html += usIndices.map(index => `
            <div class="market-card">
                <div class="market-card-header">
                    <div class="market-card-icon">📈</div>
                    <span class="market-card-label">指數</span>
                </div>
                <div class="market-card-title">${index.name}</div>
                <div class="market-card-value">
                    ${index.price}
                    <span class="market-card-change ${parseFloat(index.changePercent) >= 0 ? 'positive' : 'negative'}">
                        ${parseFloat(index.changePercent) >= 0 ? '+' : ''}${index.changePercent}%
                    </span>
                </div>
            </div>
        `).join('');
    }

    // Commodities
    if (commodities?.length) {
        html += commodities.map(item => `
            <div class="market-card">
                <div class="market-card-header">
                    <div class="market-card-icon">${item.icon || '💰'}</div>
                    <span class="market-card-label">商品</span>
                </div>
                <div class="market-card-title">${item.name}</div>
                <div class="market-card-value">
                    ${item.price}
                    <span class="market-card-change ${parseFloat(item.changePercent) >= 0 ? 'positive' : 'negative'}">
                        ${parseFloat(item.changePercent) >= 0 ? '+' : ''}${item.changePercent}%
                    </span>
                </div>
            </div>
        `).join('');
    }

    container.innerHTML = html || '<p style="color: var(--text-muted);">國際市場數據載入中...</p>';
}

// === Navigation ===
function navigateTo(page) {
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Update page visibility
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.add('hidden');
    });

    const pageElement = document.getElementById(`${page}Page`);
    if (pageElement) {
        pageElement.classList.remove('hidden');
    }

    // Update title
    const titles = {
        dashboard: '市場儀表板',
        watchlist: '我的自選清單',
        analysis: '深度分析',
        global: '國際市場'
    };
    if (elements.pageTitle) {
        elements.pageTitle.textContent = titles[page] || '市場儀表板';
    }

    state.currentPage = page;

    // Re-render watchlist if needed
    if (page === 'watchlist') {
        renderWatchlist();
    }
}

// === Actions ===
function toggleFavorite(code, btn) {
    const index = state.watchlist.indexOf(code);

    if (index > -1) {
        state.watchlist.splice(index, 1);
        btn.classList.remove('favorited');
        btn.innerHTML = '☆';
        showToast(`${code} 已從自選清單移除`);
    } else {
        state.watchlist.push(code);
        btn.classList.add('favorited');
        btn.innerHTML = '⭐';
        showToast(`${code} 已加入自選清單`);
    }

    // Save to localStorage
    localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
}

function showAnalysis(code) {
    const stock = state.allStocks.find(s => s.code === code);
    if (!stock) return;

    if (elements.modalTitle) {
        elements.modalTitle.textContent = `${stock.name} (${stock.code}) 深度分析`;
    }

    if (elements.modalBody) {
        elements.modalBody.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <h4 style="margin-bottom: 0.5rem;">📊 基本資料</h4>
                    <p>收盤價：${stock.closePrice}</p>
                    <p>漲跌幅：${stock.changePercent?.toFixed(2)}%</p>
                    <p>評分：${stock.score}/100</p>
                    ${stock.peRatio ? `<p>本益比：${stock.peRatio}</p>` : ''}
                    ${stock.dividendYield ? `<p>殖利率：${stock.dividendYield}%</p>` : ''}
                </div>
                <div>
                    <h4 style="margin-bottom: 0.5rem;">🧠 SMC 分析</h4>
                    <p>Order Block：${stock.patterns?.ob || '無訊號'}</p>
                    <p>FVG：${stock.patterns?.fvg || '無訊號'}</p>
                    <p>Liquidity Sweep：${stock.patterns?.sweep || '無訊號'}</p>
                </div>
                <div>
                    <h4 style="margin-bottom: 0.5rem;">📝 分析觀點</h4>
                    <p>${stock.analysis || '暫無分析資料'}</p>
                </div>
                <div>
                    <h4 style="margin-bottom: 0.5rem;">🏷️ 標籤</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${(stock.tags || []).map(t => `<span class="tag ${t.type}">${t.label}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    openModal();
}

function openChart(code) {
    // Open TradingView chart
    const symbol = code.replace('.TW', '');
    window.open(`https://www.tradingview.com/chart/?symbol=TWSE:${symbol}`, '_blank');
}

// === Modal ===
function openModal() {
    elements.modalOverlay?.classList.add('show');
}

function closeModal() {
    elements.modalOverlay?.classList.remove('show');
}

// === Loading ===
function showLoading() {
    elements.loadingOverlay?.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay?.classList.add('hidden');
}

// === Toast ===
function showToast(message, type = 'success') {
    if (!elements.toast || !elements.toastMessage) return;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    elements.toast.querySelector('.toast-icon').textContent = icons[type] || icons.success;
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// === Export for debugging ===
window.discoverLatest = {
    state,
    refreshData: async () => {
        showLoading();
        await loadMarketData();
        renderDashboard();
        hideLoading();
    }
};
