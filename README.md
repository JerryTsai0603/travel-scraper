# Daily Scraper — 絲襪 + 腳交 + 中文字幕

每日自動抓取 [Jable.tv](https://jable.tv) 與 [missav123.com](https://missav123.com) 上同時具備「絲襪」與「腳交」標籤、且帶有中文字幕的影片，並輸出為 JSON / Markdown。

## 功能
- 兩個站點並行抓取，可獨立開關
- 三段式篩選：標籤 → 發佈時間（預設 14 天內）→ 中文字幕
- 中文字幕偵測涵蓋：HTML 內 `中文字幕 / Chinese / 中文`、metadata、字幕軌 `lang` 屬性
- 自動去重（透過 `data/state.json`）
- 每日輸出 `data/results-YYYY-MM-DD.json` 與 `data/results-YYYY-MM-DD.md`
- 支援 Telegram / Discord 通知（環境變數）
- Windows Task Scheduler 安裝腳本

## 環境需求
- Node.js ≥ 18
- Windows / macOS / Linux 皆可執行；排程在 Windows 上以「工作排程器」安裝，Linux/macOS 建議使用 `npm run schedule`（node-cron）

## 安裝

```powershell
cd C:\Users\jerrytsai\.minimax-agent\projects\daily-scraper
npm install
Copy-Item .env.example .env   # 可選，用於通知設定
```

## 立即執行一次（不排程）

```powershell
npm run run
```

執行結果會寫入 `data/results-YYYY-MM-DD.json` 與 `data/results-YYYY-MM-DD.md`。

## 啟動常駐排程（node-cron）

```powershell
npm run schedule
```

預設 `0 8 * * *` Asia/Taipei，可於 `config.json > schedule.cron` 調整。
關閉終端機後停止；若要背景常駐，請用 Windows 工作排程器。

## 註冊 Windows 工作排程器（推薦）

```powershell
npm run install-task     # 每天 08:00 自動跑一次
npm run uninstall-task   # 移除
```

工作名稱：`DailyScraperJableMissav`

## 設定 `config.json`

| 區塊 | 用途 |
| --- | --- |
| `schedule.cron` / `schedule.timezone` | 排程時間 |
| `filters.requiredTags.zh-Hant` / `.en` | 必要標籤（命中任一即視為符合該主題） |
| `filters.subtitle.languages` / `.labels` | 中文字幕判定依據 |
| `filters.maxAgeDays` | 只納入 N 天內的新片（預設 14；`0` = 不限制） |
| `sites.jable.tagPages` / `sites.missav.tagPages` | 入口標籤頁 |
| `sites.*.maxPagesPerTag` | 每個標籤最多翻幾頁 |
| `http.concurrency` / `.requestDelayMs` | 並行與節流設定（請勿調太高，避免被擋） |

## 通知（可選）

在 `.env` 設定下列任一組即可在有新命中時推送：

```
TELEGRAM_BOT_TOKEN=xxxx
TELEGRAM_CHAT_ID=123456
```

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## 輸出範例

`data/results-2026-09-12.md`

```
# 每日結果 — 2026-09-12
- 生成時間：2026-09-12T08:01:23.456Z
- 命中影片數：**3**
- 篩選條件：絲襪 + 腳交 + 中文字幕
## jable (2)
### [Sample title](https://jable.tv/videos/sample/)
- 站點：jable
- 字幕：subtitle track lang=zh-tw
- 命中標籤：絲襪、腳交、stockings、footjob
```

## ⚠️ 法律與道德提醒

- 兩個站點的 **服務條款多半禁止自動化抓取**，請自行確認並承擔風險
- 僅供個人紀錄使用，請勿大量轉發、散布、營利
- 程式已內建節流（`requestDelayMs` + `concurrency`），請勿下調至不禮貌的程度
- 若站點變更 HTML 結構，需同步更新 `src/scrapers/*.js` 中的選擇器

## 網頁前端

`web/` 是獨立的 Express + EJS 應用，把 `data/` 內所有 JSON 彙整成可瀏覽的網站：

```powershell
npm run web          # 預設 http://127.0.0.1:3000
$env:PORT=8080; npm run web
```

啟動後可瀏覽：

| 路徑 | 內容 |
| --- | --- |
| `/` | 全期彙整 + 最近 7 天趨勢圖 + 篩選 |
| `/date/2026-09-12` | 單日結果 |
| `/history` | 每日數量條狀圖 + Top 標籤 / Top 演員 |
| `/video/<site>/<base64url>` | 影片詳情頁（標題 / 演員 / 標籤 / 字幕證據） |
| `/api/results` | JSON API（含 query 篩選） |
| `/api/stats` | 統計資料 |
| `/api/dates` | 所有有結果的日期 |
| `/api/export` | 純文字下載（含 url + thumbnail），支援 `?format=csv\|json` |
| `/thumb?url=...` | 縮圖代理（會快取到 `web/public/thumbs/`） |
| `/prices`、`/prices/trip/<id>` | 機票 / 住宿即時價格監控（詳見下方「💸 價格監控」段） |

每張卡片顯示：**縮圖**、**標題**、**發佈 / 收錄日期**、**時長**、**演員**（可點擊篩選）、**標籤**（可點擊篩選）、**字幕證據**、**原站連結**、**🔗 連結 / 🖼 縮圖 複製鈕**、**收藏 ☆ / 已看 ○** 切換鈕。

### 取得影片連結 / 縮圖（多種方式）

| 方式 | 用法 |
| --- | --- |
| 卡片右下「🔗 連結」按鈕 | 點擊即複製原始影片 URL（跳出 toast 提示） |
| 卡片右下「🖼 縮圖」按鈕 | 點擊即複製原始縮圖 URL |
| 詳情頁「影片連結」欄位 | `<input>` 直接顯示完整 URL，可全選/複製 |
| 詳情頁「縮圖連結」欄位 | 同上，含實際縮圖預覽 |
| `GET /api/export` | 下載純文字清單（含 url / thumb / 演員 / 標籤） |
| `GET /api/export?format=csv` | 下載 CSV（Excel 直接開） |
| `GET /api/export?format=json` | 下載 JSON |
| `GET /api/export?...&site=missav` 等 | 任何篩選 query 都可用在 export 上 |

匯出範例（`/api/export` 純文字）：
```
[jable] Sample Stockings Footjob 001
  url:      https://jable.tv/videos/sample-stockings-footjob-001/
  thumb:    https://...
  actors:   Sample Actress A, Sample Actress B
  tags:     絲襪, 腳交, 高清, 中字
  captured: 2026-09-12
```

### 收藏 / 已看（純前端，localStorage）
- 每張卡片右上角兩個切換鈕：☆ 收藏 / ○ 已看
- 已看卡片自動變灰、加上「已看 ✓」徽章
- 詳情頁也提供同樣按鈕
- 篩選列多了「只顯示」下拉：全部 / 已收藏 / 已看過 / 未看過
- 狀態存在 `localStorage['ds.userState.v1']`，跨分頁/重整保留
- Hero 列即時顯示「已收藏 N ｜已看 N」計數

### 最近 7 天趨勢圖（首頁 SVG）
- 純內嵌 SVG，無外部依賴
- 顯示最近 7 天每日命中影片數（缺日補 0）
- 漸層面積圖 + 折線 + 圓點 + 數值/日期標籤
- 自動隨 `stats.dates` 計算，無需手動更新

### 資料快取策略
- JSON 檔案以 mtime 失效（5 秒內不重讀）
- 縮圖下載一次快取 7 天於 `web/public/thumbs/`（目錄已 gitignore）
- 找不到原縮圖時自動 fallback 到原 URL

### 💸 價格監控（機票 + 住宿）

內建於同一個 web server，**不需要另外開 port**：

```
http://127.0.0.1:3000/prices
```

飯店追蹤的表單與詳情頁都內建 **Leaflet 地圖 + OpenStreetMap**：點地圖設中心、拖 marker 移動、拉桿調整搜尋半徑（0.5–30 km）。詳情頁會在地圖上畫出搜尋範圍圓圈 + 每家飯店的價格 marker。

| 路徑 | 內容 |
| --- | --- |
| `/prices` | 所有追蹤 trip 列表（最新價 / 倒數天數 / 門檻提示） |
| `/prices/new` / `/prices/new?kind=hotel` | 新增追蹤表單（hotel 含地圖） |
| `/prices/trip/<id>` | 單一 trip 詳情：內嵌 SVG 趨勢圖 + 飯店地圖 + 抓取歷表 |
| `/prices/trip/<id>/edit` | 編輯 |
| `/prices/trip/<id>/fetch` (POST) | 立即手動抓取一次 |
| `/prices/api/trips` / `/prices/api/trips/<id>` / `/prices/api/trips/<id>/history` | JSON API |
| `/prices/api/trips/<id>/history.csv` | CSV 下載（可丟 Excel） |
| `/health` | 雲端健康檢查 JSON |

**運作方式**
- 每個 trip 是一筆設定（機票：出發/目的地/日期/艙等；住宿：城市/入住/退房/房型）
- 預設裝載 `Mock` provider（即使沒有真實 API 也能跑、也有趨勢波動）
- 排程：每 6 小時自動抓取（`node-cron`，時區 `Asia/Taipei`，可用 `PRICES_CRON` / `PRICES_TZ` 覆蓋）
- 警報：當 `bestPrice <= threshold` 時發 Telegram / Discord（沿用 `.env` 同一組 token），同一門檻 12 小時內不重發
- 排程可關：`$env:PRICES_SCHEDULER='false'; npm run web`

**獨立排程（不跑 web 也行）**
```powershell
npm run prices:scheduler    # 只跑抓取與門檻推播，不開網頁
```

**接真實來源（adapter pattern）**
- 介面合約在 `web/prices/providers/index.js`
- 新增一個 `web/prices/providers/<name>.js`，結尾 `registerProvider(...)` 即可掛上
- 候選：Amadeus Self-Service（機票，需 API key）、Booking Demand API（住宿）、Skyscanner Partners
- 公開頁面（Google Flights / Hotels Combined）受 Cloudflare 保護，跟本專案的 jable/missav 一樣會 403；建議付費 proxy 或瀏覽器自動化

**資料儲存**
- `data/prices/trips.json` — 所有 trip 設定
- `data/prices/state.json` — 上次抓取時間 + 已發警報去重
- `data/prices/history/<tripId>.json` — 該 trip 所有歷史快照（最多 1500 筆）

### 註冊為 Windows 服務（自動登入啟動 + 崩潰自動重啟）
```powershell
npm run install-task        # 同時註冊 scrape + web 兩個工作
```
- `DailyScraperJableMissav` — 每天 08:00 跑一次爬蟲
- `DailyScraperWeb` — 登入後 30 秒啟動 `node web/server.js`，崩潰 1 分鐘後自動重啟（最多 5 次）

環境變數可影響 web 工作：
```powershell
$env:PORT=8080; $env:HOST=0.0.0.0; npm run install-task
```
（會在排程器裡注入對應的 PORT / HOST）

```powershell
npm run uninstall-task      # 同時移除兩個工作
# 手動控制 web：
Start-ScheduledTask -TaskName DailyScraperWeb
Stop-ScheduledTask  -TaskName DailyScraperWeb
Get-ScheduledTask   -TaskName DailyScraperWeb
```

## 專案結構

```
daily-scraper/
├── config.json
├── package.json
├── src/
│   ├── index.js          # 主入口；--once 跑一次，否則啟用排程
│   ├── scheduler.js      # node-cron 排程
│   ├── lib/
│   │   ├── config.js     # 載入 config.json + .env
│   │   ├── http.js       # axios + 節流 + 重試
│   │   ├── storage.js    # 寫入 JSON / Markdown / 去重
│   │   ├── notify.js     # Telegram / Discord
│   │   └── logger.js
│   ├── filters/
│   │   ├── tags.js       # 標籤比對
│   │   └── subtitle.js   # 中文字幕偵測
│   └── scrapers/
│       ├── jable.js
│       └── missav.js
├── web/                  # 網頁前端（Express + EJS）
│   ├── server.js
│   ├── lib/data.js       # 讀 data/ + 縮圖代理 + 統計
│   ├── views/            # EJS 模板（partials / index / date / history / video / empty / trend）
│   └── public/           # CSS / 客戶端 JS / thumbs 快取
├── scripts/
│   ├── install-task.ps1
│   └── uninstall-task.ps1
└── data/                 # 輸出位置（自動建立）
```

## Troubleshooting

### `npm` 在 PowerShell 被擋 (`npm.ps1` 找不到)

系統預設 `ExecutionPolicy = Restricted`。修一次就好：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

或繞過：用 `& "C:\Program Files\nodejs\npm.cmd"` 取代 `npm`；或雙擊專案的 `scripts\run-web.cmd`（純 .cmd，不受 PowerShell 政策影響）。

### 看到 `EADDRINUSE: address already in use 127.0.0.1:3000`

之前的 server 沒乾淨退出。`web/server.js` 已加 auto-port fallback（會自動換到 3001、3002…）。要強制釋放 3000：

```cmd
scripts\kill-port.cmd
```

或一行：`Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`

### `Cannot find module ...\scripts\web\server.js`

舊版 `run-web.cmd` 的 `cd /d "%~dp0\.."` 在某些環境失效。已改用**絕對路徑**直接呼叫 `node "%PROJECT_ROOT%\web\server.js"`，不依賴 cwd。

### `npm run web` 沒開瀏覽器

`npm.ps1` 被擋時整個 `npm` 都卡住。改用 `scripts\run-web.cmd`（雙擊或 cmd.exe 執行）— 內建啟動 + probe + 開瀏覽器全流程。

### 看到 `403 Request failed with status code 403`（Cloudflare 擋爬蟲）

**這是正常的，不是程式 bug。**

Jable.tv 和 missav123.com 都用 Cloudflare 的「I'm Under Attack」模式保護。Cloudflare 會根據 **IP 信譽** 而不只是 headers 來判斷：

| 已加強 | 結果 |
| --- | --- |
| 完整瀏覽器 headers（Sec-Fetch-*, Client Hints） | ❌ 不夠 |
| Cookie jar + warmup（先 GET 首頁拿 cookies） | ❌ Cloudflare 不發 cf_clearance 給 datacenter IP |
| 403 retry + 清 cookie + warmup + longer backoff | ❌ IP 已標記就一樣擋 |

**要真的繞過需要其中之一**：

1. **Residential proxy**（住宅 IP，看起來像一般用戶）— 付費服務，如 brightdata、smartproxy
2. **瀏覽器自動化**（Playwright + stealth plugin）— 慢、複雜、但能執行 JS challenge
3. **VPN 換到住宅 IP** — 如果原本的 IP 已被標記

**如果只是想用 UI 看影片**：雙擊 `scripts\run-web.cmd` 就好，它只讀 `data/` 內的 sample JSON，不會打兩個站。Sample data 已經包含完整的縮圖、標題、演員、標籤。

### 想讓真實爬蟲跑起來

最快的路徑：裝 VPN 連到住宅 IP → 跑 `scripts\run-once.cmd`。VPN 換 IP 之後通常可以解開（Cloudflare 對住宅 IP 較友善）。失敗的話就要付費 proxy。

### 改了檔案但沒生效

- EJS 模板不需要重新編譯，server 會即時讀取
- CSS / JS 改了要 `Ctrl + Shift + R` 強制重整（瀏覽器會 cache）
- `data/results-*.json` 改了要在 `web/public/thumbs/` 也更新（縮圖是用 proxy + cache 7 天）

## ☁️ 雲端部屬（GitHub + PaaS）

這個專案是 Node.js 後端（不是純靜態），所以 MiniMax Code 的 `website_deploy` 不適用。
推薦用 **GitHub repo + 任一 Node.js PaaS**：

| 平台 | 優點 | 費用 | GitHub 整合 |
| --- | --- | --- | --- |
| **Render** | 最簡單、Blueprint 自動建立 | Free（有 15 分鐘冷啟動）/$7 月 always-on | 直接接 repo，`render.yaml` 一鍵 |
| **Railway** | 沒冷啟動、隨時回應 | $5/月額度 | 直接接 repo，`Procfile` 自動 |
| **Fly.io** | 全球 edge、3 個 free VM | Free 額度 | `fly launch` 讀 Dockerfile |

### 步驟（以 Render 為例，最快）

1. **在 GitHub 建一個新 repo**（不要勾任何初始化）
2. **本地 init + push**
   ```powershell
   cd C:\Users\jerrytsai\.minimax-agent\projects\daily-scraper
   git init
   git add .
   git commit -m "feat: add prices monitor + cloud-ready"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/<repo 名>.git
   git push -u origin main
   ```
3. **Render 後台**（https://dashboard.render.com/connect）→ 選剛剛的 repo → Render 自動讀 `render.yaml` 建立 Service
4. **等 3-5 分鐘 build 完**，Render 會給你 `https://daily-scraper-web.onrender.com/`
5. **加環境變數**（Dashboard → Environment）：
   - `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`（選填）
   - `DISCORD_WEBHOOK_URL`（選填）
   - `PRICES_CRON`（想改排程頻率的話，預設 `0 */6 * * *`）
6. **瀏覽** → `https://<你的>.onrender.com/prices`

### ⚠️ 雲端兩件必知的事

1. **`data/` 在多數 PaaS 是 ephemeral**（容器重啟就清空）
   - 想保留 trip 設定與價格歷史：在 `render.yaml` 取消 `# disk:` 註解（$1/月/GB）
   - 或外接：Supabase Storage / S3 / Cloudflare R2（要寫個 storage adapter，介面已預留）
   - **不持久化的話**：每次重啟 trips.json 會回到空 — 雲端不持久等於「無狀態」

2. **免費方案有冷啟動**
   - Render Free：15 分鐘沒人連線就 sleep，第一次連線需 30 秒
   - 想 always-on：Render Starter $7/月，或改用 Railway $5/月
   - 排程也會跟著 sleep；冷啟動時可能會跑一次 fetch 補抓

### 步驟（Railway / Fly.io）

- **Railway**：`Procfile` 已備好。`npm i -g @railway/cli` → `railway login` → `railway up`
- **Fly.io**：`Dockerfile` 已備好。`brew install flyctl` 或 `iwr https://fly.io/install.ps1 -useb | iex` → `fly auth signup` → `fly launch` → `fly deploy`

三個平台的差異主要是定價與冷啟動行為，程式碼完全通用。
```
