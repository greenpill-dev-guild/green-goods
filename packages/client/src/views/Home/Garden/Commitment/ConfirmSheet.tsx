import {
  type Address,
  AddressDisplay,
  Alert,
  type CommitmentContributorRecord,
  type CommitmentReadModel,
  type CommitmentRequirementRecord,
  DialogShell,
  useCommitmentNotYetDraft,
  type EvidenceAttributionRow,
  useCommitmentEvidence,
} from "@green-goods/shared";
import {
  RiCheckboxCircleFill,
  RiCheckLine,
  RiImageLine,
  RiShieldCheckLine,
  RiTimeLine,
} from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

import { EvidencePreview } from "./EvidencePreview";

import { ConfirmNotYet } from "./ConfirmNotYet";
import { Meter, Provenance } from "./ConfirmOutcome";
import { selectConfirmCast } from "./confirm-cast";

export { Provenance } from "./ConfirmOutcome";
export { type ConfirmCast, selectConfirmCast } from "./confirm-cast";

/** Where the sheet stands, from the record and the queue rather than a local flag. */
export type ConfirmPhase = "ask" | "pending" | "confirmed";

export interface ConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commitment: CommitmentReadModel;
  requirements: CommitmentRequirementRecord[];
  contributors: CommitmentContributorRecord[];
  /** The detail's evidence attributions, resolved to what was actually submitted. */
  evidenceAttributions?: EvidenceAttributionRow[];
  viewer: Address | null;
  isOnline: boolean;
  phase: ConfirmPhase;
  /** An act already in flight: the confirm job queued, or the dispute sending. */
  isPending: boolean;
  /** The last Not yet attempt failed to reach the chain. */
  notYetFailed: boolean;
  /**
   * Whether the chain would take a dispute from this reader. Confirming and
   * disputing are granted to different people: a steward confirming for the
   * garden that took an offer up may confirm, but raiseDispute accepts only
   * the creator, the counterparty address, a named confirmer or a steward of
   * the pool's own garden. With no way to say Not yet, the sheet says so.
   */
  canNotYet: boolean;
  onConfirm: () => void;
  onNotYet: (reason: string) => void;
  onDone: () => void;
}

