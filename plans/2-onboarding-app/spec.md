# Spec: onboarding app

This spec wins over `plan.md`. `plans/1-zh-source-tax/calculator-spec.md` is "calc-spec" below.

## 1. Scope and rounds

| Round | Plan steps | Content | New dependencies |
|---|---|---|---|
| A | 2, 3, 4, 5 | flow engine, ZH flow data, draft schema, preview, onboarding schema, `employeeTariff`, their tests | none |
| B | 1, 6, 7, 8 | Next.js scaffold, Prisma 8 + Postgres, repository, server action, HR dashboard, seed | Next.js, React, Tailwind, shadcn/ui, Prisma 8, `next-safe-action` |
| C | 9, 10, 11 | form UI, Playwright, README, CLAUDE.md commands | React Hook Form, `@hookform/resolvers`, `@next-safe-action/adapter-react-hook-form`, Playwright |

The orchestrator commits after each round. The implementer does not commit.

Checks at the end of each round (all must pass):

- `bun run typecheck`, `bun run lint`, `bun test`.
- `bun run gen:tariff` gives no diff. `bun run examples` exits with 0.
- Round B: `docker compose up -d`, `bun run db:init` on an empty database, `bun run db:seed`, `bun run build`.
- Round C: also `bun run test:e2e`.

## 2. Names: the existing schema is the source

The question `id`s are the dot paths of `ZhAnswersSchema` in `src/domain/source-tax/zurich/schema.ts`. Do not rename a field of that file.

The UI draft (`plan.md` § 4 link) shows layout only. Its field names (`inHousehold`, `country`, `dailyReturnDE`, …) are not the names of this app. Do not copy them.

Question ids, in calculator order:

| id | Options (value: English label) | Visible when | Source |
|---|---|---|---|
| `incomeType` | `earned`: Earned income / `replacement`: Replacement income | always | calc-spec § 3 #1 |
| `civilStatus` | `married`: Married or registered partnership / `single`: Single, divorced, separated, widowed | `incomeType = earned` | § 3 #2 |
| `churchMember` | `true`: Roman Catholic, Christian Catholic, Protestant Reformed / `false`: None or other | `civilStatus` answered | § 3 #3 |
| `spouseEmployed` | yes / no | married and `churchMember` answered | § 3 #4 |
| `children.hasChildren` (2 label variants) | yes / no | (married and `spouseEmployed` answered) or (single and `churchMember` answered) | § 3 #5 |
| `children.list` (repeating group, "Add another child") | – | `children.hasChildren = true` | § 3 #6 |
| `children.list.<i>.group` | `underage`: Minor / `firstEducation`: Adult in first education / `other`: Neither | always (in the item) | § 4.1 |
| `children.list.<i>.childInSameHousehold` | yes / no | § 4.1 | § 4.1 |
| `children.list.<i>.parentalCare` | yes / no | § 4.1 (not married only) | § 4.1 |
| `children.list.<i>.sharedCustody` (variant 1) | `true`: Shared custody / `false`: Sole custody | § 4.1 | § 4.1 |
| `children.list.<i>.sharedCustody` (variant 2) | yes / no | § 4.1 (married only) | § 4.1 |
| `children.list.<i>.sameHousehold` | yes / no | § 4.1 | § 4.1 |
| `children.list.<i>.alternatingCustody` | yes / no | § 4.1 | § 4.1 |
| `children.list.<i>.mainFinancialContributor` | `person`: The source-taxed person / `otherParent`: The other parent | § 4.1 | § 4.1 |
| `children.list.<i>.financiallySupported` | yes / no | § 4.1 | § 4.1 |
| `residence.residenceInSwitzerland` (2 label variants) | yes / no | see § 4 rule R | § 5 |
| `residence.countryOfResidence` | `DE`: Germany / `LI`: Liechtenstein / `other`: Other country | not in Switzerland | § 5 |
| `residence.dailyReturnToGermany` (2 label variants) | yes / no | `DE` | § 5 |
| `residence.gre1Gre2` | yes / no | `DE`, daily return | § 5 |
| `residence.dailyReturnToCountryOfResidenceReasonable` | yes / no | `DE`, no daily return | § 5 |
| `residence.gre3` | yes / no | `DE`, no daily return, return reasonable | § 5 |
| `residence.dailyReturnToLiechtenstein` (2 label variants) | yes / no | `LI` | § 5 |
| `residence.moreThanFortyFiveNonReturnDays` | yes / no | `LI`, no daily return | § 5 |

