"""東京的特殊車輛：都電荒川線（單節、兩端駕駛室）、日暮里・舍人線與百合海鷗號（膠輪新交通系統）、
東京單軌與多摩單軌（跨座式單軌）、東急世田谷線（兩節連接車）。

車體沿用 jp.py 的參數化產生器，再依車種改造：
  路面電車  只建前半車（x≥0），整體繞 z 軸轉 180° 複製成後半，得到兩端都是駕駛室的單節車；車頂加單臂集電弓。
  新交通系統 拿掉鋼輪轉向架與車下設備，換成膠輪與導軌輪。
  跨座式單軌 拿掉車下所有東西，換成包住軌道梁的車體裙部與中央深色梁槽。
尺寸取自日文維基百科各車型條目；外觀依 Commons 照片估計（出處寫在各設定的 source）。
"""
import numpy as np
from array import array
from common import *
from kit import Mesh, box
import jp
import parts as P


def _arr(m):
    return np.frombuffer(m.d, dtype=np.float32).reshape(-1, 3, 10)


def _from(a):
    out = Mesh()
    out.d = array('f', a.astype(np.float32).reshape(-1).tolist())
    return out


def strip_under(m, zcut):
    """拿掉整個三角形都在 zcut 以下的部分（轉向架、車下設備、排障器）。"""
    a = _arr(m)
    keep = a[:, :, 2].max(axis=1) >= zcut
    return _from(a[keep])


def merge(*ms):
    out = Mesh()
    for m in ms:
        out.d.extend(m.d)
    return out


def rotate180(m):
    a = _arr(m).copy()
    a[:, :, 0] *= -1; a[:, :, 1] *= -1; a[:, :, 3] *= -1; a[:, :, 4] *= -1
    return _from(a)


def clip_front_half(m):
    """以 x=0 平面裁切，只留 x≥0 的部分；跨過平面的三角形切開並內插所有頂點屬性，轉 180° 複製後才不會重疊或缺角。"""
    a = _arr(m)
    keep = []
    for t in a:
        xs = t[:, 0]
        if (xs >= 0).all():
            keep.append(t)
            continue
        if (xs <= 0).all():
            continue
        poly = []
        for i in range(3):
            p, q = t[i], t[(i + 1) % 3]
            if p[0] >= 0:
                poly.append(p)
            if (p[0] >= 0) != (q[0] >= 0):
                k = p[0] / (p[0] - q[0])
                v = p + (q - p) * k
                v[0] = 0.0
                n = v[3:6]
                v[3:6] = n / max(np.linalg.norm(n), 1e-9)
                poly.append(v)
        for i in range(1, len(poly) - 1):
            keep.append(np.stack([poly[0], poly[i], poly[i + 1]]))
    return _from(np.array(keep, dtype=np.float32))


# ---------------------------------------------------------------- 改造
def rubber_tyres(cfg, m):
    """新交通系統：每個轉向架位置一對膠輪＋左右導軌輪。"""
    c = jp._defaults(cfg)
    bx = c['pitch'] * 0.30
    out = Mesh()
    for x in (-bx, bx):
        for s in (-1, 1):
            cyl(out, (x, s * 0.62, 0.42), 'y', 0.42, 0.30, C('#26292c'), seg=12, g=0.2)
            cyl(out, (x, s * (c['W'] / 2 + 0.05), 0.30), 'z', 0.16, 0.12, C('#3a3e42'), seg=8, g=0.2)
        box(out, (x, 0, 0.62), (1.2, 1.8, 0.24), C('#42474c'), 0.3)
    return merge(m, out)


def monorail_skirt(cfg, m, nose=False):
    """跨座式單軌：車體裙部往下包住軌道梁，中央留梁槽。"""
    c = jp._defaults(cfg)
    L = c['pitch'] - 0.7
    zb = c['zb']
    body = C(c['skirt_col']) if c.get('skirt_col') else C(c['body'])
    out = Mesh()
    x0 = -L / 2
    x1 = L / 2 - (c['front']['Ln'] if nose else 0)
    xc, ln = (x0 + x1) / 2, x1 - x0
    hw = c['W'] / 2 - 0.06
    for s in (-1, 1):
        box(out, (xc, s * (hw - 0.45), zb - 0.55), (ln, 0.9, 1.1), body, 0.4)
    box(out, (xc, 0, zb - 0.70), (ln, 0.9, 1.4), C('#2b2f33'), 0.2)   # 梁槽（深色）
    return merge(m, out)


