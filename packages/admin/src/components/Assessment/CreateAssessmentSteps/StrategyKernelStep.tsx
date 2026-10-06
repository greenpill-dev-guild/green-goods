import { DOMAIN_METRICS } from "@green-goods/shared/config/domain";
import { useCreateAssessmentStore } from "@green-goods/shared/stores/useCreateAssessmentStore";
import { CynefinPhase, Domain } from "@green-goods/shared/types/domain";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { AdminButton, AdminIconButton } from "../../AdminButton";
import { AdminSelectableCard } from "../../AdminSelectableCard";
import { AdminSelect, AdminTextArea, AdminTextField } from "../../AdminTextField";
import { formatDomainGuidance, knownDomain, Section } from "./shared";

const CYNEFIN_SLUGS: Record<CynefinPhase, string> = {
  [CynefinPhase.CLEAR]: "clear",
  [CynefinPhase.COMPLICATED]: "complicated",
  [CynefinPhase.COMPLEX]: "complex",
  [CynefinPhase.CHAOTIC]: "chaotic",
};

/** Default messages for metric labels */
const METRIC_DEFAULTS: Record<string, string> = {
  "app.admin.assessment.strategyKernel.metric.energyGenerated": "Energy generated",
  "app.admin.assessment.strategyKernel.metric.panelsInstalled": "Panels installed",
  "app.admin.assessment.strategyKernel.metric.hubsOnboarded": "Hubs onboarded",
  "app.admin.assessment.strategyKernel.metric.batteryCapacity": "Battery capacity",
  "app.admin.assessment.strategyKernel.metric.householdsServed": "Households served",
  "app.admin.assessment.strategyKernel.metric.treesPlanted": "Trees planted",
  "app.admin.assessment.strategyKernel.metric.areaCovered": "Area covered",
  "app.admin.assessment.strategyKernel.metric.harvestYield": "Harvest yield",
  "app.admin.assessment.strategyKernel.metric.speciesDiversity": "Species diversity",
  "app.admin.assessment.strategyKernel.metric.waterUsage": "Water usage",
  "app.admin.assessment.strategyKernel.metric.participants": "Participants",
  "app.admin.assessment.strategyKernel.metric.sessionsDelivered": "Sessions delivered",
  "app.admin.assessment.strategyKernel.metric.hoursDelivered": "Hours delivered",
  "app.admin.assessment.strategyKernel.metric.materialsDistributed": "Materials distributed",
  "app.admin.assessment.strategyKernel.metric.completionRate": "Completion rate",
  "app.admin.assessment.strategyKernel.metric.wasteCollected": "Waste collected",
  "app.admin.assessment.strategyKernel.metric.areaCleaned": "Area cleaned",
  "app.admin.assessment.strategyKernel.metric.materialRecycled": "Material recycled",
  "app.admin.assessment.strategyKernel.metric.compostProduced": "Compost produced",
  "app.admin.assessment.strategyKernel.metric.volunteers": "Volunteers",
};

/** Default messages for unit labels */
const UNIT_DEFAULTS: Record<string, string> = {
  "app.admin.assessment.strategyKernel.unit.kwh": "kWh",
  "app.admin.assessment.strategyKernel.unit.panels": "panels",
  "app.admin.assessment.strategyKernel.unit.hubs": "hubs",
  "app.admin.assessment.strategyKernel.unit.households": "households",
  "app.admin.assessment.strategyKernel.unit.trees": "trees",
  "app.admin.assessment.strategyKernel.unit.ha": "ha",
  "app.admin.assessment.strategyKernel.unit.kg": "kg",
  "app.admin.assessment.strategyKernel.unit.species": "species",
  "app.admin.assessment.strategyKernel.unit.liters": "liters",
  "app.admin.assessment.strategyKernel.unit.people": "people",
  "app.admin.assessment.strategyKernel.unit.sessions": "sessions",
  "app.admin.assessment.strategyKernel.unit.hours": "hours",
  "app.admin.assessment.strategyKernel.unit.items": "items",
  "app.admin.assessment.strategyKernel.unit.percent": "%",
  "app.admin.assessment.strategyKernel.unit.m2": "m\u00B2",
};

/** Resolve domain metrics with i18n labels; none until a known domain is chosen. */
export function resolveDomainMetrics(intl: IntlShape, domain: Domain | null) {
  const keys = domain === null ? [] : DOMAIN_METRICS[domain];
  return keys.map((m) => ({
    key: m.key,
    label: intl.formatMessage({
      id: m.labelId,
      defaultMessage: METRIC_DEFAULTS[m.labelId] ?? m.key,
    }),
    unit: intl.formatMessage({ id: m.unitId, defaultMessage: UNIT_DEFAULTS[m.unitId] ?? m.key }),
  }));
}

