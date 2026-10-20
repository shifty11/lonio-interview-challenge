# Edge cases that the build does not cover

This list names the cases that the code of plan 1 does not calculate, or that no test checks. Each row gives the source and what the code does now.

## 1. Input limits of the code

| Case | Source | What the code does |
|---|---|---|
| Total employment level above 100% (the sheet adds 101.21% for two jobs in one month) | Swissdec appendix 1 M9 (September) | `0 < ownPercent ≤ totalPercent ≤ 100`. A total above 100% throws an error. That month is not a test case. |
| Amount that is not a whole number of Rappen (for example a pro-rata 13th month salary of 1/12 × 23,000 = 1,916.666…) | Swissdec appendix 1 M11_AG2 (March), M19 (October), M20 (October), M30_AG1 (April), M30_AG2 (December), M34 (August), M47 (December) | Money is an integer number of Rappen. The caller must round the amount before the call. The workbook does not round it. These months are not test cases. The other months of the sheets are. |
| Two periods of employment in one month (for example leave on 10 February, new job on 21 February) | Swissdec appendix 1 M16 (February), M45 (February) | `Period` has one start and one end. The caller cannot give two periods. |
| Hourly or daily pay together with a second job | KS 45 § 6.5 | `employment` must be `single` for hourly and daily pay. KS 45 § 6.5 says that the conversion to 180 hours or 21.667 days covers more than one job. |
| Hourly pay: only capital settlements for recurring benefits are added without conversion | KS 45 § 6.5 | The code adds all `aperiodic` pay. The caller must give only the capital settlements. |
| Change of the employment level in the month | KS 45 § 6.4 | No input exists. The caller gives one level for the month. |

## 2. Rules that the caller must apply

The code calculates one month with the inputs that it gets. It does not apply these rules:

| Case | Source |
|---|---|
| A change of the personal situation (marriage, divorce, birth, start or end of a job, church entry or exit) applies from the next month. Exception: a spouse who starts to work gets C at once; the other spouse gets C from the next month. | KS 45 § 4.1, § 4.2 |
| The conversion for a second job starts or stops in the month after the other job starts or ends. | KS 45 § 6.4 |
| No conversion when the only other income is taxed with code E. | KS 45 § 6.4 |
| No reliable personal data: `A0Y` (single or unknown) or `C0Y` (married). | KS 45 § 4.1 |
| H is not clear (for example an unclear cohabitation): `A0`. | KS 45 § 4.3 |
| In a cohabiting couple with shared children, only the parent with the higher gross income gets H. The other parent gets A0. | KS 45 § 4.3 |
| Pay after the end of the job uses the tariff code at the date of payment. | KS 45 § 4.1 |
| Family allowances paid in full in a month with a start or end: the conversion gives a rate that is too high. The employee can ask for a recalculation. | Swissdec § 10.6.1.3 |
| A 13th month salary at a start or end of the job can give a very high rate (Swissdec § 10.6.1.2 example 2: CHF 156,499.50). The employee can ask for a recalculation until 31 March of the next year. | Swissdec § 10.6.1.2, D2 |

## 3. Processes out of scope

| Case | Source | Swissdec appendix 1 sheets |
|---|---|---|
| Corrections of earlier months | Swissdec appendix 1 | M14.1, M35, M40, M41, M42 |
| Payments after the end of the job, in the next tax year, or with a new tariff code in the payment month | KS 45 § 4.1, § 6.9 | M36, M37, M38 |
| Foreign working days of a person who lives abroad (Ausscheidung Auslandtage) | KS 45 § 6.7 | M19.1, M31, M32, M33, M33.1, M38.1 |
| Change of canton | KS 45 § 8 | M46 |
| Annual model, and a change between the annual and the monthly model | KS 45 § 7 | YM43, MY44, the annual workbook |
| Payments before the start of the job | KS 45 § 6.8 | none |
| Hardship rules | KS 45 § 4.9 | none |
| Weekly pay lists (temporary staff with accident benefits) | Swissdec appendix 1 | M12 |
| Subsequent ordinary assessment (for example above CHF 120,000 gross a year) and recalculation on request | KS 45 § 11 | none |
| The decision whether a person is subject to source tax | plan.md "Out of scope" | none |

## 4. Tests that do not exist

| Case | Reason |
|---|---|
| KS 45 § 6.3 example and the KS 45 § 6.6 examples with a 13th month salary | The code follows Swissdec § 10.6.1.2 (D2). KS 45 gives a different rate-defining salary. |
| A minimum tax above 0 | Every Zurich row has a minimum tax of 0. Only a constructed test fixture checks the rule. |
| Swissdec appendix 1: the tax with the Zurich rates | The appendix uses the rates of its own case sheets (Bern and Ticino 2019). The test checks the rate-defining salary exactly (rounded to the decimals that the sheet shows, with difference 0). The tax check uses the rate of the same sheet. It tests the product and the rounding only, at `roundingStep: 1` within 1 Rappen. |
| The leap-year February days that the KS 45 § 6.6 table does not list (for example a start on 27 February 2024) | D5 follows the table. No source confirms the other leap-year days. |
| Codes with 6–9 children | The Zurich PDFs show 0–5 children. Only the ESTV file gives these rates. |

## 5. Tariff code: differences from the calculator

| Case | Source | What the code does |
|---|---|---|
| A change of the civil status after a child was entered | `calculator-spec.md` § 7.2 | The calculator keeps the old child result and gives `H0N`. The code calculates from the current answers and gives `A0N`. |
| Replacement income | `calculator-spec.md` § 6.2 | The calculator shows `G` or `Q`. The code gives `G9N` or `Q9N`, the names of the tables in the file. |
| Missing data | `calculator-spec.md` § 7.3 | The calculator has no fallback. The code has none either. See section 2. |

## 6. Rate formula

`plan.md` § 11 is out of scope. The formula does not explain tariffs C and G. The code reads all rates from the ESTV file.
