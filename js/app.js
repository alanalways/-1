/**
 * Discover Latest - Professional Financial Platform
 * Main Application JavaScript
 */

// === Cloudflare CORS Proxy Configuration ===
const PROXY_BASE_URL = 'https://stock-proxy.cmshj30326.workers.dev/';

// === Real-time Price Cache ===
const priceCache = {
    data: new Map(),
    lastUpdate: null,
    THROTTLE_MS: 30000 // 30 秒節流
};

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
    searchQuery: '',
    analysisDate: null // 訊號分析日期
};



// === DOM Elements ===
let analysisChart = null; // Chart instance
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
    updateLoadingProgress(10, '初始化完成');

    // Load data
    updateLoadingProgress(20, '載入市場數據...');
    await loadMarketData();
    updateLoadingProgress(60, '分析 SMC 訊號...');

    // Load global markets
    updateLoadingProgress(75, '載入國際市場...');
    await loadGlobalMarkets();

    // Render UI
    updateLoadingProgress(90, '渲染界面...');
    renderDashboard();

    // Hide loading
    updateLoadingProgress(100, '完成！');
    setTimeout(hideLoading, 300);

    // Setup auto-refresh during Taiwan trading hours (9:00-13:30)
    setupAutoRefresh();
});

// === Loading Progress Functions ===
function updateLoadingProgress(percent, step) {
    const progressFill = document.getElementById('loadingProgressFill');
    const percentText = document.getElementById('loadingPercent');
    const stepText = document.getElementById('loadingStep');

    if (progressFill) progressFill.style.width = `${percent}%`;
    if (percentText) percentText.textContent = `${percent}%`;
    if (stepText) stepText.textContent = step;
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

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
                console.log('📡 進入交易時段，啟動每 60 秒即時報價更新');
                autoRefreshInterval = setInterval(updateVisiblePrices, 60 * 1000); // 60 秒更新即時報價
                showToast('🔄 交易時段即時報價已啟動', 'success');
            }
        } else {
            if (autoRefreshInterval) {
                console.log('⏸️ 離開交易時段，停止即時報價更新');
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
        }
    }, 60 * 1000);

    // 首次檢查
    if (isTaiwanTradingHours()) {
        autoRefreshInterval = setInterval(updateVisiblePrices, 60 * 1000);
        console.log('📡 已在交易時段，每 60 秒更新即時報價');
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
    // 1. 優先使用 JSON 內的緩存數據 (秒開)
    if (state.marketData?.internationalMarkets) {
        const { usIndices, commodities } = state.marketData.internationalMarkets;
        // 確保結構存在
        if (!state.marketData.raw) state.marketData.raw = {};

        state.marketData.raw.usIndices = usIndices || [];
        state.marketData.raw.commodities = commodities || [];

        // 立即渲染
        renderGlobalMarkets();
        console.log('✅ 使用 stocks-lite.json 內的國際市場數據 (秒開)');
    }

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
        // 背景更新 (不顯示 Loading)
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
            // 若失敗，保留原本數值或顯示 N/A
            return { ...item, price: '--', change: '0', changePercent: '0' };
        }));

        // 儲存到 state
        if (!state.marketData) state.marketData = {};
        if (!state.marketData.raw) state.marketData.raw = {};

        state.marketData.raw.usIndices = results.filter(r => ['^DJI', '^GSPC', '^IXIC', '^SOX', '^N225', '000001.SS'].includes(r.symbol));
        state.marketData.raw.commodities = results.filter(r => ['GC=F', 'CL=F', 'BTC-USD', 'EURUSD=X'].includes(r.symbol));

        renderGlobalMarkets(); // 更新為最新數據
        console.log('✅ 國際市場數據已在背景更新完成');
    } catch (error) {
        console.error('背景更新國際市場失敗:', error);
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

// === Cloudflare CORS Proxy Helper ===
async function fetchWithCORS(url) {
    try {
        // 組合完整的 Proxy 請求網址
        const targetUrl = `${PROXY_BASE_URL}?url=${encodeURIComponent(url)}`;
        const response = await fetch(targetUrl);

        if (!response.ok) {
            throw new Error(`Proxy error: ${response.status}`);
        }

        return response;
    } catch (error) {
        console.error('CORS Fetch Error:', error);
        throw error;
    }
}

// === Data Loading (使用瘦身版 JSON 加速載入) ===
async function loadMarketData() {
    try {
        // 優先使用瘦身版 stocks-lite.json (快速載入)
        const response = await fetch('data/stocks-lite.json');
        if (!response.ok) throw new Error('Failed to load lite data');

        const liteData = await response.json();

        // 設定 state
        state.marketData = liteData;
        state.allStocks = liteData.stocks || [];
        state.filteredStocks = [...state.allStocks];
        state.analysisDate = liteData.analysisDate;

        // === 動態更新 Market Intelligence (已改為後端生成，前端直接信任) ===
        // updateMarketIntelligence(); // Removed

        // Update last updated time with analysis date warning
        if (elements.lastUpdated && liteData.lastUpdated) {
            elements.lastUpdated.textContent = `${liteData.lastUpdated} (訊號分析：${liteData.analysisDate})`;
        }

        console.log(`✅ Loaded ${state.allStocks.length} stocks (瘦身版，快速載入)`);

        // 盤中時段啟動即時報價更新
        if (isTaiwanTradingHours()) {
            setTimeout(() => updateVisiblePrices(), 2000);
        }
    } catch (error) {
        console.error('Failed to load lite data, fallback to full:', error);

        // Fallback: 載入完整版
        try {
            const fullResponse = await fetch('data/market-data.json');
            if (fullResponse.ok) {
                const fullData = await fullResponse.json();
                state.marketData = fullData;
                state.allStocks = fullData.allStocks || [];
                state.filteredStocks = [...state.allStocks];
                updateMarketIntelligence();
                console.log(`✅ Fallback: Loaded ${state.allStocks.length} stocks (完整版)`);
            }
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            showToast('載入數據失敗，請稍後再試', 'error');
        }
    }
}

// === 即時報價更新 (僅更新畫面上可見的股票) ===
async function updateVisiblePrices() {
    // 節流檢查：上次更新 < 30 秒不發請求
    const now = Date.now();
    if (priceCache.lastUpdate && (now - priceCache.lastUpdate) < priceCache.THROTTLE_MS) {
        console.log('⏳ 即時報價節流中，跳過本次更新');
        return;
    }

    // 取得畫面上前 20 檔股票
    const visibleStocks = state.filteredStocks.slice(0, 20);
    if (visibleStocks.length === 0) return;

    console.log(`📡 更新 ${visibleStocks.length} 檔股票即時報價...`);

    const symbols = visibleStocks.map(s => {
        const code = s.code.replace('.TW', '').replace('.TWO', '');
        return `${code}.TW`;
    }).join(',');

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(visibleStocks[0].code.replace('.TW', '') + '.TW')}`;

        // 逐一更新每檔股票
        for (const stock of visibleStocks) {
            const code = stock.code.replace('.TW', '').replace('.TWO', '');
            const yahooSymbol = `${code}.TW`;

            // 檢查快取
            const cached = priceCache.data.get(yahooSymbol);
            if (cached && (now - cached.timestamp) < priceCache.THROTTLE_MS) {
                continue; // 使用快取
            }

            try {
                const response = await fetchWithCORS(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`);
                const data = await response.json();

                if (data.chart?.result?.[0]) {
                    const meta = data.chart.result[0].meta;
                    const newPrice = meta.regularMarketPrice;
                    const prevClose = meta.previousClose || meta.chartPreviousClose;
                    const changePercent = prevClose ? ((newPrice - prevClose) / prevClose * 100) : 0;

                    // 更新快取
                    priceCache.data.set(yahooSymbol, {
                        price: newPrice,
                        changePercent: changePercent.toFixed(2),
                        timestamp: now
                    });

                    // 更新 DOM
                    updateStockCardPrice(stock.code, newPrice, changePercent);

                    // 防雷：如果跌幅 > 3% 且原訊號為看多，顯示警告
                    if (changePercent < -3 && stock.signal === 'BULLISH') {
                        console.warn(`⚠️ ${stock.code} ${stock.name}: 跌幅 ${changePercent.toFixed(2)}% 但訊號看多，注意風險！`);
                    }
                }
            } catch (err) {
                console.warn(`更新 ${yahooSymbol} 失敗:`, err.message);
            }

            // 避免請求過快
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        priceCache.lastUpdate = now;
        console.log('✅ 即時報價更新完成');

    } catch (error) {
        console.error('即時報價更新失敗:', error);
    }
}

