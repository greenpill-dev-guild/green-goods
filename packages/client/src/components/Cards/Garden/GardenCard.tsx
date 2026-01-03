import { RiGroupFill, RiMapPinFill, RiMapPinUserFill } from "@remixicon/react";
import * as React from "react";
import { useIntl } from "react-intl";
import { tv, type VariantProps } from "tailwind-variants";
import { useEnsName } from "@green-goods/shared/hooks";
import { buildGardenMemberSets, cn, formatAddress } from "@green-goods/shared/utils";
import { ImageWithFallback } from "@/components/Display";
import { Badge } from "@/components/Communication";
import { Card, type CardRootProps } from "../Base/Card";

export const cardVariants = tv({
  base: "relative flex flex-col grow border-0 rounded-lg overflow-clip rounded-b-lg justify-between p-0 gap-0",
  variants: {
    media: {
      large: "",
      small: "",
    },
    height: {
      home: "", // Taller for home view
      selection: "h-72", // Shorter for selection view
      default: "", // Default height
    },
  },
  defaultVariants: {
    media: "large",
    height: "default",
  },
});

export type GardenCardVariantProps = VariantProps<typeof cardVariants>;

export type GardenCardOptions = {
  showOperators?: boolean;
  showDescription?: boolean;
  showBanner?: boolean;
};

export type GardenCardRootProps = React.HTMLAttributes<HTMLDivElement> &
  GardenCardVariantProps &
  CardRootProps & { garden: Garden; selected: boolean } & GardenCardOptions;

const OperatorBadge: React.FC<{ address: string }> = ({ address }) => {
  const { data: ensName } = useEnsName(address);
  return (
    <Badge variant="outline" tint="none" className="border-0 p-0 text-xs font-medium leading-tight">
      {formatAddress(address, { ensName, variant: "card" })}
    </Badge>
  );
};

const GardenCard = React.forwardRef<HTMLDivElement, GardenCardRootProps>(
  (
    {
      media,
      height,
      className,
      selected,
      garden,
      showOperators = false,
      showDescription = true,
      showBanner = true,
      onClick,
    },
    ref
  ) => {
    const intl = useIntl();

    const [imageError, setImageError] = React.useState(false);
    const hasProvidedSrc = Boolean(garden.bannerImage);
    const membership = React.useMemo(
      () => buildGardenMemberSets(garden.gardeners, garden.operators),
      [garden.gardeners, garden.operators]
    );
    const membersCount = membership.memberIds.size;
    const operatorAddresses = React.useMemo(
      () => Array.from(membership.operatorIds),
      [membership.operatorIds]
    );
    const operatorCount = operatorAddresses.length;

    const classes = cardVariants({ media, height, class: className });

    // Placeholder for missing/failed banner images
    const BannerFallback = () => (
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
        <div className="absolute inset-0 opacity-50 bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.04)_0px,rgba(0,0,0,0.04)_10px,transparent_10px,transparent_20px)]" />
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-5xl font-semibold text-slate-400 select-none">
            {(garden.name?.charAt(0) || "G").toUpperCase()}
          </span>
        </div>
      </div>
    );

    return (
      <Card
        ref={ref}
        data-testid="garden-card"
        className={cn(classes, "tap-feedback transition-all duration-300", selected && "")}
        onClick={onClick}
      >
        {showBanner && (
          <div
            className={cn(media === "large" ? "h-40" : "h-26", "relative w-full overflow-hidden")}
          >
            {hasProvidedSrc && !imageError ? (
              <ImageWithFallback
                src={garden.bannerImage}
                alt={garden.name || garden.description || "Garden"}
                className="absolute inset-0 w-full h-full object-cover image-lut z-1"
                fallbackClassName="absolute inset-0 w-full h-full"
                onErrorCallback={() => setImageError(true)}
              />
            ) : (
              <BannerFallback />
            )}
          </div>
        )}
        <div
          data-selected={selected}
          className={cn(
            "p-5 flex flex-col gap-2 border border-border rounded-lg transition-all duration-400 flex-1", // flex-1 for remaining space
            showBanner && "border-t-0 rounded-t-0"
          )}
        >
          <div className="flex flex-col gap-2 flex-1">
            <div
              className={cn(
                "absolute top-0 left-0 right-0 bottom-0 w-full h-full border-2 border-primary/50 rounded-lg opacity-0 status-transition z-10 pointer-events-none",
                selected && "opacity-100"
              )}
            />
            <h5
              className={cn(
                "flex items-center text-lg font-semibold transition-colors line-clamp-1",
                selected && "text-primary"
              )}
            >
              {garden.name}
            </h5>

            <div className="flex flex-row flex-wrap gap-1 text-xs text-slate-600 font-medium">
              <Badge
                variant="outline"
                tint="none"
                className="border-0 p-0 text-xs font-medium leading-tight"
                leadingIcon={<RiGroupFill className="h-4 w-4 text-primary" />}
              >
                {membersCount}{" "}
                {intl.formatMessage({
                  id: "app.garden.members",
                  defaultMessage: "Members",
                })}
              </Badge>
              {operatorCount > 0 ? (
                <Badge
                  variant="outline"
                  tint="none"
                  className="border-0 p-0 text-xs font-medium leading-tight"
                  leadingIcon={<RiMapPinUserFill className="h-4 w-4 text-primary" />}
                >
                  {operatorCount}{" "}
                  {intl.formatMessage({
                    id: "app.garden.operators",
                    defaultMessage: "Operators",
                  })}
                </Badge>
              ) : null}
              <Badge
                variant="outline"
                tint="none"
                className="border-0 p-0 text-xs font-medium leading-tight"
              >
                <RiMapPinFill className="h-4 w-4 text-primary" />
                {garden.location}
              </Badge>
            </div>

            {showOperators && operatorCount > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <RiMapPinUserFill className="h-3.5 w-3.5" />
                  <span>
                    {intl.formatMessage({
                      id: "app.garden.operatorHeading",
                      defaultMessage: "Operators",
                    })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
                  {operatorAddresses.slice(0, 2).map((operator) => (
                    <OperatorBadge key={operator} address={operator} />
                  ))}
                  {operatorAddresses.length > 2 && (
                    <span className="text-xs text-slate-500">
                      {intl.formatMessage(
                        {
                          id: "app.garden.andOthers",
                          defaultMessage: "and {amount} others",
                        },
                        { amount: operatorAddresses.length - 2 }
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}

            {showDescription && (
              <p className="text-sm text-slate-600 line-clamp-3 flex-1">{garden.description}</p>
            )}
          </div>
        </div>
      </Card>
    );
  }
);
GardenCard.displayName = "GardenCard";

export { GardenCard };
