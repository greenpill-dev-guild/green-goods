import { cn, Domain, useActions, useCurrentChain } from "@green-goods/shared";
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  useController,
} from "react-hook-form";
import { useMemo } from "react";
import { type CreateAssessmentForm, Section, extractErrorMessage } from "./shared";

/** Display config for domains, keyed by Domain enum value */
const DOMAIN_CONFIG: Record<Domain, { label: string; icon: string; color: string }> = {
  [Domain.SOLAR]: { label: "Solar", icon: "ri-sun-line", color: "amber" },
  [Domain.AGRO]: { label: "Agroforestry", icon: "ri-plant-line", color: "green" },
  [Domain.EDU]: { label: "Education", icon: "ri-book-open-line", color: "blue" },
  [Domain.WASTE]: { label: "Waste", icon: "ri-recycle-line", color: "orange" },
};

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
      <Section title="Domain" description="Select the primary action domain for this assessment.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {availableDomains.map((domain) => {
            const config = DOMAIN_CONFIG[domain];
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
                {config.label}
              </button>
            );
          })}
        </div>
        {errors.domain && <p className="text-xs text-error-dark">{errors.domain.message}</p>}
      </Section>

      {/* Action Multi-Select */}
      <Section
        title="Coherent Actions"
        description="Select the actions that will be tracked under this assessment."
      >
        {domainActions.length === 0 ? (
          <div className="rounded-md border border-dashed border-stroke-soft p-6 text-center">
            <p className="text-sm text-text-soft">
              No actions registered for {DOMAIN_CONFIG[selectedDomain].label}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-text-soft">
              <span>
                {selectedUIDs.length} of {domainActions.length} actions selected
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
                {selectedUIDs.length === domainActions.length ? "Deselect all" : "Select all"}
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
