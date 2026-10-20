---
name: jj-create-pr
description: Push current branch and create or update a pull request. Works on GitHub (gh) and Forgejo (fj).
argument-hint: [title or description]
allowed-tools: Bash(jj:*), Bash(gh:*), Bash(fj:*), Bash(perl:*), Bash(git remote:*)
---

## Context

- Current status: !`jj st`
- Change log: !`jj log --limit 15`
- Bookmarks: !`jj bookmark list`
- Remote: !`git remote get-url origin 2>/dev/null`

## Your task

Push the current changes and create or update a pull request.

$ARGUMENTS

## Steps

1. **Review the change stack**: Look at `jj log` to understand what commits will be in the PR.

2. **Set a bookmark** on the commit to push (usually `@-` after a `jj commit`, or the relevant change):
   ```bash
   jj bookmark set BRANCH_NAME -r REVISION
   ```
   Derive the branch name from the change description (e.g. `feat/add-swap-routing`).

3. **Push to remote**:
   ```bash
   jj git push -b BRANCH_NAME
   ```
   The push prints the PR URL — the existing one, or a "create a new pull request"
   link. Read it. It is the most reliable way to find the PR.

4. **Pick the forge** from the remote URL:
   `git.odincloud.xyz` → Forgejo (`fj`). `github.com` → GitHub (`gh`).
   Anything else → stop and ask the user.

5. **Create the PR** (skip if step 3 showed one already exists — the push updated it):

   **GitHub:**
   ```bash
   gh pr view BRANCH_NAME --json url,title     # check first
   gh pr create --base main --head BRANCH_NAME --title "TITLE" --body "$(cat <<'EOF'
   ## Summary
   - bullet 1
   EOF
   )"
   ```

   **Forgejo:** write the body to a file, then:
   ```bash
   fj pr create "TITLE" --base main --head BRANCH_NAME --body-file /tmp/pr-body.md
   ```

## Forgejo notes

- `fj` needs its own API token. The SSH key that pushes does **not** authorize it.
  On `unauthorized: token is required`, tell the user to run
  `fj auth login -H git.odincloud.xyz`.
- `fj` finds the repo only when the checkout has **one** remote. With several,
  add `--repo owner/name --host git.odincloud.xyz`.
- To list PRs: `fj pr search -s open`. It does not show head branches, so match a
  branch by reading the ``From `branch` into `main` `` line of `fj pr view N`.
- `fj` wraps output in Unicode isolates. Strip them before parsing:
  `fj … | perl -CS -pe 's/[\x{2066}-\x{2069}]//g'`

## Guidelines

- **Title**: conventional commits style — `feat: ...`, `fix: ...`, `refactor: ...`
- **Summary**: 2-4 concise bullet points, focus on "why" and "what"
- **Target branch**: `main`
- If working copy has uncommitted changes, ask the user to commit first
- Return the PR URL when done
