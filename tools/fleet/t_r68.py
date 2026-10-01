"""紐約地鐵 75 呎車：R68（R68A 外觀幾乎相同，共用此網格）與 R46。駕駛車與中間車。

已查證（英文維基百科 infobox）：車長 75 ft（22.77 m，防爬器間）、寬 10 ft（3.05 m）、高 12.08 ft（3.68 m）；每側 4 門；
不鏽鋼車體；第三軌集電；車端有貫通門、無折棚。
依照片估計：
  R68  Commons: R68 2704 on the D line at 50th Street.png（Dapr03，CC BY-SA 4.0）；
       MTA NYC Subway N train arriving at 36th Ave.jpg（R68A，Mtattrain，CC BY-SA 4.0）
  R46  Commons: R46 trains approaching and departing 30th Ave August 2025 1 (cropped 2).jpg（4300streetcar，CC BY 4.0）
  車頭整片不鏽鋼、幾乎垂直：面向車頭看左為司機室窗、中間貫通門、右為黑底路線牌（路線色圓標）；
  窗下左右各一組燈。R46 車頂邊緣較圓、燈為「琥珀標識燈＋白頭燈」與「白頭燈＋紅標識燈」；R68 車頂較方、兩盞白頭燈並排。
  側窗位置與數量（門間兩窗）、車頂、轉向架細節為估計。
路線圓標用 BULLET 色當換色鍵（同 R160）。
"""
from common import *
from t_r160 import third_rail_shoes, BULLET

SS = C('#b4b8bd')
SS_LOW = C('#9a9fa4')
SS_ROOF = C('#a5a9ae')
SS_FACE = C('#b0b4b9')
SS_DOOR = C('#bcc0c4')
SIGN = C('#16191c')
ZLO, ZHI = 1.90, 2.76
PITCH = 22.77
DOORS = (-8.1, -2.7, 2.7, 8.1)
BOGIE_X = 7.1


def spec(variant):
    rounded = variant == 'r46'
    return dict(
        id=variant, W=3.05, body=PITCH - 0.7, pitch=PITCH, zb=0.95,
        profile=lambda lod: Profile(hw=1.525, zb=0.95, z_sh=3.12 if rounded else 3.28, z_c=3.68, inset=0.06 if rounded else 0.04,
                                    cham=0.06, z_belt=1.5, K=6 if lod == 0 else 3, pieces=2 if lod == 0 else 1),
        band=Band([(0.0, 1.06, SS_LOW)], SS, g=0.45),
        roof_col=SS_ROOF,
        kinds=lambda lod: {**win_kinds(ZLO, ZHI, frame=C('#7d8287')),
                           'door': [(1.06, 2.98, SS_DOOR, 0.45)], 'dgap': [(1.04, 3.00, GAP, 0.2)],
                           'dwin': [(1.98, 2.74, GLASS, 0.9)],
                           'bullet': [(2.88, 3.04, BULLET, 0.6)]},
        bellows=dict(w=1.0, z0=1.10, z1=3.00),
        bogie_x=BOGIE_X, wb=2.13,
        end_col=SS,
    )


def door2(xc, w=1.27):
    x0 = xc - w / 2
    el = [(x0, x0 + 0.03, 'dgap'), (xc - 0.015, xc + 0.015, 'dgap'), (x0 + w - 0.03, x0 + w, 'dgap')]
    for lx in (x0 + 0.16, xc + 0.015 + 0.16):
        el.append((lx, lx + 0.30, ('dwin', 'door')))
    el.append((x0, x0 + w, 'door'))
    return el


def win(x0, w):
    return [(x0 - 0.035, x0, 'win_f'), (x0, x0 + w, 'win_g'), (x0 + w, x0 + w + 0.035, 'win_f')]


def side_elems(cab=False):
    """側牆元素（絕對 x，車體 ±11.03）。門 4 扇；門間兩窗、車端一窗。"""
    el = []
    for xc in DOORS:
        el += door2(xc)
    for x0, w in ((-7.05, 1.6), (-5.2, 1.6), (-1.7, 1.5), (0.2, 1.5), (3.6, 1.6), (5.45, 1.6), (-10.6, 1.4)):
        el += win(x0, w)
    if not cab:
        el += win(9.2, 1.4)
    el.append((-0.12, 0.12, 'bullet'))
    return el


