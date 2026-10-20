#!/usr/bin/env bash
# Polls pr-state.sh until there is something new to do, then prints the state
# JSON and exits. Run it in the background; its exit wakes the agent.
# Usage: pr-wait.sh --pr N [--interval 270] [--max 1500] [--caller <pane-id>]
#
# Each printed JSON has a "caller" field: the --caller value, or null. The
# agent that wakes on the exit reads the caller from it, so the caller does not
# depend on the memory of the first turn.
#
# Exits when:
#   action is fix, and a key was not reported yet for this head
#   action is done, stuck or no-pr
#   --max seconds passed: action becomes "still-waiting", and "idle" is true
#   when CI and review are finished and only already-reported work is open
source "$(dirname "$0")/lib.sh"

PR_ARG= INTERVAL=270 MAX=1500 CALLER=
while [ $# -gt 0 ]; do
  case $1 in
    --pr) PR_ARG=$2; shift 2 ;;
    --interval) INTERVAL=$2; shift 2 ;;
    --max) MAX=$2; shift 2 ;;
    --caller) CALLER=$2; shift 2 ;;
    *) die "unknown arg $1" ;;
  esac
done
[ -n "$PR_ARG" ] || die "--pr is required"

# Prints the state JSON on one line, with the caller.
emit() { jq -c --arg c "$CALLER" '.caller = (if $c == "" then null else $c end)' <<<"$1"; }

detect_forge
PR=${PR_ARG#\#}
start=$SECONDS s='{}'
while :; do
  if t=$(bash "$(dirname "$0")/pr-state.sh" --pr "$PR" 2>/dev/null); then
    s=$t
    action=$(jq -r .action <<<"$s")
    case $action in
      done|stuck|no-pr) emit "$s"; exit 0 ;;
      fix)
        new=$(jq -r --argjson h "$(read_history)" \
          '[.head as $head | .keys[] | select((($h.reported[.] // []) | index($head)) == null)] | length' <<<"$s")
        [ "$new" -gt 0 ] && { emit "$s"; exit 0; } ;;
    esac
  fi
  if [ $((SECONDS - start + INTERVAL)) -gt "$MAX" ]; then
    emit "$(jq -c '.action = "still-waiting"
      | .idle = (.ci.pending == 0 and .review.state != "pending")' <<<"$s")"
    exit 0
  fi
  sleep "$INTERVAL"
done
