# 軌島・世界：12 區視覺範圍與首發城市檢視（2026-08-31）

## 決策摘要

目前的 12 個入口其實混了三種尺度：城市都會網、含遠郊／城際的區域網，以及全國網。若全部用同一套 `fitBounds` 同框，遠端支線會把真正精彩的市中心壓成一小點。因此首發不以「12 個全部留下」為目標，而以畫面密度、來源可維護性與公開範圍能否說清楚為準。

| 產品層級 | 地區 | 決定 |
| --- | --- | --- |
| 首發核心 | 東京、紐約、倫敦、伊斯坦堡、新加坡 | 補到已明示的城市範圍完整，保留為第一層城市選單 |
| 第二波 | 布達佩斯、維也納 | 畫面緊湊且現況接近完整，核心五城穩定後補齊 |
| 先重做呈現 | 巴黎、雪梨、墨爾本 | 資料可留，但必須把都會核心與遠郊／城際拆層，不能再全網同框 |
| 策展／延後 | 瑞士景觀線、挪威 | 瑞士改成景觀走廊選集；挪威拆城市或長途走廊，不做全國首發同框 |

「日本」在這一版明確等於「東京首發城市」，不是日本全國。若未來加入大阪／京都、名古屋、福岡，應各自成為城市入口；不要把日本全國路網塞進同一張圖。「土耳其」同理，這一版先做伊斯坦堡，Ankara／İzmir 另案處理。

## 量化結果

以下由 `node tools/analyze_city_visual_scope.mjs` 直接讀現有軌形與班表計算。`對角跨度` 是全站點外框，`P90 半徑` 是以站點中位中心計算、涵蓋 90% 站點的半徑；兩者落差很大時，代表少數遠端支線正在拉壞首屏。

| 地區 | 線／variant | 班次 | 中午同時運行 | 站點 | 對角跨度 | P90 半徑 | 班表大小 | 量化形態 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 挪威 | 28 | 1,830 | 124 | 406 | 1,403 km | 381 km | 1.9 MiB | 全國尺度 |
| 紐約 | 28 | 8,348 | 398 | 472 | 43 km | 16 km | 25.3 MiB | 緊湊都會 |
| 東京 | 6 | 2,818 | 99 | 149 | 37 km | 11 km | 6.4 MiB | 緊湊都會 |
| 瑞士景觀線 | 36 | 912 | 57 | 193 | 221 km | 119 km | 0.9 MiB | 區域路網過散 |
| 新加坡 | 8 | 3,866 | 114 | 171 | 44 km | 14 km | 7.8 MiB | 緊湊都會 |
| 倫敦 | 22 | 6,836 | 342 | 269 | 68 km | 20 km | 15.3 MiB | 緊湊都會 |
| 伊斯坦堡 | 23 | 7,122 | 211 | 241 | 73 km | 19 km | 9.1 MiB | 緊湊都會 |
| 雪梨 | 24 | 5,044 | 190 | 417 | 373 km | 111 km | 8.9 MiB | 區域路網過散 |
| 巴黎 | 41 | 19,716 | 502 | 993 | 207 km | 36 km | 40.6 MiB | 都會＋遠郊混合 |
| 墨爾本 | 53 | 8,107 | 397 | 1,447 | 570 km | 24 km | 34.6 MiB | 區域路網過散 |
| 布達佩斯 | 45 | 9,832 | 225 | 565 | 62 km | 10 km | 18.7 MiB | 緊湊都會 |
| 維也納 | 33 | 12,227 | 307 | 646 | 39 km | 9 km | 24.7 MiB | 緊湊都會 |

實際瀏覽器桌面截圖與 390×844 手機檢查和量化結果一致：五個首發核心在手機都沒有水平溢出，路網能形成明確主體。倫敦檢查時當地是 04:54，顯示 0 班屬營運前時段，不是載入錯誤。

## 五個首發核心的「完整」定義

### 三語內容也是 release gate

東京、紐約、倫敦、伊斯坦堡、新加坡除了路線與班表要完整，城市專屬內容也必須同時完成繁體中文（`zh-TW`）、英文（`en`）、日文（`ja`），任何一語缺漏都不能通過 `--release`。

逐城要檢查：城市名稱與介紹、路線／系統名稱、站名與轉乘、搜尋別名、資料來源／授權／更新日期、範圍排除與資料新鮮度警告、分享標題及城市專屬狀態文字。官方專有名稱保留原文，譯名與羅馬字放在語系／搜尋別名中，不以自動翻譯覆蓋官方站名。

`data/route_scope.json` 的 `localeStatus` 在內容完成並以該語系實機驗證後，才可由 `pending` 改成 `complete`。

### 1. 新加坡

