import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import type { ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { EnsAddressText } from "@/components/EnsAddressText";
import { type EntryCheck, formatRoleNames } from "./addMembersEntry";
import { getRoleLabel } from "./gardenUtils";

interface AddMembersEntryStatusProps {
  id: string;
  /** The field's trimmed text. */
  typed: string;
  isHexAddress: boolean;
  resolvedAddress: Address | null;
  /** The field holds a name that needs an ENS lookup. */
  isEnsName: boolean;
  isResolvingEns: boolean;
  check: EntryCheck | null;
  selectedRole: GardenRole;
}

/**
 * What the typed entry means, most specific first. A typed ENS name is repeated
 * as typed; a pasted address shows its ENS name when it has one. Always mounted
 * so screen readers hear each change; guidance is calm supporting text, never an
 * error state, inset like the field's own supporting text.
 */
export function AddMembersEntryStatus({
  id,
  typed,
  isHexAddress,
  resolvedAddress,
  isEnsName,
  isResolvingEns,
  check,
  selectedRole,
}: AddMembersEntryStatusProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const roleName = (role: GardenRole) => getRoleLabel(role, formatMessage).singular;
  const member: ReactNode =
    isHexAddress && resolvedAddress ? <EnsAddressText address={resolvedAddress} /> : typed;

  let status: ReactNode = null;
  if (isResolvingEns) {
    status = formatMessage({
      id: "admin.addMember.resolvingEns",
      defaultMessage: "Resolving ENS name...",
    });
  } else if (check?.kind === "staged") {
    status = (
      <FormattedMessage
        id="admin.addMember.alreadyStaged"
        values={{ member, role: roleName(check.stagedRole), roleKey: check.stagedRole }}
      />
    );
  } else if (check?.kind === "held") {
    status = (
      <FormattedMessage
        id="admin.addMember.alreadyHasRole"
        values={{ member, role: roleName(selectedRole), roleKey: selectedRole }}
      />
    );
  } else if (check?.kind === "member") {
    status = (
      <FormattedMessage
        id="admin.addMember.currentRolesHint"
        values={{
          member,
          roles: formatRoleNames(check.currentRoles, intl),
          firstRoleKey: check.currentRoles[0],
        }}
      />
    );
  } else if (isEnsName) {
    status = resolvedAddress ? (
      <FormattedMessage
        id="admin.addMember.ensResolved"
        defaultMessage="Resolves to {address}"
        values={{ address: <EnsAddressText address={resolvedAddress} /> }}
      />
    ) : (
      formatMessage({
        id: "admin.addMember.enterValidAddress",
        defaultMessage: "Enter a valid ENS name or 0x address.",
      })
    );
  }

  return (
    <p id={id} aria-live="polite" className="mt-1 px-4 type-body text-text-soft empty:mt-0">
      {status}
    </p>
  );
}
