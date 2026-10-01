"""試做用：只輸出 out/<id>.bin＋統計（out/ 不進 repo）。正式輸出用 export_world_fleet.py。
用法：python3 tools/fleet/build.py [id ...]"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit, cars

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
for cid in [a for a in sys.argv[1:] if not a.startswith('--')] or list(cars.BUILDERS):
    m, sp = cars.BUILDERS[cid](0)
    i = kit.export(m, os.path.join(OUT, cid + '.bin'))
    tags = dict(sorted(m.counts.items(), key=lambda kv: -kv[1]))
    print(f"{cid:10s} tris={i['triangles']:6d} bytes={i['byteLength']:8d} x[{i['min'][0]:.2f},{i['max'][0]:.2f}] y[{i['min'][1]:.2f},{i['max'][1]:.2f}] z[{i['min'][2]:.2f},{i['max'][2]:.2f}] {tags}")
