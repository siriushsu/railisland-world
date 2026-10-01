"""紐約地鐵 R160（R160A Alstom／R160B Kawasaki，外觀相同）：駕駛車與中間車。

已查證（英文維基百科 infobox）：車長 60 ft 2.5 in（18.35 m）、寬 9 ft 9.28 in（2.98 m）、高 12 ft 0.29 in（3.67 m）；
每側 4 門；不鏽鋼車體、玻璃纖維車端；第三軌集電（無集電弓）；車端有貫通門、無折棚。
依照片估計（Commons：F Train At Kings Highway.jpg，MTAEnthusiast10，CC BY 4.0）：
  車頭黑色玻璃纖維面罩（上緣圓拱）、貫通門偏向司機室另一側、司機室窗在車頭右側（面向車頭看在左）、
  上方路線牌（路線色圓標）、下緣左右各一對頭燈、面罩下方露出不鏽鋼、最下為防爬器。
  側窗與門的位置、窗數（門間兩窗、車端一小窗）、車頂冷氣罩、轉向架細節。
車身沒有路線色；路線色只出現在車頭與側面的路線圓標，網格裡用 BULLET 色當換色鍵（map3d.js 的 TINT_SOURCES）。
"""
from common import *

SS = C('#b8bcc2')          # 不鏽鋼（估）
SS_LOW = C('#9da2a8')
SS_ROOF = C('#a7abb0')
SS_DOOR = C('#c3c7cc')
CAP = C('#1a1a1a')         # 黑色車頭面罩（估）
BULLET = C('#eb6800')      # 路線圓標：F／M 線橘（換色鍵，見 map3d.js）
LAMP = C('#f2efe2')
LAMP_OFF = C('#c9ccce')
ZLO, ZHI = 1.85, 2.72
PITCH = 18.35


def spec():
    return dict(
        id='r160', W=2.98, body=PITCH - 0.7, pitch=PITCH, zb=0.95,
        profile=lambda lod: Profile(hw=1.49, zb=0.95, z_sh=3.22, z_c=3.67, inset=0.05, cham=0.06, z_belt=1.5,
                                    K=6 if lod == 0 else 3, pieces=2 if lod == 0 else 1),
        band=Band([(0.0, 1.06, SS_LOW)], SS, g=0.45),
        roof_col=SS_ROOF,
        kinds=lambda lod: {**win_kinds(ZLO, ZHI, frame=C('#7d8287')),
                           'door': [(1.06, 2.98, SS_DOOR, 0.45)], 'dgap': [(1.04, 3.00, GAP, 0.2)],
                           'dwin': [(1.92, 2.70, GLASS, 0.9)],
                           'bullet': [(2.86, 3.02, BULLET, 0.6)]},
        bellows=dict(w=1.0, z0=1.10, z1=3.00),
        bogie_x=6.29, wb=2.13,
        end_col=SS,
    )


def door2(xc, w=1.27, lod=0):
    """雙扇滑門：門縫、中縫、兩片門板各一扇窄窗。"""
    x0 = xc - w / 2
    el = [(x0, x0 + 0.03, 'dgap'), (xc - 0.015, xc + 0.015, 'dgap'), (x0 + w - 0.03, x0 + w, 'dgap')]
    for lx in (x0 + 0.17, xc + 0.015 + 0.15):
        el.append((lx, lx + 0.28, ('dwin', 'door')))
    el.append((x0, x0 + w, 'door'))
    return el


def win(x0, w):
    return [(x0 - 0.035, x0, 'win_f'), (x0, x0 + w, 'win_g'), (x0 + w, x0 + w + 0.035, 'win_f')]


DOORS = (-7.5, -2.5, 2.5, 7.5)


def side_elems(lod, cab=False):
    """側牆元素（絕對 x，車體 ±8.83）。門 4 扇；門間兩窗、車端一小窗；側面路線圓標在中門之間上方。"""
    el = []
    for xc in DOORS:
        el += door2(xc, lod=lod)
    for x0, w in ((-6.55, 1.25), (-4.4, 1.25), (-1.55, 1.25), (0.3, 1.25), (3.15, 1.25), (5.3, 1.25), (-8.55, 0.55)):
        el += win(x0, w)
    if not cab:
        el += win(8.0, 0.55)
    el.append((-0.12, 0.12, 'bullet'))
    return el


def roof_fn(m, sp, lod):
    zc = 3.67
    for xc in (-5.6, 5.6):     # 低矮冷氣罩
        roof_unit(m, xc, 0, zc - 0.05, 3.0, 1.6, 0.10, C('#9fa4a9'), top=C('#a3a8ad'), bevel=0.08, vent=False)
    third_rail_shoes(m, sp['bogie_x'])


