import { Button } from "@green-goods/shared/components/Button";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useEditConfirmers } from "@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController";
import {
  type ConfirmerEditCopy,
  type ConfirmerRule,
  confirmerRuleError,
  sameConfirmerRule,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Address } from "@green-goods/shared/types/domain";
import { useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminDialog } from "@/components/AdminDialog";
import { FlowStatusRow } from "@/components/Layout/FlowStatusRow";
import { GardenPoolTarget } from "../PoolTarget";
import { ConfirmerGroupEditor } from "../Seed/SeedConfirmerList";
import { seedMembers } from "../Seed/seedStepModel";
import { editConfirmersStatus } from "./editConfirmersStatus";
import { confirmerRuleText } from "./groupTerms";

/** Copies a batching wallet changes per request, as Shared sends them (`sendConfirmerEdit`). */
const PER_APPROVAL = 50;

export interface EditConfirmersDialogProps {
  open: boolean;
  onClose: () => void;
  /** Every copy took the new confirmers: close back to the inspector, and say so. */
  onChanged: (count: number) => void;
  chainId: number;
  garden: Address;
  isProtocol?: boolean;
  /** The group's title, or the single promise's. */
  title: string;
  /** The copies nobody has taken: the ones this changes, each with its own team fallback. */
  available: readonly ConfirmerEditCopy[];
  /** Their rule now, read from a copy nobody has taken. */
  current: Pick<CommitmentReadModel, "confirmers" | "confirmationThreshold">;
  /** Whether the available copies disagree, after an earlier change that didn't finish. */
  mixed?: boolean;
  /** Who confirms when nobody is named depends on which way the promise runs. */
  direction: CommitmentReadModel["direction"];
  /** How many were taken up: they keep the confirmers they were taken up under. */
  taken: number;
}

/**
 * Edit Confirmers: one named group and threshold for every copy nobody has
 * taken, for a group or a single promise, so a steward can name an account
 * that replaced a lost one. Taken copies keep the rule they were taken up
 * under, because the contract fixes it at take-up. Once any copy may carry the
 * new rule, the list locks, so a Try Again sends the same one. Mount it when it
 * opens: the list starts from `current` at mount.
 */
