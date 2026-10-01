"""世界版車款註冊表：各 t_*.py 模組提供 BUILDERS[id](lod)->(Mesh, spec)；
jp_*.py 模組提供 CARS（jp.py 的參數化設定清單），自動註冊駕駛車與中間車。"""
import importlib, glob, os
import jp

BUILDERS = {}
JP_CARS = {}
JP_MODULE = {}
for _mod in ('t_r160', 't_e233', 't_r62a', 't_e235', 't_r142', 't_e231', 't_r211', 't_tm1000', 't_special'):
    BUILDERS.update(importlib.import_module(_mod).BUILDERS)
for _path in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'jp_*.py'))):
    try:
        _m = importlib.import_module(os.path.basename(_path)[:-3])
    except Exception as _e:   # 一個設定檔寫壞，不影響其他檔建置；正式輸出時 export 會再檢查
        import sys
        print(f'⚠ 略過 {os.path.basename(_path)}：{_e!r}', file=sys.stderr)
        continue
    for _cfg in _m.CARS:
        if _cfg['id'] in BUILDERS or _cfg['id'] in JP_CARS:
            raise SystemExit(f"重複的車款 id：{_cfg['id']}")
        JP_CARS[_cfg['id']] = _cfg
        JP_MODULE[_cfg['id']] = os.path.basename(_path)
    BUILDERS.update(jp.register(_m.CARS))
