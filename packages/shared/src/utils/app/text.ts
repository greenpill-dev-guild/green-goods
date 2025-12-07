export type FormatAddressVariant = "default" | "card" | "long";

export interface FormatAddressOptions {
  variant?: FormatAddressVariant;
  ensName?: string | null;
  fallbackLabel?: string;
}

/** Shortens an Ethereum address or ENS name for display in the UI. */
export const formatAddress = (
  address?: string | null,
  options: FormatAddressOptions = {}
): string => {
  const { variant = "default", ensName, fallbackLabel } = options;
  if (ensName) return ensName;
  if (!address) return fallbackLabel ?? "no address provided";
  if (address.includes(".eth")) return address;

  const slices = {
    default: { start: 6, end: 4 },
    card: { start: 4, end: 3 },
    long: { start: 8, end: 6 },
  } as const satisfies Record<FormatAddressVariant, { start: number; end: number }>;

  const { start, end } = slices[variant] ?? slices.default;
  if (address.length <= start + end) return address;

  const startSlice = address.slice(0, start);
  const endSlice = address.slice(address.length - end);
  return `${startSlice}...${endSlice}`;
};

/** Truncates a string and appends an ellipsis when it exceeds the provided length. */
export function truncate(str: string, n: number) {
  return str.length > n ? `${str.slice(0, n - 1)}...` : str;
}

/** Ensures the first character of a string is capitalized. */
export const capitalize = (s: string): string =>
  (s && String(s[0]).toUpperCase() + String(s).slice(1)) || "";
