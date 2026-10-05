import { CynefinPhase, Domain } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type ReactNode } from "react";
import { type IntlShape, useIntl } from "react-intl";

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

/**
 * A domain the guidance knows, or null: nothing is preselected (DL-047), and a
 * restored draft can carry a stale value. Either way the steps show neutral
 * text instead of falling back to one domain's examples.
 */
export function knownDomain(domain: Domain | null | undefined): Domain | null {
  return domain !== null && domain !== undefined && domain in DOMAIN_SLUGS ? domain : null;
}

/** A domain's placeholder or example text; undefined until a known domain is chosen. */
export function formatDomainGuidance(
  intl: IntlShape,
  base: string,
  domain: Domain | null,
  pick: (guidance: DomainGuidance) => string
): string | undefined {
  const known = knownDomain(domain);
  if (known === null) return undefined;
  return intl.formatMessage({
    id: domainKey(base, known),
    defaultMessage: pick(DOMAIN_GUIDANCE[known]),
  });
}

interface DomainGuidance {
  titlePlaceholder: string;
  locationPlaceholder: string;
  descriptionPlaceholder: string;
  descriptionHelp: string;
  diagnosisPlaceholder: string;
  smartOutcomeExample: string;
  cynefinExamples: Record<CynefinPhase, string>;
}

/** Domain-specific guidance for wizard fields — placeholders and help text adapt to the selected domain */
export const DOMAIN_GUIDANCE: Record<Domain, DomainGuidance> = {
  [Domain.SOLAR]: {
    titlePlaceholder: "e.g., Kigali Community Solar — Phase 2 Deployment",
    locationPlaceholder: "e.g., Kigali, Rwanda — Sector 5 hub network",
    descriptionPlaceholder:
      "What solar energy challenge is being addressed? What scale of deployment is involved and who benefits?",
    descriptionHelp:
      "Describe the energy access situation, infrastructure being deployed, and target community.",
    diagnosisPlaceholder:
      "e.g., Rural households in Sector 5 rely on diesel generators averaging 4 hours daily. High fuel cost ($12/week) limits productive electricity use and creates indoor health risks...",
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

// (LabeledField retired 2026-08-30 — assessment steps use the admin field
// family: AdminTextField/AdminTextArea/AdminSelect/AdminFieldGroup.)

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  /** What the section asks for. The Review's sections restate answers, so they carry none. */
  description?: string;
  /**
   * The section's one act, a compact button such as the Add for its list. It
   * sits at the end of the title row, above the list, so the list growing
   * never moves it.
   */
  action?: ReactNode;
  children: ReactNode;
}) {
  const heading = <h3 className="min-w-0 text-title-md font-semibold text-text-strong">{title}</h3>;
  return (
    <section className="space-y-3">
      <div>
        {action ? (
          <div className="flex items-start justify-between gap-3">
            {heading}
            {/* A 28px button sits on the title's 24px line with the 6px a compact
                button reserves around its finger box. That room is taken back
                here, where nothing beside it can be pressed, so the header stays
                as tall as a section without an act. */}
            <div className="-my-2 flex shrink-0">{action}</div>
          </div>
        ) : (
          heading
        )}
        {description ? <p className="mt-0.5 body-sm text-text-soft">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * One answer on the Review step: its label over its value, wrapped in full so
 * nothing the attestation carries is cut short. A list of answers goes in as
 * children; an answer left empty reads "Not provided". Rows sit in a `<dl>`.
 */
export function ReviewRow({
  label,
  value,
  wide = false,
  children,
}: {
  label: string;
  value?: string | null;
  /** Long text: the row takes the section's full width. */
  wide?: boolean;
  children?: ReactNode;
}) {
  const intl = useIntl();
  const provided = Boolean(children) || Boolean(value && value.trim().length > 0);
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="label-xs text-text-soft">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 whitespace-pre-wrap break-words body-sm",
          provided ? "text-text-strong" : "text-text-soft"
        )}
      >
        {provided
          ? (children ?? value)
          : intl.formatMessage({
              id: "admin.assessment.review.notProvided",
              defaultMessage: "Not provided",
            })}
      </dd>
    </div>
  );
}
