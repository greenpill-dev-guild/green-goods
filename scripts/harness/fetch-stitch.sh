#!/usr/bin/env bash
# Download a Stitch asset (HTML or screenshot) following Google Cloud Storage redirects.
# Usage: scripts/fetch-stitch.sh <download_url> <output_path>
#
# The Stitch API returns signed URLs that 302-redirect to the actual asset.
# curl -L follows the redirect chain. --fail exits non-zero on HTTP errors.

set -euo pipefail

url="${1:?Usage: fetch-stitch.sh <url> <output_path>}"
output="${2:?Usage: fetch-stitch.sh <url> <output_path>}"

mkdir -p "$(dirname "$output")"
curl -fsSL -o "$output" "$url"
echo "Downloaded: $output ($(wc -c < "$output" | tr -d ' ') bytes)"
