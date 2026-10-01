"""京成・北總・京急（都營淺草線直通，18 m 3 門級）車型設定，給 jp.py 的參數化產生器用。
尺寸取自 catalog-2026-10.json（ja.wikipedia 規格表）；外觀依各款 Commons 參考照片估計。"""

# ---- 共用色 ----
SUS = '#c4c8cc'          # 不鏽鋼
SUS_LOW = '#a7acb1'
BLK = '#1c1c1c'          # 黑色面罩
DEST = '#2b2d30'         # 方向幕
LAMP = '#f2efe2'         # 頭燈
TAIL = '#7a1a1c'         # 尾燈（熄）
KS_RED = '#e60012'       # 京成 human red（遠離路線換色鍵的暗紅）
KS_BLUE = '#1a2fd0'      # 京成 future blue（catalog #0B00DA 略提亮）
HK_BLUE = '#1450c0'      # 北總藍
HK_LBLUE = '#1ea0e6'     # 北總淺藍
KQ_RED = '#e5171f'       # 京急紅
KQ_IVORY = '#f1ecdc'     # 京急白（米白）


def lamps(y, z, r=0.085):
    return [('circle', -y, z, r + 0.04, '#26282a'), ('circle', y, z, r + 0.04, '#26282a'),
            ('circle', -y, z, r, LAMP, 0.9), ('circle', y, z, r, LAMP, 0.9)]


def tails(y, z, w=0.36, h=0.09):
    return [('rect', -y, z, w, h, 0.03, TAIL, 0.7), ('rect', y, z, w, h, 0.03, TAIL, 0.7)]


# 京成 18 m 不鏽鋼通勤車共通車體（直立側牆、分散式冷氣）
KS_BODY = dict(pitch=18.0, W=2.845, zb=1.0, roof=3.62, shoulder=3.20, body=SUS, low=SUS_LOW, roof_col='#a3a8ad',
               win=(1.80, 2.74), win_frame='#5d6268', ac=[(-5.6, 1.7), (-1.9, 1.7), (1.9, 1.7), (5.6, 1.7)], ac_top=3.98)

# ---- 京成 3000 形（3000 形系車頭：斜面、左偏貫通門、黑面罩＋紅藍帶） ----
KS3000 = dict(
    KS_BODY, id='keisei3000', name='京成 3000 形（2 代）',
    source='尺寸：ja.wikipedia 京成3000形電車 (2代) 規格表（18,000／2,845／4,036.5 mm）；照片：Commons Keisei-Type3000-3040F.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    bands=[(1.62, 1.74, KS_RED), (1.56, 1.62, KS_BLUE), (3.06, 3.11, KS_BLUE)],
    front=dict(Ln=0.8, tip_w=0.90, tip_drop=0.08, setback=0.22, face=SUS,
               cap=[(1.44, None, BLK)],
               decals=[('rect', -0.86, 2.44, 0.50, 0.86, 0.04, 'GLASS'),                 # 貫通門窗
                       ('rect', 0.38, 2.66, 1.62, 0.72, 0.04, 'GLASS'),                  # 擋風玻璃
                       ('rect', 0.38, 3.30, 0.95, 0.18, 0.02, DEST, 0.6),
                       ('rect', -0.86, 1.60, 0.56, 1.62, 0.04, '#232425', 0.5),          # 貫通門下段
                       ('band', 1.77, 1.92, KS_RED), ('band', 1.69, 1.77, KS_BLUE),
                       ('rect', -0.98, 3.30, 0.22, 0.16, 0.03, LAMP, 0.9), ('rect', 0.98, 3.30, 0.22, 0.16, 0.03, LAMP, 0.9),
                       *tails(0.95, 1.55, 0.34, 0.08)],
               skirt=(SUS, 0.30, 1.00)),
)

# 3700 形系平面車頭（左窗＋中央偏左貫通門＋右大窗，紅藍帶在玻璃下方）
def ks3700_front(top_band, low_band, face=SUS, Ln=0.5):
    return dict(Ln=Ln, tip_w=0.93, tip_drop=0.06, setback=0.10, face=face,
                decals=[('rect', 0.0, 2.74, 2.52, 1.56, 0.06, BLK, 0.6),
                        ('rect', -1.00, 2.70, 0.48, 1.20, 0.04, 'GLASS'),
                        ('rect', -0.36, 2.60, 0.56, 1.20, 0.04, 'GLASS'),
                        ('rect', 0.66, 2.70, 1.20, 1.20, 0.04, 'GLASS'),
                        ('rect', 0.66, 3.38, 1.00, 0.18, 0.02, DEST, 0.6),
                        ('band', 1.72, 1.90, top_band), ('band', 1.40, 1.63, low_band),
                        ('rect', -0.36, 1.55, 0.62, 0.40, 0.05, low_band, 0.5),
                        *lamps(1.00, 1.515, 0.075),
                        ('rect', 0.95, 0.70, 0.30, 0.10, 0.02, '#26282a', 0.4)],
                skirt=(face, 0.32, 1.00))


