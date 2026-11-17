// Command Surface: the way into a new promise from Home (DL-181).
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { usePoolAccess } from "@green-goods/shared/hooks/client-ui/pool/useGardenPoolController";
import { useDashboardNavigation } from "@green-goods/shared/hooks/client-ui/useDashboardNavigation";
import { useCommitmentPools } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import type { Address } from "@green-goods/shared/types/domain";
import { useContext } from "react";

import { PoolCreateEntry } from "../Garden/Pool/PoolCreateEntry";
import { HomeShownContext } from "./homeShown";

export interface OfferOrAskProps {
  /** The active garden, whose pool the promise is started in. */
  gardenId: string;
}

/**
 * Offer or Ask on Home (DL-181): the garden page's floating + and its sheet, over the journal
 * and 16px above the bottom bar. It reads the garden's pool as the garden page does, the first
 * the indexer lists for the garden, and shows only to a reader that pool's Promises tab shows
 * it to (`usePoolAccess`). It leaves with Home, taking its sheet with it. A door opens the
 * composer as the next page, so the composer's Back and Done return to Home.
 */
export function OfferOrAsk({ gardenId }: OfferOrAskProps) {
  const homeShown = useContext(HomeShownContext);
  const { pools } = useCommitmentPools({ chainId: DEFAULT_CHAIN_ID, garden: gardenId as Address });
  const { canCreate } = usePoolAccess(pools[0]);
  const dashboardNavigation = useDashboardNavigation();
  if (!canCreate || !homeShown) return null;
  return (
    <PoolCreateEntry
      aboveAppBar
      onChoose={(door) =>
        dashboardNavigation.open(`/home/${gardenId}/commitments/new?direction=${door}`)
      }
    />
  );
}
