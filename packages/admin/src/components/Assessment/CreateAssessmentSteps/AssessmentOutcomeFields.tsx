import type { SmartOutcome } from "@green-goods/shared/types/domain";
import { RiDeleteBinLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminIconButton } from "../../AdminButton";
import { AdminSelect, AdminTextField } from "../../AdminTextField";

type OutcomeField = "description" | "metric" | "target";

interface AssessmentOutcomeFieldsProps {
  outcome: SmartOutcome;
  metrics: readonly { key: string; label: string; unit: string }[];
  selectedMetricCounts: ReadonlyMap<string, number>;
  errors: Partial<Record<OutcomeField, string>>;
  isSubmitting: boolean;
  canRemove: boolean;
  onChange: (field: OutcomeField, value: string | number) => void;
  onBlur: (field: OutcomeField) => void;
  onRemove: () => void;
}

/** One outcome's controls; the step owns validation exposure and row lifecycle. */
export function AssessmentOutcomeFields({
  outcome,
  metrics,
  selectedMetricCounts,
  errors,
  isSubmitting,
  canRemove,
  onChange,
  onBlur,
  onRemove,
}: AssessmentOutcomeFieldsProps) {
  const { formatMessage } = useIntl();
  return (
    <div
      data-region="outcome-row"
      className="grid grid-cols-[minmax(0,1fr)_3.5rem_2rem] items-start gap-x-2 gap-y-1 [grid-template-areas:'outcome_outcome_remove'_'metric_target_target'] @xl:grid-cols-[minmax(0,1fr)_14rem_7rem_2rem] @xl:[grid-template-areas:'outcome_metric_target_remove']"
    >
      <AdminTextField
        className="[grid-area:outcome]"
        label={formatMessage({
          id: "app.admin.assessment.strategyKernel.outcomeFieldLabel",
          defaultMessage: "Outcome",
        })}
        placeholder={formatMessage({
          id: "app.admin.assessment.strategyKernel.outcomePlaceholder",
          defaultMessage: "A sentence about people or land",
        })}
        disabled={isSubmitting}
        value={outcome.description}
        onChange={(e) => onChange("description", e.target.value)}
        onBlur={() => onBlur("description")}
        error={errors.description}
        helperText={formatMessage({
          id: "app.admin.assessment.strategyKernel.outcomeHelp",
          defaultMessage: "The change you want to see",
        })}
      />

      <AdminSelect
        className="[grid-area:metric]"
        label={formatMessage({
          id: "app.admin.assessment.strategyKernel.metricFieldLabel",
          defaultMessage: "Metric",
        })}
        disabled={isSubmitting}
        value={outcome.metric}
        onChange={(e) => onChange("metric", e.target.value)}
        onBlur={() => onBlur("metric")}
        error={errors.metric}
        helperText={formatMessage({
          id: "app.admin.assessment.strategyKernel.metricHelp",
          defaultMessage: "What you'll count",
        })}
      >
        <option value="">
          {formatMessage({
            id: "app.admin.assessment.strategyKernel.selectMetric",
            defaultMessage: "Select Metric",
          })}
        </option>
        {metrics.map((m) => (
          <option
            key={m.key}
            value={m.key}
            disabled={outcome.metric !== m.key && (selectedMetricCounts.get(m.key) ?? 0) > 0}
          >
            {m.label} ({m.unit})
          </option>
        ))}
      </AdminSelect>

      <AdminTextField
        className="[grid-area:target] [&_[data-region=supporting-line]]:min-h-8"
        type="number"
        label={formatMessage({
          id: "app.admin.assessment.strategyKernel.targetFieldLabel",
          defaultMessage: "Target",
        })}
        disabled={isSubmitting}
        value={String(outcome.target)}
        onChange={(e) => onChange("target", e.target.valueAsNumber)}
        onBlur={() => onBlur("target")}
        error={errors.target}
        helperText={formatMessage({
          id: "app.admin.assessment.strategyKernel.targetHelp",
          defaultMessage: "How much",
        })}
        inputProps={{ min: 0, step: "any" }}
      />

      {/* Always in its column, so adding a second outcome never
          shifts the fields; centred on the field's 44 / 40px box. */}
      <AdminIconButton
        variant="danger"
        className="mt-1.5 [grid-area:remove] sm:mt-1"
        onClick={onRemove}
        disabled={isSubmitting || !canRemove}
        label={formatMessage({
          id: "app.admin.assessment.strategyKernel.removeOutcome",
          defaultMessage: "Remove Outcome",
        })}
      >
        <RiDeleteBinLine />
      </AdminIconButton>
    </div>
  );
}
