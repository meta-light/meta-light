#!/usr/bin/env bash
# Create the meta-light Doppler project in a config dir that is separate from
# the default ~/.doppler login, then upload the local env files.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_DIR="${META_LIGHT_DOPPLER_CONFIG_DIR:-$HOME/.doppler-meta-light}"
doppler_cmd() { doppler --config-dir "$CONFIG_DIR" "$@"; }

if ! doppler_cmd me >/dev/null 2>&1; then
  echo "Doppler is not logged in for this repo."
  echo "This uses $CONFIG_DIR and leaves the default Doppler login untouched."
  echo
  echo "Create a Doppler account, then run:"
  echo "  doppler login --config-dir \"$CONFIG_DIR\""
  echo "  bash scripts/doppler-init.sh"
  exit 1
fi

workplace="$(doppler_cmd me --json | python3 -c 'import json,sys; print(json.load(sys.stdin).get("workplace",{}).get("slug",""))')"
if [[ "$workplace" == "blockworks-internal" ]]; then
  echo "Refusing to upload these secrets into the Blockworks Doppler workplace."
  exit 1
fi

if ! doppler_cmd projects get meta-light >/dev/null 2>&1; then
  doppler_cmd projects create meta-light --description "meta-light apps"
fi

for config in dev_carpcap dev_crm dev_web; do
  if ! doppler_cmd configs get "$config" --project meta-light >/dev/null 2>&1; then
    doppler_cmd configs create "$config" --project meta-light --environment dev
  fi
done

upload() {
  local app_path="$1"
  local config="$2"
  local env_file="$3"
  (cd "$ROOT/$app_path" && doppler_cmd setup --project meta-light --config "$config" --no-interactive)
  if [[ -f "$ROOT/$env_file" ]]; then
    doppler_cmd secrets upload "$ROOT/$env_file" --project meta-light --config "$config" >/dev/null
    echo "Uploaded $env_file to meta-light/$config"
  else
    echo "No $env_file to upload"
  fi
}

upload apps/carpcap dev_carpcap apps/carpcap/.env
upload apps/crm dev_crm apps/crm/.env.local
upload apps/web dev_web apps/web/.env
echo "Doppler project meta-light is ready."
