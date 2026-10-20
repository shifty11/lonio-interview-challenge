# Zurich source tax 2026: calculation logic

## Goal

Calculate the monthly source tax (Quellensteuer, QST) of an employee in the canton of Zurich for 2026.
This document defines the logic and the tests. Section 9 and `spec.md` define the TypeScript build.

## Scope

In scope:

- Year 2026, canton of Zurich, monthly model.
- Progressive tariffs A, B, C, H and G, with and without church tax.
- The flat-rate codes in the Zurich file (E, L, M, N, P, Q, HE, ME, NO), as simple lookups.
- The rate-defining salary for the normal case and for the special cases of the monthly model.
- The tax amount and its rounding.

Out of scope:

- The decision whether a person is subject to source tax at all. The caller supplies this.
- The subsequent ordinary assessment (nachträgliche ordentliche Veranlagung), for example above CHF 120,000 gross a year.
- Recalculation on request (Neuberechnung), hardship rules and corrections of earlier months.
- The annual model (Jahresmodell) of other cantons, and changes of canton.

The rate formula (section 11) explains how Zurich builds the rates, and it can project a table before the canton publishes it. The ESTV file stays the binding source for rates in the product.

## Sources

All files are in `sources/`. `scripts/fetch-sources.sh` downloads them again.

| File | What it gives |
|---|---|
| `sources/estv/tar26zh.txt` | The 2026 Zurich tariff, machine-readable. **The single source for rates.** |
| `sources/estv/qst-tarife-recordformate-loehne-2025-de.pdf` | The record format of the tariff file (sections 3.3, 4.2–4.4). |
| `sources/zh/*.pdf` | The readable Zurich tariff tables and the 2026 calculation parameters. Cross-check only. |
| `sources/zh/calculator/` | The JavaScript bundle of the official Zurich tariff calculator, and a readable copy. Source of `calculator-spec.md`. |
| `sources/rules/zstb-87-3.pdf` | Zurich employer guidance sheet (ZStB 87.3, valid from 1.1.2024). Tariff selection (no. 7–9), monthly base (no. 5), reference to KS 45 (no. 6, 11). |
| `sources/rules/zh-qvo1-631.41.pdf` | Zurich source-tax ordinance (QVO I). § 4: monthly gross income, no annual correction. |
| `sources/rules/estv-ks45-quellenbesteuerung.pdf` | ESTV circular 45. § 4: tariff selection. § 6: monthly model and rate-defining income. |
| `sources/rules/swissdec-richtlinien-elm-6.0.pdf` | Swissdec payroll guidelines ELM 6.0 (edition 6.3.2026). § 5.1.1: rounding. § 10.6: tax amount and rate-defining salary. |
| `sources/rules/Anhang_1_QST_Berechnung_*.xlsx` | Swissdec appendix 1: 47 worked cases for the monthly model, with Bern and Ticino 2019 rates. |
| `sources/rules/zh-kalte-progression-2026-631.1.pdf` | ZH ordinance on cold progression from 1.1.2026: the 2026 tax scales of § 35 StG (Grundtarif, Verheiratetentarif). |
| `sources/rules/estv-dbst-tarif-2026-2-215-D-2025.pdf` | ESTV circular 2-215: federal tax scales 2026 (Art. 36 DBG) and federal deductions 2026. |
| `scripts/formula.py` | The rate formula of section 11, with one named toggle per assumption. It compares every band with the ESTV file. |

Order of precedence: the ESTV file for rates. QVO I and ZStB 87.3 for the Zurich rules. KS 45 where Zurich has no own rule (ZStB 87.3 no. 6). Swissdec ELM 6.0 for the payroll calculation details, because certified payroll software must follow it (KS 45 § 6.1).

## Calculation overview

```
inputs ──► 1. tariff code ──────────────┐
       └─► 2. taxable salary (QST-Lohn) │
       └─► 3. rate-defining salary ─────┼─► 4. band lookup ─► rate
                                        │
       taxable salary × rate ◄──────────┘
             └─► 5. minimum tax ─► 6. rounding ─► tax amount
```

## 1. Tariff code

The code has three parts: tariff group, number of children, church tax flag. Example: `B2Y`.

`calculator-spec.md` holds the exact question flow and decision logic of the official Zurich calculator, extracted from its JavaScript bundle. It is the source for the code function. The rules in this section give the legal background.

