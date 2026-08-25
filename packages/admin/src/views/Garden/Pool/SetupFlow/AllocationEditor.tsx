import {
  ALLOCATION_BPS_TOTAL,
  type CommitmentAllocationBps,
  type CommitmentRecognitionPolicyBps,
  isValidCycleSplit,
} from "@green-goods/shared/modules/commitment-pooling/pool-lifecycle";
import { RiCheckLine, RiErrorWarningLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminTextField } from "@/components/AdminTextField";

/** The six allocation classes in percent: the unit stewards read (uiux-spec §6.10). */
export interface AllocationPercent {
  gardeners: string;
  treasury: string;
  steward: string;
  evaluator: string;
  community: string;
  funder: string;
}

export interface RecognitionPercent {
  equal: string;
  verified: string;
}

export type AllocationPreset = "model1" | "model2" | "model3" | "custom";

/** uiux-spec §6.10 presets, in percent. Model 2 and 3 leave remainders editable. */
export const ALLOCATION_PRESETS: Record<Exclude<AllocationPreset, "custom">, AllocationPercent> = {
  model1: {
    gardeners: "60",
    treasury: "15",
    steward: "10",
    evaluator: "5",
    community: "5",
    funder: "5",
  },
  model2: {
    gardeners: "30",
    treasury: "45",
    steward: "10",
    evaluator: "5",
    community: "5",
    funder: "5",
  },
  model3: {
    gardeners: "40",
    treasury: "20",
    steward: "20",
    evaluator: "10",
    community: "5",
    funder: "5",
  },
};

export const DEFAULT_RECOGNITION_PERCENT: RecognitionPercent = { equal: "20", verified: "80" };

const TREASURY_GUIDANCE_FLOOR = 15;

function percentToBps(value: string): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
  return Math.round(parsed * 100);
}

/** Percent strings → the bps structs the contract stores. NaN shares fail the sum check. */
export function toAllocationBps(values: AllocationPercent): CommitmentAllocationBps {
  return {
    gardeners: percentToBps(values.gardeners),
    treasury: percentToBps(values.treasury),
    steward: percentToBps(values.steward),
    evaluator: percentToBps(values.evaluator),
    community: percentToBps(values.community),
    funder: percentToBps(values.funder),
  };
}

export function toRecognitionBps(values: RecognitionPercent): CommitmentRecognitionPolicyBps {
  return {
    equalParticipationBps: percentToBps(values.equal),
    verifiedContributionBps: percentToBps(values.verified),
  };
}

function allocationSumPercent(values: AllocationPercent): number {
  const bps = toAllocationBps(values);
  const total =
    bps.gardeners + bps.treasury + bps.steward + bps.evaluator + bps.community + bps.funder;
  return Number.isFinite(total) ? total / 100 : Number.NaN;
}

export interface AllocationEditorProps {
  preset: AllocationPreset;
  onPresetChange: (preset: AllocationPreset) => void;
  allocation: AllocationPercent;
  onAllocationChange: (allocation: AllocationPercent) => void;
  recognition: RecognitionPercent;
  onRecognitionChange: (recognition: RecognitionPercent) => void;
  disabled?: boolean;
}

/**
 * The six-role split and the within-gardeners recognition policy, in percent
 * with a "stored on-chain as basis points" helper (uiux-spec §6.10). Presets
 * prefill the editor; every field stays editable. The sum must equal 100 %
 * (the contract's InvalidAllocation guard) and a treasury share under the
 * 15 % guidance floor warns without blocking.
 */
