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
| 東京 | 16 | 8,628 | 261 | 328 | 40 km | 10 km | 15.8 MiB | 緊湊都會 |
| 瑞士景觀線 | 36 | 912 | 57 | 193 | 221 km | 119 km | 0.9 MiB | 區域路網過散 |
| 新加坡 | 13 | 6,060 | 152 | 219 | 44 km | 13 km | 11.1 MiB | 緊湊都會 |
| 倫敦 | 67 | 8,590 | 290 | 506 | 99 km | 21 km | 16.7 MiB | 緊湊都會 |
| 伊斯坦堡 | 23 | 7,122 | 211 | 241 | 73 km | 19 km | 9.1 MiB | 緊湊都會 |
| 雪梨 | 24 | 5,044 | 190 | 417 | 373 km | 111 km | 8.9 MiB | 區域路網過散 |
| 巴黎 | 41 | 19,716 | 502 | 993 | 207 km | 36 km | 40.6 MiB | 都會＋遠郊混合 |
| 墨爾本 | 53 | 8,107 | 397 | 1,447 | 570 km | 24 km | 34.6 MiB | 區域路網過散 |
| 布達佩斯 | 45 | 9,832 | 225 | 565 | 62 km | 10 km | 18.7 MiB | 緊湊都會 |
| 維也納 | 33 | 12,227 | 307 | 646 | 39 km | 9 km | 24.7 MiB | 緊湊都會 |

實際瀏覽器桌面截圖與 390×844 手機檢查和量化結果一致：五個首發核心在手機都沒有水平溢出，路網能形成明確主體。倫敦檢查時當地是 04:54，顯示 0 班屬營運前時段，不是載入錯誤。

## 五個首發核心的「完整」定義

### 品質優先順序：路線正確，再求時刻準確

首發硬條件依序是：官方現行營運範圍完整；軌道幾何、站序、分支、轉乘與營運方向正確；每一條營運路線／分支都有列車可流動，且正反方向各驗一例。分鐘級準確時刻、即時位置、準點率與誤點校正都不是首發條件。

不能因為舊資料中「已經有這條線」就視為驗證通過。五城必須逐線對照官方現行路網並留下 evidence，才可把 `routeVerificationStatus` 改為 `complete`；新加坡、紐約、東京、倫敦已在 2026-08-31 完成，伊斯坦堡仍是 pending。正式發布時，官方路網查證日不得超過 45 天，避免剛補完就已落後新通車或延伸。

沒有可靠逐班時刻時，可以用官方公告班距或合理的合成班距產生動畫；但 UI、資料 metadata 與三語說明都必須明示「班距模擬／位置示意」，不得寫成官方即時位置或現行逐班時刻。列車仍須沿正確軌形通過正確站序，不能為了視覺密度移動真實路線、站點或車輛位置。

### 三語內容也是 release gate

東京、紐約、倫敦、伊斯坦堡、新加坡除了路線與班表要完整，城市專屬內容也必須同時完成繁體中文（`zh-TW`）、英文（`en`）、日文（`ja`），任何一語缺漏都不能通過 `--release`。

逐城要檢查：城市名稱與介紹、路線／系統名稱、站名與轉乘、搜尋別名、資料來源／授權／更新日期、範圍排除與資料新鮮度警告、分享標題及城市專屬狀態文字。官方專有名稱保留原文，譯名與羅馬字放在語系／搜尋別名中，不以自動翻譯覆蓋官方站名。

`data/route_scope.json` 的 `localeStatus` 在內容完成並以該語系實機驗證後，才可由 `pending` 改成 `complete`。

### 1. 新加坡

