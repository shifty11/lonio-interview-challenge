---
name: jj-merge-pr
description: Merge a PR, squash-merging on the server so branch commits collapse into one on main. Use when the user says "merge pr", "merge", "ship it", or wants to land a branch. Works on GitHub (gh) and Forgejo (fj).
argument-hint: [--merge] [PR number]
allowed-tools: Bash(jj:*), Bash(gh:*), Bash(fj:*), Bash(perl:*), Bash(git remote:*), Bash(mv:*), Bash(herdr:*), Bash(test:*), Skill
---

## Context

- Current status: !`jj st`
- Change log: !`jj log --limit 15`
- Bookmarks: !`jj bookmark list`
- Remote: !`git remote get-url origin 2>/dev/null`

## Your task

Merge the pull request, letting the server's squash-merge collapse all branch
commits into a single commit on `main`. **Do not squash locally** — the branch
commits are already pushed, so squashing them and re-pushing would be a
force-push, and the squash-merge collapses them on the server anyway.

$ARGUMENTS

## Steps

1. **Identify the branch**: Find the bookmark on or near `@-`. If no bookmark exists, ask the user which branch to merge.

2. **Ensure commits are pushed**:
   ```bash
   jj git push -b BRANCH_NAME
   ```
   This only pushes new commits (no rewrite). If nothing is unpushed, it's a no-op.

3. **Pick the forge** from the remote URL:
   `git.odincloud.xyz` → Forgejo (`fj`). `github.com` → GitHub (`gh`).
   Anything else → stop and ask the user.

4. **Merge the PR.** Write a conventional commit subject and a body summarizing
   all changes. If the user gave a message in arguments, use that instead.

   **GitHub** (find the number with `gh pr view BRANCH_NAME --json number,url`):
   ```bash
   gh pr merge PR_NUMBER --squash \
     --subject "conventional commit subject (#PR_NUMBER)" \
     --body "summary of all changes"
   ```
   `--merge` instead of `--squash` when the user asks.

   **Forgejo** (find the number with `fj pr search -s open`):
   ```bash
   fj pr merge PR_NUMBER -M squash \
     -t "conventional commit subject (#PR_NUMBER)" \
     -m "summary of all changes"
   ```
   `-M merge` instead of `-M squash` when the user asks.

5. **Sync**: invoke the `jj-sync` skill (Skill tool) at once. Do not ask.

6. **Mark the plan finished**: when this session followed a plan in
   `plans/<n>-<topic>/` for the merged work, put `x-` in front of the folder name:
   ```bash
   mv plans/<n>-<topic> plans/x-<n>-<topic>
   ```
   The folder is outside version control, so no jj step follows. Fix the path
   references to the folder in the other plans of `plans/`. Do not renumber the
   other plans. When no plan was followed, skip this step.

7. **Close your herdr panes**: skip this step when `test "$HERDR_ENV" = 1`
   fails. Else close each pane that this session started for the merged work:
   the implementer, the reviewer, the PR watcher, a dev server or any other
   pane that this session made with `herdr pane split`, `herdr agent start` or
   a herdr skill (`/herdr-impl`, `/herdr-review`, `/herdr-babysit`).
   - Find the pane IDs in this session: the IDs that those commands returned,
     and the `Agents:` and `Other panes:` lines of
     `plans/<n>-<topic>/notes/state.md` (they survive a context compaction).
   - Check each ID with `herdr pane list`. Close only the IDs that still exist:
     ```bash
     herdr pane close <pane>
     ```
   - Never close your own pane (`$HERDR_PANE_ID`). Never close a pane that
     this session did not start, also when it is in the same tab or works in
     the same repo. When you are not sure who started a pane, keep it open and
     name it in the report.
   - When no pane is yours, skip this step.

8. **Report**: the merged PR URL, the new `main` commit, the plan rename and
   the closed panes, if any. Say nothing about the local bookmark or the remote
   branch.

## Forgejo notes

- `fj` needs its own API token, separate from the SSH key used to push. On
  `unauthorized: token is required`, run `fj auth login -H git.odincloud.xyz`.
- `fj` finds the repo only with **one** remote in the checkout. With several,
  add `--repo owner/name --host git.odincloud.xyz`.
- Check CI before merging: `fj pr status PR_NUMBER` (add `--wait` to block until
  checks finish).

## Guidelines

- **Default behavior**: squash merge on the server, no local squash
- **Never squash locally or force-push** — the squash-merge handles collapsing commits
- Only use a merge commit if explicitly requested via `--merge`
- Leave the local bookmark and the remote branch as they are. Do not delete or forget
  them, and do not mention them.
- If working copy `@` has uncommitted changes, ask the user to finalize first
- If no PR exists for the branch, tell the user to create one first with `/jj-create-pr`
- Use a conventional commit subject for the squash-merge commit
