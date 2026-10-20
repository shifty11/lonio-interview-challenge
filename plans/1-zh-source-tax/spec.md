# Spec: Zurich source tax 2026 in TypeScript

This spec wins over `plan.md`. `plan.md` gives the rules and their sources. `calculator-spec.md` gives the tariff-code logic.

## 1. Scope

In scope:

- A minimal package: Bun, TypeScript (strict), Zod v4, Biome. No Next.js. Plan 2 adds Next.js to this package.
- `computeTariffCode` and its parts: the complete answers schema, the child results, the residence result.
- The ESTV tariff file parser, the generated 2026 Zurich tables, the rate lookup.
- The social-insurance days, the rate-defining salary, the tax amount.

Out of scope (plan 2): the flow engine, the draft schema, the question data, `previewTariff`, the onboarding schema, persistence, server, UI. Also out of scope: the items of `plan.md` "Out of scope", and the `plan.md` § 11 rate formula.

## 2. Package

| File | Content |
|---|---|
| `package.json` | `"type": "module"`. Scripts below. Dependencies: `zod` (v4). Dev: `typescript`, `@biomejs/biome`, `@types/bun`. |
| `tsconfig.json` | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noEmit`, `moduleResolution: "bundler"`, `include: ["src", "scripts"]`. |
| `biome.json` | Lint and format. Ignore the generated file. |
| `bunfig.toml` | `[test] root = "src"`. |

Scripts: `test` (`bun test`), `typecheck` (`tsc --noEmit`), `lint` (`biome check .`), `format` (`biome format --write .`), `gen:tariff` (`bun scripts/gen-tariff-data.ts`), `examples` (`bun scripts/zh-worked-examples.ts`). Add each command to the "Commands" section of `CLAUDE.md` after it runs.

## 3. Layout

```
src/domain/source-tax/
  types.ts                 Canton, TariffResult
  money.ts                 Rappen, Ratio, rounding
  estv/                    ESTV record format: national, no canton logic
    record.ts              parseTariffFile(text): TariffFile
    lookup.ts              rateFor(file, code, rateDefining)
  monthly/                 monthly model: KS 45 § 6, Swissdec § 10.6
    sv-days.ts             socialInsuranceDays
    rate-defining.ts       rateDefiningSalary
    tax.ts                 sourceTax
  zurich/
    codes.ts               TariffCode (z.enum of the generated list)
    tariff-2026.generated.ts
    schema.ts              ZhAnswersSchema and its parts
    children.ts            childResultMarried, childResultUnmarried
    residence.ts           residenceResult
    compute.ts             computeTariffCode
scripts/
  gen-tariff-data.ts       sources/estv/tar26zh.txt → zurich/tariff-2026.generated.ts
  zh-worked-examples.ts    prints the plan.md appendix table from the real functions
```

`src/domain` imports nothing from React, Next.js, Prisma or `node:*`. A test can read a file with `Bun.file`.

## 4. Numbers

- Money is an integer number of Rappen (`Rappen` = branded `number`, `Number.isSafeInteger`). No `number` holds CHF with a fraction.
- A rate is an integer in hundredths of a percent, as the file stores it (`679` = 6.79%).
- `Ratio = { num: bigint; den: bigint }`, `den > 0`, in Rappen. The rate-defining salary is a `Ratio`. It is never rounded (Swissdec § 10.6.1).
- The factors are exact: 30 days, 180 hours, 21.667 days = `21667 / 1000`.
- Compare a `Ratio` with a band edge by cross-multiplication in `bigint`.

## 5. Tariff code

### 5.1 Answers schema (`zurich/schema.ts`)

Field names and the mapping to the calculator names: `plan.md` of plan 2 § 1 ("Field names"). Enums: `incomeType` (`earned` | `replacement`), `civilStatus` (`married` | `single`), `group` (`underage` | `firstEducation` | `other`), `mainFinancialContributor` (`person` | `otherParent`), `countryOfResidence` (`DE` | `LI` | `other`). All other answers are booleans.

`ZhAnswersSchema` is the complete answer set, a nested discriminated union of `z.strictObject`:

- on `incomeType`: `earned` has `civilStatus`, `churchMember`, `children`, `residence`; `replacement` has `residence` only;
- on `civilStatus`: `married` adds `spouseEmployed`; `single` has no spouse field;
- `children` on `hasChildren`: `false` has no list; `true` has `list` with at least one child. A married person's child is a `MarriedChild`; a single person's child is an `UnmarriedChild`;
- `MarriedChild` and `UnmarriedChild`: one union member per row of `calculator-spec.md` § 4.3 and § 4.2. A member holds exactly the answers that are visible on that row (§ 4.1);
- `residence`: one member per row of § 5.1.

Types come from `z.infer` only.

### 5.2 Child and residence results

- `childResultUnmarried(child): { justifiesH: boolean; counts: boolean }`: § 4.2, row by row.
- `childResultMarried(child): { counts: boolean }`: § 4.3, row by row.
- `residenceResult(residence): { borderCrosser: boolean; override: "noSourceTax" | null; remark: "dtaReservation" | null }`: § 5.1, row by row.

Each row cites `calculator-spec.md` § and the `main.pretty.js` line.

### 5.3 `computeTariffCode(answers: ZhAnswers): TariffResult`

```ts
type TariffResult =
  | { kind: "code"; code: TariffCode; remark: string | null }
  | { kind: "noSourceTax"; text: string; remark: string | null };
