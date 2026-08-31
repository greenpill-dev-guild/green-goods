import type { Address } from "@green-goods/shared/types/domain";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useRouteBackedLeftSheetConfig } from "@/components/Layout";
import GardenSignalPoolView from "@/views/Garden/SignalPool";
import GardenStrategiesView from "@/views/Garden/Strategies";
import { VaultActionRouteDialog, type VaultActionRoute } from "./VaultActionRouteDialog";

interface CommunitySheetDescriptorProps {
  isStrategiesRoute: boolean;
  isSignalPoolRoute: boolean;
  vaultAction: VaultActionRoute | null;
  poolType: string | undefined;
  gardenAddress?: Address | string;
}

export function CommunitySheetDescriptor({
  isStrategiesRoute,
  isSignalPoolRoute,
  vaultAction,
  poolType,
  gardenAddress,
}: CommunitySheetDescriptorProps) {
  const { formatMessage } = useIntl();

  const communitySheet = useMemo(() => {
    if (isStrategiesRoute) {
      return {
        title: formatMessage({ id: "app.conviction.title" }),
        content: <GardenStrategiesView layout="sheet" />,
        closeTo: adminRoutes.communityCoordination({ gardenId: gardenAddress }),
        size: "lg" as const,
        tone: "community" as const,
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
        closeTo: adminRoutes.communityCoordination({ gardenId: gardenAddress }),
        size: "lg" as const,
        tone: "community" as const,
      };
    }

    return null;
  }, [formatMessage, gardenAddress, isSignalPoolRoute, isStrategiesRoute, poolType]);

  useRouteBackedLeftSheetConfig(communitySheet);

  return <VaultActionRouteDialog action={vaultAction} gardenAddress={gardenAddress} />;
}