def tram_double(cfg):
    """單節路面電車：前半車＋轉 180° 的複本，車頂中央加單臂集電弓與冷氣罩。"""
    half_cfg = dict(cfg, ac=[], gangway=False)
    m, sp = jp.build_cab_car(half_cfg, 0)
    front = clip_front_half(m)
    car = merge(front, rotate180(front))
    c = jp._defaults(cfg)
    extra = Mesh()
    for xc, L in c['ac']:
        roof_unit(extra, xc, 0, c['roof'] - 0.04, L, min(1.8, c['W'] - 0.5), c['ac_top'] - c['roof'] + 0.04, C(c['ac_col']),
                  top=shade(C(c['ac_col']), 1.06), bevel=0.15, vent=True)
    pantograph(extra, cfg.get('panto_x', 0.0), c['roof'] if not c['ac'] else c['ac_top'], lod=0, hfold=0.35, width=1.4, base_w=0.9)
    return merge(car, extra), sp


# ---------------------------------------------------------------- 設定
TODEN_BASE = dict(pitch=13.0, W=2.2, zb=0.80, roof=3.30, shoulder=3.02, ac_top=3.62, door_w=1.0, gangway=False,
                  win=(1.70, 2.55), flare=None, doors=(3.4,), ac=[(0.0, 2.6)], ac_col='#d9dadb')

