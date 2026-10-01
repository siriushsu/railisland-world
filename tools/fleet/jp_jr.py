"""JR 東日本（E233／E235／E231／209／E531／E131 各番台）、東京臨海高速鐵道（臨海線）、相模鐵道車型設定，給 jp.py 的參數化產生器用。
尺寸取自 catalog（日文維基百科各車型條目）；外觀依 Commons 照片估計。所有路線色都用實際顏色（不用換色鍵）。"""

SS = '#c4c8cc'
MASK = '#141618'
LAMP = '#f2efe2'
DEST = '#2b2d30'
WHITE_FRP = '#e9eaea'

# 實際路線色（刻意避開換色鍵 ±8 色階）
SHONAN_OR, SHONAN_GR = '#f68b1e', '#00a651'
EMERALD = '#009786'
YOKOHAMA_GR, YOKOHAMA_LG = '#00b261', '#94c83d'
NAMBU_Y, NAMBU_O, NAMBU_B = '#ffd400', '#f68b1e', '#5a2e1c'
SOBU_Y = '#ffd400'
TOZAI_SKY, TOZAI_NAVY = '#009bbf', '#003f8e'
MUSASHINO_OR = '#f47b20'
KAWAGOE_GR = '#5fb53a'
JOBAN_BL = '#0067c0'
YOKOSUKA_BL, YOKOSUKA_CR = '#0b3b7c', '#f2ead5'
SAGAMI_BL, SAGAMI_DK = '#3d86d6', '#1c5fb0'
RINKAI_CY, RINKAI_NV = '#00a0e9', '#00418e'
TWR71_BL = '#1f6fd6'
SOTETSU_NAVY = '#1a2c5e'

DOORS4 = (-7.2, -2.4, 2.4, 7.2)


def _cap(face, bands):
    """車頭端面依高度分色：bands 之間的空隙補上 face（比全寬 band 貼花省三角形）。"""
    out, z = [], None
    for z0, z1, col in sorted(bands, key=lambda b: b[0]):
        out.append((z, z0, face))
        out.append((z0, z1, col))
        z = z1
    out.append((z, None, face))
    return out


def _wrap(front_bands):
    """車頭側面轉角：整段只用最粗那道色（細色帶在粗網格上會變成方塊）。"""
    z0 = min(b[0] for b in front_bands)
    z1 = max(b[1] for b in front_bands)
    main = max(front_bands, key=lambda b: b[1] - b[0])[2]
    return [(z0, z1, main)]


# ---------------------------------------------------------------- E233 系（擴幅、後傾車頭）
def _e233_front(face, front_bands, lower=None):
    """E233 近郊／各線型車頭：上半部整片黑面板，下方橫貫色帶，再下白或不鏽鋼。"""
    dec = [('rect', 0.0, 2.70, 2.46, 1.64, 0.16, MASK, 0.9),
           ('rect', 0.0, 3.30, 1.36, 0.20, 0.03, DEST, 0.7)]
    dec += [('circle', -1.0, 3.38, 0.07, LAMP, 0.9), ('circle', 1.0, 3.38, 0.07, LAMP, 0.9)]
    wrap = _wrap(front_bands)
    return dict(Ln=1.05, tip_w=0.89, tip_drop=0.10, setback=0.30, face=face, wrap=wrap,
                cap=_cap(face, front_bands), decals=dec, skirt=('#c9ccd0', 0.12, 0.62))


E233 = dict(
    pitch=20.0, W=2.95, roof=3.62, shoulder=3.20, ac_top=4.0165, flare=(0.13, 0.62),
    body=SS, low='#a9aeb3', door_col='#bdc1c5', doors=DOORS4, ac=[(0.0, 3.4)],
)
E233_SRC = 'ja.wikipedia E233 sub-infobox (20,000 / 雨樋間2,966 / 空調上面4,016.5 mm)'

# ---------------------------------------------------------------- E231 系
E231 = dict(
    pitch=20.0, W=2.95, roof=3.62, shoulder=3.20, ac_top=4.0515, flare=(0.13, 0.62),
    body=SS, low='#a9aeb3', door_col='#bdc1c5', doors=DOORS4, ac=[(0.0, 3.2)],
)


