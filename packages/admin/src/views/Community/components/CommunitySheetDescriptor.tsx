import { adminRoutes, useLeftSheetConfig, type LeftSheetConfig } from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const communitySheet = useMemo<LeftSheetConfig | null>(() => {
    if (isVaultRoute) {
      return {
        title: formatMessage({ id: "app.treasury.title" }),
        content: <GardenVaultView layout="sheet" />,
        onClose: () => navigate(adminRoutes.communityTreasury()),
      };
    }

    if (isStrategiesRoute) {
      return {
        title: formatMessage({ id: "app.conviction.title" }),
        content: <GardenStrategiesView layout="sheet" />,
        onClose: () => navigate(adminRoutes.communityGovernance()),
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
        onClose: () => navigate(adminRoutes.communityGovernance()),
      };
    }

    return null;
  }, [formatMessage, isSignalPoolRoute, isStrategiesRoute, isVaultRoute, navigate, poolType]);

  useLeftSheetConfig(communitySheet);

  return null;
}
