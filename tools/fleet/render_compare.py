"""把 tools/fleet 產生的 .bin 網格丟進 Blender（bpy 模組或 blender -b）以 Cycles 渲染，供與參考照片並排比對。
改自台灣版 prototypes/tiny-trains/blender/tainan-fleet-v2/blender_compare.py。

用法：python3 tools/fleet/render_compare.py -- --bin tools/fleet/out --out <輸出目錄> --ids r160,e233 [--samples 32]
  另外加 --formation r160:r160-mid 會把「駕駛車＋中間車＋反向駕駛車」排成三節一起渲染。
輸出：<id>-side.png（側視，車頭朝右）、<id>-q34.png（前右 3/4）、<id>-front.png（正面）。
參考照片只用來人工比對，不放進 repo。
"""
import sys, os, gzip, math, json
import numpy as np
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


BIN = arg('--bin')
OUT = arg('--out')
LOD = 'near'
SAMPLES = int(arg('--samples', '32'))
IDS = arg('--ids', '').split(',') if arg('--ids') else []
FORMATION = arg('--formation')
VIEWS = arg('--views', 'side,q34,front').split(',')   # 只要部分視角時用，例如 --views q34
os.makedirs(OUT, exist_ok=True)


def srgb_to_lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def load_mesh(mid):
    a = np.frombuffer(open(os.path.join(BIN, mid + '.bin'), 'rb').read(), dtype='<f4').reshape(-1, 10).copy()
    return a, {'min': a[:, 0:3].min(axis=0).tolist(), 'max': a[:, 0:3].max(axis=0).tolist()}


def place(a, dx=0.0, flip=False):
    a = a.copy()
    if flip:
        a[:, 0] *= -1; a[:, 1] *= -1; a[:, 3] *= -1; a[:, 4] *= -1   # 繞 z 轉 180°，繞向不變
    a[:, 0] += dx
    return a


def make_object(mid, a=None, meta=None):
    if a is None:
        a, meta = load_mesh(mid)
    # 網頁材質是 DoubleSide、只看頂點法線；Blender 的自訂法線要跟面繞向同側，所以渲染前把繞向反了的三角形翻過來
    t = a.reshape(-1, 3, 10).copy()
    p = t[:, :, 0:3]
    bad = (np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0]) * t[:, :, 3:6].mean(axis=1)).sum(axis=1) < 0
    t[bad] = t[bad][:, ::-1, :]
    a = t.reshape(-1, 10)
    n = len(a)
    me = bpy.data.meshes.new(mid)
    me.vertices.add(n)
    me.vertices.foreach_set('co', a[:, 0:3].astype(np.float32).ravel())
    nt = n // 3
    me.loops.add(n)
    me.loops.foreach_set('vertex_index', np.arange(n, dtype=np.int32))
    me.polygons.add(nt)
    me.polygons.foreach_set('loop_start', np.arange(0, n, 3, dtype=np.int32))
    me.polygons.foreach_set('use_smooth', np.ones(nt, dtype=bool))
    me.update(calc_edges=True)
    col = me.color_attributes.new(name='col', type='FLOAT_COLOR', domain='POINT')
    rgba = np.ones((n, 4), np.float32)
    rgba[:, :3] = srgb_to_lin(a[:, 6:9])
    col.data.foreach_set('color', rgba.ravel())
    gl = me.attributes.new(name='gloss', type='FLOAT', domain='POINT')
    gl.data.foreach_set('value', a[:, 9].astype(np.float32))
    me.normals_split_custom_set_from_vertices([tuple(v) for v in a[:, 3:6].astype(np.float32)])
    ob = bpy.data.objects.new(mid, me)
    bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.new('car')
    if mat.node_tree is None:
        mat.use_nodes = True
    nt_ = mat.node_tree
    for nd in list(nt_.nodes):
        nt_.nodes.remove(nd)
    out = nt_.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt_.nodes.new('ShaderNodeBsdfPrincipled')
    vc = nt_.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'col'
    at = nt_.nodes.new('ShaderNodeAttribute')
    at.attribute_name = 'gloss'
    at.attribute_type = 'GEOMETRY'
    mp = nt_.nodes.new('ShaderNodeMapRange')
    mp.inputs['From Min'].default_value = 0.0
    mp.inputs['From Max'].default_value = 1.0
    mp.inputs['To Min'].default_value = 0.85
    mp.inputs['To Max'].default_value = 0.18
    nt_.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    nt_.links.new(at.outputs['Fac'], mp.inputs['Value'])
    nt_.links.new(mp.outputs['Result'], bsdf.inputs['Roughness'])
    nt_.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    ob.data.materials.append(mat)
    return ob, a, meta


def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)
    for mt in list(bpy.data.materials):
        bpy.data.materials.remove(mt)
    for cm in list(bpy.data.cameras):
        bpy.data.cameras.remove(cm)
    for lg in list(bpy.data.lights):
        bpy.data.lights.remove(lg)