def _e231_front(front_bands):
    """E231 通勤型（0／1000／3000 番台）車頭：不鏽鋼框、上半部黑面板、橫貫色帶、黑色燈帶、白色排障器。"""
    dec = [('rect', 0.0, 2.69, 2.46, 1.58, 0.10, MASK, 0.9),
           ('rect', 0.0, 3.28, 1.50, 0.18, 0.03, DEST, 0.7)]
    dec += [('rect', 0.0, 1.44, 2.46, 0.24, 0.04, MASK, 0.8),
            ('rect', -0.86, 1.44, 0.30, 0.16, 0.03, LAMP, 0.9), ('rect', 0.86, 1.44, 0.30, 0.16, 0.03, LAMP, 0.9)]
    return dict(Ln=0.85, tip_w=0.91, tip_drop=0.10, setback=0.14, face=SS, wrap=_wrap(front_bands), cap=_cap(SS, front_bands),
                decals=dec, skirt=('#dfe1e3', 0.18, 0.62))


def _frp_front(front_bands, lamp_strip=True):
    """209 系 500／3500 番台、E231-500：白色 FRP 車頭、黑色大窗、窗下色帶、黑色燈座、白色排障器。"""
    dec = [('rect', 0.0, 2.72, 2.40, 1.50, 0.22, MASK, 0.9),
           ('rect', 0.0, 3.28, 1.50, 0.18, 0.03, DEST, 0.7)]
    if lamp_strip:
        dec += [('rect', 0.0, 1.46, 2.30, 0.24, 0.08, MASK, 0.8)]
    else:
        dec += [('rect', -0.88, 1.46, 0.50, 0.24, 0.08, MASK, 0.8), ('rect', 0.88, 1.46, 0.50, 0.24, 0.08, MASK, 0.8)]
    dec += [('rect', -0.88, 1.46, 0.26, 0.14, 0.04, LAMP, 0.9), ('rect', 0.88, 1.46, 0.26, 0.14, 0.04, LAMP, 0.9)]
    return dict(Ln=0.9, tip_w=0.90, tip_drop=0.12, setback=0.12, face=WHITE_FRP, wrap=_wrap(front_bands), cap=_cap(WHITE_FRP, front_bands),
                decals=dec, skirt=('#e3e5e7', 0.16, 0.66))


# ---------------------------------------------------------------- sustina 系（E235／E131／71-000）
SUSTINA = dict(
    pitch=20.0, W=2.95, roof=3.42, shoulder=3.12, ac_top=3.80, flare=(0.13, 0.62),
    body='#a9adb1', low='#8f9397', roof_col='#9a9ea2', door_col='#b3b7bb', doors=DOORS4, ac=[(-3.6, 3.0), (3.6, 3.0)], ac_col='#b5b9bd',
)


