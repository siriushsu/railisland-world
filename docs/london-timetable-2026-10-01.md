# 倫敦官方時刻表（2026-10-01）

Underground、DLR、Tram 共 13,059 班改用 TfL 官方平日時刻，取代原本的合成班距。

## 來源

- TfL Unified API 逐站時刻表：`/Line/{id}/Timetable/{stopPointId}?direction={outbound|inbound}`。Powered by TfL Open Data。
- 平日取「Monday - Thursday」，沒有就依序取「Monday - Friday」、「Wednesdays」、「Tuesdays」、「Thursdays」（環線、漢默史密斯及城市線的平日班表只分到單日）。
- `tfl.gov.uk` 的整包 TransXChange 時刻檔對建置環境回 403，所以只用 Unified API。

## 重建方法（`tools/build_london_timetable.mjs`）

1. 每條線、每個方向取 `/Route/Sequence` 的 orderedLineRoutes，排出「上游先」的站序。
2. 依站序逐站查時刻表（共 1,250 次，快取在 `.cache/tfl-timetable`）。每筆發車附帶到下游各站的分鐘數。
3. 某站的發車若在 ±1.5 分鐘內對得上上游已知班次經過該站的時刻、且下一站相同，就是同一班；對不上的就是在該站起駛的班次（區間車）。
4. TfL 的站間時刻有時同一站連續出現兩次（到站、離站），合併成一站。
5. 每班對回 `data/london.json` 的路徑 variant：同母線、依站碼順序包含全部停靠站的最短 variant。單向環（Tram）不可反向對應。對不上的 5 班捨棄，96 班只保留能對上的連續段。
6. 時刻精度為分鐘；同一分鐘的相鄰站往後推幾秒，維持時間單調。

## 沒有官方時刻的部分

- **Elizabeth line 與六條 London Overground**（Liberty、Lioness、Mildmay、Suffragette、Weaver、Windrush）：TfL 逐站時刻 API 對國鐵站碼（910G）回 404。2,724 班沿用原本的合成班距，標 `estimated`。要改官方時刻需要 National Rail（Rail Data Marketplace）的時刻資料。
- **DLR Lewisham–Stratford**：官方平日時刻沒有直通班（Stratford 只到 Canary Wharf，Lewisham 往 Bank 或 Canary Wharf）。路徑保留在地圖上，不虛構班次；`tools/verify_london_routes.mjs` 列為例外。

## 抽查

- 維多利亞線：一天 975 班（原模擬 250 班）；Brixton→Walthamstow Central 全程 30.5 分鐘；Oxford Circus 早上 8～9 點每 2～3 分鐘一班；首班 05:21、末班 00:53。
- 班表 28.8 MB（原 17.5 MB）。

## 重建

```bash
NODE_USE_ENV_PROXY=1 node tools/build_london_timetable.mjs           # 第一次會抓 TfL（約 10 分鐘）
# 要重建 Elizabeth／Overground 的合成班次時：
node tools/headway2sched.mjs london && cp data/london_schedule_dense.json /tmp/london_synth.json
node tools/build_london_timetable.mjs --offline --synthetic-from /tmp/london_synth.json
node tools/verify_london_routes.mjs
```

`tools/headway2sched.mjs all` 已不再重建倫敦，避免蓋掉官方時刻。
