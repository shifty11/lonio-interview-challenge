---
name: herdr-babysit
description: Use when the user says "herdr-babysit", "babysit in herdr", or wants a cheap agent in a herdr pane to watch the current PR and report fix work back to this session. Requires HERDR_ENV=1.
argument-hint: "[#pr] [poll interval e.g. 5m] [model]"
allowed-tools: Bash(herdr:*), Bash(jj:*), Bash(git rev-parse:*)
---

# herdr-babysit

Start a watcher agent in a sibling herdr pane. The watcher runs
`/pr-babysit` and sends "PR #N needs fixes. Report: <path>" back to this pane
when there is work. This session decides what to do with the report.

$ARGUMENTS

## Arguments

- `#N`: the PR number. Default: the watcher finds the PR of the current branch.
- interval: for example `5m`. Default: `270s`.
- model: default `haiku`.

## Steps

1. Check `test "$HERDR_ENV" = 1`. When it fails, stop.
2. Name the agent `babysit-<pr or bookmark>`. Names must match
   `[a-z][a-z0-9_-]{0,31}` and be unique in `herdr agent list`: put `-` in
   place of other characters (`feat/x` → `feat-x`) and cut to 32 characters.
3. Split a pane:
   `herdr pane split --current --direction down --cwd "$(git rev-parse --show-toplevel)" --no-focus`
   Read `.result.pane.pane_id`.
4. Start the agent:
   `herdr agent start <name> --kind claude --pane <id> -- --model <model> --permission-mode auto`
5. Send the brief. Expand `$HERDR_PANE_ID` before you send it:
   `herdr agent prompt <name> "/pr-babysit caller=$HERDR_PANE_ID <#N> <interval>"`
   Do not use `--wait`.
6. Tell the user the agent name and the pane ID. When a report message
   arrives later, read the report and ask the user what to do with it, unless
   the user said so before. One option is `/pr-fix <path>` in this session.
7. **After each fix push, start the next round.** The watcher does not see a
   new head on its own after it sends a report: it waits for this session.
   Send the brief again, with the new head:
   `herdr agent prompt <name> "Fix pushed (head <sha>). /pr-babysit caller=$HERDR_PANE_ID <#N> <interval>"`
   Then run `herdr pane read <pane> | tail` once. When the brief sits unsent
   in the input box, run `herdr agent send-keys <name> enter`. Do this after
   every push to the PR branch, also when the push came from a fix that was
   not `/pr-fix`.