CARS = [
    # ---------------- E233-2000（常磐線各停・千代田線直通）：窄車體、直立車頭、偏左貫通門
    dict(
        E233, id='jre2332000', name='JR 東日本 E233 系 2000 番台（常磐線各停・千代田線直通）',
        source='ja.wikipedia E233-2000 sub-infobox (20,000 / 2,790 / 4,051.5 mm)；Commons: Series-E233-2000-14F.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        W=2.79, ac_top=4.0515, flare=None,
        bands=[(1.44, 1.47, '#f4f4f4'), (1.47, 1.75, EMERALD)],
        front=dict(Ln=0.55, tip_w=0.93, tip_drop=0.06, setback=0.08, face=SS,
                   wrap=[(1.50, 1.96, EMERALD)], cap=_cap(SS, [(1.50, 1.96, EMERALD), (1.96, 1.99, '#f4f4f4')]),
                   decals=[('rect', 0.0, 2.72, 2.48, 1.48, 0.10, MASK, 0.9),
                           ('rect', 0.0, 3.30, 1.40, 0.18, 0.03, DEST, 0.7),
                           ('rect', -0.62, 2.55, 0.66, 1.30, 0.04, '#26292c', 0.6),     # 偏左貫通門
                           ('rect', -0.62, 2.70, 0.48, 0.80, 0.04, 'GLASS'),
                           ('rect', 0.42, 2.66, 1.18, 0.84, 0.04, 'GLASS'),
                           ('rect', -0.92, 1.70, 0.30, 0.22, 0.05, MASK, 0.8), ('rect', 0.92, 1.70, 0.30, 0.22, 0.05, MASK, 0.8),
                           ('rect', -0.92, 1.70, 0.22, 0.14, 0.03, LAMP, 0.9), ('rect', 0.92, 1.70, 0.22, 0.14, 0.03, LAMP, 0.9)],
                   skirt=('#c9ccd0', 0.12, 0.66)),
    ),
    # ---------------- E233-3000（東海道・宇都宮・高崎線）：湘南色雙色帶、不鏽鋼下半部
    dict(
        E233, id='jre2333000', name='JR 東日本 E233 系 3000 番台（東海道・上野東京ライン）',
        source=E233_SRC + '；Commons: Jr e233.jpg（A3005，CC BY-SA 4.0）',
        bands=[(1.45, 1.64, SHONAN_GR), (1.64, 1.76, SHONAN_OR)],
        front=_e233_front(SS, [(1.58, 1.76, SHONAN_GR), (1.76, 1.88, SHONAN_OR)]),
    ),
    # ---------------- E233-6000（橫濱線）：綠色漸層帶、窗上黃綠細帶、白色下半部
    dict(
        E233, id='jre2336000', name='JR 東日本 E233 系 6000 番台（橫濱線）',
        source=E233_SRC + '；Commons: Series-E233-6000-H002.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        bands=[(1.45, 1.62, YOKOHAMA_GR), (1.62, 1.76, YOKOHAMA_LG), (2.88, 2.98, YOKOHAMA_LG)],
        front=_e233_front(WHITE_FRP, [(1.58, 1.72, YOKOHAMA_GR), (1.72, 1.86, YOKOHAMA_LG)]),
    ),
    # ---------------- E233-8000／8500（南武線）：黃・橘・咖啡三色帶、白色下半部
    dict(
        E233, id='jre2338000', name='JR 東日本 E233 系 8000・8500 番台（南武線）',
        source=E233_SRC + '；Commons: Series-E233-8000-N4.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        bands=[(1.44, 1.52, NAMBU_B), (1.52, 1.62, NAMBU_O), (1.62, 1.76, NAMBU_Y), (2.88, 2.98, NAMBU_Y)],
        front=_e233_front(WHITE_FRP, [(1.60, 1.67, NAMBU_B), (1.67, 1.77, NAMBU_O), (1.77, 1.89, NAMBU_Y)]),
    ),
    # ---------------- E235-1000（橫須賀・總武快速）：藍色外框車頭、奶油色帶＋點狀漸層
    dict(
        SUSTINA, id='jre2351000', name='JR 東日本 E235 系 1000 番台（橫須賀・總武快速線）',
        source='ja.wikipedia E235-1000 sub-infobox (20,000 / 2,950 / 3,620 mm)；Commons: Series-E235-1000 J10.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        ac_top=3.62,
        bands=[(1.44, 1.52, YOKOSUKA_BL), (1.52, 1.74, YOKOSUKA_CR), (2.82, 2.98, YOKOSUKA_BL)],
        front=dict(Ln=0.9, tip_w=0.87, tip_drop=0.06, setback=0.12, face=YOKOSUKA_BL,
                   decals=[('rect', 0.0, 2.66, 2.30, 1.30, 0.18, MASK, 0.9),
                           ('rect', 0.0, 3.14, 1.30, 0.17, 0.03, DEST, 0.7),
                           ('circle', -0.98, 3.15, 0.065, LAMP, 0.9), ('circle', 0.98, 3.15, 0.065, LAMP, 0.9),
                           ('rect', 0.0, 1.88, 2.30, 0.36, 0.04, YOKOSUKA_CR),
                           ('rect', 0.0, 1.66, 2.30, 0.10, 0.02, '#8a9cc4'),          # 點狀漸層（簡化成淡藍）
                           ('rect', 0.0, 1.30, 2.30, 0.40, 0.04, '#1e2430', 0.6)],     # 下方深色
                   skirt=('#2a2e36', 0.16, 0.64)),
    ),
    # ---------------- E231-500（總武線各停）：白色 FRP 車頭、黃色帶
    dict(
        E231, id='jre231500', name='JR 東日本 E231 系 500 番台（中央・總武線各停）',
        source='ja.wikipedia E231 infobox (20,000 / 2,966 / 4,051.5 mm)；Commons: JRE-SeriesE231-500.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        bands=[(1.45, 1.74, SOBU_Y), (2.86, 3.02, SOBU_Y)],
        front=dict(_frp_front([(1.62, 2.00, SOBU_Y)], lamp_strip=False), setback=0.06, Ln=0.85),
    ),
    # ---------------- E231-800（東西線直通）：窄直立車體、偏左貫通門、天藍＋深藍帶
    dict(
        E231, id='jre231800', name='JR 東日本 E231 系 800 番台（中央線・東京地鐵東西線直通）',
        source='ja.wikipedia E231 infobox (width 2,880 mm for 800番台)；Commons: JRE Series-E231-800 K5.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        W=2.88, ac_top=4.05, flare=None,
        bands=[(1.45, 1.56, TOZAI_SKY), (1.56, 1.64, TOZAI_NAVY), (1.64, 1.76, TOZAI_SKY)],
        front=dict(Ln=0.55, tip_w=0.93, tip_drop=0.06, setback=0.08, face=SS,
                   wrap=[(1.56, 1.96, TOZAI_SKY)], cap=_cap(SS, [(1.56, 1.74, TOZAI_SKY), (1.74, 1.79, TOZAI_NAVY), (1.79, 1.96, TOZAI_SKY)]),
                   decals=[('rect', 0.0, 2.74, 2.52, 1.42, 0.08, MASK, 0.9),
                           ('rect', 0.0, 3.30, 1.40, 0.18, 0.03, DEST, 0.7),
                           ('rect', -0.66, 2.52, 0.66, 1.30, 0.04, '#26292c', 0.6),     # 偏左貫通門
                           ('rect', -0.66, 2.70, 0.48, 0.80, 0.04, 'GLASS'),
                           ('rect', 0.42, 2.66, 1.24, 0.84, 0.04, 'GLASS'),
                           ('rect', -0.92, 1.66, 0.24, 0.12, 0.0, LAMP, 0.9), ('rect', 0.92, 1.66, 0.24, 0.12, 0.0, LAMP, 0.9)],
                   skirt=('#e3e5e7', 0.14, 0.70)),
    ),
    # ---------------- E231-1000（東海道・宇都宮・高崎線）：E231 車頭＋湘南色
    dict(
        E231, id='jre2311000', name='JR 東日本 E231 系 1000 番台（近郊型・湘南色）',
        source='ja.wikipedia E231 infobox (20,000 / 2,966 / 4,051.5 mm)；Commons: JRE Series-E231 U33F.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        bands=[(1.45, 1.56, SHONAN_GR), (1.56, 1.66, SHONAN_OR), (1.66, 1.76, SHONAN_GR)],
        front=_e231_front([(1.60, 1.72, SHONAN_OR), (1.72, 1.88, SHONAN_GR)]),
    ),
    # ---------------- E231-3000（川越・八高線）：E231 車頭＋綠・橘・綠
    dict(
        E231, id='jre2313000', name='JR 東日本 E231 系 3000 番台（川越・八高線）',
        source='ja.wikipedia E231 infobox (20,000 / 2,966 / 4,051.5 mm)；Commons: JR East E231-3000 series Hachikō Line 20180302.jpg（Cfktj1596，CC BY-SA 4.0）',
        bands=[(1.45, 1.52, KAWAGOE_GR), (1.52, 1.68, MUSASHINO_OR), (1.68, 1.76, KAWAGOE_GR), (2.88, 2.98, KAWAGOE_GR)],
        front=_e231_front([(1.60, 1.66, KAWAGOE_GR), (1.66, 1.82, MUSASHINO_OR), (1.82, 1.88, KAWAGOE_GR)]),
    ),
    # ---------------- 209-500（武藏野線）：白色 FRP 車頭、橘・白・咖啡帶
    dict(
        E231, id='jr209500', name='JR 東日本 209 系 500 番台（武藏野線）',
        source='ja.wikipedia 209 infobox (拡幅車: 20,000 / 2,966 / 4,066.5 mm)；Commons: JREast-209-500-Mitsu511.jpg（TC411-507 aka JobanLineE531，CC BY 3.0）；塗裝依武藏野線（catalog）',
        ac_top=4.0665,
        bands=[(1.44, 1.60, MUSASHINO_OR), (1.60, 1.66, '#f4f4f4'), (1.66, 1.76, NAMBU_B)],
        front=_frp_front([(1.66, 1.86, MUSASHINO_OR), (1.86, 1.91, '#f4f4f4'), (1.91, 1.99, NAMBU_B)]),
    ),
    # ---------------- 209-3500（川越・八高線）：白色 FRP 車頭、綠・橘・綠
    dict(
        E231, id='jr2093500', name='JR 東日本 209 系 3500 番台（川越・八高線）',
        source='ja.wikipedia 209 infobox (拡幅 20,000 / 2,966 / 4,066.5 mm)；Commons: JRE Series209-3500 51F.jpg（MaedaAkihiko，CC0）',
        ac_top=4.0665,
        bands=[(1.45, 1.52, KAWAGOE_GR), (1.52, 1.68, MUSASHINO_OR), (1.68, 1.76, KAWAGOE_GR), (2.88, 2.98, KAWAGOE_GR)],
        front=_frp_front([(1.66, 1.72, KAWAGOE_GR), (1.72, 1.90, MUSASHINO_OR), (1.90, 1.96, KAWAGOE_GR)]),
    ),
    # ---------------- E531（常磐線中距離）：黑色大窗、白色下半部＋藍色斜翼、腰帶與窗上藍帶
    dict(
        E233, id='jre531', name='JR 東日本 E531 系（常磐線・上野東京ライン）',
        source='ja.wikipedia E531 infobox (20,000 / 2,950 / 4,016.5 mm)；Commons: JRE Series-E531 K416.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        bands=[(1.45, 1.75, JOBAN_BL), (2.86, 3.04, JOBAN_BL)],
        front=dict(Ln=1.0, tip_w=0.89, tip_drop=0.10, setback=0.26, face=WHITE_FRP,
                   wrap=[(1.40, 1.80, JOBAN_BL)], cap=_cap(WHITE_FRP, [(None, 1.40, SS)]),
                   decals=[('rect', 0.0, 2.80, 2.46, 1.52, 0.14, MASK, 0.9),
                           ('rect', 0.0, 3.36, 1.40, 0.18, 0.03, DEST, 0.7),
                           ('circle', -1.0, 3.40, 0.065, LAMP, 0.9), ('circle', 1.0, 3.40, 0.065, LAMP, 0.9),
                           ('poly', [(-1.30, 1.40), (-0.70, 1.40), (-1.30, 1.98)], JOBAN_BL),   # 藍色斜翼
                           ('poly', [(1.30, 1.40), (1.30, 1.98), (0.70, 1.40)], JOBAN_BL),
                           ],
                   skirt=('#c9ccd0', 0.12, 0.62)),
    ),
    # ---------------- E131-500（相模線）：藍框黑臉、中央貫通門、點狀燈飾
    dict(
        SUSTINA, id='jre131500', name='JR 東日本 E131 系 500 番台（相模線）',
        source='ja.wikipedia E131 infobox (20,000 / 2,998 / 4,036 mm)；Commons: Series-E131-500 G02.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        W=2.98, ac_top=3.80,
        bands=[(1.44, 1.74, SAGAMI_BL), (2.80, 2.96, SAGAMI_BL)],
        front=dict(Ln=0.6, tip_w=0.93, tip_drop=0.05, setback=0.06, face=SAGAMI_BL,
                   cap=[(None, 1.30, SAGAMI_DK), (1.30, 3.32, MASK), (3.32, None, SAGAMI_BL)],
                   decals=[
                           ('rect', 0.0, 2.25, 0.62, 1.78, 0.06, '#2a2e33', 0.6),       # 中央貫通門
                           ('circle', -0.95, 3.16, 0.06, LAMP, 0.9), ('circle', 0.95, 3.16, 0.06, LAMP, 0.9),
                           ('rect', -0.80, 1.86, 0.62, 0.30, 0.06, '#a8d4f4', 0.7),     # 點狀燈飾（簡化）
                           ('rect', 0.80, 1.86, 0.62, 0.30, 0.06, '#a8d4f4', 0.7),
                           ],
                   skirt=('#2f3a4a', 0.18, 0.66)),
    ),
    # ---------------- 臨海線 70-000：209 系衍生、銀色 FRP 車頭、藍帶
    dict(
        E231, id='twr70000', name='東京臨海高速鐵道 70-000 形（臨海線）',
        source='ja.wikipedia 70-000 infobox (先頭20,420/中間20,000, 2,870, 4,067 mm)；Commons: TWR Series70-000 70-070.jpg（MaedaAkihiko，CC0）',
        W=2.87, ac_top=4.067, flare=None,
        bands=[(1.45, 1.52, RINKAI_CY), (1.52, 1.70, RINKAI_NV), (1.70, 1.76, RINKAI_CY), (2.86, 2.98, RINKAI_NV)],
        front=dict(Ln=0.9, tip_w=0.90, tip_drop=0.12, setback=0.12, face='#d6d9dc',
                   decals=[('rect', 0.0, 2.76, 2.36, 1.42, 0.18, MASK, 0.9),
                           ('rect', 0.0, 3.30, 1.40, 0.18, 0.03, DEST, 0.7),
                           ('rect', 0.0, 1.86, 1.40, 0.04, 0.01, RINKAI_CY),
                           ('rect', 0.0, 1.66, 1.40, 0.30, 0.02, RINKAI_NV),
                           ('rect', -0.95, 1.68, 0.28, 0.20, 0.06, MASK, 0.8), ('rect', 0.95, 1.68, 0.28, 0.20, 0.06, MASK, 0.8),
                           ('rect', -0.95, 1.68, 0.18, 0.12, 0.04, LAMP, 0.9), ('rect', 0.95, 1.68, 0.18, 0.12, 0.04, LAMP, 0.9)],
                   skirt=('#e3e5e7', 0.16, 0.66)),
    ),
    # ---------------- 臨海線 71-000：E235 系衍生、白色車頭＋藍框、藍色下半部與弧線
    dict(
        SUSTINA, id='twr71000', name='東京臨海高速鐵道 71-000 形（臨海線）',
        source='ja.wikipedia 71-000 infobox (20,000 / 2,998 / 4,016.5 mm)；Commons: Rinkai Series71-000 71-401.jpg（MaedaAkihiko，CC0）',
        W=2.98, ac_top=3.80,
        bands=[(1.10, 1.76, TWR71_BL), (2.80, 2.98, TWR71_BL)],
        front=dict(Ln=0.9, tip_w=0.87, tip_drop=0.06, setback=0.12, face='#eef0f2',
                   wrap=[(0.0, 1.50, TWR71_BL)], cap=[(None, 1.50, TWR71_BL), (1.50, None, '#eef0f2')],
                   decals=[('rect', 0.0, 2.64, 2.36, 1.46, 0.05, TWR71_BL),
                           ('rect', 0.0, 2.66, 2.12, 1.26, 0.05, MASK, 0.9),
                           ('rect', 0.0, 3.14, 1.30, 0.17, 0.03, DEST, 0.7),
                           ('circle', -0.95, 3.14, 0.065, LAMP, 0.9), ('circle', 0.95, 3.14, 0.065, LAMP, 0.9),
                           ('poly', [(-1.25, 1.66), (0.0, 1.78), (1.25, 1.66), (1.25, 1.74), (0.0, 1.86), (-1.25, 1.74)], TWR71_BL),  # 藍色弧線
                           ],
                   skirt=('#2b3440', 0.18, 0.62)),
    ),
]