The visibility rules must give exactly the member sets of `ZhAnswersSchema`. The enumeration test (§ 7) proves this.

Labels are English translations of the calc-spec German text. A label variant is a separate entry on the same `id` with a disjoint `visibleWhen`. The replacement-income variants add "(during or before the replacement income)".

## 3. Flow engine (`src/domain/flow/`)

No Zurich knowledge in this folder. No React, Next.js or Prisma import.

```ts
type Option<V> = { value: V; label: string };

type Question<Root, Item = never> = {
  kind: "question";
  id: string;                      // dot path relative to the root, or to the item inside a group
  label: string;
  options: readonly Option<string | boolean>[];
  visibleWhen: (root: Root, item: Item) => boolean;
  source: string;                  // for example "calculator-spec.md § 4.1"
};

type RepeatingGroup<Root, Item> = {
  kind: "group";
  id: string;                      // dot path of the array, for example "children.list"
  itemLabel: string;               // "Child"
  addLabel: string;                // "Add another child"
  visibleWhen: (root: Root) => boolean;
  items: readonly Question<Root, Item>[];
};

type FlowNode<Root, Item> = Question<Root> | RepeatingGroup<Root, Item>;
type Flow<Root> = readonly FlowNode<Root>[];
```

Exact generic parameters are the implementer's choice. No `any`.

Functions:

- `getPath(obj, path)` and `setPath(obj, path, value)`: dot paths, numeric segments index arrays. `setPath` returns a new object and does not mutate the input.
- `prune(flow, draft)`: walks the nodes in order. It copies an answer only when its question is visible. Each predicate gets the pruned prefix (root) and the pruned item prefix, never the raw draft. A group copies each item. A group that is not visible gives no array. Idempotent: `prune(prune(x)) = prune(x)`.
- `visibleQuestions(flow, draft)`: the visible nodes of the pruned draft, with concrete paths (`children.list.1.sameHousehold`) and the group items. The renderer reads only this.
- `missingAnswers(flow, draft)`: the paths of the visible questions with no answer, in flow order. A visible group with an empty or missing array reports the paths of the first item (`children.list.0.group`), because the schema needs at least one child.
- `enumerate.ts` (tests only): a depth-first walk over every answer path of a flow, with a bound on the item count of a group.

Rule: a predicate reads earlier questions only. The engine passes the pruned prefix, so a forward reference reads `undefined`.

## 4. Zurich flow (`src/domain/source-tax/zurich/`)

- `questions.ts`: `zhFlow`, the data of § 2.
- `schema.ts` adds `ZhDraftSchema`: the same paths as `ZhAnswersSchema`, every leaf optional, `children.list` an array of partial children, `residence` partial. Every enum leaf uses the `z.enum` of the existing file. `z.strictObject` at every level.
- **Rule R (residence visibility):** the residence questions are visible once `children.hasChildren` is answered (earned income), or at once (replacement income). This deviates from calc-spec § 3 row 7 (see `plan.md`, Fixed decisions). An incomplete child shows in `missingAnswers`. The visibility test cites this rule.
- **`hasChildren` toggle:** a change to `true` sets `children.list = [{}]`. A change to `false` removes the list. `prune` drops the list when `hasChildren` is not `true`, so the toggle is UI help only.
- `preview.ts`: `previewTariff(draft: ZhDraft): PreviewResult`. Steps: prune, `missingAnswers`, `ZhAnswersSchema.safeParse`, `computeTariffCode`.

```ts
type PreviewResult =
  | TariffResult<TariffCode>
  | { kind: "incomplete"; missing: string[] };
```

  When `missing` is empty and the parse fails, the function throws: that is a bug in the flow data, not a user error.

- `src/domain/source-tax/types.ts` adds `SourceTaxModule`: `{ canton: Canton; draftSchema; answersSchema; flow; compute; preview }`, typed by the module's own schemas. `registry.ts`: `sourceTaxModules = { ZH: zurichModule } as const satisfies Record<Canton, SourceTaxModule<...>>`.

## 5. Onboarding (`src/domain/onboarding/`)

