import { cn } from "@/utils/cn";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { Card, type CardRootProps } from "./Card";
import {
  RiUser2Fill,
  RiUserCommunityFill,
  RiUserLocationFill,
} from "@remixicon/react";
import { Badge } from "../Badge/Badge";
import { formatAddress } from "@/utils/text";

export const cardVariants = tv({
  base: "relative flex flex-col grow border-0 rounded-lg overflow-clip rounded-lg justify-between p-0 gap-0",
  variants: {
    media: {
      large: "",
      small: "",
    },
  },
  defaultVariants: {
    media: "large",
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
      className,
      selected,
      garden,
      showOperators = false,
      showDescription = true,
      showBanner = true,
      ...props
    },
    ref
  ) => {
    const classes = cardVariants({ media, class: className });
    return (
      <Card ref={ref} className={cn(classes, selected && "")} {...props}>
        <img
          src={garden.bannerImage}
          alt={garden.description}
          className={cn(
            media === "large" ? "h-55" : "max-h-26",
            "object-cover image-lut z-1",
            !showBanner && "hidden"
          )}
        />
        <div
          data-selected={selected}
          className={cn(
            "p-5 flex flex-col gap-2 border border-border rounded-lg transition-all duration-400",
            showBanner && "border-t-0"
          )}
        >
          <div className="flex flex-col gap-2">
            <div
              className={cn(
                "absolute top-0 left-0 right-0 bottom-0 w-full h-full border-2 border-primary/50 rounded-lg opacity-0 transition-opacity",
                selected && "opacity-100"
              )}
            />
            <h5
              className={cn(
                "flex items-center text-xl font-medium transition-colors",
                selected && "text-primary"
              )}
            >
              {garden.name}
            </h5>
            <div className="flex flex-row gap-1">
              <Badge variant="outline" tint="none">
                <RiUserCommunityFill className="w-3.5 text-primary mx-1" />
                {garden.operators.length} Gardeners
              </Badge>
              <Badge variant="outline" tint="none">
                <RiUserLocationFill className="w-3.5 text-primary mx-1" />
                {garden.location}
              </Badge>
            </div>
            {showOperators && (
              <>
                <div className="text-xs text-slate-700 uppercase">
                  Operators
                </div>
                <div className="flex flex-row gap-1 flex-wrap">
                  <>
                    {garden.operators.slice(0, 2).map((operator) => (
                      <Badge key={operator} variant="outline" tint="none">
                        <RiUser2Fill className="w-3.5 text-primary mx-1" />
                        {formatAddress(operator)}
                      </Badge>
                    ))}
                    {garden.operators.length > 2 && (
                      <Badge key={"others"} variant="outline" tint="none">
                        <RiUser2Fill className="w-3.5 text-primary mx-1" />
                        and {garden.operators.length - 2} others
                      </Badge>
                    )}
                  </>
                </div>
              </>
            )}
          </div>
          {showDescription && (
            <div className="text-sm text-slate-500">{garden.description}</div>
          )}
        </div>
      </Card>
    );
  }
);
GardenCard.displayName = "GardenCard";

export { GardenCard };
