"""西武鐵道、東武鐵道（東上線／伊勢崎線系統）車型設定，給 jp.py 的參數化產生器用。
尺寸取自 catalog-2026-10.json（日文維基百科各車型 infobox）；外觀依 Commons 照片估計。"""

SIL = '#c4c8cc'     # 不鏽鋼／鋁合金車身
BLK = '#141618'     # 車頭黑色面罩
SKIRT = ('#8e959c', 0.30, 0.95)   # 銀灰色大型排障器


def lamps(y, z, r, lens='#f2efe2', housing='#1a1c1e'):
    """左右對稱的圓形頭燈（外框＋燈）。"""
    return [('circle', -y, z, r + 0.05, housing), ('circle', y, z, r + 0.05, housing),
            ('circle', -y, z, r, lens, 0.9), ('circle', y, z, r, lens, 0.9)]


def rlamps(y, z, w, h, housing='#1a1c1e', lens='#f2efe2'):
    """左右對稱的方形頭燈箱。"""
    return [('rect', -y, z, w, h, 0.04, housing), ('rect', y, z, w, h, 0.04, housing),
            ('rect', -y - w * 0.18, z, w * 0.42, h * 0.6, 0.03, lens, 0.9), ('rect', y + w * 0.18, z, w * 0.42, h * 0.6, 0.03, lens, 0.9)]


# 20 m 4 門車共用尺寸（車頂 3.66、肩 3.25）
D20 = dict(pitch=20.0, zb=1.0, roof=3.66, shoulder=3.25, ac=[(-4.8, 3.0), (0.0, 3.0), (4.8, 3.0)])

# ── 西武 ──────────────────────────────────────────────────────────────

SEIBU_YELLOW = '#e3bd1e'

# 西武新 2000 系／9000 系共用的平頭（兩窗＋中央貫通門、圓頭燈、燈下不鏽鋼飾板）
def _seibu_flat(face, door):
    return dict(Ln=0.42, tip_w=0.95, tip_drop=0.06, setback=0.06, face=face,
                decals=[('rect', -0.80, 3.30, 0.80, 0.42, 0.10, BLK, 0.85),            # 種別幕
                        ('rect', 0.00, 3.30, 0.72, 0.36, 0.06, BLK, 0.85),             # 行先幕
                        ('rect', 0.82, 3.30, 0.80, 0.42, 0.10, BLK, 0.85),
                        ('rect', -0.80, 2.48, 0.86, 0.90, 0.08, BLK, 0.85),
                        ('rect', -0.80, 2.48, 0.74, 0.78, 0.06, 'GLASS'),
                        ('rect', 0.82, 2.48, 0.86, 0.90, 0.08, BLK, 0.85),
                        ('rect', 0.82, 2.48, 0.74, 0.78, 0.06, 'GLASS'),
                        ('rect', 0.01, 2.10, 0.66, 2.00, 0.04, door, 0.5),              # 貫通門板（稍暗）
                        ('rect', 0.01, 2.45, 0.38, 0.72, 0.05, 'GLASS'),                # 貫通門窗
                        ('poly', [(-1.24, 1.30), (-0.36, 1.30), (-0.42, 1.58), (-1.24, 1.58)], '#b9bec3', 0.8),   # 不鏽鋼飾板
                        ('poly', [(1.24, 1.30), (0.36, 1.30), (0.42, 1.58), (1.24, 1.58)], '#b9bec3', 0.8)]
                + lamps(0.80, 1.78, 0.11),
                skirt=('#9aa0a6', 0.28, 1.0))


S2000 = dict(
    D20, id='seibu2000', name='西武新 2000 系',
    source='ja.wikipedia 西武2000系 新2000系 infobox（全長 20,000／寬 2,870／高 4,065 mm）；Commons: Seibu-Series New-2000 Express.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    W=2.87, ac_top=4.02, body=SEIBU_YELLOW, low='#b8961a', door_col='#ddb81d', roof_col='#8d9196',
    win=(1.80, 2.72), win_frame='#3d4043', ac=[(-4.8, 2.4), (-1.6, 2.4), (1.6, 2.4), (4.8, 2.4)],
    front=_seibu_flat(SEIBU_YELLOW, '#cfa91a'),
)

