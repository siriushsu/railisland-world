# 軌島・世界 / Rail Island World

把世界各城的公開鐵道時刻表畫成一張會動的地圖。這是 [軌島台灣版](https://railisland.tw)的獨立姊妹專案；程式、資料與發布流程皆分開，不會把海外城市內容放進台灣版 repo。

目前已接上台灣版 2026-10-01 的現行 UI 與多語骨架（地圖引擎為 MapLibre GL），保留地圖、時鐘、速度、列車跟隨、車站看板、搜尋、主題與分享機制。台灣版之後新增的台灣專屬功能（台鐵誤點、公車轉乘、車庫、台南歷史重播、週末活動、地景 3D、衛星影像）在世界版以 `WORLD_BUILD`／`html.world-ui` 關閉；同步方法見 [docs/taiwan-ui-sync-2026-10-01.md](docs/taiwan-ui-sync-2026-10-01.md)。世界版一次只載入一座城市，以免 12 份大型班表同時下載或拖慢手機。

## 首發範圍

首發核心是東京、紐約、倫敦、伊斯坦堡、新加坡。布達佩斯與維也納列為第二波；巴黎、雪梨、墨爾本要先把都會核心與遠郊／城際拆層；瑞士改成景觀走廊策展，挪威全國同框則延後並考慮拆成城市或長途走廊。

五個首發核心的城市專屬內容均以繁體中文、英文、日文三語為發布必要條件；路線資料補完但翻譯未驗證，仍不算完成。

首發品質以路線為先：官方現行範圍、軌形、站序、分支與轉乘必須正確完整，每個營運分支都要能看到雙向列車流動。分鐘級準時、即時位置與誤點校正暫不要求；沒有可靠逐班時刻時可用明示的合成班距，但不得宣稱為即時資料。

既有路線也要逐線重新對照官方資料，不因檔案已存在就算通過；正式發布所依據的官方路網查證日不得超過 45 天。

這個決定來自實際桌機／手機構圖與路網跨度量測，不只是主觀挑城市。詳見 [12 區視覺範圍檢視](docs/city-scope-review-2026-08-31.md)；完整路線缺口與官方來源見 [2026-08-31 路線稽核](docs/route-audit-2026-08-31.md)。

## 本機執行

本專案沒有 build step：

```bash
python3 -m http.server 5188
```

開啟 `http://127.0.0.1:5188/`。資料快照結構檢查：

```bash
node tools/audit_route_coverage.mjs

# 比較路網跨度、站點分布、同時運行班次與班表大小
node tools/analyze_city_visual_scope.mjs

# 取得新加坡官方 Train GTFS（AccountKey 不寫進 repo）
LTA_DATAMALL_ACCOUNT_KEY=... node tools/fetch_lta_train_gtfs.mjs /private/tmp/singapore-lta-gtfs.zip

# 重建／驗證新加坡 CCL6 與三套 LRT（首次執行會讀取 OSM 公開 relation）
node tools/build_singapore.mjs --refresh
node tools/headway2sched.mjs singapore
node tools/verify_singapore_routes.mjs

# 重建／驗證新加坡 185 站與 13 個路線 variant 的繁中、英文、日文索引
node tools/build_singapore_i18n.mjs
node tools/verify_singapore_i18n.mjs
```

## 資料與授權

各城市資料源與範圍記錄於 [`data/route_scope.json`](data/route_scope.json)以及各 `data/*_schedule_dense.json` 的 `source_notes`。底圖來源為 OpenStreetMap／CARTO；各營運資料仍依原發布者授權與署名要求使用。

本站是個人愛好者專案，與資料提供者、鐵路營運機構及交通主管機關均無隸屬或背書關係。動畫依時刻表推演，不代表即時列車位置或正式旅運資訊。
