import { ItemRow, ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useCommitmentJobs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import { useYourWorkOnPhone } from "@green-goods/shared/hooks/work/useYourWorkOnPhone";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { findActionByUID } from "@green-goods/shared/utils/action/parsers";
import { RiErrorWarningLine, RiRefreshLine, RiTaskLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { APP_ROUTES } from "@/config/pwaRouting";
import {
  decisionRow,
  draftRow,
  type PendingRow,
  type PendingRowContext,
  proofRow,
  submissionRow,
} from "../WorkDashboard/buildPendingRows";
import { PendingRowCard } from "../WorkDashboard/PendingRowCard";
import { sortPendingRows } from "../WorkDashboard/pendingRows";
import { resolveWorkNavigation } from "../WorkDashboard/workDashboardUtils";
import { JournalSection } from "./JournalSection";

/** How many unfinished items Home shows before Open Your Work (decision 27). */
const CONTINUE_ROWS = 3;

const NO_REVIEW_WORKS = new Map();

/**
 * Continue (PWA Home step 8, DL-127): the reader's own work still on this phone in the active
 * garden's scope, the rows Your Work › Pending lists first (DL-061), at most three, with Open
 * Your Work for the rest. It lists what the Your Work badge counts (DL-129). Rows open what the
 * sheet's rows open; Discard stays in Your Work.
 */
export function Continue() {
  const intl = useIntl();
  const navigate = useNavigateToTop();
  const isOnline = useOnlineStatus();
  const onPhone = useYourWorkOnPhone();
  const { sendsFromTap } = useCommitmentJobs({ chainId: DEFAULT_CHAIN_ID });
  const { data: actions = [] } = useActions();
  const openWorkDashboard = useUIStore((state) => state.openWorkDashboard);

  const context: PendingRowContext = {
    intl,
    isOnline,
    // Only whether a row may be discarded reads this, and Home offers no Discard.
    pausedForDataSaver: false,
    sendsFromTap,
    actionTitle: (actionUID) => findActionByUID(actions, actionUID)?.title,
    isLinked: onPhone.isLinked,
  };
  const rows = sortPendingRows([
    ...onPhone.submissions.map((work) => submissionRow(work, true, context)),
    ...onPhone.decisions.map((work) => decisionRow(work, onPhone.decisionFor(work.id), context)),
    ...onPhone.drafts.map(draftRow),
    ...onPhone.proofs.map((proof) => proofRow(proof, context)),
  ]);
  const shown = rows.slice(0, CONTINUE_ROWS);
  // A read still running or failed speaks only when there is nothing to show.
  const isLoading = shown.length === 0 && onPhone.isLoading;
  const failed = shown.length === 0 && !isLoading && onPhone.isError;

  const open = (row: PendingRow) => {
    switch (row.type) {
      case "draft":
        return navigate(`${APP_ROUTES.garden}?draftId=${row.draft.id}`);
      case "proof": {
        const { garden, commitmentId, source } = row.proof;
        if (!garden) return;
        const promise = `/home/${garden}/commitments/${commitmentId.toString()}`;
        // A draft picks up where it was left; queued proof shows where it stands.
        return navigate(source === "draft" ? `${promise}/proof` : promise);
      }
      default: {
        const target = resolveWorkNavigation(row.work, NO_REVIEW_WORKS);
        if (!target) return;
        return navigate(`/home/${target.gardenId}/work/${target.workId}`, {
          state: { from: "home", returnTo: APP_ROUTES.home },
        });
      }
    }
  };

  const message = (id: string) => intl.formatMessage({ id });

  return (
    <JournalSection
      data-component="HomeContinue"
      title={message("app.home.continue.title")}
      action={{
        label: message("app.workDashboard.openButton"),
        onClick: () => openWorkDashboard("pending"),
      }}
      busy={isLoading}
    >
      {isLoading ? (
        <li>
          <ItemRowSkeleton edge="info" />
        </li>
      ) : failed ? (
        <li>
          <ItemRow
            lead={{ kind: "icon", icon: <RiErrorWarningLine aria-hidden="true" /> }}
            title={message("app.workDashboard.error.title")}
            details={[message("app.home.continue.error.detail")]}
            action={
              // The queue is on this phone, so trying it again needs no connection.
              !isOnline && !onPhone.queueUnreadable ? undefined : (
                <IconButton
                  onClick={onPhone.refetch}
                  aria-label={message("app.common.tryAgain")}
                  icon={<RiRefreshLine aria-hidden="true" />}
                />
              )
            }
          />
        </li>
      ) : shown.length === 0 ? (
        <li>
          <ItemRow
            lead={{ kind: "icon", icon: <RiTaskLine aria-hidden="true" /> }}
            title={message("app.home.continue.empty.title")}
            details={[message("app.home.continue.empty.detail")]}
          />
        </li>
      ) : (
        shown.map((row) => (
          <li key={row.id}>
            <PendingRowCard
              row={row}
              actionTitle={
                row.type === "draft" && row.draft.actionUID !== null
                  ? findActionByUID(actions, row.draft.actionUID)?.title
                  : undefined
              }
              onOpen={() => open(row)}
            />
          </li>
        ))
      )}
    </JournalSection>
  );
}
