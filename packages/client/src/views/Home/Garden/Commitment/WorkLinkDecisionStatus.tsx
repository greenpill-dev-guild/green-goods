import { cn } from "@green-goods/shared/utils/styles/cn";
import type { WorkLinkDecisionState } from "@green-goods/shared/commitment-pooling";
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiRefreshLine,
  RiTimeLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";

import { pwaStatusStyles, type PwaStatusTone } from "@/components/Pwa/statusStyles";

export type { WorkLinkDecisionState };

const PRESENTATION: Record<
  WorkLinkDecisionState,
  { tone: PwaStatusTone; Icon: typeof RiTimeLine; messageId: string }
> = {
  awaitingApproval: {
    tone: "information",
    Icon: RiTimeLine,
    messageId: "app.commitment.work.awaitingApproval",
  },
  readyToReconcile: {
    tone: "warning",
    Icon: RiRefreshLine,
    messageId: "app.commitment.work.readyToReconcile",
  },
  needsFreshReview: {
    tone: "warning",
    Icon: RiErrorWarningLine,
    messageId: "app.commitment.work.needsFreshReview",
  },
  counted: {
    tone: "success",
    Icon: RiCheckboxCircleLine,
    messageId: "app.commitment.work.counted",
  },
  unavailable: {
    tone: "neutral",
    Icon: RiLoader4Line,
    messageId: "app.commitment.work.unavailable",
  },
};

/** Text and icon make the Work-link decision legible without relying on color. */
export function WorkLinkDecisionStatus({
  state,
  id,
}: {
  state: WorkLinkDecisionState;
  id?: string;
}) {
  const { formatMessage } = useIntl();
  const { tone, Icon, messageId } = PRESENTATION[state];
  const styles = pwaStatusStyles[tone];

  return (
    <p
      id={id}
      className={cn(
        "mt-1 flex items-center gap-1 text-xs",
        styles.text,
        state === "unavailable" && "italic"
      )}
      role="status"
      aria-live="polite"
      data-work-link-state={state}
    >
      <Icon className={cn("h-4 w-4 shrink-0", styles.icon)} aria-hidden="true" />
      <span>{formatMessage({ id: messageId })}</span>
    </p>
  );
}
