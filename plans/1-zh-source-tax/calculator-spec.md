# Zurich tariff calculator: extracted logic

This spec describes the logic of the Zurich source-tax calculator "Tarifrechner Quellensteuer" (Angular app "Quellensteuer Tarifbestimmung").
The calculator runs completely in the browser. It sends no data to a server.

- Page: https://www.zh.ch/de/steuern-finanzen/steuern/quellensteuer/quellensteuer-tarife.html
- Bundle: `sources/zh/calculator/main.872e860cd29e72f392d0.js`
- Readable copy: `sources/zh/calculator/main.pretty.js` (Prettier 3.3.3). Line numbers below refer to this file.

## 1. Code map

| Part | Lines | Function |
|---|---|---|
| Validity check (base class `cl`) | 15553–15613 | `hasInvalidPropertyValues` |
| Tariff service (`_l`) | 15681–15985 | `getRate`, `getMainIncomeRate`, `getReplacementIncomeRate`, `getRateGroup`, built-in examples |
| Child result service (`El`) | 16141–16438 | `getResultForMarriedPeople`, `getResultForUnmarriedPeople` |
| Child questionnaire (`Wl`) | 16592–17109 | question texts, `isVisible`, `parentsMarried` |
| Residence result service (`Zl`) | 17110–17208 | `getResult` |
| Residence questionnaire (`lc`) | 17209–17610 | question texts, `isVisible` |
| Main questionnaire (`Ic`) | 17610–18170 | question texts, `isVisible` |
| Result display (`app-questionnaire`) | 18779–18841 | `displayResult`, `getRate` ("Tarif: " prefix) |

## 2. Data model

```ts
type Response = {
  mainIncome?: boolean;                                   // true: earned income, false: replacement income
  civilStatusMarriedOrRegisteredRelationship?: boolean;
  recognizedReligiousAffiliation?: boolean;
  partnerEmployed?: boolean;
  withChildren?: boolean;
  childQuestionnaires: Child[];
  centerOfLifeQuestionnaire: CenterOfLife;
};

type Child = {
  group?: "UNDERAGE" | "IN_FIRST_APPRENTICESHIP" | "OTHER";
  childInSameHousehold?: boolean;
  parentalCare?: boolean;
  sharedCustody?: boolean;
  sameHousehold?: boolean;
  alternatingCustody?: boolean;
  mainFinancialContributor?: boolean;   // true: the taxable person, false: the other parent
  financiallySupported?: boolean;
};
type ChildResult = { parentsRateJustified: boolean; childCounts: boolean };

type CenterOfLife = {
  residenceInSwitzerland?: boolean;
  countryOfResidence?: "GERMANY" | "LIECHTENSTEIN" | "OTHER";
  dailyReturnToGermany?: boolean;
  dailyReturnToLiechtenstein?: boolean;
  moreThanFortyFiveNonReturnDays?: boolean;
  gre1_gre2?: boolean;
  dailyReturnToCountryOfResidenceReasonable?: boolean;
  gre3?: boolean;
};
type CenterOfLifeResult = { boarderCrosser: boolean; rate?: string; remark?: string };
```

## 3. Main questions

