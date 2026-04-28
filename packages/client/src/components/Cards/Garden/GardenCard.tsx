import {
  type Address,
  formatAddress,
  type Garden,
  GardenCardComponent as SharedGardenCard,
  type GardenCardProps as SharedGardenCardProps,
  gardenCardVariants,
  useEnsName,
  useGreenGoodsEnsName,
} from "@green-goods/shared";
import * as React from "react";
import { useIntl } from "react-intl";
export { gardenCardVariants };
export type { GardenCardVariantProps } from "@green-goods/shared";

export type GardenCardOptions = {
  showOperators?: boolean;
  showDescription?: boolean;
  showBanner?: boolean;
};

export interface GardenCardProps
  extends Omit<SharedGardenCardProps, "garden" | "labels" | "renderOperatorName">,
    GardenCardOptions {
  garden: Garden;
}

const OperatorName: React.FC<{ address: Address }> = ({ address }) => {
  const { data: greenGoodsEnsName } = useGreenGoodsEnsName(address);
  const { data: ensName } = useEnsName(address);
  return <>{formatAddress(address, { ensName: greenGoodsEnsName || ensName, variant: "card" })}</>;
};

const GardenCard = React.forwardRef<HTMLDivElement, GardenCardProps>(
  ({ garden, ...props }, ref) => {
    const intl = useIntl();

    return (
      <SharedGardenCard
        ref={ref}
        {...(props as SharedGardenCardProps)}
        garden={{
          id: garden.id,
          name: garden.name,
          location: garden.location,
          description: garden.description,
          bannerImage: garden.bannerImage,
          gardeners: garden.gardeners,
          operators: garden.operators,
        }}
        labels={{
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
            { count: "{count}" }
          ),
        }}
        renderOperatorName={(address) => <OperatorName address={address as Address} />}
      />
    );
  }
);
GardenCard.displayName = "GardenCard";

export { GardenCard };