- `countries.ts`: `COUNTRY_CODES` (ISO 3166-1 alpha-2, `as const`, includes `CH`, `DE`, `LI`, `XK`), `Nationality = z.enum(COUNTRY_CODES)`, `countryName(code)` with `Intl.DisplayNames(["en"], { type: "region" })` and the code as fallback.
- `schema.ts`:
  - `Name = z.string().trim().min(1, "Required").max(100)`.
  - `OnboardingDraftSchema = z.strictObject({ firstName: z.string(), lastName: z.string(), nationality: Nationality.optional(), sourceTax: z.strictObject({ canton: z.literal("ZH"), answers: ZhDraftSchema }).optional() })`.
  - `OnboardingSchema`: discriminated union on `nationality`. `CH`: `z.strictObject({ firstName: Name, lastName: Name, nationality: z.literal("CH") })`. Others: `z.strictObject({ firstName: Name, lastName: Name, nationality: Nationality.exclude(["CH"]), sourceTax: z.strictObject({ canton: z.literal("ZH"), answers: ZhAnswersSchema }) })`.
  - Any extra key (for example `tariffCode`) fails both schemas.
- `employee-tariff.ts`: `employeeTariff(employee: Onboarding): { kind: "swiss" } | TariffResult<TariffCode>`. Exhaustive switch on the branch. It calls the module of `sourceTax.canton` from the registry.
- `prepareOnboarding(draft: OnboardingDraft): { kind: "ok"; value: Onboarding } | { kind: "missing"; paths: string[] }`. Steps: drop `sourceTax` when the nationality is `CH`; prune the answers; collect missing paths (names, nationality, `sourceTax.answers.<path>`); strict parse. The form resolver and the server both call it. Paths use the RHF form: `sourceTax.answers.children.list.0.group`.

## 6. Persistence and server (round B)

Prisma 8 API names in `plan.md` § 2 are from the docs of the plan time. Check each one with Context7 (`@prisma/orm-postgres`, Prisma 8) before use. Write each real name that differs into `notes/impl-result.md`. When Prisma 8 cannot do a part of `plan.md` § 2, stop and report `blocked`.

- Model `Employee` as in `plan.md` § 2. `nationality` and `canton` are PostgreSQL enum types. `sourceTaxAnswers` is `jsonb`, null for `CH`.
- `scripts/gen-prisma-enums.ts` writes the two enum blocks between marker comments. A second run gives no diff.
- `src/server/enums.test.ts`: each database enum equals its domain `z.enum` list (same members, same order). The test reads the emitted contract, not a live database.
- `src/server/employees.ts`: `EmployeeRepo = { create(e: Onboarding): Promise<{ id: string }>; list(): Promise<EmployeeRow[]> }`. `list` sorts by `createdAt` descending. `EmployeeRow = { id; firstName; lastName; nationality; createdAt; employee: Onboarding | null }`. A row whose stored data fails `OnboardingSchema` gets `employee: null`. It does not throw, and the other rows show.
- `src/server/onboarding.ts`: `submitOnboardingCore(input: OnboardingDraft, repo): Promise<{ kind: "saved"; id: string } | { kind: "missing"; paths: string[] }>`. It calls `prepareOnboarding`, then `repo.create`. It never reads a tariff code from the input.
- `src/server/safe-action.ts`: the `next-safe-action` client. The server-error handler logs the error and returns "Something went wrong. Try again."
- `src/app/onboarding/actions.ts`: `submitOnboarding`, `inputSchema(OnboardingDraftSchema)`. On `missing`: `returnValidationErrors` with "Required" at each path. On `saved`: `revalidatePath("/hr")`, redirect to `/onboarding/done`. Check the API shape with Context7 (Zod v4 support).
- `src/prisma/seed.ts`: the seven example employees of the UI draft (CH; IT single; PT single + sole-custody child; CZ married + two children; DE border crosser; LI replacement daily return; IN replacement in CH), with the schema field names of § 2. Each seed record passes `OnboardingSchema`.
- `src/app/hr/page.tsx`: dynamic server component. Columns: Name, Nationality (name + code), ZH tariff, Meaning, Remark, Added. Cells: `CH` → "No source tax (Swiss)"; code → badge with the code, meaning from the letter, digit and church flag; `noSourceTax` → its text and remark; `employee: null` → "Invalid stored data". Summary counts above the table.
- `src/app/page.tsx`: links to `/onboarding` and `/hr`. `/onboarding/done`: thank-you text, links to a new form and to `/hr`.

