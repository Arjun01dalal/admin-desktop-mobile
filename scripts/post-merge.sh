#!/bin/bash
set -e

# Post-merge setup: install dependencies (Electron desktop app — no workflows to restart).
npm install --no-audit --no-fund
