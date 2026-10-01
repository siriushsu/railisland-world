"""日本通勤電車的參數化產生器：一個車型＝一份設定（dict），產出駕駛車與中間車兩個網格。

用法：在 jp_*.py 寫 CARS = [cfg, ...]，cars.py 會自動註冊 BUILDERS[cfg['id']] 與 BUILDERS[cfg['id'] + '-mid']。
座標同 common.py：+X 車頭、+Y 車左、z=0 軌面、x=0 為連結器間距中心；1 單位＝1 公尺。

設定欄位（未給就用預設值）：
  id, name                 網格 id（全小寫、- 連接）與顯示名
  pitch=20.0               車長（連結器間距）
  W=2.95                   車寬；zb=1.0 車體下緣；roof=3.62 車頂高；shoulder=3.20 肩線高
  flare=None               擴幅車體下半部內傾 (dy, dz)，例如 (0.13, 0.62)；None 為直立側牆
  body='#c4c8cc'           車身色；low=None 車體下緣色（預設比車身暗）；roof_col='#9fa4a9' 車頂色
  bands=[]                 側面色帶 [(z0, z1, '#hex'), ...]，會延續到門上，除非 door_over_bands=True
  doors=None               門中心 x 清單；None 時依車長自動（20 m 4 門、18 m 以下 3 門）
  door_w=1.3               門寬；door_col=None 門色（預設同車身）；door_over_bands=False
  door_frame=None          門兩側直條色（如 E235）；door_top=None 門上方色塊
  win=(1.78, 2.73)         側窗上下緣；win_frame='#6f757b'
  ac=[(0, 3.2)]            車頂冷氣罩 [(中心 x, 長度), ...]；ac_top=None（預設 roof+0.35）；ac_col='#b3b7bb'
  third_rail=False         第三軌集電靴（無集電弓的路線）
  gangway=True             中間車兩端折棚
  front={...}              車頭：
      Ln=0.9               車頭長度（放樣段）
      tip_w=0.90           車頭尖端寬度比例（相對 W）
      tip_drop=0.10        車頭尖端車頂下降量
      setback=0.20         上半部後傾量（公尺，上緣比下緣退後）
      face='#e9eaea'       車頭基本色（cap 與 u>0.5 的側面）
      wrap=[]              車頭側面（u>0.5）依高度分色 [(z0, z1, '#hex'), ...]，其餘用 face
      cap=[]               車頭端面依高度分色 [(z0, z1, '#hex'), ...]（z0/z1 可為 None）
      decals=[]            依序貼上：('rect', cy, cz, w, h, r, '#hex'[, gloss])、('poly', [(y,z),...], '#hex'[, gloss])、
                           ('circle', cy, cz, r, '#hex'[, gloss])、('band', z0, z1, '#hex'[, gloss])（全寬橫帶）
      skirt=('#3a3d40', 0.18, 0.62)  排障器 (色, 下緣 z, 上緣 z)；None 不做
"""
import math
import numpy as np
from common import *
from kit import prism_yz
import parts as P

GLASS_GLOSS = 0.92


def H(c):
    if c == 'GLASS':
        return GLASS
    return C(c) if isinstance(c, str) else c


def _defaults(cfg):
    c = dict(pitch=20.0, W=2.95, zb=1.0, roof=3.62, shoulder=3.20, flare=None, body='#c4c8cc', low=None, roof_col='#9fa4a9',
             bands=[], doors=None, door_w=1.3, door_col=None, door_over_bands=False, door_frame=None, door_top=None,
             win=(1.78, 2.73), win_frame='#6f757b', ac=[(0.0, 3.2)], ac_top=None, ac_col='#b3b7bb', third_rail=False, gangway=True)
    c.update(cfg)
    f = dict(Ln=0.9, tip_w=0.90, tip_drop=0.10, setback=0.20, face='#e9eaea', wrap=[], cap=[], decals=[], skirt=('#3a3d40', 0.18, 0.62))
    f.update(cfg.get('front', {}))
    c['front'] = f
    if c['doors'] is None:
        L = c['pitch']
        if L >= 19.5:
            c['doors'] = (-7.2, -2.4, 2.4, 7.2)
        elif L >= 17.5:
            c['doors'] = (-6.1, 0.0, 6.1) if c.get('n_doors', 3) == 3 else (-6.6, -2.2, 2.2, 6.6)
        else:
            c['doors'] = (-5.0, 0.0, 5.0)
    if c['ac_top'] is None:
        c['ac_top'] = c['roof'] + 0.35
    return c


