"""Build the app's autocomplete seed from the Mithila-Panji CSV exports.
Usage: python3 scripts/build-seed.py "<dir with gotras.csv mools.csv villages.csv in_gotra_edges.csv>"
Writes src/data/seed/{gotras,mools,villages}.json (committed, so the app has no runtime dependency on the CSVs).
"""
import csv, json, sys, re, collections, pathlib

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parent.parent / "src" / "data" / "seed"
out.mkdir(parents=True, exist_ok=True)
rd = lambda n: list(csv.DictReader(open(src / n, encoding="utf-8-sig")))

gotras = [{"id": g["id"], "dev": g["name_dev"], "roman": g["name_roman"], "seq": int(g["seq"])} for g in rd("gotras.csv")]
edges = collections.defaultdict(list)
for e in rd("in_gotra_edges.csv"):
    edges[e["mool_id"]].append(e["gotra_id"])
mools = []
for m in rd("mools.csv"):
    aka = [a.strip() for a in re.split(r"[;,]", m.get("aka", "").replace("/", ";")) if a.strip()]
    mools.append({"id": m["id"], "dev": m["name_dev"], "roman": m["name_roman"], "aka": aka, "gotras": edges.get(m["id"], [])})

bad = re.compile(r"[\d/=.]|pañjī|पञ्जी|suta|śrī|श्री")
seen, villages = set(), []
for v in rd("villages.csv"):
    r, d = v["name_roman"].strip(), v["name_dev"].strip()
    if not r or bad.search(r) or bad.search(d) or len(r) > 34 or len(r.split()) > 3:
        continue
    k = r.lower()
    if k in seen:
        continue
    seen.add(k)
    villages.append({"id": v["id"], "dev": d, "roman": r})

for name, data in (("gotras", gotras), ("mools", mools), ("villages", villages)):
    (out / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(name, len(data))
