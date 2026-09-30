import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { RiArrowRightSLine } from "@remixicon/react";
import { Fragment, type ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminListRow } from "@/components/AdminListRow";
import { PersonName } from "@/components/PersonName";
import { ClaimantName } from "../ClaimantName";
import { commitmentStateChip } from "../poolPresentation";
import { dueDateText, timelineTime } from "../poolTime";
import type { GroupTakenRow } from "./groupInspectorModel";

export interface GroupPeopleListProps {
  /** The copies someone took, in the order to show them. */
  taken: readonly GroupTakenRow[];
  /** The copies nobody has taken. */
  available: readonly CommitmentReadModel[];
  /** The filter keeps the not-taken row. */
  showAvailable: boolean;
  chainId: number;
  /** The group carries a G$ reward, so each row says whether it was paid. */
  rewarded: boolean;
  onOpenCommitment: (commitment: CommitmentReadModel) => void;
}

/**
 * The group inspector's list (PRD-1022 screen 14): each row leads with the
 * person who took the copy, with when they took it, where the proof stands,
 * who confirmed it and whether the reward was paid, and its state on the
 * right; the copies nobody has taken share one row. No copy numbers. Every
 * row opens that promise's own inspector.
 */
export function GroupPeopleList({
  taken,
  available,
  showAvailable,
  chainId,
  rewarded,
  onOpenCommitment,
}: GroupPeopleListProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const now = Date.now();

  const facts = (row: GroupTakenRow): ReactNode[] => {
    const { commitment } = row;
    const line: ReactNode[] = [];
    if (row.tookAt !== null) {
      line.push(
        formatMessage(
          { id: "cockpit.garden.pool.group.tookIt", defaultMessage: "Took it {when}" },
          { when: timelineTime(intl, row.tookAt, now) }
        )
      );
    }
    if (commitment.evidenceCount === 0) {
      line.push(
        formatMessage({ id: "cockpit.garden.pool.group.noProof", defaultMessage: "No proof yet" })
      );
    } else if (row.proofAt !== null) {
      line.push(
        formatMessage(
          { id: "cockpit.garden.pool.group.proofAt", defaultMessage: "Proof {when}" },
          { when: timelineTime(intl, row.proofAt, now) }
        )
      );
    }
    if (row.bucket === "kept" && row.confirmedBy && row.confirmedAt !== null) {
      line.push(
        formatMessage(
          {
            id: "cockpit.garden.pool.group.confirmedBy",
            defaultMessage: "Confirmed by {who}, {when}",
          },
          {
            who: <PersonName key="who" address={row.confirmedBy} className="font-normal" />,
            when: timelineTime(intl, row.confirmedAt, now),
          }
        )
      );
    } else if (row.bucket === "inProgress") {
      line.push(
        commitment.evidenceCount === 0 && commitment.dueDate
          ? formatMessage(
              { id: "cockpit.garden.pool.row.due", defaultMessage: "due {date}" },
              { date: dueDateText(intl, Number(commitment.dueDate) * 1000, now) }
            )
          : formatMessage({
              id: "cockpit.garden.pool.group.notConfirmed",
              defaultMessage: "Not confirmed yet",
            })
      );
    }
    if (rewarded && row.bucket !== "ended") {
      line.push(
        commitment.considerationPaid
          ? formatMessage({
              id: "cockpit.garden.pool.group.rewardPaid",
              defaultMessage: "Reward paid",
            })
          : formatMessage({
              id: "cockpit.garden.pool.group.rewardUnpaid",
              defaultMessage: "Reward not paid yet",
            })
      );
    }
    if (row.nth > 1) {
      line.push(
        formatMessage(
          {
            id: "cockpit.garden.pool.group.repeat",
            defaultMessage:
              "{nth, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} from this group",
          },
          { nth: row.nth }
        )
      );
    }
    return line;
  };

  return (
    <ul className="divide-y divide-stroke-soft" data-testid="group-people">
      {taken.map((row) => {
        const chip = commitmentStateChip(row.commitment, formatMessage);
        return (
          <li key={row.commitment.id}>
            <AdminListRow
              onClick={() => onOpenCommitment(row.commitment)}
              className="flex items-center gap-3 rounded-[var(--m3-shape-sm)] border-0 bg-transparent px-1 py-2"
            >
              <span className="min-w-0 flex-1">
                {row.commitment.counterparty ? (
                  <ClaimantName
                    chainId={chainId}
                    claim={{
                      claimant: row.commitment.counterparty,
                      claimType:
                        row.commitment.counterpartyKind === "GARDEN" ? "GARDEN" : "INDIVIDUAL",
                    }}
                  />
                ) : null}
                <span className="mt-0.5 block body-xs text-text-sub">
                  {facts(row).map((fact, index) => (
                    <Fragment key={index}>
                      {index > 0 ? <span aria-hidden="true"> · </span> : null}
                      {fact}
                    </Fragment>
                  ))}
                </span>
              </span>
              <StatusBadge variant={chip.variant} size="sm">
                {chip.label}
              </StatusBadge>
              <RiArrowRightSLine className="h-4 w-4 shrink-0 text-text-soft" aria-hidden />
            </AdminListRow>
          </li>
        );
      })}
      {showAvailable ? (
        <li>
          <AdminListRow
            onClick={() => onOpenCommitment(available[0] as CommitmentReadModel)}
            className="flex items-center gap-3 rounded-[var(--m3-shape-sm)] border-0 bg-transparent px-1 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block body-sm font-semibold text-text-strong">
                {formatMessage(
                  {
                    id: "cockpit.garden.pool.group.notTaken",
                    defaultMessage: "{count} not taken up yet",
                  },
                  { count: available.length }
                )}
              </span>
              <span className="mt-0.5 block body-xs text-text-sub">
                {formatMessage({
                  id: "cockpit.garden.pool.group.anyone",
                  defaultMessage: "Anyone in the garden can take one up",
                })}
              </span>
            </span>
            <StatusBadge variant="info" size="sm">
              {formatMessage({
                id: "cockpit.garden.pool.group.availableChip",
                defaultMessage: "Available",
              })}
            </StatusBadge>
            <RiArrowRightSLine className="h-4 w-4 shrink-0 text-text-soft" aria-hidden />
          </AdminListRow>
        </li>
      ) : null}
    </ul>
  );
}
