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
import { slugSchema, type SlugFormValues } from "../../modules/ens/slug";

export { slugSchema, type SlugFormValues } from "../../modules/ens/slug";

export function useSlugForm(suggestedSlug?: string) {
  return useForm<SlugFormValues>({
    resolver: zodResolver(slugSchema),
    mode: "onChange",
    defaultValues: { slug: suggestedSlug ?? "" },
  });
}
