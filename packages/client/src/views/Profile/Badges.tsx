import { RiMedal2Line } from "@remixicon/react";
import React from "react";
import { GreenpillBadgeCard } from "@/components/UI/Badge/GreenpillBadgeCard";
import { useBadges } from "@/providers/badges";

export const ProfileBadges: React.FC = () => {
  const { greenpill, isLoading } = useBadges();

  function handleMint() {
    window.open("https://www.atlantisp2p.com/greenpillnft", "_blank");
  }

  return (
    <div className="flex flex-col gap-3">
      <h6 className="flex items-center gap-2">
        <RiMedal2Line className="w-4" /> Badges
      </h6>
      {isLoading ? (
        <div className="text-sm text-slate-600">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <GreenpillBadgeCard badge={greenpill} onMint={handleMint} />
        </div>
      )}
    </div>
  );
};
