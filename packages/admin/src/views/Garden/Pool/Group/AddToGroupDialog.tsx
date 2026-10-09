import {
  type GroupToAddTo,
  useAddToGroup,
} from "@green-goods/shared/hooks/admin-ui/pool/useAddToGroup";
import { MAX_COMMITMENT_SET_SIZE } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { Address } from "@green-goods/shared/types/domain";
import { useEffect, useId, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCardTitle } from "@/components/AdminCard";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminTextField } from "@/components/AdminTextField";
import { FlowStatusRow } from "@/components/Layout/FlowStatusRow";
import { GardenPoolTarget } from "../PoolTarget";
import { SeedFlowNote } from "../Seed/SeedFlowFooter";
import { formatUsd } from "../poolPresentation";
import { addToGroupStatus } from "./addToGroupStatus";

/** How many a steward usually adds at once, as the seeding flow suggests. */
const COUNT_CHOICES = [1, 5, 10, 20] as const;

/** Why an Add sent nothing, in the words the dialog shows under it. */
const REFUSAL = {
  expired: {
    id: "cockpit.garden.pool.add.expired",
    defaultMessage:
      "This group's deadline has passed, so nothing can join it. Start a new group instead.",
  },
  full: {
    id: "cockpit.garden.pool.add.full",
    defaultMessage:
      "{room, plural, =0 {You already hold as many offers as this pool allows at once, so none can be added now.} one {You have room for one more offer under this pool's limit. Choose fewer.} other {You have room for # more offers under this pool's limit. Choose fewer.}}",
  },
  "not-creator": {
    id: "cockpit.garden.pool.add.notCreator",
    defaultMessage:
      "Only the steward who created this group can add to it. Start a new group instead.",
  },
  blocked: {
    id: "cockpit.garden.pool.reward.blocked",
    defaultMessage: "Nothing could be sent from here. Check your wallet, then try again.",
  },
} as const;

export interface AddToGroupCounts {
  published: number;
  available: number;
  inProgress: number;
  kept: number;
  ended: number;
}

export interface AddToGroupDialogProps {
  open: boolean;
  onClose: () => void;
  /** Back to the Seed More Like This choice. */
  onBack: () => void;
  /** Every copy was added: close back to the inspector, and say so. */
  onAdded: (count: number) => void;
  chainId: number;
  garden: Address;
  isProtocol?: boolean;
  /** Who is adding; only the group's creator may. */
  owner: Address | null;
  /** The group, as the send needs it. */
  group: GroupToAddTo;
  /** The group's title, as its row shows it. */
  title: string;
  counts: AddToGroupCounts;
  /** The terms every new copy takes, as the inspector shows them: [label, value]. */
  terms: ReadonlyArray<readonly [string, string]>;
  /** Each copy's reward in cents, for the most the group could pay; null with no reward. */
  rewardCents: bigint | null;
  /** For a group of offers, how many more the steward may hold at once; null otherwise. */
  offerRoom?: number | null;
}

/**
 * Add to This Group (PRD-1022 D4, screens 28–30): only the number is asked. The
 * new copies take the group's terms, deadline and G$ amount, so they join its
 * row. One summary at the top carries ready, approving and declined in its
 * first lines while the comparison under them stays put.
 */
