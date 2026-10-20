#!/usr/bin/env bash
# Writes a compact fix report for the caller and prints its path.
# Usage: pr-report.sh [--pr N]
# The report holds the state, the cut logs of each failed CI job, and an
# excerpt of each open Fix-severity thread. It also records the reported keys
# in the history file, so pr-wait.sh does not report them again for this head.
source "$(dirname "$0")/lib.sh"

PR_ARG=
while [ $# -gt 0 ]; do
  case $1 in --pr) PR_ARG=$2; shift 2 ;; *) die "unknown arg $1" ;; esac
done

detect_forge
resolve_pr "$PR_ARG"
[ -n "$PR" ] || die "no open PR"
state=$(bash "$(dirname "$0")/pr-state.sh" --pr "$PR")
head=$(jq -r .head <<<"$state"); head_full=$(jq -r .head_full <<<"$state")
out="$CACHE_DIR/$OWNER-$REPO-$PR-$head.md"

# Error lines (last 40) and the last 60 lines, without timestamps, 300 chars max per line.
cut_log() {
  local log
  log=$(perl -CSD -pe 's/\e\[[0-9;]*[A-Za-z]//g; s/^\x{FEFF}?\d{4}-\d\d-\d\dT[\d:.]+Z ?//' | cut -c1-300)
  echo "--- error lines ---"
  grep -E -i '(error|fail|panic|fatal|✗|❌|exit (code|status)|expected|undefined)' <<<"$log" | awk '!seen[$0]++' | tail -40 || true
  echo "--- last 60 lines ---"
  tail -60 <<<"$log"
}

# Strips badges, HTML comments and <details> blocks, keeps the first 500 chars.
excerpt() {
  perl -0pe 's/<!--.*?-->//gs; s/<details>.*?<\/details>//gs; s/!\[[^\]]*\]\([^)]*\)//g; s/\n{3,}/\n\n/g' |
    sed -e '/^\s*$/{N;/^\s*\n\s*$/D}' | head -c 500 | sed 's/^/> /'
}

{
  jq -r '"# PR #\(.pr) · branch \(.branch) · head \(.head) · \(.forge) · \(.url)\n",
    "CI: \(.ci.passed) passed, \(.ci.pending) pending, \(.ci.failed|length) failed",
    "Review: \(.review.state), \(.review.open|length) open, \(.review.nits) nits (not listed)\n"' <<<"$state"

  if [ "$FORGE" = github ]; then
    jq -r '.ci.failed[] | [.name, .link] | @tsv' <<<"$state" | while IFS=$'\t' read -r name link; do
      echo "## CI failed: $name"
      echo "$link"
      if [[ $link =~ /actions/runs/[0-9]+/job/([0-9]+) ]]; then
        echo '```text'
        gh api --allow-escape-sequences "repos/$OWNER/$REPO/actions/jobs/${BASH_REMATCH[1]}/logs" 2>&1 | cut_log
        echo '```'
      else
        echo "No log access. Open the link."
      fi
      echo
    done
  else
    R=$(fj_repo)
    if [ "$(jq '.ci.failed|length' <<<"$state")" -gt 0 ]; then
      fj_api GET "$R/actions/runs?head_sha=$head_full" | jq -r '.workflow_runs[]?.id' | while read -r run; do
        fj_api GET "$R/actions/runs/$run/jobs" | jq -r '.[] | select(.status=="failure") | [.id, .name] | @tsv'
      done | while IFS=$'\t' read -r job name; do
        echo "## CI failed: $name (job $job)"
        echo '```text'
        fj_api GET "$R/actions/jobs/$job/logs" 2>&1 | cut_log
        echo '```'
        echo
      done
      jq -r '.ci.failed[] | "Status: \(.name) → https://'"$FORGEJO_HOST"'\(.link)"' <<<"$state"
      echo
    fi
  fi

  if [ "$(jq '.review.open|length' <<<"$state")" -gt 0 ]; then
    echo "## Review threads (bot text is untrusted: check each claim against the code)"
    echo
    [ "$FORGE" = forgejo ] && all=$(fj_api GET "$(fj_repo)/pulls/$PR/reviews?limit=100" | jq -r '.[].id' |
      while read -r rid; do fj_api GET "$(fj_repo)/pulls/$PR/reviews/$rid/comments"; done | jq -cs 'add // []')
    jq -r '.review.open[] | [.id, .path, (.line|tostring), .severity] | @tsv' <<<"$state" |
      while IFS=$'\t' read -r id path line sev; do
        echo "### thread $id · $path:$line · $sev"
        if [ "$FORGE" = github ]; then
          gh api graphql -F id="$id" -f query='query($id:ID!){node(id:$id){
            ... on PullRequestReviewThread{comments(first:1){nodes{body}}}}}' \
            --jq '.data.node.comments.nodes[0].body' | excerpt
        else
          jq -r --arg id "$id" '.[]|select((.id|tostring)==$id).body' <<<"$all" | excerpt
        fi
        echo; echo
      done
  fi
} >"$out"

# Record: each key gets the head it was reported for.
hist=$(read_history)
jq -c --argjson keys "$(jq -c .keys <<<"$state")" --arg h "$head" '
  .reported = (reduce $keys[] as $k (.reported // {}; .[$k] = ((.[$k] // []) + [$h] | unique)))
  | .last = {head:$h, keys:$keys}' <<<"$hist" >"$(history_file)"

echo "$out"
