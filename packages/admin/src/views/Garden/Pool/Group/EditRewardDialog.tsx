import { useEditReward } from "@green-goods/shared/hooks/admin-ui/pool/useEditReward";
import { useGoodDollarPrice } from "@green-goods/shared/hooks/blockchain/useGoodDollarPrice";
import {
  goodDollarWeiToUsdCents,
  parseUsdCents,
  usdCentsText,
  usdCentsToGoodDollarWei,
} from "@green-goods/shared/modules/wallet/good-dollar-price";
import type { Address } from "@green-goods/shared/types/domain";
import { useEffect, useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCardTitle } from "@/components/AdminCard";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminTextField } from "@/components/AdminTextField";
import { FlowStatusRow } from "@/components/Layout/FlowStatusRow";
import { GardenPoolTarget } from "../PoolTarget";
import { formatGoodDollars, formatUsd, priceUnavailableReason } from "../Seed/seedReward";
import { editRewardStatus, editRewardSummary } from "./editRewardStatus";

/** A term edit is cheap, so up to this many go in one wallet approval (`reward-edit`). */
const PER_APPROVAL = 50;

export interface EditRewardDialogProps {
  open: boolean;
  onClose: () => void;
  /** Every copy took the new reward: close back to the inspector, and say so. */
  onChanged: (count: number) => void;
  chainId: number;
  garden: Address;
  isProtocol?: boolean;
  /** The group's title, or the single promise's. */
  title: string;
  /** The copies nobody has taken: the ones this changes. */
  available: readonly bigint[];
  /** Who took theirs, by name: they keep the reward they agreed to. */
  takenBy: readonly string[];
  /** Each copy's reward now, in G$ base units. */
  currentWei: bigint;
  /** The dollars it was set in, while the chain still holds that amount (`rewardCentsAsSet`). */
  currentCentsAsSet: bigint | null;
  /** A G$ reward is paid through the garden's settlement account, which must be active. */
  settlementActive: boolean;
}

/**
 * Edit Reward (PRD-1022 D14, screens 31–33): one new reward, in dollars, for
 * every copy nobody has taken, in one approval where the wallet can. Taken
 * copies keep what they agreed to. The G$ amount is converted at the price read
 * just before the change and fixed from then, so a Try Again sends the same one.
 */
