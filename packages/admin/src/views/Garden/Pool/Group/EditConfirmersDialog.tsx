import type { SheetActionsProps } from "@green-goods/shared/components/Dialog/SheetActions";
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
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { Fragment, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminDialog } from "@/components/AdminDialog";
import { FlowStatusRow } from "@/components/Layout/FlowStatusRow";
import { PersonName } from "@/components/PersonName";
import { GardenPoolTarget } from "../PoolTarget";
import { ConfirmerGroupEditor } from "../Seed/SeedConfirmerList";
import { seedMembers } from "../Seed/seedStepModel";
import {
  confirmerRuleMessage,
  editConfirmersStatus,
  editConfirmersSummary,
} from "./editConfirmersStatus";
import { confirmerRuleText, confirmersSplitText } from "./groupTerms";

/** Copies a batching wallet changes per request, as Shared sends them (`sendConfirmerEdit`). */
const PER_APPROVAL = 50;

/**
 * The people a confirmer change names, on one line: each by the name the Hub
 * shows them under, with a short address after a name so two people who share
 * one can be told apart. Someone with no name shows as their short address.
 */
function ConfirmerNames({ addresses }: { addresses: readonly Address[] }) {
  return addresses.map((address, index) => (
    <Fragment key={address}>
      {index > 0 ? ", " : null}
      <PersonName address={address}>
        {(name) => (
          <span title={address}>
            {name.startsWith("0x")
              ? name
              : `${name} (${formatAddress(address, { variant: "card" })})`}
          </span>
        )}
      </PersonName>
    </Fragment>
  ));
}

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
  // A typed name or address isn't in the list until it's added, so saving waits for it.
  const [pending, setPending] = useState(false);
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
  // Once any copy may carry the new rule, the rest must get the same one, even
  // after a later Try Again is declined or refused outright.
  const mayHaveChanged = status.phase === "partial" || status.phase === "unconfirmed";
  const [ruleKept, setRuleKept] = useState(false);
  if (mayHaveChanged && !ruleKept) setRuleKept(true);
  const locked = ruleKept || mayHaveChanged;
  // Copies taken since a change missed them keep the rule they were taken up with.
  const retryTargets = available.filter((copy) => status.retry.includes(copy.commitmentId));
  const retrying = retryTargets.length > 0;
  const finished =
    status.phase === "changed" || (status.retry.length > 0 && !retrying && available.length > 0);
  const draft: ConfirmerRule = { confirmers: confirmers as Address[], threshold };
  const now: ConfirmerRule = {
    confirmers: current.confirmers,
    threshold: current.confirmationThreshold ?? 1,
  };
  const ruleError = confirmerRuleError(draft);
  const ruleMessage = confirmerRuleMessage(ruleError, formatMessage);
  const unchanged = !locked && !retrying && !mixed && sameConfirmerRule(draft, now);
  const blocked =
    ruleMessage ??
    (unchanged
      ? formatMessage({
          id: "hub.garden.pool.confirmers.unchanged",
          defaultMessage: "Change the list or the number to save.",
        })
      : null);
  const count = retrying ? retryTargets.length : available.length;

  const change = async () => {
    setError(null);
    const rule = locked && sent.current ? sent.current : draft;
    sent.current = rule;
    const outcome = await edit.change(retrying ? retryTargets : available, rule);
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

  const isNamed = (address: Address, group: readonly Address[]) =>
    group.some((entry) => entry.toLowerCase() === address.toLowerCase());
  const added = draft.confirmers.filter((address) => !isNamed(address, current.confirmers));
  const removed = current.confirmers.filter((address) => !isNamed(address, draft.confirmers));
  const summary = editConfirmersSummary({
    available: available.length,
    taken,
    // After a change that didn't finish, the copies share no one rule to name or
    // compare with, so the summary names the whole new group instead.
    from: mixed ? confirmersSplitText(formatMessage) : confirmerRuleText(formatMessage, current),
    to: ruleError
      ? "—"
      : confirmerRuleText(formatMessage, {
          confirmers: draft.confirmers,
          confirmationThreshold: draft.threshold,
        }),
    names:
      mixed && draft.confirmers.length > 0 ? <ConfirmerNames addresses={draft.confirmers} /> : null,
    adds: !mixed && added.length > 0 ? <ConfirmerNames addresses={added} /> : null,
    removes: !mixed && removed.length > 0 ? <ConfirmerNames addresses={removed} /> : null,
    formatMessage,
  });

  const note =
    status.phase === "asking"
      ? formatMessage({
          id: "hub.garden.pool.seed.note.waiting",
          defaultMessage: "The dialog stays open until your wallet answers.",
        })
      : status.busy
        ? null
        : (error ??
          (pending
            ? formatMessage({
                id: "hub.garden.pool.confirmers.unadded",
                defaultMessage: "Select Add to include the name you typed, or clear the field.",
              })
            : null) ??
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

  const footer: SheetActionsProps = finished
    ? {
        primary: {
          label: formatMessage({ id: "app.common.done", defaultMessage: "Done" }),
          onClick: () => onChanged(available.length),
        },
      }
    : {
        note: note ? <span role="status">{note}</span> : undefined,
        primary: {
          label: retrying
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
              ),
          onClick: () => void change(),
          loading: status.busy,
          disabled: !status.busy && (pending || (!locked && Boolean(blocked))),
        },
        secondary: {
          label: formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" }),
          onClick: onClose,
          disabled: status.busy,
        },
      };

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
          onPendingChange={setPending}
        />
      </div>
    </AdminDialog>
  );
}
