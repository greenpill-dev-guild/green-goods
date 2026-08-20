#!/bin/bash
# Envio tracks its generated entity tables in Hasura during fresh storage
# initialization, but it does not track its internal envio_* progress tables.
# Local tooling (scripts/dev/smoke-full.js) queries envio_chains over GraphQL to
# prove indexing progress, so this script tracks whatever Envio left untracked.
# Uses only curl + node (no psql/python3 dependency).

# Envio's HASURA_GRAPHQL_ENDPOINT is the metadata endpoint itself, so strip the
# path to get the server root this script needs for /v2/query and /v1/graphql.
HASURA_URL="${HASURA_GRAPHQL_ENDPOINT:-http://graphql-engine:8080}"
HASURA_URL="${HASURA_URL%/v1/metadata}"
HASURA_URL="${HASURA_URL%/}"
HASURA_SECRET="${HASURA_GRAPHQL_ADMIN_SECRET:-testing}"

MAX_WAIT=120
POLL=5
elapsed=0

get_tables() {
  curl -s -X POST "${HASURA_URL}/v2/query" \
    -H "content-type: application/json" \
    -H "x-hasura-admin-secret: ${HASURA_SECRET}" \
    -d "{\"type\":\"run_sql\",\"args\":{\"source\":\"default\",\"sql\":\"SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename\"}}" 2>/dev/null
}

# Wait for the indexer schema to exist in postgres
while [ $elapsed -lt $MAX_WAIT ]; do
  resp=$(get_tables)
  if echo "$resp" | grep -q '"envio_chains"'; then
    break
  fi
  sleep $POLL
  elapsed=$((elapsed + POLL))
done

if ! echo "$resp" | grep -q '"envio_chains"'; then
  echo "track-hasura-tables: indexer schema not found after ${MAX_WAIT}s, skipping" >&2
  exit 0
fi

# Nothing to do if the internal progress tables are already exposed.
schema_check=$(curl -s -X POST "${HASURA_URL}/v1/graphql" \
  -H "content-type: application/json" \
  -d '{"query":"{ __schema { queryType { fields { name } } } }"}' 2>/dev/null)

if echo "$schema_check" | grep -q '"envio_chains"'; then
  exit 0
fi

# Extract table names using node
tables=$(echo "$resp" | node -e "
  const chunks = [];
  process.stdin.on('data', d => chunks.push(d));
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(Buffer.concat(chunks).toString());
      const rows = (data.result || []).slice(1);
      rows.forEach(r => console.log(r[0]));
    } catch (e) { process.exit(1); }
  });
")

if [ -z "$tables" ]; then
  echo "track-hasura-tables: could not parse table list, skipping" >&2
  exit 0
fi

# Track each table and grant public select permission
tracked=0
for table in $tables; do
  curl -s -X POST "${HASURA_URL}/v1/metadata" \
    -H "content-type: application/json" \
    -H "x-hasura-admin-secret: ${HASURA_SECRET}" \
    -d "{\"type\":\"pg_track_table\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$table\"}}}" > /dev/null 2>&1

  curl -s -X POST "${HASURA_URL}/v1/metadata" \
    -H "content-type: application/json" \
    -H "x-hasura-admin-secret: ${HASURA_SECRET}" \
    -d "{\"type\":\"pg_create_select_permission\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$table\"},\"role\":\"public\",\"permission\":{\"columns\":\"*\",\"filter\":{}}}}" > /dev/null 2>&1

  tracked=$((tracked + 1))
done

echo "track-hasura-tables: tracked $tracked tables in Hasura"
