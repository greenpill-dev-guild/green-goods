import * as React from "react";
import { cn } from "@green-goods/shared/utils";
import { Card } from "../Base/Card";
import { cardVariants as gardenCardVariants, type GardenCardVariantProps } from "./GardenCard";

type GardenCardSkeletonProps = GardenCardVariantProps & {
  showBanner?: boolean;
};

export const GardenCardSkeleton: React.FC<GardenCardSkeletonProps> = ({
  media = "large",
  height = "home",
  showBanner = true,
}) => {
  const classes = gardenCardVariants({ media, height });

  return (
    <Card className={cn(classes)}>
      {showBanner && <div className={cn(media === "large" ? "h-40" : "h-26", "w-full skeleton")} />}
      <div
        className={cn(
          "p-5 flex flex-col gap-2 border border-border rounded-lg transition-all duration-400 flex-1",
          showBanner && "border-t-0 rounded-t-0"
        )}
      >
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-6 w-40 rounded skeleton" />
          <div className="flex flex-row gap-2">
            <div className="h-5 w-32 rounded skeleton" />
            <div className="h-5 w-24 rounded skeleton" />
          </div>

          <div className="space-y-2 mt-2">
            <div className="h-4 w-full rounded skeleton" />
            <div className="h-4 w-11/12 rounded skeleton" />
            <div className="h-4 w-4/5 rounded skeleton" />
          </div>

          <div className="mt-auto flex items-center gap-2">
            <div className="h-5 w-20 rounded skeleton" />
            <div className="h-5 w-20 rounded skeleton" />
            <div className="h-5 w-16 rounded skeleton" />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default GardenCardSkeleton;
