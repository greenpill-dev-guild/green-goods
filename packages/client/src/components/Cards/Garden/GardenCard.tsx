/**
 * GardenCard - Re-exported from shared with client-specific ENS integration
 *
 * The shared GardenCard accepts a `renderOperatorName` prop for ENS name resolution.
 * This wrapper provides the ENS integration using the client's useEnsName hook.
 */
import * as React from "react";
import { useIntl } from "react-intl";
import {
  GardenCard as SharedGardenCard,
  type GardenCardProps as SharedGardenCardProps,
  type GardenCardLabels,
} from "@green-goods/shared/components";
import { useEnsName } from "@green-goods/shared/hooks";
import { formatAddress } from "@green-goods/shared/utils";

// Re-export types for backward compatibility
export type {
  GardenCardData,
  GardenCardLabels,
  GardenCardVariantProps,
} from "@green-goods/shared/components";

// Also export the variants for customization
export { gardenCardVariants } from "@green-goods/shared/components";

/** Operator name with ENS resolution */
const OperatorName: React.FC<{ address: string }> = ({ address }) => {
  const { data: ensName } = useEnsName(address);
  return <>{formatAddress(address, { ensName, variant: "card" })}</>;
};

/** Props for client GardenCard - extends shared with Garden type */
export interface GardenCardProps extends Omit<SharedGardenCardProps, "garden" | "labels"> {
  garden: Garden;
}

/**
 * Client GardenCard wrapper with i18n and ENS support
 */
export const GardenCard = React.forwardRef<HTMLDivElement, GardenCardProps>(
  ({ garden, ...props }, ref) => {
    const intl = useIntl();

    // Translate labels
    const labels: GardenCardLabels = {
      members: intl.formatMessage({
        id: "app.garden.members",
        defaultMessage: "Members",
      }),
      operators: intl.formatMessage({
        id: "app.garden.operators",
        defaultMessage: "Operators",
      }),
      operatorHeading: intl.formatMessage({
        id: "app.garden.operatorHeading",
        defaultMessage: "Operators",
      }),
      andOthers: intl.formatMessage(
        {
          id: "app.garden.andOthers",
          defaultMessage: "and {count} others",
        },
        { count: "{count}" } // Keep placeholder for shared component
      ),
    };

    // Map Garden type to GardenCardData
    const gardenData = {
      id: garden.id,
      name: garden.name,
      location: garden.location,
      description: garden.description,
      bannerImage: garden.bannerImage,
      gardeners: garden.gardeners,
      operators: garden.operators,
    };

    return (
      <SharedGardenCard
        ref={ref}
        garden={gardenData}
        labels={labels}
        renderOperatorName={(address) => <OperatorName address={address} />}
        {...props}
      />
    );
  }
);

GardenCard.displayName = "GardenCard";
