# Onboarding app

## Goal

Build the onboarding form and the HR dashboard. One pure function, `computeTariffCode`, computes the Zurich tariff code. The form preview, the server action and the dashboard use it. `plans/1-zh-source-tax/calculator-spec.md` ("spec") defines the logic.

## Fixed decisions

- One progressive page. The question flow is data with `visibleWhen` rules.
- Full calculator scope: earned and replacement income, the child sub-flow, residence (CH, DE, LI, other).
- Nationality `CH` gives no source-tax questions. Every other nationality is source-taxed (brief simplification).
- Compute only from current answers. Clear hidden answers. Do not copy the calculator's stale-child bug (spec §7.2).
- The residence questions are visible once `hasChildren` is answered, or at once for replacement income. The calculator hides them until every child has a result (spec §3 row 7). With pruning of hidden answers, that rule deletes the residence answers on every child edit. `missingAnswers` reports incomplete children instead. The codes are the same.
- No auth on `/hr`. The README lists the gap.
- **Enums, not free strings.** A value with a fixed set of options is a `z.enum` in the domain and a `native_enum` in the Prisma 8 contract, referenced with `pg.enum()` (a PostgreSQL enum type). No TypeScript `enum` keyword: `z.enum` and `as const` give literal unions. A yes/no question is a boolean. A question with two or more named answers is an enum: `incomeType` (`earned` | `replacement`), `civilStatus` (`married` | `single`), `mainFinancialContributor` (`person` | `otherParent`), `group`, `countryOfResidence`. `sharedCustody` stays a boolean: both label variants ask the same yes/no question.
- **One type from the form to the database.** The server action goes through `next-safe-action` with the shared Zod schema as `inputSchema`. The client calls a typed function, not a URL. The result is a typed union. No `any`, no `as` cast and no untyped `FormData` parsing at the boundary.
- **The ZH answers stay JSON.** Their shape depends on the branch (discriminated unions, a repeated child group), and SQL cannot express that invariant. Zod validates the JSON on write and on read, and every enum-like value inside it is a `z.enum`. The columns that the database or the dashboard select by are typed columns: `nationality` and `canton` are native enums. The README lists the alternative (one normalized table per canton) as a trade-off.
- G and Q are stored and shown as `G9N` and `Q9N`: every code then has the form letter + digit + Y/N and exists in `sources/estv/tar26zh.txt`. The calculator shows `G`/`Q` (spec §6.2); golden cases #16/#17 cite this difference.

## 1. Domain (`src/domain`, pure TS + Zod)

```
src/domain/
  flow/          generic question engine (no Zurich knowledge)
    question.ts  Question, RepeatingGroup, FlowNode types
    path.ts      getPath / setPath
    engine.ts    visibleQuestions, prune, missingAnswers
    enumerate.ts walks every answer path (tests only)
  source-tax/
    types.ts     Canton = z.enum(["ZH"]), TariffCode, TariffResult, SourceTaxModule
    registry.ts  { ZH: zurichModule }
    zurich/
      schema.ts     ZhDraftSchema, ZhAnswersSchema (+ child, residence)
      questions.ts  flow data in calculator order, German labels verbatim
      children.ts   childResultMarried / childResultUnmarried (spec §4.2, §4.3)
      residence.ts  residenceResult (spec §5.1)
      compute.ts    computeTariffCode (spec §6)
      preview.ts    previewTariff(draft)
      *.test.ts
  onboarding/
    countries.ts        ISO alpha-2 list (`as const` array → `Nationality = z.enum(...)`), German names via Intl.DisplayNames
    schema.ts           OnboardingDraftSchema, OnboardingSchema
    employee-tariff.ts  employeeTariff(employee)
```