# ---------------------------------------------------------------- 相鐵（YOKOHAMA NAVYBLUE 全塗裝）
_SOT_SIDE = dict(body=SOTETSU_NAVY, low='#121f45', roof_col='#3a4256', door_col='#1d3064', win_frame='#10182e',
                 ac_col='#4a5266', doors=DOORS4)


def _sotetsu_front(centre_door):
    dec = [('rect', 0.0, 2.72, 2.40, 1.36, 0.14, MASK, 0.9)]
    if centre_door:   # 20000／21000：黑色窗區用端面分色，下緣一道藍光，玻璃三分（中央為貫通門）
        dec = [('rect', 0.0, 2.03, 2.30, 0.05, 0.0, '#2a52c8', 0.7),
            ('rect', 0.0, 2.62, 0.70, 1.56, 0.04, '#0e1220', 0.7),
            ('rect', 0.0, 2.68, 0.56, 1.08, 0.04, 'GLASS'),
            ('rect', -0.82, 2.70, 0.82, 1.04, 0.04, 'GLASS'), ('rect', 0.82, 2.70, 0.82, 1.04, 0.04, 'GLASS')]
    else:
        dec += [('rect', 0.0, 2.70, 2.22, 1.10, 0.10, 'GLASS'), ('rect', 0.0, 3.25, 1.50, 0.18, 0.03, DEST, 0.7)]
    dec += [('rect', 0.0, 1.62, 1.70, 0.50, 0.06, '#101318', 0.6)]                        # 格柵
    for z in (1.48, 1.62, 1.76):
        dec.append(('rect', 0.0, z, 1.62, 0.03, 0.0, '#2c313a', 0.6))
    for s in (-1, 1):                                                                        # 雙圓頭燈
        dec += [('rect', s * 0.95, 1.98, 0.56, 0.30, 0.14, '#0c0e12', 0.8),
                ('circle', s * 0.84, 1.98, 0.10, LAMP, 0.9), ('circle', s * 1.06, 1.98, 0.10, LAMP, 0.9)]
    return dec


