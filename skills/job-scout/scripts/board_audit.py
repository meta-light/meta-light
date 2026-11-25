import sys, json, re, importlib.util, concurrent.futures as cf
from pathlib import Path

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("scout", root / "scripts" / "scout.py")
sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
cfg = sc.load_cfg(); L = cfg["location"]

def cls(j):
    loc = f'{j.get("location","")} {j.get("work_mode","")}'.strip()
    if not loc: return "unknown"
    local = sc.rx_any(L["local_markers"], loc); remote = sc.rx_any(L["remote_markers"], loc)
    if sc.rx_any(L["non_us_remote"], loc) and not local and not re.search(r"united states|\bus\b|usa|north america|americas", loc, re.I): return "bad"
    if not sc.rx_any(L["allow"], loc): return "bad"
    if not remote and not local: return "bad"
    return "ok"

boards = sc.http_lines(root / "data" / "boards.txt")

def run(u):
    try:
        jobs, kind = sc.scrape_board(u, cfg)
    except Exception as e:
        return u, {"kind": "error", "err": str(e)[:80]}
    c = {"ok": 0, "bad": 0, "unknown": 0}; ex = []
    for j in jobs:
        k = cls(j); c[k] += 1
        if k == "bad" and len(ex) < 4: ex.append(j.get("location"))
    return u, {"kind": kind, "n": len(jobs), **c, "bad_examples": ex}

out = {}
with cf.ThreadPoolExecutor(8) as ex:
    for u, r in ex.map(run, boards): out[u] = r
json.dump(out, open(sys.argv[1], "w"), indent=1)