CARS = [
    dict(TODEN_BASE, id='toden8900', name='都電 8900 形（橘色）', kind='tram',
         source='ja.wikipedia 都電8900形（13,000／2,200／3,800 mm）；Commons: Toei Type8900-8902.jpg（MaedaAkihiko，CC BY-SA 4.0）',
         body='#f4f3ef', low='#e04a14', roof_col='#e6e6e3', bands=[(0.80, 1.10, '#e04a14'), (1.66, 1.72, '#1b1d1f'), (2.58, 2.66, '#1b1d1f'), (2.90, 3.02, '#e04a14')],
         door_col='#eceae6',
         front=dict(Ln=0.55, tip_w=0.92, tip_drop=0.12, setback=0.08, face='#e04a14',
                    decals=[('rect', 0.0, 2.38, 1.78, 1.20, 0.10, 'GLASS'), ('rect', 0.0, 3.10, 1.10, 0.20, 0.03, '#202326', 0.7),
                            ('rect', -0.66, 1.22, 0.30, 0.14, 0.03, '#f2efe2', 0.9), ('rect', 0.66, 1.22, 0.30, 0.14, 0.03, '#f2efe2', 0.9)],
                    skirt=('#2f3336', 0.22, 0.60))),
    dict(TODEN_BASE, id='toden8800', name='都電 8800 形（玫瑰色）', kind='tram',
         source='ja.wikipedia 都電8800形（13,000／2,200／3,800 mm）；外觀依 catalog 描述與 8900 形同系設計（Commons 照片下載受限）',
         body='#f4f3ef', low='#c93d6c', roof_col='#e6e6e3', bands=[(0.80, 1.10, '#c93d6c'), (1.66, 1.72, '#1b1d1f'), (2.58, 2.66, '#1b1d1f')],
         door_col='#eceae6',
         front=dict(Ln=0.65, tip_w=0.88, tip_drop=0.14, setback=0.12, face='#c93d6c',
                    decals=[('rect', 0.0, 2.38, 1.70, 1.20, 0.18, 'GLASS'), ('rect', 0.0, 3.08, 1.00, 0.20, 0.03, '#202326', 0.7),
                            ('circle', -0.62, 1.24, 0.09, '#f2efe2', 0.9), ('circle', 0.62, 1.24, 0.09, '#f2efe2', 0.9)],
                    skirt=('#2f3336', 0.22, 0.60))),
    dict(TODEN_BASE, id='toden7700', name='都電 7700 形（藍色）', kind='tram', pitch=12.52, W=2.203,
         source='ja.wikipedia 都電7700形（12,520／2,203／3,800 mm）；Commons: Toei Type7700-7703.jpg（MaedaAkihiko，CC BY-SA 4.0）',
         body='#2f5fc0', low='#2a4f9c', roof_col='#ece8dc', door_col='#2c58b4', win_frame='#d8c9a0',
         bands=[(2.62, 2.70, '#d8c9a0'), (1.62, 1.68, '#d8c9a0')],
         front=dict(Ln=0.35, tip_w=0.95, tip_drop=0.10, setback=0.05, face='#2f5fc0',
                    cap=[(3.0, None, '#e9e3d2')],
                    decals=[('rect', 0.0, 2.36, 1.80, 1.10, 0.05, '#d8c9a0', 0.5), ('rect', 0.0, 2.36, 1.66, 0.98, 0.04, 'GLASS'),
                            ('rect', 0.0, 3.08, 1.10, 0.20, 0.03, '#2b2d30', 0.7),
                            ('circle', -0.55, 1.42, 0.12, '#d8c9a0'), ('circle', -0.55, 1.42, 0.08, '#f2efe2', 0.9),
                            ('circle', 0.55, 1.42, 0.12, '#d8c9a0'), ('circle', 0.55, 1.42, 0.08, '#f2efe2', 0.9),
                            ('circle', 0.0, 1.52, 0.10, '#d8c9a0', 0.6)],
                    skirt=('#5a4a3a', 0.25, 0.65))),
    dict(TODEN_BASE, id='toden9000', name='都電 9000 形（復古塗裝）', kind='tram',
         source='ja.wikipedia 都電9000形（13,000／2,200／3,800 mm）；外觀依 catalog 描述（奶油色上半、栗色下半、金色飾線；Commons 照片下載受限）',
         body='#f2e6c8', low='#6e1c27', roof_col='#e8e0cc', door_col='#efe2c2', win_frame='#8a6d2e',
         bands=[(0.80, 1.62, '#7a1f2b'), (1.62, 1.66, '#c9a54a'), (2.66, 2.70, '#c9a54a')],
         front=dict(Ln=0.55, tip_w=0.86, tip_drop=0.16, setback=0.05, face='#f2e6c8', cap=[(None, 1.62, '#7a1f2b')],
                    wrap=[(0.0, 1.62, '#7a1f2b')],
                    decals=[('rect', 0.0, 2.32, 1.62, 1.08, 0.08, 'GLASS'), ('rect', 0.0, 3.02, 0.90, 0.18, 0.03, '#2b2d30', 0.7),
                            ('band', 1.62, 1.66, '#c9a54a'), ('circle', 0.0, 1.30, 0.13, '#c9a54a'), ('circle', 0.0, 1.30, 0.09, '#f2efe2', 0.9)],
                    skirt=('#3a3d40', 0.25, 0.65))),
]

# 東急世田谷線 300 系：兩節連接車（每節 8.25 m），駕駛車＋轉向的駕駛車即為一列
SETAGAYA = dict(id='tokyu300', name='東急 300 系（世田谷線，綠色塗裝）', kind='lrt',
                source='ja.wikipedia 東急300系電車（8,250／2,500／3,945 mm）；Commons: Tokyu-EC300-3.jpg（Yaguchi，CC BY-SA 4.0）',
                pitch=8.25, W=2.5, zb=0.45, roof=3.25, shoulder=2.98, ac_top=3.55, ac=[(-1.2, 2.4)], doors=(-1.6,), door_w=1.1,
                body='#23944a', low='#1d7a3d', roof_col='#d9dadb', door_col='#cfd2d4', win=(1.25, 2.50), win_frame='#2a2d30',
                bands=[(0.45, 1.20, '#f2efe6')],
                front=dict(Ln=0.55, tip_w=0.90, tip_drop=0.10, setback=0.10, face='#23944a', cap=[(None, 1.20, '#f2efe6')],
                           wrap=[(0.0, 1.20, '#f2efe6')],
                           decals=[('rect', 0.0, 2.10, 1.95, 1.35, 0.12, 'GLASS'), ('rect', 0.0, 2.92, 1.30, 0.18, 0.03, '#2b2d30', 0.7),
                                   ('poly', [(-1.0, 0.70), (-0.15, 0.70), (-0.05, 0.95), (-0.15, 1.18), (-1.0, 1.18)], '#23944a', 0.5),
                                   ('poly', [(1.0, 0.70), (0.15, 0.70), (0.05, 0.95), (0.15, 1.18), (1.0, 1.18)], '#23944a', 0.5),
                                   ('rect', -0.80, 1.00, 0.26, 0.12, 0.03, '#f2efe2', 0.9), ('rect', 0.80, 1.00, 0.26, 0.12, 0.03, '#f2efe2', 0.9)],
                           skirt=('#23944a', 0.12, 0.42)))

