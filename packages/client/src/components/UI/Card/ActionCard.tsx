import { RiCamera3Line } from "@remixicon/react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@green-goods/shared/utils";
import { Card, type CardRootProps } from "./Card";
import { ImageWithFallback } from "../Image/ImageWithFallback";

export const cardVariants = tv({
  base: "relative flex flex-col grow border-0 rounded-lg overflow-clip rounded-b-lg justify-between p-0 gap-0 h-max-content", // Fixed height to match garden cards
  variants: {
    media: {
      large: "",
      small: "",
    },
    height: {
      home: "",
      selection: "h-60",
      default: "",
    },
  },
  defaultVariants: {
    media: "large",
    height: "default",
  },
});

export type ActionCardVariantProps = VariantProps<typeof cardVariants>;

export type ActionCardRootProps = React.HTMLAttributes<HTMLDivElement> &
  ActionCardVariantProps &
  CardRootProps & { action: Action; selected: boolean };

const ActionCard = React.forwardRef<HTMLDivElement, ActionCardRootProps>(
  ({ media, height, className, selected, action, ...props }, ref) => {
    const classes = cardVariants({ media, height, class: className });
    return (
      <Card
        ref={ref}
        className={cn(classes, "tap-feedback transition-all duration-300")}
        {...props}
      >
        <ImageWithFallback
          src={action.media[0]}
          alt={action.description}
          className={cn(
            media === "large" ? "h-40" : "h-26", // Consistent with garden cards
            "w-full object-cover image-lut z-1"
          )}
          fallbackClassName={cn(media === "large" ? "h-40" : "h-26", "w-full")}
        />
        <div
          data-selected={selected}
          className="p-5 flex flex-col gap-2 border border-t-0 rounded-b-lg border-border transition-all duration-400 flex-1"
        >
          <div className="flex flex-row gap-2">
            <div
              className={cn(
                "absolute top-0 left-0 right-0 bottom-0 w-full h-full border-2 border-primary/50 rounded-lg opacity-0 status-transition z-10 pointer-events-none",
                selected && "opacity-100"
              )}
            />
            <h5
              className={cn(
                "flex items-center text-xl font-medium line-clamp-2",
                selected && "text-primary"
              )}
            >
              <RiCamera3Line
                className={cn("w-8 inline-flex mr-2", selected && "animate-spring-bump")}
              />
              {action.title}
            </h5>
          </div>
          <div className="text-sm text-slate-500 h-24 flex-1 line-clamp-3">
            {action.mediaInfo?.description}
          </div>
        </div>
      </Card>
    );
  }
);
ActionCard.displayName = "ActionCard";

export { ActionCard };
