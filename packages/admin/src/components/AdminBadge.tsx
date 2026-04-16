import { cn } from "@green-goods/shared";

// ============================================================================
// Types
// ============================================================================

export interface AdminBadgeProps {
  count?: number;
  visible?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminBadge — M3 Notification Badge
 *
 * Implements Material Design 3 badge anatomy in two configurations:
 * - Small (dot): count is undefined — h-1.5 w-1.5, no label
 * - Large (number): count is provided — h-4 min-w-4 px-1, displays count (99+ cap)
 *
 * Both use: error background, on-error text, full-round shape.
 * Returns null when visible is false (default true).
 */
export function AdminBadge({ count, visible = true, className }: AdminBadgeProps) {
  if (!visible) return null;

  const isLarge = count !== undefined;
  const label = count !== undefined ? (count > 99 ? "99+" : String(count)) : undefined;

  return (
    <span
      aria-label={label ? `${label} notifications` : "notification"}
      className={cn(
        // Color
        "bg-[rgb(var(--m3-error))] text-[rgb(var(--m3-on-error))]",
        // Shape: full-round
        "rounded-[var(--m3-shape-full)]",
        // Inline flex for centering label text
        "inline-flex items-center justify-center",
        isLarge
          ? [
              // Large: 16dp height, 16dp min-width, 4dp horizontal padding
              "h-4 min-w-4 px-1",
              // Typography: label-sm bold, no line wrap
              "text-label-sm font-bold leading-none",
            ]
          : [
              // Small (dot): 6dp
              "h-1.5 w-1.5",
            ],
        className
      )}
    >
      {label}
    </span>
  );
}

AdminBadge.displayName = "AdminBadge";
