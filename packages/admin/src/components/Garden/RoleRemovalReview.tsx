import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import type { RoleRemovalStatus } from "@green-goods/shared/hooks/garden/useGardenOperations";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiCheckLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiLoader4Line,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { getRoleLabel } from "./gardenUtils";
import { coveringRole, type MemberPerson, rolesKept } from "./manageRoles";
import { PersonAvatar, YouTag } from "./ManageRolesPersonRow";

/** Where one picked pair stands: read at review, then sent or left out. */
export type ReviewPairStatus = "checking" | "ready" | "sending" | RoleRemovalStatus;

/** A pair the run has not proven removed: the person holds that role until a read says otherwise. */
const STILL_HELD: ReadonlySet<ReviewPairStatus> = new Set([
  "refused",
  "declined",
  "failed",
  "notSent",
  "unknown",
]);

export interface ReviewPair {
  role: GardenRole;
  status: ReviewPairStatus;
  /** Why the chain refused it, or what stopped its send. */
  reason?: string;
}

/** One person under review: their roles as they stood when Review opened, and each picked role. */
export interface ReviewPerson {
  person: MemberPerson;
  pairs: ReviewPair[];
}

const STATUS_LABEL_IDS: Partial<Record<ReviewPairStatus, string>> = {
  checking: "admin.manageRoles.state.checking",
  sending: "admin.manageRoles.state.removing",
  removed: "admin.manageRoles.state.removed",
  alreadyRemoved: "admin.manageRoles.state.alreadyRemoved",
  refused: "admin.manageRoles.state.refused",
  declined: "admin.manageRoles.state.notSent",
  notSent: "admin.manageRoles.state.notSent",
  failed: "admin.manageRoles.state.failed",
  unknown: "admin.manageRoles.state.unknown",
};

function PairState({ status }: { status: ReviewPairStatus }) {
  const { formatMessage } = useIntl();
  const id = STATUS_LABEL_IDS[status];
  if (!id) return null;
  const busy = status === "checking" || status === "sending";
  const Icon = busy
    ? RiLoader4Line
    : status === "removed"
      ? RiCheckLine
      : status === "refused" || status === "failed"
        ? RiCloseCircleLine
        : status === "unknown"
          ? RiErrorWarningLine
          : null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 type-label-sm",
        status === "removed" && "text-success-dark",
        (status === "refused" || status === "failed") && "text-error-dark",
        status === "unknown" && "text-warning-dark",
        !["removed", "refused", "failed", "unknown"].includes(status) && "text-text-sub"
      )}
    >
      {Icon ? (
        <Icon aria-hidden="true" className={cn("h-4 w-4", busy && "motion-safe:animate-spin")} />
      ) : null}
      {formatMessage({ id })}
    </span>
  );
}

interface RoleRemovalReviewProps {
  people: ReviewPerson[];
  chainId: number;
  viewer?: string | null;
}

/**
 * The review of a removal: one row per person, each picked role on its own line with where it
 * stands, then what the person keeps. The list never reorders or resizes as the run goes, so a
 * steward reading it while the wallet works sees each line change in place (DL-072).
 */
export function RoleRemovalReview({ people, chainId, viewer }: RoleRemovalReviewProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const roleName = (role: GardenRole) => getRoleLabel(role, formatMessage).singular;
  const listRoles = (roles: GardenRole[]) =>
    intl.formatList(roles.map(roleName), { type: "conjunction" });
  // The run's own rank check names its lock; any other reason is the chain's words.
  const reasonText = (reason: string) =>
    reason === "owner-only" ? formatMessage({ id: "admin.manageRoles.lock.ownerOnly" }) : reason;

  return (
    <ul
      data-component="RoleRemovalReview"
      className="divide-y divide-stroke-soft rounded-(--gg-row-radius) border border-stroke-soft bg-bg-white px-3"
    >
      {people.map(({ person, pairs }) => {
        // What they keep counts a picked role as going until the run proves otherwise.
        const going = pairs.filter((pair) => !STILL_HELD.has(pair.status)).map((pair) => pair.role);
        const kept = rolesKept(person, going);
        const covering = going
          .map((role) => coveringRole(role, kept))
          .find((role): role is GardenRole => role !== null);
        return (
          <li key={person.address} className="flex items-start gap-3 py-2.5">
            <PersonAvatar address={person.address} chainId={chainId} size="sm" />
            <AddressDisplay address={person.address} list>
              {(name) => (
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex min-w-0 items-center gap-2">
                    <span
                      className="truncate type-title-sm text-text-strong"
                      title={`${name} · ${person.address}`}
                    >
                      {name}
                    </span>
                    {viewer && viewer.toLowerCase() === person.address.toLowerCase() ? (
                      <YouTag />
                    ) : null}
                  </p>
                  <ul className="space-y-1">
                    {pairs.map((pair) => (
                      <li key={pair.role} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "type-body font-medium text-text-strong",
                              pair.status === "alreadyRemoved" && "text-text-soft line-through"
                            )}
                          >
                            {formatMessage(
                              { id: "admin.manageRoles.row.remove" },
                              { role: roleName(pair.role) }
                            )}
                          </p>
                          {pair.reason &&
                          (pair.status === "refused" || pair.status === "failed") ? (
                            <p
                              className="line-clamp-2 type-meta text-error-dark"
                              title={reasonText(pair.reason)}
                            >
                              {reasonText(pair.reason)}
                            </p>
                          ) : null}
                        </div>
                        <PairState status={pair.status} />
                      </li>
                    ))}
                  </ul>
                  <p className="type-meta text-text-sub">
                    {kept.length > 0
                      ? formatMessage(
                          { id: "admin.manageRoles.row.keeps" },
                          { roles: listRoles(kept) }
                        )
                      : formatMessage({ id: "admin.manageRoles.row.leaves" })}
                  </p>
                  {covering ? (
                    <p className="type-meta text-text-sub">
                      {formatMessage(
                        { id: "admin.manageRoles.row.covered" },
                        { role: roleName(covering) }
                      )}
                    </p>
                  ) : null}
                </div>
              )}
            </AddressDisplay>
          </li>
        );
      })}
    </ul>
  );
}
