import { useCallback, useEffect, useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import {
  type ActiveGardenStatus,
  activeGardenScope,
  isInGardenListScope,
  resolveActiveGarden,
} from "../../modules/garden/active-garden";
import { useActiveGardenStore } from "../../stores/useActiveGardenStore";
import type { Garden } from "../../types/domain";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { type MyGardens, useMyGardens } from "./useMyGardens";

export interface ActiveGarden {
  status: ActiveGardenStatus;
  /**
   * The garden Home opens in: the resolved garden when `ready`, the remembered one while the
   * account's gardens are unknown (`loading`) or their read failed (`error`), otherwise null.
   */
  gardenId: string | null;
  /** The active garden's record from the account's gardens, once `ready`. */
  garden: Garden | null;
  /** The account's gardens, for the switcher. */
  myGardens: MyGardens;
  /**
   * Make one of the account's gardens the active one, as the chip's switcher and Home's
   * first-login page do. A garden that is not the account's is ignored: visiting a garden never
   * switches it. Joining an open garden writes its own choice (`useJoinGarden`, DL-147).
   */
  selectGarden: (gardenId: string) => void;
  /**
   * Whether a garden-scoped list (DL-129: the Promises and Your Work sheets and their badges)
   * shows an item that names these gardens (`isInGardenListScope`). It hides only what the chip
   * can show by switching, so nothing on the phone is stranded.
   */
  inScope: (gardens: readonly (string | null | undefined)[]) => boolean;
}

/**
 * The installed app's active garden for the signed-in account on this chain
 * (`modules/garden/active-garden`). One garden selects itself and is remembered; a remembered
 * garden wins while it is still the account's; several with none remembered ask the member to
 * choose. Only the remembered choice is written here: drafts, queued jobs, promise links and
 * permission checks keep their own garden.
 */
export function useActiveGarden(chainId: number = DEFAULT_CHAIN_ID): ActiveGarden {
  const account = usePrimaryAddress();
  const myGardens = useMyGardens(account, chainId);
  const scope = activeGardenScope(chainId, account);
  const remembered = useActiveGardenStore((state) => state.gardenIdsByScope);
  const rememberGarden = useActiveGardenStore((state) => state.rememberGarden);

  const { gardens, isLoaded, isError } = myGardens;
  const { resolution, inScope } = useMemo(() => {
    const resolution = resolveActiveGarden({
      scope,
      remembered,
      myGardens: { gardens, isLoaded, isError },
    });
    const listScope = {
      activeGardenId: resolution.gardenId,
      memberGardenIds: isLoaded
        ? new Set(gardens.map(({ garden }) => garden.id.toLowerCase()))
        : null,
    };
    return {
      resolution,
      inScope: (named: readonly (string | null | undefined)[]) =>
        isInGardenListScope(listScope, named),
    };
  }, [scope, remembered, gardens, isLoaded, isError]);

  // The one garden an account has selects itself and is remembered.
  const autoSelected = resolution.status === "ready" && resolution.remember;
  useEffect(() => {
    if (scope && autoSelected && resolution.gardenId) rememberGarden(scope, resolution.gardenId);
  }, [autoSelected, rememberGarden, resolution.gardenId, scope]);

  const selectGarden = useCallback(
    (gardenId: string) => {
      const mine = gardens.find(({ garden }) => garden.id.toLowerCase() === gardenId.toLowerCase());
      if (scope && mine) rememberGarden(scope, mine.garden.id);
    },
    [gardens, rememberGarden, scope]
  );

  const garden =
    resolution.status === "ready"
      ? (gardens.find(({ garden: mine }) => mine.id === resolution.gardenId)?.garden ?? null)
      : null;

  return {
    status: resolution.status,
    gardenId: resolution.gardenId,
    garden,
    myGardens,
    selectGarden,
    inScope,
  };
}
