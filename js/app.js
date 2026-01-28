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

    // Load global markets
    await loadGlobalMarkets();

    // Render UI
    renderDashboard();

    // Hide loading
    hideLoading();

    // Setup auto-refresh during Taiwan trading hours (9:00-13:30)
    setupAutoRefresh();
});

// === Trading Hours Auto Refresh ===
let autoRefreshInterval = null;

function isTaiwanTradingHours() {
    const now = new Date();
    // 台北時間 = UTC+8
    const taiwanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const hours = taiwanTime.getHours();
    const minutes = taiwanTime.getMinutes();
    const day = taiwanTime.getDay();

    // 週一到週五
    if (day === 0 || day === 6) return false;

    // 9:00 - 13:30
    const timeValue = hours * 60 + minutes;
    return timeValue >= 9 * 60 && timeValue <= 13 * 60 + 30;
}

function setupAutoRefresh() {
    // 每分鐘檢查是否在交易時段
    setInterval(() => {
        if (isTaiwanTradingHours()) {
            if (!autoRefreshInterval) {
                console.log('📡 進入交易時段，啟動每 5 分鐘自動更新');
                autoRefreshInterval = setInterval(refreshAllData, 5 * 60 * 1000);
                showToast('🔄 交易時段自動更新已啟動', 'success');
            }
        } else {
            if (autoRefreshInterval) {
                console.log('⏸️ 離開交易時段，停止自動更新');
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
        }
    }, 60 * 1000);

    // 首次檢查
    if (isTaiwanTradingHours()) {
        autoRefreshInterval = setInterval(refreshAllData, 5 * 60 * 1000);
        console.log('📡 已在交易時段，自動更新每 5 分鐘');
    }
}

async function refreshAllData() {
    console.log('🔄 自動更新資料...', new Date().toLocaleTimeString());
    try {
        await loadMarketData();
        await loadGlobalMarkets();
        renderDashboard();
        renderGlobalMarkets();

        if (elements.lastUpdated) {
            elements.lastUpdated.textContent = new Date().toLocaleString('zh-TW');
        }
        showToast('✅ 資料已更新', 'success');
    } catch (err) {
        console.error('自動更新失敗:', err);
    }
}

// === Global Markets Data ===
async function loadGlobalMarkets() {
    const symbols = [
        { symbol: '^DJI', name: '道瓊工業', icon: '🇺🇸' },
        { symbol: '^GSPC', name: 'S&P 500', icon: '📊' },
        { symbol: '^IXIC', name: '那斯達克', icon: '💻' },
        { symbol: '^SOX', name: '費半指數', icon: '🔌' },
        { symbol: '^N225', name: '日經 225', icon: '🇯🇵' },
        { symbol: '000001.SS', name: '上證指數', icon: '🇨🇳' },
        { symbol: 'GC=F', name: '黃金', icon: '🥇' },
        { symbol: 'CL=F', name: '原油', icon: '🛢️' },
        { symbol: 'BTC-USD', name: '比特幣', icon: '₿' },
        { symbol: 'EURUSD=X', name: '歐元/美元', icon: '💱' }
    ];

    try {
        const results = await Promise.all(symbols.map(async (item) => {
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}?interval=1d&range=2d`;
                const response = await fetchWithCORS(url);
                const data = await response.json();

                if (data.chart?.result?.[0]) {
                    const result = data.chart.result[0];
                    const meta = result.meta;
                    const quotes = result.indicators?.quote?.[0] || {};

                    const currentPrice = meta.regularMarketPrice || quotes.close?.[quotes.close.length - 1] || 0;
                    const prevClose = meta.previousClose || meta.chartPreviousClose || currentPrice;
                    const change = currentPrice - prevClose;
                    const changePercent = prevClose ? (change / prevClose * 100) : 0;

                    return {
                        ...item,
                        price: currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                        change: change.toFixed(2),
                        changePercent: changePercent.toFixed(2)
                    };
                }
            } catch (e) {
                console.warn(`Failed to fetch ${item.symbol}:`, e.message);
            }
            return { ...item, price: '--', change: '0', changePercent: '0' };
        }));

        // 儲存到 state
        if (!state.marketData) state.marketData = {};
        if (!state.marketData.raw) state.marketData.raw = {};

        state.marketData.raw.usIndices = results.filter(r => ['^DJI', '^GSPC', '^IXIC', '^SOX', '^N225', '000001.SS'].includes(r.symbol));
        state.marketData.raw.commodities = results.filter(r => ['GC=F', 'CL=F', 'BTC-USD', 'EURUSD=X'].includes(r.symbol));

        console.log('✅ 國際市場資料已載入');
    } catch (error) {
        console.error('載入國際市場失敗:', error);
    }
}

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

        // === 動態更新 Market Intelligence ===
        updateMarketIntelligence();

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

// 動態生成 Market Intelligence 內容
function updateMarketIntelligence() {
    if (!state.marketData.marketIntelligence) return;

    const stocks = state.allStocks;
    const bullishCount = stocks.filter(s => s.signal === 'BULLISH').length;
    const bearishCount = stocks.filter(s => s.signal === 'BEARISH').length;
    const smcCount = stocks.filter(s => s.patterns?.ob || s.patterns?.fvg || s.patterns?.sweep).length;

    // 計算平均漲跌幅
    const avgChange = stocks.length > 0
        ? (stocks.reduce((sum, s) => sum + (parseFloat(s.changePercent) || 0), 0) / stocks.length).toFixed(2)
        : 0;

    // 找出漲幅最大的產業
    const sectorMap = new Map();
    stocks.forEach(s => {
        if (s.sector) {
            if (!sectorMap.has(s.sector)) sectorMap.set(s.sector, { count: 0, change: 0 });
            sectorMap.get(s.sector).count++;
            sectorMap.get(s.sector).change += parseFloat(s.changePercent) || 0;
        }
    });
    const hotSector = [...sectorMap.entries()]
        .map(([name, data]) => ({ name, avgChange: data.change / data.count }))
        .sort((a, b) => b.avgChange - a.avgChange)[0];

    // 更新 marketIntelligence 陣列
    state.marketData.marketIntelligence = [
        {
            icon: '📈',
            category: '盤後總結',
            title: `今日掃描 ${stocks.length} 檔股票`,
            content: `看多 ${bullishCount} 檔 | 看空 ${bearishCount} 檔 | SMC 訊號 ${smcCount} 檔\n平均漲跌：${avgChange}%`,
            stats: [
                { label: '看多', value: bullishCount },
                { label: '看空', value: bearishCount }
            ]
        },
        {
            icon: '📊',
            category: '全市場掃描',
            title: `共掃描 ${stocks.length} 檔股票`,
            content: `看多 ${bullishCount} 檔 • 看空 ${bearishCount} 檔 • SMC 訊號 ${smcCount} 檔`,
            stats: [
                { label: '總數', value: stocks.length },
                { label: 'SMC', value: smcCount }
            ]
        },
        {
            icon: '🔥',
            category: '熱門產業',
            title: hotSector ? `${hotSector.name} 最強` : '產業分析',
            content: hotSector ? `${hotSector.name} 平均漲幅 ${hotSector.avgChange.toFixed(2)}%` : '計算中...',
            stats: []
        },
        {
            icon: '🌍',
            category: '國際市場',
            title: '國際指數即時報價',
            content: '請切換至「國際市場」頁面查看詳細數據',
            stats: []
        },
        {
            icon: '🤖',
            category: 'SMC 策略觀點',
            title: `市場情緒：${bullishCount > bearishCount ? '偏多' : bullishCount < bearishCount ? '偏空' : '中性'} | SMC 訊號：${smcCount} 檔`,
            content: `今日 SMC 策略掃描全市場，發現 ${smcCount} 檔具備機構訊號。`
        }
    ];
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
        simulator: '複利雪球模擬器',
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

    // Initialize simulator if needed
    if (page === 'simulator' && !state.simulatorInitialized) {
        initSimulator();
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
        elements.modalTitle.textContent = `${stock.name} (${stock.code}) SMC 深度分析`;
    }

    if (elements.modalBody) {
        // Create professional analysis layout
        elements.modalBody.innerHTML = `
            <div class="smc-analysis-container">
                <!-- Header Info -->
                <div class="smc-header">
                    <div class="smc-price-info">
                        <span class="smc-current-price">${stock.closePrice}</span>
                        <span class="smc-change ${parseFloat(stock.changePercent) >= 0 ? 'positive' : 'negative'}">
                            ${parseFloat(stock.changePercent) >= 0 ? '+' : ''}${stock.changePercent?.toFixed(2)}%
                        </span>
                    </div>
                    <div class="smc-signal-badge ${stock.signal?.toLowerCase() || 'neutral'}">
                        ${stock.signal === 'BULLISH' ? '🟢 看多' : stock.signal === 'BEARISH' ? '🔴 看空' : '⚪ 中性'}
                    </div>
                </div>
                
                <!-- Chart Container -->
                <div class="smc-chart-wrapper">
                    <div class="smc-chart-header">
                        <span>📊 K 線圖表 + SMC 標記</span>
                        <div class="smc-chart-legend">
                            <span class="legend-item"><span style="background:#f59e0b"></span>MA5</span>
                            <span class="legend-item"><span style="background:#3b82f6"></span>MA20</span>
                            <span class="legend-item"><span style="background:#a855f7"></span>MA60</span>
                        </div>
                    </div>
                    <div class="smc-chart-container">
                        <canvas id="smcCandleChart"></canvas>
                        <div class="smc-chart-loading" id="smcChartLoading">
                            <div class="spinner"></div>
                            <span>載入 K 線資料中...</span>
                        </div>
                    </div>
                </div>
                
                <!-- SMC Deep Dive -->
                <div class="smc-deep-dive">
                    <h4>🔍 SMC DEEP DIVE</h4>
                    <div class="smc-signals-grid">
                        <div class="smc-signal-card ${stock.patterns?.ob ? 'active' : ''}">
                            <div class="signal-icon">🧱</div>
                            <div class="signal-name">Order Block</div>
                            <div class="signal-value">${stock.patterns?.ob === 'bullish-ob' ? '✅ Bullish' : stock.patterns?.ob === 'bearish-ob' ? '🔻 Bearish' : '—'}</div>
                        </div>
                        <div class="smc-signal-card ${stock.patterns?.fvg ? 'active' : ''}">
                            <div class="signal-icon">🕳️</div>
                            <div class="signal-name">FVG</div>
                            <div class="signal-value">${stock.patterns?.fvg === 'bullish-fvg' ? '✅ Bullish' : stock.patterns?.fvg === 'bearish-fvg' ? '🔻 Bearish' : '—'}</div>
                        </div>
                        <div class="smc-signal-card ${stock.patterns?.sweep ? 'active' : ''}">
                            <div class="signal-icon">🐢</div>
                            <div class="signal-name">Liq Sweep</div>
                            <div class="signal-value">${stock.patterns?.sweep === 'liquidity-sweep-bull' ? '✅ 破底翻' : stock.patterns?.sweep === 'liquidity-sweep-bear' ? '🔻 假突破' : '—'}</div>
                        </div>
                        <div class="smc-signal-card">
                            <div class="signal-icon">📈</div>
                            <div class="signal-name">Score</div>
                            <div class="signal-value">${stock.score}/100</div>
                        </div>
                    </div>
                </div>
                
                <!-- Entry Confirmation -->
                <div class="smc-entry-confirmation">
                    <h4>📋 ENTRY CONFIRMATION</h4>
                    <div class="entry-checklist" id="entryChecklist">
                        <div class="checklist-item loading">載入中...</div>
                    </div>
                </div>
                
                <!-- Fundamentals -->
                <div class="smc-fundamentals">
                    <h4>📊 基本面數據</h4>
                    <div class="fundamentals-grid">
                        <div class="fund-item">
                            <span class="fund-label">本益比</span>
                            <span class="fund-value">${stock.peRatio || '—'}</span>
                        </div>
                        <div class="fund-item">
                            <span class="fund-label">殖利率</span>
                            <span class="fund-value">${stock.dividendYield ? stock.dividendYield + '%' : '—'}</span>
                        </div>
                        <div class="fund-item">
                            <span class="fund-label">量比</span>
                            <span class="fund-value">${stock.volumeRatio?.toFixed(2) || '—'}</span>
                        </div>
                        <div class="fund-item">
                            <span class="fund-label">產業</span>
                            <span class="fund-value">${stock.sector || '—'}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Analysis Text -->
                <div class="smc-analysis-text">
                    <h4>🧠 AI 分析觀點</h4>
                    <p>${stock.analysis || '暫無分析資料'}</p>
                </div>
                
                <!-- Tags -->
                <div class="smc-tags">
                    ${(stock.tags || []).map(t => `<span class="tag ${t.type}">${t.label}</span>`).join('')}
                </div>
            </div>
        `;

        // Fetch and render candlestick chart
        fetchAndRenderCandleChart(code);
    }

    openModal();
}

// Fetch historical data and render professional candlestick chart
async function fetchAndRenderCandleChart(code) {
    const chartLoading = document.getElementById('smcChartLoading');
    const entryChecklist = document.getElementById('entryChecklist');

    try {
        // Use backtest-data.js fetch function if available, else use Yahoo Finance directly
        const symbol = code.includes('.TW') || code.includes('.TWO') ? code : code + '.TW';
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`;

        const response = await fetchWithCORS(url);
        const data = await response.json();

        if (data.chart?.result?.[0]) {
            const result = data.chart.result[0];
            const timestamps = result.timestamp || [];
            const quotes = result.indicators?.quote?.[0] || {};

            const history = timestamps.map((t, i) => ({
                date: new Date(t * 1000).toISOString().split('T')[0],
                open: quotes.open?.[i] || 0,
                high: quotes.high?.[i] || 0,
                low: quotes.low?.[i] || 0,
                close: quotes.close?.[i] || 0,
                volume: quotes.volume?.[i] || 0
            })).filter(h => h.open > 0);

            if (history.length > 0) {
                renderCandlestickChart(history);
                updateEntryChecklist(history, entryChecklist);
            }
        }
    } catch (error) {
        console.warn('Failed to fetch chart data:', error);
        if (chartLoading) chartLoading.innerHTML = '<span style="color: var(--text-muted);">無法載入 K 線資料</span>';
    }
}

function renderCandlestickChart(history) {
    const chartLoading = document.getElementById('smcChartLoading');
    if (chartLoading) chartLoading.style.display = 'none';

    const ctx = document.getElementById('smcCandleChart');
    if (!ctx) return;

    // Calculate MAs
    const closes = history.map(h => h.close);
    const ma5 = calculateMA(closes, 5);
    const ma20 = calculateMA(closes, 20);
    const ma60 = calculateMA(closes, 60);

    // Prepare data
    const labels = history.map(h => h.date.slice(5)); // MM-DD format
    const candleData = history.map(h => ({
        x: h.date.slice(5),
        o: h.open,
        h: h.high,
        l: h.low,
        c: h.close
    }));

    // Use standard Chart.js line chart for OHLC visualization (simpler than full candlestick)
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.slice(-60), // Last 60 days
            datasets: [
                {
                    label: '收盤價',
                    data: closes.slice(-60),
                    borderColor: closes[closes.length - 1] > closes[closes.length - 2] ? '#10b981' : '#ef4444',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    borderWidth: 2
                },
                {
                    label: 'MA5',
                    data: ma5.slice(-60),
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    pointRadius: 0,
                    borderDash: []
                },
                {
                    label: 'MA20',
                    data: ma20.slice(-60),
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    pointRadius: 0,
                    borderDash: []
                },
                {
                    label: 'MA60',
                    data: ma60.slice(-60),
                    borderColor: '#a855f7',
                    borderWidth: 1,
                    pointRadius: 0,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.raw?.toFixed(2) || '--'}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#888', maxTicksLimit: 10 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#888' }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function calculateMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / period);
        }
    }
    return result;
}

function updateEntryChecklist(history, container) {
    if (!container || history.length < 20) return;

    const closes = history.map(h => h.close);
    const currentPrice = closes[closes.length - 1];
    const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const ma60 = history.length >= 60 ? closes.slice(-60).reduce((a, b) => a + b, 0) / 60 : null;

    // Calculate RSI
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    const rsi = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));

    // Generate checklist
    const checks = [
        { label: 'Price > MA20', passed: currentPrice > ma20 },
        { label: 'Price > MA60', passed: ma60 ? currentPrice > ma60 : null },
        { label: 'RSI < 70 (not overbought)', passed: rsi < 70 },
        { label: 'RSI > 30 (not oversold)', passed: rsi > 30 }
    ];

    container.innerHTML = checks.map(c => `
        <div class="checklist-item ${c.passed === true ? 'passed' : c.passed === false ? 'failed' : 'neutral'}">
            <span class="check-icon">${c.passed === true ? '✅' : c.passed === false ? '❌' : '⚪'}</span>
            <span>${c.label}</span>
        </div>
    `).join('');
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

// === Simulator ===
let simChart = null;
let simEngine = null;
let simSelectedSymbol = null;

function initSimulator() {
    state.simulatorInitialized = true;
    simEngine = new BacktestEngine();

    const els = {
        search: document.getElementById('simSymbolSearch'),
        results: document.getElementById('simSearchResults'),
        selected: document.getElementById('simSelectedSymbol'),
        symbolName: document.getElementById('simSymbolName'),
        symbolCode: document.getElementById('simSymbolCode'),
        modeTabs: document.querySelectorAll('.sim-mode-tab'),
        runBtn: document.getElementById('simRunButton'),
        years: document.getElementById('simYears'),
        yearsValue: document.getElementById('simYearsValue'),
        annualReturn: document.getElementById('simAnnualReturn'),
        annualReturnValue: document.getElementById('simAnnualReturnValue'),
        annualReturnGroup: document.getElementById('simAnnualReturnGroup'),
        usePhases: document.getElementById('simUsePhases'),
        phasesContainer: document.getElementById('simInvestmentPhases'),
        fixedMonthlyGroup: document.getElementById('simFixedMonthlyGroup'),
        addPhase: document.getElementById('simAddPhase'),
        chartTitle: document.getElementById('simChartTitle'),
        loading: document.getElementById('simLoading'),
        startDate: document.getElementById('simStartDate'),
        endDate: document.getElementById('simEndDate')
    };

    // Default dates
    const today = new Date();
    const tenYearsAgo = new Date(today);
    tenYearsAgo.setFullYear(today.getFullYear() - 10);
    els.startDate.value = tenYearsAgo.toISOString().split('T')[0];
    els.endDate.value = today.toISOString().split('T')[0];

    let currentMode = 'backtest';
    let searchTimeout = null;

    // Search
    els.search.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            els.results.innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(async () => {
            const results = await searchSymbol(query);
            els.results.innerHTML = results.slice(0, 8).map(r => `
                <div class="sim-search-item" data-symbol="${r.symbol}" data-name="${r.name}">
                    <strong>${r.symbol}</strong> - ${r.name} 
                    <span style="color: var(--text-muted);">${r.type || ''}</span>
                </div>
            `).join('');

            els.results.querySelectorAll('.sim-search-item').forEach(item => {
                item.addEventListener('click', () => {
                    simSelectedSymbol = {
                        symbol: item.dataset.symbol,
                        name: item.dataset.name
                    };
                    els.symbolName.textContent = simSelectedSymbol.name;
                    els.symbolCode.textContent = simSelectedSymbol.symbol;
                    els.selected.style.display = 'flex';
                    els.results.innerHTML = '';
                    els.search.value = '';
                    els.runBtn.disabled = false;
                });
            });
        }, 300);
    });

    // Mode tabs
    els.modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            els.modeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;

            els.annualReturnGroup.style.display = currentMode === 'simulation' ? 'block' : 'none';
        });
    });

    // Years slider
    els.years.addEventListener('input', (e) => {
        els.yearsValue.textContent = e.target.value;
    });

    // Annual return slider
    els.annualReturn.addEventListener('input', (e) => {
        els.annualReturnValue.textContent = e.target.value;
    });

    // Phases toggle
    els.usePhases.addEventListener('change', (e) => {
        els.phasesContainer.style.display = e.target.checked ? 'block' : 'none';
        els.fixedMonthlyGroup.style.display = e.target.checked ? 'none' : 'block';
    });

    // Add phase
    els.addPhase.addEventListener('click', () => {
        const count = document.querySelectorAll('.sim-phase-item').length + 1;
        const html = `
            <div class="sim-phase-item" data-phase="${count}">
                <div class="sim-phase-header">
                    第 ${count} 階段
                    <button onclick="this.closest('.sim-phase-item').remove()" 
                            style="float: right; background: none; border: none; color: #ef4444; cursor: pointer;">✕</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <div>
                        <label style="font-size: 0.75rem;">月數</label>
                        <input type="number" class="sim-phase-months" value="12" min="1">
                    </div>
                    <div>
                        <label style="font-size: 0.75rem;">每月金額</label>
                        <input type="number" class="sim-phase-amount" value="10000" min="0" step="1000">
                    </div>
                </div>
            </div>
        `;
        document.getElementById('simPhaseList').insertAdjacentHTML('beforeend', html);
    });

    // Run simulation
    els.runBtn.addEventListener('click', async () => {
        if (!simSelectedSymbol) return;

        els.loading.style.display = 'flex';
        els.chartTitle.textContent = `${simSelectedSymbol.name} 模擬中...`;

        try {
            const params = getSimParams();
            let result;

            if (currentMode === 'backtest') {
                const data = await BacktestData.fetchHistoricalData(simSelectedSymbol.symbol, params.years);
                result = simEngine.runBacktest(data, params);
            } else if (currentMode === 'forecast') {
                const data = await BacktestData.fetchHistoricalData(simSelectedSymbol.symbol, 10);
                result = simEngine.runForecast(data, params);
            } else {
                result = simEngine.runSimulation(params);
            }

            renderSimChart(result, currentMode);
            updateSimStats(result, currentMode);
            els.chartTitle.textContent = `${simSelectedSymbol.name} - ${currentMode === 'backtest' ? '歷史回測' : currentMode === 'forecast' ? '未來預測' : '固定模擬'}`;

        } catch (err) {
            console.error('Simulation error:', err);
            showToast('模擬失敗：' + err.message, 'error');
        }

        els.loading.style.display = 'none';
    });

    function getSimParams() {
        const params = {
            initialCapital: parseFloat(document.getElementById('simInitialCapital').value) || 100000,
            monthlyInvestment: parseFloat(document.getElementById('simMonthlyInvestment').value) || 10000,
            years: parseInt(document.getElementById('simYears').value) || 10,
            annualReturn: parseFloat(document.getElementById('simAnnualReturn').value) / 100 || 0.07,
            startDate: els.startDate.value || null,
            endDate: els.endDate.value || null
        };

        if (els.usePhases.checked) {
            params.usePhases = true;
            params.investmentPhases = [];
            document.querySelectorAll('.sim-phase-item').forEach((item, i) => {
                params.investmentPhases.push({
                    phase: i + 1,
                    months: parseInt(item.querySelector('.sim-phase-months').value) || 12,
                    amount: parseFloat(item.querySelector('.sim-phase-amount').value) || 0
                });
            });
        }

        return params;
    }

    function renderSimChart(result, mode) {
        const ctx = document.getElementById('simMainChart').getContext('2d');

        if (simChart) {
            simChart.destroy();
        }

        let labels, datasets;

        if (mode === 'backtest') {
            // 資料已為週線，直接使用 (若資料太多則取每 4 週一點)
            const weeklyData = result.timeline.length > 260
                ? result.timeline.filter((_, i) => i % 4 === 0 || i === result.timeline.length - 1)
                : result.timeline;
            labels = weeklyData.map(t => t.date);

            // 計算股價的縮放比例以便在同一圖表顯示
            const maxPrice = Math.max(...weeklyData.map(t => t.price));
            const maxValue = Math.max(...weeklyData.map(t => t.marketValue));
            const priceScale = maxValue / maxPrice * 0.5; // 股價縮放到市值的50%高度

            datasets = [
                {
                    label: '投資組合市值',
                    data: weeklyData.map(t => t.marketValue),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: '投入本金',
                    data: weeklyData.map(t => t.cost),
                    borderColor: '#6b7280',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0,
                    yAxisID: 'y'
                },
                {
                    label: '股價',
                    data: weeklyData.map(t => t.price),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.05)',
                    fill: false,
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: 0,
                    yAxisID: 'y1'
                }
            ];
        } else if (mode === 'forecast') {
            labels = result.timeline.map(t => t.date);
            datasets = [
                {
                    label: '樂觀 (P90)',
                    data: result.timeline.map(t => t.p90),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: '+1',
                    tension: 0.3
                },
                {
                    label: '中位數 (P50)',
                    data: result.timeline.map(t => t.p50),
                    borderColor: '#3b82f6',
                    fill: false,
                    tension: 0.3
                },
                {
                    label: '保守 (P10)',
                    data: result.timeline.map(t => t.p10),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: '-1',
                    tension: 0.3
                },
                {
                    label: '投入本金',
                    data: result.timeline.map(t => t.capital),
                    borderColor: '#6b7280',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0
                }
            ];
        } else {
            labels = result.timeline.map(t => t.date);
            datasets = [
                {
                    label: '投資組合價值',
                    data: result.timeline.map(t => t.value),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: '投入本金',
                    data: result.timeline.map(t => t.capital),
                    borderColor: '#6b7280',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0
                }
            ];
        }

        simChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { position: 'top' },
                    zoom: {
                        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
                        pan: { enabled: true, mode: 'x' }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    if (context.dataset.yAxisID === 'y1') {
                                        label += 'NT$' + context.parsed.y.toFixed(2);
                                    } else {
                                        label += 'NT$' + Math.round(context.parsed.y).toLocaleString();
                                    }
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: '市值 / 本金 (NT$)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: mode === 'backtest',
                        position: 'right',
                        beginAtZero: false,
                        grid: {
                            drawOnChartArea: false
                        },
                        title: {
                            display: true,
                            text: '股價 (NT$)'
                        }
                    }
                }
            }
        });
    }

    function updateSimStats(result, mode) {
        const fmt = (val) => 'NT$' + Math.round(val).toLocaleString();
        const pct = (val) => (val * 100).toFixed(2) + '%';

        if (mode === 'backtest') {
            document.getElementById('simStatFinalValue').textContent = fmt(result.summary.finalMarketValue);
            document.getElementById('simStatTotalReturn').textContent = pct(result.summary.totalReturn);
            document.getElementById('simStatCAGR').textContent = pct(result.summary.cagr);
            document.getElementById('simStatMaxDrawdown').textContent = pct(result.summary.maxDrawdown);
            document.getElementById('simStatSharpe').textContent = result.summary.sharpeRatio.toFixed(2);
            document.getElementById('simStatDividends').textContent = fmt(result.summary.totalDividends);
        } else if (mode === 'forecast') {
            document.getElementById('simStatFinalValue').textContent = fmt(result.summary.median);
            document.getElementById('simStatTotalReturn').textContent = pct(result.summary.medianReturn);
            document.getElementById('simStatCAGR').textContent = '--';
            document.getElementById('simStatMaxDrawdown').textContent = '--';
            document.getElementById('simStatSharpe').textContent = '--';
            document.getElementById('simStatDividends').textContent = '--';
        } else {
            document.getElementById('simStatFinalValue').textContent = fmt(result.summary.finalValue);
            document.getElementById('simStatTotalReturn').textContent = pct(result.summary.totalGainPercent);
            document.getElementById('simStatCAGR').textContent = pct(result.summary.annualReturn);
            document.getElementById('simStatMaxDrawdown').textContent = '--';
            document.getElementById('simStatSharpe').textContent = '--';
            document.getElementById('simStatDividends').textContent = '--';
        }
    }

    console.log('✅ Simulator initialized');
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
