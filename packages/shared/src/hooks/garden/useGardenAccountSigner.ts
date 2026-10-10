import { toFunctionSelector, zeroAddress } from "viem";
import { useReadContracts } from "wagmi";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import type { Address } from "../../types/domain";
import { GARDEN_ACCOUNT_EXECUTION_ABI } from "../../utils/blockchain/abis/garden";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";

/** ERC-6551: `isValidSigner` answers with its own selector when the signer is valid. */
const VALID_SIGNER_MAGIC_VALUE = toFunctionSelector("isValidSigner(address,bytes)");

/**
 * Whether the connected account can act as a garden account, and who owns it.
 *
 * A garden's roles say who may steward it; they do not say who can sign for its account. Only
 * the garden token's owner (or an account that owner permissioned) passes `execute`, so writes
 * that must come from the garden account, such as changing its cookie jars, gate on this read
 * rather than on the role list. `canSign` stays false until the chain has answered.
 */
export function useGardenAccountSigner(
  gardenAddress?: Address,
  options: { enabled?: boolean } = {}
) {
  const primaryAddress = usePrimaryAddress() as Address | null;
  const enabled = (options.enabled ?? true) && Boolean(gardenAddress);

  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: gardenAddress as Address,
        abi: GARDEN_ACCOUNT_EXECUTION_ABI,
        functionName: "owner" as const,
      },
      {
        address: gardenAddress as Address,
        abi: GARDEN_ACCOUNT_EXECUTION_ABI,
        functionName: "isValidSigner" as const,
        // Nobody connected asks about the zero address, which no garden account accepts.
        args: [primaryAddress ?? zeroAddress, "0x"] as const,
      },
    ],
    allowFailure: true,
    query: { enabled, staleTime: STALE_TIME_MEDIUM },
  });

  const owner = data?.[0]?.status === "success" ? (data[0].result as Address) : undefined;
  const signerAnswer = data?.[1];

  return {
    owner,
    canSign:
      Boolean(primaryAddress) &&
      signerAnswer?.status === "success" &&
      signerAnswer.result === VALID_SIGNER_MAGIC_VALUE,
    /** True once the chain has said yes or no for the connected account. */
    isResolved: signerAnswer?.status === "success",
    isLoading,
  };
}