KS3700 = dict(
    KS_BODY, id='keisei3700', name='京成 3700 形',
    W=2.85, ac_top=3.95,
    source='尺寸：ja.wikipedia 京成3700形電車 規格表（18,000／2,850／3,990 mm）；照片：Commons Keisei 3701 approaching Keisei Takasago station 20201116 084353.jpg（Hellojinujinu，CC BY-SA 4.0）',
    bands=[(1.66, 1.78, KS_RED), (1.58, 1.66, KS_BLUE), (3.06, 3.11, KS_BLUE)],
    front=ks3700_front(KS_RED, KS_BLUE),
)

KS3100 = dict(
    KS_BODY, id='keisei3100', name='京成 3100 形（Access 特急）',
    source='尺寸：ja.wikipedia 京成3100形電車 (3代) 規格表（18,000／2,845／4,036.5 mm）；照片：Commons Keisei-Type3151.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    bands=[(1.60, 1.74, '#f08a00'), (3.04, 3.16, '#f08a00')],
    front=dict(Ln=0.85, tip_w=0.88, tip_drop=0.10, setback=0.24, face=SUS,
               wrap=[(1.45, 3.70, '#f08a00')],
               cap=[(1.45, None, BLK)],
               decals=[('rect', -1.00, 2.50, 0.30, 0.95, 0.04, 'GLASS'),
                       ('rect', -0.38, 2.50, 0.62, 0.95, 0.04, 'GLASS'),
                       ('rect', 0.66, 2.50, 1.10, 0.95, 0.04, 'GLASS'),
                       ('rect', 0.10, 3.36, 1.90, 0.20, 0.03, DEST, 0.6),
                       ('band', 1.50, 1.72, '#f08a00'),
                       ('rect', 0.75, 1.61, 0.40, 0.10, 0.02, KS_BLUE, 0.5),
                       ('rect', -1.12, 1.78, 0.14, 0.30, 0.05, LAMP, 0.9), ('rect', 1.12, 1.78, 0.14, 0.30, 0.05, LAMP, 0.9)],
               skirt=('#8d9298', 0.30, 1.00)),
)

KS3200 = dict(
    KS_BODY, id='keisei3200', name='京成 3200 形（3 代）',
    source='尺寸：ja.wikipedia 京成3200形電車 (3代) 規格表（18,000／2,845／4,036.5 mm）；照片：Commons 京成電鉄3200形電車.jpg（HiLens Image Works，CC BY-SA 4.0）',
    bands=[(1.64, 1.78, KS_RED), (3.04, 3.20, KS_BLUE)],
    front=dict(Ln=0.85, tip_w=0.90, tip_drop=0.10, setback=0.22, face=SUS,
               wrap=[(1.50, 3.70, KS_BLUE)],
               cap=[(1.45, None, BLK)],
               decals=[('rect', -0.92, 2.55, 0.62, 0.98, 0.05, 'GLASS'),
                       ('rect', 0.02, 2.40, 0.84, 1.30, 0.06, '#26282a', 0.5),         # 中央貫通門
                       ('rect', 0.02, 2.62, 0.66, 0.80, 0.04, 'GLASS'),
                       ('rect', 0.92, 2.55, 0.62, 0.98, 0.05, 'GLASS'),
                       ('rect', 0.0, 3.36, 1.90, 0.20, 0.03, DEST, 0.6),
                       ('band', 1.52, 1.72, KS_BLUE), ('band', 1.47, 1.52, KS_RED),
                       ('rect', -1.10, 1.78, 0.16, 0.30, 0.05, LAMP, 0.9), ('rect', 1.10, 1.78, 0.16, 0.30, 0.05, LAMP, 0.9)],
               skirt=(SUS, 0.30, 1.00)),
)

