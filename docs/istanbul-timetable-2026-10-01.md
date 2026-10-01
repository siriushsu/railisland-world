# 伊斯坦堡官方時刻表（2026-10-01）

Metro İstanbul 營運的 19 個路徑（M1A、M1B、M2、M2A、M3～M9、T1、T3、T4、T5、F1、F4、TF1、TF2）共 5,783 班改用官方平日時刻，取代原本的合成班距。

## 來源

- Metro İstanbul 手機 App 用的公開 API：`https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2`，不需金鑰。
  - `GetLines`、`GetStations`、`GetDirectionById/{lineId}`：路線、站序、方向。
  - `GetTimeTable`（POST `{BoardingStationId, LineId, Language, DirectionId, DateTime}`）：該站、該方向從指定時間起約一小時內的發車時刻。
- 服務日取 2026-10-07（星期三）。
- 不用的來源：
  - 伊斯坦堡市開放資料平台的「Public Transport GTFS」服務期只到 2024-12-31，缺 M11、T5 和 2024 年以後的延伸。
  - metro.istanbul 網站的逐站時刻端點有防自動化檢查。

## 重建方法（`tools/build_istanbul_timetable.mjs`）

1. API 的線名對回 `data/istanbul.json` 的路徑（M2 的 Sanayi Mahallesi–Seyrantepe 對 M2A）。每個方向只取起訖兩站之間那一段，所以 M7 的分段運轉、T1 的 Cevizlibağ–Eminönü 區間車都照官方方向收錄。
2. 各方向起點站從 04:00 到隔日 00:00 逐小時查，得到全天發車時刻。
3. 其他各站查 08:00 與 14:00 兩個時段，比對前後兩站的發車時刻推出站間時間（含停站）。班距固定時，差一個班距也對得上，所以在命中數接近最高的候選裡取最接近距離推估的值。速度超出 8～90 km/h 或對不上時，改用距離推估（metro 32、tram 16、纜索 20、纜車 6 km/h）。
4. 只有兩站的往返線（F1、F4、TF1、TF2）兩端同時發車，比對不出站間時間，直接用距離推估。
5. 快取在 `.cache/ibb/tt`（2,397 次查詢），每次重建的逐線報告寫到 `.cache/ibb/build-report.json`。

## 沒有官方時刻的部分

M11（UAB）、T2 與 F2（IETT）、T6、F3、Marmaray 與 B2（TCDD／UAB）不在 Metro İstanbul 的 API。這 2,402 班沿用原本的合成班距，標 `estimated`。

中途起駛的區間車沒有另外建班次：每班都從方向起點出發。

## 抽查

| 路線 | 平日班數（單向） | 全程 | 首班～末班 |
|---|---|---|---|
| M2 Yenikapı→Hacıosman | 179 | 31 分 | 05:57～00:00 |
| M1A Yenikapı→Atatürk Havalimanı | 132 | 35 分 | 06:05～00:00 |
| T1 Kabataş→Bağcılar | 351 | 62 分 | 06:00～23:59 |
| M4 Kadıköy→Sabiha Gökçen | 193 | 52 分 | 06:00～23:59 |

Şişhane（M2）早上 8:30 前後兩個方向都是 4～5 分鐘一班。

班表 8.5 MB（原 6.5 MB）。

## 重建

```bash
NODE_USE_ENV_PROXY=1 node tools/build_istanbul_timetable.mjs     # 第一次會抓 API
# 要重建 M11 等線的合成班次時：
node tools/headway2sched.mjs istanbul && cp data/istanbul_schedule_dense.json /tmp/ist_synth.json
node tools/build_istanbul_timetable.mjs --offline --synthetic-from /tmp/ist_synth.json
node tools/verify_istanbul_routes.mjs
```

`tools/headway2sched.mjs all` 已不再重建伊斯坦堡，避免蓋掉官方時刻。