def _spec(c):
    hw = c['W'] / 2
    body, low = H(c['body']), H(c['low']) if c['low'] else shade(H(c['body']), 0.86)
    zlo, zhi = c['win']
    door_col = H(c['door_col']) if c['door_col'] else body
    bands = [(z0, z1, H(col), 0.5) for z0, z1, col in c['bands']]
    # 門板：避開色帶（色帶延續到門上），或整片蓋過
    dz = [(c['zb'] + 0.08, c['shoulder'] - 0.28)]
    if not c['door_over_bands']:
        for z0, z1, _, _ in sorted(bands):
            nxt = []
            for a, b in dz:
                if z1 <= a or z0 >= b:
                    nxt.append((a, b))
                    continue
                if z0 > a:
                    nxt.append((a, z0))
                if z1 < b:
                    nxt.append((z1, b))
            dz = nxt
    door_top_z = c['shoulder'] - 0.28
    kinds = {**win_kinds(zlo, zhi, frame=H(c['win_frame'])),
             'door': [(a, b, door_col, 0.45) for a, b in dz], 'dgap': [(c['zb'] + 0.06, door_top_z + 0.02, GAP, 0.2)],
             'dwin': [(zlo + 0.08, zhi - 0.02, GLASS, 0.9)],
             'cdoor': [(a, b, body, 0.45) for a, b in dz], 'cwin': [(zlo + 0.15, zhi - 0.12, GLASS, 0.9)]}
    if c['door_frame']:
        kinds['dpost'] = [(c['zb'] + 0.06, door_top_z + 0.02, H(c['door_frame']), 0.5)]
    if c['door_top']:
        kinds['dtop'] = [(door_top_z + 0.06, door_top_z + 0.26, H(c['door_top']), 0.5)]
    flare = c['flare']
    z_belt = max(c['zb'] + (flare[1] if flare else 0.5) + 0.3, 1.9)
    return dict(
        id=c['id'], W=c['W'], body=c['pitch'] - 0.7, pitch=c['pitch'], zb=c['zb'],
        profile=lambda lod: Profile(hw=hw, zb=c['zb'], z_sh=c['shoulder'], z_c=c['roof'], inset=0.07, cham=0.08, z_belt=z_belt, flare=flare,
                                    K=6 if lod == 0 else 3, pieces=2 if lod == 0 else 1),
        band=Band([(c['zb'], c['zb'] + 0.10, low)] + bands, body, g=0.45),
        roof_col=H(c['roof_col']), kinds=lambda lod: kinds,
        bellows=dict(w=1.2, z0=c['zb'] + 0.15, z1=c['shoulder'] - 0.15),
        bogie_x=c['pitch'] * 0.345, wb=2.1 if c['pitch'] >= 17.5 else 1.9, end_col=body,
    )


def _side(c, cab):
    hx = c['pitch'] / 2 - HALF_GAP
    w = c['door_w']
    el = []
    doors = sorted(c['doors'])
    for xc in doors:
        x0 = xc - w / 2
        top = ('dtop',) if c['door_top'] else ()
        el += [(x0, x0 + 0.03, ('dgap',) + top), (xc - 0.015, xc + 0.015, ('dgap',) + top), (x0 + w - 0.03, x0 + w, ('dgap',) + top)]
        for lx in (x0 + 0.19, xc + 0.015 + 0.17):
            el.append((lx, lx + 0.26, ('dwin', 'door') + top))
        el.append((x0, x0 + w, ('door',) + top))
        if c['door_frame']:
            el += [(x0 - 0.12, x0, 'dpost'), (x0 + w, x0 + w + 0.12, 'dpost')]
    gap = 0.18 if c['door_frame'] else 0.12

    def windows(a, b):
        span = b - a
        if span < 0.6:
            return []
        n = 1 if span < 2.6 else 2
        pw = (span - (n + 1) * 0.15) / n
        return [(a + 0.15 + i * (pw + 0.15), pw) for i in range(n)]
    edges = [-hx + 0.25] + [x for d in doors for x in (d - w / 2 - gap, d + w / 2 + gap)] + [hx - 0.25]
    spans = [(edges[i], edges[i + 1]) for i in range(0, len(edges), 2)]
    cab_end = hx - 1.55 if cab else None
    for k, (a, b) in enumerate(spans):
        if cab and k == len(spans) - 1:
            # 駕駛車車頭側：乘務員門＋窄窗
            el += [(cab_end, cab_end + 0.6, ('cwin', 'cdoor')), (cab_end - 0.05, cab_end, 'dgap'), (cab_end + 0.6, cab_end + 0.65, 'dgap')]
            b = min(b, cab_end - 0.25)
        for x0, pw in windows(a, b):
            el += [(x0 - 0.035, x0, 'win_f'), (x0, x0 + pw, 'win_g'), (x0 + pw, x0 + pw + 0.035, 'win_f')]
    return el


