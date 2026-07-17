#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TARGET_IMAGE="postgres:17.10"
HASURA_IMAGE="hasura/graphql-engine:v2.43.0"
PG_PORT="${ENVIO_PG_PORT:-3008}"
HASURA_PORT="${HASURA_EXTERNAL_PORT:-3006}"
APPLY=false

cd "$ROOT_DIR"

if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--apply]" >&2
  exit 2
fi

if command -v docker >/dev/null 2>&1; then
  DOCKER_BIN="$(command -v docker)"
elif [[ -x /Applications/OrbStack.app/Contents/MacOS/xbin/docker ]]; then
  DOCKER_BIN=/Applications/OrbStack.app/Contents/MacOS/xbin/docker
elif [[ -x /Applications/Docker.app/Contents/Resources/bin/docker ]]; then
  DOCKER_BIN=/Applications/Docker.app/Contents/Resources/bin/docker
else
  echo "Docker CLI not found. Install or open OrbStack/Docker Desktop first." >&2
  exit 1
fi

if [[ "${DOCKER_HOST:-}" == unix://* ]]; then
  configured_socket="${DOCKER_HOST#unix://}"
  if [[ ! -S "$configured_socket" ]]; then
    unset DOCKER_HOST
  fi
fi

if [[ -z "${DOCKER_HOST:-}" && -S /Users/afo/.orbstack/run/docker.sock ]]; then
  export DOCKER_HOST=unix:///Users/afo/.orbstack/run/docker.sock
fi

for command_name in curl node shasum; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 1
  fi
done

"$DOCKER_BIN" info >/dev/null

source_containers=( $("$DOCKER_BIN" ps --filter "publish=${PG_PORT}" --format '{{.ID}}') )
if [[ ${#source_containers[@]} -ne 1 ]]; then
  echo "Expected exactly one running PostgreSQL container publishing port ${PG_PORT}; found ${#source_containers[@]}." >&2
  exit 1
fi
source_container="${source_containers[0]}"

hasura_containers=( $("$DOCKER_BIN" ps --filter "publish=${HASURA_PORT}" --format '{{.ID}}') )
if [[ ${#hasura_containers[@]} -ne 1 ]]; then
  echo "Expected exactly one running Hasura container publishing port ${HASURA_PORT}; found ${#hasura_containers[@]}." >&2
  exit 1
fi
hasura_container="${hasura_containers[0]}"

container_env() {
  local container="$1"
  local key="$2"
  "$DOCKER_BIN" inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container" \
    | awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }'
}

pg_user="${ENVIO_PG_USER:-$(container_env "$source_container" POSTGRES_USER)}"
pg_database="${ENVIO_PG_DATABASE:-$(container_env "$source_container" POSTGRES_DB)}"
pg_password="${ENVIO_PG_PASSWORD:-$(container_env "$source_container" POSTGRES_PASSWORD)}"
admin_secret="${HASURA_GRAPHQL_ADMIN_SECRET:-$(container_env "$hasura_container" HASURA_GRAPHQL_ADMIN_SECRET)}"
pg_user="${pg_user:-postgres}"
pg_database="${pg_database:-envio-dev}"
pg_password="${pg_password:-testing}"
admin_secret="${admin_secret:-testing}"

source_volume="$(
  "$DOCKER_BIN" inspect \
    --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{println .Name}}{{end}}{{end}}' \
    "$source_container" | awk 'NF { print; exit }'
)"
if [[ -z "$source_volume" ]]; then
  echo "The running PostgreSQL container does not use a named volume at /var/lib/postgresql/data." >&2
  exit 1
fi

compose_project="$("$DOCKER_BIN" inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$source_container")"
compose_service="$("$DOCKER_BIN" inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$source_container")"
compose_files="$("$DOCKER_BIN" inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$source_container")"
compose_workdir="$("$DOCKER_BIN" inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$source_container")"
hasura_service="$("$DOCKER_BIN" inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$hasura_container")"
hasura_project="$("$DOCKER_BIN" inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$hasura_container")"

if [[ -z "$compose_project" || -z "$compose_service" || -z "$compose_files" || -z "$compose_workdir" ]]; then
  echo "The running PostgreSQL container is not backed by a discoverable Docker Compose project." >&2
  exit 1
fi
if [[ "$hasura_project" != "$compose_project" ]]; then
  echo "PostgreSQL and Hasura belong to different Compose projects; refusing to recreate services." >&2
  exit 1
fi

suffix="$(date -u +%Y%m%dT%H%M%SZ)-$$"
copy_volume="gg-wave6-pg17-copy-${suffix}"
rehearsal_network="gg-wave6-pg17-network-${suffix}"
rehearsal_postgres="gg-wave6-pg17-postgres-${suffix}"
rehearsal_hasura="gg-wave6-pg17-hasura-${suffix}"
source_stopped=false
apply_started=false
proof_green=false

