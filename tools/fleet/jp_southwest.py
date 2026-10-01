"""東急・小田急・京王（東京西南方私鐵）車型設定，給 jp.py 的參數化產生器用。
尺寸取自 docs/rolling-stock/catalog-2026-10.json（ja.wikipedia 各車型 infobox）；外觀依 Commons 照片估計，只做到俯視／斜看認得出的程度。"""

SS = '#c4c8cc'        # 不鏽鋼車身
SILVER = '#c9cdd1'    # 車頭銀色 FRP／塗裝
BLACK = '#1c1c1c'
IVORY = '#f2ede0'     # 京王車頭象牙色
KEIO_RED = '#dd0077'
KEIO_BLUE = '#1c2d7c'
OER_BLUE = '#1b5fb0'  # 小田急皇家藍（舊塗裝帶）
OER_BLUE2 = '#1b6fc6' # 小田急帝國藍（新塗裝，偏亮）


def lamp(y, z, w=0.36, h=0.13, frame=None, lit='#f2efe2'):
    """方形頭燈（省三角形：只貼燈面一片，外框色忽略）。"""
    return [('rect', y, z, w - 0.06, h - 0.04, 0.02, lit, 0.9)]


def lamps(y, z, **kw):
    return lamp(-y, z, **kw) + lamp(y, z, **kw)


def win3(left, door, right, zc, h, frame=BLACK, pad=0.06):
    """三片前窗（左窗、貫通門窗、右窗），各為 (cy, w)；先黑框再玻璃。"""
    out = []
    for cy, w in (left, door, right):
        out.append(('rect', cy, zc, w + pad * 2, h + pad * 2, 0.06, frame, 0.7))
    for cy, w in (left, door, right):
        out.append(('rect', cy, zc, w, h, 0.05, 'GLASS'))
    return out


# ───────────────────────────── 東急 ─────────────────────────────

# 5000 系家族（5000／5050／5080）：銀色 FRP 車頭，上半黑色窗區、貫通門偏左，窗下一條細色線，頭燈在下緣兩角。
T5000 = dict(
    pitch=20.0, W=2.80, roof=3.65, shoulder=3.22, ac_top=4.02, flare=(0.10, 0.62),
    ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
    front=dict(Ln=0.75, tip_w=0.92, tip_drop=0.08, setback=0.15, face=SILVER,
               decals=[('rect', 0.0, 2.63, 2.44, 1.44, 0.12, BLACK, 0.85),
                       ('rect', -1.04, 2.62, 0.30, 1.02, 0.04, 'GLASS'),
                       ('rect', -0.40, 2.62, 0.68, 1.02, 0.04, 'GLASS'),
                       ('rect', 0.62, 2.62, 1.14, 1.02, 0.04, 'GLASS'),
                       ('rect', -0.40, 1.48, 0.80, 0.78, 0.02, '#b9bdc1', 0.5),     # 貫通門下半
                       ('band', 1.86, 1.92, '#da0442'),
                       *lamps(1.00, 1.42, w=0.40, h=0.10)],
               skirt=('#b8bcc0', 0.30, 0.78)),
)


def t5000(id, name, source, W, top, low, line, wide=(1.32, 1.74)):
    f = dict(T5000['front'])
    f['decals'] = [d if d[0] != 'band' else ('band', 1.86, 1.92, line) for d in T5000['front']['decals']]
    return dict(T5000, id=id, name=name, source=source, W=W,
                bands=[(2.86, 2.98, top), (wide[0], wide[1], low)], front=f)


# 2020 系家族（2020／6020／3020，sustina）：黑色大圓頂面罩、白色下部、車頭下緣一條路線色弧線、側面窗上細色帶。
def t2020(id, name, source, col):
    dome = '#1d2028'
    return dict(
        id=id, name=name, source=source,
        pitch=20.0, W=2.826, roof=3.65, shoulder=3.22, ac_top=4.02, flare=(0.13, 0.62),
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(2.88, 2.96, col)],
        front=dict(Ln=1.25, tip_w=0.86, tip_drop=0.16, setback=0.32, face='#f4f4f2',
                   wrap=[(1.06, 1.16, col), (1.48, 4.2, dome)],
                   decals=[('rect', 0.0, 2.60, 2.38, 2.30, 0.45, dome, 0.8),
                           ('rect', -0.56, 2.70, 0.66, 0.95, 0.06, 'GLASS'),
                           ('rect', 0.46, 2.72, 1.22, 0.88, 0.06, 'GLASS'),
                           ('rect', 0.0, 3.34, 1.50, 0.18, 0.04, '#2b2f38', 0.7),
                           ('rect', 0.12, 1.58, 1.30, 0.05, 0.02, '#f4f4f2', 0.7),
                           ('circle', -0.98, 1.72, 0.07, '#e8f0ff', 0.9), ('circle', 0.98, 1.72, 0.07, '#e8f0ff', 0.9),
                           ('band', 1.08, 1.16, col)],
                   skirt=('#2a2d30', 0.30, 0.66)),
    )