/** Cynefin phase keys (stable identifiers) mapped to i18n keys */
const CYNEFIN_PHASE_KEYS = [
  {
    value: CynefinPhase.CLEAR,
    labelId: "app.admin.assessment.strategyKernel.cynefin.clear",
    descriptionId: "app.admin.assessment.strategyKernel.cynefin.clearDescription",
  },
  {
    value: CynefinPhase.COMPLICATED,
    labelId: "app.admin.assessment.strategyKernel.cynefin.complicated",
    descriptionId: "app.admin.assessment.strategyKernel.cynefin.complicatedDescription",
  },
  {
    value: CynefinPhase.COMPLEX,
    labelId: "app.admin.assessment.strategyKernel.cynefin.complex",
    descriptionId: "app.admin.assessment.strategyKernel.cynefin.complexDescription",
  },
  {
    value: CynefinPhase.CHAOTIC,
    labelId: "app.admin.assessment.strategyKernel.cynefin.chaotic",
    descriptionId: "app.admin.assessment.strategyKernel.cynefin.chaoticDescription",
  },
] as const;

const CYNEFIN_DEFAULTS: Record<string, string> = {
  "app.admin.assessment.strategyKernel.cynefin.clear": "Clear",
  "app.admin.assessment.strategyKernel.cynefin.clearDescription":
    "Known knowns. Best practices apply, cause-effect obvious.",
  "app.admin.assessment.strategyKernel.cynefin.complicated": "Complicated",
  "app.admin.assessment.strategyKernel.cynefin.complicatedDescription":
    "Known unknowns. Expert analysis needed, multiple right answers.",
  "app.admin.assessment.strategyKernel.cynefin.complex": "Complex",
  "app.admin.assessment.strategyKernel.cynefin.complexDescription":
    "Unknown unknowns. Safe-to-fail probes, emergent practice.",
  "app.admin.assessment.strategyKernel.cynefin.chaotic": "Chaotic",
  "app.admin.assessment.strategyKernel.cynefin.chaoticDescription":
    "No cause-effect. Act first, novel practice required.",
};

/** Resolve Cynefin options with i18n labels */
export function resolveCynefinOptions(intl: IntlShape) {
  return CYNEFIN_PHASE_KEYS.map((opt) => ({
    value: opt.value,
    label: intl.formatMessage({ id: opt.labelId, defaultMessage: CYNEFIN_DEFAULTS[opt.labelId] }),
    description: intl.formatMessage({
      id: opt.descriptionId,
      defaultMessage: CYNEFIN_DEFAULTS[opt.descriptionId],
    }),
  }));
}

interface StrategyKernelStepProps {
  showValidation: boolean;
  validationAttempt?: number;
  isSubmitting: boolean;
}

/**
 * Step 2: Strategy Kernel
 * Fields: diagnosis (textarea), SMART outcomes (repeater), Cynefin phase (radio cards).
 * Every control sits on the step's own left and right edges, with no card
 * around a row of fields, so they all line up with the challenge above them.
 */