`src/domain` imports nothing from `src/server`, `src/app` or Prisma.

## 7. Form (round C)

- `useHookFormAction(submitOnboarding, resolver, { formProps: { shouldUnregister: true, defaultValues } })`. Check the API with Context7.
- The resolver calls `prepareOnboarding`. Missing paths become "Required" field errors. The submit button stays enabled; a submit with errors shows "<n> answers are missing" and marks each field.
- `prune` in `prepareOnboarding` is the correctness mechanism. `shouldUnregister` is UI only.
- `flow-renderer.tsx` renders `visibleQuestions(zhFlow, draft)`. No conditional question in JSX. A radio group maps the option index to the typed value. Each radio group has an accessible name (the label) for Playwright.
- Children: `useFieldArray` on `sourceTax.answers.children.list`, "Add another child", "Remove" when there is more than one child.
- `tariff-preview.tsx`: calls `previewTariff` on the watched draft. Shows the code in large mono text with a legend, or the no-source-tax text and remark, or "Not complete · <n> open questions". `CH` shows "No source tax".
- Layout and colors follow the UI draft. Tailwind tokens, shadcn/ui components, light and dark.

## 8. Tests

Unit (`bun test`, table-driven, each case has a `source`):

| File | Cases |
|---|---|
| `flow/engine.test.ts` | getPath/setPath, prune idempotence, forward reference reads `undefined`, group with 0 items reports item 0 |
| `zurich/visibility.test.ts` | each row of § 2, rule R |
| `zurich/prune.test.ts` | idempotence; stale branch dropped after a change of `civilStatus`, `group`, `countryOfResidence`, `hasChildren` |
| `zurich/civil-status-change.test.ts` | calc-spec § 7.2 flow gives `A0N` |
| `zurich/enumeration.test.ts` | every answer path with 0, 1, 2 children: the leaf has no missing answers, parses with `ZhAnswersSchema`, is prune-stable, and gives a `TariffCode` (records 06 and 11) or `noSourceTax`; each strict prefix of a path has missing answers |
| `zurich/schema-paths.test.ts` | every question id is a path of `ZhDraftSchema` and of at least one member of `ZhAnswersSchema` |
| `zurich/preview.test.ts` | incomplete, code, noSourceTax with remark |
| `onboarding/schema.test.ts` | CH branch, non-CH branch, CH with `sourceTax` rejected, extra `tariffCode` rejected, empty and blank names rejected |
| `onboarding/prepare.test.ts` | CH drops `sourceTax`; missing paths in RHF form |
| `onboarding/employee-tariff.test.ts` | CH, code, noSourceTax |
| `src/server/onboarding.test.ts` | fake repo: saved, missing, `tariffCode` in the input rejected, the repo gets the pruned answers |
| `src/server/enums.test.ts` | § 6 |
| `src/server/employees.test.ts` | the row parse: a bad row gives `employee: null` (no database) |

Playwright (`tests/e2e/onboarding.spec.ts`). `globalSetup` drops and creates the test database `lonio_test`, then runs the init. The web server uses that database.

1. Swiss: names + `CH`, no source-tax block, submit, the row shows on `/hr` with "No source tax (Swiss)".
2. Married + one child (minor, in household, shared custody, same household), church member, spouse employed, residence CH: preview `C1Y`, submit, `/hr` shows `C1Y`.
3. Appear and disappear: select married, answer `spouseEmployed`, switch to single: `spouseEmployed` is gone; switch back: it is empty.
4. Empty submit: "Required" on first name, last name, nationality; no navigation.
5. Liechtenstein, replacement income, daily return: preview shows "No source tax in principle" and "Subject to the double taxation agreement".

## 9. Files outside `src`

- `tsconfig.json`: add `DOM`, `jsx`, the Next.js plugin and `paths` (`@/*` → `src/*`). Keep the strict flags. `include` covers `src`, `scripts`, `tests`, `next-env.d.ts`.
- `biome.json`: exclude `.next`, `next-env.d.ts`, `src/prisma/contract.json`, `src/prisma/contract.d.ts`, `src/components/ui` (shadcn output) only when Biome fails on it.
- `.gitignore`: `.next`, `.env`, `playwright-report`, `test-results`.
- One `package.json` at the root. No sub-project.
- `.env.example`: `DATABASE_URL` for the dev database. No secret.
