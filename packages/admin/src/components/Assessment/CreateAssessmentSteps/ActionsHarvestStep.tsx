import { cn, Domain, useActions, useCurrentChain } from "@green-goods/shared";
import { useEffect, useMemo, useRef } from "react";
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  useController,
  useWatch,
} from "react-hook-form";
import { type IntlShape, useIntl } from "react-intl";
import {
  type CreateAssessmentForm,
  extractErrorMessage,
  inputClassName,
  LabeledField,
  Section,
} from "./shared";

const DOMAIN_LABEL_DEFAULTS: Record<string, string> = {
  "app.admin.assessment.domainAction.domain.solar": "Solar",
  "app.admin.assessment.domainAction.domain.agroforestry": "Agroforestry",
  "app.admin.assessment.domainAction.domain.education": "Education",
  "app.admin.assessment.domainAction.domain.waste": "Waste",
};

const DOMAIN_LABEL_IDS: Record<Domain, string> = {
  [Domain.SOLAR]: "app.admin.assessment.domainAction.domain.solar",
  [Domain.AGRO]: "app.admin.assessment.domainAction.domain.agroforestry",
  [Domain.EDU]: "app.admin.assessment.domainAction.domain.education",
  [Domain.WASTE]: "app.admin.assessment.domainAction.domain.waste",
};

function resolveDomainLabel(intl: IntlShape, domain: Domain): string {
  const labelId = DOMAIN_LABEL_IDS[domain];
  return intl.formatMessage({
    id: labelId,
    defaultMessage: DOMAIN_LABEL_DEFAULTS[labelId],
  });
}

interface ActionsHarvestStepProps {
  register: UseFormRegister<CreateAssessmentForm>;
  errors: FieldErrors<CreateAssessmentForm>;
  control: Control<CreateAssessmentForm>;
  isSubmitting: boolean;
}

/**
 * Step 3: Actions & Harvest
 * Actions multi-select (filtered by domain from Step 1) + reporting period date range.
 * Clears selected actions when domain changes.
 */
export function ActionsHarvestStep({
  register,
  errors,
  control,
  isSubmitting,
}: ActionsHarvestStepProps) {
  const intl = useIntl();

  // Watch domain from Step 1
  const selectedDomain = (useWatch({ control, name: "domain" }) ?? Domain.SOLAR) as Domain;

  // Action UIDs controller
  const { field: actionUIDsField } = useController({
    control,
    name: "selectedActionUIDs",
  });

  const selectedUIDs: string[] = Array.isArray(actionUIDsField.value) ? actionUIDsField.value : [];

  // Fetch all actions from the current chain and filter by selected domain
  const chainId = useCurrentChain();
  const { data: allActions = [] } = useActions(chainId);
  const domainActions = useMemo(
    () => allActions.filter((action) => action.domain === selectedDomain),
    [allActions, selectedDomain]
  );

  // Clear selected actions when domain changes
  const prevDomainRef = useRef(selectedDomain);
  useEffect(() => {
    if (prevDomainRef.current === selectedDomain) return;
    prevDomainRef.current = selectedDomain;
    actionUIDsField.onChange([]);
  }, [selectedDomain, actionUIDsField]);

  const handleToggleAction = (actionId: string) => {
    if (isSubmitting) return;
    const next = selectedUIDs.includes(actionId)
      ? selectedUIDs.filter((id) => id !== actionId)
      : [...selectedUIDs, actionId];
    actionUIDsField.onChange(next);
  };

  return (
    <div className="space-y-6">
      {/* Action Multi-Select */}
      <Section
        title={intl.formatMessage({
          id: "app.admin.assessment.domainAction.actionsTitle",
          defaultMessage: "Coherent Actions",
        })}
        description={intl.formatMessage({
          id: "app.admin.assessment.domainAction.actionsDescription",
          defaultMessage: "Select the actions that will be tracked under this assessment.",
        })}
      >
        {domainActions.length === 0 ? (
          <div className="rounded-md border border-dashed border-stroke-soft p-6 text-center">
            <p className="text-sm text-text-soft">
              {intl.formatMessage(
                {
                  id: "app.admin.assessment.domainAction.noActions",
                  defaultMessage: "No actions registered for {domain}.",
                },
                { domain: resolveDomainLabel(intl, selectedDomain) }
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-text-soft">
              <span>
                {intl.formatMessage(
                  {
                    id: "app.admin.assessment.domainAction.selectedCount",
                    defaultMessage: "{count} of {total} actions selected",
                  },
                  { count: selectedUIDs.length, total: domainActions.length }
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (selectedUIDs.length === domainActions.length) {
                    actionUIDsField.onChange([]);
                  } else {
                    actionUIDsField.onChange(domainActions.map((a) => a.id));
                  }
                }}
                disabled={isSubmitting}
                className="text-xs font-medium text-primary-dark hover:text-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
              >
                {selectedUIDs.length === domainActions.length
                  ? intl.formatMessage({
                      id: "app.admin.assessment.domainAction.deselectAll",
                      defaultMessage: "Deselect all",
                    })
                  : intl.formatMessage({
                      id: "app.admin.assessment.domainAction.selectAll",
                      defaultMessage: "Select all",
                    })}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {domainActions.map((action) => {
                const isChecked = selectedUIDs.includes(action.id);
                return (
                  <label
                    key={action.id}
                    aria-label={action.title}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition",
                      isChecked
                        ? "border-primary-base bg-primary-alpha-10 text-primary-dark"
                        : "border-stroke-soft bg-bg-white text-text-sub hover:border-primary-alpha-24 hover:bg-primary-alpha-10",
                      isSubmitting && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleAction(action.id)}
                      disabled={isSubmitting}
                      className="mt-0.5 h-4 w-4 rounded border-stroke-sub text-primary-base focus:ring-2 focus:ring-primary-alpha-24 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{action.title}</span>
                      {action.slug && (
                        <span className="block truncate text-xs text-text-soft">{action.slug}</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Always render to reserve space */}
        <span className="block min-h-[1.25rem] text-xs text-error-dark">
          {extractErrorMessage(errors.selectedActionUIDs) || "\u00A0"}
        </span>
      </Section>

      {/* Reporting Period */}
      <Section
        title={intl.formatMessage({
          id: "app.admin.assessment.sdgHarvest.harvestTitle",
          defaultMessage: "Harvest Intent",
        })}
        description={intl.formatMessage({
          id: "app.admin.assessment.sdgHarvest.harvestDescription",
          defaultMessage: "Set the reporting period for work aggregation into hypercerts.",
        })}
      >
        <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
          <LabeledField
            label={intl.formatMessage({
              id: "app.admin.assessment.sdgHarvest.reportingStartLabel",
              defaultMessage: "Reporting period start",
            })}
            required
            error={errors.reportingPeriodStart?.message}
            helpText={intl.formatMessage({
              id: "app.admin.assessment.sdgHarvest.reportingStartHelp",
              defaultMessage: "Start of the harvest window.",
            })}
          >
            <input
              type="date"
              disabled={isSubmitting}
              className={inputClassName(errors.reportingPeriodStart)}
              {...register("reportingPeriodStart")}
            />
          </LabeledField>
          <LabeledField
            label={intl.formatMessage({
              id: "app.admin.assessment.sdgHarvest.reportingEndLabel",
              defaultMessage: "Reporting period end",
            })}
            required
            error={errors.reportingPeriodEnd?.message}
            helpText={intl.formatMessage({
              id: "app.admin.assessment.sdgHarvest.reportingEndHelp",
              defaultMessage: "End of the harvest window.",
            })}
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
