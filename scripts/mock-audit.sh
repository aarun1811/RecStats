#!/usr/bin/env bash
# mock-audit.sh — Phase 10 Wave 0 grep sweep for mock/fallback offenders.
#
# Exits 0 when the production code paths are clean of every known offender
# listed in .planning/codebase/CONCERNS.md §"Legacy hooks reference ..." and
# .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §3.
#
# Exits 1 when any pattern hits, printing every offender as file:line.
#
# Scope: only scans backend/app and frontend/src. Test fixtures, e2e specs,
# migrations, caches, envs, locks, and build outputs are explicitly excluded.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BACKEND_DIR="backend/app"
FRONTEND_DIR="frontend/src"

HIT_COUNT=0
HIT_OUTPUT=""

# Common ripgrep/grep exclude args. Reused by every pattern that scans the
# production code paths.
EXCLUDE_ARGS=(
  --exclude-dir=node_modules
  --exclude-dir=.venv
  --exclude-dir=__pycache__
  --exclude-dir=dist
  --exclude-dir=build
  --exclude-dir=migrations
  --exclude-dir=tests
  --exclude-dir=e2e
  --exclude='*.test.ts'
  --exclude='*.test.tsx'
  --exclude='*.test.py'
  --exclude='*.lock'
  --exclude='.env*'
)

INCLUDE_ARGS=(
  --include='*.py'
  --include='*.ts'
  --include='*.tsx'
)

# check_grep PATTERN LABEL — runs grep -rnE across backend/app + frontend/src
# with the shared excludes. Accumulates hits into HIT_OUTPUT and increments
# HIT_COUNT.
check_grep() {
  local pattern="$1"
  local label="$2"
  local hits
  if hits=$(grep -rnE "${INCLUDE_ARGS[@]}" "${EXCLUDE_ARGS[@]}" -- "$pattern" "$BACKEND_DIR" "$FRONTEND_DIR" 2>/dev/null); then
    if [[ -n "$hits" ]]; then
      HIT_OUTPUT+="=== [${label}] pattern: ${pattern} ==="$'\n'
      HIT_OUTPUT+="$hits"$'\n'
      HIT_COUNT=$((HIT_COUNT + $(printf '%s\n' "$hits" | wc -l | tr -d ' ')))
    fi
  fi
}

# check_file PATH LABEL — fails if the file exists under the repo.
check_file() {
  local path="$1"
  local label="$2"
  if [[ -f "$path" ]]; then
    HIT_OUTPUT+="=== [${label}] file exists: ${path} ==="$'\n'
    HIT_OUTPUT+="$path"$'\n'
    HIT_COUNT=$((HIT_COUNT + 1))
  fi
}

# ---- Patterns from RESEARCH.md §3 + CONCERNS.md --------------------------- #

# Legacy hardcoded Superset dataset mapping (backend charts router).
check_grep 'CHART_DATASOURCE_MAP' 'legacy-charts-map'
check_grep 'CHART_QUERIES' 'legacy-charts-queries'

# Dead frontend hooks (by filename).
check_file "frontend/src/hooks/use-chart-data.ts" 'dead-hook-use-chart-data'
check_file "frontend/src/hooks/use-kpi-data.ts"   'dead-hook-use-kpi-data'
check_file "frontend/src/hooks/use-breaks-data.ts" 'dead-hook-use-breaks-data'
check_file "frontend/src/hooks/use-prefetch.ts"   'dead-hook-use-prefetch'

# Types barrel export violates convention.
check_file "frontend/src/types/index.ts" 'barrel-types-index'

# Barrel imports (any remaining `from "@/types"` at end of line).
check_grep "from ['\"]@/types['\"];?$" 'barrel-types-import'

# Mock/placeholder literals in production code.
check_grep '[Ll]orem [Ii]psum'      'lorem-ipsum'
check_grep 'placeholder data'       'placeholder-data-literal'
check_grep '[Tt][Oo][Dd][Oo].*replace with real' 'todo-replace-with-real'

# Hardcoded integer dataset_id Python assignments in backend API routes.
# (excluded: tests/, via EXCLUDE_ARGS above)
if hits=$(grep -rnE --include='*.py' "${EXCLUDE_ARGS[@]}" -- '^[[:space:]]*datasource_id[[:space:]]*=[[:space:]]*[0-9]+' "$BACKEND_DIR" 2>/dev/null); then
  if [[ -n "$hits" ]]; then
    HIT_OUTPUT+="=== [hardcoded-datasource-id] pattern: datasource_id = <int> ==="$'\n'
    HIT_OUTPUT+="$hits"$'\n'
    HIT_COUNT=$((HIT_COUNT + $(printf '%s\n' "$hits" | wc -l | tr -d ' ')))
  fi
fi

# ---- Report -------------------------------------------------------------- #

if (( HIT_COUNT > 0 )); then
  printf '%s\n' "$HIT_OUTPUT"
  printf 'mock-audit: FAIL — %d offender(s) found\n' "$HIT_COUNT" >&2
  exit 1
fi

printf 'mock-audit: clean\n'
exit 0
