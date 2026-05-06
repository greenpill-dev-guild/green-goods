#!/usr/bin/env bash

set -euo pipefail

ports=(3001 3002 3003 6006)
# Client opens twice on port 3001: ?presentation=pwa forces installed-PWA chrome
# (bottom AppBar, /home entry), ?presentation=website forces the marketing site
# (SiteHeader hamburger, / entry). The override is read on localhost only, then
# cached in per-tab sessionStorage so each tab stays in its mode after redirects.
# Source: packages/shared/src/utils/app/pwa.ts:getClientPresentationMode.
urls=(
  "https://localhost:3001/?presentation=pwa"
  "https://localhost:3001/?presentation=website"
  "https://localhost:3002"
  "http://localhost:3003"
  "http://localhost:6006"
)

# Wait up to 60s per port, in parallel. `wait-port -t` returns non-zero on
# timeout, so we collect which ports actually came up and open only those URLs.
# Failing open beats failing silently when one Vite server crashes on boot.
WAIT_TIMEOUT_MS=60000
pids=()
for port in "${ports[@]}"; do
  bun x wait-port -t "$WAIT_TIMEOUT_MS" "$port" >/dev/null 2>&1 &
  pids+=("$!")
done

ready_ports=()
for i in "${!ports[@]}"; do
  port="${ports[$i]}"
  pid="${pids[$i]}"
  if wait "$pid" 2>/dev/null; then
    ready_ports+=("$port")
  else
    echo "[browser] port $port did not come up within ${WAIT_TIMEOUT_MS}ms; skipping its tabs."
  fi
done

ready_urls=()
for url in "${urls[@]}"; do
  for ready_port in "${ready_ports[@]}"; do
    if [[ "$url" == *":${ready_port}/"* || "$url" == *":${ready_port}" ]]; then
      ready_urls+=("$url")
      break
    fi
  done
done

if [[ ${#ready_urls[@]} -eq 0 ]]; then
  echo "[browser] No services came up — not launching a browser."
  exit 0
fi

open_default_browser() {
  for url in "${ready_urls[@]}"; do
    open "$url"
    sleep 0.25
  done
}

brave_app="/Applications/Brave Browser.app"
brave_bin="$brave_app/Contents/MacOS/Brave Browser"

# Launch Brave directly first. This avoids the LaunchServices handoff timeout
# seen when PM2 shells try to call `open -a "Brave Browser"` in the background.
if [[ -x "$brave_bin" ]]; then
  nohup "$brave_bin" --new-window "${ready_urls[@]}" >/dev/null 2>&1 &
  exit 0
fi

if [[ -d "$brave_app" ]]; then
  for url in "${ready_urls[@]}"; do
    open -a "Brave Browser" "$url"
    sleep 0.25
  done
  exit 0
fi

open_default_browser
