# 軌島・世界路線稽核（2026-08-31）

這份稽核把「完整」拆成三件可驗證的事：官方現行路網範圍、本站實際收錄範圍、資料快照日期。城市型路網以官方現行固定軌道系統為目標；挪威、瑞士這類全國尺度資料若採策展範圍，必須明說，不用「完整」包裝選集。

產品首發已另依實際桌機／手機構圖與路網跨度分級：東京、紐約、倫敦、伊斯坦堡、新加坡為首發核心；其餘地區的保留、拆層與延後理由見 [`city-scope-review-2026-08-31.md`](city-scope-review-2026-08-31.md)。本表的優先級已依此決策更新。

機器可讀的同一份範圍在 [`data/route_scope.json`](../data/route_scope.json)，可執行檢查在 [`tools/audit_route_coverage.mjs`](../tools/audit_route_coverage.mjs)。

## 結論與優先順序

| 優先 | 地區 | 現況 | 已確認缺口／下一步 |
| --- | --- | --- | --- |
| P0 | 新加坡 | 13 個營運 variant：6 MRT、CCL 主環／分支與 3 LRT | 2026-08-31 已依 LTA 現行圖與六條 MRT 官方頁完成逐線稽核：NSL 27、EWL 35（含樟宜支線）、NEL 17、CCL 33、DTL 35、TEL 現行 27 站；Bukit Panjang、Sengkang、Punggol LRT 亦完成逐環站序與雙向流動驗證。185 個唯一站名與 13 個路線名稱已補齊繁中／英／日。人工班距繼續明示為模擬，[LTA DataMall Train GTFS](https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html)列為時刻增強，不阻擋路線首發。 |
| P0 | 東京 | 6 線：都營地下鐵 4 線＋日暮里・舍人線＋東京櫻花路面電車 | 由 [Tokyo Metro 官方路線圖](https://www.tokyometro.jp/en/subwaymap/index.html)與 [ODPT 官方資料目錄](https://ckan.odpt.org/en/dataset/?license_id=odpt-ptodbl&organization=tokyometro)補 9 條 Tokyo Metro。 |
| P0 | 伊斯坦堡 | 23 條舊快照路線／variant | 補 M11、T2、T5、T6、F4，並重建 M3、M4、M5、M8、M9 延伸；依 [Metro İstanbul](https://www.metro.istanbul/en/)現行官方圖逐線核對。 |
| P0 | 倫敦 | 只有 Underground，22 個分支 variant | 依 [TfL Tube and Rail](https://tfl.gov.uk/maps/track?intcmp=40400)補 London Overground、Elizabeth line、DLR、Tram；Overground 使用現行六個線名。 |
| P0 | 紐約 | Subway 28 個 service pattern | Subway 主體齊，但 [MTA 現行圖](https://www.mta.info/map/5341)另含 [Staten Island Railway](https://www.mta.info/schedules/subway/staten-island-railway)，本站尚缺；現有來源說明誤寫 Entur 也要一併修正。 |
| P1 | 維也納 | 5 U-Bahn＋Badner Bahn＋27 個 tram route／variant | 官方現行資訊可見 33、40、41、42，本站快照未收錄；刷新 GTFS 時先判斷是服務日篩選還是 route 被漏掉。來源：[Wiener Linien 路網圖](https://www.wienerlinien.at/web/wl-en/maps)、[時刻表](https://www.wienerlinien.at/web/guest/fahrplaene)。 |
| P1 | 布達佩斯 | 4 Metro＋5 HÉV＋tram，共 45 | 與 [BKK 固定軌道路網](https://bkk.hu/en/journey-planning/maps/fixed-rail-and-trolleybus-network/)及 [官方 Open Data](https://opendata.bkk.hu/)範圍相符；列為第二波。 |
| 拆層 | 巴黎 | 41 線 | 建置腳本曾主動略去 T7、T9、T10、T12、T13、T14；補線前先把 Metro／Tram 與 RER／Transilien 拆成預設核心與郊區層。[Île-de-France Mobilités](https://www.iledefrance-mobilites.fr/le-reseau/plans) |
| 拆層 | 雪梨 | 24 線，涵蓋 Train、Metro、Light Rail | 官方範圍大致相符，但 Intercity 導致首屏跨度 373 km；都會核心與城際線先拆層。[TfNSW Train](https://transportnsw.info/travel-info/ways-to-get-around/train)、[Metro](https://transportnsw.info/travel-info/ways-to-get-around/metro)、[Light Rail](https://transportnsw.info/routes/light-rail) |
| 拆層 | 墨爾本 | 13 V/Line＋16 Metro＋24 Tram，共 53 | Metro／Tram 與 V/Line 先拆層，再以 Metro Tunnel 通車後 feed 重建。[PTV Maps](https://www.ptv.vic.gov.au/more/maps/) |
| 策展 | 瑞士 | 36 條景觀窄軌／代表性 service | 改成一次一組景觀走廊，不宣稱全瑞士完整。時刻可由 [Swiss 2026 GTFS](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020)刷新，但 GTFS 不含 shapes。 |
| 延後 | 挪威 | 28 條旅客鐵路 service | 全國跨度 1,403 km，不適合首發同框；若保留，先拆城市或長途走廊，再用 [Entur 現行 feed](https://developer.entur.org/stops-and-timetable-data/)刷新。 |

## 每一城完成的共同 gate

1. 官方路線清單：route ID、公開名稱、營運狀態、起訖／分支、啟用日期都有來源。
2. 路線新鮮度：官方現行 route、營運端點、通車／停駛日期必須刷新；記錄資料查證日，不能拿舊路網冒充現行完整。
   首發五城在 release 時的官方路網查證日不得超過 45 天；既有路線也要逐線複核，不因檔案已存在就自動算完成。
3. 幾何完整度：每個營運分支各自建線；Y 字路網不得壓成單一 chainage。
4. 方向驗證：每條有方向的資料至少各跑一班正反向；端點、站序、行進方向與時刻皆一致。
5. 折返驗證：除點到走廊距離外，必跑「非相鄰點距離 <15m 且方向點積 <-0.5」的反向重走偵測。
6. 站名與轉乘：同母站多月台可合併，但環線重訪與遠距同名站不可誤併。
7. 授權：資料與地圖幾何分開記錄來源、授權、署名文字與衍生限制。
8. 基本流動：每一條營運路線與分支都要能看到列車，正反方向各驗至少一例；可用明示的合成班距，不要求分鐘級準時或即時位置。
9. 誠實標示：合成班距與舊班表若只作動畫樣板，UI 和 metadata 必須明示「模擬／示意」，不得宣稱官方現行時刻或即時位置。
10. 三語內容：首發核心五城都要完成繁中、英文、日文；包含城市介紹、路線／站名、轉乘、搜尋別名、來源／授權／更新日期、範圍警告與分享文字。
11. 瀏覽器驗收：桌機＋360／375／414／768 寬、真實觸控、Chromium＋WebKit；每城至少驗城市切換、正反向列車、跟隨、站牌、搜尋與分享深連結，並逐一切換 `zh-TW`／`en`／`ja`。

## 稽核指令

```bash
# 現有快照結構與必要 route ID 不得退步；已知缺口只列出，不阻擋開發
node tools/audit_route_coverage.mjs

# 首發發布 gate：只檢查 productTier=launch-core 的五個核心城市
node tools/audit_route_coverage.mjs --release

# 全部 12 區都要無缺口時才用；策展／拆層城市也會納入
node tools/audit_route_coverage.mjs --all-release
```

`--release` 現在仍應是紅燈，因為東京、紐約、倫敦、伊斯坦堡尚有已知缺口；新加坡的路線與三語 gate 已先轉綠。它只把現行路線、基本流動／誠實標示與三語內容列為硬條件。分鐘級時刻準確、即時位置與誤點校正列在 `scheduleEnhancements`，不會阻擋首發。
