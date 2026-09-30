import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckLine } from "@remixicon/react";
import * as React from "react";
import type { ReactNode } from "react";

type SelectionRole = "toggle" | "radio";

export interface AdminSelectableCardProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "title"> {
  title: ReactNode;
  description?: ReactNode;
  selected: boolean;
  selectionRole?: SelectionRole;
  leadingVisual?: ReactNode;
  meta?: ReactNode;
}

export const AdminSelectableCard = React.forwardRef<HTMLButtonElement, AdminSelectableCardProps>(
  (
    {
      title,
      description,
      selected,
      selectionRole = "toggle",
      leadingVisual,
      meta,
      className,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const role = selectionRole === "radio" ? "radio" : props.role;

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        role={role}
        aria-checked={selectionRole === "radio" ? selected : undefined}
        aria-pressed={selectionRole === "toggle" ? selected : undefined}
        disabled={disabled}
        data-component="AdminSelectableCard"
        data-selected={selected ? "true" : "false"}
        className={cn(
          "relative flex h-full w-full items-start gap-3 rounded-[var(--m3-shape-md)] border px-3.5 py-3 text-left",
          "transition-[background-color,border-color,box-shadow,color,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
          "active:scale-[0.99]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]",
          selected
            ? "border-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))] bg-[rgb(var(--tone-action,var(--m3-primary))/0.1)] text-[rgb(var(--m3-on-surface))] shadow-[inset_0_0_0_1px_rgb(var(--tone-action,var(--m3-primary))/0.16)]"
            : "border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface))] text-[rgb(var(--m3-on-surface-variant))] hover:border-[rgb(var(--tone-action,var(--m3-primary))/0.28)] hover:bg-[rgb(var(--m3-surface-container-low))]",
          disabled && "cursor-not-allowed opacity-[0.55]",
          className
        )}
      >
        {leadingVisual ? <span className="mt-0.5 shrink-0">{leadingVisual}</span> : null}

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block pr-7 text-title-sm font-semibold leading-snug",
              selected
                ? "text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]"
                : "text-[rgb(var(--m3-on-surface))]"
            )}
          >
            {title}
          </span>
          {description ? (
            <span className="mt-1 block text-body-sm leading-snug text-[rgb(var(--m3-on-surface-variant))]">
              {description}
            </span>
          ) : null}
          {meta ? <span className="mt-2 flex flex-wrap items-center gap-1.5">{meta}</span> : null}
        </span>

        {selected ? (
          <RiCheckLine
            className="absolute right-3 top-3 h-4 w-4 text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]"
            aria-hidden="true"
          />
        ) : null}
      </button>
    );
  }
);

AdminSelectableCard.displayName = "AdminSelectableCard";
