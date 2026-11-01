import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchKeys } from "../../config/query-keys/garden";
import type { Address } from "../../types/domain";

export interface HeldBatchSettlement<Hold, Saved> {
  hold: Hold | null;
  /** What this read proved landed. */
  saved: Saved[];
}

/**
 * Saves in one domain whose outcome is unknown. `hold` and `saved` come from the latest read, and
 * `lastReadAt` marks it. A read follows every send and can settle that send by itself, so act on
 * each read, not on Check Again's result.
 */
export function useHeldBatches<Hold, Saved>(input: {
  domain: string;
  account: Address | null;
  chainId: number;
  /** Off while this tab's own send is in flight: that send is not unknown. */
  enabled: boolean;
  read: (shown: Hold | null) => Promise<HeldBatchSettlement<Hold, Saved>>;
  moveOn: (hold: Hold) => Promise<HeldBatchSettlement<Hold, Saved>>;
  /** Refresh whatever the proven items change. */
  onSaved: (saved: Saved[]) => void;
  onError: (error: unknown) => void;
}) {
  const { domain, account, chainId, enabled, read, moveOn, onSaved, onError } = input;
  const queryClient = useQueryClient();
  const key = batchKeys.hold(domain, account ?? "", chainId);
  const note = (settlement: HeldBatchSettlement<Hold, Saved>) => {
    if (settlement.saved.length > 0) onSaved(settlement.saved);
    return settlement;
  };

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const shown = queryClient.getQueryData<HeldBatchSettlement<Hold, Saved>>(key)?.hold ?? null;
      return note(await read(shown));
    },
    enabled,
    // Read on opening and when the person asks. The journal is the durable copy.
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const mutation = useMutation({
    mutationFn: async (hold: Hold) => note(await moveOn(hold)),
    onSuccess: (settlement) => queryClient.setQueryData(key, settlement),
    onError,
  });
  const hold = query.data?.hold ?? null;

  return {
    hold,
    saved: query.data?.saved ?? [],
    lastReadAt: query.dataUpdatedAt,
    /** False from a read's first failure: while it retries, nothing it can't read locks anyone out. */
    isSettlingHold: (query.isFetching && query.failureCount === 0) || mutation.isPending,
    checkAgain: async () => {
      const { error } = await query.refetch();
      if (error) onError(error);
    },
    moveOn: async () => {
      if (hold) await mutation.mutateAsync(hold).catch(() => undefined);
    },
  };
}
