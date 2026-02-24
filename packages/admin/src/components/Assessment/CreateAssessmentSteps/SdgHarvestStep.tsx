import { cn, SDG_TARGETS } from "@green-goods/shared";
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  useController,
} from "react-hook-form";
import { useIntl } from "react-intl";
import {
  type CreateAssessmentForm,
  Section,
  LabeledField,
  inputClassName,
  extractErrorMessage,
} from "./shared";

/** Short icon labels for SDGs (numbered 1-17) */
const SDG_ICONS: Record<number, string> = {
  1: "ri-money-dollar-circle-line",
  2: "ri-restaurant-line",
  3: "ri-heart-pulse-line",
  4: "ri-book-open-line",
  5: "ri-women-line",
  6: "ri-drop-line",
  7: "ri-sun-line",
  8: "ri-briefcase-line",
  9: "ri-building-line",
  10: "ri-scales-3-line",
  11: "ri-community-line",
  12: "ri-recycle-line",
  13: "ri-earth-line",
  14: "ri-anchor-line",
  15: "ri-plant-line",
  16: "ri-shield-check-line",
  17: "ri-links-line",
};

interface SdgHarvestStepProps {
  register: UseFormRegister<CreateAssessmentForm>;
  errors: FieldErrors<CreateAssessmentForm>;
  control: Control<CreateAssessmentForm>;
  isSubmitting: boolean;
}

/**
 * Step 3: SDG Alignment + Harvest Intent
 * SDG multi-select (17 goals as icon+label chips) + reporting period (date range).
 */
export function SdgHarvestStep({ register, errors, control, isSubmitting }: SdgHarvestStepProps) {
  const intl = useIntl();

  // SDG targets controller
  const { field: sdgField } = useController({
    control,
    name: "sdgTargets",
  });

  const selectedSdgs: number[] = Array.isArray(sdgField.value) ? sdgField.value : [];

  const handleToggleSdg = (sdgId: number) => {
    if (isSubmitting) return;
    const next = selectedSdgs.includes(sdgId)
      ? selectedSdgs.filter((id) => id !== sdgId)
      : [...selectedSdgs, sdgId];
    sdgField.onChange(next);
  };

  return (
    <div className="space-y-6">
      {/* SDG Alignment */}
      <Section
        title={intl.formatMessage({ id: "app.admin.assessment.sdgHarvest.sdgTitle", defaultMessage: "SDG Alignment" })}
        description={intl.formatMessage({ id: "app.admin.assessment.sdgHarvest.sdgDescription", defaultMessage: "Select the UN Sustainable Development Goals this assessment aligns with." })}
      >
        <div className="flex items-center justify-between text-xs text-text-soft">
          <span>
            {intl.formatMessage(
              { id: "app.admin.assessment.sdgHarvest.goalsSelected", defaultMessage: "{count} of 17 goals selected" },
              { count: selectedSdgs.length }
            )}
          </span>
          {selectedSdgs.length > 0 && (
            <button
              type="button"
              onClick={() => sdgField.onChange([])}
              disabled={isSubmitting}
              className="text-xs font-medium text-primary-dark hover:text-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
            >
              {intl.formatMessage({ id: "app.admin.assessment.sdgHarvest.clearSelection", defaultMessage: "Clear selection" })}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {SDG_TARGETS.map((sdg) => {
            const isSelected = selectedSdgs.includes(sdg.id);
            const icon = SDG_ICONS[sdg.id] ?? "ri-flag-line";
            return (
              <button
                key={sdg.id}
                type="button"
                onClick={() => handleToggleSdg(sdg.id)}
                disabled={isSubmitting}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                  isSelected
                    ? "border-primary-base bg-primary-alpha-10 text-primary-darker"
                    : "border-stroke-soft bg-bg-white text-text-sub hover:border-primary-alpha-24 hover:bg-primary-alpha-10",
                  isSubmitting && "cursor-not-allowed opacity-60"
                )}
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-bg-weak text-xs font-semibold text-text-soft">
                  {sdg.id}
                </span>
                <i className={cn(icon, "flex-shrink-0 text-base")} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{sdg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Error message */}
        <span className="block min-h-[1.25rem] text-xs text-error-dark">
          {extractErrorMessage(errors.sdgTargets) || "\u00A0"}
        </span>
      </Section>

      {/* Harvest Intent -- Reporting Period */}
      <Section
        title={intl.formatMessage({ id: "app.admin.assessment.sdgHarvest.harvestTitle", defaultMessage: "Harvest Intent" })}
        description={intl.formatMessage({ id: "app.admin.assessment.sdgHarvest.harvestDescription", defaultMessage: "Set the reporting period for work aggregation into hypercerts." })}
      >
        <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
          <LabeledField
            label={intl.formatMessage({ id: "app.admin.assessment.sdgHarvest.reportingStartLabel", defaultMessage: "Reporting period start" })}
            required
            error={errors.reportingPeriodStart?.message}
            helpText={intl.formatMessage({ id: "app.admin.assessment.sdgHarvest.reportingStartHelp", defaultMessage: "Start of the harvest window." })}
          >
            <input
              type="date"
              disabled={isSubmitting}
              className={inputClassName(errors.reportingPeriodStart)}
              {...register("reportingPeriodStart")}
            />
          </LabeledField>
          <LabeledField
            label={intl.formatMessage({ id: "app.admin.assessment.sdgHarvest.reportingEndLabel", defaultMessage: "Reporting period end" })}
            required
            error={errors.reportingPeriodEnd?.message}
            helpText={intl.formatMessage({ id: "app.admin.assessment.sdgHarvest.reportingEndHelp", defaultMessage: "End of the harvest window." })}
          >
            <input
              type="date"
              disabled={isSubmitting}
              className={inputClassName(errors.reportingPeriodEnd)}
              {...register("reportingPeriodEnd")}
            />
          </LabeledField>
        </div>
      </Section>
    </div>
  );
}
