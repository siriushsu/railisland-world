"""紐約地鐵 R142（Bombardier；R142A〔Kawasaki〕外觀相近，共用此網格）：駕駛車與中間車。

已查證（英文維基百科 infobox）：車長 51 ft 4 in（15.65 m）、寬 8 ft 9.5 in（2.68 m）、高 11 ft 10.67 in（3.62 m）；
每側 3 門（每車 6 組 50 吋側門）；不鏽鋼車體、玻璃纖維車頭；第三軌集電。
依照片估計（Commons：R142 2 train at East 180th Street.jpg；R142 6 Train @ 149th Street-Grand Concourse.jpg）：
  車頭深藍黑色面罩（上緣圓拱），中間偏左為不鏽鋼貫通門（含門框），左右各一司機室窗（右窗較大），
  上方路線牌（路線色圓標），下緣左右各一塊暗紅色燈罩、內有標識燈（上）與頭燈（下），再下為不鏽鋼與防爬器。
  側窗（門間一大窗、車端一小窗）、車頂、轉向架細節。
車身沒有路線色；路線圓標用 BULLET 色當換色鍵（同 R160）。
"""
from common import *
from t_r160 import third_rail_shoes, BULLET

SS = C('#b8bcc1')
SS_LOW = C('#9da2a7')
SS_ROOF = C('#a7abb0')
SS_DOOR = C('#c0c4c8')
CAP = C('#1c2230')         # 深藍黑面罩（估）
POD = C('#7d1d24')         # 暗紅燈罩（估）
ZLO, ZHI = 1.90, 2.74
PITCH = 15.65
DOORS = (-5.2, 0.0, 5.2)
BOGIE_X = 5.0


def spec():
    return dict(
        id='r142', W=2.68, body=PITCH - 0.7, pitch=PITCH, zb=0.95,
        profile=lambda lod: Profile(hw=1.34, zb=0.95, z_sh=3.15, z_c=3.62, inset=0.05, cham=0.06, z_belt=1.5,
                                    K=6 if lod == 0 else 3, pieces=2 if lod == 0 else 1),
        band=Band([(0.0, 1.06, SS_LOW)], SS, g=0.45),
        roof_col=SS_ROOF,
        kinds=lambda lod: {**win_kinds(ZLO, ZHI, frame=C('#7d8287')),
                           'door': [(1.06, 2.98, SS_DOOR, 0.45)], 'dgap': [(1.04, 3.00, GAP, 0.2)],
                           'dwin': [(1.95, 2.72, GLASS, 0.9)],
                           'sign': [(2.84, 3.04, C('#202326'), 0.7)],
                           'bullet': [(2.86, 3.02, BULLET, 0.6)]},
        bellows=dict(w=1.0, z0=1.10, z1=3.00),
        bogie_x=BOGIE_X, wb=2.13,
        end_col=SS,
    )


def door2(xc, w=1.27):
    x0 = xc - w / 2
    el = [(x0, x0 + 0.03, 'dgap'), (xc - 0.015, xc + 0.015, 'dgap'), (x0 + w - 0.03, x0 + w, 'dgap')]
    for lx in (x0 + 0.15, xc + 0.015 + 0.15):
        el.append((lx, lx + 0.30, ('dwin', 'door')))
    el.append((x0, x0 + w, 'door'))
    return el


def win(x0, w):
    return [(x0 - 0.035, x0, 'win_f'), (x0, x0 + w, 'win_g'), (x0 + w, x0 + w + 0.035, 'win_f')]


def side_elems(cab=False):
    """側牆元素（絕對 x，車體 ±7.48）。門 3 扇；門間一大窗、車端一窗；側面 LED 路線牌在中門兩側上方。"""
    el = []
    for xc in DOORS:
        el += door2(xc)
    for x0, w in ((-3.2, 1.35), (1.85, 1.35), (-7.05, 0.85)):
        el += win(x0, w)
    if not cab:
        el += win(6.2, 0.85)
    el += [(-1.75, -0.95, 'sign'), (-1.70, -1.48, ('bullet', 'sign')), (0.95, 1.75, 'sign'), (1.00, 1.22, ('bullet', 'sign'))]
    return el


def roof_fn(m, sp, lod):
    zc = 3.62
    for xc in (-4.6, 4.6):
        roof_unit(m, xc, 0, zc - 0.05, 2.6, 1.5, 0.10, C('#9fa4a9'), top=C('#a3a8ad'), bevel=0.08, vent=False)
    third_rail_shoes(m, BOGIE_X, reach=1.22)


