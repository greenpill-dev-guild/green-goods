import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { batchKeys } from "../../config/query-keys/garden";
import type { TransactionSender } from "../../modules/transactions/types";
import type { Address } from "../../types/domain";

/** The sender's answer, shared across routes but scoped to the connected account and wallet. */
export function useBatchCapability(input: {
  sender: TransactionSender | null;
  account: Address | null | undefined;
  chainId: number;
  /** The caller's listing and prerequisites allow this read; asking never prompts a signature. */
  enabled: boolean;
}) {
  const { sender, account, chainId, enabled } = input;
  const { connector } = useAccount();
  return useQuery({
    queryKey: batchKeys.capability(account ?? "", chainId, connector?.uid ?? ""),
    queryFn: async () => (await sender!.getBatchCapability!({ account: account!, chainId })).atomic,
    enabled: enabled && Boolean(account && sender?.getBatchCapability),
    retry: false,
  });
}
