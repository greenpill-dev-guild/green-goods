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

function getStatusToneClasses(tone: WorkbenchTone) {
  if (tone === "pending") return "bg-warning-lighter/95 text-warning-dark";
  if (tone === "approved") return "bg-success-lighter/95 text-success-dark";
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
            className="h-14 w-14 rounded-2xl object-cover shadow-[var(--edge-rest),0_10px_18px_rgba(38,28,18,0.08)] max-[599px]:h-11 max-[599px]:w-11 max-[599px]:rounded-[0.85rem]"
          />
        ) : (
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-soft dark:bg-bg-sub text-primary-base shadow-[var(--edge-rest),0_10px_18px_rgba(38,28,18,0.05)] max-[599px]:h-11 max-[599px]:w-11 max-[599px]:rounded-[0.85rem]">
            <LeadingIcon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label-sm text-text-soft">{eyebrow}</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-bold tracking-[0.01em]",
              getStatusToneClasses(statusTone)
            )}
          >
            {statusLabel}
          </span>
        </div>
        <h3 className="mt-[0.32rem] text-title-md text-text-strong">{title}</h3>
        <p className="mt-[0.2rem] max-w-[60ch] text-body-md text-text-sub">{description}</p>
        <div className="mt-[0.55rem] flex flex-wrap gap-[0.45rem]">
          {meta.map((value) => (
            <span
              key={`${title}-${value}`}
              className="inline-flex items-center rounded-full bg-bg-soft px-2.5 py-[0.34rem] text-body-sm font-semibold text-text-sub shadow-[var(--edge-rest)]"
            >
              {value}
            </span>
          ))}
        </div>
      </div>

      <div
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-bg-soft text-text-sub shadow-[var(--edge-rest)] max-[599px]:hidden"
        aria-hidden="true"
      >
        <RiArrowRightLine className="h-4 w-4" />
      </div>
    </>
  );

  const sharedClassName = cn(
    "relative grid w-full items-center gap-[0.875rem] px-4 py-3 text-left transition-[background-color,transform,box-shadow,filter] duration-200 ease-out motion-reduce:transition-none max-[599px]:grid-cols-[auto_minmax(0,1fr)] max-[599px]:gap-3 max-[599px]:px-[0.8rem] max-[599px]:py-[0.85rem]",
    "grid-cols-[auto_minmax(0,1fr)_auto]",
    selected &&
      "bg-[rgb(var(--ws-primary-container)/0.12)] shadow-[0_0_0_1px_rgba(var(--workspace-tint),0.22),0_10px_24px_rgba(38,28,18,0.05)]",
    disabled && "cursor-default opacity-60 shadow-none",
    onClick &&
      !disabled &&
      "cursor-pointer hover:-translate-y-0.5 transition duration-[var(--spring-fast-duration)] hover:bg-bg-weak dark:hover:bg-bg-sub/60 hover:shadow-[var(--edge-rest),0_8px_18px_rgba(38,28,18,0.05)] active:translate-y-0 active:scale-[0.998] active:bg-[#fff8ec] dark:active:bg-bg-sub active:shadow-[0_0_0_1px_rgba(var(--workspace-tint),0.14),0_4px_10px_rgba(38,28,18,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
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
