import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges className values with Tailwind CSS classes
 * Handles conditional classes and deduplicates conflicting utilities
 */
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export type { ClassValue };
