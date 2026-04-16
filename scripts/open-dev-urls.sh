#!/usr/bin/env bash

set -euo pipefail

ports=(3001 3002 3003 6006)
urls=(
  "https://localhost:3001"
  "https://localhost:3002"
  "http://localhost:3003"
  "http://localhost:6006"
)

for port in "${ports[@]}"; do
  bun x wait-port "$port" &
done
wait

open_default_browser() {
  for url in "${urls[@]}"; do
    open "$url"
    sleep 0.25
  done
}

brave_app="/Applications/Brave Browser.app"
brave_bin="$brave_app/Contents/MacOS/Brave Browser"

# Launch Brave directly first. This avoids the LaunchServices handoff timeout
# seen when PM2 shells try to call `open -a "Brave Browser"` in the background.
if [[ -x "$brave_bin" ]]; then
  nohup "$brave_bin" --new-window "${urls[@]}" >/dev/null 2>&1 &
  exit 0
fi

if [[ -d "$brave_app" ]]; then
  for url in "${urls[@]}"; do
    open -a "Brave Browser" "$url"
    sleep 0.25
  done
  exit 0
fi

open_default_browser
