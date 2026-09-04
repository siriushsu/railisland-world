# 軌島・世界 1.0.0 送審準備證據

基準日：2026-09-04。本文件記錄「可重現的送審前準備」，不代表已簽章、已上傳、已建立商店紀錄或已送審。

## 固定識別與版本

- iOS bundle ID／Android package：`tw.railisland.world`
- 版本：`1.0.0`
- iOS build／Android version code：`1`
- 內容：東京、紐約、倫敦、伊斯坦堡、新加坡；繁中、英文、日文
- 定位：依公開時刻表／班距推演，非即時列車位置

## 自動檢查

- `npm run build:verify`：五城的 route gaps、full-line gaps、motion gaps、source gaps 與三語缺口皆為 0；App readiness PASS。
- `npm run store:verify`：三語 metadata 字數／byte 限制、64 張圖片的數量與尺寸、永久 application id 皆通過。
- `tools/verify_world_ui.mjs`：Chromium 與 WebKit 的 360／375／414／768 px、真實 touch tap、東京城市切換與 OFM-only 網路請求 gate 均通過。
- App bundle 只有五城資料，不含 Firebase、RevenueCat、定位、通知或廣告 SDK。
- App 底圖已鎖定 OpenFreeMap vector，不含 CARTO／Esri raster 退路或 API key 要求。
- App bundle 不攜帶未使用的 `og-world-1200x630.png`；商店視覺沿用軌島原 icon。

## 商店圖片

`app/store/assets/` 共 64 張：

- Apple：3 語 × 5 城 × iPhone 6.9 吋 `1320×2868`。
- Apple：3 語 × 5 城 × iPad 13 吋 `2064×2752`。
- Google Play：3 語 × 5 城 × phone `1080×1920`。
- Google Play：3 語 × 5 城 × 10-inch tablet `1600×2560`。
- Google Play：3 張 `1024×500` feature graphic。
- Google Play：1 張 `512×512` 原軌島 icon。

產線會等到該城有列車、MapLibre canvas 可見且 OpenFreeMap／OpenMapTiles／OpenStreetMap 署名存在才截圖，並拒絕 API key／CARTO 錯誤文字。

## Native release build proof

### Android

- 指令：`JAVA_HOME=/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home android/gradlew -p android reportReleaseSigning bundleRelease`
- 輸出：`app/android/app/build/outputs/bundle/release/app-release.aab`
- 當次未簽章 build proof SHA-256：`19d297052df688ed85cd5d0766c5c712da351d40a7c85967383b129f9146fefb`。正式簽章重建後必須另行記錄新雜湊。
- 合併 manifest：package `tw.railisland.world`、`versionName 1.0.0`、`versionCode 1`、min API 24、target API 36，只要求 `INTERNET`。
- 簽章：無；這是 build proof，不可直接上傳 Play production。

### iOS

- 工具：Xcode 26.6，iPhoneOS SDK 26.5。
- 輸出：`app/ios/App/output/RailIslandWorld-unsigned.xcarchive`
- 結果：`ARCHIVE SUCCEEDED`。
- archive 內 App：bundle id `tw.railisland.world`、`1.0.0 (1)`、iOS 15+、iPhone／iPad、`ITSAppUsesNonExemptEncryption=false`。
- 內含：App 本身的 `PrivacyInfo.xcprivacy`、繁中／英文／日文 `InfoPlist.strings`、第三方授權全文。
- 簽章：無；這是 build proof，不可直接上傳 App Store Connect。

build 輸出在 gitignore 範圍內，不進版控。要上傳時必須在相同已驗證 commit 用帳號持有人的正式 signing 重建。

## 尚未可自動代填的項目

- Apple Developer Team／distribution certificate／provisioning profile。
- Android upload key 與 Play App Signing。
- App Review 聯絡人真實姓名與電話。
- TestFlight／Play internal testing 的實機驗收。
- 商店紀錄建立、metadata／圖片上傳與正式送審。
- 公開法律頁：2026-09-04 實測首頁為 200，`privacy.html`、`terms.html`、`app-support.html` 均為 404；合併部署後必須再測。
- 送審文字可由 `npm run store:export` 從 metadata 重建；`store:verify` 會逐欄比對輸出，避免 Console 貼入檔與 JSON 分岔。
- 公開網址可由 `npm run release:online` 做 cache-buster GET、HTTP status、Content-Type、頁面標記與託管錯誤頁檢查；目前因尚未部署法律頁，預期不通過。
- 真機測試與 Google closed testing 任務已列在 `REAL-DEVICE-TEST-PLAN.md`，尚未宣稱完成。
