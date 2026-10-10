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
import { IconButton } from "./IconButton";

export type AlertVariant = "error" | "warning" | "info" | "success";

export interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  onDismiss?: () => void;
  /** Replaces the variant's icon, for a notice that says what state it is in. */
  icon?: ReactNode;
  /**
   * `inline` sets the icon beside everything. `stacked` puts the icon and title
   * on one line and runs the body and action the full width below, with the
   * body keeping two lines, so notices that trade places share one height. It
   * has no dismiss button.
   */
  layout?: "inline" | "stacked";
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

export function Alert({
  variant,
  title,
  children,
  action,
  className,
  onDismiss,
  icon,
  layout = "inline",
}: AlertProps) {
  const { formatMessage } = useIntl();
  const role = variant === "error" ? "alert" : "status";
  const resolvedIcon = icon ?? variantIcons[variant];

  if (layout === "stacked") {
    return (
      <div role={role} className={cn("rounded-lg border p-3", variantStyles[variant], className)}>
        <div className="flex items-center gap-2">
          {resolvedIcon}
          {title ? <p className="min-w-0 text-sm font-semibold">{title}</p> : null}
        </div>
        <div className="mt-1 min-h-[2lh] text-sm">{children}</div>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    );
  }

  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        variantStyles[variant],
        className
      )}
    >
      {resolvedIcon}
      <div className="flex-1 text-sm">
        {title && <p className="font-medium">{title}</p>}
        <div className={title ? "mt-1" : ""}>{children}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <IconButton
          size="compact"
          className="-my-1.5 -mr-1.5 flex-shrink-0 text-current opacity-70 hover:opacity-100"
          onClick={onDismiss}
          aria-label={formatMessage({ id: "app.common.close" })}
          icon={<RiCloseLine />}
        />
      )}
    </div>
  );
}
