import { RiCamera3Line } from "@remixicon/react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@/utils/cn";
import { Card, type CardRootProps } from "./Card";

export const cardVariants = tv({
  base: "relative flex flex-col grow border-0 rounded-lg overflow-clip rounded-b-lg justify-between p-0 gap-0 h-max-content", // Fixed height to match garden cards
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

export type ActionCardVariantProps = VariantProps<typeof cardVariants>;

export type ActionCardRootProps = React.HTMLAttributes<HTMLDivElement> &
  ActionCardVariantProps &
  CardRootProps & { action: Action; selected: boolean };

const ActionCard = React.forwardRef<HTMLDivElement, ActionCardRootProps>(
  ({ media, className, selected, action, ...props }, ref) => {
    const classes = cardVariants({ media, class: className });
    return (
      <Card ref={ref} className={cn(classes)} {...props}>
        <img
          src={action.media[0]}
          alt={action.description}
          className={cn(
            media === "large" ? "h-40" : "h-26", // Consistent with garden cards
            "object-cover image-lut z-1"
          )}
        />
        <div
          data-selected={selected}
          className="p-5 flex flex-col gap-2 border border-t-0 rounded-b-lg border-border transition-all duration-400 flex-1"
        >
          <div className="flex flex-row gap-2">
            <div
              className={cn(
                "absolute top-0 left-0 right-0 bottom-0 w-full h-full border-2 border-primary/50 rounded-lg opacity-0 transition-opacity",
                selected && "opacity-100"
              )}
            />
            <h5 className={cn("flex items-center text-xl font-medium", selected && "text-primary")}>
              <RiCamera3Line
                className={cn("w-8 inline-flex mr-2", selected && "animate-spring-bump")}
              />
              {action.title}
            </h5>
          </div>
          <div className="text-sm text-slate-500 h-24 flex-1">{action.mediaInfo?.description}</div>
        </div>
      </Card>
    );
  }
);
ActionCard.displayName = "ActionCard";

export { ActionCard };
