# herdr-ship templates

Replace each `<…>`. Write all text in STE. Expand `$HERDR_PANE_ID` before you
send a brief.

## state.md

```markdown
# State: <n>-<topic>

- Phase: clarify | plan | gate | implement | verify | review | e2e | pr | fix-loop | done
- Intent: <one line>
- Grant: none | approved <date>: commit, push, PR, thread replies, fix rounds; no merge
- Orchestrator pane: <pane>
- Agents: impl-<topic> <pane>, review-<topic> <pane>, babysit-<pr> <pane>
- Other panes: <role> <pane> (for example dev-server <pane>), or none
- Bookmark: <type>/<topic>
- PR: #<pr> <url>
- Head: <sha8>
- Rounds: <k> (last: notes/round-<k>.md)
- Open: <items>
```

## Implement brief

Send after `/herdr-impl` started the agent (the skill sends its own short
brief; send this one as the next prompt):

```
Read plans/<n>-<topic>/plan.md and plans/<n>-<topic>/spec.md. The spec wins over the plan. Implement the order of work task by task. Write tests for the real behavior. Run task lint, task test and the diff-coverage report of the repo when it has one. Do not commit and do not push. Write a short result to plans/<n>-<topic>/notes/impl-result.md. When you finish or are blocked, tell the caller with: herdr agent prompt <orchestrator-pane> 'impl-<topic>: done|blocked — <one-line summary>'.
```

## Round brief (`notes/round-<k>.md`)

Used for the review round and for each PR fix round.

```markdown
# Round <k>: <review | CI and bot review> (PR #<pr>, head <sha8>)

Source: <notes/review.md | babysit report path>

Work in the jj working copy (@). Do not commit. Do not push.

## 1. <thread or finding id>: <short title>

<file:line>. <What is wrong, in your own words, checked against the code.>
Fix: <the rule to apply, and what must not change>.
Tests: <the test to add>.
Docs: <the doc and spec parts to update, or "none">.

## <k>. <thread id>: no change

The caller answers this thread.

## Rules

STE prose in docs and comments, present tense. Run <task lint, task test,
the race run of the touched packages, the diff-coverage report>. Write a
short result to plans/<n>-<topic>/notes/round-<k>-result.md.
```

Prompt to send:

```
New round. Read plans/<n>-<topic>/notes/round-<k>.md and do it. Do not commit and do not push. When you finish or are blocked: herdr agent prompt <orchestrator-pane> 'impl-<topic>: done|blocked — <one-line summary>'.
```

## Thread reply

One or two sentences. `fixed`: what changed. `skip`: why not in this PR.
`wrong`: why the claim is not correct, with file:line.

## PR body

```markdown
## Summary
- <what and why, 2–4 bullets>

## Test plan
- <checks that pass>
- Not done: <steps that did not run, or "none">
```
