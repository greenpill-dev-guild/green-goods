import { cn } from "@green-goods/shared";
import * as React from "react";
import { Card } from "../Base/Card";
import { type ActionCardVariantProps, cardVariants as actionCardVariants } from "./ActionCard";

type ActionCardSkeletonProps = ActionCardVariantProps;

export const ActionCardSkeleton: React.FC<ActionCardSkeletonProps> = ({
  media = "small",
  height = "selection",
}) => {
  const classes = actionCardVariants({ media, height });
  const mediaHeightClass = media === "large" ? "h-40" : "h-24";

  return (
    <Card className={cn(classes)}>
      <div className={cn(mediaHeightClass, "w-full skeleton")} />
      <div className="flex flex-1 flex-col gap-2 rounded-b-lg border border-t-0 border-border p-3 transition-all duration-400 @[300px]:p-4 @[400px]:p-5">
        <div className="h-6 w-44 rounded skeleton" />
        <div className="mt-1 space-y-2">
          <div className="h-4 w-full rounded skeleton" />
          <div className="h-4 w-10/12 rounded skeleton" />
          <div className="h-4 w-8/12 rounded skeleton" />
        </div>
      </div>
    </Card>
  );
};
