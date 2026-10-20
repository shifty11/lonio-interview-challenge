---
name: herdr-review
description: Start a new agent in a herdr pane that reviews implemented changes against a plan. Use when the user says "herdr-review", "review in herdr", or wants a Claude Code or opencode agent to review a diff. Requires HERDR_ENV=1.
argument-hint: [plan-path] [revset] [claude|opencode] [model]
allowed-tools: Bash(herdr:*), Bash(jj:*), Read
---

# herdr-review

Start an agent in a sibling herdr pane. The agent reviews changes against a
plan. It does not change code.

$ARGUMENTS

## Arguments

- `plan-path`: the plan file. When it is missing, use the newest
  `plans/*/plan.md`. Ask when it is not clear.
- `revset`: the changes to review. Default: `trunk()..@`.
- harness: `claude` (default) or `opencode`.
- model: optional.
  - claude: default `opus` (the alias selects the latest Opus).
  - opencode: default is the configured model. Do not pass a model.

## Steps

1. Check `test "$HERDR_ENV" = 1`. When it fails, stop.
2. Derive an agent name from the plan topic: `review-<topic>`
   (`[a-z][a-z0-9_-]{0,31}`, unique in `herdr agent list`).
3. Split a pane (`right` for a wide pane, else `down`):
   `herdr pane split --current --direction right --cwd "<plan-cwd>" --no-focus`
   `<plan-cwd>` is the workspace root of the changes (the `.workspaces/<topic>`
   folder when the plan is there). Read `.result.pane.pane_id`.
4. Start the agent:
   - claude:
     `herdr agent start <name> --kind claude --pane <id> -- --model <model> --permission-mode auto`
   - opencode with a model: first
     `herdr pane run <id> "export OPENCODE_CONFIG_CONTENT='{\"model\":\"<provider/model>\"}'"`
     Then, for both cases:
     `herdr agent start <name> --kind opencode --pane <id> -- --standalone --auto`
5. Send the brief:
   `herdr agent prompt <name> "Review the changes in jj revset <revset> against the plan in <plan-path>. Read the diff with jj diff -r '<revset>'. Run task lint and task test. Find bugs, missed plan steps, missing tests and violations of CLAUDE.md. Do not edit code and do not commit. Write the findings, most severe first, each with file:line, to plans/<topic>/notes/review.md. When you finish or are blocked, tell the caller with: herdr agent prompt $HERDR_PANE_ID '<name>: done|blocked — <one-line summary>'."`
   `$HERDR_PANE_ID` is the caller pane; expand it before sending.
   Do not use `--wait`. Tell the user the agent name, pane ID and report path.

## opencode: Venice credits

The main opencode provider is `venice`. Its free credits can run out. Then
the agent shows an error such as "payment required" (HTTP 402). Switch to
the same model on `pzero`: `venice/<model>` becomes `pzero/<model>`.
Stop the agent (`herdr agent send-keys <name> ctrl+c`), set
`OPENCODE_CONFIG_CONTENT='{"model":"pzero/<model>"}'` in the pane, start it
again and send the brief again with "continue where the last run stopped".

Always start opencode with `--standalone`. Without it, the session runs in
the shared opencode service and keeps editing files after the client dies.
