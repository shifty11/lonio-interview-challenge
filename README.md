# Lonio interview challenge: employee onboarding and Zurich source tax

This repository holds a full-stack TypeScript application. It has two screens:

- `/onboarding`: a form with conditional questions. A Swiss employee gets no source-tax questions.
- `/hr`: a dashboard. It lists the employees who completed the form. For each non-Swiss employee it shows the Zurich source tax tariff code, for example `B2Y`.

One pure function, `computeTariffCode`, computes the code. The form preview, the server and the dashboard use it. The brief is in `docs/challenge.md`.

## Run the application

You need Bun, Docker and Node.js.

```sh
bun install
cp .env.example .env          # the values match docker-compose.yml. They are not secrets.
docker compose up -d          # PostgreSQL 17 on host port 54329
bun run db:init               # creates the tables on an empty database
bun run db:seed               # adds seven example employees. It does nothing when the table has rows.
bun run dev                   # http://localhost:3000
```

Open `/onboarding` for the form and `/hr` for the dashboard. The page `/hr` has no login (see "Security").

To start again with an empty database, run `docker compose down -v`, then the steps above.

### Checks

| Command | What it does |
|---|---|
| `bun test` | Unit tests of the domain and the server core |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | Biome (lint, format check, import order) |
| `bun run gen:tariff` | Writes the 2026 tariff data from the ESTV file. The file must not change. |
| `bun run examples` | Prints the worked examples from the real functions. It exits with code 1 when a value differs. |
| `bun run test:e2e` | Playwright tests. They build the app, make the database `lonio_test` and start the app on port 3100. Run `bunx playwright install chromium` once before. |

## Approach

The work follows one chain: bundle, spec, live check, golden tests.

1. **Bundle.** The Zurich calculator runs in the browser. I saved its JavaScript bundle in `sources/zh/calculator/` and made a readable copy.
2. **Spec.** I read the code and wrote `plans/1-zh-source-tax/calculator-spec.md`. It lists the questions, the visibility rules, the child rules, the residence rules and the result rules. Each rule cites a line of the readable bundle.
3. **Live check.** I ran the real calculator with Playwright on the same cases. Ten cases match. One case differs because of a bug in the calculator (see "Trade-offs").
4. **Golden tests.** The spec holds 17 golden cases and two built-in examples of the calculator. They are unit tests. A second test walks every answer path of the question flow.
5. **Domain code.** The tariff rules are TypeScript. Each rule cites its spec row.
6. **App.** The form, the server action and the dashboard come last. They only call the domain.

A plan and a spec guided each part. They are in `plans/`. The spec of a part wins over its plan.

## Architecture

```
src/
  domain/        pure TypeScript and Zod. No React, Next.js or Prisma.
    flow/        the generic question engine: prune, visibleQuestions, missingAnswers
    source-tax/  one module per canton. Zurich: questions, schemas, tariff rules, ESTV tables, tax amount
    onboarding/  nationality list, the onboarding schemas, prepareOnboarding, employeeTariff
  server/        repository, safe-action client, the core of the submit action
  lib/           code shared by the client and the server: the error tree, the date format
  prisma/        Prisma 8 contract, emitted contract files, the database client, the seed
  app/           Next.js routes and the server action
  components/    shadcn/ui and the form components
tests/e2e/       Playwright tests
sources/         official documents (reference only)
scripts/         scripts that fetch, generate and compare data
plans/           plans and specs
```

### The question flow is data

`src/domain/source-tax/zurich/questions.ts` is a list of questions. Each question has an `id`, a label, options, a `visibleWhen` rule and a source. A repeating group describes the children.

The generic engine in `src/domain/flow/` reads this list. It has no Zurich knowledge.

- `prune` copies an answer only when its question is visible. A rule reads the earlier answers only.
- `visibleQuestions` gives the questions that the form shows. The renderer reads nothing else. JSX has no conditional question.
- `missingAnswers` gives the paths of the open questions.

### One schema, one type

The Zod schemas are the only source of the input type. Types come from `z.infer`.

- `ZhDraftSchema` is the form state. Every answer can be empty.
- `ZhAnswersSchema` is the complete record. It is a nest of discriminated unions. An answer that exists in one branch only (for example `spouseEmployed`) is in that branch only.
- `OnboardingSchema` is a discriminated union on the nationality. `CH` has no `sourceTax`. Every other nationality has `sourceTax` with the canton and the answers.

