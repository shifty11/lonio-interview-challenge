# Shared helpers for the pr-babysit scripts. Source this file; do not run it.
# Needs: git, jq, curl. GitHub also needs gh. Branch lookup needs jj.

set -euo pipefail

FORGEJO_HOST=git.odincloud.xyz
# A remote can name the internal host of the same Forgejo. The API and the
# fj token still use FORGEJO_HOST.
FORGEJO_REMOTE_HOSTS=("$FORGEJO_HOST" git-internal.odincloud.xyz)
CACHE_DIR=${XDG_CACHE_HOME:-$HOME/.cache}/pr-babysit
mkdir -p "$CACHE_DIR"

die() { echo "error: $*" >&2; exit 1; }

# Sets FORGE (github|forgejo), OWNER, REPO from the origin remote.
detect_forge() {
  local url path host
  url=$(git remote get-url origin 2>/dev/null) || die "no origin remote"
  FORGE=
  case "$url" in
    *github.com[:/]*) FORGE=github ;;
    *)
      for host in "${FORGEJO_REMOTE_HOSTS[@]}"; do
        case "$url" in *"$host"[:/]*) FORGE=forgejo ;; esac
      done
      ;;
  esac
  [ -n "$FORGE" ] || die "unknown forge: $url"
  path=${url#*://}          # strip scheme
  path=${path#*@}           # strip user@
  path=${path#*[:/]}        # strip host and : or /
  path=${path%.git}
  OWNER=${path%%/*}
  REPO=${path#*/}
}

# The bookmark on @- (else @). Reads only; never snapshots the working copy.
current_branch() {
  local b
  for rev in @- @; do
    b=$(jj log --ignore-working-copy -r "$rev" --no-graph \
      -T 'local_bookmarks.map(|b| b.name()).join("\n")' 2>/dev/null | head -1)
    [ -n "$b" ] && { echo "$b"; return; }
  done
}

# Forgejo API GET/POST. The token stays in this function and is never printed.
fj_api() {
  local method=$1 path=$2; shift 2
  local token
  # fj keys the token by the host it logged in to, which can be the internal
  # host name. Take the first host that has a token.
  token=$(jq -r '[$ARGS.positional[] as $h | .hosts[$h].token // empty][0] // empty' \
    ~/.local/share/forgejo-cli/keys.json --args "${FORGEJO_REMOTE_HOSTS[@]}")
  [ -n "$token" ] || die "no fj token for ${FORGEJO_REMOTE_HOSTS[*]}; run: fj auth login -H $FORGEJO_HOST"
  curl -sS --fail-with-body -X "$method" -H "Authorization: token $token" \
    -H 'Content-Type: application/json' "$@" "https://$FORGEJO_HOST/api/v1$path"
}
fj_repo() { echo "/repos/$OWNER/$REPO"; }

# Prints the open PR number for a branch, or nothing.
find_pr() {
  local branch=$1
  [ -n "$branch" ] || return 0
  if [ "$FORGE" = github ]; then
    gh pr list -R "$OWNER/$REPO" --head "$branch" --state open --json number -q '.[0].number'
  else
    fj_api GET "$(fj_repo)/pulls?state=open&limit=50" |
      jq -r --arg b "$branch" '[.[]|select(.head.ref==$b)][0].number // empty'
  fi
}

# Resolves PR from "--pr N" or the current branch. Sets PR.
resolve_pr() {
  PR=${1:-}
  PR=${PR#\#}
  [ -n "$PR" ] || PR=$(find_pr "$(current_branch)")
}

history_file() { echo "$CACHE_DIR/$OWNER-$REPO-$PR.json"; }
read_history() { local f; f=$(history_file); [ -s "$f" ] && cat "$f" || echo '{}'; }

# The login of the token owner. Replies from this login mark a thread as handled.
my_login() {
  if [ "$FORGE" = github ]; then gh api user --jq .login; else fj_api GET /user | jq -r .login; fi
}
