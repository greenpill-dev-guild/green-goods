/**
 * Action Form Schema & Types
 *
 * Zod schema for creating actions, extracted from admin's CreateAction view
 * for reuse across CreateAction, EditAction, and tests.
 *
 * The actual React Hook Form integration (useActionForm hook) is planned
 * for a future iteration; this module provides the shared validation layer.
 */

import { z } from "zod";
import type { WorkInput } from "../../types/domain";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ACTION_DOMAINS = [0, 1, 2, 3] as const;
type ActionDomainValue = (typeof ACTION_DOMAINS)[number];

const DOMAIN_SLUG_PREFIX: Record<ActionDomainValue, string> = {
  0: "solar",
  1: "agro",
  2: "edu",
  3: "waste",
};

const workInputTypeSchema = z.enum([
  "text",
  "textarea",
  "select",
  "multi-select",
  "number",
  "band",
  "repeater",
]);

const instructionInputSchema: z.ZodType<WorkInput> = z.lazy(() =>
  z.object({
    key: z.string().min(1, "Field key is required"),
    title: z.string().min(1, "Field title is required"),
    placeholder: z.string(),
    type: workInputTypeSchema,
    required: z.boolean(),
    options: z.array(z.string()),
    bands: z.array(z.string()).optional(),
    unit: z.string().optional(),
    repeaterFields: z.array(instructionInputSchema).optional(),
  })
);

export const createActionSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .regex(/^[a-z]+\.[a-z_]+$/, 'Slug must use format "domain.action_name"'),
    domain: z.coerce
      .number()
      .int()
      .refine(
        (value): value is ActionDomainValue => ACTION_DOMAINS.includes(value as ActionDomainValue),
        "Select a valid domain"
      ),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    capitals: z.array(z.number()).min(1, "Select at least one capital"),
    media: z.array(z.instanceof(File)).min(1, "At least one image required"),
    instructionConfig: z.object({
      description: z.string(),
      uiConfig: z.object({
        media: z.object({
          title: z.string(),
          description: z.string(),
          maxImageCount: z.number(),
          minImageCount: z.number(),
          required: z.boolean(),
          needed: z.array(z.string()),
          optional: z.array(z.string()),
        }),
        details: z.object({
          title: z.string(),
          description: z.string(),
          feedbackPlaceholder: z.string(),
          inputs: z.array(instructionInputSchema),
        }),
        review: z.object({
          title: z.string(),
          description: z.string(),
        }),
      }),
    }),
  })
  .superRefine((data, ctx) => {
    const expectedPrefix = DOMAIN_SLUG_PREFIX[data.domain as ActionDomainValue];
    if (!data.slug.startsWith(`${expectedPrefix}.`)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: `Slug must start with "${expectedPrefix}." for the selected domain`,
      });
    }
  });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateActionFormData = z.infer<typeof createActionSchema>;