| # | Field | Question (German, as shown) | Answers | Visible when |
|---|---|---|---|---|
| 1 | `mainIncome` | Für welche Einkünfte möchten Sie den Quellensteuertarif ermitteln? | Erwerbseinkommen (true) / Ersatzeinkünfte (false) | always |
| 2 | `civilStatusMarriedOrRegisteredRelationship` | Zivilstand | Verheiratet oder eingetragene Partnerschaft (true) / Ledig, Geschieden, Getrennt, Verwitwet (false) | `mainIncome = true` |
| 3 | `recognizedReligiousAffiliation` | Konfession | röm.-kath., christ.-kath., evang.-ref. (true) / Keine oder andere (false) | civil status answered |
| 4 | `partnerEmployed` | Ist der Ehegatte / eingetragene Partner erwerbstätig oder bezieht er/sie Ersatzeinkünfte? | Ja / Nein | married and confession answered |
| 5 | `withChildren` | Married: Leibliche oder adoptierte Kinder der Person oder der Ehegatten bzw. Partner? Not married: Leibliche oder adoptierte Kinder der Person? | Ja / Nein | (married and #4 answered) or (not married and #3 answered) |
| 6 | children | one child questionnaire per child (section 4); button "Ein weiteres Kind erfassen" | – | `withChildren = true` |
| 7 | residence | residence questionnaire (section 5) | – | (`mainIncome = true` and #5 answered and every child has a result) or `mainIncome = false` |

When `withChildren` changes, the child list is cleared. When it becomes true, one empty child is added (line 17997).

## 4. Child questions (one set per child)

"Married" in this section means `partnerEmployed` is answered (`parentsMarried()`, line 16948). It does not read the civil status directly.

### 4.1 Questions

| Field | Question | Answers | Visible when |
|---|---|---|---|
| `group` | Kind minderjährig oder volljährig und in Erstausbildung? | Minderjährig (UNDERAGE) / Volljährig und in Erstausbildung (IN_FIRST_APPRENTICESHIP) / weder noch (OTHER) | always |
| `childInSameHousehold` | Wohnsitz des Kindes im selben Haushalt? | Ja / Nein | group is UNDERAGE or IN_FIRST_APPRENTICESHIP |
| `parentalCare` | Elterliche Sorge | Ja / Nein | UNDERAGE, not married, not in household |
| `sharedCustody` (variant 1) | Elterliche Sorge | Geteiltes Sorgerecht (true) / Alleiniges Sorgerecht (false) | UNDERAGE, in household |
| `sharedCustody` (variant 2) | Geteiltes Sorgerecht | Ja / Nein | UNDERAGE, married, not in household |
| `sameHousehold` | Gemeinsamer Haushalt mit dem anderen Elternteil? | Ja / Nein | (UNDERAGE, in household, shared custody) or (IN_FIRST_APPRENTICESHIP, in household) |
| `alternatingCustody` | Alternierende Obhut? | Ja / Nein | UNDERAGE and one of: (not in household, parental care) / (in household, not same household) / (married, not in household, shared custody) |
| `mainFinancialContributor` | Wer leistet den grösseren finanziellen Beitrag an den Unterhalt des Kindes? | Quellensteuerpflichtige Person (true) / Anderer Elternteil (false) | (UNDERAGE and one of: not in household + alternating custody / in household + same household + not married / in household + alternating custody) or (IN_FIRST_APPRENTICESHIP, not married, same household) |
| `financiallySupported` | Wird zur Hauptsache (mehr als 50%) für den Kindsunterhalt aufgekommen? | Ja / Nein | IN_FIRST_APPRENTICESHIP and (in household + not same household, or not in household) |

### 4.2 Child result: not married (lines 16278–16428)

`H` = `parentsRateJustified` (the child can justify tariff H). `count` = `childCounts` (the child counts for the digit).

| group | in household | further answers | H | count |
|---|---|---|---|---|
| UNDERAGE | yes | shared custody, same household, main contributor = person | yes | yes |
| UNDERAGE | yes | shared custody, same household, main contributor = other parent | no | no |
| UNDERAGE | yes | shared custody, not same household, alternating, main contributor = person | yes | yes |
| UNDERAGE | yes | shared custody, not same household, alternating, main contributor = other parent | no | no |
| UNDERAGE | yes | shared custody, not same household, not alternating | yes | yes |
| UNDERAGE | yes | sole custody | yes | yes |
| UNDERAGE | no | parental care, alternating, main contributor = person | yes | yes |
| UNDERAGE | no | parental care, alternating, main contributor = other parent | no | no |
| UNDERAGE | no | parental care, not alternating | no | no |
| UNDERAGE | no | no parental care | no | no |
| IN_FIRST_APPRENTICESHIP | yes | same household, main contributor = person | yes | yes |
| IN_FIRST_APPRENTICESHIP | yes | same household, main contributor = other parent | no | no |
| IN_FIRST_APPRENTICESHIP | yes | not same household, financially supported | yes | yes |
| IN_FIRST_APPRENTICESHIP | yes | not same household, not financially supported | no | no |
| IN_FIRST_APPRENTICESHIP | no | financially supported | **no** | **yes** |
| IN_FIRST_APPRENTICESHIP | no | not financially supported | no | no |
| OTHER | – | – | no | no |

### 4.3 Child result: married (lines 16152–16277)

For married people only `count` matters. `H` is always true and is not used.

| group | in household | further answers | count |
|---|---|---|---|
| UNDERAGE | yes | shared custody, same household | yes |
| UNDERAGE | yes | shared custody, not same household, alternating, main contributor = person | yes |
| UNDERAGE | yes | shared custody, not same household, alternating, main contributor = other parent | no |
| UNDERAGE | yes | shared custody, not same household, not alternating | no |
| UNDERAGE | yes | sole custody | yes |
| UNDERAGE | no | shared custody, alternating, main contributor = person | yes |
| UNDERAGE | no | shared custody, alternating, main contributor = other parent | no |
| UNDERAGE | no | shared custody, not alternating | no |
| UNDERAGE | no | no shared custody | no |
| IN_FIRST_APPRENTICESHIP | yes | same household | yes |
| IN_FIRST_APPRENTICESHIP | yes | not same household, financially supported | yes |
| IN_FIRST_APPRENTICESHIP | yes | not same household, not financially supported | no |
| IN_FIRST_APPRENTICESHIP | no | financially supported | yes |
| IN_FIRST_APPRENTICESHIP | no | not financially supported | no |
| OTHER | – | – | no |

Two rows differ from the not-married table in a way that is easy to miss:
- UNDERAGE in household, shared custody, not same household, not alternating: **no** for married, **yes** for not married.
- IN_FIRST_APPRENTICESHIP in household, same household: married does not ask for the main contributor.

## 5. Residence questions ("Angaben zum Lebensmittelpunkt")

For replacement income, the questions add "während oder vor Bezug der Ersatzeinkünfte" to the text.

| Field | Question | Visible when |
|---|---|---|
| `residenceInSwitzerland` | Hauptwohnsitz in der Schweiz? | always |
| `countryOfResidence` | Wohnsitzstaat: Deutschland / Liechtenstein / Anderes Land | not in Switzerland |
| `dailyReturnToGermany` | Tägliche Rückkehr an den Hauptwohnsitz in Deutschland? | Germany |
| `gre1_gre2` | Ansässigkeitsbescheinigung beigebracht? (Formular Gre-1 oder Gre-2) | Germany, daily return |
| `dailyReturnToCountryOfResidenceReasonable` | Tägliche Rückkehr grundsätzlich zumutbar (weniger als 100km Fahrdistanz)? | Germany, no daily return |
| `gre3` | Nachweis von mehr als 60 beruflich bedingten Nichtrückkehrtagen im Kalenderjahr beigebracht? (Formular Gre-3) | Germany, no daily return, return reasonable |
| `dailyReturnToLiechtenstein` | Tägliche Rückkehr an den Hauptwohnsitz in Liechtenstein? | Liechtenstein |
| `moreThanFortyFiveNonReturnDays` | Mehr als 45 beruflich bedingte Nichtrückkehrtage im Kalenderjahr? | Liechtenstein, no daily return |

### 5.1 Residence result (lines 17116–17198)

| Residence | Answers | Border crosser | Override |
|---|---|---|---|
| Switzerland | – | no | – |
| Germany | daily return, Gre-1/Gre-2 given | **yes** | – |
| Germany | daily return, no Gre-1/Gre-2 | no | – |
| Germany | no daily return, return reasonable, Gre-3 given | no | – |
| Germany | no daily return, return reasonable, no Gre-3 | **yes** | – |
| Germany | no daily return, return not reasonable | no | – |
| Liechtenstein | daily return | no | rate = "Grundsätzlich keine Quellensteuerpflicht", remark = "Unter Vorbehalt des Doppelbesteuerungsabkommens" |
| Liechtenstein | no daily return, more than 45 non-return days | no | remark only (the code stays) |
| Liechtenstein | no daily return, 45 non-return days or fewer | no | rate = "Grundsätzlich keine Quellensteuerpflicht", remark as above |
| Other country | – | no | – |

## 6. Result

### 6.1 Earned income (`mainIncome = true`, lines 15854–15918)

No result until the civil status, the confession, the residence result and (if married) `partnerEmployed` exist, and every child has a result. If `withChildren` is true and the child list is empty, there is also no result (lines 15876 and 15894). The UI prevents this case: it adds one child when `withChildren` becomes true.

```
church = recognizedReligiousAffiliation ? "Y" : "N"
if married:
    letter = partnerEmployed ? "C" : "B"
    digit  = number of children with count = yes
else:
    letter = (any child with H = yes) ? "H" : "A"
    digit  = number of children with count = yes
digit  = min(digit, 9)
if border crosser: letter = { A: L, B: M, C: N, H: P }[letter]
code   = letter + digit + church
```

Consequences:
- Not married with only children that count but do not justify H (adult child in first education, not in the household, financially supported) gives `A1`, `A2`, ….
- Not married with an H child gives `H` + the count of **all** counting children.

### 6.2 Replacement income (`mainIncome = false`, lines 15920–15942)

```
code = border crosser ? "Q" : "G"
```

The calculator shows only the letter (`G` or `Q`). The tariff file names the table `G9N` and `Q9N`.
A result needs the residence result. All other main answers and the child list must be empty.

### 6.3 Override and display (lines 15829–15853, 18829–18841)

- If the residence result has a `rate` text, that text replaces the code.
- A residence `remark` is shown with the result.
- A result of 3 characters or fewer is shown as "Tarif: " + code. A longer text is shown as it is.

## 7. Quirks of the calculator

1. **Hidden answers are cleared.** When a question becomes hidden, Angular destroys its component. The component then sends `value: undefined` (`ngOnDestroy`, lines 16064–16066 and 16515–16517), and the handler deletes the answer. So the stored answers always follow the visible path. `hasInvalidPropertyValues` is a guard: it gives no result if an answer off the path exists. Our implementation must also clear hidden answers.
2. **Child results are not recomputed when the civil status changes (bug).** "Married" for children is `partnerEmployed !== undefined`. When the civil status changes, `partnerEmployed` is cleared, but each child keeps the result it computed before. A child updates its result only when one of its own answers changes (`update()`, line 16938). Verified in the live calculator on 2026-10-20:
   1. Earned income, married, no church, partner employed, children yes, child 1 "weder noch", residence Switzerland → `C0N`.
   2. Change the civil status to "Ledig, Geschieden, Getrennt, Verwitwet". Answer children "Ja" again and residence Switzerland.
   3. Result: `H0N` (child shows "Kind Ergebnis: H0"). The married child result `{ parentsRateJustified: true }` stays and gives H. The tariff file has no `H0` table. A fresh entry of the same answers gives `A0N`.

   Our implementation computes all results from the current answers, so it gives `A0N` here.
3. **No fallbacks.** The calculator has no rule for missing data (KS 45 § 4.1: `A0Y` or `C0Y`). It also does not apply "changes count from the next month". These rules stay in the payroll process, not in the code function.
4. **G and Q ignore church tax and children.** This matches the tariff file.

## 8. Built-in examples (oracle)

The bundle contains two read-only examples with their expected results (lines 15689–15819):

| Example | Expected |
|---|---|
| Earned income, not married, no church; children: UNDERAGE in household + shared custody + same household + main contributor = person; UNDERAGE not in household + parental care + alternating + main contributor = person; IN_FIRST_APPRENTICESHIP not in household + financially supported; OTHER; residence Switzerland | `H3N` |
| As above with 3 more OTHER children; residence Germany, no daily return, return reasonable, no Gre-3 | `P3N` |

## 9. Golden cases (derived from the code)

| # | Input | Expected |
|---|---|---|
| 1 | Earned, not married, no church, no children, Switzerland | `A0N` |
| 2 | Earned, married, church, partner not employed, no children, Switzerland | `B0Y` |
| 3 | Earned, married, no church, partner employed, 2 × UNDERAGE in household + shared custody + same household | `C2N` |
| 4 | Earned, not married, church, 1 × UNDERAGE in household + sole custody | `H1Y` |
| 5 | Earned, not married, no church, 1 × UNDERAGE not in household + no parental care | `A0N` |
| 6 | Earned, not married, no church, 1 × IN_FIRST_APPRENTICESHIP not in household + financially supported | `A1N` |
| 7 | Earned, not married, no church, 1 × UNDERAGE in household + shared custody + same household + main contributor = other parent | `A0N` |
| 8 | Earned, married, partner not employed, no church, 10 × UNDERAGE in household + sole custody | `B9N` |
| 9 | Earned, married, partner not employed, no church, 1 × UNDERAGE not in household + sole custody | `B0N` |
| 10 | Earned, not married, no church, no children, Germany + daily return + Gre-1 | `L0N` |
| 11 | Same as 10 without Gre-1 | `A0N` |
| 12 | Earned, married, partner employed, church, no children, Germany + no daily return + reasonable + no Gre-3 | `N0Y` |
| 13 | Same as 12 with Gre-3 | `C0Y` |
| 14 | Earned, not married, no church, no children, Liechtenstein + daily return | "Grundsätzlich keine Quellensteuerpflicht" + remark |
| 15 | Same as 14, no daily return, more than 45 non-return days | `A0N` + remark |
| 16 | Replacement income, Switzerland | `G` |
| 17 | Replacement income, Germany + daily return + Gre-1 | `Q` |

## 10. Live check (2026-10-20)

Playwright opened the calculator snippet (bundle `main.872e860cd29e72f392d0.js`, the same file as the saved copy). Each case started from a fresh page load, and the answers were entered top-down.

| Case | Expected | Live result | Pass |
|---|---|---|---|
| Built-in example H3N | `H3N` | Tarif: H3N | yes |
| Built-in example P3N | `P3N` | Tarif: P3N | yes |
| #6 | `A1N` | Tarif: A1N | yes |
| #7 | `A0N` | Tarif: A0N | yes |
| #9 | `B0N` | Tarif: B0N | yes |
| #12 | `N0Y` | Tarif: N0Y | yes |
| #14 | no source tax + remark | Grundsätzlich keine Quellensteuerpflicht · Unter Vorbehalt des Doppelbesteuerungsabkommens | yes |
| #15 | `A0N` + remark | Tarif: A0N · Unter Vorbehalt des Doppelbesteuerungsabkommens | yes |
| #16 | `G` | Tarif: G | yes |
| #17 | `Q` | Tarif: Q | yes |
| Civil status change (§ 7 item 2) | `A0N` from the spec | Tarif: H0N | no: calculator bug |

Cases #1–5, #8, #10, #11 and #13 are not checked live. They use the same rows as the checked cases.
