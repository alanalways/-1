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
const initApp = async () => {
    try {
        console.log('🚀 Discover Latest initializing...');

        // Setup event listeners
        setupEventListeners();
        updateLoadingProgress(10, '初始化完成');

        // Load data
        updateLoadingProgress(20, '載入市場數據...');
        await loadMarketData();
        updateLoadingProgress(60, '分析 SMC 訊號...');

        // Render UI immediately (First Contentful Paint)
        updateLoadingProgress(80, '渲染界面...');
        renderDashboard();

        // Load global markets in background (Non-blocking)
        updateLoadingProgress(90, '載入國際市場...');
        // 不使用 await，讓它在背景跑，或者使用 await 但因為 UI 已渲染所以沒差 (用戶說要放到 renderDashboard 之後)
        // 但為了確保進度條正確，這裡還是 await 比較好，因為 renderDashboard 已經跑了，使用者看得到東西
        await loadGlobalMarkets();

        // Hide loading
        updateLoadingProgress(100, '完成！');
        setTimeout(hideLoading, 300);

        // Setup auto-refresh during Taiwan trading hours (9:00-13:30)
        setupAutoRefresh();

    } catch (error) {
        console.error('❌ App initialization failed:', error);
        // 即使初始化失敗也要隱藏 Loading 並顯示錯誤
        hideLoading();
        showToast('初始化失敗: ' + error.message, 'error');
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

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
                // [修改] 改用本地 Server Proxy (/api/yahoo)
                const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(item.symbol)}?interval=1d&range=2d`;
                const response = await fetch(url); // 直接使用 fetch，無需 fetchWithCORS
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

// === CORS Proxy Helper ===
async function fetchWithCORS(url) {
    // 判斷是否為 Yahoo Finance URL
    if (url.includes('yahoo.com')) {
        // 使用我們自己的 Server Proxy
        const targetPath = new URL(url).pathname;
        const query = new URL(url).search;
        return fetch(`/api/yahoo${targetPath}${query}`);
    }

    // 判斷是否為 TWSE URL
    if (url.includes('twse.com.tw')) {
        const targetPath = new URL(url).pathname;
        const query = new URL(url).search;
        return fetch(`/api/twse${targetPath}${query}`);
    }

    // 其他來源使用 codetabs (備用)
    try {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy?quest=';
        const targetUrl = `${proxyUrl}${encodeURIComponent(url)}`;
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
        return response;
    } catch (error) {
        console.error('CORS Fetch Error:', error);
        throw error;
    }
}


// === Stock Card Factory ===

function createStockCard(stock, index) {
    const isFavorited = state.watchlist.includes(stock.code);
    const changeClass = stock.changePercent > 0 ? 'positive' : (stock.changePercent < 0 ? 'negative' : '');

    // [新增] 自動補全 SMC Tags (若 patterns 有值但 tags 沒寫)
    let displayTags = [...(stock.tags || [])];
    if (stock.patterns) {
        if (stock.patterns.ob && !displayTags.find(t => t.type === 'smc-ob'))
            displayTags.push({ type: 'smc-ob', label: 'OB 訂單塊' });
        if (stock.patterns.fvg && !displayTags.find(t => t.type === 'smc-fvg'))
            displayTags.push({ type: 'smc-fvg', label: 'FVG 缺口' });
        if (stock.patterns.sweep && !displayTags.find(t => t.type === 'smc-liq'))
            displayTags.push({ type: 'smc-liq', label: '流動性掃取' });
    }

    // Generate tags HTML
    const tagsHtml = displayTags.map(tag => {
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
        <div class="stock-card" data-stock-code="${stock.code}" style="animation-delay: ${index * 0.05}s">
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

// === Data Loading ===
// [修改] 改為呼叫 Server API
async function loadMarketData() {
    try {
        state.isLoading = true;

        console.log('📡 正在從伺服器 API 請求數據...');

        // 1. 平行請求股票列表與市場摘要
        const [stocksRes, marketRes] = await Promise.all([
            fetch('/api/data/stocks'),
            fetch('/api/data/market')
        ]);

        let stocks = [];
        let marketSummary = null;

        // 2. 處理股票數據
        if (stocksRes.ok) {
            const data = await stocksRes.json();
            // 轉換資料格式以符合前端需求
            stocks = data.map(s => ({
                code: s.code,
                name: s.name,
                closePrice: parseFloat(s.close_price) || 0,
                openPrice: parseFloat(s.open_price) || 0,
                highPrice: parseFloat(s.high_price) || 0,
                lowPrice: parseFloat(s.low_price) || 0,
                volume: parseInt(s.volume) || 0,
                changePercent: parseFloat(s.change_percent) || 0,
                signal: s.signal || 'NEUTRAL',
                score: s.score || 0,
                market: s.market || '上市',
                sector: s.sector || '其他',
                peRatio: s.pe_ratio,
                analysis: s.analysis,
                patterns: s.patterns
            }));
            console.log(`✅ 成功載入 ${stocks.length} 檔股票`);
        } else if (stocksRes.status === 404) {
            // [新增] 處理空資料庫狀態 (Cold Start)
            console.warn('⚠️ 資料庫為空，系統可能正在初始化...');
            updateLoadingProgress(50, '系統初次啟動，正在抓取最新數據... (每 10 秒重試)');

            // 等待 10 秒後重試 Polling
            await new Promise(resolve => setTimeout(resolve, 10000));
            return loadMarketData(); // 遞迴呼叫
        } else {
            console.warn('無法載入股票數據');
        }

        // 3. 處理大盤摘要
        if (marketRes.ok) {
            const data = await marketRes.json();
            marketSummary = data;
            // 如果 data_json 是字串就 parse，如果是物件就直接用
            if (marketSummary && typeof marketSummary.data_json === 'string') {
                marketSummary.data_json = JSON.parse(marketSummary.data_json);
            }
        }

        // 4. 更新狀態
        state.marketData = marketSummary?.data_json || {};
        state.allStocks = stocks;
        state.filteredStocks = [...state.allStocks];

        // 5. 更新最後更新時間 UI (強制使用當前時間，確保使用者看到變化)
        if (elements.lastUpdated) {
            const nowStr = new Date().toLocaleString('zh-TW');
            elements.lastUpdated.textContent = `${nowStr} (來源: 資料庫 API)`;
            elements.lastUpdated.style.color = '#10b981'; // 綠色提示更新成功
            setTimeout(() => elements.lastUpdated.style.color = '', 2000);
        }

        // 6. 啟動盤中即時更新
        if (stocks.length > 0 && isTaiwanTradingHours()) {
            setTimeout(() => updateVisiblePrices(), 2000);
        }

        state.isLoading = false;
        return stocks.length > 0;

    } catch (error) {
        console.error('Data Load Error:', error);
        showToast('無法連接伺服器: ' + error.message, 'error');
        state.isLoading = false;
        return false;
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
                // [修改] 改用本地 Server Proxy (/api/yahoo)
                const response = await fetch(`/api/yahoo/v8/finance/chart/${yahooSymbol}`);
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
    if (!container) return;

    // Fallback: 如果後端沒有提供 marketIntelligence，則前端即時計算
    let intelligence = state.marketData?.marketIntelligence;
    if (!Array.isArray(intelligence) || intelligence.length === 0) {
        // 使用前端數據生成
        intelligence = generateMarketIntelligenceFallback();
    }

    if (!intelligence || intelligence.length === 0) return;

    container.innerHTML = intelligence.map(item => `
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

// [新增] 前端即時生成市場概覽數據 (Fallback)
function generateMarketIntelligenceFallback() {
    const stocks = state.allStocks || [];
    if (stocks.length === 0) return [];

    // 1. 統計多空
    const bullish = stocks.filter(s => s.signal === 'BULLISH').length;
    const bearish = stocks.filter(s => s.signal === 'BEARISH').length;

    // 2. 計算平均漲跌
    let totalChange = 0;
    stocks.forEach(s => totalChange += parseFloat(s.changePercent || 0));
    const avgChange = (totalChange / stocks.length).toFixed(2);

    // 3. 尋找強勢產業 (排除 Generic)
    const sectorStats = {};
    stocks.forEach(s => {
        const sector = (s.sector || '其他').trim();
        if (!sectorStats[sector]) sectorStats[sector] = { sum: 0, count: 0 };
        sectorStats[sector].sum += parseFloat(s.changePercent || 0);
        sectorStats[sector].count++;
    });

    let bestSector = { name: '分析中', avg: -999 };
    const ignoredSectors = ['其他', 'ETF', '受益證券', '存託憑證'];

    // First pass: Try to find best non-ignored sector
    for (const [name, stats] of Object.entries(sectorStats)) {
        if (ignoredSectors.includes(name) && Object.keys(sectorStats).length > 1) continue;
        const avg = stats.sum / stats.count;
        if (avg > bestSector.avg) bestSector = { name, avg };
    }

    // If still defaults (e.g. all ignored), try again without filter
    if (bestSector.avg === -999) {
        for (const [name, stats] of Object.entries(sectorStats)) {
            const avg = stats.sum / stats.count;
            if (avg > bestSector.avg) bestSector = { name, avg };
        }
    }

    // Formatting Logic
    let sectorTitle = `${bestSector.name || '電子'} 最強`;
    let sectorContent = `該板塊平均漲幅 ${bestSector.avg > -900 ? bestSector.avg.toFixed(2) : 0}%`;

    // Handle Flat Market (Zero change)
    if (Math.abs(bestSector.avg) < 0.01 || bestSector.avg === -999) {
        sectorTitle = '市場觀望中';
        sectorContent = '各產業平均漲跌幅持平 (0.00%)';
    }

    // 4. 國際市場 (從 raw 或暫存取)
    const indices = state.marketData?.raw?.usIndices || [];
    const dji = indices.find(i => i.symbol === '^DJI' || i.symbol === 'DJI') || { changePercent: '--' };
    const ndx = indices.find(i => i.symbol === '^IXIC' || i.symbol === 'NASDAQ') || { changePercent: '--' };

    return [
        {
            icon: '📊',
            category: '全市場掃描',
            title: `共掃描 ${stocks.length} 檔`,
            content: `看多 ${bullish} 檔 • 看空 ${bearish} 檔\n平均漲跌 ${avgChange}%`
        },
        {
            icon: '🔥',
            category: '熱門產業',
            title: sectorTitle,
            content: sectorContent
        },
        {
            icon: '🌍',
            category: '國際市場',
            title: '美股連動',
            content: `道瓊 ${dji.changePercent}% | 那斯達克 ${ndx.changePercent}%`
        },
        {
            icon: '🤖',
            category: 'AI 觀點',
            title: bullish > bearish ? '多頭架構' : '空方主導',
            content: `目前 ${bullish > bearish ? '多方' : '空方'} 佔優，建議順勢操作。`
        }
    ];
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
        const beforeCount = stocks.length;
        switch (state.currentFilter) {
            case 'bullish':
                stocks = stocks.filter(s =>
                    s.signal?.toUpperCase() === 'BULLISH' ||
                    parseFloat(s.changePercent) > 3 // 漲幅 > 3% 也算看多
                );
                break;
            case 'bearish':
                stocks = stocks.filter(s =>
                    s.signal?.toUpperCase() === 'BEARISH' ||
                    parseFloat(s.changePercent) < -3 // 跌幅 > 3% 也算看空
                );
                break;
            case 'smc':
                stocks = stocks.filter(s =>
                    s.patterns?.ob || s.patterns?.fvg || s.patterns?.sweep ||
                    (s.score && s.score >= 70) // SMC 評分 >= 70 也納入
                );
                break;
        }
        console.log(`🎯 篩選 [${state.currentFilter}]: ${beforeCount} → ${stocks.length} 檔`);
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
    visibleStockCount = 50; // [新增] 重置分頁計數
    renderStockCards();
}

// [新增] 分頁狀態
let visibleStockCount = 50;
const STOCK_BATCH_SIZE = 50;

function loadMoreStocks() {
    visibleStockCount += STOCK_BATCH_SIZE;
    renderStockCards(true); // true = append mode (not used here, we re-render slice)
}

function renderStockCards() {
    const container = elements.stockCards;
    if (!container) return;

    const totalStocks = state.filteredStocks || [];

    // Update count
    if (elements.stockCount) {
        elements.stockCount.textContent = `顯示 ${Math.min(visibleStockCount, totalStocks.length)} / ${totalStocks.length} 檔`;
    }

    if (totalStocks.length === 0) {
        container.innerHTML = `
            <div class="watchlist-empty">
                <div class="empty-icon">🔍</div>
                <p>沒有符合條件的股票</p>
                <span>試試調整篩選條件</span>
            </div>
        `;
        return;
    }

    // [優化] 分頁渲染：只渲染前 visibleStockCount 筆
    // 當搜尋時，重置顯示數量 (這部分邏輯放在 applyFiltersAndSort)
    const visibleStocks = totalStocks.slice(0, visibleStockCount);

    container.innerHTML = visibleStocks.map((stock, index) => createStockCard(stock, index)).join('');

    // [新增] "載入更多" 按鈕
    if (visibleStocks.length < totalStocks.length) {
        const loadMoreContainer = document.createElement('div');
        loadMoreContainer.className = 'load-more-container';
        loadMoreContainer.style.textAlign = 'center';
        loadMoreContainer.style.marginTop = '20px';

        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'btn primary';
        loadMoreBtn.innerHTML = `👇 載入更多 (${totalStocks.length - visibleStocks.length} 檔)`;
        loadMoreBtn.onclick = () => {
            loadMoreBtn.textContent = '載入中...';
            // 使用 setTimeout 讓 UI 先更新 Loading 文字
            setTimeout(() => {
                visibleStockCount += STOCK_BATCH_SIZE;
                renderStockCards();
            }, 50);
        };

        loadMoreContainer.appendChild(loadMoreBtn);
        container.appendChild(loadMoreContainer);
    }

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

    // Add click event to card
    container.querySelectorAll('.stock-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Prevent click if clicking button inside card
            if (e.target.closest('.action-btn')) return;
            const code = card.dataset.stockCode;
            showAnalysis(code); // Changed from showStockDetail to showAnalysis for consistency
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
        <div class="stock-card" data-stock-code="${stock.code}" style="animation-delay: ${index * 0.05}s">
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

    // [修復] 綁定按鈕事件 - 這是之前缺失的部分
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

    // 卡片點擊事件
    container.querySelectorAll('.stock-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.action-btn')) return;
            const code = card.dataset.stockCode;
            showAnalysis(code);
        });
    });
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
    const icon = btn.querySelector('.btn-icon') || btn;
    const index = state.watchlist.indexOf(code);
    const isAdding = index === -1;

    if (isAdding) {
        state.watchlist.push(code);
        btn.classList.add('favorited');
        if (icon) icon.innerHTML = '⭐';
        showToast(`已加入自選: ${code}`);
    } else {
        state.watchlist = state.watchlist.filter(c => c !== code);
        btn.classList.remove('favorited');
        if (icon) icon.innerHTML = '☆';
        showToast(`已移除自選: ${code}`);

        // [修復] 如果在自選清單頁面，立即重新渲染整個清單以確保同步
        if (state.currentPage === 'watchlist') {
            console.log('🔄 Watchlist item removed, refreshing list...');
            // 使用 renderWatchlist() 而非手動移除 DOM，確保 Empty State 正確顯示
            renderWatchlist();
        }
    }

    // Save to localStorage
    localStorage.setItem('watchlist', JSON.stringify(state.watchlist));

    // Update dashboard buttons if visible
    document.querySelectorAll(`.action-btn[data-action="favorite"][data-code="${code}"]`).forEach(otherBtn => {
        if (otherBtn !== btn) {
            otherBtn.classList.toggle('favorited', isAdding);
            const otherIcon = otherBtn.querySelector('.btn-icon') || otherBtn;
            if (otherIcon) otherIcon.innerHTML = isAdding ? '⭐' : '☆';
        }
    });
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
                            <div class="info-value">${Math.floor(stock.volume / 1000).toLocaleString()}</div>
                            <div class="info-unit">張</div>
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

        // [重要] 延遲綁定事件，確保 DOM 元素已完全渲染
        setTimeout(() => {
            // Setup toggle button event delegation for 存股派/大膽派
            setupAllocationToggle(stock);

            // Setup AI prediction dropdown event handlers
            setupPredictionControls(stock);

            // Setup AI 介紹股簡報按鈕 (Gemini API)
            setupAIAnalysisButton(stock);

            // [新增] K 線時間範圍下拉選單連動
            const chartTimeframe = document.getElementById('chartTimeframe');
            if (chartTimeframe) {
                chartTimeframe.addEventListener('change', () => {
                    const timeframe = chartTimeframe.value;
                    console.log(`📊 切換 K 線時間範圍: ${timeframe}`);
                    loadTradingViewWidget(pureCode, timeframe);
                });
            }
        }, 100);
    }

    openModal();
}

