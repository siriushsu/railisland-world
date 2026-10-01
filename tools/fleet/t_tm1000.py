"""東京地鐵 1000 系（銀座線）：駕駛車與中間車。

已查證（日文維基百科 1000 系條目）：車長 16,000 mm、基準寬 2,550 mm、全高 3,465 mm；第三軌 600 V（無集電弓）；
每側 3 門；6 輛編組。塗裝仿 1927 年東京地下鐵道 1000 形：全車檸檬黃、車頂紅褐色。
依照片估計（Commons：Tokyo-Metro 1000.jpg，Sui-setz，CC BY-SA 3.0）：
  車頭圓角、幾乎垂直；上半部整片黑色玻璃區（面向車頭看左為貫通門窗、右為大擋風玻璃），
  車頂紅褐色並包到車頭上緣，上緣中央兩盞圓形頭燈；窗下一道橘色腰帶（上緣白、藍細線）繞過車頭與側面；
  車頭下方左右各一個紅色圓形尾燈罩。側窗與門的位置、冷氣罩、轉向架細節。
只用在銀座線，塗裝固定、不換色（顏色刻意避開 map3d.js 的換色鍵）。
"""
from common import *

YEL = C('#f6c200')
YEL_LOW = C('#d9aa00')
ROOF = C('#9b2f25')        # 紅褐色車頂（估）
ORANGE = C('#ff9500')
WHITE = C('#f4f2ea')
NAVY = C('#1d3b8f')
DOOR = C('#f2bd00')
DISC = C('#d23a30')
LAMP = C('#f2efe2')
ZLO, ZHI = 1.74, 2.62
PITCH = 16.0
DOORS = (-5.0, 0.0, 5.0)
BOGIE_X = 4.75


def spec():
    return dict(
        id='tm1000', W=2.55, body=PITCH - 0.7, pitch=PITCH, zb=0.95,
        profile=lambda lod: Profile(hw=1.275, zb=0.95, z_sh=3.05, z_c=3.465, inset=0.06, cham=0.06, z_belt=1.5,
                                    K=6 if lod == 0 else 3, pieces=2 if lod == 0 else 1),
        band=Band([(0.0, 1.05, YEL_LOW), (1.585, 1.635, ORANGE, 0.45), (1.635, 1.655, WHITE, 0.45), (1.655, 1.67, NAVY, 0.45)], YEL, g=0.45),
        roof_col=ROOF,
        kinds=lambda lod: {**win_kinds(ZLO, ZHI, frame=C('#2a2d30')),
                           'door': [(1.05, 1.585, DOOR, 0.45), (1.67, 2.90, DOOR, 0.45)], 'dgap': [(1.03, 2.92, GAP, 0.2)],
                           'dwin': [(1.80, 2.70, GLASS, 0.9)]},
        bellows=dict(w=1.0, z0=1.10, z1=2.90),
        bogie_x=BOGIE_X, wb=1.9,
        end_col=YEL,
    )


def door2(xc, w=1.3):
    x0 = xc - w / 2
    el = [(x0, x0 + 0.03, 'dgap'), (xc - 0.015, xc + 0.015, 'dgap'), (x0 + w - 0.03, x0 + w, 'dgap')]
    for lx in (x0 + 0.22, xc + 0.015 + 0.20):
        el.append((lx, lx + 0.22, ('dwin', 'door')))
    el.append((x0, x0 + w, 'door'))
    return el


def win(x0, w):
    return [(x0 - 0.035, x0, 'win_f'), (x0, x0 + w, 'win_g'), (x0 + w, x0 + w + 0.035, 'win_f')]


def side_elems(cab=False):
    """側牆元素（絕對 x，車體 ±7.65）。門 3 扇；門間兩窗、車端一窗。"""
    el = []
    for xc in DOORS:
        el += door2(xc)
    for x0, w in ((-3.95, 1.2), (-2.35, 1.2), (1.15, 1.2), (2.75, 1.2), (-7.3, 1.0)):
        el += win(x0, w)
    if not cab:
        el += win(6.3, 1.0)
    return el


def roof_fn(m, sp, lod):
    zc = 3.465
    for xc in (-3.6, 3.6):
        roof_unit(m, xc, 0, zc - 0.05, 2.6, 1.7, 0.12, C('#8c2b22'), top=C('#94302a'), bevel=0.10, vent=False)
    m.tag = 'bogie'
    for x in (-BOGIE_X, BOGIE_X):   # 第三軌集電靴
        for s in (-1, 1):
            box(m, (x + 0.35, s * 1.03, 0.30), (0.12, 0.38, 0.08), DARK)
            box(m, (x + 0.35, s * 1.18, 0.23), (0.30, 0.16, 0.05), DARK)