AGT = [
    dict(id='nt300', name='都營 300 形（日暮里・舍人線）', kind='agt',
         source='ja.wikipedia 東京都交通局300形（9,030／2,490／3,340 mm）；Commons: Nippori-Toneri-Liner Type300-14.jpg（MaedaAkihiko，CC BY-SA 4.0）',
         pitch=9.0, W=2.49, zb=0.95, roof=3.20, shoulder=2.92, ac_top=3.34, ac=[(0.0, 2.6)], doors=(0.0,), door_w=1.2, gangway=True,
         body='#c4c8cc', roof_col='#a9adb1', win=(1.70, 2.65), bands=[(1.48, 1.52, '#5fae2e'), (1.52, 1.56, '#f09199')],
         front=dict(Ln=0.55, tip_w=0.94, tip_drop=0.08, setback=0.12, face='#c9cdd1',
                    decals=[('rect', -0.32, 2.30, 1.30, 1.20, 0.08, 'GLASS'), ('rect', 0.62, 2.20, 0.62, 1.42, 0.06, '#b7bbbf', 0.5),
                            ('rect', 0.62, 2.40, 0.48, 0.90, 0.05, 'GLASS'), ('rect', -0.70, 1.38, 0.26, 0.12, 0.03, '#f2efe2', 0.9),
                            ('rect', 0.40, 1.38, 0.26, 0.12, 0.03, '#f2efe2', 0.9)],
                    skirt=('#9da2a7', 0.55, 0.90))),
    dict(id='nt330', name='都營 330 形（日暮里・舍人線）', kind='agt',
         source='ja.wikipedia 東京都交通局330形（9,000／2,490／3,340 mm）；Commons: Nippori-Toneri-Liner Type330-39.jpg（MaedaAkihiko，CC BY-SA 4.0）',
         pitch=9.0, W=2.49, zb=0.95, roof=3.20, shoulder=2.92, ac_top=3.34, ac=[(0.0, 2.6)], doors=(0.0,), door_w=1.2, gangway=True,
         body='#c4c8cc', roof_col='#a9adb1', win=(1.70, 2.65), bands=[(1.48, 1.52, '#5fae2e'), (1.52, 1.56, '#f09199')],
         front=dict(Ln=0.75, tip_w=0.90, tip_drop=0.10, setback=0.14, face='#f2f2f0',
                    decals=[('rect', 0.0, 2.42, 1.86, 1.30, 0.22, '#141618', 0.9), ('rect', 0.0, 2.40, 1.60, 1.10, 0.15, 'GLASS'),
                            ('circle', -0.18, 1.55, 0.10, '#f2efe2', 0.9), ('circle', 0.18, 1.55, 0.10, '#f2efe2', 0.9),
                            ('rect', 0.0, 1.38, 0.70, 0.10, 0.03, '#1b1d1f', 0.6)],
                    skirt=('#f2f2f0', 0.55, 0.90))),
    dict(id='u7300', name='百合海鷗號 7300 系', kind='agt',
         source='ja.wikipedia ゆりかもめ7300系（9,000／2,550／3,343 mm）；Commons: Yurikamome Series7300-7381F.jpg（MaedaAkihiko，CC0）',
         pitch=9.0, W=2.55, zb=0.95, roof=3.20, shoulder=2.92, ac_top=3.34, ac=[(0.0, 2.6)], doors=(0.0,), door_w=1.2,
         body='#bfc3c7', roof_col='#a9adb1', win=(1.70, 2.65), bands=[(1.50, 1.56, '#27404e'), (1.56, 1.58, '#7ec8e3')],
         front=dict(Ln=0.65, tip_w=0.92, tip_drop=0.10, setback=0.12, face='#f2f2f0',
                    decals=[('rect', 0.0, 2.38, 1.92, 1.40, 0.25, '#141618', 0.9), ('rect', 0.0, 2.40, 1.62, 1.12, 0.18, 'GLASS'),
                            ('rect', 0.0, 1.44, 0.90, 0.12, 0.03, '#3b4f8f', 0.6)],
                    skirt=('#f2f2f0', 0.55, 0.90))),
    dict(id='u7500', name='百合海鷗號 7500 系', kind='agt',
         source='ja.wikipedia ゆりかもめ7500系（9,000／2,550／3,343 mm）；Commons: Yurikamome Series7500-7581F.jpg（MaedaAkihiko，CC0）',
         pitch=9.0, W=2.55, zb=0.95, roof=3.20, shoulder=2.92, ac_top=3.34, ac=[(0.0, 2.6)], doors=(0.0,), door_w=1.2,
         body='#bfc3c7', roof_col='#a9adb1', win=(1.70, 2.65), bands=[(1.50, 1.56, '#27404e')],
         front=dict(Ln=0.70, tip_w=0.90, tip_drop=0.10, setback=0.14, face='#f4f4f2',
                    decals=[('rect', 0.0, 2.38, 1.92, 1.40, 0.22, '#141c3a', 0.9), ('rect', 0.0, 2.42, 1.58, 1.06, 0.16, 'GLASS'),
                            ('poly', [(-0.95, 1.50), (-0.30, 1.40), (-0.30, 1.46), (-0.95, 1.56)], '#2a5be0', 0.8),
                            ('poly', [(0.95, 1.50), (0.30, 1.40), (0.30, 1.46), (0.95, 1.56)], '#2a5be0', 0.8)],
                    skirt=('#f4f4f2', 0.55, 0.90))),
]

