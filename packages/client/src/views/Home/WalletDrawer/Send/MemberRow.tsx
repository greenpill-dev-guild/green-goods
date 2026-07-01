import {
  type Address,
  cn,
  formatAddress,
  type GardenRole,
  getRoleColorClasses,
  getRoleLabel,
  useEnsAvatar,
  useEnsName,
} from "@green-goods/shared";
import { RiCheckLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/Display/Avatar/Avatar";

interface MemberRowProps {
  address: Address;
  roles?: GardenRole[];
  /** Shown under the name when the list mixes gardens (search / flat mode). */
  gardenName?: string;
  /** Garden names the sender and this member both belong to ("Together in …"). */
  sharedGardens?: string[];
  /** Suppress the garden line when a section header already names the garden. */
  hideGarden?: boolean;
  selected?: boolean;
  onSelect: () => void;
}

/** Cap visible role badges so a multi-role member never overflows the row. */
const MAX_BADGES = 2;

/**
 * Presentational recipient row. Identity (name + avatar) resolves lazily via the
 * shared ENS hooks; the wallet address is the always-available fallback.
 */
export function MemberRow({
  address,
  roles = [],
  gardenName,
  sharedGardens,
  hideGarden,
  selected,
  onSelect,
}: MemberRowProps) {
  const { formatMessage } = useIntl();
  const { data: ensName } = useEnsName(address);
  const { data: ensAvatar } = useEnsAvatar(address);

  const displayName = ensName || formatAddress(address);
  const initials = (ensName ? ensName.replace(/\.eth$/i, "") : address.slice(2))
    .slice(0, 2)
    .toUpperCase();
  const visibleRoles = roles.slice(0, MAX_BADGES);
  const extraRoles = roles.length - visibleRoles.length;

  // "Gardens you share" wins over a plain garden line; the section header owns the
  // garden when `hideGarden` is set (frontend-design Rule 17 — don't restate it).
  const sharedGardensText = sharedGardens?.length ? sharedGardens.join(", ") : null;
  const contextLine = sharedGardensText
    ? formatMessage({ id: "app.send.recipient.sharedGardens" }, { gardens: sharedGardensText })
    : !hideGarden && gardenName
      ? gardenName
      : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition",
        selected
          ? "border-primary-base bg-primary-base/10"
          : "border-stroke-soft-200 bg-bg-white-0 hover:bg-bg-weak-50"
      )}
    >
      <Avatar className="h-10 w-10">
        {ensAvatar ? <AvatarImage src={ensAvatar} alt="" /> : null}
        <AvatarFallback className="text-xs font-medium text-text-sub-600">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-strong-950" title={displayName}>
          {displayName}
        </p>
        {contextLine ? (
          <p className="truncate text-xs text-text-soft-400" title={contextLine}>
            {contextLine}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {visibleRoles.map((role) => {
          const colors = getRoleColorClasses(role);
          return (
            <span
              key={role}
              className={cn(
                "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                colors.iconBg,
                colors.iconText
              )}
            >
              {getRoleLabel(role, formatMessage).singular}
            </span>
          );
        })}
        {extraRoles > 0 ? (
          <span className="text-[10px] text-text-soft-400">+{extraRoles}</span>
        ) : null}
        {selected ? (
          <RiCheckLine className="h-4 w-4 shrink-0 text-primary-base" aria-hidden />
        ) : null}
      </div>
    </button>
  );
}
