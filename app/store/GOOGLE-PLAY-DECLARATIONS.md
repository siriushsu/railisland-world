# Google Play Data safety／App content 建議答案

答案基準：`tw.railisland.world`、`1.0.0 (1)` 的目前二進位。正式填寫時逐題對照 Play Console 原文；表單變更時以當日版本為準。

## Data safety

- Does your app collect or share any of the required user data types? **No**。
- Is all user data encrypted in transit? **Yes**（App 的外部請求皆 HTTPS）。
- Do users have a way to request that their data is deleted? **Not applicable / No data collected by the developer**。
- Independent security review：No。
- Committed to follow the Families Policy：No（不是兒童導向 App）。

判斷依據：沒有帳號、analytics、crash reporting、廣告、定位、推播、付款或裝置 ID；介面偏好只在裝置。OpenFreeMap 現行政策表示預設不保存 IP，也不使用 cookies 或 tracking；安全事件期間可能為防濫用暫時啟用 IP 日誌。App 不使用 IP 推論位置或識別裝置。這項連線已寫在隱私政策，送審當日要重查供應商政策；如果 OpenFreeMap 或 CDN 開始把 IP 用於位置、identifier、analytics 或非即時必要用途，必須改填相應類型與用途。

Google 明定 WebView 由 App 控制的資料處理也要納入，且 SDK／第三方傳送不能忽略：<https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-EN>。

## App access

- All functionality is available without special access：**Yes**。
- Login／membership／location restriction：None。
- Instructions：留空或填「No login or access restriction. Dismiss the first-use guide to enter the map.」

## Ads

- Does your app contain ads? **No**。

## Target audience and content

- Target age groups：**13–15, 16–17, 18 and over**。
- Appeal to children：No；不是專為兒童設計，不使用卡通角色、兒童行銷或兒童廣告。
- Store listing intentionally appeals to children：No。

## Content rating（IARC）

- Category：Utility, Productivity, Communication or Other（非 Game；依 Console 當下選項選最接近的 Utility/Other）。
- Violence、fear、sexuality、language、controlled substances、gambling、user interaction、location sharing、in-app purchases：全部 No／None。
- Digital purchases：No。
- Users exchange content：No。
- App shares user location：No。
- External links：只有支援／法律／來源連結，沒有開放式內建瀏覽器。
- 預期：一般級；以 IARC 實際證書為準，不手動宣稱特定地區級別。

## 其他 App content

- Privacy policy：`https://siriushsu.github.io/railisland-world/privacy.html`
- News app：No。
- COVID-19 contact tracing/status：No。
- Government app：No。
- Financial features：None。
- Health features：None。
- Advertising ID：No；manifest 不宣告 `com.google.android.gms.permission.AD_ID`。
- Data deletion URL：不需要（無帳號且不收集資料）；若 Console 強制，可使用支援頁並在說明寫明本機資料可透過清除資料／移除 App 刪除。

官方說明：

- Prepare app for review：<https://support.google.com/googleplay/android-developer/answer/9859455?hl=en-GB>
- Data safety：<https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-EN>
- Target audience：<https://support.google.com/googleplay/android-developer/answer/9867159?hl=en>
- Content ratings：<https://support.google.com/googleplay/android-developer/answer/9859655?hl=en>