S9000 = dict(
    S2000, id='seibu9000', name='西武 9000 系（多摩湖線，紅色塗裝）',
    source='ja.wikipedia 西武9000系 infobox（全長 20,000／寬 2,870／高 4,065 mm）；Commons: Seibu 9000 series 9103F.jpg（Kznrhsd，CC0）',
    body='#d42530', low='#a91d26', door_col='#cf2430',
    front=_seibu_flat('#d42530', '#c4222c'),
)

S101 = dict(
    D20, id='seibu101', name='西武新 101 系（多摩川線）',
    source='ja.wikipedia 西武101系 infobox（全長 20,000／寬 2,877／高 4,065 mm）；Commons: Seibu New 101 series.JPG（みやっち，CC BY 3.0）',
    W=2.877, ac_top=4.02, body=SEIBU_YELLOW, low='#b8961a', door_col='#ddb81d', roof_col='#8d9196',
    win=(1.80, 2.72), win_frame='#3d4043', ac=[(-4.8, 2.4), (-1.6, 2.4), (1.6, 2.4), (4.8, 2.4)],
    front=dict(Ln=0.42, tip_w=0.95, tip_drop=0.06, setback=0.10, face=SEIBU_YELLOW,
               decals=[('rect', -0.62, 2.70, 1.10, 1.32, 0.10, BLK, 0.85),     # 左右兩大塊黑色窗區（含行先幕）
                       ('rect', 0.66, 2.70, 1.10, 1.32, 0.10, BLK, 0.85),
                       ('rect', -0.62, 2.48, 0.98, 0.70, 0.05, 'GLASS'),
                       ('rect', 0.66, 2.48, 0.98, 0.70, 0.05, 'GLASS'),
                       ('rect', -0.62, 3.14, 0.56, 0.18, 0.03, '#d8dade', 0.6),
                       ('rect', 0.66, 3.14, 0.70, 0.18, 0.03, '#d8dade', 0.6),
                       ('poly', [(-1.24, 1.26), (-0.36, 1.26), (-0.44, 1.56), (-1.24, 1.56)], '#b9bec3', 0.8),
                       ('poly', [(1.24, 1.26), (0.36, 1.26), (0.44, 1.56), (1.24, 1.56)], '#b9bec3', 0.8)]
               + lamps(0.88, 1.76, 0.11),
               skirt=('#3a3d40', 0.30, 0.95)),
)