export function EditRewardDialog({
  open,
  onClose,
  onChanged,
  chainId,
  garden,
  isProtocol,
  title,
  available,
  takenBy,
  currentWei,
  currentCentsAsSet,
  settlementActive,
}: EditRewardDialogProps) {
  const { formatMessage, locale } = useIntl();
  const fieldsetId = useId();
  const price = useGoodDollarPrice({ enabled: open });
  const reward = useEditReward({ chainId });
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The G$ amount of the first change, kept for every Try Again.
  const fixedAmount = useRef<bigint | null>(null);

  const readCents =
    currentCentsAsSet ??
    (price.state.status === "ready"
      ? goodDollarWeiToUsdCents(currentWei, price.state.price)
      : null);
  const { reset } = reward;
  useEffect(() => {
    if (!open) return;
    reset();
    fixedAmount.current = null;
    setError(null);
    setAmountText(currentCentsAsSet !== null ? usdCentsText(currentCentsAsSet) : "");
  }, [open, reset, currentCentsAsSet]);

  const current =
    readCents === null
      ? formatMessage(
          { id: "cockpit.garden.pool.reward.inGoodDollars", defaultMessage: "{amount} G$" },
          { amount: formatGoodDollars(currentWei, locale) }
        )
      : currentCentsAsSet !== null
        ? formatUsd(readCents, locale)
        : formatMessage(
            { id: "cockpit.garden.pool.reward.about", defaultMessage: "about {amount}" },
            { amount: formatUsd(readCents, locale) }
          );
  const listFormat = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });
  const status = editRewardStatus({
    mode: reward.mode,
    isSending: reward.isSending,
    copies: reward.copies,
    available: available.length,
    takenBy,
    current,
    formatMessage,
    formatList: (items) => listFormat.format(items),
  });

  // Once any copy may carry the new amount, the rest must get the same one.
  const locked = status.phase === "partial" || status.phase === "unconfirmed";
  const cents = parseUsdCents(amountText);
  const unavailable = locked ? null : priceUnavailableReason(price.state, formatMessage);
  const newCents = cents !== null && cents > 0n ? cents : null;
  const retrying = status.retry.length > 0;
  // The amount starts at the reward as set; asking the wallet to write it again changes nothing.
  const unchanged =
    !locked && !retrying && currentCentsAsSet !== null && newCents === currentCentsAsSet;
  const blocked = !settlementActive
    ? formatMessage({
        id: "cockpit.garden.pool.reward.needsSettlement",
        defaultMessage:
          "A reward is paid through this garden's settlement account, which isn't active.",
      })
    : (unavailable ??
      (unchanged
        ? formatMessage({
            id: "cockpit.garden.pool.reward.unchanged",
            defaultMessage: "Type the new amount to change the reward.",
          })
        : null));
  const count = retrying ? status.retry.length : available.length;

  const change = async () => {
    setError(null);
    let amount = locked ? fixedAmount.current : null;
    if (amount === null) {
      if (newCents === null) return;
      try {
        amount = usdCentsToGoodDollarWei(newCents, (await price.readNow()).price);
      } catch {
        setError(
          priceUnavailableReason({ status: "unavailable", reason: "missing" }, formatMessage)
        );
        return;
      }
      fixedAmount.current = amount;
    }
    const outcome = await reward.change(retrying ? status.retry : available, amount);
    if (outcome === "changed") onChanged(available.length);
    if (outcome === "blocked") {
      setError(
        formatMessage({
          id: "cockpit.garden.pool.reward.blocked",
          defaultMessage: "Nothing could be sent from here. Check your wallet, then try again.",
        })
      );
    }
  };

  const summary = editRewardSummary({
    available: available.length,
    taken: takenBy.length,
    current,
    readCents,
    newCents,
    formatUsd: (cents) => formatUsd(cents, locale),
    formatMessage,
  });

  const note =
    status.phase === "asking"
      ? formatMessage({
          id: "cockpit.garden.pool.seed.note.waiting",
          defaultMessage: "The dialog stays open until your wallet answers.",
        })
      : status.busy
        ? null
        : (error ??
          blocked ??
          (reward.mode === "one-by-one"
            ? formatMessage(
                {
                  id: "cockpit.garden.pool.seed.note.oneByOne",
                  defaultMessage:
                    "{count, plural, one {Your wallet will ask you once.} =2 {Your wallet will ask you twice, one after the other.} other {Your wallet will ask you # times, one after another.}}",
                },
                { count }
              )
            : count <= PER_APPROVAL
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.note.bundle",
                    defaultMessage:
                      "{count, plural, one {Your wallet will ask you once.} other {Your wallet will ask you once, for all #.}}",
                  },
                  { count }
                )
              : formatMessage(
                  {
                    id: "cockpit.garden.pool.reward.note.bundles",
                    defaultMessage: "Your wallet will ask you {requests} times, once for every 50.",
                  },
                  { requests: Math.ceil(count / PER_APPROVAL) }
                )));

  const footer =
    status.phase === "changed" ? (
      <AdminButton type="button" variant="filled" onClick={() => onChanged(available.length)}>
        {formatMessage({ id: "app.common.done", defaultMessage: "Done" })}
      </AdminButton>
    ) : (
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <p className="min-w-0 body-xs text-text-soft sm:flex-1" data-testid="reward-prompt-count">
          {note ? <span role="status">{note}</span> : null}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <AdminButton type="button" variant="text" onClick={onClose} disabled={status.busy}>
            {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
          </AdminButton>
          <AdminButton
            type="button"
            variant="filled"
            onClick={() => void change()}
            disabled={status.busy || Boolean(blocked) || (!locked && newCents === null)}
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
                    { count }
                  )
                : formatMessage({
                    id: "cockpit.garden.pool.setup.retry",
                    defaultMessage: "Try Again",
                  })
              : formatMessage(
                  {
                    id: "cockpit.garden.pool.reward.change",
                    defaultMessage: "{count, plural, one {Change Reward} other {Change # Rewards}}",
                  },
                  { count }
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
        id: "cockpit.garden.pool.reward.title",
        defaultMessage: "Edit Reward",
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
      <div className="space-y-4" data-testid="edit-reward">
        <FlowStatusRow
          tone={status.tone}
          busy={status.busy}
          title={status.title}
          description={status.description}
          progress={status.progress}
          summary={summary}
        />
        <fieldset
          className="min-w-0 space-y-2"
          disabled={status.busy || locked}
          aria-labelledby={`${fieldsetId}-title`}
        >
          <AdminCardTitle as="h4" id={`${fieldsetId}-title`}>
            {formatMessage({
              id: "cockpit.garden.pool.reward.newReward",
              defaultMessage: "New reward",
            })}
          </AdminCardTitle>
          <AdminTextField
            label={formatMessage({
              id: "cockpit.garden.pool.seed.rewardAmountUsd",
              defaultMessage: "Amount for each (USD)",
            })}
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder="$5.00"
            helperText={
              unavailable ??
              (newCents !== null && price.state.status === "ready"
                ? formatMessage(
                    {
                      id: "cockpit.garden.pool.reward.estimate",
                      defaultMessage: "About {amount} G$ at today's rate, fixed when you save.",
                    },
                    {
                      amount: formatGoodDollars(
                        usdCentsToGoodDollarWei(newCents, price.state.price),
                        locale
                      ),
                    }
                  )
                : formatMessage({
                    id: "cockpit.garden.pool.reward.rate",
                    defaultMessage: "Paid in G$ at today's rate, fixed when you save.",
                  }))
            }
            error={
              amountText.trim() !== "" && newCents === null
                ? formatMessage({
                    id: "cockpit.garden.pool.seed.error.considerationUsd",
                    defaultMessage: "Enter an amount in dollars above zero, like 5.00.",
                  })
                : undefined
            }
            inputProps={{ inputMode: "decimal" }}
            className="max-w-sm"
          />
        </fieldset>
      </div>
    </AdminDialog>
  );
}
