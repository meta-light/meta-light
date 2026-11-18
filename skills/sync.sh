#!/usr/bin/env bash
# Link every skill in this directory into the agent skill dirs.
#
#   skills/sync.sh             .claude/skills and .agents/skills in this repo
#   skills/sync.sh --global    also ~/.claude/skills, ~/.agents/skills, ~/.codex/skills
#   skills/sync.sh --dry-run   print what would change
#
# Existing entries that are not links to this directory are left alone and reported.
# Links into this directory whose skill was removed or renamed are deleted.
set -euo pipefail

SRC="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(dirname "$SRC")"

global=0
dry=0
for arg in "$@"; do
  case "$arg" in
    --global) global=1 ;;
    --dry-run) dry=1 ;;
    -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

run() {
  if [ "$dry" = 1 ]; then echo "  would: $*"; else "$@"; fi
}

resolve() {
  (cd -P "$1" 2>/dev/null && pwd -P)
}

# Project links are relative so they survive cloning to another path.
sync_target() {
  local dir="$1" prefix="$2"
  echo "$dir"
  run mkdir -p "$dir"

  local linked=0 skipped=0 pruned=0
  for skill in "$SRC"/*/; do
    skill="${skill%/}"
    [ -f "$skill/SKILL.md" ] || continue
    local name dest
    name="$(basename "$skill")"
    dest="$dir/$name"

    if [ -L "$dest" ] || [ -e "$dest" ]; then
      if [ "$(resolve "$dest")" != "$skill" ]; then
        echo "  skip $name: already exists and is not ours"
        skipped=$((skipped + 1))
      fi
      continue
    fi
    run ln -s "$prefix$name" "$dest"
    echo "  link $name"
    linked=$((linked + 1))
  done

  for dest in "$dir"/*; do
    [ -L "$dest" ] || continue
    local target
    target="$(readlink "$dest")"
    case "$target" in
      "$prefix"*|"$SRC"/*) ;;
      *) continue ;;
    esac
    if [ ! -f "$dest/SKILL.md" ]; then
      run rm "$dest"
      echo "  prune $(basename "$dest")"
      pruned=$((pruned + 1))
    fi
  done

  echo "  $linked linked, $skipped skipped, $pruned pruned"
}

sync_target "$ROOT/.agents/skills" "../../skills/"
sync_target "$ROOT/.claude/skills" "../../skills/"

# ~/.agents first: entries in ~/.claude/skills often link through ~/.agents/skills.
if [ "$global" = 1 ]; then
  sync_target "$HOME/.agents/skills" "$SRC/"
  sync_target "$HOME/.claude/skills" "$SRC/"
  sync_target "$HOME/.codex/skills" "$SRC/"
fi
