# Apple App Privacy／年齡分級建議答案

答案基準：`1.0.0 (1)` 的目前程式、Capacitor App／Share、OpenFreeMap-only，無其他 SDK。任何新增 analytics、crash reporting、定位、廣告、帳號、付款或推播後都必須重做。

## App Privacy

- Does this app collect data? **No — Data Not Collected**。
- Tracking? **No**。
- App Privacy Policy URL：`https://siriushsu.github.io/railisland-world/privacy.html`

理由：開發者不收集 Apple 表單中的個人資料類型；偏好只存裝置。線上底圖請求由 OpenFreeMap 傳送，該服務現行政策表示預設不保存 IP、無帳號／cookies／tracking，僅安全事件期間可能暫時啟用 IP 日誌（最長 30 天）。App 自己不以 IP 推論位置、建立識別碼或使用者檔案；政策頁仍完整揭露第三方連線。送審當日要再查一次 OpenFreeMap 政策，若最終供應商或行為改變，先改答案再上傳。

參考：

- Apple privacy details：<https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/>
- OpenFreeMap privacy：<https://openfreemap.org/privacy/>

## Privacy manifest

`PrivacyInfo.xcprivacy` 宣告：

- `NSPrivacyTracking = false`
- tracking domains：空
- collected data types：空
- required-reason API types：空

Capacitor 或 plugin 若升級，須重新檢查其 SDK privacy manifest，不能只沿用目前空陣列。

## 年齡分級問卷

- In-app controls（parental controls／age assurance）：No
- Capabilities（UGC／messaging／advertising／social media／unrestricted web access）：No
- Mature themes、profanity、horror：None
- Medical／wellness：None
- Sexuality／nudity：None
- Violence／weapons：None
- Gambling、simulated gambling、loot boxes、contests：None
- Made for Kids：No
- Age Category Override：Not Applicable
- Age Suitability URL：留空

預期 Apple global rating：**4+**；仍以 App Store Connect 即時計算為準。支援頁開啟 GitHub issue 的外部連結不是 App 內 unrestricted browser，且 App 本身沒有 UGC feed。

官方分級：<https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/>。
