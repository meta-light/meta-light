#!/usr/bin/env bash
# Point this repo at the existing Doppler projects. Does not create projects,
# create configs, or upload secrets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_DIR="${META_LIGHT_DOPPLER_CONFIG_DIR:-$HOME/.doppler-meta-light}"
doppler_cmd() { doppler --config-dir "$CONFIG_DIR" "$@"; }

if ! doppler_cmd me >/dev/null 2>&1; then
  echo "Doppler is not logged in for this repo."
  echo "This uses $CONFIG_DIR and leaves the default Doppler login untouched."
  echo
  echo "  doppler login --config-dir \"$CONFIG_DIR\""
  echo "  bash scripts/doppler-init.sh"
  exit 1
fi

workplace="$(doppler_cmd me --json | python3 -c 'import json,sys; print(json.load(sys.stdin).get("workplace",{}).get("slug",""))')"
if [[ "$workplace" == "blockworks-internal" ]]; then
  echo "Refusing to use the Blockworks Doppler workplace."
  exit 1
fi

for project in carpcap meta-light-web; do
  if ! doppler_cmd projects get "$project" >/dev/null 2>&1; then
    echo "Doppler project '$project' was not found in workplace $workplace."
    echo "This script does not create projects."
    exit 1
  fi
done

# Set one directory at a time. `doppler setup --project` applies that project
# to every path in doppler.yaml, so it cannot bind these two apps separately.
doppler_cmd configure set project=carpcap config=dev --scope "$ROOT/apps/carpcap"
doppler_cmd configure set project=meta-light-web config=dev --scope "$ROOT/apps/web"
echo "Using existing Doppler projects carpcap and meta-light-web (config dev)."
echo "CRM is not part of this setup. No secrets were uploaded."