```

- Logic: `calculator-spec.md` § 6.1, § 6.2, § 6.3. Digit capped at 9. Border-crosser map A→L, B→M, C→N, H→P.
- Replacement income gives `G9N`, or `Q9N` for a border crosser. The calculator shows `G` and `Q` (§ 6.2).
- Texts, exactly: `noSourceTax` text = `"No source tax in principle"`. Remark `dtaReservation` = `"Subject to the double taxation agreement"`. Each constant cites the German original of § 5.1.
- The function builds the code string and parses it with `TariffCode.parse`. A failure is a programming error and throws.
- Every `switch` on a union is exhaustive and ends with a `never` check.

### 5.4 `TariffCode` (`zurich/codes.ts`)

`TariffCode = z.enum(ZH_2026_CODES)`. `ZH_2026_CODES` is the `as const` list of every code in records `06` and `11` of the file, in file order. The generator writes it.

## 6. ESTV file (`estv/record.ts`)

`parseTariffFile(text: string): TariffFile`. Format: `plan.md` § 4.1. It reads records `00`, `06`, `11`, `12`, `13`, `99`.

```ts
type Band = { from: Rappen; width: Rappen; minTax: Rappen; rate: number };
type TariffFile = {
  canton: string;
  validFrom: string;                       // YYYYMMDD
  tables: Record<string, readonly Band[]>; // records 06 and 11, sorted by `from`
  medians: Record<string, Rappen>;         // record 13, for example MED
  fees: Record<string, number>;            // record 12, rate in hundredths of a percent
};
```

The parser throws an `Error` with the line number when a check fails:

- header `00` and trailer `99` exist, and the record count in the trailer matches;
- each table of record `06` starts at 1, has no gap and no overlap;
- the children field matches the code digit, except in `G9N` and `Q9N` (`00`);
- transaction is `01`.

It returns `warnings: string[]` when a rate goes down as income goes up (warn only).

## 7. Generated data

`scripts/gen-tariff-data.ts` reads `sources/estv/tar26zh.txt` (latin1), calls `parseTariffFile`, and writes `src/domain/source-tax/zurich/tariff-2026.generated.ts`:

- `export const ZH_2026_CODES = [...] as const;`
- `export const ZH_2026: TariffFile = {...};` with a typed annotation, not `as const`.
- A header comment: generated, source file, do not edit.

The output is deterministic. A test regenerates the content in memory and compares it with the committed file.

## 8. Lookup (`estv/lookup.ts`)

`rateFor(file, code, rateDefining: Ratio): { rate: number; minTax: Rappen; band: Band | null }`

- `rateDefining < 100` Rappen (CHF 1): rate 0, min tax 0, band `null` (`plan.md` § 4.3).
- Else the band with `from ≤ x < from + width` (D3, half-open).
- The last band of a table has no upper bound. It covers every `x ≥ from` (the `100,001` row and the flat-rate rows).
- An unknown code throws.

## 9. Social-insurance days (`monthly/sv-days.ts`)

`socialInsuranceDays(period: Period): number` with

```ts
type Period =
  | { kind: "fullMonth" }
  | { kind: "start"; date: PlainDate }
  | { kind: "end"; date: PlainDate }
  | { kind: "startAndEnd"; start: PlainDate; end: PlainDate }; // same month
