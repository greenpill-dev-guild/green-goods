import type { DehydratedState } from "@tanstack/react-query";

type StoredQuery = DehydratedState["queries"][number];

/** Local queue projections rebuild from durable jobs and never retain object URLs. */
export function isDurableWorkRead(key: readonly unknown[]): boolean {
  return !(key[1] === "works" && (key[2] === "offline" || (key[2] === "mine" && key[5] === true)));
}

/** Old mixed queries also contain confirmed approval overlays; keep those remote rows. */
export function restoreDurableWorkQuery(query: StoredQuery): StoredQuery {
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