def _roof(c):
    def fn(m, sp, lod):
        zc = c['roof']
        for xc, L in c['ac']:
            roof_unit(m, xc, 0, zc - 0.04, L, min(2.2, c['W'] - 0.7), c['ac_top'] - zc + 0.04, H(c['ac_col']),
                      top=shade(H(c['ac_col']), 1.06), bevel=0.2, vent=(lod == 0))
        if c['third_rail']:
            m.tag = 'bogie'
            bx = sp['bogie_x']
            reach = c['W'] / 2 - 0.12
            for x in (-bx, bx):
                for s in (-1, 1):
                    box(m, (x + 0.35, s * (0.86 + reach) / 2, 0.30), (0.12, reach - 0.86 + 0.04, 0.08), DARK)
                    box(m, (x + 0.35, s * reach, 0.23), (0.30, 0.16, 0.05), DARK)
    return fn


BELLY = [(-3.8, 2.2, 0.55, 1.0, 1.15), (-0.9, 1.8, 0.55, 1.0, 1.10), (2.2, 2.6, 0.52, 1.0, 1.18)]


def _belly(c):
    s = c['pitch'] / 20.0
    return [(x * s, l * s, zl, c['zb'], hw * c['W'] / 2.95) for x, l, zl, _, hw in BELLY]


def _nose_curves(c):
    f, hw, top, zb = c['front'], c['W'] / 2, c['roof'], c['zb']
    tip = f['tip_w']
    hwc = [(0, hw), (0.45, hw * (1 - (1 - tip) * 0.1)), (0.75, hw * (1 - (1 - tip) * 0.35)), (0.92, hw * (1 - (1 - tip) * 0.7)), (1.0, hw * tip)]
    d = f['tip_drop']
    topc = [(0, top), (0.5, top - d * 0.1), (0.85, top - d * 0.5), (1.0, top - d)]
    botc = [(0, zb), (0.6, zb - 0.02), (1.0, zb - 0.05)]
    nexp = [(0, 2.6), (0.6, 3.6), (1, 4.6)]
    mw = [(0, 0.0), (0.4, 0.3), (1, 0.75)]
    sb = f['setback']

    def setback(u, z):
        return np.clip((np.asarray(z) - 1.6) / max(0.5, top - 1.6), 0, 1) * sb * np.clip(np.asarray(u), 0, 1) ** 2
    return hwc, topc, botc, nexp, mw, setback


def _nose_colour(c):
    f = c['front']
    face = H(f['face'])
    wrap = [(z0, z1, H(col)) for z0, z1, col in f['wrap']]

    def fn(kind, u, xc, yc, zc):
        if kind in ('roof', 'floor') or u < 0.5:
            return None
        for z0, z1, col in wrap:
            if z0 <= zc < z1:
                return col, 0.5
        return face, 0.45
    return fn