type PlainDate = { year: number; month: number; day: number };
```

Day number `n(d)` (KS 45 § 6.6, D5): day 31 is 30. The last day of February is 30. In a leap year, 28 February is also 30. Other days keep their number.

- `fullMonth`: 30.
- `start`: `max(30 − n + 1, 1)`.
- `end`: `min(n, 30)`.
- `startAndEnd`: `max(n(end) − n(start) + 1, 1)`. Start and end in another month, or end before start: throw.

## 10. Rate-defining salary (`monthly/rate-defining.ts`)

```ts
type MonthInput = {
  code: TariffCode;
  pay:
    | { kind: "monthly"; periodic: Rappen; thirteenthMonth: Rappen; period: Period }
    | { kind: "hourly"; pay: Rappen; hours: Ratio }   // KS 45 § 6.5
    | { kind: "daily"; pay: Rappen; days: Ratio };    // KS 45 § 6.5
  aperiodic: Rappen;
  employment:                                          // KS 45 § 6.4, ZStB 87.3 no. 9
    | { kind: "single" }
    | { kind: "totalIncomeKnown"; otherPeriodic: Rappen }
    | { kind: "levels"; ownPercent: number; totalPercent: number }
    | { kind: "ownLevelOnly"; ownPercent: number }
    | { kind: "noLevel" };
};
```

- `periodic`: salary-certificate items 1, 2 and 7. `aperiodic`: items 3, 4 and 5 (Swissdec § 10.6.1).
- **13th month salary (D2): Swissdec ELM 6.0 § 10.6.1.2.** `thirteenthMonth` is periodic pay. It is added to `periodic` and converted with it. KS 45 § 6.3 adds a share of one full 13th month salary instead. The code does not implement KS 45 § 6.3. The doc comment of `thirteenthMonth` says this.
- Monthly: `p = (periodic + thirteenthMonth) / socialInsuranceDays(period) × 30`. Then employment:
  - `single`: `p`;
  - `totalIncomeKnown`: `p + otherPeriodic`;
  - `levels`: `p / ownPercent × totalPercent`;
  - `ownLevelOnly`: `p / ownPercent × 100`;
  - `noLevel`: `p + file.medians.MED`.
  Then add `aperiodic` without conversion.
- Hourly: `pay / hours × 180 + aperiodic`. Daily: `pay / days × 21667/1000 + aperiodic`. `employment` must be `single` (KS 45 § 6.5 covers more than one job). Else throw.
- Percent values are integers 1–100, `ownPercent ≤ totalPercent`. Else throw.

`rateDefiningSalary(input, file): Ratio`.

## 11. Tax (`monthly/tax.ts`)

```ts
type TaxOptions = { roundingStep: 5 | 1 };   // Rappen; default 5 (D1)
sourceTax(input: MonthInput, file: TariffFile, options?: TaxOptions): {
  code: TariffCode;
  taxableSalary: Rappen;       // periodic + thirteenthMonth + aperiodic, or pay + aperiodic
  rateDefiningSalary: Ratio;
  rate: number;                // hundredths of a percent
  tax: Rappen;
};
```

- `raw = taxableSalary × rate / 10000` Rappen, kept exact (integer numerator over `10000`).
- `tax = max(raw, minTax)`.
- Round to `roundingStep` Rappen, halves up, on the exact value (Swissdec § 5.1.1). Example: `425000 × 909 / 10000 = 38632.5` Rappen → `38635`.

## 12. Tests

Each case has a `source` string. Tables are data-driven.

| File | Cases |
|---|---|
| `zurich/compute.test.ts` | `calculator-spec.md` § 9 golden cases 1–17 (16 → `G9N`, 17 → `Q9N`), § 8 built-in `H3N` and `P3N` |
| `zurich/children.test.ts` | every row of § 4.2 and § 4.3 |
| `zurich/residence.test.ts` | every row of § 5.1 |
| `zurich/schema.test.ts` | a married child on a single person fails; an answer off the path fails (strict); `hasChildren: true` with an empty list fails |
| `zurich/codes.test.ts` | every code that `computeTariffCode` can build (A0–9, B0–9, C0–9, H1–9, L0–9, M0–9, N0–9, P1–9 × N/Y, G9N, Q9N) is in `TariffCode` |
| `estv/record.test.ts` | each parser check rejects a broken fixture; the real file parses with 0 errors |
| `zurich/generated.test.ts` | regenerate equals the committed file |
| `estv/lookup.test.ts` | every code and every band of the real file: lower edge, upper edge (`from + width − 1` Rappen, not on the last band), one value inside give the file rate; the last band at CHF 1,000,000; `x < 1` CHF gives 0; D3: CHF 850.40 → band 801–850 |
| `monthly/sv-days.test.ts` | every row of the `plan.md` § 3.2 table; `startAndEnd`; the throw cases |
| `monthly/rate-defining.test.ts` | KS 45 examples without a 13th month salary (§ 6.4, § 6.5, § 6.6); each employment kind; Swissdec § 10.6.1.2 example 1 (end 15 March, rate-defining 8,500.00) and example 2 (end 1 November, rate-defining 156,499.50) |
| `monthly/tax.test.ts` | `plan.md` appendix rows 1–9; KS 45 rounding (1,024 × 11.1% → 113.65; 1,540 × 7.2% → 110.90; 1,485 × 11.4% → 169.30); Swissdec § 10.6.1.2 example 1 → A0N 9.09%, tax 386.35; example 2 → A0N 31.27%, tax 1,631.25; `roundingStep: 1` |
| `monthly/swissdec-appendix.test.ts` | Swissdec appendix 1 (monthly workbook): the cases in scope (no correction, no canton change, no annual model), at least 8, each with its sheet name. The rates come from the case sheet. Compare the rate-defining salary exactly and the tax at `roundingStep: 1` within 1 Rappen. `notes/impl-result.md` lists each skipped sheet and the reason. |

The KS 45 § 6.3 example and the KS 45 § 6.6 examples with a 13th month salary give a different result under Swissdec. They are not test cases. The D2 row in `plan.md` § 8 records this.

## 13. Checks

`bun test`, `bun run typecheck`, `bun run lint`, `bun run gen:tariff` (no diff), `bun run examples` (prints the `plan.md` appendix values).
