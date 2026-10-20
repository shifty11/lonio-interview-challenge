# Lonio interview challenge

The original brief, as Lonio sent it.

## Context: AI is changing everything

AI is fundamentally changing how software is built. Code generation is becoming fast and cheap. An engineer working with AI agents can produce in hours what used to take days.

But this shift does not make engineering easier — it changes what matters. When code is cheap to produce, the bottleneck moves. It moves to the decisions around the code:

- How maintainable is the architecture?
- How easy is it to change requirements without major refactoring?
- What guarantees the correctness of this system?
- How likely is a change to introduce regressions?

We believe the best engineers in this new world are not the ones who write the most code — they are the ones who direct AI effectively while maintaining high standards for the code it produces. They know what to delegate and what to control. They care about the shape of the system, not just whether it works today.

This challenge is designed to see how you work in that world.

## Ground rules

**Use AI coding agents.** This is not optional — working effectively with AI is a core part of the role. At Lonio we use Claude Code because we believe it is currently the best tool for the job, but we have not tested every alternative. You are welcome to use a different AI agent — but if you do, be ready to explain why you think it is better.

**Time:** This is not a speed test. If you are already comfortable working with AI agents, your active work may only take a couple of hours — though the agents themselves need time to run. If AI-assisted development is newer to you, it may take longer to find your workflow, and that is fine. Take the time you need. We care about the result and the process, not the clock.

**Make your own decisions.** The instructions below are deliberately open-ended. Decide how to structure things, make trade-offs. We will ask you about your choices.

**Tech stack:** Build a full-stack TypeScript application with React on the frontend and Next.js on the backend. Everything else — database, ORM, additional libraries — is your choice.

## What to build

### Background: Swiss source tax

In Switzerland, employees who are not Swiss citizens may be subject to source tax (Quellensteuer). The real rules for determining who is subject to source tax are complex, so for this challenge we simplify: assume that every non-Swiss employee is subject to source tax and needs a tariff code.

The Canton of Zurich publishes an online calculator that determines this tariff code:
https://www.zh.ch/de/steuern-finanzen/steuern/quellensteuer/quellensteuer-tarife.html

A tariff code looks like B2Y — a letter (tariff category), a number (eligible children), and Y/N (church tax). The important thing to understand is that determining this code requires asking the employee a series of conditional questions: civil status, religion, whether a spouse is employed, whether they have children, and more. Each answer can change which questions come next.

The calculator on the Zurich website shows this progressive logic. The goal is to replicate the full logic of the calculator, including edge cases.

### The application

Build an application with two screens:

- **Employee onboarding form** — A form where an employee enters their personal data. It should collect at minimum first name, last name, and nationality. Beyond that, the fields you need are driven by what is required to compute the source tax tariff code — figuring out which fields to ask is part of the challenge. The form should have conditional logic: which questions appear depends on previous answers. For example, a Swiss employee does not need to answer source tax questions at all.
- **HR dashboard** — A page where HR can see a list of employees who have completed the onboarding form. For each non-Swiss employee, the page should display the suggested source tax tariff code, computed from the data the employee entered.

### The extraction challenge

Extract the logic from the Zurich calculator and implement it as a function that computes the tariff code from employee data.

This function should be used by both the onboarding form and the HR dashboard. We want to see how you approach extracting structured business rules from an external source — this is a core challenge at Lonio, where we integrate with dozens of government portals and payroll systems.

### Building for the future

Although this challenge focuses on the Zurich source tax calculator, imagine this is the first piece of infrastructure in a much larger compliance platform.

In the future, the platform will support additional Swiss cantons, each with different rules and question flows, as well as other HR compliance processes such as family allowances, each requiring its own conditional questions and business rules.

We are not asking you to build for these scenarios today. However, we encourage you to consider how your architecture would evolve as new workflows and government processes are added. We are interested in the trade-offs you make to support long-term changeability.

## What to deliver

**A note on bugs:** It is better if the code runs, but do not spend hours chasing bugs. We care more about the architecture, the type safety, the AI workflow, and the decisions you made than whether every feature works end-to-end. If something is broken and you know why, just note it — that tells us more than a silent fix that cost you hours.

### 1. Source code

Provide a single Git repository that we can clone and run. The repository may contain multiple projects (frontend, backend, etc.) — that's perfectly fine. We simply want everything in one place.

We will review the entire repository, not just the application code. This could include spec, scripts, AI rules, and any AI-related artifacts that helped you build the solution.

### 2. README

Include a README describing:

- How you approached the challenge
- How would you improve your approach as you submitted?
- How you used AI during development
- Which tools, agents, or workflows you used.
- How you ensured the correctness, security, and reliability of the code
- Any tradeoffs you intentionally made

We are interested in your engineering process and not as much as the final result.

### 3. Architecture & changeability video (5–10 minutes)

Record a short video (Loom or similar) explaining how you would adapt the system if the Source Tax website changed tomorrow. For example:

- A question is added, removed, or renamed
- Validation rules change
- The application flow changes
- New conditional logic is introduced

Walk us through:

- The steps you would take
- Which prompts, workflows, or pipelines you would add or modify
- Which parts of the codebase would need to change manually and or review
- How you would verify that the system still works correctly

We are less interested in the specific change and more interested in how you think about maintaining and evolving the system.

### 4. Product demo (≈2 minutes)

Record a short screen capture (Loom or similar) showing the application from the user's perspective. Please demonstrate:

- Filling out the form
- Conditional fields appearing and disappearing
- Validation and error handling
- The HR dashboard
- Any key user workflows

This should be a product demo, not a code walkthrough.
