#!/usr/bin/env bash
# One snapshot of a PR as compact JSON. Usage: pr-state.sh [--pr N]
#
# action:
#   no-pr  no open PR for the branch
#   fix    a CI job failed, or the review is done and has open Fix-severity threads
#   wait   CI or review still runs, nothing to fix
#   done   CI green, review done, no open Fix-severity thread
#   stuck  a failed job or thread is still open on a 3rd head after 2 reports
#
# Fix severity: Kody critical/high/medium, CodeRabbit Critical/Major/Minor.
# A thread is handled when it is resolved, outdated, has a resolver, or has a
# reply from our own account.
source "$(dirname "$0")/lib.sh"

PR_ARG=
while [ $# -gt 0 ]; do
  case $1 in --pr) PR_ARG=$2; shift 2 ;; *) die "unknown arg $1" ;; esac
done

detect_forge
resolve_pr "$PR_ARG"
if [ -z "$PR" ]; then
  jq -nc --arg f "$FORGE" --arg b "$(current_branch)" '{forge:$f, branch:$b, action:"no-pr"}'
  exit 0
fi
ME=${PR_BABYSIT_ME:-$(my_login)}  # override only for tests

if [ "$FORGE" = github ]; then
  pr=$(gh pr view "$PR" -R "$OWNER/$REPO" --json state,headRefName,headRefOid,url)
  checks=$(gh pr checks "$PR" -R "$OWNER/$REPO" --json name,bucket,link 2>/dev/null || echo '[]')
  ci=$(jq -c '[.[]|select(.name!="CodeRabbit")|{name, state:(
          if .bucket=="pass" or .bucket=="skipping" then "pass"
          elif .bucket=="pending" then "pending" else "fail" end), link}]' <<<"$checks")
  review_state=$(jq -r '[.[]|select(.name=="CodeRabbit")][0].bucket // "absent"
          | if .=="pending" then "pending" elif .=="absent" then "absent" else "done" end' <<<"$checks")
  threads=$(gh api graphql --paginate -F owner="$OWNER" -F repo="$REPO" -F pr="$PR" -f query='
    query($owner:String!,$repo:String!,$pr:Int!,$endCursor:String){
      repository(owner:$owner,name:$repo){pullRequest(number:$pr){
        reviewThreads(first:100,after:$endCursor){pageInfo{hasNextPage endCursor}
          nodes{id isResolved isOutdated path line
            comments(first:50){nodes{author{login} body}}}}}}}' |
    jq -c --arg me "$ME" '[.data.repository.pullRequest.reviewThreads.nodes[]
      | select(.comments.nodes[0].author.login|test("^coderabbit"))
      | select(.isResolved|not) | select(.isOutdated|not)
      | select([.comments.nodes[]|select(.author.login==$me)]|length==0)
      | (.comments.nodes[0].body) as $b
      | {id, path, line,
         severity:(($b|capture("_(?<s>[^_]*(Critical|Major|Minor|Trivial|Nitpick|Info))_")?|.s)
                   // "unknown" | sub("^[^A-Za-z]*";""))}]' | jq -cs 'add // []')
  head=$(jq -r .headRefOid <<<"$pr"); branch=$(jq -r .headRefName <<<"$pr"); url=$(jq -r .url <<<"$pr")
  fixre='^(Critical|Major|Minor|unknown)$'
else
  R=$(fj_repo)
  pr=$(fj_api GET "$R/pulls/$PR")
  head=$(jq -r .head.sha <<<"$pr"); branch=$(jq -r .head.ref <<<"$pr"); url=$(jq -r .html_url <<<"$pr")
  status=$(fj_api GET "$R/commits/$head/status")
  ci=$(jq -c '[.statuses[]?|select(.context|test("kod";"i")|not)|{name:.context, state:(
          if .status=="success" then "pass" elif .status=="pending" then "pending" else "fail" end),
          link:.target_url}]' <<<"$status")
  review_state=$(jq -r '[.statuses[]?|select(.context|test("kod";"i"))][0].status // "absent"
          | if .=="pending" then "pending" elif .=="absent" then "absent" else "done" end' <<<"$status")
  # Kody files one review per finding. Collect all review comments once.
  comments=$(fj_api GET "$R/pulls/$PR/reviews?limit=100" | jq -r '.[].id' |
    while read -r rid; do fj_api GET "$R/pulls/$PR/reviews/$rid/comments"; done | jq -cs 'add // []')
  threads=$(jq -c --arg me "$ME" '
    . as $all
    | [.[] | select(.user.login=="kody") | select(.resolver==null)
       | . as $k
       | select([$all[] | select(.user.login==$me and .path==$k.path
                 and .position==$k.position and .commit_id==$k.commit_id)] | length==0)
       | {id:(.id|tostring), path, line:.position,
          severity:((.body|capture("severity_level-(?<s>[a-z]+)")?|.s) // "unknown")}]' <<<"$comments")
  fixre='^(critical|high|medium|unknown)$'
fi

jq -nc --arg forge "$FORGE" --arg repo "$OWNER/$REPO" --argjson pr "$PR" --arg url "$url" \
  --arg branch "$branch" --arg head "$head" --argjson ci "$ci" --arg rs "$review_state" \
  --argjson threads "$threads" --arg fixre "$fixre" --argjson hist "$(read_history)" '
  ($ci|map(select(.state=="fail"))) as $failed
  | ($ci|map(select(.state=="pending"))|length) as $pending
  | ($threads|map(select(.severity|test($fixre)))) as $open
  | ($threads|length - ($open|length)) as $nits
  # A review that never reported counts as done once CI has finished.
  | (if $rs=="absent" then (if $pending==0 and ($ci|length)>0 then "done" else "pending" end) else $rs end) as $review
  | ([$failed[]|"ci:"+.name] + (if $review=="done" then [$open[]|"thread:"+.id] else [] end)) as $keys
  | {forge:$forge, repo:$repo, pr:$pr, url:$url, branch:$branch, head:$head[0:8], head_full:$head,
     ci:{passed:($ci|map(select(.state=="pass"))|length), pending:$pending,
         failed:[$failed[]|{name, link}]},
     review:{state:$review, open:$open, nits:$nits},
     keys:$keys,
     action:(
       if ([$keys[] | select((($hist.reported[.] // []) - [$head[0:8]] | length) >= 2)] | length) > 0 then "stuck"
       elif ($keys|length) > 0 then "fix"
       elif $pending==0 and $review=="done" then "done"
       else "wait" end)}'
