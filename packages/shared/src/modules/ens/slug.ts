import { z } from "zod";

const SLUG_MAX_LENGTH = 50;

/** Mirrors ENS._validateSlug and ENSReceiver._isValidSlug at the contract boundary. */
export const ensSlugSchema = z
  .string()
  .min(3, "Too short (min 3 characters)")
  .max(SLUG_MAX_LENGTH, "Too long (max 50 characters)")
  .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens")
  .refine((slug) => !/^-|-$/.test(slug), "Cannot start or end with hyphen")
  .refine((slug) => !slug.includes("--"), "No consecutive hyphens");

export const slugSchema = z.object({ slug: ensSlugSchema });
export type SlugFormValues = z.infer<typeof slugSchema>;

export interface SlugValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSlug(slug: string): SlugValidationResult {
  const result = ensSlugSchema.safeParse(slug);
  if (result.success) return { valid: true };

  // Preserve the utility's feedback order: length, hyphens, then characters.
  // Forms retain the schema's existing issue order (characters before hyphens).
  const issues = result.error.issues;
  const issue =
    issues.find((issue) => issue.code === "too_small" || issue.code === "too_big") ??
    issues.find((issue) => issue.code === "custom") ??
    issues[0];
  return { valid: false, error: issue.message };
}

/** Suggest an ENS registration slug from a display name, not a public URL slug. */
export function suggestSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, SLUG_MAX_LENGTH)
      // Trim after the cut: cutting at a separator would leave a trailing hyphen.
      .replace(/^-|-$/g, "")
  );
}
