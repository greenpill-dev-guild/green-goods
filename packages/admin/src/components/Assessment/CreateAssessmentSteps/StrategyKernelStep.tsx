import { cn, CynefinPhase, Domain } from "@green-goods/shared";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  useController,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import { useIntl, type IntlShape } from "react-intl";
import {
  type CreateAssessmentForm,
  Section,
  LabeledField,
  inputClassName,
  textareaClassName,
  extractErrorMessage,
} from "./shared";

/** Domain metric keys (stable identifiers) mapped to i18n label/unit keys */
const DOMAIN_METRIC_KEYS: Record<Domain, { key: string; labelId: string; unitId: string }[]> = {
  [Domain.SOLAR]: [
    { key: "kwhGenerated", labelId: "app.admin.assessment.strategyKernel.metric.energyGenerated", unitId: "app.admin.assessment.strategyKernel.unit.kwh" },
    { key: "panelsInstalled", labelId: "app.admin.assessment.strategyKernel.metric.panelsInstalled", unitId: "app.admin.assessment.strategyKernel.unit.panels" },
    { key: "hubsOnboarded", labelId: "app.admin.assessment.strategyKernel.metric.hubsOnboarded", unitId: "app.admin.assessment.strategyKernel.unit.hubs" },
    { key: "batteryCapacityKwh", labelId: "app.admin.assessment.strategyKernel.metric.batteryCapacity", unitId: "app.admin.assessment.strategyKernel.unit.kwh" },
    { key: "householdsServed", labelId: "app.admin.assessment.strategyKernel.metric.householdsServed", unitId: "app.admin.assessment.strategyKernel.unit.households" },
  ],
  [Domain.AGRO]: [
    { key: "treesPlanted", labelId: "app.admin.assessment.strategyKernel.metric.treesPlanted", unitId: "app.admin.assessment.strategyKernel.unit.trees" },
    { key: "areaCoveredHa", labelId: "app.admin.assessment.strategyKernel.metric.areaCovered", unitId: "app.admin.assessment.strategyKernel.unit.ha" },
    { key: "yieldKg", labelId: "app.admin.assessment.strategyKernel.metric.harvestYield", unitId: "app.admin.assessment.strategyKernel.unit.kg" },
    { key: "speciesCount", labelId: "app.admin.assessment.strategyKernel.metric.speciesDiversity", unitId: "app.admin.assessment.strategyKernel.unit.species" },
    { key: "waterUsageLiters", labelId: "app.admin.assessment.strategyKernel.metric.waterUsage", unitId: "app.admin.assessment.strategyKernel.unit.liters" },
  ],
  [Domain.EDU]: [
    { key: "participantsCount", labelId: "app.admin.assessment.strategyKernel.metric.participants", unitId: "app.admin.assessment.strategyKernel.unit.people" },
    { key: "sessionsDelivered", labelId: "app.admin.assessment.strategyKernel.metric.sessionsDelivered", unitId: "app.admin.assessment.strategyKernel.unit.sessions" },
    { key: "hoursDelivered", labelId: "app.admin.assessment.strategyKernel.metric.hoursDelivered", unitId: "app.admin.assessment.strategyKernel.unit.hours" },
    { key: "materialsDistributed", labelId: "app.admin.assessment.strategyKernel.metric.materialsDistributed", unitId: "app.admin.assessment.strategyKernel.unit.items" },
    { key: "completionRate", labelId: "app.admin.assessment.strategyKernel.metric.completionRate", unitId: "app.admin.assessment.strategyKernel.unit.percent" },
  ],
  [Domain.WASTE]: [
    { key: "wasteCollectedKg", labelId: "app.admin.assessment.strategyKernel.metric.wasteCollected", unitId: "app.admin.assessment.strategyKernel.unit.kg" },
    { key: "areaCleanedM2", labelId: "app.admin.assessment.strategyKernel.metric.areaCleaned", unitId: "app.admin.assessment.strategyKernel.unit.m2" },
    { key: "recycledKg", labelId: "app.admin.assessment.strategyKernel.metric.materialRecycled", unitId: "app.admin.assessment.strategyKernel.unit.kg" },
    { key: "compostKg", labelId: "app.admin.assessment.strategyKernel.metric.compostProduced", unitId: "app.admin.assessment.strategyKernel.unit.kg" },
    { key: "participantsCount", labelId: "app.admin.assessment.strategyKernel.metric.volunteers", unitId: "app.admin.assessment.strategyKernel.unit.people" },
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
    label: intl.formatMessage({ id: m.labelId, defaultMessage: METRIC_DEFAULTS[m.labelId] ?? m.key }),
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
  "app.admin.assessment.strategyKernel.cynefin.clearDescription": "Known knowns. Best practices apply, cause-effect obvious.",
  "app.admin.assessment.strategyKernel.cynefin.complicated": "Complicated",
  "app.admin.assessment.strategyKernel.cynefin.complicatedDescription": "Known unknowns. Expert analysis needed, multiple right answers.",
  "app.admin.assessment.strategyKernel.cynefin.complex": "Complex",
  "app.admin.assessment.strategyKernel.cynefin.complexDescription": "Unknown unknowns. Safe-to-fail probes, emergent practice.",
  "app.admin.assessment.strategyKernel.cynefin.chaotic": "Chaotic",
  "app.admin.assessment.strategyKernel.cynefin.chaoticDescription": "No cause-effect. Act first, novel practice required.",
};

/** Resolve Cynefin options with i18n labels */
function resolveCynefinOptions(intl: IntlShape) {
  return CYNEFIN_PHASE_KEYS.map((opt) => ({
    value: opt.value,
    label: intl.formatMessage({ id: opt.labelId, defaultMessage: CYNEFIN_DEFAULTS[opt.labelId] }),
    description: intl.formatMessage({ id: opt.descriptionId, defaultMessage: CYNEFIN_DEFAULTS[opt.descriptionId] }),
  }));
}

interface StrategyKernelStepProps {
  register: UseFormRegister<CreateAssessmentForm>;
  errors: FieldErrors<CreateAssessmentForm>;
  control: Control<CreateAssessmentForm>;
  isSubmitting: boolean;
}

/**
 * Step 1: Strategy Kernel
 * Fields: title, description, location, diagnosis (textarea),
 *         SMART outcomes (repeater), Cynefin phase (radio selector)
 */
export function StrategyKernelStep({
  register,
  errors,
  control,
  isSubmitting,
}: StrategyKernelStepProps) {
  const intl = useIntl();

  // Watch the domain field to filter metrics (defaults to SOLAR)
  const selectedDomain = useWatch({ control, name: "domain" }) ?? Domain.SOLAR;
  const metrics = resolveDomainMetrics(intl, selectedDomain as Domain);
  const cynefinOptions = resolveCynefinOptions(intl);

  // SMART outcomes field array
  const { fields, append, remove } = useFieldArray({
    control,
    name: "smartOutcomes",
  });

  // Cynefin phase controller
  const { field: cynefinField } = useController({
    control,
    name: "cynefinPhase",
  });

  return (
    <div className="space-y-6">
      <Section
        title={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.sectionTitle", defaultMessage: "Strategy Kernel" })}
        description={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.sectionDescription", defaultMessage: "Define the challenge, outcomes, and complexity context for this assessment." })}
      >
        <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
          <LabeledField
            label={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.titleLabel", defaultMessage: "Title" })}
            required
            error={errors.title?.message}
            helpText={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.titleHelp", defaultMessage: "Summarise this assessment in a few words." })}
          >
            <input
              type="text"
              disabled={isSubmitting}
              className={inputClassName(errors.title)}
              {...register("title")}
            />
          </LabeledField>
          <LabeledField
            label={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.locationLabel", defaultMessage: "Location" })}
            required
            error={errors.location?.message}
            helpText={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.locationHelp", defaultMessage: "Where this assessment applies." })}
          >
            <input
              type="text"
              disabled={isSubmitting}
              className={inputClassName(errors.location)}
              {...register("location")}
            />
          </LabeledField>
        </div>

        <LabeledField
          label={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.descriptionLabel", defaultMessage: "Description" })}
          required
          error={errors.description?.message}
          helpText={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.descriptionHelp", defaultMessage: "Provide context and goals for this assessment." })}
        >
          <textarea
            rows={2}
            disabled={isSubmitting}
            className={textareaClassName(errors.description)}
            {...register("description")}
          />
        </LabeledField>

        <LabeledField
          label={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.diagnosisLabel", defaultMessage: "Diagnosis" })}
          required
          error={errors.diagnosis?.message}
          helpText={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.diagnosisHelp", defaultMessage: "Root-cause analysis of the challenge being addressed." })}
        >
          <textarea
            rows={4}
            disabled={isSubmitting}
            className={textareaClassName(errors.diagnosis)}
            placeholder={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.diagnosisPlaceholder", defaultMessage: "Describe the core challenge and its root causes..." })}
            {...register("diagnosis")}
          />
        </LabeledField>
      </Section>

      {/* SMART Outcomes Repeater */}
      <Section
        title={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.smartOutcomesTitle", defaultMessage: "SMART Outcomes" })}
        description={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.smartOutcomesDescription", defaultMessage: "Define measurable targets. Each outcome needs a description, metric, and target value." })}
      >
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-col gap-2 rounded-lg border border-stroke-soft bg-bg-white p-3 sm:flex-row sm:items-start sm:gap-3"
            >
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  placeholder={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.outcomePlaceholder", defaultMessage: "What this outcome achieves..." })}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong shadow-sm transition focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-24",
                    errors.smartOutcomes?.[index]?.description &&
                      "border-error-light focus:border-error-base focus:ring-error-lighter"
                  )}
                  {...register(`smartOutcomes.${index}.description`)}
                />
                {errors.smartOutcomes?.[index]?.description && (
                  <p className="text-xs text-error-dark">
                    {errors.smartOutcomes[index].description.message}
                  </p>
                )}
              </div>

              <div className="w-full sm:w-48">
                <select
                  disabled={isSubmitting}
                  className={cn(
                    "w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong shadow-sm transition focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-24",
                    errors.smartOutcomes?.[index]?.metric &&
                      "border-error-light focus:border-error-base focus:ring-error-lighter"
                  )}
                  {...register(`smartOutcomes.${index}.metric`)}
                >
                  <option value="">{intl.formatMessage({ id: "app.admin.assessment.strategyKernel.selectMetric", defaultMessage: "Select metric" })}</option>
                  {metrics.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.unit})
                    </option>
                  ))}
                </select>
                {errors.smartOutcomes?.[index]?.metric && (
                  <p className="mt-0.5 text-xs text-error-dark">
                    {errors.smartOutcomes[index].metric.message}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2">
                <div className="w-24">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.targetPlaceholder", defaultMessage: "Target" })}
                    disabled={isSubmitting}
                    className={cn(
                      "w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong shadow-sm transition focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-24",
                      errors.smartOutcomes?.[index]?.target &&
                        "border-error-light focus:border-error-base focus:ring-error-lighter"
                    )}
                    {...register(`smartOutcomes.${index}.target`, { valueAsNumber: true })}
                  />
                  {errors.smartOutcomes?.[index]?.target && (
                    <p className="mt-0.5 text-xs text-error-dark">
                      {errors.smartOutcomes[index].target.message}
                    </p>
                  )}
                </div>

                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={isSubmitting}
                    className="mt-1 rounded-md p-1.5 text-error-base transition hover:bg-error-lighter hover:text-error-dark disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.removeOutcome", defaultMessage: "Remove outcome" })}
                  >
                    <RiDeleteBinLine className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Array-level error */}
          {errors.smartOutcomes && !Array.isArray(errors.smartOutcomes) && (
            <p className="text-xs text-error-dark">{extractErrorMessage(errors.smartOutcomes)}</p>
          )}

          <button
            type="button"
            onClick={() => append({ description: "", metric: "", target: 0 })}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-md border border-stroke-soft px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RiAddLine className="h-4 w-4" />
            {intl.formatMessage({ id: "app.admin.assessment.strategyKernel.addOutcome", defaultMessage: "Add outcome" })}
          </button>
        </div>
      </Section>

      {/* Cynefin Phase Selector */}
      <Section
        title={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.cynefinTitle", defaultMessage: "Cynefin Phase" })}
        description={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.cynefinDescription", defaultMessage: "Classify the complexity of the operating environment." })}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cynefinOptions.map((option) => {
            const isSelected = Number(cynefinField.value) === option.value;
            return (
              <label
                key={option.value}
                aria-label={intl.formatMessage({ id: "app.admin.assessment.strategyKernel.cynefinAriaLabel", defaultMessage: "Cynefin phase: {phase}" }, { phase: option.label })}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition",
                  isSelected
                    ? "border-primary-base bg-primary-alpha-10 text-primary-dark"
                    : "border-stroke-soft bg-bg-white text-text-sub hover:border-primary-alpha-24 hover:bg-primary-alpha-10",
                  isSubmitting && "cursor-not-allowed opacity-60"
                )}
              >
                <input
                  type="radio"
                  name="cynefinPhase"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => cynefinField.onChange(option.value)}
                  disabled={isSubmitting}
                  className="mt-0.5 h-4 w-4 border-stroke-sub text-primary-base focus:ring-2 focus:ring-primary-alpha-24 focus:ring-offset-0"
                />
                <div>
                  <span className="text-sm font-medium">{option.label}</span>
                  <p className="mt-0.5 text-xs text-text-soft">{option.description}</p>
                </div>
              </label>
            );
          })}
        </div>
        {errors.cynefinPhase && (
          <p className="text-xs text-error-dark">{errors.cynefinPhase.message}</p>
        )}
      </Section>
    </div>
  );
}
