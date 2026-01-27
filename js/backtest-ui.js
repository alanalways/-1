/**
 * 複利雪球模擬器 - UI 控制腳本
 * Compound Snowball Simulator - UI Controller
 */

// === 全域狀態 ===
const state = {
    mode: 'backtest',       // backtest, forecast, simulation
    selectedSymbol: null,
    historicalData: null,
    currency: 'TWD',
    exchangeRate: 31.5,
    chart: null,
    results: null
};

// === DOM 元素 ===
const elements = {};

// === 初始化 ===
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    initEventListeners();
    initChart();

    // 取得匯率
    try {
        state.exchangeRate = await BacktestData.fetchExchangeRate();
    } catch (e) {
        console.log('使用預設匯率');
    }

    updateLastUpdated();
});

function initElements() {
    elements.symbolSearch = document.getElementById('symbolSearch');
    elements.searchResults = document.getElementById('searchResults');
    elements.selectedSymbol = document.getElementById('selectedSymbol');
    elements.symbolName = document.getElementById('symbolName');
    elements.symbolCode = document.getElementById('symbolCode');
    elements.symbolIcon = document.getElementById('symbolIcon');

    elements.modeTabs = document.querySelectorAll('.mode-tab');
    elements.runButton = document.getElementById('runButton');

    elements.initialCapital = document.getElementById('initialCapital');
    elements.monthlyInvestment = document.getElementById('monthlyInvestment');
    elements.years = document.getElementById('years');
    elements.yearsValue = document.getElementById('yearsValue');
    elements.annualReturn = document.getElementById('annualReturn');
    elements.annualReturnValue = document.getElementById('annualReturnValue');
    elements.annualReturnGroup = document.getElementById('annualReturnGroup');

    elements.commissionRate = document.getElementById('commissionRate');
    elements.taxRate = document.getElementById('taxRate');
    elements.dipBuyStrategy = document.getElementById('dipBuyStrategy');
    elements.rsiThreshold = document.getElementById('rsiThreshold');
    elements.rsiThresholdGroup = document.getElementById('rsiThresholdGroup');
    elements.reinvestDividends = document.getElementById('reinvestDividends');

    elements.advancedToggle = document.getElementById('advancedToggle');
    elements.advancedContent = document.getElementById('advancedContent');

    elements.chartTitle = document.getElementById('chartTitle');
    elements.chartCanvas = document.getElementById('mainChart');
    elements.chartLegend = document.getElementById('chartLegend');
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    elements.resetZoom = document.getElementById('resetZoom');
    elements.downloadCSV = document.getElementById('downloadCSV');

    elements.statsGrid = document.getElementById('statsGrid');
    elements.statFinalValue = document.getElementById('statFinalValue');
    elements.statTotalReturn = document.getElementById('statTotalReturn');
    elements.statCAGR = document.getElementById('statCAGR');
    elements.statMaxDrawdown = document.getElementById('statMaxDrawdown');
    elements.statSharpe = document.getElementById('statSharpe');
    elements.statDividends = document.getElementById('statDividends');

    elements.currencyBtns = document.querySelectorAll('.currency-btn');
    elements.lastUpdated = document.getElementById('lastUpdated');
    elements.toast = document.getElementById('toast');
}

function initEventListeners() {
    // 搜尋功能
    let searchTimeout;
    elements.symbolSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 1) {
            elements.searchResults.classList.remove('active');
            return;
        }

        searchTimeout = setTimeout(() => searchSymbols(query), 300);
    });

    elements.symbolSearch.addEventListener('focus', () => {
        if (elements.searchResults.children.length > 0) {
            elements.searchResults.classList.add('active');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            elements.searchResults.classList.remove('active');
        }
    });

    // 模式切換
    elements.modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.modeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.mode = tab.dataset.mode;
            updateModeUI();
        });
    });

    // 年限滑桿
    elements.years.addEventListener('input', (e) => {
        elements.yearsValue.textContent = e.target.value;
    });

    // 年化報酬率滑桿
    elements.annualReturn.addEventListener('input', (e) => {
        elements.annualReturnValue.textContent = e.target.value;
    });

    // 逢低加碼策略
    elements.dipBuyStrategy.addEventListener('change', (e) => {
        elements.rsiThresholdGroup.style.display = e.target.value === 'rsi' ? 'block' : 'none';
    });

    // 進階設定折疊
    elements.advancedToggle.addEventListener('click', () => {
        elements.advancedContent.classList.toggle('show');
        elements.advancedToggle.textContent =
            elements.advancedContent.classList.contains('show')
                ? '▲ 收起進階設定'
                : '▼ 交易成本與進階設定';
    });

    // 執行按鈕
    elements.runButton.addEventListener('click', runSimulation);

    // 重置縮放
    elements.resetZoom.addEventListener('click', () => {
        if (state.chart) {
            state.chart.resetZoom();
        }
    });

    // 下載 CSV
    elements.downloadCSV.addEventListener('click', downloadResults);

    // 貨幣切換
    elements.currencyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.currencyBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currency = btn.dataset.currency;
            if (state.results) {
                updateStats(state.results);
            }
        });
    });
}

