import { RiExternalLinkLine, RiLeafFill, RiSparklingLine } from "@remixicon/react";
import React from "react";
import { Card } from "@/components/UI/Card/Card";
import { Badge as UIBadge } from "@/components/UI/Badge/Badge";
import { Button } from "@/components/UI/Button";
import type { Badge } from "@/modules/badges";

export const GreenpillBadgeCard: React.FC<{
  badge?: Badge;
  onMint?: () => void;
}> = ({ badge, onMint }) => {
  const state = badge?.state ?? "unknown";
  const owned = Boolean(badge?.owned);

  const stateLabel = state === "green" ? "Green" : state === "red" ? "Red" : state;
  const image = badge?.images?.large || "/images/app-mock.png";

  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UIBadge
            variant="pill"
            tint={state === "green" ? "tertiary" : state === "red" ? "destructive" : "muted"}
          >
            {stateLabel}
          </UIBadge>
          <h6 className="font-semibold">Greenpill</h6>
        </div>
        {owned && <RiLeafFill className="w-4 text-emerald-600" />}
      </div>

      <div className="rounded-xl overflow-hidden bg-slate-50 w-full aspect-[16/9]">
        <img src={image} alt="Greenpill badge" className="w-full h-full object-cover" />
      </div>

      {badge?.progress && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Impact</span>
            <span>
              {badge.progress.current} / {badge.progress.target} {badge.progress.unit}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{
                width: `${Math.min(100, Math.round((badge.progress.current / badge.progress.target) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {!owned && (
          <Button
            size="small"
            onClick={onMint}
            leadingIcon={<RiSparklingLine className="w-4" />}
            label="Mint Greenpill"
          />
        )}
        {badge?.details?.howToUrl && (
          <a href={badge.details.howToUrl} target="_blank" rel="noreferrer">
            <Button
              mode="ghost"
              size="small"
              leadingIcon={<RiExternalLinkLine className="w-4" />}
              label="How to earn IPs"
            />
          </a>
        )}
      </div>
    </Card>
  );
};
