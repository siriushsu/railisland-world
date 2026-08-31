# 軌島・世界路線稽核（2026-08-31）

這份稽核把「完整」拆成三件可驗證的事：官方現行路網範圍、本站實際收錄範圍、資料快照日期。城市型路網以官方現行固定軌道系統為目標；挪威、瑞士這類全國尺度資料若採策展範圍，必須明說，不用「完整」包裝選集。

產品首發已另依實際桌機／手機構圖與路網跨度分級：東京、紐約、倫敦、伊斯坦堡、新加坡為首發核心；其餘地區的保留、拆層與延後理由見 [`city-scope-review-2026-08-31.md`](city-scope-review-2026-08-31.md)。本表的優先級已依此決策更新。

機器可讀的同一份範圍在 [`data/route_scope.json`](../data/route_scope.json)，可執行檢查在 [`tools/audit_route_coverage.mjs`](../tools/audit_route_coverage.mjs)。

## 結論與優先順序

| 優先 | 地區 | 現況 | 已確認缺口／下一步 |
| --- | --- | --- | --- |
| P0 | 新加坡 | 13 個營運 variant：6 MRT、CCL 主環／分支與 3 LRT | 2026-08-31 已依 LTA 現行圖與六條 MRT 官方頁完成逐線稽核：NSL 27、EWL 35（含樟宜支線）、NEL 17、CCL 33、DTL 35、TEL 現行 27 站；Bukit Panjang、Sengkang、Punggol LRT 亦完成逐環站序與雙向流動驗證。185 個唯一站名與 13 個路線名稱已補齊繁中／英／日。人工班距繼續明示為模擬，[LTA DataMall Train GTFS](https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html)列為時刻增強，不阻擋路線首發。 |
| P0 | 東京 | Toei 6 線＋Tokyo Metro 9 線，共 16 個路徑 variant | 2026-08-31 已由 [Tokyo Metro 官方繁中](https://www.tokyometro.jp/lang_tcn/station/index.html)、[英文](https://www.tokyometro.jp/lang_en/station/index.html)、[日文](https://www.tokyometro.jp/station/index.html)各線頁逐站複核 9 線；方南町支線獨立成 `Mb`，千代田線接完整至北綾瀨。Toei 2,818 班沿用 [東京都交通局官方 GTFS-JP](https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip)普通平日時刻；Tokyo Metro 使用明示合成班距，不冒充官方逐班時刻。258 個唯一站名與 16 個路徑名已有繁中／英／日索引。 |
| P0 | 伊斯坦堡 | 26 個可見路徑：12 Metro、6 Tram、4 Funicular、Marmaray／B2，另含 2 條補充纜車 | 2026-08-31 已依 [Metro İstanbul](https://www.metro.istanbul/en/)、UAB、TCDD 與 IETT 現行官方資料完成逐線重建。M11 已接通 Gayrettepe－Halkalı，M3／M4／M5／M8／M9 延伸及 T2／T5／T6／F4 均補齊；T3 保留單向環，未通車 T7 排除。277 個唯一站名與 26 個路徑／類型已有繁中、英文、日文；7,679 班為明示合成班距，臨時異動請以官方公告為準。 |
| P0 | 倫敦 | TfL 20 個現行線別，共 67 個端點／via variant | 2026-08-31 已用 [TfL Unified API](https://api.tfl.gov.uk/Line/Mode/tube,overground,elizabeth-line,dlr,tram)逐線重建：Underground 33、DLR 6、Elizabeth 10、Overground 12、Tram 6。Overground 採 [TfL 現行六線名](https://tfl.gov.uk/modes/london-overground/the-new-look-london-overground?intcmp=75267)；Tram 市中心單向環保留六個官方方向路徑。464 個唯一站名、67 個路徑與 20 個線別已有繁中／英／日索引；TfL 未提供官方中日站名者保留官方英文專名。8,590 班為明示合成班距，不冒充即時位置或官方逐班時刻。 |
| P0 | 紐約 | 28 個 Subway service＋Staten Island Railway，共 36 個 route variant | 2026-08-31 已用 [MTA regular static GTFS](https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip)重建 8,497 班官方時刻與線形；[MTA 現行圖](https://www.mta.info/map/5341)及 [SIR 官方時刻表](https://www.mta.info/schedules/subway/staten-island-railway)逐線複核。SIR 21 站已加入，A／4／5 分支與 F／N 不同走廊各自建線，公開 metadata 也已改回 MTA。MTA 未發布中日官方站名集，因此站名保留官方英文，城市與路線內容提供繁中／英／日。 |
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

`--release` 現在應為綠燈：新加坡、紐約、東京、倫敦與伊斯坦堡五個首發核心城市的現行路線、基本流動、來源標示及三語 gate 全部通過。它只把現行路線、基本流動／誠實標示與三語內容列為硬條件。分鐘級時刻準確、即時位置與誤點校正列在 `scheduleEnhancements`，不會阻擋首發。
