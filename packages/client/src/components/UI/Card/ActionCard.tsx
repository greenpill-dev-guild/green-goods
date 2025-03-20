import { cn } from "@/utils/cn";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { Card, type CardRootProps } from "./Card";
import { RiCamera3Line } from "@remixicon/react";

export const cardVariants = tv({
  base: "flex flex-col grow border rounded-lg border-card-darkergrey overflow-clip rounded-lg text-card-foreground justify-between border-slate-200 p-0 gap-0",
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
          className={cn(media === "large" ? "h-auto aspect-video" : "max-h-26", "object-cover image-lut")} 
        />
        <div
          data-selected={selected}
          className="p-5 flex flex-col gap-2 border-2 border-t-0 rounded-b-lg border-white data-[selected=true]:border-greengoods-selected transition-all duration-400"
        >
          <div className="flex flex-row gap-2">
            <h5 className="flex items-center text-xl font-medium">
              <RiCamera3Line className="w-8 inline-flex mr-2" />
              {action.title}
            </h5>
          </div>
          <div className="text-sm text-slate-500">{action.mediaInfo.description}</div>
        </div>
      </Card>
    );
  }
);
ActionCard.displayName = "ActionCard";

export { ActionCard };