def third_rail_shoes(m, bx, reach=1.36):
    """第三軌集電靴樑（轉向架兩側）。reach＝集電靴中心距車中線；外緣不超出車寬（網頁依網格寬度縮放）。"""
    m.tag = 'bogie'
    for x in (-bx, bx):
        for s in (-1, 1):
            box(m, (x + 0.35, s * (0.86 + reach) / 2, 0.30), (0.12, reach - 0.86 + 0.04, 0.08), DARK)     # 自側樑伸出的集電靴樑
            box(m, (x + 0.35, s * reach, 0.23), (0.32, 0.18, 0.05), DARK)     # 集電靴


BELLY = [(-3.6, 2.2, 0.50, 0.95, 1.15), (-0.6, 1.6, 0.55, 0.95, 1.10), (2.6, 2.4, 0.50, 0.95, 1.15)]


def build_mid_car(lod):
    sp = spec()
    return build_mid(sp, lod, side_elems(lod), roof_fn=roof_fn, belly_items=BELLY, wb=sp['wb'],
                     lo_bellows=False, hi_bellows=False), sp


def nose_curves():
    hw = [(0, 1.49), (0.5, 1.48), (0.85, 1.45), (1.0, 1.40)]
    top = [(0, 3.67), (0.5, 3.65), (0.85, 3.60), (1.0, 3.55)]
    bot = [(0, 0.95), (1.0, 0.93)]
    nexp = [(0, 3.0), (0.6, 5.0), (1, 6.0)]
    mw = [(0, 0.0), (0.4, 0.3), (1, 0.7)]
    return hw, top, bot, nexp, mw


def decals(m, nose, x_tip, lod):
    h, lm = 0.10, 0.25
    # 面向車頭看：左＝-y（車的右側）。黑色面罩（上緣圓拱）
    nose.decal_front(m, rrect(0.0, 2.41, 2.70, 2.26, 0.45, 5), CAP, 0.55, 0.018, h=h, lmax=lm)
    # 貫通門（不鏽鋼）與門窗
    nose.decal_front(m, rrect(-0.10, 2.10, 1.04, 2.06, 0.05, 2), SS_DOOR, 0.45, 0.030, h=h, lmax=lm)
    nose.decal_front(m, rrect(-0.10, 2.52, 0.54, 0.86, 0.08, 3), GLASS, 0.92, 0.042, h=h, lmax=lm)
    # 司機室窗（銀框＋玻璃）
    nose.decal_front(m, rrect(-0.985, 2.43, 0.82, 1.12, 0.09, 3), C('#8c9196'), 0.4, 0.030, h=h, lmax=lm)
    nose.decal_front(m, rrect(-0.985, 2.43, 0.72, 1.02, 0.07, 3), GLASS, 0.92, 0.042, h=h, lmax=lm)
    # 路線牌＋路線色圓標（換色鍵）
    nose.decal_front(m, rrect(-0.10, 3.36, 0.46, 0.32, 0.04, 2), C('#202326'), 0.7, 0.030, h=0.06, lmax=0.2)
    nose.decal_front(m, ellipse(-0.10, 3.36, 0.12, 0.12, 14), BULLET, 0.6, 0.042, h=0.05)
    # MTA 圓標（白底藍圓）
    nose.decal_front(m, ellipse(0.78, 2.42, 0.19, 0.19, 16), C('#e6e7e8'), 0.5, 0.030, h=0.06)
    nose.decal_front(m, ellipse(0.78, 2.50, 0.07, 0.07, 10), C('#0039a6'), 0.5, 0.042, h=0.04)
    # 頭燈：左右各一對（內側點亮）
    for y, c in ((-1.12, LAMP_OFF), (-0.76, LAMP), (0.71, LAMP), (1.06, LAMP_OFF)):
        nose.decal_front(m, ellipse(y, 1.47, 0.11, 0.11, 12), c, 0.9, 0.042, h=0.05)
    # 防爬器與連結器
    m.tag = 'nose'
    box(m, (x_tip - 0.06, 0, 0.93), (0.16, 2.84, 0.17), C('#3a3e42'), 0.3)
    box(m, (x_tip - 0.25, 0, 0.66), (0.50, 0.40, 0.26), DARK, 0.3)


def build_cab(lod):
    sp = spec()
    Ln = 0.32
    el = side_elems(lod, cab=True)
    from common import build_cab as _cab
    m = _cab(sp, lod, PITCH, Ln, nose_curves(), el, decal_fn=decals, roof_fn=roof_fn, belly_items=BELLY,
             bogie_xs=[-6.29 + 0.175, 6.29], wb=sp['wb'], u_switch=0.3, body_col=SS, n_st=8, coupler_bellows=False,
             belly_span=(-5.6, 5.0))
    return m, sp


BUILDERS = {
    'r160': build_cab,
    'r160-mid': build_mid_car,
}
