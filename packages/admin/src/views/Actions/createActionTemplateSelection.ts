import { type ActionInstructionConfig, Domain, instructionTemplates } from "@green-goods/shared";

const TEMPLATE_DOMAIN_BY_PREFIX: Record<string, Domain> = {
  solar: Domain.SOLAR,
  agro: Domain.AGRO,
  edu: Domain.EDU,
  waste: Domain.WASTE,
};

function cloneInstructionTemplate(template: ActionInstructionConfig): ActionInstructionConfig {
  return typeof structuredClone === "function"
    ? structuredClone(template)
    : JSON.parse(JSON.stringify(template));
}

export interface CreateActionTemplateSelection {
  slug: string;
  domain: Domain;
  instructionConfig: ActionInstructionConfig;
}

export function resolveCreateActionTemplateSelection(
  slug: string
): CreateActionTemplateSelection | null {
  const template = instructionTemplates[slug];
  if (!template) return null;

  const prefix = slug.split(".")[0];
  const domain = TEMPLATE_DOMAIN_BY_PREFIX[prefix];
  if (domain === undefined) return null;

  return {
    slug,
    domain,
    instructionConfig: cloneInstructionTemplate(template),
  };
}
