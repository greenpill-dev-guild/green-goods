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
import {
  type CreateAssessmentForm,
  Section,
  LabeledField,
  inputClassName,
  textareaClassName,
  extractErrorMessage,
} from "./shared";

/** Common metrics by domain for the SMART outcomes dropdown */
const DOMAIN_METRICS: Record<Domain, { key: string; label: string; unit: string }[]> = {
  [Domain.SOLAR]: [
    { key: "kwhGenerated", label: "Energy generated", unit: "kWh" },
    { key: "panelsInstalled", label: "Panels installed", unit: "panels" },
    { key: "hubsOnboarded", label: "Hubs onboarded", unit: "hubs" },
    { key: "batteryCapacityKwh", label: "Battery capacity", unit: "kWh" },
    { key: "householdsServed", label: "Households served", unit: "households" },
  ],
  [Domain.AGRO]: [
    { key: "treesPlanted", label: "Trees planted", unit: "trees" },
    { key: "areaCoveredHa", label: "Area covered", unit: "ha" },
    { key: "yieldKg", label: "Harvest yield", unit: "kg" },
    { key: "speciesCount", label: "Species diversity", unit: "species" },
    { key: "waterUsageLiters", label: "Water usage", unit: "liters" },
  ],
  [Domain.EDU]: [
    { key: "participantsCount", label: "Participants", unit: "people" },
    { key: "sessionsDelivered", label: "Sessions delivered", unit: "sessions" },
    { key: "hoursDelivered", label: "Hours delivered", unit: "hours" },
    { key: "materialsDistributed", label: "Materials distributed", unit: "items" },
    { key: "completionRate", label: "Completion rate", unit: "%" },
  ],
  [Domain.WASTE]: [
    { key: "wasteCollectedKg", label: "Waste collected", unit: "kg" },
    { key: "areaCleanedM2", label: "Area cleaned", unit: "m\u00B2" },
    { key: "recycledKg", label: "Material recycled", unit: "kg" },
    { key: "compostKg", label: "Compost produced", unit: "kg" },
    { key: "participantsCount", label: "Volunteers", unit: "people" },
  ],
};

/** Labels and descriptions for Cynefin phases */
const CYNEFIN_OPTIONS = [
  {
    value: CynefinPhase.CLEAR,
    label: "Clear",
    description: "Known knowns. Best practices apply, cause-effect obvious.",
  },
  {
    value: CynefinPhase.COMPLICATED,
    label: "Complicated",
    description: "Known unknowns. Expert analysis needed, multiple right answers.",
  },
  {
    value: CynefinPhase.COMPLEX,
    label: "Complex",
    description: "Unknown unknowns. Safe-to-fail probes, emergent practice.",
  },
  {
    value: CynefinPhase.CHAOTIC,
    label: "Chaotic",
    description: "No cause-effect. Act first, novel practice required.",
  },
] as const;

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
  // Watch the domain field to filter metrics (defaults to SOLAR)
  const selectedDomain = useWatch({ control, name: "domain" }) ?? Domain.SOLAR;
  const metrics = DOMAIN_METRICS[selectedDomain as Domain] ?? DOMAIN_METRICS[Domain.SOLAR];

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
        title="Strategy Kernel"
        description="Define the challenge, outcomes, and complexity context for this assessment."
      >
        <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
          <LabeledField
            label="Title"
            required
            error={errors.title?.message}
            helpText="Summarise this assessment in a few words."
          >
            <input
              type="text"
              disabled={isSubmitting}
              className={inputClassName(errors.title)}
              {...register("title")}
            />
          </LabeledField>
          <LabeledField
            label="Location"
            required
            error={errors.location?.message}
            helpText="Where this assessment applies."
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
          label="Description"
          required
          error={errors.description?.message}
          helpText="Provide context and goals for this assessment."
        >
          <textarea
            rows={2}
            disabled={isSubmitting}
            className={textareaClassName(errors.description)}
            {...register("description")}
          />
        </LabeledField>

        <LabeledField
          label="Diagnosis"
          required
          error={errors.diagnosis?.message}
          helpText="Root-cause analysis of the challenge being addressed."
        >
          <textarea
            rows={4}
            disabled={isSubmitting}
            className={textareaClassName(errors.diagnosis)}
            placeholder="Describe the core challenge and its root causes..."
            {...register("diagnosis")}
          />
        </LabeledField>
      </Section>

      {/* SMART Outcomes Repeater */}
      <Section
        title="SMART Outcomes"
        description="Define measurable targets. Each outcome needs a description, metric, and target value."
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
                  placeholder="What this outcome achieves..."
                  disabled={isSubmitting}
                  className={cn(
                    "w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80",
                    errors.smartOutcomes?.[index]?.description &&
                      "border-red-300 focus:border-red-400 focus:ring-red-100/60"
                  )}
                  {...register(`smartOutcomes.${index}.description`)}
                />
                {errors.smartOutcomes?.[index]?.description && (
                  <p className="text-xs text-red-600">
                    {errors.smartOutcomes[index].description.message}
                  </p>
                )}
              </div>

              <div className="w-full sm:w-48">
                <select
                  disabled={isSubmitting}
                  className={cn(
                    "w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80",
                    errors.smartOutcomes?.[index]?.metric &&
                      "border-red-300 focus:border-red-400 focus:ring-red-100/60"
                  )}
                  {...register(`smartOutcomes.${index}.metric`)}
                >
                  <option value="">Select metric</option>
                  {metrics.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.unit})
                    </option>
                  ))}
                </select>
                {errors.smartOutcomes?.[index]?.metric && (
                  <p className="mt-0.5 text-xs text-red-600">
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
                    placeholder="Target"
                    disabled={isSubmitting}
                    className={cn(
                      "w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80",
                      errors.smartOutcomes?.[index]?.target &&
                        "border-red-300 focus:border-red-400 focus:ring-red-100/60"
                    )}
                    {...register(`smartOutcomes.${index}.target`, { valueAsNumber: true })}
                  />
                  {errors.smartOutcomes?.[index]?.target && (
                    <p className="mt-0.5 text-xs text-red-600">
                      {errors.smartOutcomes[index].target.message}
                    </p>
                  )}
                </div>

                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={isSubmitting}
                    className="mt-1 rounded-md p-1.5 text-red-500 transition hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Remove outcome"
                  >
                    <RiDeleteBinLine className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Array-level error */}
          {errors.smartOutcomes && !Array.isArray(errors.smartOutcomes) && (
            <p className="text-xs text-red-600">{extractErrorMessage(errors.smartOutcomes)}</p>
          )}

          <button
            type="button"
            onClick={() => append({ description: "", metric: "", target: 0 })}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-md border border-stroke-soft px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RiAddLine className="h-4 w-4" />
            Add outcome
          </button>
        </div>
      </Section>

      {/* Cynefin Phase Selector */}
      <Section
        title="Cynefin Phase"
        description="Classify the complexity of the operating environment."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CYNEFIN_OPTIONS.map((option) => {
            const isSelected = Number(cynefinField.value) === option.value;
            return (
              <label
                key={option.value}
                aria-label={"Cynefin phase: ".concat(option.label)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition",
                  isSelected
                    ? "border-green-500 bg-green-50 text-green-800"
                    : "border-stroke-soft bg-bg-white text-text-sub hover:border-green-300 hover:bg-green-50/5",
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
                  className="mt-0.5 h-4 w-4 border-stroke-sub text-green-600 focus:ring-2 focus:ring-green-200 focus:ring-offset-0"
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
          <p className="text-xs text-red-600">{errors.cynefinPhase.message}</p>
        )}
      </Section>
    </div>
  );
}
