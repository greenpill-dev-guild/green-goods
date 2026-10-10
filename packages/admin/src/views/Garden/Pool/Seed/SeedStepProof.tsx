import { Alert } from "@green-goods/shared/components/Alert";
import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminCheckbox } from "@/components/AdminCheckbox";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminSettingRow } from "@/components/AdminSettingRow";
import { SeedConfirmerList, type SeedMember } from "./SeedConfirmerList";
import { SeedRewardSection } from "./SeedRewardSection";
import type { SeedFieldError } from "./seedStepModel";

export interface SeedStepProofProps {
  form: UseFormReturn<CommitmentComposerValues>;
  values: CommitmentComposerValues;
  /** Field ids are derived from the dialog's one useId, so labels stay unique. */
  noteId: string;
  busy: boolean;
  errorOf: SeedFieldError;
  /** The garden's people, offered as confirmers in one tap. */
  members: readonly SeedMember[];
  /** Without a registered protocol pool the Green Goods team fallback cannot stand. */
  protocolRegistered: boolean;
  /** G$ rewards wait until the garden's settlement account is active. */
  settlementActive: boolean;
  price: GoodDollarPriceState;
}

/**
 * Step three of Seed Promises: who confirms, whether the Green Goods team may
 * step in, how each promise is taken up, and the reward. The same settings
 * apply to every promise the answer creates, and each is confirmed on its own.
 */
export function SeedStepProof({
  form,
  values,
  noteId,
  busy,
  errorOf,
  members,
  protocolRegistered,
  settlementActive,
  price,
}: SeedStepProofProps) {
  const { formatMessage } = useIntl();
  const count = values.count ?? 1;

  return (
    <div className="space-y-4">
      {count > 1 ? (
        <Alert variant="info">
          {formatMessage(
            {
              id: "cockpit.garden.pool.seed.appliesToEach",
              defaultMessage:
                "These apply to each of the {count} promises. Each one is confirmed on its own.",
            },
            { count }
          )}
        </Alert>
      ) : null}

      <SeedConfirmerList
        form={form}
        values={values}
        busy={busy}
        errorOf={errorOf}
        members={members}
      />

      <AdminSettingRow
        labelId={`${noteId}-fallback`}
        label={formatMessage({
          id: "cockpit.garden.pool.seed.protocolFallback",
          defaultMessage: "Let the Green Goods team confirm if nobody local is eligible",
        })}
        description={
          protocolRegistered
            ? formatMessage({
                id: "cockpit.garden.pool.seed.protocolFallbackHint",
                defaultMessage:
                  "On for this pilot. Usable only while nobody local can confirm, always with a recorded reason; every contributor stays excluded.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.seed.protocolFallbackUnavailable",
                defaultMessage:
                  "Unavailable on this deployment: no Green Goods protocol pool is registered yet. The fallback is stored off.",
              })
        }
      >
        <AdminCheckbox
          aria-labelledby={`${noteId}-fallback`}
          checked={protocolRegistered && values.protocolFallbackEnabled}
          disabled={busy || !protocolRegistered}
          onChange={(event) =>
            form.setValue("protocolFallbackEnabled", event.target.checked, {
              shouldDirty: true,
            })
          }
        />
      </AdminSettingRow>
      {!protocolRegistered ? (
        <Alert variant="warning">
          {formatMessage({
            id: "cockpit.garden.pool.seed.protocolFallbackRepair",
            defaultMessage:
              "Repair path: register the protocol pool (a deployment operation), or name a reachable local confirmer group before seeding.",
          })}
        </Alert>
      ) : null}

      <Controller
        control={form.control}
        name="claimMode"
        render={({ field }) => (
          <AdminChoiceGroup
            ariaLabel={formatMessage({
              id: "cockpit.garden.pool.seed.claimMode",
              defaultMessage: "Claim mode",
            })}
            value={field.value}
            onChange={field.onChange}
            columns={2}
            options={[
              {
                value: "OPEN",
                disabled: busy,
                label: formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode.open",
                  defaultMessage: "Open",
                }),
                description: formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode.openHint",
                  defaultMessage: "Anyone in the garden may take it up",
                }),
              },
              {
                value: "APPROVAL_GATED",
                disabled: busy,
                label: formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode.gated",
                  defaultMessage: "Steward-reviewed",
                }),
                description: formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode.gatedAskHint",
                  defaultMessage: "Each ask waits for your approval",
                }),
              },
            ]}
          />
        )}
      />

      <SeedRewardSection
        form={form}
        values={values}
        busy={busy}
        errorOf={errorOf}
        settlementActive={settlementActive}
        price={price}
        count={count}
      />
    </div>
  );
}
