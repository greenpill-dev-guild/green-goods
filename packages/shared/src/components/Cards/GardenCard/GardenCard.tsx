import { RiGroupFill, RiMapPinFill, RiMapPinUserFill } from "@remixicon/react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { buildGardenMemberSets } from "../../../utils/app/garden";
import { formatAddress } from "../../../utils/app/text";
import { cn } from "../../../utils/styles/cn";
import { Badge } from "../../Badge/Badge";
import { GardenBannerFallback } from "../../Display/GardenBannerFallback";
import { ImageWithFallback } from "../../Display/ImageWithFallback";

const gardenCardVariants = tv({
  base: "@container relative flex flex-col grow border-0 rounded-lg overflow-clip rounded-b-lg justify-between p-0 gap-0 transition-all duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)]",
  variants: {
    media: {
      large: "",
      small: "",
    },
    height: {
      home: "",
      selection: "h-72",
      default: "",
    },
    interactive: {
      true: "cursor-pointer",
      false: "",
    },
  },
  defaultVariants: {
    media: "large",
    height: "default",
    interactive: true,
  },
});

export type GardenCardVariantProps = VariantProps<typeof gardenCardVariants>;

/** Data structure for the GardenCard component */
export interface GardenCardData {
  id: string;
  name: string;
  location?: string;
  description?: string;
  bannerImage?: string;
  gardeners?: string[];
  operators?: string[];
}

/** Translatable labels for the GardenCard component */
export interface GardenCardLabels {
  members?: string;
  operators?: string;
  operatorHeading?: string;
  /** Template for "and X others" - use {count} placeholder */
  andOthers?: string;
}

/** Default English labels */
const defaultLabels: Required<GardenCardLabels> = {
  members: "Members",
  operators: "Operators",
  operatorHeading: "Operators",
  andOthers: "and {count} others",
};

export interface GardenCardProps extends GardenCardVariantProps {
  garden: GardenCardData;
  selected?: boolean;
  className?: string;
  onClick?: () => void;
  showOperators?: boolean;
  showStats?: boolean;
  showDescription?: boolean;
  showBanner?: boolean;
  /** Translated labels - defaults to English */
  labels?: GardenCardLabels;
  /** Render function for operator display name (for ENS resolution) */
  renderOperatorName?: (address: string) => React.ReactNode;
}

