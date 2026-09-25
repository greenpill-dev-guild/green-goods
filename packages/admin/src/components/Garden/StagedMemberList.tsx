import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiCloseLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { EnsAddressText } from "@/components/EnsAddressText";
import { AdminIconButton } from "../AdminButton";
import { formatRoleNames, type StagedMember } from "./addMembersEntry";
import { RoleChip } from "./RoleChip";

interface StagedMemberListProps {
  members: StagedMember[];
  /** Roles each address holds today (lowercase keys), for the "Currently a …" line. */
  rolesByAddress: Map<string, GardenRole[]>;
  onRemove: (address: Address) => void;
  disabled?: boolean;
}

/**
 * The Add Members queue: who is being added and the role each person is
 * getting. People already in the garden also show the roles they hold today,
 * so a promotion reads at a glance; new people stay one line.
 */
export function StagedMemberList({
  members,
  rolesByAddress,
  onRemove,
  disabled = false,
}: StagedMemberListProps) {
  const intl = useIntl();
  const { formatMessage } = intl;

  return (
    // Reserved-geometry staging area: fixed height from first paint so adding
    // names never grows the dialog (§ dialog standard — loading/list regions
    // reserve their final dimensions).
    <div
      className="h-44 overflow-y-auto rounded-[var(--m3-shape-md)] border border-stroke-soft bg-bg-weak/40 p-2"
      role="group"
      aria-label={formatMessage({
        id: "admin.addMember.pendingList",
        defaultMessage: "Members to add",
      })}
    >
      {members.length === 0 ? (
        <p className="flex h-full items-center justify-center px-4 text-center body-xs text-text-soft">
          {formatMessage({
            id: "admin.addMember.stagedEmpty",
            defaultMessage: "Resolved addresses appear here before they are added.",
          })}
        </p>
      ) : (
        <ul className="space-y-2">
          {members.map(({ address, role }) => {
            // A row's own role is never one they hold: only people without it
            // are staged, and the chain can overrule a roster that lags a revoke.
            const currentRoles = (rolesByAddress.get(address.toLowerCase()) ?? []).filter(
              (held) => held !== role
            );
            const currentRolesLabel =
              currentRoles.length > 0
                ? formatMessage(
                    { id: "admin.addMember.currentRoles" },
                    {
                      roles: formatRoleNames(currentRoles, intl),
                      firstRoleKey: currentRoles[0],
                    }
                  )
                : null;
            return (
              <li
                key={address}
                className="flex items-center justify-between gap-2 rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container))] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-body-md text-text-strong" title={address}>
                    <EnsAddressText address={address} />
                  </span>
                  {currentRolesLabel ? (
                    <span
                      className="block truncate body-sm text-text-soft"
                      title={currentRolesLabel}
                    >
                      {currentRolesLabel}
                    </span>
                  ) : null}
                </div>
                <RoleChip role={role} />
                <AdminIconButton
                  size="sm"
                  className="shrink-0"
                  onClick={() => onRemove(address)}
                  disabled={disabled}
                  label={formatMessage({ id: "admin.addMember.remove", defaultMessage: "Remove" })}
                >
                  <RiCloseLine />
                </AdminIconButton>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
