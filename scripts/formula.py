"""Reverse-engineered model of the 2026 Zurich source-tax rates.

The model computes the rate of each band from the tax law and the 2026
parameter sheet, and compares it with the ESTV tariff file.
The defaults in TOGGLES are the best fit. Tariffs A, B and H match; the
model for C does not match yet, and there is no model for G.

Usage:
  python3 -I scripts/formula.py sources/estv/tar26zh.txt A0N A0Y ...
  python3 -I scripts/formula.py sources/estv/tar26zh.txt all --set bk_base=net -v
Each assumption is a named toggle in TOGGLES. Override with --set name=value.
"""
import argparse
import math
from decimal import Decimal as D, ROUND_HALF_UP

TOGGLES = {
    "months": 12,               # monthly midpoint x months = yearly gross
    "first_band_point": "upper",  # evaluation point of band 1-800: upper | mid
    "band_point": "mid0",       # mid0: (from-1+to)/2, mid: (from+to)/2
    "double_round": False,      # round the rate to 3 decimals first, then to 2
    "alv_nbu_cap": 148_200,     # ALV and NBU only up to this yearly salary
    "bk_base": "gross",         # base of the % job-cost deduction: gross | net
    "ins_base": "gross",        # base of the federal % insurance deduction: gross | net
    "floor100": "both",         # round taxable income down to 100: both | fed | none
    "personal_tax": 24,         # ZH personal tax per year and person
    "married_persons": 2,       # B and C pay the personal tax for both spouses
    "fed_min": 25,              # federal tax below this is not levied
    "fed_child_credit_A": False,  # federal 263 per child also for tariff A
    "h_ins": "single",          # insurance deduction for H: single | married
    "c_median": 5_875,          # tariff C: monthly income assumed for the spouse
    "c_spouse": "min",          # tariff C spouse income: min(own, median) | median
    "canton_factor": 0.98,      # extra factor on canton+commune tax, Grundtarif (found by fit)
    "canton_factor_verh": 1.0,  # extra factor on canton+commune tax, Verheiratetentarif
    "fed_factor": 1.0,          # extra factor on federal tax
    "simple_round": 0.0,        # round the ZH simple tax to this step (0 = no rounding)
    "canton_round": 0.0,        # round the canton+commune tax to this step
    "total_round": 0.0,         # round the yearly total tax to this step
}


def rstep(x, step):
    if not step:
        return x
    return float((D(repr(x)) / D(repr(step))).quantize(D("1"), ROUND_HALF_UP) * D(repr(step)))

# ZH § 35 StG, 2026: (width, rate %), last entry open.
ZH_GRUND = [(7000, 0), (5000, 2), (4800, 3), (8000, 4), (9700, 5), (11200, 6), (13100, 7),
            (17600, 8), (34000, 9), (33700, 10), (53300, 11), (69300, 12), (math.inf, 13)]
ZH_VERH = [(14100, 0), (6400, 2), (8100, 3), (9800, 4), (11200, 5), (14500, 6), (32200, 7),
           (32400, 8), (48500, 9), (57900, 10), (62900, 11), (72600, 12), (math.inf, 13)]
ZH_CANTON_MULT = 0.98
ZH_COMMUNE_MULT = {"N": 1.099, "Y": 1.160}

# Federal Art. 36 DBG, 2026: (from income, tax at that income, tax per further 100).
FED_SINGLE = [(0, 0, 0), (15200, 0, 0.77), (33200, 138.60, 0.88), (43500, 229.20, 2.64),
              (58000, 612.00, 2.97), (76200, 1152.50, 5.94), (82100, 1502.95, 6.60),
              (108900, 3271.75, 8.80), (141500, 6140.55, 11.00), (185100, 10936.55, 13.20),
              (793900, 91298.15, 13.20), (794000, 91310.00, 11.50)]
FED_MARRIED = [(0, 0, 0), (29700, 0, 1.00), (53400, 237, 2), (61300, 395, 3), (79100, 929, 4),
               (94900, 1561, 5), (108700, 2251, 6), (120600, 2965, 7), (130500, 3658, 8),
               (138400, 4290, 9), (144300, 4821, 10), (148300, 5221, 11), (150400, 5452, 12),
               (152400, 5692, 13), (941300, 108249, 13), (941400, 108261, 11.50)]
FED_CHILD_CREDIT = 263


def zh_simple(income, scale):
    tax, rest = 0.0, income
    for width, rate in scale:
        part = min(rest, width)
        if part <= 0:
            break
        tax += part * rate / 100
        rest -= part
    return tax


def fed_tax(income, scale):
    start, base, per100 = [s for s in scale if s[0] <= income][-1]
    return base + per100 * math.floor((income - start) / 100)


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def floor100(x):
    return max(0, math.floor(x / 100) * 100)


def social(y, t):
    """AHV/IV/EO 5.3% and BVG 6.5% on all; ALV 1.1% and NBU 1.0% up to the cap."""
    capped = min(y, t["alv_nbu_cap"])
    return y * (0.053 + 0.065) + capped * (0.011 + 0.010)


