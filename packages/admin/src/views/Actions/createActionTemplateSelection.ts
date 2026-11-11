import { ALL_DOMAINS, DOMAIN_SLUG_PREFIX } from "@green-goods/shared/utils/domain";
import type { ActionInstructionConfig, Domain } from "@green-goods/shared/types/domain";
import { instructionTemplates } from "@green-goods/shared/utils/action/templates";

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
  const domain = ALL_DOMAINS.find((value) => DOMAIN_SLUG_PREFIX[value] === prefix);
  if (domain === undefined) return null;

  return {
    slug,
    domain,
    instructionConfig: cloneInstructionTemplate(template),
  };
}