CARS = [
    dict(
        D20, id='seibu40000', name='西武 40000 系',
        source='ja.wikipedia 西武40000系 infobox（中間車 20,000／寬 2,848／高 4,050 mm）；Commons: Seibu-Series40000 40001.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        W=2.848, ac_top=4.02, flare=(0.10, 0.62), body=SIL, roof_col='#a5aaaf', win_frame='#5a6066',
        door_frame='#1f7fd0', door_top=None, ac=[(-3.0, 3.6), (3.0, 3.6)],
        front=dict(Ln=1.05, tip_w=0.90, tip_drop=0.14, setback=0.30, face='#c9cdd1',
                   wrap=[(1.95, 3.70, '#2a2e33')],
                   decals=[('rect', 0.0, 2.80, 2.48, 1.60, 0.20, BLK, 0.9),               # 黑色上半部
                           ('rect', -0.86, 2.48, 0.62, 0.88, 0.06, 'GLASS'),
                           ('rect', 0.00, 2.48, 0.68, 0.88, 0.06, 'GLASS'),
                           ('rect', 0.82, 2.48, 0.74, 0.88, 0.06, 'GLASS'),
                           ('rect', 0.0, 3.30, 1.70, 0.22, 0.06, '#2b2f34', 0.6),            # 行先表示器
                           ('rect', -0.86, 1.62, 0.66, 0.66, 0.10, '#1f86d6', 0.6),          # 藍→綠漸層（分三格）
                           ('rect', -0.30, 1.62, 0.50, 0.66, 0.02, '#26b6c8', 0.6),
                           ('rect', 0.25, 1.62, 0.62, 0.66, 0.02, '#38c27a', 0.6),
                           ('rect', 0.88, 1.62, 0.62, 0.66, 0.10, '#2f8fd4', 0.6),
                           ('rect', -1.18, 1.62, 0.08, 0.60, 0.02, '#8a1f2a', 0.6),          # 左側尾燈條
                           ('rect', 1.18, 1.62, 0.08, 0.60, 0.02, '#8a1f2a', 0.6)],
                   skirt=('#c3c7cb', 0.25, 1.10)),
    ),
    dict(
        D20, id='seibu30000', name='西武 30000 系（Smile Train）',
        source='ja.wikipedia 西武30000系 infobox（全長 20,000／寬 2,975／高 4,060 mm）；Commons: Seibu-Ikebukuro-Line Series30000-38811.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        W=2.975, ac_top=4.02, flare=(0.14, 0.62), body=SIL, roof_col='#a5aaaf', win_frame='#5a6066',
        bands=[(1.28, 1.70, '#3a8fd2')], door_over_bands=False, door_col='#c0c4c8', ac=[(-3.0, 3.6), (3.0, 3.6)],
        front=dict(Ln=1.35, tip_w=0.86, tip_drop=0.20, setback=0.30, face='#f3f4f4',
                   decals=[('rect', 0.0, 2.76, 2.36, 1.56, 0.55, BLK, 0.9),               # 蛋形大窗
                           ('rect', 0.0, 2.78, 2.10, 1.10, 0.40, 'GLASS'),
                           ('poly', [(-1.08, 1.92), (1.08, 1.92), (0.86, 1.70), (0.45, 1.60), (-0.45, 1.60), (-0.86, 1.70)], '#2f9ad6', 0.6),
                           ('poly', [(-0.35, 1.92), (0.40, 1.92), (0.30, 1.62), (-0.30, 1.62)], '#3cc28a', 0.6),
                           ('rect', 0.0, 1.16, 0.95, 0.34, 0.14, '#1a1c1e', 0.4)]           # 「嘴巴」連結器開口
                   + lamps(0.96, 1.42, 0.10),
                   skirt=('#f0f1f1', 0.30, 0.95)),
    ),
    dict(
        D20, id='seibu20000', name='西武 20000 系',
        source='ja.wikipedia 西武20000系 infobox（中間車 20,000／寬 2,845／高 4,060 mm）；Commons: Seibu Series20000-20101.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        W=2.845, ac_top=4.02, body=SIL, roof_col='#a5aaaf', win_frame='#5a6066',
        door_frame='#1f6fd0', bands=[(1.22, 1.30, '#1f6fd0')], ac=[(-3.0, 3.6), (3.0, 3.6)],
        front=dict(Ln=0.70, tip_w=0.92, tip_drop=0.10, setback=0.18, face='#9da3a9',
                   wrap=[(3.45, 3.70, '#1f6fd0')],
                   decals=[('rect', 0.0, 2.78, 2.46, 1.40, 0.12, BLK, 0.9),
                           ('rect', 0.0, 2.68, 2.20, 0.96, 0.08, 'GLASS'),
                           ('rect', 0.20, 3.27, 1.10, 0.22, 0.03, '#2b2f34', 0.6),
                           ('band', 3.52, 3.62, '#1f6fd0'),
                           ('rect', 0.0, 1.68, 1.62, 0.66, 0.02, '#1f6fd0', 0.55)]           # 中央藍色面板
                   + rlamps(1.0, 1.66, 0.28, 0.54),
                   skirt=('#9da3a9', 0.25, 1.05)),
    ),
    dict(
        D20, id='seibu6000', name='西武 6000 系',
        source='ja.wikipedia 西武6000系 infobox（全長 20,000／寬 2,871／高 4,060 mm）；Commons: Seibu-Series6000 6007.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        W=2.871, ac_top=4.02, body=SIL, roof_col='#a5aaaf', win_frame='#5a6066',
        bands=[(1.56, 1.70, '#1f5fc0'), (1.70, 1.73, '#f2f2f2'), (3.06, 3.16, '#1f5fc0')], ac=[(-3.0, 3.6), (3.0, 3.6)],
        front=dict(Ln=0.45, tip_w=0.94, tip_drop=0.08, setback=0.12, face='#f2f3f3',
                   decals=[('rect', -0.68, 3.28, 0.82, 0.32, 0.06, BLK, 0.85),               # 左（貫通門側）上窗
                           ('rect', -0.68, 2.40, 0.66, 0.90, 0.06, 'GLASS'),                  # 貫通門窗
                           ('rect', 0.52, 2.66, 1.46, 1.42, 0.08, BLK, 0.9),                  # 右側大擋風窗
                           ('rect', 0.52, 2.62, 1.30, 1.00, 0.06, 'GLASS'),
                           ('rect', -0.68, 1.80, 0.86, 0.13, 0.0, '#1f5fc0', 0.55),           # 左側藍帶
                           ('rect', 0.52, 1.75, 1.46, 0.48, 0.0, '#1f5fc0', 0.55)]            # 右側藍色面板
                   + rlamps(0.72, 1.52, 0.48, 0.20, housing='#d0d3d6'),
                   skirt=('#a9aeb3', 0.25, 1.0)),
    ),
    S2000,
    S9000,
    S101,
    dict(
        D20, id='seibu8000', name='西武 8000 系（元小田急 8000 形）',
        source='ja.wikipedia 西武8000系 infobox（全長 20,000／寬 2,967／高 4,040 mm）；Commons: Seibu Series8000-8003.jpg（MaedaAkihiko，CC0）',
        W=2.967, ac_top=4.0, body='#f2f3f2', low='#c9cbcb', door_col='#eceeed', roof_col='#8d9196', win_frame='#3d4043',
        bands=[(3.02, 3.12, '#3f9ad0'), (1.30, 1.72, '#5ba9c4')], door_over_bands=True,
        ac=[(-4.8, 2.4), (-1.6, 2.4), (1.6, 2.4), (4.8, 2.4)],
        front=dict(Ln=0.50, tip_w=0.94, tip_drop=0.08, setback=0.14, face='#f2f3f2',
                   decals=[('rect', 0.0, 2.64, 2.62, 1.36, 0.06, BLK, 0.9),               # 黑色三窗區
                           ('rect', -0.80, 2.56, 0.80, 0.90, 0.04, 'GLASS'),
                           ('rect', 0.0, 2.60, 0.62, 1.00, 0.04, 'GLASS'),
                           ('rect', 0.80, 2.56, 0.80, 0.90, 0.04, 'GLASS'),
                           ('rect', 0.0, 3.22, 0.56, 0.18, 0.03, '#2b2f34', 0.6),
                           ('rect', -0.72, 1.70, 0.62, 0.48, 0.02, '#2f6fd0', 0.55),          # 藍綠格紋（簡化成三色塊）
                           ('rect', 0.0, 1.70, 0.84, 0.48, 0.02, '#3bb07a', 0.55),
                           ('rect', 0.72, 1.70, 0.62, 0.48, 0.02, '#2f6fd0', 0.55)]
                   + rlamps(1.0, 1.84, 0.50, 0.24, housing='#1a1c1e'),
                   skirt=('#a9aeb3', 0.28, 0.98)),
    ),
]

