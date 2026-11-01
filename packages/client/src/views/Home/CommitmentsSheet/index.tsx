import { restoreDashboardScroll } from "@/components/Navigation/restoreDashboardScroll";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { usePoolCycleRail } from "@green-goods/shared/hooks/client-ui/pool/useGardenPoolController";
import { useCommitmentJobs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import {
  type CommitmentCycleRecord,
  useCommitmentPools,
  useCommitmentSeries,
  useCommitmentsInbox,
  useCommitmentsToConfirm,
} from "@green-goods/shared/commitment-pooling";
import { RiArchiveLine, RiPulseLine, RiShieldCheckLine } from "@remixicon/react";
import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useDashboardNavigation } from "@green-goods/shared/hooks/client-ui/useDashboardNavigation";
import {
  useUIStore,
  type CommitmentsDashboardReturnState,
  type CommitmentsDirectionFilter,
} from "@green-goods/shared/stores/useUIStore";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";

import { CycleDetailsSheet, CycleRail } from "@/components/Features/Commitments";
import { AppSheet, type AppSheetTab } from "@/components/Sheets/AppSheet";
import { listedToConfirmCount } from "./grouping";
import { LiveTab } from "./LiveTab";
import { OverTimeTab } from "./OverTimeTab";
import { ToConfirmTab } from "./ToConfirmTab";

interface CommitmentsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The member's commitments, in their own sheet.
 *
 * It is not a wallet tab. The wallet holds balances, which are one number each
 * with no lifecycle and nothing waiting on anyone; a commitment is a
 * relationship that moves, needs an act, and belongs to a garden.
 *
 * Tabs split by tense rather than by object, so the container word and the
 * object words are never the same: "Commitments" holds "Live" and "History".
 * A steward gets a third, "To confirm", for what reaches them through their
 * garden's Hat rather than through their own account.
 *
 * With an active garden the sheet shows that garden's promises only and names
 * it under its title (DL-129), and its seasons and campaigns lead each tab as
 * the old Pool tab's rail: a tap filters the list, and the ⓘ opens the
 * details, whose Show Its Promises filters it too (decision 32).
 */
