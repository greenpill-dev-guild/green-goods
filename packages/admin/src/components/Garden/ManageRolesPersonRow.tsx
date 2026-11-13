import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import { Button } from "@green-goods/shared/components/Button";
import { GardenMembershipDates } from "@green-goods/shared/components/GardenMembershipDates";
import { MemberIdentity } from "./MemberIdentity";
import type { Address, GardenMemberHistory } from "@green-goods/shared/types/domain";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
  type GardenRoleRemovalBlock,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { getRoleLabel } from "./gardenUtils";
import type { MemberPerson } from "./manageRoles";
import { LockedRoleChip, RoleCheckChip } from "./RoleCheckChip";

/**
 * A person's round avatar as the person row draws it: their photo, else a person glyph on the
 * quiet fill, which also holds the circle while the photo is looked up (DL-112, DL-161).
 */
export function PersonAvatar({
  address,
  chainId,
  size = "md",
}: {
  address: Address;
  chainId: number;
  size?: "sm" | "md";
}) {
  const avatar = useResolvedProfileAvatar(address, undefined, chainId, { list: true });
  const glyph = (
    <span className="absolute inset-0 flex items-center justify-center">
      <RiUserLine aria-hidden="true" className={size === "md" ? "h-5 w-5" : "h-4 w-4"} />
    </span>
  );
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-bg-weak text-text-soft",
        size === "md" ? "h-10 w-10" : "h-8 w-8"
      )}
    >
      {avatar.avatarUri ? (
        <ImageWithFallback
          src={avatar.avatarUri}
          alt=""
          fallbackIcon={RiUserLine}
          backgroundFallback={glyph}
          className="absolute inset-0 h-full w-full object-cover"
          fallbackClassName="absolute inset-0 h-full w-full"
        />
      ) : (
        glyph
      )}
    </span>
  );
}

/** The one-line marker that the row is the steward's own. */
export function YouTag() {
  const { formatMessage } = useIntl();
  return (
    <span className="shrink-0 rounded-full border border-stroke-soft px-1.5 type-meta-sm font-medium text-text-sub">
      {formatMessage({ id: "admin.manageRoles.you" })}
    </span>
  );
}

const BLOCK_ORDER: GardenRoleRemovalBlock[] = [
  "own-access",
  "owner-only",
  "owner-steward",
  "last-owner",
];

interface ManageRolesPersonRowProps {
  person: MemberPerson;
  chainId: number;
  isViewer: boolean;
  /** The person's roles this viewer cannot remove, and why. */
  blocked: ReadonlyMap<GardenRole, GardenRoleRemovalBlock>;
  /** The person's roles picked for removal. */
  selected: ReadonlySet<GardenRole>;
  onToggle: (role: GardenRole, checked: boolean) => void;
  /** A viewer who cannot manage roles sees them without checkboxes or reasons. */
  readOnly: boolean;
  disabled?: boolean;
  history?: GardenMemberHistory;
  historyLoading?: boolean;
  historyError?: boolean;
  onAddRole?: () => void;
  addRoleDisabled?: boolean;
}

/**
 * One person on Manage Roles: their avatar and name as the directory shows them, then a check
 * chip for each role they hold (DL-049). A role this viewer cannot remove shows a lock, and the
 * row says why in words, so no rule rests on memory.
 */
export function ManageRolesPersonRow({
  person,
  chainId,
  isViewer,
  blocked,
  selected,
  onToggle,
  readOnly,
  disabled = false,
  history,
  historyLoading = false,
  historyError = false,
  onAddRole,
  addRoleDisabled = false,
}: ManageRolesPersonRowProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const reasons = BLOCK_ORDER.filter((block) => [...blocked.values()].includes(block)).map(
    (block) => {
      if (block === "own-access") {
        const roles = person.roles.filter((role) => blocked.get(role) === "own-access");
        return formatMessage(
          { id: "admin.manageRoles.lock.ownAccess" },
          {
            count: roles.length,
            roles: intl.formatList(
              roles.map((role) => getRoleLabel(role, formatMessage).singular),
              { type: "conjunction" }
            ),
          }
        );
      }
      return formatMessage({
        id:
          block === "owner-only"
            ? "admin.manageRoles.lock.ownerOnly"
            : block === "owner-steward"
              ? "admin.manageRoles.lock.ownerSteward"
              : "admin.manageRoles.lock.lastOwner",
      });
    }
  );

  return (
    <li
      data-component="ManageRolesPersonRow"
      className={cn(
        "flex items-start gap-3 rounded-(--gg-row-radius) border bg-bg-white px-3 py-2.5",
        selected.size > 0 ? "border-[rgb(var(--text-strong-950)/0.3)]" : "border-stroke-soft"
      )}
    >
      <PersonAvatar address={person.address} chainId={chainId} />
      <AddressDisplay address={person.address} list>
        {(name) => (
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="flex min-w-0 items-center gap-2">
              <span
                className="truncate type-title-sm text-text-strong"
                title={`${name} · ${person.address}`}
              >
                {name}
              </span>
              {isViewer ? <YouTag /> : null}
            </p>
            <MemberIdentity address={person.address} showName={false} />
            <GardenMembershipDates
              history={history}
              roles={person.roles}
              isLoading={historyLoading}
              isError={historyError}
            />
            {!readOnly && onAddRole ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  emphasis="secondary"
                  size="compact"
                  disabled={
                    disabled || addRoleDisabled || person.roles.length === GARDEN_ROLE_ORDER.length
                  }
                  aria-label={formatMessage({ id: "admin.members.addRoleFor" }, { member: name })}
                  onClick={onAddRole}
                >
                  {formatMessage({ id: "admin.members.addRole" })}
                </Button>
              </div>
            ) : null}
            <ul
              className="flex flex-wrap gap-1.5"
              aria-label={formatMessage({ id: "admin.manageRoles.rolesOf" }, { name })}
            >
              {person.roles.map((role) => (
                <li key={role} className="flex">
                  {readOnly ? (
                    <span className="inline-flex min-h-8 items-center rounded-full bg-bg-weak px-3 type-label-sm text-text-sub">
                      {getRoleLabel(role, formatMessage).singular}
                    </span>
                  ) : blocked.has(role) ? (
                    <LockedRoleChip role={role} />
                  ) : (
                    <RoleCheckChip
                      role={role}
                      personName={name}
                      checked={selected.has(role)}
                      disabled={disabled}
                      onCheckedChange={(checked) => onToggle(role, checked)}
                    />
                  )}
                </li>
              ))}
            </ul>
            {!readOnly
              ? reasons.map((reason) => (
                  <p key={reason} className="type-meta text-text-sub">
                    {reason}
                  </p>
                ))
              : null}
          </div>
        )}
      </AddressDisplay>
    </li>
  );
}
