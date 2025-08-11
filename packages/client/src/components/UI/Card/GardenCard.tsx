import { RiGroupFill, RiMapPinFill, RiMapPinUserFill } from "@remixicon/react";
import * as React from "react";
import { useIntl } from "react-intl";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@/utils/cn";
import { formatAddress } from "@/utils/text";
import { Badge } from "../Badge/Badge";
import { Card, type CardRootProps } from "./Card";

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

    const classes = cardVariants({ media, height, class: className });
    return (
      <Card ref={ref} className={cn(classes, selected && "")} onClick={onClick}>
        <img
          src={garden.bannerImage}
          alt={garden.description}
          className={cn(
            media === "large" ? "h-40" : "h-26", // Consistent heights
            "object-cover image-lut z-1",
            !showBanner && "hidden"
          )}
        />
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
                "absolute top-0 left-0 right-0 bottom-0 w-full h-full border-2 border-primary/50 rounded-lg opacity-0 transition-opacity z-10 pointer-events-none",
                selected && "opacity-100"
              )}
            />
            <h5
              className={cn(
                "flex items-center text-xl font-medium transition-colors line-clamp-2",
                selected && "text-primary"
              )}
            >
              {garden.name}
            </h5>
            <div className="flex flex-row gap-1">
              <Badge
                variant="outline"
                tint="none"
                leadingIcon={<RiGroupFill className="h-4 w-4 text-primary" />}
              >
                {garden.operators.length}{" "}
                {intl.formatMessage({
                  id: "app.garden.gardeners",
                  defaultMessage: "Gardeners",
                })}
              </Badge>
              <Badge variant="outline" tint="none">
                <RiMapPinFill className="h-4 w-4 text-primary" />
                {garden.location}
              </Badge>
            </div>

            {showDescription && (
              <p className="text-sm text-slate-600 line-clamp-3 flex-1">{garden.description}</p>
            )}

            {showOperators && (
              <div className="flex items-center gap-2 mt-auto">
                <RiMapPinUserFill className="h-4 w-4 text-slate-400" />
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  {garden.operators.slice(0, 2).map((operator) => (
                    <Badge key={operator} variant="outline" tint="none">
                      {formatAddress(operator)}
                    </Badge>
                  ))}
                  {garden.operators.length > 2 && (
                    <span className="text-slate-500">
                      {intl.formatMessage(
                        {
                          id: "app.garden.andOthers",
                          defaultMessage: "and {amount} others",
                        },
                        { amount: garden.operators.length - 2 }
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }
);
GardenCard.displayName = "GardenCard";

export { GardenCard };
