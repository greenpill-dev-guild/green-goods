import { type ComponentType } from "react";
import { cn } from "../../utils";
import { getStatusToneClasses, type WorkbenchTone } from "./WorkbenchRow";

export interface WorkbenchCardProps {
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

/**
 * WorkbenchCard — the card-shaped presentation of a registry item. Same data
 * model and visual vocabulary as {@link WorkbenchRow} (icon tile, status pill,
 * meta chips) so list and grid layouts of the same registry stay coherent. The
 * grid container itself is authored in the consuming view (admin) so its
 * `grid-cols-*` utilities are reached by the app's Tailwind content scan.
 */
export function WorkbenchCard({
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
}: WorkbenchCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt=""
              loading="lazy"
              draggable={false}
              className="h-11 w-11 rounded-xl object-cover shadow-[var(--edge-rest),_var(--elevation-1)]"
            />
          ) : (
            <div
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-primary-base shadow-[var(--edge-rest),_var(--elevation-1)]"
              style={{ background: "var(--admin-workbench-icon-bg, rgb(var(--bg-soft-200)))" }}
            >
              <LeadingIcon className="h-5 w-5" />
            </div>
          )}
          <span className="truncate text-label-sm text-text-soft">{eyebrow}</span>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-label-sm font-bold",
            getStatusToneClasses(statusTone)
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-title-md text-text-strong" title={title}>
          {title}
        </h3>
        <p className="mt-1 line-clamp-2 text-body-md text-text-sub">{description}</p>
      </div>

      {meta.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {meta.map((value) => (
            <span
              key={`${title}-${value}`}
              className="inline-flex items-center rounded-full bg-bg-soft px-2.5 py-1 text-body-sm font-semibold text-text-sub shadow-[var(--edge-rest)]"
            >
              {value}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );

  const sharedClassName = cn(
    "relative flex h-full flex-col gap-3 rounded-2xl p-4 text-left transition-[background-color,transform,box-shadow] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] motion-reduce:transition-none",
    "glass-raised shadow-[var(--edge-rest),_var(--elevation-1)]",
    selected && "shadow-[var(--edge-focus)]",
    disabled && "cursor-default opacity-60 shadow-none",
    onClick &&
      !disabled &&
      "cursor-pointer hover:-translate-y-0.5 hover:bg-bg-weak hover:shadow-[var(--edge-hover),_var(--elevation-2)] active:translate-y-0 active:shadow-[var(--edge-rest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
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
