import { type DehydratedState, hashKey } from "@tanstack/react-query";

/** The part of a stored query these transforms read, whichever store wrote it. */
type StoredQuery = Pick<DehydratedState["queries"][number], "queryKey" | "queryHash" | "state">;

/** Local queue projections rebuild from durable jobs and never retain object URLs. */
export function isDurableWorkRead(key: readonly unknown[]): boolean {
  return !(key[1] === "works" && (key[2] === "offline" || (key[2] === "mine" && key[5] === true)));
}

const READ_MODEL_GROUPS = new Set([
  "gardens",
  "actions",
  "gardeners",
  "gardener-profile",
  "profile-avatars",
  "ens",
]);
const READ_MODEL_WORK_SOURCES = new Set(["online", "metadata", "merged", "mine"]);

/**
 * The offline read model: the reads screens need to open without a connection.
 * A restored snapshot keeps these whatever its age; everything else follows the
 * ordinary persistence window.
 */
export function isOfflineReadModelQuery(queryKey: readonly unknown[]): boolean {
  if (queryKey[0] !== "greengoods") return false;
  const group = String(queryKey[1] ?? "");
  if (group === "works") return READ_MODEL_WORK_SOURCES.has(String(queryKey[2] ?? ""));
  return READ_MODEL_GROUPS.has(group);
}

const GARDEN_KEYED_WORK_SOURCES = new Set(["online", "merged", "offline", "local"]);

/**
 * Garden-keyed work reads now use one lowercase garden segment. Snapshots saved
 * before that keep their checksummed spelling until restored here, so offline
 * copies still open after the update.
 */
function withLowercaseGarden<T extends StoredQuery>(query: T): T {
  const key = query.queryKey;
  if (
    key[1] !== "works" ||
    !GARDEN_KEYED_WORK_SOURCES.has(String(key[2])) ||
    typeof key[3] !== "string" ||
    key[3] === key[3].toLowerCase()
  )
    return query;
  const queryKey = [...key.slice(0, 3), key[3].toLowerCase(), ...key.slice(4)];
  return { ...query, queryKey, queryHash: hashKey(queryKey) };
}

/** Old mixed queries also contain confirmed approval overlays; keep those remote rows. */
export function restoreDurableWorkQuery<T extends StoredQuery>(stored: T): T {
  const query = withLowercaseGarden(stored);
  if (
    query.queryKey[1] !== "works" ||
    query.queryKey[2] !== "merged" ||
    !Array.isArray(query.state.data)
  )
    return query;
  const data = query.state.data.filter((row: unknown) => {
    if (!row || typeof row !== "object") return false;
    const work = row as { id?: unknown; status?: unknown };
    return (
      typeof work.id === "string" &&
      /^0x[0-9a-f]{64}$/i.test(work.id) &&
      !["offline", "syncing", "sync_failed"].includes(String(work.status))
    );
  });
  return { ...query, state: { ...query.state, data } };
}