// ============================================
// AI Prediction Controls (AI 進場價位預測)
// ============================================
function setupPredictionControls(stock) {
    const techniqueSelect = document.getElementById('predictionTechnique');
    const aiTypeSelect = document.getElementById('predictionAI');

    if (!techniqueSelect || !aiTypeSelect) return;

    const updatePrediction = () => {
        const technique = techniqueSelect.value;
        const aiType = aiTypeSelect.value;
        const basePrice = parseFloat(stock.price || stock.closePrice || 100);

        // 根據技術類型計算不同的進場價位
        let entryMultiplier = 0.95;
        let stopLossMultiplier = 0.90;
        let targetMultiplier = 1.15;

        switch (technique) {
            case 'sma':
                entryMultiplier = 0.97;
                stopLossMultiplier = 0.92;
                targetMultiplier = 1.12;
                break;
            case 'bollinger':
                entryMultiplier = 0.93;
                stopLossMultiplier = 0.88;
                targetMultiplier = 1.18;
                break;
            case 'fibonacci':
                entryMultiplier = 0.382 + 0.58; // 61.8% retracement
                stopLossMultiplier = 0.85;
                targetMultiplier = 1.20;
                break;
        }

        // 根據 AI 類型調整
        if (aiType === 'aggressive') {
            entryMultiplier += 0.02;
            stopLossMultiplier += 0.03;
            targetMultiplier += 0.05;
        } else if (aiType === 'conservative') {
            entryMultiplier -= 0.02;
            stopLossMultiplier -= 0.02;
            targetMultiplier -= 0.03;
        }

        // 更新 DOM
        const priceBoxes = document.querySelectorAll('.prediction-price');
        if (priceBoxes[0]) priceBoxes[0].textContent = (basePrice * entryMultiplier).toFixed(2);
        if (priceBoxes[1]) priceBoxes[1].textContent = (basePrice * stopLossMultiplier).toFixed(2);
        if (priceBoxes[2]) priceBoxes[2].textContent = (basePrice * targetMultiplier).toFixed(2);

        console.log(`🎯 AI 預測更新: ${technique} + ${aiType} → Entry: ${(basePrice * entryMultiplier).toFixed(2)}`);
    };

    techniqueSelect.addEventListener('change', updatePrediction);
    aiTypeSelect.addEventListener('change', updatePrediction);
}