export function StrategyKernelStep({
  showValidation,
  validationAttempt = 0,
  isSubmitting,
}: StrategyKernelStepProps) {
  const intl = useIntl();
  const { formatMessage } = intl;

  const form = useCreateAssessmentStore((s) => s.form);
  const setField = useCreateAssessmentStore((s) => s.setField);
  const addSmartOutcome = useCreateAssessmentStore((s) => s.addSmartOutcome);
  const removeSmartOutcome = useCreateAssessmentStore((s) => s.removeSmartOutcome);
  const updateSmartOutcome = useCreateAssessmentStore((s) => s.updateSmartOutcome);

  // Newly added fields have not participated in the failed validation. They
  // reveal their errors on blur or the next explicit attempt to continue.
  const [freshFields, setFreshFields] = useState({
    attempt: validationAttempt,
    keys: new Set<string>(),
  });
  const revealField = (index: number, field: string) =>
    setFreshFields((current) => {
      const keys = new Set(current.keys);
      keys.delete(`${index}:${field}`);
      return { ...current, keys };
    });
  const showOutcomeError = (index: number, field: string) =>
    showValidation &&
    (freshFields.attempt !== validationAttempt || !freshFields.keys.has(`${index}:${field}`));
  const addOutcome = () => {
    const index = form.smartOutcomes.length;
    setFreshFields((current) => ({
      attempt: validationAttempt,
      keys: new Set([
        ...(current.attempt === validationAttempt ? current.keys : []),
        ...["description", "metric", "target"].map((field) => `${index}:${field}`),
      ]),
    }));
    addSmartOutcome();
  };
  const removeOutcome = (index: number) => {
    setFreshFields((current) => ({
      ...current,
      keys: new Set(
        [...current.keys].flatMap((key) => {
          const [row, field] = key.split(":");
          const rowIndex = Number(row);
          return rowIndex === index
            ? []
            : [`${rowIndex > index ? rowIndex - 1 : rowIndex}:${field}`];
        })
      ),
    }));
    removeSmartOutcome(index);
  };

  // Step 1 requires a domain, but a restored draft can carry a stale one; an
  // unknown domain reads as none (neutral text), never as Solar (DL-047).
  const domainEnum = knownDomain(form.domain);
  const smartOutcomeExample = formatDomainGuidance(
    intl,
    "app.admin.assessment.strategyKernel.smartOutcomeExample",
    domainEnum,
    (guidance) => guidance.smartOutcomeExample
  );
  const metrics = resolveDomainMetrics(intl, domainEnum);
  const cynefinOptions = resolveCynefinOptions(intl);
  const selectedMetricCounts = useMemo(() => {
    const counts = new Map<string, number>();
    form.smartOutcomes.forEach((outcome) => {
      const metric = outcome.metric.trim();
      if (!metric) return;
      counts.set(metric, (counts.get(metric) ?? 0) + 1);
    });
    return counts;
  }, [form.smartOutcomes]);

  // Local validation errors
  const fieldErrors = useMemo(
    () => ({
      diagnosis:
        form.diagnosis.trim().length > 0
          ? null
          : formatMessage({
              id: "app.admin.assessment.strategyKernel.diagnosisRequired",
              defaultMessage: "The challenge is required",
            }),
      smartOutcomes:
        form.smartOutcomes.length > 0 &&
        form.smartOutcomes.every((o) => o.description.trim() && o.metric.trim())
          ? null
          : formatMessage({
              id: "app.admin.assessment.strategyKernel.smartOutcomesRequired",
              defaultMessage: "At least one complete outcome is required",
            }),
    }),
    [form.diagnosis, form.smartOutcomes, formatMessage]
  );

  // Per-item outcome errors
  const outcomeErrors = form.smartOutcomes.map((o) => ({
    description:
      o.description.trim().length > 0
        ? null
        : formatMessage({
            id: "app.admin.assessment.strategyKernel.outcomeDescriptionRequired",
            defaultMessage: "Description is required",
          }),
    metric:
      o.metric.trim().length === 0
        ? formatMessage({
            id: "app.admin.assessment.strategyKernel.outcomeMetricRequired",
            defaultMessage: "Select a metric",
          })
        : (selectedMetricCounts.get(o.metric.trim()) ?? 0) > 1
          ? formatMessage({
              id: "app.admin.assessment.strategyKernel.outcomeMetricDuplicate",
              defaultMessage: "Each metric can only be used once per assessment",
            })
          : null,
    target:
      o.target >= 0
        ? null
        : formatMessage({
            id: "app.admin.assessment.strategyKernel.outcomeTargetPositive",
            defaultMessage: "Use 0 or more",
          }),
  }));

  // An assessment holds at least one outcome, so a lone row's Remove is held.
  const canRemoveOutcome = form.smartOutcomes.length > 1;

  // Roving-tabindex radiogroup, as a native radio set behaves: Tab reaches the
  // chosen phase, and Arrow, Home and End move the choice with the focus.
  const cynefinCards = useRef<(HTMLButtonElement | null)[]>([]);
  const chosenCynefinIndex = cynefinOptions.findIndex(
    (option) => option.value === form.cynefinPhase
  );
  const cynefinTabStop = Math.max(0, chosenCynefinIndex);
  const handleCynefinKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isSubmitting) return;
    const last = cynefinOptions.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        next = cynefinTabStop >= last ? 0 : cynefinTabStop + 1;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = cynefinTabStop <= 0 ? last : cynefinTabStop - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    setField("cynefinPhase", cynefinOptions[next].value);
    cynefinCards.current[next]?.focus();
  };

  return (
    <div className="space-y-6">
      {/* The step title already names this part, so the field stands alone. */}
      <AdminTextArea
        label={formatMessage({
          id: "app.admin.assessment.strategyKernel.diagnosisLabel",
          defaultMessage: "The challenge",
        })}
        required
        rows={4}
        disabled={isSubmitting}
        value={form.diagnosis}
        onChange={(e) => setField("diagnosis", e.target.value)}
        error={(showValidation && fieldErrors.diagnosis) || undefined}
        helperText={formatMessage({
          id: "app.admin.assessment.strategyKernel.diagnosisHelp",
          defaultMessage:
            "What problem is this work addressing, and why does it exist? (the diagnosis)",
        })}
        placeholder={
          formatDomainGuidance(
            intl,
            "app.admin.assessment.strategyKernel.diagnosisPlaceholder",
            domainEnum,
            (guidance) => guidance.diagnosisPlaceholder
          ) ??
          formatMessage({
            id: "app.admin.assessment.strategyKernel.diagnosisPlaceholder",
            defaultMessage: "Describe the core challenge and its root causes...",
          })
        }
      />

      {/* SMART Outcomes Repeater */}
      <Section
        title={formatMessage({
          id: "app.admin.assessment.strategyKernel.smartOutcomesTitle",
          defaultMessage: "What You'll Measure",
        })}
        description={formatMessage({
          id: "app.admin.assessment.strategyKernel.smartOutcomesDescription",
          defaultMessage:
            "Each outcome needs a metric and a target for the end of the reporting period (SMART outcomes)",
        })}
        action={
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={addOutcome}
            disabled={isSubmitting}
            leadingIcon={<RiAddLine />}
          >
            {formatMessage({
              id: "app.admin.assessment.strategyKernel.addOutcome",
              defaultMessage: "Add Outcome",
            })}
          </AdminButton>
        }
      >
        {smartOutcomeExample ? (
          <p className="body-xs text-text-soft">{smartOutcomeExample}</p>
        ) : null}
        {/* The rows answer to this list's width, not the viewport's: one line
            where Outcome, Metric and Target fit. Below that, Outcome and
            Remove share a line over Metric and Target, which leaves the Metric
            wide enough to show its unit. */}
        <div className="@container">
          <div className="flex flex-col gap-4 @xl:gap-2">
            {form.smartOutcomes.map((outcome, index) => (
              <div
                key={index}
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
                  onChange={(e) => updateSmartOutcome(index, "description", e.target.value)}
                  onBlur={() => revealField(index, "description")}
                  error={
                    (showOutcomeError(index, "description") && outcomeErrors[index]?.description) ||
                    undefined
                  }
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
                  onChange={(e) => updateSmartOutcome(index, "metric", e.target.value)}
                  onBlur={() => revealField(index, "metric")}
                  error={
                    (showOutcomeError(index, "metric") && outcomeErrors[index]?.metric) || undefined
                  }
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
                      disabled={
                        outcome.metric !== m.key && (selectedMetricCounts.get(m.key) ?? 0) > 0
                      }
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
                  onChange={(e) => updateSmartOutcome(index, "target", e.target.valueAsNumber)}
                  onBlur={() => revealField(index, "target")}
                  error={
                    (showOutcomeError(index, "target") && outcomeErrors[index]?.target) || undefined
                  }
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
                  onClick={() => removeOutcome(index)}
                  disabled={isSubmitting || !canRemoveOutcome}
                  label={formatMessage({
                    id: "app.admin.assessment.strategyKernel.removeOutcome",
                    defaultMessage: "Remove Outcome",
                  })}
                >
                  <RiDeleteBinLine />
                </AdminIconButton>
              </div>
            ))}
          </div>
        </div>

        {/* Array-level error */}
        {showValidation && fieldErrors.smartOutcomes && (
          <p className="body-xs text-error-dark">{fieldErrors.smartOutcomes}</p>
        )}
      </Section>

      {/* Cynefin Phase Selector */}
      <Section
        title={formatMessage({
          id: "app.admin.assessment.strategyKernel.cynefinTitle",
          defaultMessage: "How Predictable Is This Work?",
        })}
        description={formatMessage({
          id: "app.admin.assessment.strategyKernel.cynefinDescription",
          defaultMessage: "Pick the closest fit (Cynefin)",
        })}
      >
        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving-tabindex radiogroup; focus lives on the AdminSelectableCard radios */}
        <div
          role="radiogroup"
          aria-label={formatMessage({
            id: "app.admin.assessment.strategyKernel.cynefinTitle",
            defaultMessage: "How Predictable Is This Work?",
          })}
          onKeyDown={handleCynefinKeyDown}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {cynefinOptions.map((option, index) => {
            const cynefinExample = formatDomainGuidance(
              intl,
              `app.admin.assessment.strategyKernel.cynefinExample.${CYNEFIN_SLUGS[option.value]}`,
              domainEnum,
              (guidance) => guidance.cynefinExamples[option.value]
            );
            return (
              <AdminSelectableCard
                key={option.value}
                ref={(node) => {
                  cynefinCards.current[index] = node;
                }}
                selectionRole="radio"
                selected={index === chosenCynefinIndex}
                tabIndex={index === cynefinTabStop ? 0 : -1}
                disabled={isSubmitting}
                onClick={() => setField("cynefinPhase", option.value)}
                aria-label={formatMessage(
                  {
                    id: "app.admin.assessment.strategyKernel.cynefinAriaLabel",
                    defaultMessage: "Cynefin phase: {phase}",
                  },
                  { phase: option.label }
                )}
                title={option.label}
                description={
                  <>
                    {option.description}
                    {cynefinExample ? (
                      <span className="mt-0.5 block italic">{cynefinExample}</span>
                    ) : null}
                  </>
                }
              />
            );
          })}
        </div>
      </Section>
    </div>
  );
}
