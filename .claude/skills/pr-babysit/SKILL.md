---
name: pr-babysit
description: Use when the user says "babysit the PR", "watch CI", "watch the PR", "fix coderabbit and CI", "fix kody and CI", or when /herdr-babysit starts a watcher with caller=<pane>. Watches CI and the review bot (CodeRabbit on GitHub, Kody on Forgejo) of the current branch's PR until it is all green.
argument-hint: "[caller=<pane-id>] [#pr] [poll interval e.g. 5m]"
allowed-tools: Bash(bash:*), Bash(herdr agent prompt:*), Bash(jj st:*), Read
---

# pr-babysit — PR watcher

You watch a PR and report the fix work to the caller. The caller decides what to
do with the report. You do not fix anything.
Scripts do all forge work. You read only their one-line JSON output.

$ARGUMENTS

Scripts: `S=~/.claude/skills/pr-babysit/scripts`

## Arguments

- `caller=<pane-id>`: the herdr pane that gets the reports. Without it, the
  user is the caller.
- `#N` or `N`: the PR number. Default: the open PR of the current branch.
- interval: `90s`, `5m` → seconds. Default: `270`.

## Start (one time)

1. Run `bash $S/pr-state.sh` (add `--pr N` when given). Keep `pr` from the
   output. Give `--pr <pr>` to every later script call.
2. Run `jj st`. When the working copy has changes, tell the caller one time:
   "CI and the review bot see only pushed commits."
3. Handle the state JSON.

## Handle a state JSON

Print one line:
`PR #<pr> · <head> · CI <passed>✓ <pending>… <failed>✗ · review <state>, <open> open · <action>`

Then do the row for `action`:

| action | Do |
|---|---|
| `wait` | Wait. |
| `still-waiting`, `idle` false | Wait. |
| `still-waiting`, `idle` true | Tell "PR #N: no change for 25 min. The open work is reported. The watcher stops." Stop. |
| `fix` | Run `bash $S/pr-report.sh --pr N`. It prints a path. Tell "PR #N needs fixes. Report: <path>". Without a caller: stop after you tell it. With a caller: start the Wait in the same turn, right after the tell. |
| `done` | Tell "PR #N is all green (<nits> nits). The merge is the user's decision." Stop. |
| `stuck` | Tell "PR #N is stuck: <keys> stay open after 2 fix pushes. The watcher stops." Stop. |
| `no-pr` | Tell "No open PR for <branch>. Run /jj-create-pr." Stop. |

**Wait:** run `bash $S/pr-wait.sh --pr N --interval <interval>` with the Bash
tool and `run_in_background: true`. With a caller, add `--caller <caller>`.
End the turn. When the command exits, you get a notification. Read its output
file (one JSON line) and handle it.

**The caller after a wait:** the JSON of `pr-wait.sh` has a `caller` field.
It is the caller of this turn: a pane id means "with a caller", null means
"without a caller". Use this field, not your memory of the first turn.

A wait is a running `pr-wait.sh`. "I wait for the caller" with no
`pr-wait.sh` in the background is not a wait: the watcher then sleeps for
good. Every turn that does not stop ends with exactly one `pr-wait.sh` in the
background. `pr-wait.sh` sees the caller's fix push on its own: a new head
gives the open keys again as not reported.

**A new brief from the caller** (for example "Fix pushed (head <sha>).
/pr-babysit …"): do Start again. When a `pr-wait.sh` of an earlier turn still
runs, do not start a second one; handle the state JSON of Start, and when its
action is a wait, end the turn and let the running wait report.

**Tell:** with a caller, run
`bash $S/pr-tell.sh --to <caller> -- <text>` with the Bash tool and
`run_in_background: true`. The caller can be blocked on a question to the user
(herdr error `agent_blocked`); then `pr-tell.sh` tries again every 60 s for up
to 30 min. A tell does not change the next step: a Stop still ends the turn,
and a Wait still starts `pr-wait.sh`. When the tell exits, read its JSON line:
`told` true needs nothing more. `told` false: print the text and the error in
this pane, and send the tell no more. Without a caller, print the text.

**Stop:** end the turn without a wait.

## Rules

- Your only actions: the scripts in `$S`, `jj st`, and reading the output
  files of your background commands. Send each tell through `pr-tell.sh`,
  never with a direct `herdr agent prompt`.
- Do not read report files, logs, code or review comments. Do not edit files,
  commit or push. Do not call `gh`, `fj` or `curl`.
- Do not use `ScheduleWakeup` or `sleep`. `pr-wait.sh` and `pr-tell.sh` do
  the waiting.
- Never merge, and never tell the caller to merge or to run a merge command
  such as `/jj-merge-pr`. Only the user decides on a merge.
- When a script fails, tell the caller its last error line and stop.
