---
name: herdr-impl
description: Start a new agent in a herdr pane that implements a written plan. Use when the user says "herdr-impl", "implement the plan in herdr", or wants a plan handed to a Claude Code or opencode agent. Requires HERDR_ENV=1.
argument-hint: <plan-path> [claude|opencode] [model]
allowed-tools: Bash(herdr:*), Bash(jj:*), Read
---

# herdr-impl

Start an agent in a sibling herdr pane. The agent implements a plan.

$ARGUMENTS

## Arguments

- `plan-path`: the plan file. When it is missing, use the newest
  `plans/*/plan.md`. Ask when it is not clear.
- harness: `claude` (default) or `opencode`.
- model: optional.
  - claude: default `sonnet` (the alias selects the latest Sonnet).
  - opencode: default is the configured model. Do not pass a model.

## Steps

1. Check `test "$HERDR_ENV" = 1`. When it fails, stop.
2. Derive an agent name from the plan topic: `impl-<topic>`
   (`[a-z][a-z0-9_-]{0,31}`, unique in `herdr agent list`).
3. Split a pane (`right` for a wide pane, else `down`):
   `herdr pane split --current --direction right --cwd "<plan-cwd>" --no-focus`
   `<plan-cwd>` is the workspace root of the plan (the `.workspaces/<topic>`
   folder when the plan is there). Read `.result.pane.pane_id`.
4. Start the agent:
   - claude:
     `herdr agent start <name> --kind claude --pane <id> -- --model <model> --permission-mode auto`
   - opencode with a model: first
     `herdr pane run <id> "export OPENCODE_CONFIG_CONTENT='{\"model\":\"<provider/model>\"}'"`
     Then, for both cases:
     `herdr agent start <name> --kind opencode --pane <id> -- --standalone --auto`
5. Send the brief:
   `herdr agent prompt <name> "Implement the plan in <plan-path>. Follow it task by task. Run task lint and task test. Do not commit. When you finish or are blocked, tell the caller with: herdr agent prompt $HERDR_PANE_ID '<name>: done|blocked — <one-line summary>'. Report what you changed and what is open."`
   `$HERDR_PANE_ID` is the caller pane; expand it before sending.
   Do not use `--wait`. Tell the user the agent name and pane ID.

## opencode: Venice credits

The main opencode provider is `venice`. Its free credits can run out. Then
the agent shows an error such as "payment required" (HTTP 402). Switch to
the same model on `pzero`: `venice/<model>` becomes `pzero/<model>`.
Stop the agent (`herdr agent send-keys <name> ctrl+c`), set
`OPENCODE_CONFIG_CONTENT='{"model":"pzero/<model>"}'` in the pane, start it
again and send the brief again with "continue where the last run stopped".

Always start opencode with `--standalone`. Without it, the session runs in
the shared opencode service and keeps editing files after the client dies.