export const CommitmentsSheet: React.FC<CommitmentsSheetProps> = ({ isOpen, onClose }) => {
  const { formatMessage } = useIntl();
  const returnState = useUIStore((state) => state.commitmentsSheetReturnState);
  const opening = useUIStore((state) => state.commitmentsSheetOpening);
  const [activeTab, setActiveTab] = useState<CommitmentsDashboardReturnState["tab"]>(
    returnState?.tab ?? opening?.tab ?? "live"
  );
  const [direction, setDirection] = useState<CommitmentsDirectionFilter>(
    returnState?.direction ?? "all"
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const restoredScroll = useRef(false);
  const chainId = DEFAULT_CHAIN_ID;
  const viewer = usePrimaryAddress();
  const { gardenId, garden: activeGarden, inScope } = useActiveGarden();

  const inbox = useCommitmentsInbox({ chainId, viewer: viewer ?? undefined, inScope });
  const toConfirm = useCommitmentsToConfirm({ chainId, viewer: viewer ?? undefined, inScope });
  const { pools } = useCommitmentPools({ chainId });
  const { data: gardens = [] } = useGardens();
  const { series } = useCommitmentSeries({ chainId, holder: viewer ?? undefined });
  const { sendsFromTap } = useCommitmentJobs({ chainId });
  const dashboardNavigation = useDashboardNavigation();

  // The garden's pool is its first, as its Pool tab reads it.
  const gardenPool = gardenId
    ? pools.find((pool) => compareAddresses(pool.garden, gardenId))
    : undefined;
  // Back from a promise restores the filter as it was left, even when it was cleared.
  const initialCycleId = returnState ? returnState.cycleId : opening?.cycleId;
  const rail = usePoolCycleRail({
    chainId,
    poolId: gardenPool?.poolId ?? null,
    initialCycleId: initialCycleId ? BigInt(initialCycleId) : null,
  });
  // The last season or campaign stays drawn while its details sheet closes.
  const [details, setDetails] = useState<{ cycle: CommitmentCycleRecord | null; open: boolean }>({
    cycle: null,
    open: false,
  });
  const cycleRail = (
    <CycleRail
      cycles={rail.cycles}
      selectedCycleId={rail.selectedCycleId}
      onSelect={rail.setSelectedCycleId}
      onShowDetails={(cycle) => setDetails({ cycle, open: true })}
    />
  );
  // A series belongs to its pool's garden, like the promises it offers.
  const gardenSeries = series.filter((entry) =>
    inScope([pools.find((pool) => pool.poolId === entry.poolId)?.garden])
  );

  const tabs: AppSheetTab[] = [
    {
      id: "live",
      label: formatMessage({ id: "app.commitments.tab.live" }),
      icon: <RiPulseLine />,
      count: inbox.liveActCount,
    },
    {
      id: "over-time",
      label: formatMessage({ id: "app.commitments.tab.overTime" }),
      icon: <RiArchiveLine />,
      count: inbox.settledActCount,
    },
    ...(toConfirm.isSteward
      ? [
          {
            id: "to-confirm",
            label: formatMessage({ id: "app.commitments.tab.toConfirm" }),
            icon: <RiShieldCheckLine />,
            count: listedToConfirmCount(toConfirm),
          },
        ]
      : []),
  ];

  // The sheet stays mounted, so a steward who loses the role (or switches
  // account) while To confirm is selected would reopen it with a tab that no
  // longer exists and no panel under it. Fall back to the tab that always does.
  const selectedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : "live";

  // The sheet sits beside the garden outlet rather than above a route of its
  // own, so opening a commitment has to put the sheet away first or it would
  // stay drawn over the very screen it just opened.
  const openCommitment = useCallback(
    (gardenAddress: string, commitmentId: bigint) => {
      // The pool names its garden in lowercase; the route is happier with the
      // garden's own id when the list has it.
      const canonical =
        gardens.find((garden) => garden.id.toLowerCase() === gardenAddress.toLowerCase())?.id ??
        gardenAddress;
      dashboardNavigation.leave(
        {
          kind: "commitments",
          tab: selectedTab,
          direction,
          cycleId: rail.selectedCycleId?.toString(),
          scrollTop:
            contentRef.current?.querySelector<HTMLElement>(".overflow-y-auto")?.scrollTop ?? 0,
        },
        `/home/${canonical}/commitments/${commitmentId.toString()}`
      );
    },
    [dashboardNavigation, gardens, selectedTab, direction, rail.selectedCycleId]
  );

  useLayoutEffect(() => {
    if (!isOpen || !returnState || restoredScroll.current || selectedTab !== returnState.tab)
      return;
    if (direction !== returnState.direction) {
      restoredScroll.current = true;
      return;
    }
    const content = contentRef.current;
    if (!content) return;
    return restoreDashboardScroll(
      content,
      () => content.querySelector<HTMLElement>(".overflow-y-auto"),
      returnState.scrollTop,
      () => {
        restoredScroll.current = true;
      }
    );
  }, [isOpen, returnState, selectedTab, direction]);

  // Every tab lists promises, so the rail filters whichever is shown. The
  // sheet names the active garden once, so its rows need no garden headings.
  const listProps = {
    lead: cycleRail,
    cycleId: rail.selectedCycleId,
    gardenHeadings: !gardenId,
  };

  return (
    <>
      <AppSheet
        isOpen={isOpen}
        covered={dashboardNavigation.isDashboardCovered}
        entryMotion={returnState ? "instant" : "slide"}
        viewTransitionName="promises-dashboard"
        onClose={() => {
          dashboardNavigation.clear();
          onClose();
        }}
        header={{
          title: formatMessage({ id: "app.commitments.title" }),
          // In the active garden the line under the title names it, in the description's place.
          description: activeGarden
            ? formatMessage({ id: "app.common.inGarden" }, { garden: activeGarden.name })
            : formatMessage({ id: "app.commitments.subtitle" }),
        }}
        tabs={tabs}
        activeTab={selectedTab}
        onTabChange={(tab) => setActiveTab(tab as CommitmentsDashboardReturnState["tab"])}
        contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
        size="full"
      >
        <div ref={contentRef} className="flex min-h-0 flex-1 flex-col">
          {selectedTab === "live" && (
            <LiveTab
              {...listProps}
              inbox={inbox}
              pools={pools}
              gardens={gardens}
              sendsFromTap={sendsFromTap}
              direction={direction}
              onDirectionChange={setDirection}
              onOpenCommitment={openCommitment}
              covered={dashboardNavigation.isDashboardCovered}
            />
          )}
          {selectedTab === "over-time" && (
            <OverTimeTab
              {...listProps}
              inbox={inbox}
              pools={pools}
              gardens={gardens}
              series={gardenSeries}
              onOpenCommitment={openCommitment}
            />
          )}
          {selectedTab === "to-confirm" && toConfirm.isSteward && (
            <ToConfirmTab {...listProps} toConfirm={toConfirm} onOpenCommitment={openCommitment} />
          )}
        </div>
      </AppSheet>
      <CycleDetailsSheet
        cycle={details.cycle}
        isOpen={details.open}
        onClose={() => setDetails((current) => ({ ...current, open: false }))}
        onShowPromises={(cycleId) => {
          rail.setSelectedCycleId(cycleId);
          setDetails((current) => ({ ...current, open: false }));
        }}
      />
    </>
  );
};
