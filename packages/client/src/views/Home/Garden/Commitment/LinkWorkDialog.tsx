import {
  type Action,
  type CommitmentRequirementRecord,
  DialogShell,
  StatusBadge,
  type Work,
} from "@green-goods/shared";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";

export interface LinkWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The reader's own work in this garden that could be linked. */
  works: Work[];
  requirements: CommitmentRequirementRecord[];
  actions: Action[];
  chainId: number;
  /** A row the caller already chose, from the standing not-yet-linked row. */
  preselected?: { workUID: string; requirementIndex: number } | null;
  isPending: boolean;
  /**
   * The operation id is minted here, once per selection, and travels with the
   * confirm: the queue derives its dedup key from it, so a double tap before
   * the pending state re-renders must hand over the same id both times.
   */
  onConfirm: (workUID: string, requirementIndex: number, clientOperationId: string) => void;
}

/**
 * The link picker: one of the member's own submissions in this garden, and the
 * exact requirement row it fulfils. Repeated action UIDs never fall back to
 * first-match; the row is a choice whenever there is more than one.
 */
export function LinkWorkDialog({
  open,
  onOpenChange,
  works,
  requirements,
  actions,
  chainId,
  preselected = null,
  isPending,
  onConfirm,
}: LinkWorkDialogProps) {
  const { formatMessage, formatDate } = useIntl();
  const [workUID, setWorkUID] = useState<string | null>(null);
  const [requirementIndex, setRequirementIndex] = useState<number | null>(null);
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());

  // Each opening starts from what the caller handed over, or from nothing,
  // and is a new operation. A link after an unlink is a new act too.
  useEffect(() => {
    if (!open) return;
    setWorkUID(preselected?.workUID ?? null);
    setRequirementIndex(preselected?.requirementIndex ?? (requirements.length === 1 ? 0 : null));
    setOperationId(crypto.randomUUID());
  }, [open, preselected, requirements.length]);

  const actionTitle = (actionUID: number | bigint) =>
    actions.find((action) => action.id === `${chainId}-${actionUID.toString()}`)?.title ??
    formatMessage({ id: "app.commitment.work.unknownAction" });
  const statusLabel = (status: Work["status"]) =>
    formatMessage({
      id:
        status === "approved" || status === "pending" || status === "rejected"
          ? `app.work.status.${status}`
          : "app.commitment.work.statusOther",
    });

  // The contract pairs a work with a row of the same action and rejects any
  // other pairing with `WorkActionMismatch`, so only the rows that match the
  // chosen work are offered. With exactly one match the row needs no choice.
  const chosenWork = works.find((work) => work.id === workUID) ?? null;
  const eligibleRows = chosenWork
    ? requirements.filter((row) => Number(row.actionUID) === Number(chosenWork.actionUID))
    : requirements;
  const chosenRow =
    eligibleRows.length === 1
      ? eligibleRows[0]
      : requirementIndex === null
        ? null
        : (eligibleRows.find((row) => row.requirementIndex === requirementIndex) ?? null);
  const canConfirm = Boolean(workUID) && chosenRow !== null && !isPending;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      title={formatMessage({ id: "app.commitment.link.title" })}
      description={formatMessage({ id: "app.commitment.link.body" })}
      size="md"
    >
      <div className="space-y-4">
        {works.length === 0 ? (
          <p className="text-sm text-text-sub-600">
            {formatMessage({ id: "app.commitment.link.empty" })}
          </p>
        ) : (
          <fieldset>
            <legend className="text-sm font-medium text-text-strong-950">
              {formatMessage({ id: "app.commitment.link.work" })}
            </legend>
            <ul className="mt-2 space-y-2">
              {works.map((work) => {
                const selected = workUID?.toLowerCase() === work.id.toLowerCase();
                const id = `link-work-${work.id.toLowerCase()}`;
                return (
                  <li
                    key={work.id}
                    className={
                      selected
                        ? "flex items-center gap-3 rounded-[var(--radius-lg)] border border-primary-alpha-24 bg-primary-alpha-10 p-3"
                        : "flex items-center gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3"
                    }
                  >
                    <input
                      id={id}
                      type="radio"
                      name="link-work"
                      checked={selected}
                      onChange={() => {
                        setWorkUID(work.id);
                        setOperationId(crypto.randomUUID());
                      }}
                      className="accent-[var(--color-primary)]"
                    />
                    <label
                      htmlFor={id}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-text-strong-950">
                          {actionTitle(work.actionUID)}
                        </span>
                        <span className="block text-xs text-text-sub-600">
                          {formatDate(new Date(work.createdAt), { month: "short", day: "numeric" })}
                        </span>
                      </span>
                      <StatusBadge
                        size="sm"
                        variant={work.status === "approved" ? "success" : "warning"}
                      >
                        {statusLabel(work.status)}
                      </StatusBadge>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        {eligibleRows.length > 1 ? (
          <div>
            <label className="block text-sm font-medium text-text-strong-950" htmlFor="link-row">
              {formatMessage({ id: "app.commitment.link.row" })}
            </label>
            <select
              id="link-row"
              value={requirementIndex ?? ""}
              onChange={(event) => {
                setRequirementIndex(event.target.value === "" ? null : Number(event.target.value));
                setOperationId(crypto.randomUUID());
              }}
              className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
            >
              <option value="">{formatMessage({ id: "app.commitment.link.rowChoose" })}</option>
              {eligibleRows.map((row) => (
                <option key={row.id} value={row.requirementIndex}>
                  {formatMessage(
                    { id: "app.commitment.link.rowOption" },
                    {
                      action: actionTitle(row.actionUID),
                      done: Math.min(row.approvedCount, row.requiredCount),
                      of: row.requiredCount,
                    }
                  )}
                </option>
              ))}
            </select>
          </div>
        ) : chosenRow ? (
          <p className="text-sm text-text-sub-600">
            {formatMessage(
              { id: "app.commitment.link.rowBound" },
              { action: actionTitle(chosenRow.actionUID) }
            )}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canConfirm}
          aria-busy={isPending}
          onClick={() => {
            if (workUID && chosenRow) onConfirm(workUID, chosenRow.requirementIndex, operationId);
          }}
          className="w-full rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
        >
          {formatMessage({ id: "app.commitment.link.confirm" })}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onOpenChange(false)}
          className="w-full rounded-[var(--radius-lg)] px-4 py-3 text-sm font-medium text-text-sub-600 tap-target-lg"
        >
          {formatMessage({ id: "app.commitment.link.cancel" })}
        </button>
      </div>
    </DialogShell>
  );
}
