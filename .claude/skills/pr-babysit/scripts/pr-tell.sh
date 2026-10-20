#!/usr/bin/env bash
# Sends a message to the caller pane. When the caller is blocked on
# interactive input (herdr error agent_blocked), it tries again every
# --every seconds until --max seconds passed. Run it in the background.
# Prints one JSON line: {"told":true,"tries":N} or {"told":false,"tries":N,"error":"..."}.
# Usage: pr-tell.sh --to <pane> [--every 60] [--max 1800] -- <text>
TO= EVERY=60 MAX=1800
while [ $# -gt 0 ]; do
  case $1 in
    --to) TO=$2; shift 2 ;;
    --every) EVERY=$2; shift 2 ;;
    --max) MAX=$2; shift 2 ;;
    --) shift; break ;;
    *) echo "{\"told\":false,\"tries\":0,\"error\":\"unknown arg $1\"}"; exit 2 ;;
  esac
done
TEXT=$*
[ -n "$TO" ] && [ -n "$TEXT" ] || { echo '{"told":false,"tries":0,"error":"--to and a text are required"}'; exit 2; }

start=$SECONDS tries=0
while :; do
  tries=$((tries + 1))
  out=$(herdr agent prompt "$TO" "$TEXT" 2>&1) && { jq -cn --argjson n "$tries" '{told:true,tries:$n}'; exit 0; }
  if ! grep -q agent_blocked <<<"$out" || [ $((SECONDS - start + EVERY)) -gt "$MAX" ]; then
    err=$(jq -r '.error.message // empty' <<<"$out" 2>/dev/null)
    jq -cn --argjson n "$tries" --arg e "${err:-$(tail -n1 <<<"$out")}" '{told:false,tries:$n,error:$e}'
    exit 1
  fi
  sleep "$EVERY"
done
