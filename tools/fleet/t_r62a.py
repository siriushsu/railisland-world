"""紐約地鐵 R62A（Bombardier；R62〔Kawasaki〕外觀幾乎相同，共用此網格）：駕駛車與中間車。

已查證（英文維基百科 infobox）：車長 51.04 ft（15.56 m）、寬 8.60 ft（2.62 m）、高 11.89 ft（3.62 m）；每側 3 門；
不鏽鋼車體；第三軌集電；車端有貫通門、無折棚。
依照片估計（Commons：MTA NYC Subway 1 train leaving 125th St.jpg，Mtattrain，CC BY-SA 4.0；
R62A Subway Car, 1936, Shuttle, September 5th, 2014.jpg，ARJPHOTOGRAPHY，CC BY-SA 4.0）：
  車頭整片不鏽鋼、幾乎垂直；面向車頭看左為司機室窗、中間貫通門、右為大型路線牌（黑底、路線色圓標）；
  左右各一組紅色標識燈（上）與白色頭燈（下）。側窗位置與數量、車頂、轉向架細節。
車身沒有路線色；路線圓標用 BULLET 色當換色鍵（同 R160）。
"""
from common import *
from t_r160 import third_rail_shoes, BULLET

SS = C('#b4b8bd')
SS_LOW = C('#9a9fa4')
SS_ROOF = C('#a5a9ae')
SS_FACE = C('#aeb2b7')
SS_DOOR = C('#bcc0c4')
SIGN = C('#16191c')
ZLO, ZHI = 1.88, 2.72
PITCH = 15.56
DOORS = (-5.19, 0.0, 5.19)
BOGIE_X = 5.0


def spec():
    return dict(
        id='r62a', W=2.62, body=PITCH - 0.7, pitch=PITCH, zb=0.95,
        profile=lambda lod: Profile(hw=1.31, zb=0.95, z_sh=3.15, z_c=3.62, inset=0.05, cham=0.06, z_belt=1.5,
                                    K=6 if lod == 0 else 3, pieces=2 if lod == 0 else 1),
        band=Band([(0.0, 1.06, SS_LOW)], SS, g=0.45),
        roof_col=SS_ROOF,
        kinds=lambda lod: {**win_kinds(ZLO, ZHI, frame=C('#7d8287')),
                           'door': [(1.06, 2.98, SS_DOOR, 0.45)], 'dgap': [(1.04, 3.00, GAP, 0.2)],
                           'dwin': [(1.95, 2.70, GLASS, 0.9)],
                           'bullet': [(2.86, 3.02, BULLET, 0.6)]},
        bellows=dict(w=1.0, z0=1.10, z1=3.00),
        bogie_x=BOGIE_X, wb=1.98,
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
    """側牆元素（絕對 x，車體 ±7.43）。門 3 扇；門間兩窗、車端一窗。"""
    el = []
    for xc in DOORS:
        el += door2(xc)
    for x0, w in ((-4.15, 1.3), (-2.3, 1.3), (1.0, 1.3), (2.85, 1.3), (-7.0, 0.9)):
        el += win(x0, w)
    if not cab:
        el += win(6.1, 0.9)
    el.append((-2.62, -2.38, 'bullet'))
    return el


def roof_fn(m, sp, lod):
    third_rail_shoes(m, BOGIE_X, reach=1.20)


BELLY = [(-2.6, 1.8, 0.50, 0.95, 1.0), (0.0, 1.4, 0.55, 0.95, 0.95), (2.6, 1.8, 0.50, 0.95, 1.0)]


def build_mid_car(lod):
    sp = dict(spec(), belly_half=3.9)
    return build_mid(sp, lod, side_elems(), roof_fn=roof_fn, belly_items=BELLY, wb=sp['wb'],
                     lo_bellows=False, hi_bellows=False), sp


def nose_curves():
    hw = [(0, 1.31), (0.6, 1.30), (1.0, 1.25)]
    top = [(0, 3.62), (0.5, 3.60), (1.0, 3.50)]
    bot = [(0, 0.95), (1.0, 0.94)]
    nexp = [(0, 3.0), (0.6, 5.0), (1, 6.0)]
    mw = [(0, 0.0), (0.4, 0.3), (1, 0.7)]
    return hw, top, bot, nexp, mw


def decals(m, nose, x_tip, lod):
    h, lm = 0.10, 0.25
    # 面向車頭看：左＝-y。司機室窗
    nose.decal_front(m, rrect(-0.85, 2.635, 0.66, 0.90, 0.07, 3), C('#7f8489'), 0.4, 0.020, h=h, lmax=lm)
    nose.decal_front(m, rrect(-0.85, 2.635, 0.56, 0.82, 0.06, 3), GLASS, 0.92, 0.032, h=h, lmax=lm)
    # 貫通門與門窗
    nose.decal_front(m, rrect(0.03, 2.10, 0.82, 1.94, 0.03, 2), SS_DOOR, 0.45, 0.020, h=h, lmax=lm)
    nose.decal_front(m, rrect(0.03, 2.66, 0.46, 0.62, 0.06, 3), GLASS, 0.92, 0.032, h=h, lmax=lm)
    # 路線牌（黑底）＋路線色圓標（換色鍵）
    nose.decal_front(m, rrect(0.91, 2.635, 0.62, 0.86, 0.08, 3), SIGN, 0.9, 0.020, h=h, lmax=lm)
    nose.decal_front(m, ellipse(0.91, 2.62, 0.21, 0.21, 16), BULLET, 0.6, 0.032, h=0.05)
    # 左右各一組：紅色標識燈（上）、白色頭燈（下）
    for y in (-0.70, 0.72):
        nose.decal_front(m, ellipse(y, 1.91, 0.10, 0.10, 12), C('#c23a32'), 0.8, 0.030, h=0.05)
        nose.decal_front(m, ellipse(y, 1.47, 0.11, 0.11, 12), C('#f2efe2'), 0.9, 0.030, h=0.05)
    m.tag = 'nose'
    box(m, (x_tip - 0.05, 0, 0.93), (0.14, 2.52, 0.15), C('#4a4e52'), 0.3)    # 防爬器
    box(m, (x_tip - 0.25, 0, 0.66), (0.50, 0.40, 0.26), DARK, 0.3)            # 連結器


def build_cab(lod):
    sp = spec()
    from common import build_cab as _cab
    m = _cab(sp, lod, PITCH, 0.22, nose_curves(), side_elems(cab=True), decal_fn=decals, roof_fn=roof_fn, belly_items=BELLY,
             bogie_xs=[-BOGIE_X + 0.175, BOGIE_X], wb=sp['wb'], u_switch=0.3, body_col=SS_FACE, n_st=8, coupler_bellows=False,
             belly_span=(-3.9, 3.7))
    return m, sp


BUILDERS = {
    'r62a': build_cab,
    'r62a-mid': build_mid_car,
}
