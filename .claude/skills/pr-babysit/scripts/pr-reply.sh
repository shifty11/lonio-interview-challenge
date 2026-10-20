#!/usr/bin/env bash
# Closes the loop on one review thread. The reply text comes from stdin,
# never from the command line. Run it after the push, so the sha exists.
# Usage: pr-reply.sh --pr N <thread-id> fixed|skip|wrong [sha] <<<"one-line summary"
#
#   GitHub:  fixed → reply "Fixed in <sha>. <text>" and resolve the thread
#            skip, wrong → reply "<text>"; the thread stays open
#   Forgejo: 👍 (fixed, skip) or 👎 (wrong) on Kody's comment, then an inline
#            reply "@kody Fixed in <sha>. <text>" or "@kody <text>" in Kody's
#            thread. Forgejo cannot resolve threads; the user closes them in the UI.
source "$(dirname "$0")/lib.sh"

PR_ARG=
args=()
while [ $# -gt 0 ]; do
  case $1 in --pr) PR_ARG=$2; shift 2 ;; *) args+=("$1"); shift ;; esac
done
[ -n "$PR_ARG" ] || die "--pr is required"
[ ${#args[@]} -ge 2 ] || die "usage: pr-reply.sh --pr N <thread-id> fixed|skip|wrong [sha]"
TID=${args[0]} KIND=${args[1]} SHA=${args[2]:-}
case $KIND in fixed) [ -n "$SHA" ] || die "fixed needs a sha" ;; skip|wrong) ;; *) die "bad kind $KIND" ;; esac

detect_forge
PR=${PR_ARG#\#}
text=$(cat)
[ -n "$text" ] || die "empty reply text on stdin"
prefix=""; [ "$FORGE" = forgejo ] && prefix="@kody "
[ "$KIND" = fixed ] && body="${prefix}Fixed in ${SHA:0:8}. $text" || body="$prefix$text"
tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT

if [ "$FORGE" = github ]; then
  dbid=$(gh api graphql -F id="$TID" -f query='query($id:ID!){node(id:$id){
    ... on PullRequestReviewThread{comments(first:1){nodes{databaseId}}}}}' \
    --jq '.data.node.comments.nodes[0].databaseId')
  [ -n "$dbid" ] || die "thread $TID not found"
  printf '%s' "$body" >"$tmp"
  gh api "repos/$OWNER/$REPO/pulls/$PR/comments/$dbid/replies" -X POST -F body=@"$tmp" --jq .id >/dev/null
  if [ "$KIND" = fixed ]; then
    gh api graphql -F id="$TID" -f query='mutation($id:ID!){
      resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' >/dev/null
    echo "thread $TID: replied and resolved"
  else
    echo "thread $TID: replied"
  fi
  exit 0
fi

R=$(fj_repo)
kody=$(fj_api GET "$R/pulls/$PR/reviews?limit=100" | jq -r '.[]|select(.user.login=="kody").id' |
  while read -r rid; do fj_api GET "$R/pulls/$PR/reviews/$rid/comments"; done |
  jq -cs --arg id "$TID" 'add // [] | map(select((.id|tostring)==$id))[0] // empty')
[ -n "$kody" ] || die "Kody comment $TID not found"

reaction=+1; [ "$KIND" = wrong ] && reaction=-1
jq -nc --arg c "$reaction" '{content:$c}' >"$tmp"
fj_api POST "$R/issues/comments/$TID/reactions" --data-binary @"$tmp" >/dev/null || echo "warn: reaction failed" >&2

# Same commit_id, path and position as Kody's comment, so the reply lands in its thread.
jq -nc --argjson k "$kody" --arg b "$body" \
  '{event:"COMMENT", body:"", commit_id:$k.commit_id,
    comments:[{path:$k.path, new_position:$k.position, body:$b}]}' >"$tmp"
if rid=$(fj_api POST "$R/pulls/$PR/reviews" --data-binary @"$tmp" | jq -r .id); then
  got=$(fj_api GET "$R/pulls/$PR/reviews/$rid/comments" | jq -c '.[0]|{commit_id,path,position}')
  want=$(jq -c '{commit_id,path,position}' <<<"$kody")
  [ "$got" = "$want" ] && { echo "thread $TID: reacted $reaction, replied in thread"; exit 0; }
  echo "warn: reply review $rid landed at $got, not $want" >&2
  exit 1
fi

# Fallback: one top-level comment that names the file and line.
jq -nc --argjson k "$kody" --arg t "$body" \
  '{body:("@kody " + $k.path + ":" + ($k.position|tostring) + " — " + ($t|ltrimstr("@kody ")))}' >"$tmp"
fj_api POST "$R/issues/$PR/comments" --data-binary @"$tmp" >/dev/null
echo "thread $TID: reacted $reaction, inline reply failed, posted a top-level comment"
