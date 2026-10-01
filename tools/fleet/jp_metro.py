"""東京地鐵（Tokyo Metro）車型設定，給 jp.py 的參數化產生器用。尺寸取自日文維基百科各車型條目；外觀依 Commons 照片估計。"""

CARS = [
    dict(
        id='tm2000', name='東京地鐵 2000 系（丸之內線）',
        source='ja.wikipedia 東京メトロ2000系（全長 18,000／寬 2,780／高 3,480 mm）；Commons: Tokyo-Metro Series2000-2026.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=18.0, W=2.78, zb=0.95, roof=3.36, shoulder=3.02, ac_top=3.48, third_rail=True,
        body='#e3262e', low='#b81e25', roof_col='#a9adb1', door_col='#d9232b', win=(1.80, 2.66), win_frame='#3a3d40',
        bands=[(2.84, 2.96, '#c9cdd1')],   # 窗上方銀色正弦波帶（簡化為直帶）
        ac=[(-4.2, 2.6), (4.2, 2.6)],
        front=dict(Ln=0.8, tip_w=0.88, tip_drop=0.08, setback=0.10, face='#e3262e',
                   decals=[('rect', 0.0, 2.68, 2.24, 1.40, 0.38, '#141618', 0.9),          # 黑色「眼睛」面
                           ('rect', -0.72, 2.66, 0.56, 0.90, 0.10, 'GLASS'),
                           ('rect', 0.0, 2.58, 0.60, 1.05, 0.06, 'GLASS'),
                           ('rect', 0.72, 2.66, 0.56, 0.90, 0.10, 'GLASS'),
                           ('rect', 0.0, 3.24, 1.50, 0.18, 0.04, '#2b2d30', 0.7),
                           ('circle', -1.05, 1.74, 0.13, '#1a1c1e'), ('circle', 1.05, 1.74, 0.13, '#1a1c1e'),
                           ('circle', -1.05, 1.74, 0.08, '#f2efe2', 0.9), ('circle', 1.05, 1.74, 0.08, '#f2efe2', 0.9),
                           ('band', 1.40, 1.43, '#d0d3d6')],
                   skirt=('#2f3336', 0.30, 0.70)),
    ),
]


# ---- 以下為地鐵與直通伙伴車型（共用車頭小工具） ----
ALU = '#c0c4c8'     # 鋁合金車身（無塗裝）
SUS = '#c4c8cc'     # 不鏽鋼車身
BLK = '#141618'
LAMP = '#f2efe2'


def _yt(W, tip_w):
    return W / 2 * tip_w - 0.07


def lamps(y, z, r=0.10, bezel=BLK, br=None):
    """左右對稱頭燈（外圈＋燈芯）。"""
    br = br or r + 0.05
    out = []
    if bezel:
        out += [('circle', -y, z, br, bezel), ('circle', y, z, br, bezel)]
    return out + [('circle', -y, z, r, LAMP, 0.9), ('circle', y, z, r, LAMP, 0.9)]


def windscreen(W, tip_w, z0, z1, door=0.0, dw=0.60, mask=BLK, pad=0.08, r=0.12, frame=None, fpad=0.07):
    """黑色面罩＋左右擋風玻璃＋貫通門窗。door=None 為一整片玻璃（中間細柱）。frame 為面罩外框色。"""
    yt = _yt(W, tip_w)
    d = []
    if mask is None:            # 面罩改用 cap（端面依高度分色），省三角形
        frame = None
    if frame:
        d.append(('rect', 0.0, (z0 + z1) / 2, 2 * yt, z1 - z0 + 2 * fpad, r + 0.04, frame))
        yt -= fpad
    if mask is not None:
        d.append(('rect', 0.0, (z0 + z1) / 2, 2 * yt, z1 - z0, r, mask, 0.85))
    g0, g1 = z0 + pad, z1 - pad
    gc, gh = (g0 + g1) / 2, g1 - g0
    a, b = -yt + pad, yt - pad
    if door is None:
        d += [('rect', (a - 0.03) / 2, gc, -a - 0.03, gh, 0.06, 'GLASS'), ('rect', (b + 0.03) / 2, gc, b - 0.03, gh, 0.06, 'GLASS')]
    else:
        l1, r1 = door - dw / 2 - 0.07, door + dw / 2 + 0.07
        d += [('rect', (a + l1) / 2, gc, l1 - a, gh, 0.06, 'GLASS'),
              ('rect', door, gc - 0.06, dw, gh + 0.08, 0.05, 'GLASS'),
              ('rect', (r1 + b) / 2, gc, b - r1, gh, 0.06, 'GLASS')]
    return d