BELLY = [(-2.4, 1.8, 0.50, 0.95, 1.0), (0.0, 1.2, 0.55, 0.95, 0.95), (2.4, 1.8, 0.50, 0.95, 1.0)]


def build_mid_car(lod):
    sp = dict(spec(), belly_half=3.6)
    return build_mid(sp, lod, side_elems(), roof_fn=roof_fn, belly_items=BELLY, wb=sp['wb']), sp


def nose_curves():
    hw = [(0, 1.275), (0.5, 1.26), (0.8, 1.22), (1.0, 1.14)]
    top = [(0, 3.465), (0.5, 3.44), (0.8, 3.38), (1.0, 3.30)]
    bot = [(0, 0.95), (1.0, 0.94)]
    nexp = [(0, 2.8), (0.6, 3.6), (1, 4.4)]
    mw = [(0, 0.0), (0.4, 0.35), (1, 0.85)]
    return hw, top, bot, nexp, mw


def nose_colour(kind, u, xc, yc, zc):
    """車頭側面：車頂紅褐包到前緣、腰帶繞過轉角，其餘黃色。"""
    if kind == 'floor':
        return None
    if kind == 'roof' or zc > 3.05:
        return ROOF, 0.4
    if u < 0.5:
        return None
    if 1.585 <= zc < 1.67:
        return ORANGE, 0.45
    return YEL, 0.45


def decals(m, nose, x_tip, lod):
    h, lm = 0.10, 0.25
    # 上半部黑色玻璃區：面向車頭看左為貫通門窗、右為大擋風玻璃
    nose.decal_front(m, rrect(0.0, 2.40, 2.20, 1.42, 0.10, 3), C('#1c1f22'), 0.6, 0.018, h=h, lmax=lm)
    nose.decal_front(m, rrect(-0.55, 2.42, 0.62, 1.28, 0.06, 2), GLASS, 0.92, 0.028, h=h, lmax=lm)
    nose.decal_front(m, rrect(0.42, 2.42, 1.10, 1.28, 0.06, 2), GLASS, 0.92, 0.028, h=h, lmax=lm)
    # 腰帶
    for z0, z1, c in ((1.585, 1.635, ORANGE), (1.635, 1.655, WHITE), (1.655, 1.67, NAVY)):
        nose.decal_front(m, [(-1.13, z0), (1.13, z0), (1.13, z1), (-1.13, z1)], c, 0.45, 0.020, h=0.05, lmax=0.2)
    # 上緣兩盞圓形頭燈（紅褐底座）
    nose.decal_front(m, rrect(0.0, 3.17, 0.62, 0.24, 0.10, 3), C('#7e251d'), 0.5, 0.020, h=0.05, lmax=0.2)
    for y in (-0.15, 0.15):
        nose.decal_front(m, ellipse(y, 3.17, 0.09, 0.09, 12), LAMP, 0.9, 0.030, h=0.04)
    # 下方紅色圓形尾燈罩
    for s in (-1, 1):
        nose.decal_front(m, ellipse(s * 0.62, 1.20, 0.17, 0.17, 16), DISC, 0.6, 0.030, h=0.05)
    m.tag = 'nose'
    box(m, (x_tip - 0.05, 0, 0.90), (0.12, 2.20, 0.10), C('#7d8287'), 0.3)
    box(m, (x_tip - 0.25, 0, 0.66), (0.50, 0.36, 0.24), DARK, 0.3)


def build_cab(lod):
    sp = spec()
    from common import make_nose, nose_loft
    import parts as P
    x_tip = PITCH / 2
    x_rear = -PITCH / 2 + HALF_GAP
    Ln = 0.55
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
    P.bellows(m, x_rear, -1, half=HALF_GAP, lod=lod, **sp['bellows'])
    nose, nk = make_nose(prof, xn0, Ln, +1, nose_curves(), subdiv=2)
    nose_loft(m, nose, nk, sp['band'], sp['roof_col'], YEL, u_switch=0.5, n_st=10, col_fn=nose_colour,
              cap_bands=[(None, 3.05, YEL, 0.45), (3.05, None, ROOF, 0.4)])
    m.tag = 'decal'
    decals(m, nose, x_tip, lod)
    roof_fn(m, sp, lod)
    for x in (-BOGIE_X + 0.175, BOGIE_X - 0.3):
        bogie(m, x, wb=sp['wb'], lod=lod)
    belly(m, -3.6, 3.2, sp['zb'], sp['W'], lod=lod, items=BELLY)
    return m, sp


BUILDERS = {
    'tm1000': build_cab,
    'tm1000-mid': build_mid_car,
}