# ── 東武 ──────────────────────────────────────────────────────────────

TOBU_ORANGE = '#f08a10'


def _tobu_a_train(panel, wrap_panel=True, door_left=False, extra=()):
    """東武 50000 型系列（日立 A-train）：上半黑色大窗、下半整片色板、下角黑色頭燈箱。"""
    dec = [('rect', 0.0, 2.80, 2.44, 1.40, 0.16, BLK, 0.9)]
    if door_left:   # 50050／50070／50090：左側（車右）貫通／避難門
        dec += [('rect', -0.86, 2.62, 0.52, 1.00, 0.05, 'GLASS'),
                ('rect', 0.30, 2.66, 1.66, 0.80, 0.05, 'GLASS')]
    else:
        dec += [('rect', 0.0, 2.66, 2.24, 0.82, 0.06, 'GLASS')]
    dec += [('rect', 0.0, 3.30, 1.10, 0.22, 0.03, '#2b2f34', 0.6),
            ('rect', 0.0, 1.72, 2.46, 0.66, 0.04, panel, 0.6)]
    dec += list(extra)
    dec += rlamps(0.98, 1.36, 0.40, 0.22)
    return dict(Ln=0.62, tip_w=0.92, tip_drop=0.10, setback=0.16, face='#c9cdd1',
                wrap=[(1.40, 2.06, panel), (2.06, 3.50, '#2a2e33')] if wrap_panel else [(2.06, 3.50, '#2a2e33')],
                decals=dec, skirt=('#8e959c', 0.25, 1.05))