- 範圍：6 套 MRT，加 Bukit Panjang、Sengkang、Punggol 3 套 LRT。
- CCL 必須包含 2026-07-12 通車的 Keppel、Cantonment、Prince Edward Road，成為完整環線。[LTA CCL6](https://www.lta.gov.sg/content/ltagov/en/upcoming_projects/rail_expansion/circle_line_6.html)
- 2026-08-31 路線稽核已完成：資料含 CCL 主環、Dhoby Ghaut—Prince Edward Road 分支、Bukit Panjang LRT、Sengkang 東／西環、Punggol 東／西環，共 13 個營運 variant。NSL 27、EWL 35（含樟宜支線）、NEL 17、CCL 33、DTL 35、TEL 現行 27 站皆已逐線鎖定站序與端點；未營運的 Bedok South、Sungei Bedok 不納入現行路網。
- 185 個唯一站名與 13 個路線名稱已完成繁中、英文、日文索引。繁中採 LTA 官方中文名轉繁體；日文既有站優先參考新加坡旅遊局指南，新站依 LTA 英文名一致轉寫，並在來源檔明示不是 LTA 官方日文命名。
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
- 2026-08-31 路線稽核已完成：Tokyo Metro G／M／H／T／C／Y／Z／N／F 九線與 Toei 六線同框；丸ノ內線方南町支線獨立建線，千代田線完整接至北綾瀨。官方九線站數 19／28／22／23／20／24／14／19／16 逐線鎖定。[Tokyo Metro 路線・站資訊](https://www.tokyometro.jp/lang_en/station/index.html)
- Tokyo Metro 站名使用官方繁中、英文、日文頁面；Toei 日文與英文取官方 GTFS-JP translations。東京都交通局未提供對等的地鐵繁中站名資料集，因此 Toei 專有站名在繁中介面保留官方日文專名。
- Toei 2,818 班為官方 GTFS-JP 普通平日 service；Tokyo Metro 5,810 班是明示合成班距，只求正確路線上可見雙向流動。未取得 ODPT consumerKey 前不宣稱是官方逐班時刻。

### 4. 倫敦

- 範圍：Underground、Elizabeth line、DLR、Tram，加 London Overground 六個現行線名；不含一般 National Rail。
- 2026-08-31 已用 TfL Unified API 的 2026-08-27 現行 Route/Sequence 快照重建 20 個品牌線別：Underground 33、DLR 6、Elizabeth 10、Overground 12、Tram 6，共 67 個端點／via 路徑。Central、District、Northern 原先漏掉的營運分支也一起補齊。[TfL Tube and Rail](https://tfl.gov.uk/maps/track?intcmp=40400)
- Overground 六線為 Lioness、Mildmay、Windrush、Weaver、Suffragette、Liberty；每個分支依現行官方端點獨立建線。[TfL Overground](https://tfl.gov.uk/modes/london-overground/the-new-look-london-overground?intcmp=75267)
- Croydon Tram 市中心單向環按 TfL 六個方向性站序建置，動畫不會把單向路段反向虛構。其餘 61 個路徑均有正反向流動。
- 464 個唯一站名、67 個路徑與 20 個線別已完成繁中、英文、日文索引。TfL 未提供官方中日站名集，因此專有站名在中日介面保留官方英文，不杜撰營運機構譯名。
- 8,590 班為明示的合成班距，只求正確路線上的可見流動；分鐘級時刻可日後再接 TfL／National Rail timetable，不阻擋首發。[TfL Open Data](https://tfl.gov.uk/info-for/open-data-users/our-open-data?intcmp=3671)

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

1. 新加坡：現行 6 MRT＋3 LRT 的路線、站序、分支、雙向流動與三語內容已完成；LTA Train GTFS 是時刻增強，不阻擋路線首發。
2. 紐約：補 SIR、修來源與抓取管線。
3. 東京：Toei＋Tokyo Metro 路線、分岔、雙向流動與三語內容已完成；官方 Metro GTFS 為後續時刻增強，先不擴 JR／私鐵。
4. 倫敦：20 個 TfL 現行線別、67 個路徑、方向性流動與三語內容已完成；官方逐班時刻列為後續增強。
5. 伊斯坦堡：先以現行官方路網補線與延伸；舊 calendar 若暫作動畫樣板，必須在三語 UI 與 metadata 明示為模擬。

每城完成時仍需通過 `route-audit-2026-08-31.md` 的共同 gate：官方 route ID、兩方向各一例、Y 字分支、反向重走偵測、站序／轉乘、授權與 Chromium＋WebKit 手機實測。

新加坡官方 GTFS 下載準備：

```bash
LTA_DATAMALL_ACCOUNT_KEY=... node tools/fetch_lta_train_gtfs.mjs /private/tmp/singapore-lta-gtfs.zip
```
