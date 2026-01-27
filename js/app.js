/**
 * 台股每日市場分析報告 - 前端應用程式
 * 動態載入市場資料並渲染 UI
 */

// === 資料載入 ===
async function loadMarketData() {
    try {
        const response = await fetch('./data/market-data.json');
        if (!response.ok) throw new Error('Failed to load data');
        return await response.json();
    } catch (error) {
        console.error('載入資料失敗:', error);
        return null;
    }
}

// === 渲染市場情報卡片 ===
function renderMarketCards(data) {
    const container = document.getElementById('marketCards');
    if (!data || !data.marketIntelligence) {
        container.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        return;
    }

    const cards = data.marketIntelligence.map(item => `
        <div class="market-card">
            <div class="market-card-header">
                <div class="market-card-icon">${item.icon}</div>
                <span class="market-card-label">${item.category}</span>
            </div>
            <h3 class="market-card-title">${item.title}</h3>
            <p class="market-card-content">${item.content}</p>
            ${item.stats ? `
                <div class="market-card-stats">
                    ${item.stats.map(stat => `
                        <div class="stat-item">
                            <span class="stat-label">${stat.label}</span>
                            <span class="stat-value ${stat.change >= 0 ? 'positive' : 'negative'}">
                                ${stat.change >= 0 ? '+' : ''}${stat.value}
                            </span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');

    container.innerHTML = cards;
}

// === 渲染股票推薦卡片 ===
function renderStockCards(data) {
    const container = document.getElementById('stockCards');
    if (!data || !data.recommendations) {
        container.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        return;
    }

    const cards = data.recommendations.map(stock => `
        <div class="stock-card" data-market="${stock.market}">
            <div class="stock-card-header">
                <div class="stock-card-info">
                    <span class="stock-card-date">${data.updateDate || 'N/A'}</span>
                    <div class="stock-card-title">
                        <span class="stock-code">${stock.code}</span>
                        <span class="stock-name">${stock.name}</span>
                    </div>
                </div>
                <div class="stock-card-actions">
                    <button class="action-btn" title="加入觀察">🔖</button>
                    <button class="action-btn" title="分享">📤</button>
                    <button class="bullish-btn">${stock.signal}</button>
                </div>
            </div>
            <div class="stock-card-stats">
                <div class="stock-stat">
                    <span class="stock-stat-label">價格變動</span>
                    <span class="stock-stat-value ${stock.changePercent >= 0 ? 'positive' : 'negative'}">
                        ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent}%
                    </span>
                </div>
                <div class="stock-stat">
                    <span class="stock-stat-label">成交量比</span>
                    <span class="stock-stat-value ${stock.volumeRatio >= 1 ? 'positive' : ''}">
                        ${stock.volumeRatio}x
                    </span>
                </div>
                <div class="stock-stat">
                    <span class="stock-stat-label">收盤價</span>
                    <span class="stock-stat-value">$${stock.closePrice}</span>
                </div>
            </div>
            <div class="stock-card-analysis">
                ${stock.analysis}
            </div>
            <div class="stock-card-tags">
                ${stock.tags.map(tag => `
                    <span class="tag ${tag.type}">${tag.label}</span>
                `).join('')}
            </div>
        </div>
    `).join('');

    container.innerHTML = cards;
}

// === 渲染側邊欄股票列表 ===
function renderSidebar(data) {
    const bullishList = document.getElementById('bullishList');
    const bearishList = document.getElementById('bearishList');
    const bullishCount = document.getElementById('bullishCount');
    const bearishCount = document.getElementById('bearishCount');

    if (!data || !data.recommendations) return;

    const bullish = data.recommendations.filter(s => s.changePercent >= 0);
    const bearish = data.recommendations.filter(s => s.changePercent < 0);

    bullishCount.textContent = bullish.length;
    bearishCount.textContent = bearish.length;

    bullishList.innerHTML = bullish.map(stock => `
        <div class="stock-item" data-code="${stock.code}">
            <span class="stock-item-code">${stock.code}</span>
            <span class="stock-item-change positive">+${stock.changePercent}%</span>
        </div>
    `).join('');

    bearishList.innerHTML = bearish.map(stock => `
        <div class="stock-item" data-code="${stock.code}">
            <span class="stock-item-code">${stock.code}</span>
            <span class="stock-item-change negative">${stock.changePercent}%</span>
        </div>
    `).join('');

    // 點擊側邊欄項目滾動到對應卡片
    document.querySelectorAll('.stock-item').forEach(item => {
        item.addEventListener('click', () => {
            const code = item.dataset.code;
            const card = document.querySelector(`.stock-card[data-code="${code}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.borderColor = 'var(--accent-blue)';
                setTimeout(() => {
                    card.style.borderColor = '';
                }, 2000);
            }
        });
    });
}