export function ConfirmSheet({
  open,
  onOpenChange,
  commitment,
  requirements,
  contributors,
  evidenceAttributions = [],
  viewer,
  isOnline,
  phase,
  isPending,
  notYetFailed,
  canNotYet,
  onConfirm,
  onNotYet,
  onDone,
}: ConfirmSheetProps) {
  const { formatMessage } = useIntl();
  const cast = selectConfirmCast(commitment);
  const [mode, setMode] = useState<"ask" | "notYet">("ask");
  const { evidence, isLoading: evidenceLoading } = useCommitmentEvidence(evidenceAttributions);
  // The words of a Not yet survive closing the sheet and losing the signal.
  const { reason: draftReason, setReason: setDraftReason } = useCommitmentNotYetDraft(
    commitment.id,
    viewer
  );

  const count = commitment.confirmationCount ?? 0;
  const threshold = Math.max(commitment.confirmationThreshold ?? 1, 1);
  const named = commitment.confirmers;
  const approvedRows = requirements.filter(
    (row) => row.requiredCount > 0 && row.approvedCount >= row.requiredCount
  ).length;
  const provider = commitment.leadProvider ?? commitment.creator ?? null;
  const excludedCount = contributors.filter((entry) => entry.active).length;

  const title =
    phase === "confirmed"
      ? formatMessage({ id: "app.confirm.title.kept" })
      : phase === "pending"
        ? formatMessage({ id: "app.confirm.title.saved" })
        : mode === "notYet"
          ? formatMessage({ id: "app.confirm.title.notYet" })
          : formatMessage({ id: `app.confirm.title.${cast}` });

  const description =
    phase === "confirmed"
      ? formatMessage({ id: "app.confirm.info.confirmed" })
      : phase === "pending"
        ? formatMessage({ id: "app.confirm.info.pending" })
        : mode === "notYet"
          ? formatMessage({
              id: notYetFailed ? "app.confirm.info.notYetFailed" : "app.confirm.info.notYet",
            })
          : formatMessage({ id: "app.confirm.info.ask" });

  const sendNotYet = () => {
    const reason = draftReason.trim();
    if (!reason) return;
    onNotYet(reason);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) setMode("ask");
        onOpenChange(next);
      }}
      preventClose={isPending}
      title={title}
      description={description}
      size="md"
    >
      {phase === "confirmed" ? (
        <div className="space-y-4" data-component="ConfirmSheetKept">
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-success-light bg-success-lighter p-5 text-center">
            <RiCheckboxCircleFill className="h-8 w-8 text-success-base" aria-hidden="true" />
            <p className="text-base font-medium text-text-strong-950">
              {formatMessage({ id: "app.confirm.kept.heading" })}
            </p>
            <p className="text-sm text-text-sub-600">
              {formatMessage({ id: `app.confirm.kept.${cast}` })}
            </p>
          </div>
          <Provenance commitment={commitment} />
          <button
            type="button"
            onClick={onDone}
            className="w-full rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg"
          >
            {formatMessage({ id: "app.confirm.done" })}
          </button>
        </div>
      ) : phase === "pending" ? (
        <div className="space-y-4" data-component="ConfirmSheetPending">
          <Meter done={Math.min(count + 1, threshold)} of={threshold} includesThisDevice />
          <p className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3 text-sm text-text-strong-950">
            <RiTimeLine className="h-4 w-4 shrink-0 text-text-sub-600" aria-hidden="true" />
            {formatMessage({ id: "app.confirm.pending.row" })}
          </p>
          <Alert variant="info" className="p-3">
            {formatMessage({
              id: isOnline ? "app.confirm.pending.online" : "app.confirm.pending.offline",
            })}
          </Alert>
          <button
            type="button"
            onClick={onDone}
            className="w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 px-4 py-3 text-sm font-medium text-text-strong-950 tap-target-lg"
          >
            {formatMessage({ id: "app.confirm.done" })}
          </button>
        </div>
      ) : mode === "notYet" ? (
        <ConfirmNotYet
          cast={cast}
          draftReason={draftReason}
          setDraftReason={setDraftReason}
          isOnline={isOnline}
          isPending={isPending}
          notYetFailed={notYetFailed}
          onSend={sendNotYet}
          onBack={() => setMode("ask")}
        />
      ) : (
        <div className="space-y-4" data-component="ConfirmSheetAsk">
          <p className="text-sm text-text-sub-600">
            {provider ? (
              <span className="flex flex-wrap items-center gap-1">
                {formatMessage({ id: `app.confirm.summary.${cast}.before` })}
                <AddressDisplay address={provider} showCopyButton={false} />
                {formatMessage({ id: `app.confirm.summary.${cast}.after` })}
              </span>
            ) : (
              formatMessage({ id: `app.confirm.summary.${cast}.after` })
            )}
          </p>

          <ul className="space-y-2">
            {cast === "request-work" || cast === "offer" ? (
              <li className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3 text-sm">
                <RiCheckLine className="h-4 w-4 shrink-0 text-text-sub-600" aria-hidden="true" />
                <span>
                  <span className="block font-medium text-text-strong-950">
                    {formatMessage({ id: "app.confirm.row.approvedWork" })}
                  </span>
                  <span className="block text-xs text-text-sub-600">
                    {formatMessage(
                      { id: "app.confirm.row.approvedWorkMeta" },
                      { done: approvedRows, of: requirements.length }
                    )}
                  </span>
                </span>
              </li>
            ) : null}
            <li className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3 text-sm">
              <RiImageLine className="h-4 w-4 shrink-0 text-text-sub-600" aria-hidden="true" />
              <span>
                <span className="block font-medium text-text-strong-950">
                  {formatMessage({ id: "app.confirm.row.proof" })}
                </span>
                <span className="block text-xs text-text-sub-600">
                  {formatMessage(
                    { id: "app.confirm.row.proofMeta" },
                    { count: commitment.evidenceCount }
                  )}
                </span>
              </span>
            </li>
          </ul>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
              {formatMessage({ id: "app.confirm.evidence.title" })}
            </p>
            <EvidencePreview evidence={evidence} isLoading={evidenceLoading} />
          </div>

          <Meter done={count} of={threshold} />

          {named.length > 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3 text-sm">
              <p className="text-xs text-text-soft-400">
                {formatMessage({ id: "app.confirm.group.title" }, { threshold })}
              </p>
              <ul className="mt-2 space-y-1">
                {named.map((address) => (
                  <li key={address} className="flex items-center gap-2">
                    <AddressDisplay address={address} showCopyButton={false} />
                    {viewer && address.toLowerCase() === viewer.toLowerCase() ? (
                      <span className="rounded-full bg-warning-lighter px-2 py-0.5 text-[10px] font-medium text-warning-dark">
                        {formatMessage({ id: "app.confirm.group.yourTurn" })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="flex items-start gap-2 rounded-[var(--radius-lg)] bg-bg-weak-50 p-3 text-xs text-text-sub-600">
            <RiShieldCheckLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {formatMessage({ id: `app.confirm.exclusion.${cast}` }, { count: excludedCount })}
          </p>

          {!canNotYet ? (
            <p className="text-xs text-text-sub-600">
              {formatMessage({ id: "app.confirm.notYet.unavailable" })}
            </p>
          ) : null}
          <div className={canNotYet ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
            {canNotYet ? (
              <button
                type="button"
                onClick={() => setMode("notYet")}
                disabled={isPending}
                className="rounded-[var(--radius-lg)] border border-stroke-soft-200 px-4 py-3 text-sm font-medium text-text-strong-950 tap-target-lg disabled:opacity-60"
              >
                {formatMessage({ id: "app.confirm.notYet.act" })}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              aria-busy={isPending}
              className="rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
            >
              {formatMessage({ id: `app.confirm.act.${cast}` })}
            </button>
          </div>
        </div>
      )}
    </DialogShell>
  );
}
