import { type CreateAssessmentFormData, CynefinPhase, cn, Domain } from "@green-goods/shared";
import { type ReactNode } from "react";
import { type IntlShape, useIntl } from "react-intl";

// Re-export the form data type from shared for backwards compatibility
export type CreateAssessmentForm = CreateAssessmentFormData;

// ─── Domain Display Constants ────────────────────────────

/** Domain icon and color (stable), labels resolved via i18n */
export const DOMAIN_ICON_CONFIG: Record<Domain, { icon: string; color: string; labelId: string }> =
  {
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

export function resolveDomainLabel(intl: IntlShape, domain: Domain): string {
  const config = DOMAIN_ICON_CONFIG[domain];
  return intl.formatMessage({
    id: config.labelId,
    defaultMessage: DOMAIN_LABEL_DEFAULTS[config.labelId],
  });
}

/** All domains for when no mask is provided */
export const ALL_DOMAINS = [Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE];

// ─── Domain Guidance ─────────────────────────────────────

const DOMAIN_SLUGS: Record<Domain, string> = {
  [Domain.SOLAR]: "solar",
  [Domain.AGRO]: "agro",
  [Domain.EDU]: "edu",
  [Domain.WASTE]: "waste",
};

/** Resolve a domain-specific i18n key */
export function domainKey(base: string, domain: Domain): string {
  return `${base}.${DOMAIN_SLUGS[domain]}`;
}

/** Domain-specific guidance for wizard fields — placeholders and help text adapt to the selected domain */
export const DOMAIN_GUIDANCE: Record<
  Domain,
  {
    titlePlaceholder: string;
    locationPlaceholder: string;
    descriptionPlaceholder: string;
    descriptionHelp: string;
    diagnosisPlaceholder: string;
    diagnosisHelp: string;
    smartOutcomeExample: string;
    cynefinExamples: Record<CynefinPhase, string>;
  }
> = {
  [Domain.SOLAR]: {
    titlePlaceholder: "e.g., Kigali Community Solar — Phase 2 Deployment",
    locationPlaceholder: "e.g., Kigali, Rwanda — Sector 5 hub network",
    descriptionPlaceholder:
      "What solar energy challenge is being addressed? What scale of deployment is involved and who benefits?",
    descriptionHelp:
      "Describe the energy access situation, infrastructure being deployed, and target community.",
    diagnosisPlaceholder:
      "e.g., Rural households in Sector 5 rely on diesel generators averaging 4 hours daily. High fuel cost ($12/week) limits productive electricity use and creates indoor health risks...",
    diagnosisHelp:
      "What energy access gap or infrastructure challenge are you addressing? What are the root causes?",
    smartOutcomeExample: "e.g., Generate 500 kWh/month from newly installed panels",
    cynefinExamples: {
      [CynefinPhase.CLEAR]:
        "Standard rooftop installation with proven equipment and trained installers.",
      [CynefinPhase.COMPLICATED]:
        "Grid-tied system requiring utility negotiations and custom inverter sizing.",
      [CynefinPhase.COMPLEX]: "First off-grid deployment in region with unknown demand patterns.",
      [CynefinPhase.CHAOTIC]:
        "Emergency solar deployment after natural disaster, no infrastructure baseline.",
    },
  },
  [Domain.AGRO]: {
    titlePlaceholder: "e.g., Cerrado Reforestation — Q1 Planting Assessment",
    locationPlaceholder: "e.g., Alto Paraíso, Goiás — Farm cooperative lot 3",
    descriptionPlaceholder:
      "What land area and species are being assessed? What ecological or agricultural challenge does this address?",
    descriptionHelp:
      "Describe the site conditions, species mix, and restoration or production goals.",
    diagnosisPlaceholder:
      "e.g., Degraded pastureland from cattle overgrazing has reduced soil organic matter to <1%. Native species corridors are fragmented, limiting pollinator pathways...",
    diagnosisHelp:
      "What land degradation, biodiversity loss, or agricultural challenge are you addressing?",
    smartOutcomeExample: "e.g., Plant 200 native species seedlings across 5 hectares",
    cynefinExamples: {
      [CynefinPhase.CLEAR]:
        "Monoculture planting with established nursery stock and known survival rates.",
      [CynefinPhase.COMPLICATED]:
        "Multi-species agroforestry design requiring soil analysis and spacing models.",
      [CynefinPhase.COMPLEX]:
        "Restoration of degraded land with unknown seed bank and variable rainfall.",
      [CynefinPhase.CHAOTIC]: "Post-fire restoration with no baseline data and active erosion.",
    },
  },
  [Domain.EDU]: {
    titlePlaceholder: "e.g., Field Worker Training — Solar Maintenance Certification",
    locationPlaceholder: "e.g., Medellín, Colombia — Community learning center",
    descriptionPlaceholder:
      "What training or educational program is being assessed? Who are the learners and what skills are targeted?",
    descriptionHelp: "Describe the training program, target audience, and learning objectives.",
    diagnosisPlaceholder:
      "e.g., Field operators lack standardized training on solar panel maintenance, leading to 35% system degradation in year 1. Knowledge transfer relies on informal peer learning...",
    diagnosisHelp:
      "What knowledge or skills gap exists? What are the consequences of not addressing it?",
    smartOutcomeExample: "e.g., Train 30 field operators to maintenance certification level",
    cynefinExamples: {
      [CynefinPhase.CLEAR]:
        "Standardized curriculum with certified instructors and known pass rates.",
      [CynefinPhase.COMPLICATED]:
        "Custom training for multiple skill levels requiring needs assessment.",
      [CynefinPhase.COMPLEX]:
        "Community-led learning with variable literacy and no prior baseline.",
      [CynefinPhase.CHAOTIC]:
        "Emergency response training during active crisis with shifting needs.",
    },
  },
  [Domain.WASTE]: {
    titlePlaceholder: "e.g., Dharavi Riverbank Cleanup — Monthly Impact Review",
    locationPlaceholder: "e.g., Dharavi, Mumbai — Mithi River corridor (2km stretch)",
    descriptionPlaceholder:
      "What waste management challenge is being tracked? What materials and community are involved?",
    descriptionHelp: "Describe the waste stream, collection infrastructure, and target outcomes.",
    diagnosisPlaceholder:
      "e.g., Unmanaged plastic waste accumulates along 2km of riverbank at 500kg/week. No formal collection infrastructure exists. Local informal recyclers recover <10% of recyclables...",
    diagnosisHelp:
      "What waste accumulation or management gap are you addressing? What are the root causes?",
    smartOutcomeExample: "e.g., Divert 2 tonnes of recyclable waste from landfill per month",
    cynefinExamples: {
      [CynefinPhase.CLEAR]:
        "Established collection routes with trained sorters and known buyer network.",
      [CynefinPhase.COMPLICATED]:
        "Multi-stream sorting requiring material analysis and market research.",
      [CynefinPhase.COMPLEX]: "New upcycling program with unknown community adoption patterns.",
      [CynefinPhase.CHAOTIC]:
        "Waste crisis response with no existing infrastructure or baseline data.",
    },
  },
};

// ─── Helper Components ───────────────────────────────────

interface LabeledFieldProps {
  label: string;
  required?: boolean;
  error?: string | null;
  helpText?: string;
  children: ReactNode;
}

export function LabeledField({ label, required, error, helpText, children }: LabeledFieldProps) {
  return (
    <label className="space-y-0.5 text-sm">
      <span className="font-medium text-text-sub">
        {label}
        {required ? <span className="ml-1 text-error-base">*</span> : null}
      </span>
      {helpText ? <span className="block text-xs text-text-soft">{helpText}</span> : null}
      {children}
      {/* Always render to reserve space and prevent layout shift */}
      <span className="block min-h-[1.25rem] text-xs text-error-dark">{error || "\u00A0"}</span>
    </label>
  );
}

/** Input class name utility — accepts a boolean error flag instead of RHF FieldError */
export const inputClassName = (hasError?: boolean) =>
  cn(
    "mt-1 w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong shadow-sm transition focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-16",
    hasError && "border-error-light focus:border-error-base focus:ring-error-lighter"
  );

/** Textarea class name utility — accepts a boolean error flag instead of RHF FieldError */
export const textareaClassName = (hasError?: boolean) =>
  cn(
    "mt-1 w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong shadow-sm transition focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-alpha-16",
    hasError && "border-error-light focus:border-error-base focus:ring-error-lighter"
  );

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-text-strong">{title}</h3>
        <p className="mt-0.5 text-sm text-text-soft">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ReviewRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value?: string | null;
  multiline?: boolean;
}) {
  const intl = useIntl();
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-text-soft">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm text-text-sub",
          multiline ? "whitespace-pre-wrap break-words" : "truncate"
        )}
      >
        {value && value.trim().length > 0
          ? value
          : intl.formatMessage({
              id: "admin.assessment.review.notProvided",
              defaultMessage: "Not provided",
            })}
      </p>
    </div>
  );
}

export function formatDateRange(start?: string | number | null, end?: string | number | null) {
  if (!start && !end) return "Not provided";

  const formatValue = (value?: string | number | null) => {
    if (!value) return undefined;
    if (typeof value === "string" && value.includes("-")) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString();
    }
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!numeric) return undefined;
    const timestamp = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString();
  };

  const startLabel = formatValue(start);
  const endLabel = formatValue(end);

  if (startLabel && endLabel) {
    return `${startLabel} – ${endLabel}`;
  }
  return startLabel ?? endLabel ?? "Not provided";
}