# 舊型平頭（9000／1000）：銀色平頭、三片窗、窗下色帶裡嵌方形頭燈。
def t_flat(door_cy, left, right, band, band_col, wz=(2.08, 2.92)):
    zc, h = (wz[0] + wz[1]) / 2, wz[1] - wz[0]
    return dict(Ln=0.40, tip_w=0.96, tip_drop=0.05, setback=0.05, face='#c2c6ca',
                decals=[('rect', 0.0, 3.20, 2.30, 0.26, 0.04, BLACK, 0.7),
                        ('rect', door_cy, 1.75, 0.76, 2.30, 0.02, '#b0b4b8', 0.5),
                        *win3(left, (door_cy, 0.62), right, zc, h),
                        ('band', band[0], band[1], band_col),
                        *lamps(1.00, (band[0] + band[1]) / 2, w=0.40, h=0.16),
                        ('rect', -1.00, 1.42, 0.24, 0.10, 0.02, '#7a1f22'), ('rect', 1.00, 1.42, 0.24, 0.10, 0.02, '#7a1f22')],
                skirt=('#9da2a7', 0.30, 0.80))


CARS_TOKYU = [
    t5000('tokyu5050', '東急 5050 系（東橫線）',
          'ja.wikipedia 東急5000系電車(2代) infobox（5050系 先頭 20,200／寬 2,820／高 4,050 mm）；Commons: Tokyu 5050 series.jpg（Cheng-en Cheng，CC BY-SA 2.0）',
          2.82, '#da0442', '#da0442', '#da0442'),
    t5000('tokyu5000', '東急 5000 系（田園都市線）',
          'ja.wikipedia 東急5000系電車(2代) infobox（先頭 20,100／寬 2,800／高 4,050 mm）；Commons: Tokyu 5000 Series 5101F 20210811.jpg（Ryochancomne，CC BY-SA 4.0）',
          2.80, '#20a288', '#d23a4a', '#e60012'),
    t5000('tokyu5080', '東急 5080 系（目黑線）',
          'ja.wikipedia 東急5000系電車(2代) infobox（5080系 20,000／2,800／4,050 mm）；Commons: Tokyu-Series5080-Meguro-Line.jpg（MaedaAkihiko，CC BY-SA 4.0）',
          2.80, '#1f2a5a', '#009cd2', '#009cd2'),
    t2020('tokyu2020', '東急 2020 系（田園都市線）',
          'ja.wikipedia 東急2020系電車 infobox（先頭 20,470／中間 20,000、寬 2,826、高 4,046 mm）；Commons: Tokyu 2020 series Den-en-toshi Line Tana Station 20190530.jpg（Cfktj1596，CC BY-SA 4.0）',
          '#20a288'),
    t2020('tokyu6020', '東急 6020 系（大井町線）',
          'ja.wikipedia 東急2020系電車 infobox（20,000／2,826／4,046 mm）；Commons: Tokyu Series6020-6122.jpg（MaedaAkihiko，CC0）',
          '#f18c43'),
    t2020('tokyu3020', '東急 3020 系（目黑線）',
          'ja.wikipedia 東急2020系電車 infobox（20,000／2,826／4,046 mm）；Commons: Tokyu-series 3020-3122 8cars.jpg（LERK，CC BY-SA 4.0）',
          '#009cd2'),
    dict(
        id='tokyu3000', name='東急 3000 系（目黑線）',
        source='ja.wikipedia 東急3000系電車 infobox（先頭 20,300／中間 20,000、寬 2,820、高 4,065 mm）；Commons: Tokyu-Series3000-3813.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.82, roof=3.65, shoulder=3.22, ac_top=4.04, flare=(0.10, 0.62),
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(1.62, 1.82, '#d8202e'), (1.50, 1.58, '#1f2a5a')],   # 紅藍之間的白細線留給車身銀色
        front=dict(Ln=0.55, tip_w=0.94, tip_drop=0.06, setback=0.08, face=SILVER,
                   decals=[('rect', 0.0, 2.84, 2.48, 1.02, 0.06, BLACK, 0.8),
                           ('rect', -0.88, 2.80, 0.66, 0.80, 0.04, 'GLASS'),
                           ('rect', -0.06, 2.74, 0.70, 0.92, 0.04, 'GLASS'),
                           ('rect', 0.78, 2.80, 0.88, 0.80, 0.04, 'GLASS'),
                           ('band', 2.12, 2.32, '#2a2c30'),
                           ('band', 1.76, 2.10, '#d8202e'),
                           ('band', 1.71, 1.76, '#eef0f2'),
                           ('band', 1.58, 1.71, '#1f2a5a'),
                           *lamps(0.95, 1.93, w=0.42, h=0.20, frame='#c2c6ca')],
                   skirt=('#b8bcc0', 0.30, 0.86)),
    ),
    dict(
        id='tokyu6000', name='東急 6000 系（大井町線急行）',
        source='ja.wikipedia 東急6000系電車(2代) infobox（20,000／2,800／4,050 mm）；Commons: Tokyu6000(2).jpg（Yaguchi，CC BY-SA 3.0）',
        pitch=20.0, W=2.80, roof=3.65, shoulder=3.22, ac_top=4.02, flare=(0.10, 0.62),
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(3.00, 3.16, '#d7263a')], door_frame='#ee7a2e',   # 門旁橘色斜紋（簡化為直條）
        front=dict(Ln=1.05, tip_w=0.86, tip_drop=0.12, setback=0.38, face=SILVER,
                   wrap=[(2.02, 4.2, '#d7263a')],
                   decals=[('rect', 0.0, 2.90, 2.30, 1.70, 0.10, '#d7263a', 0.6),
                           ('rect', 0.0, 2.78, 2.26, 1.18, 0.14, '#1a1c1e', 0.85),
                           ('rect', -0.70, 2.80, 0.62, 0.95, 0.05, 'GLASS'),
                           ('rect', -0.02, 2.76, 0.62, 1.00, 0.05, 'GLASS'),
                           ('rect', 0.64, 2.80, 0.62, 0.95, 0.05, 'GLASS'),
                           ('band', 1.98, 2.03, '#f39a3e'),
                           ('rect', -1.08, 2.18, 0.12, 0.30, 0.03, '#f2efe2', 0.9), ('rect', 1.08, 2.18, 0.12, 0.30, 0.03, '#f2efe2', 0.9)],
                   skirt=('#c8ccd0', 0.30, 0.82)),
    ),
    dict(
        id='tokyu9000', name='東急 9000 系・9020 系（大井町線）',
        source='ja.wikipedia 東急9000系電車 infobox（20,000／2,800／4,050 mm）；Commons: Tokyu-Oimachi-Line Series9000-9009.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.80, roof=3.62, shoulder=3.20, ac_top=4.00,
        ac=[(-6.0, 1.6), (-2.0, 1.6), (2.0, 1.6), (6.0, 1.6)], win_frame='#5f656b',
        bands=[(1.50, 1.76, '#d8293a')],
        front=t_flat(-0.35, (-1.00, 0.50), (0.68, 1.16), (1.62, 1.88), '#f6a01e'),
    ),
    dict(
        id='tokyu1000', name='東急 1000 系（池上線・東急多摩川線，原色紅帶）',
        source='ja.wikipedia 東急1000系電車 infobox（18,000／2,800／3,990 mm）；Commons: Tokyu 1000 Series.jpg（T. Hanami，CC0）',
        pitch=18.0, W=2.80, roof=3.60, shoulder=3.18, ac_top=3.97,
        doors=(-6.1, 0.0, 6.1), ac=[(-3.8, 2.4), (3.8, 2.4)], win_frame='#5f656b',
        bands=[(1.52, 1.78, '#d8202e')],
        front=t_flat(-0.36, (-1.02, 0.44), (0.66, 1.20), (1.55, 1.85), '#d8202e'),
    ),
    dict(
        id='tokyu7000', name='東急 7000 系（池上線・東急多摩川線）',
        source='ja.wikipedia 東急7000系電車(2代) infobox（18,000／2,800／4,050 mm）；Commons: Tokyu-Series7000-7105F.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=18.0, W=2.80, roof=3.65, shoulder=3.22, ac_top=4.02, flare=(0.08, 0.62),
        doors=(-6.1, 0.0, 6.1), ac=[(-3.8, 2.4), (3.8, 2.4)], win_frame='#5f656b', roof_col='#3d6b4c',
        bands=[(3.00, 3.22, '#1e6b3a'), (2.90, 3.00, '#8dc21f')], door_frame='#8dc21f',   # 門旁綠色弧紋簡化為直條
        front=dict(Ln=0.95, tip_w=0.88, tip_drop=0.14, setback=0.22, face=SILVER,
                   wrap=[(2.22, 4.2, '#1e6b3a')],
                   decals=[('rect', 0.0, 2.92, 2.42, 1.52, 0.30, '#1e6b3a', 0.6),
                           ('rect', 0.0, 2.98, 2.20, 1.10, 0.14, BLACK, 0.85),
                           ('rect', -0.62, 2.84, 0.64, 0.82, 0.05, 'GLASS'),
                           ('rect', 0.42, 2.86, 1.18, 0.78, 0.05, 'GLASS'),
                           ('band', 2.18, 2.24, '#8dc21f'),
                           ('circle', -0.98, 2.36, 0.08, '#e9e7dc', 0.9), ('circle', 0.98, 2.36, 0.08, '#e9e7dc', 0.9)],
                   skirt=('#b8bcc0', 0.30, 0.80)),
    ),
]

