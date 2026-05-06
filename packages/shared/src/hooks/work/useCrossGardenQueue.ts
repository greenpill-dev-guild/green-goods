import { useMemo } from "react";
import type { Work } from "../../types/domain";
import { useGardens } from "../blockchain/useBaseLists";

const STATUS_TIER: Record<string, number> = {
  pending_review: 0,
  pending_assessment: 1,
  pending_mint: 2,
  other: 3,
};

export interface UseCrossGardenQueueResult {
  items: Work[];
  isLoading: boolean;
  gardenCount: number;
}

export function useCrossGardenQueue(): UseCrossGardenQueueResult {
  const { data: gardens = [], isLoading } = useGardens();

  const items = useMemo(() => {
    const mergedWorks = gardens.flatMap((garden) => garden.works);
    const sortedWorks = [...mergedWorks].sort((a, b) => {
      const statusTierA = STATUS_TIER[a.status as string] ?? STATUS_TIER.other;
      const statusTierB = STATUS_TIER[b.status as string] ?? STATUS_TIER.other;

      if (statusTierA !== statusTierB) {
        return statusTierA - statusTierB;
      }

      if (a.createdAt !== b.createdAt) {
        return a.createdAt - b.createdAt;
      }

      return a.id.localeCompare(b.id);
    });

    const seen = new Set<string>();
    const deduplicated: Work[] = [];
    for (const work of sortedWorks) {
      if (seen.has(work.id)) continue;
      seen.add(work.id);
      deduplicated.push(work);
    }

    return deduplicated;
  }, [gardens]);

  return {
    items,
    isLoading,
    gardenCount: gardens.length,
  };
}
