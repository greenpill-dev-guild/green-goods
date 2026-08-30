import { useCreateAssessmentStore } from "@green-goods/shared/stores/useCreateAssessmentStore";
import { CynefinPhase, Domain } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import { useMemo } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { AdminButton, AdminIconButton } from "../../AdminButton";
import { AdminSelect, AdminTextArea, AdminTextField } from "../../AdminTextField";
import { DOMAIN_GUIDANCE, domainKey, Section } from "./shared";

const CYNEFIN_SLUGS: Record<CynefinPhase, string> = {
  [CynefinPhase.CLEAR]: "clear",
  [CynefinPhase.COMPLICATED]: "complicated",
  [CynefinPhase.COMPLEX]: "complex",
  [CynefinPhase.CHAOTIC]: "chaotic",
};

/** Domain metric keys (stable identifiers) mapped to i18n label/unit keys */
const DOMAIN_METRIC_KEYS: Record<Domain, { key: string; labelId: string; unitId: string }[]> = {
  [Domain.SOLAR]: [
    {
      key: "kwhGenerated",
      labelId: "app.admin.assessment.strategyKernel.metric.energyGenerated",
      unitId: "app.admin.assessment.strategyKernel.unit.kwh",
    },
    {
      key: "panelsInstalled",
      labelId: "app.admin.assessment.strategyKernel.metric.panelsInstalled",
      unitId: "app.admin.assessment.strategyKernel.unit.panels",
    },
    {
      key: "hubsOnboarded",
      labelId: "app.admin.assessment.strategyKernel.metric.hubsOnboarded",
      unitId: "app.admin.assessment.strategyKernel.unit.hubs",
    },
    {
      key: "batteryCapacityKwh",
      labelId: "app.admin.assessment.strategyKernel.metric.batteryCapacity",
      unitId: "app.admin.assessment.strategyKernel.unit.kwh",
    },
    {
      key: "householdsServed",
      labelId: "app.admin.assessment.strategyKernel.metric.householdsServed",
      unitId: "app.admin.assessment.strategyKernel.unit.households",
    },
  ],
  [Domain.AGRO]: [
    {
      key: "treesPlanted",
      labelId: "app.admin.assessment.strategyKernel.metric.treesPlanted",
      unitId: "app.admin.assessment.strategyKernel.unit.trees",
    },
    {
      key: "areaCoveredHa",
      labelId: "app.admin.assessment.strategyKernel.metric.areaCovered",
      unitId: "app.admin.assessment.strategyKernel.unit.ha",
    },
    {
      key: "yieldKg",
      labelId: "app.admin.assessment.strategyKernel.metric.harvestYield",
      unitId: "app.admin.assessment.strategyKernel.unit.kg",
    },
    {
      key: "speciesCount",
      labelId: "app.admin.assessment.strategyKernel.metric.speciesDiversity",
      unitId: "app.admin.assessment.strategyKernel.unit.species",
    },
    {
      key: "waterUsageLiters",
      labelId: "app.admin.assessment.strategyKernel.metric.waterUsage",
      unitId: "app.admin.assessment.strategyKernel.unit.liters",
    },
  ],
  [Domain.EDU]: [
    {
      key: "participantsCount",
      labelId: "app.admin.assessment.strategyKernel.metric.participants",
      unitId: "app.admin.assessment.strategyKernel.unit.people",
    },
    {
      key: "sessionsDelivered",
      labelId: "app.admin.assessment.strategyKernel.metric.sessionsDelivered",
      unitId: "app.admin.assessment.strategyKernel.unit.sessions",
    },
    {
      key: "hoursDelivered",
      labelId: "app.admin.assessment.strategyKernel.metric.hoursDelivered",
      unitId: "app.admin.assessment.strategyKernel.unit.hours",
    },
    {
      key: "materialsDistributed",
      labelId: "app.admin.assessment.strategyKernel.metric.materialsDistributed",
      unitId: "app.admin.assessment.strategyKernel.unit.items",
    },
    {
      key: "completionRate",
      labelId: "app.admin.assessment.strategyKernel.metric.completionRate",
      unitId: "app.admin.assessment.strategyKernel.unit.percent",
    },
  ],
  [Domain.WASTE]: [
    {
      key: "wasteCollectedKg",
      labelId: "app.admin.assessment.strategyKernel.metric.wasteCollected",
      unitId: "app.admin.assessment.strategyKernel.unit.kg",
    },
    {
      key: "areaCleanedM2",
      labelId: "app.admin.assessment.strategyKernel.metric.areaCleaned",
      unitId: "app.admin.assessment.strategyKernel.unit.m2",
    },
    {
      key: "recycledKg",
      labelId: "app.admin.assessment.strategyKernel.metric.materialRecycled",
      unitId: "app.admin.assessment.strategyKernel.unit.kg",
    },
    {
      key: "compostKg",
      labelId: "app.admin.assessment.strategyKernel.metric.compostProduced",
      unitId: "app.admin.assessment.strategyKernel.unit.kg",
    },
    {
      key: "participantsCount",
      labelId: "app.admin.assessment.strategyKernel.metric.volunteers",
      unitId: "app.admin.assessment.strategyKernel.unit.people",
    },
  ],
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

/** Resolve domain metrics with i18n labels */
function resolveDomainMetrics(intl: IntlShape, domain: Domain) {
  const keys = DOMAIN_METRIC_KEYS[domain] ?? DOMAIN_METRIC_KEYS[Domain.SOLAR];
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
function resolveCynefinOptions(intl: IntlShape) {
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
  isSubmitting: boolean;
}

/**
 * Step 2: Strategy Kernel
 * Fields: diagnosis (textarea), SMART outcomes (repeater), Cynefin phase (radio selector)
 */
export function StrategyKernelStep({ showValidation, isSubmitting }: StrategyKernelStepProps) {
  const intl = useIntl();
  const { formatMessage } = intl;

  const form = useCreateAssessmentStore((s) => s.form);
  const setField = useCreateAssessmentStore((s) => s.setField);
  const addSmartOutcome = useCreateAssessmentStore((s) => s.addSmartOutcome);
  const removeSmartOutcome = useCreateAssessmentStore((s) => s.removeSmartOutcome);
  const updateSmartOutcome = useCreateAssessmentStore((s) => s.updateSmartOutcome);

  const domainEnum = form.domain;
  // Fallback so an unset/out-of-range persisted domain can't crash the step
  // (mirrors resolveDomainMetrics' `?? Domain.SOLAR` guard below).
  const guidance = DOMAIN_GUIDANCE[domainEnum] ?? DOMAIN_GUIDANCE[Domain.SOLAR];
  const metrics = resolveDomainMetrics(intl, domainEnum);
  const cynefinOptions = resolveCynefinOptions(intl);

  // Local validation errors
  const fieldErrors = useMemo(
    () => ({
      diagnosis:
        form.diagnosis.trim().length > 0
          ? null
          : formatMessage({
              id: "app.admin.assessment.strategyKernel.diagnosisRequired",
              defaultMessage: "Diagnosis is required",
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
      o.metric.trim().length > 0
        ? null
        : formatMessage({
            id: "app.admin.assessment.strategyKernel.outcomeMetricRequired",
            defaultMessage: "Select a metric",
          }),
    target:
      o.target >= 0
        ? null
        : formatMessage({
            id: "app.admin.assessment.strategyKernel.outcomeTargetPositive",
            defaultMessage: "Target must be positive",
          }),
  }));

  return (
    <div className="space-y-6">
      <Section
        title={formatMessage({
          id: "app.admin.assessment.strategyKernel.sectionTitle",
          defaultMessage: "Strategy Kernel",
        })}
        description={formatMessage({
          id: "app.admin.assessment.strategyKernel.sectionDescription",
          defaultMessage:
            "Define the challenge, outcomes, and complexity context for this assessment.",
        })}
      >
        <AdminTextArea
          label={formatMessage({
            id: "app.admin.assessment.strategyKernel.diagnosisLabel",
            defaultMessage: "Diagnosis",
          })}
          required
          rows={4}
          disabled={isSubmitting}
          value={form.diagnosis}
          onChange={(e) => setField("diagnosis", e.target.value)}
          error={(showValidation && fieldErrors.diagnosis) || undefined}
          helperText={formatMessage({
            id: domainKey("app.admin.assessment.strategyKernel.diagnosisHelp", domainEnum),
            defaultMessage: guidance.diagnosisHelp,
          })}
          placeholder={formatMessage({
            id: domainKey("app.admin.assessment.strategyKernel.diagnosisPlaceholder", domainEnum),
            defaultMessage: guidance.diagnosisPlaceholder,
          })}
        />
      </Section>

      {/* SMART Outcomes Repeater */}
      <Section
        title={formatMessage({
          id: "app.admin.assessment.strategyKernel.smartOutcomesTitle",
          defaultMessage: "SMART Outcomes",
        })}
        description={formatMessage({
          id: "app.admin.assessment.strategyKernel.smartOutcomesDescription",
          defaultMessage:
            "Define measurable targets. Each outcome needs a description, metric, and target value.",
        })}
      >
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: domainKey("app.admin.assessment.strategyKernel.smartOutcomeExample", domainEnum),
            defaultMessage: guidance.smartOutcomeExample,
          })}
        </p>
        <div className="space-y-3">
          {form.smartOutcomes.map((outcome, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 rounded-lg border border-stroke-soft bg-bg-white p-3 sm:flex-row sm:items-start sm:gap-3"
            >
              <AdminTextField
                className="flex-1"
                label={formatMessage({
                  id: "app.admin.assessment.strategyKernel.outcomeFieldLabel",
                  defaultMessage: "Outcome",
                })}
                placeholder={formatMessage({
                  id: "app.admin.assessment.strategyKernel.outcomePlaceholder",
                  defaultMessage: "What this outcome achieves...",
                })}
                disabled={isSubmitting}
                value={outcome.description}
                onChange={(e) => updateSmartOutcome(index, "description", e.target.value)}
                error={(showValidation && outcomeErrors[index]?.description) || undefined}
              />

              <AdminSelect
                className="w-full sm:w-48"
                label={formatMessage({
                  id: "app.admin.assessment.strategyKernel.metricFieldLabel",
                  defaultMessage: "Metric",
                })}
                disabled={isSubmitting}
                value={outcome.metric}
                onChange={(e) => updateSmartOutcome(index, "metric", e.target.value)}
                error={(showValidation && outcomeErrors[index]?.metric) || undefined}
              >
                <option value="">
                  {formatMessage({
                    id: "app.admin.assessment.strategyKernel.selectMetric",
                    defaultMessage: "Select Metric",
                  })}
                </option>
                {metrics.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} ({m.unit})
                  </option>
                ))}
              </AdminSelect>

              <div className="flex items-start gap-2">
                <AdminTextField
                  className="w-28"
                  type="number"
                  label={formatMessage({
                    id: "app.admin.assessment.strategyKernel.targetFieldLabel",
                    defaultMessage: "Target",
                  })}
                  disabled={isSubmitting}
                  value={String(outcome.target)}
                  onChange={(e) => updateSmartOutcome(index, "target", e.target.valueAsNumber)}
                  error={(showValidation && outcomeErrors[index]?.target) || undefined}
                  inputProps={{ min: 0, step: "any" }}
                />

                {form.smartOutcomes.length > 1 && (
                  <AdminIconButton
                    variant="danger"
                    className="mt-1.5"
                    onClick={() => removeSmartOutcome(index)}
                    disabled={isSubmitting}
                    label={formatMessage({
                      id: "app.admin.assessment.strategyKernel.removeOutcome",
                      defaultMessage: "Remove Outcome",
                    })}
                  >
                    <RiDeleteBinLine />
                  </AdminIconButton>
                )}
              </div>
            </div>
          ))}

          {/* Array-level error */}
          {showValidation && fieldErrors.smartOutcomes && (
            <p className="text-xs text-error-dark">{fieldErrors.smartOutcomes}</p>
          )}

          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={() => addSmartOutcome()}
            disabled={isSubmitting}
            leadingIcon={<RiAddLine />}
          >
            {formatMessage({
              id: "app.admin.assessment.strategyKernel.addOutcome",
              defaultMessage: "Add Outcome",
            })}
          </AdminButton>
        </div>
      </Section>

      {/* Cynefin Phase Selector */}
      <Section
        title={formatMessage({
          id: "app.admin.assessment.strategyKernel.cynefinTitle",
          defaultMessage: "Cynefin Phase",
        })}
        description={formatMessage({
          id: "app.admin.assessment.strategyKernel.cynefinDescription",
          defaultMessage: "Classify the complexity of the operating environment.",
        })}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cynefinOptions.map((option) => {
            const isSelected = form.cynefinPhase === option.value;
            return (
              <label
                key={option.value}
                aria-label={formatMessage(
                  {
                    id: "app.admin.assessment.strategyKernel.cynefinAriaLabel",
                    defaultMessage: "Cynefin phase: {phase}",
                  },
                  { phase: option.label }
                )}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition",
                  isSelected
                    ? "border-primary-base bg-primary-alpha-10 text-primary-dark"
                    : "border-stroke-soft bg-bg-white text-text-sub hover:bg-[rgb(var(--m3-on-surface)/0.08)]",
                  isSubmitting && "cursor-not-allowed opacity-60"
                )}
              >
                <input
                  type="radio"
                  name="cynefinPhase"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setField("cynefinPhase", option.value)}
                  disabled={isSubmitting}
                  className="mt-0.5 h-4 w-4 border-stroke-sub accent-primary-base focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] focus-visible:ring-offset-0"
                />
                <div>
                  <span className="label-md font-medium">{option.label}</span>
                  <p className="mt-0.5 body-sm text-text-soft">{option.description}</p>
                  <p className="mt-0.5 body-sm italic text-text-soft/70">
                    {formatMessage({
                      id: domainKey(
                        `app.admin.assessment.strategyKernel.cynefinExample.${CYNEFIN_SLUGS[option.value]}`,
                        domainEnum
                      ),
                      defaultMessage: guidance.cynefinExamples[option.value],
                    })}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
