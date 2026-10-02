# 交接：check_3d 假綠修正，2026-10-02

## 分支與 worktree

- 分支 `claude/reverent-jemison-6a9b6f`，worktree 在主 repo 底下的 `.claude/worktrees/reverent-jemison-6a9b6f`。
- 基底是 `main` 的 a358cdd（PR #11 合併後）。
- 寫這份交接時（`9f4a79e`）還沒 push：遠端沒有這條分支，也還沒開 PR。

## 已完成

| commit | 內容 |
|---|---|
| `1b0a8f0` | 判定改成只認跟隨車的正向證據（出現在 `poseSamples` 或 `modelFallbacks`），最多等 30 秒，等不到判 `INCONCLUSIVE`；兩秒後複查不同判 `FLAKY`。 |
| `09c3a88` | 本交接文件的第一版。 |
| `28ace5d` | `railIslandIntegration.active` 不是 true 時不採信（render 丟例外後 stats 停在舊的一幀）；跟隨車 id 的系統與車次要等於腳本選的那班；`FALLBACK` 改 exit 2。 |
| `0046c76` | 兩秒複查時 `frame.clock.wallEpochSec` 沒前進就判 `INCONCLUSIVE`（tick 丟例外時 active 仍是 true，但資料 frame 不再更新），附 `frozen` 與 `tickErrors`。 |
| `6dc5c5a` | 上一條改成兩秒後再輪詢最多 10 秒，等到 `wallEpochSec` 前進才算數（無視窗 SwiftShader 每幀 0.7–1.5 秒，慢到約 2 秒一幀時只比一次會誤判）。 |
| `9f4a79e` | 只改註解與文件：複查時機、`tickErrors` 只印前 3 筆、單純每幀變慢會被頁面看門狗補 tick。 |

現行判定（第二行；第一行與舊版相同，頁面錯誤從第三行起印）：

| 判定 | 意思 | exit |
|---|---|---|
| `MODELLED <車型> <節數> 節` | 跟隨的那班車擺好車廂 | 0 |
| `FALLBACK <原因>` | 3D 有載入，但跟隨車退回示意 | 2 |
| `INCONCLUSIVE {…}` | 等不到證據、車次找不到、或資料 frame 停住（附 `frozen` 與 `tickErrors`） | 1 |
| `FLAKY <前> → <後>` | 複查結果不同（先等 2 秒，再等資料 frame 前進，最多 10 秒；優先於 frame 停住） | 1 |

`docs/HANDOFF-2026-10-01.md` 第 48 行的 check_3d 說明已同步。

## 驗證

四輪獨立驗收（都由沒參與實作的 agent 執行，headless Chromium，`nyc_sched 2-0849 10:30`，故障一律從腳本外部注入：伺服器端讓指定路徑連線重設、回 500 或改送別的檔；頁面端在 `</body>` 前插一段 script 製造故障，並丟一個 MARKER 自報注入有生效）。HEAD 的結果：

| 情境 | 第二行 | exit |
|---|---|---|
| 正常 | `MODELLED r142 10 節` | 0 |
| `map3d.js` 回 500／連線被重設 | `INCONCLUSIVE`，active=false、renderer=false、errors 是模組載入失敗 | 1 |
| 換上 165ae34 的 `rail-3d.js` | `FALLBACK 來源位置不在線形上` | 2 |
| 判定與複查之間把地圖縮遠 | `FLAKY MODELLED r142 10 節 → INCONCLUSIVE` | 1 |
| 不存在的車次 `ZZZ-9999` | `INCONCLUSIVE`，第一行 `no train` | 1 |
| 跟隨被導向別班車 | `INCONCLUSIVE`，selected 是別班 | 1 |
| 傾斜後 `renderer.update` 每次丟例外 | `INCONCLUSIVE`，active=false | 1 |
| 傾斜後 tick 每次丟例外 | `INCONCLUSIVE`，附 `frozen` 與 `tickErrors` | 1 |
| 傾斜後每幀延後 2 秒 | `MODELLED r142 10 節` | 0 |
| r142 車模資產回 500 | `INCONCLUSIVE`，errors 有「列車模型載入失敗」 | 1 |
| 修前版本，`map3d.js` 連線被重設 | （沒有第二行，第一行少了 `models`） | 0（假綠重現） |

- 突變測試：分別拿掉 active 檢查、車次比對、frame 停住檢查，以及把 `FALLBACK` 改回 exit 0，對應情境都變回 exit 0；未突變的控制組結果與上表相同。把複查改回只比一次 `wallEpochSec` 時，每幀約 2 秒的情境 4 次裡誤判 2 次；目前的輪詢版本 5 次都判對。
- 抽查 `nyc_sched B`、`nyc_sched N`（r68 8 節）、`tokyo_sched G`（tm1000 6 節），都是 `MODELLED`、exit 0。正常情境連跑多次都是 `MODELLED`，每次約 20–26 秒。
- 修前版本在沒有任何注入時也自然出現過一次假綠：`map3d.js` 的相依模組載到一半就停，輸出沒有 `models`、exit 0。

