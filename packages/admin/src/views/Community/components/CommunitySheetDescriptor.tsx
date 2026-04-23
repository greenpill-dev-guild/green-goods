import { adminRoutes, useRouteBackedLeftSheetConfig } from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import GardenSignalPoolView from "@/views/Garden/SignalPool";
import GardenStrategiesView from "@/views/Garden/Strategies";
import GardenVaultView from "@/views/Garden/Vault";

interface CommunitySheetDescriptorProps {
  isVaultRoute: boolean;
  isStrategiesRoute: boolean;
  isSignalPoolRoute: boolean;
  poolType: string | undefined;
}

export function CommunitySheetDescriptor({
  isVaultRoute,
  isStrategiesRoute,
  isSignalPoolRoute,
  poolType,
}: CommunitySheetDescriptorProps) {
  const { formatMessage } = useIntl();

  const communitySheet = useMemo(() => {
    if (isVaultRoute) {
      return {
        title: formatMessage({ id: "app.treasury.title" }),
        content: <GardenVaultView layout="sheet" />,
        closeTo: adminRoutes.communityTreasury(),
      };
    }

    if (isStrategiesRoute) {
      return {
        title: formatMessage({ id: "app.conviction.title" }),
        content: <GardenStrategiesView layout="sheet" />,
        closeTo: adminRoutes.communityGovernance(),
      };
    }

    if (isSignalPoolRoute) {
      return {
        title: formatMessage({
          id:
            poolType === "action"
              ? "app.signal.actionPool.title"
              : "app.signal.hypercertPool.title",
        }),
        content: <GardenSignalPoolView layout="sheet" />,
        closeTo: adminRoutes.communityGovernance(),
      };
    }

    return null;
  }, [formatMessage, isSignalPoolRoute, isStrategiesRoute, isVaultRoute, poolType]);

  useRouteBackedLeftSheetConfig(communitySheet);

  return null;
}
