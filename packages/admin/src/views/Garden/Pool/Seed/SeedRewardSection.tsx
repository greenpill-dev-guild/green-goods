import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminTextField } from "@/components/AdminTextField";
import { SeedAmountField } from "./SeedAmountField";
import type { RewardUnits } from "./seedRewardAmount";
import type { SeedFieldError } from "./seedStepModel";

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
 * The declared reward, folded away as advanced: one rail only, the external one
 * naming its fields, and nothing here pays anyone. The amount is typed in the
 * rail's own token units.
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

  return (
    <details className="rounded-[var(--m3-shape-md)] bg-bg-soft p-3">
      <summary className="label-md cursor-pointer text-text-strong">
        {formatMessage({
          id: "cockpit.garden.pool.seed.reward",
          defaultMessage: "Advanced: declared reward",
        })}
      </summary>
      <div className="mt-3 space-y-3" data-testid="seed-consideration">
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
                  value: "NONE",
                  label: formatMessage({
                    id: "cockpit.garden.pool.seed.rail.none",
                    defaultMessage: "None",
                  }),
                  description: formatMessage({
                    id: "cockpit.garden.pool.seed.rail.noneHint",
                    defaultMessage: "No declared reward",
                  }),
                },
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
                        defaultMessage: "Needs this garden's settlement account to be active first",
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
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.seed.rewardNote",
            defaultMessage:
              "One rail only. External payouts are recorded after the fact; Celo G$ becomes a conserved payout plan after fulfilment. Nothing here pays anyone.",
          })}
        </p>
      </div>
    </details>
  );
}
