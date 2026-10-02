# 交接：世界版 2D 路段配到別條線的同名站（`HANDOFF-2026-10-01.md` 待辦 6），2026-10-02

## 目前狀態

> **2026-10-02 更新：下面「還沒做」第 1–5 項已完成**（`7530702` BUILD world-v1002d、三語更新紀錄、交接文件待辦 6；`1341ce1` `verify_world_2d_routes` 第 4 項，拿掉投影點排序時 7 城判失敗、還原後 12 城通過）。第 4 項的驗證全部通過；`check_3d` 的 A-1601 第一次沒載入 3D（無 `models`），重跑兩次都有。剩第 6 項 push／PR。

- 分支 `claude/admiring-mendel-02fc35`，worktree 在 repo 的 `.claude/worktrees/festive-hopper-48cb12`。基底是 `f52cb3e`（world-v1002a），它已經用 merge commit `a358cdd` 併進 `main`，兩者的樹相同；開 PR 時 base 用 `main`。
- **只在本機，還沒 push。**
- 已完成並驗證：`b64791c`（修正＋新檢查 `tools/verify_world_2d_routes.mjs`，細節見 commit 訊息）。本文件是下一個 commit。
- BUILD 號：協調好的是 **`world-v1002d`**（a＝happy-noyce、b 保留給倫敦、c＝紐約／東京車型查證那條），**還沒改進 `index.html`**。

## 已完成（`b64791c`）

- `assignSchedShapePathsFor` 的候選改以「實體站」（站名＋時刻表座標）為單位：線形上的站點或投影點離這一站超過 150 m（`SCHED_STOP_MATCH_KM`）就不收；投影補登改用每一站自己的座標，門檻 150 m（原本 300 m，而且一個站名只用第一次出現的座標）；別條線先挑兩站都在線站列上的，再挑里程差最小的。投影前用線形外框預篩，貼軌耗時與修前相當。
- `tools/verify_world_2d_routes.mjs`：每個世界城市的每一段，線形上兩端離時刻表站點 ≤ 150 m；正向對照（換上兩站都離它 2 km 以上的另一段線形，必須判失敗）；覆蓋率（直線段不准有線形同時經過兩站 150 m 內；檢查的城市＝頁面上全部世界城市）。修前 8 城失敗，修後 12 城通過。
- 紐約待辦 6 列的路段全部改到正確的線，兩端離站 0–4 m；只有 96 St 那一端是 103 m，因為 Q 線的線形離 96 St 站點最近就是 103 m。

## 還沒做（依序）

1. **BUILD**：`index.html` 的 `const BUILD = 'world-v1002a'` 改成 `'world-v1002d'`，`app/scripts/audit-app-readiness.mjs` 第 78 行的檢查字串同步改。改之前再掃一次各分支有沒有人用了 d：
   ```bash
   for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do echo "$b $(git show "$b:index.html" 2>/dev/null | grep -o "const BUILD = '[^']*'")"; done | grep 1002
   ```
