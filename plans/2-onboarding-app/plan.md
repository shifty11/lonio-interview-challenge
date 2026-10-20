# Onboarding app

## Goal

Build the onboarding form and the HR dashboard. One pure function, `computeTariffCode`, computes the Zurich tariff code. The form preview, the server action and the dashboard use it. `plans/1-zh-source-tax/calculator-spec.md` ("spec") defines the logic.

## Fixed decisions

- One progressive page. The question flow is data with `visibleWhen` rules.
- Full calculator scope: earned and replacement income, the child sub-flow, residence (CH, DE, LI, other).
- Nationality `CH` gives no source-tax questions. Every other nationality is source-taxed (brief simplification).
- Compute only from current answers. Clear hidden answers. Do not copy the calculator's stale-child bug (spec §7.2).
- No auth on `/hr`. The README lists the gap.
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
    types.ts     TariffCode, TariffResult, SourceTaxModule
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
    countries.ts        ISO alpha-2, German names via Intl.DisplayNames
    schema.ts           OnboardingDraftSchema, OnboardingSchema
    employee-tariff.ts  employeeTariff(employee)
```

- **Field names:** readable names with a mapping table to the calculator names (spec §2): `incomeType` ← `mainIncome`, `civilStatus` ← `civilStatusMarriedOrRegisteredRelationship`, `churchMember` ← `recognizedReligiousAffiliation`, `children.hasChildren/list` ← `withChildren/childQuestionnaires`, `gre1_gre2` → `gre1Gre2`.
- **Two Zod schemas, same dot paths.** `ZhDraftSchema`: partial form state, optional leaves. `ZhAnswersSchema`: complete set, nested discriminated unions of `z.strictObject` (on `incomeType`, `civilStatus`, `hasChildren`; children as `MarriedChild` / `UnmarriedChild` unions, one member per spec table row; residence one member per §5.1 row). Fallback if Zod cannot discriminate on booleans: `z.union` of strict objects. Types via `z.infer` only.
- **Onboarding schema:** discriminated union on nationality: `CH` → no `sourceTax`; other → `sourceTax: { canton: "ZH", answers: ZhAnswers }`.
- **Flow data:** `Question { id (dot path), label, options, visibleWhen(root, item), source }`, `RepeatingGroup` for children ("Ein weiteres Kind erfassen"). Label variants (married/unmarried child question, `sharedCustody` v1/v2, replacement-income residence texts) are separate entries on the same `id` with disjoint `visibleWhen`. `visibleWhen` is typed TS (trade-off vs a JSON DSL, noted in README).
- **Engine:** `prune` walks top-down and copies only visible answers, evaluating predicates on the pruned prefix (idempotent). `visibleQuestions` drives the renderer. `missingAnswers` gives per-field "required" errors.
- **Compute:** `computeTariffCode(answers: ZhAnswers): TariffResult`, total over the complete type. `TariffResult = { kind: "code"; code; remark: string | null } | { kind: "noSourceTax"; text; remark }`. `previewTariff(draft)` = prune → missingAnswers → safeParse → compute, else `{ kind: "incomplete", missing }`. Digit capped at 9; border-crosser map A→L, B→M, C→N, H→P. Every rule cites spec § and `main.pretty.js` line. Exhaustive switches with `never`.
- **Extension:** `SourceTaxModule { canton, draftSchema, answersSchema, flow, compute }` + registry with one entry. A new canton adds a folder; another process (family allowance) reuses `flow/`.

## 2. Persistence

One Prisma model `Employee`: `id`, `firstName`, `lastName`, `nationality` (ISO alpha-2), `sourceTax Json?` (null for CH; pruned, complete `{ canton, answers }`), `answersVersion Int @default(1)`, `createdAt`. Answers as JSON, parsed by Zod on write and read: question changes need no DB migration; `answersVersion` + `migrateAnswers` handle schema changes. The code is not stored; the dashboard computes it. Files: `prisma/schema.prisma`, `prisma.config.ts`, `docker-compose.yml` (postgres 17), `.env.example`, `src/server/db.ts` (PrismaPg adapter).

## 3. Server

- `src/server/employees.ts`: `createEmployee`, `listEmployees` (parses each row; a bad row shows "invalid stored data").
- `src/server/onboarding.ts`: `submitOnboardingCore(input: unknown, repo)`: draft parse → prune → missingAnswers → strict `OnboardingSchema` parse (rejects a client `tariffCode`) → compute check → save. Testable without Next.
- `src/app/onboarding/actions.ts`: server action wrapper, `revalidatePath("/hr")`, redirect to `/onboarding/done`.
- `src/app/hr/page.tsx`: server component, dynamic.

## 4. UI

- Routes: `/`, `/onboarding`, `/onboarding/done`, `/hr`.
- `components/onboarding/onboarding-form.tsx`: RHF with a resolver that prunes, runs `missingAnswers`, then `zodResolver(OnboardingSchema)`; maps server `fieldErrors` with `setError`.
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
| `zurich/visibility.test.ts` | each "visible when" condition of §3, §4.1, §5 |
| `zurich/prune.test.ts` | idempotence, stale branches dropped on changes |
| `zurich/civil-status-change.test.ts` | spec §7.2 flow gives `A0N` (calculator: `H0N`, bug) |
| `zurich/enumeration.test.ts` | DFS over all answer paths (0–2 children): each leaf complete, parses, prune-stable, and its code is in the record-06 code set of `tar26zh.txt` (or noSourceTax); each strict prefix is incomplete |
| `zurich/schema-paths.test.ts` | every question id exists in both schemas |
| `onboarding/schema.test.ts` | CH/non-CH branches, extra `tariffCode` key rejected |
| `src/server/onboarding.test.ts` | core action with a fake repo |

Playwright (`tests/e2e/onboarding.spec.ts`, test DB reset in `globalSetup`): Swiss path; married + child → C1Y on preview and dashboard; questions appear/disappear; empty submit shows errors; Liechtenstein daily return shows no-source-tax + remark.

## 6. Steps (each one verifiable)

1. Scaffold: create-next-app (TS, App Router, `src/`, Tailwind) with Bun; strict tsconfig; Biome instead of ESLint; shadcn init; scripts; `.env.example`.
2. Flow engine + generic tests.
3. Zurich schemas + flow data; schema-path and visibility tests.
4. Child and residence tables, tests first.
5. Compute, preview, golden, civil-status and enumeration tests.
6. Onboarding schema + `employeeTariff`.
7. DB: docker compose, Prisma 7 config, model, init migration, repository, `prisma/seed.ts` (golden employees).
8. Server action + core test.
9. Dashboard page.
10. Form: personal + main questions + preview, then children, then residence.
11. Playwright specs.
12. CLAUDE.md commands, README, final run of `bun test`, lint, typecheck, e2e.

## 7. Commands (add to CLAUDE.md after each one runs)

`docker compose up -d`, `bun install`, `bun run db:migrate`, `bun run db:seed`, `bun run dev`, `bun test`, `bun run typecheck`, `bun run lint`, `bun run format`, `bun run test:e2e`.

## 8. README outline (brief "What to deliver")

Run steps; approach (bundle → spec → live check → golden tests); architecture; how a calculator change flows through (flow data + schema + tests; enumeration and schema-path tests catch gaps; `answersVersion`; idea: bundle-hash watcher); trade-offs (G9N/Q9N, JSON vs columns, TS predicates vs DSL, H0N bug not copied, nationality-only rule, Liechtenstein, no fallback codes); correctness oracles; security (server recomputes, strict schemas; gaps: no auth, no encryption, no rate limit); AI use (Claude Code, CLAUDE.md, plans, Context7, Playwright MCP, review loops); improvements.

## 9. Risks (check current docs via Context7 at implementation time)

Prisma 7 (`prisma.config.ts`, `prisma-client` generator output path, `PrismaPg` setup, import path); Next.js major version and server-action serialization; Tailwind v4 + current `shadcn init`; Zod v4 (nested discriminated unions with boolean discriminators, `z.strictObject`, error helpers, `exactOptionalPropertyTypes`); RHF + `@hookform/resolvers` with Zod v4, `useFieldArray` on nested paths; `bun test` root and path aliases; Playwright webServer + test DB order.
