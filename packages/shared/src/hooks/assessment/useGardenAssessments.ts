import { useQuery } from "@tanstack/react-query";

import { getEASConfig } from "../../config/blockchain";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { getGardenAssessments } from "../../modules/data/eas";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { assessmentsKeys } from "../../config/query-keys/garden";
import { isZeroBytes32 } from "../../utils/blockchain/vaults";

const ZERO_UID = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Every assessment schema the chain has registered, newest first.
 *
 * EAS schemas are immutable, so assessment v3 is a separate UID beside the
 * still-readable v2 record, and a garden's assessments sit under whichever one
 * was current when they were recorded. Anything that offers a garden's
 * assessments — the commitment attachment picker most of all, since the pooling
 * module accepts either UID (ProofLib.sol:104-107) — has to read both, or a
 * garden holding only a v3 attestation reads as having none.
 */
function assessmentSchemaUIDs(chainId: number): string[] {
  const config = getEASConfig(chainId);
  const uids = [config.ASSESSMENT_V3.uid, config.ASSESSMENT.uid].filter(
    (uid) => !isZeroBytes32(uid ?? ZERO_UID)
  );
  return [...new Set(uids)];
}

export function useGardenAssessments(gardenAddress?: string, chainId?: number) {
  const resolvedChainId = chainId ?? DEFAULT_CHAIN_ID;

  return useQuery({
    queryKey: assessmentsKeys.byGardenBase(gardenAddress ?? "", resolvedChainId),
    queryFn: async () => {
      if (!gardenAddress) {
        return [];
      }
      const perSchema = await Promise.all(
        assessmentSchemaUIDs(resolvedChainId).map((uid) =>
          getGardenAssessments(gardenAddress, resolvedChainId, uid)
        )
      );
      // One attestation can only carry one schema, but a chain that registered
      // the same UID twice would otherwise duplicate the row in the picker.
      const byId = new Map(perSchema.flat().map((assessment) => [assessment.id, assessment]));
      return [...byId.values()];
    },
    enabled: Boolean(gardenAddress),
    staleTime: STALE_TIME_MEDIUM,
    refetchInterval: 60_000,
  });
}
