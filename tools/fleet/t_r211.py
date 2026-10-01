"""紐約地鐵 R211（R211A／R211T；Kawasaki）：駕駛車與中間車。

已查證（英文維基百科 infobox）：車長 60.21 ft（18.35 m）、寬 10 ft（3.05 m，最大）、高 12 ft（3.66 m，最大）；
每側 4 門、門寬 58 吋（1.47 m，比舊車寬）；不鏽鋼車體；第三軌集電。R211T（開放式貫通道試驗車）外觀相同。
依照片估計（Commons：R211 A train approaching 80th Street August 2025.jpg，4300streetcar，CC BY 4.0；
First R211 Subway Cars Roll Into Service on the A Line.jpg，Metropolitan Transportation Authority，CC BY 2.0）：
  車頭大面積 MTA 藍色面罩（上緣圓拱），下緣左右兩塊白色斜角，斜邊各一道 LED 頭燈條；
  面向車頭看左為司機室窗、中間貫通門（藍色、上方目的地顯示器）、右為大窗與路線圓標；
  駕駛車側面從車頭到第一扇門前有一段藍色、以黃色細線收邊。側窗位置與數量、車頂、轉向架細節。
路線圓標用 BULLET 色當換色鍵（同 R160）。
"""
from common import *
from t_r160 import third_rail_shoes, BULLET

SS = C('#b9bdc2')
SS_LOW = C('#9ea3a8')
SS_ROOF = C('#a7abb0')
SS_DOOR = C('#c2c6ca')
BLUE = C('#1f3f9e')        # MTA 藍（估）
WHITE = C('#e3e5e7')
YELLOW = C('#f2c230')
LED = C('#f4f6f8')
ZLO, ZHI = 1.85, 2.78
PITCH = 18.35
DOORS = (-7.4, -2.47, 2.47, 7.4)
DOOR_W = 1.47


def spec():
    return dict(
        id='r211', W=3.05, body=PITCH - 0.7, pitch=PITCH, zb=0.95,
        profile=lambda lod: Profile(hw=1.525, zb=0.95, z_sh=3.22, z_c=3.66, inset=0.05, cham=0.06, z_belt=1.5,
                                    K=6 if lod == 0 else 3, pieces=2 if lod == 0 else 1),
        band=Band([(0.0, 1.06, SS_LOW)], SS, g=0.45),
        roof_col=SS_ROOF,
        kinds=lambda lod: {**win_kinds(ZLO, ZHI, frame=C('#7d8287')),
                           'door': [(1.06, 3.00, SS_DOOR, 0.45)], 'dgap': [(1.04, 3.02, GAP, 0.2)],
                           'dwin': [(1.95, 2.75, GLASS, 0.9)],
                           'bullet': [(2.88, 3.04, BULLET, 0.6)],
                           'blue': [(1.06, 9.0, BLUE, 0.5)], 'yline': [(1.06, 9.0, YELLOW, 0.5)]},
        bellows=dict(w=1.0, z0=1.10, z1=3.00),
        bogie_x=6.29, wb=2.13,
        end_col=SS,
    )


def door2(xc, w=DOOR_W):
    x0 = xc - w / 2
    el = [(x0, x0 + 0.03, 'dgap'), (xc - 0.015, xc + 0.015, 'dgap'), (x0 + w - 0.03, x0 + w, 'dgap')]
    for lx in (x0 + 0.20, xc + 0.015 + 0.18):
        el.append((lx, lx + 0.30, ('dwin', 'door')))
    el.append((x0, x0 + w, 'door'))
    return el


def win(x0, w):
    return [(x0 - 0.035, x0, 'win_f'), (x0, x0 + w, 'win_g'), (x0 + w, x0 + w + 0.035, 'win_f')]


def side_elems(cab=False):
    """側牆元素（絕對 x，車體 ±8.83）。門 4 扇；門間兩窗、車端一窗；駕駛車車頭段為藍色＋黃線。"""
    el = []
    for xc in DOORS:
        el += door2(xc)
    for x0, w in ((-6.45, 1.1), (-4.65, 1.1), (-1.55, 1.2), (0.35, 1.2), (3.55, 1.1), (5.35, 1.1), (-8.6, 0.42)):
        el += win(x0, w)
    if cab:
        el += [(8.13, 8.20, 'yline'), (8.20, 8.83, 'blue')]
    else:
        el += win(8.18, 0.42)
    el.append((-0.12, 0.12, 'bullet'))
    return el


def roof_fn(m, sp, lod):
    zc = 3.66
    for xc in (-5.6, 5.6):
        roof_unit(m, xc, 0, zc - 0.05, 3.0, 1.6, 0.10, C('#9fa4a9'), top=C('#a3a8ad'), bevel=0.08, vent=False)
    third_rail_shoes(m, sp['bogie_x'])


BELLY = [(-3.6, 2.2, 0.50, 0.95, 1.15), (-0.6, 1.6, 0.55, 0.95, 1.10), (2.6, 2.4, 0.50, 0.95, 1.15)]


def build_mid_car(lod):
    sp = spec()
    return build_mid(sp, lod, side_elems(), roof_fn=roof_fn, belly_items=BELLY, wb=sp['wb'],
                     lo_bellows=False, hi_bellows=False), sp


