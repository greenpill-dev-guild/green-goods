import * as React from "react";
import { cn } from "@/utils/styles/cn";
import { Card } from "./Card";
import { cardVariants as actionCardVariants, type ActionCardVariantProps } from "./ActionCard";

type ActionCardSkeletonProps = ActionCardVariantProps;

export const ActionCardSkeleton: React.FC<ActionCardSkeletonProps> = ({
  media = "small",
  height = "selection",
}) => {
  const classes = actionCardVariants({ media, height });

  return (
    <Card className={cn(classes)}>
      <div
        className={cn(media === "large" ? "h-40" : "h-26", "w-full bg-slate-200 animate-pulse")}
      />
      <div className="p-5 flex flex-col gap-2 border border-t-0 rounded-b-lg border-border transition-all duration-400 flex-1">
        <div className="h-6 w-44 bg-slate-200 rounded animate-pulse" />
        <div className="space-y-2 mt-1">
          <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-10/12 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-8/12 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    </Card>
  );
};

export default ActionCardSkeleton;