def metro20(id, name, source, W, ac_top, **kw):
    """20 m 4 門地鐵車（鋁合金或不鏽鋼，無擴幅，架空線）。"""
    d = dict(id=id, name=name, source=source, pitch=20.0, W=W, zb=1.0, roof=3.60, shoulder=3.20, ac_top=ac_top,
             body=ALU, roof_col='#a3a8ad', win_frame='#3a3d40', ac=[(-4.6, 2.6), (4.6, 2.6)])
    d.update(kw)
    return d


def _src(dims, photo, author, lic):
    return f'{dims}；Commons: {photo}（{author}，{lic}）'


SKIRT = ('#8e9398', 0.32, 0.74)       # 銀色排障器（多數東京地鐵新車）
SKIRT_D = ('#2f3336', 0.30, 0.72)

# --- 東京地鐵 ---
_TM13 = 0.90
TM13000 = dict(
    id='tm13000', name='東京地鐵 13000 系（日比谷線）',
    source=_src('ja.wikipedia 東京メトロ13000系（中間 20,000／車側灯間 2,829／全高 3,585 mm）', 'Tokyo-Metro-Series13000-13111.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    pitch=20.0, W=2.83, zb=0.98, roof=3.40, shoulder=3.04, ac_top=3.585, body=ALU, roof_col='#a3a8ad', win=(1.74, 2.62), win_frame='#3a3d40',
    bands=[(1.62, 1.66, '#9fc6e8'), (2.74, 2.79, '#b5b5ac')], ac=[(-4.6, 2.6), (4.6, 2.6)],
    front=dict(Ln=1.0, tip_w=_TM13, tip_drop=0.08, setback=0.32, face=ALU, cap=[(2.00, 3.26, BLK)],
               decals=windscreen(2.83, _TM13, 2.00, 3.26, mask=None)
               + [('rect', 0.0, 1.76, 2.0, 0.16, 0.06, BLK, 0.8),
                  ('rect', -0.80, 1.76, 0.30, 0.07, 0.03, LAMP, 0.9), ('rect', 0.80, 1.76, 0.30, 0.07, 0.03, LAMP, 0.9),
                  ('band', 1.62, 1.66, '#9fc6e8')],
               skirt=SKIRT),
)

_W15 = 2.85
TM15000 = metro20('tm15000', '東京地鐵 15000 系（東西線）',
    _src('ja.wikipedia 東京メトロ15000系（中間 20,000／寬 2,850／空調 4,022 mm）', 'Tokyo-Metro Series15000-15001.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _W15, 4.02,
    bands=[(1.66, 1.74, '#009bbf'), (1.74, 1.77, '#003f8e'), (2.80, 2.86, '#ffffff'), (2.86, 2.92, '#009bbf')],
    front=dict(Ln=1.0, tip_w=0.90, setback=0.28, face=ALU,
               cap=[(1.72, 1.80, '#009bbf'), (1.80, 1.84, '#003f8e'), (1.84, 3.38, BLK)], wrap=[(1.72, 3.45, '#009bbf')],
               decals=windscreen(_W15, 0.90, 2.12, 3.32, mask=None)
               + lamps(0.98, 2.06, r=0.08, bezel=None),
               skirt=SKIRT))

_W16 = 2.848
TM16000 = metro20('tm16000', '東京地鐵 16000 系（千代田線）',
    _src('ja.wikipedia 東京メトロ16000系（中間 20,000／寬 2,848／空調 4,022 mm）', 'Tokyo-Metro Series16000-16001.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _W16, 4.02,
    bands=[(1.64, 1.74, '#00bb85'), (2.80, 2.88, '#00bb85')],
    front=dict(Ln=1.0, tip_w=0.90, setback=0.30, face=ALU,
               decals=windscreen(_W16, 0.90, 2.10, 3.34, door=-0.25)
               + [('rect', 0.0, 1.90, 2 * _yt(_W16, 0.90), 0.34, 0.10, '#00bb85'), ('band', 2.06, 2.10, '#ffffff')]
               + lamps(0.92, 1.90, r=0.09, bezel=None),
               skirt=SKIRT))

_W10 = 2.85
TM10000 = metro20('tm10000', '東京地鐵 10000 系（有樂町線・副都心線）',
    _src('ja.wikipedia 東京メトロ10000系（中間 20,000／寬 2,850／空調 4,045 mm）', 'Tokyo-Metro-Series10000 10102.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _W10, 4.045,
    bands=[(1.62, 1.68, '#9c5e31'), (1.68, 1.70, '#ffffff'), (1.70, 1.76, '#c1a470')],
    front=dict(Ln=1.0, tip_w=0.86, tip_drop=0.14, setback=0.16, face=ALU,
               cap=[(1.74, 1.78, '#9c5e31'), (1.78, 1.92, '#f4f4f2'), (1.92, 1.98, '#c1a470'), (1.98, 3.36, BLK)],
               wrap=[(1.74, 3.48, '#d88a2c')],
               decals=windscreen(_W10, 0.86, 2.24, 3.34, mask=None)
               + lamps(1.0, 2.10, r=0.07),
               skirt=SKIRT))

_W17 = 2.848
TM17000 = metro20('tm17000', '東京地鐵 17000 系（有樂町線・副都心線）',
    _src('ja.wikipedia 東京メトロ17000系（中間 20,000／寬 2,848／空調 4,022 mm）', 'Tokyo-Metro-Series17000 17105.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _W17, 4.02,
    bands=[(1.64, 1.72, '#9c5e31'), (1.72, 1.76, '#e2b83a'), (2.82, 2.86, '#e2b83a')],
    front=dict(Ln=1.0, tip_w=0.88, setback=0.28, face=ALU,
               cap=[(1.80, 1.86, '#e2b83a'), (1.86, 2.12, '#d97a35'), (2.12, 3.34, BLK), (3.34, None, '#d97a35')],
               wrap=[(1.80, 3.48, '#d97a35')],
               decals=windscreen(_W17, 0.88, 2.12, 3.34, mask=None)
               + lamps(0.98, 2.00, r=0.09, bezel=BLK),
               skirt=SKIRT))

_W18 = 2.828
TM18000 = metro20('tm18000', '東京地鐵 18000 系（半藏門線）',
    _src('ja.wikipedia 東京メトロ18000系（車體長 中間 19,500／車側灯間 2,828 mm；全高依 17000 系估）', 'Tokyo-Metro Series18000-18007.jpg', 'MaedaAkihiko', 'CC0'),
    _W18, 4.05,
    bands=[(1.64, 1.70, '#8f76d6'), (1.70, 1.75, '#5b3e9c'), (2.82, 2.87, '#8f76d6')],
    front=dict(Ln=1.0, tip_w=0.88, setback=0.28, face=ALU,
               cap=[(1.80, 2.08, '#5b3e9c'), (2.08, 2.14, '#a99be0'), (2.14, 3.34, BLK), (3.34, None, '#a99be0')],
               wrap=[(1.80, 3.48, '#a99be0')],
               decals=windscreen(_W18, 0.88, 2.14, 3.34, mask=None)
               + lamps(1.0, 2.02, r=0.08, bezel=None),
               skirt=SKIRT))

_W08 = 2.78
TM08 = metro20('tm08', '東京地鐵 08 系（半藏門線）',
    _src('ja.wikipedia 東京メトロ08系（中間 20,000／車體寬 2,780／4,022 mm）', 'Tokyo-Metro Series08-006.jpg', 'MaedaAkihiko', 'CC0'),
    _W08, 4.02,
    bands=[(1.64, 1.76, '#a8327f')],
    front=dict(Ln=0.9, tip_w=0.88, setback=0.22, face=ALU,
               decals=windscreen(_W08, 0.88, 1.74, 3.34, door=-0.20, pad=0.10)
               + [('rect', 0.0, 1.88, 1.70, 0.24, 0.04, '#a8327f')]
               + [('rect', -0.25, 2.62, 0.08, 1.20, 0.02, BLK)]
               + lamps(1.0, 1.90, r=0.07, bezel=None),
               skirt=SKIRT))
# 08 系面罩下緣涵蓋頭燈，玻璃起點較高
TM08['front']['decals'] = [d if not (d[0] == 'rect' and d[-1] == 'GLASS') else d[:2] + (2.68,) + d[3:4] + (1.20,) + d[5:] for d in TM08['front']['decals']]

_W90 = 2.78
TM9000 = metro20('tm9000', '東京地鐵 9000 系（南北線）',
    _src('ja.wikipedia 東京メトロ9000系（中間 20,000／寬 2,780／4,080 mm）', 'Tokyo-Metro Series9000R-9803.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _W90, 4.05,
    bands=[(1.64, 1.72, '#00ac9b'), (1.72, 1.75, '#ffffff'), (1.75, 1.78, '#00ac9b')],
    front=dict(Ln=0.6, tip_w=0.93, tip_drop=0.12, setback=0.06, face=ALU,
               decals=windscreen(_W90, 0.93, 2.10, 3.36, pad=0.07, r=0.08)
               + [('rect', 0.0, 1.98, 2 * _yt(_W90, 0.93), 0.18, 0.04, BLK, 0.8)]
               + [('band', 1.72, 1.80, '#00ac9b'), ('band', 1.80, 1.83, '#ffffff'), ('band', 1.83, 1.87, '#00ac9b')]
               + [('rect', -0.92, 1.98, 0.30, 0.10, 0.03, LAMP, 0.9), ('rect', 0.92, 1.98, 0.30, 0.10, 0.03, LAMP, 0.9)],
               skirt=SKIRT))

_W05 = 2.85
TM05 = metro20('tm05', '東京地鐵 05 系（東西線）',
    _src('ja.wikipedia 東京メトロ05系（中間 20,000／寬 2,850／冷房上面 4,020 mm）', '2022-2-11-nishikasai.jpg', '勝沼梓', 'CC BY-SA 4.0'),
    _W05, 4.02,
    bands=[(1.66, 1.76, '#009bbf'), (1.76, 1.78, '#ffffff'), (1.78, 1.80, '#003f8e')],
    front=dict(Ln=0.55, tip_w=0.93, tip_drop=0.12, setback=0.06, face=ALU,
               decals=windscreen(_W05, 0.93, 2.14, 3.36, pad=0.07, r=0.06)
               + [('band', 1.74, 1.94, '#009bbf'), ('band', 1.94, 1.97, '#ffffff'), ('band', 1.97, 2.01, '#003f8e')]
               + [('rect', -0.95, 2.04, 0.26, 0.10, 0.03, '#f4e9c0', 0.9), ('rect', 0.95, 2.04, 0.26, 0.10, 0.03, '#f4e9c0', 0.9)],
               skirt=SKIRT_D))

_W07 = 2.80
TM07 = metro20('tm07', '東京地鐵 07 系（東西線）',
    _src('ja.wikipedia 東京メトロ07系（先頭 20,070／車體寬 2,800／4,092 mm）', 'Tokyo-Metro Series07R-76.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _W07, 4.05,
    bands=[(1.66, 1.75, '#009bbf'), (1.75, 1.78, '#003f8e')],
    front=dict(Ln=0.9, tip_w=0.86, tip_drop=0.16, setback=0.12, face=ALU,
               decals=windscreen(_W07, 0.86, 2.10, 3.32, door=-0.30, pad=0.07, r=0.26)
               + [('band', 1.86, 1.95, '#009bbf'), ('band', 1.95, 1.98, '#003f8e')]
               + lamps(0.98, 1.92, r=0.08),
               skirt=SKIRT))

_W80 = 2.85
TM8000 = metro20('tm8000', '東京地鐵 8000 系（半藏門線）',
    _src('ja.wikipedia 東京メトロ8000系（全長 20,000／全高 4,135 mm；寬度未核實）', 'Tokyo-Metro Series8000-8015.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _W80, 4.08,
    bands=[(1.64, 1.78, '#b23c8e')],
    front=dict(Ln=0.45, tip_w=0.94, tip_drop=0.14, setback=0.04, face=ALU,
               decals=[('rect', -0.98, 2.62, 0.42, 1.08, 0.05, BLK, 0.85), ('rect', -0.98, 2.62, 0.34, 1.00, 0.04, 'GLASS'),
                       ('rect', -0.38, 2.62, 0.56, 1.08, 0.05, BLK, 0.85), ('rect', -0.38, 2.80, 0.48, 0.70, 0.04, 'GLASS'),
                       ('rect', 0.58, 2.62, 1.12, 1.08, 0.05, BLK, 0.85), ('rect', 0.58, 2.62, 1.04, 1.00, 0.04, 'GLASS'),
                       ('rect', 0.0, 3.30, 2.30, 0.14, 0.03, BLK, 0.8),
                       ('band', 1.82, 2.04, '#b23c8e')]
               + lamps(1.02, 1.93, r=0.08, bezel=None),
               skirt=SKIRT_D))

# --- 都營 ---
_W55 = 2.809
TOEI5500 = dict(
    id='toei5500', name='都營 5500 形（淺草線）',
    source=_src('ja.wikipedia 都営5500形（全長 18,000／車側灯間 2,808.8／空調 4,036 mm）', 'Toei-Type5522-1.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    pitch=18.0, W=_W55, zb=1.0, roof=3.60, shoulder=3.20, ac_top=4.03, body=SUS, roof_col='#a3a8ad', win_frame='#2a2c2f',
    doors=(-5.9, 0.0, 5.9), bands=[(1.76, 2.75, '#3a3d42'), (2.86, 2.92, '#e2405e')], door_frame='#e2405e',
    ac=[(-4.0, 2.4), (4.0, 2.4)],
    front=dict(Ln=1.25, tip_w=0.84, tip_drop=0.14, setback=0.30, face='#dfe1e3',
               cap=[(1.30, 3.42, '#4a4e55')], wrap=[(3.30, None, '#4a4e55')],
               decals=[('rect', 0.0, 2.72, 2 * _yt(_W55, 0.84) - 0.30, 1.10, 0.10, '#18191b', 0.85),
                       ('rect', -0.55, 2.66, 0.66, 0.86, 0.08, 'GLASS'), ('rect', 0.42, 2.66, 0.90, 0.86, 0.08, 'GLASS'),
                       ('rect', 0.0, 3.27, 1.80, 0.14, 0.03, '#18191b'),
                       # 隈取：兩側紅色弧帶
                       ('poly', [(-1.12, 3.40), (-1.02, 3.40), (-1.04, 2.20), (-0.86, 1.55), (-0.96, 1.48), (-1.14, 2.15)], '#e2405e'),
                       ('poly', [(1.02, 3.40), (1.12, 3.40), (1.14, 2.15), (0.96, 1.48), (0.86, 1.55), (1.04, 2.20)], '#e2405e'),
                       ('rect', -0.95, 1.92, 0.07, 0.40, 0.02, LAMP, 0.9), ('rect', 0.95, 1.92, 0.07, 0.40, 0.02, LAMP, 0.9)],
               skirt=('#b4b8bc', 0.30, 0.78)),
)

_W63 = 2.831
TOEI6300 = metro20('toei6300', '都營 6300 形（三田線）',
    _src('ja.wikipedia 都営6300形（中間 20,000／寬 2,831／4,045 mm）', 'Toei-Type6300-6314.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _W63, 4.045, body=SUS,
    bands=[(1.62, 1.66, '#e60012'), (1.66, 1.76, '#0067b0')],
    front=dict(Ln=0.6, tip_w=0.92, tip_drop=0.14, setback=0.08, face='#c9c3b8',
               cap=[(1.86, 2.08, '#0067b0'), (2.08, 2.13, '#e60012'), (2.13, 3.38, '#0067b0')],
               decals=windscreen(_W63, 0.92, 2.18, 3.34, pad=0.06, mask=None)
               + lamps(0.95, 1.98, r=0.08, bezel=BLK),
               skirt=SKIRT_D))

_W65 = 2.829
TOEI6500 = metro20('toei6500', '都營 6500 形（三田線）',
    _src('ja.wikipedia 都営6500形（中間 20,000／車側灯幅 2,829／空調 4,056 mm）', 'Toei Series6500-6502.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _W65, 4.056, body=SUS,
    bands=[(2.80, 2.86, '#0079c2')], door_frame='#0079c2',
    front=dict(Ln=0.45, tip_w=0.95, tip_drop=0.08, setback=0.03, face='#c4c8cc',
               cap=[(1.58, 1.64, '#0079c2'), (1.64, 3.36, '#101214'), (3.36, None, '#0079c2')], wrap=[(1.58, 3.48, '#0079c2')],
               decals=[('rect', -0.68, 2.60, 0.78, 1.06, 0.04, 'GLASS'), ('rect', 0.0, 2.55, 0.50, 1.18, 0.04, 'GLASS'),
                       ('rect', 0.68, 2.60, 0.78, 1.06, 0.04, 'GLASS'),
                       ('rect', -1.04, 3.26, 0.16, 0.14, 0.03, LAMP, 0.9), ('rect', 1.04, 3.26, 0.16, 0.14, 0.03, LAMP, 0.9)],
               skirt=SKIRT_D))

_W103 = 2.79
TOEI10300 = metro20('toei10300', '都營 10-300 形（新宿線）',
    _src('ja.wikipedia 都営10-300形（中間 20,000／寬 2,790／4,036.5 mm）', 'Toei Series10-300 10-450.jpg', 'MaedaAkihiko', 'CC0'),
    _W103, 4.03, body=SUS,
    bands=[(1.62, 1.74, '#a6c93a'), (1.74, 1.78, '#1f2a5a')],
    front=dict(Ln=0.8, tip_w=0.90, setback=0.16, face=SUS,
               cap=[(1.72, 2.10, '#a6c93a'), (2.10, 2.15, '#1f2a5a'), (2.15, 3.36, BLK)],
               decals=windscreen(_W103, 0.90, 2.15, 3.36, door=-0.55, dw=0.50, pad=0.07, mask=None)
               + lamps(0.95, 3.18, r=0.06, bezel=None),
               skirt=SKIRT_D))

# 大江戶線：線性馬達小型車
_W126 = 2.49
TOEI12600 = dict(
    id='toei12600', name='都營 12-600 形（大江戶線）',
    source=_src('ja.wikipedia 都営12-600形（中間 16,500／寬 2,490／3,140 mm）', 'Toei-subway12-600.jpg', 'Nyohoho', 'CC BY-SA 3.0'),
    pitch=16.5, W=_W126, zb=0.80, roof=2.95, shoulder=2.66, ac_top=3.12, body=ALU, roof_col='#a3a8ad', win=(1.50, 2.38), win_frame='#3a3d40',
    doors=(-5.0, 0.0, 5.0), door_w=1.3, bands=[(1.40, 1.46, '#c03250')], door_frame='#c03250',
    ac=[(-3.6, 2.2), (3.6, 2.2)],
    front=dict(Ln=0.9, tip_w=0.88, tip_drop=0.10, setback=0.18, face='#c03250',
               cap=[(None, 1.38, ALU)], wrap=[(0.0, 1.38, ALU)],
               decals=windscreen(_W126, 0.88, 1.66, 2.80, door=0.40, dw=0.50, pad=0.07, r=0.18, mask='#1a1b1e')
               + [('band', 1.36, 1.40, '#ffffff')]
               + lamps(0.80, 1.18, r=0.10, bezel=None),
               skirt=('#9ea3a8', 0.20, 0.62)),
)

_W120 = 2.498
TOEI12000 = dict(
    TOEI12600, id='toei12000', name='都營 12-000 形（大江戶線）', W=_W120, ac_top=3.14,
    source=_src('ja.wikipedia 都営12-000形（中間 16,500／寬 2,498／3,150 mm）', 'Model 12-000 of Toei Transportation 2.jpg', 'Lover of Romance', 'CC BY-SA 3.0'),
    bands=[(1.80, 1.86, '#c03250'), (1.86, 1.89, '#e07a8e')], door_frame=None,
    front=dict(Ln=0.7, tip_w=0.90, tip_drop=0.12, setback=0.10, face=ALU,
               decals=windscreen(_W120, 0.90, 1.64, 2.82, door=0.0, dw=0.52, pad=0.07, r=0.16, mask='#1a1b1e')
               + [('rect', -0.70, 1.52, 0.70, 0.07, 0.02, '#d8282e'), ('rect', -0.18, 1.52, 0.36, 0.07, 0.02, '#e8b81e'),
                  ('rect', 0.42, 1.52, 0.70, 0.07, 0.02, '#2a9a4a')]
               + lamps(0.80, 1.20, r=0.09, bezel='#3a3d40'),
               skirt=('#9ea3a8', 0.20, 0.62)),
)

# --- 直通伙伴 ---
_W2T = 2.80
TOYO2000 = metro20('toyo2000', '東葉高速鐵道 2000 系',
    _src('ja.wikipedia 東葉高速鉄道2000系（中間 20,000／寬 2,800／4,022 mm）', 'Toyo-Rapid-Railway Series2000-2009.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _W2T, 4.02,
    bands=[(1.64, 1.68, '#e60012'), (1.68, 1.72, '#f39800'), (1.72, 1.75, '#f5c200')],
    front=dict(Ln=0.8, tip_w=0.90, setback=0.20, face=ALU,
               decals=windscreen(_W2T, 0.90, 1.98, 3.34, pad=0.07, r=0.10)
               + [('band', 1.84, 1.88, '#e60012'), ('band', 1.88, 1.92, '#f39800'), ('band', 1.92, 1.95, '#f5c200')]
               + lamps(1.0, 2.08, r=0.07, bezel=None),
               skirt=SKIRT))

_WSR = 2.78
SAITAMA2000 = metro20('saitama2000', '埼玉高速鐵道 2000 系',
    _src('ja.wikipedia 埼玉高速鉄道2000系（中間 20,000／寬 2,780／4,040 mm）', 'Series-SR2000-2802.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _WSR, 4.04,
    bands=[(1.64, 1.68, '#0067c0'), (1.68, 1.77, '#00a99d')],
    front=dict(Ln=0.6, tip_w=0.93, tip_drop=0.12, setback=0.06, face=ALU,
               decals=windscreen(_WSR, 0.93, 1.80, 3.36, pad=0.08, r=0.08)
               + [('rect', 0.0, 1.82, 2 * _yt(_WSR, 0.93), 0.14, 0.02, '#00a99d'), ('band', 1.89, 1.93, '#0067c0')]
               + [('rect', -0.92, 2.06, 0.26, 0.11, 0.03, LAMP, 0.9), ('rect', 0.92, 2.06, 0.26, 0.11, 0.03, LAMP, 0.9)],
               skirt=SKIRT))
# 玻璃只在 2.2 以上
SAITAMA2000['front']['decals'] = [d if not (d[0] == 'rect' and d[-1] == 'GLASS') else d[:2] + (2.76,) + d[3:4] + (1.04,) + d[5:] for d in SAITAMA2000['front']['decals']]

_WY5 = 2.80
YOKOHAMAY500 = metro20('yokohamay500', '橫濱高速鐵道 Y500 系',
    _src('ja.wikipedia 横浜高速鉄道Y500系（中間 20,000／寬 2,800／4,050 mm）', 'Yokohama-Series-Y502.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _WY5, 4.05, body=SUS,
    bands=[(1.62, 1.74, '#3a6fd8')], door_frame='#e8c23a',
    front=dict(Ln=0.85, tip_w=0.90, setback=0.18, face='#7f9ee0',
               cap=[(None, 1.62, '#3466d0')], wrap=[(0.0, 1.62, '#3466d0')],
               decals=windscreen(_WY5, 0.90, 2.02, 3.34, pad=0.08, r=0.10)
               + [('circle', 0.0, 1.88, 0.15, '#ffffff'), ('circle', 0.0, 1.88, 0.11, '#3466d0')]
               + lamps(0.96, 1.80, r=0.07, bezel=None),
               skirt=SKIRT_D))

# 筑波快線：流線型車頭、V 形下緣擋風玻璃
_WTX = 2.95
_ytx = _yt(_WTX, 0.84)
TX1000 = metro20('tx1000', '筑波快線 TX-1000 系',
    _src('ja.wikipedia つくばエクスプレス1000系（中間 20,000／寬 2,950／4,070 mm）', 'TX Series1000-1609.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _WTX, 4.07, doors=(-6.6, 0.0, 6.6),
    bands=[(2.84, 2.95, '#dc5a78')],
    front=dict(Ln=1.3, tip_w=0.84, tip_drop=0.16, setback=0.34, face=ALU,
               decals=[('poly', [(-_ytx, 3.36), (_ytx, 3.36), (_ytx, 2.40), (0.0, 2.16), (-_ytx, 2.40)], '#1d2a3a', 0.85),
                       ('poly', [(-_ytx + 0.06, 3.30), (-0.36, 3.30), (-0.36, 2.28), (-_ytx + 0.06, 2.44)], 'GLASS'),
                       ('poly', [(-0.28, 3.30), (0.28, 3.30), (0.28, 2.22), (-0.28, 2.22)], 'GLASS'),
                       ('poly', [(0.36, 3.30), (_ytx - 0.06, 3.30), (_ytx - 0.06, 2.44), (0.36, 2.28)], 'GLASS'),
                       ('rect', 0.0, 1.78, 0.62, 0.70, 0.02, '#b8bcc0')]
               + lamps(1.02, 2.06, r=0.07, bezel=None) + [('circle', -1.0, 1.82, 0.08, BLK), ('circle', 1.0, 1.82, 0.08, BLK)],
               skirt=('#b4b8bc', 0.30, 0.86)))

TX2000 = dict(TX1000, id='tx2000', name='筑波快線 TX-2000 系',
    source=_src('ja.wikipedia つくばエクスプレス2000系（中間 20,000／寬 2,950／4,070 mm）', 'TX Series2000-2654.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    front=dict(TX1000['front'], decals=TX1000['front']['decals'] + [('rect', 0.72, 2.50, 0.40, 0.09, 0.02, '#d8283c')]))

_WT3 = 2.998
TX3000 = metro20('tx3000', '筑波快線 TX-3000 系',
    _src('ja.wikipedia つくばエクスプレス3000系（中間 20,000／寬 2,998／4,070 mm）', 'TX Series3000-3685.jpg', 'MaedaAkihiko', 'CC BY-SA 4.0'),
    _WT3, 4.07, doors=(-6.6, 0.0, 6.6),
    bands=[(2.84, 2.95, '#d8508e')], door_frame='#4a4fb0',
    front=dict(Ln=1.0, tip_w=0.88, setback=0.26, face=ALU,
               decals=[('rect', 0.0, 2.08, 2 * _yt(_WT3, 0.88), 0.32, 0.12, '#ef4a52')]
               + windscreen(_WT3, 0.88, 2.16, 3.38, pad=0.08, r=0.20, mask='#1a1c20')
               + [('rect', -0.95, 1.86, 0.30, 0.05, 0.02, LAMP, 0.9), ('rect', 0.95, 1.86, 0.30, 0.05, 0.02, LAMP, 0.9)],
               skirt=SKIRT))

CARS += [TM13000, TM15000, TM16000, TM10000, TM17000, TM18000, TM08, TM9000, TM05, TM07, TM8000,
         TOEI5500, TOEI6300, TOEI6500, TOEI10300, TOEI12600, TOEI12000,
         TOYO2000, SAITAMA2000, YOKOHAMAY500, TX1000, TX2000, TX3000]


def _fill_cap(cfg):
    """kit.Nose.cap 只封 bands 涵蓋的高度；把其餘高度補上車頭底色，避免端面破洞。"""
    f = cfg.get('front', {})
    if not f.get('cap'):
        return
    face = f.get('face', '#e9eaea')
    lo, hi = -1e3, 1e3
    out, z = [], lo
    for z0, z1, col in sorted(f['cap'], key=lambda b: lo if b[0] is None else b[0]):
        z0 = lo if z0 is None else z0
        z1 = hi if z1 is None else z1
        if z0 > z:
            out.append((None if z == lo else z, z0, face))
        out.append((None if z0 == lo else z0, None if z1 == hi else z1, col))
        z = max(z, z1)
    if z < hi:
        out.append((z, None, face))
    cfg['front'] = dict(f, cap=out)


for _c in CARS[1:]:
    _fill_cap(_c)