export function AllocationEditor({
  preset,
  onPresetChange,
  allocation,
  onAllocationChange,
  recognition,
  onRecognitionChange,
  disabled = false,
}: AllocationEditorProps) {
  const { formatMessage } = useIntl();
  const valid = isValidCycleSplit({
    allocation: toAllocationBps(allocation),
    recognitionPolicy: toRecognitionBps(recognition),
  });
  const sum = allocationSumPercent(allocation);
  const treasury = Number(allocation.treasury);
  const lowTreasury = Number.isFinite(treasury) && treasury < TREASURY_GUIDANCE_FLOOR;

  const setShare = (key: keyof AllocationPercent, value: string) => {
    onPresetChange("custom");
    onAllocationChange({ ...allocation, [key]: value });
  };

  const fields: Array<{ key: keyof AllocationPercent; label: string }> = [
    {
      key: "gardeners",
      label: formatMessage({
        id: "cockpit.garden.pool.split.gardeners",
        defaultMessage: "Gardeners",
      }),
    },
    {
      key: "treasury",
      label: formatMessage({
        id: "cockpit.garden.pool.split.treasury",
        defaultMessage: "Treasury",
      }),
    },
    // The on-chain class is named `steward`; stewards read it as their own role.
    {
      key: "steward",
      label: formatMessage({ id: "cockpit.garden.pool.split.steward", defaultMessage: "Steward" }),
    },
    {
      key: "evaluator",
      label: formatMessage({
        id: "cockpit.garden.pool.split.evaluator",
        defaultMessage: "Evaluator",
      }),
    },
    {
      key: "community",
      label: formatMessage({
        id: "cockpit.garden.pool.split.community",
        defaultMessage: "Community",
      }),
    },
    {
      key: "funder",
      label: formatMessage({ id: "cockpit.garden.pool.split.funder", defaultMessage: "Funder" }),
    },
  ];

  return (
    <div className="space-y-4" data-component="AllocationEditor">
      <AdminChoiceGroup
        ariaLabel={formatMessage({
          id: "cockpit.garden.pool.split.preset",
          defaultMessage: "Preset",
        })}
        value={preset}
        columns={2}
        onChange={(value) => {
          const next = value as AllocationPreset;
          onPresetChange(next);
          if (next !== "custom") onAllocationChange(ALLOCATION_PRESETS[next]);
        }}
        options={[
          {
            value: "model1",
            label: formatMessage({
              id: "cockpit.garden.pool.split.preset.model1",
              defaultMessage: "Garden-led (standard)",
            }),
            description: "60 · 15 · 10 · 5 · 5 · 5",
            disabled,
          },
          {
            value: "model2",
            label: formatMessage({
              id: "cockpit.garden.pool.split.preset.model2",
              defaultMessage: "Treasury-led",
            }),
            description: "30 · 45 · 10 · 5 · 5 · 5",
            disabled,
          },
          {
            value: "model3",
            label: formatMessage({
              id: "cockpit.garden.pool.split.preset.model3",
              defaultMessage: "Balanced",
            }),
            description: "40 · 20 · 20 · 10 · 5 · 5",
            disabled,
          },
          {
            value: "custom",
            label: formatMessage({
              id: "cockpit.garden.pool.split.preset.custom",
              defaultMessage: "Custom",
            }),
            description: formatMessage({
              id: "cockpit.garden.pool.split.preset.customHint",
              defaultMessage: "Edit any share below",
            }),
            disabled,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <AdminTextField
            key={field.key}
            label={field.label}
            value={allocation[field.key]}
            onChange={(event) => setShare(field.key, event.target.value)}
            inputProps={{ inputMode: "decimal", "aria-describedby": "allocation-sum" }}
            trailingIcon={PercentSign}
            disabled={disabled}
          />
        ))}
      </div>

      <div id="allocation-sum" className="space-y-1 text-xs" aria-live="polite">
        {valid.allocation ? (
          <p className="flex items-center gap-1.5 text-[rgb(var(--tone-on-surface-accent))]">
            <RiCheckLine className="h-3.5 w-3.5" aria-hidden />
            {formatMessage({
              id: "cockpit.garden.pool.split.sumOk",
              defaultMessage: "Total: 100 %",
            })}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[rgb(var(--m3-error))]" role="alert">
            <RiErrorWarningLine className="h-3.5 w-3.5" aria-hidden />
            {formatMessage(
              {
                id: "cockpit.garden.pool.split.sumInvalid",
                defaultMessage: "The six shares must total exactly 100 %. Right now: {sum} %.",
              },
              { sum: Number.isFinite(sum) ? String(sum) : "—" }
            )}
          </p>
        )}
        {lowTreasury ? (
          <p className="flex items-center gap-1.5 text-warning-dark">
            <RiErrorWarningLine className="h-3.5 w-3.5" aria-hidden />
            {formatMessage({
              id: "cockpit.garden.pool.split.treasuryLow",
              defaultMessage: "Guidance keeps the treasury share at 15 % or more.",
            })}
          </p>
        ) : null}
        <p className="text-text-soft">
          {formatMessage(
            {
              id: "cockpit.garden.pool.split.bpsHelper",
              defaultMessage: "Stored on-chain as basis points (×100): {total} in all.",
            },
            { total: ALLOCATION_BPS_TOTAL }
          )}
        </p>
      </div>

      <div className="space-y-2 border-t border-[rgb(var(--m3-outline-variant))] pt-3">
        <p className="label-md text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.split.recognition",
            defaultMessage: "Gardeners' part",
          })}
        </p>
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.split.recognitionHint",
            defaultMessage:
              "How the gardeners' share divides: a part shared equally for taking part, the rest by proven contribution.",
          })}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AdminTextField
            label={formatMessage({
              id: "cockpit.garden.pool.split.recognition.equal",
              defaultMessage: "Taking part",
            })}
            value={recognition.equal}
            onChange={(event) => onRecognitionChange({ ...recognition, equal: event.target.value })}
            inputProps={{ inputMode: "decimal" }}
            trailingIcon={PercentSign}
            disabled={disabled}
          />
          <AdminTextField
            label={formatMessage({
              id: "cockpit.garden.pool.split.recognition.verified",
              defaultMessage: "Proven contribution",
            })}
            value={recognition.verified}
            onChange={(event) =>
              onRecognitionChange({ ...recognition, verified: event.target.value })
            }
            inputProps={{ inputMode: "decimal" }}
            trailingIcon={PercentSign}
            disabled={disabled}
          />
        </div>
        {valid.recognitionPolicy ? null : (
          <p className="flex items-center gap-1.5 text-xs text-[rgb(var(--m3-error))]" role="alert">
            <RiErrorWarningLine className="h-3.5 w-3.5" aria-hidden />
            {formatMessage({
              id: "cockpit.garden.pool.split.recognitionInvalid",
              defaultMessage: "The two parts must total exactly 100 %.",
            })}
          </p>
        )}
      </div>
    </div>
  );
}

function PercentSign({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      %
    </span>
  );
}