The form uses `useHookFormAction` with the server action. The action declares `OnboardingDraftSchema` as its `inputSchema`. The client calls a typed function. The result is a typed union. At the client-server boundary there is no `any`, no `as` cast and no untyped `FormData` parsing. The generic flow engine has a few internal casts (the empty draft in `walk`, the result of `setPath`). The enumeration test and the schema-path test cover them.

### Form, server and dashboard use the same functions

- The form resolver calls `prepareOnboarding`. The server calls the same function. It prunes the answers, lists the open paths and parses the record with the strict schema.
- The preview calls `previewTariff`. It prunes, checks the open questions, parses and computes.
- The dashboard calls `employeeTariff` on the stored record. The database does not hold the code.

### Persistence

Prisma 8 (`@prisma/orm-postgres`) and PostgreSQL. The contract is `src/prisma/contract.prisma`. It has one model, `Employee`.

- `nationality` and `canton` are PostgreSQL enum types. A script copies the members from the domain `z.enum` lists. A test checks that the emitted contract equals the lists.
- `sourceTaxAnswers` is `jsonb`. It is null for a Swiss employee. Zod validates it on write and on read. A row with invalid data shows "Invalid stored data" on the dashboard. The other rows still show.
- `answersVersion` marks the version of the stored answers.

## How a change of the calculator flows through

The Zurich website can add, remove or rename a question. It can change a rule. The steps are:

1. **Detect.** Fetch the new bundle. Compare it with the saved one. A diff of the readable copy shows the changed lines. (An idea for later: a scheduled job that hashes the bundle and opens a ticket on a change.)
2. **Update the spec.** Change `calculator-spec.md` first. The spec cites the lines of the bundle.
3. **Change the flow data.** Add, remove or rename the question in `questions.ts`. Change its `visibleWhen` rule.
4. **Change the schemas.** Change `ZhDraftSchema` and `ZhAnswersSchema` in `schema.ts`.
5. **Change the rule.** Change `children.ts`, `residence.ts` or `compute.ts` when a result rule changes.
6. **Run the tests.** The tests find the gaps that a person can miss:
   - The enumeration test walks every answer path with 0, 1 and 2 children. Each complete path must parse, be stable under `prune` and give a code. Each strict prefix must have open answers. A visibility rule that does not match the schema fails here.
   - The schema-path test checks that every question id is a path of both schemas.
   - The enum test checks that the database enums equal the domain lists.
   - The golden tests check the codes.
7. **Check the live calculator.** Run the changed cases in the real calculator and in the app.
8. **Migrate stored answers.** A change of the answer shape raises `answersVersion`. A `migrateAnswers` function converts old rows. The function does not exist yet, because version 1 is the only version. The dashboard shows a row that fails the schema as "Invalid stored data" and does not crash.

A new canton is a new folder in `src/domain/source-tax/`. It adds a module with its own schemas, flow and compute function. The registry in `registry.ts` lists it. The Zurich module does not change. Another process, for example family allowances, reuses `src/domain/flow/`.

## Trade-offs

- **`G9N` and `Q9N` instead of `G` and `Q`.** The calculator shows `G` and `Q` for replacement income. The ESTV tariff file has the codes `G9N` and `Q9N`. The app stores and shows the file form. Then every code has the form letter, digit, Y or N, and exists in the file. The golden cases 16 and 17 cite this difference.
- **JSON answers instead of one table per canton.** The answers depend on the branch (unions, a repeated child group). SQL cannot express this invariant well. Zod checks the JSON on write and on read. A question change needs no migration. The cost is that SQL cannot query a single answer. The alternative is one normalized table per canton. It gives SQL constraints and queries, and it costs a migration for each question change.
- **PostgreSQL enums instead of text.** A fixed set of values is a `z.enum` in the domain and a native enum in the database. The database rejects a wrong value. The cost is that a new member needs a migration. A script and a test keep the two lists equal.
- **TypeScript predicates instead of a JSON rule language.** `visibleWhen` is a typed function. The compiler checks it, and a rule can use any logic. A rule language would let a non-developer edit the flow, but it needs an interpreter and its own tests.
- **The `H0N` bug is not copied.** The calculator keeps a stale child result when the civil status changes. The live calculator gives `H0N`, a code that does not exist in the tariff file. A fresh entry of the same answers gives `A0N`. The app computes everything from the current answers and gives `A0N`. A test cites this case.
- **Rule R for the residence questions.** The calculator shows the residence questions only after every child has a result. The app prunes hidden answers. With that rule, each edit of a child would delete the residence answers. The app shows the residence questions once `hasChildren` is answered. An incomplete child shows as an open answer. The codes are the same.
- **Every non-Swiss nationality is source-taxed.** This is the simplification of the brief. The real rules (permit type, residence) are out of scope.
- **Liechtenstein.** The calculator gives "In principle, no source tax" with a remark for a Liechtenstein resident who returns daily. The app shows the same text and the remark. It does not give a code.
- **No fallback codes.** KS 45 allows `A0Y` or `C0Y` when data is missing. The calculator has no such rule. The app does not invent one. An incomplete form gives no code.
- **The tax amount is extra.** The brief needs only the code. The domain also holds the 2026 ESTV tables and a tax amount function. The UI does not use it.
- **The form state is not trusted.** `shouldUnregister` clears the value of a hidden question in the form. It is only UI help. Two label variants of one path (for example the married and the single wording of `hasChildren`) have two flow keys, so a change of the variant gives an empty field. `prune` in `prepareOnboarding` is the mechanism that keeps the record correct.

