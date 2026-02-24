import { cn, Domain } from "@green-goods/shared";
import { useEffect, useMemo } from "react";
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  useController,
} from "react-hook-form";
import { type IntlShape, useIntl } from "react-intl";
import {
  type CreateAssessmentForm,
  inputClassName,
  LabeledField,
  Section,
  textareaClassName,
} from "./shared";

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

interface DomainContextStepProps {
  register: UseFormRegister<CreateAssessmentForm>;
  errors: FieldErrors<CreateAssessmentForm>;
  control: Control<CreateAssessmentForm>;
  isSubmitting: boolean;
  /** Garden domain bitmask (bit 0=Solar, 1=Agro, 2=Edu, 3=Waste). If omitted, all domains shown. */
  gardenDomainMask?: number;
}

/**
 * Step 1: Domain & Context
 * Domain selector (from garden domain bitmask) + title, description, location.
 * Auto-selects domain when garden mask has exactly 1 domain.
 */
export function DomainContextStep({
  register,
  errors,
  control,
  isSubmitting,
  gardenDomainMask,
}: DomainContextStepProps) {
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

  const selectedDomain = Number(domainField.value) as Domain;

  // Auto-select domain when garden mask has exactly 1 domain
  useEffect(() => {
    if (availableDomains.length === 1 && selectedDomain !== availableDomains[0]) {
      domainField.onChange(availableDomains[0]);
    }
  }, [availableDomains, selectedDomain, domainField]);

  const handleDomainChange = (domain: Domain) => {
    if (isSubmitting) return;
    domainField.onChange(domain);
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

      {/* Context Fields */}
      <Section
        title={intl.formatMessage({
          id: "app.admin.assessment.domainContext.contextTitle",
          defaultMessage: "Assessment Context",
        })}
        description={intl.formatMessage({
          id: "app.admin.assessment.domainContext.contextDescription",
          defaultMessage: "Provide basic details about this assessment.",
        })}
      >
        <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
          <LabeledField
            label={intl.formatMessage({
              id: "app.admin.assessment.strategyKernel.titleLabel",
              defaultMessage: "Title",
            })}
            required
            error={errors.title?.message}
            helpText={intl.formatMessage({
              id: "app.admin.assessment.strategyKernel.titleHelp",
              defaultMessage: "Summarise this assessment in a few words.",
            })}
          >
            <input
              type="text"
              disabled={isSubmitting}
              className={inputClassName(errors.title)}
              {...register("title")}
            />
          </LabeledField>
          <LabeledField
            label={intl.formatMessage({
              id: "app.admin.assessment.strategyKernel.locationLabel",
              defaultMessage: "Location",
            })}
            required
            error={errors.location?.message}
            helpText={intl.formatMessage({
              id: "app.admin.assessment.strategyKernel.locationHelp",
              defaultMessage: "Where this assessment applies.",
            })}
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
          label={intl.formatMessage({
            id: "app.admin.assessment.strategyKernel.descriptionLabel",
            defaultMessage: "Description",
          })}
          required
          error={errors.description?.message}
          helpText={intl.formatMessage({
            id: "app.admin.assessment.strategyKernel.descriptionHelp",
            defaultMessage: "Provide context and goals for this assessment.",
          })}
        >
          <textarea
            rows={2}
            disabled={isSubmitting}
            className={textareaClassName(errors.description)}
            {...register("description")}
          />
        </LabeledField>
      </Section>
    </div>
  );
}
