# 📈 Discover Latest - 台股智能分析平台

專業級台股市場分析與投資模擬平台，整合即時行情、技術分析與複利回測功能。

**🔗 線上版本：[https://alanalways.github.io/report/](https://alanalways.github.io/report/)**

---

## ✨ 核心功能

### 📊 市場儀表板
- **1,000+ 台股即時資料**：涵蓋上市/上櫃個股
- **Smart Money Concepts 分析**：Order Block、FVG、流動性分析
- **快速篩選**：多頭強勢、SMC 結構、成交量爆發、分類篩選
- **智能評分**：多維度技術面評估

### 🎯 複利雪球模擬器
- **歷史回測**：最多 20 年歷史資料
- **未來預測**：馬可夫模型蒙地卡羅模擬
- **固定模擬**：自訂年化報酬率預測
- **分時段投資**：支援多階段定期定額規劃
- **圖表顯示**：
  - 📈 投資組合市值
  - 💰 累積投入本金
  - 📉 股價走勢（雙 Y 軸）
- **週單位資料點**：更清晰的長期趨勢觀察

### 🌍 國際市場追蹤
- 道瓊、S&P 500、那斯達克
- 歐洲主要指數
- 亞太市場概覽

---

## 🚀 快速開始

### 本地開發

```bash
# 安裝依賴
npm install

# 啟動本地伺服器
npm run dev
# 或
npx serve . -p 3000

# 抓取最新資料
npm run update-data
```

瀏覽器開啟 `http://localhost:3000` 即可。

---

## 📁 專案結構

```
.
├── index.html              # 主頁面（整合所有功能）
├── css/
│   └── style.css           # 深色主題樣式
├── js/
│   ├── app.js              # 主應用邏輯
│   ├── backtest-data.js    # 資料取得（Yahoo Finance）
│   └── backtest-engine.js  # 回測計算引擎
├── data/                   # 市場資料 (JSON)
├── scripts/                # Node.js 後端腳本
└── .github/workflows/      # GitHub Actions 自動化
```

---

## 📊 資料來源

| 來源 | 用途 |
|------|------|
| [臺灣證券交易所 (TWSE)](https://www.twse.com.tw/) | 台股即時行情 |
| [證券櫃檯買賣中心 (TPEx)](https://www.tpex.org.tw/) | 上櫃股票資料 |
| [Yahoo Finance](https://finance.yahoo.com/) | 歷史價格、國際市場 |
| [FinMind](https://finmindtrade.com/) | 補充資料來源 |

> ⚠️ 本系統僅供學術研究與個人參考，不構成投資建議。

---

## 🔧 主要技術

- **前端**：Vanilla JS + Chart.js
- **資料**：Yahoo Finance API + CORS Proxy
- **部署**：GitHub Pages (靜態)
- **自動化**：GitHub Actions 每日更新

---

## 📱 使用方式

1. **儀表板**：瀏覽台股即時行情與分析
2. **自選清單**：收藏關注的個股
3. **複利模擬器**：
   - 搜尋股票代碼（如 0050、0056、00830）
   - 設定投資參數
   - 點擊「🚀 開始模擬」
4. **深度分析**：點擊個股進入詳細技術分析
5. **國際市場**：追蹤全球主要指數

---

## 📈 模擬器支援標的

台灣 ETF 搜尋自動加上 `.TW` 後綴：
- `0050` → 元大台灣50
- `0056` → 元大高股息
- `00830` → 國泰費城半導體
- `00940` → 元大台灣價值高息
- `2330` → 台積電

---

## 📝 授權

MIT License

---

Made with ❤️ by Alan