## Correctness

The code has several independent checks:

- **The calculator is the oracle.** The golden cases and the two built-in examples come from the bundle. The live run in the real calculator confirms them.
- **The ESTV file is the oracle for the tariff data.** `bun run gen:tariff` writes the data from `sources/estv/tar26zh.txt`. The file must not change. A test checks every code against the file.
- **Official documents are the oracle for the rules.** `sources/` holds ZStB 87.3, KS 45, the Zurich ordinance and the Swissdec guideline. Each rule cites its source in a comment. `bun run examples` prints the worked examples from the real functions.
- **Exhaustive walk.** The enumeration test checks every answer path of the flow.
- **Types.** TypeScript runs with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Every `switch` on a union ends with a `never` check.
- **End-to-end tests.** Playwright runs nine cases against a real browser and a real test database.

Known gap: the end-to-end tests cover nine paths. The unit tests cover the other paths.

## Security

- The server does not trust the client. It validates the input with the same Zod schema. It prunes the answers and parses the record with the strict schema.
- The schemas are strict. An extra key, for example `tariffCode`, fails the parse. The dashboard computes the code from the stored answers. The client cannot set a code.
- `next-safe-action` handles server errors. The client gets a generic message. The server logs the details.
- The database user and the password in `docker-compose.yml` are for local development only.

Known gaps:

- **No authentication.** Everyone can open `/hr`. A real system needs a login and a role check.
- **No encryption.** The database stores the names and the answers as plain data. A real system needs encryption at rest and a retention rule.
- **No rate limit.** The submit action accepts any number of requests.
- **No audit log.** The app does not record who read or changed a record.

## How I used AI

- **Claude Code** wrote most of the code. I directed it with plans and specs. `CLAUDE.md` holds the rules of the repository: the stack, the layout, the architecture rules and the commands.
- **Plans and specs.** Each part has `plans/<n>-<topic>/plan.md` and a `spec.md`. The spec wins over the plan. They are in the repository.
- **Rounds.** Work on the app ran in three rounds (domain, server and dashboard, form and tests). A separate implementer agent did each round. An orchestrator session checked the result and committed. Agents ran in separate terminal panes (herdr).
- **Context7** gave the current API of each library (Prisma 8, `next-safe-action`, React Hook Form, Playwright, Base UI). The rules ask the agent to check the docs first and not to rely on memory.
- **Playwright** (as an MCP tool and as a test runner) drove the real Zurich calculator and the app.
- **Review loops.** A review pass reads the diff against the plan and the spec. It lists findings. The findings go back to an implementer.
- **Version control.** The repository uses Jujutsu with a Git backend.

What I controlled myself: the architecture rules, the decision to put the flow in data, the decision to derive the code from stored answers, and the review of each round. What I delegated: reading the bundle, writing the tables and the tests, and the UI code.

## What I would improve

- Add a login and a role check for `/hr`.
- Add a scheduled job that hashes the Zurich bundle and opens a ticket on a change.
- Build `migrateAnswers` with the first change of the answer shape.
- Add a second canton to prove the module boundary.
- Show the tax amount on the dashboard, with the salary as an input.
- Add German labels. The labels are English translations of the German calculator text.
- Run the Playwright tests in CI with a database service.
- Add encryption at rest and a retention rule for personal data.
