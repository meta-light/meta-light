#!/usr/bin/env bash
# Inject Doppler secrets when this repo's personal Doppler config is set up.
# Falls through to the process environment and .env files otherwise.
set -euo pipefail
CONFIG_DIR="${META_LIGHT_DOPPLER_CONFIG_DIR:-$HOME/.doppler-meta-light}"
if command -v doppler >/dev/null 2>&1 && [[ -d "$CONFIG_DIR" ]] && doppler --config-dir "$CONFIG_DIR" configure get project --plain >/dev/null 2>&1; then
  exec doppler --config-dir "$CONFIG_DIR" run -- "$@"
fi
exec "$@"
