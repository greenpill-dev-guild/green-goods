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
  DOMAIN_GUIDANCE,
  DOMAIN_ICON_CONFIG,
  domainKey,
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
  // Fallback so an unset/out-of-range persisted domain can't crash the step.
  // A restored draft can carry a stale `domain`; without this guard the later
  // `guidance.titlePlaceholder` deref throws on first render and the whole
  // Create Assessment dialog fails to open. Mirrors resolveDomainMetrics.
  const guidance = DOMAIN_GUIDANCE[selectedDomain] ?? DOMAIN_GUIDANCE[Domain.SOLAR];

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
        <AdminChoiceGroup
          ariaLabel={formatMessage({
            id: "app.admin.assessment.domainAction.domainTitle",
            defaultMessage: "Domain",
          })}
          columns={4}
          value={String(selectedDomain)}
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
            placeholder={formatMessage({
              id: domainKey("app.admin.assessment.domainContext.titlePlaceholder", selectedDomain),
              defaultMessage: guidance.titlePlaceholder,
            })}
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
            placeholder={formatMessage({
              id: domainKey(
                "app.admin.assessment.domainContext.locationPlaceholder",
                selectedDomain
              ),
              defaultMessage: guidance.locationPlaceholder,
            })}
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
          placeholder={formatMessage({
            id: domainKey(
              "app.admin.assessment.domainContext.descriptionPlaceholder",
              selectedDomain
            ),
            defaultMessage: guidance.descriptionPlaceholder,
          })}
          error={(showValidation && fieldErrors.description) || undefined}
          helperText={formatMessage({
            id: domainKey("app.admin.assessment.domainContext.descriptionHelp", selectedDomain),
            defaultMessage: guidance.descriptionHelp,
          })}
        />
      </Section>
    </div>
  );
}
