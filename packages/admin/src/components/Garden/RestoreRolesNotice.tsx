import { Button } from "@green-goods/shared/components/Button";
import type { Address } from "@green-goods/shared/types/domain";
import {
  type GardenRole,
  missingSubRoles,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { useState } from "react";
import { useIntl } from "react-intl";
import { getRoleLabel } from "./gardenUtils";

type RestoreStatus = "idle" | "working" | "nothing" | "unread" | "failed";

export interface RestoreRolesNoticeProps {
  address: Address;
  roles: readonly GardenRole[];
  /** The roles this viewer may grant; absent when every role is open to them. */
  allowedRoles?: readonly GardenRole[];
  disabled?: boolean;
  /** Reads which roles the chain still lacks; `null` when a read fails. */
  check: (address: Address, roles: readonly GardenRole[]) => Promise<GardenRole[] | null>;
  /** Grants each role; resolves true when every one landed. */
  restore: (address: Address, roles: readonly GardenRole[]) => Promise<boolean>;
  /** The chain answered that nothing is missing, so the indexed roster is behind it. */
  onRosterStale?: () => void;
}

/**
 * Says which roles a person's Owner or Steward role gives but they do not hold, and restores
 * them in one action that names them. The chain is read first, so the wallet is asked only for
 * roles it still lacks, and the steward is told when nothing is missing.
 */
export function RestoreRolesNotice({
  address,
  roles,
  allowedRoles,
  disabled = false,
  check,
  restore,
  onRosterStale,
}: RestoreRolesNoticeProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const [status, setStatus] = useState<RestoreStatus>("idle");
  const missing = missingSubRoles(roles);
  if (missing.length === 0) return null;

  const list = (names: readonly GardenRole[]) =>
    intl.formatList(
      names.map((role) => getRoleLabel(role, formatMessage).singular),
      { type: "conjunction" }
    );
  const giver = roles.includes("owner") ? "owner" : "steward";
  const canRestore = !allowedRoles || missing.every((role) => allowedRoles.includes(role));

  const run = async () => {
    setStatus("working");
    const stillMissing = await check(address, missing);
    if (stillMissing === null) {
      setStatus("unread");
      return;
    }
    if (stillMissing.length === 0) {
      setStatus("nothing");
      onRosterStale?.();
      return;
    }
    const landed = await restore(address, stillMissing).catch(() => false);
    setStatus(landed ? "idle" : "failed");
  };

  const outcome =
    status === "nothing"
      ? formatMessage({ id: "admin.manageRoles.restore.nothing" })
      : status === "unread"
        ? formatMessage({ id: "admin.manageRoles.restore.unread" })
        : status === "failed"
          ? formatMessage({ id: "admin.manageRoles.restore.failed" })
          : null;

  return (
    <div className="space-y-1.5" data-component="RestoreRolesNotice">
      <p className="type-meta text-text-sub">
        {formatMessage(
          { id: "admin.manageRoles.restore.missing" },
          {
            roles: list(missing),
            role: getRoleLabel(giver, formatMessage).singular,
          }
        )}
      </p>
      {canRestore ? (
        <Button
          type="button"
          emphasis="secondary"
          size="compact"
          disabled={disabled || status === "nothing"}
          loading={status === "working"}
          onClick={() => void run()}
        >
          {formatMessage({ id: "admin.manageRoles.restore.action" }, { roles: list(missing) })}
        </Button>
      ) : (
        <p className="type-meta text-text-sub">
          {formatMessage({ id: "admin.manageRoles.restore.ownerOnly" })}
        </p>
      )}
      {outcome ? (
        <p role="status" className="type-meta text-text-sub">
          {outcome}
        </p>
      ) : null}
    </div>
  );
}