def _decals(c):
    f = c['front']

    def fn(m, nose, x_tip, lod):
        off = 0.018
        for d in f['decals']:
            kind = d[0]
            if kind == 'rect':
                _, cy, cz, w, h, r, col, *g = d
                poly = rrect(cy, cz, w, h, r, 3 if r > 0.05 else 2)
            elif kind == 'poly':
                _, poly, col, *g = d
            elif kind == 'circle':
                _, cy, cz, r, col, *g = d
                poly = ellipse(cy, cz, r, r, 14)
            elif kind == 'band':
                _, z0, z1, col, *g = d
                yw = c['W'] / 2 * f['tip_w'] - 0.02
                poly = [(-yw, z0), (yw, z0), (yw, z1), (-yw, z1)]
            else:
                raise ValueError(kind)
            gloss = g[0] if g else (GLASS_GLOSS if H(col) == GLASS else 0.5)
            hh = 0.06 if kind == 'circle' else 0.10
            nose.decal_front(m, poly, H(col), gloss, off, h=hh, lmax=0.25)
            off += 0.006
        m.tag = 'nose'
        if f['skirt']:
            col, z0, z1 = f['skirt']
            hw = c['W'] / 2 * f['tip_w'] - 0.04
            xs = x_tip - 0.32
            prism_yz(m, [(-hw, z0), (hw, z0), (hw - 0.04, z1), (-hw + 0.04, z1)], xs - 0.22, xs + 0.10, H(col), 0.4)
        box(m, (x_tip - 0.45, 0, 0.80), (0.5, 0.36, 0.24), DARK, 0.3)
    return fn


def _cap_bands(c):
    """端面分色：設定只涵蓋部分高度時，其餘高度補上車頭底色（否則 kit.Nose.cap 只封有列出的區段，會留下破洞）。"""
    bands = c['front']['cap']
    if not bands:
        return None
    face = H(c['front']['face'])
    lo, hi = -1e9, 1e9
    spans = sorted(((lo if z0 is None else z0), (hi if z1 is None else z1), H(col)) for z0, z1, col in bands)
    out, cur = [], lo
    for z0, z1, col in spans:
        if z0 > cur:
            out.append((None if cur == lo else cur, z0, face, 0.45))
        out.append((None if z0 == lo else z0, None if z1 == hi else z1, col, 0.45))
        cur = max(cur, z1)
    if cur < hi:
        out.append((cur, None, face, 0.45))
    return out


def build_cab_car(cfg, lod):
    c = _defaults(cfg)
    sp = _spec(c)
    pitch, Ln = c['pitch'], c['front']['Ln']
    x_tip = pitch / 2
    x_rear = -pitch / 2 + HALF_GAP
    xn0 = x_tip - Ln
    m = Mesh()
    prof = sp['profile'](lod)
    layout = P.Layout(sp['band'], sp['kinds'](lod), P.resolve(_side(c, True)))
    P.wall_panels(m, prof, 'L', x_rear, xn0, layout)
    P.wall_panels(m, prof, 'R', x_rear, xn0, layout)
    P.roof_loft(m, prof, x_rear, xn0, sp['roof_col'])
    P.floor_plate(m, prof, x_rear, xn0, UNDER)
    ring, _ = prof.ring()
    P.end_cap(m, ring, x_rear, -1, sp['end_col'])
    if c['gangway']:
        P.bellows(m, x_rear, -1, half=HALF_GAP, lod=lod, **sp['bellows'])
    nose, nk = make_nose(prof, xn0, Ln, +1, _nose_curves(c), subdiv=2)
    cap = _cap_bands(c)
    nose_loft(m, nose, nk, sp['band'], sp['roof_col'], H(c['front']['face']), u_switch=0.5, n_st=12, col_fn=_nose_colour(c), cap_bands=cap)
    m.tag = 'decal'
    _decals(c)(m, nose, x_tip, lod)
    _roof(c)(m, sp, lod)
    bx = sp['bogie_x']
    for x in (-bx + 0.175, bx - 0.7):
        bogie(m, x, wb=sp['wb'], lod=lod)
    s = pitch / 20.0
    belly(m, -5.4 * s, 4.6 * s, sp['zb'], sp['W'], lod=lod, items=_belly(c))
    return m, sp


def build_mid_car(cfg, lod):
    c = _defaults(cfg)
    sp = dict(_spec(c), belly_half=5.3 * c['pitch'] / 20.0)
    m = build_mid(sp, lod, _side(c, False), roof_fn=_roof(c), belly_items=_belly(c), wb=sp['wb'],
                  lo_bellows=c['gangway'], hi_bellows=c['gangway'])
    return m, sp


def register(cars):
    out = {}
    for cfg in cars:
        out[cfg['id']] = (lambda cfg: lambda lod: build_cab_car(cfg, lod))(cfg)
        out[cfg['id'] + '-mid'] = (lambda cfg: lambda lod: build_mid_car(cfg, lod))(cfg)
    return out
