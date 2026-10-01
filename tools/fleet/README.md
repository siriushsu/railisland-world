# 世界版列車網格（程序化建模）

3D 圖層（`rail-3d`）用的當地車型網格，由本目錄的純 Python 產生器建出；Blender 只用來渲染比對圖。

東京全部車型（110 款）：
- `jp.py`：日本通勤電車參數化產生器，開頭有完整欄位說明。
- `jp_metro.py`（東京地鐵、都營、TX、東葉、埼玉高速、橫濱高速）、`jp_jr.py`（JR 其餘番台、臨海線、相鐵）、`jp_southwest.py`（東急、小田急、京王）、`jp_north.py`（西武、東武）、`jp_east.py`（京成、北總、京急）：每款一份設定，`cars.py` 自動註冊。
- `t_special.py`：都電（兩端駕駛室的單節車）、世田谷線、日暮里・舍人線與百合海鷗號（膠輪）、東京單軌與多摩單軌（跨座式）。
- `map_tokyo_fleet.py`：依車型目錄產生 `formations.js` 裡東京各線的車型與權重。
- 每款的尺寸出處與照片（Commons 檔名、作者、授權）寫在設定的 `source`，輸出時寫進 manifest。

以下表格是早期手寫的車款：

| 車款 | 網格 | 用在 |
|---|---|---|
| 紐約地鐵 R160 | `r160`（駕駛車）、`r160-mid`（中間車） | 紐約 E、F、FX、J、M、R、Z |
| JR 東日本 E233 系 | `e233`、`e233-mid` | 東京 JC、JCO、JCI、JK、JT、JU、JS、JE、JH、JA、JN |
| 紐約地鐵 R62A（R62 共用） | `r62a`、`r62a-mid` | 紐約 1、3、6、6X、S 42 St |
| JR 東日本 E235 系 | `e235`、`e235-mid` | 東京 JY |
| 紐約地鐵 R142（R142A 共用） | `r142`、`r142-mid` | 紐約 2、4、5 |
| JR 東日本 E231 系通勤型 | `e231`、`e231-mid` | 東京 JB、JJ、JM、JHK |
| 紐約地鐵 R211 | `r211`、`r211-mid` | 紐約 A（三個分支）、C、G、S Rockaway、SIR（R211S）、B／D 少數 |
| 紐約地鐵 R68（R68A 共用）、R46 | `r68`、`r46` 與各自的 `-mid` | 紐約 B、D、N、Q、W、S Franklin |
| 東京地鐵 1000 系 | `tm1000`、`tm1000-mid` | 東京 G 銀座線（固定塗裝，不換色） |

尺寸、塗裝與參考照片的出處寫在各 `t_*.py` 開頭與 `export_world_fleet.py` 的 `MODELS`；車型清單與建模優先順序見 `docs/rolling-stock/`。

## 需求

- Python 3.9+、`numpy`、`scipy`、`shapely`。
- 渲染比對圖另需 `bpy`（Blender 的 Python 模組，`pip install bpy`，約 500 MB）或 Blender 本體；PNG 拼圖用 `pillow`。

## 重新產生

```sh
python3 tools/fleet/build.py                 # 試做：輸出 tools/fleet/out/<id>.bin 與三角形統計（out/ 不進 repo）
python3 tools/fleet/render_compare.py -- --bin tools/fleet/out --out /tmp/render --ids r160,e233 --formation e233:e233-mid
python3 tools/fleet/map_tokyo_fleet.py       # 東京：依車型目錄更新各線車型與權重（formations.js）
python3 tools/fleet/export_world_fleet.py    # 正式輸出到 rail-3d/assets/blender-map-v1/（.bin.gz），並更新 manifest.json
```

`export_world_fleet.py` 會檢查每個網格不超過 8,000 個三角形（與 c381／文湖線地圖網格同級）。

## 換色鍵

網格裡的路線色部位用固定顏色當換色鍵，載入時由 `rail-3d/integration/map3d.js` 的 `TINT_SOURCES` 換成該路線的顏色：

- E233、E231 的色帶與車頭色塊：`#f15a22`（中央線橘）
- R160／R62A／R142／R211 的路線圓標：`#eb6800`
- E235 的車頭外框與門邊：`#80c241`（山手線黃綠）

東京的設定式車款都直接用實際塗裝色，**不要**用這些顏色（±8 色階內都避開），否則會被換成路線色。加需要換色的車款時，路線色部位用這幾個顏色之一（或在 `TINT_SOURCES` 加一組），其他部位避開這些顏色（容差 ±0.03）。

## 加新車款

1. 寫 `t_<id>.py`，提供 `BUILDERS['<id>']`（駕駛車）與 `BUILDERS['<id>-mid']`（中間車），各回傳 `(Mesh, spec)`；加進 `cars.py` 的模組清單。
2. 用 `build.py`、`render_compare.py` 跟參考照片比對、修正。
3. 在 `export_world_fleet.py` 的 `MODELS` 補名稱、尺寸與來源，執行輸出。
4. 在 `rail-3d/integration/formations.js` 的 `WORLD_STOCK` 加車長／寬，把路線指到新網格；更新 `FORMATIONS-world.md`。

## 座標與格式

- `+X` 車頭、`+Y` 車左、`z=0` 軌面、1 單位＝1 公尺；`x=0` 為連結器間距（pitch）中心。
- 非索引三角形，每頂點 10 個 float32：位置、法線、sRGB 顏色、光澤。網頁材質是 DoubleSide、只看頂點法線，所以三角形繞向不必一致（`render_compare.py` 渲染前會自動翻正）。
- 網頁依路線編組把網格縮放到單車長、寬（`formations.js`），寬度比例同時套用在高度，所以 `WORLD_STOCK` 的寬度要等於網格寬。

`kit.py`、`parts.py`、`common.py` 沿用軌島台灣版 `prototypes/tiny-trains/blender/tainan-fleet-v2`（`parts.Profile` 另加 `flare` 參數做擴幅車體），`render_compare.py` 改自同目錄的 `blender_compare.py`。