BELLY = [(-2.6, 1.8, 0.50, 0.95, 1.0), (0.0, 1.4, 0.55, 0.95, 0.95), (2.6, 1.8, 0.50, 0.95, 1.0)]


def build_mid_car(lod):
    sp = dict(spec(), belly_half=3.9)
    return build_mid(sp, lod, side_elems(), roof_fn=roof_fn, belly_items=BELLY, wb=sp['wb'],
                     lo_bellows=False, hi_bellows=False), sp


def nose_curves():
    hw = [(0, 1.34), (0.5, 1.33), (0.85, 1.30), (1.0, 1.26)]
    top = [(0, 3.62), (0.5, 3.60), (0.85, 3.56), (1.0, 3.50)]
    bot = [(0, 0.95), (1.0, 0.94)]
    nexp = [(0, 3.0), (0.6, 5.0), (1, 6.0)]
    mw = [(0, 0.0), (0.4, 0.3), (1, 0.7)]
    return hw, top, bot, nexp, mw


def decals(m, nose, x_tip, lod):
    h, lm = 0.10, 0.25
    # 面向車頭看：左＝-y。深藍黑面罩（上緣圓拱，下緣到燈罩上方）
    nose.decal_front(m, rrect(0.0, 2.69, 2.46, 1.62, 0.42, 5), CAP, 0.55, 0.018, h=h, lmax=lm)
    # 貫通門框（不鏽鋼）、門板、門窗
    nose.decal_front(m, rrect(-0.14, 2.12, 1.19, 2.16, 0.05, 2), SS_DOOR, 0.45, 0.030, h=h, lmax=lm)
    nose.decal_front(m, rrect(-0.07, 2.05, 0.79, 1.98, 0.03, 2), C('#b1b5ba'), 0.45, 0.040, h=h, lmax=lm)
    nose.decal_front(m, rrect(-0.04, 2.47, 0.58, 0.88, 0.09, 3), GLASS, 0.92, 0.050, h=h, lmax=lm)
    # 司機室窗（左小右大）
    for y, w in ((-0.99, 0.46), (0.82, 0.64)):
        nose.decal_front(m, rrect(y, 2.49, w + 0.08, 1.00, 0.09, 3), C('#6b7178'), 0.5, 0.026, h=h, lmax=lm)   # 窗框
        nose.decal_front(m, rrect(y, 2.49, w, 0.92, 0.07, 3), GLASS, 0.92, 0.036, h=h, lmax=lm)
    # 路線牌＋路線色圓標（換色鍵）
    nose.decal_front(m, rrect(-0.14, 3.37, 0.40, 0.30, 0.04, 2), C('#202326'), 0.7, 0.030, h=0.06, lmax=0.2)
    nose.decal_front(m, ellipse(-0.14, 3.37, 0.11, 0.11, 14), BULLET, 0.6, 0.042, h=0.05)
    # 暗紅燈罩與燈：上標識燈、下頭燈
    for y, w in ((-1.03, 0.46), (0.89, 0.64)):
        nose.decal_front(m, rrect(y, 1.55, w, 0.70, 0.04, 2), POD, 0.6, 0.030, h=0.06, lmax=0.2)
        ly = y + (0.06 if y < 0 else -0.02)
        nose.decal_front(m, ellipse(ly, 1.71, 0.09, 0.09, 12), C('#6fa7a8'), 0.85, 0.042, h=0.04)
        nose.decal_front(m, ellipse(ly, 1.43, 0.10, 0.10, 12), C('#f2efe2'), 0.9, 0.042, h=0.04)
    m.tag = 'nose'
    box(m, (x_tip - 0.05, 0, 0.93), (0.14, 2.58, 0.15), C('#4a4e52'), 0.3)    # 防爬器
    box(m, (x_tip - 0.25, 0, 0.66), (0.50, 0.40, 0.26), DARK, 0.3)            # 連結器


def build_cab(lod):
    sp = spec()
    from common import build_cab as _cab
    m = _cab(sp, lod, PITCH, 0.28, nose_curves(), side_elems(cab=True), decal_fn=decals, roof_fn=roof_fn, belly_items=BELLY,
             bogie_xs=[-BOGIE_X + 0.175, BOGIE_X], wb=sp['wb'], u_switch=0.3, body_col=SS, n_st=8, coupler_bellows=False,
             belly_span=(-3.9, 3.7))
    return m, sp


BUILDERS = {
    'r142': build_cab,
    'r142-mid': build_mid_car,
}