### 1.1 Tariff group (ZStB 87.3 no. 7, KS 45 § 4)

| Group | When |
|---|---|
| A | Single, divorced, separated or widowed, and no children in the same household. |
| B | Married (or registered partnership), and only one spouse has earned income or replacement income. |
| C | Married (or registered partnership), and both spouses have earned income or replacement income, in Switzerland or abroad, of any amount. Exception: if the only income of the other spouse is taxed with code E, use B. |
| H | Single, divorced, separated or widowed, lives with children or dependants in the same household and pays most of their support. In a cohabiting couple with shared children, only the parent with the higher gross income gets H. The other parent gets A0. |
| G | Replacement income that an insurer pays directly to the person, not through the employer. |
| E | Simplified procedure (vereinfachtes Abrechnungsverfahren). The employer decides. |
| L, M, N, P, Q | Cross-border commuters from Germany with a valid Gre-1 or Gre-2 form. They mirror A, B, C, H and G. |

If the employee does not give reliable personal data (KS 45 § 4.1):

- single or civil status unknown: `A0Y`;
- married: `C0Y`.

If H is not clear (for example unclear cohabitation): use `A0` (KS 45 § 4.3).

### 1.2 Number of children (KS 45 § 4.7)

- Count the children who are minors or in their first education (with proof), and whose support the employee mainly pays.
- For H, a child must live in the same household, or be in alternating custody with the person as the main contributor (`calculator-spec.md` § 4.2).
- The file has 0–9 children. H has only 1–9. The code of G is always `G9N`.
- The code is authoritative. The children field (pos. 44–45) matches the code digit, except in `G9N` and `Q9N`, where it is `00`.
- More than 9 children: use 9. The record-format spec says "max. 9".

### 1.3 Church tax flag (ZStB 87.3 no. 8)

- `Y` if the person belongs to a state-recognised church (Landeskirche). Membership of a Zurich parish is not required.
- `N` otherwise.
- G is always `N`. The file has only `G9N`.

### 1.4 Timing (KS 45 § 4.1, § 4.2)

- The code depends on the situation at the date of payment.
- A change (marriage, divorce, birth, start or end of a job, entry to or exit from a church) applies from the **next month**.
- Exception: when a spouse starts to work, that spouse gets C at once. The other spouse gets C from the next month.

## 2. Taxable salary (QST-Lohn)

Sum of all taxable pay that the employer pays in the month (QVO I § 4, ZStB 87.3 no. 5, Swissdec § 10.6.1):

- salary, hourly or daily pay, overtime, allowances (family, meal, location), commissions;
- 13th month salary, bonus, gratuities, tips, long-service gifts;
- benefits in kind (valued with the AHV rates), employee shares, lump-sum expenses without an approved expense policy;
- severance pay;
- replacement income paid through the employer (sick pay, accident pay).

Pay that is due after the job ends uses the tariff code at the date of payment (KS 45 § 4.1).

## 3. Rate-defining salary (QST-SB-Lohn)

This value selects the band. Normally it is the same as the taxable salary.

### 3.1 Formula (Swissdec § 10.6.1)

```
rate_defining = periodic / sv_days × 30  +  aperiodic
```

- `periodic`: regular pay of the month. Salary-certificate items 1, 2 and 7. If you are not sure, the pay is periodic.
- `aperiodic`: irregular pay of the month. Salary-certificate items 3, 4 and 5: bonus, overtime pay, payment for unused holidays, long-service gifts, gratuities, severance pay, board fees, employee shares.
- `sv_days`: social-insurance days in the month (30 for a full month).
- Keep full precision. Do not round the rate-defining salary.

### 3.2 Start or end of the job in the month (KS 45 § 6.6, Swissdec § 10.6.1)

- Convert only the periodic pay to 30 days. Do not convert the aperiodic pay.
- Count the days with the social-insurance method. Examples from KS 45 § 6.6:

| Event | Days |
|---|---|
| Start on 31 March or on 30 March | 1 |
| Start on 29 March | 2 |
| Start on 29 Feb 2024 or on 28 Feb 2024 | 1 |
| Start on 28 Feb 2023 | 1 |
| Start on 27 Feb 2023 | 4 |
| End on 31 March or on 30 March | 30 |
| End on 29 March | 29 |
| End on 29 Feb 2024 or on 28 Feb 2024 | 30 |
| End on 28 Feb 2023 | 30 |
| End on 27 Feb 2023 | 27 |

