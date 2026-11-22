import { Button } from "@green-goods/shared/components/Button";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { Address } from "@green-goods/shared/types/domain";
import {
  type GardenRole,
  restorableSubRoles,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { useState } from "react";
import { useIntl } from "react-intl";
import { getRoleLabel } from "./gardenUtils";

type RestoreStatus = "idle" | "working" | "nothing" | "changed" | "unread" | "failed";

export interface RestoreRolesNoticeProps {
  address: Address;
  roles: readonly GardenRole[];
  /**
   * Every role with a recorded grant or revocation in the person's history. A sub-role in it was
   * taken away, so it is never offered back. Absent while the history is unread or failed: then
   * nothing is offered.
   */
  recordedRoles?: readonly GardenRole[];
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
 * Says which roles a person's Owner or Steward role gives but no grant ever minted, and restores
 * them in one action that names them. A sub-role with any recorded event is left alone. The chain
 * is read first, the giving role and a steward's Owner hat included, so the wallet is asked only for
 * roles still missing, and the steward is told when nothing is.
 */
export function RestoreRolesNotice({
  address,
  roles,
  recordedRoles,
  allowedRoles,
  disabled = false,
  check,
  restore,
  onRosterStale,
}: RestoreRolesNoticeProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const missing = recordedRoles ? restorableSubRoles(roles, recordedRoles) : [];
  const missingKey = missing.join(",");
  // An answer belongs to the roles it was about; a different gap starts fresh.
  const [answer, setAnswer] = useState<{ status: RestoreStatus; key: string }>({
    status: "idle",
    key: missingKey,
  });
  const status = answer.key === missingKey ? answer.status : "idle";
  const setStatus = (next: RestoreStatus) => setAnswer({ status: next, key: missingKey });
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
    // The giving role is read too, and for a steward the Owner hat: if the giving role is gone, or
    // the steward became an owner since the list was read, an Evaluator could go to an owner.
    const guards: GardenRole[] = giver === "steward" ? ["steward", "owner"] : ["owner"];
    const answer = await check(address, [...guards, ...missing]);
    if (answer === null) {
      setStatus("unread");
      return;
    }
    if (answer.includes(giver) || (giver === "steward" && !answer.includes("owner"))) {
      setStatus("changed");
      onRosterStale?.();
      return;
    }
    const stillMissing = answer.filter((role) => missing.includes(role));
    if (stillMissing.length === 0) {
      setStatus("nothing");
      onRosterStale?.();
      return;
    }
    const landed = await restore(address, stillMissing).catch((error: unknown) => {
      logger.warn("Restoring missing sub-roles failed", { error, roles: stillMissing });
      return false;
    });
    setStatus(landed ? "idle" : "failed");
  };

  const outcome =
    status === "nothing"
      ? formatMessage({ id: "admin.manageRoles.restore.nothing" })
      : status === "changed"
        ? formatMessage({ id: "admin.manageRoles.restore.changed" })
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
            count: missing.length,
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
          disabled={disabled || status === "nothing" || status === "changed"}
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
