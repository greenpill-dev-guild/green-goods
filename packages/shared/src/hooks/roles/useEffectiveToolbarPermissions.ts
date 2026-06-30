/**
 * Effective Toolbar Permissions Hook
 *
 * Computes which canvas toolbar slots are visible based on
 * the user's garden-level roles, aggregated across all managed
 * gardens or scoped to the selected garden.
 *
 * Fail-open: while loading or on error, all slots are visible.
 */

import { useMemo } from "react";
import { compareAddresses, isAddressInList } from "../../utils/blockchain/address";
import { useAdminStore } from "../../stores/useAdminStore";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useRole } from "../gardener/useRole";
import { useEligibleAdminGardens } from "../garden/useEligibleAdminGardens";

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
  const address = usePrimaryAddress();
  const selectedGarden = useAdminStore((s) => s.selectedGarden);
  const { isDeployer, loading: roleLoading } = useRole();
  const {
    eligibleGardens,
    isLoaded: eligibleGardensLoaded,
    isError: eligibleGardensError,
  } = useEligibleAdminGardens();

  return useMemo(() => {
    // Fail-open while loading or on error (gardens data undefined)
    if (roleLoading || !eligibleGardensLoaded || !address) {
      return FAIL_OPEN;
    }

    if (eligibleGardensError && eligibleGardens.length === 0) {
      return FAIL_OPEN;
    }

    // Determine which gardens to check
    const scope = selectedGarden
      ? eligibleGardens.filter((g) => compareAddresses(g.id, selectedGarden.id))
      : eligibleGardens;

    // Compute aggregated roles across the scope
    let hasAnyRole = false;
    let isOperatorOrOwner = false;
    let isOwner = false;

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
      if (inOwners) {
        isOwner = true;
      }
    }

    return {
      showWork: hasAnyRole,
      showGarden: isOperatorOrOwner,
      // Operators participate in Community: they manage roles, deposits, and
      // payouts. Gating to deployer-or-owner only hid that surface from people
      // who do most of the day-to-day work.
      showCommunity: isDeployer || isOperatorOrOwner,
      showActions: isDeployer,
      isLoading: false,
    };
  }, [
    address,
    selectedGarden,
    eligibleGardens,
    roleLoading,
    eligibleGardensLoaded,
    eligibleGardensError,
    isDeployer,
  ]);
}