Rule for March to January: a month always has 30 days. Start: days = max(30 − day + 1, 1). End: days = min(day, 30).
Rule for February: the last day counts as day 30. In a leap year, 28 February also counts as day 30 (see the 2024 rows). Other February days keep their number. This matches all rows of the table. See decision D5.

### 3.3 13th month salary (decision D2)

- Paid monthly with the salary: it is periodic pay. No special rule.
- Paid quarterly, half-yearly or yearly: see decision D2. Swissdec and KS 45 give different results here.

### 3.4 More than one employment (ZStB 87.3 no. 9, KS 45 § 6.4)

Each employer computes the rate-defining salary for its own job:

1. If the employer knows the real total income (for example two contracts with the same employer, or a group of companies): use the total income.
2. Else, if the employee tells the total employment level: periodic pay ÷ own level × total level.
3. Else: periodic pay ÷ own level × 100%.
4. If no employment level can be found (for example a lump-sum side job): add the tariff C median, CHF 5,875 (record `MED`).

Then add the aperiodic pay without conversion. The conversion starts or stops from the month after the other job starts or ends. There is no conversion if the only other income is taxed with code E.

Part-time with one employer and no other income: no conversion.

### 3.5 Hourly or daily pay that is not paid monthly (KS 45 § 6.5)

- Hourly: rate-defining salary = hourly pay (including holiday and public-holiday pay) × 180.
- Daily: rate-defining salary = daily pay × 21.667.
- If the rates differ in the period: use the weighted mean (total pay ÷ hours or days × 180 or 21.667).
- This rule also covers more than one job and a start or end of the job in the month.
- Hourly pay that is paid as a monthly salary: use sections 3.1–3.4. Get the employment level from the normal working hours of the company.

## 4. Band lookup

### 4.1 Record format (`tar26zh.txt`)

Fixed-width ASCII, CRLF. Positions count from 1.

| Pos | Field | Encoding |
|---|---|---|
| 1–2 | record type | `06` progressive, `11` fixed category, `12` collection fee, `13` median, `00` header, `99` trailer |
| 3–4 | transaction | `01` new, `02` change, `03` delete |
| 5–6 | canton | `ZH` |
| 7–16 | code | for example `A0N`, padded with spaces |
| 17–24 | valid from | `YYYYMMDD` |
| 25–33 | income from | Rappen (2 implied decimals) |
| 34–42 | band width | Rappen |
| 43 | gender | blank |
| 44–45 | children | `00`–`09` |
| 46–54 | minimum tax | Rappen. Record `13`: the median value. |
| 55–59 | rate | hundredths of a percent (`03127` = 31.27%) |
| 60–62 | status | blank |

### 4.2 Band layout (each progressive table, 315 rows)

| From (CHF) | Width (CHF) | Rows |
|---|---|---|
| 1 | 800 | 1 |
| 801 … 15,951 | 50 | 304 |
| 16,001, 18,001 | 2,000 | 2 |
| 20,001 … 45,001 | 5,000 | 6 |
| 50,001 | 50,000 | 1 |
| 100,001 | 1 | 1 (open to the top) |

### 4.3 Lookup rule

- Find the row where `from ≤ rate_defining < from + width`.
- If `rate_defining ≥ 100,001`: use the last row.
- If `rate_defining < 1`: the rate is 0 and the tax is 0.
- See decision D3 for amounts with cents at a band edge.

## 5. Tax amount

```
raw  = taxable_salary × rate / 100
tax  = max(raw, minimum_tax)      # minimum tax is 0 in every Zurich row
tax  = round_to_0.05(tax)         # see decision D1
```

- Multiply the **taxable** salary by the rate, not the rate-defining salary (Swissdec § 10.6.1, KS 45 § 6.2).
- Minimum tax rule: record-format spec § 4.4. In Zurich all rows have 0, but the code applies the rule, so that it works for other files.

## 6. Flat-rate codes (2026 Zurich file)