- **Field names:** readable names with a mapping table to the calculator names (spec §2): `incomeType` ← `mainIncome`, `civilStatus` ← `civilStatusMarriedOrRegisteredRelationship`, `churchMember` ← `recognizedReligiousAffiliation`, `children.hasChildren/list` ← `withChildren/childQuestionnaires`, `gre1_gre2` → `gre1Gre2`.
- **Two Zod schemas, same dot paths.** `ZhDraftSchema`: partial form state, optional leaves. `ZhAnswersSchema`: complete set, nested discriminated unions of `z.strictObject` (on `incomeType`, `civilStatus`, `hasChildren`; children as `MarriedChild` / `UnmarriedChild` unions, one member per spec table row; residence one member per §5.1 row). Zod v4 accepts `z.literal(true)` as a discriminator and nests discriminated unions. Types via `z.infer` only.
- **Onboarding schema:** `Nationality` is a `z.enum` of the ISO alpha-2 list in `countries.ts`. `OnboardingSchema` is a discriminated union on `nationality`: `z.literal("CH")` → no `sourceTax`; `Nationality.exclude(["CH"])` → `sourceTax: { canton: "ZH", answers: ZhAnswers }`. Zod needs a literal or a set of literals in every member. A plain `z.string()` member is not allowed.
- **Flow data:** `Question { id (dot path), label, options, visibleWhen(root, item), source }`, `RepeatingGroup` for children ("Ein weiteres Kind erfassen"). Label variants (married/unmarried child question, `sharedCustody` v1/v2, replacement-income residence texts) are separate entries on the same `id` with disjoint `visibleWhen`. `visibleWhen` is typed TS (trade-off vs a JSON DSL, noted in README).
- **Engine:** `prune` walks top-down and copies only visible answers, evaluating predicates on the pruned prefix (idempotent). Rule: a `visibleWhen` predicate reads earlier questions only. The engine passes the pruned prefix, not the full draft, so a forward reference reads `undefined`. The enumeration test (prune-stable leaves) catches a violation. `visibleQuestions` drives the renderer. `missingAnswers` gives per-field "required" errors.
- **Compute:** `computeTariffCode(answers: ZhAnswers): TariffResult`, total over the complete type. `TariffResult = { kind: "code"; code; remark: string | null } | { kind: "noSourceTax"; text; remark }`. `previewTariff(draft)` = prune → missingAnswers → safeParse → compute, else `{ kind: "incomplete", missing }`. Digit capped at 9; border-crosser map A→L, B→M, C→N, H→P. Every rule cites spec § and `main.pretty.js` line. Exhaustive switches with `never`.
- **Extension:** `SourceTaxModule { canton, draftSchema, answersSchema, flow, compute }` + registry with one entry. A new canton adds a folder; another process (family allowance) reuses `flow/`.

## 2. Persistence

Prisma 8 with `@prisma/orm-postgres`. The contract `src/prisma/contract.prisma` has one model `Employee`: `id Uuid @id @default(uuid())`, `firstName`, `lastName`, `nationality pg.enum(Nationality)` (one member per ISO alpha-2 code), `canton pg.enum(Canton)?` (`{ ZH }`, null for CH), `sourceTaxAnswers Jsonb?` (null for CH; pruned, complete ZH answers), `answersVersion Int @default(1)`, `createdAt DateTime @default(now())`. The two `native_enum` blocks copy the domain `z.enum` lists: `scripts/gen-prisma-enums.ts` writes them into the contract between marker comments, and `src/server/enums.test.ts` asserts that `db.enums` equals the domain lists. `src/domain` never imports Prisma; the test lives in `src/server`. Answers as JSON, parsed by Zod on write and read in the repository: question changes need no DB migration. If a `zod-json` extension for Prisma 8 exists at build time, use it for `sourceTaxAnswers`, so the column validates on the wire. `answersVersion` marks the schema version of the stored answers. A `migrateAnswers` function comes with the first version 2. It is not built now. The code is not stored; the dashboard computes it.

