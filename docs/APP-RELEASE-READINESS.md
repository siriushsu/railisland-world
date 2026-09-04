# 軌島・世界 App 上架整備（2026-09-04）

## 結論

近期上架採「五城免費 companion app」最穩妥：東京、紐約、倫敦、伊斯坦堡、新加坡。網站繼續展示十二個地區；App 不以城市數量追進度，而以通過路線、流動、來源與三語閘門為準。

這個版本定位為台灣版軌島的世界鐵道輔助作品，不共用帳號、訂閱、定位或資料庫。第一版只保留互動地圖、當地時鐘、列車／車站查看、跟隨、搜尋、三語與原生分享。這能降低審核、隱私、權限與跨專案事故風險。

## 內容完整度

| 地區 | 可見路徑 | v1 App | 現況 |
|---|---:|---|---|
| 東京 | 16 | 是 | 首發閘門通過；目前為 Tokyo Metro＋都營範圍，不宣稱日本全國或含 JR／全部私鐵 |
| 紐約 | 36 | 是 | MTA Subway services＋Staten Island Railway；分支分開呈現 |
| 倫敦 | 67 | 是 | Underground、Elizabeth line、DLR、Tram、London Overground 的營運路徑分拆 |
| 伊斯坦堡 | 26 | 是 | Metro、電車、纜索鐵路、Marmaray 等現行範圍 |
| 新加坡 | 13 | 是 | 6 套 MRT、3 套 LRT 與營運分支 |
| 布達佩斯 | 45 | 第二批候選 | 視覺範圍集中，可優先做完整三語／真機複驗 |
| 維也納 | 35 | 第二批候選 | 視覺範圍集中，可與布達佩斯同批 |
| 瑞士景觀線 | 47 | 暫緩 | 長距離策展型；仍有 13 個同名站重複投影與路線命名消歧工作 |
| 巴黎 | 49 | 暫緩 | 站點與代表線形的對齊比例仍不理想，需把主幹／郊區層級拆清楚 |
| 雪梨 | 24 | 暫緩 | 路網地域跨度大，需設核心與城際顯示層級 |
| 墨爾本 | 55 | 暫緩 | 長距離離群路徑使全景視覺失焦，需分層或另做區域視角 |
| 挪威 | 30 | 暫緩 | 官方 GTFS 仍有一組已知幾何缺口，F1／F2／F8 尤其需補；F8 Ofotbanen 優先 |

2026-09-04 的 `tools/audit_route_coverage.mjs --release` 結果：首發五城的路線缺口、全線檢查、流動、來源與繁中／英文／日文缺口均為 0；十二地區合計仍有挪威 1 個已知 route gap。瑞士單元測試 18/18 通過。

## 已落地的 App 基礎

- App 專用設定集中在 `app/world-app.config.json`，第一版城市數量固定為五城，預設東京。
- Capacitor iOS／Android 共用殼；bundle/application id 已由開發者於 2026-09-04 確認鎖定為 `tw.railisland.world`，與台灣版分開。
- 建置只複製五城資料，防止把成熟度不同的七個地區或 241 MB 全資料誤塞入 App。
- 保留原本軌島 icon，不製作或申請新 icon。
- 原生功能只帶 App metadata 與系統分享；沒有 Firebase、RevenueCat、定位、通知或廣告 SDK。
- App 包內的 Leaflet 改成本地檔；OpenFreeMap 是唯一日常底圖，不使用需要 API key 的來源。
- 新增繁中／英文／日文隱私權政策、服務條款與支援頁，首頁有可見入口。
- 三語 Apple／Google Play 商店文案、審核備註、隱私／Data safety 與分級建議答案已集中在 `app/store/`。
- 已產生 60 張五城三語裝置截圖、3 張 Google feature graphic 與 1 張沿用軌島原 icon 的 Play icon，共 64 張。
- iOS `PrivacyInfo.xcprivacy`、三語 App 顯示名稱、非豁免加密回答與 Android 外部簽章範本已就位。
- 已以 Xcode 26.6 建立未簽章 iOS Release archive，並以 Android API 36 建立未簽章 release AAB，兩邊均以 `tw.railisland.world` 與 `1.0.0 (1)` 通過內容檢查。
- `npm run build:verify` 會重跑路線 release gate，並檢查五城資料集合、三語法律頁、禁用功能、外部贊助移除與原生平台設定。
- `npm run store:export` 會輸出 Apple／Google Play 三語逐欄文字；`npm run release:online` 會在部署後檢查四個送審公開網址。
- 商店 Console 填寫指南、真機測試矩陣與 iOS export options 範本已就位，不含任何私鑰或私人電話。

## 商店審核風險與處置

### Apple 4.2：不能只是網站包殼