def taxes(group, kids, church, y, t, spouse_y=0.0):
    """Yearly canton+commune and federal tax for household gross y (+ spouse_y)."""
    married = group in "BC"
    with_kids_scale = group in "BCH"
    earners = [y] + ([spouse_y] if spouse_y else [])
    total = sum(earners)
    soc = sum(social(e, t) for e in earners)
    net = total - soc

    def base(e):
        return e if t["bk_base"] == "gross" else e - social(e, t)

    # canton
    bk_c = sum(clamp(0.10 * base(e), 6600, 12400) for e in earners)
    ins_married = married or (group == "H" and t["h_ins"] == "married")
    ins_c = (5800 if ins_married else 2900) + 1300 * kids
    taxable_c = net - bk_c - ins_c - 9400 * kids - (6200 if spouse_y else 0)
    if t["floor100"] == "both":
        taxable_c = floor100(taxable_c)
    taxable_c = max(0, taxable_c)
    simple = rstep(zh_simple(taxable_c, ZH_VERH if with_kids_scale else ZH_GRUND), t["simple_round"])
    factor = t["canton_factor_verh"] if with_kids_scale else t["canton_factor"]
    canton = rstep(simple * (ZH_CANTON_MULT + ZH_COMMUNE_MULT[church]) * factor,
                   t["canton_round"]) + t["personal_tax"] * (t["married_persons"] if married else 1)

    # federal
    bk_f = sum(800 + 3200 + clamp(0.03 * base(e), 2000, 4000) for e in earners)
    ins_base = total if t["ins_base"] == "gross" else net
    ins_f = (min(0.05 * ins_base, 3700) if ins_married else min(0.03 * ins_base, 1800)) + 700 * kids
    dual = clamp(0.5 * min(earners), 8600, 14100) if spouse_y else 0
    taxable_f = net - bk_f - ins_f - 6800 * kids - (2800 if married else 0) - dual
    if t["floor100"] in ("both", "fed"):
        taxable_f = floor100(taxable_f)
    taxable_f = max(0, taxable_f)
    fed = fed_tax(taxable_f, FED_MARRIED if with_kids_scale else FED_SINGLE)
    if group in "BCH" or (group == "A" and t["fed_child_credit_A"]):
        fed -= FED_CHILD_CREDIT * kids
    if fed < t["fed_min"]:
        fed = 0
    fed *= t["fed_factor"]
    return canton, fed


def model_rate(group, kids, church, monthly, t):
    y = monthly * t["months"]
    if group == "C":
        cap = t["c_median"] * t["months"]
        spouse = min(y, cap) if t["c_spouse"] == "min" else cap
        canton, fed = taxes(group, kids, church, y, t, spouse_y=spouse)
        return rstep(canton + fed, t["total_round"]) / (y + spouse) * 100
    canton, fed = taxes(group, kids, church, y, t)
    return rstep(canton + fed, t["total_round"]) / y * 100


def load(path):
    tables = {}
    for line in open(path):
        if line.startswith("06"):
            code = line[6:16].strip()
            tables.setdefault(code, []).append(
                (int(line[24:33]) / 100, int(line[33:42]) / 100, int(line[54:59]) / 100))
    return tables


def round2(x):
    return float(D(repr(x)).quantize(D("0.01"), ROUND_HALF_UP))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("codes", nargs="+")
    ap.add_argument("--set", action="append", default=[])
    ap.add_argument("-v", "--verbose", action="store_true")
    a = ap.parse_args()
    t = dict(TOGGLES)
    for kv in a.set:
        k, v = kv.split("=", 1)
        old = t[k]
        t[k] = (v == "True") if isinstance(old, bool) else type(old)(v)
    tables = load(a.file)
    codes = a.codes
    if codes == ["all"]:
        codes = sorted(c for c in tables if c[0] in "ABCGH" and len(tables[c]) > 1)
    total_rows = total_bad = 0
    for code in codes:
        group, kids, church = code[0], int(code[1]), code[2]
        if group == "G":
            print(f"{code}: skipped (model for G not built)")
            continue
        bad, worst = [], 0.0
        for frm, w, rate in tables[code]:
            if frm == 1:
                point = frm + w - 1 if t["first_band_point"] == "upper" else (frm + frm + w - 1) / 2
            elif w <= 1:
                point = frm - 1  # open top row: rate at exactly 100,000 a month
            elif t["band_point"] == "mid0":
                point = (frm - 1 + frm + w - 1) / 2
            else:
                point = (frm + frm + w - 1) / 2
            raw = model_rate(group, kids, church, point, t)
            if t["double_round"]:
                raw = float(D(repr(raw)).quantize(D("0.001"), ROUND_HALF_UP))
            got = round2(raw)
            diff = got - rate
            worst = max(worst, abs(diff))
            if abs(diff) > 0.001:
                bad.append((frm, w, rate, got))
        n = len(tables[code])
        total_rows += n
        total_bad += len(bad)
        print(f"{code}: {n - len(bad)}/{n} match, max |diff| {worst:.2f}")
        if a.verbose:
            for frm, w, rate, got in bad[:12]:
                print(f"    {frm:>9.0f} +{w:<6.0f} table {rate:6.2f} model {got:6.2f}")
    print(f"TOTAL {total_rows - total_bad}/{total_rows}")


main()