// === 更新股票卡片價格 DOM ===
function updateStockCardPrice(code, newPrice, changePercent) {
    const card = document.querySelector(`[data-stock-code="${code}"]`);
    if (!card) return;

    const priceEl = card.querySelector('.stock-price');
    const changeEl = card.querySelector('.stock-change');

    if (priceEl) {
        priceEl.textContent = `$${newPrice.toLocaleString()}`;
    }

    if (changeEl) {
        const isPositive = changePercent >= 0;
        changeEl.textContent = `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`;
        changeEl.className = `stock-change ${isPositive ? 'positive' : 'negative'}`;
    }
}

// 動態生成 Market Intelligence 內容
// 動態生成 Market Intelligence 內容 (已移除，改由後端 scripts/generate-report.js 統一計算)
// function updateMarketIntelligence() { ... }

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
        global: '國際市場',
        crypto: '加密貨幣 (Binance)'
    };
    if (elements.pageTitle) {
        elements.pageTitle.textContent = titles[page] || '市場儀表板';
    }

    state.currentPage = page;

    // Trigger page specific logic
    if (page === 'crypto') {
        loadCryptoMarket();
    }

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

    // 取得純股票代碼（不含 .TW）
    const pureCode = code.replace('.TW', '').replace('.TWO', '');
    const tvSymbol = `TWSE:${pureCode}`;

    if (elements.modalTitle) {
        elements.modalTitle.textContent = `${stock.name} (${pureCode}) 深度分析`;
    }

    if (elements.modalBody) {
        // Create professional StockLAB-style layout
        elements.modalBody.innerHTML = `
            <div class="deep-analysis-container">
                <!-- Section 1: TradingView Chart -->
                <div class="chart-section">
                    <div class="chart-header">
                        <div class="chart-title">
                            <span class="chart-icon">📈</span>
                            <span>股票歷史走勢</span>
                        </div>
                        <div class="chart-controls">
                            <span class="chart-symbol">${pureCode}</span>
                            <select id="chartTimeframe" class="chart-select">
                                <option value="1M">1 月</option>
                                <option value="3M">3 月</option>
                                <option value="1Y" selected>1 年</option>
                                <option value="5Y">5 年</option>
                                <option value="ALL">全部</option>
                            </select>

                            <button class="chart-btn ai-btn" id="aiAnalysisBtn">
                                ✨ AI 介紹股簡報
                                <span class="beta-badge">BETA</span>
                            </button>
                        </div>
                    </div>
                    <div class="tradingview-widget-container" id="tradingview_container">
                        <div id="tradingview_chart" style="height: 400px;"></div>
                        <div class="chart-loading" id="tvLoading">
                            <div class="spinner"></div>
                            <span>載入圖表中...</span>
                        </div>
                    </div>
                    <div class="chart-source">
                        資料來源：TWSE「每日成交資訊」（使用 API 查詢）
                    </div>
                </div>

                <!-- Section 2: Stock Info Cards -->
                <div class="info-cards-section">
                    <div class="info-section-title">創新資訊</div>
                    <div class="info-cards-grid">
                        <div class="info-card">
                            <div class="info-label">成交量</div>
                            <div class="info-value">${formatNumber(stock.volume)}</div>
                            <div class="info-unit">TWD</div>
                        </div>
                        <div class="info-card ${parseFloat(stock.changePercent) >= 0 ? 'positive' : 'negative'}">
                            <div class="info-label">漲幅</div>
                            <div class="info-value">${parseFloat(stock.changePercent) >= 0 ? '+' : ''}${stock.changePercent?.toFixed(2)}%</div>
                            <div class="info-unit"></div>
                        </div>
                        <div class="info-card">
                            <div class="info-label">開盤</div>
                            <div class="info-value">${stock.openPrice}</div>
                            <div class="info-unit">TWD</div>
                        </div>
                        <div class="info-card">
                            <div class="info-label">最高</div>
                            <div class="info-value">${stock.highPrice}</div>
                            <div class="info-unit">TWD</div>
                        </div>
                    </div>
                    <div class="more-details-btn">
                        <button onclick="toggleMoreDetails()">展開更多 ▼</button>
                    </div>
                </div>

                <!-- Section 3: Related Stocks Graph -->
                <div class="related-stocks-section">
                    <div class="related-header">
                        <div class="related-title">
                            <span class="related-icon">✨</span>
                            <span>產業關聯股 Beta 連動族譜</span>
                            <span class="beta-badge">BETA</span>
                        </div>
                    </div>
                    <div class="related-description">
                        <p><strong>價值定期（定期指失下漲較為自分區一定「買入止盤」）</strong></p>
                        <p>正相關 > 的連動股票因為具有相連動進化引動趨市場總動的特性。</p>
                        <p>建議關注 的 和股動量時變之，市力1.2，代表主動股每日漲 1%，這連動服平均 1.2%。</p>
                    </div>
                    <div class="related-graph-container">
                        <div class="related-graph-title">AI 的獲勝股技術說明</div>
                        <div class="related-graph-subtitle">代表階較高，源碼股</div>
                        <div id="relatedStocksGraph" class="related-graph">
                            <!-- Force-directed graph will be rendered here -->
                        </div>
                        <div class="graph-legend">
                            <span class="legend-item"><span class="dot" style="background:#3b82f6"></span>主股</span>
                            <span class="legend-item"><span class="dot" style="background:#22c55e"></span>強連動 > 1</span>
                            <span class="legend-item"><span class="dot" style="background:#f59e0b"></span>弱連動 0.5-1</span>
                            <span class="legend-item"><span class="dot" style="background:#ef4444"></span>逆連動 (負 Beta)</span>
                        </div>
                    </div>
                </div>

                <!-- Section 4: SMC Analysis (Collapsible) -->
                <div class="smc-section-collapsed" id="smcSection">
                    <div class="smc-signals-row">
                        <div class="smc-mini-card ${stock.patterns?.ob ? 'active' : ''}">
                            <span class="mini-icon">🧱</span>
                            <span class="mini-label">${stock.signal === 'BULLISH' ? 'Bullish OB (看漲訂單塊)' : stock.signal === 'BEARISH' ? 'Bearish OB (看跌訂單塊)' : 'Order Block (訂單塊)'}</span>
                            <span class="mini-value">${stock.patterns?.ob ? '✓' : '—'}</span>
                        </div>
                        <div class="smc-mini-card ${stock.patterns?.fvg ? 'active' : ''}">
                            <span class="mini-icon">🕳️</span>
                            <span class="mini-label">${stock.signal === 'BULLISH' ? 'Bullish FVG (看漲公平價值缺口)' : stock.signal === 'BEARISH' ? 'Bearish FVG (看跌公平價值缺口)' : 'FVG (公平價值缺口)'}</span>
                            <span class="mini-value">${stock.patterns?.fvg ? '✓' : '—'}</span>
                        </div>
                        <div class="smc-mini-card ${stock.patterns?.sweep ? 'active' : ''}">
                            <span class="mini-icon">🐢</span>
                            <span class="mini-label">Liquidity Sweep (流動性掃蕩)</span>
                            <span class="mini-value">${stock.patterns?.sweep ? '✓' : '—'}</span>
                        </div>
                        <div class="smc-mini-card ${stock.mss ? 'active' : ''}">
                            <span class="mini-icon">🔄</span>
                            <span class="mini-label">MSS (市場結構轉換)</span>
                            <span class="mini-value">${stock.mss ? '✓' : '—'}</span>
                        </div>
                        <div class="smc-mini-card score">
                            <span class="mini-icon">📊</span>
                            <span class="mini-label">SMC Score (評分)</span>
                            <span class="mini-value">${stock.score}/100</span>
                        </div>
                    </div>
                </div>

                <!-- Tags -->
                <div class="analysis-tags">
                    ${(stock.tags || []).map(t => `<span class="tag ${t.type}">${t.label}</span>`).join('')}
                </div>

                <!-- Section 5: AI Analysis Report -->
                <div class="ai-analysis-section">
                    <div class="ai-section-header">
                        <h4>💡 AI 智慧分析報告</h4>
                        <span class="beta-badge">BETA</span>
                    </div>
                    
                    <!-- 財務健康評分 -->
                    <div class="ai-health-score">
                        <div class="health-gauge-container">
                            <svg viewBox="0 0 100 60" class="health-gauge">
                                <defs>
                                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" style="stop-color:#ef4444"/>
                                        <stop offset="50%" style="stop-color:#f59e0b"/>
                                        <stop offset="100%" style="stop-color:#10b981"/>
                                    </linearGradient>
                                </defs>
                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6" stroke-linecap="round"/>
                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#gaugeGradient)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(stock.score / 100) * 126} 126"/>
                                <text x="50" y="45" text-anchor="middle" fill="#f8fafc" font-size="16" font-weight="bold">${stock.score}</text>
                                <text x="50" y="55" text-anchor="middle" fill="#94a3b8" font-size="6">健康評分</text>
                            </svg>
                        </div>
                        <div class="health-analysis">
                            <div class="analysis-badge ${stock.score >= 70 ? 'positive' : stock.score >= 40 ? 'neutral' : 'negative'}">
                                ${stock.score >= 70 ? '✅ 財務穩健' : stock.score >= 40 ? '⚠️ 需審慎評估' : '❌ 高風險警示'}
                            </div>
                            <p class="analysis-text">
                                ${stock.name} 綜合評分 ${stock.score}/100。
                                ${stock.patterns?.ob ? '偵測到訂單塊 (Order Block)，機構有佈局跡象。' : ''}
                                ${stock.patterns?.fvg ? '存在公平價值缺口 (FVG)，價格可能回補。' : ''}
                                ${parseFloat(stock.changePercent) > 0 ? `今日上漲 ${stock.changePercent?.toFixed(2)}%，動能偏多。` : `今日下跌 ${Math.abs(stock.changePercent || 0).toFixed(2)}%，需留意支撐。`}
                            </p>
                        </div>
                    </div>

                    <!-- 選股量化評級 -->
                    <div class="ai-quantitative">
                        <div class="quant-header">
                            <span class="quant-label">選股量化評級</span>
                            <span class="quant-direction ${stock.signal === 'BULLISH' ? 'bullish' : 'bearish'}">
                                ${stock.signal === 'BULLISH' ? '📈 買進' : stock.signal === 'BEARISH' ? '📉 賣出' : '➖ 觀望'}
                            </span>
                        </div>
                        <div class="quant-bar-container">
                            <span class="quant-bar-label left">看跌</span>
                            <div class="quant-bar">
                                <div class="quant-bar-fill" style="width: ${stock.score}%; background: ${stock.score >= 50 ? 'var(--accent-green)' : 'var(--accent-red)'}"></div>
                                <div class="quant-bar-marker" style="left: ${stock.score}%"></div>
                            </div>
                            <span class="quant-bar-label right">看漲</span>
                        </div>
                    </div>

                    <!-- 資產配置建議 -->
                    <div class="ai-asset-allocation">
                        <div class="allocation-header">
                            <span class="allocation-title">📊 資產類別配置分析</span>
                            <span class="allocation-subtitle">建議配置</span>
                        </div>
                        <div class="allocation-toggle">
                            <span class="toggle-label">風險配置（持股）</span>
                            <div class="toggle-buttons">
                                <button class="toggle-btn active" data-mode="conservative">存股派</button>
                                <button class="toggle-btn" data-mode="aggressive">大膽派</button>
                            </div>
                        </div>
                        <div class="allocation-caution">
                            <span class="caution-icon">⚠️</span>
                            <span id="allocationCautionText">若是以穩健收息為主「存股派」，適合不喜歡短期波動的投資者</span>
                        </div>
                        <div class="allocation-chart" id="allocationChart">
                            <div class="allocation-bar-row">
                                <span class="allocation-label">股票</span>
                                <div class="allocation-bar-group">
                                    <div class="allocation-bar stock" style="width: ${stock.score >= 70 ? '80' : stock.score >= 40 ? '60' : '40'}%"></div>
                                </div>
                                <span class="allocation-value">${stock.score >= 70 ? '80' : stock.score >= 40 ? '60' : '40'}%</span>
                            </div>
                            <div class="allocation-bar-row">
                                <span class="allocation-label">債券</span>
                                <div class="allocation-bar-group">
                                    <div class="allocation-bar bond" style="width: ${stock.score >= 70 ? '10' : stock.score >= 40 ? '25' : '35'}%"></div>
                                </div>
                                <span class="allocation-value">${stock.score >= 70 ? '10' : stock.score >= 40 ? '25' : '35'}%</span>
                            </div>
                            <div class="allocation-bar-row">
                                <span class="allocation-label">現金</span>
                                <div class="allocation-bar-group">
                                    <div class="allocation-bar cash" style="width: ${stock.score >= 70 ? '5' : stock.score >= 40 ? '10' : '20'}%"></div>
                                </div>
                                <span class="allocation-value">${stock.score >= 70 ? '5' : stock.score >= 40 ? '10' : '20'}%</span>
                            </div>
                            <div class="allocation-bar-row">
                                <span class="allocation-label">其他</span>
                                <div class="allocation-bar-group">
                                    <div class="allocation-bar other" style="width: ${stock.score >= 70 ? '5' : '5'}%"></div>
                                </div>
                                <span class="allocation-value">5%</span>
                            </div>
                        </div>
                        <div class="allocation-legend">
                            <span class="legend-item"><span class="dot" style="background:#10b981"></span>股票</span>
                            <span class="legend-item"><span class="dot" style="background:#3b82f6"></span>債券</span>
                            <span class="legend-item"><span class="dot" style="background:#f59e0b"></span>現金</span>
                            <span class="legend-item"><span class="dot" style="background:#a855f7"></span>其他</span>
                        </div>
                    </div>

                    <!-- 歷史配息率 -->
                    <div class="ai-dividend-history">
                        <div class="dividend-header">
                            <span class="dividend-title">📊 歷史配息概況</span>
                            <span class="dividend-info">近 5 年</span>
                        </div>
                        <div class="dividend-bars" id="dividendBars">
                            ${generateDividendBars()}
                        </div>
                        <div class="dividend-legend">
                            <span class="legend-item"><span class="dot" style="background:#10b981"></span>現金</span>
                            <span class="legend-item"><span class="dot" style="background:#3b82f6"></span>股票</span>
                        </div>
                    </div>

                    <!-- AI 進場價位預測 -->
                    <div class="ai-entry-prediction">
                        <div class="prediction-header">
                            <h5>🎯 AI 進場價位預測</h5>
                            <span class="beta-badge">BETA</span>
                        </div>
                        <div class="prediction-controls">
                            <div class="prediction-select-group">
                                <label>技術選擇</label>
                                <select class="prediction-select" id="predictionTechnique">
                                    <option value="ema">EMA (指數移動平均)</option>
                                    <option value="sma">SMA (簡單移動平均)</option>
                                    <option value="bollinger">布林通道</option>
                                    <option value="fibonacci">費氏回撤</option>
                                </select>
                            </div>
                            <div class="prediction-select-group">
                                <label>AI 類型</label>
                                <select class="prediction-select" id="predictionAI">
                                    <option value="conservative">穩健型 (保守)</option>
                                    <option value="aggressive">積極型 (激進)</option>
                                    <option value="balanced">平衡型</option>
                                </select>
                            </div>
                        </div>
                        <div class="prediction-result">
                            <div class="prediction-price-box">
                                <span class="prediction-label">建議進場價</span>
                                <span class="prediction-price">${(parseFloat(stock.price || stock.closePrice || 100) * 0.95).toFixed(2)}</span>
                                <span class="prediction-unit">TWD</span>
                            </div>
                            <div class="prediction-price-box">
                                <span class="prediction-label">建議停損價</span>
                                <span class="prediction-price negative">${(parseFloat(stock.price || stock.closePrice || 100) * 0.9).toFixed(2)}</span>
                                <span class="prediction-unit">TWD</span>
                            </div>
                            <div class="prediction-price-box">
                                <span class="prediction-label">目標價位</span>
                                <span class="prediction-price positive">${(parseFloat(stock.price || stock.closePrice || 100) * 1.15).toFixed(2)}</span>
                                <span class="prediction-unit">TWD</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Load TradingView Widget
        loadTradingViewWidget(pureCode);

        // Render related stocks graph
        renderRelatedStocksGraph(stock);

        // Setup toggle button event delegation for 存股派/大膽派
        setupAllocationToggle(stock);
    }

    openModal();
}

// ============================================
// Allocation Toggle (存股派/大膽派) Logic
// ============================================
function setupAllocationToggle(stock) {
    const toggleButtons = document.querySelectorAll('.toggle-btn');

    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            toggleButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const mode = btn.dataset.mode;
            const cautionText = document.getElementById('allocationCautionText');

            // Get allocation bar elements
            const stockBar = document.querySelector('.allocation-bar.stock');
            const bondBar = document.querySelector('.allocation-bar.bond');
            const cashBar = document.querySelector('.allocation-bar.cash');
            const otherBar = document.querySelector('.allocation-bar.other');

            // Get allocation value elements
            const valueElements = document.querySelectorAll('.allocation-value');

            if (mode === 'aggressive') {
                // 大膽派 - Aggressive allocation (90% stocks)
                if (stockBar) stockBar.style.width = '90%';
                if (bondBar) bondBar.style.width = '5%';
                if (cashBar) cashBar.style.width = '3%';
                if (otherBar) otherBar.style.width = '2%';

                if (valueElements[0]) valueElements[0].textContent = '90%';
                if (valueElements[1]) valueElements[1].textContent = '5%';
                if (valueElements[2]) valueElements[2].textContent = '3%';
                if (valueElements[3]) valueElements[3].textContent = '2%';

                if (cautionText) {
                    cautionText.textContent = '「大膽派」配置追求極致成長，適合風險承受度極高、能長期持有的投資者';
                }
            } else {
                // 存股派 - Conservative/Stock-saving allocation (60% stocks)
                const baseScore = stock?.score || 50;
                const stockPct = baseScore >= 70 ? 60 : baseScore >= 40 ? 50 : 40;
                const bondPct = baseScore >= 70 ? 25 : baseScore >= 40 ? 30 : 35;
                const cashPct = baseScore >= 70 ? 10 : baseScore >= 40 ? 15 : 20;
                const otherPct = 100 - stockPct - bondPct - cashPct;

                if (stockBar) stockBar.style.width = `${stockPct}%`;
                if (bondBar) bondBar.style.width = `${bondPct}%`;
                if (cashBar) cashBar.style.width = `${cashPct}%`;
                if (otherBar) otherBar.style.width = `${otherPct}%`;

                if (valueElements[0]) valueElements[0].textContent = `${stockPct}%`;
                if (valueElements[1]) valueElements[1].textContent = `${bondPct}%`;
                if (valueElements[2]) valueElements[2].textContent = `${cashPct}%`;
                if (valueElements[3]) valueElements[3].textContent = `${otherPct}%`;

                if (cautionText) {
                    cautionText.textContent = '若是以穩健收息為主「存股派」，適合不喜歡短期波動的投資者';
                }
            }
        });
    });
}

// ============================================
// Investment Type Quiz Logic
// ============================================

const quizQuestions = [
    {
        text: "當您的投資組合在一個月內下跌 20% 時，您的反應是？",
        options: [
            { text: "立即停損賣出，避免更大損失", score: 1 },
            { text: "感到焦慮，考慮是否該減碼", score: 2 },
            { text: "按兵不動，觀察市場變化", score: 3 },
            { text: "若是好標的，視為加碼良機", score: 4 }
        ]
    },
    {
        text: "您目前投資的主要目的是什麼？",
        options: [
            { text: "保本至上，不希望有任何虧損", score: 1 },
            { text: "產生穩定現金流（如股息、利息）", score: 2 },
            { text: "資產長期穩健增長，對抗通膨", score: 3 },
            { text: "追求短期高報酬，願意承擔波動", score: 4 }
        ]
    },
    {
        text: "除了日常緊急預備金，您擁有的投資資金預計可以閒置多久？",
        options: [
            { text: "隨時可能需要使用", score: 1 },
            { text: "1 ~ 3 年", score: 2 },
            { text: "3 ~ 5 年", score: 3 },
            { text: "5 年以上", score: 4 }
        ]
    },
    {
        text: "您對於「槓桿投資」（如融資、期貨）的看法？",
        options: [
            { text: "完全不考慮，風險太高", score: 1 },
            { text: "只有極少部分資金會嘗試", score: 2 },
            { text: "若有把握，會適度運用", score: 3 },
            { text: "經常使用，是放大獲利的工具", score: 4 }
        ]
    },
    {
        text: "假設有一檔新興科技股，預期獲利極高但可能歸零，您願意投入多少資金？",
        options: [
            { text: "0%，我只投資大公司", score: 1 },
            { text: "5% 以下，當作樂透", score: 2 },
            { text: "10-20%，看好產業前景", score: 3 },
            { text: "20% 以上，願意放手一博", score: 4 }
        ]
    },
    {
        text: "您過去的投資經驗主要集中在？",
        options: [
            { text: "定存、儲蓄險、貨幣型基金", score: 1 },
            { text: "債券、特別股、高股息 ETF", score: 2 },
            { text: "權值股、大盤型 ETF", score: 3 },
            { text: "中小型股、成長股、加密貨幣", score: 4 }
        ]
    },
    {
        text: "您認為理想的年化報酬率是多少？",
        options: [
            { text: "2-4% (略高於定存即可)", score: 1 },
            { text: "5-8% (穩定現金流)", score: 2 },
            { text: "8-15% (超越大盤)", score: 3 },
            { text: "15% 以上 (追求高成長)", score: 4 }
        ]
    },
    {
        text: "如果市場出現重大利空消息（如戰爭、疫情），您通常會？",
        options: [
            { text: "迅速出清持股轉現金", score: 1 },
            { text: "將資金轉往避險資產", score: 2 },
            { text: "維持既有定期定額扣款", score: 3 },
            { text: "積極尋找被錯殺的標的", score: 4 }
        ]
    },
    {
        text: "您多久檢視一次投資組合？",
        options: [
            { text: "每天，甚至隨時", score: 3 }, // 積極關注
            { text: "每週或每月", score: 3 },
            { text: "每季或半年", score: 2 },
            { text: "只要不缺錢就不太看", score: 1 } // 很保守或被動
        ]
    },
    {
        text: "最後，對於「高風險高報酬」這句話，您的直覺是？",
        options: [
            { text: "敬而遠之", score: 1 },
            { text: "需要仔細評估", score: 2 },
            { text: "可接受適度風險", score: 3 },
            { text: "興奮，這是獲利的來源", score: 4 }
        ]
    }
];

let quizState = {
    currentQuestion: 0,
    answers: [],
    inProgress: false
};

// Quiz Event Handlers
document.addEventListener('DOMContentLoaded', () => {
    // Add Quiz Trigger (e.g., in sidebar or floating button)
    // Currently relying on direct call or adding a button if UI allows

    // Setup Modal Close Logic
    const quizOverlay = document.getElementById('quizModalOverlay');
    const quizClose = document.getElementById('quizClose');

    if (quizClose) {
        quizClose.addEventListener('click', closeQuizModal);
    }

    if (quizOverlay) {
        quizOverlay.addEventListener('click', (e) => {
            if (e.target === quizOverlay) closeQuizModal();
        });
    }

    // Add Quiz Entry Button in Sidebar
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        const quizBtn = document.createElement('a');
        quizBtn.href = "#";
        quizBtn.className = 'nav-item';
        quizBtn.onclick = (e) => {
            e.preventDefault();
            openQuizModal();
        };
        quizBtn.innerHTML = `
            <span class="nav-icon">🧬</span>
            <span class="nav-text">投資測驗</span>
        `;
        navMenu.appendChild(quizBtn);
    }
});

function openQuizModal() {
    const overlay = document.getElementById('quizModalOverlay');
    if (overlay) {
        overlay.classList.add('active');
        resetQuiz();
    }
}

function closeQuizModal() {
    const overlay = document.getElementById('quizModalOverlay');
    if (overlay) overlay.classList.remove('active');
}

function resetQuiz() {
    quizState = {
        currentQuestion: 0,
        answers: [],
        inProgress: false
    };

    showStep('quizIntro');
}

function startQuiz() {
    quizState.inProgress = true;
    showStep('quizQuestionContainer');
    renderQuestion();
}

function showStep(stepId) {
    document.querySelectorAll('.quiz-step').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.quiz-step').forEach(el => el.classList.remove('active'));

    const step = document.getElementById(stepId);
    if (step) {
        step.classList.remove('hidden');
        step.classList.add('active');
    }
}

function renderQuestion() {
    const qData = quizQuestions[quizState.currentQuestion];

    // Update Progress
    const progress = ((quizState.currentQuestion + 1) / quizQuestions.length) * 100;
    document.getElementById('quizProgress').style.width = `${progress}%`;
    document.getElementById('qCurrent').textContent = quizState.currentQuestion + 1;

    // Update Text
    document.getElementById('qText').textContent = qData.text;

    // Generate Options
    const optionsContainer = document.getElementById('qOptions');
    optionsContainer.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];

    qData.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'quiz-option';
        div.innerHTML = `
            <div class="quiz-option-letter">${letters[idx]}</div>
            <div class="quiz-option-text">${opt.text}</div>
        `;
        div.onclick = () => submitAnswer(opt.score);
        optionsContainer.appendChild(div);
    });
}

function submitAnswer(score) {
    quizState.answers.push(score);

    if (quizState.currentQuestion < quizQuestions.length - 1) {
        quizState.currentQuestion++;
        // Fade out effect could be added here
        renderQuestion();
    } else {
        calculateResult();
    }
}

function calculateResult() {
    const totalScore = quizState.answers.reduce((a, b) => a + b, 0);
    const avgScore = totalScore / quizQuestions.length;

    let result = {
        type: '',
        icon: '',
        desc: '',
        tags: [],
        advice: ''
    };

    // 5 Types Logic (Score Range: 10 - 40)
    // 10-16: 保守型 (Conservative)
    // 17-22: 收息型 (Income Oriented)
    // 23-28: 價值型 (Value Investor)
    // 29-34: 穩健成長型 (Growth)
    // 35-40: 積極型 (Aggressive)

    if (totalScore <= 16) {
        result.type = '保守防禦型 (Conservative)';
        result.icon = '🛡️';
        result.desc = '您將資金安全視為首要任務，極度厭惡虧損。適合波動極低、保本為主的理財工具。';
        result.tags = ['#保本至上', '#低風險', '#定存愛好者'];
        result.advice = '建議配置：80% 定存/債券, 20% 防禦型股票 (如中華電)。避免單壓個股，優先考慮債券 ETF。';
    } else if (totalScore <= 22) {
        result.type = '穩健收息型 (Income)';
        result.icon = '🌳';
        result.desc = '您偏好現金流，喜歡看著戶頭定期有錢進來的感覺。對於股價波動有一定容忍度，但更在意配息。';
        result.tags = ['#現金流', '#高股息', '#存股族'];
        result.advice = '建議配置：60% 高股息 ETF (如 0056, 00878) + 金融股, 30% 債券, 10% 成長股。專注於殖利率 5% 以上標的。';
    } else if (totalScore <= 28) {
        result.type = '價值投資型 (Value)';
        result.icon = '💎';
        result.desc = '您願意花時間研究基本面，喜歡在股價被低估時買進。雖然不追求暴利，但期望資產穩健增值。';
        result.tags = ['#基本面', '#找便宜', '#長期持有'];
        result.advice = '建議配置：50% 權值股/市值型 ETF (0050), 30% 低基期績優股, 20% 現金保留加碼。適合使用「本益比」與「殖利率」作為進場依據。';
    } else if (totalScore <= 34) {
        result.type = '穩健成長型 (Growth)';
        result.icon = '🚀';
        result.desc = '您追求資產長期增長，願意承擔市場波動以換取較高報酬。相信時間與複利的力量。';
        result.tags = ['#複利效應', '#波段操作', '#趨勢交易'];
        result.advice = '建議配置：40% 科技成長股 (由 AI 分析推薦), 40% 大盤 ETF, 20% 衛星持股嘗試高報酬。可關注 SMC 訊號找尋波段買點。';
    } else {
        result.type = '積極冒險型 (Aggressive)';
        result.icon = '🦁';
        result.desc = '您擁有強大的風險承受力，追求倍數獲利。對於新科技、新趨勢充滿熱情，不怕短期劇烈震盪。';
        result.tags = ['#高風險高報酬', '#槓桿操作', '#少年股神'];
        result.advice = '建議配置：60% 小型成長股/動能股, 20% 槓桿型 ETF, 20% 核心持股。善用技術分析 (SMC) 精準抓取進出場點，嚴設停損。';
    }

    // Render Result
    document.getElementById('resultType').textContent = result.type;
    document.getElementById('resultIcon').textContent = result.icon;
    document.getElementById('resultDesc').textContent = result.desc;
    document.getElementById('resultAdvice').textContent = result.advice;

    const tagsContainer = document.getElementById('resultTags');
    tagsContainer.innerHTML = result.tags.map(tag => `<span class="result-tag">${tag}</span>`).join('');

    showStep('quizResult');
}

async function loadTradingViewWidget(symbol) {
    const container = document.getElementById('tradingview_chart');
    const loading = document.getElementById('tvLoading');

    if (!container) return;

    const cleanCode = symbol.replace('.TW', '').replace('.TWO', '');

    // === Strategy 1: Try static JSON first ===
    try {
        const url = `data/history/${cleanCode}.json`;
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            const historyData = data.daily || [];

            if (historyData.length > 0) {
                const chartData = historyData.map(d => ({
                    date: new Date(d.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
                    close: d.close,
                    high: d.high,
                    low: d.low
                }));

                renderSelfBuiltChart(container, chartData, symbol);
                if (loading) loading.style.display = 'none';
                console.log(`📊 Chart loaded from static JSON for ${cleanCode}`);
                return;
            }
        }
    } catch (e) {
        console.log(`Static JSON not available for ${cleanCode}, trying API...`);
    }

    // === Strategy 2: Handle USDT (Crypto) via Binance API ===
    if (symbol.endsWith('USDT')) {
        try {
            const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=365`;
            const response = await fetch(binanceUrl);
            const data = await response.json();

            const chartData = data.map(d => ({
                date: new Date(d[0]).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4])
            }));

            renderSelfBuiltChart(container, chartData, symbol);
            if (loading) loading.style.display = 'none';
            return;
        } catch (e) {
            console.warn('Binance API failed:', e);
        }
    }

    // === Strategy 3: Try Yahoo Finance via CORS proxy ===
    try {
        const twSymbol = `${cleanCode}.TW`;
        const url = `${PROXY_BASE_URL}https://query1.finance.yahoo.com/v8/finance/chart/${twSymbol}?interval=1d&range=6mo`;

        if (loading) loading.innerHTML = '<span style="color: var(--accent-yellow);">📊 即時抓取資料中...</span>';

        const response = await fetchWithCORS(url);
        const data = await response.json();

        if (data.chart?.result?.[0]) {
            const result = data.chart.result[0];
            const timestamps = result.timestamp || [];
            const quotes = result.indicators?.quote?.[0] || {};

            const chartData = timestamps.map((t, i) => ({
                date: new Date(t * 1000).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
                close: quotes.close?.[i] || 0,
                high: quotes.high?.[i] || 0,
                low: quotes.low?.[i] || 0
            })).filter(d => d.close > 0);

            if (chartData.length > 0) {
                renderSelfBuiltChart(container, chartData, symbol);
                if (loading) loading.style.display = 'none';
                console.log(`📊 Chart loaded from Yahoo API for ${cleanCode}`);
                return;
            }
        }
    } catch (e) {
        console.warn('Yahoo Finance API failed:', e);
    }

    // === Strategy 4: Final fallback - simulated data ===
    console.log(`📊 Using simulated data for ${cleanCode}`);
    if (loading) loading.innerHTML = '<span style="color: var(--accent-yellow);">📊 顯示模擬趨勢...</span>';
    setTimeout(() => renderFallbackChart(container, symbol), 500);
}