| Code | Rate | Note |
|---|---|---|
| `E0N`, `E0Y` | 5.00% | simplified procedure |
| `L0`–`L9`, `M0`–`M9`, `N0`–`N9`, `P1`–`P9` (N/Y) | 4.50% | German cross-border commuters |
| `Q9N` | 4.50% | German cross-border commuters, replacement income |
| `HEN`, `HEY` | 25.00% | board members (record `11`) |
| `MEN`, `MEY` | 31.50% | employee shares (record `11`) |
| `NON`, `NOY` | 0.00% | correction code (record `11`) |

These records have one row from CHF 1 with a very large width. The same lookup works for them.

## 7. Collection fee (information only)

Record `12`: `PEL` 2% (electronic filing), `PPA` 2% (paper), `PSP` 10% (simplified procedure). The canton pays this fee to the employer. It does not change the tax of the employee. Swissdec rounds the fee to CHF 0.05.

## 8. Decisions

| ID | Question | Recommendation | Status |
|---|---|---|---|
| D1 | Rounding of the tax amount | Round to CHF 0.05, halves up. One setting (`roundingStep`). Swissdec § 5.1.1 and the KS 45 examples (10 of 10) support it. The Swissdec appendix 1 workbook does not round. | decided |
| D2 | 13th month salary paid quarterly, half-yearly or yearly, and at a start or end of the job | Swissdec ELM 6.0 § 10.6.1.2: the 13th month salary is periodic pay and is converted with the other periodic pay. KS 45 § 6.3 adds 25%, 50% or 100% of one full 13th month salary instead. The results differ at a start or end of the job: Swissdec § 10.6.1.2 example 2 (end on 1 November) gives a rate-defining salary of CHF 156,499.50; the KS 45 rule gives about CHF 12,000. The KS 45 § 6.3 example and the KS 45 § 6.6 examples with a 13th month salary are therefore not test cases. | decided |
| D3 | Rate-defining salary with cents at a band edge (for example CHF 850.40) | Use the half-open interval `from ≤ x < from + width`. The last band of a table has no upper bound. No source defines this. This rule has no gaps. | decided |
| D4 | More than 9 children | Use 9. The Zurich calculator does the same (`calculator-spec.md` § 6.1). | decided |
| D5 | Day count in February of a leap year | Follow the KS 45 § 6.6 table: 28 and 29 February 2024 both count as day 30. | decided |

## 9. TypeScript build

`spec.md` gives the exact names, types and tests. The spec wins over this section.

### 9.1 Decisions of the user

- Scope: the tax amount and `computeTariffCode` in one change. Plan 2 builds the app on top of it.
- D1, D3 and D5: the recommendations of section 8.
- D2: Swissdec ELM 6.0 § 10.6.1.2, with a test for its two examples.
- No pull request. The change stays local as jj commits.

Decisions of the orchestrator:

- A minimal package (Bun, TypeScript, Zod v4, Biome) without Next.js. Plan 2 adds Next.js to it.
- Money in integer Rappen, the rate-defining salary as an exact fraction (`bigint`). No decimal library.
- The ESTV record parser and the monthly model are national modules (`estv/`, `monthly/`). The Zurich module holds the 2026 data and the tariff-code logic.
- The generator writes one TypeScript file with the 2026 tables and the code list. The file is committed.
- English texts for the no-source-tax result and the remark (plan 2 "English UI").

### 9.2 Order of work

1. Package scaffold: `package.json`, `tsconfig.json`, `biome.json`, `bunfig.toml`. Commands into `CLAUDE.md`.
2. ESTV parser and generator, the generated file, the regeneration test. This gives `TariffCode`.
3. Tariff code: answers schema, child results, residence result, `computeTariffCode`. Tests first.
4. `rateFor` and the full-file lookup test.
5. Social-insurance days and rate-defining salary. Tests first.
6. Tax amount: worked examples, Swissdec § 10.6.1.2 examples, rounding.
7. Swissdec appendix 1 cases in scope.
8. `scripts/zh-worked-examples.ts`.

### 9.3 Verification

- `bun test`, `bun run typecheck`, `bun run lint`: all pass.
- `bun run gen:tariff`, then `jj diff`: no change in the generated file.

### 9.4 End-to-end

There is no app yet. The end-to-end check runs the real functions on the real file:

