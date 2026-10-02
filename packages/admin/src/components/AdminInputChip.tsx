import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCloseLine } from "@remixicon/react";
import type { ReactNode } from "react";

export interface AdminInputChipProps {
  /** What was chosen, e.g. a person's name. */
  label: ReactNode;
  /** The label as plain text, for the tooltip when it is cut short. */
  text: string;
  /** Up to two letters, or an image, in a 24dp circle before the label. */
  avatar?: ReactNode;
  /** Takes it back out of the selection. */
  onRemove: () => void;
  /** The remove button's accessible name, e.g. "Remove lina". */
  removeLabel: string;
  disabled?: boolean;
  className?: string;
}

/**
 * AdminInputChip — M3 input chip, for something the steward chose and can take
 * back out, such as a person named as a confirmer.
 *
 * - Height: 32dp, corner-small (8dp), an outline over the low container fill
 * - Optional 24dp leading avatar; the label truncates with its full text as a tooltip
 * - Trailing remove button with a 44px finger box (admin-hit-target)
 *
 * Chips flow in a wrapping row, so each choice takes only its own width and the
 * row wraps only after many (PRD-1022 D15). A filter chip selects; this one
 * holds a choice already made. Render them inside an element with
 * `role="list"` and its own name.
 */
export function AdminInputChip({
  label,
  text,
  avatar,
  onRemove,
  removeLabel,
  disabled = false,
  className,
}: AdminInputChipProps) {
  return (
    <span
      data-component="AdminInputChip"
      role="listitem"
      title={text}
      className={cn(
        "inline-flex h-8 max-w-full items-center gap-1.5 pr-0.5",
        avatar ? "pl-1" : "pl-3",
        "rounded-[var(--m3-shape-sm)] border border-[rgb(var(--m3-outline-variant))]",
        "bg-[rgb(var(--m3-surface-container-low))] text-[rgb(var(--m3-on-surface))]",
        "text-label-lg font-medium",
        disabled && "opacity-[0.38]",
        className
      )}
    >
      {avatar ? (
        <span
          aria-hidden="true"
          className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-[rgb(var(--m3-secondary-container))] text-label-sm font-semibold text-[rgb(var(--m3-on-secondary-container))]"
        >
          {avatar}
        </span>
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={removeLabel}
        className={cn(
          "admin-hit-target m3-state-layer grid h-7 w-7 shrink-0 place-items-center rounded-full",
          "text-[rgb(var(--m3-on-surface-variant))] [--state-layer-color:var(--m3-on-surface-variant)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]",
          "disabled:pointer-events-none"
        )}
      >
        <RiCloseLine className="h-[18px] w-[18px]" aria-hidden />
      </button>
    </span>
  );
}