2. **更新紀錄（三語）**：照 `f52cb3e` 的做法，改 `index.html` 的更新紀錄與 `i18n/world-translations.js`（`git show f52cb3e -- index.html i18n/world-translations.js` 可看格式）。重點：路段不再配到別條線的同名站；線形資料沒涵蓋的路段改畫兩站之間的直線。
3. **文件**：`docs/HANDOFF-2026-10-01.md` 待辦 6 改成已修，比照待辦 5 的寫法。只改待辦 6 那幾行：另一條分支（`claude/reverent-jemison-6a9b6f`）會改同一個檔第 48 行的 `check_3d` 說明。`tools/verify_world_3d_routes.mjs` 檔頭最後一句「不在這裡驗」可以補上「見 `verify_world_2d_routes.mjs`」。
4. **其餘驗證**（在 worktree 根目錄執行；一次只開一個瀏覽器，本機 `http.server` 被多個瀏覽器同時存取會斷線）：
   ```bash
   python3 -m http.server 5196 --bind 127.0.0.1 &
   node tools/verify_world_2d_routes.mjs http://127.0.0.1:5196/
   node tools/verify_world_3d_routes.mjs http://127.0.0.1:5196/
   node tools/verify_nyc_routes.mjs
   node tools/audit_route_coverage.mjs --release
   node tools/verify_world_ui.mjs http://127.0.0.1:5196/
   mkdir -p /tmp/cities && node tools/dev/check_cities.mjs http://127.0.0.1:5196/ /tmp/cities
   (cd app && npm run build:verify)
   ```
   `check_3d` 抽查修正過的班次（時刻是該段發車時間）：
   ```bash
   BASE=http://127.0.0.1:5196/ node tools/dev/check_3d.mjs nyc_sched N-0736 /tmp/n-0736.png 08:40
   BASE=http://127.0.0.1:5196/ node tools/dev/check_3d.mjs nyc_sched A-1601 /tmp/a-1601.png 16:05
   BASE=http://127.0.0.1:5196/ node tools/dev/check_3d.mjs nyc_sched 5-0814 /tmp/5-0814.png 09:31
   BASE=http://127.0.0.1:5196/ node tools/dev/check_3d.mjs nyc_sched W-0704 /tmp/w-0704.png 07:36
   BASE=http://127.0.0.1:5196/ node tools/dev/check_3d.mjs nyc_sched F-0627 /tmp/f-0627.png 06:50
   ```
   輸出沒有 `models` 欄位代表 3D 沒載入，不算通過。`claude/reverent-jemison-6a9b6f`（`1b0a8f0`）的新版 `check_3d` 會多印一行判定（MODELLED／FALLBACK 是 exit 0，INCONCLUSIVE／FLAKY 是 exit 1）；那條合併後就改用新版。
5. **突變測試還沒做**：「別條線先挑兩站都在線站列上的」這條排序，新檢查守不到。W 線 Atlantic Av-Barclays Ctr→DeKalb Av 不加這條排序時會貼到 2～5 線，兩端離站 123／136 m，仍在 150 m 內。要守的話，可以加一項斷言：別條線有兩站都在線站列上的時候，不准選帶投影點的線。
6. 全部通過後才 push、開 PR（base `main`）；push、開 PR、合併之前先列出對象、內容與帳號確認。

## 裁決與風險

- **門檻 150 m 怎麼來的**：紐約同名而不同地點的站，例如 181 St 兩組座標相隔 441 m，86 St 有 6 組座標、最遠相隔 21.8 km。修前各實體站離最近的同名線站，紐約只有 Court Sq（111 m）、96 St（103 m）超過 100 m；維也納、布達佩斯有一批 100–151 m 的，超過 150 m 的線站若線形本身經過站點 150 m 內，就改用投影點。
- **直線段變多**：線形資料沒有涵蓋的路段，改成兩站之間的直線。修前這些路段貼在別條分支或線形端點上，偏離幾百公尺到上百公里。直線段數：巴黎 34232（有直線段的班次 4459／25728；RER A／C／D 與 Transilien 支線、13 號線 Saint-Denis 支線、7 號線 Ivry 支線、10 號線 Auteuil 段、T4、T8）、墨爾本 1448（Ringwood–Blackburn、Parliament→Jolimont）、挪威 1042（原 152；Gjøvik 線、瑞典段）、雪梨 1319（原 1318）、維也納 290、布達佩斯 202（H6 Tököl 以南）。紐約、東京、倫敦、新加坡、伊斯坦堡、瑞士都是 0，所以有 3D 的城市不受影響。根治要補線形資料，另開工作。
- **雪梨、墨爾本、瑞士的列車全都找不到自己的路線**（`worldTrainLine` 回 null，車名對不上線的 id），這三城沒有「優先自己的路線」，只靠上面的排序挑線。不在這次範圍。
- **還沒驗證**：3D、介面、五城截圖、App 建置、`check_3d` 都還沒跑（見上面第 4 項）。這次動的是所有世界城市的 2D 位置，`verify_world_3d_routes` 修後還沒跑。

## 只在本機、被忽略的東西

- repo 根目錄的 `node_modules` 是指向 `app/node_modules` 的連結；`app/node_modules` 是 `npm ci` 裝的。兩者都被 git 忽略。
- 修前修後的量測探針放在 session 的暫存目錄，不在 repo，可能已經清掉；需要長期保留的量測已經收進 `tools/verify_world_2d_routes.mjs`。