KS3400 = dict(
    KS_BODY, id='keisei3400', name='京成 3400 形',
    W=2.832, ac_top=3.95, body='#d3d6d9', low='#b3b7bb', door_col='#cfd2d5',
    source='尺寸：ja.wikipedia 京成3400形電車 規格表（18,000／2,832／3,990 mm）；照片：Commons Type3400-Keisei.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    bands=[(1.66, 1.78, KS_RED), (1.58, 1.66, KS_BLUE), (3.04, 3.09, KS_BLUE)],
    front=dict(ks3700_front(KS_RED, KS_BLUE, face='#d6d9dc'), tip_w=0.94, setback=0.06),
)
KS3400['front']['decals'] = [('rect', 0.0, 2.74, 2.52, 1.56, 0.06, BLK, 0.6),
                             ('rect', -0.86, 2.70, 0.72, 1.18, 0.04, 'GLASS'),
                             ('rect', -0.04, 2.60, 0.66, 1.20, 0.04, 'GLASS'),
                             ('rect', 0.86, 2.70, 0.74, 1.18, 0.04, 'GLASS'),
                             ('rect', 0.86, 3.38, 0.70, 0.18, 0.02, DEST, 0.6),
                             ('band', 1.76, 1.90, KS_RED), ('band', 1.44, 1.64, KS_BLUE),
                             ('rect', -0.04, 1.62, 0.66, 0.40, 0.05, '#d6d9dc', 0.5),
                             *lamps(1.00, 1.54, 0.075)]

# 3500／3600 形：平直鋼製風格車頭（左右窗＋中央貫通門，紅帶內含頭燈，下方藍帶）
def flat_front(red_z, blue_z, face=SUS, dest_col='#2a49c8', lamp_y=0.92, twin=False):
    lamp = (lamps(lamp_y, sum(red_z) / 2, 0.09) if not twin else
            [*lamps(lamp_y + 0.18, sum(red_z) / 2, 0.08), *lamps(lamp_y - 0.12, sum(red_z) / 2, 0.08)])
    return dict(Ln=0.35, tip_w=0.95, tip_drop=0.05, setback=0.0, face=face,
                decals=[('rect', -0.84, 2.67, 0.70, 0.98, 0.06, '#26282a', 0.5),
                        ('rect', -0.84, 2.67, 0.62, 0.90, 0.05, 'GLASS'),
                        ('rect', 0.84, 2.67, 0.70, 0.98, 0.06, '#26282a', 0.5),
                        ('rect', 0.84, 2.67, 0.62, 0.90, 0.05, 'GLASS'),
                        ('rect', 0.0, 2.25, 0.76, 2.30, 0.05, '#9da2a7', 0.5),             # 貫通門框
                        ('rect', 0.0, 2.25, 0.68, 2.22, 0.04, face, 0.5),
                        ('rect', 0.0, 2.80, 0.50, 0.80, 0.04, 'GLASS'),
                        ('rect', 0.0, 3.38, 0.70, 0.20, 0.03, dest_col, 0.6),
                        ('band', red_z[0], red_z[1], KS_RED), ('band', blue_z[0], blue_z[1], KS_BLUE),
                        *lamp],
                skirt=('#3a3d40', 0.40, 0.98))


KS3500 = dict(
    KS_BODY, id='keisei3500', name='京成 3500 形（更新車）',
    W=2.832, ac_top=4.00, roof=3.60, ac=[(-5.6, 1.6), (-1.9, 1.6), (1.9, 1.6), (5.6, 1.6)],
    source='尺寸：ja.wikipedia 京成3500形電車 規格表（18,000／2,832／4,050 mm）；照片：Commons Keisei 3588 20090602.jpg（日本語版ウィキペディアのDD51612さん，CC BY-SA 3.0）',
    bands=[(1.66, 1.80, KS_RED), (1.52, 1.60, KS_BLUE), (3.02, 3.08, KS_BLUE)],
    front=flat_front((1.68, 2.07), (1.36, 1.56)),
)

KS3600 = dict(
    KS_BODY, id='keisei3600', name='京成 3600 形',
    W=2.794, ac_top=3.93, ac=[(-4.8, 2.4), (0.0, 2.4), (4.8, 2.4)],
    source='尺寸：ja.wikipedia 京成3600形電車 規格表（18,000／2,794／3,969 mm）；照片：Commons Keisei 3600 series Keisei Main Line 20170921.jpg（Cfktj1596，CC BY-SA 4.0）',
    bands=[(1.66, 1.80, KS_RED), (1.50, 1.60, KS_BLUE), (3.02, 3.08, KS_BLUE)],
    front=flat_front((1.71, 2.10), (1.39, 1.60), twin=True, lamp_y=0.80),
)