def nose_curves():
    hw = [(0, 1.525), (0.5, 1.51), (0.85, 1.48), (1.0, 1.43)]
    top = [(0, 3.66), (0.5, 3.64), (0.85, 3.60), (1.0, 3.54)]
    bot = [(0, 0.95), (1.0, 0.93)]
    nexp = [(0, 3.0), (0.6, 5.0), (1, 6.0)]
    mw = [(0, 0.0), (0.4, 0.3), (1, 0.7)]
    return hw, top, bot, nexp, mw


def nose_colour(kind, u, xc, yc, zc):
    """車頭側面前段（u>0.35）為藍色，下緣斜角白。"""
    if kind in ('roof', 'floor') or u < 0.35:
        return None
    return (WHITE, 0.45) if zc < 1.75 else (BLUE, 0.5)


def cap_poly():
    """藍色面罩：上緣圓角、下緣兩側斜切（斜邊以下為白色）。逆時針。"""
    pts = [(-0.60, 1.06), (0.60, 1.06), (1.38, 1.80)]
    r, top, half = 0.42, 3.50, 1.38
    for k in range(7):
        a = math.radians(90 * k / 6)
        pts.append((half - r + r * math.cos(a), top - r + r * math.sin(a)))
    for k in range(7):
        a = math.radians(90 + 90 * k / 6)
        pts.append((-half + r + r * math.cos(a), top - r + r * math.sin(a)))
    pts.append((-1.38, 1.80))
    return pts


def decals(m, nose, x_tip, lod):
    h, lm = 0.10, 0.25
    nose.decal_front(m, cap_poly(), BLUE, 0.5, 0.018, h=h, lmax=lm)
    # LED 頭燈條（沿斜邊）
    for s in (-1, 1):
        a, b = (s * 1.30, 1.70), (s * 0.70, 1.16)
        dx, dz = 0.0, 0.06
        nose.decal_front(m, [a, b, (b[0], b[1] + dz), (a[0], a[1] + dz)], LED, 0.95, 0.030, h=0.04, lmax=0.15)
    # 面向車頭看：左＝-y。司機室窗、貫通門與門窗、目的地顯示器、右大窗與路線圓標
    nose.decal_front(m, rrect(-1.00, 2.62, 0.70, 1.56, 0.10, 3), GLASS, 0.92, 0.030, h=h, lmax=lm)
    nose.decal_front(m, rrect(-0.09, 2.10, 0.86, 2.12, 0.04, 2), C('#2a4aa8'), 0.5, 0.026, h=h, lmax=lm)
    nose.decal_front(m, rrect(-0.09, 2.43, 0.58, 1.20, 0.10, 3), GLASS, 0.92, 0.036, h=h, lmax=lm)
    nose.decal_front(m, rrect(-0.09, 3.36, 0.84, 0.22, 0.03, 2), C('#15181b'), 0.7, 0.036, h=0.06, lmax=0.2)
    nose.decal_front(m, rrect(0.92, 2.62, 0.86, 1.56, 0.10, 3), GLASS, 0.92, 0.030, h=h, lmax=lm)
    nose.decal_front(m, ellipse(0.92, 2.65, 0.26, 0.26, 18), BULLET, 0.6, 0.040, h=0.05)
    m.tag = 'nose'
    box(m, (x_tip - 0.05, 0, 0.93), (0.14, 2.96, 0.15), C('#4a4e52'), 0.3)    # 防爬器
    box(m, (x_tip - 0.25, 0, 0.66), (0.50, 0.40, 0.26), DARK, 0.3)            # 連結器


def build_cab(lod):
    sp = spec()
    from common import make_nose, nose_loft
    import parts as P
    x_tip = PITCH / 2
    x_rear = -PITCH / 2 + HALF_GAP
    Ln = 0.32
    xn0 = x_tip - Ln
    m = Mesh()
    prof = sp['profile'](lod)
    layout = P.Layout(sp['band'], sp['kinds'](lod), P.resolve(side_elems(cab=True)))
    P.wall_panels(m, prof, 'L', x_rear, xn0, layout)
    P.wall_panels(m, prof, 'R', x_rear, xn0, layout)
    P.roof_loft(m, prof, x_rear, xn0, sp['roof_col'])
    P.floor_plate(m, prof, x_rear, xn0, UNDER)
    ring, _ = prof.ring()
    P.end_cap(m, ring, x_rear, -1, sp['end_col'])
    nose, nk = make_nose(prof, xn0, Ln, +1, nose_curves(), subdiv=2)
    nose_loft(m, nose, nk, sp['band'], sp['roof_col'], WHITE, u_switch=0.35, n_st=8, col_fn=nose_colour)
    m.tag = 'decal'
    decals(m, nose, x_tip, lod)
    roof_fn(m, sp, lod)
    for x in (-6.29 + 0.175, 6.29):
        bogie(m, x, wb=sp['wb'], lod=lod)
    belly(m, -5.6, 5.0, sp['zb'], sp['W'], lod=lod, items=BELLY)
    return m, sp


BUILDERS = {
    'r211': build_cab,
    'r211-mid': build_mid_car,
}