// === 搜尋功能 ===
async function searchSymbols(query) {
    try {
        const results = await BacktestData.searchSymbol(query);

        if (results.length === 0) {
            elements.searchResults.innerHTML = '<div class="search-result-item">找不到相關結果</div>';
        } else {
            elements.searchResults.innerHTML = results.map(r => `
                <div class="search-result-item" data-symbol="${r.symbol}">
                    <div class="search-result-symbol">${r.symbol}</div>
                    <div class="search-result-name">${r.name} · ${r.exchange || r.type}</div>
                </div>
            `).join('');

            // 點擊選擇
            elements.searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => selectSymbol(item.dataset.symbol));
            });
        }

        elements.searchResults.classList.add('active');
    } catch (error) {
        console.error('搜尋失敗:', error);
        showToast('搜尋失敗，請稍後再試', 'error');
    }
}

async function selectSymbol(symbol) {
    elements.searchResults.classList.remove('active');
    elements.symbolSearch.value = symbol;

    showLoading(true);

    try {
        const years = parseInt(elements.years.value) || 10;
        state.historicalData = await BacktestData.fetchHistoricalData(symbol, years + 5);
        state.selectedSymbol = symbol;

        // 更新 UI
        elements.symbolName.textContent = state.historicalData.name || symbol;
        elements.symbolCode.textContent = symbol;
        elements.selectedSymbol.style.display = 'flex';

        // 設定圖示
        if (symbol.includes('BTC') || symbol.includes('ETH')) {
            elements.symbolIcon.textContent = '₿';
        } else if (symbol.endsWith('.TW')) {
            elements.symbolIcon.textContent = '🇹🇼';
        } else {
            elements.symbolIcon.textContent = '📊';
        }

        elements.runButton.disabled = false;
        elements.chartTitle.textContent = `${state.historicalData.name} 模擬分析`;

        showToast(`已選擇 ${state.historicalData.name}`, 'success');

    } catch (error) {
        console.error('載入資料失敗:', error);
        showToast('載入資料失敗，請確認股票代碼', 'error');
        state.selectedSymbol = null;
        elements.runButton.disabled = true;
    }

    showLoading(false);
}

// === 執行模擬 ===
async function runSimulation() {
    if (!state.selectedSymbol) {
        showToast('請先選擇投資標的', 'warning');
        return;
    }

    showLoading(true);

    try {
        const engine = new BacktestEngine();
        const params = getParams();

        let results;

        switch (state.mode) {
            case 'backtest':
                results = engine.runBacktest(state.historicalData, params);
                elements.chartTitle.textContent = `📊 ${state.historicalData.name} 歷史回測`;
                break;

            case 'forecast':
                results = engine.runForecast(state.historicalData, params);
                elements.chartTitle.textContent = `🔮 ${state.historicalData.name} 未來預測`;
                break;

            case 'simulation':
                results = engine.runSimulation(params);
                elements.chartTitle.textContent = `📈 固定報酬模擬 (${params.annualReturn * 100}%/年)`;
                break;
        }

        state.results = results;
        updateChart(results);
        updateStats(results);

        elements.resetZoom.style.display = 'inline-block';
        elements.downloadCSV.style.display = 'inline-block';

        showToast('模擬完成！', 'success');

    } catch (error) {
        console.error('模擬失敗:', error);
        showToast('模擬失敗: ' + error.message, 'error');
    }

    showLoading(false);
}

