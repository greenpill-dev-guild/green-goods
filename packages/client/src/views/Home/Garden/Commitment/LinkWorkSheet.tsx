import type { Action, Work } from "@green-goods/shared/types/domain";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import { type CommitmentRequirementRecord } from "@green-goods/shared/commitment-pooling";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";

export interface LinkWorkSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The reader's own work in this garden that could be linked. */
  works: Work[];
  requirements: CommitmentRequirementRecord[];
  actions: Action[];
  chainId: number;
  /** A row the caller already chose, from the standing not-yet-linked row. */
  preselected?: { workUID: string; requirementIndex: number | null } | null;
  isPending: boolean;
  /** Starts a Work submission already scoped to one exact requirement row. */
  onSubmitRequirement: (requirement: CommitmentRequirementRecord) => void;
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
export function LinkWorkSheet({
  open,
  onOpenChange,
  works,
  requirements,
  actions,
  chainId,
  preselected = null,
  isPending,
  onSubmitRequirement,
  onConfirm,
}: LinkWorkSheetProps) {
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
  const eligibleWorks = works.filter((work) =>
    requirements.some((row) => Number(row.actionUID) === Number(work.actionUID))
  );
  const chosenWork = eligibleWorks.find((work) => work.id === workUID) ?? null;
  const eligibleRows = chosenWork
    ? requirements.filter((row) => Number(row.actionUID) === Number(chosenWork.actionUID))
    : requirements;
  const chosenRow =
    eligibleRows.length === 1
      ? eligibleRows[0]
      : requirementIndex === null
        ? null
        : (eligibleRows.find((row) => row.requirementIndex === requirementIndex) ?? null);
  const canConfirm = chosenWork !== null && chosenRow !== null && !isPending;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      title={formatMessage({ id: "app.commitment.link.title" })}
      description={formatMessage({ id: "app.commitment.link.body" })}
      size="md"
      sheetSize="tall"
      actions={{
        primary: {
          label: formatMessage({ id: "app.commitment.link.confirm" }),
          disabled: !canConfirm,
          loading: isPending,
          onClick: () => {
            if (chosenWork && chosenRow)
              onConfirm(chosenWork.id, chosenRow.requirementIndex, operationId);
          },
        },
        secondary: {
          label: formatMessage({ id: "app.commitment.link.cancel" }),
          disabled: isPending,
          onClick: () => onOpenChange(false),
        },
      }}
    >
      <div className="space-y-4">
        {eligibleWorks.length === 0 ? (
          <p className="text-sm text-text-sub-600">
            {formatMessage({ id: "app.commitment.link.empty" })}
          </p>
        ) : (
          <fieldset disabled={isPending}>
            <SheetHeading as="legend">
              {formatMessage({ id: "app.commitment.link.work" })}
            </SheetHeading>
            <ul className="mt-2 space-y-2">
              {eligibleWorks.map((work) => {
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
                      className="accent-primary-on-surface"
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

        {chosenWork && eligibleRows.length > 1 ? (
          <fieldset disabled={isPending}>
            <SheetHeading as="legend">
              {formatMessage({ id: "app.commitment.link.row" })}
            </SheetHeading>
            <div className="mt-2 space-y-2">
              {eligibleRows.map((row) => (
                <label
                  key={row.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3 text-sm text-text-strong-950 focus-within:ring-2 focus-within:ring-primary-on-surface"
                >
                  <input
                    type="radio"
                    name="link-requirement"
                    value={row.requirementIndex}
                    checked={requirementIndex === row.requirementIndex}
                    onChange={() => {
                      setRequirementIndex(row.requirementIndex);
                      setOperationId(crypto.randomUUID());
                    }}
                    className="shrink-0 accent-primary-on-surface"
                  />
                  <span>
                    {formatMessage(
                      { id: "app.commitment.link.rowOptionNamed" },
                      {
                        requirement: row.requirementIndex + 1,
                        action: actionTitle(row.actionUID),
                        done: Math.min(row.approvedCount, row.requiredCount),
                        of: row.requiredCount,
                      }
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : chosenWork && chosenRow ? (
          <p className="text-sm text-text-sub-600">
            {formatMessage(
              { id: "app.commitment.link.rowBound" },
              { action: actionTitle(chosenRow.actionUID) }
            )}
          </p>
        ) : null}

        <section>
          <SheetHeading>{formatMessage({ id: "app.commitment.link.newWork" })}</SheetHeading>
          <ul
            className="mt-2 space-y-2"
            aria-label={formatMessage({ id: "app.commitment.link.rows" })}
          >
            {requirements.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  data-pressable="row"
                  onClick={() => onSubmitRequirement(row)}
                  disabled={isPending}
                  aria-label={formatMessage(
                    { id: "app.commitment.link.submitRequirement" },
                    { requirement: row.requirementIndex + 1 }
                  )}
                  className="w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 px-4 py-3 text-left text-sm font-medium text-text-strong-950 tap-target-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-on-surface"
                >
                  {formatMessage({ id: "app.commitment.link.submitRequirementCta" })}
                  <span className="mt-0.5 block text-xs font-normal text-text-sub-600">
                    {formatMessage(
                      { id: "app.commitment.link.rowOptionNamed" },
                      {
                        requirement: row.requirementIndex + 1,
                        action: actionTitle(row.actionUID),
                        done: Math.min(row.approvedCount, row.requiredCount),
                        of: row.requiredCount,
                      }
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DialogShell>
  );
}
