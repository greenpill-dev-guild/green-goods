import { RiArrowRightLine } from "@remixicon/react";
import { type ComponentType } from "react";
import { cn } from "../../utils";

export type WorkbenchTone = "pending" | "approved" | "certify" | "history";

export interface WorkbenchRowProps {
  eyebrow: string;
  title: string;
  description: string;
  meta: string[];
  statusLabel: string;
  statusTone: WorkbenchTone;
  leadingIcon: ComponentType<{ className?: string }>;
  thumbnailSrc?: string | null;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function getStatusToneClasses(tone: WorkbenchTone) {
  // Base `bg-*-lighter` (no `/95`): the opacity-modifier variant authored in
  // shared JSX is not reached by admin's Tailwind content scan, so the pill
  // rendered background-less in admin. The base tint ships and the 95%→100%
  // delta on an already-pale color is imperceptible. Fixes Actions + Hub.
  if (tone === "pending") return "bg-warning-lighter text-warning-dark";
  if (tone === "approved") return "bg-success-lighter text-success-dark";
  if (tone === "certify") return "bg-primary-alpha-10 text-text-strong";
  return "bg-bg-soft text-text-sub shadow-[var(--edge-rest)]";
}

export function WorkbenchRow({
  eyebrow,
  title,
  description,
  meta,
  statusLabel,
  statusTone,
  leadingIcon: LeadingIcon,
  thumbnailSrc,
  selected = false,
  disabled = false,
  onClick,
  className,
}: WorkbenchRowProps) {
  const content = (
    <>
      <div
        className="flex w-[3.75rem] items-center justify-center max-[599px]:w-12"
        aria-hidden="true"
      >
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-14 w-14 rounded-2xl object-cover workbench-raised max-[599px]:h-11 max-[599px]:w-11"
          />
        ) : (
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl text-primary-base workbench-raised max-[599px]:h-11 max-[599px]:w-11"
            style={{ background: "var(--admin-workbench-icon-bg, rgb(var(--bg-soft-200)))" }}
          >
            <LeadingIcon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label-sm text-text-soft">{eyebrow}</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-label-sm font-bold",
              getStatusToneClasses(statusTone)
            )}
          >
            {statusLabel}
          </span>
        </div>
        <h3 className="mt-1 text-title-md text-text-strong">{title}</h3>
        <p className="mt-1 text-body-md text-text-sub">{description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {meta.map((value) => (
            <span
              key={`${title}-${value}`}
              className="inline-flex items-center rounded-full bg-bg-soft px-2.5 py-1 text-body-sm font-semibold text-text-sub shadow-[var(--edge-rest)]"
            >
              {value}
            </span>
          ))}
        </div>
      </div>

      <div
        className="workbench-row-trailing h-9 w-9 items-center justify-center rounded-full bg-bg-soft text-text-sub shadow-[var(--edge-rest)]"
        aria-hidden="true"
      >
        <RiArrowRightLine className="h-4 w-4" />
      </div>
    </>
  );

  const sharedClassName = cn(
    "workbench-row relative grid w-full items-center gap-3 px-4 py-3 text-left max-[599px]:grid-cols-[auto_minmax(0,1fr)]",
    "grid-cols-[auto_minmax(0,1fr)_auto]",
    selected && "shadow-[var(--edge-focus)]",
    disabled && "cursor-default opacity-60 shadow-none",
    onClick &&
      !disabled &&
      "workbench-row-clickable cursor-pointer hover:bg-bg-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        data-selected={selected ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        className={sharedClassName}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      data-selected={selected ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      className={sharedClassName}
    >
      {content}
    </div>
  );
}