App 的差異要在審核備註和商店文案寫清楚：五城路網／時刻表隨 App 提供、全螢幕互動 canvas 動畫、當地時間、列車跟隨、車站看板、裝置內偏好與原生分享。不要把它描述成「打開世界版網站的 App」。仍應在送審前用實機錄一段跨城市切換與跟車操作，作為審核說明素材。

官方規則：<https://developer.apple.com/app-store/review/guidelines/>（4.2 Minimum Functionality、4.3 Spam）。不要拆成東京版、紐約版等多個 App。

### 與台灣版的關係

同一開發者有兩個鐵道 App 本身不是禁止，但兩者需有清楚不同的內容：

- 軌島：台灣全鐵道、台鐵即時誤點與本地深度功能。
- 軌島・世界：跨城市的路網與公開時刻／班距流動，第一版五城，不宣稱即時。

名稱、subtitle、截圖首張與審核備註都要使用這個區分。兩者不要共用 application id、商店 listing 或資料處理宣告。

### 隱私

Apple 要求 App 內與 App Store Connect 都能開啟隱私權政策；Google Play 需要隱私權政策與 Data safety。已補頁面，但正式填表前仍須按「最終二進位＋最終底圖供應商」逐項回答，不能只因沒有帳號就直接勾 Data Not Collected。

- Apple：<https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/>
- Google Play：<https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-EN>

### Android 版本要求

新 App／更新在 2026-08-31 後需 target Android 16（API 36）以上；原生 project 的 readiness gate 會檢查 `targetSdkVersion >= 36`。

官方說明：<https://support.google.com/googleplay/android-developer/answer/11926878?hl=en>

## 需帳號持有人後續完成

1. **簽署與商店帳號**：iOS Team、certificate、provisioning；Android upload key、Play App Signing 尚未設定。不要把私鑰放入 repo。
2. **實機 QA**：至少 iPhone SE 尺寸、一般 iPhone、iPad、Android 360／375／414／768 寬；五城各跑一次切換、縮放、跟車、車站看板、三語、分享、前後景與低網速。
3. **公開法律網址**：repo 內已有三語 privacy／terms／support 頁；2026-09-04 實測首頁為 HTTP 200，但三個法律／支援 URL 仍為 404。必須先合併並部署，才能填入商店。
4. **底圖壓力測試**：確認 OpenFreeMap 在 iOS WKWebView 與 Android WebView 的字形、跨來源請求、失敗提示和署名；第一版不設未授權的 raster 退路。
5. **正式簽署包**：未簽章 Release archive／AAB 已成功建立，只證明 release build 可產出；仍須以正式憑證重建，送進 TestFlight／Play internal testing 驗證。
6. **上架前資料重查**：若距最近官方查證超過 45 天，重跑 route release gate 並更新五城 snapshot；商店審查期間也需再抽查一次營運變更。
7. **Google 新個人帳號測試門檻**：若 Play 個人帳號建立於 2023-11-13 之後，production access 前需至少 12 位測試者連續 opt-in closed test 14 天；實際資格以 Console 為準。
8. **法律身分與聯絡資料**：Apple／Google 的 trader status、身分驗證、地址及送審聯絡電話必須由帳號持有人如實填寫，repo 不代判斷或保存私人資料。

## 建議商店定位

### 繁中

- 名稱：`軌島・世界`
- 副標題：`世界城市的鐵道流動`
- 短描述：`看東京、紐約、倫敦、伊斯坦堡與新加坡的列車，沿正確路網依公開時刻與班距流動。`

### English

- Name: `Rail Island World`
- Subtitle: `City railways in motion`
- Short description: `Watch trains move across verified networks in Tokyo, New York, London, Istanbul and Singapore.`

### 日本語

- 名前：`軌島・世界`
- サブタイトル：`都市鉄道の流れを地図で`
- 短い説明：`東京、ニューヨーク、ロンドン、イスタンブール、シンガポールの鉄道を公開時刻・運転間隔から可視化。`

商店文案不得使用「即時列車位置」「日本版」或「全日本」；要固定寫「依公開時刻表／班距推演」「東京」。

## 建議的發布順序

1. 合併已驗證但尚未公開的七個世界版 commits，再合併本 App readiness branch。
2. 部署法律頁與首頁入口，先用公開 HTTPS URL 驗證無 404。
3. 以已確認的 `tw.railisland.world` 建立 App Store Connect／Play Console 記錄。
4. 建 release archive，先進 TestFlight 與 Play internal testing。
5. 五城、三語、四種螢幕寬度實機驗收；修正後重新跑 `npm run build:verify`。
6. 準備三語商店文案與截圖，填寫 App Privacy／Data safety，再送審。
7. 第二批優先布達佩斯與維也納；其他城市依本文件的缺口逐個解鎖，不用等十二城同時完成。
