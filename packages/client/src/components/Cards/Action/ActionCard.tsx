import { type Action, ActionBannerFallback, cn } from "@green-goods/shared";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { ImageWithFallback } from "../../Display/Image/ImageWithFallback";
import { Card, type CardRootProps } from "../Base/Card";

export const cardVariants = tv({
  base: "relative flex flex-col grow border-0 rounded-lg overflow-clip rounded-b-lg justify-between p-0 gap-0",
  variants: {
    media: {
      large: "",
      small: "",
    },
    height: {
      home: "",
      selection: "h-[13.25rem]",
      default: "h-auto",
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
    const mediaHeightClasses = media === "small" ? "h-24" : "h-26 @[300px]:h-32 @[400px]:h-40";

    return (
      <Card
        ref={ref}
        data-testid="action-card"
        className={cn(
          classes,
          "@container tap-feedback transition-all duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]"
        )}
        {...props}
      >
        <div className={cn("relative w-full", mediaHeightClasses)}>
          <ImageWithFallback
            src={action.media[0]}
            alt={action.description}
            className={cn("w-full object-cover image-lut z-1", mediaHeightClasses)}
            fallbackClassName={cn("w-full", mediaHeightClasses)}
            backgroundFallback={
              <ActionBannerFallback domain={action.domain} title={action.title} />
            }
          />
        </div>
        <div
          data-selected={selected}
          className="flex flex-1 flex-col gap-2 rounded-b-lg border border-t-0 border-border p-3 transition-all duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] @[300px]:p-4 @[400px]:p-5"
        >
          <h5
            className={cn(
              "min-w-0 truncate text-label-md font-semibold",
              selected && "text-primary"
            )}
            title={action.title}
          >
            {action.title}
          </h5>
          <div className="line-clamp-3 h-[3.75rem] text-sm leading-5 text-text-sub-600">
            {action.mediaInfo?.description}
          </div>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-lg border-[3px] border-primary opacity-0 status-transition z-10 pointer-events-none",
            selected && "opacity-100"
          )}
        />
      </Card>
    );
  }
);
ActionCard.displayName = "ActionCard";

export { ActionCard };
