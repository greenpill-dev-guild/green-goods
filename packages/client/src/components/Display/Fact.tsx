import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ReactNode } from "react";

/**
 * One labelled fact: an icon and its label on the start side, the value on the end. Rows sit in a
 * `<dl className="divide-y divide-stroke-soft-200">`, as on the promise pages and the reporting
 * permission summary.
 */
export function Fact({
  icon,
  label,
  value,
  tag = null,
  wrap = false,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  /** "You", or the role the person holds, beside the value. */
  tag?: ReactNode;
  /**
   * For a row whose label and value are both free-length words (a translated limit and a date):
   * when they can't share a line on a narrow phone or at a larger text size, the value moves under
   * the label, still on the end side, instead of being squeezed.
   */
  wrap?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2.5",
        wrap ? "flex-wrap gap-x-3 gap-y-0.5" : "gap-3"
      )}
    >
      <dt
        className={cn(
          "flex items-center gap-2 text-xs text-text-sub-600",
          wrap ? "min-w-0" : "shrink-0"
        )}
      >
        <span
          className={cn("flex text-text-soft-400 [&>svg]:h-4 [&>svg]:w-4", wrap && "shrink-0")}
          aria-hidden="true"
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd
        className={cn(
          "flex min-w-0 items-center justify-end gap-1 text-right text-sm text-text-strong-950",
          wrap && "ms-auto [overflow-wrap:anywhere]"
        )}
      >
        {value}
        {tag ? (
          <span className="ms-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-bg-weak-50 px-2 py-0.5 text-[10px] font-medium text-text-sub-600">
            {tag}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