export const GardenCard = React.forwardRef<HTMLDivElement, GardenCardProps>(
  (
    {
      garden,
      media,
      height,
      interactive = true,
      selected = false,
      className,
      onClick,
      showOperators = false,
      showStats = true,
      showDescription = true,
      showBanner = true,
      labels: labelsProp,
      renderOperatorName,
    },
    ref
  ) => {
    // Merge provided labels with defaults
    const labels = { ...defaultLabels, ...labelsProp };

    const membership = React.useMemo(
      () => buildGardenMemberSets(garden.gardeners || [], garden.operators || []),
      [garden.gardeners, garden.operators]
    );

    const membersCount = membership.memberIds.size;
    const operatorAddresses = React.useMemo(
      () => Array.from(membership.operatorIds),
      [membership.operatorIds]
    );
    const operatorCount = operatorAddresses.length;

    const classes = gardenCardVariants({ media, height, interactive });
    const isMinimalSelection = height === "selection" && !showStats && !showOperators;
    const mediaHeightClasses =
      isMinimalSelection && media === "small" ? "h-24" : "h-26 @[300px]:h-32 @[400px]:h-40";

    const Wrapper = interactive ? "button" : "div";

    return (
      <Wrapper
        ref={ref as React.Ref<HTMLButtonElement & HTMLDivElement>}
        data-testid="garden-card"
        className={cn(
          classes,
          isMinimalSelection && "h-[13.25rem]",
          "rounded-2xl border border-border bg-bg-white-0 text-left",
          className
        )}
        onClick={interactive ? onClick : undefined}
        type={interactive ? "button" : undefined}
        style={{ textAlign: "left", width: "100%" }}
      >
        {showBanner && (
          <div
            className={cn(
              // Container query: adapts to card width, not viewport
              mediaHeightClasses,
              "relative w-full overflow-hidden"
            )}
          >
            <ImageWithFallback
              src={garden.bannerImage || ""}
              alt={garden.name || garden.description || "Garden"}
              className="absolute inset-0 w-full h-full object-cover"
              backgroundFallback={<GardenBannerFallback name={garden.name} />}
            />
          </div>
        )}

        <div
          data-selected={selected}
          className={cn(
            // Container query: responsive padding based on card width
            "p-3 @[300px]:p-4 @[400px]:p-5",
            "flex flex-col gap-2 border border-border rounded-lg transition-all duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)] flex-1 text-left",
            showBanner && "border-t-0 rounded-t-none"
          )}
        >
          <div className="flex flex-col gap-2 flex-1">
            {/* Selection highlight overlay */}
            <div
              className={cn(
                "absolute top-0 left-0 right-0 bottom-0 w-full h-full border-2 rounded-lg opacity-0 transition-opacity duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)] z-10 pointer-events-none",
                selected && "opacity-100"
              )}
              style={{ borderColor: "var(--color-primary)" }}
            />

            {/* Garden name */}
            <h5
              className={cn(
                isMinimalSelection
                  ? "min-w-0 truncate text-label-md font-semibold transition-colors"
                  : "flex items-center text-lg font-semibold transition-colors line-clamp-1",
                selected && "text-primary"
              )}
              title={garden.name}
            >
              {garden.name}
            </h5>

            {/* Stats badges */}
            {showStats && (
              <div className="flex flex-row flex-wrap gap-1 text-xs text-text-sub-600 font-medium">
                <Badge
                  variant="outline"
                  tint="none"
                  className="border-0 p-0 text-xs font-medium leading-tight"
                  leadingIcon={<RiGroupFill className="h-4 w-4 text-primary" />}
                >
                  {membersCount} {labels.members}
                </Badge>

                {operatorCount > 0 && (
                  <Badge
                    variant="outline"
                    tint="none"
                    className="border-0 p-0 text-xs font-medium leading-tight"
                    leadingIcon={<RiMapPinUserFill className="h-4 w-4 text-primary" />}
                  >
                    {operatorCount} {labels.operators}
                  </Badge>
                )}

                {garden.location && (
                  <Badge
                    variant="outline"
                    tint="none"
                    className="border-0 p-0 text-xs font-medium leading-tight"
                  >
                    <RiMapPinFill className="h-4 w-4 text-primary" />
                    <span className="max-w-[12rem] truncate" title={garden.location}>
                      {garden.location}
                    </span>
                  </Badge>
                )}
              </div>
            )}

            {/* Operators list */}
            {showOperators && operatorCount > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-sub-600">
                  <RiMapPinUserFill className="h-3.5 w-3.5 text-primary" />
                  <span>{labels.operatorHeading}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-xs text-text-sub-600">
                  {operatorAddresses.slice(0, 2).map((operator) => {
                    const operatorLabel = renderOperatorName
                      ? renderOperatorName(operator)
                      : formatAddress(operator, { variant: "card" });
                    return (
                      <Badge
                        key={operator}
                        variant="outline"
                        tint="none"
                        className="border-0 p-0 text-xs font-medium leading-tight"
                      >
                        <span
                          className="max-w-[10rem] truncate"
                          title={typeof operatorLabel === "string" ? operatorLabel : operator}
                        >
                          {operatorLabel}
                        </span>
                      </Badge>
                    );
                  })}
                  {operatorAddresses.length > 2 && (
                    <span className="text-xs text-text-sub-600">
                      {labels.andOthers.replace("{count}", String(operatorAddresses.length - 2))}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {showDescription && garden.description && (
              <p
                className={cn(
                  "text-sm text-text-sub-600 line-clamp-3",
                  isMinimalSelection ? "h-[3.75rem] leading-5" : "flex-1"
                )}
                title={garden.description}
              >
                {garden.description}
              </p>
            )}
          </div>
        </div>
      </Wrapper>
    );
  }
);

GardenCard.displayName = "GardenCard";

export { gardenCardVariants };
