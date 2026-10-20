"""Parse the ESTV tar26zh.txt file and compare it with the ZH PDF tables.

Usage: python3 -I scripts/compare.py sources/estv/tar26zh.txt sources/zh
Needs pdftotext (poppler).
"""
import re
import subprocess
import sys
from collections import defaultdict, Counter
from pathlib import Path


def parse_estv(path):
    tables = defaultdict(list)  # (code, kids, church) -> [(from, step, min_tax, rate)]
    for line in Path(path).read_text().splitlines():
        if not line.startswith("06"):
            continue
        qst = line[6:16].strip()
        code, kids, church = qst[0], qst[1], qst[2]
        frm = int(line[24:33]) / 100
        step = int(line[33:42]) / 100
        n_kids = int(line[43:45])
        min_tax = int(line[45:54]) / 100
        rate = int(line[54:59]) / 100
        tables[(code, kids, church)].append((frm, step, n_kids, min_tax, rate))
    return tables


ROW = re.compile(r"^\s*(?:bis\s+(\d+)|(\d+)\s+–\s+(\d+)|über\s+(\d+))\s+(.*)$")


def parse_pdf(path):
    """Return {kids_col_index: [(from, to, rate)]}. Empty cells are skipped."""
    cols = defaultdict(list)
    text = subprocess.run(["pdftotext", "-layout", str(path), "-"],
                          check=True, capture_output=True, text=True).stdout
    lines = text.splitlines()
    header = next(l for l in lines if re.search(r"\b[A-Z]0\s+[A-Z]1", l))
    labels = re.findall(r"\b([A-Z])(\d)\b", header)
    for line in lines:
        m = ROW.match(line)
        if not m:
            continue
        if m.group(1):
            frm, to = 0, int(m.group(1))
        elif m.group(2):
            frm, to = int(m.group(2)), int(m.group(3))
        else:
            frm, to = int(m.group(4)) + 1, None
        # numbers are right-aligned to the last column (H has an empty H0 column)
        nums = re.findall(r"\d+\.\d\d", line)
        offset = len(labels) - len(nums)
        for i, num in enumerate(nums):
            cols[int(labels[offset + i][1])].append((frm, to, float(num)))
    return cols


def main():
    estv = parse_estv(sys.argv[1])
    pdfdir = Path(sys.argv[2])

    print("== ESTV file summary ==")
    for key in sorted(estv):
        rows = estv[key]
        steps = Counter(r[1] for r in rows)
        mins = {r[3] for r in rows}
        last = rows[-1]
        print(f"{''.join(key)}: {len(rows)} rows, steps={dict(steps)}, "
              f"min_tax={mins}, last_from={last[0]} rate={last[4]}")
        # continuity check
        for a, b in zip(rows, rows[1:]):
            if abs(a[0] + a[1] - b[0]) > 0.001:
                print(f"   GAP after {a}")

    print("\n== PDF vs ESTV ==")
    for pdf in sorted(pdfdir.glob("[A-Z]_*.pdf")):
        code = pdf.name[0]
        church = "Y" if "_mit" in pdf.name else "N"
        cols = parse_pdf(pdf)
        for kids, rows in sorted(cols.items()):
            key = (code, "9" if code == "G" else str(kids), church)
            if key not in estv:
                print(f"{pdf.name} col {kids}: no ESTV table {key}")
                continue
            table = estv[key]
            mism = 0
            for frm, to, rate in rows:
                probe = to if to is not None else frm + 1  # a salary inside the band
                hit = [r for r in table if r[0] <= probe < r[0] + r[1] + 0.001]
                if not hit:
                    mism += 1
                    print(f"  {pdf.name} {key} band {frm}-{to}: no ESTV row")
                    continue
                if abs(hit[-1][4] - rate) > 0.001:
                    mism += 1
                    if mism <= 3:
                        print(f"  {pdf.name} {key} band {frm}-{to}: pdf={rate} estv={hit[-1][4]}")
            print(f"{pdf.name} col {kids} -> {''.join(key)}: {len(rows)} cells, {mism} mismatches")


main()