T50000 = dict(
    D20, id='tobu50000', name='東武 50000 型（東上線）',
    source='ja.wikipedia 東武50000系 infobox（中間車 20,000／狹幅 2,846／高 4,050 mm）；Commons: Tobu-Tojo-Line-Series51001F.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    W=2.846, ac_top=4.02, body=SIL, roof_col='#a5aaaf', win_frame='#5a6066', door_frame=TOBU_ORANGE,
    ac=[(-3.0, 3.6), (3.0, 3.6)],
    front=_tobu_a_train(TOBU_ORANGE),
)

CARS += [
    T50000,
    dict(T50000, id='tobu50050', name='東武 50050 型（半藏門線直通）',
         source='ja.wikipedia 東武50000系 infobox（中間車 20,000／寬 2,846／高 4,050 mm）；Commons: Tobu50050-RPU15006.jpg（The RW place，CC BY-SA 3.0）',
         front=_tobu_a_train(TOBU_ORANGE, door_left=True)),
    dict(T50000, id='tobu50090', name='東武 50090 型（TJ ライナー）',
         source='ja.wikipedia 東武50000系 infobox（中間車 20,000／寬 2,846／高 4,050 mm）；Commons: Tobu Railway 50090 TJ-Liner.jpg（Sui-setz，Public domain）',
         bands=[(1.56, 1.66, '#4a4cb4')],
         front=_tobu_a_train(TOBU_ORANGE, door_left=True,
                             extra=[('rect', 0.0, 2.00, 2.46, 0.08, 0.0, '#4a4cb4', 0.55), ('rect', 0.0, 1.93, 2.46, 0.06, 0.0, '#e8e9ea', 0.55)])),
    dict(
        D20, id='tobu70000', name='東武 70000 型（日比谷線直通）',
        source='ja.wikipedia 東武70000系 infobox（中間車 20,000／寬 2,829／高 3,972 mm）；Commons: Tobu-Series70000-71701.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        W=2.829, roof=3.60, ac_top=3.97, flare=(0.10, 0.62), body=SIL, roof_col='#a5aaaf', win_frame='#5a6066',
        bands=[(1.44, 1.60, '#d8263a'), (3.08, 3.16, '#d8263a')], ac=[(-3.0, 3.6), (3.0, 3.6)],
        front=dict(Ln=1.0, tip_w=0.88, tip_drop=0.16, setback=0.32, face='#d8263a',
                   wrap=[(1.0, 1.55, '#8e959c'), (1.55, 3.80, '#d8263a')],
                   cap=[(None, 1.55, '#8e959c')],
                   decals=[('rect', 0.0, 2.86, 2.30, 1.56, 0.18, BLK, 0.9),
                           ('rect', -0.80, 2.68, 0.62, 1.00, 0.06, 'GLASS'),
                           ('rect', -0.08, 2.64, 0.60, 1.08, 0.04, 'GLASS'),
                           ('rect', 0.68, 2.70, 0.80, 0.98, 0.06, 'GLASS'),
                           ('rect', 0.0, 1.84, 2.40, 0.48, 0.02, '#d8263a', 0.55),          # 窗下紅色面板
                           ('band', 1.52, 1.60, '#3a3d40')]
                   + rlamps(0.96, 1.86, 0.40, 0.18),
                   skirt=('#9aa0a6', 0.28, 1.10)),
    ),
]

