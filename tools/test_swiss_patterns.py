#!/usr/bin/env python3
"""build_swiss_shapes.py 服務型態拆線的離線單元測試(不需要 GTFS,秒級)。

存在的理由:那些守門在今天的真實資料上全部是**恆真通過**的——1013 個 trip 沒有一個
非相鄰重複站,所以「跑完沒 raise」這件事零訊號(判斷力 rubric 第七節第 5 條)。
恆真的判準必須另外證明「該紅的時候會紅」,這支就是那個正向對照;每一組都附一個
反向對照:把守門拿掉之後,同一筆輸入必須產生錯誤的結果。

跑法:python3 tools/test_swiss_patterns.py
"""
import importlib.util
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("bss", os.path.join(ROOT, "tools", "build_swiss_shapes.py"))
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)

ok = fail = 0


def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  ✓ {name}")
    else:
        fail += 1
        print(f"  ✗ {name}  {detail}")


def scs_without_guards(a, b):
    """守門加上去之前的版本,用來證明守門真的擋掉了壞結果(反向對照)。"""
    i = j = 0
    out = []
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            out.append(a[i]); i += 1; j += 1
        elif a[i] not in b[j:]:
            out.append(a[i]); i += 1
        elif b[j] not in a[i:]:
            out.append(b[j]); j += 1
        else:
            return None
    out.extend(a[i:]); out.extend(b[j:])
    seen, ded = set(), []
    for x in out:
        if x not in seen:
            seen.add(x); ded.append(x)
    return tuple(ded)


print("1. 折返序列:同一站非相鄰重複出現")
a, b = ("A", "B", "C", "B", "D"), ("A", "B", "C", "B", "E")
check("_order_compatible 會放行(所以擋不住的責任在 _scs_merge)", B._order_compatible(a, b) is True)
check("_scs_merge 拒絕合併", B._scs_merge(a, b) is None)
bad = scs_without_guards(a, b)
check("反向對照:沒有守門會吐出 ('A','B','C','D','E')", bad == ("A", "B", "C", "D", "E"), f"實得 {bad}")
check("反向對照:那個結果不是 a 的超序列(折返腿被吃掉)", not B._is_subseq(a, bad))

print("2. 環狀路線自我合併")
c = ("A", "B", "C", "A")
check("_scs_merge 拒絕", B._scs_merge(c, c) is None)
check("反向對照:沒有守門會砍成 ('A','B','C')", scs_without_guards(c, c) == ("A", "B", "C"))

print("3. 超序列不變式")
x, y = ("A", "B", "D"), ("A", "C", "D")
m = B._scs_merge(x, y)
check("順序相容的兩序列合得起來", m is not None, f"實得 {m}")
check("合併結果是雙方的超序列", m is not None and B._is_subseq(x, m) and B._is_subseq(y, m))

print("4. Y 岔(兩個不同的頭)不得合併 —— 伯連納快車的形狀")
bex_a = ("Chur", "Thusis", "Berguen", "Pontresina", "Tirano")
bex_b = ("StMoritz", "Pontresina", "Tirano")
check("兩邊都有自己的私有端點 ⇒ 互相都不是子路徑",
      not (B._is_subpath(bex_a, bex_b) or B._is_subpath(bex_b, bex_a)))
folded = B._fold_patterns({bex_a: {"t1"}, bex_b: {"t2"}},
                          {k: (46.8 + i * 0.01, 9.5 + i * 0.01) for i, k in
                           enumerate(set(bex_a) | set(bex_b))})
check("_fold_patterns 保留兩個型態", len(folded) == 2, f"實得 {len(folded)}")

print("5. 子路徑(短程是長程的一段)必須合併")
s_a = ("Schiers", "Landquart", "Chur", "Thusis")
s_b = ("Chur", "Landquart")
check("短的兩端都落在長的站集內 ⇒ 是子路徑", B._is_subpath(s_b, s_a))

print("6. 方向:反向的子序列要被吸收")
check("_absorbed_by 對反向成立", B._absorbed_by(("C", "B", "A"), ("A", "B", "C", "D")))
check("單向測試會漏掉(所以雙向不是多餘的寫法)", not B._is_subseq(("C", "B", "A"), ("A", "B", "C", "D")))

print("7. 車站鍵:三種官方 stop_id 形態都要收斂到同一個車站")
check("月台後綴", B.station_key("ch:1:sloid:1300:2:5") == "ch:1:sloid:1300")
check("_gen 形態", B.station_key("ch:1:sloid:9179_gen:ch:1:sloid:9179:0:110081") == "ch:1:sloid:9179")
check("純數字＋後綴", B.station_key("8301003_gen:missingSLOID_pf:31") == "8301003")
check("同一站的兩個月台收斂到同鍵",
      B.station_key("ch:1:sloid:1300:2:5") == B.station_key("ch:1:sloid:1300:1:2"))

print("8. 迂迴看門人的門檻本身")
check("DETOUR_SANITY_RATIO 訂在真實山岳幾何上限 4.3 之下(訂高會漏掉 RE8 那種 2.6 的假折返)",
      0 < B.DETOUR_SANITY_RATIO <= 2.5)

print(f"\n{ok} 過、{fail} 失敗")
sys.exit(1 if fail else 0)
