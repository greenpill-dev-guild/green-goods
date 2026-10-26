import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useGardenAssessmentRecords } from "@green-goods/shared/hooks/assessment/useGardenAssessmentRecords";
import { useActions, useGardeners } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { GardenTab } from "@green-goods/shared/hooks/garden/useGardenTabs";
import type { useWorks } from "@green-goods/shared/hooks/work/useWorks";
import type { Address, Garden } from "@green-goods/shared/types/domain";
import { type ComponentProps, useMemo } from "react";
import {
  GardenAssessments,
  GardenGardeners,
  type GardenMember,
  GardenWork,
} from "@/components/Features";
import { GardenPool } from "./Pool";

interface GardenSectionProps {
  garden: Garden;
  tab: GardenTab;
  /** The garden's work, read once by the page for this tab, its rail and its notifications. */
  workRead: ReturnType<typeof useWorks>;
  /** The garden's commitment pool, when it has one. */
  pool: ComponentProps<typeof GardenPool>["pool"] | undefined;
  /** Stewards and owners answer join requests from the Gardeners tab. */
  canManageRequests: boolean;
  /**
   * Where a work's page returns on its Back: the garden's own page by default, or Home when the
   * section is a sheet over it (DL-128).
   */
  workReturnTo?: string;
}

/**
 * The garden page's open section: its work, its pool, its insights or its gardeners. The sheets
 * over Home (Work, Insights and Gardeners) render the same sections, so neither surface forks
 * them.
 */
export function GardenSection({
  garden,
  tab,
  workRead,
  pool,
  canManageRequests,
  workReturnTo,
}: GardenSectionProps) {
  const chainId = DEFAULT_CHAIN_ID;
  // Read only once the reader opens Insights: an EAS read, then two IPFS files
  // per assessment, is too much to spend on a tab most visits never open.
  const { records: assessmentRecords, status: assessmentStatus } = useGardenAssessmentRecords(
    tab === GardenTab.Insights ? garden.id : undefined,
    chainId
  );
  const { data: allGardeners = [] } = useGardeners();
  const { data: actions = [] } = useActions(chainId);
  const members = useMemo<GardenMember[]>(() => {
    const stewardSet = new Set((garden.stewards ?? []).map((addr) => addr.toLowerCase()));
    const gardenerSet = new Set((garden.gardeners ?? []).map((addr) => addr.toLowerCase()));
    const seen = new Set<string>();
    const orderedAddresses: string[] = [];

    for (const list of [garden.stewards ?? [], garden.gardeners ?? []]) {
      for (const address of list) {
        const normalized = address.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        orderedAddresses.push(address);
      }
    }

    return orderedAddresses.map((address) => {
      const normalized = address.toLowerCase();
      const match = allGardeners.find((g) => g.account?.toLowerCase() === normalized);

      return {
        id: match?.id || address,
        account: address as Address,
        username: match?.username || undefined,
        email: match?.email || undefined,
        phone: match?.phone || undefined,
        avatar: match?.avatar || undefined,
        registeredAt: match?.registeredAt ?? null,
        isSteward: stewardSet.has(normalized),
        isGardener: gardenerSet.has(normalized),
      };
    });
  }, [allGardeners, garden]);

  switch (tab) {
    case GardenTab.Work:
      return (
        <GardenWork
          actions={actions}
          works={workRead.works}
          isFetching={workRead.isFetching}
          readState={workRead}
          gardenId={garden.id}
          chainId={chainId}
          onRefresh={workRead.refetch}
          returnTo={workReturnTo}
        />
      );
    case GardenTab.Pool:
      return pool ? <GardenPool pool={pool} /> : null;
    case GardenTab.Insights:
      return (
        <GardenAssessments
          gardenId={garden.id}
          assessmentFetchStatus={assessmentStatus}
          records={assessmentRecords}
          description={garden.description}
        />
      );
    case GardenTab.Gardeners:
      return (
        <GardenGardeners members={members} garden={garden} canManageRequests={canManageRequests} />
      );
  }
}