# 東武 10000／9000／30000：不鏽鋼平頭＋紅帶
TOBU_RED = '#c81a30'

CARS += [
    dict(
        D20, id='tobu10000', name='東武 10000 系',
        source='ja.wikipedia 東武10000系 infobox（全長 20,000／寬 2,874／高 4,045 mm）；Commons: Tobu-Series10000 11006.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        W=2.874, ac_top=4.0, body=SIL, roof_col='#a5aaaf', win_frame='#6f757b',
        bands=[(1.62, 1.76, TOBU_RED), (1.12, 1.60, '#b2b7bc')], door_over_bands=True, ac=[(-3.0, 3.6), (3.0, 3.6)],
        front=dict(Ln=0.42, tip_w=0.95, tip_drop=0.08, setback=0.14, face='#c9cdd1',
                   decals=[('rect', -0.82, 2.64, 0.82, 1.20, 0.06, '#1e2a40', 0.9),        # 左窗（含藍底行先幕）
                           ('rect', -0.82, 2.48, 0.74, 0.80, 0.04, 'GLASS'),
                           ('rect', 0.82, 2.64, 0.82, 1.20, 0.06, '#1e2a40', 0.9),
                           ('rect', 0.82, 2.48, 0.74, 0.80, 0.04, 'GLASS'),
                           ('rect', 0.0, 2.04, 0.84, 2.20, 0.06, '#b9bec3', 0.5),            # 貫通門
                           ('rect', 0.0, 2.50, 0.56, 0.86, 0.05, 'GLASS'),
                           ('band', 1.82, 2.02, TOBU_RED)]
                   + rlamps(1.05, 1.62, 0.22, 0.24, housing='#d0d3d6'),
                   skirt=None),
    ),
    dict(
        D20, id='tobu30000', name='東武 30000 系',
        source='ja.wikipedia 東武30000系 infobox（全長 20,000／車體寬 2,770／高 4,045 mm）；Commons: Tobu-Series30000 31612.jpg（MaedaAkihiko，CC0）',
        W=2.77, ac_top=4.0, body=SIL, roof_col='#a5aaaf', win_frame='#6f757b',
        bands=[(1.62, 1.76, TOBU_RED)], ac=[(-3.0, 3.6), (3.0, 3.6)],
        front=dict(Ln=0.45, tip_w=0.95, tip_drop=0.08, setback=0.14, face='#c9cdd1',
                   decals=[('rect', -0.82, 2.60, 0.66, 1.14, 0.18, BLK, 0.9),
                           ('rect', -0.82, 2.58, 0.54, 0.98, 0.14, 'GLASS'),
                           ('rect', 0.84, 2.60, 0.66, 1.14, 0.18, BLK, 0.9),
                           ('rect', 0.84, 2.58, 0.54, 0.98, 0.14, 'GLASS'),
                           ('rect', 0.0, 3.32, 0.80, 0.20, 0.03, '#2b2f34', 0.6),
                           ('rect', 0.0, 2.00, 0.66, 2.10, 0.10, '#b9bec3', 0.5),
                           ('rect', 0.0, 2.48, 0.44, 0.84, 0.05, 'GLASS'),
                           ('band', 1.40, 1.70, TOBU_RED)]
                   + rlamps(0.84, 1.55, 0.42, 0.20, housing='#e2e4e6'),
                   skirt=('#a9aeb3', 0.25, 1.0)),
    ),
    dict(
        D20, id='tobu9000', name='東武 9000 型（東上線）',
        source='ja.wikipedia 東武9000系 infobox（全長 20,000／車體寬 2,770／高 4,045 mm）；Commons: Tobu-Tojo-Line-Series9101F.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        W=2.77, ac_top=4.0, body=SIL, roof_col='#a5aaaf', win_frame='#6f757b',
        bands=[(1.80, 1.92, TOBU_RED)], ac=[(-3.0, 3.6), (3.0, 3.6)],
        front=dict(Ln=0.40, tip_w=0.96, tip_drop=0.06, setback=0.08, face='#c9cdd1',
                   decals=[('rect', -0.94, 2.66, 0.46, 1.12, 0.06, BLK, 0.9),               # 左窄窗（藍底行先幕）
                           ('rect', -0.94, 3.04, 0.42, 0.30, 0.03, '#2f7fd0', 0.7),
                           ('rect', -0.94, 2.50, 0.40, 0.70, 0.04, 'GLASS'),
                           ('rect', -0.30, 2.08, 0.78, 2.00, 0.04, '#b9bec3', 0.5),          # 貫通門（偏左）
                           ('rect', -0.30, 2.62, 0.52, 0.66, 0.05, BLK, 0.8),
                           ('rect', 0.72, 2.66, 1.06, 1.12, 0.06, BLK, 0.9),                 # 右大窗
                           ('rect', 0.72, 3.04, 1.00, 0.30, 0.03, '#2f7fd0', 0.7),
                           ('rect', 0.72, 2.50, 1.00, 0.70, 0.04, 'GLASS'),
                           ('band', 1.90, 2.12, TOBU_RED)]
                   + rlamps(0.98, 1.62, 0.20, 0.24, housing='#d0d3d6'),
                   skirt=None),
    ),
]

