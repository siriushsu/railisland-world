# 軌島・世界 1.0.0 送審清單

基準日：2026-09-04。永久識別碼已由開發者確認為 `tw.railisland.world`；後續不得改成台灣版識別碼或建立第二個五城 App。

## 已在 repo 完成

- iOS／Android 共用版本 `1.0.0`、build/version code `1`。
- iOS 15+、iPhone／iPad；Android min API 24、target/compile API 36。
- 五城資料、繁中／英文／日文、原生分享、OpenFreeMap-only 設定。
- 原本軌島 icon；沒有新 icon、廣告、帳號、定位、推播或付費 SDK。
- 三語商店文案、審核備註、隱私／分級／App content 建議答案。
- Apple／Google Play 三語五城截圖、Google feature graphic 與沿用軌島原 icon 的 Play icon，共 64 張。
- iOS `PrivacyInfo.xcprivacy` 與非豁免加密回答 `false`。
- Android 外部 release signing 範本；keystore 與密碼被 gitignore 排除。
- 第三方軟體授權全文與圖資署名打入 web bundle。
- 未簽章 iOS Release archive 與 Android release AAB 皆已建立成功，可作為正式簽署前的 build proof。
- `npm run release:verify` 會檢查內容 gate、App bundle、商店文案與素材規格。
- `npm run store:export` 會從唯一 metadata 來源產生兩間商店可逐欄貼入的三語文字，並由驗收腳本防止內容分岔。
- `npm run release:online` 會在部署後檢查公開首頁、隱私、條款與支援頁均為 HTTPS HTML 且不是 404／託管錯誤頁。
- 已備妥 Console 填寫指南、真機測試矩陣與 iOS App Store Connect export options 範本。

## 需要帳號持有人完成

- [ ] 確認 Apple Developer Program 與 Google Play developer account 的合約／稅務／付款資料有效。
- [ ] 由帳號持有人確認 Apple／Google 的 trader status、開發者身分驗證與公開聯絡資訊；不得由 repo 猜測法律身分。
- [ ] 用 bundle ID／package name `tw.railisland.world` 建立兩個商店紀錄。
- [ ] Apple SKU 建議 `railisland-world-ios-1`；Google 預設語言建議繁中。
- [ ] 填入送審聯絡人的真實姓名、電話與 `support@railisland.tw`；repo 不保存私人電話。
- [ ] 先公開部署 `privacy.html`、`terms.html`、`app-support.html`，逐一確認 HTTPS、手機可讀且無 404。2026-09-04 實測三頁均為 404，現階段不可先填進商店。
- [ ] 建立 iOS distribution signing 與 Android upload key；不要把憑證、`.p12`、`.mobileprovision`、`.jks` 或密碼 commit。
- [ ] 以正式簽章上傳 TestFlight 與 Play internal testing，五城、三語、分享、前後景、旋轉與低網速各跑一次。
- [ ] 若 Google 是 2023-11-13 後建立的個人開發者帳號，完成至少 12 位測試者連續 opt-in 14 天的 closed test，再申請 production access；以 Console 顯示為準。
- [ ] 依本目錄答案填 App Privacy、Data safety、年齡／內容分級與 App access。
- [ ] 上傳商店圖片；逐張確認沒有 API key／Carto 浮水印、測試資料、模擬器外框或真實個資。
- [ ] 送審前 45 天內重跑五城路線 release gate，並抽查官方營運變更。

## 商店紀錄建議值

| 欄位 | Apple | Google Play |
|---|---|---|
| 類型 | App | App |
| 價格 | Free | Free |
| 主要分類 | Travel | Travel & Local |
| 次要分類 | Reference | 不適用 |
| 帳號／demo | 無，不需 demo account | 所有功能免登入 |
| 廣告 | 無 | Does not contain ads |
| 兒童 | Not Made for Kids | 不選 12 歲以下；選 13–15、16–17、18+ |
| 內容分級預期 | 問卷全無敏感內容，預期 4+ | IARC 問卷全無敏感內容；以系統計算結果為準 |
| Export compliance | 只用作業系統標準 HTTPS；`ITSAppUsesNonExemptEncryption=false` | 不另填加密出口欄位 |
| Content rights | 有權使用所列開放資料／開源元件，畫面保留署名 | 同左 |

不要填「即時列車位置」「導航」「全日本」或「所有路線」。商店與審核說明都固定寫「依公開時刻表／班距推演」及第一版五城範圍。

## 圖片規格（2026-09-04 查證）

- Apple：每種裝置 1–10 張，JPEG 或 PNG、不可有 alpha。若支援 iPad，需 iPad 截圖。這個 repo 的產線使用 6.9 吋 iPhone `1320×2868` 與 13 吋 iPad `2064×2752`。
- Google：app icon `512×512`；feature graphic `1024×500`；每種裝置最多 8 張。手機至少 2 張；大螢幕推薦／必要集合準備 4 張以上，使用 9:16 且短邊至少 1080 px。
- 產線命令：先 `npm run build`，再 `npm run store:capture`。完成後 `npm run store:verify`。

官方規格：

- Apple screenshot specifications：<https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/>
- Apple platform version information：<https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/>
- Google preview assets：<https://support.google.com/googleplay/android-developer/answer/9866151?hl=en>
- Google store listing：<https://support.google.com/googleplay/android-developer/answer/9859152?hl=en-EN>

## 送審順序

1. 合併並部署首頁與法律頁；確認公開 URL。
2. 建立商店紀錄與正式簽署設定。
3. 上傳 internal/TestFlight，不直接送 production review。
4. 真機測試與素材複驗；修正後重建同一版本的新 build number/version code。
5. 填表、上傳 metadata 和圖片。
6. 將最終二進位與本目錄答案再對照一次，才送審。

逐欄操作請看 `CONSOLE-ENTRY-GUIDE.md`；真機與 closed test 任務請看 `REAL-DEVICE-TEST-PLAN.md`。

本清單不代表已建立商店紀錄、已上傳或已送審；這些外部寫入需由帳號持有人操作或另行明確授權。
