import { createTV } from "tailwind-variants";
export type { VariantProps, ClassValue } from "tailwind-variants";

import { twMergeConfig } from "../utils/cn";

export const tv = createTV({
  twMergeConfig,
});
