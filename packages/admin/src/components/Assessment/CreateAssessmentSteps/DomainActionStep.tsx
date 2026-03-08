import { cn, Domain, useActions, useCurrentChain } from "@green-goods/shared";
import { type Control, type FieldErrors, useController } from "react-hook-form";
import { useMemo } from "react";
import { useIntl, type IntlShape } from "react-intl";
import { type CreateAssessmentForm, Section, extractErrorMessage } from "./shared";

/** Domain icon and color (stable), labels resolved via i18n */
const DOMAIN_ICON_CONFIG: Record<Domain, { icon: string; color: string; labelId: string }> = {
  [Domain.SOLAR]: {
    icon: "ri-sun-line",
    color: "amber",
    labelId: "app.admin.assessment.domainAction.domain.solar",
  },
  [Domain.AGRO]: {
    icon: "ri-plant-line",
    color: "green",
    labelId: "app.admin.assessment.domainAction.domain.agroforestry",
  },
  [Domain.EDU]: {
    icon: "ri-book-open-line",
    color: "blue",
    labelId: "app.admin.assessment.domainAction.domain.education",
  },
  [Domain.WASTE]: {
    icon: "ri-recycle-line",
    color: "orange",
    labelId: "app.admin.assessment.domainAction.domain.waste",
  },
};

const DOMAIN_LABEL_DEFAULTS: Record<string, string> = {
  "app.admin.assessment.domainAction.domain.solar": "Solar",
  "app.admin.assessment.domainAction.domain.agroforestry": "Agroforestry",
  "app.admin.assessment.domainAction.domain.education": "Education",
  "app.admin.assessment.domainAction.domain.waste": "Waste",
};

function resolveDomainLabel(intl: IntlShape, domain: Domain): string {
  const config = DOMAIN_ICON_CONFIG[domain];
  return intl.formatMessage({
    id: config.labelId,
    defaultMessage: DOMAIN_LABEL_DEFAULTS[config.labelId],
  });
}

/** Expand a domain bitmask into an array of Domain enum values */
function expandDomainMask(mask: number): Domain[] {
  const domains: Domain[] = [];
  if (mask & 1) domains.push(Domain.SOLAR);
  if (mask & 2) domains.push(Domain.AGRO);
  if (mask & 4) domains.push(Domain.EDU);
  if (mask & 8) domains.push(Domain.WASTE);
  return domains;
}

/** All domains for when no mask is provided */
const ALL_DOMAINS = [Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE];

interface DomainActionStepProps {
  errors: FieldErrors<CreateAssessmentForm>;
  control: Control<CreateAssessmentForm>;
  isSubmitting: boolean;
  /** Garden domain bitmask (bit 0=Solar, 1=Agro, 2=Edu, 3=Waste). If omitted, all domains shown. */
  gardenDomainMask?: number;
}

/**
 * Step 2: Domain + Action Set
 * Domain selector (from garden domain bitmask) + action multi-select (filtered by chosen domain).
 */
export function DomainActionStep({
  errors,
  control,
  isSubmitting,
  gardenDomainMask,
}: DomainActionStepProps) {
  const intl = useIntl();

  // Available domains from garden bitmask (or all if not provided)
  const availableDomains = useMemo(
    () =>
      gardenDomainMask !== undefined && gardenDomainMask !== null
        ? expandDomainMask(gardenDomainMask)
        : ALL_DOMAINS,
    [gardenDomainMask]
  );

  // Domain controller
  const { field: domainField } = useController({
    control,
    name: "domain",
  });

  // Action UIDs controller
  const { field: actionUIDsField } = useController({
    control,
    name: "selectedActionUIDs",
  });

  const selectedDomain = Number(domainField.value) as Domain;

  // Fetch all actions from the current chain and filter by selected domain
  const chainId = useCurrentChain();
  const { data: allActions = [] } = useActions(chainId);
  const domainActions = useMemo(
    () => allActions.filter((action) => action.domain === selectedDomain),
    [allActions, selectedDomain]
  );

  const selectedUIDs: string[] = Array.isArray(actionUIDsField.value) ? actionUIDsField.value : [];

  const handleToggleAction = (actionId: string) => {
    if (isSubmitting) return;
    const next = selectedUIDs.includes(actionId)
      ? selectedUIDs.filter((id) => id !== actionId)
      : [...selectedUIDs, actionId];
    actionUIDsField.onChange(next);
  };

  const handleDomainChange = (domain: Domain) => {
    if (isSubmitting) return;
    domainField.onChange(domain);
    // Clear selected actions when domain changes (they belong to the old domain)
    actionUIDsField.onChange([]);
  };

  return (
    <div className="space-y-6">
      {/* Domain Selector */}
      <Section
        title={intl.formatMessage({
          id: "app.admin.assessment.domainAction.domainTitle",
          defaultMessage: "Domain",
        })}
        description={intl.formatMessage({
          id: "app.admin.assessment.domainAction.domainDescription",
          defaultMessage: "Select the primary action domain for this assessment.",
        })}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {availableDomains.map((domain) => {
            const config = DOMAIN_ICON_CONFIG[domain];
            const isSelected = selectedDomain === domain;
            return (
              <button
                key={domain}
                type="button"
                onClick={() => handleDomainChange(domain)}
                disabled={isSubmitting}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition",
                  isSelected
                    ? "border-primary-base bg-primary-alpha-10 text-primary-darker"
                    : "border-stroke-soft bg-bg-white text-text-sub hover:border-primary-alpha-24 hover:bg-primary-alpha-10",
                  isSubmitting && "cursor-not-allowed opacity-60"
                )}
              >
                <i className={cn(config.icon, "text-base")} aria-hidden="true" />
                {resolveDomainLabel(intl, domain)}
              </button>
            );
          })}
        </div>
        {errors.domain && <p className="text-xs text-error-dark">{errors.domain.message}</p>}
      </Section>

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
    </div>
  );
}