cleanup() {
  local exit_code=$?
  set +e
  if [[ "$source_stopped" == true ]]; then
    "$DOCKER_BIN" start "$source_container" >/dev/null
  fi
  if [[ "$apply_started" == true && "$proof_green" != true ]]; then
    echo "Apply verification failed. Preserving rollback volume ${copy_volume} and rehearsal containers." >&2
    echo "Inspect them before cleanup; the original volume is ${source_volume}." >&2
    exit "$exit_code"
  fi
  "$DOCKER_BIN" rm -f "$rehearsal_hasura" "$rehearsal_postgres" >/dev/null 2>&1 || true
  "$DOCKER_BIN" network rm "$rehearsal_network" >/dev/null 2>&1 || true
  "$DOCKER_BIN" volume rm "$copy_volume" >/dev/null 2>&1 || true
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

wait_for_postgres() {
  local container="$1"
  for _ in $(seq 1 45); do
    if "$DOCKER_BIN" exec "$container" pg_isready -U "$pg_user" -d "$pg_database" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  "$DOCKER_BIN" logs --tail 80 "$container" >&2 || true
  return 1
}

wait_for_hasura() {
  local url="$1"
  for _ in $(seq 1 45); do
    if curl -fsS --max-time 2 "${url}/healthz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

postgres_version() {
  "$DOCKER_BIN" exec "$1" psql -X -U "$pg_user" -d "$pg_database" -At \
    -c 'select version();'
}

database_fingerprint() {
  local container="$1"
  local schema_hash
  local table
  local table_count
  local tables

  schema_hash="$(
    "$DOCKER_BIN" exec "$container" psql -X -U "$pg_user" -d "$pg_database" -At -c \
      "select md5(coalesce(string_agg(concat_ws('|', table_schema, table_name, column_name, data_type, is_nullable, ordinal_position::text), E'\\n' order by table_schema, table_name, ordinal_position), '')) from information_schema.columns where table_schema not in ('pg_catalog', 'information_schema');"
  )"
  tables="$(
    "$DOCKER_BIN" exec "$container" psql -X -U "$pg_user" -d "$pg_database" -At -c \
      "select format('%I.%I', schemaname, tablename) from pg_tables where schemaname not in ('pg_catalog', 'information_schema') order by schemaname, tablename;"
  )"

  {
    printf 'schema=%s\n' "$schema_hash"
    while IFS= read -r table; do
      [[ -n "$table" ]] || continue
      table_count="$(
        "$DOCKER_BIN" exec "$container" psql -X -U "$pg_user" -d "$pg_database" -At \
          -c "select count(*) from ${table};"
      )"
      printf '%s=%s\n' "$table" "$table_count"
    done <<< "$tables"
  } | shasum -a 256 | awk '{print $1}'
}

graphql_fingerprint() {
  local url="$1"
  local response
  response="$(mktemp /tmp/gg-wave6-graphql.XXXXXX)"
  curl -fsS --max-time 10 "${url}/v1/graphql" \
    -H 'Content-Type: application/json' \
    -H "x-hasura-admin-secret: ${admin_secret}" \
    --data '{"query":"query Wave6Introspection { __schema { queryType { name } mutationType { name } subscriptionType { name } directives { name locations args { name defaultValue type { kind name ofType { kind name ofType { kind name } } } } } types { kind name fields(includeDeprecated: true) { name args { name defaultValue type { kind name ofType { kind name ofType { kind name } } } } type { kind name ofType { kind name ofType { kind name } } } } inputFields { name defaultValue type { kind name ofType { kind name ofType { kind name } } } } interfaces { kind name } enumValues(includeDeprecated: true) { name } possibleTypes { kind name } } } }"}' \
    > "$response"
  node - "$response" <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const response = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (response.errors) throw new Error(JSON.stringify(response.errors));
function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
process.stdout.write(crypto.createHash('sha256').update(JSON.stringify(canonical(response.data))).digest('hex'));
NODE
  rm -f "$response"
}

baseline_url="http://127.0.0.1:${HASURA_PORT}"
wait_for_postgres "$source_container"
wait_for_hasura "$baseline_url"
baseline_version="$(postgres_version "$source_container")"
baseline_database_hash="$(database_fingerprint "$source_container")"
baseline_graphql_hash="$(graphql_fingerprint "$baseline_url")"

echo "Baseline database: ${baseline_version}"
echo "Baseline database fingerprint: ${baseline_database_hash}"
echo "Baseline GraphQL fingerprint: ${baseline_graphql_hash}"

if ! "$DOCKER_BIN" image inspect "$TARGET_IMAGE" >/dev/null 2>&1; then
  "$DOCKER_BIN" pull "$TARGET_IMAGE"
fi
if ! "$DOCKER_BIN" image inspect "$HASURA_IMAGE" >/dev/null 2>&1; then
  "$DOCKER_BIN" pull "$HASURA_IMAGE"
