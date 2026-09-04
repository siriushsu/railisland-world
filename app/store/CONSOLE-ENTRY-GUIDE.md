# 軌島・世界商店 Console 填寫指南

適用版本：`tw.railisland.world`、`1.0.0 (1)`。這份指南把已完成的內容分成可直接貼入、必須由帳號持有人回答，以及上傳後才能確認的三類。

## 共通前置條件

1. 公開部署首頁、`privacy.html`、`terms.html`、`app-support.html`。
2. 在 `app/` 執行 `npm run release:online`；四個網址全部 PASS 才填入商店。
3. 確認 `support@railisland.tw` 可正常收信，並由帳號持有人決定是否以 trader 身分在歐盟提供 App。trader／non-trader 是法律身分判斷，repo 不代選。
4. 商店名稱、bundle/package ID、價格與五城範圍不得臨時改成和 metadata 不同的內容。

## App Store Connect

### 建立紀錄

- Platforms：iOS
- Name：`軌島・世界`
- Primary language：Traditional Chinese
- Bundle ID：`tw.railisland.world`
- SKU：`railisland-world-ios-1`
- User access：Full Access（若帳號只有本人）

Apple 規定先建立 App record 才能上傳 build；Bundle ID 必須與 Xcode 專案完全相同，第一個 build 上傳後不可更換。

官方說明：<https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/>、<https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/>。

### 可直接貼入

- 三語 listing：`app/store/export/apple/`
- 三語圖片：`app/store/assets/apple/`
- Privacy Policy URL：`https://siriushsu.github.io/railisland-world/privacy.html`
- Support URL：`https://siriushsu.github.io/railisland-world/app-support.html`
- Marketing URL：`https://siriushsu.github.io/railisland-world/`
- App Review Notes：`APPLE-REVIEW-NOTES.md`
- App Privacy／分級：`APPLE-PRIVACY-AND-RATING.md`
- Sign-in required：No
- Price：Free
- Primary category：Travel；secondary：Reference

### 必須由本人填寫

- App Review contact 的真實姓名、可收信 email、國際格式電話。
- Apple Developer 合約、稅務、付款與 EU Digital Services Act trader status。
- Content Rights 最終確認；本專案可依 repo 內列出的開放資料來源與授權回答，但帳號持有人仍需確認發布資格。

### 上傳與測試

1. 以正確 Apple Team 開啟 `app/ios/App/App.xcworkspace`，設定 Signing & Capabilities。
2. 用 Generic iOS Device 建立 Archive，先執行 Validate App。
3. 上傳 TestFlight；等待 processing 完成並處理所有 warning。
4. 在至少一台 iPhone 與一台 iPad 依 `REAL-DEVICE-TEST-PLAN.md` 測試。
5. 選定通過測試的 build，完成 Export Compliance、App Privacy、Age Rating 與 Review Information 後才 Add for Review。

## Google Play Console

### 建立紀錄

- Default language：Chinese (Traditional) – zh-TW
- App name：`軌島・世界`
- App or game：App
- Free or paid：Free
- Package name：第一個 AAB 上傳後由 `tw.railisland.world` 鎖定
- Category：Travel & Local
- Contains ads：No

### 可直接貼入

- 三語 listing：`app/store/export/google-play/`
- 三語圖片與 feature graphic：`app/store/assets/google-play/`
- Data safety／App content：`GOOGLE-PLAY-DECLARATIONS.md`
- Privacy Policy：`https://siriushsu.github.io/railisland-world/privacy.html`
- App access：All functionality is available without special access
- Support email：`support@railisland.tw`

### 必須由本人確認

- Developer account 身分類型、身分驗證、地址／電話、付款資料與適用的 trader 宣告。
- 若是 **2023-11-13 之後建立的個人帳號**：production 前必須建立 closed test，至少 12 位測試者連續 opt-in 14 天，之後再申請 production access。舊個人帳號或組織帳號以 Console 實際顯示為準。
- Target audience 建議選 13–15、16–17、18+；不得為了省略問卷而填不實年齡。

官方說明：<https://support.google.com/googleplay/android-developer/answer/14151465?hl=zh-Hant>。

### 上傳與測試

1. 建立並妥善備份 upload key，將四個 `RAILISLAND_WORLD_*` 值放在本機環境或未追蹤的 Gradle properties。
2. 執行 `npm run sync`，再到 `app/android/` 執行 `./gradlew reportReleaseSigning bundleRelease`。
3. `reportReleaseSigning` 必須顯示已提供外部簽章；用 `jarsigner -verify` 複驗 AAB。
4. 先上傳 internal testing；真機通過後，視帳號資格進 closed testing 或 production。
5. 完成 Data safety、Content rating、Target audience、App access、Ads、News、Government、Financial 與 Health 等 App content 問卷。

## 最後按下送審前

- `npm run release:verify`
- `npm run release:online`
- 五城官方資料查證不超過 45 天
- 簽署後 binary 的 ID／版本／權限與本文件相同
- 截圖沒有 API key、CARTO／其他未授權底圖、測試資料或個資
- TestFlight／Play 測試版本沒有 crash、空白底圖阻塞操作或分享失敗

不得把未簽章的本機 build proof 上傳商店，也不要直接從第一個上傳 build 送 production review。