# ───────────────────────────── 小田急 ─────────────────────────────

CARS_ODAKYU = [
    dict(
        id='odakyu3000', name='小田急 3000 形',
        source='ja.wikipedia 小田急3000形電車(2代) infobox（20,000／2,866／4,120 mm）；Commons: Odakyu-Series3000 3654.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.866, roof=3.68, shoulder=3.24, ac_top=4.08,
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(1.62, 1.82, OER_BLUE)],
        front=dict(Ln=0.60, tip_w=0.93, tip_drop=0.06, setback=0.10, face='#d4d8dc',
                   decals=[('rect', 0.0, 2.50, 2.42, 1.76, 0.06, BLACK, 0.85),
                           ('rect', -0.74, 2.66, 0.72, 0.84, 0.04, 'GLASS'),
                           ('rect', 0.38, 2.66, 1.50, 0.84, 0.04, 'GLASS'),
                           ('rect', 0.0, 2.07, 2.38, 0.05, 0.0, OER_BLUE),
                           ('circle', -0.80, 3.18, 0.07, '#f2efe2', 0.9), ('circle', 0.80, 3.18, 0.07, '#f2efe2', 0.9)],
                   skirt=('#c8ccd0', 0.30, 0.84)),
    ),
    dict(
        id='odakyu4000', name='小田急 4000 形',
        source='ja.wikipedia 小田急4000形電車(2代) infobox（20,000／2,790／4,045 mm）；Commons: Odakyu-Series4000 4055.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.79, roof=3.65, shoulder=3.22, ac_top=4.02, flare=(0.13, 0.62),
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(1.62, 1.82, OER_BLUE2)],
        front=dict(Ln=0.90, tip_w=0.90, tip_drop=0.10, setback=0.25, face=SILVER,
                   wrap=[(3.36, 4.2, '#2a8ee0'), (1.55, 1.93, '#2a8ee0')],
                   cap=[(None, 3.36, SILVER), (3.36, None, '#2a8ee0')],
                   decals=[('rect', 0.0, 2.65, 2.42, 1.44, 0.08, BLACK, 0.85),
                           ('rect', -0.80, 2.74, 0.66, 1.04, 0.04, 'GLASS'),
                           ('rect', 0.36, 2.80, 1.58, 0.90, 0.04, 'GLASS'),
                           ('band', 1.55, 1.93, '#2a8ee0'),
                           ('rect', -0.80, 1.40, 0.72, 0.30, 0.02, '#b9bdc1', 0.5),
                           ('circle', -0.96, 1.68, 0.13, '#1a1c1e'), ('circle', 0.96, 1.68, 0.13, '#1a1c1e'),
                           ('circle', -0.96, 1.68, 0.08, '#f2efe2', 0.9), ('circle', 0.96, 1.68, 0.08, '#f2efe2', 0.9)],
                   skirt=('#c8ccd0', 0.30, 0.82)),
    ),
    dict(
        id='odakyu1000', name='小田急 1000 形',
        source='ja.wikipedia 小田急1000形電車 infobox（20,000／2,860／4,060 mm）；Commons: Odakyu.type1000.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.86, roof=3.65, shoulder=3.22, ac_top=4.04,
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(1.60, 1.86, OER_BLUE2)],
        front=dict(Ln=0.50, tip_w=0.95, tip_drop=0.06, setback=0.08, face='#cdd1d5',
                   decals=[('rect', 0.06, 1.95, 0.76, 2.50, 0.02, '#b9bdc1', 0.5),
                           *win3((-0.80, 0.92), (0.06, 0.58), (0.92, 0.82), 2.68, 0.98, frame='#2a2c2e'),
                           ('rect', -0.80, 3.30, 0.80, 0.16, 0.03, BLACK), ('rect', 0.06, 3.30, 0.58, 0.16, 0.03, BLACK),
                           ('band', 1.60, 1.86, OER_BLUE2),
                           *lamps(0.94, 1.73, w=0.40, h=0.16, frame='#d0d4d8')],
                   skirt=('#c8ccd0', 0.30, 0.84)),
    ),
    dict(
        id='odakyu5000', name='小田急 5000 形（2 代，拡幅車）',
        source='ja.wikipedia 小田急5000形電車(2代) infobox（20,000／2,900／4,035 mm）；Commons: OER-Series5000-5451.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.90, roof=3.65, shoulder=3.22, ac_top=4.02, flare=(0.13, 0.62),
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(1.84, 1.88, '#4ab3e8'), (1.62, 1.82, '#0a5ec8')],
        front=dict(Ln=1.30, tip_w=0.84, tip_drop=0.16, setback=0.36, face=SILVER,
                   decals=[('rect', 0.0, 2.58, 2.30, 2.06, 0.40, '#1c2026', 0.85),
                           ('rect', 0.0, 2.88, 2.06, 1.00, 0.22, 'GLASS'),
                           ('rect', 0.0, 1.70, 1.20, 0.05, 0.02, '#4ab3e8', 0.9),
                           ('rect', 0.58, 2.00, 0.52, 0.16, 0.02, '#0a5ec8'),
                           ('circle', -0.92, 1.70, 0.05, '#f2efe2', 0.9), ('circle', 0.92, 1.70, 0.05, '#f2efe2', 0.9)],
                   skirt=('#c8ccd0', 0.30, 0.84)),
    ),
    dict(
        id='odakyu8000', name='小田急 8000 形',
        source='ja.wikipedia 小田急8000形電車 infobox（20,000／車體寬 2,900／4,040 mm）；Commons: Odakyu 8000.JPG（Toshinori baba，CC BY-SA 3.0）',
        pitch=20.0, W=2.90, roof=3.62, shoulder=3.20, ac_top=4.00,
        body='#f4f1e1', low='#d9d5c3', roof_col='#a9adb1', win_frame='#3a3d40',
        ac=[(-6.0, 1.6), (-2.0, 1.6), (2.0, 1.6), (6.0, 1.6)],
        bands=[(1.55, 1.85, OER_BLUE)],
        front=dict(Ln=0.40, tip_w=0.96, tip_drop=0.05, setback=0.05, face='#f4f1e1',
                   decals=[('rect', 0.0, 2.60, 2.54, 1.46, 0.12, BLACK, 0.85),
                           ('rect', -0.84, 2.40, 0.82, 0.76, 0.04, 'GLASS'),
                           ('rect', 0.0, 2.40, 0.54, 0.76, 0.04, 'GLASS'),
                           ('rect', 0.84, 2.40, 0.82, 0.76, 0.04, 'GLASS'),
                           ('rect', -0.84, 3.08, 0.50, 0.20, 0.03, '#b8352c', 0.6),
                           ('rect', 0.0, 1.42, 0.62, 0.92, 0.02, '#e2dfcf', 0.5),
                           ('band', 1.55, 1.85, OER_BLUE),
                           *lamps(0.88, 1.70, w=0.52, h=0.18, frame='#e8e6dc')],
                   skirt=('#c9ccd0', 0.30, 0.82)),
    ),
]

