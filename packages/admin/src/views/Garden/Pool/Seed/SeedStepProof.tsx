import { Alert } from "@green-goods/shared/components/Alert";
import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminCheckbox } from "@/components/AdminCheckbox";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminSettingRow } from "@/components/AdminSettingRow";
import { SeedConfirmerList } from "./SeedConfirmerList";
import { SeedRewardSection } from "./SeedRewardSection";
import type { SeedFieldError } from "./seedStepModel";

export interface SeedStepProofProps {
  form: UseFormReturn<CommitmentComposerValues>;
  values: CommitmentComposerValues;
  /** Field ids are derived from the dialog's one useId, so labels stay unique. */
  noteId: string;
  busy: boolean;
  errorOf: SeedFieldError;
  /** The address being typed, held by the dialog so it survives a step change. */
  confirmerDraft: string;
  onConfirmerDraftChange: (value: string) => void;
  onAddConfirmer: () => void;
  /** Without a registered protocol pool the Green Goods team fallback cannot stand. */
  protocolRegistered: boolean;
  /** Celo settlement stays disabled until the garden's account is active. */
  settlementActive: boolean;
}

/**
 * Step three of the seeding console: who confirms, whether the Green Goods team
 * may step in, how the commitment is claimed, and the advanced declared reward.
 */
export function SeedStepProof({
  form,
  values,
  noteId,
  busy,
  errorOf,
  confirmerDraft,
  onConfirmerDraftChange,
  onAddConfirmer,
  protocolRegistered,
  settlementActive,
}: SeedStepProofProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <SeedConfirmerList
        form={form}
        values={values}
        busy={busy}
        errorOf={errorOf}
        confirmerDraft={confirmerDraft}
        onConfirmerDraftChange={onConfirmerDraftChange}
        onAddConfirmer={onAddConfirmer}
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
                label: formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode.gated",
                  defaultMessage: "Steward-reviewed",
                }),
                description: formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode.gatedHint",
                  defaultMessage: "Requests wait for review",
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
      />
    </div>
  );
}
