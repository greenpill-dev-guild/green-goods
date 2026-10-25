import { type ComponentType } from "react";
import { cn } from "../../utils/styles/cn";

export type WorkbenchTone = "pending" | "approved" | "certify" | "history";

export interface WorkbenchCardProps {
  eyebrow: string;
  title: string;
  description: string;
  meta: string[];
  /**
   * The item's lifecycle state. A record with no lifecycle of its own (an
   * assessment, a minted hypercert) leaves it out and the card shows no pill.
   */
  statusLabel?: string;
  statusTone?: WorkbenchTone;
  leadingIcon: ComponentType<{ className?: string }>;
  thumbnailSrc?: string | null;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

function getStatusToneClasses(tone: WorkbenchTone) {
  // Base `bg-*-lighter`, not a `/95` opacity variant: on an already-pale color
  // the 95%→100% delta is imperceptible, so the plain tint is enough.
  if (tone === "pending") return "bg-warning-lighter text-warning-dark";
  if (tone === "approved") return "bg-success-lighter text-success-dark";
  if (tone === "certify") return "bg-primary-alpha-10 text-text-strong";
  return "bg-bg-soft text-text-sub shadow-[var(--edge-rest)]";
}

/**
 * WorkbenchCard: a registry item (the Actions workspace's actions) as a card on
 * the shared card surface (`.gg-card`, DL-102), with an icon tile or thumbnail,
 * a status pill and meta chips. The grid container itself is authored in the
 * consuming view (admin), which decides the columns with `grid-cols-*`
 * breakpoints.
 */
export function WorkbenchCard({
  eyebrow,
  title,
  description,
  meta,
  statusLabel,
  statusTone = "history",
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
              className="h-11 w-11 rounded-xl object-cover workbench-raised"
            />
          ) : (
            <div
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-primary-base workbench-raised"
              style={{ background: "var(--admin-workbench-icon-bg, rgb(var(--bg-soft-200)))" }}
            >
              <LeadingIcon className="h-5 w-5" />
            </div>
          )}
          <span className="truncate type-meta-sm text-text-soft">{eyebrow}</span>
        </div>
        {statusLabel ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 type-meta-sm font-bold",
              getStatusToneClasses(statusTone)
            )}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate type-title-md text-text-strong" title={title}>
          {title}
        </h3>
        {description ? (
          <p className="mt-1 line-clamp-2 type-body text-text-sub">{description}</p>
        ) : null}
      </div>

      {meta.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {meta.map((value) => (
            <span
              key={`${title}-${value}`}
              className="inline-flex items-center rounded-full bg-bg-soft px-2.5 py-1 type-meta font-semibold text-text-sub shadow-[var(--edge-rest)]"
            >
              {value}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );

  const sharedClassName = cn(
    // The card takes its fill, edge and corner from `.gg-card`, never a `rounded-*` utility.
    "workbench-card gg-card relative flex h-full flex-col gap-3 p-4 text-left",
    selected && "shadow-[var(--edge-focus)]",
    disabled && "cursor-default opacity-60 shadow-none",
    onClick &&
      !disabled &&
      "workbench-card-clickable cursor-pointer hover:bg-bg-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
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
