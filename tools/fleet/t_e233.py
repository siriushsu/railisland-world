"""JR 東日本 E233 系（0 番台：中央線快速／青梅・五日市線）：駕駛車（クハ）與中間車（サハ）。

已查證（日文維基百科 E233 系條目）：車長 20,000 mm、寬 2,950 mm（雨樋間 2,966）、空調上面高 4,016.5 mm、
擴幅車體（下半部內傾）、輕量不鏽鋼、每側 4 門、單臂集電弓與車頂冷氣。
依照片估計（Commons：JRE Series-E233-T4 12cars.jpg，MaedaAkihiko，CC0）：
  車頭稍微後傾，上半部整片黑色（擋風玻璃與行先表示器），下半部白色、左右角有路線色塊，再下為不鏽鋼與大型排障器；
  頭燈在黑色面板上緣兩角；側面窗下（腰帶）與窗上各一道路線色帶；門間兩窗、車端一窗；冷氣在車頂中央。
路線色帶用 BAND 色當換色鍵（map3d.js 的 TINT_SOURCES），同一份網格依路線換成京濱東北、京葉、橫濱、埼京、南武等色；
湘南色（橘綠雙色）與 2000 番台（窄車體、前面有貫通門）不在這份網格的範圍。
中間車不放集電弓：同一份中間車網格會重複用在每一節中間車。
"""
from common import *
from kit import prism_yz

SS = C('#c4c8cc')          # 不鏽鋼（估）
SS_LOW = C('#a9aeb3')
SS_ROOF = C('#9fa4a9')
BAND = C('#f15a22')        # 中央線橘（換色鍵，見 map3d.js）
FACE = C('#e9eaea')        # 車頭下半部白色 FRP（估）
MASK = C('#141618')        # 車頭上半部黑色面板
DOOR = C('#bdc1c5')
LAMP = C('#f2efe2')
ZLO, ZHI = 1.78, 2.73
PITCH = 20.0
DOORS = (-7.2, -2.4, 2.4, 7.2)


def spec():
    return dict(
        id='e233', W=2.95, body=PITCH - 0.7, pitch=PITCH, zb=1.0,
        profile=lambda lod: Profile(hw=1.475, zb=1.0, z_sh=3.20, z_c=3.62, inset=0.07, z_belt=2.0, flare=(0.13, 0.62),
                                    K=6 if lod == 0 else 3, pieces=2 if lod == 0 else 1),
        band=Band([(1.0, 1.10, SS_LOW), (1.47, 1.75, BAND, 0.5), (2.86, 3.04, BAND, 0.5)], SS, g=0.45),
        roof_col=SS_ROOF,
        kinds=lambda lod: {**win_kinds(ZLO, ZHI, frame=C('#6f757b')),
                           # 門板不蓋過腰帶：腰帶顏色延續到門上
                           'door': [(1.08, 1.47, DOOR, 0.45), (1.75, 2.84, DOOR, 0.45)], 'dgap': [(1.06, 2.86, GAP, 0.2)],
                           'dwin': [(1.86, 2.70, GLASS, 0.9)],
                           'cdoor': [(1.10, 1.47, SS, 0.45), (1.75, 2.80, SS, 0.45)], 'cwin': [(1.95, 2.60, GLASS, 0.9)]},
        bellows=dict(w=1.2, z0=1.15, z1=3.05),
        bogie_x=6.9, wb=2.1,
        end_col=SS,
    )


def door2(xc, w=1.3):
    x0 = xc - w / 2
    el = [(x0, x0 + 0.03, 'dgap'), (xc - 0.015, xc + 0.015, 'dgap'), (x0 + w - 0.03, x0 + w, 'dgap')]
    for lx in (x0 + 0.20, xc + 0.015 + 0.17):
        el.append((lx, lx + 0.26, ('dwin', 'door')))
    el.append((x0, x0 + w, 'door'))
    return el


def win(x0, w):
    return [(x0 - 0.035, x0, 'win_f'), (x0, x0 + w, 'win_g'), (x0 + w, x0 + w + 0.035, 'win_f')]


def side_elems(cab=False):
    el = []
    for xc in DOORS:
        el += door2(xc)
    for x0, w in ((-6.3, 1.55), (-4.55, 1.5), (-1.6, 1.45), (0.15, 1.45), (3.05, 1.5), (4.75, 1.55), (-9.3, 1.25)):
        el += win(x0, w)
    if not cab:
        el += win(8.05, 1.25)
    else:   # 乘務員門（車頭後方）
        el += [(8.05, 8.65, ('cwin', 'cdoor')), (8.0, 8.05, 'dgap'), (8.65, 8.70, 'dgap')]
    return el


