/**
 * Slug Form Hook
 *
 * React Hook Form + Zod schema for ENS slug input validation.
 * Mirrors contract _validateSlug() rules exactly for instant client-side feedback.
 *
 * @module hooks/ens/useSlugForm
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

/**
 * Slug validation schema — must stay in sync with:
 * contracts/src/registries/ENS.sol _validateSlug(),
 * contracts/src/registries/ENSReceiver.sol _isValidSlug(),
 * shared/utils/blockchain/ens.ts validateSlug().
 */
export const slugSchema = z.object({
  slug: z
    .string()
    .min(3, "Too short (min 3 characters)")
    .max(50, "Too long (max 50 characters)")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens")
    .refine((s) => !/^-|-$/.test(s), "Cannot start or end with hyphen")
    .refine((s) => !s.includes("--"), "No consecutive hyphens"),
});

export type SlugFormValues = z.infer<typeof slugSchema>;

export function useSlugForm(suggestedSlug?: string) {
  return useForm<SlugFormValues>({
    resolver: zodResolver(slugSchema),
    mode: "onChange",
    defaultValues: { slug: suggestedSlug ?? "" },
  });
}