# ───────────────────────────── 京王 ─────────────────────────────

CARS_KEIO = [
    dict(
        id='keio9000', name='京王 9000 系',
        source='ja.wikipedia 京王9000系電車 infobox（20,000／2,845／4,017 mm）；Commons: Keio-Series9000-9701.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.845, roof=3.62, shoulder=3.20, ac_top=4.00,
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(1.70, 1.82, KEIO_RED), (1.58, 1.68, KEIO_BLUE)],
        front=dict(Ln=0.60, tip_w=0.94, tip_drop=0.06, setback=0.08, face=IVORY,
                   decals=[('rect', -0.80, 2.66, 0.92, 1.18, 0.10, BLACK, 0.8), ('rect', 0.80, 2.66, 0.92, 1.18, 0.10, BLACK, 0.8),
                           ('rect', -0.80, 2.66, 0.80, 1.04, 0.06, 'GLASS'), ('rect', 0.80, 2.66, 0.80, 1.04, 0.06, 'GLASS'),
                           ('rect', 0.0, 2.68, 0.42, 0.78, 0.04, 'GLASS'),
                           ('rect', 0.0, 3.25, 0.56, 0.16, 0.03, BLACK),
                           ('band', 1.82, 1.96, KEIO_RED),
                           ('band', 1.56, 1.79, KEIO_BLUE),
                           *lamps(0.90, 1.67, w=0.42, h=0.15, frame='#e8e6dc')],
                   skirt=('#e9e5d8', 0.30, 0.86)),
    ),
    dict(
        id='keio8000', name='京王 8000 系',
        source='ja.wikipedia 京王8000系電車 infobox（20,000／2,845／4,055 mm）；Commons: Keio-Series8000.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.845, roof=3.65, shoulder=3.22, ac_top=4.04,
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(2.84, 2.92, KEIO_RED), (1.62, 1.80, KEIO_RED)],
        front=dict(Ln=0.90, tip_w=0.90, tip_drop=0.10, setback=0.22, face=IVORY,
                   decals=[('rect', 0.0, 2.85, 2.42, 1.16, 0.10, BLACK, 0.85),
                           ('rect', -0.80, 2.80, 0.78, 0.96, 0.05, 'GLASS'),
                           ('rect', 0.02, 2.80, 0.66, 0.96, 0.05, 'GLASS'),
                           ('rect', 0.82, 2.80, 0.78, 0.96, 0.05, 'GLASS'),
                           ('band', 2.08, 2.11, KEIO_BLUE),
                           ('band', 1.62, 1.86, KEIO_RED),
                           *lamps(0.96, 1.74, w=0.40, h=0.14, frame='#e8e6dc')],
                   skirt=('#ece8dc', 0.30, 0.86)),
    ),
    dict(
        id='keio7000', name='京王 7000 系',
        source='ja.wikipedia 京王7000系電車 infobox（20,000／2,800／4,045 mm）；Commons: Keio-Series7000-7805.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.80, roof=3.62, shoulder=3.20, ac_top=4.02,
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(1.70, 1.82, KEIO_RED), (1.62, 1.68, KEIO_BLUE)],
        front=dict(Ln=0.40, tip_w=0.96, tip_drop=0.05, setback=0.05, face=IVORY,
                   decals=[('rect', 0.0, 3.20, 2.44, 0.30, 0.05, BLACK, 0.8),
                           ('rect', 0.0, 2.52, 2.44, 1.00, 0.06, '#2a2c2e', 0.7),
                           ('rect', -0.82, 2.52, 0.82, 0.86, 0.05, 'GLASS'), ('rect', 0.0, 2.52, 0.50, 0.86, 0.05, 'GLASS'),
                           ('rect', 0.82, 2.52, 0.82, 0.86, 0.05, 'GLASS'),
                           ('band', 1.98, 2.12, KEIO_RED),
                           ('band', 1.94, 1.98, KEIO_BLUE),
                           *lamps(0.98, 1.72, w=0.28, h=0.26, frame='#c0c4c8')],
                   skirt=('#c0c4c8', 0.30, 0.86)),
    ),
    dict(
        id='keio5000', name='京王 5000 系（2 代）',
        source='ja.wikipedia 京王5000系電車(2代) infobox（20,000／2,826／4,016.5 mm）；Commons: Keio Series5000-5737 Keio-Liner-36.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.826, roof=3.62, shoulder=3.20, ac_top=4.00, flare=(0.13, 0.62),
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(2.84, 3.06, KEIO_RED), (1.62, 1.78, KEIO_BLUE)],
        front=dict(Ln=1.20, tip_w=0.86, tip_drop=0.12, setback=0.35, face=SILVER,
                   wrap=[(1.62, 4.2, '#1c2236')],
                   decals=[('rect', 0.0, 2.68, 2.18, 2.08, 0.34, '#1c2236', 0.85),
                           ('rect', -1.16, 2.30, 0.10, 1.20, 0.04, KEIO_RED), ('rect', 1.16, 2.30, 0.10, 1.20, 0.04, KEIO_RED),
                           ('rect', -0.62, 2.92, 0.66, 1.00, 0.06, 'GLASS'),
                           ('rect', 0.44, 2.92, 1.24, 1.00, 0.06, 'GLASS'),
                           ('circle', -0.92, 1.86, 0.06, '#e8f0ff', 0.9), ('circle', 0.92, 1.86, 0.06, '#e8f0ff', 0.9)],
                   skirt=(KEIO_RED, 0.30, 0.86)),
    ),
    dict(
        id='keio2000', name='京王 2000 系',
        source='ja.wikipedia 京王2000系電車 infobox（20,000／2,826／4,016.5 mm）；Commons: Keio series2000-2701F.jpg（にいがたん，CC BY-SA 4.0）',
        pitch=20.0, W=2.826, roof=3.62, shoulder=3.20, ac_top=4.00, flare=(0.13, 0.62),
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(2.86, 2.94, '#c8155e')],
        front=dict(Ln=1.00, tip_w=0.88, tip_drop=0.12, setback=0.30, face=IVORY,
                   decals=[('rect', 0.0, 2.56, 2.40, 2.08, 0.55, '#c8155e', 0.6),
                           ('rect', 0.0, 2.58, 2.26, 1.94, 0.50, BLACK, 0.85),
                           ('rect', -0.02, 2.82, 2.02, 0.86, 0.10, 'GLASS'),
                           ('circle', -0.96, 1.62, 0.10, '#f2efe2', 0.9), ('circle', 0.96, 1.62, 0.10, '#f2efe2', 0.9)],
                   skirt=('#e9e5d8', 0.30, 0.84)),
    ),
    dict(
        id='keio1000', name='京王 1000 系（井之頭線，車頭鮭魚粉色編組）',
        source='ja.wikipedia 京王1000系電車(2代) infobox（20,000／車體基準寬 2,810／4,045 mm）；Commons: Inokashira line Series1000.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.81, roof=3.62, shoulder=3.20, ac_top=4.02,
        ac=[(-4.6, 2.8), (4.6, 2.8)], win_frame='#5f656b',
        bands=[(2.84, 3.00, '#f2a0a6')],
        front=dict(Ln=0.50, tip_w=0.95, tip_drop=0.06, setback=0.08, face=SILVER,
                   wrap=[(2.08, 4.2, '#f2a0a6')], cap=[(None, 2.08, SILVER), (2.08, None, '#f2a0a6')],
                   decals=[('rect', -0.37, 1.95, 0.70, 2.40, 0.02, '#b9bdc1', 0.5),
                           *win3((-1.04, 0.40), (-0.37, 0.56), (0.72, 1.12), 2.62, 0.92, frame='#c9cdd1'),
                           ('rect', -0.37, 3.30, 0.80, 0.24, 0.04, '#2a2c2e'),
                           ('rect', -1.02, 3.30, 0.14, 0.12, 0.02, '#f08a30'), ('rect', 1.02, 3.30, 0.14, 0.12, 0.02, '#f08a30'),
                           *lamps(0.98, 1.85, w=0.30, h=0.14, frame='#b0b4b8')],
                   skirt=('#c8ccd0', 0.30, 0.86)),
    ),
]

CARS = CARS_TOKYU + CARS_ODAKYU + CARS_KEIO
