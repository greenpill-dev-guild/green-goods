import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { DEFAULT_CHAIN_ID } from "../../../config/blockchain";
import type { CreateActionFormData } from "../../action/useActionForm";
import { createActionSchema } from "../../action/useActionForm";
import { Domain } from "../../../types/domain";
import { defaultTemplate } from "../../../utils/action/templates";

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

export const createActionResolver = zodResolver(
  createActionSchema
) as Resolver<CreateActionFormData>;

export const ACTION_STEP_FIELDS: Partial<Record<string, (keyof CreateActionFormData)[]>> = {
  basics: ["title", "slug", "domain", "startTime", "endTime"],
  capitals: ["capitals"],
};
