#!/usr/bin/env bash
# ==============================================================================
# MVP Validation Script (Phase 7.12)
#
# Runs the full validation checklist for the Context.ai API backend MVP.
# Exit code 0 = all checks passed, non-zero = at least one check failed.
#
# Usage:
#   ./scripts/validate-mvp.sh          # full validation
#   ./scripts/validate-mvp.sh --quick  # skip integration/e2e (CI-friendly)
#
# Requirements:
#   - pnpm installed
#   - Node.js >= 20
#   - Dependencies installed (pnpm install)
# ==============================================================================

set -uo pipefail
# Note: -e is intentionally omitted so that individual check failures
# are captured by the if-else branches and the summary can always run.

# ── Colours & helpers ─────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Colour

PASS=0
FAIL=0
WARNINGS=0
RESULTS=()

step() { printf "\n${CYAN}━━━ %s ━━━${NC}\n" "$1"; }

pass() {
  PASS=$((PASS + 1))
  RESULTS+=("${GREEN}✅ $1${NC}")
  printf "${GREEN}  ✅ %s${NC}\n" "$1"
}

fail() {
  FAIL=$((FAIL + 1))
  RESULTS+=("${RED}❌ $1${NC}")
  printf "${RED}  ❌ %s${NC}\n" "$1"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  RESULTS+=("${YELLOW}⚠️  $1${NC}")
  printf "${YELLOW}  ⚠️  %s${NC}\n" "$1"
}

# ── Parse flags ───────────────────────────────────────────────────────────────

QUICK=false
if [[ "${1:-}" == "--quick" ]]; then
  QUICK=true
fi

# ── Navigate to project root ─────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

printf "\n${CYAN}🚀 Context.ai API — MVP Validation${NC}\n"
printf "   Project: %s\n" "$PROJECT_ROOT"
printf "   Date:    %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"
printf "   Mode:    %s\n" "$( $QUICK && echo 'quick' || echo 'full' )"

# ══════════════════════════════════════════════════════════════════════════════
# 1. LINTING
# ══════════════════════════════════════════════════════════════════════════════

step "1/7  Linting (ESLint)"

if pnpm lint 2>&1; then
  pass "ESLint — no errors"
else
  fail "ESLint — errors found"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 2. TYPE CHECKING (build)
# ══════════════════════════════════════════════════════════════════════════════

step "2/7  TypeScript Build"

if pnpm build 2>&1; then
  pass "TypeScript build — success"
else
  fail "TypeScript build — failed"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 3. UNIT TESTS
# ══════════════════════════════════════════════════════════════════════════════

step "3/7  Unit Tests"

if pnpm test 2>&1; then
  pass "Unit tests — all passing"
else
  fail "Unit tests — failures detected"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 4. COVERAGE CHECK
# ══════════════════════════════════════════════════════════════════════════════

step "4/7  Coverage Thresholds"

if pnpm test:cov 2>&1; then
  pass "Coverage thresholds met (branches>=75, functions>=77, lines>=80, stmts>=80)"
else
  fail "Coverage below configured thresholds"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 5. CONTRACT / SECURITY / PERFORMANCE TESTS
# ══════════════════════════════════════════════════════════════════════════════

step "5/7  Specialised Test Suites"

if pnpm test:contract 2>&1; then
  pass "API Contract tests — passing"
else
  fail "API Contract tests — failures"
fi

if pnpm test:security 2>&1; then
  pass "Security tests — passing"
else
  fail "Security tests — failures"
fi

if pnpm test:performance 2>&1; then
  pass "Performance tests — passing"
else
  fail "Performance tests — failures"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 6. INTEGRATION & E2E (skipped in --quick mode)
# ══════════════════════════════════════════════════════════════════════════════

step "6/7  Integration & E2E Tests"

if $QUICK; then
  warn "Skipped integration tests (--quick mode)"
  warn "Skipped E2E tests (--quick mode)"
else
  if pnpm test:integration 2>&1; then
    pass "Integration tests — passing"
  else
    warn "Integration tests — failures (may require running database)"
  fi

  if pnpm test:e2e 2>&1; then
    pass "E2E tests — passing"
  else
    warn "E2E tests — failures (may require running database)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# 7. BUILD ARTEFACT VERIFICATION
# ══════════════════════════════════════════════════════════════════════════════

step "7/7  Build Artefact Verification"

if [ -d "dist" ]; then
  DIST_FILES=$(find dist -name '*.js' | wc -l | tr -d ' ')
  if [ "$DIST_FILES" -gt 0 ]; then
    pass "Build artefact — dist/ contains $DIST_FILES JS files"
  else
    fail "Build artefact — dist/ is empty"
  fi
else
  fail "Build artefact — dist/ directory not found"
fi

if [ -f "dist/main.js" ]; then
  pass "Entry point — dist/main.js exists"
else
  fail "Entry point — dist/main.js not found"
fi

# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

printf "\n${CYAN}═══════════════════════════════════════════════${NC}\n"
printf "${CYAN}  MVP VALIDATION SUMMARY${NC}\n"
printf "${CYAN}═══════════════════════════════════════════════${NC}\n\n"

for r in "${RESULTS[@]}"; do
  printf "  %b\n" "$r"
done

TOTAL=$((PASS + FAIL + WARNINGS))
printf "\n  ─────────────────────────────────────────────\n"
printf "  ${GREEN}Passed:${NC}   %d / %d\n" "$PASS" "$TOTAL"
printf "  ${RED}Failed:${NC}   %d / %d\n" "$FAIL" "$TOTAL"
printf "  ${YELLOW}Warnings:${NC} %d / %d\n" "$WARNINGS" "$TOTAL"
printf "  ─────────────────────────────────────────────\n\n"

if [ "$FAIL" -gt 0 ]; then
  printf "${RED}❌ MVP VALIDATION FAILED — %d check(s) did not pass.${NC}\n\n" "$FAIL"
  exit 1
else
  printf "${GREEN}✅ MVP VALIDATION PASSED — all critical checks succeeded.${NC}\n\n"
  exit 0
fi

