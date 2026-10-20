# CLAUDE.md

## Purpose

This repo is the Lonio interview challenge. The brief is in `docs/challenge.md`.

The app has two screens:

- **Onboarding form.** An employee enters personal data. The questions are conditional: each answer controls which questions come next. A Swiss employee gets no source-tax questions.
- **HR dashboard.** HR sees all employees who completed the form. For each non-Swiss employee, it shows the suggested Zurich source-tax tariff code (for example `B2Y`).

One pure function, `computeTariffCode`, computes the code. The form and the dashboard both use it.

## Stack

| Area | Tool |
|---|---|
| Language | TypeScript, strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Framework | Next.js (App Router, server actions) + React |
| Runtime and tooling | Bun: package manager, scripts, test runner |
| Database | PostgreSQL, started with `docker compose` |
| ORM | Prisma 8 (`@prisma/orm-postgres`). The contract is `src/prisma/contract.prisma`. `prisma contract emit` writes `contract.json` and `contract.d.ts` next to it. Both are committed. |
| Validation | Zod v4 |
| Client to server | Next.js server actions through `next-safe-action`, typed by the shared Zod schema |
| Forms | React Hook Form + `zodResolver` |
| UI | Tailwind v4 + shadcn/ui |
| Lint and format | Biome |
| Tests | `bun test` for the domain, Playwright for end-to-end |

Use the Context7 MCP server for library docs. Do not rely on memory for library APIs.

## Layout

```
src/
  domain/       pure logic: tariff rules, question flow, Zod schemas
  server/       repositories, the safe-action client
  lib/          code that the client and the server share: the validation error tree, the date format
  prisma/       Prisma contract, emitted contract files, the db client
  app/          Next.js routes and server actions
  components/   shadcn/ui components and the form renderer
migrations/     Prisma migration files (`migrations/app/`)
tests/e2e/      Playwright tests
sources/        official source documents (reference only)
scripts/        scripts that fetch and compare the sources
plans/          plans, one folder per topic
docs/           the challenge brief and other docs
```

## Architecture rules

- `src/domain` imports nothing from React, Next.js or Prisma. It is pure TypeScript and Zod.
- The question flow is data: a list of questions with `visibleWhen` rules. The form renderer reads this data. Do not hard-code conditional questions in JSX.
- The Zod schema is the single source of the input type. Infer types with `z.infer`. Do not write a second type by hand.
- Use a discriminated union when an answer exists only in a branch (for example, `spouseEmployed` exists only when the civil status is married).
- Each tariff rule cites its source in a comment, for example `// ZStB 87.3 no. 7` or `// KS 45 § 4.3`.
- The server validates input with the same Zod schema. It does not trust a tariff code from the client. The dashboard computes the code from the stored answers.
- Every `switch` on a union is exhaustive and ends with a `never` check.
- Enums, not free strings. A value with a fixed set of options is a `z.enum` in the domain and a `native_enum` in the Prisma contract, referenced with `pg.enum()`, which is a PostgreSQL enum type. Do not store it as `String` or as a text-backed `enum`. Do not use the TypeScript `enum` keyword: `z.enum` and `as const` give literal unions.
- A yes/no question is a boolean. A question with two or more named answers is an enum.
- A Prisma enum copies a domain `z.enum`. A script generates the `native_enum` block from the domain list, and a test in `src/server` checks that `db.enums` equals the domain list.
- One type from the form to the database. A server action declares the shared Zod schema as its `inputSchema` and returns a typed union. No `any`, no `as` cast and no untyped `FormData` parsing at the client-server boundary.
- Keep each canton and each process in its own module. A new canton adds a module. It does not change the Zurich module.

## Commands

Run each command from the repo root. Each command ran without error when it was added.

| Command | Use |
|---|---|
| `bun run typecheck` | `tsc --noEmit` over `src`, `scripts` and `tests` |
| `bun run lint` | `biome check .` (lint, format check, import order) |
| `bun run format` | `biome format --write .` |
| `bun test` | all unit tests (`bunfig.toml` sets the root to `src`) |
| `bun run gen:tariff` | writes `src/domain/source-tax/zurich/tariff-2026.generated.ts` from `sources/estv/tar26zh.txt`. The file must not change. |
| `bun run examples` | prints the worked examples of `plans/1-zh-source-tax/plan.md` from the real functions. It exits with code 1 when a value differs. |
| `docker compose up -d` | starts PostgreSQL 17 on host port 54329. Copy `.env.example` to `.env` first. |
| `bun install` | installs the packages |
| `bun run dev` | starts PostgreSQL (`docker compose up -d --wait`) and the Next.js dev server on port 3000. When the dev server exits (Ctrl+C), it runs `docker compose stop`. |
| `bun run dev:next` | starts only the Next.js dev server on port 3000. PostgreSQL must run. |
| `bun run build` | builds the app. The Geist font needs network access. |
| `bun run gen:enums` | writes the two `native_enum` blocks of `src/prisma/contract.prisma` from the domain lists. A second run gives no diff. |
| `bun run contract:emit` | runs `gen:enums`, then `prisma contract emit`. It writes `contract.json` and `contract.d.ts` with two-space indent. Restore the committed files when only the whitespace differs. |
| `bun run db:init` | creates the tables on an empty database |
| `bun run db:migrate` | applies the migration files |
| `bun run db:verify` | checks that the database matches the contract |
| `bun run db:seed` | adds the seven example employees. It does nothing when the table has rows. |
| `bun run test:e2e` | Playwright tests. They build the app, drop and create the database `lonio_test`, and start the app on port 3100. The database server must run. Run `bunx playwright install chromium` once. |
| `uv run --with openpyxl python3 scripts/extract-swissdec-appendix.py` | writes `src/domain/source-tax/monthly/swissdec-appendix.generated.ts` from the Swissdec appendix workbook. |

## Testing

- Domain tests are table-driven. Each case cites its source (a document section or a calculator run).
- A rule change starts with a failing test.
- Before you say that work is done, run `bun test` and Biome, and report the output.

## Sources and plans

- `sources/` holds the official documents. `scripts/fetch-sources.sh` downloads them again. Do not edit these files.
- `plans/1-zh-source-tax/plan.md` defines the Zurich tariff logic and its tests.
- The challenge requires only the tariff code. The tax amount in the plan is optional extra scope.
- Plans live in `plans/<n>-<topic>/plan.md`. In this repo, `plans/` is under version control.

## Writing style

Write all prose in ASD-STE100 Simplified Technical English: short sentences, active voice, one meaning per word. Docs describe the system as it is now, in the present tense.
