"""北總（都營淺草線直通，18 m 3 門級）車型設定，給 jp.py 的參數化產生器用。
京成七款、京急四款已移除：未取得車輛設計使用許諾前不放當地車型，京成、京急各線改由其他車型或通用外觀承擔（2026-10-28）。
尺寸取自 catalog-2026-10.json（ja.wikipedia 規格表）；外觀依各款 Commons 參考照片估計。"""

# ---- 共用色 ----
SUS = '#c4c8cc'          # 不鏽鋼
SUS_LOW = '#a7acb1'
BLK = '#1c1c1c'          # 黑色面罩
DEST = '#2b2d30'         # 方向幕
LAMP = '#f2efe2'         # 頭燈
TAIL = '#7a1a1c'         # 尾燈（熄）
HK_BLUE = '#1450c0'      # 北總藍
HK_LBLUE = '#1ea0e6'     # 北總淺藍


def lamps(y, z, r=0.085):
    return [('circle', -y, z, r + 0.04, '#26282a'), ('circle', y, z, r + 0.04, '#26282a'),
            ('circle', -y, z, r, LAMP, 0.9), ('circle', y, z, r, LAMP, 0.9)]


def tails(y, z, w=0.36, h=0.09):
    return [('rect', -y, z, w, h, 0.03, TAIL, 0.7), ('rect', y, z, w, h, 0.03, TAIL, 0.7)]


# 北總 18 m 不鏽鋼通勤車車體（直立側牆、分散式冷氣；與京成同系車體）
HK_BODY = dict(pitch=18.0, W=2.845, zb=1.0, roof=3.62, shoulder=3.20, body=SUS, low=SUS_LOW, roof_col='#a3a8ad',
               win=(1.80, 2.74), win_frame='#5d6268', ac=[(-5.6, 1.7), (-1.9, 1.7), (1.9, 1.7), (5.6, 1.7)], ac_top=3.98)

# ---- 北總 ----
HK7500 = dict(
    HK_BODY, id='hokuso7500', name='北總 7500 形（千葉 NT 9200 形同型）',
    source='尺寸：ja.wikipedia 北総鉄道7500形電車 規格表（18,000／2,845／4,036.5 mm）；照片：Commons Hokuso-Series7503.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    bands=[(1.62, 1.74, HK_BLUE), (1.56, 1.62, HK_LBLUE), (3.06, 3.11, HK_BLUE)],
    front=dict(Ln=0.8, tip_w=0.90, tip_drop=0.08, setback=0.22, face=SUS,
               cap=[(1.44, None, BLK)],
               decals=[('rect', -0.86, 2.44, 0.50, 0.86, 0.04, 'GLASS'),                 # 貫通門窗
                       ('rect', 0.38, 2.66, 1.62, 0.72, 0.04, 'GLASS'),                  # 擋風玻璃
                       ('rect', 0.38, 3.30, 0.95, 0.18, 0.02, DEST, 0.6),
                       ('rect', -0.86, 1.60, 0.56, 1.62, 0.04, '#232425', 0.5),          # 貫通門下段
                       ('band', 1.76, 1.92, HK_BLUE), ('band', 1.69, 1.76, HK_LBLUE),
                       ('rect', -0.98, 3.30, 0.22, 0.16, 0.03, LAMP, 0.9), ('rect', 0.98, 3.30, 0.22, 0.16, 0.03, LAMP, 0.9),
                       *tails(0.95, 1.55, 0.34, 0.08),
                       ('rect', -0.75, 1.84, 0.50, 0.08, 0.01, '#f4f4f4', 0.5)],     # 「HOKSO」字樣
               skirt=(SUS, 0.30, 1.00)),
)

# 7300 形車頭（左窗＋中央偏左貫通門＋右大窗，色帶在玻璃下方）
def front_7300(top_band, low_band, face=SUS, Ln=0.5):
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


HK7300 = dict(
    HK_BODY, id='hokuso7300', name='北總 7300 形（7800 形／千葉 NT 9800 形同型）',
    W=2.85, ac_top=3.95,
    source='尺寸：ja.wikipedia 北総鉄道7300形電車 規格表（18,000／2,850／3,990 mm）；照片：Commons Hokuso-Series7311.jpg（MaedaAkihiko，CC BY-SA 4.0）',
    bands=[(1.66, 1.78, HK_BLUE), (1.58, 1.66, HK_LBLUE), (3.06, 3.11, HK_BLUE)],
    front=front_7300(HK_BLUE, HK_BLUE),
)
HK7300['front']['decals'].append(('rect', -0.85, 1.81, 0.55, 0.08, 0.01, '#f4f4f4', 0.5))

HK9100 = dict(
    HK_BODY, id='hokuso9100', name='北總 9100 形（C-Flyer）',
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

CARS = [HK7500, HK9100, HK7300]