Files: `prisma.config.ts` (`definePrismaConfig` + `ormConfig` from `@prisma/orm-postgres/config`), `src/prisma/contract.prisma`, `src/prisma/contract.json` and `src/prisma/contract.d.ts` (emitted, committed), `src/prisma/db.ts` (`postgres<Contract>({ url, contractJson })`, server only), `migrations/app/*/migration.ts`, `docker-compose.yml` (postgres 17), `.env.example`. Workflow: edit the contract → `prisma contract emit` → `prisma migration plan --name <change>` → `prisma db migrate`. On an empty database: `prisma db init`. There is no reset command: drop and recreate the database with docker, then `db init`. There is no seed command: `bun src/prisma/seed.ts` imports `db` and calls `create`. Queries use the chained API, for example `db.orm.public.Employee.orderBy((e) => e.createdAt.desc()).all()`.

## 3. Server

- `src/server/employees.ts`: `createEmployee`, `listEmployees` over `db.orm.public.Employee` (parses each row with Zod; a bad row shows "invalid stored data").
- `src/server/onboarding.ts`: `submitOnboardingCore(input: unknown, repo)`: draft parse → prune → missingAnswers → strict `OnboardingSchema` parse (rejects a client `tariffCode`) → compute check → save. Testable without Next.
- `src/server/safe-action.ts`: the `next-safe-action` client (`createSafeActionClient`) with a server-error handler that logs and returns a generic message.
- `src/app/onboarding/actions.ts`: `submitOnboarding = actionClient.inputSchema(OnboardingDraftSchema).action(...)`. The action calls `submitOnboardingCore(parsedInput, repo)`, returns missing-answer errors with `returnValidationErrors` (typed to the schema shape), then `revalidatePath("/hr")` and redirect to `/onboarding/done`. The client imports the action and gets its input and result types.
- `src/app/hr/page.tsx`: server component, dynamic.

## 4. UI

- Routes: `/`, `/onboarding`, `/onboarding/done`, `/hr`.
- `components/onboarding/onboarding-form.tsx`: `useHookFormAction(submitOnboarding, resolver, { formProps: { shouldUnregister: true } })` from `@next-safe-action/adapter-react-hook-form`. `shouldUnregister: true` drops the value of a hidden question, so a question that reappears is empty, as in the calculator. The resolver prunes, runs `missingAnswers`, then `zodResolver(OnboardingSchema)`. The adapter maps the server `validationErrors` to RHF field errors.
- `personal-fields.tsx`: first name, last name, nationality (searchable select). Source-tax block only for non-CH.
- `flow-renderer.tsx`: `useWatch` + `visibleQuestions(zhFlow, draft)`; no conditionals in JSX; radio groups map option index to typed value.
- `children-group.tsx`: `useFieldArray`; `hasChildren` true adds one child, false removes all; add/remove buttons.
- `tariff-preview.tsx`: "Tarif: B2Y", no-source-tax text + remark, or "Noch unvollständig".
- `hr/employee-table.tsx`: name, nationality, code badge, remark; CH shows "nicht quellensteuerpflichtig".

## 5. Tests

`bun test` (root `src/`, set in `bunfig.toml`). Each case has a `source`.

| File | Cases |
|---|---|
| `zurich/compute.test.ts` | 17 golden cases (spec §9, G9N/Q9N), built-in H3N/P3N (§8), 10 children → B9N |
| `zurich/children.test.ts` | every row of §4.2 and §4.3 |
| `zurich/residence.test.ts` | every row of §5.1 |
| `zurich/visibility.test.ts` | each "visible when" condition of §3, §4.1, §5; the residence group follows the rule in Fixed decisions, not §3 row 7 |
| `zurich/prune.test.ts` | idempotence, stale branches dropped on changes |
| `zurich/civil-status-change.test.ts` | spec §7.2 flow gives `A0N` (calculator: `H0N`, bug) |
| `zurich/enumeration.test.ts` | DFS over all answer paths (0–2 children): each leaf complete, parses, prune-stable, and its code is in the record-06 code set of `tar26zh.txt` (or noSourceTax); each strict prefix is incomplete |
| `zurich/schema-paths.test.ts` | every question id exists in both schemas |
| `onboarding/schema.test.ts` | CH/non-CH branches, extra `tariffCode` key rejected |
| `src/server/onboarding.test.ts` | core action with a fake repo |
| `src/server/enums.test.ts` | each Prisma enum (`Nationality`, `Canton`) equals its domain `z.enum` list |