## 下一步

1. **push 與開 PR 還沒做，要先確認再動。** PR 內文在 `.claude/handoff-check3d/pr-body.md`：

   ```bash
   git push -u origin claude/reverent-jemison-6a9b6f
   gh pr create --repo siriushsu/railisland-world --base main --head claude/reverent-jemison-6a9b6f --title "fix(dev): check_3d 只在 3D 真的畫出跟隨車時 exit 0" --body-file .claude/handoff-check3d/pr-body.md
   ```
2. **和倫敦分支 `claude/london-3d-fleet` 合併時 `tools/dev/check_3d.mjs` 會衝突**。倫敦的 5739734 改了選車那段 `evaluate`（參數改成 `[route, play]`、`state.playing=play`、呼叫端傳 `[route, !!process.env.PLAY]`），並在第一行的 info 加了 `direction`。這邊把同一段 `evaluate` 改成回傳 `{ label, sys, train }`（`want`），`r` 改由 `want` 推出。合併時兩邊都要保留：倫敦的 `play` 與 `direction`，加上這邊的 `want`、`evidence(want)`、`clock`、`verdict`、`line`／`frozen`／`moved` 那段複查、`process.exitCode` 的對照。倫敦那支讀輸出的工具只解析第一行、exit code 用 `rc=$?` 記錄，不受第二行與 exit 2 影響。倫敦那條的交接文件在該分支的 `docs/HANDOFF-2026-10-02-london-3d.md`。

## 裁決與風險

- `FALLBACK` 以 exit 2 結束：它代表跟隨的車在 3D 裡沒畫成車廂。以 0 結束時，165ae34 那個回歸只看 exit code 會通過。代價是停在終點站的「編組超出已知線形端點」這類可以接受的退回也是 2，要看第二行的原因判斷。
- `FLAKY` 以 exit 1 結束：以 0 結束會再次看起來像通過。
- 複查時先比結果、再比畫面有沒有更新：地圖縮遠這類「結果變了」的情況維持 `FLAKY`，結果沒變但畫面停住才判 `INCONCLUSIVE`。
- 等待上限 30 秒：正常情況下證據在原本固定的兩段 4 秒等待結束時就在了；30 秒只在模型載入慢或失敗時才會等滿。
- 判定只看跟隨的那班車。畫面上其他車退回不影響判定，但第一行的 `fallbacks` 仍會列出，例如東京抽查時另一班 `TS↓081` 的「編組超出已知線形端點」。
- 照不到的：WebGL context 遺失、鏡頭離開跟隨車（要看截圖）；頁面未捕捉的例外只印在第三行，不影響 exit code；tick 例外若發生在呼叫 render 之後，資料 frame 照常更新，也照不到。
- `frozen` 看的是資料 frame（`frame.clock.wallEpochSec`），不是 3D 圖層：tick 端例外時 `renderer.stats.frames` 仍在增加。`tickErrors` 是頁面從載入起記下的 tick 例外（頁面記 5 筆，這裡印前 3 筆），可能混到開機時的舊例外；空的代表 frame 停住不是 tick 例外造成的（例如主執行緒卡住、頁面被隱藏）。單純 rAF 變慢不會判停住：rAF 斷超過 2.5 秒時，頁面的看門狗（`index.html` 的 `setInterval` 看門狗）每 2 秒補一次 tick。
- 車次比對只比 id 裡的系統與車次：同系統同名的兩班會被當成同一班（現有紐約 8497 班、東京 28640 班沒有重名）；車次含冒號時會誤判 `INCONCLUSIVE`（安全側）。
- `PLAY=1`（倫敦分支）時列車在動，退回原因可能隨位置改變，複查比較容易出現 `FLAKY`，判讀時要算進去。
- 本機 `python3 -m http.server` 偶發讓 `map3d.js` 或它的相依模組載入失敗，新版判 `INCONCLUSIVE`，重跑即可。它的 listen backlog 只有 5；一次兩個瀏覽器並行的對照裡，backlog 5 兩次都失敗、backlog 128 兩次都成功，可能是原因，還沒定論。

## 只在本機的被忽略產物

- `.claude/handoff-check3d/`（在這個 worktree 裡，被 `.git/info/exclude` 的 `.claude/` 忽略）：
  - `faulty_server.py`：跟 `python3 -m http.server` 一樣的靜態伺服器（listen backlog 128），可用環境變數讓指定路徑連線被重設（`RESET`）、回 500（`FAIL500`）或改送另一個檔案（`OVERRIDE`）。
  - `make_flaky_index.py`：產生測 `FLAKY` 用的 index 副本。
  - `pr-body.md`：PR 內文。`commit-msg.txt`：1b0a8f0 的 commit 訊息。
  - `out/*.txt`：第一版修正時各情境的實際輸出。
- `.claude/verify-check3d/` 到 `.claude/verify-check3d4/`：四輪驗收用的修前版本副本、突變副本與探針。
- worktree 根目錄的 `node_modules` 是指向 `app/node_modules` 的連結（被忽略）；`app/node_modules` 是 `npm ci` 裝的。
