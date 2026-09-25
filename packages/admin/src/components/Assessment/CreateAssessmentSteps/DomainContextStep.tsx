import { useCreateAssessmentStore } from "@green-goods/shared/stores/useCreateAssessmentStore";
import { Domain } from "@green-goods/shared/types/domain";
import { expandDomainMask } from "@green-goods/shared/utils/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { AdminChoiceGroup } from "../../AdminChoiceGroup";
import { AdminTextArea, AdminTextField } from "../../AdminTextField";
import {
  ALL_DOMAINS,
  DOMAIN_ICON_CONFIG,
  formatDomainGuidance,
  knownDomain,
  resolveDomainLabel,
  Section,
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
 * Nothing is preselected, even for a garden with one domain: the steward
 * chooses it, as DL-047 asks.
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

  // Null until the steward chooses (DL-047), and for a restored draft's domain
  // that no longer exists or that this garden does not document. Placeholders
  // and examples follow a known domain; before one is chosen the fields show
  // neutral text.
  const restoredDomain = knownDomain(form.domain);
  const selectedDomain =
    restoredDomain !== null && availableDomains.includes(restoredDomain) ? restoredDomain : null;

  // A restored domain this garden does not document is cleared, so the step
  // asks for a domain instead of carrying one the steward cannot see.
  useEffect(() => {
    if (form.domain !== null && !availableDomains.includes(form.domain)) {
      setField("domain", null);
    }
  }, [availableDomains, form.domain, setField]);

  const handleDomainChange = (domain: Domain) => {
    if (isSubmitting) return;
    setField("domain", domain);
  };

  // Local validation errors, computed from store data
  const fieldErrors = useMemo(
    () => ({
      domain:
        selectedDomain !== null
          ? null
          : formatMessage({
              id: "app.admin.assessment.domainContext.domainRequired",
              defaultMessage: "Choose a domain",
            }),
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
    [selectedDomain, form.title, form.description, form.location, formatMessage]
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
        <AdminChoiceGroup
          ariaLabel={formatMessage({
            id: "app.admin.assessment.domainAction.domainTitle",
            defaultMessage: "Domain",
          })}
          columns={4}
          value={selectedDomain === null ? null : String(selectedDomain)}
          onChange={(next) => {
            if (!isSubmitting) handleDomainChange(Number(next) as Domain);
          }}
          options={availableDomains.map((domain) => ({
            value: String(domain),
            label: resolveDomainLabel(intl, domain),
            leadingVisual: (
              <i className={cn(DOMAIN_ICON_CONFIG[domain].icon, "text-base")} aria-hidden="true" />
            ),
            disabled: isSubmitting,
          }))}
        />
        {showValidation && fieldErrors.domain ? (
          <p role="alert" className="body-sm text-error-dark">
            {fieldErrors.domain}
          </p>
        ) : null}
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
          <AdminTextField
            label={formatMessage({
              id: "app.admin.assessment.strategyKernel.titleLabel",
              defaultMessage: "Title",
            })}
            required
            disabled={isSubmitting}
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder={formatDomainGuidance(
              intl,
              "app.admin.assessment.domainContext.titlePlaceholder",
              selectedDomain,
              (guidance) => guidance.titlePlaceholder
            )}
            error={(showValidation && fieldErrors.title) || undefined}
            helperText={formatMessage({
              id: "app.admin.assessment.strategyKernel.titleHelp",
              defaultMessage: "Summarise this assessment in a few words.",
            })}
          />
          <AdminTextField
            label={formatMessage({
              id: "app.admin.assessment.strategyKernel.locationLabel",
              defaultMessage: "Location",
            })}
            required
            disabled={isSubmitting}
            value={form.location}
            onChange={(e) => setField("location", e.target.value)}
            placeholder={formatDomainGuidance(
              intl,
              "app.admin.assessment.domainContext.locationPlaceholder",
              selectedDomain,
              (guidance) => guidance.locationPlaceholder
            )}
            error={(showValidation && fieldErrors.location) || undefined}
            helperText={formatMessage({
              id: "app.admin.assessment.strategyKernel.locationHelp",
              defaultMessage: "Where this assessment applies.",
            })}
          />
        </div>

        <AdminTextArea
          label={formatMessage({
            id: "app.admin.assessment.strategyKernel.descriptionLabel",
            defaultMessage: "Description",
          })}
          required
          rows={2}
          disabled={isSubmitting}
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder={formatDomainGuidance(
            intl,
            "app.admin.assessment.domainContext.descriptionPlaceholder",
            selectedDomain,
            (guidance) => guidance.descriptionPlaceholder
          )}
          error={(showValidation && fieldErrors.description) || undefined}
          helperText={
            formatDomainGuidance(
              intl,
              "app.admin.assessment.domainContext.descriptionHelp",
              selectedDomain,
              (guidance) => guidance.descriptionHelp
            ) ??
            formatMessage({
              id: "app.admin.assessment.domainContext.descriptionHelp",
              defaultMessage: "Describe the work, where it happens, and who it serves.",
            })
          }
        />
      </Section>
    </div>
  );
}
