#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: scripts/commit-upstream-upgrade-group.sh [--base-ref <ref>] [--dry-run] <group> [commit message]

Groups:
  upstream-sync
  layering
  local-forks
  build-cleanups
EOF
  exit 2
}

default_commit_message() {
  case "$1" in
    upstream-sync)
      printf '%s\n' 'Merge upstream 2026.3.27 baseline'
      ;;
    layering)
      printf '%s\n' 'Operations: add overlay and runtime template layering'
      ;;
    local-forks)
      printf '%s\n' 'Plugins: retain local fork surfaces after upstream upgrade'
      ;;
    build-cleanups)
      printf '%s\n' 'Build: align plugin staging and generated metadata'
      ;;
    *)
      printf 'Unknown group: %s\n' "$1" >&2
      exit 1
      ;;
  esac
}

base_ref=upstream/main
dry_run=false

if [ "${1:-}" = "--" ]; then
  shift
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-ref)
      [ "$#" -ge 2 ] || usage
      base_ref=$2
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    --help|-h)
      usage
      ;;
    --)
      shift
      break
      ;;
    -*)
      printf 'Unknown option: %s\n' "$1" >&2
      usage
      ;;
    *)
      break
      ;;
  esac
done

[ "$#" -ge 1 ] || usage

group=$1
shift

if [ "$#" -gt 0 ]; then
  commit_message=$1
else
  commit_message=$(default_commit_message "$group")
fi

files=$(pnpm -s ops:list-upstream-upgrade-groups --base-ref "$base_ref" --group "$group" --format paths)

if [ -z "$files" ]; then
  printf 'No files matched group "%s" against base ref "%s"\n' "$group" "$base_ref" >&2
  exit 1
fi

pending_files=()
while IFS= read -r file; do
  [ -n "$file" ] || continue
  if git status --short -- "$file" | grep -q .; then
    pending_files+=("$file")
  fi
done <<< "$files"

if [ "${#pending_files[@]}" -eq 0 ]; then
  printf 'No pending worktree changes matched group "%s" against base ref "%s"\n' "$group" "$base_ref" >&2
  exit 1
fi

file_count=${#pending_files[@]}

if [ "$dry_run" = true ]; then
  printf 'Base ref: %s\n' "$base_ref"
  printf 'Group: %s\n' "$group"
  printf 'Commit message: %s\n' "$commit_message"
  printf 'File count: %s\n' "$file_count"
  printf 'First files:\n'
  printf '%s\n' "${pending_files[@]}" | sed -n '1,20p'
  exit 0
fi

scripts/committer "$commit_message" "${pending_files[@]}"
