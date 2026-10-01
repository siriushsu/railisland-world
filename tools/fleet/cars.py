"""世界版車款註冊表：各 t_*.py 模組提供 BUILDERS[id](lod)->(Mesh, spec)。"""
import importlib
BUILDERS = {}
for _mod in ('t_r160', 't_e233'):
    try:
        _m = importlib.import_module(_mod)
    except ModuleNotFoundError as e:
        if e.name != _mod:
            raise
        continue
    BUILDERS.update(_m.BUILDERS)
