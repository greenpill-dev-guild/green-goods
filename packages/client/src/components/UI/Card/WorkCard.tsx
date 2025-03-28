import { cn } from "@/utils/cn";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { Card, type CardRootProps } from "./Card";
import { Button } from "../Button";

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

export type ActionCardVariantProps = VariantProps<typeof cardVariants>;

export type ActionCardRootProps = React.HTMLAttributes<HTMLDivElement> &
  ActionCardVariantProps &
  CardRootProps & { work: Work; selected: boolean };

const WorkCard = React.forwardRef<HTMLDivElement, ActionCardRootProps>(
  ({ media, className, selected, work, ...props }, ref) => {
    const classes = cardVariants({ media, class: className });
    return (
      <Card ref={ref} className={cn(classes)} {...props}>
        <img
          src={work.media[0]}
          alt={work.feedback}
          className={cn(
            media === "large" ? "h-auto aspect-video" : "max-h-26",
            "object-cover image-lut z-1"
          )}
        />
        <div
          data-selected={selected}
          className="p-5 flex flex-col gap-2 border border-t-0 rounded-b-lg border-border transition-all duration-400"
        >
          <div className="flex flex-row gap-2">
            <div
              className={cn(
                "absolute top-0 left-0 right-0 bottom-0 w-full h-full border-2 border-primary/50 rounded-lg opacity-0 transition-opacity",
                selected && "opacity-100"
              )}
            />
            <h6
              className={cn(
                "flex items-center text-xl font-medium",
                selected && "text-primary"
              )}
            >
              {work.title}
            </h6>
          </div>
          <div className="text-sm text-slate-500">{work.feedback}</div>
          <div className="border-t border-border" />
          <div className="flex flex-row gap-2 items-center">
            <div className="text-slate-500 text-xs">
              Published on {new Date(work.createdAt).toLocaleString()}
            </div>
            <Button label="View Details" size="small" />
          </div>
        </div>
      </Card>
    );
  }
);
WorkCard.displayName = "WorkCard";

export { WorkCard };
