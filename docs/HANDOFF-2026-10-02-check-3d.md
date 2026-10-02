# 交接：check_3d 假綠修正，2026-10-02

## 分支與 worktree

- 分支 `claude/reverent-jemison-6a9b6f`，worktree 在主 repo 底下的 `.claude/worktrees/reverent-jemison-6a9b6f`。
- 基底是 `main` 的 a358cdd（PR #11 合併後）。
- **沒有 push**：遠端沒有這條分支，也還沒開 PR。

## 已完成

- `1b0a8f0` fix(dev): check_3d 只認跟隨車的正向證據，等不到就判 INCONCLUSIVE
  - 舊版的問題：3D 模組（`rail-3d/integration/map3d.js`）載入失敗時 renderer 不存在，`modelFallbacks` 仍是空陣列，輸出只少了 `models` 欄位，照樣 exit 0。
  - 判定改成等跟隨的那班車（`railIslandIntegration.frame.selectedVehicleId`）出現在 `renderer.stats.poseSamples`（`MODELLED <車型> <節數> 節`）或 `modelFallbacks`（`FALLBACK <原因>`），最多等 30 秒；等不到印 `INCONCLUSIVE`（附 `active`、`renderer` 有無、`selected`、`errors` 前三筆）；判定兩秒後再看一次，不同就印 `FLAKY`。`INCONCLUSIVE` 與 `FLAKY` 以 exit 1 結束。
  - 第一行輸出（車次與 `pitch/zoom/bearing/models/fallbacks`）不變，判定印在第二行。
  - `docs/HANDOFF-2026-10-01.md` 第 48 行的 check_3d 說明同步更新。
- 本機驗證（headless Chromium，`nyc_sched 2-0849 10:30`，實際輸出存在 `.claude/handoff-check3d/out/`）：

| 情境 | 第二行 | exit |
|---|---|---|
| 正常 | `MODELLED r142 10 節` | 0 |
| `map3d.js` 回 500 | `INCONCLUSIVE`，active=false、renderer=false、errors 是模組載入失敗 | 1 |
| `map3d.js` 連線被重設 | 同上 | 1 |
| 換上 165ae34 的 `rail-3d.js` | `FALLBACK 來源位置不在線形上` | 0 |
| 判定與複查之間把地圖縮遠 | `FLAKY MODELLED r142 10 節 → INCONCLUSIVE` | 1 |
| 舊版腳本，`map3d.js` 連線被重設 | （舊版沒有第二行，第一行少了 `models`） | 0（假綠重現） |

  另抽查 `nyc_sched B`（r68 8 節）、`nyc_sched N`（r68 8 節）、`tokyo_sched G`（tm1000 6 節），都是 `MODELLED`、exit 0。

## 進行中與下一步

1. **獨立驗收沒跑完**，要另派一個不知道實作過程的 agent 重跑上表，外加：舊版對照、第一行格式比對、交接文件說明逐句對照實際行為、找其他仍可能「3D 沒成功卻 exit 0」的路徑。故障一律從腳本外部注入，不要改受測腳本。可以直接用的指令（在 worktree 根目錄）：

   ```bash
   (cd app && npm ci) && ln -sn app/node_modules node_modules   # 已有就跳過
   git show 165ae34:rail-3d.js > /tmp/rail-3d.165ae34.js
   python3 .claude/handoff-check3d/make_flaky_index.py /tmp/index.flaky.html
   python3 -m http.server 5241 --bind 127.0.0.1 &
   RESET=/rail-3d/integration/map3d.js python3 .claude/handoff-check3d/faulty_server.py 5242 "$PWD" &
   FAIL500=/rail-3d/integration/map3d.js python3 .claude/handoff-check3d/faulty_server.py 5243 "$PWD" &
   OVERRIDE=/rail-3d.js=/tmp/rail-3d.165ae34.js python3 .claude/handoff-check3d/faulty_server.py 5244 "$PWD" &
   OVERRIDE=/=/tmp/index.flaky.html,/index.html=/tmp/index.flaky.html python3 .claude/handoff-check3d/faulty_server.py 5245 "$PWD" &
   for port in 5241 5242 5243 5244 5245; do BASE=http://127.0.0.1:$port/ node tools/dev/check_3d.mjs nyc_sched 2-0849 /tmp/c$port.png 10:30; echo "port=$port rc=$?"; done
   ```

   預期：5241 `MODELLED`／0、5242 與 5243 `INCONCLUSIVE`／1、5244 `FALLBACK 來源位置不在線形上`／0、5245 `FLAKY`／1。port 被占用就換號。

2. **push 與開 PR 還沒做**，要先確認再動。PR 內文草稿在 `.claude/handoff-check3d/pr-body.md`：

   ```bash
   git push -u origin claude/reverent-jemison-6a9b6f
   gh pr create --repo siriushsu/railisland-world --base main --head claude/reverent-jemison-6a9b6f --title "fix(dev): check_3d 只認跟隨車的正向證據，等不到就判 INCONCLUSIVE" --body-file .claude/handoff-check3d/pr-body.md
   ```

3. **和倫敦分支 `claude/london-3d-fleet` 合併時 `tools/dev/check_3d.mjs` 會衝突**（`git merge-tree --write-tree --name-only HEAD claude/london-3d-fleet` 已確認）。倫敦的 5739734 加了 `PLAY=1` 時列車不暫停（`[route, play]` 參數與 `state.playing=play`），並在第一行的 info 加了 `direction` 欄位。合併時兩邊都要保留：倫敦的 `play` 與 `direction`，加上這邊的 `evidence`、`verdict`、`line`、`process.exitCode` 那幾段。倫敦那條的交接文件在該分支的 `docs/HANDOFF-2026-10-02-london-3d.md`。

## 裁決與風險

- `FLAKY` 也以 exit 1 結束：以 0 結束會再次看起來像通過。
- 等待上限 30 秒：正常情況下，原本固定的兩段 4 秒等待結束時證據就已經在了（每次約 22–28 秒跑完）；30 秒只在模型載入慢或失敗時才會等滿。
- 判定只看跟隨的那班車。畫面上其他車退回不影響判定，但第一行的 `fallbacks` 仍會列出，例如東京抽查時另一班 `TS↓081` 的「編組超出已知線形端點」。
- `PLAY=1`（倫敦分支）時列車在動，退回原因可能隨位置改變，兩秒複查比較容易出現 `FLAKY`，判讀時要算進去。
- 本機 `python3 -m http.server`（Python 3.9.6）單一瀏覽器依序跑 7 次，有 1 次 `map3d.js` 的相依模組載入失敗，伺服器 log 裡沒有失敗的那個請求。新版會判 `INCONCLUSIVE`，重跑即可；根因沒查。

## 只在本機的被忽略產物

- `.claude/handoff-check3d/`（在這個 worktree 裡，被 `.git/info/exclude` 的 `.claude/` 忽略）：
  - `faulty_server.py`：跟 `python3 -m http.server` 一樣的靜態伺服器，可用環境變數讓指定路徑連線被重設（`RESET`）、回 500（`FAIL500`）或改送另一個檔案（`OVERRIDE`）。
  - `make_flaky_index.py`：產生測 `FLAKY` 用的 index 副本。
  - `pr-body.md`、`commit-msg.txt`：PR 內文草稿與 1b0a8f0 的 commit 訊息。
  - `out/*.txt`：上表各情境的實際輸出（`orig-*` 是舊版，`new-*`、`rob-*` 是新版）。
- worktree 根目錄的 `node_modules` 是指向 `app/node_modules` 的連結（被忽略）；`app/node_modules` 是 `npm ci` 裝的。