# ---- 北總 ----
HK7500 = dict(
    KS3000, id='hokuso7500', name='北總 7500 形（千葉 NT 9200 形同型）',
    source='尺寸：ja.wikipedia 北総鉄道7500形電車 規格表（18,000／2,845／4,036.5 mm）；照片：Commons Hokuso-Series7503.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    bands=[(1.62, 1.74, HK_BLUE), (1.56, 1.62, HK_LBLUE), (3.06, 3.11, HK_BLUE)],
    front=dict(KS3000['front']),
)
HK7500['front']['decals'] = [(('band', 1.76, 1.92, HK_BLUE) if d[0] == 'band' and d[3] == KS_RED else
                              ('band', 1.69, 1.76, HK_LBLUE) if d[0] == 'band' else d) for d in KS3000['front']['decals']]
HK7500['front']['decals'].append(('rect', -0.75, 1.84, 0.50, 0.08, 0.01, '#f4f4f4', 0.5))     # 「HOKSO」字樣

HK7300 = dict(
    KS3700, id='hokuso7300', name='北總 7300 形（7800 形／千葉 NT 9800 形同型）',
    source='尺寸：ja.wikipedia 北総鉄道7300形電車 規格表（18,000／2,850／3,990 mm）；照片：Commons Hokuso-Series7311.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    bands=[(1.66, 1.78, HK_BLUE), (1.58, 1.66, HK_LBLUE), (3.06, 3.11, HK_BLUE)],
    front=ks3700_front(HK_BLUE, HK_BLUE),
)
HK7300['front']['decals'].append(('rect', -0.85, 1.81, 0.55, 0.08, 0.01, '#f4f4f4', 0.5))

HK9100 = dict(
    KS_BODY, id='hokuso9100', name='北總 9100 形（C-Flyer）',
    W=2.78, ac_top=3.95, body='#70757b', low='#1ea0e6', door_col='#7c8187', door_frame='#f2c200',
    win=(1.82, 2.78), ac=[(-4.6, 2.6), (4.6, 2.6)],
    source='尺寸：ja.wikipedia 千葉ニュータウン鉄道9100形電車 規格表（18,000／2,780／3,985 mm）；照片：Commons Hokuso-9118 Oshiage-Line.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    bands=[(1.0, 1.20, HK_LBLUE)],
    front=dict(Ln=1.30, tip_w=0.86, tip_drop=0.16, setback=0.48, face='#c9cdd1',
               wrap=[(0.0, 1.20, HK_LBLUE), (1.58, 3.70, '#3a3f45')],
               cap=[(None, 1.20, HK_LBLUE), (1.58, None, '#2a2d31')],
               decals=[('rect', -0.55, 2.60, 0.62, 1.00, 0.05, 'GLASS'),
                       ('rect', 0.55, 2.68, 1.18, 0.82, 0.05, 'GLASS'),
                       ('rect', 0.0, 3.38, 1.50, 0.16, 0.03, DEST, 0.6),
                       ('rect', 0.42, 1.92, 0.40, 0.10, 0.02, LAMP, 0.9),
                       ('rect', 0.30, 2.12, 0.62, 0.10, 0.02, DEST, 0.6)],
               skirt=(HK_LBLUE, 0.30, 1.05)),
)

# ---- 京急（紅色塗裝＋米白窗帶） ----
KQ_BODY = dict(pitch=18.0, W=2.83, zb=1.0, roof=3.62, shoulder=3.20, body=KQ_RED, low='#b8121a', roof_col='#8f9499',
               door_col=KQ_RED, win=(1.84, 2.74), win_frame='#5a5e63', bands=[(1.74, 2.86, KQ_IVORY)],
               ac=[(0.0, 4.6)], ac_top=3.98)


def kq_front(ivory, split=-0.48, lamp_top=True, num_w=0.0):
    d = [('rect', 0.0, 2.78, 2.44, 1.36, 0.10, BLK, 0.7),
         ('rect', (split - 0.03 - 1.16) / 2, 2.76, split - 0.03 + 1.16, 1.22, 0.06, 'GLASS'),      # 左偏貫通門窗
         ('rect', (split + 0.03 + 1.16) / 2, 2.76, 1.16 - split - 0.03, 1.22, 0.06, 'GLASS'),
         ('band', ivory[0], ivory[1], KQ_IVORY),
         ('rect', -0.95, 1.46, 0.48, 0.20, 0.09, '#3a3d40', 0.6), ('rect', 0.95, 1.46, 0.48, 0.20, 0.09, '#3a3d40', 0.6),
         ('rect', -0.95, 1.46, 0.36, 0.11, 0.05, TAIL, 0.7), ('rect', 0.95, 1.46, 0.36, 0.11, 0.05, TAIL, 0.7)]
    if lamp_top:
        d += [('rect', -1.02, 3.28, 0.18, 0.12, 0.04, LAMP, 0.9), ('rect', 1.02, 3.28, 0.18, 0.12, 0.04, LAMP, 0.9)]
    if num_w:
        d.append(('rect', 0.72, sum(ivory) / 2, num_w, 0.18, 0.02, '#1a1a1a', 0.5))   # 形式數字
    return d