- `bun run examples` prints the appendix table of this plan. Every code, rate, rate-defining salary and tax matches the table.
- `bun run examples` also prints the two Swissdec § 10.6.1.2 examples: 8,500.00 → 9.09% → 386.35, and 156,499.50 → 31.27% → 1,631.25.

## 10. Tests

| Oracle | What it checks |
|---|---|
| `scripts/compare.py` | The ESTV file matches the Zurich PDFs in every cell that the PDFs show. The PDFs cover 0–5 children: 52 of the 79 progressive tables. Codes with 6–9 children have no PDF cross-check. Result now: 52 tables, 0 mismatches. |
| ESTV file | For every code and every band: the lower edge, the upper edge and one value inside give the file rate. |
| Worked examples below | The end-to-end calculation with the real 2026 rates. |
| KS 45 examples (§ 6.3–6.6) | Rate-defining salary for start or end of the job, the 13th month salary, more than one job, hourly pay. |
| Swissdec appendix 1 (`M1`–`M47`) | The rate-defining salary and the tax amount of the cases in scope, with the rates of each case sheet in place of the Zurich rates. |
| KS 45 rounding examples | 1,024 × 11.1% → 113.65; 1,540 × 7.2% → 110.90; 1,485 × 11.4% → 169.30. |

## 11. Rate formula (reverse-engineered)

No source publishes the method. The parameter sheet gives the inputs only. The formula below comes from a fit against all 24,570 progressive bands of `tar26zh.txt`. `scripts/formula.py` holds it. Each assumption is a toggle there, and the defaults are the best fit.

### 11.1 Results

| Tariff | Bands that match exactly | Largest error | Status |
|---|---|---|---|
| A (0–9 children, N/Y) | 6,247 / 6,300 (99.2%) | 0.01 | solved |
| B (0–9 children, N/Y) | 6,258 / 6,300 (99.3%) | 0.01 | solved |
| H (1–9 children, N/Y) | 5,625 / 5,670 (99.2%) | 0.01 | solved |
| C (0–9 children, N/Y) | 1,445 / 6,300 (22.9%) | 3.49 | open |
| G | no model | – | open |

The remaining errors in A, B and H are all 0.01, at a rounding boundary of the rate (the raw rate is within about ±0.0006 of x.xx5). Tests showed that these steps do **not** explain them: rounding of the simple tax, of the canton tax or of the total, double rounding of the rate, and binary floating-point error.

### 11.2 Evaluation point

The table gives one rate per band. The rate is the rate of one monthly salary `m`:

| Band | m |
|---|---|
| 1–800 | 800 (upper bound) |
| from–to, width 50 to 50,000 | (from − 1 + to) / 2. Example: 2,551–2,600 → 2,575. |
| from 100,001 (open) | 100,000 |

Yearly gross `Y = 12 × m`.

### 11.3 Deductions (2026 parameter sheet)

```
social = 5.3% × Y  (AHV/IV/EO)
       + 6.5% × Y  (BVG)
       + 1.1% × min(Y, 148,200)  (ALV)
       + 1.0% × min(Y, 148,200)  (NBU)
net    = Y − social
```

| Deduction | Canton | Federal |
|---|---|---|
| Job costs | clamp(10% × Y, 6,600, 12,400) | 800 + 3,200 + clamp(3% × Y, 2,000, 4,000) |
| Insurance, single (A, H) | 2,900 | min(3% × Y, 1,800) |
| Insurance, married (B) | 5,800 | min(5% × Y, 3,700) |
| Insurance, per child | 1,300 | 700 |
| Child deduction, per child | 9,400 | 6,800 |
| Married-couple deduction (B) | – | 2,800 |

The percentage deductions use the gross `Y`, not `net`. The fit is clearly worse with `net`.

```
taxable = floor_100(net − deductions)      # separately for canton and federal
```

### 11.4 Canton and commune tax

```
scale  = Grundtarif (A)  or  Verheiratetentarif (B, H)      # § 35 StG 2026
simple = scale(taxable_canton)
canton = simple × (0.98 + commune) × factor + 24 × persons
```