MONO = [
    dict(id='mo10000', name='東京單軌 10000 形', kind='mono',
         source='ja.wikipedia 東京モノレール10000形（中間車 15,200／2,924／4,364 mm）；Commons: Tokyo-Monorail-Type10000-10081F.jpg（MaedaAkihiko，CC BY-SA 4.0）',
         pitch=15.2, W=2.924, zb=1.40, roof=4.10, shoulder=3.80, ac_top=4.36, ac=[(-4.0, 2.6), (4.0, 2.6)], doors=(-3.6, 3.6), door_w=1.1,
         body='#f1f2f2', skirt_col='#e9eaeb', roof_col='#d5d7d9', door_col='#e8e9ea', win=(2.25, 3.25), win_frame='#3a3d40',
         door_frame='#2bb24c', bands=[(3.58, 3.66, '#00a0e9')],
         front=dict(Ln=1.2, tip_w=0.86, tip_drop=0.22, setback=0.30, face='#f1f2f2',
                    decals=[('rect', 0.0, 3.12, 2.00, 1.30, 0.40, '#141618', 0.9), ('rect', 0.0, 3.10, 1.70, 1.05, 0.30, 'GLASS'),
                            ('band', 3.82, 3.88, '#2bb24c'), ('rect', 0.0, 2.25, 0.60, 0.12, 0.03, '#1b1d1f', 0.6),
                            ('circle', -0.22, 2.25, 0.07, '#f2efe2', 0.9), ('circle', 0.22, 2.25, 0.07, '#f2efe2', 0.9)],
                    skirt=None)),
    dict(id='mo1000', name='東京單軌 1000 形（2015 年後塗裝）', kind='mono',
         source='ja.wikipedia 東京モノレール1000形（中間車 15,200／3,038／4,362 mm）；Commons: Tokyo-Monorail-Type1000-1043F.jpg（MaedaAkihiko，CC BY-SA 4.0）',
         pitch=15.2, W=3.038, zb=1.40, roof=4.10, shoulder=3.80, ac_top=4.36, ac=[(-4.0, 2.6), (4.0, 2.6)], doors=(-3.6, 3.6), door_w=1.1,
         body='#f1f2f2', skirt_col='#8e9398', roof_col='#d5d7d9', door_col='#3a78d0', win=(2.25, 3.25), win_frame='#3a3d40',
         bands=[(3.62, 3.80, '#9ccb3b')],
         front=dict(Ln=0.9, tip_w=0.90, tip_drop=0.20, setback=0.20, face='#f1f2f2',
                    cap=[(None, 1.95, '#8e9398')], wrap=[(0.0, 1.95, '#8e9398')],
                    decals=[('rect', 0.0, 3.10, 2.10, 1.10, 0.10, '#141618', 0.9), ('rect', 0.0, 3.10, 1.90, 0.95, 0.08, 'GLASS'),
                            ('band', 3.70, 3.86, '#9ccb3b'), ('rect', -0.70, 2.30, 0.30, 0.12, 0.03, '#f2efe2', 0.9),
                            ('rect', 0.70, 2.30, 0.30, 0.12, 0.03, '#f2efe2', 0.9)],
                    skirt=None)),
    dict(id='tt1000', name='多摩單軌 1000 系', kind='mono',
         source='ja.wikipedia 多摩都市モノレール1000系（中間車 14,600／2,980／5,180 mm）；Commons: Tama-Toshi-Monorail Series1000-1111.jpg（MaedaAkihiko，CC BY-SA 4.0）',
         pitch=14.6, W=2.98, zb=1.50, roof=4.20, shoulder=3.90, ac_top=4.50, ac=[(-3.8, 2.4), (3.8, 2.4)], doors=(-3.4, 3.4), door_w=1.1,
         body='#c4c8cc', skirt_col='#b5b9bd', roof_col='#a9adb1', win=(2.35, 3.35), win_frame='#3a3d40',
         bands=[(1.50, 2.30, '#e97119'), (2.20, 2.30, '#f3b33d')],
         front=dict(Ln=0.9, tip_w=0.92, tip_drop=0.15, setback=0.15, face='#c9cdd1',
                    decals=[('rect', 0.0, 3.25, 2.20, 1.30, 0.12, '#141618', 0.9), ('rect', 0.0, 3.25, 1.95, 1.05, 0.08, 'GLASS'),
                            ('band', 2.30, 2.46, '#f3b33d'), ('band', 2.46, 2.60, '#e97119'),
                            ('rect', -0.70, 2.05, 0.30, 0.12, 0.03, '#f2efe2', 0.9), ('rect', 0.70, 2.05, 0.30, 0.12, 0.03, '#f2efe2', 0.9)],
                    skirt=None)),
]


