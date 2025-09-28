#!/usr/bin/env bash
set -euo pipefail
echo "[post-create] ensure frontend deps"
cd /workspaces/app/frontend
if [ -f package-lock.json ]; then npm ci; else npm i; fi
echo "[post-create] done"