# 東武 90000 系：Commons 找不到自由授權照片（2026-10 搜尋「東武90000系」「Tobu 90000 series」「東武90000型」皆無結果），
# catalog 塗裝／車頭亦標 unverified。以下僅依尺寸做成「新世代東上線鋁合金車」的暫定外觀，待有照片再修正。
CARS += [
    dict(
        D20, id='tobu90000', name='東武 90000 系（東上線，暫定外觀）',
        source='ja.wikipedia 東武90000系 infobox（先頭 20,470／中間 20,000／寬 2,828／高 4,108 mm）；無參考照片，外觀為暫定',
        W=2.828, roof=3.68, ac_top=4.10, flare=(0.10, 0.62), body=SIL, roof_col='#a5aaaf', win_frame='#5a6066',
        door_frame='#1a6fc0', ac=[(-3.0, 3.6), (3.0, 3.6)],
        front=dict(Ln=1.1, tip_w=0.88, tip_drop=0.16, setback=0.32, face='#c9cdd1',
                   wrap=[(2.00, 3.75, '#2a2e33')],
                   decals=[('rect', 0.0, 2.84, 2.30, 1.56, 0.20, BLK, 0.9),
                           ('rect', -0.78, 2.64, 0.66, 1.00, 0.06, 'GLASS'),
                           ('rect', 0.0, 2.62, 0.62, 1.06, 0.04, 'GLASS'),
                           ('rect', 0.76, 2.64, 0.70, 1.00, 0.06, 'GLASS'),
                           ('rect', 0.0, 3.36, 1.40, 0.20, 0.04, '#2b2f34', 0.6),
                           ('rect', 0.0, 1.86, 2.30, 0.14, 0.0, '#1a6fc0', 0.55)]
                   + rlamps(0.92, 1.58, 0.42, 0.20),
                   skirt=('#9aa0a6', 0.28, 1.10)),
    ),
]
