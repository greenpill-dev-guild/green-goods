import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import {
  type CommitmentsToConfirm,
  isCapturedCommitment,
  selectConfirmQueueRows,
  useCommitmentMetadata,
} from "@green-goods/shared/commitment-pooling";
import { RiShieldCheckLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";

import { CommitmentRow, CommitmentStateLadder } from "@/components/Features/Commitments";
import { PWA_DRAWER_SCROLL_CLASSNAME } from "@/components/Pwa/drawerScrollStyles";

export interface ToConfirmTabProps {
  toConfirm: CommitmentsToConfirm;
  /** Where a row goes when tapped: the commitment, in the garden it is for. */
  onOpenCommitment: (gardenAddress: string, commitmentId: bigint) => void;
}

/**
 * What reaches the reader as a steward of their gardens, not as a counterparty.
 *
 * A garden claim is confirmed by the garden, which means its Hat wearers; a
 * commitment recorded on someone's behalf is the same. None of this is in the
 * reader's own ledger, so nothing here repeats a Live row, and the tab says so
 * in its first line. Confirming itself is an online act on the commitment's
 * own screen, which is where every row leads.
 */
export function ToConfirmTab({ toConfirm, onOpenCommitment }: ToConfirmTabProps) {
  const { formatMessage } = useIntl();
  const isOnline = useOnlineStatus();
  const { byCID } = useCommitmentMetadata(
    useMemo(
      () => toConfirm.groups.flatMap((group) => group.rows.map((row) => row.commitment)),
      [toConfirm.groups]
    )
  );
  const groups = useMemo(() => {
    const rows = selectConfirmQueueRows({
      toConfirm,
      byCID,
      search: "",
      include: ["ORDINARY"],
    });
    return rows.reduce<Array<{ garden: string; gardenName: string; rows: typeof rows }>>(
      (result, row) => {
        const group = result.find((candidate) => candidate.garden === row.garden);
        if (group) group.rows.push(row);
        else result.push({ garden: row.garden, gardenName: row.gardenName, rows: [row] });
        return result;
      },
      []
    );
  }, [toConfirm, byCID]);

  return (
    <CommitmentStateLadder
      availability={toConfirm.availability}
      isLoading={toConfirm.isLoading}
      isError={toConfirm.isError}
      isOnline={isOnline}
      isEmpty={toConfirm.count === 0}
      onRetry={() => void toConfirm.refetch()}
      regionClassName={PWA_DRAWER_SCROLL_CLASSNAME}
      copy={{
        loadingId: "app.commitments.toConfirm.loading",
        errorId: "app.commitments.toConfirm.error",
        emptyTitleId: "app.commitments.toConfirm.emptyTitle",
        emptyDescriptionId: "app.commitments.toConfirm.emptyDescription",
      }}
    >
      <p className="text-xs text-text-sub-600">
        {formatMessage({ id: "app.commitments.toConfirm.intro" })}
      </p>

      {groups.map((group) => (
        <div key={group.garden} data-component="ToConfirmGroup">
          <h4
            className="mb-2 truncate text-xs font-medium uppercase tracking-wide text-text-soft-400"
            title={group.gardenName}
          >
            {group.gardenName}
          </h4>
          <div className="space-y-2">
            {group.rows.map((row) => {
              const captured = isCapturedCommitment(row.commitment);
              return (
                <div key={row.commitment.id} className="space-y-1">
                  <CommitmentRow
                    row={{ commitment: row.commitment, seat: "confirmer", needsYou: true }}
                    title={row.title}
                    onOpen={(id) => onOpenCommitment(group.garden, id)}
                  />
                  <div className="flex gap-1 px-1">
                    <StatusBadge size="sm" variant="neutral">
                      {formatMessage({
                        id: captured
                          ? "app.commitments.toConfirm.captured"
                          : "app.commitments.toConfirm.gardenClaim",
                      })}
                    </StatusBadge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="flex items-start gap-2 rounded-[var(--radius-lg)] bg-bg-weak-50 p-3 text-xs text-text-sub-600">
        <RiShieldCheckLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {formatMessage({ id: "app.commitments.toConfirm.rule" })}
      </p>
    </CommitmentStateLadder>
  );
}