- `commune` = 1.099 without church tax (N), 1.160 with church tax (Y). These are the weighted means from the parameter sheet.
- `factor` = **0.98 for the Grundtarif (A)**, 1.00 for the Verheiratetentarif (B, H). The factor is empirical. It is a sharp optimum: 0.979 or 0.981 gives fewer than a third of the matches. No source explains it.
- `24 × persons`: a fixed CHF 24 a year per person. `persons` = 2 for B, 1 for A and H. The lowest bands show it directly: A0 at band 801–850 is 2 ÷ 825 = 0.24%, and B0 is twice the A0 rate. This is probably the Zurich personal tax (Personalsteuer). I did not check the amount in the law.

### 11.5 Federal tax

```
scale   = single tariff (A)  or  married tariff (B, H)        # Art. 36 DBG 2026
federal = scale(taxable_federal) − 263 × children (B, H only)
federal = 0 if federal < 25                                    # Art. 36 Abs. 3 DBG
```

Tariff A gets no CHF 263 child credit. The A tables with children fit only without it.

### 11.6 Rate

```
rate = round_half_up((canton + federal) / Y × 100, 2)
```

### 11.7 Open: tariff C

C must combine the income of both spouses. The parameter sheet gives the median (CHF 5,875 a month) and the dual-earner deductions (canton CHF 6,200; federal CHF 8,600–14,100). The tested models do not fit:

- Household = own salary + spouse salary `S`, with `S` = min(own, 5,875 × 12), = 5,875 × 12, or = own salary. Married scales, deductions for both earners, rate = household tax ÷ household gross.
- With and without each dual-earner deduction, job costs for one or both earners, child deductions once or twice, personal tax for one or two persons, factor 0.98 or 1.00.

The best variant matches 114 of 939 test bands. If I solve for the spouse income `S` that reproduces each C0N band, `S` is CHF 300–400 above the own salary below CHF 6,000 a month. It then stays at about CHF 6,500–6,700 up to CHF 12,000, and it grows to about CHF 16,900 at CHF 75,000. So the construction is different from the tested ones.

### 11.8 Open: tariff G

G has no personal tax (the rate is 0.00% up to CHF 1,150 a month). At CHF 100,000 a month it is 37.20%, against 31.27% for A0N. This is close to the full marginal rates with almost no deductions. The parameter sheet says "canton Grundtarif, federal special tariff with a lump-sum deduction of CHF 6,300". A fit with one fixed deduction per level (canton and federal, with and without social deductions and factor 0.98) matches only 11 of 105 sample bands.

### 11.9 Next steps for the formula

1. Ask the Zurich tax office (Steueramt, source-tax division) for the method of tariffs C and G, and for the reason for the factor 0.98.
2. Before the 2027 tables are published: run `scripts/formula.py` with the 2027 parameters and compare when the 2027 file arrives. This tests whether the formula holds from year to year.

## Appendix: worked examples (2026 Zurich rates)

| Case | Code | Taxable | Rate-defining | Band | Rate | Raw | Tax (D1) |
|---|---|---|---|---|---|---|---|
| Full month | A0N | 6,000.00 | 6,000.00 | 5,951–6,000 | 6.79% | 407.40 | 407.40 |
| Married, sole earner, 2 children, church | B2Y | 9,000.00 | 9,000.00 | 8,951–9,000 | 3.28% | 295.20 | 295.20 |
| Married, dual earner | C0N | 7,500.00 | 7,500.00 | 7,451–7,500 | 8.89% | 666.75 | 666.75 |
| Single parent, 1 child, church | H1Y | 5,200.00 | 5,200.00 | 5,151–5,200 | 1.95% | 101.40 | 101.40 |
| Replacement income from insurer | G9N | 3,000.00 | 3,000.00 | 2,951–3,000 | 5.19% | 155.70 | 155.70 |
| Start on 15 March (16 days, § 3.2), salary 6,000 | A0N | 3,200.00 | 3,200 ÷ 16 × 30 = 6,000.00 | 5,951–6,000 | 6.79% | 217.28 | 217.30 |
| Salary 6,000 + bonus 10,000 | A0N | 16,000.00 | 16,000.00 | 15,951–16,000 | 15.95% | 2,552.00 | 2,552.00 |
| High salary | A0N | 120,000.00 | 120,000.00 | from 100,001 | 31.27% | 37,524.00 | 37,524.00 |
| Cents at band edge | A0N | 850.40 | 850.40 | 801–850 (D3) | 0.24% | 2.04096 | 2.05 |
