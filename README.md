# Lonio interview challenge

An employee onboarding form and an HR dashboard. The dashboard shows the Zurich source-tax tariff code (for example `B2Y`) of each non-Swiss employee.

See [How I built this with Claude Code](https://claude.ai/artifact/UEfctpdDfwgk8uxdr41bWf) for the most important sessions behind this repo. I left out the cleanup sessions to keep it short.

## Run

You need Bun and Docker.

```sh
cp .env.example .env
bun install
bun run dev   # starts PostgreSQL, creates the tables, adds seven example employees, starts the app on http://localhost:3000
```

Open `/onboarding` for the form and `/hr` for the dashboard.

Checks: `bun test`, `bun run lint`, `bun run typecheck`, `bun run test:e2e`. The end-to-end tests need PostgreSQL to run, and `bunx playwright install chromium` once first.

## Approach
I first read some of the PDFs myself to get a feeling for the domain, and I tried the Zurich calculator.
Then I told Claude to analyze the calculator page and find out if it could extract the logic. This works only because the logic runs in the browser.
Claude downloaded the calculator bundle and the PDFs, and I also let it consult the Swissdec guidelines.

Next, I told Claude to write one plan for the calculator logic and one plan for the app (both are in `plans/`).
My implementation agents then built it, and I made some small changes at the end.

Some things I deliberately told Claude to use or follow:
- PostgreSQL, because it is a very good choice for a SaaS-like app and I know it well.
- Tailwind CSS for the UI.
- Type safety, and enums over free strings, because that makes the code more stable.

## What I would improve
- I would check if the Zurich calculator is the only source of truth, or if there are other ways to get the logic.
- I am not very familiar with Next.js on the backend. I would spend more time comparing the core libraries, for example the ORM and the database migration strategy.
- I would spend more time on a good testing strategy. The logic is complex, and Swissdec has more test cases that we could reuse (18 of the 53 appendix sheets are still skipped).

## How I used AI
I use Claude Code inside herdr (herdr.dev). I have a remote setup that I can reach through herdr, so agents can run overnight or while I am away from the computer.
Right now I mostly use Opus 5.5 as the main agent, Fable 5.1 for more complex tasks and Sonnet 5.5 for simpler ones. This can change from month to month.

`CLAUDE.md` holds the rules for the agents: the stack, the layout, the architecture rules and the commands. The agents use the Context7 MCP server to read current library docs.

## Tools, agents and workflows
- Claude Code (Opus 5.5, Fable 5.1 and Sonnet 5.5)
- I use jj (Jujutsu) for version control, and many of my Claude Code skills are based on it.
- `/herdr-ship`: a global skill of mine. It implements a plan with an orchestrator, an implementer and a reviewer agent. A copy is in [`.claude/skills/herdr-ship/`](.claude/skills/herdr-ship/SKILL.md), so it also works as a project skill in this repo. The skills that it calls are in [`.claude/skills/`](.claude/skills/) too.
- Context7 for library docs, and Playwright to drive the real Zurich calculator and the app.

## Correctness, security and reliability
I did not focus on the security of the web app itself (see "Trade-offs").
For correctness I relied on tests and on the real calculator as the reference:
- The golden test cases come from the calculator bundle. I ran 8 of the 17 golden cases and the 2 built-in examples of the bundle in the live calculator with Playwright to confirm them. This check also found a bug in the calculator: after a change of the civil status, it gives `H0N`, a code that does not exist in the tariff file. The app does not copy this bug.
- A test walks every answer path of the question flow with up to 2 children and checks that each complete path gives a valid code.
- A test checks the tariff codes against the official ESTV tariff file.
- TypeScript runs in strict mode, and the server validates every input with the same Zod schema as the form. The dashboard computes the code from the stored answers and never trusts a code from the client.
- Playwright end-to-end tests run the form and the dashboard against a real test database.
- A reviewer agent (Opus) checked the work of each plan against the plan and the spec.

## Trade-offs
For the sake of simplicity I made the following trade-offs:
- No login and no other security for the app. The main focus was the extraction of the logic and a simple way to show it.
- I did not spend time on library choices, except for the points in "Approach" and Prisma 8.
- I chose Prisma 8, which is still a release candidate, for its typed contract and its native PostgreSQL enums. An API can still change before the final release, and a release candidate can have bugs.
- I let the agent decide on most of the folder structure.
- Biome runs with its recommended rules and TypeScript is strict, but I did not add any custom lint rules. In a real app this would help code quality.
- I did not read most of the code that the agents produced. The tests and the reviewer agent are what check it.
- The repo contains many files that I would usually not commit, for example plans and PDFs.
- I copied the global skills that I used into this repo so that you can understand my process better. Usually they would not live in this repo, and they are tailored to my own workflow and environment.
