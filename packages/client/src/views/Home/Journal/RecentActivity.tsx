// Command Surface: the garden's newest work on Home (DL-127, decision 23).
import { WorkCardSkeleton } from "@green-goods/shared/components/Cards/WorkCard/WorkCard";
import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import {
  type GardenRecentActivity,
  useGardenRecentActivity,
} from "@green-goods/shared/hooks/garden/useGardenJournal";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { RiInboxLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

import { MinimalWorkCard } from "@/components/Cards";
import { formatSavedAt } from "@/components/Communication/Offline/formatSavedAt";
import { JournalSection } from "./JournalSection";
import { JournalLoadingRows, JournalStateRow } from "./JournalStateRow";

export interface RecentActivityProps {
  gardenId: string;
}

/**
 * Recent Activity: the garden's three newest works as the Work tab's rows, with the Work tab's
 * status pills, the same for every role. A pending row opens the work, where a steward
 * approves it; no row carries a Review control (decision 23). See All opens the garden's Work
 * as a sheet over Home (DL-128), so Home keeps its place.
 */
export function RecentActivity({ gardenId }: RecentActivityProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const navigate = useNavigateToTop();
  const openGardenSheet = useUIStore((state) => state.openGardenSheet);
  const activity = useGardenRecentActivity(gardenId);
  const { state } = activity;

  return (
    <JournalSection
      data-component="RecentActivity"
      title={formatMessage({ id: "app.home.journal.recentActivity" })}
      action={{
        label: formatMessage({ id: "app.home.journal.seeAll" }),
        onClick: () => openGardenSheet("work"),
      }}
      note={
        state.status === "ready" && state.savedAt
          ? formatMessage(
              { id: "app.offline.savedWork" },
              { when: formatSavedAt(intl, state.savedAt) }
            )
          : undefined
      }
      busy={state.status === "loading"}
    >
      <RecentActivityRows
        activity={activity}
        onOpenWork={(workId) =>
          navigate(`/home/${gardenId}/work/${workId}`, {
            state: { from: "home", returnTo: "/home" },
          })
        }
      />
    </JournalSection>
  );
}

function RecentActivityRows({
  activity: { state, actionTitleOf, refetch },
  onOpenWork,
}: {
  activity: GardenRecentActivity;
  onOpenWork: (workId: string) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  switch (state.status) {
    case "loading":
      return (
        <JournalLoadingRows
          label={formatMessage({ id: "app.home.journal.recentActivity.loading" })}
          count={3}
          placeholder={<WorkCardSkeleton />}
        />
      );
    case "error":
      return (
        <JournalStateRow
          kind="error"
          title={formatMessage({ id: "app.home.journal.recentActivity.errorTitle" })}
          onRetry={refetch}
        />
      );
    case "offline":
      return (
        <JournalStateRow
          kind="offline"
          title={formatMessage({ id: "app.home.journal.offlineTitle" })}
        />
      );
    case "empty":
      return (
        <JournalStateRow
          kind="empty"
          icon={<RiInboxLine />}
          title={formatMessage({ id: "app.home.journal.recentActivity.emptyTitle" })}
          detail={formatMessage({ id: "app.home.journal.recentActivity.emptyDetail" })}
        />
      );
    case "ready":
      return state.items.map((work) => (
        <li key={work.id}>
          <MinimalWorkCard
            work={work}
            actionTitle={actionTitleOf(work)}
            variant="detailed"
            onClick={() => onOpenWork(work.id)}
          />
        </li>
      ));
  }
}