def roof_fn(m, sp, lod):
    zc = 3.62
    roof_unit(m, 0.0, 0, zc - 0.04, 3.4, 2.2, 4.0165 - zc + 0.04, C('#b3b7bb'), top=C('#bfc3c6'), bevel=0.22, vent=(lod == 0))
    m.tag = 'roof'
    for s in (-1, 1):   # 車頂兩側的配管蓋
        box(m, (0, s * 1.05, zc - 0.10), (17.5, 0.12, 0.10), C('#8e9398'), 0.3)


BELLY = [(-3.8, 2.2, 0.55, 1.0, 1.15), (-0.9, 1.8, 0.55, 1.0, 1.10), (2.2, 2.6, 0.52, 1.0, 1.18)]


def build_mid_car(lod):
    sp = spec()
    return build_mid(sp, lod, side_elems(), roof_fn=roof_fn, belly_items=BELLY, wb=sp['wb']), sp


def nose_curves():
    hw = [(0, 1.475), (0.45, 1.465), (0.75, 1.43), (0.92, 1.37), (1.0, 1.31)]
    top = [(0, 3.62), (0.5, 3.61), (0.85, 3.57), (1.0, 3.52)]
    bot = [(0, 1.0), (0.6, 0.98), (1.0, 0.93)]
    nexp = [(0, 2.6), (0.6, 3.6), (1, 4.6)]
    mw = [(0, 0.0), (0.4, 0.3), (1, 0.75)]

    def setback(u, z):   # 上半部後傾：前面上緣比下緣退後約 0.3 m
        return np.clip((np.asarray(z) - 1.6) / 1.9, 0, 1) * 0.30 * np.clip(np.asarray(u), 0, 1) ** 2
    return hw, top, bot, nexp, mw, setback


def nose_colour(kind, u, xc, yc, zc):
    """車頭側面：前段（u>0.55）上白、中間路線色、下不鏽鋼；黑色面板由前視貼花覆蓋。"""
    if kind in ('roof', 'floor') or u < 0.55:
        return None
    if zc < 1.44:
        return SS, 0.45
    if zc < 1.83:
        return BAND, 0.5
    return FACE, 0.4


def decals(m, nose, x_tip, lod):
    h, lm = 0.10, 0.25
    nose.decal_front(m, rrect(0.0, 2.68, 2.42, 1.66, 0.18, 4), MASK, 0.9, 0.020, h=h, lmax=lm)
    nose.decal_front(m, rrect(0.0, 3.30, 1.30, 0.20, 0.03, 2), C('#2b2d30'), 0.7, 0.032, h=0.06, lmax=0.2)   # 行先表示器
    for s in (-1, 1):
        nose.decal_front(m, ellipse(s * 1.0, 3.38, 0.07, 0.06, 10), LAMP, 0.9, 0.032, h=0.04)               # 頭燈
        nose.decal_front(m, [(s * 1.02, 1.44), (s * 1.29, 1.44), (s * 1.29, 1.83), (s * 1.02, 1.83)], BAND, 0.5, 0.020, h=0.06, lmax=0.2)
    m.tag = 'nose'
    # 排障器（銀色）與連結器
    xs = x_tip - 0.30
    prism_yz(m, [(-1.25, 0.12), (1.25, 0.12), (1.20, 0.62), (-1.20, 0.62)], xs - 0.20, xs + 0.12, C('#c9ccd0'), 0.5)
    box(m, (x_tip - 0.45, 0, 0.80), (0.5, 0.36, 0.24), DARK, 0.3)


def build_cab(lod):
    sp = spec()
    Ln = 1.05
    from common import make_nose, nose_loft
    import parts as P
    x_tip = PITCH / 2
    x_rear = -PITCH / 2 + HALF_GAP
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
    nose_loft(m, nose, nk, sp['band'], sp['roof_col'], FACE, u_switch=0.55, n_st=12, col_fn=nose_colour,
              cap_bands=[(None, 1.44, SS, 0.45), (1.44, None, FACE, 0.4)])
    m.tag = 'decal'
    decals(m, nose, x_tip, lod)
    roof_fn(m, sp, lod)
    for x in (-6.9 + 0.175, 6.2):
        bogie(m, x, wb=sp['wb'], lod=lod)
    belly(m, -5.4, 4.6, sp['zb'], sp['W'], lod=lod, items=BELLY)
    return m, sp


BUILDERS = {
    'e233': build_cab,
    'e233-mid': build_mid_car,
}