def setup_scene(res):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    w = bpy.data.worlds.new('w')
    if w.node_tree is None:
        w.use_nodes = True
    wt = w.node_tree
    for nd in list(wt.nodes):
        wt.nodes.remove(nd)
    bg = wt.nodes.new('ShaderNodeBackground')
    wo = wt.nodes.new('ShaderNodeOutputWorld')
    bg.inputs['Color'].default_value = (0.62, 0.70, 0.82, 1)
    bg.inputs['Strength'].default_value = 0.9
    wt.links.new(bg.outputs['Background'], wo.inputs['Surface'])
    sc.world = w
    sc.render.film_transparent = False
    # 太陽：右前上方，柔和陰影
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 3.2
    sun.angle = math.radians(4)
    so = bpy.data.objects.new('sun', sun)
    so.rotation_euler = (math.radians(52), math.radians(8), math.radians(-40))
    bpy.context.scene.collection.objects.link(so)
    # 地面：中性灰＋兩條鋼軌線（示意），只為接地
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, -0.0))
    g = bpy.context.active_object
    gm = bpy.data.materials.new('ground')
    if gm.node_tree is None:
        gm.use_nodes = True
    gt = gm.node_tree
    for nd in list(gt.nodes):
        gt.nodes.remove(nd)
    gb = gt.nodes.new('ShaderNodeBsdfPrincipled')
    go = gt.nodes.new('ShaderNodeOutputMaterial')
    gb.inputs['Base Color'].default_value = (0.36, 0.35, 0.32, 1)
    gb.inputs['Roughness'].default_value = 0.95
    gt.links.new(gb.outputs['BSDF'], go.inputs['Surface'])
    g.data.materials.append(gm)
    return sc


def aim(cam, target):
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def render_view(sc, ob, mid, kind, ctr, span):
    cd = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    if kind == 'front':
        cd.lens = 70
        dist = 4.6 / (18 / 70)
        cam.location = (ctr[0] + dist, ctr[1] - dist * 0.08, ctr[2] + 0.2)
        aim(cam, ctr)
    elif kind == 'side':
        cd.lens = 90
        dist = (span * 0.5) / (18 / 90) * 1.04
        cam.location = (ctr[0], ctr[1] - dist, ctr[2] + 0.35)
        aim(cam, ctr)
    else:
        cd.lens = 55
        az = math.radians(34)
        el = math.radians(13)
        dist = (span * 0.62) / (18 / 55) + 4
        cam.location = (ctr[0] + dist * math.cos(el) * math.cos(az), ctr[1] - dist * math.cos(el) * math.sin(az), ctr[2] + dist * math.sin(el))
        aim(cam, ctr)
    sc.render.filepath = os.path.join(OUT, f'{mid}-{kind}.png')
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    bpy.data.cameras.remove(cd)
    print('RENDERED', sc.render.filepath, flush=True)


for mid in IDS:
    reset_scene()
    sc = setup_scene((1500, 420))
    ob, a, meta = make_object(mid)
    mn = np.array(meta['min']); mx = np.array(meta['max'])
    length = float(mx[0] - mn[0])
    ctr = (float((mn[0] + mx[0]) / 2), 0.0, 1.9)
    if 'side' in VIEWS:
        sc.render.resolution_x, sc.render.resolution_y = 1500, 420
        render_view(sc, ob, mid, 'side', ctr, max(length, 12.0) * 1.08)
    if 'q34' in VIEWS:
        sc.render.resolution_x, sc.render.resolution_y = 1500, 700
        render_view(sc, ob, mid, 'q34', ctr, max(length, 12.0))
    if 'front' in VIEWS:
        sc.render.resolution_x, sc.render.resolution_y = 900, 900
        render_view(sc, ob, mid, 'front', (float(mx[0]), 0.0, 2.0), 6)

if FORMATION:
    cab, mid = FORMATION.split(':')
    ac, mc = load_mesh(cab)
    am, mm = load_mesh(mid)
    lc = mc['max'][0] - mc['min'][0]; lm = mm['max'][0] - mm['min'][0]
    parts = [place(ac, lm / 2 + 0.16 + lc / 2), place(am, 0.0), place(ac, -(lm / 2 + 0.16 + lc / 2), flip=True)]
    a = np.vstack(parts)
    reset_scene()
    sc = setup_scene((1800, 700))
    ob, a, meta = make_object(cab + '-set', a, {'min': a[:, 0:3].min(axis=0).tolist(), 'max': a[:, 0:3].max(axis=0).tolist()})
    mn = np.array(meta['min']); mx = np.array(meta['max'])
    render_view(sc, ob, cab + '-set', 'q34', (float(mx[0]) - 10.0, 0.0, 1.9), 26)
print('DONE', flush=True)
import os as _os; _os._exit(0)
