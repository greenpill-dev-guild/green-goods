import { Chip } from "@green-goods/shared/components/Chip";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type ComponentType } from "react";

// ============================================================================
// Types
// ============================================================================

export interface AdminFilterChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  leadingIcon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminFilterChip — the cockpit's filter chip, Shared's `Chip` (DL-116)
 *
 * The installed app's chip at the cockpit's density (F4, DL-101):
 * - Height: 32px with a 44px hit area, a capsule, the shared chip's own; the
 *   cockpit also reserves the 44px finger box in its layout (DL-011), as its
 *   other 32px controls do, so a row of chips keeps its height
 * - Unselected: the shared chip's outline and fill
 * - Selected: the app's selected look in the workspace tone, a solid
 *   --tone-action fill with --tone-on-action text (the shared recipe reads the
 *   tone where the chip sits, and the app's action pair where there is none)
 * - Focus: the shared chip's one solid 2px ring in the tone, 2px off the chip
 *   (DL-098)
 * - Selection shows by fill and `aria-pressed` alone, with no leading check mark,
 *   so choosing a chip never changes its width or moves the chips after it
 *   (DL-065). An optional leadingIcon shows in both states for the same reason.
 */
export function AdminFilterChip({
  label,
  selected,
  onToggle,
  leadingIcon: LeadingIcon,
  disabled = false,
  className,
}: AdminFilterChipProps) {
  return (
    <Chip
      data-component="AdminFilterChip"
      selected={selected}
      onClick={onToggle}
      disabled={disabled}
      leadingIcon={
        LeadingIcon ? <LeadingIcon className="h-[18px] w-[18px] shrink-0" aria-hidden /> : undefined
      }
      className={cn("admin-hit-target", className)}
    >
      <span>{label}</span>
    </Chip>
  );
}