fi

"$DOCKER_BIN" volume create "$copy_volume" >/dev/null
"$DOCKER_BIN" stop "$source_container" >/dev/null
source_stopped=true
"$DOCKER_BIN" run --rm --user 0 \
  -v "${source_volume}:/from:ro" \
  -v "${copy_volume}:/to" \
  "$TARGET_IMAGE" \
  bash -ceu 'cp -a /from/. /to/'
"$DOCKER_BIN" start "$source_container" >/dev/null
source_stopped=false
wait_for_postgres "$source_container"
wait_for_hasura "$baseline_url"

"$DOCKER_BIN" network create "$rehearsal_network" >/dev/null
"$DOCKER_BIN" run -d \
  --name "$rehearsal_postgres" \
  --network "$rehearsal_network" \
  -e "POSTGRES_USER=${pg_user}" \
  -e "POSTGRES_PASSWORD=${pg_password}" \
  -e "POSTGRES_DB=${pg_database}" \
  -v "${copy_volume}:/var/lib/postgresql/data" \
  "$TARGET_IMAGE" >/dev/null
wait_for_postgres "$rehearsal_postgres"

"$DOCKER_BIN" run -d \
  --name "$rehearsal_hasura" \
  --network "$rehearsal_network" \
  -p 127.0.0.1::8080 \
  -e "HASURA_GRAPHQL_DATABASE_URL=postgres://${pg_user}:${pg_password}@${rehearsal_postgres}:5432/${pg_database}" \
  -e "HASURA_GRAPHQL_ADMIN_SECRET=${admin_secret}" \
  -e HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public \
  -e HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES=true \
  "$HASURA_IMAGE" >/dev/null
rehearsal_port="$("$DOCKER_BIN" port "$rehearsal_hasura" 8080/tcp | awk -F: 'NR == 1 { print $NF }')"
rehearsal_url="http://127.0.0.1:${rehearsal_port}"
wait_for_hasura "$rehearsal_url"

rehearsal_version="$(postgres_version "$rehearsal_postgres")"
rehearsal_database_hash="$(database_fingerprint "$rehearsal_postgres")"
rehearsal_graphql_hash="$(graphql_fingerprint "$rehearsal_url")"

[[ "$rehearsal_version" == PostgreSQL\ 17.10* ]]
[[ "$rehearsal_database_hash" == "$baseline_database_hash" ]]
[[ "$rehearsal_graphql_hash" == "$baseline_graphql_hash" ]]

echo "Rehearsal database: ${rehearsal_version}"
echo "Rehearsal database fingerprint: ${rehearsal_database_hash}"
echo "Rehearsal GraphQL fingerprint: ${rehearsal_graphql_hash}"
echo "Copied-volume PostgreSQL 17.10 rehearsal: PASS"

if [[ "$APPLY" != true ]]; then
  proof_green=true
  echo "Local services were not changed. Re-run with --apply to recreate the discovered Compose services on 17.10."
  exit 0
fi

compose_args=(compose --project-name "$compose_project" --project-directory "$compose_workdir")
IFS=',' read -r -a compose_file_list <<< "$compose_files"
for compose_file in "${compose_file_list[@]}"; do
  compose_args+=(-f "$compose_file")
done

if ! "$DOCKER_BIN" "${compose_args[@]}" config --images | grep -Fxq "$TARGET_IMAGE"; then
  echo "Discovered Compose project does not resolve PostgreSQL to ${TARGET_IMAGE}; refusing to apply." >&2
  exit 1
fi

apply_started=true
"$DOCKER_BIN" "${compose_args[@]}" up -d --no-deps --force-recreate "$compose_service"
upgraded_postgres="$("$DOCKER_BIN" "${compose_args[@]}" ps -q "$compose_service")"
wait_for_postgres "$upgraded_postgres"

if [[ -n "$hasura_service" ]]; then
  "$DOCKER_BIN" "${compose_args[@]}" up -d --no-deps --force-recreate "$hasura_service"
fi
wait_for_hasura "$baseline_url"

applied_version="$(postgres_version "$upgraded_postgres")"
applied_database_hash="$(database_fingerprint "$upgraded_postgres")"
applied_graphql_hash="$(graphql_fingerprint "$baseline_url")"

[[ "$applied_version" == PostgreSQL\ 17.10* ]]
[[ "$applied_database_hash" == "$baseline_database_hash" ]]
[[ "$applied_graphql_hash" == "$baseline_graphql_hash" ]]

proof_green=true
echo "Applied database: ${applied_version}"
echo "Applied database fingerprint: ${applied_database_hash}"
echo "Applied GraphQL fingerprint: ${applied_graphql_hash}"
echo "Local PostgreSQL 17.10 upgrade and GraphQL equivalence: PASS"