def roof_fn(m, sp, lod):
    zc = 3.68
    for xc in (-6.5, 6.5):
        roof_unit(m, xc, 0, zc - 0.05, 3.2, 1.7, 0.10, C('#9fa4a9'), top=C('#a3a8ad'), bevel=0.08, vent=False)
    third_rail_shoes(m, BOGIE_X)


BELLY = [(-4.4, 2.6, 0.50, 0.95, 1.15), (-0.8, 1.8, 0.55, 0.95, 1.10), (3.2, 2.8, 0.50, 0.95, 1.15)]


def build_mid_car(variant, lod):
    sp = dict(spec(variant), belly_half=6.2)
    return build_mid(sp, lod, side_elems(), roof_fn=roof_fn, belly_items=BELLY, wb=sp['wb'],
                     lo_bellows=False, hi_bellows=False), sp


def nose_curves(variant):
    rounded = variant == 'r46'
    hw = [(0, 1.525), (0.6, 1.51), (1.0, 1.46)]
    top = [(0, 3.68), (0.5, 3.64), (1.0, 3.48 if rounded else 3.56)]
    bot = [(0, 0.95), (1.0, 0.94)]
    nexp = [(0, 3.0), (0.6, 4.0 if rounded else 5.0), (1, 4.5 if rounded else 6.0)]
    mw = [(0, 0.0), (0.4, 0.3), (1, 0.75)]
    return hw, top, bot, nexp, mw


def decals(variant):
    def fn(m, nose, x_tip, lod):
        h, lm = 0.10, 0.25
        # 面向車頭看：左＝-y。司機室窗
        nose.decal_front(m, rrect(-0.95, 2.62, 0.78, 0.98, 0.10, 3), C('#7f8489'), 0.4, 0.020, h=h, lmax=lm)
        nose.decal_front(m, rrect(-0.95, 2.62, 0.68, 0.88, 0.08, 3), GLASS, 0.92, 0.032, h=h, lmax=lm)
        # 貫通門與門窗
        nose.decal_front(m, rrect(0.0, 2.10, 0.86, 1.98, 0.03, 2), SS_DOOR, 0.45, 0.020, h=h, lmax=lm)
        nose.decal_front(m, rrect(0.0, 2.64, 0.50, 0.70, 0.06, 3), GLASS, 0.92, 0.032, h=h, lmax=lm)
        # 路線牌（黑底）＋路線色圓標（換色鍵）
        nose.decal_front(m, rrect(0.95, 2.62, 0.70, 0.90, 0.08, 3), SIGN, 0.9, 0.020, h=h, lmax=lm)
        nose.decal_front(m, ellipse(0.95, 2.62, 0.24, 0.24, 16), BULLET, 0.6, 0.032, h=0.05)
        if variant == 'r46':
            lamps = [(-1.10, C('#e2a33a')), (-0.80, C('#f2efe2')), (0.80, C('#f2efe2')), (1.10, C('#c23a32'))]
        else:
            lamps = [(-1.08, C('#f2efe2')), (-0.80, C('#f2efe2')), (0.80, C('#f2efe2')), (1.08, C('#f2efe2'))]
        for y, col in lamps:
            nose.decal_front(m, ellipse(y, 1.62, 0.10, 0.10, 12), col, 0.9, 0.030, h=0.05)
        m.tag = 'nose'
        box(m, (x_tip - 0.05, 0, 0.93), (0.14, 2.96, 0.15), C('#4a4e52'), 0.3)    # 防爬器
        box(m, (x_tip - 0.25, 0, 0.66), (0.50, 0.40, 0.26), DARK, 0.3)            # 連結器
    return fn


def build_cab(variant, lod):
    sp = spec(variant)
    from common import build_cab as _cab
    m = _cab(sp, lod, PITCH, 0.30, nose_curves(variant), side_elems(cab=True), decal_fn=decals(variant), roof_fn=roof_fn,
             belly_items=BELLY, bogie_xs=[-BOGIE_X + 0.175, BOGIE_X], wb=sp['wb'], u_switch=0.3, body_col=SS_FACE, n_st=8,
             coupler_bellows=False, belly_span=(-6.0, 5.6))
    return m, sp


BUILDERS = {
    'r68': lambda lod: build_cab('r68', lod),
    'r68-mid': lambda lod: build_mid_car('r68', lod),
    'r46': lambda lod: build_cab('r46', lod),
    'r46-mid': lambda lod: build_mid_car('r46', lod),
}
