import {
  type CreateActionFormData,
  createActionSchema,
  DEFAULT_CHAIN_ID,
  defaultTemplate,
  Domain,
} from "@green-goods/shared";
import { zodResolver } from "@hookform/resolvers/zod";

export const CREATE_ACTION_DEFAULT_CHAIN_ID = DEFAULT_CHAIN_ID;

export function createActionDefaultValues(): CreateActionFormData {
  return {
    title: "",
    slug: "",
    domain: Domain.SOLAR,
    startTime: new Date(),
    endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    capitals: [],
    media: [],
    instructionConfig: defaultTemplate,
  };
}

export const createActionResolver = zodResolver(createActionSchema);

export const ACTION_STEP_FIELDS: Partial<Record<string, (keyof CreateActionFormData)[]>> = {
  basics: ["title", "slug", "domain", "startTime", "endTime"],
  capitals: ["capitals"],
};
