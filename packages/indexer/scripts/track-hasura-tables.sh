#!/bin/bash
# Envio tracks its generated entity tables in Hasura during fresh storage
# initialization, but it does not track its internal envio_* progress tables.
# Local tooling (scripts/dev/smoke-full.js) queries envio_chains over GraphQL to
# prove indexing progress, so this script tracks whatever Envio left untracked.
#
# It also owns the `public` role's read grant. Hasura exposes an `X_aggregate`
# root field only to a role whose select permission carries
# `allow_aggregations`; without it a query asking for one is rejected outright,
# and because a document's rows and aggregates travel together, the rejection
# also loses the plain rows beside them. The public `/impact` band reads
# protocol-wide totals that way, so the grant belongs wherever the tables are
# tracked.
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

# Nothing to do once the internal progress tables are exposed *and* the public
# role can aggregate every table the public impact reader asks for. A stack
# that predates the aggregation grant exposes envio_chains but publishes no
# `_aggregate` root field, and a pass that only half applied publishes some;
# either way the pass has to run again, so the fast path checks each required
# root by name rather than "any aggregate". TRACK_HASURA_FORCE=1 skips the
# fast path outright to re-run every grant.
REQUIRED_AGGREGATE_ROOTS="CommitmentPool_aggregate CommitmentProviderExposure_aggregate Disbursement_aggregate"

schema_check=$(curl -s -X POST "${HASURA_URL}/v1/graphql" \
  -H "content-type: application/json" \
  -d '{"query":"{ __schema { queryType { fields { name } } } }"}' 2>/dev/null)

required_roots_present() {
  for root in $REQUIRED_AGGREGATE_ROOTS; do
    echo "$schema_check" | grep -q "\"$root\"" || return 1
  done
  return 0
}

if [ "${TRACK_HASURA_FORCE:-0}" != "1" ] &&
   echo "$schema_check" | grep -q '"envio_chains"' &&
   required_roots_present; then
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

metadata_call() {
  curl -s -X POST "${HASURA_URL}/v1/metadata" \
    -H "content-type: application/json" \
    -H "x-hasura-admin-secret: ${HASURA_SECRET}" \
    -d "$1" 2>/dev/null
}

# The `public` role's read grant. Hasura has no upsert for a permission, and a
# table Envio tracked itself already carries one without `allow_aggregations`,
# so an existing grant is replaced through a single `bulk` transaction: two
# separate drop and create requests would leave a window where the table reads
# as forbidden. Only a grant of this script's own shape is ever replaced: a
# narrower one (a column allowlist, a row filter) is somebody's deliberate
# restriction, and widening it back to every column would be a silent security
# regression, so it is left alone and reported instead.
PERMISSION='{"columns":"*","filter":{},"allow_aggregations":true}'
# Matched as a quoted (literal) case pattern, so the star is not a glob.
OWN_SHAPE_PATTERN='"columns":"*","filter":{}'

current_public_permission() {
  metadata_call '{"type":"export_metadata","version":2,"args":{}}' | node -e "
    const chunks = [];
    process.stdin.on('data', d => chunks.push(d));
    process.stdin.on('end', () => {
      try {
        const md = JSON.parse(Buffer.concat(chunks).toString()).metadata;
        const table = (md.sources || []).flatMap(s => s.tables || [])
          .find(t => t.table && t.table.schema === 'public' && t.table.name === process.argv[1]);
        const perm = ((table && table.select_permissions) || []).find(p => p.role === 'public');
        process.stdout.write(perm ? JSON.stringify(perm.permission) : '');
      } catch (e) { process.exit(1); }
    });
  " "$1"
}

# Each metadata write makes Hasura rebuild its GraphQL schema, so a busy engine
# can drop one. A lost write leaves the table readable but not aggregatable —
# exactly the state this grant exists to remove — so an attempt that neither
# succeeded nor reported an existing grant is retried once and then reported.
# Silence would republish the original defect.
grant_public_select() {
  table="$1"
  target="{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$table\"},\"role\":\"public\"}"
  create="{\"type\":\"pg_create_select_permission\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$table\"},\"role\":\"public\",\"permission\":${PERMISSION}}}"
  replace="{\"type\":\"bulk\",\"args\":[{\"type\":\"pg_drop_select_permission\",\"args\":${target}},${create}]}"

  attempt=0
  while [ $attempt -lt 2 ]; do
    attempt=$((attempt + 1))
    response=$(metadata_call "$create")
    case "$response" in
      *'"message":"success"'*) return 0 ;;
      *already-exists*)
        existing=$(current_public_permission "$table")
        case "$existing" in
          *'"allow_aggregations":true'*) return 0 ;;
          *"$OWN_SHAPE_PATTERN"*) ;;
          *)
            kept=$((kept + 1))
            echo "track-hasura-tables: left the public grant on $table untouched (not this script's shape): $existing" >&2
            return 0
            ;;
        esac
        response=$(metadata_call "$replace")
        case "$response" in
          *'"message":"success"'*) return 0 ;;
        esac
        ;;
    esac
    sleep 1
  done

  ungranted=$((ungranted + 1))
  echo "track-hasura-tables: could not grant aggregate access on $table" >&2
  return 1
}

# Track each table and grant the public role select + aggregation permission
tracked=0
ungranted=0
kept=0
for table in $tables; do
  metadata_call "{\"type\":\"pg_track_table\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$table\"}}}" > /dev/null

  grant_public_select "$table" || true

  tracked=$((tracked + 1))
done

if [ "$ungranted" -gt 0 ]; then
  echo "track-hasura-tables: tracked $tracked tables in Hasura, $ungranted without aggregate access" >&2
  echo "track-hasura-tables: re-run with TRACK_HASURA_FORCE=1 to retry them" >&2
elif [ "$kept" -gt 0 ]; then
  echo "track-hasura-tables: tracked $tracked tables in Hasura, $kept custom public grant(s) left untouched"
else
  echo "track-hasura-tables: tracked $tracked tables in Hasura"
fi