def _register():
    out = {}
    for cfg in CARS:
        out[cfg['id']] = (lambda c: lambda lod: tram_double(c))(cfg)
    out[SETAGAYA['id']] = lambda lod: jp.build_cab_car(SETAGAYA, lod)
    out[SETAGAYA['id'] + '-mid'] = lambda lod: jp.build_mid_car(SETAGAYA, lod)
    for cfg in AGT:
        def cab(lod, c=cfg):
            m, sp = jp.build_cab_car(c, lod)
            return rubber_tyres(c, strip_under(m, c['zb'] - 0.02)), sp

        def mid(lod, c=cfg):
            m, sp = jp.build_mid_car(c, lod)
            return rubber_tyres(c, strip_under(m, c['zb'] - 0.02)), sp
        out[cfg['id']] = cab
        out[cfg['id'] + '-mid'] = mid
    for cfg in MONO:
        def cab(lod, c=cfg):
            m, sp = jp.build_cab_car(c, lod)
            return monorail_skirt(c, strip_under(m, c['zb'] - 0.02), nose=True), sp

        def mid(lod, c=cfg):
            m, sp = jp.build_mid_car(c, lod)
            return monorail_skirt(c, strip_under(m, c['zb'] - 0.02)), sp
        out[cfg['id']] = cab
        out[cfg['id'] + '-mid'] = mid
    return out


BUILDERS = _register()
ALL = CARS + [SETAGAYA] + AGT + MONO
