#!/usr/bin/env bash
npx --yes @mermaid-js/mermaid-cli -i "$1" -o "${2:-${1%.*}}.svg"