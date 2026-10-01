"""JR 東日本 E231 系（0 番台通勤型：中央・總武各停、常磐快速、武藏野等）：駕駛車與中間車。

已查證（日文維基百科 E231 系條目）：車長 20,000 mm、寬 2,966 mm、空調上面高 4,051.5 mm、擴幅車體、輕量不鏽鋼、每側 4 門。
依照片估計（Commons：SeriesE231-0 Sobu-Line.jpg、JRE Series-E231-0 MU10.jpg）：
  車頭幾乎垂直、四周一圈不鏽鋼框；上半部整片黑（擋風玻璃與行先表示器），中間一道橫貫整個車頭的路線色帶，
  色帶下方一條黑色燈帶（左右各一頭燈），再下為不鏽鋼與白色大型排障器。側面只有窗下一道路線色帶。
  窗的位置與數量、冷氣罩、轉向架細節。
路線色部位用 BAND 色當換色鍵（同 E233，map3d.js 的 TINT_SOURCES）。
500 番台（白色 FRP 車頭）、800 番台（地下鐵直通、前面有門）、武藏野線的三色帶、八高線的雙色帶都簡化成這一款與單一路線色。
中間車不放集電弓。
"""
from common import *
from kit import prism_yz
from t_e233 import win, BELLY

SS = C('#c4c8cc')
SS_LOW = C('#a9aeb3')
SS_ROOF = C('#9fa4a9')
BAND = C('#f15a22')        # 換色鍵（與 E233 相同）
MASK = C('#141618')
DOOR = C('#bdc1c5')
LAMP = C('#f2efe2')
SKIRT = C('#dfe1e3')
ZLO, ZHI = 1.78, 2.73
PITCH = 20.0
DOORS = (-7.2, -2.4, 2.4, 7.2)


def spec():
    return dict(
        id='e231', W=2.95, body=PITCH - 0.7, pitch=PITCH, zb=1.0,
        profile=lambda lod: Profile(hw=1.475, zb=1.0, z_sh=3.20, z_c=3.62, inset=0.07, z_belt=2.0, flare=(0.13, 0.62),
                                    K=6 if lod == 0 else 3, pieces=2 if lod == 0 else 1),
        band=Band([(1.0, 1.10, SS_LOW), (1.45, 1.74, BAND, 0.5)], SS, g=0.45),
        roof_col=SS_ROOF,
        kinds=lambda lod: {**win_kinds(ZLO, ZHI, frame=C('#6f757b')),
                           'door': [(1.08, 1.45, DOOR, 0.45), (1.74, 2.92, DOOR, 0.45)], 'dgap': [(1.06, 2.94, GAP, 0.2)],
                           'dwin': [(1.86, 2.70, GLASS, 0.9)],
                           'cdoor': [(1.10, 1.45, SS, 0.45), (1.74, 2.80, SS, 0.45)], 'cwin': [(1.95, 2.60, GLASS, 0.9)]},
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


def side_elems(cab=False):
    el = []
    for xc in DOORS:
        el += door2(xc)
    for x0, w in ((-6.3, 1.55), (-4.55, 1.5), (-1.6, 1.45), (0.15, 1.45), (3.05, 1.5), (4.75, 1.55), (-9.3, 1.25)):
        el += win(x0, w)
    if not cab:
        el += win(8.05, 1.25)
    else:
        el += [(8.05, 8.65, ('cwin', 'cdoor')), (8.0, 8.05, 'dgap'), (8.65, 8.70, 'dgap')]
    return el


def roof_fn(m, sp, lod):
    zc = 3.62
    roof_unit(m, 0.0, 0, zc - 0.04, 3.2, 2.2, 4.0515 - zc + 0.04, C('#b3b7bb'), top=C('#bfc3c6'), bevel=0.24, vent=(lod == 0))
    m.tag = 'roof'
    for s in (-1, 1):
        box(m, (0, s * 1.05, zc - 0.10), (17.5, 0.12, 0.10), C('#8e9398'), 0.3)


def build_mid_car(lod):
    sp = spec()
    return build_mid(sp, lod, side_elems(), roof_fn=roof_fn, belly_items=BELLY, wb=sp['wb']), sp


def nose_curves():
    hw = [(0, 1.475), (0.45, 1.465), (0.75, 1.44), (0.92, 1.39), (1.0, 1.34)]
    top = [(0, 3.62), (0.5, 3.61), (0.85, 3.57), (1.0, 3.52)]
    bot = [(0, 1.0), (0.6, 0.98), (1.0, 0.95)]
    nexp = [(0, 2.6), (0.6, 3.6), (1, 4.6)]
    mw = [(0, 0.0), (0.4, 0.3), (1, 0.75)]

    def setback(u, z):   # 幾乎垂直，上緣略退
        return np.clip((np.asarray(z) - 1.6) / 1.9, 0, 1) * 0.14 * np.clip(np.asarray(u), 0, 1) ** 2
    return hw, top, bot, nexp, mw, setback


def nose_colour(kind, u, xc, yc, zc):
    """車頭側面前段：路線色帶繞過轉角（1.60～1.88），其餘不鏽鋼。"""
    if kind in ('roof', 'floor') or u < 0.55:
        return None
    if 1.60 <= zc < 1.88:
        return BAND, 0.5
    return SS, 0.45


def decals(m, nose, x_tip, lod):
    h, lm = 0.10, 0.25
    nose.decal_front(m, rrect(0.0, 2.69, 2.46, 1.58, 0.10, 3), MASK, 0.9, 0.020, h=h, lmax=lm)            # 上半部黑色面板
    nose.decal_front(m, rrect(0.0, 3.28, 1.50, 0.18, 0.03, 2), C('#2b2d30'), 0.7, 0.032, h=0.06, lmax=0.2)  # 行先表示器
    nose.decal_front(m, [(-1.33, 1.60), (1.33, 1.60), (1.33, 1.88), (-1.33, 1.88)], BAND, 0.5, 0.020, h=0.08, lmax=0.25)  # 路線色帶
    nose.decal_front(m, rrect(0.0, 1.44, 2.46, 0.24, 0.04, 2), MASK, 0.8, 0.020, h=0.08, lmax=0.25)        # 黑色燈帶
    for s in (-1, 1):
        nose.decal_front(m, rrect(s * 0.86, 1.44, 0.30, 0.16, 0.03, 2), LAMP, 0.9, 0.032, h=0.04, lmax=0.15)
    m.tag = 'nose'
    xs = x_tip - 0.30
    prism_yz(m, [(-1.25, 0.18), (1.25, 0.18), (1.20, 0.62), (-1.20, 0.62)], xs - 0.20, xs + 0.10, SKIRT, 0.5)   # 白色排障器
    box(m, (x_tip - 0.45, 0, 0.80), (0.5, 0.36, 0.24), DARK, 0.3)


def build_cab(lod):
    sp = spec()
    Ln = 0.85
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
    nose_loft(m, nose, nk, sp['band'], sp['roof_col'], SS, u_switch=0.55, n_st=12, col_fn=nose_colour)
    m.tag = 'decal'
    decals(m, nose, x_tip, lod)
    roof_fn(m, sp, lod)
    for x in (-6.9 + 0.175, 6.2):
        bogie(m, x, wb=sp['wb'], lod=lod)
    belly(m, -5.4, 4.6, sp['zb'], sp['W'], lod=lod, items=BELLY)
    return m, sp


BUILDERS = {
    'e231': build_cab,
    'e231-mid': build_mid_car,
}