Playwright (`tests/e2e/onboarding.spec.ts`; `globalSetup` drops and recreates the test database, then runs `prisma db init`): Swiss path; married + child → C1Y on preview and dashboard; questions appear and disappear, and a question that reappears is empty; empty submit shows errors; Liechtenstein daily return shows no-source-tax + remark.

## 6. Steps (each one verifiable)

1. Scaffold: create-next-app (TS, App Router, `src/`, Tailwind) with Bun; strict tsconfig; Biome instead of ESLint; shadcn init; scripts; `.env.example`.
2. Flow engine + generic tests.
3. Zurich schemas + flow data; schema-path and visibility tests.
4. Child and residence tables, tests first.
5. Compute, preview, golden, civil-status and enumeration tests.
6. Onboarding schema + `employeeTariff`.
7. DB: docker compose, `prisma orm init --target postgres --authoring psl`, the contract with the two native enums, `scripts/gen-prisma-enums.ts`, `contract emit`, enum test, first migration plan, repository, `src/prisma/seed.ts` (golden employees).
8. `next-safe-action` client, server action + core test.
9. Dashboard page.
10. Form: personal + main questions + preview, then children, then residence.
11. Playwright specs.
12. CLAUDE.md commands, README, final run of `bun test`, lint, typecheck, e2e.

## 7. Commands (add to CLAUDE.md after each one runs)

`docker compose up -d`, `bun install`, `bun run contract:emit` (`prisma contract emit`), `bun run db:init` (empty database), `bun run db:migrate` (`prisma db migrate`), `bun run db:verify` (`prisma db verify`), `bun run db:seed` (`bun src/prisma/seed.ts`), `bun run dev`, `bun test`, `bun run typecheck`, `bun run lint`, `bun run format`, `bun run test:e2e`.

## 8. README outline (brief "What to deliver")

Run steps; approach (bundle → spec → live check → golden tests); architecture; how a calculator change flows through (flow data + schema + tests; enumeration and schema-path tests catch gaps; `answersVersion`; idea: bundle-hash watcher); trade-offs (G9N/Q9N, JSON answers vs one normalized table per canton, enums in Postgres vs text, TS predicates vs DSL, H0N bug not copied, nationality-only rule, Liechtenstein, no fallback codes); correctness oracles; security (server recomputes, strict schemas; gaps: no auth, no encryption, no rate limit); AI use (Claude Code, CLAUDE.md, plans, Context7, Playwright MCP, review loops); improvements.

## 9. Risks (check current docs via Context7 at implementation time)

Prisma 8 (`prisma orm init` output with Bun, `with { type: "json" }` import of `contract.json` under Next.js and `resolveJsonModule`, `Jsonb?` null write and the read type, `db.enums` shape for the enum test, the `migrations/app` folder, a `zod-json` extension if it exists, `pg.enum` filters support only `eq` and `in`); `next-safe-action` with Zod v4 and the RHF adapter (`useHookFormAction`, `returnValidationErrors` shape); the emitted `contract.d.ts` types under `exactOptionalPropertyTypes`; Next.js major version and server-action serialization; Tailwind v4 + current `shadcn init`; Zod v4 (nested discriminated unions with boolean discriminators, `z.strictObject`, error helpers, `exactOptionalPropertyTypes`); RHF + `@hookform/resolvers` with Zod v4, `useFieldArray` on nested paths, `shouldUnregister: true` together with `useFieldArray`; `bun test` root and path aliases; Playwright webServer + test DB order.