KQ1000 = dict(
    KQ_BODY, id='keikyu1000', name='京急新 1000 形（紅色塗裝車）',
    source='尺寸：ja.wikipedia 京急新1000形電車 規格表（18,000／2,830／4,026.5 mm）；照片：Commons Keikyu-Main-Line Type1000-355 445.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    front=dict(Ln=0.80, tip_w=0.90, tip_drop=0.10, setback=0.24, face=KQ_RED,
               decals=kq_front((1.71, 2.07), num_w=0.90),
               skirt=('#c3c7cb', 0.30, 1.00)),
)

KQ600 = dict(
    KQ_BODY, id='keikyu600', name='京急 600 形（3 代）',
    W=2.83, ac_top=3.98,
    source='尺寸：ja.wikipedia 京急600形電車 (3代) 規格表（18,000／2,830／4,020 mm）；照片：Commons Keikyu-Type600-608-8.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    front=dict(Ln=0.95, tip_w=0.86, tip_drop=0.14, setback=0.30, face=KQ_RED,
               decals=kq_front((1.70, 2.08), split=-0.40, num_w=0.70),
               skirt=('#c3c7cb', 0.30, 1.00)),
)

KQ1500 = dict(
    KQ_BODY, id='keikyu1500', name='京急 1500 形',
    win=(1.86, 2.74), bands=[(1.70, 1.80, KQ_IVORY)], ac=[(-4.4, 2.6), (0.0, 2.6), (4.4, 2.6)], ac_top=4.00,
    source='尺寸：ja.wikipedia 京急1500形電車 規格表（18,000／2,830／4,040 mm）；照片：Commons Keikyu-Type1500-1725.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    front=dict(Ln=0.40, tip_w=0.95, tip_drop=0.06, setback=0.05, face=KQ_RED,
               decals=[('rect', 0.0, 3.29, 2.52, 0.24, 0.04, BLK, 0.7),
                       ('rect', -0.86, 2.60, 0.84, 0.92, 0.08, '#26282a', 0.6), ('rect', -0.86, 2.60, 0.76, 0.84, 0.07, 'GLASS'),
                       ('rect', 0.04, 2.60, 0.64, 0.92, 0.06, '#26282a', 0.6), ('rect', 0.04, 2.60, 0.56, 0.84, 0.05, 'GLASS'),
                       ('rect', 0.89, 2.60, 0.80, 0.92, 0.08, '#26282a', 0.6), ('rect', 0.89, 2.60, 0.72, 0.84, 0.07, 'GLASS'),
                       ('band', 1.82, 2.02, KQ_IVORY),
                       ('rect', -0.95, 1.62, 0.56, 0.26, 0.04, '#d5d8db', 0.6), ('rect', 0.95, 1.62, 0.56, 0.26, 0.04, '#d5d8db', 0.6),
                       ('circle', -0.86, 1.62, 0.08, LAMP, 0.9), ('circle', 0.86, 1.62, 0.08, LAMP, 0.9),
                       ('band', 1.08, 1.14, '#9c0f16')],
               skirt=('#c3c7cb', 0.30, 1.00)),
)

KQ2100 = dict(
    KQ_BODY, id='keikyu2100', name='京急 2100 形（2 門橫向座椅車）',
    doors=(-4.7, 4.7), ac=[(-3.0, 3.2), (3.0, 3.2)], ac_top=3.98,
    source='尺寸：ja.wikipedia 京急2100形電車 規格表（先頭 18,170／中間 18,000／2,830／4,026.5 mm，模型取 18,000）；照片：Commons Keikyu-Type2100-73.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    front=dict(Ln=0.95, tip_w=0.86, tip_drop=0.14, setback=0.30, face=KQ_RED,
               decals=kq_front((1.57, 2.07), split=-0.45, num_w=0.95),
               skirt=('#c3c7cb', 0.30, 1.00)),
)

CARS = [KS3000, KS3100, KS3200, KS3700, KS3400, KS3500, KS3600, HK7500, HK9100, HK7300, KQ1000, KQ600, KQ1500, KQ2100]
