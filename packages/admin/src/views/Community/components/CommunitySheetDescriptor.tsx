import { GOVERNANCE_ENABLED } from "@green-goods/shared/config/app";
import { useCanvasSearchParams } from "@green-goods/shared/hooks/navigation/useCanvasSearchParams";
import type { Address } from "@green-goods/shared/types/domain";
import { JAR_LIMIT_ROUTE_ITEM_PREFIX } from "@green-goods/shared/utils/cookie-jar-claim-limit";
import {
  adminRoutes,
  FUND_JAR_ROUTE_ITEM,
} from "@green-goods/shared/utils/navigation/admin-routes";
import { useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useNavigationType } from "react-router-dom";
import { isAddress } from "viem";
import { useRouteBackedLeftSheetConfig } from "@/components/Layout";
import GardenSignalPoolView from "@/views/Garden/SignalPool";
import GardenStrategiesView from "@/views/Garden/Strategies";
import { CookieJarDepositModal } from "@/views/Hub/components/CookieJarDepositModal";
import { type VaultActionRoute, VaultActionRouteDialog } from "./VaultActionRouteDialog";

interface CommunitySheetDescriptorProps {
  isStrategiesRoute: boolean;
  isSignalPoolRoute: boolean;
  vaultAction: VaultActionRoute | null;
  poolType: string | undefined;
  selectedItem: string | null;
  gardenAddress?: Address | string;
}

export function CommunitySheetDescriptor({
  isStrategiesRoute,
  isSignalPoolRoute,
  vaultAction,
  poolType,
  selectedItem,
  gardenAddress,
}: CommunitySheetDescriptorProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { updateSearch } = useCanvasSearchParams();
  // Whether Fund Cookie Jar's press pushed the entry the dialog is open on. It lives in a ref
  // because a deposit's success closes the dialog with a callback from the moment it was sent.
  const fundJarPushedEntry = useRef(false);
  useEffect(() => {
    fundJarPushedEntry.current = selectedItem === FUND_JAR_ROUTE_ITEM && navigationType === "PUSH";
  }, [navigationType, selectedItem]);

  const communitySheet = useMemo(() => {
    if (GOVERNANCE_ENABLED && isStrategiesRoute) {
      return {
        title: formatMessage({ id: "app.conviction.title" }),
        content: <GardenStrategiesView layout="sheet" />,
        closeTo: adminRoutes.communityCoordination({ gardenId: gardenAddress }),
        size: "lg" as const,
        tone: "community" as const,
      };
    }

    if (GOVERNANCE_ENABLED && isSignalPoolRoute) {
      return {
        title: formatMessage({
          id:
            poolType === "action"
              ? "app.signal.actionPool.title"
              : "app.signal.hypercertPool.title",
        }),
        content: <GardenSignalPoolView layout="sheet" />,
        closeTo: adminRoutes.communityCoordination({ gardenId: gardenAddress }),
        size: "lg" as const,
        tone: "community" as const,
      };
    }

    return null;
  }, [formatMessage, gardenAddress, isSignalPoolRoute, isStrategiesRoute, poolType]);

  useRouteBackedLeftSheetConfig(communitySheet);

  return (
    <>
      <VaultActionRouteDialog action={vaultAction} gardenAddress={gardenAddress} />
      {gardenAddress && isAddress(gardenAddress) ? (
        // Fund Cookie Jar opens over whichever tab the URL is on, and closing
        // drops the item and leaves the tab alone (DL-140). After a press it goes
        // back over the pushed entry, so browser Back stays live; a direct link or
        // a reload has no press beneath it. Only Fix Limit First moves on, because
        // the limit editor is on the jar's page under Payouts.
        <CookieJarDepositModal
          isOpen={selectedItem === FUND_JAR_ROUTE_ITEM}
          onClose={() => {
            if (fundJarPushedEntry.current) navigate(-1);
            else updateSearch({ item: undefined });
          }}
          gardenAddress={gardenAddress}
          onFixLimit={(jarAddress) =>
            navigate(
              adminRoutes.communityPayouts({
                gardenId: gardenAddress,
                item: `${JAR_LIMIT_ROUTE_ITEM_PREFIX}${jarAddress}`,
              }),
              { replace: true }
            )
          }
        />
      ) : null}
    </>
  );
}
