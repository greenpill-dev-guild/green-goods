import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiInformationLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { cn } from "../utils/styles/cn";

export type AlertVariant = "error" | "warning" | "info" | "success";

export interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  onDismiss?: () => void;
}

const variantStyles: Record<AlertVariant, string> = {
  error: "border-error-light bg-error-lighter text-error-dark",
  warning: "border-warning-light bg-warning-lighter text-warning-dark",
  info: "border-information-light bg-information-lighter text-information-dark",
  success: "border-success-light bg-success-lighter text-success-dark",
};

const variantIcons: Record<AlertVariant, ReactNode> = {
  error: <RiErrorWarningLine className="h-5 w-5 flex-shrink-0" aria-hidden="true" />,
  warning: <RiAlertLine className="h-5 w-5 flex-shrink-0" aria-hidden="true" />,
  info: <RiInformationLine className="h-5 w-5 flex-shrink-0" aria-hidden="true" />,
  success: <RiCheckboxCircleLine className="h-5 w-5 flex-shrink-0" aria-hidden="true" />,
};

export function Alert({ variant, title, children, action, className, onDismiss }: AlertProps) {
  const { formatMessage } = useIntl();
  const role = variant === "error" ? "alert" : "status";

  return (
    <div
      role={role}
      className={cn("flex items-start gap-3 rounded-lg border p-4", variantStyles[variant], className)}
    >
      {variantIcons[variant]}
      <div className="flex-1 text-sm">
        {title && <p className="font-medium">{title}</p>}
        <div className={title ? "mt-1" : ""}>{children}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 rounded-md p-1 opacity-70 transition hover:opacity-100"
          aria-label={formatMessage({ id: "app.common.close" })}
        >
          <RiCloseLine className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