export function AddToGroupDialog({
  open,
  onClose,
  onBack,
  onAdded,
  chainId,
  garden,
  isProtocol,
  owner,
  group,
  title,
  counts,
  terms,
  rewardCents,
  offerRoom = null,
}: AddToGroupDialogProps) {
  const { formatMessage, locale } = useIntl();
  const fieldsetId = useId();
  const adding = useAddToGroup({ chainId, owner, group, offerRoom });
  const [count, setCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const { reset } = adding;
  const ownerKey = owner?.toLowerCase() ?? null;

  useEffect(() => {
    if (!open) return;
    reset();
    setCount(1);
    setError(null);
  }, [open, chainId, ownerKey, group.displayGroupId, reset]);

  const status = addToGroupStatus({
    mode: adding.mode,
    isSending: adding.isSending,
    copies: adding.copies,
    pass: adding.pass,
    count,
    formatMessage,
  });
  const validCount = Number.isInteger(count) && count >= 1 && count <= MAX_COMMITMENT_SET_SIZE;
  const retrying = adding.retryCount > 0;
  const sends = retrying ? adding.retryCount : count;
  const from = (value: number, to: number) =>
    formatMessage(
      { id: "cockpit.garden.pool.add.fromTo", defaultMessage: "{from} → {to}" },
      { from: value, to: to }
    );
  const upTo = (copies: number) =>
    formatMessage(
      { id: "cockpit.garden.pool.reward.upTo", defaultMessage: "up to {amount}" },
      { amount: formatUsd((rewardCents ?? 0n) * BigInt(copies), locale) }
    );
  const added = validCount ? count : 0;
  const summary: Array<[string, string]> = [
    [
      formatMessage({
        id: "cockpit.garden.pool.add.inGroup",
        defaultMessage: "Promises in the group",
      }),
      from(counts.published, counts.published + added),
    ],
    [
      formatMessage({
        id: "cockpit.garden.pool.add.available",
        defaultMessage: "Available to take up",
      }),
      from(counts.available, counts.available + added),
    ],
    [
      formatMessage({
        id: "cockpit.garden.pool.add.others",
        defaultMessage: "In progress, kept, ended",
      }),
      formatMessage(
        {
          id: "cockpit.garden.pool.add.othersValue",
          defaultMessage: "{inProgress}, {kept}, {ended} · unchanged",
        },
        { inProgress: counts.inProgress, kept: counts.kept, ended: counts.ended }
      ),
    ],
    ...(rewardCents !== null
      ? ([
          [
            formatMessage({
              id: "cockpit.garden.pool.reward.allKept",
              defaultMessage: "Reward if all are kept",
            }),
            formatMessage(
              { id: "cockpit.garden.pool.reward.totalFromTo", defaultMessage: "{from} → {to}" },
              { from: upTo(counts.published), to: upTo(counts.published + added) }
            ),
          ],
        ] as Array<[string, string]>)
      : []),
  ];

  const add = async () => {
    setError(null);
    const outcome = await adding.add(count);
    if (outcome === "sent") onAdded(count);
    else if (outcome !== "left")
      setError(formatMessage(REFUSAL[outcome], { room: offerRoom ?? 0 }));
  };

  const footer = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <p className="min-w-0 body-xs text-text-soft sm:flex-1" data-testid="add-prompt-count">
        <SeedFlowNote
          phase={status.phase}
          busy={status.busy}
          mode={adding.mode}
          count={sends}
          reason={error}
        />
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <AdminButton
          type="button"
          variant="outlined"
          onClick={onBack}
          disabled={status.busy || adding.locked}
          className="self-start sm:self-auto"
        >
          {formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
        </AdminButton>
        <AdminButton
          type="button"
          variant="filled"
          onClick={() => void add()}
          disabled={status.busy || !validCount}
          loading={status.busy}
          className="w-full sm:w-auto"
        >
          {retrying
            ? status.phase === "partial"
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.tryAgainCount",
                    defaultMessage: "Try Again ({count})",
                  },
                  { count: sends }
                )
              : formatMessage({
                  id: "cockpit.garden.pool.setup.retry",
                  defaultMessage: "Try Again",
                })
            : formatMessage(
                {
                  id: "cockpit.garden.pool.add.submit",
                  defaultMessage: "{count, plural, one {Add Promise} other {Add # Promises}}",
                },
                { count: validCount ? count : 1 }
              )}
        </AdminButton>
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
        id: "cockpit.garden.pool.add.title",
        defaultMessage: "Add to This Group",
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
      <div className="space-y-4" data-testid="add-to-group">
        <FlowStatusRow
          tone={status.tone}
          busy={status.busy}
          title={status.title}
          description={status.description}
          progress={status.progress}
          summary={summary}
          className="min-h-[263px] grid-rows-[108px_auto] sm:min-h-[185px] sm:grid-rows-[50px_auto]"
        />
        <fieldset
          className="min-w-0 space-y-2"
          disabled={status.busy || adding.locked}
          aria-labelledby={`${fieldsetId}-count`}
        >
          <AdminCardTitle as="h4" id={`${fieldsetId}-count`}>
            {formatMessage({
              id: "cockpit.garden.pool.add.countTitle",
              defaultMessage: "Promises to add",
            })}
          </AdminCardTitle>
          <div className="flex flex-wrap gap-2">
            {COUNT_CHOICES.map((choice) => (
              <AdminFilterChip
                key={choice}
                label={String(choice)}
                selected={count === choice}
                onToggle={() => setCount(choice)}
              />
            ))}
          </div>
          <AdminTextField
            label={formatMessage({
              id: "cockpit.garden.pool.seed.promisesField",
              defaultMessage: "Promises",
            })}
            value={String(count)}
            onChange={(event) => setCount(Number(event.target.value))}
            helperText={formatMessage({
              id: "cockpit.garden.pool.add.countHint",
              defaultMessage:
                "Each one is taken up and kept on its own, like the rest of the group.",
            })}
            error={
              validCount
                ? undefined
                : formatMessage(
                    {
                      id: "cockpit.garden.pool.seed.error.countTooMany",
                      defaultMessage: "Create {max, number} promises or fewer at once.",
                    },
                    { max: MAX_COMMITMENT_SET_SIZE }
                  )
            }
            inputProps={{ inputMode: "numeric", max: MAX_COMMITMENT_SET_SIZE }}
            className="max-w-sm"
          />
        </fieldset>
        <section className="space-y-2">
          <AdminCardTitle as="h4">
            {formatMessage({
              id: "cockpit.garden.pool.add.sameAs",
              defaultMessage: "Same as the group",
            })}
          </AdminCardTitle>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            {terms.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="body-sm text-text-soft">{label}</dt>
                <dd className="body-sm text-text-strong">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </AdminDialog>
  );
}
