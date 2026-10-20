---
name: jj-sync
description: Fetch latest changes from remote and rebase current stack onto main. Use when the user says "sync", "rebase", "update from main", or "pull".
allowed-tools: Bash(jj:*)
---

## Context

- Recent log: !`jj log --limit 10`

## Your task

Sync with the latest remote changes and rebase the current stack onto main.

$ARGUMENTS

## Steps

1. **Fetch remote changes**:
   ```bash
   jj git fetch
   ```

2. **Update local main bookmark**:
   ```bash
   jj bookmark set main -r main@origin
   ```

3. **Check whether the stack is already merged** — do this *before* rebasing:
   ```bash
   jj diff --from main --to @ --summary
   ```
   Empty output means the stack's content is already in `main`, which is the normal
   state right after a **squash-merge** (`/jj-merge-pr`). Do **not** rebase; the
   branch commits have nothing left to contribute:
   ```bash
   jj new main
   ```
   Then skip to step 5.

   Why this matters: a squash-merge collapses the branch into **one new commit with a
   different hash**, so jj cannot tell the originals are already applied. `jj rebase`
   dutifully replays each one onto a `main` that already contains its changes, which
   conflicts instead of emptying — `--skip-emptied` does not help, because a
   *conflicted* commit is not an *emptied* one. The rebase also drags the branch's
   bookmark onto the replayed commits, so it diverges from `origin`.

4. **Rebase onto main** — only when step 3 showed real changes:
   ```bash
   jj rebase -d main
   ```

5. **Show the result**: Run `jj log --limit 5` so the user can see the rebased stack.

## Guidelines

- **`jj undo` is the escape hatch.** It reverses the last operation cleanly, conflicts
  included. If a rebase goes wrong, undo it and re-check step 3 rather than resolving
  conflicts that should not exist.
- Never resolve rebase conflicts whose "resolution" is an empty commit — that is the
  signature of rebasing an already-merged branch. Undo and use `jj new main`.
- If there are genuine rebase conflicts (step 3 showed real changes), show them and let
  the user resolve manually
- After `jj new main`, the merged branch commits and their bookmark are left in place;
  they still mirror the remote branch. Only remove them if the user asks:
  `jj bookmark forget BRANCH` (local) and `jj git push --deleted` (remote too).
  Do not mention the leftover bookmark in the report.
- If the user specifies a different target branch (e.g. "sync onto develop"), use that
  instead of main — including in the step 3 check
