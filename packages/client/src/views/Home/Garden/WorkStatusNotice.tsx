import { Alert } from "@green-goods/shared/components/Alert";
import type { Work } from "@green-goods/shared/types/domain";
import {
  RiAlertLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiRefreshLine,
  RiTimeLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";

import {
  blockedReasonMessage,
  queuedWorkDetailMessage,
  readQueuedWorkState,
} from "@/components/Cards/Work/queuedWorkCopy";
import { workUploadGroup } from "@/components/Cards/Work/workUploadGroup";

const ICON = "h-5 w-5 flex-shrink-0";

const ACTION_ENDED_REASONS = new Set(["NotActiveAction", "ActionExpired"]);

interface NoticeCopy {
  variant: "info" | "warning";
  icon: ReactNode;
  title: MessageDescriptor;
  body: MessageDescriptor;
}

/**
 * Why the gardener's own queued work is still on this phone, in the page under
 * its title (D24, D30): the icon and title on one line, then one or two lines
 * on what happens next. The bar below holds only the acts.
 */
export function WorkStatusNotice({ work, isOnline }: { work: Work; isOnline: boolean }) {
  const { formatMessage } = useIntl();
  const state = readQueuedWorkState(work.metadata);
  const copy = ((): NoticeCopy => {
    switch (workUploadGroup(state.submissionState)) {
      case "attention":
        return {
          variant: "warning",
          icon: <RiAlertLine className={ICON} aria-hidden="true" />,
          title:
            state.submissionState === "blocked"
              ? blockedReasonMessage(state.blockedReason)
              : (queuedWorkDetailMessage(state) ?? blockedReasonMessage(undefined)),
          body:
            state.blockedReason && ACTION_ENDED_REASONS.has(state.blockedReason)
              ? { id: "app.work.notice.blocked.actionEnded.body" }
              : { id: "app.work.notice.blocked.body" },
        };
      case "failed":
        return {
          variant: "warning",
          icon: <RiErrorWarningLine className={ICON} aria-hidden="true" />,
          title: { id: "app.work.notice.failed.title" },
          body: { id: "app.work.notice.failed.body" },
        };
      case "preparing":
        return {
          variant: "info",
          icon: <RiLoader4Line className={`${ICON} animate-spin`} aria-hidden="true" />,
          title:
            state.submissionState === "photo-pending"
              ? { id: "app.uploads.state.photoPending" }
              : { id: "app.work.notice.preparing.title" },
          body: { id: "app.work.notice.preparing.body" },
        };
      case "sent":
        return state.submissionState === "sending" && isOnline
          ? {
              variant: "info",
              icon: <RiLoader4Line className={`${ICON} animate-spin`} aria-hidden="true" />,
              title: { id: "app.work.notice.sending.title" },
              body: { id: "app.work.notice.sending.body" },
            }
          : {
              variant: "info",
              icon: <RiRefreshLine className={ICON} aria-hidden="true" />,
              title: { id: "app.work.notice.checking.title" },
              body: { id: "app.work.notice.checking.body" },
            };
      default:
        return {
          variant: "info",
          icon: <RiTimeLine className={ICON} aria-hidden="true" />,
          title: { id: "app.work.notice.waiting.title" },
          body: isOnline
            ? { id: "app.work.notice.waiting.body" }
            : { id: "app.home.work.offlineNotice" },
        };
    }
  })();

  return (
    <Alert
      variant={copy.variant}
      layout="stacked"
      icon={copy.icon}
      title={formatMessage(copy.title)}
    >
      <p data-component="WorkStatusNotice" data-state={state.submissionState ?? "waiting"}>
        {formatMessage(copy.body)}
      </p>
    </Alert>
  );
}
