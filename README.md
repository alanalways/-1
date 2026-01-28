# 📈 Discover Latest - 台股智能分析平台

專業級台股市場分析與投資模擬平台，整合即時行情、SMC 策略分析與複利回測功能。

**🔗 線上版本：[https://alanalways.github.io/report/](https://alanalways.github.io/report/)**

---

## ✨ 核心功能

### 📊 市場儀表板
- **1,000+ 台股即時資料**：涵蓋上市/上櫃個股
- **Smart Money Concepts (SMC) 進階分析**：
  - Order Block 訂單塊（ATR 動態閾值）
  - Fair Value Gap 價值缺口
  - Liquidity Sweep 流動性掃蕩（Swing High/Low 偵測）
  - Market Structure 市場結構濾網（MA200 趨勢判斷）
- **快速篩選**：多頭強勢、SMC 結構、看空訊號
- **智能評分**：多維度技術面評估 (0-100)
- **動態盤後總結**：自動統計看多/看空/SMC 訊號數量

### 🔍 深度分析模態框
- **K 線圖表**：6 個月歷史資料 + MA5/20/60 均線
- **SMC 訊號卡片**：Order Block、FVG、Liq Sweep 視覺化
- **Entry Confirmation**：進場確認清單（RSI、MA 條件）
- **基本面數據**：本益比、殖利率、量比、產業

### 🎯 複利雪球模擬器
- **歷史回測**：最多 20 年歷史資料
- **未來預測**：馬可夫模型 + 歷史 Bootstrap 重抽樣（保留肥尾效應）
- **滑價模擬**：0.2% 滑價參數，更貼近真實交易
- **分時段投資**：支援多階段定期定額規劃
- **圖表顯示**：
  - 📈 投資組合市值
  - 💰 累積投入本金
  - 📉 股價走勢（雙 Y 軸）
- **週單位資料點**：更清晰的長期趨勢觀察

### 🌍 國際市場追蹤
- 美股指數：道瓊、S&P 500、那斯達克、費半
- 亞太市場：日經 225、上證指數
- 商品/加密：黃金、原油、比特幣、歐元/美元

### ⏱️ 交易時段自動更新
- 台股交易時段 **9:00-13:30**（週一至週五）
- **每 5 分鐘自動更新**所有資料
- 非交易時段停止更新，節省資源

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
│   └── style.css           # 深色主題樣式 + SMC 模態框樣式
├── js/
│   ├── app.js              # 主應用邏輯 + K 線圖表渲染
│   ├── backtest-data.js    # 資料取得（Yahoo Finance + CORS Proxy）
│   └── backtest-engine.js  # 回測計算引擎（含滑價 + Bootstrap）
├── scripts/
│   └── analyze.js          # SMC 分析模組（ATR/Swing/MSS）
├── data/                   # 市場資料 (JSON)
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

## 🔧 技術特點

| 技術 | 說明 |
|------|------|
| **SMC 策略** | ATR 動態閾值、Swing High/Low、Market Structure |
| **回測引擎** | 滑價 0.2%、歷史 Bootstrap 重抽樣 |
| **前端** | Vanilla JS + Chart.js |
| **資料** | Yahoo Finance API + CORS Proxy |
| **部署** | GitHub Pages (靜態) |
| **自動化** | GitHub Actions 每日更新 |

---

## 📱 功能模組

1. **儀表板**：瀏覽台股即時行情與 SMC 分析
2. **自選清單**：收藏關注的個股
3. **深度分析**：點擊 📊 按鈕開啟專業 K 線分析
4. **國際市場**：追蹤全球主要指數與商品
5. **複利模擬器**：
   - 選擇標的（支援台股代碼如 `2330.TW`、`00940.TW`）
   - 設定投資參數（本金、定期定額、年限）
   - 執行歷史回測或未來預測

---

## 📄 License

MIT License
