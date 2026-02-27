import { cn } from "@green-goods/shared";
import { RiAlertLine, RiErrorWarningLine, RiInformationLine } from "@remixicon/react";
import type { ReactNode } from "react";

export type TxInlineFeedbackSeverity = "error" | "warning" | "info";

interface TxInlineFeedbackProps {
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
  info: "border-primary-light bg-primary-lighter text-primary-dark",
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
          <p className="mt-1 opacity-90">{message}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