// ============================================
// AI 介紹股簡報 (Gemini API 整合)
// ============================================
function setupAIAnalysisButton(stock) {
    const btn = document.getElementById('aiAnalysisBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ 分析中...';
        btn.disabled = true;

        try {
            const params = new URLSearchParams({
                code: stock.code,
                name: stock.name || '',
                price: stock.closePrice || stock.price || '',
                sector: stock.sector || '',
                changePercent: stock.changePercent || '',
                score: stock.score || 50,
                signal: stock.signal || 'NEUTRAL'
            });

            const response = await fetch(`/api/ai-analysis?${params}`);
            const data = await response.json();

            if (data.success) {
                // 建立或更新 AI 結果區域
                let resultDiv = document.getElementById('aiAnalysisResult');
                if (!resultDiv) {
                    resultDiv = document.createElement('div');
                    resultDiv.id = 'aiAnalysisResult';
                    resultDiv.className = 'ai-analysis-result';
                    // 插入到 AI 區塊上方
                    const aiSection = document.querySelector('.ai-analysis-section');
                    if (aiSection) {
                        aiSection.insertBefore(resultDiv, aiSection.firstChild.nextSibling);
                    }
                }

                resultDiv.innerHTML = `
                    <div class="ai-result-header">
                        <span class="ai-result-icon">🤖</span>
                        <span class="ai-result-title">Gemini AI 分析</span>
                        <span class="ai-result-model">${data.model}</span>
                    </div>
                    <div class="ai-result-content">${data.analysis.replace(/\n/g, '<br>')}</div>
                `;

                console.log(`✅ AI 分析完成 (${data.model}):`, data.stockCode);
            } else {
                throw new Error(data.error || 'AI 分析失敗');
            }
        } catch (error) {
            console.error('AI 分析錯誤:', error);
            alert(`AI 分析失敗: ${error.message}`);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
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

async function loadTradingViewWidget(symbol, timeframe = '1Y') {
    const container = document.getElementById('tradingview_chart');
    const loading = document.getElementById('tvLoading');

    if (!container) return;

    const cleanCode = symbol.replace('.TW', '').replace('.TWO', '');

    // [新增] 時間範圍對照表
    const timeframeToRange = {
        '1M': { yahoo: '1mo', days: 30 },
        '3M': { yahoo: '3mo', days: 90 },
        '1Y': { yahoo: '1y', days: 365 },
        '5Y': { yahoo: '5y', days: 1825 },
        'ALL': { yahoo: 'max', days: 9999 }
    };
    const range = timeframeToRange[timeframe] || timeframeToRange['1Y'];

    // === Strategy 1: Try static JSON first ===
    try {
        const url = `data/history/${cleanCode}.json`;
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            let historyData = data.daily || [];

            // [新增] 根據時間篩選資料
            if (historyData.length > range.days) {
                historyData = historyData.slice(-range.days);
            }

            if (historyData.length > 0) {
                const chartData = historyData.map(d => ({
                    date: new Date(d.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
                    close: d.close,
                    high: d.high,
                    low: d.low
                }));

                renderSelfBuiltChart(container, chartData, symbol);
                if (loading) loading.style.display = 'none';
                console.log(`📊 Chart loaded from static JSON for ${cleanCode} (${timeframe})`);
                return;
            }
        }
    } catch (e) {
        console.log(`Static JSON not available for ${cleanCode}, trying API...`);
    }

    // === Strategy 2: Handle USDT (Crypto) via Binance API ===
    if (symbol.endsWith('USDT')) {
        try {
            const limit = Math.min(range.days, 1000); // Binance 限制
            const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${limit}`;
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

    // === Strategy 3: Try TWSE API directly (僅當月資料) ===
    if (timeframe === '1M') {
        try {
            const twseUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&stockNo=${cleanCode}`;
            if (loading) loading.innerHTML = '<span style="color: var(--accent-yellow);">📊 從證交所抓取資料中...</span>';

            const response = await fetchWithCORS(twseUrl);
            const data = await response.json();

            if (data.stat === 'OK' && data.data && data.data.length > 0) {
                const chartData = data.data.map(row => {
                    const parsePrice = (str) => parseFloat(String(str).replace(/,/g, '')) || 0;
                    return {
                        date: row[0],
                        open: parsePrice(row[3]),
                        high: parsePrice(row[4]),
                        low: parsePrice(row[5]),
                        close: parsePrice(row[6])
                    };
                }).filter(d => d.close > 0);

                if (chartData.length > 0) {
                    renderSelfBuiltChart(container, chartData, symbol);
                    if (loading) loading.style.display = 'none';
                    console.log(`📊 Chart loaded from TWSE API for ${cleanCode}`);
                    return;
                }
            }
        } catch (e) {
            console.warn('TWSE API failed:', e);
        }
    }

    // === Strategy 4: Try Yahoo Finance via CORS proxy (備用) ===
    const tryYahoo = async (suffix) => {
        try {
            const yahooSymbol = `${cleanCode}.${suffix}`;
            // [修改] 使用動態 range 參數
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=${range.yahoo}`;

            if (loading) loading.innerHTML = '<span style="color: var(--accent-yellow);">📊 從 Yahoo 抓取資料中...</span>';

            const response = await fetchWithCORS(url);
            const data = await response.json();

            if (data.chart?.result?.[0]) {
                const result = data.chart.result[0];
                const timestamps = result.timestamp || [];
                const quotes = result.indicators?.quote?.[0] || {};

                const chartData = timestamps.map((t, i) => ({
                    date: new Date(t * 1000).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
                    open: quotes.open?.[i] || quotes.close?.[i] || 0,
                    close: quotes.close?.[i] || 0,
                    high: quotes.high?.[i] || 0,
                    low: quotes.low?.[i] || 0
                })).filter(d => d.close > 0);

                if (chartData.length > 0) {
                    renderSelfBuiltChart(container, chartData, symbol);
                    if (loading) loading.style.display = 'none';
                    console.log(`📊 Chart loaded from Yahoo API for ${yahooSymbol}`);
                    return true;
                }
            }
        } catch (e) {
            console.warn(`Yahoo Finance API failed for ${suffix}:`, e);
        }
        return false;
    };

    // 先試 TW (上市)，若失敗再試 TWO (上櫃)
    if (await tryYahoo('TW')) return;
    if (await tryYahoo('TWO')) return;

    // === Strategy 5: 使用當前股票的今日數據建立簡易圖表 ===
    try {
        // 從已載入的股票數據中尋找該股票
        const stock = state.allStocks.find(s => s.code.replace('.TW', '') === cleanCode);
        if (stock && stock.closePrice) {
            const open = parseFloat(stock.openPrice) || parseFloat(stock.closePrice);
            const high = parseFloat(stock.highPrice) || parseFloat(stock.closePrice);
            const low = parseFloat(stock.lowPrice) || parseFloat(stock.closePrice);
            const close = parseFloat(stock.closePrice);

            // 建立今日單筆數據
            const today = new Date().toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
            const chartData = [{ date: today, open, high, low, close }];

            // 顯示今日數據
            renderSelfBuiltChart(container, chartData, symbol);
            if (loading) loading.innerHTML = '<span style="color: var(--accent-blue);">📊 顯示今日數據</span>';
            console.log(`📊 Chart showing today's data for ${cleanCode}`);
            return;
        }
    } catch (e) {
        console.warn('Today data fallback failed:', e);
    }

    // === 所有來源都失敗 ===
    console.log(`⚠️ No data available for ${cleanCode}`);
    if (loading) loading.innerHTML = '<span style="color: var(--accent-red);">⚠️ 請稍後重試</span>';
}

function renderSelfBuiltChart(container, chartData, symbol) {
    // Destroy existing chart
    if (analysisChart) {
        analysisChart.destroy();
        analysisChart = null;
    }

    // Create canvas
    container.innerHTML = '<canvas id="selfBuiltChart" style="width:100%;height:100%;"></canvas>';
    const ctxCanvas = document.getElementById('selfBuiltChart');
    if (!ctxCanvas) return;

    const labels = chartData.map(d => d.date);
    const opens = chartData.map(d => d.open || d.close);
    const highs = chartData.map(d => d.high || d.close);
    const lows = chartData.map(d => d.low || d.close);
    const closes = chartData.map(d => d.close);

    // Calculate MAs
    const ma5 = calculateMA(closes, 5);
    const ma20 = calculateMA(closes, 20);

    // --- SMC Pattern Detection (Client-side) ---
    const smcZones = [];

    // 1. Detect FVG (Fair Value Gaps)
    // Look for 3-candle patterns where 1st and 3rd don't overlap
    for (let i = 2; i < chartData.length; i++) {
        const prevHigh = highs[i - 2];
        const prevLow = lows[i - 2];
        const currHigh = highs[i];
        const currLow = lows[i];

        // Bullish FVG: Gap between Candle 1 High and Candle 3 Low
        if (currLow > prevHigh) {
            smcZones.push({
                type: 'FVG-Bull',
                yTop: currLow,
                yBottom: prevHigh,
                xStart: i - 2,
                xEnd: Math.min(i + 15, chartData.length - 1), // Extend for visibility
                color: 'rgba(34, 197, 94, 0.25)', // Green
                border: 'rgba(34, 197, 94, 0.5)'
            });
        }

        // Bearish FVG: Gap between Candle 1 Low and Candle 3 High
        if (currHigh < prevLow) {
            smcZones.push({
                type: 'FVG-Bear',
                yTop: prevLow,
                yBottom: currHigh,
                xStart: i - 2,
                xEnd: Math.min(i + 15, chartData.length - 1),
                color: 'rgba(239, 68, 68, 0.25)', // Red
                border: 'rgba(239, 68, 68, 0.5)'
            });
        }
    }

    // 2. Detect OB (Order Blocks - Simplified)
    // Detect Pivot Highs/Lows as potential OBs
    for (let i = 5; i < chartData.length - 5; i++) {
        // Swing Low (Bullish OB)
        if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
            smcZones.push({
                type: 'OB-Bull',
                yTop: highs[i], // OB usually covers the candle body or range
                yBottom: lows[i],
                xStart: i,
                xEnd: Math.min(i + 20, chartData.length - 1),
                color: 'rgba(59, 130, 246, 0.3)', // Blue
                border: 'rgba(59, 130, 246, 0.6)'
            });
        }
        // Swing High (Bearish OB)
        if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
            smcZones.push({
                type: 'OB-Bear',
                yTop: highs[i],
                yBottom: lows[i],
                xStart: i,
                xEnd: Math.min(i + 20, chartData.length - 1),
                color: 'rgba(168, 85, 247, 0.3)', // Purple
                border: 'rgba(168, 85, 247, 0.6)'
            });
        }
    }

    // Filter zones to keep only recent or significant ones to avoid clutter
    const recentZones = smcZones.filter(z => z.xEnd > chartData.length - 60).slice(-10);


    // Create candlestick data for floating bar chart
    const candleData = chartData.map((d, i) => {
        const open = opens[i];
        const close = closes[i];
        return [Math.min(open, close), Math.max(open, close)];
    });

    const candleColors = chartData.map((d, i) => {
        return closes[i] >= opens[i] ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)';
    });

    const candleBorders = chartData.map((d, i) => {
        return closes[i] >= opens[i] ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)';
    });

    analysisChart = new Chart(ctxCanvas, {
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
                    barPercentage: 0.7,
                    categoryPercentage: 0.9,
                    order: 2
                },
                {
                    label: 'MA5',
                    data: ma5,
                    type: 'line',
                    borderColor: '#f59e0b',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.3,
                    order: 1
                },
                {
                    label: 'MA20',
                    data: ma20,
                    type: 'line',
                    borderColor: '#3b82f6',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.3,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x',
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                    }
                },
                legend: {
                    display: true,
                    labels: { color: '#94a3b8', filter: (item) => item.text !== 'K線' }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(26, 26, 36, 0.95)',
                    callbacks: {
                        label: function (context) {
                            const i = context.dataIndex;
                            if (context.dataset.label === 'K線') {
                                const o = opens[i]?.toFixed(2);
                                const h = highs[i]?.toFixed(2);
                                const l = lows[i]?.toFixed(2);
                                const c = closes[i]?.toFixed(2);
                                return [`O:${o} H:${h} L:${l} C:${c}`];
                            }
                            return `${context.dataset.label}: ${context.parsed.y?.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#64748b', maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#64748b' },
                    position: 'right'
                }
            }
        },
        plugins: [{
            id: 'smcOverlay',
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                const xAxis = chart.scales.x;
                const yAxis = chart.scales.y;

                // 1. Draw Wicks
                ctx.save();
                ctx.lineWidth = 1;
                chartData.forEach((d, i) => {
                    if (highs[i] == null) return;
                    const x = xAxis.getPixelForValue(i);
                    const yHigh = yAxis.getPixelForValue(highs[i]);
                    const yLow = yAxis.getPixelForValue(lows[i]);
                    const color = closes[i] >= opens[i] ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)';

                    ctx.strokeStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(x, yHigh);
                    ctx.lineTo(x, yLow);
                    ctx.stroke();
                });
                ctx.restore();

                // 2. Draw SMC Zones
                recentZones.forEach(zone => {
                    const xStart = xAxis.getPixelForValue(zone.xStart);
                    const xEnd = xAxis.getPixelForValue(zone.xEnd);
                    const yTop = yAxis.getPixelForValue(zone.yTop);
                    const yBottom = yAxis.getPixelForValue(zone.yBottom);
                    const width = xEnd - xStart;
                    const height = yBottom - yTop; // Canvas coords: Top < Bottom

                    ctx.save();
                    ctx.fillStyle = zone.color;
                    ctx.strokeStyle = zone.border;
                    ctx.lineWidth = 1;
                    ctx.fillRect(xStart, yTop, width, height);
                    ctx.strokeRect(xStart, yTop, width, height);

                    // Label
                    ctx.fillStyle = zone.border;
                    ctx.font = '10px Arial';
                    ctx.fillText(zone.type, xStart, yTop - 5);
                    ctx.restore();
                });
            }
        }]
    });
}

// === renderFallbackChart 已移除 (禁止模擬數據) ===

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

// Render related stocks graph using data-driven correlation
function renderRelatedStocksGraph(stock) {
    const container = document.getElementById('relatedStocksGraph');
    if (!container) return;

    // 1. Get related stocks from same sector
    // [Fix] Treat '其他' as null to force fallback logic for generic sectors
    const sector = (stock.sector === '其他' || !stock.sector) ? null : stock.sector;

    // Fallback: If sector is generic, use Top Volume stocks as 'related' by market interest
    let relatedStocks = [];
    if (sector) {
        relatedStocks = state.allStocks.filter(s => s.sector === sector && s.code !== stock.code);
    }

    // If not enough stocks in sector, grab some from same market or top volume
    if (relatedStocks.length < 3) {
        relatedStocks = state.allStocks
            .filter(s => s.code !== stock.code)
            .sort((a, b) => (b.volume || 0) - (a.volume || 0))
            .slice(0, 8);
    }

    // 2. Calculate Correlation (Snapshot Beta Proxy)
    // We use daily change percent similarity as a proxy for immediate correlation
    const centerChange = stock.changePercent || 0;

    const nodes = relatedStocks.map(s => {
        const change = s.changePercent || 0;
        let beta = 0;

        // Simple heuristic for snapshot beta:
        // Same direction? Positive. Opposite? Negative.
        // Magnitude similarity determines how close to 1 or -1.
        if (Math.sign(centerChange) === Math.sign(change) && centerChange !== 0) {
            const ratio = Math.min(Math.abs(centerChange), Math.abs(change)) / Math.max(Math.abs(centerChange), Math.abs(change));
            beta = 0.5 + (ratio * 0.5); // 0.5 ~ 1.0 (Positive Correlation)
        } else if (centerChange !== 0) {
            beta = -0.5 - (Math.min(Math.abs(centerChange), Math.abs(change)) / Math.max(1, Math.abs(centerChange))) * 0.5; // -0.5 ~ -1.0
        } else {
            // If center didn't move, assume weak positive correlation for same sector
            beta = 0.2;
        }

        return {
            code: s.code.replace('.TW', '').replace('.TWO', ''),
            name: s.name,
            change: change,
            beta: beta.toFixed(2)
        };
    })
        .sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta)) // Prioritize strong correlations (pos or neg)
        .slice(0, 6); // Top 6

    // Create SVG force-directed graph
    const width = container.offsetWidth || 400;
    const height = 280;
    const centerX = width / 2;
    const centerY = height / 2;

    let svg = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}">`;

    // Gradient definitions
    svg += `
    <defs>
        <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#b45309;stop-opacity:1" />
        </radialGradient>
    </defs>`;

    // Draw connections lines first (so they are behind nodes)
    nodes.forEach((rs, i) => {
        const angle = (i / nodes.length) * Math.PI * 2;
        // Stronger correlation = Closer distance
        const distance = 80 + (1 - Math.abs(rs.beta)) * 60;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;

        const beta = parseFloat(rs.beta);
        // Green for positive, Red for negative
        const color = beta > 0 ? '#10b981' : '#ef4444';
        const opacity = Math.min(Math.abs(beta), 1);
        const dashArray = beta < 0 ? '4,4' : ''; // Dash for negative correlation

        svg += `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" 
                  stroke="${color}" stroke-width="${1 + Math.abs(beta) * 2}" stroke-dasharray="${dashArray}" opacity="${opacity}"/>`;
    });

    // Draw center node (main stock)
    svg += `<circle cx="${centerX}" cy="${centerY}" r="38" fill="url(#centerGrad)" stroke="#fff" stroke-width="2"/>`;
    svg += `<text x="${centerX}" y="${centerY - 6}" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">${stock.name?.slice(0, 4) || ''}</text>`;
    svg += `<text x="${centerX}" y="${centerY + 8}" text-anchor="middle" fill="#fff" font-size="10" opacity="0.9">${stock.changePercent > 0 ? '+' : ''}${stock.changePercent?.toFixed(2)}%</text>`;

    // Draw related nodes
    nodes.forEach((rs, i) => {
        const angle = (i / nodes.length) * Math.PI * 2;
        const distance = 80 + (1 - Math.abs(rs.beta)) * 60;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;

        const beta = parseFloat(rs.beta);
        const isPositive = beta > 0;
        const nodeColor = isPositive ? '#064e3b' : '#450a0a';
        const strokeColor = isPositive ? '#10b981' : '#ef4444';

        svg += `<circle cx="${x}" cy="${y}" r="30" fill="${nodeColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<text x="${x}" y="${y - 4}" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">${rs.name?.slice(0, 3) || ''}</text>`;
        svg += `<text x="${x}" y="${y + 8}" text-anchor="middle" fill="${strokeColor}" font-size="9">${rs.change > 0 ? '+' : ''}${rs.change.toFixed(1)}%</text>`;

        // Beta Label
        // svg += `<text x="${x}" y="${y + 20}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">β ${rs.beta}</text>`;
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
