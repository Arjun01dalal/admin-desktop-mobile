#!/bin/bash
# Post-merge setup: reinstall workspace deps and regenerate mobile derived files.
set -e

npm install --no-audit --no-fund

# Regenerate the mobile API registry from shared definitions (idempotent).
node packages/mobile/scripts/sync-shared.cjs

# Regenerate mobile .env (gitignored). Best-effort: don't block merges if it
# needs values unavailable in this environment.
node packages/mobile/scripts/gen-env.cjs || echo "gen-env skipped (non-fatal)"
