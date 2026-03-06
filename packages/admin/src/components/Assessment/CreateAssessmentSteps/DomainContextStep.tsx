import { cn, Domain, expandDomainMask, useCreateAssessmentStore } from "@green-goods/shared";
import { useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import {
  ALL_DOMAINS,
  DOMAIN_GUIDANCE,
  DOMAIN_ICON_CONFIG,
  domainKey,
  inputClassName,
  LabeledField,
  resolveDomainLabel,
  Section,
  textareaClassName,
} from "./shared";

interface DomainContextStepProps {
  showValidation: boolean;
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
  showValidation,
  isSubmitting,
  gardenDomainMask,
}: DomainContextStepProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const form = useCreateAssessmentStore((s) => s.form);
  const setField = useCreateAssessmentStore((s) => s.setField);

  // Available domains from garden bitmask (or all if not provided)
  const availableDomains = useMemo(
    () =>
      gardenDomainMask !== undefined && gardenDomainMask !== null
        ? expandDomainMask(gardenDomainMask)
        : ALL_DOMAINS,
    [gardenDomainMask]
  );

  const selectedDomain = form.domain;
  const guidance = DOMAIN_GUIDANCE[selectedDomain];

  // Auto-select domain when garden mask has exactly 1 domain
  useEffect(() => {
    if (availableDomains.length === 1 && selectedDomain !== availableDomains[0]) {
      setField("domain", availableDomains[0]);
    }
  }, [availableDomains, selectedDomain, setField]);

  const handleDomainChange = (domain: Domain) => {
    if (isSubmitting) return;
    setField("domain", domain);
  };

  // Local validation errors, computed from store data
  const fieldErrors = useMemo(
    () => ({
      title:
        form.title.trim().length > 0
          ? null
          : formatMessage({
              id: "app.admin.assessment.domainContext.titleRequired",
              defaultMessage: "Title is required",
            }),
      description:
        form.description.trim().length > 0
          ? null
          : formatMessage({
              id: "app.admin.assessment.domainContext.descriptionRequired",
              defaultMessage: "Description is required",
            }),
      location:
        form.location.trim().length > 0
          ? null
          : formatMessage({
              id: "app.admin.assessment.domainContext.locationRequired",
              defaultMessage: "Location is required",
            }),
    }),
    [form.title, form.description, form.location, formatMessage]
  );

  return (
    <div className="space-y-6">
      {/* Domain Selector */}
      <Section
        title={formatMessage({
          id: "app.admin.assessment.domainAction.domainTitle",
          defaultMessage: "Domain",
        })}
        description={formatMessage({
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
      </Section>

      {/* Context Fields */}
      <Section
        title={formatMessage({
          id: "app.admin.assessment.domainContext.contextTitle",
          defaultMessage: "Assessment Context",
        })}
        description={formatMessage({
          id: "app.admin.assessment.domainContext.contextDescription",
          defaultMessage: "Provide basic details about this assessment.",
        })}
      >
        <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
          <LabeledField
            label={formatMessage({
              id: "app.admin.assessment.strategyKernel.titleLabel",
              defaultMessage: "Title",
            })}
            required
            error={showValidation ? fieldErrors.title : null}
            helpText={formatMessage({
              id: "app.admin.assessment.strategyKernel.titleHelp",
              defaultMessage: "Summarise this assessment in a few words.",
            })}
          >
            <input
              type="text"
              disabled={isSubmitting}
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder={formatMessage({
                id: domainKey(
                  "app.admin.assessment.domainContext.titlePlaceholder",
                  selectedDomain
                ),
                defaultMessage: guidance.titlePlaceholder,
              })}
              className={inputClassName(showValidation && !!fieldErrors.title)}
            />
          </LabeledField>
          <LabeledField
            label={formatMessage({
              id: "app.admin.assessment.strategyKernel.locationLabel",
              defaultMessage: "Location",
            })}
            required
            error={showValidation ? fieldErrors.location : null}
            helpText={formatMessage({
              id: "app.admin.assessment.strategyKernel.locationHelp",
              defaultMessage: "Where this assessment applies.",
            })}
          >
            <input
              type="text"
              disabled={isSubmitting}
              value={form.location}
              onChange={(e) => setField("location", e.target.value)}
              placeholder={formatMessage({
                id: domainKey(
                  "app.admin.assessment.domainContext.locationPlaceholder",
                  selectedDomain
                ),
                defaultMessage: guidance.locationPlaceholder,
              })}
              className={inputClassName(showValidation && !!fieldErrors.location)}
            />
          </LabeledField>
        </div>

        <LabeledField
          label={formatMessage({
            id: "app.admin.assessment.strategyKernel.descriptionLabel",
            defaultMessage: "Description",
          })}
          required
          error={showValidation ? fieldErrors.description : null}
          helpText={formatMessage({
            id: domainKey("app.admin.assessment.domainContext.descriptionHelp", selectedDomain),
            defaultMessage: guidance.descriptionHelp,
          })}
        >
          <textarea
            rows={2}
            disabled={isSubmitting}
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder={formatMessage({
              id: domainKey(
                "app.admin.assessment.domainContext.descriptionPlaceholder",
                selectedDomain
              ),
              defaultMessage: guidance.descriptionPlaceholder,
            })}
            className={textareaClassName(showValidation && !!fieldErrors.description)}
          />
        </LabeledField>
      </Section>
    </div>
  );
}
