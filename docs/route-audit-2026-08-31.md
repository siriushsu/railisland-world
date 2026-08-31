# 軌島・世界路線稽核（2026-08-31）

這份稽核把「完整」拆成三件可驗證的事：官方現行路網範圍、本站實際收錄範圍、資料快照日期。城市型路網以官方現行固定軌道系統為目標；挪威、瑞士這類全國尺度資料若採策展範圍，必須明說，不用「完整」包裝選集。

機器可讀的同一份範圍在 [`data/route_scope.json`](../data/route_scope.json)，可執行檢查在 [`tools/audit_route_coverage.mjs`](../tools/audit_route_coverage.mjs)。

## 結論與優先順序

| 優先 | 地區 | 現況 | 已確認缺口／下一步 |
| --- | --- | --- | --- |
| P0 | 新加坡 | 6 套 MRT、8 個 shape variant | 補 Bukit Panjang／Sengkang／Punggol LRT；補 2026-07-12 通車的 CCL6 三站 Keppel、Cantonment、Prince Edward Road。LTA 現行頁列出 6 MRT＋3 LRT，[CCL6 官方頁](https://www.lta.gov.sg/content/ltagov/en/upcoming_projects/rail_expansion/circle_line_6.html)已標示通車日期。 |
| P0 | 東京 | 6 線：都營地下鐵 4 線＋日暮里・舍人線＋東京櫻花路面電車 | 由 [Tokyo Metro 官方路線圖](https://www.tokyometro.jp/en/subwaymap/index.html)與 [ODPT 官方資料目錄](https://ckan.odpt.org/en/dataset/?license_id=odpt-ptodbl&organization=tokyometro)補 9 條 Tokyo Metro。 |
| P0 | 巴黎 | 41 線 | 建置腳本曾為檔案大小主動略去 T7、T9、T10、T12、T13、T14；現在改成單城市懶載入後，這個限制不再合理。以 [Île-de-France Mobilités 現行路網圖](https://www.iledefrance-mobilites.fr/le-reseau/plans)補回。 |
| P0 | 伊斯坦堡 | 23 條舊快照路線／variant | 補 M11、T2、T5、T6、F4，並重建 M3、M4、M5、M8、M9 延伸；依 [Metro İstanbul](https://www.metro.istanbul/en/)現行官方圖逐線核對。 |
| P1 | 倫敦 | 只有 Underground，22 個分支 variant | 依 [TfL Tube and Rail](https://tfl.gov.uk/maps/track?intcmp=40400)補 London Overground、Elizabeth line、DLR、Tram；Overground 使用現行六個線名。 |
| P1 | 紐約 | Subway 28 個 service pattern | Subway 主體齊，但 [MTA 現行圖](https://www.mta.info/map/5341)另含 [Staten Island Railway](https://www.mta.info/schedules/subway/staten-island-railway)，本站尚缺。 |
| P1 | 維也納 | 5 U-Bahn＋Badner Bahn＋27 個 tram route／variant | 官方現行資訊可見 33、40、41、42，本站快照未收錄；刷新 GTFS 時先判斷是服務日篩選還是 route 被漏掉。來源：[Wiener Linien 路網圖](https://www.wienerlinien.at/web/wl-en/maps)、[時刻表](https://www.wienerlinien.at/web/guest/fahrplaene)。 |
| P1 | 墨爾本 | 13 V/Line＋16 Metro＋24 Tram，共 53 | 路線集合大致完整，但要用 Metro Tunnel 通車後 feed 重建並核對 Sunbury／Cranbourne／Pakenham 新運行形狀；來源：[PTV Maps](https://www.ptv.vic.gov.au/more/maps/)。 |
| P2 | 挪威 | 28 條旅客鐵路 service | 以 [Entur 現行 feed](https://developer.entur.org/stops-and-timetable-data/)刷新。Entur 明示 NeTEx 最完整、GTFS 隨供應者更新；刷新後要重跑雙方向與折返檢查。 |
| P2 | 瑞士 | 36 條景觀窄軌／代表性 service | 定位改成「景觀策展集」，不宣稱全瑞士完整。時刻可由 [Swiss 2026 GTFS](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020)刷新，但官方說明指出 GTFS 不含 shapes，幾何仍需獨立維護。 |
| 維持 | 雪梨 | 24 線，涵蓋 Train、Metro、Light Rail | 與 [TfNSW Train](https://transportnsw.info/travel-info/ways-to-get-around/train)、[Metro](https://transportnsw.info/travel-info/ways-to-get-around/metro)、[Light Rail](https://transportnsw.info/routes/light-rail)現行分類相符；納入例行刷新。 |
| 維持 | 布達佩斯 | 4 Metro＋5 HÉV＋tram，共 45 | 與 [BKK 固定軌道路網](https://bkk.hu/en/journey-planning/maps/fixed-rail-and-trolleybus-network/)及 [官方 Open Data](https://opendata.bkk.hu/)範圍相符；納入例行刷新。 |

## 每一城完成的共同 gate

1. 官方路線清單：route ID、公開名稱、營運狀態、起訖／分支、啟用日期都有來源。
2. 資料新鮮度：記錄 feed 下載日、採用 service day、時區與 DST；不得用人工延長舊 calendar 冒充現行資料。
3. 幾何完整度：每個營運分支各自建線；Y 字路網不得壓成單一 chainage。
4. 方向驗證：每條有方向的資料至少各跑一班正反向；端點、站序、行進方向與時刻皆一致。
5. 折返驗證：除點到走廊距離外，必跑「非相鄰點距離 <15m 且方向點積 <-0.5」的反向重走偵測。
6. 站名與轉乘：同母站多月台可合併，但環線重訪與遠距同名站不可誤併。
7. 授權：資料與地圖幾何分開記錄來源、授權、署名文字與衍生限制。
8. 瀏覽器驗收：桌機＋360／375／414／768 寬、真實觸控、Chromium＋WebKit；每城至少驗城市切換、正反向列車、跟隨、站牌、搜尋與分享深連結。

## 稽核指令

```bash
# 現有快照結構與必要 route ID 不得退步；已知缺口只列出，不阻擋開發
node tools/audit_route_coverage.mjs

# 準備宣稱「路線完整」或正式發布時使用；blockingGaps 未清空即失敗
node tools/audit_route_coverage.mjs --release
```

`--release` 現在應該是紅燈；這是刻意的。只有路線真的補齊，或把產品範圍明確改成策展集並寫進公開說明，才可清掉對應缺口。
