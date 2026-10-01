# 台灣版介面同步（2026-10-01）

世界版 `index.html` 是台灣版 `index.html` 加上一組世界版改動。這次把它從台灣版 8/31 的 `5c1c7ea7cf` 跟到 10/1 的 `5801a47ced`（taiwan-rail-live `main`）。

## 範圍

只跟上與城市無關的通用介面；台灣專屬功能不搬過來。

- **帶進來**：MapLibre GL 地圖引擎（取代 Leaflet）、新版頂列與底部分頁、字級、列車光環、日夜光影、暗色 2.0、跟車時車頭朝上、路線導覽、新版查詢與今日亮點面板，以及期間所有通用修正。
- **不帶進來**：台鐵誤點／等站卡、公車轉乘、車庫、台南歷史重播、週末鐵道活動、地景 3D（`rail-3d.js`）、衛星影像、站台股道、新北輕軌模型、配樂情境（`data/music.json`）、GL 軌道（台灣 geojson）、台灣 SEO 頁連結。

## 做法

1. 找出世界版分岔點：在台灣版 8/28–9/5 間逐 commit 比對 `index.html`，`5c1c7ea7` 與世界版差異最小（626 行）。
2. `git merge-file`（ours＝世界版、base＝`5c1c7ea7`、theirs＝台灣版 `main`），40 個衝突逐一處理：
   - 世界版品牌、頁首 meta、更新紀錄、資料來源、頁尾連結、城市資料說明：保留世界版。
   - 台灣版新引擎與新版繪製：採台灣版，再把世界版的邏輯（`schedMarkerLabel`、時速判斷的尾跡、城市網址參數、`deepCity`）改寫到 `M` 適配層上。
   - `trainDisplayNo()` 對世界城市直接回傳 `worldRouteBadge()`，台灣版新加的所有車號顯示點因此自動顯示路線代號。
3. 其他檔案：
   - 採台灣版：`i18n/translations.js`、`vendor/maplibre-gl.*`（5.9.0）。
   - 三方合併：`i18n/content-translations.js`（無衝突）。
   - 新增：`night-theme.css`、`night-board.js`、`night-map.js`、`rail-discovery.js`、`rail-3d.css`、`rail-3d/environment/sun.mjs`、`rail-3d/integration/{train-halo-style,formations}.js`。
   - 移除：`vendor/leaflet-maplibre-gl.js`、Leaflet 授權檔與 `leaflet` 套件依賴。
4. 世界版關閉台灣專屬功能的位置：
   - JS：`WORLD_BUILD` 守門（資料載入、GL 軌道、離線陸地、配樂、週末活動、底圖埋點、查詢快捷列、車庫入口、說明中心條目）。
   - CSS：`html.world-ui` 一組 `display:none`（更多選單列、地圖風格的衛星／地景鈕），以及手機頂列以城市選單取代 `#gtabOne`。
   - 車站看板對世界城市不分「北上／南下」，一律依終點分組。

## 驗收

- `tools/verify_world_ui.mjs`：Chromium 通過（四種寬度、真實 tap、東京懶載入、台灣版入口）。測試已改成播放鍵看得到才按，因為台灣版把手機的播放鍵收進時鐘膠囊。
- 五座首發城市 × 三語（東京 ja、紐約 en、倫敦 zh-TW、伊斯坦堡 en、新加坡 zh-TW）：開機、跟車、車站看板皆無 JavaScript 錯誤。
- `app/`：`npm run build:verify` 通過（路線 release gate、App readiness）；`app/www` 開機預設東京、英文正常。

## 尚未驗證

- WebKit（此環境沒有安裝），以及 iOS／Android 真機。
- 實際 OpenFreeMap 底圖（驗證環境沒有外網，只確認底圖失敗時的退路提示）。
- `data/events.json` 404：8/31 版本就有，這次沒有處理。

## 下次同步

用同一個方法，base 改成 `5801a47ced`。
