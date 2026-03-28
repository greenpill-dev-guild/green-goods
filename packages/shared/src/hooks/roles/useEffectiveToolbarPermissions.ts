/**
 * Effective Toolbar Permissions Hook
 *
 * Computes which cockpit toolbar slots are visible based on
 * the user's garden-level roles, aggregated across all managed
 * gardens or scoped to the selected garden.
 *
 * Fail-open: while loading or on error, all slots are visible.
 */

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { isAddressInList } from "../../utils/blockchain/address";
import { useAdminStore } from "../../stores/useAdminStore";
import { useGardens } from "../blockchain/useBaseLists";
import { useRole } from "../gardener/useRole";

export interface ToolbarPermissions {
  showWork: boolean;
  showGarden: boolean;
  showCommunity: boolean;
  showActions: boolean;
  isLoading: boolean;
}

const FAIL_OPEN: ToolbarPermissions = {
  showWork: true,
  showGarden: true,
  showCommunity: true,
  showActions: true,
  isLoading: true,
};

export function useEffectiveToolbarPermissions(): ToolbarPermissions {
  const { address } = useAccount();
  const selectedGarden = useAdminStore((s) => s.selectedGarden);
  const { isDeployer, isOperator: isPlatformOperator, loading: roleLoading } = useRole();
  const { data: gardens, isLoading: gardensLoading } = useGardens();

  return useMemo(() => {
    // Fail-open while loading
    if (roleLoading || gardensLoading || !address) {
      return FAIL_OPEN;
    }

    // Determine which gardens to check
    const scope = selectedGarden
      ? (gardens ?? []).filter((g) => g.id === selectedGarden.id)
      : (gardens ?? []);

    // Compute aggregated roles across the scope
    let hasAnyRole = false;
    let isOperatorOrOwner = false;

    for (const garden of scope) {
      const inOperators = isAddressInList(address, garden.operators);
      const inGardeners = isAddressInList(address, garden.gardeners);
      const inOwners = isAddressInList(address, garden.owners);
      const inEvaluators = isAddressInList(address, garden.evaluators);
      const inFunders = isAddressInList(address, garden.funders);
      const inCommunities = isAddressInList(address, garden.communities);

      if (inOperators || inGardeners || inOwners || inEvaluators || inFunders || inCommunities) {
        hasAnyRole = true;
      }

      if (inOperators || inOwners) {
        isOperatorOrOwner = true;
      }

      // Short-circuit: if we already have the highest permissions, stop iterating
      if (hasAnyRole && isOperatorOrOwner) break;
    }

    return {
      showWork: hasAnyRole,
      showGarden: isOperatorOrOwner,
      showCommunity: isOperatorOrOwner,
      showActions: isDeployer || isPlatformOperator,
      isLoading: false,
    };
  }, [
    address,
    selectedGarden,
    gardens,
    roleLoading,
    gardensLoading,
    isDeployer,
    isPlatformOperator,
  ]);
}
