# 軌島・世界 App 第三方聲明

- Capacitor 8.4.2、Capacitor App 8.1.1、Capacitor Share 8.0.1：MIT License。
- MapLibre GL JS 5.9.0：BSD 3-Clause License（2026-10 起為唯一地圖引擎，不再使用 Leaflet）。
- three.js r170：MIT License（立體列車）。
- PMTiles：BSD 3-Clause License；fflate：MIT License（立體列車模組隨附）。
- 立體列車外觀：沿用軌島台灣版自製的 C381 與文湖線示意網格，色帶依路線換色，不代表紐約或東京的實際車型。
- 線上底圖：OpenFreeMap、OpenMapTiles、OpenStreetMap contributors（ODbL）。
- 各城市交通資料的來源與授權：對應 `data/*.json` 的 `source_notes`。

完整授權全文與圖資署名位於 `licenses/`，建置時合併為 App bundle 的 `third-party-licenses.txt`。版本升級時必須重新對照 `package-lock.json` 與 `vendor/` 檔頭。