CARS += [
    dict(
        _SOT_SIDE, id='sotetsu12000', name='相鐵 12000 系',
        source='ja.wikipedia 相鉄12000系 infobox (20,000 / 2,998 / 4,016.5 mm)；Commons: Sagami-Railway Series12000.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=20.0, W=2.98, roof=3.62, shoulder=3.20, ac_top=4.0165, flare=(0.13, 0.62), ac=[(0.0, 3.4)],
        front=dict(Ln=1.2, tip_w=0.86, tip_drop=0.14, setback=0.30, face=SOTETSU_NAVY,
                   decals=_sotetsu_front(False), skirt=('#141c36', 0.14, 0.70)),
    ),
    dict(
        _SOT_SIDE, id='sotetsu20000', name='相鐵 20000 系',
        source='ja.wikipedia 相鉄20000系 infobox (先頭20,470/中間20,000, 2,787, 4,065 mm)；Commons: Sagami-Railway-21000-20103F.jpg（MaedaAkihiko，CC BY-SA 4.0；照片為 20000 系 20103F）',
        pitch=20.0, W=2.787, roof=3.62, shoulder=3.20, ac_top=4.065, flare=(0.08, 0.6), ac=[(0.0, 3.4)],
        front=dict(Ln=1.15, tip_w=0.88, tip_drop=0.14, setback=0.26, face=SOTETSU_NAVY,
                   cap=[(None, 2.00, SOTETSU_NAVY), (2.00, 3.44, MASK), (3.44, None, SOTETSU_NAVY)],
                   decals=_sotetsu_front(True), skirt=('#141c36', 0.14, 0.70)),
    ),
]
CARS.append(dict(CARS[-1], id='sotetsu21000', name='相鐵 21000 系（東急直通用 8 輛編組）',
                 source='ja.wikipedia 相鉄20000系 infobox（21000 系共用：先頭20,470/中間20,000, 2,787, 4,065 mm）；Commons: Sagami-Railway-21000-21106F.jpg（MaedaAkihiko，CC BY-SA 4.0）'))
