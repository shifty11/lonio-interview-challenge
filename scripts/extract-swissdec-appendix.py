"""Extract the monthly cases of Swissdec appendix 1 into a TypeScript data file.

Run: uv run --with openpyxl python3 scripts/extract-swissdec-appendix.py
Input:  sources/rules/Anhang_1_QST_Berechnung_Monat_20260306.xlsx
Output: src/domain/source-tax/monthly/swissdec-appendix.data.ts, and a skip report on stdout.

Each case sheet lists one person for a tax year. The script reads the rows of every month column:
code, rate, social-insurance days, the wages, the rate-defining salary and the tax amount.
A sheet is skipped when it is out of scope or when a cell does not map to the model of `MonthInput`.
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "sources/rules/Anhang_1_QST_Berechnung_Monat_20260306.xlsx"
OUTPUT = ROOT / "src/domain/source-tax/monthly/swissdec-appendix.data.ts"

MONTHS = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]

# Sheets that are out of scope by title (spec.md § 12: no correction, no canton change, no annual model).
SCOPE_SKIPS = {
    "M14.1": "corrections of March and August (Korrektur) and back payments after leaving in April and September",
    "M19.1": "foreign working days are split off (Ausscheidung Auslandtage); the model has no foreign-days input",
    "M31": "foreign working days are split off (Ausscheidung Auslandtage)",
    "M32": "payment in the following year and foreign working days",
    "M33": "left before the tax year, payments in the following year, foreign working days",
    "M33.1": "canton change and foreign working days",
    "M35": "correction of the leaving month (Korrektur)",
    "M36": "left before the tax year, payment in the following year",
    "M37": "payment after leaving with a new tariff code in the payment month",
    "M38": "left before the tax year, payment in the following year",
    "M38.1": "foreign working days and payment in the following year",
    "M40": "correction of earlier months (Korrektur)",
    "M41": "correction of earlier months (Korrektur)",
    "M42": "correction of earlier months (Korrektur)",
    "YM43": "canton and system change from the annual model to the monthly model",
    "MY44": "canton and system change from the monthly model to the annual model",
    "M46": "canton change",
}


def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def to_rappen(value, what):
    """CHF float to integer Rappen. Raise when the cell is not a whole number of Rappen."""
    scaled = value * 100
    if abs(scaled - round(scaled)) > 1e-6:
        raise Unsupported(f"{what} {value} is not a whole number of Rappen (the sheet does not round a pro-rata 13th month salary)")
    return round(scaled)


class Unsupported(Exception):
    pass


def extract(ws):
    rows = {}
    for row in ws.iter_rows():
        label = row[0].value
        if isinstance(label, str):
            rows.setdefault(label.strip(), []).append([c.value for c in row[1:]])

    header = rows.get("Bezeichnung")
    if header is None:
        raise Unsupported("no month header row")
    columns = [i for i, v in enumerate(header[0]) if v in MONTHS]
    if not columns:
        raise Unsupported("the sheet lists weeks, not month columns")

    def first(prefix, exact=False):
        for label, lists in rows.items():
            if (label == prefix) if exact else label.startswith(prefix):
                return lists[0]
        return None

    def many(prefix):
        out = []
        for label, lists in rows.items():
            if label.startswith(prefix) and "Total" not in label and "kumul" not in label:
                out.append(lists[0])
        return out

    def cell(values, i):
        return values[i] if values is not None and i < len(values) else None

    def pick(lists, i):
        for values in lists:
            v = number(cell(values, i))
            if v is not None:
                return v
        return None

    code_row = first("QST-Tarifcode")
    sv_row = first("SV-Tage", exact=True)
    sb_row = first("QST-SB-Lohn", exact=True)
    sb_aperiodic_row = first("QST-SB-aperiodisch", exact=True)
    if code_row is None or sv_row is None or sb_row is None:
        raise Unsupported("a required row is missing (code, SV days or rate-defining salary)")
    rate_rows = many("QST-Satz")
    tax_rows = many("QST-Betrag")
    lohn_rows = many("QST-Lohn")
    total_lohn = first("QST-Lohn Total", exact=True)
    thirteenth_row = next((v[0] for k, v in rows.items() if re.match(r"^13\. Monatslohn", k)), None)
    weitere = first("Weitere Beschäftigung (X)", exact=True)
    bg_own = first("BG AG 1", exact=True)
    bg_other = first("BG andere AG", exact=True)
    bg_total = first("BG Total", exact=True)
    hours_row = first("Anzahl Stunden", exact=True)
    qst_hours = first("QST-Stunden", exact=True)
    pay_row = first("Stundenlohn", exact=True)
    entry_row = first("Eintritt", exact=True)
    exit_row = first("Austritt", exact=True)
    if not rate_rows or not tax_rows or not (lohn_rows or total_lohn):
        raise Unsupported("rate, tax or QST wage row is missing")

    # Entry and exit dates sit in the column of their month.
    def spells(row):
        out = {}
        for v in row or []:
            if hasattr(v, "year"):
                out[(v.year, v.month)] = v
        return out

    entries = spells(entry_row)
    exits = spells(exit_row)
    year = max([d.year for d in exits.values()] + [d.year for d in entries.values()])

    months = []
    for i in columns:
        month = MONTHS.index(header[0][i]) + 1
        code = cell(code_row, i)
        sv_days = number(cell(sv_row, i))
        if code is None or sv_days is None:
            continue
        code = str(code).replace("AON", "A0N")
        rate = pick(rate_rows, i)
        tax = pick(tax_rows, i)
        lohn = pick(lohn_rows, i)
        if lohn is None and total_lohn is not None:
            lohn = number(cell(total_lohn, i))
        sb = number(cell(sb_row, i))
        if rate is None or lohn is None or sb is None:
            continue
        scaled_rate = rate * 10000
        if abs(scaled_rate - round(scaled_rate)) > 1e-6:
            raise Unsupported(f"month {month}: rate {rate} has more than two decimals as a percentage")
        aperiodic = number(cell(sb_aperiodic_row, i)) or 0
        thirteenth = number(cell(thirteenth_row, i)) or 0
        lohn_r = to_rappen(lohn, f"month {month} QST-Lohn")
        aperiodic_r = to_rappen(aperiodic, f"month {month} aperiodic")
        thirteenth_r = to_rappen(thirteenth, f"month {month} 13th month")

        # Period from entry and exit in this month (the tax year only).
        entry = entries.get((year, month))
        leave = exits.get((year, month))
        if entry is not None and leave is not None:
            if leave < entry:
                raise Unsupported(f"month {month}: two spells of employment in one month")
            period = {"kind": "startAndEnd", "start": [year, month, entry.day], "end": [year, month, leave.day]}
        elif entry is not None:
            period = {"kind": "start", "date": [year, month, entry.day]}
        elif leave is not None:
            period = {"kind": "end", "date": [year, month, leave.day]}
        else:
            period = {"kind": "fullMonth"}

        # Employment: a second employer exists when "BG andere AG" has a value.
        other = number(cell(bg_other, i)) or 0
        employment = {"kind": "single"}
        if other > 0:
            own = number(cell(bg_own, i))
            total = number(cell(bg_total, i))
            if own is None or total is None:
                raise Unsupported(f"month {month}: employment levels are incomplete")
            own_p, total_p = own * 100, total * 100
            for name, value in (("own level", own_p), ("total level", total_p)):
                if abs(value - round(value)) > 1e-6:
                    raise Unsupported(f"month {month}: {name} {value}% is not an integer percentage")
            employment = {"kind": "levels", "ownPercent": round(own_p), "totalPercent": round(total_p)}
        elif cell(weitere, i) not in (None, ""):
            # Another job exists, its level is unknown: the own level is converted to 100% (KS 45 § 6.4).
            own = number(cell(bg_own, i))
            if own is None:
                raise Unsupported(f"month {month}: own employment level is missing")
            own_p = own * 100
            if abs(own_p - round(own_p)) > 1e-6:
                raise Unsupported(f"month {month}: own level {own_p}% is not an integer percentage")
            employment = {"kind": "ownLevelOnly", "ownPercent": round(own_p)}

        entry_month = {
            "month": month,
            "code": code,
            "rate": round(scaled_rate),
            "svDays": round(sv_days),
            "period": period,
            "employment": employment,
            "aperiodic": aperiodic_r,
            "thirteenthMonth": thirteenth_r,
            "expectedRateDefining": f"{sb:.4f}".rstrip("0").rstrip(".") if sb != round(sb, 2) else f"{sb:.2f}",
            "expectedTax": None if tax is None else round(tax * 100, 4),
        }
        if qst_hours is not None:
            # Hourly pay, weekly payment: the monthly sum is converted to 180 hours (KS 45 § 6.5).
            hours = number(cell(hours_row, i))
            if hours is None or hours == 0:
                raise Unsupported(f"month {month}: no hours")
            entry_month["hourly"] = {"pay": lohn_r - aperiodic_r, "hours": round(hours)}
            entry_month["periodic"] = 0
        else:
            entry_month["periodic"] = lohn_r - aperiodic_r - thirteenth_r
        months.append(entry_month)

    if not months:
        raise Unsupported("no month with data")
    return {"sheet": ws.title, "title": ws["A1"].value.strip(), "year": year, "months": months}


def main():
    wb = openpyxl.load_workbook(SOURCE, data_only=True)
    cases, skipped = [], {}
    for ws in wb.worksheets:
        if not re.match(r"^(Y?M|MY)\d", ws.title):
            continue
        if ws.title in SCOPE_SKIPS:
            skipped[ws.title] = SCOPE_SKIPS[ws.title]
            continue
        try:
            cases.append(extract(ws))
        except Unsupported as error:
            skipped[ws.title] = str(error)

    lines = [
        "// Generated by scripts/extract-swissdec-appendix.py from",
        "// sources/rules/Anhang_1_QST_Berechnung_Monat_20260306.xlsx. Do not edit.",
        "// Amounts are Rappen. Rates are hundredths of a percent. `expectedRateDefining` is CHF as the sheet shows it.",
        "",
        "export type AppendixPeriod =",
        '\t| { kind: "fullMonth" }',
        '\t| { kind: "start"; date: [number, number, number] }',
        '\t| { kind: "end"; date: [number, number, number] }',
        '\t| { kind: "startAndEnd"; start: [number, number, number]; end: [number, number, number] };',
        "",
        "export type AppendixMonth = {",
        "\tmonth: number;",
        "\tcode: string;",
        "\trate: number;",
        "\tsvDays: number;",
        "\tperiod: AppendixPeriod;",
        "\temployment:",
        '\t\t| { kind: "single" }',
        '\t\t| { kind: "levels"; ownPercent: number; totalPercent: number }',
        '\t\t| { kind: "ownLevelOnly"; ownPercent: number };',
        "\tperiodic: number;",
        "\tthirteenthMonth: number;",
        "\taperiodic: number;",
        "\thourly?: { pay: number; hours: number };",
        "\texpectedRateDefining: string;",
        "\t/** Rappen, as the sheet computes it (no rounding). */",
        "\texpectedTax: number | null;",
        "};",
        "",
        "export type AppendixCase = { sheet: string; title: string; year: number; months: AppendixMonth[] };",
        "",
        "export const SWISSDEC_APPENDIX_MONTHLY: AppendixCase[] = " + json.dumps(cases, ensure_ascii=False, indent=1) + ";",
        "",
    ]
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"included": [c["sheet"] for c in cases], "skipped": skipped}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    sys.exit(main())