function renderSelfBuiltChart(container, chartData, symbol) {
    // Destroy existing chart
    if (analysisChart) {
        analysisChart.destroy();
        analysisChart = null;
    }

    // Create canvas
    container.innerHTML = '<canvas id="selfBuiltChart" style="width:100%;height:100%;"></canvas>';
    const ctx = document.getElementById('selfBuiltChart');
    if (!ctx) return;

    const labels = chartData.map(d => d.date);
    const opens = chartData.map(d => d.open || d.close);
    const highs = chartData.map(d => d.high || d.close);
    const lows = chartData.map(d => d.low || d.close);
    const closes = chartData.map(d => d.close);

    // Calculate MAs
    const ma5 = calculateMA(closes, 5);
    const ma20 = calculateMA(closes, 20);

    // Create candlestick data for floating bar chart
    // Each bar goes from min(open, close) to max(open, close)
    const candleData = chartData.map((d, i) => {
        const open = opens[i];
        const close = closes[i];
        return [Math.min(open, close), Math.max(open, close)];
    });

    // Color each candle based on direction
    const candleColors = chartData.map((d, i) => {
        return closes[i] >= opens[i] ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)';
    });

    const candleBorders = chartData.map((d, i) => {
        return closes[i] >= opens[i] ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)';
    });

    // Create wick data (high-low range as error bars style)
    // We'll use a separate line dataset for wicks
    const wickData = chartData.map((d, i) => ({
        x: i,
        y: (highs[i] + lows[i]) / 2,
        high: highs[i],
        low: lows[i]
    }));

    analysisChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'K線',
                    data: candleData,
                    backgroundColor: candleColors,
                    borderColor: candleBorders,
                    borderWidth: 1,
                    borderSkipped: false,
                    barPercentage: 0.7,
                    categoryPercentage: 0.9
                },
                {
                    label: 'MA5',
                    data: ma5,
                    type: 'line',
                    borderColor: '#f59e0b',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.3,
                    fill: false,
                    order: 0
                },
                {
                    label: 'MA20',
                    data: ma20,
                    type: 'line',
                    borderColor: '#3b82f6',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.3,
                    fill: false,
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        usePointStyle: true,
                        filter: (item) => item.text !== 'K線'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(26, 26, 36, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            const i = context.dataIndex;
                            if (context.dataset.label === 'K線') {
                                const o = opens[i]?.toFixed(2) || '-';
                                const h = highs[i]?.toFixed(2) || '-';
                                const l = lows[i]?.toFixed(2) || '-';
                                const c = closes[i]?.toFixed(2) || '-';
                                return [`開: ${o}`, `高: ${h}`, `低: ${l}`, `收: ${c}`];
                            }
                            return `${context.dataset.label}: ${context.parsed.y?.toFixed(2) || '-'}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#64748b', font: { size: 10 } },
                    position: 'right'
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        },
        plugins: [{
            id: 'candlestickWicks',
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                const xAxis = chart.scales.x;
                const yAxis = chart.scales.y;
                const meta = chart.getDatasetMeta(0); // K線 dataset

                meta.data.forEach((bar, i) => {
                    const high = highs[i];
                    const low = lows[i];
                    const open = opens[i];
                    const close = closes[i];

                    if (high == null || low == null) return;

                    const x = bar.x;
                    const yHigh = yAxis.getPixelForValue(high);
                    const yLow = yAxis.getPixelForValue(low);
                    const yBody = yAxis.getPixelForValue(Math.max(open, close));

                    // Draw wick (high-low line)
                    ctx.save();
                    ctx.beginPath();
                    ctx.strokeStyle = close >= open ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)';
                    ctx.lineWidth = 1;
                    ctx.moveTo(x, yHigh);
                    ctx.lineTo(x, yLow);
                    ctx.stroke();
                    ctx.restore();
                });
            }
        }]
    });
}


function renderFallbackChart(container, symbol) {
    // Generate simulated OHLC data when API fails
    const today = new Date();
    const chartData = [];
    let price = 100 + Math.random() * 50;

    for (let i = 60; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Generate realistic OHLC data
        const volatility = 2 + Math.random() * 2;
        const open = price;
        const direction = Math.random() - 0.48;
        const close = open + direction * volatility;
        const high = Math.max(open, close) + Math.random() * volatility * 0.5;
        const low = Math.min(open, close) - Math.random() * volatility * 0.5;

        chartData.push({
            date: date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
            open: Math.max(open, 20),
            high: Math.max(high, 20),
            low: Math.max(low, 20),
            close: Math.max(close, 20)
        });

        price = close;
    }

    renderSelfBuiltChart(container, chartData, symbol);
    const loading = document.getElementById('tvLoading');
    if (loading) loading.style.display = 'none';
}


// Format large numbers
function formatNumber(num) {
    const n = parseFloat(String(num).replace(/,/g, ''));
    if (isNaN(n)) return num;
    if (n >= 100000000) return (n / 100000000).toFixed(2) + '億';
    if (n >= 10000) return (n / 10000).toFixed(0) + '萬';
    return n.toLocaleString();
}

// Generate dividend bars for AI analysis section
function generateDividendBars() {
    const years = ['2020', '2021', '2022', '2023', '2024'];
    const cashDividends = [1.2, 1.5, 2.0, 1.8, 2.2].map(v => v * (0.8 + Math.random() * 0.4));
    const stockDividends = [0.3, 0.2, 0.5, 0.4, 0.3].map(v => v * (0.5 + Math.random() * 1));

    return years.map((year, i) => {
        const cashWidth = Math.min(cashDividends[i] * 20, 80);
        const stockWidth = Math.min(stockDividends[i] * 20, 40);
        return `
            <div class="dividend-bar-row">
                <span class="dividend-year">${year}</span>
                <div class="dividend-bar-group">
                    <div class="dividend-bar cash" style="width: ${cashWidth}%"></div>
                    <div class="dividend-bar stock" style="width: ${stockWidth}%"></div>
                </div>
                <span class="dividend-value">${cashDividends[i].toFixed(2)}</span>
            </div>
        `;
    }).join('');
}

// Render related stocks graph using simple SVG
function renderRelatedStocksGraph(stock) {
    const container = document.getElementById('relatedStocksGraph');
    if (!container) return;

    // Get related stocks from same sector
    const sector = stock.sector || '其他';
    const relatedStocks = state.allStocks
        .filter(s => s.sector === sector && s.code !== stock.code)
        .slice(0, 6)
        .map(s => ({
            code: s.code.replace('.TW', ''),
            name: s.name,
            beta: (Math.random() * 2 - 0.5).toFixed(2) // Simulated beta
        }));

    // Create SVG force-directed graph
    const width = container.offsetWidth || 400;
    const height = 280;
    const centerX = width / 2;
    const centerY = height / 2;

    let svg = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}">`;

    // Draw connections
    relatedStocks.forEach((rs, i) => {
        const angle = (i / relatedStocks.length) * Math.PI * 2;
        const radius = 100;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const beta = parseFloat(rs.beta);
        const color = beta > 1 ? '#22c55e' : beta > 0.5 ? '#f59e0b' : beta > 0 ? '#3b82f6' : '#ef4444';
        const dashArray = beta < 0 ? '5,5' : '';

        svg += `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" 
                  stroke="${color}" stroke-width="2" stroke-dasharray="${dashArray}" opacity="0.6"/>`;
    });

    // Draw center node (main stock)
    svg += `<circle cx="${centerX}" cy="${centerY}" r="35" fill="#f59e0b"/>`;
    svg += `<text x="${centerX}" y="${centerY - 5}" text-anchor="middle" fill="#0a0a0f" font-size="10" font-weight="bold">${stock.name?.slice(0, 4) || ''}</text>`;
    svg += `<text x="${centerX}" y="${centerY + 10}" text-anchor="middle" fill="#0a0a0f" font-size="9">(${stock.code.replace('.TW', '')})</text>`;

    // Draw related nodes
    relatedStocks.forEach((rs, i) => {
        const angle = (i / relatedStocks.length) * Math.PI * 2;
        const radius = 100;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const beta = parseFloat(rs.beta);
        const color = beta > 1 ? '#22c55e' : beta > 0.5 ? '#f59e0b' : beta > 0 ? '#3b82f6' : '#ef4444';

        svg += `<circle cx="${x}" cy="${y}" r="28" fill="${color}"/>`;
        svg += `<text x="${x}" y="${y - 3}" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">${rs.name?.slice(0, 3) || ''}</text>`;
        svg += `<text x="${x}" y="${y + 10}" text-anchor="middle" fill="#fff" font-size="8">(${rs.code})</text>`;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
}

function toggleMoreDetails() {
    const smcSection = document.getElementById('smcSection');
    if (smcSection) {
        smcSection.classList.toggle('expanded');
    }
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
    // 開啟深度分析（不再導向 TradingView）
    showAnalysis(code);
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

// === Crypto Market Logic ===
async function loadCryptoMarket() {
    const grid = document.getElementById('cryptoGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading-spinner"></div>';

    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT'];

    try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const allData = await response.json();

        const relevantData = allData.filter(d => symbols.includes(d.symbol));

        grid.innerHTML = relevantData.map(coin => {
            const price = parseFloat(coin.lastPrice).toLocaleString();
            const change = parseFloat(coin.priceChangePercent).toFixed(2);
            const isUp = parseFloat(coin.priceChangePercent) >= 0;
            const symbol = coin.symbol;

            return `
                <div class="market-card" onclick="openCryptoModal('${symbol}')">
                    <div class="market-info">
                        <div class="market-title">
                            <span class="market-icon">🪙</span>
                            ${symbol.replace('USDT', '')}
                        </div>
                        <div class="market-price">$${price}</div>
                        <div class="market-change ${isUp ? 'trend-up' : 'trend-down'}">
                            ${isUp ? '▲' : '▼'} ${change}%
                        </div>
                    </div>
                </div>
             `;
        }).join('');
    } catch (e) {
        console.error('Crypto fetch failed', e);
        grid.innerHTML = '<p>載入失敗，請稍後再試</p>';
    }
}

window.openCryptoModal = function (symbol) {
    const fakeStock = {
        code: symbol,
        name: symbol.replace('USDT', ''),
        price: 'Loading...',
        market: 'Crypto',
        sector: '加密貨幣',
        analysis: 'Binance Live Data',
        tags: [{ label: 'Crypto', type: 'smc-ob' }]
    };

    // Create Modal Content
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const overlay = document.getElementById('modalOverlay');

    modalTitle.innerHTML = `${fakeStock.name} (Binance)`;
    modalBody.innerHTML = `
        <div class="modal-grid">
            <div class="modal-section full-width">
                <h4>📊 即時走勢 (Binance)</h4>
                <div class="chart-container" id="tradingview_chart" style="height: 400px; position: relative;">
                    <div class="tv-loading" id="tvLoading">
                        <div class="loading-spinner"></div>
                        <span>載入圖表數據中...</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    overlay.classList.add('active');
    loadTradingViewWidget(symbol);
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
