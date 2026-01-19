import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { RiGroupFill, RiMapPinFill, RiMapPinUserFill } from "@remixicon/react";
import { cn } from "../../../utils/styles/cn";
import { buildGardenMemberSets } from "../../../utils/app/garden";
import { formatAddress } from "../../../utils/app/text";
import { ImageWithFallback } from "../../Display/ImageWithFallback";
import { Badge } from "../../Badge/Badge";

const gardenCardVariants = tv({
  base: "@container relative flex flex-col grow border-0 rounded-lg overflow-clip rounded-b-lg justify-between p-0 gap-0 transition-all duration-300",
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
  showDescription?: boolean;
  showBanner?: boolean;
  /** Translated labels - defaults to English */
  labels?: GardenCardLabels;
  /** Render function for operator display name (for ENS resolution) */
  renderOperatorName?: (address: string) => React.ReactNode;
}

/** Banner fallback when no image is available */
const BannerFallback: React.FC<{ name?: string }> = ({ name }) => (
  <div className="absolute inset-0">
    <div className="absolute inset-0 bg-gradient-to-br from-bg-weak-50 to-bg-soft-200" />
    <div className="absolute inset-0 opacity-50 bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.04)_0px,rgba(0,0,0,0.04)_10px,transparent_10px,transparent_20px)]" />
    <div className="absolute inset-0 grid place-items-center">
      <span className="text-5xl font-semibold text-text-soft-400 select-none">
        {(name?.charAt(0) || "G").toUpperCase()}
      </span>
    </div>
  </div>
);

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
      showDescription = true,
      showBanner = true,
      labels: labelsProp,
      renderOperatorName,
    },
    ref
  ) => {
    // Merge provided labels with defaults
    const labels = { ...defaultLabels, ...labelsProp };

    const [imageError, setImageError] = React.useState(false);
    const hasProvidedSrc = Boolean(garden.bannerImage);

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

    const Wrapper = interactive ? "button" : "div";

    return (
      <Wrapper
        ref={ref as React.Ref<HTMLButtonElement & HTMLDivElement>}
        data-testid="garden-card"
        className={cn(classes, "rounded-2xl border border-border bg-bg-white-0", className)}
        onClick={interactive ? onClick : undefined}
        type={interactive ? "button" : undefined}
      >
        {showBanner && (
          <div
            className={cn(
              // Container query: adapts to card width, not viewport
              "h-26 @[300px]:h-32 @[400px]:h-40",
              "relative w-full overflow-hidden"
            )}
          >
            {hasProvidedSrc && !imageError ? (
              <ImageWithFallback
                src={garden.bannerImage!}
                alt={garden.name || garden.description || "Garden"}
                className="absolute inset-0 w-full h-full object-cover"
                fallbackClassName="absolute inset-0 w-full h-full"
                onErrorCallback={() => setImageError(true)}
              />
            ) : (
              <BannerFallback name={garden.name} />
            )}
          </div>
        )}

        <div
          data-selected={selected}
          className={cn(
            // Container query: responsive padding based on card width
            "p-3 @[300px]:p-4 @[400px]:p-5",
            "flex flex-col gap-2 border border-border rounded-lg transition-all duration-400 flex-1",
            showBanner && "border-t-0 rounded-t-none"
          )}
        >
          <div className="flex flex-col gap-2 flex-1">
            {/* Selection highlight overlay */}
            <div
              className={cn(
                "absolute top-0 left-0 right-0 bottom-0 w-full h-full border-2 border-primary/50 rounded-lg opacity-0 transition-opacity duration-300 z-10 pointer-events-none",
                selected && "opacity-100"
              )}
            />

            {/* Garden name */}
            <h5
              className={cn(
                "flex items-center text-lg font-semibold transition-colors line-clamp-1",
                selected && "text-primary"
              )}
            >
              {garden.name}
            </h5>

            {/* Stats badges */}
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
                  {garden.location}
                </Badge>
              )}
            </div>

            {/* Operators list */}
            {showOperators && operatorCount > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-sub-600">
                  <RiMapPinUserFill className="h-3.5 w-3.5 text-primary" />
                  <span>{labels.operatorHeading}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-xs text-text-sub-600">
                  {operatorAddresses.slice(0, 2).map((operator) => (
                    <Badge
                      key={operator}
                      variant="outline"
                      tint="none"
                      className="border-0 p-0 text-xs font-medium leading-tight"
                    >
                      {renderOperatorName
                        ? renderOperatorName(operator)
                        : formatAddress(operator, { variant: "card" })}
                    </Badge>
                  ))}
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
              <p className="text-sm text-text-sub-600 line-clamp-3 flex-1">{garden.description}</p>
            )}
          </div>
        </div>
      </Wrapper>
    );
  }
);

GardenCard.displayName = "GardenCard";

export { gardenCardVariants };
