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

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const instructionInputSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
});

export const createActionSchema = z.object({
  title: z.string().min(1, "Title is required"),
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
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateActionFormData = z.infer<typeof createActionSchema>;