// === 更新時間顯示 ===
function updateTime(data) {
    const timeEl = document.getElementById('updateTime');
    if (data && data.updateTime) {
        timeEl.innerHTML = `<span>📅 更新時間：${data.updateTime}</span>`;
    }
}

// === 篩選功能 ===
function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.textContent.trim();
            const cards = document.querySelectorAll('.stock-card');

            cards.forEach(card => {
                if (filter === 'ALL') {
                    card.style.display = '';
                } else {
                    card.style.display = card.dataset.market === filter ? '' : 'none';
                }
            });
        });
    });
}

// === 搜尋功能 ===
function setupSearch() {
    const searchInput = document.querySelector('.search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.stock-card');

        cards.forEach(card => {
            const code = card.querySelector('.stock-code')?.textContent.toLowerCase() || '';
            const name = card.querySelector('.stock-name')?.textContent.toLowerCase() || '';
            const match = code.includes(query) || name.includes(query);
            card.style.display = match ? '' : 'none';
        });
    });
}

// === Toast 通知 ===
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// === 初始化 ===
async function init() {
    console.log('🚀 台股每日市場分析報告初始化中...');

    const data = await loadMarketData();

    if (data) {
        renderMarketCards(data);
        renderStockCards(data);
        renderSidebar(data);
        updateTime(data);
        showToast('✅ 資料載入完成');
    } else {
        // 載入範例資料用於展示
        const demoData = getDemoData();
        renderMarketCards(demoData);
        renderStockCards(demoData);
        renderSidebar(demoData);
        updateTime(demoData);
        showToast('📊 展示範例資料');
    }

    setupFilters();
    setupSearch();
}

// === 範例資料（用於無實際資料時展示） ===
function getDemoData() {
    return {
        updateDate: new Date().toLocaleDateString('zh-TW'),
        updateTime: new Date().toLocaleString('zh-TW'),
        marketIntelligence: [
            {
                icon: '📈',
                category: '盤後總結',
                title: '台股盤後：加權指數收漲0.5%',
                content: '今日加權指數收在 18,500 點，成交量達 2,500 億，電子股領漲大盤。',
                stats: [
                    { label: '加權指數', value: '+0.5%', change: 0.5 },
                    { label: '成交量', value: '2,500億', change: 1 }
                ]
            },
            {
                icon: '🌍',
                category: '美股動態',
                title: '美股三大指數齊漲',
                content: '道瓊上漲 0.8%，那斯達克漲 1.2%，S&P 500 漲 0.9%，科技股表現亮眼。',
                stats: [
                    { label: '道瓊', value: '+0.8%', change: 0.8 },
                    { label: '那斯達克', value: '+1.2%', change: 1.2 },
                    { label: 'S&P 500', value: '+0.9%', change: 0.9 }
                ]
            },
            {
                icon: '⚡',
                category: '期貨市場',
                title: '台指期貨留倉增加',
                content: '外資台指期貨淨多單增加 5,000 口，正價差擴大。'
            },
            {
                icon: '🤖',
                category: 'AI 投資建議',
                title: '短期偏多操作',
                content: '根據技術面與籌碼面分析，建議短線偏多操作，關注 AI 與半導體類股。'
            }
        ],
        recommendations: [
            {
                code: '2330.TW',
                name: '台積電',
                market: '上市',
                closePrice: 580,
                changePercent: 2.5,
                volumeRatio: 1.3,
                signal: 'BULLISH',
                analysis: '🔥 台積電技術面突破季線壓力，外資連續買超，AI 需求持續帶動營收成長，短線看好突破前高。',
                tags: [
                    { label: '半導體', type: 'neutral' },
                    { label: '外資買超', type: 'bullish' },
                    { label: 'AI 題材', type: 'bullish' }
                ]
            },
            {
                code: '2454.TW',
                name: '聯發科',
                market: '上市',
                closePrice: 1150,
                changePercent: 1.8,
                volumeRatio: 1.5,
                signal: 'BULLISH',
                analysis: '📱 聯發科受惠於 5G 與 AI 手機晶片需求，技術面站上所有均線，籌碼面穩健。',
                tags: [
                    { label: 'IC 設計', type: 'neutral' },
                    { label: '5G', type: 'bullish' },
                    { label: '突破', type: 'bullish' }
                ]
            },
            {
                code: '3008.TW',
                name: '大立光',
                market: '上市',
                closePrice: 2350,
                changePercent: -0.5,
                volumeRatio: 0.8,
                signal: 'NEUTRAL',
                analysis: '📷 大立光近期股價整理，等待新機發表利多刺激，建議觀望為主。',
                tags: [
                    { label: '光學', type: 'neutral' },
                    { label: '整理', type: 'bearish' }
                ]
            }
        ]
    };
}

// 啟動應用
document.addEventListener('DOMContentLoaded', init);