function getParams() {
    return {
        initialCapital: parseFloat(elements.initialCapital.value) || 100000,
        monthlyInvestment: parseFloat(elements.monthlyInvestment.value) || 10000,
        years: parseInt(elements.years.value) || 10,
        annualReturn: parseFloat(elements.annualReturn.value) / 100 || 0.07,
        commissionRate: parseFloat(elements.commissionRate.value) / 100 || 0.001425,
        taxRate: parseFloat(elements.taxRate.value) / 100 || 0.003,
        dipBuyStrategy: elements.dipBuyStrategy.value,
        rsiThreshold: parseFloat(elements.rsiThreshold.value) || 30,
        reinvestDividends: elements.reinvestDividends.checked
    };
}

// === 圖表 ===
function initChart() {
    const ctx = elements.chartCanvas.getContext('2d');

    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        drag: { enabled: true },
                        mode: 'x'
                    },
                    pan: {
                        enabled: true,
                        mode: 'x'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.parsed.y;
                            return `${context.dataset.label}: ${formatCurrency(value)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        callback: (value) => formatCurrency(value, true)
                    }
                }
            }
        }
    });
}

function updateChart(results) {
    const timeline = results.timeline;

    if (state.mode === 'forecast') {
        // 未來預測 - 信賴區間
        state.chart.data.labels = timeline.map(t => t.date.slice(0, 7));
        state.chart.data.datasets = [
            {
                label: '樂觀 (P90)',
                data: timeline.map(t => t.p90),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                fill: '+1',
                tension: 0.3
            },
            {
                label: '中位數 (P50)',
                data: timeline.map(t => t.p50),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderWidth: 3,
                tension: 0.3
            },
            {
                label: '保守 (P10)',
                data: timeline.map(t => t.p10),
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                fill: '-1',
                tension: 0.3
            },
            {
                label: '投入本金',
                data: timeline.map(t => t.capital),
                borderColor: '#6b7280',
                borderDash: [5, 5],
                tension: 0
            }
        ];
        elements.chartLegend.style.display = 'flex';

    } else {
        // 回測 / 固定模擬
        const valueKey = state.mode === 'backtest' ? 'marketValue' : 'value';
        const capitalKey = state.mode === 'backtest' ? 'cost' : 'capital';

        state.chart.data.labels = timeline.map(t => t.date.slice(0, 7));
        state.chart.data.datasets = [
            {
                label: '資產市值',
                data: timeline.map(t => t[valueKey]),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                fill: true,
                tension: 0.3,
                borderWidth: 3
            },
            {
                label: '投入本金',
                data: timeline.map(t => t[capitalKey]),
                borderColor: '#6b7280',
                borderDash: [5, 5],
                tension: 0
            }
        ];

        // 回測加上淨值
        if (state.mode === 'backtest') {
            state.chart.data.datasets.push({
                label: '淨值 (扣費用)',
                data: timeline.map(t => t.netValue),
                borderColor: '#8b5cf6',
                borderDash: [3, 3],
                tension: 0.3
            });
        }

        elements.chartLegend.style.display = 'none';
    }

    state.chart.update();
}

function updateStats(results) {
    const summary = results.summary;
    const rate = state.currency === 'USD' ? 1 / state.exchangeRate : 1;

    if (state.mode === 'forecast') {
        elements.statFinalValue.textContent = formatCurrency(summary.median * rate);
        elements.statFinalValue.className = 'stat-value positive';

        elements.statTotalReturn.textContent = formatPercent(summary.medianReturn);
        elements.statTotalReturn.className = summary.medianReturn >= 0 ? 'stat-value positive' : 'stat-value negative';

        elements.statCAGR.textContent = `${summary.years} 年`;
        elements.statMaxDrawdown.textContent = formatCurrency(summary.optimistic * rate);
        elements.statSharpe.textContent = formatCurrency(summary.conservative * rate);
        elements.statDividends.textContent = `${summary.simulations} 次模擬`;

        // 更新標籤
        document.querySelectorAll('.stat-label')[3].textContent = '樂觀情境';
        document.querySelectorAll('.stat-label')[4].textContent = '保守情境';
        document.querySelectorAll('.stat-label')[5].textContent = 'Monte Carlo';

    } else if (state.mode === 'simulation') {
        elements.statFinalValue.textContent = formatCurrency(summary.finalValue * rate);
        elements.statFinalValue.className = 'stat-value positive';

        elements.statTotalReturn.textContent = formatPercent(summary.totalGainPercent);
        elements.statTotalReturn.className = 'stat-value positive';

        elements.statCAGR.textContent = formatPercent(summary.annualReturn);
        elements.statMaxDrawdown.textContent = `${summary.doubleYears.toFixed(1)} 年`;
        elements.statSharpe.textContent = formatCurrency(summary.totalCapital * rate);
        elements.statDividends.textContent = formatCurrency(summary.totalGain * rate);

        // 更新標籤
        document.querySelectorAll('.stat-label')[3].textContent = '翻倍時間';
        document.querySelectorAll('.stat-label')[4].textContent = '總投入';
        document.querySelectorAll('.stat-label')[5].textContent = '總獲利';

    } else {
        // 回測
        elements.statFinalValue.textContent = formatCurrency(summary.finalMarketValue * rate);
        elements.statFinalValue.className = 'stat-value positive';

        elements.statTotalReturn.textContent = formatPercent(summary.totalReturn);
        elements.statTotalReturn.className = summary.totalReturn >= 0 ? 'stat-value positive' : 'stat-value negative';

        elements.statCAGR.textContent = formatPercent(summary.cagr);
        elements.statCAGR.className = summary.cagr >= 0 ? 'stat-value positive' : 'stat-value negative';

        elements.statMaxDrawdown.textContent = formatPercent(-summary.maxDrawdown);
        elements.statMaxDrawdown.className = 'stat-value negative';

        elements.statSharpe.textContent = summary.sharpeRatio.toFixed(2);
        elements.statDividends.textContent = formatCurrency(summary.totalDividends * rate);

        // 還原標籤
        document.querySelectorAll('.stat-label')[3].textContent = '最大回撤';
        document.querySelectorAll('.stat-label')[4].textContent = '夏普比率';
        document.querySelectorAll('.stat-label')[5].textContent = '累積股息';
    }
}

function updateModeUI() {
    // 固定模擬顯示年化報酬率設定
    elements.annualReturnGroup.style.display = state.mode === 'simulation' ? 'block' : 'none';

    // 更新標題
    const titles = {
        backtest: '選擇標的後開始歷史回測',
        forecast: '選擇標的後開始未來預測',
        simulation: '設定參數後開始模擬'
    };

    if (!state.selectedSymbol) {
        elements.chartTitle.textContent = titles[state.mode];
    }

    // 固定模擬不需要選股
    if (state.mode === 'simulation') {
        elements.runButton.disabled = false;
    } else {
        elements.runButton.disabled = !state.selectedSymbol;
    }
}

// === 下載 CSV ===
function downloadResults() {
    if (!state.results) return;

    const timeline = state.results.timeline;
    let csv = '';

    if (state.mode === 'forecast') {
        csv = '日期,投入本金,保守(P10),中位數(P50),樂觀(P90)\n';
        timeline.forEach(t => {
            csv += `${t.date},${t.capital},${t.p10.toFixed(0)},${t.p50.toFixed(0)},${t.p90.toFixed(0)}\n`;
        });
    } else if (state.mode === 'simulation') {
        csv = '日期,投入本金,資產價值,獲利,報酬率\n';
        timeline.forEach(t => {
            csv += `${t.date},${t.capital},${t.value.toFixed(0)},${t.gain.toFixed(0)},${(t.gainPercent * 100).toFixed(2)}%\n`;
        });
    } else {
        csv = '日期,股價,持股,成本,市值,淨值,未實現損益,報酬率,回撤,RSI\n';
        timeline.forEach(t => {
            csv += `${t.date},${t.price.toFixed(2)},${t.shares.toFixed(2)},${t.cost.toFixed(0)},${t.marketValue.toFixed(0)},${t.netValue.toFixed(0)},${t.unrealizedGain.toFixed(0)},${(t.unrealizedGainPercent * 100).toFixed(2)}%,${(t.drawdown * 100).toFixed(2)}%,${t.rsi?.toFixed(1) || ''}\n`;
        });
    }

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest_${state.selectedSymbol || 'simulation'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('報表已下載', 'success');
}

// === 工具函數 ===
function formatCurrency(value, compact = false) {
    const symbol = state.currency === 'USD' ? '$' : 'NT$';

    if (compact && Math.abs(value) >= 1000000) {
        return symbol + (value / 1000000).toFixed(1) + 'M';
    }
    if (compact && Math.abs(value) >= 1000) {
        return symbol + (value / 1000).toFixed(0) + 'K';
    }

    return symbol + Math.round(value).toLocaleString();
}

function formatPercent(value) {
    const sign = value >= 0 ? '+' : '';
    return sign + (value * 100).toFixed(2) + '%';
}

function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} show`;

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

function updateLastUpdated() {
    elements.lastUpdated.textContent = new Date().toLocaleString('zh-TW');
}