export function EditConfirmersDialog({
  open,
  onClose,
  onChanged,
  chainId,
  garden,
  isProtocol,
  title,
  available,
  current,
  mixed = false,
  direction,
  taken,
}: EditConfirmersDialogProps) {
  const { formatMessage } = useIntl();
  const edit = useEditConfirmers({ chainId });
  const { data: gardens } = useGardens(chainId);
  const members = useMemo(
    () => seedMembers(gardens?.find((entry) => entry.id.toLowerCase() === garden.toLowerCase())),
    [gardens, garden]
  );
  // The list starts from the rule at mount, never after: a change that lands moves it.
  const [confirmers, setConfirmersState] = useState<string[]>(() => [...current.confirmers]);
  const [threshold, setThreshold] = useState(() => current.confirmationThreshold ?? 1);
  const [error, setError] = useState<string | null>(null);
  // A name still being looked up isn't in the list yet, so saving waits for it.
  const [adding, setAdding] = useState(false);
  // The latest list, for a name that resolves after other changes.
  const latest = useRef<string[]>(confirmers);
  // The rule of the first change, kept for every Try Again.
  const sent = useRef<ConfirmerRule | null>(null);
  const setConfirmers = (next: string[]) => {
    latest.current = next;
    setConfirmersState(next);
  };

  const status = editConfirmersStatus({
    mode: edit.mode,
    isSending: edit.isSending,
    copies: edit.copies,
    available: available.length,
    taken,
    formatMessage,
  });
  // Once any copy may carry the new rule, the rest must get the same one.
  const locked = status.phase === "partial" || status.phase === "unconfirmed";
  const retrying = status.retry.length > 0;
  const draft: ConfirmerRule = { confirmers: confirmers as Address[], threshold };
  const now: ConfirmerRule = {
    confirmers: current.confirmers,
    threshold: current.confirmationThreshold ?? 1,
  };
  const ruleError = confirmerRuleError(draft);
  const ruleMessage =
    ruleError === "hub.garden.pool.seed.error.confirmersTooMany"
      ? formatMessage({
          id: "hub.garden.pool.seed.error.confirmersTooMany",
          defaultMessage: "That is more confirmers than one promise can name.",
        })
      : ruleError === "hub.garden.pool.seed.error.thresholdAtLeastOne"
        ? formatMessage({
            id: "hub.garden.pool.seed.error.thresholdAtLeastOne",
            defaultMessage: "At least one confirmation is needed.",
          })
        : ruleError === "hub.garden.pool.seed.error.thresholdAboveGroup"
          ? formatMessage({
              id: "hub.garden.pool.seed.error.thresholdAboveGroup",
              defaultMessage: "That asks for more confirmations than there are named confirmers.",
            })
          : null;
  const unchanged = !locked && !retrying && !mixed && sameConfirmerRule(draft, now);
  const blocked =
    ruleMessage ??
    (unchanged
      ? formatMessage({
          id: "hub.garden.pool.confirmers.unchanged",
          defaultMessage: "Change the list or the number to save.",
        })
      : null);
  const count = retrying ? status.retry.length : available.length;

  const change = async () => {
    setError(null);
    const rule = locked && sent.current ? sent.current : draft;
    sent.current = rule;
    const targets = retrying
      ? available.filter((copy) => status.retry.includes(copy.commitmentId))
      : available;
    const outcome = await edit.change(targets, rule);
    if (outcome === "changed") onChanged(available.length);
    if (outcome === "blocked") {
      setError(
        formatMessage({
          id: "hub.garden.pool.reward.blocked",
          defaultMessage: "Nothing could be sent from here. Check your wallet, then try again.",
        })
      );
    }
  };

  const summary: Array<[string, string]> = [
    [
      formatMessage(
        { id: "hub.garden.pool.reward.availableRow", defaultMessage: "{count} available" },
        { count: available.length }
      ),
      formatMessage(
        { id: "hub.garden.pool.confirmers.fromTo", defaultMessage: "{from} → {to}" },
        {
          from: confirmerRuleText(formatMessage, current),
          to: ruleError
            ? "—"
            : confirmerRuleText(formatMessage, {
                confirmers: draft.confirmers,
                confirmationThreshold: draft.threshold,
              }),
        }
      ),
    ],
  ];
  if (taken > 0) {
    summary.push([
      formatMessage(
        { id: "hub.garden.pool.reward.takenRow", defaultMessage: "{count} taken" },
        { count: taken }
      ),
      formatMessage({
        id: "hub.garden.pool.confirmers.takenKeep",
        defaultMessage: "Unchanged, as taken up",
      }),
    ]);
  }

  const note =
    status.phase === "asking"
      ? formatMessage({
          id: "hub.garden.pool.seed.note.waiting",
          defaultMessage: "The dialog stays open until your wallet answers.",
        })
      : status.busy
        ? null
        : (error ??
          blocked ??
          (edit.mode === "one-by-one"
            ? formatMessage(
                {
                  id: "hub.garden.pool.seed.note.oneByOne",
                  defaultMessage:
                    "{count, plural, one {Your wallet will ask you once.} =2 {Your wallet will ask you twice, one after the other.} other {Your wallet will ask you # times, one after another.}}",
                },
                { count }
              )
            : count <= PER_APPROVAL
              ? formatMessage(
                  {
                    id: "hub.garden.pool.seed.note.bundle",
                    defaultMessage:
                      "{count, plural, one {Your wallet will ask you once.} other {Your wallet will ask you once, for all #.}}",
                  },
                  { count }
                )
              : formatMessage(
                  {
                    id: "hub.garden.pool.reward.note.bundles",
                    defaultMessage: "Your wallet will ask you {requests} times, once for every 50.",
                  },
                  { requests: Math.ceil(count / PER_APPROVAL) }
                )));

  const footer =
    status.phase === "changed" ? (
      <Button
        type="button"
        emphasis="primary"
        size="sm"
        onClick={() => onChanged(available.length)}
      >
        {formatMessage({ id: "app.common.done", defaultMessage: "Done" })}
      </Button>
    ) : (
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <p className="min-w-0 type-meta text-text-soft sm:flex-1">
          {note ? <span role="status">{note}</span> : null}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            emphasis="tertiary"
            size="sm"
            onClick={onClose}
            disabled={status.busy}
          >
            {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
          </Button>
          <Button
            type="button"
            emphasis="primary"
            size="sm"
            onClick={() => void change()}
            disabled={status.busy || adding || (!locked && Boolean(blocked))}
            loading={status.busy}
            className="w-full sm:w-auto"
          >
            {retrying
              ? status.phase === "partial"
                ? formatMessage(
                    {
                      id: "hub.garden.pool.seed.tryAgainCount",
                      defaultMessage: "Try Again ({count})",
                    },
                    { count }
                  )
                : formatMessage({ id: "hub.garden.pool.setup.retry", defaultMessage: "Try Again" })
              : formatMessage(
                  {
                    id: "hub.garden.pool.confirmers.change",
                    defaultMessage:
                      "{count, plural, one {Change Confirmers} other {Change Confirmers on # Promises}}",
                  },
                  { count }
                )}
          </Button>
        </div>
      </div>
    );

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="lg"
      tone="garden"
      preventClose={status.busy}
      title={formatMessage({
        id: "hub.garden.pool.confirmers.title",
        defaultMessage: "Edit Confirmers",
      })}
      target={
        <GardenPoolTarget
          chainId={chainId}
          garden={garden}
          isProtocol={isProtocol}
          record={title}
        />
      }
      actions={footer}
    >
      <div className="space-y-4" data-testid="edit-confirmers">
        <FlowStatusRow
          tone={status.tone}
          busy={status.busy}
          title={status.title}
          description={status.description}
          progress={status.progress}
          summary={summary}
        />
        <ConfirmerGroupEditor
          draft={{
            confirmers,
            threshold,
            read: () => latest.current,
            setConfirmers,
            setThreshold,
            errors: {
              confirmers:
                ruleError === "hub.garden.pool.seed.error.confirmersTooMany"
                  ? (ruleMessage ?? undefined)
                  : undefined,
              threshold:
                ruleError && ruleError !== "hub.garden.pool.seed.error.confirmersTooMany"
                  ? (ruleMessage ?? undefined)
                  : undefined,
            },
          }}
          ordinaryNote={
            direction === "REQUEST"
              ? formatMessage({
                  id: "hub.garden.pool.confirmers.ordinaryRequest",
                  defaultMessage: "Nobody named: the one who asked confirms it.",
                })
              : formatMessage({
                  id: "hub.garden.pool.seed.confirmersDefaultOffer",
                  defaultMessage: "Nobody named: whoever takes this up confirms it.",
                })
          }
          busy={status.busy || locked}
          members={members}
          onAddingChange={setAdding}
        />
      </div>
    </AdminDialog>
  );
}
