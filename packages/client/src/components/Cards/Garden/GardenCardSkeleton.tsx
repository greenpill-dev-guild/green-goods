import { cn } from "@green-goods/shared";
import * as React from "react";
import { Card } from "../Base/Card";
import { type GardenCardVariantProps, gardenCardVariants } from "./GardenCard";

type GardenCardSkeletonProps = GardenCardVariantProps & {
  showBanner?: boolean;
  showStats?: boolean;
};

export const GardenCardSkeleton: React.FC<GardenCardSkeletonProps> = ({
  media = "large",
  height = "home",
  showBanner = true,
  showStats = true,
}) => {
  const classes = gardenCardVariants({ media, height });
  const isMinimalSelection = height === "selection" && !showStats;
  const mediaHeightClass =
    isMinimalSelection && media === "small" ? "h-24" : media === "large" ? "h-40" : "h-26";

  return (
    <Card className={cn(classes, isMinimalSelection && "h-[13.25rem]")}>
      {showBanner && <div className={cn(mediaHeightClass, "w-full skeleton")} />}
      <div
        className={cn(
          "p-3 @[300px]:p-4 @[400px]:p-5 flex flex-col gap-2 border border-border rounded-lg transition-all duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] flex-1",
          showBanner && "border-t-0 rounded-t-0"
        )}
      >
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-6 w-40 rounded skeleton" />
          {showStats && (
            <div className="flex flex-row gap-2">
              <div className="h-5 w-32 rounded skeleton" />
              <div className="h-5 w-24 rounded skeleton" />
            </div>
          )}

          <div className={cn("space-y-2", !isMinimalSelection && "mt-2")}>
            <div className="h-4 w-full rounded skeleton" />
            <div className="h-4 w-11/12 rounded skeleton" />
            <div className="h-4 w-4/5 rounded skeleton" />
          </div>

          {showStats && (
            <div className="mt-auto flex items-center gap-2">
              <div className="h-5 w-20 rounded skeleton" />
              <div className="h-5 w-20 rounded skeleton" />
              <div className="h-5 w-16 rounded skeleton" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
