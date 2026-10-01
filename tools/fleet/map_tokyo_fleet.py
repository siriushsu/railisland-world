"""東京各線的車型分配：讀車型目錄（docs/rolling-stock/catalog-2026-10.json）與已建好的網格，
產生 rail-3d/integration/formations.js 裡 tokyo_sched 的 routes 區塊（標記 TOKYO-FLEET 之間）。

規則：
  - 每條線列出 catalog 中該線的 main（權重 1）與 minor（權重 0.3）車型，只取已有網格的；
  - 網格 id：catalog id 去掉連字號（tm-13000 → tm13000），少數例外見 ALIAS；
  - E233 系 0／1000／5000／7000 番台共用可換路線色的 e233 網格；
  - 編組長度與節數沿用原本各線的設定（KIND／COUNT），只有車長和實際車型明顯不同的線調整；
  - 列車依車次號碼雜湊固定抽一款（formations.js 的 pickMesh），比例約等於權重；沒有逐班派車資料，屬推估。

用法：python3 tools/fleet/map_tokyo_fleet.py   （之後再跑 export_world_fleet.py）
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cars

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..'))
CATALOG = os.path.join(REPO, 'docs/rolling-stock/catalog-2026-10.json')
FORMATIONS = os.path.join(REPO, 'rail-3d/integration/formations.js')

ALIAS = {
    'jr-e233-0': 'e233', 'jr-e233-1000': 'e233', 'jr-e233-5000': 'e233', 'jr-e233-7000': 'e233',
    'jr-e235-0': 'e235', 'jr-e231-0': 'e231', 'tm-1000': 'tm1000',
    'toei-8800': 'toden8800', 'toei-8900': 'toden8900', 'toei-7700': 'toden7700', 'toei-9000': 'toden9000',
    'toei-300': 'nt300', 'toei-320': 'nt300', 'toei-330': 'nt330', 'u-7300': 'u7300', 'u-7500': 'u7500',
    'mo-10000': 'mo10000', 'mo-1000': 'mo1000', 'mo-2000': 'mo1000', 'tt-1000': 'tt1000', 'tokyu-300': 'tokyu300',
}

# 各線編組：[種類, 節數]；種類的車長／寬在 KINDS（寬度實際以網格自身寬度為準）
KINDS = {'ginza': (16, 2.55), 'maru': (18, 2.78), 'oedo': (16.5, 2.5), 'asakusa': (18, 2.8), 'std': (20, 2.85),
         'tram': (13, 2.2), 'agt': (9, 2.5), 'setagaya': (8.25, 2.5), 'mo': (15.2, 3.0), 'tt': (14.6, 2.98)}
COUNT = {
    'G': ('ginza', 6), 'M': ('maru', 6), 'Mb': ('maru', 3), 'E': ('oedo', 8), 'A': ('asakusa', 8), 'I': ('std', 8), 'S': ('std', 10),
    'H': ('std', 7), 'T': ('std', 10), 'C': ('std', 10), 'Y': ('std', 10), 'Z': ('std', 10), 'N': ('std', 6), 'F': ('std', 10),
    'SA': ('tram', 1), 'NT': ('agt', 5),
    'JY': ('std', 11), 'JK': ('std', 10), 'JC': ('std', 10), 'JB': ('std', 10), 'JA': ('std', 10), 'JL': ('std', 10), 'JJ': ('std', 15),
    'JO': ('std', 15), 'JE': ('std', 10), 'JT': ('std', 15), 'JU': ('std', 15), 'JS': ('std', 15), 'JN': ('std', 6), 'JM': ('std', 8),
    'JH': ('std', 8), 'JCO': ('std', 10), 'JCI': ('std', 6), 'JHK': ('std', 4),
    'TY': ('std', 8), 'MG': ('std', 8), 'DT': ('std', 10), 'OM': ('std', 5), 'IK': ('asakusa', 3), 'TM': ('asakusa', 3), 'SG': ('setagaya', 2),
    'OH': ('std', 10), 'OT': ('std', 10), 'KO': ('std', 10), 'KON': ('std', 10), 'IN': ('std', 5), 'KOS': ('std', 10), 'KOT': ('std', 10),
    'KOK': ('std', 6), 'KOD': ('std', 4),
    'SI': ('std', 10), 'SS': ('std', 10), 'SSH': ('std', 10), 'SK': ('std', 6), 'ST': ('std', 4), 'SW': ('std', 4), 'SIT': ('std', 4),
    'SIY': ('std', 10), 'SSE': ('std', 4),
    'TS': ('std', 10), 'TSO': ('std', 10), 'TSK': ('std', 2), 'TSD': ('std', 2), 'TJ': ('std', 10),
    'KS': ('asakusa', 8), 'KSO': ('asakusa', 8), 'KSK': ('asakusa', 4), 'HS': ('asakusa', 8), 'KK': ('asakusa', 8), 'KKA': ('asakusa', 8),
    'TX': ('std', 6), 'R': ('std', 10), 'MO': ('mo', 6), 'TT': ('tt', 4), 'U': ('agt', 6),
}
WEIGHT = {'main': 1.0, 'minor': 0.3}


def mesh_of(cid):
    if cid in ALIAS:
        return ALIAS[cid]
    for cand in (cid.replace('-', ''), re.sub(r'^jr-', '', cid).replace('-', '')):
        if cand in cars.BUILDERS:
            return cand
    return None


def main():
    cat = json.load(open(CATALOG, encoding='utf-8'))['cities']['tokyo_sched']
    lines = {}
    missing = set()
    for ct in cat['carTypes']:
        m = mesh_of(ct['id'])
        if not m:
            missing.add(ct['id'])
            continue
        for line, role in ct['lines'].items():
            w = WEIGHT.get(role.split()[0], 0.3)
            entry = lines.setdefault(line, {})
            entry[m] = max(entry.get(m, 0), w)
    out = []
    for line, (kind, n) in COUNT.items():
        meshes = sorted(lines.get(line, {}).items(), key=lambda kv: (-kv[1], kv[0]))
        if not meshes:
            out.append(f"{json.dumps(line)}:['{kind}',{n}]")
            continue
        if len(meshes) == 1:
            out.append(f"{json.dumps(line)}:['{kind}',{n},'{meshes[0][0]}',FLEET]")
        else:
            lst = ','.join(f"['{m}',{w:g}]" for m, w in meshes)
            out.append(f"{json.dumps(line)}:['{kind}',{n},[{lst}],FLEET]")
    kinds = ','.join(f"{k}:[{a},{b}]" for k, (a, b) in KINDS.items())
    block = ("  // TOKYO-FLEET 開始（tools/fleet/map_tokyo_fleet.py 產生，請勿手改）\n"
             f"  tokyo_sched:{{\n    {kinds},\n    routes:{{\n      " +
             ',\n      '.join(','.join(out[i:i + 4]) for i in range(0, len(out), 4)) +
             ",\n    },\n    fallback:['std',8],\n  },\n  // TOKYO-FLEET 結束\n")
    s = open(FORMATIONS, encoding='utf-8').read()
    if '// TOKYO-FLEET 開始' in s:
        s = re.sub(r"  // TOKYO-FLEET 開始.*?// TOKYO-FLEET 結束\n", lambda _: block, s, flags=re.S)
    else:
        s2 = re.sub(r"  // 東京：銀座線.*?\n  tokyo_sched:\{.*?\n  \},\n", lambda _: block, s, count=1, flags=re.S)
        if s2 == s:
            sys.exit('找不到 tokyo_sched 區塊')
        s = s2
    open(FORMATIONS, 'w', encoding='utf-8').write(s)
    covered = sum(1 for l in COUNT if lines.get(l))
    print(f'✓ 東京 {covered}/{len(COUNT)} 條線有當地車型網格；目錄中尚無網格的車型 {len(missing)} 款：{", ".join(sorted(missing))}')


if __name__ == '__main__':
    main()
