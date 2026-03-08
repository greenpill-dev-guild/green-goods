/**
 * Create Garden Form Hook
 *
 * React Hook Form + Zod schema for garden creation validation.
 * Extracts validation from useCreateGardenStore.isStepValid() into a
 * declarative schema, enabling per-step trigger() validation in the wizard UI.
 *
 * @module hooks/garden/useCreateGardenForm
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Domain } from "../../types/domain";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum character length for garden names (enforced on-chain and in UI) */
export const GARDEN_NAME_MAX_LENGTH = 72;

// ---------------------------------------------------------------------------
// Address schema (Ethereum 0x-prefixed, 40 hex chars)
// ---------------------------------------------------------------------------

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

// ---------------------------------------------------------------------------
// Slug schema — matches contract _validateSlug() rules exactly
// (kept in sync with hooks/ens/useSlugForm.ts and utils/blockchain/ens.ts)
// ---------------------------------------------------------------------------

const gardenSlugSchema = z
  .string()
  .min(3, "Too short (min 3 characters)")
  .max(50, "Too long (max 50 characters)")
  .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens")
  .refine((s) => !/^-|-$/.test(s), "Cannot start or end with hyphen")
  .refine((s) => !s.includes("--"), "No consecutive hyphens");

// ---------------------------------------------------------------------------
// Garden creation schema
// ---------------------------------------------------------------------------

export const createGardenSchema = z.object({
  name: z
    .string()
    .min(1, "Garden name is required")
    .max(
      GARDEN_NAME_MAX_LENGTH,
      `Garden name must be ${GARDEN_NAME_MAX_LENGTH} characters or less`
    ),
  slug: gardenSlugSchema,
  description: z.string().min(1, "Description is required"),
  location: z.string().min(1, "Location is required"),
  bannerImage: z.string().optional().default(""),
  metadata: z.string().optional().default(""),
  openJoining: z.boolean().default(false),
  domains: z.array(z.nativeEnum(Domain)).min(1, "Select at least one domain"),
  gardeners: z.array(addressSchema).default([]),
  operators: z.array(addressSchema).default([]),
});

type CreateGardenFormInput = z.input<typeof createGardenSchema>;
type CreateGardenFormOutput = z.output<typeof createGardenSchema>;
export type CreateGardenFormData = CreateGardenFormInput;

// ---------------------------------------------------------------------------
// Per-step field maps for wizard trigger() validation
// ---------------------------------------------------------------------------

/**
 * Fields validated on each wizard step.
 * UI calls `trigger(gardenStepFields[stepId])` to validate only the current step.
 */
export const gardenStepFields = {
  details: ["name", "slug", "description", "location", "bannerImage", "domains"] as const,
  team: ["gardeners", "operators", "openJoining"] as const,
  review: [] as const,
} satisfies Record<string, readonly (keyof CreateGardenFormData)[]>;

export type GardenStepId = keyof typeof gardenStepFields;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export function createDefaultGardenForm(): CreateGardenFormInput {
  return {
    name: "",
    slug: "",
    description: "",
    location: "",
    bannerImage: "",
    metadata: "",
    openJoining: false,
    domains: [],
    gardeners: [],
    operators: [],
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCreateGardenForm() {
  return useForm<CreateGardenFormInput, unknown, CreateGardenFormOutput>({
    resolver: zodResolver(createGardenSchema),
    mode: "onTouched",
    defaultValues: createDefaultGardenForm(),
  });
}

export type UseCreateGardenFormReturn = ReturnType<typeof useCreateGardenForm>;
