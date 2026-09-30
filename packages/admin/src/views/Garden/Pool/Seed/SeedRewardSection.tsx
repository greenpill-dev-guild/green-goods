import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminTextField } from "@/components/AdminTextField";
import { SeedAmountField } from "./SeedAmountField";
import type { RewardUnits } from "./seedRewardAmount";
import {
  railForRewardAnswer,
  type RewardAnswer,
  rewardAnswerOf,
  type SeedFieldError,
} from "./seedStepModel";

export interface SeedRewardSectionProps {
  form: UseFormReturn<CommitmentComposerValues>;
  values: CommitmentComposerValues;
  busy: boolean;
  errorOf: SeedFieldError;
  /** Celo settlement stays disabled until the garden's account is active. */
  settlementActive: boolean;
  /** The units the amount is typed in, read once by the wizard for every step. */
  units: RewardUnits;
}

/**
 * The declared reward, asked as a question: No leaves the rail at none, and Yes
 * shows the rails, one only, the external one naming its fields. Nothing here
 * pays anyone. The amount is typed in the rail's own token units.
 */
export function SeedRewardSection({
  form,
  values,
  busy,
  errorOf,
  settlementActive,
  units,
}: SeedRewardSectionProps) {
  const { formatMessage } = useIntl();
  const answer = rewardAnswerOf(values.considerationRail);
  const question = formatMessage({
    id: "cockpit.garden.pool.seed.rewardQuestion",
    defaultMessage: "Does this come with a reward?",
  });
  return (
    <section className="space-y-3">
      <p className="label-md text-text-strong">{question}</p>
      <AdminChoiceGroup
        ariaLabel={question}
        value={answer}
        columns={2}
        onChange={(next) => {
          const rail = railForRewardAnswer(next as RewardAnswer, values.considerationRail);
          // An amount means nothing in another rail's units, so it starts over.
          if (rail !== values.considerationRail) {
            form.setValue("considerationAmount", "", { shouldDirty: true });
          }
          form.setValue("considerationRail", rail, { shouldDirty: true, shouldValidate: true });
        }}
        options={[
          {
            value: "no",
            label: formatMessage({ id: "cockpit.garden.pool.seed.rewardNo", defaultMessage: "No" }),
          },
          {
            value: "yes",
            label: formatMessage({
              id: "cockpit.garden.pool.seed.rewardYes",
              defaultMessage: "Yes",
            }),
          },
        ]}
      />
      {answer === "yes" ? (
        <div className="space-y-3" data-testid="seed-consideration">
          <Controller
            control={form.control}
            name="considerationRail"
            render={({ field }) => (
              <AdminChoiceGroup
                ariaLabel={formatMessage({
                  id: "cockpit.garden.pool.seed.rail",
                  defaultMessage: "Reward rail",
                })}
                value={field.value}
                onChange={(rail) => {
                  // An amount means nothing in another rail's units, so it starts over.
                  if (rail !== field.value) {
                    form.setValue("considerationAmount", "", { shouldDirty: true });
                  }
                  field.onChange(rail);
                }}
                options={[
                  {
                    value: "ARBITRUM_EXTERNAL",
                    label: formatMessage({
                      id: "cockpit.garden.pool.seed.rail.external",
                      defaultMessage: "External payout record",
                    }),
                    description: formatMessage({
                      id: "cockpit.garden.pool.seed.rail.externalHint",
                      defaultMessage:
                        "Record a jar or treasury payout after the fact; no value moves here",
                    }),
                  },
                  {
                    value: "CELO_SETTLEMENT",
                    label: formatMessage({
                      id: "cockpit.garden.pool.seed.rail.celo",
                      defaultMessage: "Celo G$ settlement",
                    }),
                    description: settlementActive
                      ? formatMessage({
                          id: "cockpit.garden.pool.seed.rail.celoHint",
                          defaultMessage: "A conserved payout plan after fulfilment",
                        })
                      : formatMessage({
                          id: "cockpit.garden.pool.seed.rail.celoUnavailable",
                          defaultMessage:
                            "Needs this garden's settlement account to be active first",
                        }),
                    disabled: !settlementActive,
                  },
                ]}
              />
            )}
          />
          {values.considerationRail === "ARBITRUM_EXTERNAL" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <AdminTextField
                label={formatMessage({
                  id: "cockpit.garden.pool.seed.rewardSource",
                  defaultMessage: "Paid from (address)",
                })}
                value={values.considerationSource}
                onChange={(event) =>
                  form.setValue("considerationSource", event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                error={errorOf("considerationSource")}
                placeholder="0x…"
                disabled={busy}
              />
              <AdminTextField
                label={formatMessage({
                  id: "cockpit.garden.pool.seed.rewardToken",
                  defaultMessage: "Token (address)",
                })}
                value={values.considerationToken}
                onChange={(event) =>
                  form.setValue("considerationToken", event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                error={errorOf("considerationToken")}
                placeholder="0x…"
                disabled={busy}
              />
              <SeedAmountField
                form={form}
                value={values.considerationAmount}
                units={units}
                error={errorOf("considerationAmount")}
                disabled={busy}
              />
            </div>
          ) : values.considerationRail === "CELO_SETTLEMENT" ? (
            <SeedAmountField
              form={form}
              value={values.considerationAmount}
              units={units}
              error={errorOf("considerationAmount")}
              disabled={busy}
            />
          ) : null}
          <p className="body-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.seed.rewardNote",
              defaultMessage:
                "One rail only. External payouts are recorded after the fact; Celo G$ becomes a conserved payout plan after fulfilment. Nothing here pays anyone.",
            })}
          </p>
        </div>
      ) : null}
    </section>
  );
}
