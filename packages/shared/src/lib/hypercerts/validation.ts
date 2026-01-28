import { validateMetaData as sdkValidateMetaData } from "@hypercerts-org/sdk";
import { z } from "zod";

import type { HypercertMetadata } from "../../types/hypercerts";
import { TOTAL_UNITS } from "./constants";

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address format");

export const allowlistEntrySchema = z.object({
  address: addressSchema,
  units: z.bigint().positive(),
  label: z.string().optional(),
});

export const allowlistSchema = z
  .array(allowlistEntrySchema)
  .min(1, "Allowlist must include at least one entry")
  .refine(
    (entries) => entries.reduce((sum, entry) => sum + entry.units, 0n) === TOTAL_UNITS,
    `Total units must equal ${TOTAL_UNITS.toString()}`
  );

export const scopeDefinitionSchema = z.object({
  name: z.string().min(1),
  value: z.array(z.string().min(1)).min(1),
  excludes: z.array(z.string().min(1)).optional(),
  display_value: z.string().min(1).optional(),
});

export const timeframeDefinitionSchema = z
  .object({
    name: z.string().min(1),
    value: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
    display_value: z.string().min(1),
  })
  .refine(
    (data) => {
      const [start, end] = data.value;
      // Allow end = 0 to represent an indefinite/ongoing timeframe
      if (end === 0) return true;
      // Otherwise, start must be <= end
      return start <= end;
    },
    {
      message: "Timeframe start must be before or equal to end (or end = 0 for indefinite)",
      path: ["value"],
    }
  );

export const propertyDefinitionSchema = z.object({
  trait_type: z.string().min(1),
  value: z.union([z.string(), z.number()]),
});

export const attestationRefSchema = z.object({
  uid: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  title: z.string().min(1),
  domain: z.string().optional(),
});

export const outcomeMetricsSchema = z.object({
  predefined: z.record(
    z.string(),
    z.object({
      value: z.number(),
      unit: z.string().min(1),
      aggregation: z.enum(["sum", "count", "average", "max"]),
      label: z.string().min(1),
    })
  ),
  custom: z.record(
    z.string(),
    z.object({
      value: z.number(),
      unit: z.string().min(1),
      label: z.string().min(1),
    })
  ),
});

export const greenGoodsExtensionSchema = z.object({
  gardenId: z.string().min(1),
  attestationRefs: z.array(attestationRefSchema).min(1),
  sdgs: z.array(z.number().int().min(1).max(17)),
  capitals: z.array(z.string().min(1)),
  outcomes: outcomeMetricsSchema,
  domain: z.string(),
  karmaGapProjectId: z.string().optional(),
  protocolVersion: z.string().min(1),
});

export const hypercertMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  image: z.string().min(1),
  external_url: z.string().optional(),
  hypercert: z.object({
    work_scope: scopeDefinitionSchema,
    impact_scope: scopeDefinitionSchema,
    work_timeframe: timeframeDefinitionSchema,
    impact_timeframe: timeframeDefinitionSchema,
    contributors: scopeDefinitionSchema,
    rights: scopeDefinitionSchema,
  }),
  properties: z.array(propertyDefinitionSchema).optional(),
  hidden_properties: greenGoodsExtensionSchema.optional(),
});

function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "unknown";
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

export function validateMetadata(metadata: HypercertMetadata): {
  valid: boolean;
  errors: Record<string, string>;
} {
  // The SDK schema uses additionalProperties: false, so we must strip
  // our Green Goods extension (hidden_properties) before validation.
  // The SDK only validates the standard Hypercert fields.
  const { hidden_properties, ...sdkMetadata } = metadata;
  const sdkResult = sdkValidateMetaData(sdkMetadata);
  const errors: Record<string, string> = {};

  if (!sdkResult.valid) {
    for (const [field, message] of Object.entries(sdkResult.errors ?? {})) {
      errors[field] = Array.isArray(message) ? message.join(", ") : String(message);
    }
  }

  if (metadata.hidden_properties) {
    const extensionResult = greenGoodsExtensionSchema.safeParse(metadata.hidden_properties);
    if (!extensionResult.success) {
      const extensionErrors = formatZodErrors(extensionResult.error);
      for (const [field, message] of Object.entries(extensionErrors)) {
        errors[`hidden_properties.${field}`] = message;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
