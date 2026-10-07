import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useCommitmentJobs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import {
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

import { AppSheet, type AppSheetTab } from "@/components/Sheets/AppSheet";
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
 */
export const CommitmentsSheet: React.FC<CommitmentsSheetProps> = ({ isOpen, onClose }) => {
  const { formatMessage } = useIntl();
  const returnState = useUIStore((state) => state.commitmentsSheetReturnState);
  const [activeTab, setActiveTab] = useState<CommitmentsDashboardReturnState["tab"]>(
    returnState?.tab ?? "live"
  );
  const [direction, setDirection] = useState<CommitmentsDirectionFilter>(
    returnState?.direction ?? "all"
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const restoredScroll = useRef(false);
  const chainId = DEFAULT_CHAIN_ID;
  const viewer = usePrimaryAddress();

  const inbox = useCommitmentsInbox({ chainId, viewer: viewer ?? undefined });
  const toConfirm = useCommitmentsToConfirm({ chainId, viewer: viewer ?? undefined });
  const { pools } = useCommitmentPools({ chainId });
  const { data: gardens = [] } = useGardens();
  const { series } = useCommitmentSeries({ chainId, holder: viewer ?? undefined });
  const { sendsFromTap } = useCommitmentJobs({ chainId });
  const dashboardNavigation = useDashboardNavigation();

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
          tab: activeTab,
          direction,
          scrollTop:
            contentRef.current?.querySelector<HTMLElement>(".overflow-y-auto")?.scrollTop ?? 0,
        },
        `/home/${canonical}/commitments/${commitmentId.toString()}`
      );
      onClose();
    },
    [onClose, dashboardNavigation, gardens, activeTab, direction]
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
            count: toConfirm.count,
          },
        ]
      : []),
  ];

  // The sheet stays mounted, so a steward who loses the role (or switches
  // account) while To confirm is selected would reopen it with a tab that no
  // longer exists and no panel under it. Fall back to the tab that always does.
  const selectedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : "live";

  useLayoutEffect(() => {
    if (!isOpen || !returnState || restoredScroll.current || selectedTab !== returnState.tab)
      return;
    if (direction !== returnState.direction) {
      restoredScroll.current = true;
      return;
    }
    const content = contentRef.current;
    if (!content) return;
    const restore = () => {
      const scroller = content.querySelector<HTMLElement>(".overflow-y-auto");
      if (!scroller) return;
      scroller.scrollTop = returnState.scrollTop;
      if (scroller.scrollTop >= returnState.scrollTop) {
        restoredScroll.current = true;
        observer.disconnect();
      }
    };
    const observer = new MutationObserver(restore);
    observer.observe(content, { childList: true, subtree: true });
    restore();
    return () => observer.disconnect();
  }, [isOpen, returnState, selectedTab, direction]);

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={() => {
        dashboardNavigation.clear();
        onClose();
      }}
      header={{
        title: formatMessage({ id: "app.commitments.title" }),
        description: formatMessage({ id: "app.commitments.subtitle" }),
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
            inbox={inbox}
            pools={pools}
            gardens={gardens}
            sendsFromTap={sendsFromTap}
            direction={direction}
            onDirectionChange={setDirection}
            onOpenCommitment={openCommitment}
          />
        )}
        {selectedTab === "over-time" && (
          <OverTimeTab
            inbox={inbox}
            pools={pools}
            gardens={gardens}
            series={series}
            onOpenCommitment={openCommitment}
          />
        )}
        {selectedTab === "to-confirm" && toConfirm.isSteward && (
          <ToConfirmTab toConfirm={toConfirm} onOpenCommitment={openCommitment} />
        )}
      </div>
    </AppSheet>
  );
};
