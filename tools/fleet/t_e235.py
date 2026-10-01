"""JR 東日本 E235 系（0 番台：山手線）：駕駛車（クハ）與中間車（サハ）。

已查證（日文維基百科 E235 系條目）：車長 20,000 mm、寬 2,950 mm、高 3,620 mm（集電弓降下 3,950）、
擴幅車體、不鏽鋼（sustina）、每側 4 門。
依照片估計（Commons：Yamanote-Line-E235.jpg、Series-E235-0 9.jpg，MaedaAkihiko，CC BY-SA 4.0）：
  車頭整面路線色（黃綠）外框，上半部圓角黑色面板（擋風玻璃與行先表示器），面板下緣以點狀漸層轉回路線色，
  最下為深灰色大型排障器；頭燈在黑色面板上緣兩角。側面為灰色不鏽鋼、沒有水平色帶，
  路線色在每扇門兩側的直條與門上方的方塊。窗的位置與數量、車頂冷氣罩、轉向架細節。
路線色部位用 KEY 色（山手線黃綠）當換色鍵（map3d.js 的 TINT_SOURCES）。
點狀漸層簡化成三道深淺不同的綠色，不跟著換色；目前只用在山手線。
中間車不放集電弓：同一份中間車網格會重複用在每一節中間車。
"""
from common import *
from kit import prism_yz

SS = C('#a9adb1')          # sustina 不鏽鋼（照片偏灰，估）
SS_LOW = C('#8f9397')
SS_ROOF = C('#9a9ea2')
KEY = C('#80c241')         # 山手線黃綠（換色鍵）
MASK = C('#141618')
DOOR = C('#b3b7bb')
LAMP = C('#f2efe2')
SKIRT = C('#3a3d40')
ZLO, ZHI = 1.80, 2.74
PITCH = 20.0
DOORS = (-7.2, -2.4, 2.4, 7.2)
DOOR_W = 1.3


def spec():
    return dict(
        id='e235', W=2.95, body=PITCH - 0.7, pitch=PITCH, zb=1.0,
        profile=lambda lod: Profile(hw=1.475, zb=1.0, z_sh=3.12, z_c=3.42, inset=0.07, z_belt=2.0, flare=(0.13, 0.62),
                                    K=6 if lod == 0 else 3, pieces=2 if lod == 0 else 1),
        band=Band([(1.0, 1.10, SS_LOW)], SS, g=0.45),
        roof_col=SS_ROOF,
        kinds=lambda lod: {**win_kinds(ZLO, ZHI, frame=C('#6f757b')),
                           'door': [(1.08, 2.90, DOOR, 0.45)], 'dgap': [(1.06, 2.92, GAP, 0.2)],
                           'dwin': [(1.86, 2.72, GLASS, 0.9)],
                           # 門兩側的路線色直條、門上方的路線色方塊
                           'dpost': [(1.06, 2.92, KEY, 0.5)], 'dtop': [(2.96, 3.14, KEY, 0.5)],
                           'cdoor': [(1.10, 2.84, SS, 0.45)], 'cwin': [(1.95, 2.60, GLASS, 0.9)]},
        bellows=dict(w=1.2, z0=1.15, z1=3.0),
        bogie_x=6.9, wb=2.1,
        end_col=SS,
    )


def door2(xc, w=DOOR_W):
    x0 = xc - w / 2
    el = [(x0 - 0.13, x0, 'dpost'), (x0 + w, x0 + w + 0.13, 'dpost'), (x0, x0 + w, 'dtop'),
          (x0, x0 + 0.03, ('dgap', 'dtop')), (xc - 0.015, xc + 0.015, ('dgap', 'dtop')), (x0 + w - 0.03, x0 + w, ('dgap', 'dtop'))]
    for lx in (x0 + 0.20, xc + 0.015 + 0.17):
        el.append((lx, lx + 0.26, ('dwin', 'door', 'dtop')))
    el.append((x0, x0 + w, ('door', 'dtop')))
    return el


def win(x0, w):
    return [(x0 - 0.035, x0, 'win_f'), (x0, x0 + w, 'win_g'), (x0 + w, x0 + w + 0.035, 'win_f')]


