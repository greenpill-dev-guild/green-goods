import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckLine, RiLockLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { getRoleLabel } from "./gardenUtils";

interface RoleCheckChipProps {
  role: GardenRole;
  /** Whose role it is, so the checkbox names the pair it selects. */
  personName: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * One of a person's roles on their Manage Roles row, as a checkbox: checked means this role is
 * picked for removal. A filled box and a heavier outline both mark it, so a selection never rests
 * on one cue. Picking is quiet on purpose; the destructive emphasis waits for the review's confirm.
 */
export function RoleCheckChip({
  role,
  personName,
  checked,
  onCheckedChange,
  disabled = false,
}: RoleCheckChipProps) {
  const { formatMessage } = useIntl();
  const label = getRoleLabel(role, formatMessage).singular;
  return (
    <label
      data-component="RoleCheckChip"
      data-checked={checked || undefined}
      className={cn(
        // A 32px capsule with the cockpit's 44px finger box (`before`), like its other chips.
        "relative inline-flex min-h-8 items-center gap-2 whitespace-nowrap rounded-full bg-bg-white py-1 type-label-sm transition-colors",
        "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
        "has-focus-visible:ring-2 has-focus-visible:ring-[rgb(var(--tone-focus-ring,var(--primary-base)))] has-focus-visible:ring-offset-2",
        checked
          ? "border-2 border-[rgb(var(--text-strong-950))] pl-[7px] pr-[11px] font-semibold text-text-strong"
          : "border border-[rgb(var(--gg-control-outline))] pl-2 pr-3 text-text-sub",
        disabled
          ? "cursor-not-allowed opacity-[0.38]"
          : "cursor-pointer hover:bg-[rgb(var(--text-strong-950)/0.08)]"
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        aria-label={formatMessage(
          { id: "admin.manageRoles.chipLabel" },
          { role: label, name: personName }
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-(--admin-radius-xs) border-[1.5px]",
          checked
            ? "border-[rgb(var(--text-strong-950))] bg-[rgb(var(--text-strong-950))] text-[rgb(var(--bg-white-0))]"
            : "border-[rgb(var(--gg-control-outline))]"
        )}
      >
        {checked ? <RiCheckLine className="h-3.5 w-3.5" /> : null}
      </span>
      {label}
    </label>
  );
}

/** A role the viewer cannot remove: shown, marked with a lock, and never focusable. The row says why. */
export function LockedRoleChip({ role }: { role: GardenRole }) {
  const { formatMessage } = useIntl();
  return (
    <span
      data-component="LockedRoleChip"
      className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-stroke-sub py-1 pl-2.5 pr-3 type-label-sm text-text-soft"
    >
      <RiLockLine aria-hidden="true" className="h-3.5 w-3.5" />
      {getRoleLabel(role, formatMessage).singular}
    </span>
  );
}
