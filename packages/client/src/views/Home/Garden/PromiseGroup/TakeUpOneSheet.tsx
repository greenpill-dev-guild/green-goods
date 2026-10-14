import { Alert } from "@green-goods/shared/components/Alert";
import type { SheetActionsProps } from "@green-goods/shared/components/Dialog/SheetActions";
import type { GroupTakeUpState } from "@green-goods/shared/hooks/client-ui/pool/usePromiseGroupController";
import { useIntl } from "react-intl";

import { AppSheet } from "@/components/Sheets/AppSheet";

export interface TakeUpOneSheetProps {
  open: boolean;
  onClose: () => void;
  /** A steward-reviewed group asks; an open one takes up. */
  approvalGated: boolean;
  /** The act's own words, the same as the page's bar. */
  actLabelId: string;
  /** The promises' shared name. */
  title: string;
  /** What each one asks, in one line: its units and when it is due. */
  terms: string | null;
  state: GroupTakeUpState;
  /** Take up the copy the app picks now. */
  onTakeUp: () => void;
  /** Take up the copy offered after the first went elsewhere. */
  onTakeUpNext: (copyId: bigint) => void;
  /** Try the same copy again after a send that didn't go through. */
  onRetry: () => void;
  onRefresh: () => void;
}

/**
 * Taking up one promise from a group (PRD-1029 c3, c4): a half sheet that
 * repeats what that one promise asks and says plainly that the app picks
 * which. It can't close while the act is in flight. When somebody got to the
 * chosen one first it asks before choosing another, and when none is left it
 * says so without promising more; a send the chain refused reads as the
 * failed act does everywhere.
 */
export function TakeUpOneSheet({
  open,
  onClose,
  approvalGated,
  actLabelId,
  title,
  terms,
  state,
  onTakeUp,
  onTakeUpNext,
  onRetry,
  onRefresh,
}: TakeUpOneSheetProps) {
  const { formatMessage } = useIntl();
  const inFlight = state.step === "checking" || state.step === "sending";
  const act = formatMessage({ id: actLabelId });
  const back = formatMessage({ id: "app.pool.group.backToGroup" });

  let notice: { variant: "warning" | "error" | "info"; title?: string; body: string } | null = null;
  let actions: SheetActionsProps = {
    primary: { label: act, loading: inFlight, onClick: onTakeUp, testId: "take-up-one" },
    secondary: {
      label: formatMessage({ id: "app.common.cancel" }),
      disabled: inFlight,
      onClick: onClose,
    },
  };
  switch (state.step) {
    case "taken":
      notice = {
        variant: "warning",
        title: formatMessage({ id: "app.pool.group.sheet.taken.title" }),
        body: formatMessage({
          id: approvalGated
            ? "app.pool.group.sheet.taken.bodyAsk"
            : "app.pool.group.sheet.taken.body",
        }),
      };
      actions = {
        primary: {
          label: formatMessage({
            id: approvalGated
              ? "app.pool.group.act.askToTakeUpOne"
              : "app.pool.group.act.takeUpAnother",
          }),
          onClick: () => onTakeUpNext(state.next),
          testId: "take-up-next",
        },
        secondary: { label: back, onClick: onClose },
      };
      break;
    case "none":
      notice = {
        variant: "info",
        title: formatMessage({ id: "app.pool.group.hold.none" }),
        body: formatMessage({ id: "app.pool.group.sheet.none.body" }),
      };
      actions = { primary: { label: back, onClick: onClose } };
      break;
    case "unknown":
      notice = { variant: "warning", body: formatMessage({ id: "app.pool.group.counts.unknown" }) };
      actions = {
        primary: { label: formatMessage({ id: "app.common.refresh" }), onClick: onRefresh },
        secondary: { label: back, onClick: onClose },
      };
      break;
    case "failed":
      notice = { variant: "error", body: formatMessage({ id: "app.pool.group.sheet.failed" }) };
      actions = {
        primary: { label: formatMessage({ id: "app.pool.queued.retry" }), onClick: onRetry },
        secondary: { label: back, onClick: onClose },
      };
      break;
  }

  return (
    <AppSheet
      isOpen={open}
      onClose={onClose}
      preventClose={inFlight}
      size="half"
      header={{
        title: formatMessage({
          id: approvalGated ? "app.pool.group.sheet.titleAsk" : "app.pool.group.sheet.title",
        }),
      }}
      actions={actions}
    >
      <div className="space-y-3" data-component="TakeUpOneSheet" data-step={state.step}>
        <div className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3">
          <p className="line-clamp-2 text-sm font-medium text-text-strong-950" title={title}>
            {title}
          </p>
          {terms ? <p className="mt-0.5 text-xs text-text-sub-600">{terms}</p> : null}
        </div>
        {notice ? (
          <Alert variant={notice.variant} title={notice.title}>
            {notice.body}
          </Alert>
        ) : (
          <p className="text-sm leading-relaxed text-text-sub-600">
            {formatMessage({
              id: approvalGated ? "app.pool.group.sheet.picksAsk" : "app.pool.group.sheet.picks",
            })}
          </p>
        )}
        <p className="min-h-5 text-xs text-text-sub-600" role="status">
          {state.step === "checking" ? formatMessage({ id: "app.pool.group.sheet.checking" }) : ""}
        </p>
      </div>
    </AppSheet>
  );
}