def side_elems(cab=False):
    el = []
    for xc in DOORS:
        el += door2(xc)
    for x0, w in ((-6.2, 1.5), (-4.5, 1.5), (-1.55, 1.4), (0.15, 1.4), (3.0, 1.5), (4.7, 1.5), (-9.3, 1.2)):
        el += win(x0, w)
    if not cab:
        el += win(8.1, 1.2)
    else:   # 乘務員門
        el += [(8.15, 8.75, ('cwin', 'cdoor')), (8.10, 8.15, 'dgap'), (8.75, 8.80, 'dgap')]
    return el


def roof_fn(m, sp, lod):
    zc = 3.42
    for xc in (-4.6, 4.6):   # 低矮冷氣罩（全高 3,620）
        roof_unit(m, xc, 0, zc - 0.04, 3.0, 2.0, 3.62 - zc + 0.04, C('#b5b9bd'), top=C('#c0c4c7'), bevel=0.18, vent=(lod == 0))


BELLY = [(-3.8, 2.2, 0.55, 1.0, 1.15), (-0.9, 1.8, 0.55, 1.0, 1.10), (2.2, 2.6, 0.52, 1.0, 1.18)]


def build_mid_car(lod):
    sp = spec()
    return build_mid(sp, lod, side_elems(), roof_fn=roof_fn, belly_items=BELLY, wb=sp['wb']), sp


def nose_curves():
    hw = [(0, 1.475), (0.45, 1.465), (0.75, 1.43), (0.92, 1.36), (1.0, 1.28)]
    top = [(0, 3.42), (0.5, 3.42), (0.85, 3.40), (1.0, 3.36)]
    bot = [(0, 1.0), (0.6, 0.98), (1.0, 0.95)]
    nexp = [(0, 2.6), (0.6, 3.4), (1, 4.2)]
    mw = [(0, 0.0), (0.4, 0.35), (1, 0.85)]

    def setback(u, z):   # 前面上緣略為後傾
        return np.clip((np.asarray(z) - 1.6) / 1.8, 0, 1) * 0.12 * np.clip(np.asarray(u), 0, 1) ** 2
    return hw, top, bot, nexp, mw, setback


def nose_colour(kind, u, xc, yc, zc):
    """車頭前段（u>0.5）整圈路線色外框；車頂維持不鏽鋼。"""
    if kind in ('roof', 'floor') or u < 0.5:
        return None
    return KEY, 0.5


def decals(m, nose, x_tip, lod):
    h, lm = 0.10, 0.25
    nose.decal_front(m, rrect(0.0, 2.57, 2.34, 1.46, 0.20, 4), MASK, 0.9, 0.020, h=h, lmax=lm)
    nose.decal_front(m, rrect(0.0, 3.14, 1.30, 0.17, 0.03, 2), C('#2b2d30'), 0.7, 0.032, h=0.06, lmax=0.2)   # 行先表示器
    for s in (-1, 1):
        nose.decal_front(m, ellipse(s * 0.98, 3.15, 0.07, 0.06, 10), LAMP, 0.9, 0.032, h=0.04)               # 頭燈
    # 點狀漸層：黑色面板下緣往下三道由深到淺的綠
    for z0, z1, c in ((1.80, 1.88, C('#1e3a14')), (1.68, 1.80, C('#3b6a20')), (1.54, 1.68, C('#5e9a2f'))):
        nose.decal_front(m, [(-1.17, z0), (1.17, z0), (1.17, z1), (-1.17, z1)], c, 0.5, 0.020, h=0.08, lmax=0.25)
    m.tag = 'nose'
    # 深灰色排障器與連結器
    xs = x_tip - 0.40
    prism_yz(m, [(-1.28, 0.16), (1.28, 0.16), (1.24, 0.64), (-1.24, 0.64)], xs - 0.25, xs + 0.08, SKIRT, 0.3)
    box(m, (x_tip - 0.45, 0, 0.80), (0.45, 0.36, 0.26), DARK, 0.3)


def build_cab(lod):
    sp = spec()
    Ln = 0.95
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
    nose_loft(m, nose, nk, sp['band'], sp['roof_col'], KEY, u_switch=0.5, n_st=12, col_fn=nose_colour)
    m.tag = 'decal'
    decals(m, nose, x_tip, lod)
    roof_fn(m, sp, lod)
    for x in (-6.9 + 0.175, 6.2):
        bogie(m, x, wb=sp['wb'], lod=lod)
    belly(m, -5.4, 4.6, sp['zb'], sp['W'], lod=lod, items=BELLY)
    return m, sp


BUILDERS = {
    'e235': build_cab,
    'e235-mid': build_mid_car,
}
