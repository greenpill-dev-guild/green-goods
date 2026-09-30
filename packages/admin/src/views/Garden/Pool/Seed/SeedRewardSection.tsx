import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import {
  type GoodDollarPriceState,
  usdCentsToGoodDollarWei,
} from "@green-goods/shared/modules/wallet/good-dollar-price";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminCardTitle } from "@/components/AdminCard";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminTextField } from "@/components/AdminTextField";
import {
  carriedOverUsd,
  formatGoodDollars,
  formatUsd,
  priceUnavailableReason,
  rewardCentsOf,
} from "./seedReward";
import type { SeedFieldError } from "./seedStepModel";

export interface SeedRewardSectionProps {
  form: UseFormReturn<CommitmentComposerValues>;
  values: CommitmentComposerValues;
  busy: boolean;
  errorOf: SeedFieldError;
  /** G$ is paid through the garden's settlement account, so Yes waits until it is active. */
  settlementActive: boolean;
  price: GoodDollarPriceState;
  /** How many promises the answer creates, for the most the reward could total. */
  count: number;
}

/**
 * The reward, asked as a question (PRD-1022 D9, D13). No leaves it at none.
 * Yes pays in G$ through the garden's settlement account, and waits, with its
 * reason, until that account is active. The steward enters dollars; the G$
 * amount is converted at today's rate when the promises are created and fixed
 * from then. Nothing here pays anyone or reserves anything.
 */
export function SeedRewardSection({
  form,
  values,
  busy,
  errorOf,
  settlementActive,
  price,
  count,
}: SeedRewardSectionProps) {
  const { formatMessage, locale } = useIntl();
  const wanted = values.considerationRail !== "NONE";
  const cents = rewardCentsOf(values);
  const unavailable = priceUnavailableReason(price, formatMessage);
  const question = formatMessage({
    id: "cockpit.garden.pool.seed.rewardQuestion",
    defaultMessage: "Does this come with a reward?",
  });

  // A reward carried over in G$ (seeding more like an earlier promise) is shown
  // in dollars at today's rate, and converted back when these are created.
  const carried =
    values.considerationRail === "CELO_SETTLEMENT" &&
    values.considerationUsd === undefined &&
    price.status === "ready"
      ? carriedOverUsd(values.considerationAmount, price.price)
      : null;
  useEffect(() => {
    if (carried === null) return;
    form.setValue("considerationUsd", carried, { shouldDirty: false });
  }, [carried, form]);

  const choose = (answer: string) => {
    if (answer === "yes") {
      form.setValue("considerationRail", "CELO_SETTLEMENT", { shouldDirty: true });
      form.setValue("considerationUsd", values.considerationUsd ?? "", { shouldDirty: true });
    } else {
      form.setValue("considerationRail", "NONE", { shouldDirty: true });
      form.setValue("considerationUsd", undefined, { shouldDirty: true });
      form.setValue("considerationAmount", "", { shouldDirty: true });
    }
    void form.trigger(["considerationUsd", "considerationAmount"]);
  };

  const helper =
    unavailable ??
    (cents !== null && cents > 0n && price.status === "ready"
      ? formatMessage(
          {
            id: "cockpit.garden.pool.seed.rewardEstimate",
            defaultMessage:
              "About {amount} G$ at today's rate. The G$ amount is fixed when you create.",
          },
          { amount: formatGoodDollars(usdCentsToGoodDollarWei(cents, price.price), locale) }
        )
      : formatMessage({
          id: "cockpit.garden.pool.seed.rewardRate",
          defaultMessage: "Paid in G$ at today's rate. The G$ amount is fixed when you create.",
        }));

  return (
    <section className="space-y-3" data-testid="seed-reward">
      <AdminCardTitle as="h4">{question}</AdminCardTitle>
      <AdminChoiceGroup
        ariaLabel={question}
        value={wanted ? "yes" : "no"}
        columns={2}
        onChange={choose}
        options={[
          {
            value: "no",
            disabled: busy,
            label: formatMessage({ id: "cockpit.garden.pool.seed.rewardNo", defaultMessage: "No" }),
            description: formatMessage({
              id: "cockpit.garden.pool.seed.rewardNoHint",
              defaultMessage: "Nothing is paid",
            }),
          },
          {
            value: "yes",
            disabled: busy || !settlementActive,
            label: formatMessage({
              id: "cockpit.garden.pool.seed.rewardYes",
              defaultMessage: "Yes",
            }),
            description: settlementActive
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.rewardYesHint",
                  defaultMessage: "Paid in G$ after each one is kept",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.seed.rail.celoUnavailable",
                  defaultMessage: "Needs this garden's settlement account to be active first",
                }),
          },
        ]}
      />
      {wanted ? (
        <div className="space-y-1">
          <AdminTextField
            label={formatMessage({
              id: "cockpit.garden.pool.seed.rewardAmountUsd",
              defaultMessage: "Amount for each (USD)",
            })}
            value={values.considerationUsd ?? ""}
            onChange={(event) =>
              form.setValue("considerationUsd", event.target.value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            placeholder="$5.00"
            error={unavailable ? undefined : errorOf("considerationUsd")}
            helperText={helper}
            inputProps={{ inputMode: "decimal" }}
            disabled={busy || price.status !== "ready"}
            className="max-w-sm"
          />
          <p className="body-xs text-text-soft">
            {cents !== null && cents > 0n && count > 1
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.rewardTotal",
                    defaultMessage:
                      "Up to {total} if all {count} are kept, paid in G$ through this garden's settlement account. Nothing is reserved or paid here.",
                  },
                  { total: formatUsd(cents * BigInt(count), locale), count }
                )
              : formatMessage({
                  id: "cockpit.garden.pool.seed.rewardTotalOne",
                  defaultMessage:
                    "Paid in G$ through this garden's settlement account once it's kept. Nothing is reserved or paid here.",
                })}
          </p>
        </div>
      ) : null}
    </section>
  );
}
