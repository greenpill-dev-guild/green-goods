import type { QueryClient } from "@tanstack/react-query";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { approvalsKeys, workApprovalsKeys, worksKeys } from "../../config/query-keys/work";

type ApprovalRefresh = { workUIDs: Set<string>; timer?: ReturnType<typeof setTimeout> };
const approvalRefreshes = new WeakMap<QueryClient, Map<string, ApprovalRefresh>>();

/** Receipt presentation owns no indexer reads. Reconcile on the app's query client so
 * navigating away from the detail leaves its refreshes running. */
export function refreshApprovalReads(
  client: QueryClient,
  chainId: number,
  { gardenId, workUID }: { gardenId: string; workUID: string },
  followUp: boolean
): void {
  const onlineKey = worksKeys.online(gardenId, chainId);
  const activityKey = worksKeys.activity(gardenId, chainId);
  const refresh = (workUIDs: Set<string>) =>
    Promise.allSettled(
      [
        onlineKey,
        activityKey,
        workApprovalsKeys.all,
        approvalsKeys.all,
        ...Array.from(workUIDs, (uid) => worksKeys.byUID(uid, chainId)),
      ].map((queryKey) => client.invalidateQueries({ queryKey }, { cancelRefetch: false }))
    );

  if (!followUp) {
    void refresh(new Set([workUID]));
    return;
  }

  const scope = JSON.stringify(onlineKey);
  const scopes = approvalRefreshes.get(client) ?? new Map<string, ApprovalRefresh>();
  approvalRefreshes.set(client, scopes);
  const previous = scopes.get(scope);
  if (previous?.timer !== undefined) clearTimeout(previous.timer);
  const current: ApprovalRefresh = { workUIDs: new Set([...(previous?.workUIDs ?? []), workUID]) };
  scopes.set(scope, current);

  const run = async (round: number) => {
    await refresh(current.workUIDs);
    if (scopes.get(scope) !== current) return;
    const delay = INDEXER_LAG_SCHEDULE_MS[round];
    if (delay === undefined) {
      scopes.delete(scope);
      return;
    }
    // If the API is slow, wait for the current read before giving the indexer
    // another chance. Restarting a slow read can prevent it from ever finishing.
    current.timer = setTimeout(
      () => void run(round + 1),
      delay - (INDEXER_LAG_SCHEDULE_MS[round - 1] ?? 0)
    );
  };
  void run(0);
}