- 範圍：6 套 MRT，加 Bukit Panjang、Sengkang、Punggol 3 套 LRT。
- CCL 必須包含 2026-07-12 通車的 Keppel、Cantonment、Prince Edward Road，成為完整環線。[LTA CCL6](https://www.lta.gov.sg/content/ltagov/en/upcoming_projects/rail_expansion/circle_line_6.html)
- 現有資料是人工班距合成。LTA DataMall 已在 2026-08-03推出 Train GTFS Schedule、Trip Updates 與 Service Alerts，下一版應以官方 GTFS 重建；即時資料可留到 App 後續版本。[LTA DataMall](https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html)
- 官方 v6.9 文件指定端點為 `GTFSScheduleTrain`，回傳 15 分鐘有效的 GTFS ZIP 連結；repo 已備妥 `tools/fetch_lta_train_gtfs.mjs`，只從 `LTA_DATAMALL_ACCOUNT_KEY` 環境變數讀金鑰。[LTA API v6.9](https://datamall.lta.gov.sg/content/dam/datamall/datasets/LTA_DataMall_API_User_Guide.pdf)
- 這城優先第一個做：範圍小、視覺最好、官方新 feed 剛好能取代人工班距。

### 2. 紐約

- 範圍：MTA NYCT Subway ＋ Staten Island Railway；不含 PATH、LIRR、Metro-North、NJ Transit。
- 現有 28 個 Subway service pattern 保留，補 `SI`。MTA 2026 schedule dataset 已明示包含 Staten Island Railway。[MTA Subway Schedules 2026](https://data.ny.gov/Transportation/MTA-Subway-Schedules-2026/g8es-h7gb)
- `nyc_schedule_dense.json` 的來源說明誤寫成 Entur，重建時必須修正成 MTA、記錄抓取日與 service date。

### 3. 東京

- 首發範圍：現有都營地下鐵 4 線＋日暮里・舍人線＋東京櫻花路面電車，再補 Tokyo Metro 9 線。
- 不宣稱涵蓋 JR 東日本、京王、小田急、東急、西武、東武、京急、京成等全部東京私鐵；那些若加入，應另立「東京廣域」層。
- Tokyo Metro 的 9 線與官方資料可由 [Tokyo Metro 路線圖](https://www.tokyometro.jp/en/subwaymap/index.html)及 [ODPT 官方資料目錄](https://ckan.odpt.org/en/dataset/?organization=tokyometro&tags=%E9%89%84%E9%81%93-railway)鎖定。

### 4. 倫敦

- 範圍：Underground、Elizabeth line、DLR、Tram，加 London Overground 六個現行線名；不含一般 National Rail。
- Overground 六線為 Lioness、Mildmay、Windrush、Weaver、Suffragette、Liberty。[TfL Overground](https://tfl.gov.uk/modes/london-overground/the-new-look-london-overground?intcmp=75267)
- TfL Unified API 可提供路線、地理拓撲與時刻；Journey Planner timetable feed 每週更新。下一版不應只在舊 Underground 拓撲上增加人工班距。[TfL Open Data](https://tfl.gov.uk/info-for/open-data-users/our-open-data?intcmp=3671)

### 5. 伊斯坦堡

- 首發範圍：Metro、tram、funicular 與 Marmaray；纜車可顯示，但不列入「軌道路線完整」宣稱。排除 Metrobus 與渡輪。
- 現有快照至少缺 M11、T2、T5、T6、F4，且 M3、M4、M5、M8、M9 已有延伸需要重建。[Metro İstanbul 現行路線](https://metro.istanbul/en/)
- 最大風險不是線少，而是現有 IBB GTFS calendar 原始效期停在 2024，過去曾技術性延長到 2026。這份資料只能當舊版視覺樣本，不能以「2026 現行班表」發布。

## 其餘七區怎麼處理

- 布達佩斯、維也納：畫面非常適合，保留第二波；先修已知少線與授權確認。
- 巴黎：保留資料，但首屏預設只開 Metro／Tram；RER／Transilien 用開關加入。現有 40.6 MiB 班表也需要按層懶載入。
- 雪梨：Sydney Trains 都會區、Metro、Light Rail 為核心；Intercity 另開，不參與市區 `fitBounds`。
- 墨爾本：Metro＋Tram 為核心；V/Line 另開。570 km 外框正是目前畫面大量留黑的主因。
- 瑞士：改成 Glacier Express／Bernina／GoldenPass 等景觀走廊策展，不做全瑞士「完整」。
- 挪威：移出首發。若日後保留，拆 Oslo 都會、Bergen／Flåm、Trondheim／北部長途等入口。

## 實作順序與 gate

1. 新加坡：接 LTA Train GTFS，補 3 LRT＋CCL6。
2. 紐約：補 SIR、修來源與抓取管線。
3. 東京：合併 Toei＋Tokyo Metro，先不擴 JR／私鐵。
4. 倫敦：補 Overground／Elizabeth／DLR／Tram，依模式拆資料檔。
5. 伊斯坦堡：先解決現行來源，再補路線；不得再延長過期 calendar。

每城完成時仍需通過 `route-audit-2026-08-31.md` 的共同 gate：官方 route ID、兩方向各一例、Y 字分支、反向重走偵測、站序／轉乘、授權與 Chromium＋WebKit 手機實測。

新加坡官方 GTFS 下載準備：

```bash
LTA_DATAMALL_ACCOUNT_KEY=... node tools/fetch_lta_train_gtfs.mjs /private/tmp/singapore-lta-gtfs.zip
```
