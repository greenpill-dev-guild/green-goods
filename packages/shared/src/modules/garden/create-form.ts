import { z } from "zod";
import { ensSlugSchema } from "../ens/slug";

import { Domain } from "../../types/domain";
import { utf8ByteLength } from "../../utils/app/text";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The longest garden name, in UTF-8 bytes: GardenAccount reverts `NameTooLong`
 * past it, on create and on rename. An accented letter takes two bytes, so a
 * name can reach the limit in fewer characters. As a field's `maxLength` it
 * still caps the characters, which never cuts a name that fits the bytes.
 */
export const GARDEN_NAME_MAX_LENGTH = 72;

/** Whether a name fits what the contract stores: trimmed, as create and rename send it. */
export function gardenNameFits(name: string): boolean {
  return utf8ByteLength(name.trim()) <= GARDEN_NAME_MAX_LENGTH;
}

// ---------------------------------------------------------------------------
// Address schema (Ethereum 0x-prefixed, 40 hex chars)
// ---------------------------------------------------------------------------

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

// ---------------------------------------------------------------------------
// Garden creation schema
// ---------------------------------------------------------------------------

export const createGardenSchema = z.object({
  name: z
    .string()
    .min(1, "Garden name is required")
    .refine(gardenNameFits, `Garden name must fit in ${GARDEN_NAME_MAX_LENGTH} bytes`),
  slug: ensSlugSchema,
  description: z.string().min(1, "Description is required"),
  location: z.string().min(1, "Location is required"),
  bannerImage: z.string().optional().default(""),
  metadata: z.string().optional().default(""),
  openJoining: z.boolean().default(false),
  domains: z.array(z.nativeEnum(Domain)).min(1, "Select at least one domain"),
  gardeners: z.array(addressSchema).default([]),
  stewards: z.array(addressSchema).default([]),
});

export type CreateGardenFormInput = z.input<typeof createGardenSchema>;
export type CreateGardenFormOutput = z.output<typeof createGardenSchema>;
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
  team: ["gardeners", "stewards", "openJoining"] as const,
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
    stewards: [],
  };
}
