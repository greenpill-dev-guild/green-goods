#!/bin/bash
# Track Envio's public tables and apply only the public aggregation actions
# produced by hasura-permissions.mjs. Uses curl + node; no psql or jq.

HASURA_URL="${HASURA_GRAPHQL_ENDPOINT:-http://graphql-engine:8080}"
HASURA_URL="${HASURA_URL%/v1/metadata}"
HASURA_URL="${HASURA_URL%/}"
HASURA_SECRET="${HASURA_GRAPHQL_ADMIN_SECRET:-testing}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PLANNER="$SCRIPT_DIR/hasura-permissions.mjs"
MAX_WAIT=120
POLL=5
elapsed=0

get_tables() {
  curl -s -X POST "${HASURA_URL}/v2/query" \
    -H "content-type: application/json" \
    -H "x-hasura-admin-secret: ${HASURA_SECRET}" \
    -d '{"type":"run_sql","args":{"source":"default","sql":"SELECT tablename FROM pg_tables WHERE schemaname = '\''public'\'' ORDER BY tablename"}}' 2>/dev/null
}

metadata_call() {
  curl -s -X POST "${HASURA_URL}/v1/metadata" \
    -H "content-type: application/json" \
    -H "x-hasura-admin-secret: ${HASURA_SECRET}" \
    -d "$1" 2>/dev/null
}

while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  resp=$(get_tables)
  if echo "$resp" | grep -q '"envio_chains"'; then break; fi
  sleep "$POLL"
  elapsed=$((elapsed + POLL))
done

if ! echo "$resp" | grep -q '"envio_chains"'; then
  echo "track-hasura-tables: indexer schema not found after ${MAX_WAIT}s, skipping" >&2
  exit 0
fi

tables_json=$(printf '%s' "$resp" | node "$PLANNER" parse-tables)
if [ -z "$tables_json" ] || [ "$tables_json" = "[]" ]; then
  echo "track-hasura-tables: could not parse table list, skipping" >&2
  exit 0
fi
export HASURA_REQUIRED_TABLES_JSON="$tables_json"

schema_check=$(curl -s -X POST "${HASURA_URL}/v1/graphql" \
  -H "content-type: application/json" \
  -d '{"query":"{ __schema { queryType { fields { name } } } }"}' 2>/dev/null)
if [ "${TRACK_HASURA_FORCE:-0}" != "1" ] && \
  printf '%s' "$schema_check" | node "$PLANNER" roots-present; then
  exit 0
fi

applied=0
failed=0
attempt=0
while [ "$attempt" -lt 2 ]; do
  attempt=$((attempt + 1))
  metadata=$(metadata_call '{"type":"export_metadata","version":2,"args":{}}')
  plan=$(printf '%s' "$metadata" | node "$PLANNER" plan) || break
  pending=$(printf '%s' "$plan" | node "$PLANNER" counts | cut -d ' ' -f 1)
  if [ "$pending" -eq 0 ]; then break; fi

  while IFS= read -r request; do
    [ -z "$request" ] && continue
    response=$(metadata_call "$request")
    case "$response" in
      *'"message":"success"'*) applied=$((applied + 1)) ;;
      *) failed=$((failed + 1)) ;;
    esac
  done <<EOF
$(printf '%s' "$plan" | node "$PLANNER" requests)
EOF
  [ "$attempt" -lt 2 ] && sleep 1
done

metadata=$(metadata_call '{"type":"export_metadata","version":2,"args":{}}')
final_plan=$(printf '%s' "$metadata" | node "$PLANNER" plan)
counts=$(printf '%s' "$final_plan" | node "$PLANNER" counts)
set -- $counts
pending=$1
kept=$2
satisfied=$3
malformed=$4

echo "track-hasura-tables: ${satisfied} satisfied, ${kept} custom kept, ${malformed} malformed, ${pending} action(s) remaining; ${applied} applied, ${failed} failed"
if [ "$pending" -gt 0 ] || [ "$malformed" -gt 0 ]; then
  echo "track-hasura-tables: re-run with TRACK_HASURA_FORCE=1 after correcting reported metadata" >&2
fi
