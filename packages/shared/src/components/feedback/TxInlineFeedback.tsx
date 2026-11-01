import { RiAlertLine, RiErrorWarningLine, RiInformationLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

import { cn } from "../../utils/styles/cn";
import { Button } from "../Button";

export type TxInlineFeedbackSeverity = "error" | "warning" | "info";

export interface TxInlineFeedbackProps {
  visible: boolean;
  severity: TxInlineFeedbackSeverity;
  title: string;
  message: string;
  action?: ReactNode;
  reserveClassName?: string;
  className?: string;
}

const severityStyles: Record<TxInlineFeedbackSeverity, string> = {
  error: "border-error-light bg-error-lighter text-error-dark",
  warning: "border-warning-light bg-warning-lighter text-warning-dark",
  info: "border-primary-alpha-24 bg-primary-alpha-10 text-primary-on-surface",
};

function SeverityIcon({ severity }: { severity: TxInlineFeedbackSeverity }) {
  if (severity === "error") {
    return <RiErrorWarningLine className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />;
  }
  if (severity === "warning") {
    return <RiAlertLine className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />;
  }
  return <RiInformationLine className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />;
}

export function TxInlineFeedback({
  visible,
  severity,
  title,
  message,
  action,
  reserveClassName = "min-h-[6.5rem]",
  className,
}: TxInlineFeedbackProps) {
  if (!visible) {
    return <div aria-hidden="true" className={cn("w-full", reserveClassName, className)} />;
  }

  const role = severity === "error" ? "alert" : "status";
  const live = severity === "error" ? "assertive" : "polite";

  return (
    <div className={cn("w-full", reserveClassName, className)}>
      <div
        role={role}
        aria-live={live}
        className={cn(
          "flex items-start gap-3 rounded-lg border p-4 text-sm",
          severityStyles[severity]
        )}
      >
        <SeverityIcon severity={severity} />
        <div className="flex-1">
          <p className="font-medium">{title}</p>
          <p className="mt-1 opacity-90 break-words [overflow-wrap:anywhere]">{message}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export interface TxHoldFeedbackProps {
  title: string;
  message: string;
  /** What the chain holds now, when that belongs in the notice. */
  detail?: string;
  /** The last read could not see everything this send wrote, so moving on waits. */
  hasUnreadValues: boolean;
  isSettling: boolean;
  /** Another send is in flight; settling waits for it. */
  isBusy?: boolean;
  onCheckAgain: () => void;
  onMoveOn: () => void;
  className?: string;
}

/**
 * A send whose outcome nobody can say yet. What it sent stays paused until the person checks again
 * and it has landed, or chooses to move on, which they can do only from values they have seen.
 */
export function TxHoldFeedback({
  title,
  message,
  detail,
  hasUnreadValues,
  isSettling,
  isBusy = false,
  onCheckAgain,
  onMoveOn,
  className,
}: TxHoldFeedbackProps) {
  const { formatMessage } = useIntl();
  return (
    <TxInlineFeedback
      visible
      severity="warning"
      title={title}
      message={[
        message,
        detail,
        hasUnreadValues ? formatMessage({ id: "app.garden.settings.hold.unread" }) : null,
      ]
        .filter(Boolean)
        .join(" ")}
      reserveClassName=""
      className={className}
      action={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            onClick={onCheckAgain}
            disabled={isBusy}
            loading={isSettling}
          >
            {formatMessage({ id: "app.garden.settings.hold.checkAgain" })}
          </Button>
          <Button
            type="button"
            emphasis="tertiary"
            size="sm"
            onClick={onMoveOn}
            disabled={isBusy || isSettling || hasUnreadValues}
          >
            {formatMessage({ id: "app.garden.settings.hold.moveOn" })}
          </Button>
        </div>
      }
    />
  );
}
